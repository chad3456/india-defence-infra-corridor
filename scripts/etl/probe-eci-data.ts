/**
 * Where ECI's seat-by-seat results can still be read by a script.
 *
 * `npm run eci:probe`. Writes data/live/eci-data-probe.json. Publishes nothing.
 *
 * The results portal (results.eci.gov.in) turned out to serve only the
 * election currently being counted: every past folder answers 404, and the
 * pages search engines show are their caches. ECI's permanent record is its
 * Statistical Reports, and eci.gov.in refuses automated requests (406). But
 * ECI also publishes those reports on data.gov.in, the government's open-data
 * platform, which has an API. So this asks:
 *
 *   1. Which Election Commission datasets does data.gov.in carry, and can
 *      their rows be read with the platform's public sample key?
 *   2. Do the dataset pages link CSV files directly?
 *   3. Does eci.gov.in answer a request that looks fully like a browser?
 *   4. What do Wikipedia's current chief-minister table and a 2026 assembly
 *      election's constituency table look like (the fallback for who governs,
 *      and a cross-check for results)?
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "./lib/http";
import { parseTables } from "./lib/wikitext";
import { isEntryPoint } from "./lib/entry";

const OUT = join(process.cwd(), "data", "live", "eci-data-probe.json");
const SAMPLES = join(process.cwd(), "data", "live", "election-atlas-samples");
/** data.gov.in's documented public sample key: rate-limited, for exactly this kind of test. */
const SAMPLE_KEY = "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b";
const out: Record<string, unknown> = { probedAt: new Date().toISOString() };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface CatalogRecord { index_name?: string; title?: string; org?: string[]; source?: string; updated_date?: string; field?: Array<{ id: string; name: string; type: string }>; total?: number }

async function flush() {
  await mkdir(join(process.cwd(), "data", "live"), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 1) + "\n", "utf8");
}

