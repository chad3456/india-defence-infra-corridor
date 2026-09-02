/**
 * Find a complete, citable list of Vande Bharat services.
 *
 * OSM has eight route relations traced. The real fleet is around 160, so the
 * map currently shows five per cent of the network and implies it is all of it.
 * That is the worst kind of wrong: plausible, drawn, and silently partial.
 *
 * What a usable source has to carry, in priority order:
 *   1. every service, with train numbers -- the number is the identity, and it
 *      is what a tracking site can be queried with later
 *   2. origin and destination stations, so a route can be drawn at all
 *   3. whether the service is running, distinct from announced
 *   4. distance and frequency, which turn a line on a map into a measurement
 *
 * Live-running sites are probed too, because "active" is the user's question
 * and a published list answers it only as of its last edit. They are mostly
 * JavaScript front-ends over private APIs, so this checks what actually comes
 * back rather than assuming any of them are scrapable.
 *
 * Publishes nothing.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText, getJson } from "./lib/http";

const ROOT = process.cwd();
const OUT = join(ROOT, "data/live/vande-probe.json");

const BROWSER = {
  "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

interface Check {
  id: string; group: string; url: string;
  status: "ok" | "failed";
  httpError?: string; bytes?: number; looksLike?: string;
  /** Signals that the payload is the list, not a landing page. */
  hits?: Record<string, number>;
  /** How many things that look like train numbers appear. */
  trainNumbers?: number;
  sample?: string;
}
const checks: Check[] = [];
interface TableSummary {
  i: number; caption: string | null; headers: string[]; rows: number; firstRow: string[];
}
let tableReport: TableSummary[] | null = null;

function classify(b: string): string {
  const t = b.slice(0, 300).toLowerCase();
  if (t.startsWith("{") || t.startsWith("[")) return "json";
  if (t.includes("<?xml")) return "xml";
  if (t.includes("<html") || t.includes("<!doctype")) return "html";
  return "text";
}
function hits(b: string, terms: string[]): Record<string, number> {
  const o: Record<string, number> = {};
  const low = b.toLowerCase();
  for (const t of terms) {
    const n = low.split(t.toLowerCase()).length - 1;
    if (n > 0) o[t] = n;
  }
  return o;
}
/** Vande Bharat services are numbered in the 20xxx / 22xxx / 26xxx ranges. */
function countTrainNumbers(b: string): number {
  const m = b.match(/\b(20\d{3}|22\d{3}|26\d{3})\b/g);
  return m ? new Set(m).size : 0;
}

async function probe(id: string, group: string, url: string, terms: string[], browser = false): Promise<void> {
  const res = await getText(url, {
    timeoutMs: 45_000, retries: 1, cacheMs: 0,
    headers: browser ? BROWSER : undefined,
  });
  if (!res.ok || res.data === null) {
    checks.push({ id, group, url, status: "failed", httpError: res.error });
  } else {
    const b = res.data;
    checks.push({
      id, group, url, status: "ok", bytes: b.length, looksLike: classify(b),
      hits: hits(b, terms), trainNumbers: countTrainNumbers(b),
      sample: b.replace(/\s+/g, " ").slice(0, 200),
    });
  }
  await flush();
}

async function flush(): Promise<void> {
  await mkdir(join(ROOT, "data/live"), { recursive: true });
  await writeFile(OUT, JSON.stringify({ probedAt: new Date().toISOString(), tableReport, checks }, null, 2) + "\n", "utf8");
}

