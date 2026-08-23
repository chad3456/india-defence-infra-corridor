/**
 * WHO Global Health Observatory — suicide mortality.
 *
 * The observatory was the only health source that answered a plain fetch. NCRB
 * returned 503 from four paths, NIMHANS failed at DNS, IIPS answered 404. So
 * this is what a mental-health chart for India can honestly be built from, and
 * the limits below are as much of the deliverable as the numbers are.
 *
 * ── What the probe found, and what it dictates ───────────────────────────
 *
 * `SDGSUICIDE` carries 99 Indian observations, and they are not a grid:
 *
 *   AGEGROUP_YEARSALL   66 obs, 2000-2021, three sexes  → a real time series
 *   every other band     3 obs, 2021 only, three sexes  → one age profile
 *
 * That is two different charts and they must not be merged. The rate over time
 * is a trend; the rate by age is a snapshot of a single year. Drawing the
 * second as though it were the first would invent twenty years of history that
 * WHO does not publish.
 *
 * The bands also overlap. WHO reports 30-49 alongside 30-39 and 40-49, and
 * 15-29 alongside 15-19 and 20-29. `AGE_BANDS` below is a deliberately chosen
 * non-overlapping, contiguous set; charting the full list would count the same
 * deaths two and three times over, and would look like data rather than like a
 * bug.
 *
 * ── What these numbers are not ───────────────────────────────────────────
 *
 * They are not a count of suicides, and they are not prevalence of mental
 * illness. WHO models country rates where civil registration is incomplete, and
 * India's is. NCRB publishes India's own recorded figures and they differ
 * substantially from these — a disagreement this site records rather than
 * resolves. Everything here is graded low confidence for that reason.
 */
import type { Series, DataPoint } from "../../../lib/types";
import { ALL_SECURITY_SPECS } from "../../../lib/security-catalogue";
import { getJson } from "../lib/http";

const BASE = "https://ghoapi.azureedge.net/api";
const SOURCE_ID = "who-gho-suicide";

/**
 * Non-overlapping and contiguous from 10 upward.
 *
 * 10-19 is preferred over 15-19 because WHO publishes no 10-14 band, so
 * starting at 15 would silently drop the youngest ages it does cover.
 */
const AGE_BANDS: Array<{ dim: string; label: string }> = [
  { dim: "AGEGROUP_YEARS10-19", label: "10–19" },
  { dim: "AGEGROUP_YEARS20-29", label: "20–29" },
  { dim: "AGEGROUP_YEARS30-39", label: "30–39" },
  { dim: "AGEGROUP_YEARS40-49", label: "40–49" },
  { dim: "AGEGROUP_YEARS50-59", label: "50–59" },
  { dim: "AGEGROUP_YEARS60-69", label: "60–69" },
  { dim: "AGEGROUP_YEARS70PLUS", label: "70+" },
];

const SEX = { both: "SEX_BTSX", male: "SEX_MLE", female: "SEX_FMLE" } as const;

interface Observation {
  SpatialDim?: string;
  TimeDim?: number;
  Dim1?: string | null;
  Dim2?: string | null;
  NumericValue?: number | null;
}

export interface WhoResult {
  series: Series[];
  errors: string[];
  fetched: number;
}

/**
 * Fetch one indicator's Indian rows, or say why not.
 *
 * The first version returned null on any failure and discarded the error, so a
 * live run reported "no rows returned" and nothing else — while the probe had
 * fetched the identical URL successfully minutes earlier. Throwing away the one
 * piece of information needed to fix it is a worse bug than the failure it was
 * hiding, so the reason is carried out now.
 *
 * The unfiltered fallback exists because the `$filter` parameter is the only
 * thing separating the two call paths, and a CDN that mishandles it would
 * produce exactly this: a probe that works and a connector that does not. If
 * the filtered form fails, the whole indicator is fetched and India selected
 * here, which is slower and always correct.
 */
async function indiaRows(
  code: string,
  log: (m: string) => void,
): Promise<{ rows: Observation[] } | { error: string }> {
  const filtered = `${BASE}/${encodeURIComponent(code)}?$filter=SpatialDim%20eq%20%27IND%27`;
  const first = await getJson<{ value: Observation[] }>(filtered, { cacheMs: 0, timeoutMs: 60_000 });

  let value: Observation[] | null = first.ok && first.data?.value ? first.data.value : null;
  if (!value) {
    log(`  ${code}: filtered request failed (${first.error ?? "no value array"}) — retrying unfiltered`);
    const all = await getJson<{ value: Observation[] }>(`${BASE}/${encodeURIComponent(code)}`, {
      cacheMs: 0,
      timeoutMs: 120_000,
    });
    if (!all.ok || !all.data?.value) {
      return { error: `filtered: ${first.error ?? "no value array"}; unfiltered: ${all.error ?? "no value array"}` };
    }
    value = all.data.value.filter((r) => r.SpatialDim === "IND");
    log(`  ${code}: unfiltered fallback returned ${value.length} Indian row(s)`);
  }

  const rows = value.filter((r) => r.NumericValue !== null && r.NumericValue !== undefined);
  if (rows.length === 0) return { error: "answered, but carried no Indian observations" };
  return { rows };
}

