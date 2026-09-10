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
import { isEntryPoint } from "../lib/entry";

const ROOT = process.cwd();
const OUT = join(ROOT, "data", "sacred", "atlas.json");
const STATE_FILE = join(ROOT, "data", "geo", "india-states.topo.json");
const WDQS = "https://query.wikidata.org/sparql";

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

async function loadStates(): Promise<FeatureCollection<Geometry, { name: string | null }>> {
  const t = JSON.parse(await readFile(STATE_FILE, "utf8")) as
    Topology<{ india: GeometryCollection<{ name: string | null }> }>;
  return feature(t, t.objects.india) as FeatureCollection<Geometry, { name: string | null }>;
}

export async function run(): Promise<void> {
  const states = await loadStates();

  // ── The spine, in pages ────────────────────────────────────────────────
  const byQid = new Map<string, Site>();
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
  console.log(`spine: ${byQid.size} mapped sites`);

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
      withStatedDedication: sites.filter((s) => s.dedications.length > 0).length,
      withInception: sites.filter((s) => s.inception).length,
      withHeritage: sites.filter((s) => s.heritage).length,
      withState: sites.filter((s) => s.state).length,
    },
    sites,
  }, null, 2) + "\n", "utf8");

  console.log(`\nwrote ${sites.length} sites to ${OUT}`);
}

if (isEntryPoint(import.meta.url)) {
  run().catch((err) => { console.error(err); process.exit(1); });
}
