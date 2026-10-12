/**
 * The electorate of every assembly segment, from ECI's own statistical report.
 *
 * `npm run eci:electors`. Reads data/pdf/eci-ge2024-15-assembly-segment-electors.pdf
 * (ECI, General Election 2024, report 15, "Assembly Segment Wise Information
 * of Electors", fetched from the Internet Archive's copy of eci.gov.in by
 * scripts/etl/probe-eci-electors.ts) and writes data/elections/electors-ge2024.json.
 * Needs no network: the PDF is committed, so the figures stay pinned to it.
 *
 * Each segment row gives general electors (men, women, third gender), overseas
 * electors, service electors, the total, and votes polled on EVMs. A row is kept
 * only if it adds up — each group's parts sum to its total and the groups sum to
 * the electorate — and each Lok Sabha seat's subtotal row must equal the sum of
 * its segments. Votes polled here are EVM votes only (postal ballots are not
 * in this report), so turnout from it is EVM turnout and is labelled so.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { extractTables, parseIndianNumber } from "../lib/pdf-table";
import { isEntryPoint } from "../lib/entry";
import { atlasState } from "../../../lib/elections-atlas-shared";

const PDF = join(process.cwd(), "data", "pdf", "eci-ge2024-15-assembly-segment-electors.pdf");
const OUT = join(process.cwd(), "data", "elections", "electors-ge2024.json");
export const SOURCE = {
  publisher: "Election Commission of India",
  title: "General Election 2024 (18th Lok Sabha), Statistical Report 15: Assembly Segment Wise Information of Electors",
  url: "https://web.archive.org/web/20250819111609/https://www.eci.gov.in/eci-backend/public/all_files/GE-2024-statistical-report/15-Assembly-SegmentWise-Information-Electors.pdf",
  file: "data/pdf/eci-ge2024-15-assembly-segment-electors.pdf",
};

export interface Segment {
  ac: string;
  pc: string;
  page: number;
  /** General electors living in India: men, women, third gender. */
  m: number; f: number; tg: number;
  /** Overseas (NRI) electors, all genders. */
  nri: number;
  /** Service electors (armed forces and others posted away), men and women. */
  serviceM: number; serviceF: number;
  electors: number;
  /** Votes polled on EVMs, valid votes plus NOTA. Postal ballots are not included. */
  polledEvm: number;
}

export interface ElectorsFile {
  source: typeof SOURCE & { pages: number };
  /** ECI state code → segments, in the report's order. */
  states: Record<string, { name: string; segments: Segment[] }>;
  problems: string[];
}

const N = (s: string | undefined) => parseIndianNumber(s ?? "");

/** One table row → a segment, if it is one and it adds up. */
export function parseRow(cells: string[]): { name: string; v: number[] } | null {
  // A name occasionally arrives in more than one fragment; everything before the numbers is the name.
  const firstNum = cells.findIndex((c) => /^\d[\d,]*$/.test(c.trim()));
  if (firstNum < 0) return null;
  const v = cells.slice(firstNum).map(N);
  if (v.length !== 13 || v.some((x) => x == null)) return null;
  return { name: cells.slice(0, firstNum).join(" ").replace(/\s+/g, " ").trim(), v: v as number[] };
}

export function checkRow(v: number[]): string | null {
  const [m, f, tg, gen, nm, nf, ntg, nri, sm, sf, svc, total, polled] = v as [number, number, number, number, number, number, number, number, number, number, number, number, number];
  if (m + f + tg !== gen) return `general ${m}+${f}+${tg} ≠ ${gen}`;
  if (nm + nf + ntg !== nri) return `overseas ${nm}+${nf}+${ntg} ≠ ${nri}`;
  if (sm + sf !== svc) return `service ${sm}+${sf} ≠ ${svc}`;
  if (gen + nri + svc !== total) return `groups ${gen}+${nri}+${svc} ≠ ${total}`;
  if (polled > total) return `polled ${polled} > electors ${total}`;
  return null;
}

