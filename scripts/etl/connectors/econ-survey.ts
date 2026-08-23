/**
 * Economic Survey statistical workbooks.
 *
 * The Survey publishes the data behind its charts as twelve spreadsheets under
 * `indiabudget.gov.in/economicsurvey/doc/tabchart/`. Everyone cites the PDF;
 * these sit beside it and have real cells, which makes them the best source
 * this project has found for several series that exist nowhere else in
 * machine-readable form.
 *
 * ── The trap this connector is built around ──────────────────────────────
 *
 * Sheet names are reused across workbooks with entirely different contents.
 * "Chart VIII.16" is international tourist arrivals in tabchart10 and a
 * financial-year table in tabchart8. "Chart VIII.21" is patents filed in one
 * and state-wise services in another. A connector keyed on sheet name alone
 * would silently publish one under the other's label — the same failure that
 * put incident counts on a civilian-deaths chart.
 *
 * So every table is addressed by workbook AND sheet, and the header must match
 * a pattern before a single value is read. A sheet that does not match is
 * refused with its actual header reported, not relabelled.
 *
 * ── The second trap, found the hard way ──────────────────────────────────
 *
 * A sheet name does not mean a table. Chart IX.21 stacks two tables under one
 * name — revenue per GB, then data consumed per subscriber — both with a "Year"
 * column and both covering 2014 and 2025. Reading the sheet as one table
 * produced two rows for each year, validation rejected the series, and because
 * the write was a batch gate at the time it took four healthy series down with
 * it. So extractions address a *block*: the run of year rows under one header.
 *
 * Part-year rows are the same trap wearing a different hat. "FY24 (Apr-Oct)"
 * sits directly under "FY24" in the airways traffic sheet. A parser that strips
 * the qualifier emits two values for one year; one that keeps the row emits a
 * seven-month figure as if it were a year. Both are refused, upstream in
 * `parsePeriod`, and a duplicate reaching this connector is now a hard error
 * naming the period rather than something validation discovers later.
 *
 * ── What it will not do ──────────────────────────────────────────────────
 *
 * These are chart-backing tables, so most run to a handful of years. That is
 * published as it is: a five-point series is a five-point series, and padding
 * it or splicing it onto another source would be inventing history. Where a
 * table carries only its endpoints, the series carries only its endpoints and
 * says so — the registry draws anything under nine points as columns, so a
 * two-year comparison is never dressed up as a trend line.
 */
import type { Series, DataPoint } from "../../../lib/types";
import { INDIA_SERIES } from "../../../lib/india-catalogue";
import {
  readWorkbook,
  parseCellNumber,
  parsePeriod,
  isPartialPeriod,
  type SheetTable,
} from "../lib/sheet-table";

const BASE = "https://www.indiabudget.gov.in/economicsurvey/doc/tabchart";

/** One extraction: which workbook, which sheet, which block, which column. */
interface Extraction {
  workbook: number;
  sheet: string;
  /**
   * Every pattern must match the header of one block on that sheet.
   *
   * This is what distinguishes the two tables stacked inside Chart IX.21, so
   * the patterns have to be specific enough to pick exactly one of them. An
   * extraction matching more than one block is refused rather than guessed at.
   */
  expectHeader: RegExp[];
  seriesId: string;
  /** Column index within the row, counting the period column as 0. */
  column: number;
  /** Applied to every value — for tables published in lakh, crore or thousands. */
  scale?: number;
  /**
   * Points required before the series is published. Three by default.
   *
   * Lowered only where the Survey's own table carries fewer, and only with a
   * note on the series saying so. Two honest points beat a fabricated third.
   */
  minPoints?: number;
  /** Appended to the series notes — used where the workbook omits a unit. */
  extraNote?: string;
  sourceId: string;
}

/**
 * Verified against `data/live/workbook-probe.json`, which recorded the real
 * header and first data row of all 255 sheets. Nothing here is guessed.
 */
