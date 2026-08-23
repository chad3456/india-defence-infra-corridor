/**
 * Reading tables out of a spreadsheet.
 *
 * The source probe found what nobody had looked for: the Economic Survey
 * publishes its statistical tables as twelve `.xlsx` files under
 * `indiabudget.gov.in/economicsurvey/doc/tabchart/`, and AMFI publishes twelve
 * monthly `.xls` reports. Everyone cites the Survey PDF; the spreadsheets sit
 * beside it.
 *
 * That matters more than it sounds. A spreadsheet has real cells. There is no
 * layout to reconstruct, no baseline tolerance, no guess about which fragment
 * belongs to which row — the three things that made the PDF and HTML paths
 * risky, and the thing that went wrong when a column layout was assumed and
 * incident counts were published as civilian deaths.
 *
 * So this is deliberately thin. It hands back the cells as they are, finds the
 * rows that start with a year, and parses Indian digit grouping. What it does
 * not do is decide what a column means: the header is reported for a person to
 * read, exactly as with the PDF path, and figures still reach the site only
 * through the curated file with a citation naming the workbook and sheet.
 */
import type { WorkBook } from "xlsx";

export interface SheetTable {
  /** Sheet name as the workbook stores it — part of any citation. */
  sheet: string;
  rows: string[][];
  /** First row that is not a data row, which is usually the header. */
  header: string[];
  /** Rows whose first cell reads as a year or an Indian fiscal year. */
  yearRows: string[][];
  /**
   * The sheet cut into blocks at each header row.
   *
   * Several Economic Survey sheets stack two tables under one sheet name.
   * Chart IX.21 carries revenue per GB and data consumed per subscriber one
   * after the other, both labelled "Year", and reading the sheet as a single
   * table produced two rows for 2014 and two for 2025 — which is how the
   * connector came to emit duplicate periods and take four healthy series down
   * with it. A block is the unit an extraction should actually address.
   */
  blocks: SheetBlock[];
}

export interface SheetBlock {
  /** Row index in the sheet where this block's header sits. */
  at: number;
  header: string[];
  /** The row directly under the header when it holds units rather than data. */
  unitRow: string[] | null;
  yearRows: string[][];
}

/**
 * Period labels, as Indian statistical workbooks actually write them.
 *
 * The first version of this accepted "2019", "2019-20" and "2019-2020" only.
 * The Economic Survey workbooks overwhelmingly use "FY19", and forty-two
 * sheets that plainly hold a year-indexed table reported zero usable rows for
 * that reason alone — the tables were readable all along and nothing could see
 * them. An en-dash is also common ("2009–10"), as is a two-year span
 * ("2004-06") for survey rounds.
 */
const BARE_YEAR = /^(19|20)\d{2}$/;
const YEAR_SPAN = /^((?:19|20)\d{2})\s*[-–—/]\s*(\d{2,4})$/;
const FY_SHORT = /^FY\s?(\d{2})$/i;
const FY_LONG = /^FY\s?((?:19|20)\d{2})(?:\s*[-–—/]\s*(\d{2,4}))?$/i;

/**
 * A label that names part of a period rather than the period.
 *
 * These are the dangerous rows. "FY24 (Apr-Oct)" sits directly beneath "FY24"
 * in the airways traffic sheet, and a parser that strips the qualifier would
 * emit two different values for the same year — the same duplicate-period
 * failure, arriving by a different route. A partial period is not a smaller
 * number for that year; it is a different measurement, and this project
 * publishes neither rather than guessing which.
 */
const PARTIAL = /\((?:[^)]*\b(?:upto|up to|apr|jan|jul|oct|till|to)\b[^)]*)\)/i;

