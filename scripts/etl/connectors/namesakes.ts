/**
 * Places named after Ram, Krishna, Hanuman and the other gods, and places and
 * institutions named after Mahatma, Indira and Rajiv Gandhi.
 *
 * `npm run namesakes:ingest`. Writes data/namesakes/namesakes.json.
 * Runs in GitHub Actions: the editing sandbox cannot reach Wikidata, Wikipedia
 * or Overpass.
 *
 * ── What "named after" has to mean here ──────────────────────────────────
 *
 * A name that contains a god's name is not evidence that the place is named
 * after the god. Krishnanagar is named after a Maharaja, Krishnagiri after its
 * black hills, Krishna district after a river; Ramgarh after rajas called Ram.
 * So nothing enters the map on the strength of its spelling. A place counts
 * for a figure only on one of three kinds of evidence, each carried separately
 * and printed on the page:
 *
 *   stated   Wikidata's "named after" (P138) points at the figure.
 *   quoted   A sentence in the place's English Wikipedia article says so,
 *            stored verbatim — see lib/namesake-match.ts for what counts.
 *   named    Leaders only: the item's own name contains the full name —
 *            "Rajiv Gandhi International Airport". A full name is unambiguous
 *            in a way that "Ram" in "Rampur" is not, so this tier exists for
 *            the Gandhis and never for the gods.
 *
 * The spelling-only question is still answered, as what it is: a count of
 * places whose name begins with a god's name, in OpenStreetMap, published as a
 * count of names and never as a count of dedications.
 *
 * ── How the candidates are found ─────────────────────────────────────────
 *
 *   1. Wikidata search for items whose P138 is the figure (any country;
 *      filtered to India by coordinates).
 *   2. Wikipedia full-text search for "named after Lord Rama" and its
 *      variants, then each hit's article is read and the sentence found.
 *   3. Leaders: Wikidata search for items whose name carries the full name.
 *   4. Overpass: roads named after the Gandhis (counted and clustered — a
 *      derived estimate), and place names by stem.
 *
 * Every step fails soft. A failed step is logged in `errors` and leaves its
 * part of the file empty rather than stopping the others.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import { getText } from "../lib/http";
import { plain } from "../lib/wikitext";
import { isEntryPoint } from "../lib/entry";
import { findNamingSentence, firstNamingSentence, roadFigure, roadKey, clusterRoads } from "../lib/namesake-match";
import {
  FIGURES, type Figure, type Place, type Evidence, type Category, type Lookalike,
  type RoadSet, type NameCount, type Namesakes,
} from "../../../lib/namesakes-shared";

const ROOT = process.cwd();
const OUT = join(ROOT, "data", "namesakes", "namesakes.json");
const STATE_FILE = join(ROOT, "data", "geo", "india-states.topo.json");
const WP = "https://en.wikipedia.org/w/api.php";
const WD = "https://www.wikidata.org/w/api.php";
const OVERPASS = ["https://overpass-api.de/api", "https://overpass.kumi.systems/api", "https://overpass.private.coffee/api"];

/** CirrusSearch will not page past 10,000. */
const MAX_OFFSET = 9_500;
/**
 * The broad settlement searches are capped. They find settlements that merely
 * mention a god, most of which are not named after one; the first two
 * thousand hits of each are read. Uncapped, the second run was still searching
 * after eighty minutes and the job was killed with nothing written.
 */
const BROAD_OFFSET = 1_500;
/** Past this, searching and reading stop and the run writes what it has. */
const BUDGET_MS = 70 * 60_000;
const STARTED = Date.now();
const late = () => Date.now() - STARTED > BUDGET_MS;
/**
 * The whole run, OpenStreetMap included, stops asking by here. The budget
 * above covered Wikipedia only, and a run spent past a hundred minutes
 * waiting on three busy Overpass instances in turn, one stem at a time —
 * which the job's own time limit would have killed with nothing committed.
 */
