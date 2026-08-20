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
  if (failures.length) {
    console.error(`${failures.length} PDF test(s) failed.`);
    process.exit(1);
  }
  console.log("All PDF tests passed.");
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
