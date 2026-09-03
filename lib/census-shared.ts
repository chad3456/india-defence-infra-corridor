/**
 * Atlas types and constants, importable from the browser.
 *
 * Split from `census.ts` because that module reads the filesystem, and a client
 * component importing one symbol from it drags `node:fs` into the browser
 * bundle -- which fails the build rather than degrading, so the split is
 * structural rather than tidiness.
 */
import type { CensusSpec } from "./census-specs";

export interface MetricCount {
  id: string;
  total: number;
  byState: Record<string, number>;
  unplaced: number;
  capped: boolean;
  fetchedAt: string;
}

/**
 * Population (2011 census, crore→absolute) and area, for normalising.
 *
 * 2011 is the last completed census; the 2021 round has not been conducted.
 * Using it means per-capita figures are against a fifteen-year-old
 * denominator, which is stated on the page rather than hidden — it is still
 * the best national denominator that exists.
 */
export const STATE_FACTS: Record<string, { pop: number; areaKm2: number }> = {
  // Names below are the ones the boundary file uses, not the ones I would
  // choose. Seven of its thirty-six spellings differ from the census -- it
  // writes "NCT of Delhi", "Jammu & Kashmir", and a plain typo,
  // "Arunanchal Pradesh" -- and a name that fails to resolve here silently
  // drops that state out of every per-capita and per-area view. Delhi
  // disappearing from a density map is not a visible failure, which is why
  // `test:census` asserts every polygon has a denominator.
  "Uttar Pradesh": { pop: 199812341, areaKm2: 240928 },
  "Maharashtra": { pop: 112374333, areaKm2: 307713 },
  "Bihar": { pop: 104099452, areaKm2: 94163 },
  "West Bengal": { pop: 91276115, areaKm2: 88752 },
  "Madhya Pradesh": { pop: 72626809, areaKm2: 308245 },
  "Tamil Nadu": { pop: 72147030, areaKm2: 130058 },
  "Rajasthan": { pop: 68548437, areaKm2: 342239 },
  "Karnataka": { pop: 61095297, areaKm2: 191791 },
  "Gujarat": { pop: 60439692, areaKm2: 196244 },
  "Andhra Pradesh": { pop: 49577103, areaKm2: 162968 },
  "Odisha": { pop: 41974218, areaKm2: 155707 },
  "Telangana": { pop: 35003674, areaKm2: 112077 },
  "Kerala": { pop: 33406061, areaKm2: 38852 },
  "Jharkhand": { pop: 32988134, areaKm2: 79716 },
  "Assam": { pop: 31205576, areaKm2: 78438 },
  "Punjab": { pop: 27743338, areaKm2: 50362 },
  "Chhattisgarh": { pop: 25545198, areaKm2: 135192 },
  "Haryana": { pop: 25351462, areaKm2: 44212 },
  "NCT of Delhi": { pop: 16787941, areaKm2: 1484 },
  // This boundary file predates the 2019 reorganisation and carries Jammu &
  // Kashmir as one unit, so the 2011 census figures for the undivided state
  // are used -- population and area from the same source, rather than a
  // present-day area paired with a 2011 population.
  "Jammu & Kashmir": { pop: 12541302, areaKm2: 222236 },
  "Uttarakhand": { pop: 10086292, areaKm2: 53483 },
  "Himachal Pradesh": { pop: 6864602, areaKm2: 55673 },
  "Tripura": { pop: 3673917, areaKm2: 10486 },
  "Meghalaya": { pop: 2966889, areaKm2: 22429 },
  "Manipur": { pop: 2570390, areaKm2: 22327 },
  "Nagaland": { pop: 1978502, areaKm2: 16579 },
  "Goa": { pop: 1458545, areaKm2: 3702 },
  "Arunanchal Pradesh": { pop: 1383727, areaKm2: 83743 },
  "Puducherry": { pop: 1247953, areaKm2: 479 },
  "Mizoram": { pop: 1097206, areaKm2: 21081 },
  "Chandigarh": { pop: 1055450, areaKm2: 114 },
  "Sikkim": { pop: 610577, areaKm2: 7096 },
  "Andaman & Nicobar Island": { pop: 380581, areaKm2: 8249 },
  "Dadara & Nagar Havelli": { pop: 343709, areaKm2: 491 },
  "Daman & Diu": { pop: 243247, areaKm2: 112 },
  "Lakshadweep": { pop: 64473, areaKm2: 32 },
};

export type Normalisation = "raw" | "perMillion" | "perArea";

export const NORMALISATIONS: Array<{ id: Normalisation; label: string; unit: string; note: string }> = [
  { id: "raw", label: "Total count", unit: "mapped", note: "What is on the map. Biggest states usually win, and so do best-mapped ones." },
  { id: "perMillion", label: "Per million people", unit: "per m", note: "Against the 2011 census, the last one completed. A fifteen-year-old denominator." },
  { id: "perArea", label: "Per 10,000 km²", unit: "per 10k km²", note: "Density on the ground. Favours small dense states — Delhi will lead most of these." },
];

export interface AtlasMetric {
  spec: CensusSpec;
  count: MetricCount;
  /** Value per state under the chosen normalisation. */
  values: Record<string, number>;
  max: number;
  leader: { state: string; value: number } | null;
}

