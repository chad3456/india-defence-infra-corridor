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
 *
 * ── Waiting for a slot instead of knocking harder ────────────────────────
 *
 * The first live run got 24 metrics and then every remaining query failed at
 * the connection level, seven seconds apart, for eleven minutes: Overpass had
 * rate-limited the runner and the loop kept knocking. A fixed gap is not a
 * rate limit, it is a guess about one.
 *
 * Overpass publishes the real answer at /api/status — how many slots the
 * caller has and, when it has none, the time the next one frees. This asks,
 * and waits for the time it is given. If it is refused anyway it stops after
 * three consecutive failures rather than spending the rest of the job
 * discovering the same thing ninety-seven more times; the run is resumable, so
 * stopping early costs nothing but the wait.
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
/**
 * The main instance first, then the public mirrors the Overpass API wiki lists
 * for exactly this purpose. Rotation happens only when an instance says it has
 * no slot for us — it is a way of spreading load off a busy server, not a way
 * of getting around one that has said no.
 */
const ENDPOINTS = [
  "https://overpass-api.de/api",
  "https://overpass.kumi.systems/api",
  "https://overpass.private.coffee/api",
] as const;

/**
 * Above this a result is assumed truncated rather than complete.
 *
 * The first setting of 60,000 was too low, and one metric proved it: water
 * wells came back at exactly the limit with Maharashtra holding 47,927 of
 * them, which is not a fact about Maharashtra but about the order Overpass
 * happened to traverse in before it stopped. Two more — level crossings at
 * 56,540 and hospitals at 55,635 — were close enough to the ceiling that they
 * could not be shown to be under it.
 *
 * A coordinate row in CSV is about twenty-two bytes, so this ceiling is a few
 * megabytes rather than the hundreds a tagged JSON response would cost. It is
 * still a ceiling, and a metric that reaches it is still recorded as CAPPED
 * and refused a ranking.
 */
const LIMIT = 200_000;
/** Floor between queries even when a slot is free. */
const GAP_MS = 7_000;
/** Beyond this wait for a slot, try a different instance instead. */
const MAX_SLOT_WAIT_MS = 90_000;
/** Consecutive failures after which the run gives up and leaves it to the next. */
const MAX_CONSECUTIVE_FAILURES = 3;
/**
 * How long a run will keep asking before leaving the rest to the next one.
 *
 * The job is allowed 55 minutes. This was 42, which left thirteen unused
 * because the budget was set when a run could still die at a rate limit and
 * the headroom was insurance against that. The slot protocol removed that
 * failure mode — run three spent its whole budget and counted 42 metrics
 * without one failure — so the insurance is now just idle time. Seven minutes
 * is enough for a slow final query plus the commit.
 */
const RUN_BUDGET_MS = 48 * 60_000;

interface Metric {
  id: string;
  total: number;
  byState: Record<string, number>;
  /** Points that fell outside every state polygon — offshore, or bad geometry. */
  unplaced: number;
  capped: boolean;
  /** The ceiling this count was taken under; a lower one earns a re-fetch. */
  limit?: number;
  /** Which Overpass instance answered — the counts are only as good as it was. */
  endpoint?: string;
  fetchedAt: string;
}

let last = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function floorGap(): Promise<void> {
  const w = GAP_MS - (Date.now() - last);
  if (w > 0) await sleep(w);
  last = Date.now();
}

/**
 * Read one instance's slot state.
 *
 * The body is plain text, either "2 slots available now." or one
 * "Slot available after: <time>, in <n> seconds." line per busy slot. Returns
 * the wait in ms — 0 when a slot is free, null when the status page itself
 * could not be read or did not say, which is treated as "do not use this
 * instance": a status page we cannot parse is not permission to proceed.
 */
export function parseSlotWait(body: string): number | null {
  if (/\bslots? available now\b/i.test(body)) return 0;
  // "Rate limit: 0" means the instance does not rate-limit at all, so every
  // request has a slot. It is not the same as having zero slots left, which is
  // reported by the "Slot available after" lines below.
  const noLimit = /\bRate limit:\s*0\b/i.test(body);
  const waits = [...body.matchAll(/\bin (-?\d+) seconds?\b/gi)].map((m) => Number(m[1]));
  if (waits.length > 0) return Math.max(0, Math.min(...waits)) * 1000 + 2_000;
  if (noLimit) return 0;
  return null;
}

async function slotWaitMs(api: string): Promise<number | null> {
  const res = await getText(`${api}/status`, { timeoutMs: 20_000, retries: 1, cacheMs: 0 });
  if (!res.ok || res.data === null) return null;
  return parseSlotWait(res.data);
}

/**
 * Pick an instance with a slot, waiting a bounded amount for one. Returns null
 * when every instance is either busy for longer than we will wait or not
 * answering — the signal to stop this run rather than to try harder.
 */
async function claimSlot(log: (s: string) => void): Promise<string | null> {
  let shortest: { api: string; wait: number } | null = null;
  for (const api of ENDPOINTS) {
    const wait = await slotWaitMs(api);
    if (wait === null) { log(`  status unreadable: ${api}`); continue; }
    if (wait === 0) return api;
    if (shortest === null || wait < shortest.wait) shortest = { api, wait };
  }
  if (shortest !== null && shortest.wait <= MAX_SLOT_WAIT_MS) {
    log(`  no slot free; waiting ${Math.round(shortest.wait / 1000)}s for ${shortest.api}`);
    await sleep(shortest.wait);
    return shortest.api;
  }
  if (shortest !== null) log(`  soonest slot is ${Math.round(shortest.wait / 1000)}s away — longer than this run will wait`);
  return null;
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
    const stale = Object.values(metrics).filter((m) => m.capped && (m.limit ?? 0) < LIMIT).length;
    log(`already counted: ${Object.keys(metrics).length}${stale ? `, of which ${stale} to recount under the raised limit` : ""}`);
  } catch { /* first run */ }

  let done = 0;
  let consecutiveFailures = 0;
  for (const spec of CENSUS_SPECS) {
    const held = metrics[spec.id];
    // A count taken under a lower ceiling and stopped by it is not a count.
    // Anything else already held is left alone — this stays resumable, not
    // a full refetch every run.
    if (held && !(held.capped && (held.limit ?? 0) < LIMIT)) continue;
    if (held) log(`  recounting ${spec.id}: was capped at ${held.limit ?? "an older limit"}`);
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

    await floorGap();
    const api = await claimSlot(log);
    if (api === null) {
      log(`no instance has a slot for us; stopping at ${Object.keys(metrics).length} of ${CENSUS_SPECS.length}. Next run resumes.`);
      errors.push("census: no Overpass slot available; run stopped early");
      break;
    }

    const res = await getText(`${api}/interpreter?data=${encodeURIComponent(q)}`, {
      timeoutMs: 240_000, retries: 2, cacheMs: 0,
    });
    if (!res.ok || res.data === null) {
      errors.push(`census: ${spec.id}: ${res.error ?? "no body"}`);
      log(`  FAIL ${spec.id}: ${res.error}`);
      // A run of failures means the service has stopped answering us, not that
      // these particular metrics are unlucky. Knocking ninety-seven more times
      // at seven-second intervals is what the first run did; it learned
      // nothing and was rude about it.
      if (++consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        log(`${consecutiveFailures} failures in a row; stopping. Next run resumes.`);
        break;
      }
      continue;
    }
    consecutiveFailures = 0;

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
      limit: LIMIT,
      endpoint: api,
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
