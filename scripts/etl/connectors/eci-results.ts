/**
 * Assembly and Lok Sabha results, seat by seat, from ECI's own result pages.
 *
 * `npm run eci:results`. Writes data/elections/results/{folder}/{state}.json.
 * Runs in GitHub Actions; the editing sandbox reaches neither ECI nor the archive.
 *
 * ECI's results portal keeps only the election currently being counted;
 * every past folder now answers 404. But the Internet Archive crawled the
 * portal heavily on and after counting day, and an archived page is ECI's page
 * byte for byte. So for each election folder this asks the archive's CDX index
 * which constituency pages it holds, fetches the latest snapshot of each raw
 * (the `id_` form, without the archive's toolbar), and parses ECI's table.
 *
 * Every page is checked against itself before a seat is kept:
 *   - on the table page, each candidate's EVM plus postal votes must equal
 *     their total, and the candidates' totals must sum to ECI's printed total;
 *   - on the candidate-card page (the fallback), the winner's printed margin
 *     must equal the winner's votes less the runner-up's.
 * A page that fails is not used. A seat with no usable page is left out and
 * counted as missing; nothing is filled in.
 *
 * A snapshot taken mid-count holds a lead, not a result, so each seat records
 * whether its page shows the count complete (all EVM rounds, a "won" card, or
 * an update stamped after counting day). The pages show which seats are not.
 *
 * The connector never throws: a folder that fails leaves its previous files.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "../lib/http";
import { isEntryPoint } from "../lib/entry";
import type { Candidate, ElectionIndexEntry, House, Seat, StateResult } from "../../../lib/elections-atlas-shared";

const ROOT = join(process.cwd(), "data", "elections", "results");
const CDX = "https://web.archive.org/cdx/search/cdx";
const PORTAL = "results.eci.gov.in";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The general-election folders the archive holds (found by
 * scripts/etl/probe-eci-wayback.ts). By-election folders are left out: a
 * by-election changes one seat, and mixing it in would make a state's house
 * a composite of two dates.
 */
export const FOLDERS: Array<{ folder: string; house: House }> = [
  { folder: "PcResultGenJune2024", house: "PC" },
  { folder: "ResultAcGenMay2026", house: "AC" },
  { folder: "ResultAcGenNov2025", house: "AC" },
  { folder: "ResultAcGenFeb2025", house: "AC" },
  { folder: "ResultAcGenNov2024", house: "AC" },
  { folder: "AcResultGenOct2024", house: "AC" },
  { folder: "AcResultGenJune2024", house: "AC" },
  { folder: "AcResultGen2ndJune2024", house: "AC" },
  { folder: "AcResultGenDecNew2023", house: "AC" },
  { folder: "ResultAcGenMay2023", house: "AC" },
  { folder: "ResultAcGenMar2023", house: "AC" },
  { folder: "ResultAcGenDec2022", house: "AC" },
  { folder: "ResultAcGenMar2022", house: "AC" },
];

/* ── HTML helpers ─────────────────────────────────────────────────────── */

const decode = (s: string) => s
  .replace(/<[^>]+>/g, " ")
  .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/\s+/g, " ").trim();
const int = (s: string | undefined) => {
  const t = decode(s ?? "").replace(/,/g, "");
  return /^-?\d+$/.test(t) ? Number(t) : null;
};

export interface PageHead {
  /** "Trends & Results May-2026" — ECI's own label for the election. */
  title: string;
  no: number;
  name: string;
  stateName: string;
  /** EVM rounds counted and scheduled, where the page shows them. */
  rounds?: [number, number];
  /** "Last Updated at 08:55 am On 05/06/2024", as an ISO date. */
  updated?: string;
}

