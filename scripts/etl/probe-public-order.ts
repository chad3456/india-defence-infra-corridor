/**
 * The documents behind the public-order section, read rather than recalled.
 *
 * The section charts riots, damage to public property, police firing and police
 * casualties since 2004. Every one of those numbers lives in an official
 * document this sandbox cannot open: NCRB's Crime in India volumes, answers laid
 * in Parliament, the Home Ministry's annual reports. This runs in Actions,
 * where those hosts answer, and does two things:
 *
 *   1. Lists the document links on NCRB's publication pages, so the choice of
 *      which volume to read is a reading, not a guessed URL.
 *   2. Downloads the documents named in DOCS, converts them to text with
 *      pdftotext -layout, and keeps the pages that mention what the section is
 *      about. The kept text is committed so every curated figure can be checked
 *      against the words of its source by a test, not by memory.
 *
 * Publishes no figure. The page reads data/protests/public-order.json, which is
 * written by hand from this text and checked against it.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { getText } from "./lib/http";

const OUT = join(process.cwd(), "data", "protests", "public-order-probe.json");
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Pages whose document links are listed. */
const LISTINGS: Array<{ id: string; url: string }> = [
  { id: "ncrb:previous", url: "https://www.ncrb.gov.in/crime-in-india-all-previous-publications.html" },
  ...[2014, 2015, 2016, 2017, 2018, 2019, 2020, 2023, 2024].map((y) => ({ id: `ncrb:${y}`, url: `https://www.ncrb.gov.in/crime-in-india-year-wise.html?year=${y}` })),
  { id: "ncrb:en-2022", url: "https://www.ncrb.gov.in/en/crime-in-india-year-wise.html?year=2022" },
  { id: "ncrb:en-index", url: "https://www.ncrb.gov.in/en/crime-in-india.html" },
  { id: "ncrb:tables", url: "https://www.ncrb.gov.in/crime-in-india-table-content.html" },
  { id: "opencity:ckan", url: "https://data.opencity.in/api/3/action/package_search?q=%22crime+in+india%22&rows=60" },
];

/** What a kept page must mention. */
const TOPIC = /riot|damage to public property|police firing|lathi|police personnel killed|killed or injured|casualt|communal|agitation|stone[- ]pelting|public order/i;

/** Documents to read. `pages` caps how many matching pages are kept. */
const DOCS: Array<{ id: string; url: string; what: string; pages?: number }> = [
  { id: "ncrb:2022:v3", what: "Crime in India 2022, Volume III (police, casualties)", url: "https://data.opencity.in/dataset/fcb23738-6a70-42d4-9aa9-6a5e1aa5ce18/resource/d4b642dc-035b-4743-8515-efd09a17c9ed/download/1701608543crimeinindia2022book3.pdf", pages: 40 },
  { id: "ls:5195", what: "Lok Sabha answer (communal incidents)", url: "https://eparlib.nic.in/bitstream/123456789/727282/1/5195.pdf" },
  { id: "ls:20238", what: "Lok Sabha answer", url: "https://eparlib.sansad.in/bitstream/123456789/519754/1/20238.pdf" },
  { id: "ls:30549", what: "Lok Sabha answer", url: "https://eparlib.sansad.in/bitstream/123456789/677173/1/30549.pdf" },
  { id: "ls:98529", what: "Lok Sabha answer", url: "https://eparlib.nic.in/bitstream/123456789/595219/1/98529.pdf" },
  { id: "ls:20180", what: "Lok Sabha answer", url: "https://eparlib.nic.in/bitstream/123456789/665987/1/20180.pdf" },
  { id: "ls:140601", what: "Lok Sabha answer", url: "https://eparlib.nic.in/bitstream/123456789/640964/1/140601.pdf" },
  { id: "ls:127126", what: "Lok Sabha answer", url: "https://eparlib.nic.in/bitstream/123456789/626398/1/127126.pdf" },
  { id: "mha:ls-1544-2022", what: "MHA, Lok Sabha unstarred 1544, 26 July 2022", url: "https://www.mha.gov.in/MHA1/Par2017/pdfs/par2022-pdfs/LS26072022/1544.pdf" },
  { id: "prs:communal-2011", what: "PRS Vital Stats: Communal violence in India (2011)", url: "https://prsindia.org/files/policy/policy_vital_state/1308201190_Vital%20Stats%20-%20Communal%20Violence%20in%20India%2014Jun11%20v2.pdf" },
];

interface Kept { page: number; text: string }

