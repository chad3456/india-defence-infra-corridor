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
import { mkdir, writeFile } from "node:fs/promises";
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

export function parseHead(html: string): PageHead | null {
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  const h2 = /<h2[^>]*>[\s\S]*?Constituency\s*<span>\s*(\d+)\s*-\s*([\s\S]*?)<strong>\s*\(([^)]+)\)/i.exec(html);
  if (!h1 || !h2) return null;
  const r = /(?:Status of EVM Round|Status as on Round)[^<]*<span>\s*(\d+)\s*<\/span>\s*\/\s*(\d+)/i.exec(html);
  const u = /Last Updated at[^<]*?On\s*(\d{2})\/(\d{2})\/(\d{4})/i.exec(html);
  const title = decode(h1[1]!).replace(/^General Elections? to (?:Assembly|Parliamentary) Constituencies:\s*/i, "");
  return {
    title,
    no: Number(h2[1]),
    name: decode(h2[2]!),
    stateName: decode(h2[3]!),
    rounds: r ? [Number(r[1]), Number(r[2])] : undefined,
    updated: u ? `${u[3]}-${u[2]}-${u[1]}` : undefined,
  };
}

/** The table view: every candidate with EVM, postal and total votes. Null if the page fails its own arithmetic. */
export function parseTablePage(html: string): { candidates: Candidate[]; total: number; problem?: string } | null {
  const table = /<table[^>]*>[\s\S]*?Candidate[\s\S]*?Total Votes[\s\S]*?<\/table>/i.exec(html)?.[0];
  if (!table) return null;
  const body = /<tbody>([\s\S]*?)<\/tbody>/i.exec(table)?.[1] ?? "";
  const candidates: Candidate[] = [];
  for (const tr of body.split(/<tr[^>]*>/i).slice(1)) {
    const td = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]!);
    if (td.length < 6) continue;
    const evm = int(td[3]), postal = int(td[4]), votes = int(td[5]);
    if (votes == null) continue;
    candidates.push({ name: decode(td[1]!), party: decode(td[2]!), votes, ...(evm != null ? { evm } : {}), ...(postal != null ? { postal } : {}) });
  }
  const foot = /<tfoot>([\s\S]*?)<\/tfoot>/i.exec(table)?.[1] ?? "";
  const th = [...foot.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => m[1]!);
  const total = int(th[5]) ?? candidates.reduce((a, c) => a + c.votes, 0);
  if (candidates.length === 0) return null;
  const sum = candidates.reduce((a, c) => a + c.votes, 0);
  const rowBad = candidates.find((c) => c.evm != null && c.postal != null && c.evm + c.postal !== c.votes);
  const problem = sum !== total ? `candidates sum to ${sum}, page total ${total}`
    : rowBad ? `${rowBad.name}: ${rowBad.evm} + ${rowBad.postal} ≠ ${rowBad.votes}` : undefined;
  return { candidates, total, problem };
}