export const EXTRACTIONS: Extraction[] = [
  {
    workbook: 9,
    sheet: "Chart IX.21",
    // Two tables live on this sheet. "revenue realization" appears only in the
    // first; "data consumption" only in the second.
    expectHeader: [/year/i, /revenue realization/i, /per\s*GB/i],
    seriesId: "mobile-data-price-per-gb",
    column: 1,
    // The Survey's chart plots two years and no more.
    minPoints: 2,
    extraNote:
      "The Survey's table carries 2014 and 2025 only, so this is a two-point comparison rather than a path — the years in between are not published here and are not guessed at. The 2025 figure is as of September 2025.",
    sourceId: "econ-survey-tabchart",
  },
  {
    workbook: 10,
    sheet: "Chart VIII.20",
    expectHeader: [/financial year/i, /2G Data Usage/i, /Total Wireless Data Usage/i],
    seriesId: "data-per-subscriber",
    column: 5,
    extraNote:
      "The total column, across all network generations. FY25 is published only as an April-to-September part-year and is left out: a seven-month figure on an annual axis reads as a collapse that did not happen.",
    sourceId: "econ-survey-tabchart",
  },
  {
    workbook: 8,
    sheet: "Chart VIII.15",
    expectHeader: [/year/i, /EV Registrations/i, /Vahan/i],
    seriesId: "ev-registrations",
    column: 1,
    // The sheet gives no unit. Values run 173.58 in FY20 to 1,965.70 in FY25,
    // which is only readable as thousands of vehicles — millions would put
    // India's FY20 EV fleet at 173 million, and units would put it at 174
    // vehicles nationwide. The scale is stated on the series rather than
    // applied silently, because an unlabelled unit is exactly the kind of
    // assumption that has gone wrong on this project before.
    scale: 1_000,
    extraNote:
      "The workbook labels this column with no unit. The figures are read as thousands of vehicles, the only reading consistent with their magnitude — a hundred and seventy-four vehicles nationally in FY20 is not a number, and a hundred and seventy-four million is more than the whole vehicle fleet. Treat the level as the Survey's chart value rather than as a VAHAN extract.",
    sourceId: "econ-survey-tabchart",
  },
  {
    workbook: 10,
    sheet: "Chart VIII.12",
    expectHeader: [/financial year/i, /international terminals/i, /domestic terminals/i],
    seriesId: "domestic-air-passengers",
    column: 2,
    // Published in crore.
    scale: 10_000_000,
    extraNote:
      "Passengers handled at domestic terminals. The sheet also lists April-to-October part-years for FY24 and FY25; both are excluded, and the FY24 part-year in particular would otherwise contradict the full FY24 row directly above it.",
    sourceId: "econ-survey-tabchart",
  },
  {
    workbook: 8,
    sheet: "Chart VIII.23",
    expectHeader: [/year/i, /startups/i],
    seriesId: "startups-recognised",
    column: 1,
    // Published in lakh; stored as a count, because "0.05 lakh" on an axis is
    // unreadable and the conversion is exact.
    scale: 100_000,
    sourceId: "econ-survey-tabchart",
  },
  {
    workbook: 10,
    sheet: "Chart VIII.17",
    expectHeader: [/year/i, /domestic tourist visits/i],
    seriesId: "domestic-tourist-visits",
    column: 1,
    // Published in crore.
    scale: 10_000_000,
    sourceId: "econ-survey-tabchart",
  },
  {
    workbook: 6,
    sheet: "Chart VI.4",
    expectHeader: [/year/i, /horticulture/i, /foodgrains/i],
    seriesId: "foodgrains-production",
    column: 2,
    sourceId: "econ-survey-tabchart",
  },
  {
    workbook: 6,
    sheet: "Chart VI.4",
    expectHeader: [/year/i, /horticulture/i, /foodgrains/i],
    seriesId: "horticulture-production",
    column: 1,
    sourceId: "econ-survey-tabchart",
  },
];

export interface SurveyResult {
  series: Series[];
  errors: string[];
  /** Sheets read successfully, for the run log. */
  extracted: number;
}

function headerMatches(header: string[], expect: RegExp[]): boolean {
  const joined = header.join(" | ");
  return expect.every((re) => re.test(joined));
}

