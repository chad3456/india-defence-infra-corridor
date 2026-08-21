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
}

/** Matches "2019", "2019-20", "2019-2020", with an optional footnote star. */
const YEAR = /^(19|20)\d{2}(\s*[-–/]\s*\d{2,4})?\*?$/;

export function looksLikeYear(cell: string): boolean {
  return YEAR.test((cell ?? "").trim());
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
    if (!ws) return { sheet, rows: [], header: [], yearRows: [] };

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

    return { sheet, rows, header, yearRows };
  });
}

export async function readWorkbook(data: Uint8Array): Promise<SheetTable[]> {
  const xlsx = await import("xlsx");
  const wb = xlsx.read(data, { type: "array" });
  return tablesFrom(wb, xlsx);
}
