/**
 * Broad probe: the blocked series, and the new mobility / elections datasets.
 *
 * `npm run mobility:probe`. Two jobs in one run, because both need the same
 * thing — a machine-readable source that actually answers from CI.
 *
 *  1. ALTERNATIVES for the 27 declared-but-empty series. The last source probe
 *     found Lok Sabha's question service answering, and NCRB responding where
 *     it previously returned 503 four times. Parliament answers are where
 *     stone-pelting counts, communal-incident tallies, squadron strength and
 *     LWE district lists are actually published, so they get tested properly.
 *
 *  2. NEW SOURCES for flight / rail / metro / bus density, elections and
 *     cinema admissions.
 *
 * The design bet worth stating: for network GEOMETRY this leans on
 * OpenStreetMap rather than an Indian ministry portal. Metro and rail alignments
 * are mapped in OSM in far more detail than any ministry publishes as data, the
 * Overpass API answers without a key, and it is the same basemap the site's
 * gazetteer already uses. Ridership and traffic COUNTS still have to come from
 * the operators — OSM knows where the line is, not how many people rode it, and
 * conflating those two would be exactly the category error this project guards
 * against.
 *
 * Publishes nothing. Writes after every check so a killed run keeps findings.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "./lib/http";

const ROOT = process.cwd();
const OUT = join(ROOT, "data/live/mobility-probe.json");

interface Check {
  id: string;
  group: string;
  /** What this would unblock if it works. */
  wants: string;
  url: string;
  method?: string;
  status: "ok" | "failed";
  httpError?: string;
  bytes?: number;
  looksLike?: string;
  /** Cheap signals that the payload is the thing we want, not a landing page. */
  hits?: Record<string, number>;
  sample?: string;
  elapsedMs?: number;
}
const checks: Check[] = [];

function classify(body: string): string {
  const t = body.slice(0, 400).toLowerCase();
  if (t.startsWith("{") || t.startsWith("[")) return "json";
  if (t.includes("<?xml")) return "xml";
  if (t.includes("%pdf")) return "pdf";
  if (t.includes("<html") || t.includes("<!doctype")) return "html";
  return "text";
}

/** Count occurrences of terms that would only appear in the real dataset. */
function hits(body: string, terms: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  const low = body.toLowerCase();
  for (const t of terms) {
    const m = low.split(t.toLowerCase()).length - 1;
    if (m > 0) out[t] = m;
  }
  return out;
}

async function probe(
  id: string, group: string, wants: string, url: string, terms: string[],
  opts: { post?: string; headers?: Record<string, string> } = {},
): Promise<void> {
  const started = Date.now();
  const res = await getText(url, { timeoutMs: 45_000, retries: 1, cacheMs: 0, headers: opts.headers });
  const elapsedMs = Date.now() - started;
  if (!res.ok || res.data === null) {
    checks.push({ id, group, wants, url, status: "failed", httpError: res.error, elapsedMs });
  } else {
    const body = res.data;
    const h = hits(body, terms);
    checks.push({
      id, group, wants, url, status: "ok", bytes: body.length,
      looksLike: classify(body), hits: h, elapsedMs,
      sample: body.replace(/\s+/g, " ").slice(0, 220),
    });
  }
  await flush();
}

async function flush(): Promise<void> {
  await mkdir(join(ROOT, "data/live"), { recursive: true });
  await writeFile(OUT, JSON.stringify({ probedAt: new Date().toISOString(), checks }, null, 2) + "\n", "utf8");
}

/** Overpass: ask for a count only, so the probe never pulls a huge payload. */
function overpass(q: string): string {
  return "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(q);
}