export async function runEconSurvey(
  opts: { dryRun?: boolean; onProgress?: (msg: string) => void } = {},
): Promise<SurveyResult> {
  const log = opts.onProgress ?? (() => {});
  const errors: string[] = [];
  const series: Series[] = [];
  let extracted = 0;

  if (opts.dryRun) {
    for (const e of EXTRACTIONS) log(`[dry-run] would read tabchart${e.workbook} :: ${e.sheet}`);
    return { series: [], errors: [], extracted: 0 };
  }

  const specById = new Map(INDIA_SERIES.map((s) => [s.id, s]));
  // One fetch per workbook however many extractions read from it.
  const books = [...new Set(EXTRACTIONS.map((e) => e.workbook))];
  const cache = new Map<number, SheetTable[]>();

  for (const n of books) {
    const url = `${BASE}/tabchart${n}.xlsx`;
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "BharatTracker/0.1 data-pipeline", accept: "*/*" },
        // These workbooks run to hundreds of kilobytes and tabchart9 has timed
        // out at forty-five seconds on a live run. A slow download is not a
        // reason to drop a source.
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) {
        errors.push(`tabchart${n}: HTTP ${res.status}`);
        continue;
      }
      cache.set(n, await readWorkbook(new Uint8Array(await res.arrayBuffer())));
      log(`  tabchart${n} opened — ${cache.get(n)?.length} sheets`);
    } catch (err) {
      errors.push(`tabchart${n}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  for (const e of EXTRACTIONS) {
    const spec = specById.get(e.seriesId);
    if (!spec) {
      errors.push(`${e.seriesId}: not declared in the India catalogue`);
      continue;
    }
    const sheets = cache.get(e.workbook);
    if (!sheets) continue; // the workbook failed; already reported

    const table = sheets.find((s) => s.sheet === e.sheet);
    if (!table) {
      errors.push(`${e.seriesId}: tabchart${e.workbook} has no sheet "${e.sheet}"`);
      continue;
    }

    // Match a block, not the sheet. Two stacked tables can both answer to the
    // sheet name, and only one of them holds the series being asked for.
    const hits = table.blocks.filter((b) => headerMatches(b.header, e.expectHeader));
    if (hits.length === 0) {
      errors.push(
        `${e.seriesId}: tabchart${e.workbook} :: "${e.sheet}" — no block matched. Headers present: ` +
          table.blocks.map((b) => `"${b.header.join(" | ")}"`).join(", "),
      );
      continue;
    }
    if (hits.length > 1) {
      // Ambiguity is refused rather than resolved by taking the first. Picking
      // silently between two tables is how one gets published under the other's
      // label, which is the failure this connector is built to prevent.
      errors.push(
        `${e.seriesId}: tabchart${e.workbook} :: "${e.sheet}" — ${hits.length} blocks matched; the pattern is not specific enough`,
      );
      continue;
    }
    const block = hits[0]!;

    const points: DataPoint[] = [];
    const seen = new Map<string, number>();
    let skippedPartial = 0;
    for (const row of block.yearRows) {
      const label = row[0] ?? "";
      if (isPartialPeriod(label)) {
        skippedPartial++;
        continue;
      }
      const period = parsePeriod(label);
      if (!period) continue;
      const raw = parseCellNumber(row[e.column] ?? "");
      const value = raw === null ? null : Math.round(raw * (e.scale ?? 1) * 1000) / 1000;
      const prior = seen.get(period);
      if (prior !== undefined) {
        // Reached only if a block genuinely repeats a period. Reported here,
        // with the values, rather than left for validation to find as a bare
        // "duplicate period" with nothing to act on.
        errors.push(
          `${e.seriesId}: tabchart${e.workbook} :: "${e.sheet}" repeats ${period} ` +
            `(${points[prior]?.value} then ${value}); not publishing`,
        );
        points.length = 0;
        break;
      }
      seen.set(period, points.length);
      points.push({ period, value, sourceId: e.sourceId });
    }

    const usable = points.filter((p) => p.value !== null).length;
    const floor = e.minPoints ?? 3;
    if (usable < floor) {
      errors.push(
        `${e.seriesId}: ${usable} usable row(s), needs ${floor}` +
          (skippedPartial ? ` (${skippedPartial} part-year row(s) skipped)` : ""),
      );
      continue;
    }

    points.sort((a, b) => a.period.localeCompare(b.period));
    series.push({
      id: spec.id,
      title: spec.title,
      definition: spec.definition,
      category: spec.category,
      unit: spec.unit,
      unitShort: spec.unitShort,
      frequency: spec.frequency,
      provenance: spec.provenance,
      confidence: spec.confidence,
      higherIsBetter: spec.higherIsBetter,
      sourceIds: [...new Set([...spec.sourceIds, e.sourceId])],
      points,
      notes: [
        ...(spec.note ? [spec.note] : []),
        ...(e.extraNote ? [e.extraNote] : []),
        `Read from the Economic Survey workbook tabchart${e.workbook}, sheet "${e.sheet}"` +
          (block.unitRow?.some(Boolean) ? `, units as printed: ${block.unitRow.filter(Boolean).join(" ")}` : "") +
          `. These are the tables behind the Survey's charts, so the series is only as long as the chart needed.`,
      ],
      lastVerified: new Date().toISOString().slice(0, 10),
    });
    extracted++;
    log(
      `  ${spec.id.padEnd(28)} ${points.length} point(s) from tabchart${e.workbook} :: ${e.sheet}` +
        (skippedPartial ? ` (${skippedPartial} part-year skipped)` : ""),
    );
  }

  return { series, errors, extracted };
}
