/**
 * Server-side loader for /ministries: the Commerce Ministry's trade figures and
 * the Home Ministry's monthly reports, each checked against the text of the
 * pinned document it was read from before anything is drawn.
 *
 * data/ministry/commerce-docs.json and mha-docs.json hold each document's text,
 * its URL, the file it is pinned as under data/pdf/, and that file's SHA-256.
 * data/ministry/trade.json holds the figures read from the releases
 * (scripts/etl/ministry/extract_trade.py), each with a verbatim quote.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { normalise, quoteHasValue } from "./public-order-shared";

export interface PinnedDoc { id: string; title: string; published: string | null; url: string; file: string | null; sha256: string | null; bytes: number | null; pages: string[]; ok: boolean; ocr?: boolean; status?: string }
export interface TradeObs { series: string; kind: "month" | "ytd"; period: string; v: number; src: string; quote: string; table: string; role: "current" | "year-earlier"; released: string | null; unit?: string }

const read = <T,>(p: string): T | null => { const f = join(process.cwd(), p); return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as T) : null; };

export interface TradeView {
  docs: Map<string, PinnedDoc>;
  verified: TradeObs[];
  failed: Array<{ obs: TradeObs; why: string }>;
  /** Per series and period: the first release's figure and the latest revision. */
  first: Map<string, TradeObs>;
  latest: Map<string, TradeObs>;
  releases: PinnedDoc[];
}

let cache: TradeView | null = null;

export function loadTrade(): TradeView {
  if (cache) return cache;
  const docsFile = read<{ docs: PinnedDoc[] }>("data/ministry/commerce-docs.json");
  const trade = read<{ observations: TradeObs[] }>("data/ministry/trade.json");
  const docs = new Map((docsFile?.docs ?? []).filter((d) => d.ok).map((d) => [d.id, d]));
  const text = new Map<string, string>();
  const verified: TradeObs[] = [];
  const failed: TradeView["failed"] = [];
  for (const o of trade?.observations ?? []) {
    const d = docs.get(o.src);
    if (!d) { failed.push({ obs: o, why: "document not pinned" }); continue; }
    if (!text.has(o.src)) text.set(o.src, normalise(d.pages.join("\n")));
    if (!quoteHasValue(o.quote, Math.abs(o.v)) && !quoteHasValue(o.quote, o.v)) { failed.push({ obs: o, why: "quote does not contain the figure" }); continue; }
    if (!text.get(o.src)!.includes(normalise(o.quote))) { failed.push({ obs: o, why: "quote not in the document" }); continue; }
    verified.push(o);
  }
  const key = (o: TradeObs) => `${o.series}|${o.period}`;
  const first = new Map<string, TradeObs>(), latest = new Map<string, TradeObs>();
  for (const o of verified) {
    const k = key(o);
    const f = first.get(k), l = latest.get(k);
    // A month's first figure is the one in its own release; a later release's
    // year-earlier column is the revision.
    if (!f || (o.released ?? "") < (f.released ?? "")) first.set(k, o);
    if (!l || (o.released ?? "") > (l.released ?? "")) latest.set(k, o);
  }
  const releases = [...docs.values()].filter((d) => verified.some((o) => o.src === d.id)).sort((a, b) => (a.published ?? "").localeCompare(b.published ?? ""));
  cache = { docs, verified, failed, first, latest, releases };
  return cache;
}

/** One series' monthly points, from the latest revision (or the first release). */
export function monthSeries(v: TradeView, series: string, which: "latest" | "first" = "latest"): Array<{ m: string; v: number }> {
  const src = which === "latest" ? v.latest : v.first;
  return [...src.values()].filter((o) => o.series === series && o.kind === "month").map((o) => ({ m: o.period, v: o.unit === "US$ million" ? o.v / 1000 : o.v })).sort((a, b) => a.m.localeCompare(b.m));
}

/** Fiscal-year totals: the April–March year-to-date figure, latest revision. */
export function fiscalYears(v: TradeView, series: string): Array<{ fy: string; v: number }> {
  return [...v.latest.values()].filter((o) => o.series === series && o.kind === "ytd" && /:Apr-Mar$/.test(o.period))
    .map((o) => ({ fy: o.period.split(":")[0]!.replace(/^FY/, ""), v: o.unit === "US$ million" ? o.v / 1000 : o.v }))
    .sort((a, b) => a.fy.localeCompare(b.fy));
}