export function parseHead(html: string, seatNo?: number): PageHead | null {
  const r = /class=['"]round-status['"][^>]*>[^<]*<span>\s*(\d+)\s*<\/span>\s*\/\s*(\d+)/i.exec(html);
  // English "Last Updated at 08:55 am On 05/06/2024"; Hindi "पिछली बार दिनांक 04/12/2023 को".
  const u = /Last Updated at[^<]*?On\s*(\d{2})\/(\d{2})\/(\d{4})/i.exec(html) ?? /दिनांक\s*(\d{2})\/(\d{2})\/(\d{4})/.exec(html);
  const common = { rounds: r ? [Number(r[1]), Number(r[2])] as [number, number] : undefined, updated: u ? `${u[3]}-${u[2]}-${u[1]}` : undefined };
  // 2024 onwards: <h1>General Election to …: Trends & Results May-2026</h1>
  //               <h2>Assembly Constituency <span> 10 - NAME <strong>(State)</strong>
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  const h2 = /<h2[^>]*>[\s\S]*?Constituency\s*<span>\s*(\d+)\s*-\s*([\s\S]*?)<strong>\s*\(([^)]+)\)/i.exec(html);
  if (h1 && h2) {
    return { title: decode(h1[1]!).replace(/^General Elections? to (?:Assembly|Parliamentary) Constituencies:\s*/i, ""), no: Number(h2[1]), name: decode(h2[2]!), stateName: decode(h2[3]!), ...common };
  }
  // 2022–23: <h3>GENERAL ELECTION TO VIDHAN SABHA TRENDS & RESULT MAY-2023</h3>
  //          <td colspan='9'>Karnataka-Nippani -1</td> (the number is sometimes absent)
  const h3 = /<h3>\s*(GEN(?:ERAL)? ELECTION[^<]*?)\s*<\/h3>/i.exec(html);
  const cap = /<td colspan='9' align='center'>\s*([^<]+?)\s*<\/td><\/tr>\s*<tr[^>]*>\s*<td colspan='9' align='center'>\s*Result Status/i.exec(html);
  if (h3 && cap) {
    const m = /^(.*?)-(.*?)(?:\s+-\s*(\d+))?$/.exec(decode(cap[1]!));
    const no = m?.[3] ? Number(m[3]) : seatNo;
    if (!m || no == null) return null;
    const title = decode(h3[1]!).replace(/^GEN(?:ERAL)? ELECTION TO (?:VIDHAN SABHA|LOK SABHA)\s*/i, "").replace(/\bTRENDS & RESULT\b/i, "Trends & Results");
    return { title, no, name: m[2]!.trim(), stateName: m[1]!.trim(), ...common };
  }
  // ECI's Hindi pages: <h2>विधानसभा क्षेत्र <span> चांदला<Strong> (मध्य प्रदेश)</Strong> — no seat number.
  const hi = /<h2>[^<]*<span>\s*([^<]+?)\s*<Strong>\s*\(([^)]+)\)/i.exec(html);
  if (h1 && hi && seatNo != null && /[\u0900-\u097F]/.test(hi[1]!)) {
    return { title: decode(h1[1]!), no: seatNo, name: decode(hi[1]!), stateName: decode(hi[2]!), ...common };
  }
  return null;
}

/** The table view: every candidate with EVM, postal and total votes. Null if the page fails its own arithmetic. */
export function parseTablePage(html: string): { candidates: Candidate[]; total: number; problem?: string } | null {
  // The innermost table whose header names Candidate and Total Votes. The
  // 2022–23 pages nest it inside layout tables, so take the last <table> opening
  // before the header and run to the next </table>.
  const hdr = html.search(/<th[^>]*>\s*Candidate\s*<\/th>/i);
  if (hdr < 0 || !/Total Votes/i.test(html.slice(hdr, hdr + 2000))) return null;
  const open = html.lastIndexOf("<table", hdr);
  const close = html.indexOf("</table>", hdr);
  const table = html.slice(open, close);
  const candidates: Candidate[] = [];
  let printedTotal: number | null = null;
  for (const tr of table.slice(hdr - open).split(/<tr[^>]*>/i).slice(1)) {
    const td = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]!);
    if (td.length < 6) continue;
    if (/^total$/i.test(decode(td[1]!))) { printedTotal = int(td[5]); continue; }
    const evm = int(td[3]), postal = int(td[4]), votes = int(td[5]);
    if (votes == null) continue;
    candidates.push({ name: decode(td[1]!), party: decode(td[2]!), votes, ...(evm != null ? { evm } : {}), ...(postal != null ? { postal } : {}) });
  }
  const foot = /<tfoot>([\s\S]*?)<\/tfoot>/i.exec(html.slice(open, html.indexOf("</table>", close + 1) > 0 ? close + 400 : close))?.[1] ?? /<tfoot>([\s\S]*?)<\/tfoot>/i.exec(table)?.[1] ?? "";
  const th = [...foot.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => m[1]!);
  const total = printedTotal ?? int(th[5]) ?? candidates.reduce((a, c) => a + c.votes, 0);
  if (candidates.length === 0) return null;
  const sum = candidates.reduce((a, c) => a + c.votes, 0);
  const rowBad = candidates.find((c) => c.evm != null && c.postal != null && c.evm + c.postal !== c.votes);
  const problem = sum !== total ? `candidates sum to ${sum}, page total ${total}`
    : rowBad ? `${rowBad.name}: ${rowBad.evm} + ${rowBad.postal} ≠ ${rowBad.votes}` : undefined;
  return { candidates, total, problem };
}

