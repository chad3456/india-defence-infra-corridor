/**
 * MoSPI's "Youth in India 2022" (National Statistical Office, June 2022),
 * read from the copy committed at data/pdf/mospi-youth-in-india-2022.pdf.
 * No node imports: the reader turns the PDF's reconstructed grids into the
 * same shape as NFHS-6's state file, so the dark state map, its themes and
 * its women − men view work on it unchanged.
 *
 * The report compiles other agencies' figures — NFHS, UDISE+, AISHE, PLFS,
 * SRS — so every indicator names the statement and page it was read from and
 * the agency behind it. Only state-wise statements are read; "now" is the
 * latest round the statement prints and "prev" the one before it.
 *
 * ── How a row is accepted ─────────────────────────────────────────────────
 *
 * A row must carry exactly the statement's number of value columns, or fewer
 * only where the page says why ("Included in Andhra Pradesh" — a state that
 * did not yet exist), in which case the missing columns are the earliest.
 * Anything else — a split row, as the old Dadra and Nagar Haveli and Daman and
 * Diu rows are — is left out and listed, never right-aligned on a guess.
 * "(4.6)" is a small sample (25–49 cases), "*" suppressed, "NA" not available.
 */
import type { Nfhs6Indicator, Nfhs6Row, Nfhs6States, Theme } from "./nfhs6";

export const YOUTH_PDF = "data/pdf/mospi-youth-in-india-2022.pdf";
export const YOUTH_URL = "https://mospi.gov.in/sites/default/files/publication_reports/Youth_in_India_2022/Youth_in_India_2022.pdf";

/** One state-wise statement: where it is, how many value columns its rows carry, and whose figures they are. */
export interface YouthTable { id: string; statement: string; page: number; printed: number; values: number; agency: string }

export const YOUTH_TABLES: YouthTable[] = [
  { id: "s9", statement: "9", page: 104, printed: 90, values: 18, agency: "NFHS, Ministry of Health and Family Welfare" },
  { id: "s15", statement: "15", page: 116, printed: 102, values: 9, agency: "NFHS, Ministry of Health and Family Welfare" },
  { id: "s23", statement: "23", page: 122, printed: 108, values: 9, agency: "Sample Registration System, Registrar General of India" },
  { id: "s30b", statement: "30 (b)", page: 127, printed: 113, values: 12, agency: "Periodic Labour Force Survey 2017-18, NSO" },
  { id: "s30c", statement: "30 (c)", page: 128, printed: 114, values: 12, agency: "Periodic Labour Force Survey 2019-20, NSO" },
  { id: "s38", statement: "38", page: 139, printed: 125, values: 9, agency: "UDISE+, Department of School Education and Literacy" },
  { id: "s39", statement: "39", page: 140, printed: 126, values: 9, agency: "All India Survey on Higher Education, Department of Higher Education" },
  { id: "s41", statement: "41", page: 142, printed: 128, values: 6, agency: "All India Survey on Higher Education, Department of Higher Education" },
  { id: "s46a", statement: "46 (a)", page: 149, printed: 135, values: 9, agency: "Periodic Labour Force Survey 2017-18, NSO" },
  { id: "s46b", statement: "46 (b)", page: 150, printed: 136, values: 9, agency: "Periodic Labour Force Survey 2020-21, NSO" },
  { id: "s47a", statement: "47 (a)", page: 151, printed: 137, values: 9, agency: "Periodic Labour Force Survey 2017-18, NSO" },
  { id: "s47b", statement: "47 (b)", page: 152, printed: 138, values: 9, agency: "Periodic Labour Force Survey 2020-21, NSO" },
];

/** Where an indicator's values sit: a table and its 0-based value-column indices. */
interface At { table: string; total: number; urban?: number; rural?: number }
export interface YouthIndicatorSpec {
  n: number; label: string; unit: string; section: string;
  now: At & { round: string }; prev?: { table: string; col: number; round: string };
  note?: string;
}

