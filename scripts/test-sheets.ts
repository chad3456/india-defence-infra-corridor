/**
 * Tests for reading Economic Survey workbook tables.
 *
 * The fixtures are not invented. `survey-sheets.json` holds the cells the
 * workbook probe recorded from seven real sheets, copied verbatim. That matters
 * because the last time this project tested a table parser against a layout
 * assumed rather than observed, the fixture agreed with the bug and a broken
 * connector looked tested — incident counts reached the site as civilian
 * deaths.
 *
 * Three failures are pinned here, all of them found in production data:
 *
 *  1. Period labels. "FY19" is how these workbooks write a year, and the parser
 *     accepted only "2019" and "2019-20". Forty-two sheets holding perfectly
 *     good year-indexed tables reported zero usable rows for that reason.
 *  2. Stacked tables. Chart IX.21 carries two tables under one sheet name, both
 *     covering 2014 and 2025, and reading the sheet whole produced duplicate
 *     periods that took four unrelated series down with them.
 *  3. Part-year rows. "FY24 (Apr-Oct)" sits directly under "FY24". Stripping the
 *     qualifier duplicates the year; keeping the row publishes seven months as
 *     twelve. Both are wrong and both are refused.
 */
import { readFileSync } from "node:fs";
import {
  parsePeriod,
  isPartialPeriod,
  parseCellNumber,
  blocksOf,
  looksLikeYear,
} from "./etl/lib/sheet-table";
import { EXTRACTIONS } from "./etl/connectors/econ-survey";
import { INDIA_SERIES } from "../lib/india-catalogue";

const SHEETS = JSON.parse(
  readFileSync("scripts/__fixtures__/survey-sheets.json", "utf8"),
) as Record<string, string[][]>;

const failures: string[] = [];
function check(ok: boolean | undefined, label: string, detail = "") {
  const pass = ok === true;
  console.log(`  ${pass ? "pass" : "FAIL"}  ${label}${pass || !detail ? "" : ` — ${detail}`}`);
  if (!pass) failures.push(label);
}

console.log("Period labels");
{
  const cases: Array<[string, string | null]> = [
    ["2014", "2014"],
    ["2025*", "2025"],
    ["FY19", "FY2018-19"],
    ["FY 19", "FY2018-19"],
    ["FY25", "FY2024-25"],
    ["2019-20", "FY2019-20"],
    ["2009–10", "FY2009-10"], // en-dash, as the workbooks print it
    ["FY2019-20", "FY2019-20"],
    // Refusals.
    ["FY25 (Upto Sep)", null],
    ["FY24 (Apr-Oct)", null],
    ["Source: Department of Telecommunications.", null],
    ["", null],
  ];
  for (const [input, want] of cases) {
    const got = parsePeriod(input);
    check(got === want, `${JSON.stringify(input)} -> ${want}`, `got ${got}`);
  }
  // The one that would shift every fiscal series by a year if reversed.
  check(parsePeriod("FY19") === "FY2018-19", "FY19 is the year the fiscal year ends in");
  check(isPartialPeriod("FY24 (Apr-Oct)") && !isPartialPeriod("FY24"), "part-years are identified");
  check(!looksLikeYear("FY24 (Apr-Oct)"), "a part-year is not a usable row");
}

console.log("");
console.log("Numbers");
{
  check(parseCellNumber("1,183.75") === 1183.75, "Indian digit grouping");
  check(parseCellNumber("-") === null, "a dash is missing, not zero");
  check(parseCellNumber("") === null, "an empty cell is missing, not zero");
  check(parseCellNumber("(2.3)") === -2.3, "accounting parentheses are negative");
}

console.log("");
console.log("Stacked tables");
{
  const rows = SHEETS["tabchart9::Chart IX.21"];
  check(Boolean(rows), "the IX.21 fixture is present");
  const blocks = blocksOf(rows ?? []);
  check(blocks.length === 2, "IX.21 splits into two blocks", `${blocks.length}`);
  check(
    /revenue realization/i.test(blocks[0]?.header.join(" ") ?? ""),
    "the first block is revenue per GB",
  );
  check(
    /data consumption/i.test(blocks[1]?.header.join(" ") ?? ""),
    "the second block is data consumed",
  );
  check(
    blocks.every((b) => b.yearRows.length === 2),
    "neither block sees the other's rows",
  );
}

