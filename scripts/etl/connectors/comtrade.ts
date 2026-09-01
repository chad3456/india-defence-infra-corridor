/**
 * UN Comtrade: India's imports and exports at six-digit commodity level.
 *
 * This is the evidence base for the made-in-India dashboard. Everything the
 * page claims about a product reduces to two numbers per year for one HS6
 * line, and this is where those numbers come from.
 *
 * ── What the probe established, and why each of these matters ────────────
 *
 * `data/live/trade-probe.json` carries the run. Four findings shape this file:
 *
 *  1. `partner2Code` splits every commodity into 215 rows. A request that does
 *     not pin it returns fragments, and summing them inflates each line by a
 *     factor of a couple of hundred. `motCode` and `customsCode` split it
 *     further. All three are pinned on every call below, and the response is
 *     rejected if a commodity still arrives more than once — this is not the
 *     kind of error that should be trusted to a comment.
 *
 *  2. The free tier caps at 500 rows and reports `count: 500` next to it, so a
 *     truncated answer is indistinguishable from a complete one by the
 *     envelope. Batches are therefore sized so a full answer is provably under
 *     the cap, and a batch that comes back at exactly the cap is treated as
 *     failed rather than partial.
 *
 *  3. Multiple periods in one call is a 400. One call per year.
 *
 *  4. Naming commodity codes explicitly is the only way to page past the cap.
 *
 * ── Resumable, because the alternative keeps failing ─────────────────────
 *
 * Several hundred calls will not always finish inside one job. Every batch is
 * written the moment it lands and recorded in a state file, so a run that dies
 * halfway keeps what it fetched and the next run continues from there. This
 * project has lost work five separate times to all-or-nothing writes — a
 * validation gate that discarded a whole good batch for one bad row, a survey
 * connector that replaced instead of merged and deleted a live series when an
 * unrelated fetch timed out. This connector is built to make that impossible.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getJson } from "../lib/http";

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, "data/trade");
const STATE_PATH = join(ROOT, "data/live/trade-ingest-state.json");
const UNIVERSE_PATH = join(ROOT, "data/trade/hs6-universe.json");

const INDIA = 699;

/**
 * Codes per request.
 *
 * Two flows are requested together, so a batch of 240 codes can return at most
 * 480 rows — provably under the 500 cap, which is what lets a 500-row response
 * be read as an error rather than a coincidence.
 */
const BATCH = 240;
/** Politeness. The free tier is a shared public good with no key required. */
const MIN_GAP_MS = 1_300;
/** Leave the job time to commit what it has. */
const RUN_BUDGET_MS = 40 * 60_000;
const CAP = 500;

/**
 * Years fetched.
 *
 * Not every year since 2001: at ~22 calls per year that would be a thousand
 * requests against a free public endpoint for a chart nobody will read at
 * single-year resolution. These give three consecutive years at each end —
 * which is what `classifyLine` compares — plus enough between them to draw a
 * shape and to show where an HS revision falls.
 */
const YEARS = [2002, 2003, 2004, 2008, 2012, 2013, 2017, 2018, 2022, 2023, 2024];

interface Row {
  cmdCode?: string;
  flowCode?: string;
  period?: string | number;
  primaryValue?: number;
}
interface Envelope { count?: number | null; data?: Row[] }

/**
 * One commodity-year, both flows.
 *
 * No description field: the preview endpoint returns `cmdDesc: null` on every
 * row, so the trade data cannot name its own products. Names live once in
 * `hs6-universe.json` rather than being repeated across eleven year files.
 */
export interface YearRow { code: string; m: number; x: number }

interface State {
  /** `${year}:${batchIndex}` for every batch already written. */
  done: string[];
  lastRunAt: string;
  /** Batches that failed, with why. Kept so failures are visible, not silent. */
  failed: Array<{ key: string; error: string; at: string }>;
}

async function readState(): Promise<State> {
  try {
    return JSON.parse(await readFile(STATE_PATH, "utf8")) as State;
  } catch {
    return { done: [], lastRunAt: "", failed: [] };
  }
}

async function readUniverse(): Promise<string[]> {
  const raw = await readFile(UNIVERSE_PATH, "utf8");
  const parsed = JSON.parse(raw) as { codes: string[] };
  if (!Array.isArray(parsed.codes) || parsed.codes.length === 0) {
    throw new Error("hs6-universe.json has no codes");
  }
  return parsed.codes;
}

async function readYear(year: number): Promise<Map<string, YearRow>> {
  try {
    const raw = await readFile(join(OUT_DIR, `hs6-${year}.json`), "utf8");
    const rows = JSON.parse(raw) as YearRow[];
    return new Map(rows.map((r) => [r.code, r]));
  } catch {
    return new Map();
  }
}