const HARD_MS = 100 * 60_000;
const pastHard = () => Date.now() - STARTED > HARD_MS;
const elapsed = () => `${Math.round((Date.now() - STARTED) / 60_000)} min`;
function progress(msg: string): void { console.log(`  [${elapsed()}] ${msg}`); }
/** Politeness between API calls to one host. */
const GAP_MS = 120;
/** The generous box used only to decide whether coordinates are believable. */
const BOX = { minLat: 6, maxLat: 37.6, minLon: 67, maxLon: 97.5 };

/**
 * Places that look named after a god and are not — or might not be. Read by
 * title, and the article's own naming sentence is printed, whoever it names.
 */
export const LOOKALIKES = [
  "Krishnanagar", "Krishnagiri", "Krishna district", "Krishnarajpet", "Krishnarajanagara",
  "Ramgarh", "Ramgarh district", "Rampur", "Ramanagara", "Ramnagar, Uttarakhand", "Ramtek",
  "Rameswaram", "Ramanathapuram", "Ramagundam", "Ramachandrapuram", "Ramnad",
  "Hanumangarh", "Hanamkonda", "Sitamarhi", "Sitapur", "Lakshmangarh", "Laxmangarh",
  "Gopalganj", "Govindpur", "Shivpuri", "Shivamogga", "Shivaji Nagar, Pune", "Ganeshpuri",
  "Durgapur", "Kalimpong", "Kolkata", "Lakshmipur", "Saraswati River", "Parvati Valley",
  "Radhanagari", "Balrampur", "Ayodhya", "Vrindavan", "Dwarka, Delhi", "Chitrakoot Dham",
  "Gandhinagar", "Gandhidham", "Indiranagar", "Rajiv Gandhi Nagar",
];

/** Place-name stems counted in OpenStreetMap, for the "a name is not a dedication" panel. */
export const STEMS = [
  "Ram", "Sita", "Lakshman", "Hanuman", "Krishna", "Kishan", "Gopal", "Govind", "Radha",
  "Shiv", "Ganesh", "Durga", "Kali", "Lakshmi", "Laxmi", "Saraswati",
  "Gandhi", "Indira", "Rajiv",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const errors: string[] = [];
const funnel: Record<string, number> = {};
const bump = (k: string, n = 1) => { funnel[k] = (funnel[k] ?? 0) + n; };

async function api<T>(base: string, params: Record<string, string>, label: string): Promise<T | null> {
  const q = new URLSearchParams({ format: "json", formatversion: "2", maxlag: "5", ...params });
  await sleep(GAP_MS);
  const res = await getText(`${base}?${q}`, { timeoutMs: 60_000, retries: 3, cacheMs: 12 * 3600_000, accept: "application/json" });
  if (!res.ok || !res.data) { errors.push(`${label}: ${res.error ?? "failed"}`); return null; }
  try {
    const j = JSON.parse(res.data) as T & { error?: { code?: string; info?: string } };
    if (j.error) { errors.push(`${label}: ${j.error.code} ${j.error.info ?? ""}`); return null; }
    return j;
  } catch {
    errors.push(`${label}: not JSON`);
    return null;
  }
}

/** Every title a CirrusSearch query returns, paged. */
async function searchAll(base: string, query: string, label: string, maxOffset = MAX_OFFSET): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; offset <= maxOffset; offset += 500) {
    if (late()) { errors.push(`${label}: stopped at the time budget`); break; }
    const j = await api<{ query?: { search?: Array<{ title: string }> }; continue?: { sroffset?: number } }>(
      base, { action: "query", list: "search", srsearch: query, srlimit: "500", sroffset: String(offset), srnamespace: "0", srprop: "" }, label);
    const rows = j?.query?.search ?? [];
    out.push(...rows.map((r) => r.title));
    if (!j?.continue?.sroffset) break;
  }
  return out;
}

function chunks<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

/* ─────────────────────────── Wikidata entities ─────────────────────────── */

interface Snak { mainsnak?: { datavalue?: { value?: unknown } }; rank?: string }
interface Entity {
  id: string;
  missing?: string;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  claims?: Record<string, Snak[]>;
  sitelinks?: Record<string, { title: string }>;
}