console.log("");
console.log("Units rows are not headers");
{
  // "| (Crore) | (Crore)" satisfies every other test for a header, and treating
  // it as one severed the airways table from its own data.
  const blocks = blocksOf(SHEETS["tabchart10::Chart VIII.12"] ?? []);
  check(blocks.length === 1, "VIII.12 is one block", `${blocks.length}`);
  check(
    /Financial Year/i.test(blocks[0]?.header.join(" ") ?? ""),
    "the header is the row naming the period column",
  );
  check(
    (blocks[0]?.unitRow ?? []).filter(Boolean).join(" ") === "(Crore) (Crore)",
    "the units row is kept separately, for the citation",
  );
  // Six, not eight: the sheet lists eight period-looking rows, and the two
  // part-years are refused before they ever reach a block.
  check(
    (blocks[0]?.yearRows.length ?? 0) === 6,
    "the six full years stay with it",
    `${blocks[0]?.yearRows.length}`,
  );
  check(
    !(blocks[0]?.yearRows ?? []).some((r) => isPartialPeriod(r[0] ?? "")),
    "neither part-year row is in the block",
  );
}

console.log("");
console.log("Every extraction resolves against the recorded cells");
{
  const declared = new Set(INDIA_SERIES.map((s) => s.id));
  for (const e of EXTRACTIONS) {
    const rows = SHEETS[`tabchart${e.workbook}::${e.sheet}`];
    if (!rows) {
      check(false, `${e.seriesId}: fixture for tabchart${e.workbook}::${e.sheet}`);
      continue;
    }
    check(declared.has(e.seriesId), `${e.seriesId} is declared in the catalogue`);

    const hits = blocksOf(rows).filter((b) =>
      e.expectHeader.every((re) => re.test(b.header.join(" | "))),
    );
    check(hits.length === 1, `${e.seriesId}: matches exactly one block`, `${hits.length} matched`);
    if (hits.length !== 1) continue;

    const usable = (hits[0]?.yearRows ?? []).filter(
      (r) => !isPartialPeriod(r[0] ?? "") && parsePeriod(r[0] ?? "") !== null,
    );
    const periods = usable.map((r) => parsePeriod(r[0] ?? ""));
    check(
      new Set(periods).size === periods.length,
      `${e.seriesId}: no period appears twice`,
      periods.join(","),
    );
    check(
      usable.length >= (e.minPoints ?? 3),
      `${e.seriesId}: ${usable.length} usable row(s), floor ${e.minPoints ?? 3}`,
    );
    check(
      usable.every((r) => parseCellNumber(r[e.column] ?? "") !== null),
      `${e.seriesId}: every usable row has a value in column ${e.column}`,
    );
  }
}

console.log("");
console.log("The values themselves");
{
  // Spot values read straight off the recorded cells. If a scale or a column
  // index moves, these move with it and the test says so.
  const read = (key: string, expect: RegExp[], col: number, scale = 1) => {
    const b = blocksOf(SHEETS[key] ?? []).find((x) =>
      expect.every((re) => re.test(x.header.join(" | "))),
    );
    return (b?.yearRows ?? []).map((r) => ({
      period: parsePeriod(r[0] ?? ""),
      value: (() => {
        const n = parseCellNumber(r[col] ?? "");
        return n === null ? null : n * scale;
      })(),
    }));
  };

  const ev = read("tabchart8::Chart VIII.15", [/EV Registrations/i], 1, 1_000);
  check(
    ev.find((p) => p.period === "FY2023-24")?.value === 1_681_200,
    "EV registrations FY2023-24 read as 1,681,200 vehicles",
  );

  const air = read("tabchart10::Chart VIII.12", [/domestic terminals/i], 2, 10_000_000);
  check(
    air.filter((p) => p.period !== null).length === 6,
    "airways: six full years survive, the two part-years do not",
    `${air.filter((p) => p.period !== null).length}`,
  );
  check(
    air.find((p) => p.period === "FY2023-24")?.value === 307_000_000,
    "domestic terminal passengers FY2023-24 read as 30.7 crore",
  );

  const grain = read("tabchart6::Chart VI.4", [/foodgrains/i], 2);
  check(
    grain.find((p) => p.period === "FY2022-23")?.value === 330.3,
    "foodgrains FY2022-23 read as 330.3 million tonnes",
  );
}

console.log("");
if (failures.length) {
  console.error(`${failures.length} sheet test(s) failed.`);
  process.exit(1);
}
console.log("All sheet tests passed.");