/** The candidate-card view: name, party, votes and won/lost. Null if the winner's margin does not reconcile. */
export function parseCardPage(html: string): { candidates: Candidate[]; declared: boolean; uncontested?: boolean; problem?: string } | null {
  const cards = html.split(/<div class=['"]cand-box['"]>/i).slice(1);
  const out: Array<Candidate & { status: string; margin: number | null }> = [];
  for (const c of cards) {
    const block = /<div class=['"]status\s+(\w+)['"]>\s*<div[^>]*>([\s\S]*?)<\/div>\s*(?:<div>\s*([\d,]+)\s*(?:<span>\s*\(\s*([+-]?)\s*([\d,]+)\s*\))?)?/i.exec(c);
    const name = /<h5>([\s\S]*?)<\/h5>/i.exec(c)?.[1];
    const party = /<h6>([\s\S]*?)<\/h6>/i.exec(c)?.[1];
    if (!block || !name) continue;
    // The status class (won/lost/leading/trailing) is English on both language versions; the label is not.
    const nota = /nota\.(?:jpg|png)/i.test(c);
    out.push({ name: nota ? "NOTA" : decode(name), party: nota ? "None of the Above" : decode(party ?? ""), votes: int(block[3]) ?? -1, status: block[1]!.toLowerCase(), margin: int(block[5]) });
  }
  // A seat with one candidate, declared won and no vote count, was returned
  // unopposed: ECI prints the winner and nothing to count.
  if (out.length === 1 && out[0]!.votes < 0 && /won|elected|uncontested/.test(out[0]!.status)) {
    return { candidates: [{ name: out[0]!.name, party: out[0]!.party, votes: 0 }], declared: true, uncontested: true };
  }
  if (out.some((c) => c.votes < 0)) return null;
  if (out.length === 0) return null;
  const sorted = [...out].sort((a, b) => b.votes - a.votes);
  const declared = out.some((c) => c.status === "won");
  let problem: string | undefined;
  if (sorted.length > 1 && sorted[0]!.margin != null && sorted[0]!.margin !== sorted[0]!.votes - sorted[1]!.votes) {
    problem = `printed margin ${sorted[0]!.margin} ≠ ${sorted[0]!.votes} − ${sorted[1]!.votes}`;
  }
  return { candidates: out.map(({ name, party, votes }) => ({ name, party, votes })), declared, problem };
}

/** The party-wise page: ECI's own tally, its party abbreviations, and the size of the house. */
export function parsePartyPage(html: string): { tally: Array<{ party: string; abbr: string; won: number; leading: number; id?: string }>; seats: number | null } | null {
  // 2024 on: "(Total AC : 234)"; 2022–23: "Status Known For 224 out of 224 Constituencies".
  const seats = /\(Total (?:AC|PC)\s*:\s*(\d+)\)/i.exec(html) ?? /Status Known For\s*\d+\s*out of\s*(\d+)\s*Constituencies/i.exec(html);
  const tally: Array<{ party: string; abbr: string; won: number; leading: number; id?: string }> = [];
  const table = /Party Wise Results[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i.exec(html)?.[1]
    ?? /<th[^>]*>\s*Party\s*<\/th>\s*<th[^>]*>\s*Won\s*<\/th>([\s\S]*?)<\/table>/i.exec(html)?.[1]
    // Hindi pages: headers are in Hindi, but each party row still links its id.
    ?? (/partywisewinresult-\d+/i.test(html) ? html.slice(html.search(/<tr[^>]*>\s*<td[^>]*>[^<]*<\/td>\s*<td[^>]*>\s*<a href=["']partywisewinresult-/i)) : "");
  for (const tr of (table.startsWith("<tr") ? table.split(/<tr[^>]*>/i) : table.split(/<tr[^>]*>/i).slice(1))) {
    const td = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => decode(m[1]!));
    if (td.length < 4 || /^total$/i.test(td[0]!)) continue;
    const m = /^(.*?)\s+-\s+([^-]+)$/.exec(td[0]!);
    const won = int(td[1]), leading = int(td[2]);
    if (won == null) continue;
    // ECI's party id, the same on the English and Hindi pages: partywisewinresult-369S22.htm.
    const id = /partywise(?:win|lead)result-(\d+)[SU]\d{2}/i.exec(tr)?.[1];
    tally.push({ party: m ? m[1]!.trim() : td[0]!, abbr: m ? m[2]!.trim() : "", won, leading: leading ?? 0, ...(id ? { id } : {}) });
  }
  // Older pages print no house size; their footer row totals won plus leading,
  // which is the house once nothing is still leading.
  const foot = /Party Wise Results[\s\S]*?<tfoot>([\s\S]*?)<\/tfoot>/i.exec(html)?.[1] ?? "";
  const th = [...foot.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => int(m[1]));
  const footSeats = th[2] === 0 && th[3] != null ? th[3] : null;
  return tally.length ? { tally, seats: seats ? Number(seats[1]) : footSeats } : null;
}

/* ── Archive access ───────────────────────────────────────────────────── */

async function cdx(params: Record<string, string>): Promise<string[][] | null> {
  await sleep(1000);
  const qs = new URLSearchParams({ output: "json", ...params });
  const res = await getText(`${CDX}?${qs}`, { timeoutMs: 180_000, retries: 4, cacheMs: 0 });
  if (!res.ok || !res.data) { console.log(`  cdx failed: ${res.error}`); return null; }
  try { return (JSON.parse(res.data) as string[][]).slice(1); } catch { return null; }
}

async function snapshot(ts: string, original: string): Promise<string | null> {
  const res = await getText(`https://web.archive.org/web/${ts}id_/${original}`, { timeoutMs: 60_000, retries: 3, cacheMs: 0 });
  return res.ok && res.data && res.data.length > 2000 ? res.data : null;
}

/** For each archived page in a folder, its snapshots newest first. */
async function listFolder(folder: string): Promise<Map<string, Array<{ ts: string; original: string }>> | null> {
  const rows = await cdx({ url: `${PORTAL}/${folder}/`, matchType: "prefix", fl: "original,timestamp", filter: "statuscode:200", limit: "300000" });
  if (!rows) return null;
  const pages = new Map<string, Array<{ ts: string; original: string }>>();
  for (const [original, ts] of rows) {
    const page = /\/((?:Constituencywise|candidateswise-|partywiseresult-)[SU]\d{2}\d*\.htm)/i.exec(original ?? "")?.[1];
    if (!page || !ts) continue;
    const key = (/\/hi\//i.test(original!) ? "hi:" : "") + page.replace(/^constituencywise/i, "Constituencywise").replace(/^candidateswise-/i, "candidateswise-");
    pages.set(key, [...(pages.get(key) ?? []), { ts, original: original! }]);
  }
  for (const list of pages.values()) list.sort((a, b) => b.ts.localeCompare(a.ts));
  return pages;
}

/** Run tasks with a small fixed concurrency, politely spaced. */
async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const t = items[i++]!; await fn(t); await sleep(400); }
  }));
}

/* ── One folder ───────────────────────────────────────────────────────── */

/**
 * The first page of each kind that fails to parse in a folder is kept under
 * data/live/election-atlas-samples/, so a template change is diagnosed from
 * the page itself rather than guessed at.
 */
const savedFailures = new Set<string>();
async function keepFailure(original: string, html: string): Promise<void> {
  const m = /results\.eci\.gov\.in\/([^/]+)\/(hi\/)?(Constituencywise|candidateswise-)/i.exec(original);
  const key = m ? `${m[1]}-${m[2] ?? ""}${m[3]}` : "other";
  if (savedFailures.has(key) || savedFailures.size >= 6) return;
  savedFailures.add(key);
  const dir = join(process.cwd(), "data", "live", "election-atlas-samples");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `unparsed-${original.split("/").slice(-2).join("-").replace(/[?%=]/g, "_")}`), html.slice(0, 150_000), "utf8");
}

interface SeatDraft extends Seat { final: boolean; updated?: string; title: string; stateName: string }

async function readSeat(pages: Map<string, Array<{ ts: string; original: string }>>, state: string, no: string, problems: string[], lang: "" | "hi:" = ""): Promise<SeatDraft | null> {
  // Hindi table pages are not read: their column headers differ and the card view carries the same numbers.
  const table = lang ? [] : pages.get(`Constituencywise${state}${no}.htm`) ?? [];
  const cards = pages.get(`${lang}candidateswise-${state}${no}.htm`) ?? [];
  // Newest table snapshot that passes its own arithmetic; at most three tries.
  let fallback: SeatDraft | null = null;
  for (const snap of table.slice(0, 3)) {
    const html = await snapshot(snap.ts, snap.original);
    if (!html) continue;
    const head = parseHead(html, Number(no)), t = parseTablePage(html);
    if (!head || !t) { await keepFailure(snap.original, html); continue; }
    if (t.problem) { problems.push(`${state}${no} table ${snap.ts}: ${t.problem}`); continue; }
    // One candidate and no poll: returned unopposed. A contested seat always has two or more.
    if (t.total === 0 && t.candidates.filter((c) => c.party !== "None of the Above").length === 1) {
      return { no: head.no, name: head.name, candidates: t.candidates.filter((c) => c.party !== "None of the Above"), url: `https://web.archive.org/web/${snap.ts}/${snap.original}`, snapshot: snap.ts, status: "uncontested", final: true, updated: head.updated, title: head.title, stateName: head.stateName };
    }
    // Counting not begun, or the poll countermanded: a page of zeros names no winner.
    if (t.total === 0) { problems.push(`${state}${no} table ${snap.ts}: no votes counted on the archived page`); continue; }
    const final = head.rounds ? head.rounds[0] === head.rounds[1] && head.rounds[1] > 0 : false;
    const seat: SeatDraft = { no: head.no, name: head.name, candidates: t.candidates, url: `https://web.archive.org/web/${snap.ts}/${snap.original}`, snapshot: snap.ts, status: head.rounds ? `EVM round ${head.rounds[0]}/${head.rounds[1]}` : head.updated ? `updated ${head.updated}` : undefined, final, updated: head.updated, title: head.title, stateName: head.stateName };
    if (final || !head.rounds) return seat; // no round line: finality is decided from the update stamp later
    fallback = seat;
    break;
  }
  for (const snap of cards.slice(0, 3)) {
    const html = await snapshot(snap.ts, snap.original);
    if (!html) continue;
    const head = parseHead(html, Number(no)), c = parseCardPage(html);
    if (!head || !c) { await keepFailure(snap.original, html); continue; }
    if (c.problem) { problems.push(`${state}${no} cards ${snap.ts}: ${c.problem}`); continue; }
    if (!c.uncontested && c.candidates.every((x) => x.votes === 0)) { problems.push(`${state}${no} cards ${snap.ts}: no votes counted on the archived page`); continue; }
    if (!c.declared && fallback) return fallback;
    return { ...(lang ? { language: "hi" as const } : {}), no: head.no, name: head.name, candidates: c.candidates, url: `https://web.archive.org/web/${snap.ts}/${snap.original}`, snapshot: snap.ts, status: c.uncontested ? "uncontested" : c.declared ? "won declared" : head.rounds ? `round ${head.rounds[0]}/${head.rounds[1]}` : "in progress", final: c.declared, updated: head.updated, title: head.title, stateName: head.stateName };
  }
  return fallback;
}

/**
 * Seats read from ECI's Hindi pages carry party names in Hindi. Their English
 * names are learned from ECI's own pages, never supplied here: for seats the
 * archive kept in both languages, each candidate is paired with the one on the
 * English page polling exactly the same votes, and a Hindi party name is
 * mapped only if every pairing agrees. Names that cannot be paired stay as ECI
 * printed them. Candidate and seat names stay in Hindi: there is no ECI page
 * that pairs them for these seats.
 */
async function translateParties(pages: Map<string, Array<{ ts: string; original: string }>>, state: string, drafts: SeatDraft[], problems: string[]): Promise<void> {
  const map = new Map<string, Set<string>>();
  const learnFrom = drafts.filter((d) => !d.language && pages.has(`hi:candidateswise-${state}${d.no}.htm`)).slice(0, 25);
  for (const en of learnFrom) {
    const snap = pages.get(`hi:candidateswise-${state}${en.no}.htm`)![0]!;
    const html = await snapshot(snap.ts, snap.original);
    const c = html ? parseCardPage(html) : null;
    if (!c) continue;
    for (const h of c.candidates) {
      const match = en.candidates.filter((x) => x.votes === h.votes);
      if (match.length === 1 && h.votes > 0) map.set(h.party, (map.get(h.party) ?? new Set()).add(match[0]!.party));
    }
  }
  // ECI's party-wise pages in both languages name each party by the same id.
  const en = pages.get(`partywiseresult-${state}.htm`)?.[0], hiP = pages.get(`hi:partywiseresult-${state}.htm`)?.[0];
  if (en && hiP) {
    const [eh, hh] = [await snapshot(en.ts, en.original), await snapshot(hiP.ts, hiP.original)];
    const ep = eh ? parsePartyPage(eh) : null, hp = hh ? parsePartyPage(hh) : null;
    for (const h of hp?.tally ?? []) {
      const e = ep?.tally.find((x) => x.id && x.id === h.id);
      if (e) map.set(h.party, (map.get(h.party) ?? new Set()).add(e.party));
    }
  }
  const sure = new Map([...map].filter(([, s]) => s.size === 1).map(([hi, s]) => [hi, [...s][0]!]));
  const unmapped = new Set<string>();
  const englishTitle = drafts.find((d) => !d.language)?.title;
  for (const d of drafts) {
    if (d.language !== "hi") continue;
    for (const c of d.candidates) {
      const en = sure.get(c.party);
      if (en) c.party = en;
      else if (c.party !== "None of the Above") unmapped.add(c.party);
    }
    if (englishTitle) d.title = englishTitle;
  }
  problems.push(`Hindi pages: ${drafts.filter((d) => d.language === "hi").length} seats read from ECI's Hindi pages; ${sure.size} party names paired with English from ${learnFrom.length} seats in both languages; ${unmapped.size} left as printed`);
}

/** "Trends & Results May-2026" → "2026-05". */
function monthOf(title: string): string {
  const m = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\s]*(\d{4})/i.exec(title);
  if (!m) return "";
  const idx = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m[1]!.toLowerCase().slice(0, 3));
  return `${m[2]}-${String(idx + 1).padStart(2, "0")}`;
}