export async function run(): Promise<void> {
  // ── 1. data.gov.in catalogue ───────────────────────────────────────────
  const found = new Map<string, { id: string; title: string; org: string; updated?: string }>();
  for (const term of ["constituency wise detailed result", "general election", "assembly election", "electors", "election commission", "lok sabha 2024", "vidhan sabha", "state wise voter turnout", "party wise"]) {
    await sleep(800);
    const url = `https://api.data.gov.in/lists?format=json&notfilters[source]=visualize.data.gov.in&filters[title]=${encodeURIComponent(term)}&offset=0&limit=100&sort[updated]=desc&api-key=${SAMPLE_KEY}`;
    const res = await getText(url, { timeoutMs: 40_000, retries: 2, cacheMs: 0 });
    let records: CatalogRecord[] = [];
    try { records = (JSON.parse(res.data ?? "{}") as { records?: CatalogRecord[] }).records ?? []; } catch { /* recorded below */ }
    // The lists endpoint has changed shape before; try the catalog endpoint too.
    if (records.length === 0) {
      const alt = await getText(`https://api.data.gov.in/catalog?format=json&filters[title]=${encodeURIComponent(term)}&limit=100&api-key=${SAMPLE_KEY}`, { timeoutMs: 40_000, retries: 1, cacheMs: 0 });
      try { records = (JSON.parse(alt.data ?? "{}") as { records?: CatalogRecord[] }).records ?? []; } catch { /* ignore */ }
    }
    for (const r of records) {
      const org = (r.org ?? []).join("; ");
      if (!/election/i.test(org + " " + (r.title ?? ""))) continue;
      if (r.index_name) found.set(r.index_name, { id: r.index_name, title: r.title ?? "", org, updated: r.updated_date });
    }
    console.log(`  data.gov.in "${term}": ${records.length} records (${res.ok ? "ok" : res.error})`);
  }
  out.dataGovIn = [...found.values()];
  await flush();

  // ── 1b. read a few rows from the most promising resources ─────────────
  const reads: Array<Record<string, unknown>> = [];
  const promising = [...found.values()].filter((f) => /detailed result|constituency|candidate/i.test(f.title)).slice(0, 12);
  for (const f of promising) {
    await sleep(800);
    const res = await getText(`https://api.data.gov.in/resource/${f.id}?format=json&limit=10&offset=0&api-key=${SAMPLE_KEY}`, { timeoutMs: 40_000, retries: 2, cacheMs: 0 });
    let body: { total?: number; count?: number; field?: Array<{ id: string; name: string }>; records?: Array<Record<string, unknown>>; message?: string } = {};
    try { body = JSON.parse(res.data ?? "{}"); } catch { /* ignore */ }
    reads.push({ ...f, ok: res.ok, status: res.ok ? "200" : res.error, total: body.total, count: body.count, fields: body.field?.map((x) => `${x.id}:${x.name}`), sample: body.records?.slice(0, 3), message: body.message });
    console.log(`  read ${f.title}: total ${body.total}, got ${body.records?.length ?? 0}`);
  }
  out.reads = reads;
  await flush();

  // ── 2. dataset pages with CSV links ───────────────────────────────────
  const pages: Array<Record<string, unknown>> = [];
  for (const url of [
    "https://www.data.gov.in/catalog/general-election-lok-sabha-2024-statistical-reports-data",
    "https://www.data.gov.in/resource/constituency-wise-detailed-result-during-2024",
  ]) {
    await sleep(800);
    const res = await getText(url, { timeoutMs: 40_000, retries: 2, cacheMs: 0 });
    const html = res.data ?? "";
    const csv = [...new Set([...html.matchAll(/https?:\/\/[^"' ]+?\.(?:csv|xlsx?)(?:\?[^"' ]*)?/gi)].map((m) => m[0]))].slice(0, 30);
    const resources = [...new Set([...html.matchAll(/\/resource\/([a-z0-9-]{20,})/g)].map((m) => m[1]!))].slice(0, 60);
    pages.push({ url, ok: res.ok, status: res.ok ? "200" : res.error, bytes: html.length, csv, resources });
    if (res.ok) {
      await mkdir(SAMPLES, { recursive: true });
      await writeFile(join(SAMPLES, `datagov-${url.split("/").pop()}.html`), html.slice(0, 80_000), "utf8");
    }
  }
  out.pages = pages;
  await flush();

  // ── 3. eci.gov.in, looking like a browser ─────────────────────────────
  const eci: Array<Record<string, unknown>> = [];
  const HEADERS = {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "accept-language": "en-IN,en;q=0.9",
    "upgrade-insecure-requests": "1",
    "sec-fetch-dest": "document", "sec-fetch-mode": "navigate", "sec-fetch-site": "none", "sec-fetch-user": "?1",
  };
  for (const url of ["https://www.eci.gov.in/statistical-reports", "https://www.eci.gov.in/statistical-report/election-results/", "https://hindi.eci.gov.in/statistical-report/election-results/", "https://elections24.eci.gov.in/", "https://www.eci.gov.in/"]) {
    await sleep(1000);
    try {
      const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30_000) });
      const body = await r.text();
      eci.push({ url, status: r.status, bytes: body.length, title: /<title>([\s\S]*?)<\/title>/i.exec(body)?.[1]?.trim(), links: [...new Set([...body.matchAll(/href=["']([^"']+?\.(?:pdf|xlsx?|csv|zip))["']/gi)].map((m) => m[1]))].slice(0, 25) });
      if (r.ok) { await mkdir(SAMPLES, { recursive: true }); await writeFile(join(SAMPLES, `eci-${new URL(url).hostname}-${new URL(url).pathname.replace(/\W+/g, "_")}.html`), body.slice(0, 80_000), "utf8"); }
    } catch (e) { eci.push({ url, status: 0, error: e instanceof Error ? `${e.name}: ${e.message}${e.cause ? ` (${String(e.cause)})` : ""}` : String(e) }); }
  }
  out.eci = eci;
  await flush();

  // ── 4. Wikipedia tables ───────────────────────────────────────────────
  const wiki: Array<Record<string, unknown>> = [];
  for (const page of ["Chief minister (India)", "2026 West Bengal Legislative Assembly election", "2025 Bihar Legislative Assembly election", "Results of the 2024 Indian general election by parliamentary constituency"]) {
    await sleep(800);
    const res = await getText(`https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&formatversion=2&format=json&redirects=1`, { timeoutMs: 30_000, retries: 2, cacheMs: 0 });
    const wt = (JSON.parse(res.data ?? "{}") as { parse?: { wikitext?: string } }).parse?.wikitext ?? "";
    const tables = parseTables(wt);
    wiki.push({ page, bytes: wt.length, tables: tables.length, shapes: tables.map((t) => ({ headers: t.headers.slice(0, 12), rows: t.rows.length, first: t.rows[0]?.slice(0, 10) })).filter((t) => t.rows > 5).slice(0, 10) });
    await mkdir(SAMPLES, { recursive: true });
    await writeFile(join(SAMPLES, `wiki-${page.replace(/\W+/g, "-")}.txt`), wt.slice(0, 200_000), "utf8");
  }
  out.wiki = wiki;
  await flush();
  console.log("done");
}

if (isEntryPoint(import.meta.url)) run().catch(async (e) => { console.error(e); await flush(); process.exit(1); });
