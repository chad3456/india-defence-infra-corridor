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

async function main() {
  const which = process.argv[2] ?? "all";
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