/** The candidate-card view: name, party, votes and won/lost. Null if the winner's margin does not reconcile. */
export function parseCardPage(html: string): { candidates: Candidate[]; declared: boolean; problem?: string } | null {
  const cards = html.split(/<div class=['"]cand-box['"]>/i).slice(1);
  const out: Array<Candidate & { status: string; margin: number | null }> = [];
  for (const c of cards) {
    const status = /<div class=['"]status\s+(\w+)['"]>\s*<div[^>]*>([\s\S]*?)<\/div>\s*<div>\s*([\d,]+)\s*<span>\s*\(\s*([+-]?)\s*([\d,]+)\s*\)/i.exec(c);
    const name = /<h5>([\s\S]*?)<\/h5>/i.exec(c)?.[1];
    const party = /<h6>([\s\S]*?)<\/h6>/i.exec(c)?.[1];
    if (!status || !name) continue;
    out.push({ name: decode(name), party: decode(party ?? ""), votes: int(status[3])!, status: decode(status[2]!).toLowerCase(), margin: int(status[5]) });
  }
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
export function parsePartyPage(html: string): { tally: Array<{ party: string; abbr: string; won: number; leading: number }>; seats: number | null } | null {
  const seats = /\(Total (?:AC|PC)\s*:\s*(\d+)\)/i.exec(html);
  const tally: Array<{ party: string; abbr: string; won: number; leading: number }> = [];
  const table = /Party Wise Results[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i.exec(html)?.[1] ?? "";
  for (const tr of table.split(/<tr[^>]*>/i).slice(1)) {
    const td = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => decode(m[1]!));
    if (td.length < 4 || /^total$/i.test(td[0]!)) continue;
    const m = /^(.*?)\s+-\s+([^-]+)$/.exec(td[0]!);
    const won = int(td[1]), leading = int(td[2]);
    if (won == null) continue;
    tally.push({ party: m ? m[1]!.trim() : td[0]!, abbr: m ? m[2]!.trim() : "", won, leading: leading ?? 0 });
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
    const key = page.replace(/^constituencywise/i, "Constituencywise").replace(/^candidateswise-/i, "candidateswise-");
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

interface SeatDraft extends Seat { final: boolean; updated?: string; title: string; stateName: string }

async function readSeat(pages: Map<string, Array<{ ts: string; original: string }>>, state: string, no: string, problems: string[]): Promise<SeatDraft | null> {
  const table = pages.get(`Constituencywise${state}${no}.htm`) ?? [];
  const cards = pages.get(`candidateswise-${state}${no}.htm`) ?? [];
  // Newest table snapshot that passes its own arithmetic; at most three tries.
  let fallback: SeatDraft | null = null;
  for (const snap of table.slice(0, 3)) {
    const html = await snapshot(snap.ts, snap.original);
    if (!html) continue;
    const head = parseHead(html), t = parseTablePage(html);
    if (!head || !t) continue;
    if (t.problem) { problems.push(`${state}${no} table ${snap.ts}: ${t.problem}`); continue; }
    const final = head.rounds ? head.rounds[0] === head.rounds[1] && head.rounds[1] > 0 : false;
    const seat: SeatDraft = { no: head.no, name: head.name, candidates: t.candidates, url: `https://web.archive.org/web/${snap.ts}/${snap.original}`, snapshot: snap.ts, status: head.rounds ? `EVM round ${head.rounds[0]}/${head.rounds[1]}` : head.updated ? `updated ${head.updated}` : undefined, final, updated: head.updated, title: head.title, stateName: head.stateName };
    if (final || !head.rounds) return seat; // no round line: finality is decided from the update stamp later
    fallback = seat;
    break;
  }
  for (const snap of cards.slice(0, 3)) {
    const html = await snapshot(snap.ts, snap.original);
    if (!html) continue;
    const head = parseHead(html), c = parseCardPage(html);
    if (!head || !c) continue;
    if (c.problem) { problems.push(`${state}${no} cards ${snap.ts}: ${c.problem}`); continue; }
    if (!c.declared && fallback) return fallback;
    return { no: head.no, name: head.name, candidates: c.candidates, url: `https://web.archive.org/web/${snap.ts}/${snap.original}`, snapshot: snap.ts, status: c.declared ? "won declared" : head.rounds ? `round ${head.rounds[0]}/${head.rounds[1]}` : "in progress", final: c.declared, updated: head.updated, title: head.title, stateName: head.stateName };
  }
  return fallback;
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
    const m = /^(?:Constituencywise|candidateswise-)([SU]\d{2})(\d+)\.htm$/.exec(key);
    if (m && (!only || only.has(m[1]!))) byState.set(m[1]!, (byState.get(m[1]!) ?? new Set()).add(m[2]!));
  }
  // ECI's seat numbers run 1..N; the state code is the first three characters
  // of the page id, and the seat number the rest. Codes are always [SU] + 2 digits.
  const entry: ElectionIndexEntry = { folder, house, label: "", date: "", states: {} };
  for (const [state, seatNos] of [...byState.entries()].sort()) {
    const problems: string[] = [];
    const drafts: SeatDraft[] = [];
    const nos = [...seatNos].sort((a, b) => Number(a) - Number(b));
    await pool(nos, 4, async (no) => {
      const s = await readSeat(pages, state, no, problems);
      if (s) drafts.push(s);
      else problems.push(`${state}${no}: no archived page passed its checks`);
    });
    if (drafts.length === 0) { errors.push(`${folder} ${state}: no seats read`); continue; }
    // Counting day is the earliest update stamp in the state; a page stamped
    // on a later day was saved after counting closed.
    const days = drafts.map((d) => d.updated).filter((d): d is string => !!d).sort();
    const countingDay = days[0];
    for (const d of drafts) if (!d.final && d.updated && countingDay && d.updated > countingDay) d.final = true;

    // ECI's own tally and house size, from the party-wise page's newest snapshot.
    let partyTally: StateResult["partyTally"]; let expected: number | undefined; let abbr: Record<string, string> = {};
    const party = pages.get(`partywiseresult-${state}.htm`)?.[0];
    if (party) {
      const html = await snapshot(party.ts, party.original);
      const p = html ? parsePartyPage(html) : null;
      if (p) {
        expected = p.seats ?? undefined;
        abbr = Object.fromEntries(p.tally.filter((t) => t.abbr).map((t) => [t.party, t.abbr]));
        if (p.tally.every((t) => t.leading === 0)) partyTally = p.tally.map((t) => ({ party: t.party, won: t.won }));
      }
    }
    const first = drafts[0]!;
    const seats: Seat[] = drafts.sort((a, b) => a.no - b.no).map(({ final, updated, title, stateName, ...seat }) => ({
      ...seat,
      status: final ? (seat.status ?? "final") : `not final: ${seat.status ?? "count in progress"}`,
    }));
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
