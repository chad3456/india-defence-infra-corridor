/**
 * What can the election atlas actually read, and in what shape?
 *
 * `npm run atlas:elections:probe`. Writes data/live/election-atlas-probe.json
 * and a few sample pages under data/live/election-atlas-samples/. Publishes
 * nothing. Runs in GitHub Actions: the editing sandbox reaches none of these.
 *
 * Three questions:
 *
 *   1. Which elections does ECI's results portal still host? The portal's
 *      front page is a JavaScript shell, but each election lives in its own
 *      folder of static pages (ResultAcGenMay2026/, ResultAcGenNov2025/ …), and
 *      the folder names follow no single pattern. So: read the index pages for
 *      every folder they link, then try the names the known pattern predicts.
 *   2. For each folder that answers, which states does it cover and what does a
 *      constituency page look like? A sample of each page kind is saved so the
 *      parser is written against real HTML, not a guess at it.
 *   3. Where are the SIR deletion figures and the list of who governs each
 *      state today published in a form a script can read?
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "./lib/http";
import { parseTables } from "./lib/wikitext";
import { isEntryPoint } from "./lib/entry";

const ROOT = process.cwd();
const OUT = join(ROOT, "data", "live", "election-atlas-probe.json");
const SAMPLES = join(ROOT, "data", "live", "election-atlas-samples");
const PORTAL = "https://results.eci.gov.in";
const WIKI = "https://en.wikipedia.org/w/api.php";
const BROWSER = { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36", accept: "text/html,application/xhtml+xml" };

interface FolderProbe {
  folder: string;
  ok: boolean;
  status: string;
  title?: string;
  /** State codes seen in links (S04, U05 …) with the page kinds linked for each. */
  states?: string[];
  pageKinds?: string[];
  sampleConstituency?: string;
  note?: string;
}
const out: { probedAt: string; indexLinks: string[]; folders: FolderProbe[]; other: Array<Record<string, unknown>> } = {
  probedAt: new Date().toISOString(), indexLinks: [], folders: [], other: [],
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function fetchPage(url: string) {
  await sleep(700);
  return getText(url, { timeoutMs: 45_000, retries: 2, cacheMs: 0, headers: BROWSER });
}
async function sample(name: string, text: string) {
  await mkdir(SAMPLES, { recursive: true });
  await writeFile(join(SAMPLES, name), text.slice(0, 60_000), "utf8");
}
const titleOf = (html: string) => /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim().replace(/\s+/g, " ");

/** Folder names the portal's naming habits predict, for elections since 2019. */
function guessedFolders(): string[] {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "June", "Jun", "July", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "DecNew"];
  const out: string[] = [];
  for (const y of [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]) {
    for (const m of months) for (const p of ["ResultAcGen", "AcResultGen", "PcResultGen", "ResultPcGen"]) out.push(`${p}${m}${y}`);
  }
  return out;
}

/** URLs search engines show answering, fetched raw so their status codes are recorded. */
const KNOWN = [
  "https://results.eci.gov.in/ResultAcByeOct2026/index.htm",
  "https://results.eci.gov.in/ResultAcGenMay2026/index.htm",
  "https://results.eci.gov.in/ResultAcGenMay2026/statewiseS252.htm",
  "https://results.eci.gov.in/ResultAcGenMay2026/ConstituencywiseS25158.htm",
  "https://results.eci.gov.in/ResultAcGenNov2025/index.htm",
  "https://results.eci.gov.in/ResultAcGenNov2025/ConstituencywiseS048.htm",
  "https://results.eci.gov.in/ResultAcGenNov2025/candidateswise-S0412.htm",
  "https://results.eci.gov.in/ResultAcGenMar2023/ConstituencywiseS237.htm",
  "https://results.eci.gov.in/ResultAcGenMar2022/ConstituencywiseS1935.htm",
  "https://results.eci.gov.in/AcResultGenDecNew2023/index.htm",
  "https://results.eci.gov.in/PcResultGenJune2024/index.htm",
];

