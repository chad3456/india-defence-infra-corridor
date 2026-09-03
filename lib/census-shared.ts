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
  "Delhi": { pop: 16787941, areaKm2: 1484 },
  "Jammu and Kashmir": { pop: 12541302, areaKm2: 42241 },
  "Uttarakhand": { pop: 10086292, areaKm2: 53483 },
  "Himachal Pradesh": { pop: 6864602, areaKm2: 55673 },
  "Tripura": { pop: 3673917, areaKm2: 10486 },
  "Meghalaya": { pop: 2966889, areaKm2: 22429 },
  "Manipur": { pop: 2570390, areaKm2: 22327 },
  "Nagaland": { pop: 1978502, areaKm2: 16579 },
  "Goa": { pop: 1458545, areaKm2: 3702 },
  "Arunachal Pradesh": { pop: 1383727, areaKm2: 83743 },
  "Puducherry": { pop: 1247953, areaKm2: 479 },
  "Mizoram": { pop: 1097206, areaKm2: 21081 },
  "Chandigarh": { pop: 1055450, areaKm2: 114 },
  "Sikkim": { pop: 610577, areaKm2: 7096 },
  "Andaman and Nicobar Islands": { pop: 380581, areaKm2: 8249 },
  "Ladakh": { pop: 274289, areaKm2: 59146 },
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