// Value-column layouts, read off each page's header:
// s9   NFHS-3 W(U,R,T) M(U,R,T) · NFHS-4 W M · NFHS-5 W M      → 18
// s15  per round: had a live birth, pregnant with first, begun  → 9
// s23  2011, 2015, 2019 × ages 15-19, 20-24, 25-29             → 9
// s30  Rural, Urban, R+U × not literate, ≤ primary, middle, secondary+ → 12
// s38/s39  2011-12, 2015-16, latest × boys/male, girls/female, total → 9
// s41  2011-12, 2015-16, 2016-17, 2017-18, 2018-19, 2019-20     → 6
// s46/s47  Rural, Urban, R+U × male, female, person             → 9
const M = "Marriage and childbearing", E = "Education", P = "Primary and basic schooling", W = "Work", H = "Health";
export const YOUTH_INDICATORS: YouthIndicatorSpec[] = [
  { n: 1, label: "Women age 18-29 first married by exact age 18", unit: "%", section: M, now: { table: "s9", urban: 12, rural: 13, total: 14, round: "NFHS-5, 2019–21" }, prev: { table: "s9", col: 8, round: "NFHS-4, 2015–16" } },
  { n: 2, label: "Men age 21-29 first married by exact age 21", unit: "%", section: M, now: { table: "s9", urban: 15, rural: 16, total: 17, round: "NFHS-5, 2019–21" }, prev: { table: "s9", col: 11, round: "NFHS-4, 2015–16" } },
  { n: 3, label: "Women age 15-19 who have begun childbearing", unit: "%", section: M, now: { table: "s15", total: 8, round: "NFHS-5, 2019–21" }, prev: { table: "s15", col: 5, round: "NFHS-4, 2015–16" } },
  { n: 4, label: "Gross enrolment ratio, higher secondary (XI-XII) · Girls", unit: "%", section: E, now: { table: "s38", total: 7, round: "2020–21" }, prev: { table: "s38", col: 4, round: "2015–16" }, note: "A gross ratio: enrolment of any age over the population of the official age, so it can exceed 100." },
  { n: 5, label: "Gross enrolment ratio, higher secondary (XI-XII) · Boys", unit: "%", section: E, now: { table: "s38", total: 6, round: "2020–21" }, prev: { table: "s38", col: 3, round: "2015–16" } },
  { n: 6, label: "Gross enrolment ratio, higher secondary (XI-XII) · Total", unit: "%", section: E, now: { table: "s38", total: 8, round: "2020–21" }, prev: { table: "s38", col: 5, round: "2015–16" } },
  { n: 7, label: "Gross enrolment ratio, higher education (age 18-23) · Female", unit: "%", section: E, now: { table: "s39", total: 7, round: "2019–20" }, prev: { table: "s39", col: 4, round: "2015–16" } },
  { n: 8, label: "Gross enrolment ratio, higher education (age 18-23) · Male", unit: "%", section: E, now: { table: "s39", total: 6, round: "2019–20" }, prev: { table: "s39", col: 3, round: "2015–16" } },
  { n: 9, label: "Gross enrolment ratio, higher education (age 18-23) · Total", unit: "%", section: E, now: { table: "s39", total: 8, round: "2019–20" }, prev: { table: "s39", col: 5, round: "2015–16" } },
  { n: 10, label: "Gender parity index, higher education (age 18-23)", unit: "index", section: E, now: { table: "s41", total: 5, round: "2019–20" }, prev: { table: "s41", col: 1, round: "2015–16" }, note: "Female GER over male GER: above 1 means more women than men enrolled, relative to population." },
  { n: 11, label: "Persons age 15-29 educated to secondary or above", unit: "%", section: E, now: { table: "s30c", rural: 3, urban: 7, total: 11, round: "PLFS 2019–20" }, prev: { table: "s30b", col: 11, round: "PLFS 2017–18" }, note: "The statement's heading says 2020-21; its source note and the report's contents say PLFS 2019-20, which this follows." },
  { n: 12, label: "Persons age 15-29 who are not literate", unit: "%", section: P, now: { table: "s30c", rural: 0, urban: 4, total: 8, round: "PLFS 2019–20" }, prev: { table: "s30b", col: 8, round: "PLFS 2017–18" }, note: "The statement's heading says 2020-21; its source note and the report's contents say PLFS 2019-20, which this follows." },
  { n: 13, label: "Persons age 15-29 literate, schooled up to primary only", unit: "%", section: P, now: { table: "s30c", rural: 1, urban: 5, total: 9, round: "PLFS 2019–20" }, prev: { table: "s30b", col: 9, round: "PLFS 2017–18" }, note: "The statement's heading says 2020-21; its source note and the report's contents say PLFS 2019-20, which this follows." },
  { n: 14, label: "Persons age 15-29 schooled up to middle (VIII)", unit: "%", section: P, now: { table: "s30c", rural: 2, urban: 6, total: 10, round: "PLFS 2019–20" }, prev: { table: "s30b", col: 10, round: "PLFS 2017–18" }, note: "The statement's heading says 2020-21; its source note and the report's contents say PLFS 2019-20, which this follows." },
  { n: 15, label: "Labour force participation rate, age 15-29 · Female", unit: "%", section: W, now: { table: "s46b", rural: 1, urban: 4, total: 7, round: "PLFS 2020–21" }, prev: { table: "s46a", col: 7, round: "PLFS 2017–18" }, note: 'PLFS samples few households in the smallest UTs, and the report prints their rows without a small-sample mark: Ladakh\'s 2020-21 row gives men a 3.3% rural participation rate against 66.4% urban. Read Ladakh and Lakshadweep as indicative at best.' },
  { n: 16, label: "Labour force participation rate, age 15-29 · Male", unit: "%", section: W, now: { table: "s46b", rural: 0, urban: 3, total: 6, round: "PLFS 2020–21" }, prev: { table: "s46a", col: 6, round: "PLFS 2017–18" }, note: 'PLFS samples few households in the smallest UTs, and the report prints their rows without a small-sample mark: Ladakh\'s 2020-21 row gives men a 3.3% rural participation rate against 66.4% urban. Read Ladakh and Lakshadweep as indicative at best.' },
  { n: 17, label: "Labour force participation rate, age 15-29 · Persons", unit: "%", section: W, now: { table: "s46b", rural: 2, urban: 5, total: 8, round: "PLFS 2020–21" }, prev: { table: "s46a", col: 8, round: "PLFS 2017–18" }, note: 'PLFS samples few households in the smallest UTs, and the report prints their rows without a small-sample mark: Ladakh\'s 2020-21 row gives men a 3.3% rural participation rate against 66.4% urban. Read Ladakh and Lakshadweep as indicative at best.' },
  { n: 18, label: "Unemployment rate, age 15-29 · Female", unit: "%", section: W, now: { table: "s47b", rural: 1, urban: 4, total: 7, round: "PLFS 2020–21" }, prev: { table: "s47a", col: 7, round: "PLFS 2017–18" }, note: 'Share of the labour force without work, so a small female labour force can give a high, unstable rate. PLFS samples few households in the smallest UTs, and the report prints their rows without a small-sample mark: Ladakh\'s 2020-21 row gives men a 3.3% rural participation rate against 66.4% urban. Read Ladakh and Lakshadweep as indicative at best.' },
  { n: 19, label: "Unemployment rate, age 15-29 · Male", unit: "%", section: W, now: { table: "s47b", rural: 0, urban: 3, total: 6, round: "PLFS 2020–21" }, prev: { table: "s47a", col: 6, round: "PLFS 2017–18" }, note: 'PLFS samples few households in the smallest UTs, and the report prints their rows without a small-sample mark: Ladakh\'s 2020-21 row gives men a 3.3% rural participation rate against 66.4% urban. Read Ladakh and Lakshadweep as indicative at best.' },
  { n: 20, label: "Unemployment rate, age 15-29 · Persons", unit: "%", section: W, now: { table: "s47b", rural: 2, urban: 5, total: 8, round: "PLFS 2020–21" }, prev: { table: "s47a", col: 8, round: "PLFS 2017–18" }, note: 'PLFS samples few households in the smallest UTs, and the report prints their rows without a small-sample mark: Ladakh\'s 2020-21 row gives men a 3.3% rural participation rate against 66.4% urban. Read Ladakh and Lakshadweep as indicative at best.' },
  { n: 21, label: "Death rate, age 15-19", unit: "per 1,000", section: H, now: { table: "s23", total: 6, round: "SRS 2019" }, prev: { table: "s23", col: 3, round: "SRS 2015" }, note: "Sample Registration System, bigger states only." },
  { n: 22, label: "Death rate, age 20-24", unit: "per 1,000", section: H, now: { table: "s23", total: 7, round: "SRS 2019" }, prev: { table: "s23", col: 4, round: "SRS 2015" } },
  { n: 23, label: "Death rate, age 25-29", unit: "per 1,000", section: H, now: { table: "s23", total: 8, round: "SRS 2019" }, prev: { table: "s23", col: 5, round: "SRS 2015" } },
];