export interface MhaView { docs: PinnedDoc[]; byMonth: Array<{ m: string; doc: PinnedDoc }> }

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** The report's own month, from its title ("Monthly Major Achievements of MHA, July 2026"). */
export function mhaMonth(title: string): string | null {
  const m = title.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\W*,?\s*(\d{4})/i);
  return m ? `${m[2]}-${String(MONTHS.indexOf(m[1]!.toLowerCase()) + 1).padStart(2, "0")}` : null;
}

export function loadMha(): MhaView {
  const f = read<{ docs: PinnedDoc[] }>("data/ministry/mha-docs.json");
  const docs = (f?.docs ?? []).filter((d) => d.ok);
  const byMonth = docs.map((doc) => ({ m: mhaMonth(doc.title) ?? "", doc })).filter((x) => x.m).sort((a, b) => a.m.localeCompare(b.m));
  return { docs, byMonth };
}

/* ── The Home Ministry's reports, read ────────────────────────────────── */

export interface MhaReport { src: string; month: string | null; items: number; ocr: boolean; chars: number; readable: boolean }
export interface MhaItem { src: string; month: string; n: number; quote: string; themes: string[] }
export interface MhaBill { src: string; month: string; name: string; quote: string }
export interface MhaUapa { src: string; month: string; kind: string; quote: string; theme: string[] }
export interface MhaAmount { src: string; month: string; v: number; printed: string; unit: "crore" | "lakh" | "lakh crore"; quote: string; themes: string[] }
export interface MhaStated { series: string; src: string; month: string; v: number; quote: string }
export interface MhaFile {
  source: string;
  themes: Array<{ id: string; label: string; rule: string }>;
  counts: Array<{ id: string; label: string }>;
  reports: MhaReport[]; items: MhaItem[]; bills: MhaBill[]; uapa: MhaUapa[]; amounts: MhaAmount[]; stated: MhaStated[];
}

export interface MhaRead {
  file: MhaFile;
  docs: Map<string, PinnedDoc>;
  /** Quotes not found in their report, or figures their quote does not contain. Nothing here is drawn. */
  failed: Array<{ src: string; what: string; why: string }>;
  items: MhaItem[]; bills: MhaBill[]; uapa: MhaUapa[]; amounts: MhaAmount[]; stated: MhaStated[];
}

let mhaCache: MhaRead | null = null;

/** data/ministry/mha.json, with every quote re-found in its pinned report. */
export function loadMhaRead(): MhaRead | null {
  if (mhaCache) return mhaCache;
  const file = read<MhaFile>("data/ministry/mha.json");
  if (!file) return null;
  const docs = new Map(loadMha().docs.map((d) => [d.id, d]));
  const text = new Map<string, string>();
  const t = (src: string) => { if (!text.has(src)) text.set(src, normalise(docs.get(src)?.pages.join("\n") ?? "")); return text.get(src)!; };
  const failed: MhaRead["failed"] = [];
  const check = <T extends { src: string; quote: string },>(rows: T[], what: (r: T) => string, value?: (r: T) => number): T[] => rows.filter((r) => {
    if (!docs.has(r.src)) { failed.push({ src: r.src, what: what(r), why: "report not pinned" }); return false; }
    if (!r.quote) return true;
    if (!t(r.src).includes(normalise(r.quote))) { failed.push({ src: r.src, what: what(r), why: "quote not in the report" }); return false; }
    if (value && !quoteHasValue(r.quote, value(r))) { failed.push({ src: r.src, what: what(r), why: "quote does not contain the figure" }); return false; }
    return true;
  });
  mhaCache = {
    file, docs, failed,
    items: check(file.items, (r) => `item ${r.n}`),
    bills: check(file.bills, (r) => r.name),
    uapa: check(file.uapa, (r) => r.kind),
    amounts: check(file.amounts, (r) => r.printed, (r) => r.v),
    stated: check(file.stated, (r) => r.series, (r) => r.v),
  };
  return mhaCache;
}
