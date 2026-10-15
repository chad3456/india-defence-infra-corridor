/**
 * The Commerce and Home ministries' monthly documents, pinned in the repo.
 *
 *   npm run ministry:docs
 *
 * Commerce: the "Data-Related Releases" list at commerce.gov.in comes from the
 * site's own API (api/v1/press-release-pib and its -archive twin, found by
 * reading the front end's bundle; data/ministry/commerce-api-probe.json). The
 * monthly "Press Release on India's Foreign Trade" PDFs are downloaded.
 *
 * Home Affairs: mha.gov.in lists every "Monthly Major Achievements" PDF on one
 * HTML page, from mid-2016.
 *
 * Every PDF is saved under data/pdf/<ministry>/ with its SHA-256, and its text
 * (pdftotext -layout, page by page) under data/ministry/<ministry>-docs.json.
 * The figures on /ministries are read from that text, and a test checks each
 * one against it — so the text, the PDF it came from and the URL it was
 * downloaded from are all kept together. A document already saved is not
 * downloaded again.
 *
 * Never throws: a document that fails is listed with the reason and the run
 * carries on.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { getText } from "../lib/http";

const ROOT = process.cwd();
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export interface MinistryDoc {
  id: string;
  ministry: "commerce" | "mha";
  title: string;
  /** Publication date as the ministry lists it, ISO. */
  published: string | null;
  url: string;
  file: string | null;
  sha256: string | null;
  bytes: number | null;
  pages: string[];
  ok: boolean;
  status?: string;
  /** The PDF is a scan with no text layer; `pages` is tesseract's reading of it. */
  ocr?: boolean;
}
export interface DocsFile { ministry: string; updatedAt: string; source: string; listed: number; docs: MinistryDoc[] }

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

function isoFromDmy(s: string | undefined): string | null {
  const m = s?.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  return m ? `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}` : null;
}

async function download(url: string): Promise<Buffer | string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/pdf,*/*" }, signal: AbortSignal.timeout(90_000), redirect: "follow" });
      if (!res.ok) { if (res.status < 500 || attempt) return `HTTP ${res.status}`; continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      return buf.subarray(0, 5).toString() === "%PDF-" ? buf : "not a PDF";
    } catch (e) { if (attempt) return (e as Error).message; }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return "unreachable";
}

function pdfPages(buf: Buffer): string[] {
  const dir = mkdtempSync(join(tmpdir(), "md-"));
  writeFileSync(join(dir, "d.pdf"), buf);
  execFileSync("pdftotext", ["-layout", join(dir, "d.pdf"), join(dir, "d.txt")], { stdio: "ignore", timeout: 180_000 });
  return readFileSync(join(dir, "d.txt"), "utf8").split("\f").map((p) => p.replace(/[ \t]+$/gm, "")).filter((p, i, a) => i < a.length - 1 || p.trim());
}

/* ── Commerce ─────────────────────────────────────────────────────────── */

interface CommerceRow { nid: string; title: string; field_dates?: string; field_upload_file?: string; field_select_press_release?: string }

async function commerceIndex(): Promise<{ rows: CommerceRow[]; errors: string[] }> {
  const errors: string[] = [];
  const rows: CommerceRow[] = [];
  for (const ep of ["api/v1/press-release-pib", "api/v1/press-release-pib-archive"]) {
    const res = await getText(`https://www.commerce.gov.in/ministryofcommerce/${ep}`, { timeoutMs: 90_000, retries: 2, cacheMs: 0 });
    if (!res.ok || !res.data) { errors.push(`${ep}: ${res.error}`); continue; }
    try {
      const j = JSON.parse(res.data) as CommerceRow[] | { data?: CommerceRow[]; rows?: CommerceRow[] };
      const list = Array.isArray(j) ? j : (j.data ?? j.rows ?? []);
      rows.push(...list);
    } catch (e) { errors.push(`${ep}: ${(e as Error).message}`); }
  }
  const seen = new Set<string>();
  return { rows: rows.filter((r) => r.nid && !seen.has(r.nid) && (seen.add(r.nid), true)), errors };
}

