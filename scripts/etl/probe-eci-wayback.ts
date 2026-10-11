/**
 * ECI's own result pages, as the Internet Archive saved them.
 *
 * `npm run eci:wayback:probe`. Writes data/live/eci-wayback-probe.json and
 * sample pages. Publishes nothing.
 *
 * results.eci.gov.in keeps only the election being counted; every past folder
 * now answers 404. eci.gov.in and data.gov.in refuse this pipeline's requests.
 * But the Wayback Machine crawls the results portal heavily on counting days,
 * and an archived page is ECI's page byte for byte — the primary source,
 * preserved. This asks:
 *
 *   1. Which election folders has the archive saved? (Every archived index.htm
 *      under the portal names one.)
 *   2. For each, how many constituency pages are saved, per state — enough to
 *      rebuild every seat?
 *   3. What does a late snapshot of a constituency page contain?
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "./lib/http";
import { isEntryPoint } from "./lib/entry";

const OUT = join(process.cwd(), "data", "live", "eci-wayback-probe.json");
const SAMPLES = join(process.cwd(), "data", "live", "election-atlas-samples");
const CDX = "https://web.archive.org/cdx/search/cdx";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const out: Record<string, unknown> = { probedAt: new Date().toISOString() };

async function flush() {
  await mkdir(join(process.cwd(), "data", "live"), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 1) + "\n", "utf8");
}

async function cdx(params: Record<string, string>): Promise<string[][] | null> {
  await sleep(1500);
  const qs = new URLSearchParams({ output: "json", ...params });
  const res = await getText(`${CDX}?${qs}`, { timeoutMs: 120_000, retries: 3, cacheMs: 0 });
  if (!res.ok || !res.data) { console.log(`  cdx ${JSON.stringify(params)}: ${res.error}`); return null; }
  try { const rows = JSON.parse(res.data) as string[][]; return rows.slice(1); } catch { return []; }
}

/** One archived page: the latest 200 snapshot of an exact URL, fetched raw. */
async function latest(url: string): Promise<{ ts: string; html: string } | null> {
  const rows = await cdx({ url, fl: "timestamp,statuscode", filter: "statuscode:200", limit: "200" });
  const ts = (rows ?? []).map((r) => r[0]!).sort().at(-1);
  if (!ts) return null;
  await sleep(1500);
  const res = await getText(`https://web.archive.org/web/${ts}id_/https://${url}`, { timeoutMs: 60_000, retries: 2, cacheMs: 0 });
  return res.ok && res.data ? { ts, html: res.data } : null;
}

/**
 * Step 3 on its own (WAYBACK_SAMPLES=1): one page of each kind from the
 * folders the results connector will read, so its parser is written against
 * ECI's real markup in each year's template.
 */
async function samplePages(): Promise<void> {
  // Keep the folder listing and coverage from the full run.
  try { Object.assign(out, JSON.parse(await readFile(OUT, "utf8")), { samplesProbedAt: new Date().toISOString() }); } catch { /* first run */ }
  const want: Array<[string, string]> = [
    ["PcResultGenJune2024", "S2110"], ["PcResultGenJune2024", "S041"],
    ["ResultAcGenNov2025", "S04101"], ["ResultAcGenMay2026", "S2210"], ["ResultAcGenFeb2025", "U0540"],
    ["AcResultGenDecNew2023", "S1210"], ["AcResultGenJune2024", "S0110"], ["AcResultGen2ndJune2024", "S2110"],
  ];
  const samples: Array<Record<string, unknown>> = [];
  await mkdir(SAMPLES, { recursive: true });
  for (const [f, code] of want) {
    const state = code.slice(0, 3);
    for (const page of [`Constituencywise${code}.htm`, `candidateswise-${code}.htm`, `partywiseresult-${state}.htm`]) {
      const got = await latest(`results.eci.gov.in/${f}/${page}`);
      samples.push({ folder: f, page, ts: got?.ts, bytes: got?.html.length });
      console.log(`  ${f}/${page}: ${got ? `${got.ts} ${got.html.length}b` : "none"}`);
      if (got) await writeFile(join(SAMPLES, `wayback-${f}-${page}`), got.html.slice(0, 150_000), "utf8");
    }
  }
  out.pageSamples = samples;
  // Older folders the index listing did not name: are their pages archived?
  const older: Array<Record<string, unknown>> = [];
  for (const f of ["ResultAcGenMar2022", "ResultAcGenDec2022", "ResultAcGenMay2023", "ResultAcGenMar2023", "AcResultGenMar2022", "AcResultGenDec2022", "AcResultGenMay2023", "AcResultGenMar2023"]) {
    const rows = await cdx({ url: `results.eci.gov.in/${f}/`, matchType: "prefix", fl: "original", filter: "statuscode:200", collapse: "urlkey", limit: "20000" });
    const byState = new Map<string, Set<string>>();
    for (const [orig] of rows ?? []) {
      const m = /(?:Constituencywise|candidateswise-)([SU]\d{2})(\d+)\.htm/i.exec(orig ?? "");
      if (m) byState.set(m[1]!, (byState.get(m[1]!) ?? new Set()).add(m[2]!));
    }
    older.push({ folder: f, pages: rows?.length ?? null, seatsPerState: Object.fromEntries([...byState].map(([s, set]) => [s, set.size])) });
    console.log(`  ${f}: ${rows?.length ?? "error"} pages`);
  }
  out.older = older;
  await flush();
}