export async function runFolder(folder: string, house: House, only?: Set<string>): Promise<{ entry: ElectionIndexEntry | null; errors: string[] }> {
  const errors: string[] = [];
  const pages = await listFolder(folder);
  if (!pages) return { entry: null, errors: [`${folder}: archive index did not answer`] };
  const byState = new Map<string, Set<string>>();
  for (const key of pages.keys()) {
    const m = /^(?:hi:)?(?:Constituencywise|candidateswise-)([SU]\d{2})(\d+)\.htm$/.exec(key);
    if (m && (!only || only.has(m[1]!))) byState.set(m[1]!, (byState.get(m[1]!) ?? new Set()).add(m[2]!));
  }
  // ECI's seat numbers run 1..N; the state code is the first three characters
  // of the page id, and the seat number the rest. Codes are always [SU] + 2 digits.
  const entry: ElectionIndexEntry = { folder, house, label: "", date: "", states: {} };
  const firstTs = [...pages.entries()].filter(([k]) => !k.startsWith("partywise")).flatMap(([, v]) => v.map((x) => x.ts)).sort()[0];
  const countingDay = firstTs ? `${firstTs.slice(0, 4)}-${firstTs.slice(4, 6)}-${firstTs.slice(6, 8)}` : undefined;
  for (const [state, seatNos] of [...byState.entries()].sort()) {
    const problems: string[] = [];
    const drafts: SeatDraft[] = [];
    const nos = [...seatNos].sort((a, b) => Number(a) - Number(b));
    await pool(nos, 4, async (no) => {
      // English first; ECI's Hindi page of the same seat when that is all the archive kept.
      const s = await readSeat(pages, state, no, problems) ?? (pages.has(`hi:candidateswise-${state}${no}.htm`) ? await readSeat(pages, state, no, problems, "hi:") : null);
      if (s) drafts.push(s);
      else problems.push(`${state}${no}: no archived page passed its checks`);
    });
    if (drafts.length === 0) { errors.push(`${folder} ${state}: no seats read`); continue; }
    if (drafts.some((d) => d.language === "hi")) await translateParties(pages, state, drafts, problems);
    // Counting day is the day the archive first saved any constituency page
    // in the folder (they exist only once counting starts); a page whose own
    // "Last Updated" stamp is a later day was written after counting closed.
    for (const d of drafts) if (!d.final && d.updated && countingDay && d.updated > countingDay) d.final = true;

    // ECI's own tally and house size, from the party-wise page's newest snapshot.
    let partyTally: StateResult["partyTally"]; let expected: number | undefined; const abbr: Record<string, string> = {};
    // The newest snapshots are often from counting morning; walk back to one with nothing still leading.
    for (const snap of (pages.get(`partywiseresult-${state}.htm`) ?? []).slice(0, 4)) {
      const html = await snapshot(snap.ts, snap.original);
      const p = html ? parsePartyPage(html) : null;
      if (!p) continue;
      Object.assign(abbr, Object.fromEntries(p.tally.filter((t) => t.abbr).map((t) => [t.party, t.abbr])));
      expected ??= p.seats ?? undefined;
      if (p.tally.every((t) => t.leading === 0)) { partyTally = p.tally.map((t) => ({ party: t.party, won: t.won })); expected = p.seats ?? expected; break; }
    }
    // Pages with no round counter and a same-day stamp cannot show their own
    // finality. ECI's party tally taken after counting closed can: if it names
    // the same winners, party for party, across every seat in the house, the
    // seats read are the declared result.
    if (partyTally && expected && drafts.length === expected) {
      const won = new Map<string, number>();
      for (const d of drafts) {
        const w = d.candidates.filter((c) => c.party !== "None of the Above").sort((a, b) => b.votes - a.votes)[0];
        if (w) won.set(w.party, (won.get(w.party) ?? 0) + 1);
      }
      if (partyTally.every((t) => (won.get(t.party) ?? 0) === t.won) && [...won.values()].reduce((a, b) => a + b, 0) === partyTally.reduce((a, t) => a + t.won, 0)) {
        for (const d of drafts) if (!d.final) { d.final = true; d.status = `${d.status ?? ""}; matches ECI's completed party tally`.replace(/^; /, ""); }
      }
    } else if (partyTally && expected && drafts.length < expected) {
      // Some seats unread: the rest are final if no party has more wins here
      // than ECI's completed tally gives it, and the shortfall is exactly the
      // seats not read.
      const won = new Map<string, number>();
      for (const d of drafts) {
        const w = d.candidates.filter((c) => c.party !== "None of the Above").sort((a, b) => b.votes - a.votes)[0];
        if (w) won.set(w.party, (won.get(w.party) ?? 0) + 1);
      }
      const tallied = new Map(partyTally.map((t) => [t.party, t.won]));
      const fits = [...won].every(([p, n]) => n <= (tallied.get(p) ?? -1));
      const short = partyTally.reduce((a, t) => a + t.won, 0) - [...won.values()].reduce((a, b) => a + b, 0);
      if (fits && short === expected - drafts.length) {
        for (const d of drafts) if (!d.final) { d.final = true; d.status = `${d.status ?? ""}; consistent with ECI's completed party tally (${short} seat${short === 1 ? "" : "s"} unread)`.replace(/^; /, ""); }
      }
    }
    const first = drafts[0]!;
    // Last-known-good, seat by seat: a seat verified on an earlier run whose
    // archived page failed to fetch this time is carried over, not dropped.
    // The archive does not revise a snapshot, so the earlier reading stands.
    let carried: Seat[] = [];
    try {
      const prev = JSON.parse(await readFile(join(ROOT, folder, `${state}.json`), "utf8")) as StateResult;
      const have = new Set(drafts.map((d) => d.no));
      carried = prev.seats.filter((s) => !have.has(s.no));
      if (carried.length) problems.push(`${carried.length} seat${carried.length === 1 ? "" : "s"} not re-read this run, carried over from ${prev.fetchedAt.slice(0, 10)}: ${carried.map((s) => s.no).join(", ")}`);
    } catch { /* first run for this state */ }
    const seats: Seat[] = (drafts.sort((a, b) => a.no - b.no) as SeatDraft[]).map(({ final, updated, title, stateName, ...seat }) => ({
      ...seat,
      status: final ? (seat.status ?? "final") : `not final: ${seat.status ?? "count in progress"}`,
    }) as Seat).concat(carried).sort((a, b) => a.no - b.no);
    const result: StateResult & { stateName: string; abbreviations: Record<string, string>; problems: string[] } = {
      folder, house, state, stateName: first.stateName, label: first.title, date: monthOf(first.title),
      seats, expectedSeats: expected, partyTally, abbreviations: abbr, problems: problems.slice(0, 200), fetchedAt: new Date().toISOString(),
    };
    await mkdir(join(ROOT, folder), { recursive: true });
    await writeFile(join(ROOT, folder, `${state}.json`), JSON.stringify(result) + "\n", "utf8");
    entry.label = first.title; entry.date = monthOf(first.title);
    entry.states[state] = seats.length;
    const notFinal = seats.filter((s) => s.status?.startsWith("not final")).length;
    console.log(`  ${folder} ${state} ${first.stateName}: ${seats.length}${expected ? `/${expected}` : ""} seats, ${notFinal} not final, ${problems.length} problems`);
  }
  return { entry, errors };
}

/**
 * One folder per invocation in CI (ECI_FOLDERS), so the workflow can run
 * folders as separate jobs that each commit their own files. There is no
 * shared index file to conflict over: the site lists what is on disk.
 */
export async function run(): Promise<{ errors: string[]; wrote: number }> {
  const want = process.env.ECI_FOLDERS ? new Set(process.env.ECI_FOLDERS.split(",")) : null;
  const only = process.env.ECI_STATES ? new Set(process.env.ECI_STATES.split(",")) : undefined;
  const errors: string[] = [];
  let wrote = 0;
  for (const { folder, house } of FOLDERS) {
    if (want && !want.has(folder)) continue;
    console.log(`${folder}`);
    try {
      const { entry, errors: e } = await runFolder(folder, house, only);
      errors.push(...e);
      wrote += Object.keys(entry?.states ?? {}).length;
    } catch (e) {
      errors.push(`${folder}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (errors.length) console.log(`\n${errors.length} errors:\n  ${errors.slice(0, 40).join("\n  ")}`);
  return { errors, wrote };
}

// Only a run that wrote nothing at all fails; partial reads keep what they got.
if (isEntryPoint(import.meta.url)) run().then(({ wrote }) => process.exit(wrote === 0 ? 1 : 0));