export const YOUTH_PAIRS: ReadonlyArray<readonly [number, number, string]> = [
  [4, 5, "GER, higher secondary"],
  [7, 8, "GER, higher education"],
  [15, 16, "Labour force participation"],
  [18, 19, "Unemployment rate"],
];

export const YOUTH_THEMES: Theme[] = [
  { id: "marriage", name: "Marriage and childbearing", blurb: "Early marriage and teenage childbearing, from NFHS as the report reprints it.", ns: [1, 2, 3], lead: [1, 2, 3] },
  { id: "education", name: "Education", blurb: "Enrolment in higher secondary school and higher education, gender parity, and how far 15–29-year-olds studied.", ns: range(4, 11), lead: [6, 9, 10, 11] },
  { id: "early", name: "Primary and basic schooling", blurb: "Young people who are not literate or stopped at primary or middle school. The report has no state-wise primary enrolment.", ns: [12, 13, 14], lead: [12, 13, 14] },
  { id: "health", name: "Health", blurb: "Death rates of 15–29-year-olds by age, Sample Registration System, bigger states only.", ns: [21, 22, 23], lead: [21, 22, 23] },
  { id: "work", name: "Work", blurb: "Labour force participation and unemployment of 15–29-year-olds, usual status.", ns: range(15, 20), lead: [15, 16, 18, 19] },
  { id: "sex", name: "Women and men", blurb: "Every indicator the report gives separately for women and men.", ns: YOUTH_PAIRS.flatMap(([w, m]) => [w, m]), lead: [4, 5, 15, 16] },
];