function anchors(html: string, base: string): Array<{ href: string; text: string }> {
  const out: Array<{ href: string; text: string }> = [];
  for (const m of html.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const raw = m[1] ?? "";
    if (!raw || raw.startsWith("#") || raw.startsWith("javascript:")) continue;
    const text = (m[2] ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    let href = raw;
    try { href = new URL(raw, base).toString(); } catch { /* as written */ }
    out.push({ href, text });
  }
  return out;
}

async function download(url: string): Promise<{ ok: boolean; status: string; buf?: Buffer; type?: string }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*" }, signal: AbortSignal.timeout(120_000), redirect: "follow" });
      if (!res.ok) { if (attempt === 2 || res.status < 500) return { ok: false, status: `HTTP ${res.status}` }; continue; }
      return { ok: true, status: `HTTP ${res.status}`, buf: Buffer.from(await res.arrayBuffer()), type: res.headers.get("content-type") ?? "" };
    } catch (e) {
      if (attempt === 2) return { ok: false, status: (e as Error).message };
    }
    await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
  }
  return { ok: false, status: "unreachable" };
}

function pdfPages(buf: Buffer): string[] {
  const dir = mkdtempSync(join(tmpdir(), "po-"));
  const pdf = join(dir, "doc.pdf"), txt = join(dir, "doc.txt");
  writeFileSync(pdf, buf);
  execFileSync("pdftotext", ["-layout", pdf, txt], { stdio: "ignore", timeout: 300_000 });
  return existsSync(txt) ? readFileSync(txt, "utf8").split("\f") : [];
}

async function main(): Promise<void> {
  const listings: unknown[] = [];
  for (const l of LISTINGS) {
    await new Promise((r) => setTimeout(r, 1500));
    const res = await getText(l.url, { timeoutMs: 45_000, retries: 1, cacheMs: 0 });
    if (!res.ok || !res.data) { listings.push({ id: l.id, url: l.url, ok: false, status: res.error ?? "no body" }); console.log(`  ${l.id}: ${res.error}`); continue; }
    if (l.id === "opencity:ckan") {
      try {
        const j = JSON.parse(res.data) as { result?: { results?: Array<{ name: string; title: string; resources?: Array<{ name: string; url: string }> }> } };
        const pk = (j.result?.results ?? []).map((p) => ({ name: p.name, title: p.title, resources: (p.resources ?? []).map((r) => ({ name: r.name, url: r.url })) }));
        listings.push({ id: l.id, url: l.url, ok: true, packages: pk });
      } catch (e) { listings.push({ id: l.id, url: l.url, ok: false, status: (e as Error).message }); }
      continue;
    }
    const docs = anchors(res.data, l.url).filter((a) => /\.(?:pdf|xlsx?|csv|zip)(?:$|\?)/i.test(a.href));
    const byHref = new Map<string, string>();
    for (const a of docs) { const p = byHref.get(a.href); if (p === undefined || a.text.length > p.length) byHref.set(a.href, a.text); }
    listings.push({ id: l.id, url: l.url, ok: true, links: [...byHref].map(([href, text]) => ({ href, text })).slice(0, 400) });
    console.log(`  ${l.id}: ${byHref.size} documents`);
  }

  const documents: unknown[] = [];
  for (const d of DOCS) {
    await new Promise((r) => setTimeout(r, 1500));
    const got = await download(d.url);
    if (!got.ok || !got.buf) { documents.push({ id: d.id, what: d.what, url: d.url, ok: false, status: got.status }); console.log(`  ${d.id}: ${got.status}`); continue; }
    let pages: string[] = [];
    const isPdf = got.buf.subarray(0, 5).toString() === "%PDF-";
    try { pages = isPdf ? pdfPages(got.buf) : [got.buf.toString("utf8").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ")]; }
    catch (e) { documents.push({ id: d.id, what: d.what, url: d.url, ok: false, status: `extract: ${(e as Error).message}` }); continue; }
    const kept: Kept[] = [];
    pages.forEach((t, i) => { if (TOPIC.test(t) && kept.length < (d.pages ?? 12)) kept.push({ page: i + 1, text: t.slice(0, 9000) }); });
    documents.push({ id: d.id, what: d.what, url: d.url, ok: true, pdf: isPdf, bytes: got.buf.length, pagesTotal: pages.length, kept });
    console.log(`  ${d.id}: ${pages.length} pages, ${kept.length} kept`);
  }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({ probedAt: new Date().toISOString(), refusal: "Source text for checking, not data. Nothing here is rendered.", listings, documents }, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
