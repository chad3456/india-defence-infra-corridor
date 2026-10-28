/**
 * Child malnutrition by district: the four NFHS-5 (2019–21) district
 * measures, the bands they are coloured by, and the arithmetic the page does.
 * No node imports — the map component reads it in the browser.
 *
 * ── Bands ───────────────────────────────────────────────────────────────
 *
 * Stunting and wasting are banded by WHO–UNICEF's prevalence thresholds (de
 * Onis et al., Public Health Nutrition, 2019); anaemia by WHO's thresholds
 * of public-health significance. WHO publishes no current severity bands for
 * child underweight, so that measure uses plain ten-point bands, and the
 * legend says so. "Spread" mode instead bins the measured districts into
 * quintiles — derived, and labelled so.
 */

export type MeasureId = "stunting" | "wasting" | "underweight" | "anaemia";
export const MEASURES: MeasureId[] = ["stunting", "wasting", "underweight", "anaemia"];

export interface Band { from: number; label: string }

export interface MeasureDef {
  id: MeasureId;
  /** The Spatial India indicator carrying the NFHS-5 district factsheet value. */
  spatialId: string;
  /** The DHS Program indicator for the national and state figures in data/nfhs/rounds.json. */
  roundsKey: string;
  name: string;
  short: string;
  definition: string;
  /** Lower bounds, ascending; the first is 0. */
  bands: Band[];
  bandSource: "who-2019" | "who-anaemia" | "plain";
}

export const MEASURE: Record<MeasureId, MeasureDef> = {
  stunting: {
    id: "stunting", spatialId: "nfhs5_stunting", roundsKey: "stunting", name: "Stunting", short: "too short for age",
    definition: "Children under five whose height for age is more than two standard deviations below the WHO Child Growth Standards median — the mark of long-term undernutrition.",
    bands: [{ from: 0, label: "Very low" }, { from: 2.5, label: "Low" }, { from: 10, label: "Medium" }, { from: 20, label: "High" }, { from: 30, label: "Very high" }],
    bandSource: "who-2019",
  },
  wasting: {
    id: "wasting", spatialId: "nfhs5_wasting", roundsKey: "wasting", name: "Wasting", short: "too thin for height",
    definition: "Children under five whose weight for height is more than two standard deviations below the median — acute undernutrition, the kind that kills fastest.",
    bands: [{ from: 0, label: "Very low" }, { from: 2.5, label: "Low" }, { from: 5, label: "Medium" }, { from: 10, label: "High" }, { from: 15, label: "Very high" }],
    bandSource: "who-2019",
  },
  underweight: {
    id: "underweight", spatialId: "nfhs5_underweight", roundsKey: "underweight", name: "Underweight", short: "too light for age",
    definition: "Children under five whose weight for age is more than two standard deviations below the median — a composite of stunting and wasting.",
    bands: [{ from: 0, label: "Under 10%" }, { from: 10, label: "10–20%" }, { from: 20, label: "20–30%" }, { from: 30, label: "30–40%" }, { from: 40, label: "40% and over" }],
    bandSource: "plain",
  },
  anaemia: {
    id: "anaemia", spatialId: "nfhs5_child_anemia", roundsKey: "anaemia_child", name: "Anaemia", short: "children 6–59 months anaemic",
    definition: "Children aged 6–59 months whose haemoglobin is below 11 g/dl, adjusted for altitude — mostly iron deficiency, which slows growth and learning.",
    bands: [{ from: 0, label: "No public-health problem" }, { from: 5, label: "Mild" }, { from: 20, label: "Moderate" }, { from: 40, label: "Severe" }],
    bandSource: "who-anaemia",
  },
};

/** An ordinal ramp for the dark surface #070b12, one hue, checked for monotone lightness and a light end that clears the surface. */
export const RAMP = ["#7a3415", "#a5461a", "#d1601f", "#f58a3d", "#ffc08a"] as const;
export const NO_DATA = "#1a2230";

/** Which band a value falls in, by lower bounds. */
export function bandOf(v: number, bounds: number[]): number {
  let k = 0;
  for (let i = 0; i < bounds.length; i++) if (v >= bounds[i]!) k = i;
  return k;
}

/** The ramp step for band k of n: fewer bands take the brighter end, so "worst" always reads brightest. */
export function rampFor(k: number, n: number): string {
  return RAMP[RAMP.length - n + k] ?? RAMP[RAMP.length - 1]!;
}

/** Quintile lower bounds of a set of values (derived). */
export function quintiles(values: number[]): number[] {
  const s = [...values].sort((a, b) => a - b);
  if (!s.length) return [0];
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
  return [s[0]!, q(0.2), q(0.4), q(0.6), q(0.8)];
}

/** State names as the two sources spell them, reduced to one key. */
export function stateKey(name: string): string {
  const k = name.toLowerCase().replace(/&/g, "and").replace(/\bnct of\b|\bthe\b/g, "").replace(/[^a-z]/g, "");
  return STATE_ALIAS[k] ?? k;
}
/** The DHS Program calls Delhi "New Delhi"; the two sources join the merged union territory's names differently. */
const STATE_ALIAS: Record<string, string> = { newdelhi: "delhi", dadraandnagarhavelidamananddiu: "dadraandnagarhavelianddamananddiu" };

export interface MalDistrict {
  id: string;
  name: string;
  state: string;
  d: string;
  /** Measured NFHS-5 values; null where the district has no measurement (or only an estimate, which this site does not publish). */
  v: Record<MeasureId, number | null>;
  /** True where the source flagged the value as estimated from a parent district. */
  est: boolean;
}

export interface MalMap {
  width: number;
  height: number;
  districts: MalDistrict[];
  /** India's outline and state borders, in the same projection. */
  outline: string;
  borders: string;
  national: Record<MeasureId, { nfhs4: number | null; nfhs5: number | null }>;
  states: Record<string, Partial<Record<MeasureId, number>>>;
  fetchedAt: string | null;
  attribution: string;
}

/** Districts measured on a measure, worst first. */
export function ranked(ds: MalDistrict[], m: MeasureId): MalDistrict[] {
  return ds.filter((d) => d.v[m] !== null).sort((a, b) => b.v[m]! - a.v[m]!);
}

/** Share of measured districts at or above a value — derived. */
export function shareAtOrAbove(ds: MalDistrict[], m: MeasureId, at: number): { n: number; of: number } {
  const xs = ds.map((d) => d.v[m]).filter((x): x is number => x !== null);
  return { n: xs.filter((x) => x >= at).length, of: xs.length };
}
