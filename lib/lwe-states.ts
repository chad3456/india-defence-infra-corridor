/**
 * Left-wing extremism, by state and year.
 *
 * `data/security/lwe-states.json` holds 414 state-year rows summed from SATP's
 * eighteen state datasheets — the same rows behind every national LWE chart on
 * this site. They were fetched for a different purpose (the national page
 * refuses the pipeline, so the national series is their sum) and they carry a
 * geography that the national series throws away.
 *
 * ── Three distinctions this module refuses to blur ───────────────────────
 *
 * A state SATP does not track is not a state with zero deaths. Thirty-six
 * states and union territories exist; eighteen appear here. Rendering the other
 * eighteen as zero would draw a confident claim about places nobody counted.
 * They are returned as `null` and drawn as "not tracked", which is a different
 * colour and a different sentence.
 *
 * A year with no row for a state that is otherwise tracked *is* a zero — SATP
 * publishes a row per year per state and omits the year only when it has
 * nothing, which for a fatality count means none recorded.
 *
 * And the last year is partial. SATP updates continuously, so the current year
 * is a running total that will grow. Comparing it to a completed year as though
 * both were finished is the most common way this kind of chart misleads, so the
 * partial year is labelled everywhere it appears.
 */
import raw from "@/data/security/lwe-states.json";

export interface StateYearRow {
  state: string;
  year: number;
  civilians: number;
  securityForces: number;
  insurgents: number;
  notSpecified: number;
  incidents: number;
}

interface StateFile {
  fetchedAt: string;
  statesOk: number;
  statesTotal: number;
  missing: string[];
  rows: StateYearRow[];
}

const FILE = raw as StateFile;
export const ROWS: StateYearRow[] = FILE.rows;
export const FETCHED_AT = FILE.fetchedAt;

/** The states SATP publishes a left-wing-extremism datasheet for. */
export const TRACKED_STATES: string[] = [...new Set(ROWS.map((r) => r.state))].sort();

export const YEARS: number[] = [...new Set(ROWS.map((r) => r.year))].sort((a, b) => a - b);
export const FIRST_YEAR = YEARS[0] ?? 2004;
export const LAST_YEAR = YEARS[YEARS.length - 1] ?? 2026;

/**
 * The metrics a reader can put on the map.
 *
 * `higherIsBetter` is deliberately absent. Insurgents killed is the clearest
 * case: whether a rise is good is the argument, not the data, and this project
 * does not settle that argument with a colour ramp. Every metric here is drawn
 * on the same neutral single-hue scale — more is darker, and what more means is
 * left to the reader.
 */
export type MetricId =
  | "incidents"
  | "civilians"
  | "securityForces"
  | "insurgents"
  | "total";

export const METRICS: Array<{
  id: MetricId;
  label: string;
  short: string;
  definition: string;
  note?: string;
}> = [
  {
    id: "incidents",
    label: "Incidents of killing",
    short: "incidents",
    definition: "Incidents in which somebody was killed, as SATP records them.",
    note: "Incidents, not attacks. An encounter and an ambush both count once, and an attack with no fatality does not appear at all — so this undercounts violence and tracks lethality.",
  },
  {
    id: "civilians",
    label: "Civilians killed",
    short: "civilians",
    definition: "Civilian deaths recorded in left-wing-extremism violence.",
    note: "The category SATP is most often challenged on: deaths of people the security forces describe as sympathisers and local accounts describe as villagers land differently depending on whose report the compiler read.",
  },
  {
    id: "securityForces",
    label: "Security forces killed",
    short: "forces",
    definition: "Deaths of police and central armed police personnel.",
  },
  {
    id: "insurgents",
    label: "Insurgents killed",
    short: "insurgents",
    definition: "Deaths of people identified as Maoist cadres.",
    note: "Identification is made at the scene and is the most contested figure in the dataset. Read it as 'recorded as', not 'were'.",
  },
  {
    id: "total",
    label: "Total fatalities",
    short: "total",
    definition: "All recorded deaths, including those SATP does not attribute to a side.",
  },
];

export const METRIC_BY_ID = new Map(METRICS.map((m) => [m.id, m]));

export function valueOf(row: StateYearRow, metric: MetricId): number {
  if (metric === "total") {
    return row.civilians + row.securityForces + row.insurgents + row.notSpecified;
  }
  return row[metric];
}

export interface StateValue {
  state: string;
  /** null means SATP does not track this state — not zero. */
  value: number | null;
}

/**
 * One value per state for a metric, over a year range inclusive.
 *
 * Untracked states are returned with a null value rather than omitted, so a
 * caller cannot accidentally treat "absent" as "none".
 */
export function byState(
  metric: MetricId,
  from: number,
  to: number,
  allStates: string[],
): StateValue[] {
  const totals = new Map<string, number>();
  for (const r of ROWS) {
    if (r.year < from || r.year > to) continue;
    totals.set(r.state, (totals.get(r.state) ?? 0) + valueOf(r, metric));
  }
  return allStates.map((state) => ({
    state,
    value: totals.has(state) ? (totals.get(state) ?? 0) : null,
  }));
}

/** National totals per year for a metric — the panel's sparkline. */
export function byYear(metric: MetricId): Array<{ year: number; value: number }> {
  const totals = new Map<number, number>();
  for (const r of ROWS) totals.set(r.year, (totals.get(r.year) ?? 0) + valueOf(r, metric));
  return YEARS.map((year) => ({ year, value: totals.get(year) ?? 0 }));
}

/** The worst-affected states over a range, for the panel's ranked list. */
export function ranked(metric: MetricId, from: number, to: number): StateValue[] {
  return byState(metric, from, to, TRACKED_STATES)
    .filter((s) => s.value !== null && s.value > 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
}

/**
 * Bucket boundaries for the choropleth.
 *
 * Quantiles of the non-zero values rather than equal-width bins. LWE fatalities
 * are concentrated to the point that equal-width bins put Chhattisgarh in the
 * top bucket and everything else in the bottom one, which is true and useless:
 * the map would show a single dark state and seventeen pale ones in every year.
 * Quantiles spread the tracked states across the ramp so the geography is
 * legible, at the cost that a step is not a fixed number of deaths — which the
 * legend states rather than hides.
 */
export function bucketsOf(values: StateValue[], steps = 5): number[] {
  const xs = values
    .map((v) => v.value)
    .filter((v): v is number => v !== null && v > 0)
    .sort((a, b) => a - b);
  if (xs.length === 0) return [];
  const out: number[] = [];
  for (let i = 1; i < steps; i++) {
    const at = (i / steps) * (xs.length - 1);
    const lo = Math.floor(at);
    const hi = Math.ceil(at);
    const t = at - lo;
    out.push((xs[lo] ?? 0) * (1 - t) + (xs[hi] ?? 0) * t);
  }
  return out;
}

/** Which bucket a value falls in: 0 is lowest, `buckets.length` is highest. */
export function bucketOf(value: number, buckets: number[]): number {
  let i = 0;
  while (i < buckets.length && value > (buckets[i] ?? Infinity)) i++;
  return i;
}