export async function run(): Promise<void> {
  // ── 1. folders: every archived index page under the portal ─────────────
  const idx = await cdx({ url: "results.eci.gov.in/", matchType: "prefix", fl: "original,timestamp", filter: "original:.*/index\\.htm.*", collapse: "urlkey", limit: "5000" });
  const folders = new Map<string, string[]>();
  for (const [orig, ts] of idx ?? []) {
    const m = /results\.eci\.gov\.in(?::\d+)?\/([A-Za-z0-9]+)\/index\.htm/i.exec(orig ?? "");
    if (!m) continue;
    const f = m[1]!;
    folders.set(f, [...(folders.get(f) ?? []), ts!]);
  }
  out.folders = [...folders.entries()].map(([f, ts]) => ({ folder: f, snapshots: ts.length, first: ts.sort()[0], last: ts.sort().at(-1) })).sort((a, b) => a.folder.localeCompare(b.folder));
  console.log(`archived folders: ${folders.size}`);
  await flush();

  // ── 2. constituency pages saved per folder and state ───────────────────
  const coverage: Array<Record<string, unknown>> = [];
  const wanted = [...folders.keys()].filter((f) => /Gen/i.test(f));
  for (const f of wanted) {
    const rows = await cdx({ url: `results.eci.gov.in/${f}/`, matchType: "prefix", fl: "original,timestamp,statuscode", filter: "statuscode:200", collapse: "urlkey", limit: "20000" });
    if (!rows) { coverage.push({ folder: f, error: true }); continue; }
    const byKind = new Map<string, number>();
    const byState = new Map<string, Set<string>>();
    for (const [orig] of rows) {
      const m = /\/((?:Constituencywise|candidateswise-|statewise|partywiseresult-|partywisewinresult-|Roundwise)[A-Za-z-]*?)([SU]\d{2})(\d*)\.htm/i.exec(orig ?? "");
      if (!m) continue;
      const kind = m[1]!.replace(/-$/, "");
      byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
      if (/constituencywise|candidateswise/i.test(kind) && m[3]) {
        const set = byState.get(m[2]!) ?? new Set<string>();
        set.add(m[3]);
        byState.set(m[2]!, set);
      }
    }
    coverage.push({ folder: f, archivedPages: rows.length, byKind: Object.fromEntries(byKind), seatsPerState: Object.fromEntries([...byState.entries()].map(([s, set]) => [s, set.size])) });
    console.log(`  ${f}: ${rows.length} pages; seats per state ${JSON.stringify(Object.fromEntries([...byState.entries()].map(([s, set]) => [s, set.size])))}`);
    await flush();
  }
  out.coverage = coverage;

  // ── 3. sample late snapshots ───────────────────────────────────────────
  const samples: Array<Record<string, unknown>> = [];
  const pick = coverage.filter((c) => !c.error && Object.keys((c.seatsPerState as Record<string, number>) ?? {}).length > 0).slice(-4);
  for (const c of pick) {
    const f = c.folder as string;
    const state = Object.keys(c.seatsPerState as Record<string, number>)[0]!;
    const rows = await cdx({ url: `results.eci.gov.in/${f}/Constituencywise${state}1*`, matchType: "prefix", fl: "original,timestamp", filter: "statuscode:200", limit: "50" });
    const late = (rows ?? []).sort((a, b) => b[1]!.localeCompare(a[1]!))[0];
    if (!late) continue;
    await sleep(1500);
    const url = `https://web.archive.org/web/${late[1]}id_/${late[0]}`;
    const res = await getText(url, { timeoutMs: 60_000, retries: 2, cacheMs: 0 });
    samples.push({ folder: f, url, ok: res.ok, bytes: res.data?.length, error: res.error });
    if (res.ok && res.data) {
      await mkdir(SAMPLES, { recursive: true });
      await writeFile(join(SAMPLES, `wayback-${f}-${late[0]!.split("/").pop()}`), res.data.slice(0, 120_000), "utf8");
    }
  }
  out.samples = samples;
  await flush();
  console.log("done");
}

if (isEntryPoint(import.meta.url)) (process.env.WAYBACK_SAMPLES ? samplePages() : run()).catch(async (e) => { console.error(e); await flush(); process.exit(1); });