function values(e: Entity, p: string): unknown[] {
  return (e.claims?.[p] ?? []).filter((s) => s.rank !== "deprecated").map((s) => s.mainsnak?.datavalue?.value).filter((v) => v !== undefined);
}
function ids(e: Entity, p: string): string[] {
  return values(e, p).map((v) => (v as { id?: string }).id).filter((x): x is string => typeof x === "string");
}
function coord(e: Entity): { lat: number; lon: number } | null {
  for (const v of values(e, "P625")) {
    const c = v as { latitude?: number; longitude?: number; globe?: string };
    if (c.globe && !c.globe.endsWith("Q2")) continue; // on Earth, not the Moon
    if (typeof c.latitude === "number" && typeof c.longitude === "number") return { lat: c.latitude, lon: c.longitude };
  }
  return null;
}

async function entities(qids: string[], props: string, label: string): Promise<Map<string, Entity>> {
  const out = new Map<string, Entity>();
  for (const batch of chunks([...new Set(qids)], 50)) {
    const j = await api<{ entities?: Record<string, Entity> }>(WD, {
      action: "wbgetentities", ids: batch.join("|"), props, languages: "en", sitefilter: "enwiki", formatversion: "1",
    }, label);
    for (const [id, e] of Object.entries(j?.entities ?? {})) if (!e.missing) out.set(id, e);
  }
  return out;
}

/* ─────────────────────────── Categories ─────────────────────────── */

/**
 * The first rule that matches any class label wins, so order matters: a
 * "railway station" must be transport before "station" could be anything, and
 * a "medical college" is health before it is education.
 */
const CATEGORY_RULES: Array<[Category, RegExp]> = [
  ["religious", /\b(temple|mandir|shrine|church|mosque|gurdwara|kovil|monastery|ashram|math|matha|devasthanam|place of worship)\b/i],
  ["scheme", /\b(scheme|programme|program|yojana|mission|award|prize|scholarship|policy|act)\b/i],
  ["health", /\b(hospital|medical|health|clinic|dispensary|nursing|institute of medical)\b/i],
  ["education", /\b(university|college|school|institute|institution|academy|vidyalaya|polytechnic|library|research|campus|education)\b/i],
  ["transport", /\b(airport|aerodrome|station|railway|metro|bus|bridge|setu|flyover|port|harbour|tunnel|terminal|interchange|sea link)\b/i],
  ["sport", /\b(stadium|sports|cricket ground|arena|velodrome|indoor|swimming|pavilion|field)\b/i],
  ["road", /\b(road|street|avenue|marg|highway|square|chowk|circle|roundabout|lane|expressway)\b/i],
  ["park", /\b(park|garden|sanctuary|zoo|reserve|forest|botanical|nature)\b/i],
  ["memorial", /\b(memorial|museum|statue|monument|sculpture|samadhi|ghat|smarak|mausoleum|cenotaph|bust)\b/i],
  ["nature", /\b(river|lake|hill|mountain|peak|island|canal|dam|reservoir|waterfall|valley|beach|cave|glacier|pond|tank)\b/i],
  ["admin", /\b(district|tehsil|taluk|taluka|mandal|subdivision|division|block|constituency|municipal|panchayat|corporation|state|union territory|circle)\b/i],
  ["neighbourhood", /\b(neighbourhood|neighborhood|suburb|locality|colony|quarter|ward|nagar|area|sector|township|housing)\b/i],
  ["settlement", /\b(city|town|village|settlement|census town|hamlet|big city|metropolis|megacity|human settlement)\b/i],
  ["building", /\b(building|hall|bhawan|bhavan|house|office|centre|center|complex|auditorium|convention|theatre|fort|palace|market|tower)\b/i],
];

function categorise(classes: string[], name: string): Category {
  for (const [cat, re] of CATEGORY_RULES) if (classes.some((c) => re.test(c))) return cat;
  // No class, or none that matched: the item's own name is the last resort.
  for (const [cat, re] of CATEGORY_RULES) if (re.test(name)) return cat;
  return "other";
}

