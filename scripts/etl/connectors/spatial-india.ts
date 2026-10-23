/**
 * Spatial India, read into the repository: `npm run spatial:india`. CI only —
 * the editing sandbox cannot reach the API.
 *
 * Writes:
 *   data/spatial-india/probe.json     what each documented endpoint returned, so the
 *                                     API's shape is on record rather than assumed;
 *   data/spatial-india/districts.json every district's base row (name, state, codes);
 *   data/spatial-india/values.json    every indicator for every district, with the
 *                                     API's own estimated flag and its metadata;
 *   data/spatial-india/outlines.json  district outlines, simplified, fetched once.
 *
 * The API is free and rate-limited. Requests are paced, a 429 makes the job
 * wait and retry, and the slow parts (per-district records, outlines) resume
 * where the last run stopped, within a time budget per run. A source that
 * fails leaves the previous files in place; connectors never throw.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isEntryPoint } from "../lib/entry";
import {
  SPATIAL_BASE, VALUES_VERSION, geometryOf, idOf, rowsOf, valuesIn,
  type Geometry, type SpatialDistricts, type SpatialIndicator, type SpatialProbe, type SpatialValues,
} from "../../../lib/spatial-india";

const DIR = join(process.cwd(), "data", "spatial-india");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const START = Date.now();
const BUDGET_MS = Number(process.env.SPATIAL_BUDGET_MIN ?? 45) * 60_000;
const left = () => BUDGET_MS - (Date.now() - START);
const PACE = 2_000;

/** One GET, paced, with patience for the rate limit: a 429 waits (Retry-After, or 30 s, 60 s, 120 s) and tries again. */
async function get(url: string, as: "json" | "text" = "json"): Promise<{ ok: true; data: unknown; text: string } | { ok: false; status: number; error: string }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": "bharat-tracker (district maps; github.com/chad3456/india-defence-infra-corridor)", accept: as === "json" ? "application/json" : "*/*" }, signal: AbortSignal.timeout(60_000) });
      await sleep(PACE);
      if (r.status === 429) {
        const wait = Number(r.headers.get("retry-after")) * 1000 || 30_000 * 2 ** attempt;
        console.log(`  429 on ${url.replace(SPATIAL_BASE, "")}; waiting ${Math.round(wait / 1000)} s`);
        await sleep(Math.min(wait, 180_000));
        continue;
      }
      const text = await r.text();
      if (!r.ok) return { ok: false, status: r.status, error: `HTTP ${r.status}` };
      if (as === "text") return { ok: true, data: null, text };
      try { return { ok: true, data: JSON.parse(text), text }; } catch { return { ok: false, status: r.status, error: "not JSON" }; }
    } catch (e) {
      await sleep(PACE);
      if (attempt === 3) return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
    }
  }
  return { ok: false, status: 429, error: "rate limited after four tries" };
}

const PROBE = [
  `${SPATIAL_BASE}/v1/openapi.json`, `${SPATIAL_BASE}/llms.txt`, `${SPATIAL_BASE}/v1/indicators`, `${SPATIAL_BASE}/v1/districts?limit=2`,
  `${SPATIAL_BASE}/v1/districts/1`, "https://spatialindia.com/api-platform.md", "https://spatialindia.com/terms",
];

export async function run(): Promise<void> {
  await mkdir(DIR, { recursive: true });

  // ── What the API says about itself ──
  const endpoints: SpatialProbe["endpoints"] = [];
  let openapi: Record<string, unknown> | null = null, detailSample: unknown = null;
  for (const url of PROBE) {
    const r = await get(url, url.endsWith(".json") || url.includes("/v1/") ? "json" : "text");
    const text = r.ok ? r.text : r.error;
    endpoints.push({ path: url.replace(SPATIAL_BASE, ""), status: r.ok ? 200 : r.status, contentType: "", sample: text.slice(0, url.endsWith("openapi.json") ? 60_000 : 8_000) });
    if (r.ok && url.endsWith("openapi.json")) openapi = r.data as Record<string, unknown>;
    if (r.ok && url.endsWith("/v1/districts/1")) detailSample = r.data;
    console.log(`  probe ${url}: ${r.ok ? `ok, ${r.text.length} bytes` : r.error}`);
  }
  await writeFile(join(DIR, "probe.json"), JSON.stringify({ fetchedAt: new Date().toISOString(), endpoints } satisfies SpatialProbe, null, 1) + "\n");

  // ── The catalogue of indicators ──
  const ind = await get(`${SPATIAL_BASE}/v1/indicators`);
  const indicators = ind.ok ? (rowsOf(ind.data) as unknown as SpatialIndicator[]).filter((x) => typeof x.id === "string") : [];
  const meta = ind.ok ? ((ind.data as { meta?: SpatialValues["meta"] }).meta ?? {}) : {};
  console.log(`indicators: ${indicators.length}`);

  // ── Every district's base row ──
  const rows: Array<Record<string, unknown>> = [];
  for (let off = 0; off < 2000; off += 100) {
    const r = await get(`${SPATIAL_BASE}/v1/districts?limit=100&offset=${off}`);
    if (!r.ok) { console.log(`  districts offset ${off}: ${r.error}`); break; }
    const page = rowsOf(r.data);
    rows.push(...page);
    if (page.length < 100) break;
  }
  const dfile = join(DIR, "districts.json");
  if (rows.length) await writeFile(dfile, JSON.stringify({ fetchedAt: new Date().toISOString(), source: `${SPATIAL_BASE}/v1/districts`, pagination: "limit+offset", count: rows.length, rows } satisfies SpatialDistricts) + "\n");
  else if (!existsSync(dfile)) { console.error("no districts at all"); process.exit(1); }
  const ids = (rows.length ? rows : (JSON.parse(await readFile(dfile, "utf8")) as SpatialDistricts).rows).map(idOf).filter((x): x is string => !!x);
  console.log(`districts: ${ids.length}`);

  // ── Indicator values ──
  // The OpenAPI document names the query parameters /v1/districts accepts; one that selects indicators
  // ("indicators", "fields", "include"…) lets 100 districts arrive per request. Failing that, each
  // district's own record (/v1/districts/{objectid}) carries every indicator, at one request each.
  const vfile = join(DIR, "values.json");
  const prev: SpatialValues | null = existsSync(vfile) ? (JSON.parse(await readFile(vfile, "utf8")) as SpatialValues) : null;
  const want = new Set(indicators.map((i) => i.id));
  const values: SpatialValues["values"] = prev && prev.version === VALUES_VERSION && prev.meta?.dataset_version === meta.dataset_version ? { ...prev.values } : {};
  let method = prev?.method ?? "";
  const params = (((openapi?.paths as Record<string, Record<string, { parameters?: Array<{ name?: string }> }>>)?.["/v1/districts"]?.get?.parameters) ?? []).map((p) => p.name ?? "").filter(Boolean);
  console.log(`openapi /v1/districts parameters: ${params.join(", ") || "(none found)"}`);
  const selector = params.find((p) => /^(indicators?|fields|include|columns|select)$/i.test(p));
  if (selector && want.size) {
    const list = [...want];
    for (let i = 0; i < list.length && left() > 0; i += 20) {
      const chunk = list.slice(i, i + 20);
      for (let off = 0; off < ids.length + 100; off += 100) {
        const r = await get(`${SPATIAL_BASE}/v1/districts?limit=100&offset=${off}&${selector}=${encodeURIComponent(chunk.join(","))}`);
        if (!r.ok) { console.log(`  values ${i}/${off}: ${r.error}`); break; }
        const page = rowsOf(r.data);
        for (const row of page) { const id = idOf(row); if (id) values[id] = { ...(values[id] ?? {}), ...valuesIn(row, new Set(chunk)) }; }
        if (page.length < 100) break;
      }
    }
    method = `GET /v1/districts?${selector}=…, 100 districts a request`;
  }
  const filled = () => Object.values(values).filter((v) => Object.keys(v).length >= want.size * 0.5).length;
  if (filled() < ids.length * 0.5 && detailSample) {
    method = "GET /v1/districts/{objectid}, one district a request";
    const todo = ids.filter((id) => !values[id] || Object.keys(values[id]!).length < want.size * 0.5);
    console.log(`values by district record: ${todo.length} to fetch`);
    for (const id of todo) {
      if (left() < 10 * 60_000) { console.log("  time budget reached; the next run continues"); break; }
      const r = await get(`${SPATIAL_BASE}/v1/districts/${encodeURIComponent(id)}`);
      if (r.ok && r.data && typeof r.data === "object") values[id] = valuesIn(r.data as Record<string, unknown>, want);
    }
  }
  console.log(`values: ${filled()} of ${ids.length} districts carry most indicators (${method})`);
  if (Object.keys(values).length) await writeFile(vfile, JSON.stringify({ version: VALUES_VERSION, fetchedAt: new Date().toISOString(), method, meta, indicators, values } satisfies SpatialValues) + "\n");

  // ── Outlines: fetched once, resumed across runs ──
  const ofile = join(DIR, "outlines.json");
  const have: Record<string, Geometry> = existsSync(ofile) ? (JSON.parse(await readFile(ofile, "utf8")) as Record<string, Geometry>) : {};
  const need = ids.filter((id) => !have[id]);
  console.log(`outlines: ${Object.keys(have).length} stored, ${need.length} to fetch`);
  let fails = 0;
  for (const id of need) {
    if (left() < 3 * 60_000) { console.log("  time budget reached; the next run continues"); break; }
    const r = await get(`${SPATIAL_BASE}/v1/boundaries/${encodeURIComponent(id)}.geojson`);
    const g = r.ok ? geometryOf(r.data) : null;
    if (g) have[id] = g; else if (++fails <= 5) console.log(`  outline ${id}: ${r.ok ? "no geometry" : r.error}`);
  }
  if (Object.keys(have).length) await writeFile(ofile, JSON.stringify(have) + "\n");
  console.log(`outlines: ${Object.keys(have).length} stored, ${fails} failed`);
}

if (isEntryPoint(import.meta.url)) {
  run().catch((e) => { console.error(e); process.exit(1); });
}
