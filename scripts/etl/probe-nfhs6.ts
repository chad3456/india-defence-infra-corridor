/**
 * What NFHS-6 (2023–24) actually publishes, and in what shape — before any
 * extractor is written against it.
 *
 * The sandbox this site is built in cannot reach nfhsiips.in; GitHub Actions
 * can. So this runs there, and commits a small report: every document link on
 * the IIPS pages, what each fact-sheet PDF answers (status, size, page count),
 * and the text rows of a handful of pages from each, so the table layout can
 * be read before a parser is written. The PDFs themselves are never committed.
 *
 * Publishes no figure. The report is evidence about documents.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { extractPages, fragmentsToRows } from "./lib/pdf-table";

const OUT = join(process.cwd(), "data", "nfhs6", "probe.json");
const UA = "BharatTracker/0.1 (+https://github.com/chad3456/india-defence-infra-corridor)";
const BASE = "https://www.nfhsiips.in";

const PAGES = [
  `${BASE}/`,
  `${BASE}/nfhsuser/release-details.php`,
  `${BASE}/nfhsuser/publication.php`,
  `${BASE}/nfhsuser/nfhs6.php`,
  `${BASE}/nfhsuser/index.php`,
];

const KNOWN_PDFS = [
  `${BASE}/nfhsuser/assets/National%20Family%20Health%20Survey%20(NFHS-6)%202023-2024%20Fact%20Sheets.pdf`,
  `${BASE}/nfhsuser/assets/pdf/nfhs6%20fact%20sheet%20compendiums%20release%20writeup%20for%20website%20FINAL%2021aug26.pdf`,
];

async function get(url: string, timeoutMs = 60_000): Promise<{ status: number; type: string; bytes: Uint8Array | null; error?: string; finalUrl?: string }> {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "*/*" }, redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
    const buf = new Uint8Array(await res.arrayBuffer());
    return { status: res.status, type: res.headers.get("content-type") ?? "", bytes: buf, finalUrl: res.url };
  } catch (e) {
    const cause = (e as { cause?: { code?: string; message?: string } }).cause;
    return { status: 0, type: "", bytes: null, error: `${String(e).slice(0, 120)}${cause ? ` · cause: ${cause.code ?? ""} ${cause.message ?? ""}`.slice(0, 240) : ""}` };
  }
}

function links(html: string, base: string): Array<{ href: string; text: string }> {
  const out: Array<{ href: string; text: string }> = [];
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let href = m[1]!.trim();
    try { href = new URL(href, base).toString(); } catch { continue; }
    const text = m[2]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
    out.push({ href, text });
  }
  return out;
}

async function main() {
  const report: Record<string, unknown> = { probedAt: new Date().toISOString(), pages: [], pdfs: [] };
  const found = new Set<string>(KNOWN_PDFS);
  for (const url of PAGES) {
    const r = await get(url, 30_000);
    const html = r.bytes ? new TextDecoder().decode(r.bytes) : "";
    const ls = links(html, r.finalUrl ?? url);
    const docs = ls.filter((l) => /\.pdf|\.xlsx?|\.csv|nfhs-?6|compendium|district|fact/i.test(`${l.href} ${l.text}`));
    for (const l of docs) if (/\.pdf(?:$|\?)/i.test(l.href)) found.add(l.href);
    const forms = [...html.matchAll(/<form\b[^>]*>/gi)].map((m) => m[0].slice(0, 200));
    (report.pages as unknown[]).push({ url, status: r.status, error: r.error, finalUrl: r.finalUrl, bytes: r.bytes?.length ?? 0, forms, links: docs.slice(0, 300), allLinks: ls.length });
    console.log(`page ${url}: ${r.status} ${r.bytes?.length ?? 0} bytes, ${docs.length} document links`);
  }
  // Each PDF: does it answer, how big, how many pages, and what do a few pages say.
  for (const url of [...found].slice(0, 40)) {
    const r = await get(url, 180_000);
    const entry: Record<string, unknown> = { url, status: r.status, type: r.type, bytes: r.bytes?.length ?? 0, error: r.error };
    if (r.bytes && r.status === 200 && /pdf/i.test(r.type + url)) {
      try {
        const head = await extractPages(r.bytes, { firstPage: 1, lastPage: 1 });
        const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const task = getDocument({ data: r.bytes.slice(), useSystemFonts: true });
        const doc = await task.promise;
        entry.pages = doc.numPages;
        await task.destroy();
        const want = [1, 2, 3, 4, 5, 6, Math.min(doc.numPages, 20), Math.min(doc.numPages, 40)];
        const sample: Array<{ page: number; rows: string[][] }> = [];
        for (const p of [...new Set(want)]) {
          const [pg] = await extractPages(r.bytes, { firstPage: p, lastPage: p });
          if (pg) sample.push({ page: p, rows: fragmentsToRows(pg.fragments).slice(0, 90).map((row) => row.map((c) => c.slice(0, 120))) });
        }
        entry.sample = sample;
        entry.firstPageText = head[0]?.fragments.map((f) => f.text).join(" ").slice(0, 600);
      } catch (e) { entry.parseError = String(e).slice(0, 200); }
    }
    (report.pdfs as unknown[]).push(entry);
    console.log(`pdf ${url}: ${r.status} ${r.bytes?.length ?? 0} bytes ${entry.pages ?? ""} pages`);
  }
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(report, null, 1) + "\n");
}

main().catch((e) => { console.error(e); process.exit(0); });