/** One raw fetch with the status and the headers that say who answered. */
async function raw(url: string, headers: Record<string, string>) {
  await sleep(800);
  try {
    const res = await fetch(url, { headers, redirect: "manual", signal: AbortSignal.timeout(30_000) });
    const body = await res.text();
    return { url, status: res.status, bytes: body.length, server: res.headers.get("server"), location: res.headers.get("location"), title: titleOf(body), head: body.slice(0, 300) };
  } catch (e) {
    return { url, status: 0, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }
}

export async function run(): Promise<void> {
  for (const url of KNOWN) {
    for (const [label, h] of [["browser", BROWSER], ["bare", {} as Record<string, string>]] as const) {
      const r = await raw(url, h);
      out.other.push({ what: `known (${label})`, ...r });
      console.log(`  ${label} ${r.status} ${url}`);
      if (label === "browser" && r.status === 200 && "head" in r) {
        const full = await fetchPage(url);
        if (full.ok && full.data) await sample(url.split("/").slice(-2).join("-"), full.data);
      }
    }
  }
  await flush();

  // ── 1. index pages ────────────────────────────────────────────────────
  const folders = new Set<string>();
  for (const idx of ["/", "/index1.html", "/index.htm", "/index.html"]) {
    const res = await fetchPage(`${PORTAL}${idx}`);
    out.other.push({ what: `portal ${idx}`, ok: res.ok, status: res.ok ? "200" : res.error, bytes: res.data?.length, title: res.data ? titleOf(res.data) : undefined });
    if (!res.ok || !res.data) continue;
    await sample(`index${idx.replace(/\W/g, "_")}.html`, res.data);
    for (const m of res.data.matchAll(/url\s*=\s*https?:\/\/results\.eci\.gov\.in\/([A-Za-z0-9]+\d{4})\//g)) folders.add(m[1]!);
    for (const m of res.data.matchAll(/href=["']?(?:https?:\/\/results\.eci\.gov\.in)?\/?([A-Za-z0-9]+(?:Gen|Bye)[A-Za-z0-9]*\d{4})\/?/g)) folders.add(m[1]!);
  }
  out.indexLinks = [...folders].sort();
  console.log(`index pages link ${folders.size} folders`);

  // ── 2. every linked folder, plus the guessed names ────────────────────
  // Guesses are tried with a cheap index fetch; only general elections are guessed.
  const tried = new Set<string>();
  const candidates = [...folders, ...guessedFolders()];
  for (const folder of candidates) {
    if (tried.has(folder)) continue;
    tried.add(folder);
    const res = await fetchPage(`${PORTAL}/${folder}/index.htm`);
    if (!res.ok || !res.data) {
      if (folders.has(folder) || out.folders.length < 20) out.folders.push({ folder, ok: false, status: res.error ?? "no data" });
      continue;
    }
    const html = res.data;
    const states = [...new Set([...html.matchAll(/statewise([SU]\d{2})\d*\.htm/g)].map((m) => m[1]!))].sort();
    const kinds = [...new Set([...html.matchAll(/href=["']?([a-zA-Z-]+?)(?:[SU]\d{2})[\w-]*\.htm/g)].map((m) => m[1]!))].sort();
    const fp: FolderProbe = { folder, ok: true, status: "200", title: titleOf(html), states, pageKinds: kinds };
    // A constituency page: read one state's first statewise page for a link.
    if (states[0]) {
      const sw = await fetchPage(`${PORTAL}/${folder}/statewise${states[0]}1.htm`);
      if (sw.ok && sw.data) {
        const link = /href=["']?((?:Constituencywise|candidateswise-)[SU]\d{2}\d+\.htm)/.exec(sw.data)?.[1];
        if (out.folders.filter((f) => f.ok).length < 6) await sample(`${folder}-statewise.html`, sw.data);
        if (link) {
          fp.sampleConstituency = link;
          const cp = await fetchPage(`${PORTAL}/${folder}/${link}`);
          if (cp.ok && cp.data && out.folders.filter((f) => f.ok).length < 6) await sample(`${folder}-${link}`, cp.data);
          if (!cp.ok) fp.note = `constituency page: ${cp.error}`;
        }
      } else fp.note = `statewise page: ${sw.error}`;
    }
    out.folders.push(fp);
    console.log(`  ${folder}: ${fp.title} — ${states.length} states`);
    await flush();
  }

  // ── 3. who governs, and SIR, on Wikipedia ─────────────────────────────
  for (const page of ["Chief minister (India)", "Special Intensive Revision", "2025 Bihar Special Intensive Revision"]) {
    const res = await getText(`${WIKI}?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&formatversion=2&format=json&redirects=1`, { timeoutMs: 30_000, retries: 2, cacheMs: 0 });
    if (!res.ok || !res.data) { out.other.push({ what: `wikipedia: ${page}`, ok: false, status: res.error }); continue; }
    const wt = (JSON.parse(res.data) as { parse?: { wikitext?: string } }).parse?.wikitext ?? "";
    const tables = parseTables(wt);
    await sample(`wiki-${page.replace(/\W+/g, "-")}.txt`, wt);
    out.other.push({ what: `wikipedia: ${page}`, ok: true, bytes: wt.length, tables: tables.length, headers: tables.slice(0, 8).map((t) => t.headers.slice(0, 10)) });
  }

  // ── 4. ECI's own SIR pages ────────────────────────────────────────────
  for (const url of ["https://www.eci.gov.in/sir", "https://www.eci.gov.in/special-intensive-revision", "https://voters.eci.gov.in/", "https://ceoelection.bihar.gov.in/"]) {
    const res = await fetchPage(url);
    out.other.push({ what: url, ok: res.ok, status: res.ok ? "200" : res.error, bytes: res.data?.length, title: res.data ? titleOf(res.data) : undefined });
  }
  await flush();
  console.log(`\n${out.folders.filter((f) => f.ok).length} folders answered`);
}

async function flush(): Promise<void> {
  await mkdir(join(ROOT, "data", "live"), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 1) + "\n", "utf8");
}

if (isEntryPoint(import.meta.url)) run().catch(async (e) => { console.error(e); await flush(); process.exit(1); });