async function main(): Promise<void> {
  // ── A. network geometry ───────────────────────────────────────────
  await probe("osm-metro-count", "mobility", "every metro line in India, with geometry",
    overpass('[out:json][timeout:60];area["ISO3166-1"="IN"][admin_level=2]->.in;relation["route"="subway"](area.in);out count;'),
    ["count", "relations", "elements"]);
  await probe("osm-metro-sample", "mobility", "metro line names + operators",
    overpass('[out:json][timeout:60];area["ISO3166-1"="IN"][admin_level=2]->.in;relation["route"="subway"](area.in);out tags 40;'),
    ["Delhi", "Metro", "Namma", "Kochi", "colour", "operator"]);
  await probe("osm-rail-count", "mobility", "national rail network geometry",
    overpass('[out:json][timeout:90];area["ISO3166-1"="IN"][admin_level=2]->.in;way["railway"="rail"]["usage"="main"](area.in);out count;'),
    ["count", "ways"]);
  await probe("osm-vandebharat", "mobility", "Vande Bharat services as route relations",
    overpass('[out:json][timeout:60];relation["route"="train"]["name"~"Vande Bharat",i];out tags 60;'),
    ["Vande Bharat", "from", "to", "operator"]);
  await probe("osm-airports", "mobility", "airports with IATA codes for the flight map",
    overpass('[out:json][timeout:60];area["ISO3166-1"="IN"][admin_level=2]->.in;node["aeroway"="aerodrome"]["iata"](area.in);out tags 60;'),
    ["iata", "aerodrome", "name"]);
  await probe("osm-busroutes-count", "mobility", "city bus route coverage",
    overpass('[out:json][timeout:90];area["ISO3166-1"="IN"][admin_level=2]->.in;relation["route"="bus"](area.in);out count;'),
    ["count", "relations"]);

  // ── B. live flight density ────────────────────────────────────────
  await probe("opensky-india-bbox", "mobility", "live aircraft over India, for a density map",
    "https://opensky-network.org/api/states/all?lamin=6.5&lomin=68.0&lamax=36.0&lomax=97.5",
    ["states", "time"]);

  // ── C. operator counts (OSM cannot supply these) ──────────────────
  await probe("dgca-traffic", "mobility", "airport-wise passenger and movement counts",
    "https://www.dgca.gov.in/digigov-portal/?page=jsp/dgca/InventoryList/dataReports/aviationDataStatistics/airportActivities/airportActivity.jsp",
    ["passenger", "aircraft", "movement"]);
  await probe("aai-traffic", "mobility", "AAI airport traffic statistics",
    "https://www.aai.aero/en/business-opportunities/aai-traffic-news", ["traffic", "passenger", "statistics"]);
  await probe("indianrail-stats", "mobility", "railway freight and passenger originating traffic",
    "https://indianrailways.gov.in/railwayboard/view_section.jsp?lang=0&id=0,1,304,366,554", ["freight", "statistic", "traffic"]);
  await probe("mohua-metro", "mobility", "operational metro km by city",
    "https://mohua.gov.in/cms/metro-rail.php", ["metro", "km", "operational"]);

  // ── D. elections ──────────────────────────────────────────────────
  await probe("eci-results", "elections", "constituency results and turnout",
    "https://results.eci.gov.in/", ["election", "result", "constituency"]);
  await probe("eci-main", "elections", "ECI publications, incl. SIR roll revision",
    "https://www.eci.gov.in/", ["electoral", "roll", "revision"]);
  await probe("eci-statistical", "elections", "statistical reports by state",
    "https://www.eci.gov.in/statistical-reports", ["statistical", "report", "assembly"]);

  // ── E. the blocked series ─────────────────────────────────────────
  await probe("sansad-q-search", "blocked", "Parliament answers: the tabled tables",
    "https://sansad.in/ls/questions/questions-and-answers", ["question", "answer", "ministry"]);
  await probe("sansad-rs-q", "blocked", "Rajya Sabha Q&A",
    "https://sansad.in/rs/questions/questions-and-answers", ["question", "answer", "ministry"]);
  await probe("ncrb-cii-2022", "blocked", "Crime in India tables: POCSO, murder by sex, riots",
    "https://www.ncrb.gov.in/crime-in-india-table-addtional-table-and-chapter-contents.html",
    ["crime", "table", "pdf", "xls"]);
  await probe("ncrb-publications", "blocked", "NCRB publication index",
    "https://www.ncrb.gov.in/en/crime-india", ["crime in india", "table", "download"]);
  await probe("mha-annual", "blocked", "MHA annual report: J&K incidents, LWE districts",
    "https://www.mha.gov.in/en/documents/annual-reports", ["annual report", "pdf"]);
  await probe("trai-pir", "blocked", "TRAI performance indicators: tele-density by circle",
    "https://www.trai.gov.in/release-publication/reports/performance-indicators-reports",
    ["performance indicator", "telecom", "pdf"]);
  await probe("pmay-u-dashboard", "blocked", "PMAY houses completed",
    "https://pmay-urban.gov.in/", ["houses", "sanctioned", "completed"]);
  await probe("ppac-gas", "blocked", "PNG connections and pipeline km",
    "https://ppac.gov.in/natural-gas/gas-infrastructure", ["pipeline", "png", "cgd"]);

  // ── F. cinema ─────────────────────────────────────────────────────
  await probe("cbfc-annual", "cinema", "films certified, a floor on cinema activity",
    "https://www.cbfcindia.gov.in/cbfcAdmin/statistics.php", ["certified", "films", "year"]);

  // ── G. aggregators worth one shot each ────────────────────────────
  await probe("datagov-catalog", "aggregator", "OGD India catalogue: many of the above at once",
    "https://www.data.gov.in/catalogs", ["catalog", "dataset", "resource"]);
  await probe("datagov-api-root", "aggregator", "OGD API without a key",
    "https://api.data.gov.in/lists?format=json&limit=5", ["records", "title", "index_name"]);
  await probe("wikidata-metro", "aggregator", "metro systems and opening years via SPARQL",
    "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(
      "SELECT ?s ?sLabel ?len WHERE { ?s wdt:P31 wd:Q1414671 ; wdt:P17 wd:Q668 . OPTIONAL{?s wdt:P2043 ?len} SERVICE wikibase:label { bd:serviceParam wikibase:language 'en'. } } LIMIT 40"),
    ["bindings", "sLabel", "Metro"]);

  const ok = checks.filter((c) => c.status === "ok").length;
  console.log(`\n${ok}/${checks.length} answered.\n`);
  for (const c of checks) {
    const hh = c.hits && Object.keys(c.hits).length ? ` hits=${JSON.stringify(c.hits)}` : "";
    console.log(
      `  ${c.status === "ok" ? "ok  " : "FAIL"} ${c.group.padEnd(10)} ${c.id.padEnd(24)} ` +
      `${(c.looksLike ?? "-").padEnd(5)} ${String(c.bytes ?? "").padStart(7)}b${hh} ${c.httpError ?? ""}`,
    );
  }
}

main().catch(async (err) => { console.error(err); await flush(); process.exit(1); });
