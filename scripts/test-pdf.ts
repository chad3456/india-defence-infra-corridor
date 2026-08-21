/**
 * PDF table-extraction tests.
 *
 * Separate from the security tests because reading a PDF needs top-level
 * await, and because this is its own concern: the extractor turns a bag of
 * positioned text fragments back into rows and columns, and every assumption
 * it makes about layout is somewhere a wrong number could enter.
 *
 * The end-to-end case runs against a committed fixture PDF rather than a mock,
 * so the pdfjs integration is exercised rather than described.
 */
import { readFileSync } from "node:fs";
import {
  fragmentsToRows,
  yearRows,
  parseIndianNumber,
  extractTables,
} from "./etl/lib/pdf-table";
import { readWorkbook, parseCellNumber, looksLikeYear } from "./etl/lib/sheet-table";
import { EXTRACTIONS } from "./etl/connectors/econ-survey";
import { INDIA_SERIES } from "../lib/india-catalogue";

const failures: string[] = [];
function check(ok: boolean | undefined, label: string) {
  const pass = ok === true;
  console.log(`  ${pass ? "pass" : "FAIL"}  ${label}`);
  if (!pass) failures.push(label);
}

async function main() {
  console.log("Indian number formats");
  // Digit grouping, footnote markers, and the difference between a missing
  // figure and a zero — the three things a naive parser gets wrong.
  check(parseIndianNumber("1,68,300") === 168300, "lakh grouping parses");
  check(parseIndianNumber("2,15,48,494") === 21548494, "crore grouping parses");
  check(parseIndianNumber("6.92") === 6.92, "decimals survive");
  check(parseIndianNumber("1,234*") === 1234, "a footnote marker is stripped");
  check(parseIndianNumber("-") === null, "a dash is missing, not zero");
  check(parseIndianNumber("N.A.") === null, "N.A. is missing, not zero");
  check(parseIndianNumber("") === null, "an empty cell is missing, not zero");
  check(parseIndianNumber("0") === 0, "but a real zero is kept");

  console.log("");
  console.log("Rebuilding rows from position");
  const rows = fragmentsToRows([
    { text: "2021-22", x: 60, y: 700 },
    { text: "1,024", x: 160, y: 700 },
    { text: "2", x: 190, y: 701.5 },
    { text: "2020-21", x: 60, y: 680 },
    { text: "998", x: 160, y: 680 },
  ]);
  check(rows.length === 2, `two rows out of five fragments (got ${rows.length})`);
  check(rows[0]?.[0] === "2021-22", "the top row comes first, despite PDF y growing upward");
  check(rows[0]?.length === 3, "a superscript joins its line rather than becoming a row");
  check(rows[1]?.[1] === "998", "cells are ordered left to right");

  check(
    yearRows([["Notes"], ["2019-20", "1"], ["Source: MoSPI"], ["2020", "2"]]).length === 2,
    "year rows are separated from headings and source lines",
  );
  check(yearRows([["2019-20*", "1"]]).length === 1, "a starred partial year still counts");

  console.log("");
  console.log("End to end, against a committed PDF");
  const data = new Uint8Array(readFileSync("scripts/__fixtures__/table.pdf"));
  const tables = await extractTables(data);
  const page = tables[0];
  check(tables.length === 1, `one page (got ${tables.length})`);
  check(page?.rows.length === 5, `five rows including the header (got ${page?.rows.length})`);
  check(page?.rows[0]?.[0] === "Year", "the header row is read");
  const row = page?.rows.find((r) => r[0] === "2021-22");
  check(
    parseIndianNumber(row?.[1] ?? "") === 1024723,
    `a real value comes back off the page (got ${row?.[1]})`,
  );
  check(
    yearRows(page?.rows ?? []).length === 4,
    `four data rows (got ${yearRows(page?.rows ?? []).length})`,
  );

  console.log("");
  console.log("Spreadsheets");
  // Real cells, so none of the layout reconstruction applies — but the number
  // formats and the missing-versus-zero rule must behave identically, or a
  // figure would mean different things depending on which file it came from.
  check(parseCellNumber("1,68,300") === 168300, "lakh grouping parses");
  check(parseCellNumber("₹ 2,15,48,494") === 21548494, "a currency symbol is stripped");
  check(parseCellNumber("(1,234)") === -1234, "accounting parentheses read as negative");
  check(parseCellNumber("—") === null, "an em-dash is missing, not zero");
  check(parseCellNumber("N.A.") === null, "N.A. is missing, not zero");
  check(parseCellNumber("0") === 0, "a real zero is kept");

  check(looksLikeYear("2019-20"), "an Indian fiscal year is a year");
  check(looksLikeYear("2019"), "a calendar year is a year");
  check(looksLikeYear("2019-2020"), "the four-digit fiscal form too");
  check(!looksLikeYear("Source: MHA"), "a source line is not");
  check(!looksLikeYear("Table 1.1"), "nor a table caption");

  const sheets = await readWorkbook(new Uint8Array(readFileSync("scripts/__fixtures__/table.xlsx")));
  const t = sheets[0];
  check(sheets.length === 1, `one sheet (got ${sheets.length})`);
  check(t?.sheet === "Table 1.1", `the sheet keeps its name (got ${t?.sheet})`);
  check(t?.yearRows.length === 4, `four year rows (got ${t?.yearRows.length})`);
  check(t?.header[1] === "LWE-affected districts", "the header row is identified");
  check(
    parseCellNumber(t?.yearRows[0]?.[1] ?? "") === 106,
    `a value comes back off the sheet (got ${t?.yearRows[0]?.[1]})`,
  );
  check(
    parseCellNumber(t?.yearRows[3]?.[3] ?? "") === null,
    "and a dash in the last row stays missing",
  );

  console.log("");
  console.log("Economic Survey extractions");
  // Sheet names repeat across workbooks with different contents — "Chart
  // VIII.16" is tourism in tabchart10 and a financial-year table in tabchart8.
  // Addressing a table by name alone would publish one under the other's
  // label, so every extraction is keyed on workbook plus sheet.
  const keys = EXTRACTIONS.map((e) => `${e.workbook}::${e.sheet}::${e.column}`);
  check(new Set(keys).size === keys.length, "no two extractions read the same cell range");
  check(
    EXTRACTIONS.every((e) => e.expectHeader.length >= 2),
    "every extraction checks at least two header patterns before reading",
  );
  const declared = new Set(INDIA_SERIES.map((s) => s.id));
  const undeclared = EXTRACTIONS.filter((e) => !declared.has(e.seriesId)).map((e) => e.seriesId);
  check(undeclared.length === 0, `every target series is declared (${undeclared.join(", ")})`);
  check(
    EXTRACTIONS.every((e) => Boolean(e.sourceId)),
    "every extraction cites a source",
  );
  // The two that share a sheet must read different columns, or one silently
  // overwrites the other with the same numbers.
  const vi4 = EXTRACTIONS.filter((e) => e.workbook === 6 && e.sheet === "Chart VI.4");
  check(
    vi4.length === 2 && vi4[0]?.column !== vi4[1]?.column,
    "two series off one sheet read different columns",
  );

  console.log("");
  if (failures.length) {
    console.error(`${failures.length} PDF test(s) failed.`);
    process.exit(1);
  }
  console.log("All PDF and spreadsheet tests passed.");
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
