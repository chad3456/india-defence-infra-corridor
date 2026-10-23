/**
 * Spatial India, read into the repository: `npm run spatial:india`. CI only —
 * the editing sandbox cannot reach the API.
 *
 * Writes:
 *   data/spatial-india/probe.json      what each endpoint returned (status, a sample),
 *                                      so the API's shape is on record, not assumed;
 *   data/spatial-india/districts.json  every district row, every field, as served;
 *   data/spatial-india/boundaries.json district outlines, simplified, fetched once
 *                                      (they do not change week to week).
 *
 * The free tier returns at most 100 rows a request, so the job pages through.
 * Boundaries are fetched one at a time with a pause between requests. A source
 * that fails leaves the previous files in place; connectors never throw.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getJson, getText } from "../lib/http";
import { isEntryPoint } from "../lib/entry";
import { SPATIAL_BASE, geometryOf, idOf, rowsOf, type Geometry, type SpatialDistricts, type SpatialProbe } from "../../../lib/spatial-india";

const DIR = join(process.cwd(), "data", "spatial-india");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PROBE = ["/", "/v1", "/openapi.json", "/docs", "/v1/fields", "/v1/indicators", "/v1/meta", "/v1/sources", "/v1/states", "/v1/districts?limit=2", "/llms.txt"];

async function pages(param: (page: number) => string): Promise<Array<Record<string, unknown>> | null> {
  const all: Array<Record<string, unknown>> = [];
  let firstOfLast = "";
  for (let p = 0; p < 15; p++) {
    const r = await getJson<unknown>(`${SPATIAL_BASE}/v1/districts?${param(p)}`, { timeoutMs: 60_000, retries: 2, cacheMs: 0 });
    await sleep(800);
    if (!r.ok) { console.log(`  page ${p}: ${r.error}`); return p ? all : null; }
    const rows = rowsOf(r.data);
    const key = JSON.stringify(rows[0] ?? {});
    // A paging parameter the API ignores returns the same first page again.
    if (p > 0 && key === firstOfLast) { console.log(`  page ${p} repeats page ${p - 1}: parameter ignored`); return p > 1 ? all : null; }
    firstOfLast = key;
    all.push(...rows);
    if (rows.length < 100) break;
  }
  return all;
}

export async function run(): Promise<void> {
  await mkdir(DIR, { recursive: true });
  // ── What the API says about itself ──
  const endpoints: SpatialProbe["endpoints"] = [];
  for (const path of PROBE) {
    const r = await getText(`${SPATIAL_BASE}${path}`, { timeoutMs: 30_000, retries: 1, cacheMs: 0 });
    await sleep(500);
    endpoints.push({ path, status: r.ok ? 200 : Number(/HTTP (\d+)/.exec(r.error ?? "")?.[1] ?? 0), contentType: "", sample: (r.data ?? r.error ?? "").slice(0, 6000) });
    console.log(`  probe ${path}: ${r.ok ? "ok" : r.error} ${(r.data ?? "").length} bytes`);
  }
  await writeFile(join(DIR, "probe.json"), JSON.stringify({ fetchedAt: new Date().toISOString(), endpoints } satisfies SpatialProbe, null, 1) + "\n");

  // ── Every district, every field ──
  const tries: Array<[string, (p: number) => string]> = [
    ["limit+offset", (p) => `limit=100&offset=${p * 100}`],
    ["limit+page (1-based)", (p) => `limit=100&page=${p + 1}`],
    ["per_page+page", (p) => `per_page=100&page=${p + 1}`],
    ["limit+skip", (p) => `limit=100&skip=${p * 100}`],
  ];
  let rows: Array<Record<string, unknown>> | null = null, how = "";
  for (const [name, f] of tries) {
    console.log(`districts by ${name}`);
    rows = await pages(f);
    if (rows && rows.length > 100) { how = name; break; }
    if (rows && !how) how = `${name} (one page only)`;
  }
  const out = join(DIR, "districts.json");
  if (!rows?.length) { console.error("no district rows; previous file kept"); if (!existsSync(out)) process.exit(1); return; }
  // One row per district, by its id where it has one.
  const seen = new Set<string>();
  rows = rows.filter((r) => { const k = idOf(r) ?? JSON.stringify(r); if (seen.has(k)) return false; seen.add(k); return true; });
  console.log(`districts: ${rows.length} rows by ${how}; fields: ${Object.keys(rows[0]!).length}`);
  console.log(`  first row keys: ${Object.keys(rows[0]!).join(", ").slice(0, 1500)}`);
  const doc: SpatialDistricts = { fetchedAt: new Date().toISOString(), source: `${SPATIAL_BASE}/v1/districts`, pagination: how, count: rows.length, rows };
  await writeFile(out, JSON.stringify(doc) + "\n");

  // ── Outlines: fetched once ──
  const bfile = join(DIR, "boundaries.json");
  const have: Record<string, Geometry> = existsSync(bfile) ? JSON.parse(await readFile(bfile, "utf8")) as Record<string, Geometry> : {};
  const want = rows.map(idOf).filter((x): x is string => !!x && !have[x]);
  console.log(`boundaries: ${Object.keys(have).length} stored, ${want.length} to fetch`);
  let fails = 0;
  for (const id of want) {
    const r = await getJson<unknown>(`${SPATIAL_BASE}/v1/boundaries/${encodeURIComponent(id)}.geojson`, { timeoutMs: 30_000, retries: 1, cacheMs: 0 });
    await sleep(600);
    const g = r.ok ? geometryOf(r.data) : null;
    if (g) have[id] = g;
    else if (++fails <= 5) console.log(`  boundary ${id}: ${r.ok ? "no geometry in the response" : r.error}`);
    // Stop early if boundaries are not served at all: three straight failures and nothing stored.
    if (fails >= 3 && Object.keys(have).length === 0) { console.log("  boundaries not served for these ids; stopping"); break; }
  }
  if (Object.keys(have).length) await writeFile(bfile, JSON.stringify(have) + "\n");
  console.log(`boundaries: ${Object.keys(have).length} stored, ${fails} failed`);
}

if (isEntryPoint(import.meta.url)) {
  run().catch((e) => { console.error(e); process.exit(1); });
}
