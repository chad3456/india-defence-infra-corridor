/**
 * India's sacred geography, as far as the open record actually supports it.
 *
 * `npm run sacred:ingest`. Writes data/sacred/atlas.json.
 *
 * ── Why this is not one query ────────────────────────────────────────────
 *
 * The obvious version asks Wikidata for temples with their coordinates, deity,
 * founding date and heritage listing in a single SELECT with four OPTIONALs.
 * That version is slower, fails as one unit, and — because each OPTIONAL
 * multiplies rows — hands back a result whose row count means nothing. This
 * one asks four cheap questions and joins them here, where a join can be
 * checked. The spine (item, label, coordinates) is fetched in pages and is the
 * only part that must succeed; a missing dedication, date or heritage listing
 * leaves a null, not a hole in the map.
 *
 * ── The dedication problem, which is the whole design ────────────────────
 *
 * The user asked to see temples by deity — Shiva, Durga, and the rest. The
 * probe says that axis cannot be built from Wikidata statements alone and says
 * so with numbers: of 16,042 Hindu temples in India, 3,492 carry coordinates
 * and roughly 590 carry P825 "dedicated to". Within that 590, Shiva holds 479.
 * That is not a finding about India. It is the shape of a bulk import, and a
 * pie chart drawn from it would say "81% of Indian temples are Shiva's" with
 * complete confidence and no basis.
 *
 * So dedication is carried in three tiers that are never added together:
 *
 *   stated     Wikidata P825 says so. Strongest, rarest.
 *   canonical  The site is named in a tradition's own list — one of the twelve
 *              Jyotirlingas, the 108 Divya Desams, the Shakta Pithas, the
 *              Pancharama Kshetras. This is a textual tradition making a
 *              claim about itself, which is exactly the right kind of evidence
 *              for a question about tradition.
 *   named      The site's own name contains the god's. Weakest: an inference
 *              from philology, useful in aggregate, wrong often enough that it
 *              must never be shown as a statement.
 *
 * The page prints the tier on every figure. A reader who wants only what is
 * stated can have it; a reader who wants the fuller picture can have that too,
 * knowing what it cost.
 *
 * ── Where counting starts ────────────────────────────────────────────────
 *
 * Nothing here reconstructs a population before the colonial censuses. The
 * Rajatarangini is a dynastic chronicle, not an enumeration.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import { getText } from "../lib/http";
import { parseTables, plain } from "../lib/wikitext";
import { isEntryPoint } from "../lib/entry";

const ROOT = process.cwd();
const OUT = join(ROOT, "data", "sacred", "atlas.json");
const STATE_FILE = join(ROOT, "data", "geo", "india-states.topo.json");
const WDQS = "https://query.wikidata.org/sparql";
const WIKI = "https://en.wikipedia.org/w/api.php";

/** Page size for the spine. Small enough to finish, large enough to be four calls. */
const PAGE = 1200;
/** A stop, so a query that starts returning forever cannot run the job out. */
const MAX_PAGES = 12;

export interface Dedication {
  figure: string;
  /** How we know. Never blended — see the file docblock. */
  basis: "stated" | "canonical" | "named";
  /** For canonical: which tradition's list names it. */
  via?: string;
}

export interface Site {
  qid: string;
  name: string;
  lat: number;
  lon: number;
  /** Assigned here by point-in-polygon, not asked of Wikidata. */
  state: string | null;
  dedications: Dedication[];
  inception: string | null;
  heritage: string | null;
}

interface Row { [k: string]: string }

