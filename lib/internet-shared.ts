/**
 * Types for /internet, the state-of-the-internet essay, shared by the
 * connector, the server loader and the client components. No node imports:
 * the client bundle reads this file.
 */

/** [year, value] pairs, oldest first, nulls dropped. */
export type YearSeries = Array<[number, number]>;

export interface WbCountry {
  name: string;
  region: string;
  income: string;
}

export interface WbIndicator {
  name: string;
  /** World Bank's own source note, abridged to the first sentence. */
  note: string;
  values: Record<string, YearSeries>;
}

export interface ItuBasketRow {
  iso3: string;
  economy: string;
  code: string;
  basket: string;
  unit: "GNIpc" | "USD" | "PPP";
  values: Record<string, number>;
}

export interface ItuMedianRow {
  code: string;
  unit: string;
  grouping: string;
  group: string;
  values: Record<string, number>;
}

/** One row of ITU's plan-level allowance table: the plan ITU priced. */
export interface ItuPlan {
  economy: string;
  iso3: string | null;
  gniPct: number | null;
  usd: number | null;
  ppp: number | null;
  provider: string;
  /** Monthly data allowance (mobile) or cap (fixed) in GB; null = unlimited or unstated. */
  gb: number | null;
  unlimited: boolean;
  speedMbps: number | null;
  technology: string;
}

export interface CableCountry {
  /** Distinct cables with at least one landing in the country. */
  cables: number;
  /** Landing points in the country. */
  landings: number;
}

export interface Constellation {
  /** In orbit (no decay date) and flagged operational, partial, backup, spare or extended. */
  active: number;
  /** Launched and not yet decayed, whatever its status. */
  inOrbit: number;
  launched: number;
  decayed: number;
  launchedByYear: Record<string, number>;
  decayedByYear: Record<string, number>;
}

export interface InternetData {
  generatedAt: string;
  worldBank: {
    url: string;
    countries: Record<string, WbCountry>;
    /** Aggregates the page draws: WLD and the four income groups. */
    aggregates: Record<string, string>;
    indicators: Record<string, WbIndicator>;
  } | null;
  itu: {
    url: string;
    allowanceUrl: string;
    baskets: ItuBasketRow[];
    medians: ItuMedianRow[];
    mobile: ItuPlan[];
    fixed: ItuPlan[];
    mobileTitle: string;
    fixedTitle: string;
  } | null;
  peeringdb: { url: string; total: number; byCountry: Record<string, number> } | null;
  cables: {
    url: string;
    total: number;
    /** Keyed by ISO3 where the country name was matched; unmatched names listed separately. */
    byCountry: Record<string, CableCountry>;
    unmatched: string[];
    /** True when per-cable files were read; false when only landing points were counted. */
    perCable: boolean;
  } | null;
  satcat: {
    url: string;
    rows: number;
    activePayloads: number;
    activeByOwner: Record<string, number>;
    constellations: Record<string, Constellation>;
  } | null;
  errors: string[];
}

export interface SpeedCountry {
  name: string;
  isoN: string;
  downMbps: number;
  upMbps: number;
  latencyMs: number;
  tests: number;
  tiles: number;
}

export interface Speeds {
  generatedAt: string;
  year: number;
  quarter: number;
  source: string;
  method: string;
  borders?: string;
  minTests: Record<string, number>;
  fixed: { countries: Record<string, SpeedCountry>; tiles: number; tests: number; unplacedTiles: number; url: string };
  mobile: { countries: Record<string, SpeedCountry>; tiles: number; tests: number; unplacedTiles: number; url: string };
}

/** A hand-entered figure or event. Every one carries the page that states it. */
export interface Cite {
  publisher: string;
  title: string;
  url: string;
  accessed: string;
}

export interface CuratedShutdownYear {
  year: number;
  global: number | null;
  countries: number | null;
  india: number | null;
  note?: string;
  cite: Cite[];
}

export interface CaseStudy {
  id: string;
  date: string;
  place: string;
  /** Lower-case ISO3 for the map pin; null when the event has no single country. */
  iso3: string | null;
  title: string;
  /** What happened, as the sources state it. */
  what: string;
  /** What it shows about sovereignty or security, and how strong the evidence is. */
  why: string;
  /** Whose word it is: "company", "government", "court", "press", "biography". */
  claimant: string;
  cite: Cite[];
}

export interface CuratedInternet {
  updated: string;
  shutdowns: {
    years: CuratedShutdownYear[];
    latest: { year: number; byCountry: Array<{ iso3: string; name: string; count: number }>; cite: Cite[] };
  };
  starlinkSubscribers: Array<{ date: string; subscribers: number; countries: number | null; cite: Cite[] }>;
  cases: CaseStudy[];
  indiaConditions: { granted: Array<{ date: string; what: string; cite: Cite[] }>; conditions: Array<{ rule: string; why: string; cite: Cite[] }> };
}

/* ── what the server hands the page ─────────────────────────────────────── */

export interface MapShape {
  iso3: string;
  name: string;
  d: string;
  cx: number;
  cy: number;
  tiny: boolean;
}

export interface MapLayer {
  id: string;
  title: string;
  unit: string;
  /** Ascending thresholds for the colour classes; values below the first take class 0. */
  breaks: number[];
  /** True when larger is worse (price), so the ramp reads the other way. */
  invert?: boolean;
  values: Record<string, number>;
  year: string;
  source: string;
  derived?: string;
  note?: string;
}

export interface BarDatum {
  iso3: string;
  name: string;
  value: number;
  /** Second value for dumbbells. */
  value2?: number;
  label?: string;
}

export interface ScatterDatum {
  iso3: string;
  name: string;
  x: number;
  y: number;
  r?: number;
  group?: string;
}

export interface LineSeries {
  id: string;
  name: string;
  points: YearSeries;
  highlight?: boolean;
}

export type ChartBody =
  | { kind: "map"; layer: MapLayer }
  | { kind: "bars"; data: BarDatum[]; unit: string; reference?: { value: number; label: string }; highlight?: string[] }
  | { kind: "dumbbell"; data: BarDatum[]; unit: string; labels: [string, string] }
  | { kind: "scatter"; data: ScatterDatum[]; x: string; y: string; logX?: boolean; logY?: boolean; reference?: { x?: number; y?: number; label: string } }
  | { kind: "lines"; series: LineSeries[]; unit: string; reference?: { value: number; label: string } }
  | { kind: "columns"; data: Array<{ label: string; value: number; value2?: number }>; unit: string; labels?: [string, string]; claim?: boolean }
  | { kind: "waffle"; cells: Array<{ label: string; value: number; tone: "red" | "blue" | "grey" }>; per: number; unit: string }
  | { kind: "awaiting"; reason: string };

export interface ChartView {
  n: number;
  id: string;
  part: "access" | "speed" | "price" | "plumbing" | "control" | "sky";
  title: string;
  dek: string;
  body: ChartBody;
  source: string;
  sourceUrl: string;
  derived?: string;
  note?: string;
  /** Further sources for a claim the dek makes beyond the chart's own data. */
  also?: Array<{ label: string; url: string }>;
}

export interface InternetView {
  present: boolean;
  generatedAt: string | null;
  speedsQuarter: string | null;
  map: { w: number; h: number; shapes: MapShape[] };
  charts: ChartView[];
  headline: Array<{ label: string; value: string; sub: string }>;
  curated: CuratedInternet;
  cases: Array<CaseStudy & { x: number | null; y: number | null }>;
  sources: Array<{ name: string; url: string; what: string; licence?: string }>;
}