export async function build(): Promise<ElectorsFile> {
  const tables = await extractTables(new Uint8Array(await readFile(PDF)));
  const states: ElectorsFile["states"] = {};
  const problems: string[] = [];
  let stateName = "", code = "", pc = "";
  let pcRows: Segment[] = [];
  let spsPolled = 0;
  // Long names wrap. A segment's name can sit on a row alone with the numbers
  // following unnamed and the rest of the name after; a seat's name can do the
  // same in its heading ("PC:- BHIWANI-" / "MAHENDRAGARH") and again around its
  // subtotal row.
  let pendingName = "";
  let lastSeg: Segment | null = null;
  let pcOpen = false;          // heading ended in "-": the next lone text finishes it
  let subtotalNext = false;    // a lone "PC:- …" for the current seat: the unnamed numbers are its subtotal
  let afterSubtotal = false;   // the lone text after a wrapped subtotal finishes its label
  let pcClosed = false;        // the current seat's subtotal has been read
  const norm = (s: string) => s.toLowerCase().replace(/^nct of /, "").replace(/[^a-z]/g, "");

  const closeSubtotal = (page: number, label: string, v: number[]) => {
    const bad = checkRow(v);
    const sum = (k: keyof Segment) => pcRows.reduce((a, s) => a + (s[k] as number), 0);
    pcClosed = true;
    if (bad) problems.push(`page ${page}: ${label} subtotal does not add up (${bad})`);
    else if (sum("electors") !== v[11] || sum("polledEvm") + spsPolled !== v[12]) {
      problems.push(`page ${page}: ${label} segments sum to ${sum("electors")} electors / ${sum("polledEvm") + spsPolled} polled, subtotal says ${v[11]} / ${v[12]}`);
    }
  };

  for (const { page, rows } of tables) {
    for (const cells of rows) {
      const first = (cells[0] ?? "").trim();
      const st = /^State\s*:\s*(.+)$/i.exec(first);
      if (st && cells.length === 1) {
        stateName = st[1]!.trim();
        // The report lists the two halves of the merged UT separately, and shortens Andaman.
        const alias: Record<string, string> = { "andaman & nicobar": "Andaman and Nicobar Islands", "dadra & nagar haveli": "Dadra and Nagar Haveli and Daman and Diu", "daman & diu": "Dadra and Nagar Haveli and Daman and Diu" };
        const a = atlasState(alias[stateName.toLowerCase()] ?? stateName.replace(/^NCT OF /i, ""));
        code = a?.eci ?? "";
        if (!a) problems.push(`page ${page}: state "${stateName}" does not resolve`);
        continue;
      }
      const pcHead = /^PC\s*:-\s*(.+)$/i.exec(first);
      if (pcHead && cells.length === 1) {
        const label = pcHead[1]!.trim();
        // The current seat's own label again, alone (wrapped): its subtotal follows.
        // Only an exact match, or a wrap of it: "Jaipur" after "Jaipur Rural" is a new seat.
        if (pcRows.length && !pcClosed && (label === pc || (label.endsWith("-") && pc.startsWith(label)))) { subtotalNext = true; continue; }
        pc = label; pcRows = []; spsPolled = 0; pcOpen = label.endsWith("-"); pcClosed = false;
        continue;
      }
      const lone = cells.length === 1 && !/\d{3,}/.test(first) && !/^(Electors|Votes Polled|General|AC NAME|Other Than|Male|\+ NOTA|M$|ST\d|Election Commission|\d+ - )/i.test(first);
      if (lone) {
        if (pcOpen) { pc = `${pc}${first}`; pcOpen = false; continue; }
        if (afterSubtotal) { afterSubtotal = false; continue; }
        if (lastSeg && lastSeg.ac.endsWith("-")) { lastSeg.ac = `${lastSeg.ac}${first}`; lastSeg = null; continue; }
        pendingName = pendingName ? `${pendingName} ${first}` : first;
        continue;
      }
      const row = parseRow(cells);
      if (!row) continue;
      if (!row.name && subtotalNext) { closeSubtotal(page, `PC:- ${pc}`, row.v); subtotalNext = false; afterSubtotal = true; continue; }
      if (!row.name) row.name = pendingName;
      pendingName = "";
      afterSubtotal = false;
      if (/^SPS(?:[\s_]|$)/i.test(row.name) && row.v[11] === 0) { spsPolled += row.v[12]!; continue; }
      if (/^PC\s*:-/i.test(row.name)) { closeSubtotal(page, row.name, row.v); continue; }
      // The state's own total row carries the state's name and comes after its
      // last seat closes. A one-seat UT's only segment carries it too (Chandigarh,
      // Lakshadweep), but before its seat's subtotal.
      // Totals can spell the state out in full ("Andaman & Nicobar Islands",
      // "Dadra & Nagar Haveli and Daman & Diu"), so a row after the last seat
      // closes that begins with the state's name is its total.
      if ((pcClosed && norm(row.name).startsWith(norm(stateName))) || /total/i.test(row.name)) continue;
      const bad = checkRow(row.v);
      if (bad) { problems.push(`page ${page}: ${row.name} (${pc}) does not add up: ${bad}`); continue; }
      if (!code || !row.name) { if (!row.name) problems.push(`page ${page}: an unnamed row under ${pc}`); continue; }
      const [m, f, tg, , nm, nf, ntg, , sm, sf, , total, polled] = row.v as number[];
      const seg: Segment = { ac: row.name, pc, page, m: m!, f: f!, tg: tg!, nri: nm! + nf! + ntg!, serviceM: sm!, serviceF: sf!, electors: total!, polledEvm: polled! };
      pcRows.push(seg);
      lastSeg = seg;
      (states[code] ??= { name: stateName, segments: [] }).segments.push(seg);
    }
  }
  return { source: { ...SOURCE, pages: tables.length }, states, problems };
}

export async function run(): Promise<void> {
  const file = await build();
  const n = Object.values(file.states).reduce((a, s) => a + s.segments.length, 0);
  console.log(`${n} segments in ${Object.keys(file.states).length} states and UTs; ${file.problems.length} problems`);
  for (const p of file.problems.slice(0, 30)) console.log(`  ${p}`);
  // Refuse to write a file that lost most of the country: a layout change, not a few bad rows.
  if (n < 4000) throw new Error(`only ${n} segments read; expected about 4,120`);
  await writeFile(OUT, JSON.stringify(file) + "\n", "utf8");
  console.log(`wrote ${OUT}`);
}

if (isEntryPoint(import.meta.url)) run().catch((e) => { console.error(e); process.exit(1); });