async function writeYear(year: number, rows: Map<string, YearRow>): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const sorted = [...rows.values()].sort((a, b) => a.code.localeCompare(b.code));
  await writeFile(join(OUT_DIR, `hs6-${year}.json`), JSON.stringify(sorted) + "\n", "utf8");
}

let lastCall = 0;
async function pace(): Promise<void> {
  const wait = MIN_GAP_MS - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

/**
 * Fetch one batch of codes for one year, both flows.
 *
 * Returns an error string rather than throwing: one bad batch must cost that
 * batch and nothing else.
 */
async function fetchBatch(
  year: number,
  codes: string[],
): Promise<{ ok: true; rows: YearRow[] } | { ok: false; error: string }> {
  const qs = new URLSearchParams({
    reporterCode: String(INDIA),
    period: String(year),
    partnerCode: "0",
    flowCode: "M,X",
    cmdCode: codes.join(","),
    // The three splitting dimensions, pinned. See the probe.
    motCode: "0",
    customsCode: "C00",
    partner2Code: "0",
  });
  const url = `https://comtradeapi.un.org/public/v1/preview/C/A/HS?${qs.toString()}`;
  await pace();
  const res = await getJson<Envelope>(url, { timeoutMs: 120_000, retries: 3, cacheMs: 0 });
  if (!res.ok || !res.data) return { ok: false, error: res.error ?? "no data" };

  const raw = Array.isArray(res.data.data) ? res.data.data : [];
  if (raw.length >= CAP) {
    return {
      ok: false,
      error: `hit the ${CAP}-row cap with ${codes.length} codes — batch too large, answer is truncated`,
    };
  }

  // Fold the two flows into one row per commodity, and refuse a duplicate.
  // A repeated (code, flow) means a splitting dimension escaped the pins,
  // which would silently corrupt the value.
  const byCode = new Map<string, YearRow>();
  const seen = new Set<string>();
  for (const r of raw) {
    const code = typeof r.cmdCode === "string" ? r.cmdCode : "";
    const flow = r.flowCode === "M" || r.flowCode === "X" ? r.flowCode : "";
    if (!code || !flow) continue;
    const key = `${code}:${flow}`;
    if (seen.has(key)) {
      return { ok: false, error: `duplicate ${key} — a dimension escaped the pins` };
    }
    seen.add(key);
    const entry = byCode.get(code) ?? { code, m: 0, x: 0 };
    const v = typeof r.primaryValue === "number" ? r.primaryValue : 0;
    if (flow === "M") entry.m = v;
    else entry.x = v;
    byCode.set(code, entry);
  }
  return { ok: true, rows: [...byCode.values()] };
}

export async function run(): Promise<void> {
  const started = Date.now();
  const state = await readState();
  const universe = await readUniverse();
  const done = new Set(state.done);

  const batches: string[][] = [];
  for (let i = 0; i < universe.length; i += BATCH) batches.push(universe.slice(i, i + BATCH));

  console.log(
    `Comtrade: ${universe.length} HS6 codes, ${batches.length} batches x ${YEARS.length} years ` +
    `= ${batches.length * YEARS.length} calls. ${done.size} already done.`,
  );

  let fetched = 0;
  let failedNow = 0;
  outer: for (const year of YEARS) {
    const yearRows = await readYear(year);
    let dirty = false;
    for (let b = 0; b < batches.length; b++) {
      const key = `${year}:${b}`;
      if (done.has(key)) continue;
      if (Date.now() - started > RUN_BUDGET_MS) {
        console.log(`Run budget spent. ${done.size} batches done; the next run resumes here.`);
        if (dirty) await writeYear(year, yearRows);
        break outer;
      }
      const codes = batches[b];
      if (!codes) continue;
      const res = await fetchBatch(year, codes);
      if (!res.ok) {
        failedNow++;
        state.failed = [
          ...state.failed.filter((f) => f.key !== key),
          { key, error: res.error, at: new Date().toISOString() },
        ];
        console.log(`  FAIL ${key}: ${res.error}`);
        // Persist the failure record immediately; a crash must not lose it.
        await writeState(state, done);
        continue;
      }
      for (const row of res.rows) yearRows.set(row.code, row);
      done.add(key);
      dirty = true;
      fetched++;
      // Write after every batch. This is the whole point.
      await writeYear(year, yearRows);
      await writeState(state, done);
      if (fetched % 10 === 0) console.log(`  ${fetched} batches fetched (at ${key})`);
    }
    if (dirty) await writeYear(year, yearRows);
  }

  await writeState(state, done);
  console.log(`Done. ${fetched} batches fetched this run, ${failedNow} failed, ${done.size} total.`);
}

async function writeState(state: State, done: Set<string>): Promise<void> {
  await mkdir(join(ROOT, "data/live"), { recursive: true });
  await writeFile(
    STATE_PATH,
    JSON.stringify({ ...state, done: [...done].sort(), lastRunAt: new Date().toISOString() }, null, 2) + "\n",
    "utf8",
  );
}