async function main(): Promise<void> {
  // ── A. the list ───────────────────────────────────────────────────
  // Wikipedia's API returns wikitext, which parses far more reliably than
  // rendered HTML: a table row is a line, not a DOM to guess at.
  await probe("wiki-raw-list", "list",
    "https://en.wikipedia.org/w/index.php?title=List_of_Vande_Bharat_Express_routes&action=raw",
    ["vande bharat", "|", "km", "daily"]);
  await probe("wiki-raw-main", "list",
    "https://en.wikipedia.org/w/index.php?title=Vande_Bharat_Express&action=raw",
    ["vande bharat", "route", "rake"]);
  await probe("wiki-api-parse", "list",
    "https://en.wikipedia.org/w/api.php?action=parse&page=List_of_Vande_Bharat_Express_routes&prop=wikitext&format=json",
    ["wikitext", "vande bharat"]);
  // Wikidata: services modelled as items would give stable ids and endpoints.
  await probe("wikidata-vb", "list",
    "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(
      "SELECT ?t ?tLabel ?from ?fromLabel ?to ?toLabel WHERE { ?t wdt:P31/wdt:P279* wd:Q17518461 ; wdt:P17 wd:Q668 . " +
      "OPTIONAL { ?t wdt:P1427 ?from } OPTIONAL { ?t wdt:P1444 ?to } " +
      "SERVICE wikibase:label { bd:serviceParam wikibase:language 'en'. } } LIMIT 300"),
    ["bindings", "tLabel"]);

  // ── B. station coordinates, to draw anything at all ───────────────
  await probe("osm-stations", "geo",
    "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(
      '[out:json][timeout:120];area["ISO3166-1"="IN"][admin_level=2]->.in;' +
      'node["railway"="station"](area.in);out tags center 3000;'),
    ["railway", "station", "name"]);

  // ── C. live running: is the service actually operating today ──────
  for (const [id, url] of [
    ["ntes", "https://enquiry.indianrail.gov.in/mntes/"],
    ["erail", "https://erail.in/trains-between-stations"],
    ["railyatri", "https://www.railyatri.in/live-train-status"],
    ["indiarailinfo", "https://indiarailinfo.com/search/vande-bharat/0/0/0"],
    ["trainman", "https://www.trainman.in/live-train-status"],
  ] as const) {
    await probe(id, "live", url, ["train", "status", "running", "vande"], true);
  }

  // ── D. the operator, for a citable count ──────────────────────────
  await probe("pib-vb", "official",
    "https://www.pib.gov.in/PressReleseDetail.aspx?PRID=2001000", ["vande bharat", "trains"], true);
  await probe("indianrail-vb", "official",
    "https://indianrailways.gov.in/", ["vande", "train"], true);

  // ── E. round two: WHERE is the route table? ───────────────────────
  //
  // The dedicated list page 404s and the main article carries no train numbers,
  // so the table is on a page whose title I do not know. Asking the search API
  // is the alternative to guessing at titles one at a time.
  await probe("wiki-search", "list",
    "https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=20&srsearch=" +
    encodeURIComponent("Vande Bharat Express routes list"),
    ["title", "snippet", "Vande Bharat"]);
  await probe("wiki-cat", "list",
    "https://en.wikipedia.org/w/api.php?action=query&format=json&list=categorymembers&cmlimit=200&cmtitle=" +
    encodeURIComponent("Category:Vande Bharat Express"),
    ["title", "pageid"]);
  // What tables does the main article actually contain? Reported as structure
  // rather than sampled text, so the answer is which table to read, not a guess.
  {
    const res = await getText(
      "https://en.wikipedia.org/w/index.php?title=Vande_Bharat_Express&action=raw",
      { timeoutMs: 45_000, retries: 1, cacheMs: 0 },
    );
    if (res.ok && res.data) {
      const { parseTables } = await import("./lib/wikitext");
      const tables = parseTables(res.data);
      tableReport = tables.map((t, i) => ({
        i, caption: t.caption, headers: t.headers.slice(0, 12), rows: t.rows.length,
        firstRow: t.rows[0]?.slice(0, 8) ?? [],
      }));
      console.log(`\nmain article: ${tables.length} table(s)`);
      for (const t of tableReport) {
        console.log(`  [${t.i}] rows=${t.rows} caption=${JSON.stringify(t.caption)?.slice(0, 50)}`);
        console.log(`       headers: ${t.headers.join(" | ").slice(0, 150)}`);
      }
    }
  }

  console.log("");
  for (const c of checks) {
    const h = c.hits && Object.keys(c.hits).length ? JSON.stringify(c.hits) : "";
    console.log(
      `  ${c.status === "ok" ? "ok  " : "FAIL"} ${c.group.padEnd(9)} ${c.id.padEnd(16)} ` +
      `${(c.looksLike ?? "-").padEnd(5)} ${String(c.bytes ?? "").padStart(8)}b ` +
      `trainNos=${String(c.trainNumbers ?? 0).padStart(4)} ${h.slice(0, 46)} ${c.httpError ?? ""}`,
    );
  }
}

main().catch(async (e) => { console.error(e); await flush(); process.exit(1); });