function range(a: number, b: number) { return Array.from({ length: b - a + 1 }, (_, i) => a + i); }

/* ── Reading a statement's rows ────────────────────────────────────────── */

type Val = { v: number | null; mark: "" | "s" | "x" | "n" };
const NUMERIC = /^\(?-?\d+(?:\.\d+)?\)?$|^\*$|^NA$/i;

export function parseValue(t: string): Val {
  const s = t.trim();
  if (s === "*") return { v: null, mark: "x" };
  if (/^NA$/i.test(s)) return { v: null, mark: "n" };
  const v = Number(s.replace(/[()]/g, ""));
  return Number.isFinite(v) ? { v, mark: /^\(.*\)$/.test(s) ? "s" : "" } : { v: null, mark: "n" };
}

/** A geography's name as printed, reduced so tables that spell it differently merge. */
export const geoKey = (name: string) => name.toLowerCase().replace(/&/g, "and").replace(/\bnct of\b|\bthe\b/g, "").replace(/[^a-z]/g, "");

/**
 * Names the page wraps over three lines, so that only the middle line shares the
 * row. Which neighbouring line belongs to which row is not decidable from position
 * alone, so the fragment is named here instead.
 */
const WRAPPED: Record<string, string> = { "Haveli & Daman": "Dadra and Nagar Haveli and Daman and Diu" };

export interface ReadTable { rows: Map<string, { name: string; values: Val[] }>; problems: string[] }

