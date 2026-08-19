/**
 * SATP structure probe.
 *
 * `npm run satp:probe`. This does not publish anything. It fetches candidate
 * pages, dumps every table it finds with its header and first rows, and writes
 * the lot to `data/live/satp-probe.json`.
 *
 * It exists because of a specific failure. The connector was written against a
 * fixture built from my assumption about the columns, the assumption was wrong,
 * and 13,142 security force deaths for 2009 reached the site. This sandbox
 * cannot reach satp.org — the network policy denies it — so every correction I
 * made after that was another guess.
 *
 * A guess dressed as a fix is the thing to avoid here. So this runs in Actions,
 * where the network works, and commits what it actually saw. Then the connector
 * gets written against evidence.
 *
 * Candidate URLs are generated from the site's own navigation rather than typed
 * out, so a slug I would never have thought of still gets found.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "./lib/http";
import { decodeEntities } from "./lib/feed";

const ROOT = process.cwd();
const BASE = "https://www.satp.org";

/** Pages likely to link to the datasheets, read for their links. */
const INDEX_PAGES = [
  `${BASE}/datasheet-terrorist-attack/fatalities/india`,
  `${BASE}/datasheets`,
  `${BASE}/`,
];

/** Paths worth trying directly, whether or not an index links to them. */
const DIRECT = [
  `${BASE}/datasheet-terrorist-attack/fatalities/india-maoistinsurgency`,
  `${BASE}/datasheet-terrorist-attack/fatalities/india-jammukashmir`,
  `${BASE}/datasheet-terrorist-attack/fatalities/india`,
  `${BASE}/datasheet-terrorist-attack/fatalities/india-northeast`,
];

/** How many pages to open in total. Politeness, and a bounded run. */
const MAX_PAGES = 24;

interface TableShape {
  /** Index of the table within the page. */
  index: number;
  header: string[];
  /** First rows as read, so the column meaning is visible rather than assumed. */
  sample: string[][];
  rowCount: number;
  /** Rows whose first cell looks like a year — the ones a parser would take. */
  yearRows: number;
}

interface PageReport {
  url: string;
  status: "ok" | "failed";
  detail?: string;
  bytes?: number;
  /** The page's own <title>, which usually names the conflict. */
  title?: string;
  tables: TableShape[];
}

function text(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function tablesIn(html: string): TableShape[] {
  const out: TableShape[] = [];
  const tables = html.match(/<table\b[\s\S]*?<\/table>/gi) ?? [];
  tables.forEach((table, index) => {
    const rows = (table.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? []).map((tr) =>
      [...tr.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => text(m[1] ?? "")),
    );
    if (rows.length === 0) return;
    const isYear = (r: string[]) => /^(19|20)\d{2}$/.test((r[0] ?? "").replace(/\D/g, ""));
    const header = rows.find((r) => !isYear(r)) ?? [];
    out.push({
      index,
      header,
      sample: rows.filter(isYear).slice(0, 4),
      rowCount: rows.length,
      yearRows: rows.filter(isYear).length,
    });
  });
  return out;
}

/** Datasheet links found on a page, absolute and de-duplicated. */
function datasheetLinks(html: string): string[] {
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1] ?? "");
  const keep = hrefs.filter((h) => /datasheet|fatalit/i.test(h));
  const abs = keep.map((h) => {
    if (/^https?:\/\//i.test(h)) return h;
    if (h.startsWith("/")) return BASE + h;
    return `${BASE}/${h}`;
  });
  return [...new Set(abs.filter((u) => u.startsWith(BASE)))];
}

async function probe(url: string): Promise<PageReport> {
  const res = await getText(url, { cacheMs: 0, timeoutMs: 30_000, retries: 1, accept: "text/html" });
  if (!res.ok || !res.data) {
    return { url, status: "failed", detail: res.error ?? "no body", tables: [] };
  }
  const title = text(res.data.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").slice(0, 120);
  return {
    url,
    status: "ok",
    bytes: res.data.length,
    title,
    tables: tablesIn(res.data),
  };
}

async function main() {
  const log = (m: string) => process.stdout.write(`${m}\n`);
  log("SATP structure probe — reads pages, publishes nothing\n");

  // Pass 1: read the index pages for links.
  const discovered = new Set<string>(DIRECT);
  for (const index of INDEX_PAGES) {
    const res = await getText(index, { cacheMs: 0, timeoutMs: 30_000, retries: 1, accept: "text/html" });
    if (!res.ok || !res.data) {
      log(`  index ${index} -> ${res.error}`);
      continue;
    }
    const links = datasheetLinks(res.data);
    log(`  index ${index} -> ${links.length} datasheet link(s)`);
    for (const l of links) discovered.add(l);
  }

  // Prefer anything that names a conflict this project tracks.
  const ranked = [...discovered].sort((a, b) => {
    const score = (u: string) =>
      /maoist|naxal|leftwing|left-wing/i.test(u) ? 0 : /jammu|kashmir/i.test(u) ? 1 : 2;
    return score(a) - score(b);
  });

  log("");
  log(`Probing ${Math.min(ranked.length, MAX_PAGES)} of ${ranked.length} candidate page(s)\n`);

  const pages: PageReport[] = [];
  for (const url of ranked.slice(0, MAX_PAGES)) {
    const report = await probe(url);
    pages.push(report);
    if (report.status === "failed") {
      log(`  FAIL ${url} — ${report.detail}`);
      continue;
    }
    const best = report.tables.filter((t) => t.yearRows >= 5);
    log(`  ok   ${url}`);
    log(`       title: ${report.title}`);
    log(`       ${report.tables.length} table(s), ${best.length} with year rows`);
    for (const t of best.slice(0, 3)) {
      log(`         [${t.index}] ${t.yearRows} year rows — header: ${t.header.slice(0, 6).join(" | ")}`);
      for (const row of t.sample.slice(0, 2)) log(`             ${row.slice(0, 6).join(" | ")}`);
    }
  }

  await mkdir(join(ROOT, "data/live"), { recursive: true });
  await writeFile(
    join(ROOT, "data/live/satp-probe.json"),
    JSON.stringify({ probedAt: new Date().toISOString(), discovered: ranked, pages }, null, 2) + "\n",
    "utf8",
  );

  const withTables = pages.filter((p) => p.tables.some((t) => t.yearRows >= 5));
  log("");
  log(`${withTables.length}/${pages.length} page(s) carry a year-indexed table`);
  log("Wrote data/live/satp-probe.json — read it before touching the connector.");
}

main().catch((err: unknown) => {
  process.stderr.write(`satp probe crashed: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
