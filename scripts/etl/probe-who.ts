/**
 * WHO Global Health Observatory probe.
 *
 * `npm run who:probe`. The source probe found that WHO's observatory answers a
 * plain fetch with JSON — the only route in the health group that did. NCRB
 * returned 503 from four different paths, NIMHANS failed at DNS, and IIPS
 * answered 404, so this is the one machine interface available for anything
 * health-shaped.
 *
 * What it is looking for specifically: whether India has mental-health figures
 * broken down by age, which is what was asked for. The observatory publishes
 * dimensions per observation, so the honest answer — a series by age, a series
 * by sex, or a single national number with no breakdown at all — is readable
 * rather than assumable.
 *
 * The distinction matters more here than usual. Suicide mortality is not
 * prevalence of mental illness; they are different claims and reporting one
 * under the other's name would be the same category error this project keeps
 * guarding against. Whatever is found gets labelled as what it is.
 *
 * Publishes nothing.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getJson } from "./lib/http";

const ROOT = process.cwd();
const BASE = "https://ghoapi.azureedge.net/api";

/** What counts as relevant to the question being asked. */
const WANTED = /suicide|self.?harm|mental|depress|anxiet|psychiatr|substance use|alcohol use disorder/i;

/**
 * How many matching indicators to pull observations for.
 *
 * The first run capped this at 24 and reported "no age breakdown for India" —
 * a conclusion its own sample could not support, because the cap took the first
 * 24 of 163 matches in list order and every suicide indicator fell outside it.
 * Suicide mortality is the one measure in this group most likely to carry an
 * age dimension, so the answer was drawn from a sample that excluded the
 * question. The cap is now wide enough for the whole match set, and the
 * ordering below puts the indicators that matter first so a truncated run still
 * answers the question it was asked.
 */
const MAX_INDICATORS = 180;
/** Bounded by time rather than by count, so a slow API cannot overrun the job. */
const RUN_BUDGET_MS = 10 * 60_000;

/** Checked first: the measures most likely to answer "by age group". */
const PRIORITY = /suicide|self.?harm|depress|anxiet/i;

interface IndicatorRow {
  IndicatorCode: string;
  IndicatorName: string;
}

interface Observation {
  SpatialDim?: string;
  TimeDim?: number;
  Dim1?: string | null;
  Dim1Type?: string | null;
  Dim2?: string | null;
  Dim2Type?: string | null;
  NumericValue?: number | null;
}

interface Report {
  code: string;
  name: string;
  status: "ok" | "failed";
  detail?: string;
  /** Indian observations found. */
  points: number;
  years: number[];
  /** Distinct values of each dimension, which is where an age breakdown shows up. */
  dim1Type: string | null;
  dim1Values: string[];
  dim2Type: string | null;
  dim2Values: string[];
  /** True when at least one dimension is an age band. */
  hasAgeBreakdown: boolean;
  /**
   * For an age-dimensioned indicator: what actually exists, per band.
   *
   * The count alone is misleading. SDGSUICIDE reports 99 Indian observations
   * across three sexes, twelve age bands and twenty-two years — a full grid
   * would be 792, so most combinations are absent, and which ones are present
   * decides whether this can be a series by age or only a single-year profile.
   * The bands also overlap: 30-49 is published alongside 30-39 and 40-49, and
   * charting all three would double-count the same deaths.
   */
  byAgeBand: Array<{ band: string; observations: number; years: number[]; sexes: string[] }>;
  sample: Array<{ year: number; dim1: string | null; dim2: string | null; value: number | null }>;
}