/** Which data-related releases to pin. The monthly foreign-trade release is the record. */
const COMMERCE_KEEP = /foreign trade/i;

/* ── Home Affairs ─────────────────────────────────────────────────────── */

async function mhaIndex(): Promise<{ rows: Array<{ title: string; url: string; published: string | null }>; errors: string[] }> {
  const page = "https://www.mha.gov.in/en/commoncontent/monthly-major-achievements-mha";
  const res = await getText(page, { timeoutMs: 60_000, retries: 2, cacheMs: 0 });
  if (!res.ok || !res.data) return { rows: [], errors: [`listing: ${res.error}`] };
  const rows: Array<{ title: string; url: string; published: string | null }> = [];
  // Each listing row is a table row: a title cell, a date cell, a download link.
  for (const tr of res.data.split(/<tr[\s>]/i).slice(1)) {
    const href = tr.match(/href="([^"]+\.pdf)"/i)?.[1];
    if (!href) continue;
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]!.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim());
    const title = cells.find((c) => /[a-z]/i.test(c) && !/download/i.test(c)) ?? href.split("/").pop()!;
    const published = isoFromDmy(cells.find((c) => /\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/.test(c)));
    rows.push({ title, url: new URL(href, page).toString(), published });
  }
  return { rows, errors: [] };
}

/* ── Shared ───────────────────────────────────────────────────────────── */

async function pin(ministry: "commerce" | "mha", listed: Array<{ id: string; title: string; published: string | null; urls: string[] }>, source: string, errors: string[]) {
  const outJson = join(ROOT, "data", "ministry", `${ministry}-docs.json`);
  const prev: DocsFile | null = existsSync(outJson) ? JSON.parse(readFileSync(outJson, "utf8")) as DocsFile : null;
  const prevById = new Map((prev?.docs ?? []).map((d) => [d.id, d]));
  const docs: MinistryDoc[] = [];
  let fetched = 0;
  for (const l of listed) {
    const old = prevById.get(l.id);
    if (old?.ok && old.file && existsSync(join(ROOT, old.file))) { docs.push({ ...old, title: l.title, published: l.published }); continue; }
    let got: Buffer | string = "no url";
    let used = l.urls[0]!;
    for (const u of l.urls) { used = u; got = await download(u); if (typeof got !== "string") break; }
    await new Promise((r) => setTimeout(r, 800));
    if (typeof got === "string") { docs.push({ id: l.id, ministry, title: l.title, published: l.published, url: used, file: null, sha256: null, bytes: null, pages: [], ok: false, status: got }); console.log(`  ${l.id}: ${got}`); continue; }
    const file = join("data", "pdf", ministry, `${l.id}.pdf`);
    mkdirSync(dirname(join(ROOT, file)), { recursive: true });
    writeFileSync(join(ROOT, file), got);
    let pages: string[] = [];
    try { pages = pdfPages(got); } catch (e) { errors.push(`${l.id}: pdftotext ${(e as Error).message}`); }
    docs.push({ id: l.id, ministry, title: l.title, published: l.published, url: used, file, sha256: createHash("sha256").update(got).digest("hex"), bytes: got.length, pages, ok: true });
    fetched++;
    console.log(`  ${l.id}: ${got.length} bytes, ${pages.length} pages`);
    if (fetched % 10 === 0) writeOut();
  }
  function writeOut() {
    mkdirSync(dirname(outJson), { recursive: true });
    const out: DocsFile & { errors: string[] } = { ministry, updatedAt: new Date().toISOString(), source, listed: listed.length, docs: [...docs, ...(prev?.docs ?? []).filter((d) => !docs.some((x) => x.id === d.id) && !listed.some((x) => x.id === d.id))], errors };
    writeFileSync(outJson, JSON.stringify(out, null, 1));
  }
  writeOut();
  console.log(`${ministry}: ${listed.length} listed, ${docs.filter((d) => d.ok).length} pinned (${fetched} new), ${docs.filter((d) => !d.ok).length} failed`);
}

