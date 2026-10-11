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
import { mkdir, writeFile } from "node:fs/promises";
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

if (isEntryPoint(import.meta.url)) run().catch(async (e) => { console.error(e); await flush(); process.exit(1); });