/* ─────────────────────────── States ─────────────────────────── */

type States = FeatureCollection<Geometry, { name: string | null }>;
async function loadStates(): Promise<States> {
  const t = JSON.parse(await readFile(STATE_FILE, "utf8")) as Topology<{ india: GeometryCollection<{ name: string | null }> }>;
  return feature(t, t.objects.india) as States;
}
function stateOf(states: States, lat: number, lon: number): string | null {
  return states.features.find((f) => geoContains(f, [lon, lat]))?.properties?.name ?? null;
}
const inBox = (lat: number, lon: number) => lat >= BOX.minLat && lat <= BOX.maxLat && lon >= BOX.minLon && lon <= BOX.maxLon;

/* ─────────────────────────── Wikipedia reading ─────────────────────────── */

async function titlesToQids(titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const batch of chunks([...new Set(titles)], 50)) {
    const j = await api<{
      query?: {
        normalized?: Array<{ from: string; to: string }>;
        redirects?: Array<{ from: string; to: string }>;
        pages?: Array<{ title: string; pageprops?: { wikibase_item?: string } }>;
      };
    }>(WP, { action: "query", prop: "pageprops", ppprop: "wikibase_item", redirects: "1", titles: batch.join("|") }, "titles→items");
    const q = j?.query;
    if (!q) continue;
    const hop = new Map<string, string>();
    for (const n of q.normalized ?? []) hop.set(n.from, n.to);
    for (const r of q.redirects ?? []) hop.set(r.from, r.to);
    const byTitle = new Map((q.pages ?? []).map((p) => [p.title, p.pageprops?.wikibase_item]));
    for (const t of batch) {
      let cur = t;
      for (let i = 0; i < 3 && hop.has(cur); i++) cur = hop.get(cur)!;
      const qid = byTitle.get(cur);
      if (qid) out.set(t, qid);
    }
  }
  return out;
}

/**
 * Wikitext to readable prose, well enough to find a sentence in.
 *
 * Templates are removed innermost-first until none are left — an infobox holds
 * templates inside templates, and one pass leaves its skeleton behind as
 * "text". Tables go whole. Section headings become sentence breaks, so an
 * "Etymology" heading cannot glue itself to the sentence under it.
 */
