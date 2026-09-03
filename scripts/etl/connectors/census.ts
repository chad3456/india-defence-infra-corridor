/**
 * Count 121 kinds of thing, per state, from OpenStreetMap.
 *
 * The premise is that these are questions nobody publishes a table for. No
 * ministry owns "planetariums by state" or "stepwells by state", so the only
 * way to get the number is to count what is on the map.
 *
 * ── How the counting works, and why it is done this way ──────────────────
 *
 * One Overpass query per metric, asking for coordinates only in CSV. A JSON
 * response with tags is roughly twenty times larger for the same information,
 * and the tags are not needed: the filter already selected the things that
 * match, so all that remains is where each one is.
 *
 * States are assigned locally by point-in-polygon rather than by asking
 * Overpass 121 x 36 times. Four thousand queries against a free endpoint to
 * learn what one query plus some arithmetic can tell you is not a reasonable
 * way to treat a shared service.
 *
 * ── The honest failure this guards ───────────────────────────────────────
 *
 * Overpass truncates rather than erroring when a query is too large. A metric
 * that comes back at exactly its limit is therefore recorded as CAPPED and the
 * page refuses to rank it, because a truncated count looks exactly like a real
 * one and would put whichever states Overpass happened to reach at the top.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import { getText } from "../lib/http";
import { CENSUS_SPECS } from "../../../lib/census-specs";

const ROOT = process.cwd();
const OUT = join(ROOT, "data/census/counts.json");
const STATE_FILE = join(ROOT, "data/geo/india-states.topo.json");
const OVERPASS = "https://overpass-api.de/api/interpreter";

/** Above this a result is assumed truncated rather than complete. */
const LIMIT = 60_000;
/** Overpass is a shared free service; this is the politeness budget. */
const GAP_MS = 7_000;
const RUN_BUDGET_MS = 45 * 60_000;

interface Metric {
  id: string;
  total: number;
  byState: Record<string, number>;
  /** Points that fell outside every state polygon — offshore, or bad geometry. */
  unplaced: number;
  capped: boolean;
  fetchedAt: string;
}

let last = 0;
async function pace(): Promise<void> {
  const w = GAP_MS - (Date.now() - last);
  if (w > 0) await new Promise((r) => setTimeout(r, w));
  last = Date.now();
}

async function loadStates(): Promise<FeatureCollection<Geometry, { name: string | null }>> {
  const raw = JSON.parse(await readFile(STATE_FILE, "utf8")) as
    Topology<{ india: GeometryCollection<{ name: string | null }> }>;
  return feature(raw, raw.objects.india) as FeatureCollection<Geometry, { name: string | null }>;
}

export async function run(opts: { onProgress?: (s: string) => void } = {}): Promise<{ errors: string[] }> {
  const log = opts.onProgress ?? (() => {});
  const errors: string[] = [];
  const started = Date.now();
  await mkdir(join(ROOT, "data/census"), { recursive: true });

  const states = await loadStates();
  const names = states.features.map((f) => f.properties?.name ?? "");
  log(`state polygons: ${states.features.length}`);

  // Resume across runs: 121 paced queries will not always fit one job.
  let metrics: Record<string, Metric> = {};
  try {
    const prev = JSON.parse(await readFile(OUT, "utf8")) as { metrics?: Record<string, Metric> };
    metrics = prev.metrics ?? {};
    log(`already counted: ${Object.keys(metrics).length}`);
  } catch { /* first run */ }

  let done = 0;
  for (const spec of CENSUS_SPECS) {
    if (metrics[spec.id]) continue;
    if (Date.now() - started > RUN_BUDGET_MS) {
      log(`budget spent; ${Object.keys(metrics).length} of ${CENSUS_SPECS.length} counted. Next run resumes.`);
      break;
    }

    // CSV of coordinates only. `nwr` covers nodes, ways and relations in one
    // pass, and `out center` gives a single point for the areal ones.
    const q =
      `[out:csv(::lat,::lon;false)][timeout:180];` +
      `area["ISO3166-1"="IN"][admin_level=2]->.in;` +
      `nwr${spec.filter}(area.in);out center ${LIMIT};`;

    await pace();
    const res = await getText(`${OVERPASS}?data=${encodeURIComponent(q)}`, {
      timeoutMs: 240_000, retries: 2, cacheMs: 0,
    });
    if (!res.ok || res.data === null) {
      errors.push(`census: ${spec.id}: ${res.error ?? "no body"}`);
      log(`  FAIL ${spec.id}: ${res.error}`);
      continue;
    }

    const byState: Record<string, number> = {};
    let total = 0, unplaced = 0;
    for (const line of res.data.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      const [latS, lonS] = t.split(/[\t,]/);
      const lat = Number(latS), lon = Number(lonS);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      total++;
      let hit = false;
      for (let i = 0; i < states.features.length; i++) {
        if (geoContains(states.features[i]!, [lon, lat])) {
          const n = names[i] ?? "";
          byState[n] = (byState[n] ?? 0) + 1;
          hit = true;
          break;
        }
      }
      if (!hit) unplaced++;
    }

    metrics[spec.id] = {
      id: spec.id, total, byState, unplaced,
      capped: total >= LIMIT,
      fetchedAt: new Date().toISOString(),
    };
    done++;
    log(`  ${spec.id.padEnd(18)} ${String(total).padStart(6)}${metrics[spec.id]!.capped ? " CAPPED" : ""} across ${Object.keys(byState).length} state(s)`);

    // Write after every metric: a run killed by the job timeout keeps its work.
    await writeFile(OUT, JSON.stringify({ builtAt: new Date().toISOString(), limit: LIMIT, metrics }), "utf8");
  }

  const capped = Object.values(metrics).filter((m) => m.capped).map((m) => m.id);
  if (capped.length > 0) log(`capped (treated as incomplete): ${capped.join(", ")}`);
  log(`counted this run: ${done}; total held: ${Object.keys(metrics).length} of ${CENSUS_SPECS.length}`);
  return { errors };
}
