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
 * ── What it will not do ──────────────────────────────────────────────────
 *
 * These are chart-backing tables, so most run to a handful of years. That is
 * published as it is: a five-point series is a five-point series, and padding
 * it or splicing it onto another source would be inventing history.
 */
import type { Series, DataPoint } from "../../../lib/types";
import { INDIA_SERIES } from "../../../lib/india-catalogue";
import { readWorkbook, parseCellNumber, type SheetTable } from "../lib/sheet-table";

const BASE = "https://www.indiabudget.gov.in/economicsurvey/doc/tabchart";

/** One extraction: which workbook, which sheet, which column, which series. */
interface Extraction {
  workbook: number;
  sheet: string;
  /** Every pattern must match somewhere in the header, in order. */
  expectHeader: RegExp[];
  seriesId: string;
  /** Column index within the row, counting the year column as 0. */
  column: number;
  /** Applied to every value — for tables published in lakh or crore. */
  scale?: number;
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
    expectHeader: [/year/i, /revenue realization|per\s*GB|wireless data/i],
    seriesId: "mobile-data-price-per-gb",
    column: 1,
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

/** Normalise "2019-20" and "2019" alike to the period this project stores. */
function periodOf(cell: string): string | null {
  const t = (cell ?? "").trim().replace(/\*/g, "");
  const fy = /^((?:19|20)\d{2})\s*[-–/]\s*(\d{2,4})$/.exec(t);
  if (fy?.[1] && fy[2]) {
    const end = fy[2].length === 4 ? fy[2].slice(2) : fy[2];
    return `FY${fy[1]}-${end}`;
  }
  if (/^(19|20)\d{2}$/.test(t)) return t;
  return null;
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
        signal: AbortSignal.timeout(45_000),
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
    // The check that keeps a reused sheet name from publishing the wrong table.
    if (!headerMatches(table.header, e.expectHeader)) {
      errors.push(
        `${e.seriesId}: tabchart${e.workbook} :: "${e.sheet}" header did not match — got "${table.header.join(" | ")}"`,
      );
      continue;
    }

    const points: DataPoint[] = [];
    for (const row of table.yearRows) {
      const period = periodOf(row[0] ?? "");
      if (!period) continue;
      const raw = parseCellNumber(row[e.column] ?? "");
      points.push({
        period,
        value: raw === null ? null : Math.round(raw * (e.scale ?? 1) * 100) / 100,
        sourceId: e.sourceId,
      });
    }

    if (points.filter((p) => p.value !== null).length < 3) {
      errors.push(`${e.seriesId}: fewer than 3 usable rows; not publishing`);
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
        `Read from the Economic Survey workbook tabchart${e.workbook}, sheet "${e.sheet}". These are the tables behind the Survey's charts, so the series is only as long as the chart needed.`,
      ],
      lastVerified: new Date().toISOString().slice(0, 10),
    });
    extracted++;
    log(`  ${spec.id.padEnd(28)} ${points.length} point(s) from tabchart${e.workbook} :: ${e.sheet}`);
  }

  return { series, errors, extracted };
}