/* ── Commerce before the API: Wayback copies of the old sites ───────────── */

interface ArchiveState { listings: Record<string, Array<{ id: string; title: string }>>; failed: Record<string, string> }

const WB = (ts: string, url: string) => `https://web.archive.org/web/${ts}id_/${url}`;
/** The monthly foreign-trade release, under the titles it has carried since 2004. */
const TRADE_TITLE = /foreign trade|india.?s trade|exports? (?:and|&) imports?|trade (?:data|figures|performance)|merchandise trade/i;

async function wbText(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await getText(url, { timeoutMs: 60_000, retries: 0, cacheMs: 0 });
    if (res.ok && res.data) return res.data;
    if (!/429|fetch failed/.test(String(res.error)) || attempt) return null;
    await new Promise((r) => setTimeout(r, 90_000));
  }
  return null;
}

/**
 * The pre-2017 commerce.nic.in site listed each month's releases on a page of
 * its own; Wayback kept 183 of them. Read the listings, keep the trade
 * releases, and fetch those release pages. Then the 2020-2024 PDFs Wayback
 * kept from the WordPress site. One request every eight seconds, saving as it
 * goes, stopping at a deadline; the next run carries on where this one ended.
 */
async function commerceArchive(deadline: number) {
  const probe = JSON.parse(readFileSync(join(ROOT, "data", "ministry", "docs-probe.json"), "utf8")) as { cdx: Record<string, { rows?: string[][] }> };
  const stateFile = join(ROOT, "data", "ministry", "commerce-archive-state.json");
  const state: ArchiveState = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")) : { listings: {}, failed: {} };
  const save = () => writeFileSync(stateFile, JSON.stringify(state, null, 1));
  const pace = () => new Promise((r) => setTimeout(r, 8000));

  // 1. Monthly listing pages.
  const listings = (probe.cdx["nic-all"]?.rows ?? []).filter((r) => /pressrelease_year\.asp\?year\d*=\d{4}&month=\d+/i.test(r[0]!));
  const seenKey = new Set<string>();
  for (const [orig, ts] of listings) {
    const key = orig!.match(/year\d*=(\d{4})&month=(\d+)/i)!.slice(1).join("-");
    if (seenKey.has(key) || state.listings[key]) { seenKey.add(key); continue; }
    seenKey.add(key);
    if (Date.now() > deadline) break;
    await pace();
    const html = await wbText(WB(ts!, orig!));
    if (!html) { state.failed[`listing:${key}`] = "unreachable"; continue; }
    const items = [...html.matchAll(/pressrelease_detail\.asp\?id=(\d+)[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({ id: m[1]!, title: m[2]!.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&amp;/g, " ").replace(/\s+/g, " ").trim() }));
    state.listings[key] = items;
    delete state.failed[`listing:${key}`];
    console.log(`  listing ${key}: ${items.length} releases, ${items.filter((i) => TRADE_TITLE.test(i.title)).length} on trade`);
    save();
  }

  // 2. The trade releases among them, as archived pages.
  const detailTs = new Map((probe.cdx["nic-detail"]?.rows ?? []).map((r) => [r[0]!.match(/id=(\d+)/)?.[1] ?? "", r]));
  const want = new Map<string, { title: string; month: string }>();
  for (const [key, items] of Object.entries(state.listings)) for (const i of items) if (TRADE_TITLE.test(i.title)) want.set(i.id, { title: i.title, month: key });
  const outJson = join(ROOT, "data", "ministry", "commerce-docs.json");
  const file: DocsFile & { errors?: string[] } = JSON.parse(readFileSync(outJson, "utf8"));
  const have = new Set(file.docs.filter((d) => d.ok).map((d) => d.id));
  for (const [nid, meta] of want) {
    const id = `nic-${nid}`;
    if (have.has(id) || Date.now() > deadline) continue;
    const row = detailTs.get(nid);
    if (!row) { state.failed[id] = "not archived"; continue; }
    await pace();
    const html = await wbText(WB(row[1]!, row[0]!));
    if (!html) { state.failed[id] = "unreachable"; save(); continue; }
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<br\s*\/?>|<\/p>|<\/tr>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n");
    const rel = join("data", "pdf", "commerce", `${id}.html`);
    mkdirSync(dirname(join(ROOT, rel)), { recursive: true });
    writeFileSync(join(ROOT, rel), html);
    const published = (() => { const m = text.match(/(\d{1,2})(?:st|nd|rd|th)?[ .,-]+(January|February|March|April|May|June|July|August|September|October|November|December)[ .,-]+(\d{4})/i); if (!m) return null; const mo = ["january","february","march","april","may","june","july","august","september","october","november","december"].indexOf(m[2]!.toLowerCase()) + 1; return `${m[3]}-${String(mo).padStart(2, "0")}-${m[1]!.padStart(2, "0")}`; })();
    file.docs.push({ id, ministry: "commerce", title: meta.title, published: published ?? `${meta.month.split("-")[0]}-${meta.month.split("-")[1]!.padStart(2, "0")}-15`, url: row[0]!, file: rel, sha256: createHash("sha256").update(html).digest("hex"), bytes: html.length, pages: [text], ok: true, status: `Wayback snapshot ${row[1]}` });
    delete state.failed[id];
    console.log(`  ${id}: ${meta.title.slice(0, 70)}`);
    writeFileSync(outJson, JSON.stringify(file, null, 1)); save();
  }

  // 3. The 2020-2024 monthly PDFs Wayback kept from the WordPress uploads.
  const pdfRows = (probe.cdx["gov-wp-uploads"]?.rows ?? []).filter((r) => r[2] === "application/pdf" && /(Press[-_]Release[-_](January|February|March|April|May|June|July|August|September|October|November|December)[-_]\d{4}|PIB[-_]?(Press[-_])?Release)/i.test(r[0]!.split("/").pop()!));
  for (const [orig, ts] of pdfRows) {
    const base = orig!.split("/").pop()!.replace(/\.pdf$/i, "");
    const ym = orig!.match(/uploads\/(\d{4})\/(\d{2})\//);
    const id = `wp-${ym ? `${ym[1]}${ym[2]}-` : ""}${slug(base)}`;
    if (have.has(id) || file.docs.some((d) => d.id === id && d.ok) || Date.now() > deadline) continue;
    await pace();
    const got = await download(WB(ts!, orig!));
    if (typeof got === "string") { state.failed[id] = got; save(); if (/429/.test(got)) await new Promise((r) => setTimeout(r, 90_000)); continue; }
    const rel = join("data", "pdf", "commerce", `${id}.pdf`);
    writeFileSync(join(ROOT, rel), got);
    let pages: string[] = [];
    try { pages = pdfPages(got); } catch { /* recorded as empty */ }
    file.docs.push({ id, ministry: "commerce", title: base.replace(/[-_]+/g, " "), published: ym ? `${ym[1]}-${ym[2]}-15` : null, url: orig!, file: rel, sha256: createHash("sha256").update(got).digest("hex"), bytes: got.length, pages, ok: true, status: `Wayback snapshot ${ts}` });
    delete state.failed[id];
    console.log(`  ${id}: ${pages.length} pages`);
    writeFileSync(outJson, JSON.stringify(file, null, 1)); save();
  }
  save();
}

/**
 * Scanned PDFs: render each page at 300 dpi and read it with tesseract. The
 * result is marked `ocr`, and figures read from it are labelled as OCR'd on
 * the page — a scan read by a machine can misread a digit, and the check
 * against the text only proves the quote matches the machine's reading.
 */
function ocrPdf(file: string): string[] {
  const dir = mkdtempSync(join(tmpdir(), "ocr-"));
  execFileSync("pdftoppm", ["-r", "300", "-gray", "-png", file, join(dir, "p")], { stdio: "ignore", timeout: 600_000 });
  const pngs = execFileSync("ls", [dir]).toString().split("\n").filter((f) => f.endsWith(".png")).sort();
  return pngs.map((png) => {
    try { return execFileSync("tesseract", [join(dir, png), "-", "-l", "eng", "--psm", "4"], { timeout: 180_000, maxBuffer: 1 << 26 }).toString(); }
    catch { return ""; }
  });
}

function ocrStage(ministry: "mha" | "commerce", deadline: number) {
  const outJson = join(ROOT, "data", "ministry", `${ministry}-docs.json`);
  const file = JSON.parse(readFileSync(outJson, "utf8")) as DocsFile;
  for (const d of file.docs) {
    if (!d.ok || !d.file?.endsWith(".pdf") || d.ocr || Date.now() > deadline) continue;
    if (d.pages.join("").replace(/\s/g, "").length >= 300) continue;
    try { d.pages = ocrPdf(join(ROOT, d.file)); d.ocr = true; console.log(`  ocr ${d.id}: ${d.pages.join("").length} chars`); }
    catch (e) { console.log(`  ocr ${d.id}: ${(e as Error).message}`); }
    writeFileSync(outJson, JSON.stringify(file, null, 1));
  }
}

async function main() {
  const which = process.argv[2] ?? "all";
  if (which === "ocr") { ocrStage("mha", Date.now() + 40 * 60_000); ocrStage("commerce", Date.now() + 10 * 60_000); return; }
  if (which === "archive") { await commerceArchive(Date.now() + Number(process.env.ARCHIVE_MINUTES ?? 40) * 60_000); return; }
  if (which === "all" || which === "commerce") {
    const { rows, errors } = await commerceIndex();
    writeFileSync(join(ROOT, "data", "ministry", "commerce-index.json"), JSON.stringify({ updatedAt: new Date().toISOString(), rows }, null, 1));
    const keep = rows.filter((r) => /data related/i.test(r.field_select_press_release ?? "") && COMMERCE_KEEP.test(r.title) && r.field_upload_file);
    const listed = keep.map((r) => {
      const path = r.field_upload_file!.replace(/^\/ministryofcommerce/, "");
      return {
        id: `doc-${r.nid}-${slug(path.split("/").pop()!.replace(/\.pdf$/i, ""))}`,
        title: r.title, published: isoFromDmy(r.field_dates),
        urls: [`https://www.commerce.gov.in${path}`, `https://www.commerce.gov.in/ministryofcommerce${path}`],
      };
    });
    console.log(`commerce: ${rows.length} releases listed, ${listed.length} foreign-trade releases to pin`);
    await pin("commerce", listed, "https://www.commerce.gov.in/#/documents/press-releases/data-related-releases", errors);
  }
  if (which === "all" || which === "mha") {
    const { rows, errors } = await mhaIndex();
    const listed = rows.map((r) => ({ id: `mha-${slug(r.url.split("/").pop()!.replace(/\.pdf$/i, "").replace(/%5B1%5D|\[1\]/gi, ""))}`, title: r.title, published: r.published, urls: [r.url] }));
    const ids = new Set<string>();
    const unique = listed.filter((l) => !ids.has(l.id) && (ids.add(l.id), true));
    console.log(`mha: ${unique.length} monthly documents listed`);
    await pin("mha", unique, "https://www.mha.gov.in/en/commoncontent/monthly-major-achievements-mha", errors);
  }
}

main().catch((e) => { console.error(e); });