/** Run one SPARQL query and return its bindings flattened to plain strings. */
async function sparql(q: string, label: string): Promise<Row[] | null> {
  const url = `${WDQS}?format=json&query=${encodeURIComponent(q)}`;
  const res = await getText(url, {
    cacheMs: 6 * 3600_000,
    retries: 1,
    timeoutMs: 70_000,
    accept: "application/sparql-results+json",
  });
  if (!res.ok || !res.data) {
    console.log(`  ${label}: ${res.error ?? "failed"}`);
    return null;
  }
  try {
    const j = JSON.parse(res.data) as {
      results?: { bindings?: Array<Record<string, { value?: string }>> };
    };
    return (j.results?.bindings ?? []).map((row) => {
      const out: Row = {};
      for (const [k, v] of Object.entries(row)) {
        out[k] = (v?.value ?? "").replace(/^https?:\/\/www\.wikidata\.org\/entity\//, "");
      }
      return out;
    });
  } catch {
    console.log(`  ${label}: response was not JSON`);
    return null;
  }
}

/**
 * The spine: every Hindu temple in India that carries coordinates.
 *
 * ORDER BY ?item is not decoration — OFFSET without a total order gives no
 * guarantee that page two continues where page one stopped, and a paged fetch
 * over an unordered result can silently repeat and silently skip.
 */
function spineQuery(offset: number): string {
  return `
SELECT ?item ?itemLabel ?coord WHERE {
  ?item wdt:P31/wdt:P279* wd:Q842402 ; wdt:P17 wd:Q668 ; wdt:P625 ?coord .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?item
LIMIT ${PAGE}
OFFSET ${offset}`;
}

/** P825, the only property that actually states a temple's dedication. */
const DEDICATION_QUERY = `
SELECT ?item ?dLabel WHERE {
  ?item wdt:P31/wdt:P279* wd:Q842402 ; wdt:P17 wd:Q668 ; wdt:P825 ?d .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;

/** Founding date and heritage listing, asked separately so neither can break the map. */
const DETAIL_QUERY = `
SELECT ?item ?inception ?heritageLabel WHERE {
  ?item wdt:P31/wdt:P279* wd:Q842402 ; wdt:P17 wd:Q668 ; wdt:P625 ?c .
  OPTIONAL { ?item wdt:P571 ?inception . }
  OPTIONAL { ?item wdt:P1435 ?heritage . }
  FILTER (BOUND(?inception) || BOUND(?heritage))
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;

/** "Point(77.216 28.667)" — longitude first, which is the trap in this format. */
function parsePoint(wkt: string): { lat: number; lon: number } | null {
  const m = wkt.match(/Point\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i);
  if (!m) return null;
  const lon = Number(m[1]), lat = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

/**
 * India's bounding box, generously drawn.
 *
 * Not a border and not used as one — a site inside this box is still placed by
 * polygon, and this only decides whether the coordinates are worth believing.
 * Two sites in the first live run were not: a Venkatachalapathy temple whose
 * latitude is correct for Tamil Nadu and whose longitude puts it in the Gulf
 * of Thailand, and a Sri Muthumariyamman temple sitting in Liverpool — a real
 * Tamil temple in England, carrying "country: India" on Wikidata.
 *
 * Both are upstream errors, and neither should fail a build forever. They are
 * dropped and counted instead. The count is the safeguard: WKT writes
 * longitude first, so a positional misread would put every site in the Indian
 * Ocean and reject nearly all of them, which is loud in a way that a silent
 * filter would not be.
 */
const BOX = { minLat: 6, maxLat: 37.6, minLon: 67, maxLon: 97.5 };

function inIndia(lat: number, lon: number): boolean {
  return lat >= BOX.minLat && lat <= BOX.maxLat && lon >= BOX.minLon && lon <= BOX.maxLon;
}

/**
 * The canonical sets, and the one thing this must not get wrong.
 *
 * These come from wikitext, and that was decided on evidence rather than
 * taste. Wikidata models canon membership with P31/P361/P1269, so the first
 * plan was to query it: resolve each group from its article title and ask for
 * its members. The probe did exactly that and got ten members in total across
 * all six traditions — one Jyotirlinga of twelve, two Divya Desams of a
 * hundred and eight. The structured route is empty, so the articles it is.
 *
 * ── The mistake worth naming ─────────────────────────────────────────────
 *
 * It is tempting to treat every canonical set as a deity: twelve Jyotirlingas
 * are Shiva's, a hundred and eight Divya Desams are Vishnu's, and so on. Two
 * of these six are not deity sets at all. The Char Dham spans Badrinath and
 * Dwarka and Puri, which are Vishnu's, and Rameswaram, which is Shiva's; the
 * Chota Char Dham adds Yamunotri and Gangotri, which are river goddesses.
 * They are pilgrimage circuits, and assigning either of them a single god
 * would file Rameswaram under Vishnu on the strength of a tidy rule.
 *
 * So `deity` is nullable, and a set with none contributes membership without
 * contributing a dedication. The count is checked too: a tradition whose
 * article stops parsing should fail the run rather than quietly shrink.
 */
interface Tradition {
  id: string;
  page: string;
  label: string;
  /** The figure every member is dedicated to, or null when the set spans several. */
  deity: string | null;
  /** How many members the tradition itself claims. */
  expect: { min: number; max: number };
  note: string;
}

const TRADITIONS: Tradition[] = [
  {
    id: "jyotirlinga", page: "Jyotirlinga", label: "Jyotirlinga", deity: "Shiva",
    expect: { min: 12, max: 12 },
    note: "Twelve, on every reckoning.",
  },
  {
    id: "divya-desam", page: "Divya Desam", label: "Divya Desam", deity: "Vishnu",
    expect: { min: 90, max: 110 },
    note: "108 shrines praised by the Alvars; two are not on earth, so a placeable count is lower.",
  },
  {
    id: "shakta-pitha", page: "Shakta pithas", label: "Shakta Pitha", deity: "Shakti",
    expect: { min: 30, max: 120 },
    note: "51 in one reckoning and 108 in another, and the sites assigned differ between them.",
  },
  {
    id: "pancharama", page: "Pancharama Kshetras", label: "Pancharama Kshetra", deity: "Shiva",
    expect: { min: 5, max: 5 },
    note: "Five, in coastal Andhra.",
  },
  {
    id: "char-dham", page: "Char Dham", label: "Char Dham", deity: null,
    expect: { min: 4, max: 4 },
    note: "A circuit spanning three Vishnu sites and one of Shiva's, so it names no single god.",
  },
  {
    id: "chota-char-dham", page: "Chota Char Dham", label: "Chota Char Dham", deity: null,
    expect: { min: 4, max: 4 },
    note: "Yamunotri and Gangotri are river goddesses; Kedarnath is Shiva's and Badrinath Vishnu's.",
  },
];

export interface CanonMember {
  /** The name as the tradition's own article writes it. */
  name: string;
  /** The atlas site it was matched to, if any. */
  qid: string | null;
}

export interface CanonSet {
  id: string;
  label: string;
  deity: string | null;
  note: string;
  claimed: number;
  placed: number;
  members: CanonMember[];
  /** Why this tradition's parse is not to be trusted, when it is not. */
  problems?: string[];
}

async function wikitext(page: string): Promise<string | null> {
  const url = `${WIKI}?action=parse&page=${encodeURIComponent(page)}` +
    "&redirects=1&prop=wikitext&formatversion=2&format=json";
  const res = await getText(url, { cacheMs: 6 * 3600_000, retries: 2, timeoutMs: 45_000 });
  if (!res.ok || !res.data) return null;
  try {
    const j = JSON.parse(res.data) as { parse?: { wikitext?: string } };
    return j.parse?.wikitext ?? null;
  } catch {
    return null;
  }
}

/**
 * The display name out of a wiki link, or the leading plain text of a cell.
 *
 * `[[Somnath temple|Somnath]]` is Somnath. A bare `[[Kedarnath Temple]]` is
 * Kedarnath Temple with any disambiguator dropped. A file or category link is
 * a picture or a tag, never a site, and the arsenal catalogue learned that the
 * hard way by listing a photo caption as a missile.
 */
function linkName(cell: string): string | null {
  if (/\[\[\s*(file|image|category)\s*:/i.test(cell)) return null;
  const piped = cell.match(/\[\[([^\]|]+)\|([^\]]+)\]\]/);
  if (piped) return piped[2]!.trim();
  const bare = cell.match(/\[\[([^\]|]+)\]\]/);
  if (bare) return bare[1]!.replace(/\s*\(.*?\)\s*$/, "").trim();
  const text = plain(cell).trim();
  return text.length >= 3 && text.length <= 60 ? text : null;
}

/** Names for matching: lowercase, no punctuation, no "temple"/"shrine" suffix. */
function matchKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(temple|templo|shrine|mandir|kovil|koil|kshetra|tirtha|dham|jyotirlinga)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Member names out of one tradition's article.
 *
 * The first version unioned the names from every table on the page and fell
 * back to every bullet in the article. It produced counts that looked right
 * and content that was not: twelve names for the Jyotirlingas, of which one
 * matched a real temple, and nine for the Char Dham, which has four. A count
 * can be correct for the wrong reason, and on a page like this the wrong
 * reason is usually a navbox.
 *
 * So this picks *one* table — the one whose row count sits closest to what the
 * tradition claims about itself — rather than pooling all of them. An article
 * about the Char Dham that also tabulates the Chota Char Dham has two
 * plausible tables, and the right answer is to choose, not to add.
 *
 * The name column is resolved by what its header says, never by position, and
 * the header vocabulary has to include what these articles actually use:
 * "Jyotirlinga", "Divya Desam", "Peetham", "Abode" and the rest are names of
 * sites in exactly the way "Name" is.
 */
const NAME_COL =
  /^\s*(name|temple|shrine|site|kshetra|kshetram|pitha|peetha|peetham|dham|abode|place|location|jyotirlinga|linga|desam|divya|deity|sthala|tirtha)/i;

/** Bullets that are navigation rather than content. */
const NOT_CONTENT = /^(see also|references|external links|further reading|notes|bibliography)/i;

function canonNames(text: string, want: { min: number; max: number }): string[] {
  const target = (want.min + want.max) / 2;

  const fromRows = (rows: string[][], col: number): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const row of rows) {
      const n = linkName(row[col] ?? "");
      if (!n) continue;
      const k = matchKey(n);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(n);
    }
    return out;
  };

  // Every table that has a column plausibly naming a site.
  const candidates: string[][] = [];
  for (const t of parseTables(text)) {
    const col = t.headers.findIndex((h) => NAME_COL.test(h));
    if (col < 0) continue;
    const names = fromRows(t.rows, col);
    if (names.length > 0) candidates.push(names);
  }

  if (candidates.length > 0) {
    // Closest to the claimed size, with the larger table breaking a tie: a
    // page's main list is rarely the smallest thing on it.
    candidates.sort((a, b) =>
      Math.abs(a.length - target) - Math.abs(b.length - target) || b.length - a.length);
    const best = candidates[0]!;
    if (best.length >= want.min && best.length <= want.max) return best;
  }

  // No table fits. Read the article's bulleted lists, skipping the sections
  // that are navigation rather than content.
  const seen = new Set<string>();
  const out: string[] = [];
  let skipping = false;
  for (const line of text.split("\n")) {
    const head = line.match(/^==+\s*(.+?)\s*==+\s*$/);
    if (head) { skipping = NOT_CONTENT.test(head[1] ?? ""); continue; }
    if (skipping) continue;
    if (!/^\*+\s/.test(line)) continue;
    // A bullet with no wiki link is prose, not a member of a list of places.
    if (!/\[\[/.test(line)) continue;
    const n = linkName(line.replace(/^\*+\s*/, ""));
    if (!n) continue;
    const k = matchKey(n);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(n);
  }
  // Prefer the best table over a bullet scrape that is no closer to the claim.
  if (candidates.length > 0) {
    const best = candidates[0]!;
    if (Math.abs(best.length - target) <= Math.abs(out.length - target)) return best;
  }
  return out;
}

async function loadCanon(sites: Site[]): Promise<CanonSet[]> {
  const byKey = new Map<string, Site>();
  for (const s of sites) {
    const k = matchKey(s.name);
    if (k && !byKey.has(k)) byKey.set(k, s);
  }

  const out: CanonSet[] = [];
  for (const t of TRADITIONS) {
    const text = await wikitext(t.page);
    if (!text) {
      console.log(`  canon ${t.id}: article unavailable`);
      continue;
    }
    const names = canonNames(text, t.expect);
    const members: CanonMember[] = names.map((name) => {
      const hit = byKey.get(matchKey(name));
      return { name, qid: hit?.qid ?? null };
    });

    // Problems are recorded, not thrown. Throwing on the first bad tradition
    // reported one fault per run and hid the other five, and it discarded the
    // parsed names — which are the only thing that says *why* a parse is
    // wrong. The run still fails, at the end, once everything is on the record.
    const problems: string[] = [];
    if (names.length < t.expect.min || names.length > t.expect.max) {
      problems.push(
        `parsed ${names.length} members, expected ${t.expect.min}` +
        `${t.expect.max === t.expect.min ? "" : `–${t.expect.max}`}`,
      );
    }
    // A count can be right for the wrong reason. Twelve names that match one
    // temple between them is not twelve Jyotirlingas; it is twelve of
    // something else that happened to number twelve.
    const hitRate = names.length === 0 ? 0 : members.filter((m) => m.qid).length / names.length;
    if (names.length >= t.expect.min && hitRate < 0.25) {
      problems.push(
        `only ${members.filter((m) => m.qid).length} of ${names.length} names match any ` +
        "mapped site, which suggests the parse is reading the wrong part of the article",
      );
    }

    // Membership becomes a dedication only where the tradition names one god.
    if (t.deity) {
      for (const m of members) {
        if (!m.qid) continue;
        const site = sites.find((s) => s.qid === m.qid);
        if (!site) continue;
        if (site.dedications.some((d) => d.basis === "canonical" && d.via === t.label)) continue;
        site.dedications.push({ figure: t.deity, basis: "canonical", via: t.label });
      }
    }

    const placed = members.filter((m) => m.qid).length;
    console.log(
      `  canon ${t.id.padEnd(16)} ${String(names.length).padStart(3)} named, ` +
      `${String(placed).padStart(3)} placed` +
      (problems.length > 0 ? `   ⚠ ${problems.join("; ")}` : ""),
    );
    // The names themselves, because a count never says what went wrong.
    console.log(`      ${names.slice(0, 14).join(" · ")}${names.length > 14 ? " · …" : ""}`);

    out.push({
      id: t.id, label: t.label, deity: t.deity, note: t.note,
      claimed: names.length, placed, members,
      ...(problems.length > 0 ? { problems } : {}),
    });
  }
  return out;
}

async function loadStates(): Promise<FeatureCollection<Geometry, { name: string | null }>> {
  const t = JSON.parse(await readFile(STATE_FILE, "utf8")) as
    Topology<{ india: GeometryCollection<{ name: string | null }> }>;
  return feature(t, t.objects.india) as FeatureCollection<Geometry, { name: string | null }>;
}

export async function run(): Promise<void> {
  const states = await loadStates();

  // ── The spine, in pages ────────────────────────────────────────────────
  const byQid = new Map<string, Site>();
  const rejected: Array<{ qid: string; name: string; lat: number; lon: number; why: string }> = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const rows = await sparql(spineQuery(page * PAGE), `spine page ${page + 1}`);
    if (rows === null) break;
    console.log(`  spine page ${page + 1}: ${rows.length} rows`);
    for (const r of rows) {
      const qid = r["item"], name = r["itemLabel"], coord = r["coord"];
      if (!qid || !name || !coord) continue;
      const p = parsePoint(coord);
      if (!p) continue;
      // A label that is still a Q-id means Wikidata has no English label; the
      // item is real but unnameable on a page, so it is not mapped.
      if (/^Q\d+$/.test(name)) continue;
      if (!inIndia(p.lat, p.lon)) {
        rejected.push({ qid, name, lat: p.lat, lon: p.lon, why: "coordinates fall outside India" });
        continue;
      }
      const st = states.features.find((f) => geoContains(f, [p.lon, p.lat]));
      byQid.set(qid, {
        qid, name, lat: p.lat, lon: p.lon,
        state: st?.properties?.name ?? null,
        dedications: [],
        inception: null,
        heritage: null,
      });
    }
    if (rows.length < PAGE) break;
  }
  console.log(`spine: ${byQid.size} mapped sites, ${rejected.length} rejected`);
  for (const r of rejected) console.log(`    rejected  ${r.name}  ${r.lat},${r.lon}`);
  // A handful is upstream noise. A third of the map is a bug in this file.
  if (rejected.length > byQid.size * 0.02) {
    throw new Error(
      `${rejected.length} of ${rejected.length + byQid.size} sites fell outside India. ` +
      "That is too many to be upstream typos — check that Point() is being read " +
      "longitude-first before trusting any of this.",
    );
  }

  // ── Stated dedications ─────────────────────────────────────────────────
  const ded = await sparql(DEDICATION_QUERY, "dedications");
  let stated = 0;
  for (const r of ded ?? []) {
    const s = byQid.get(r["item"] ?? "");
    const figure = r["dLabel"];
    if (!s || !figure || /^Q\d+$/.test(figure)) continue;
    if (s.dedications.some((d) => d.figure === figure && d.basis === "stated")) continue;
    s.dedications.push({ figure, basis: "stated" });
    stated++;
  }
  console.log(`stated dedications: ${stated} on mapped sites (of ${ded?.length ?? 0} in total)`);

  // ── Dates and heritage listings ────────────────────────────────────────
  const det = await sparql(DETAIL_QUERY, "dates and heritage");
  for (const r of det ?? []) {
    const s = byQid.get(r["item"] ?? "");
    if (!s) continue;
    const inc = r["inception"];
    if (inc && !s.inception) s.inception = inc.slice(0, 10);
    const her = r["heritageLabel"];
    if (her && !/^Q\d+$/.test(her) && !s.heritage) s.heritage = her;
  }

  // ── The canonical tier ─────────────────────────────────────────────────
  // After the stated tier, so a canonical dedication can never displace one
  // Wikidata actually asserts — both are kept, each labelled with its basis.
  const canon = await loadCanon([...byQid.values()]);

  const sites = [...byQid.values()].sort((a, b) => a.name.localeCompare(b.name));

  await mkdir(join(ROOT, "data", "sacred"), { recursive: true });
  await writeFile(OUT, JSON.stringify({
    builtAt: new Date().toISOString(),
    source: "Wikidata, via the public SPARQL endpoint (CC0).",
    note:
      "Sites are those Wikidata holds as Hindu temples in India carrying coordinates. " +
      "Wikidata's coverage is uneven by state and by tradition, so a thinner region on " +
      "this map is a thinner region of the database, not of India.",
    coverage: {
      mapped: sites.length,
      withStatedDedication: sites.filter(
        (s) => s.dedications.some((d) => d.basis === "stated"),
      ).length,
      withCanonicalDedication: sites.filter(
        (s) => s.dedications.some((d) => d.basis === "canonical"),
      ).length,
      withInception: sites.filter((s) => s.inception).length,
      withHeritage: sites.filter((s) => s.heritage).length,
      withState: sites.filter((s) => s.state).length,
      rejected: rejected.length,
    },
    /**
     * Sites Wikidata places outside India while calling them Indian. Kept in
     * the file rather than dropped in silence: they are a small, checkable
     * statement about the source's accuracy, and hiding them would make this
     * map look cleaner than its inputs are.
     */
    rejected,
    canon,
    sites,
  }, null, 2) + "\n", "utf8");

  console.log(`\nwrote ${sites.length} sites to ${OUT}`);

  const broken = canon.filter((c) => c.problems && c.problems.length > 0);
  if (broken.length > 0) {
    console.error("\nCanonical sets that did not parse cleanly:");
    for (const c of broken) console.error(`  ${c.label}: ${c.problems!.join("; ")}`);
    throw new Error(
      `${broken.length} of ${canon.length} traditions failed their own count or match check. ` +
      "The atlas above was written so the parsed names can be read, but it is not fit to ship.",
    );
  }
}

if (isEntryPoint(import.meta.url)) {
  run().catch((err) => { console.error(err); process.exit(1); });
}
