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

/** How many matching indicators to pull observations for. */
const MAX_INDICATORS = 24;

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
  const matches = all.filter((i) => WANTED.test(i.IndicatorName ?? ""));
  log(`${all.length} indicators listed · ${matches.length} match the mental-health question\n`);

  const reports: Report[] = [];
  for (const ind of matches.slice(0, MAX_INDICATORS)) {
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
  log("");
  log(`${reports.filter((r) => r.status === "ok").length}/${reports.length} answered · ${withAge.length} carry an age breakdown for India`);
  log("Wrote data/live/who-probe.json — read it before writing a connector.");
}

main().catch((err: unknown) => {
  process.stderr.write(`who probe crashed: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