/** Data rows of one statement's grid, by geography. */
export function readRows(grid: string[][], table: YouthTable): ReadTable {
  const rows = new Map<string, { name: string; values: Val[] }>();
  const problems: string[] = [];
  const textOnly = (r: string[] | undefined) => !!r && r.length === 1 && !NUMERIC.test(r[0]!.trim()) && !/^\d/.test(r[0]!.trim());
  for (let i = 0; i < grid.length; i++) {
    const r = grid[i]!.map((c) => c.trim());
    let name: string, rest: string[];
    if (/^(?:All )?India$/i.test(r[0]!)) { name = "India"; rest = r.slice(1); }
    else if (/^\d{1,2}$/.test(r[0]!) && r.length > 1) {
      if (NUMERIC.test(r[1]!)) {
        // The name wraps around the number's line: "Andaman and" / "1 │ …" / "Nicobar Islands".
        const before = textOnly(grid[i - 1]) && !/Included in/i.test(grid[i - 1]![0]!) ? grid[i - 1]![0]!.trim() : "";
        const after = textOnly(grid[i + 1]) ? grid[i + 1]![0]!.trim() : "";
        name = `${before} ${after}`.trim();
        rest = r.slice(1);
      } else { name = WRAPPED[r[1]!] ?? r[1]!; rest = r.slice(2); }
    } else continue;
    if (!name) { problems.push(`${table.id} row ${r[0]}: no name`); continue; }
    // "Included in Andhra Pradesh" sits in the row, or wraps onto the line just above it.
    const explained = rest.some((c) => /Included in/i.test(c)) || (grid[i - 1] ?? []).some((c) => /Included in/i.test(c));
    const vals = rest.filter((c) => !/Included in/i.test(c));
    if (!vals.every((c) => NUMERIC.test(c))) { problems.push(`${table.id} ${name}: unreadable cells (${vals.filter((c) => !NUMERIC.test(c)).join(", ").slice(0, 60)})`); continue; }
    let values = vals.map(parseValue);
    if (values.length !== table.values) {
      if (explained && values.length < table.values) values = [...Array.from({ length: table.values - values.length }, (): Val => ({ v: null, mark: "n" })), ...values];
      else { problems.push(`${table.id} ${name}: ${values.length} values, expected ${table.values} — left out`); continue; }
    }
    const k = geoKey(name);
    const seen = rows.get(k);
    if (seen) {
      if (seen.values.some((v, j) => v.v !== values[j]!.v)) problems.push(`${table.id} ${name}: printed twice with different values — kept the first`);
      continue;
    }
    rows.set(k, { name, values });
  }
  return { rows, problems };
}

/** All statements' rows → the NFHS-6-shaped state file. */
export function buildYouth(grids: Record<string, string[][]>, builtAt: string): Nfhs6States & { pairs: typeof YOUTH_PAIRS; themes: Theme[]; tables: YouthTable[] } {
  const problems: string[] = [];
  const read: Record<string, ReadTable> = {};
  for (const t of YOUTH_TABLES) {
    read[t.id] = readRows(grids[t.id] ?? [], t);
    problems.push(...read[t.id]!.problems);
  }
  const names = new Map<string, string>();
  for (const t of YOUTH_TABLES) for (const [k, r] of read[t.id]!.rows) if (!names.has(k)) names.set(k, r.name);
  const geos: Record<string, Nfhs6Row[]> = {};
  for (const [k, name] of names) {
    const rows: Nfhs6Row[] = [];
    for (const ind of YOUTH_INDICATORS) {
      const now = read[ind.now.table]!.rows.get(k);
      const prev = ind.prev ? read[ind.prev.table]!.rows.get(k) : undefined;
      const at = (r: typeof now, c: number | undefined) => (r && c !== undefined ? r.values[c]! : undefined);
      const cells = [at(now, ind.now.urban), at(now, ind.now.rural), at(now, ind.now.total), at(prev, ind.prev?.col)];
      if (cells.every((c) => !c || c.v === null)) continue;
      const row: Nfhs6Row = [ind.n, cells[0]?.v ?? null, cells[1]?.v ?? null, cells[2]?.v ?? null, cells[3]?.v ?? null];
      const marks = cells.map((c) => (c?.mark ? c.mark : "-")).join("");
      if (marks !== "----") row.push(marks);
      rows.push(row);
    }
    if (rows.length) geos[name === "India" ? "India" : name] = rows;
  }
  const page = (id: string) => YOUTH_TABLES.find((t) => t.id === id)!;
  const indicators: Array<Nfhs6Indicator & { now: string; prev?: string; cite: string; note?: string }> = YOUTH_INDICATORS.map((i) => ({
    n: i.n, label: i.label, unit: i.unit, section: i.section, now: i.now.round, prev: i.prev?.round,
    cite: `Statement ${page(i.now.table).statement}, p. ${page(i.now.table).printed}${i.prev && i.prev.table !== i.now.table ? `; earlier round statement ${page(i.prev.table).statement}, p. ${page(i.prev.table).printed}` : ""} — ${page(i.now.table).agency}`,
    ...(i.note ? { note: i.note } : {}),
  }));
  return {
    source: { url: YOUTH_URL, title: "Youth in India 2022", released: "2022-06-29", publisher: "National Statistical Office, Ministry of Statistics and Programme Implementation" },
    fetchedAt: builtAt,
    pages: 185,
    indicators,
    geos,
    problems,
    pairs: YOUTH_PAIRS,
    themes: YOUTH_THEMES,
    tables: YOUTH_TABLES,
  };
}