export function articleText(wikitext: string): string {
  let s = wikitext;
  for (let k = 0; k < 12 && /\{\{[^{}]*\}\}/.test(s); k++) s = s.replace(/\{\{[^{}]*\}\}/g, " ");
  s = s.replace(/\{\|[\s\S]*?\|\}/g, " ");
  s = s.replace(/\[\[(?:File|Image|Category):[^\[\]]*(?:\[\[[^\]]*\]\][^\[\]]*)*\]\]/gi, " ");
  s = s.replace(/^=+\s*(.*?)\s*=+\s*$/gm, ". §§$1§§. ");
  s = s.replace(/'{2,}/g, "");
  s = s.replace(/^[*#:;]+\s*/gm, "");
  return plain(s).replace(/\s+/g, " ").replace(/(\.\s*){2,}/g, ". ").trim();
}

/**
 * Many articles in one request: the revisions API returns the current text of
 * up to fifty pages at once. The first run read one article per request and
 * Wikipedia answered 429 to sixteen of them; fifty to a request is two
 * orders of magnitude fewer calls for the same reading.
 */
async function readArticles(titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const batch of chunks([...new Set(titles)], 50)) {
    if (late()) { errors.push(`reading: stopped at the time budget with ${titles.length - out.size} articles unread`); break; }
    let j: {
      query?: {
        normalized?: Array<{ from: string; to: string }>;
        redirects?: Array<{ from: string; to: string }>;
        pages?: Array<{ title: string; revisions?: Array<{ slots?: { main?: { content?: string } } }> }>;
      };
    } | null = null;
    for (let attempt = 0; attempt < 3 && !j; attempt++) {
      if (attempt) await sleep(30_000 * attempt); // a 429 means slow down, not try again at once
      j = await api(WP, { action: "query", prop: "revisions", rvprop: "content", rvslots: "main", redirects: "1", titles: batch.join("|") }, `read ${batch.length} articles`);
    }
    const q = j?.query;
    if (!q) continue;
    const hop = new Map<string, string>();
    for (const n of q.normalized ?? []) hop.set(n.from, n.to);
    for (const r of q.redirects ?? []) hop.set(r.from, r.to);
    const text = new Map((q.pages ?? []).map((p) => [p.title, p.revisions?.[0]?.slots?.main?.content ?? ""]));
    for (const t of batch) {
      let cur = t;
      for (let i = 0; i < 3 && hop.has(cur); i++) cur = hop.get(cur)!;
      const w = text.get(cur);
      if (w) out.set(t, articleText(w));
    }
    await sleep(400);
  }
  return out;
}

const wpUrl = (title: string) => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
const wdUrl = (qid: string) => `https://www.wikidata.org/wiki/${qid}`;

/* ─────────────────────────── Overpass ─────────────────────────── */

async function overpass(q: string, label: string): Promise<string | null> {
  // Two instances at most, one attempt each, three minutes each: a busy
  // service is skipped for this run, not waited out.
  for (const base of OVERPASS.slice(0, 2)) {
    if (pastHard()) { errors.push(`${label}: skipped at the run's hard deadline`); return null; }
    const res = await getText(`${base}/interpreter?data=${encodeURIComponent(q)}`, { timeoutMs: 180_000, retries: 0, cacheMs: 0 });
    if (res.ok && res.data && !/runtime error|rate_limited/i.test(res.data.slice(0, 2000))) return res.data;
    errors.push(`${label} via ${base}: ${res.error ?? "runtime error or rate limit"}`);
    await sleep(10_000);
  }
  return null;
}

async function roads(states: States): Promise<RoadSet[] | null> {
  // Names only, CSV: a tagged JSON answer for every highway way in India is
  // hundreds of megabytes; this is the three columns the count needs.
  const q = `[out:csv(::lat,::lon,name;false)][timeout:280];area["ISO3166-1"="IN"][admin_level=2]->.in;` +
    `way[highway][name~"^(mahatma gandhi|m\\\\.? ?g\\\\.?|gandhiji|bapu|smt\\\\.? indira gandhi|indira gandhi|rajiv gandhi|gandhi) ",i](area.in);out center;`;
  const body = await overpass(q, "roads");
  if (!body) return null;
  const pts: Record<RoadSet["figure"], Array<{ key: string; lat: number; lon: number }>> = { mahatma: [], indira: [], rajiv: [], gandhi: [] };
  let lines = 0;
  for (const line of body.split("\n")) {
    const [la, lo, name] = line.split("\t");
    const lat = Number(la), lon = Number(lo);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon) || !inBox(lat, lon)) continue;
    lines++;
    const f = roadFigure(name);
    if (f) pts[f].push({ key: roadKey(name), lat, lon });
  }
  bump("osm road ways read", lines);
  return (Object.keys(pts) as RoadSet["figure"][]).map((figure) => {
    const clustered = clusterRoads(pts[figure]);
    const byState: Record<string, number> = {};
    for (const r of clustered) { const s = stateOf(states, r.lat, r.lon) ?? "Unplaced"; byState[s] = (byState[s] ?? 0) + 1; }
    return { figure, ways: pts[figure].length, roads: clustered.length, byState, points: clustered.map((r) => [r.lat, r.lon] as [number, number]) };
  });
}

/**
 * One small query per stem. The first run asked for all nineteen stems in one
 * case-insensitive regex over every place node in India, and all three
 * Overpass instances timed out on it. Place names are capitalised in the
 * data, so the match is case-sensitive, which Overpass can do far faster.
 */