export interface AtlasData {
  present: boolean;
  builtAt: string | null;
  /** Metrics that actually have counts, in spec order. */
  metrics: MetricCount[];
  specs: CensusSpec[];
  counted: number;
  declared: number;
  capped: string[];
}


/** Apply a normalisation, dropping states with no denominator rather than guessing one. */
export function normalise(count: MetricCount, mode: Normalisation): AtlasMetric["values"] {
  const out: Record<string, number> = {};
  for (const [state, n] of Object.entries(count.byState)) {
    const f = STATE_FACTS[state];
    if (mode === "raw") { out[state] = n; continue; }
    if (!f) continue;   // no denominator: omitted, never approximated
    out[state] = mode === "perMillion"
      ? (n / f.pop) * 1_000_000
      : (n / f.areaKm2) * 10_000;
  }
  return out;
}

export function buildMetric(spec: CensusSpec, count: MetricCount, mode: Normalisation): AtlasMetric {
  const values = normalise(count, mode);
  const entries = Object.entries(values);
  const max = entries.reduce((m, [, v]) => Math.max(m, v), 0);
  const top = entries.sort((a, b) => b[1] - a[1])[0];
  return {
    spec, count, values, max,
    leader: top ? { state: top[0], value: top[1] } : null,
  };
}

/**
 * Separating a real geographic signal from a mapping artifact.
 *
 * Kerala leads most metrics on this atlas — 65% of mapped libraries, 79% of
 * mapped internet cafés — and it does not have two thirds of India's libraries.
 * It has the most mappers. Left there, every chart would be a chart about
 * Kerala.
 *
 * But not every lead is an artifact: gurdwaras peak in Himachal and Punjab,
 * Jain temples in Gujarat, Buddhist sites in Ladakh and Bihar. Those survive
 * the bias, and they are the interesting ones.
 *
 * So the bias is measured rather than warned about. Each state's share of ALL
 * mapped features is its baseline — roughly, how much of the map it drew. A
 * metric where the leader's share merely matches its baseline says nothing
 * about that metric. A metric where some state runs far above its own baseline
 * is a real concentration, and `lift` is how far.
 */
export interface BiasReading {
  /** Leading state for this metric, by raw count. */
  leader: string;
  /** Leader's share of this metric, 0..1. */
  share: number;
  /** Leader's share of every mapped feature — its share of the map itself. */
  baseline: number;
  /** share / baseline. Near 1 means the lead is just mapping density. */
  lift: number;
  verdict: "likely a mapping artifact" | "mixed" | "a real concentration";
}

/**
 * Each state's share of a *typical* metric — how much of the map it drew.
 *
 * The first version summed raw features across every metric and divided. That
 * broke the moment the counts got big enough to test it: water wells came in
 * at 164,023, a quarter of all 662,746 features across 101 metrics, and 84.7%
 * of them are in Maharashtra. Maharashtra's baseline went to 29% on the
 * strength of one metric, and hospitals — where it holds a perfectly ordinary
 * 12.8% — were then reported as "likely a mapping artifact" for falling below
 * it. The baseline was corrupting the readings it exists to correct.
 *
 * So each metric now counts once, whatever its size, and the summary is the
 * median rather than the mean. A median survives one bulk import; a mean does
 * not, and a bulk import is exactly what a single state holding 85% of a
 * single metric looks like. On this data the change moves Maharashtra from 29%
 * to 12% and Kerala from 13% to 22%, which is much closer to what anyone
 * looking at Indian OpenStreetMap coverage would tell you.
 *
 * Shares are renormalised to sum to one, since medians of parts do not.
 */
export function mappingBaseline(metrics: MetricCount[]): Record<string, number> {
  const usable = metrics.filter((m) => m.total > 0);
  if (usable.length === 0) return {};

  const states = new Set<string>();
  for (const m of usable) for (const st of Object.keys(m.byState)) states.add(st);

  const raw: Record<string, number> = {};
  let sum = 0;
  for (const st of states) {
    // A state absent from a metric holds none of it, which is a zero and must
    // be counted as one — dropping it would let a state that appears in three
    // metrics outrank one that appears in all hundred.
    const shares = usable.map((m) => (m.byState[st] ?? 0) / m.total).sort((a, b) => a - b);
    const mid = shares.length >> 1;
    const median = shares.length % 2 === 1
      ? shares[mid]!
      : (shares[mid - 1]! + shares[mid]!) / 2;
    raw[st] = median;
    sum += median;
  }
  if (sum === 0) return {};

  const out: Record<string, number> = {};
  for (const [st, v] of Object.entries(raw)) out[st] = v / sum;
  return out;
}

export function readBias(count: MetricCount, baseline: Record<string, number>): BiasReading | null {
  const entries = Object.entries(count.byState).sort((a, b) => b[1] - a[1]);
  const top = entries[0];
  if (!top || count.total === 0) return null;
  const share = top[1] / count.total;
  const base = baseline[top[0]] ?? 0;
  // With no baseline to compare against, claim nothing.
  const lift = base > 0 ? share / base : 1;
  return {
    leader: top[0],
    share,
    baseline: base,
    lift,
    verdict: lift < 1.35 ? "likely a mapping artifact" : lift < 2.2 ? "mixed" : "a real concentration",
  };
}
