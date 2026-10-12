/**
 * Where ECI's electorate figures per constituency can still be read.
 *
 * `npm run eci:electors:probe`. Writes data/live/eci-electors-probe.json and
 * samples. Publishes nothing. Runs in Actions.
 *
 * The result pages carry candidates and votes, not the electorate: electors by
 * gender, turnout, postal and service voters and reserved category are in
 * ECI's Statistical Reports ("Constituency Wise Detailed Result", "AC/PC data
 * summary"), published on eci.gov.in, which refuses automated requests. So:
 *
 *   1. Has the Internet Archive kept ECI's statistical report files
 *      (xlsx/xls/csv/pdf) or the pages that link them?
 *   2. Did ECI's 2024 turnout site, or the results portal, publish electors?
 *   3. Does data.gov.in's ECI catalogue answer now?
 *   4. Does Lok Dhaba (Ashoka University's compilation of the same reports)
 *      expose an API a script can read?
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "./lib/http";
import { isEntryPoint } from "./lib/entry";

const OUT = join(process.cwd(), "data", "live", "eci-electors-probe.json");
const SAMPLES = join(process.cwd(), "data", "live", "election-atlas-samples");
const CDX = "https://web.archive.org/cdx/search/cdx";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const out: Record<string, unknown> = { probedAt: new Date().toISOString() };
async function flush() { await mkdir(join(process.cwd(), "data", "live"), { recursive: true }); await writeFile(OUT, JSON.stringify(out, null, 1) + "\n", "utf8"); }

async function cdx(params: Record<string, string>): Promise<string[][] | null> {
  await sleep(1500);
  const res = await getText(`${CDX}?${new URLSearchParams({ output: "json", ...params })}`, { timeoutMs: 180_000, retries: 3, cacheMs: 0 });
  if (!res.ok || !res.data) return null;
  try { return (JSON.parse(res.data) as string[][]).slice(1); } catch { return null; }
}

export async function run(): Promise<void> {
  // 1. statistical-report files and pages on eci.gov.in, as archived
  const files: Array<Record<string, unknown>> = [];
  for (const [url, filter] of [
    ["eci.gov.in/", "original:.*\\.(xlsx?|csv|zip)$"],
    ["www.eci.gov.in/", "original:.*\\.(xlsx?|csv|zip)$"],
    ["eci.gov.in/files/file/", ""],
    ["www.eci.gov.in/statistical-report", ""],
    ["eci.gov.in/eci-backend/", "original:.*(xlsx?|csv|zip|pdf).*"],
  ] as const) {
    const rows = await cdx({ url, matchType: "prefix", fl: "original,timestamp,mimetype,statuscode", collapse: "urlkey", limit: "5000", ...(filter ? { filter } : {}) });
    const ok = (rows ?? []).filter((r) => r[3] === "200");
    const relevant = ok.filter((r) => /constituency|detailed|electors|turnout|statistical|data.?summary|AC[_ -]?wise|PC[_ -]?wise|20(19|2[0-6])/i.test(r[0] ?? ""));
    files.push({ url, total: rows?.length ?? null, ok: ok.length, relevant: relevant.length, sample: relevant.slice(0, 60).map((r) => `${r[1]} ${r[2]} ${r[0]}`) });
    console.log(`  ${url}: ${rows?.length ?? "error"} rows, ${relevant.length} relevant`);
  }
  out.eciFiles = files;
  await flush();

  // 2. turnout sites and results-portal pages that might print electors
  const portals: Array<Record<string, unknown>> = [];
  for (const url of ["elections24.eci.gov.in/", "ecivoterturnout.eci.gov.in/", "results.eci.gov.in/PcResultGenJune2024/", "voterturnout.eci.gov.in/"]) {
    const rows = await cdx({ url, matchType: "prefix", fl: "original,timestamp,statuscode", collapse: "urlkey", filter: "statuscode:200", limit: "3000" });
    const kinds = new Map<string, number>();
    for (const [o] of rows ?? []) { const k = (o ?? "").replace(/^https?:\/\/[^/]+\/[^/]*\/?/, "").replace(/[SU]?\d+.*$/, "").slice(0, 40); kinds.set(k, (kinds.get(k) ?? 0) + 1); }
    portals.push({ url, pages: rows?.length ?? null, kinds: Object.fromEntries([...kinds].sort((a, b) => b[1] - a[1]).slice(0, 25)), sample: (rows ?? []).filter((r) => /turnout|elector|voter/i.test(r[0] ?? "")).slice(0, 30).map((r) => `${r[1]} ${r[0]}`) });
    console.log(`  ${url}: ${rows?.length ?? "error"} pages`);
  }
  out.portals = portals;
  await flush();

  // 3. data.gov.in, again
  const dg: Array<Record<string, unknown>> = [];
  for (const term of ["constituency wise detailed result", "electors", "assembly constituency"]) {
    const res = await getText(`https://api.data.gov.in/catalog?format=json&filters[title]=${encodeURIComponent(term)}&limit=50&api-key=579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b`, { timeoutMs: 40_000, retries: 2, cacheMs: 0 });
    dg.push({ term, ok: res.ok, status: res.ok ? 200 : res.error, head: res.data?.slice(0, 400) });
  }
  out.dataGovIn = dg;
  await flush();

  // 4. Lok Dhaba
  const ld: Array<Record<string, unknown>> = [];
  for (const url of [
    "https://lokdhaba.ashoka.edu.in/",
    "https://lokdhaba.ashoka.edu.in/api/",
    "https://lokdhaba.ashoka.edu.in/api/data/getVizData?ElectionType=GE&StateName=Bihar&Year=2024",
    "https://lokdhaba.ashoka.edu.in/browse-data?et=GE",
    "https://tcpd.ashoka.edu.in/lok-dhaba/",
  ]) {
    await sleep(1000);
    const res = await getText(url, { timeoutMs: 40_000, retries: 1, cacheMs: 0 });
    ld.push({ url, ok: res.ok, status: res.ok ? 200 : res.error, bytes: res.data?.length, head: res.data?.slice(0, 500), links: [...new Set([...(res.data ?? "").matchAll(/["'](\/?api\/[^"']+|[^"']+\.(?:csv|xlsx?|zip))["']/g)].map((m) => m[1]))].slice(0, 30) });
  }
  out.lokDhaba = ld;
  await flush();

  // A sample of the most promising archived ECI file, if one exists.
  const pick = files.flatMap((f) => (f.sample as string[]) ?? []).find((s) => /detailed|constituency/i.test(s) && /xlsx?|csv/i.test(s));
  if (pick) {
    const [ts, , orig] = pick.split(" ");
    const res = await getText(`https://web.archive.org/web/${ts}id_/${orig}`, { timeoutMs: 120_000, retries: 2, cacheMs: 0 });
    out.sampleFile = { orig, ts, ok: res.ok, bytes: res.data?.length };
    if (res.ok && res.data) { await mkdir(SAMPLES, { recursive: true }); await writeFile(join(SAMPLES, `eci-statreport-sample.${/csv$/i.test(orig!) ? "csv" : "bin"}`), res.data.slice(0, 500_000), "binary"); }
  }
  await flush();
  console.log("done");
}

if (isEntryPoint(import.meta.url)) run().catch(async (e) => { console.error(e); await flush(); process.exit(1); });