async function nameCounts(): Promise<NameCount[] | null> {
  const out: NameCount[] = [];
  for (const stem of STEMS) {
    if (pastHard()) { errors.push(`place names: stopped at the hard deadline before ${stem}`); break; }
    const q = `[out:csv(name;false)][timeout:180];area["ISO3166-1"="IN"][admin_level=2]->.in;` +
      `node[place~"^(city|town|village|hamlet|suburb|neighbourhood)$"][name~"^${stem}"](area.in);out;`;
    const body = await overpass(q, `place names ${stem}`);
    await sleep(8_000);
    if (!body) continue;
    const names = body.split("\n").map((l) => l.trim()).filter(Boolean);
    bump("osm place names read", names.length);
    const freq = new Map<string, number>();
    for (const n of names) freq.set(n, (freq.get(n) ?? 0) + 1);
    const top = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12);
    out.push({ stem, places: names.length, top });
  }
  return out.length ? out : null;
}

/* ─────────────────────────── The run ─────────────────────────── */

export async function run(): Promise<void> {
  const states = await loadStates();

  // ── 1. Who is who ────────────────────────────────────────────────────
  const figQid = await titlesToQids(FIGURES.map((f) => f.enwiki));
  const figures = FIGURES.map((f) => ({ id: f.id, name: f.name, kind: f.kind, qid: figQid.get(f.enwiki) ?? null, enwiki: f.enwiki }));
  for (const f of figures) console.log(`  ${f.id.padEnd(10)} ${f.qid ?? "UNRESOLVED"}  (${f.enwiki})`);
  const byQid = new Map(figures.filter((f) => f.qid).map((f) => [f.qid!, f.id]));

  // ── 2. Candidates ────────────────────────────────────────────────────
  /** qid → figures it is a candidate for, and how it was found. */
  const stated = new Map<string, Set<string>>();
  const labelled = new Map<string, Set<string>>();
  const searched = new Map<string, Set<string>>(); // Wikipedia title → figures
  const add = (m: Map<string, Set<string>>, k: string, fig: string) => { if (!m.has(k)) m.set(k, new Set()); m.get(k)!.add(fig); };

  for (const f of FIGURES) {
    const qid = figQid.get(f.enwiki);
    if (!qid) continue;
    const p138 = await searchAll(WD, `haswbstatement:P138=${qid}`, `P138 ${f.id}`);
    p138.forEach((q) => add(stated, q, f.id));
    bump(`wikidata P138 hits: ${f.id}`, p138.length);

    const phrases = new Set<string>();
    for (const w of f.search) {
      phrases.add(`"named after ${w}"`);
      phrases.add(`"named for ${w}"`);
      if (f.title) { phrases.add(`"named after ${f.title} ${w}"`); phrases.add(`"name from ${f.title} ${w}"`); }
      if (f.kind === "leader") { phrases.add(`"in memory of ${w}"`); phrases.add(`"in honour of ${w}"`); phrases.add(`"in honor of ${w}"`); phrases.add(`"renamed after ${w}"`); }
    }
    /*
     * The phrase searches alone found 41 articles for Rama. A town's article
     * rarely says "named after Rama" in exactly those words; it says the name
     * "is derived from Lord Rama", or tells the legend first and the name
     * after. So for the gods, every settlement article that mentions the god
     * is also read, and the sentence rules decide. This widens what is read,
     * not what is accepted.
     */
    if (f.kind === "god") {
      for (const w of f.search.slice(0, 2)) {
        phrases.add(`"${f.title} ${w}" hastemplate:"Infobox settlement"`);
        phrases.add(`"${w}" "named after" hastemplate:"Infobox settlement"`);
        phrases.add(`"${w}" "derived from" hastemplate:"Infobox settlement"`);
        phrases.add(`"${w}" "its name" hastemplate:"Infobox settlement"`);
      }
    }
    let n = 0;
    for (const ph of phrases) {
      const titles = await searchAll(WP, ph, `search ${ph}`, ph.includes("hastemplate:") ? BROAD_OFFSET : MAX_OFFSET);
      titles.forEach((t) => add(searched, t, f.id));
      n += titles.length;
    }
    bump(`wikipedia phrase hits: ${f.id}`, n);
    progress(`${f.id}: ${p138.length} on Wikidata, ${n} article hits`);

    if (f.kind === "leader" && f.label) {
      for (const w of f.search) {
        for (const filter of ["haswbstatement:P17=Q668", "haswbstatement:P625"]) {
          const hits = await searchAll(WD, `"${w}" ${filter}`, `label ${w} ${filter}`);
          hits.forEach((q) => add(labelled, q, f.id));
          bump(`wikidata name hits: ${f.id}`, hits.length);
        }
      }
    }
  }

  // ── 3. Read the search hits first; only a match becomes an item ──────
  // Reading is fifty articles a call; looking an item up is one more call per
  // fifty plus its class labels. Reading first means only the articles that
  // actually carry a naming sentence cost a lookup.
  progress(`reading ${searched.size} search hits`);
  const texts = await readArticles([...searched.keys()]);
  bump("wikipedia articles found", searched.size);
  bump("search hits read", texts.size);
  const matched = [...searched.entries()].filter(([t, figs]) => {
    const text = texts.get(t);
    return !!text && [...figs].some((id) => findNamingSentence(text, FIGURES.find((f) => f.id === id)!, t) !== null);
  }).map(([t]) => t);
  bump("search hits with a naming sentence", matched.length);
  progress(`${matched.length} of them carry a naming sentence`);
  const titleQid = await titlesToQids(matched);
  const searchedByQid = new Map<string, Set<string>>();
  for (const [t, figs] of searched) {
    const q = titleQid.get(t);
    if (q) for (const f of figs) add(searchedByQid, q, f);
  }

  // ── 4. Read every candidate item ─────────────────────────────────────
  const all = [...new Set([...stated.keys(), ...labelled.keys(), ...searchedByQid.keys()])].filter((q) => /^Q\d+$/.test(q));
  bump("candidate items", all.length);
  progress(`looking up ${all.length} items`);
  const ents = await entities(all, "labels|descriptions|claims|sitelinks", "items");

  // Class and located-in labels, fetched once for the whole set.
  const classIds = new Set<string>(), locIds = new Set<string>();
  for (const e of ents.values()) { ids(e, "P31").forEach((c) => classIds.add(c)); ids(e, "P131").slice(0, 1).forEach((c) => locIds.add(c)); }
  const labelEnts = await entities([...classIds, ...locIds], "labels", "class labels");
  const lab = (q: string) => labelEnts.get(q)?.labels?.en?.value ?? null;

  const places: Place[] = [];
  for (const qid of all) {
    const e = ents.get(qid);
    if (!e) continue;
    const name = e.labels?.en?.value;
    if (!name) { bump("dropped: no English name"); continue; }
    const c = coord(e);
    const inIndia = c ? inBox(c.lat, c.lon) && stateOf(states, c.lat, c.lon) !== null : ids(e, "P17").includes("Q668");
    if (!inIndia) { bump("dropped: not in India"); continue; }
    if (ids(e, "P31").includes("Q5")) { bump("dropped: a person"); continue; }
    const classes = ids(e, "P31").map(lab).filter((x): x is string => !!x);
    const enwiki = e.sitelinks?.enwiki?.title ?? null;
    const evidence: Evidence[] = [];

    // stated: re-read P138 from the item itself, not from the search index.
    for (const t of ids(e, "P138")) {
      const fig = byQid.get(t);
      if (fig) evidence.push({ figure: fig, tier: "stated", url: wdUrl(qid) });
    }
    // named: leaders' full names in the item's own English name.
    for (const f of FIGURES) {
      if (f.kind === "leader" && f.label?.test(name) && !(f.notWith ?? []).some((w) => new RegExp(`\\b${w}\\b`, "i").test(name))) {
        evidence.push({ figure: f.id, tier: "named", url: wdUrl(qid) });
      }
    }
    places.push({
      qid, name,
      description: e.descriptions?.en?.value ?? null,
      lat: c ? Math.round(c.lat * 1e5) / 1e5 : null,
      lon: c ? Math.round(c.lon * 1e5) / 1e5 : null,
      state: c ? stateOf(states, c.lat, c.lon) : null,
      locatedIn: ids(e, "P131").map(lab)[0] ?? null,
      category: categorise(classes, name),
      classes,
      enwiki,
      evidence,
    });
  }
  bump("items in India", places.length);

  // ── 5. Read the articles and find the sentence ───────────────────────
  // Every India item with an English article is read, not only the search
  // hits: a P138 item whose article also says so carries both, and the page
  // can print the sentence instead of only a link.
  const toRead = places.filter((p) => p.enwiki);
  const unread = toRead.map((p) => p.enwiki!).filter((t) => !texts.has(t));
  progress(`reading ${unread.length} more articles`);
  for (const [t, x] of await readArticles(unread)) texts.set(t, x);
  bump("articles read", toRead.length);
  for (const p of toRead) {
    const text = texts.get(p.enwiki!);
    if (!text) continue;
    for (const f of FIGURES) {
      const m = findNamingSentence(text, f, p.enwiki!);
      if (!m) continue;
      if (m.needsContext) {
        // Held for review: the name is there, the god is not established. The
        // sentence is kept so the reviewer reads what the article says.
        if (!p.evidence.some((x) => x.figure === f.id)) {
          p.review = true;
          (p.held ??= []).push({ figure: f.id, tier: "quoted", quote: m.sentence, url: wpUrl(p.enwiki!) });
        }
        bump("sentences held for review");
        continue;
      }
      p.evidence.push({ figure: f.id, tier: "quoted", quote: m.sentence, url: wpUrl(p.enwiki!) });
    }
  }

  const kept = places.filter((p) => p.evidence.length > 0 || p.review);
  kept.sort((a, b) => a.name.localeCompare(b.name));
  bump("places with evidence", kept.filter((p) => p.evidence.length > 0).length);

  // ── 6. The lookalikes ────────────────────────────────────────────────
  const lookQid = await titlesToQids(LOOKALIKES);
  const lookEnts = await entities([...lookQid.values()], "labels|claims", "lookalike items");
  const lookTexts = await readArticles(LOOKALIKES);
  const lookalikes: Lookalike[] = LOOKALIKES.map((title) => {
    const qid = lookQid.get(title) ?? null;
    const e = qid ? lookEnts.get(qid) : undefined;
    const c = e ? coord(e) : null;
    const text = lookTexts.get(title);
    return {
      title, qid,
      name: e?.labels?.en?.value ?? title,
      lat: c?.lat ?? null, lon: c?.lon ?? null,
      state: c ? stateOf(states, c.lat, c.lon) : null,
      quote: text ? firstNamingSentence(text, title) : null,
      url: wpUrl(title),
    };
  });

  // ── 7. OpenStreetMap ─────────────────────────────────────────────────
  progress("OpenStreetMap roads and names");
  const roadSets = await roads(states);
  const counts = await nameCounts();

  const out: Namesakes = {
    generatedAt: new Date().toISOString(),
    figures,
    places: kept,
    lookalikes,
    roads: roadSets,
    nameCounts: counts,
    funnel,
    errors: errors.slice(0, 200),
  };

  if (figures.some((f) => !f.qid)) throw new Error("a figure did not resolve; refusing to write a file that silently lacks it");
  if (kept.length === 0) throw new Error("no places at all — the upstream answered nothing useful; keeping the previous file");
  await mkdir(join(ROOT, "data", "namesakes"), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 1) + "\n", "utf8");
  console.log("\nfunnel:");
  for (const [k, v] of Object.entries(funnel)) console.log(`  ${k}: ${v}`);
  console.log(`errors: ${errors.length}`);
  for (const e of errors.slice(0, 30)) console.log(`  ${e}`);
  console.log(`wrote ${OUT}: ${kept.length} places, ${lookalikes.length} lookalikes`);
}

if (isEntryPoint(import.meta.url)) {
  run().catch((e) => { console.error(e); process.exit(1); });
}