function build(specId: string, points: DataPoint[], extraNotes: string[]): Series | null {
  const spec = ALL_SECURITY_SPECS.find((s) => s.id === specId);
  if (!spec || points.length === 0) return null;
  return {
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
    sourceIds: [...new Set([...spec.sourceIds, SOURCE_ID])],
    points,
    notes: [...(spec.note ? [spec.note] : []), ...extraNotes],
    lastVerified: new Date().toISOString().slice(0, 10),
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

export async function runWho(
  opts: { dryRun?: boolean; onProgress?: (msg: string) => void } = {},
): Promise<WhoResult> {
  const log = opts.onProgress ?? (() => {});
  const errors: string[] = [];
  const series: Series[] = [];

  if (opts.dryRun) {
    log("[dry-run] would read SDGSUICIDE and MH_12 for India");
    return { series: [], errors: [], fetched: 0 };
  }

  const crudeRes = await indiaRows("SDGSUICIDE", log);
  if ("error" in crudeRes) {
    // Reported and stepped over, not returned on. The age-standardised series
    // comes from a different indicator and there is no reason one failing
    // should take the other with it.
    errors.push(`SDGSUICIDE: ${crudeRes.error}`);
  }
  const crude = "error" in crudeRes ? [] : crudeRes.rows;

  /* ---- The trend: all ages, one series per sex ---- */
  for (const [key, dim] of crude.length ? Object.entries(SEX) : []) {
    const rows = crude.filter((r) => r.Dim1 === dim && r.Dim2 === "AGEGROUP_YEARSALL");
    const points: DataPoint[] = rows
      .filter((r) => r.TimeDim)
      .map((r) => ({ period: String(r.TimeDim), value: round(r.NumericValue ?? 0), sourceId: SOURCE_ID }))
      .sort((a, b) => a.period.localeCompare(b.period));
    const id = key === "both" ? "suicide-rate" : `suicide-rate-${key}`;
    const s = build(id, points, [
      "All ages. WHO's crude rate, so a rise can reflect an ageing population as much as a change in risk — the age-standardised series alongside this one removes that effect.",
    ]);
    if (s) {
      series.push(s);
      log(`  ${id.padEnd(26)} ${points.length} year(s)`);
    } else if (points.length === 0) {
      errors.push(`${id}: no observations for ${dim}`);
    }
  }

  /* ---- The profile: one year, by age band ---- */
  const profileYear = Math.max(
    0,
    ...crude
      .filter((r) => r.Dim2 !== "AGEGROUP_YEARSALL" && r.TimeDim)
      .map((r) => r.TimeDim ?? 0),
  );
  if (profileYear === 0) {
    errors.push("SDGSUICIDE: no age-banded observations found");
  } else {
    for (const [key, dim] of Object.entries(SEX)) {
      const points: DataPoint[] = [];
      for (const band of AGE_BANDS) {
        const hit = crude.find(
          (r) => r.Dim1 === dim && r.Dim2 === band.dim && r.TimeDim === profileYear,
        );
        // A band with no observation is left out rather than zeroed: WHO not
        // publishing a rate is not a rate of zero.
        if (hit) points.push({ period: band.label, value: round(hit.NumericValue ?? 0), sourceId: SOURCE_ID });
      }
      const id = key === "both" ? "suicide-rate-by-age" : `suicide-rate-by-age-${key}`;
      const s = build(id, points, [
        `WHO publishes an age breakdown for ${profileYear} only, so this is a single-year profile and not a trend. The bands are non-overlapping and contiguous from 10; WHO also publishes wider bands that overlap these, and including them would count the same deaths twice.`,
      ]);
      if (s) {
        series.push(s);
        log(`  ${id.padEnd(26)} ${points.length} band(s), ${profileYear}`);
      }
    }
  }

  /* ---- Age-standardised, for comparison with the crude trend ---- */
  const stdRes = await indiaRows("MH_12", log);
  if ("error" in stdRes) {
    errors.push(`MH_12: ${stdRes.error}`);
  } else {
    const rows = stdRes.rows.filter((r) => r.Dim1 === SEX.both);
    const points: DataPoint[] = rows
      .filter((r) => r.TimeDim)
      .map((r) => ({ period: String(r.TimeDim), value: round(r.NumericValue ?? 0), sourceId: SOURCE_ID }))
      .sort((a, b) => a.period.localeCompare(b.period));
    const s = build("suicide-rate-age-standardised", points, [
      "Age-standardised to a reference population, which is what makes it comparable across countries and across time. Where this and the crude rate diverge, the gap is the effect of India's changing age structure rather than a change in risk.",
    ]);
    if (s) {
      series.push(s);
      log(`  suicide-rate-age-standardised ${points.length} year(s)`);
    }
  }

  return { series, errors, fetched: series.length };
}