async function main() {
  const log = (m: string) => process.stdout.write(`${m}\n`);
  log("Reading the WHO observatory — publishes nothing\n");

  const list = await getJson<{ value: IndicatorRow[] }>(`${BASE}/Indicator`);
  if (!list.ok || !list.data?.value) {
    log(`FAILED to list indicators: ${list.error ?? "no body"}`);
    process.exit(1);
  }
  const all = list.data.value;
  const matches = all
    .filter((i) => WANTED.test(i.IndicatorName ?? ""))
    .sort(
      (a, b) =>
        Number(PRIORITY.test(b.IndicatorName ?? "")) - Number(PRIORITY.test(a.IndicatorName ?? "")),
    );
  log(`${all.length} indicators listed · ${matches.length} match the mental-health question`);
  log(`${matches.filter((i) => PRIORITY.test(i.IndicatorName ?? "")).length} of them are suicide or mood-disorder measures, checked first\n`);

  const startedAt = Date.now();
  const reports: Report[] = [];
  for (const ind of matches.slice(0, MAX_INDICATORS)) {
    if (Date.now() - startedAt > RUN_BUDGET_MS) {
      log(`\nbudget spent after ${reports.length} indicator(s)`);
      break;
    }
    const url = `${BASE}/${encodeURIComponent(ind.IndicatorCode)}?$filter=SpatialDim%20eq%20%27IND%27`;
    const res = await getJson<{ value: Observation[] }>(url);
    if (!res.ok || !res.data?.value) {
      reports.push({
        code: ind.IndicatorCode,
        name: ind.IndicatorName,
        status: "failed",
        detail: res.error ?? "no body",
        points: 0,
        years: [],
        dim1Type: null,
        dim1Values: [],
        dim2Type: null,
        dim2Values: [],
        hasAgeBreakdown: false,
        byAgeBand: [],
        sample: [],
      });
      continue;
    }
    const rows = res.data.value.filter((r) => r.NumericValue !== null && r.NumericValue !== undefined);
    const dim1Values = [...new Set(rows.map((r) => r.Dim1).filter((d): d is string => Boolean(d)))];
    const dim2Values = [...new Set(rows.map((r) => r.Dim2).filter((d): d is string => Boolean(d)))];
    const dim1Type = rows.find((r) => r.Dim1Type)?.Dim1Type ?? null;
    const dim2Type = rows.find((r) => r.Dim2Type)?.Dim2Type ?? null;
    const years = [...new Set(rows.map((r) => r.TimeDim).filter((y): y is number => Boolean(y)))].sort(
      (a, b) => a - b,
    );

    const report: Report = {
      code: ind.IndicatorCode,
      name: ind.IndicatorName,
      status: "ok",
      points: rows.length,
      years,
      dim1Type,
      dim1Values: dim1Values.slice(0, 20),
      dim2Type,
      dim2Values: dim2Values.slice(0, 20),
      // The whole point of the run: an age band is what "by age group" needs.
      hasAgeBreakdown: /AGEGROUP|AGE/i.test(`${dim1Type ?? ""}${dim2Type ?? ""}`),
      byAgeBand: (() => {
        const ageOn: "Dim1" | "Dim2" | null = /AGE/i.test(dim1Type ?? "")
          ? "Dim1"
          : /AGE/i.test(dim2Type ?? "")
            ? "Dim2"
            : null;
        if (!ageOn) return [];
        const other = ageOn === "Dim1" ? "Dim2" : "Dim1";
        const map = new Map<string, { years: Set<number>; sexes: Set<string>; n: number }>();
        for (const r of rows) {
          const band = (ageOn === "Dim1" ? r.Dim1 : r.Dim2) ?? "(none)";
          const acc = map.get(band) ?? { years: new Set<number>(), sexes: new Set<string>(), n: 0 };
          acc.n++;
          if (r.TimeDim) acc.years.add(r.TimeDim);
          const o = (other === "Dim1" ? r.Dim1 : r.Dim2) ?? null;
          if (o) acc.sexes.add(o);
          map.set(band, acc);
        }
        return [...map.entries()]
          .map(([band, a]) => ({
            band,
            observations: a.n,
            years: [...a.years].sort((x, y) => x - y),
            sexes: [...a.sexes].sort(),
          }))
          .sort((a, b) => b.observations - a.observations);
      })(),
      sample: rows.slice(0, 6).map((r) => ({
        year: r.TimeDim ?? 0,
        dim1: r.Dim1 ?? null,
        dim2: r.Dim2 ?? null,
        value: r.NumericValue ?? null,
      })),
    };
    reports.push(report);
    log(
      `  ${ind.IndicatorCode.padEnd(22)} ${String(report.points).padStart(4)} obs  ` +
        `${report.years[0] ?? "-"}–${report.years.at(-1) ?? "-"}  ` +
        `${report.hasAgeBreakdown ? "AGE" : "   "}  ${ind.IndicatorName.slice(0, 60)}`,
    );
  }

  await mkdir(join(ROOT, "data/live"), { recursive: true });
  await writeFile(
    join(ROOT, "data/live/who-probe.json"),
    JSON.stringify(
      { probedAt: new Date().toISOString(), listed: all.length, matched: matches.length, reports },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  const withAge = reports.filter((r) => r.hasAgeBreakdown);
  for (const r of withAge) {
    log("");
    log(`${r.code} — ${r.name}`);
    for (const b of r.byAgeBand) {
      log(
        `  ${b.band.padEnd(24)} ${String(b.observations).padStart(3)} obs  ` +
          `${b.years[0] ?? "-"}–${b.years.at(-1) ?? "-"} (${b.years.length} yr)  ${b.sexes.join(",")}`,
      );
    }
  }
  log("");
  log(`${reports.filter((r) => r.status === "ok").length}/${reports.length} answered · ${withAge.length} carry an age breakdown for India`);
  log("Wrote data/live/who-probe.json — read it before writing a connector.");
}

main().catch((err: unknown) => {
  process.stderr.write(`who probe crashed: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