/** Strip footnote markers and whitespace without touching the label itself. */
function tidy(cell: string): string {
  return (cell ?? "").replace(/[*†#]/g, "").replace(/\s+/g, " ").trim();
}

export function isPartialPeriod(cell: string): boolean {
  return PARTIAL.test(cell ?? "");
}

/**
 * Normalise a period label to the form this project stores, or null.
 *
 * Returns null for a partial period on purpose — see `PARTIAL`. Callers must
 * treat null as "skip this row", never as "year zero".
 */
export function parsePeriod(cell: string): string | null {
  const raw = cell ?? "";
  if (isPartialPeriod(raw)) return null;
  const t = tidy(raw.replace(/\([^)]*\)/g, ""));
  if (t === "") return null;

  if (BARE_YEAR.test(t)) return t;

  const span = YEAR_SPAN.exec(t);
  if (span?.[1] && span[2]) return `FY${span[1]}-${span[2].slice(-2).padStart(2, "0")}`;

  const long = FY_LONG.exec(t);
  if (long?.[1]) {
    const start = Number(long[1]);
    const end = long[2] ? long[2].slice(-2).padStart(2, "0") : String((start + 1) % 100).padStart(2, "0");
    return `FY${start}-${end}`;
  }

  const short = FY_SHORT.exec(t);
  if (short?.[1]) {
    // "FY19" is the year the Indian financial year ends in, so it spans
    // 2018-19. Getting this backwards would shift every series by a year.
    const endYY = Number(short[1]);
    const endYear = endYY >= 50 ? 1900 + endYY : 2000 + endYY;
    return `FY${endYear - 1}-${String(endYY).padStart(2, "0")}`;
  }
  return null;
}

export function looksLikeYear(cell: string): boolean {
  return parsePeriod(cell) !== null;
}

/**
 * Parse a number as Indian statistical publications write them.
 *
 * Shared behaviour with the PDF reader on purpose: lakh and crore grouping,
 * footnote markers stripped, and a dash or "N.A." returning null rather than
 * zero. A missing figure and a zero are different facts.
 */
export function parseCellNumber(cell: string): number | null {
  const cleaned = (cell ?? "").replace(/[,\s*†#₹]/g, "");
  if (cleaned === "" || /^[-–—]+$/.test(cleaned) || /^n\.?a\.?$/i.test(cleaned)) return null;
  // Parenthesised negatives, as accounting tables write them.
  const neg = /^\((.*)\)$/.exec(cleaned);
  const n = Number(neg ? `-${neg[1]}` : cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Read a workbook's sheets into plain string grids. */
export function tablesFrom(wb: WorkBook, xlsx: typeof import("xlsx")): SheetTable[] {
  return wb.SheetNames.map((sheet) => {
    const ws = wb.Sheets[sheet];
    if (!ws) return { sheet, rows: [], header: [], yearRows: [], blocks: [] };

    // `raw: false` gives the displayed text, which is what a citation should
    // quote — a cell showing "1,68,300" is stored as 168300 and formatted, and
    // the formatted form is what a reader checking the page will see.
    const grid = xlsx.utils.sheet_to_json<string[]>(ws, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });

    const rows = grid.map((r) => (r ?? []).map((c) => String(c ?? "").replace(/\s+/g, " ").trim()));
    const yearRows = rows.filter((r) => looksLikeYear(r[0] ?? ""));
    const header = rows.find((r) => !looksLikeYear(r[0] ?? "") && r.filter(Boolean).length >= 2) ?? [];

    return { sheet, rows, header, yearRows, blocks: blocksOf(rows) };
  });
}

/**
 * A row that titles a table rather than carrying data.
 *
 * `strict` additionally requires the row to name its own first column. That
 * distinction matters more than it looks: the units row of the airways traffic
 * sheet reads "| (Crore) | (Crore)", which satisfies every other test for a
 * header and, when treated as one, cut the real header off from its own data
 * and made the whole table invisible. Headers in these workbooks name the
 * period column — "Year", "Financial Year" — and units rows never do.
 *
 * A few sheets genuinely do start their header with an empty cell, so this is a
 * preference rather than a rule: `blocksOf` tries strict first and falls back.
 */
function isHeaderRow(row: string[], strict: boolean): boolean {
  if (looksLikeYear(row[0] ?? "")) return false;
  if (strict && !(row[0] ?? "").trim()) return false;
  return row.filter(Boolean).length >= 2;
}

/**
 * Cut a sheet into blocks, one per header row.
 *
 * A block runs from its header to the row before the next header, and keeps
 * only the year rows in between. A header with no year rows under it is
 * dropped: a source line or a footnote can satisfy the shape of a header and
 * would otherwise open an empty block that an extraction could match against.
 */
export function blocksOf(rows: string[][]): SheetBlock[] {
  const strict = cut(rows, true);
  return strict.length > 0 ? strict : cut(rows, false);
}

function cut(rows: string[][], strict: boolean): SheetBlock[] {
  const starts: number[] = [];
  rows.forEach((r, i) => {
    if (isHeaderRow(r, strict)) starts.push(i);
  });

  const blocks: SheetBlock[] = [];
  for (let k = 0; k < starts.length; k++) {
    const at = starts[k] ?? 0;
    const end = starts[k + 1] ?? rows.length;
    const body = rows.slice(at + 1, end);
    const yearRows = body.filter((r) => looksLikeYear(r[0] ?? ""));
    if (yearRows.length === 0) continue;
    // A unit row sits between header and data, names no period, and carries
    // something like "(Crore)". Kept separately so a citation can quote it.
    const first = body[0];
    const unitRow = first && !looksLikeYear(first[0] ?? "") && first.some(Boolean) ? first : null;
    blocks.push({ at, header: rows[at] ?? [], unitRow, yearRows });
  }
  return blocks;
}

export async function readWorkbook(data: Uint8Array): Promise<SheetTable[]> {
  const xlsx = await import("xlsx");
  const wb = xlsx.read(data, { type: "array" });
  return tablesFrom(wb, xlsx);
}
