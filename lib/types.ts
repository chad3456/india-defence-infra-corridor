/**
 * Core data model.
 *
 * Design rule: every number rendered on this site must be traceable to a named
 * source with a URL and a verification date. A series that cannot satisfy that
 * does not ship — `scripts/validate.ts` enforces it at build time.
 */

export type Category =
  | "defence"
  | "infrastructure"
  | "economy"
  | "trade"
  | "manufacturing"
  | "space"
  | "quality-of-life"
  | "social"
  | "real-estate"
  | "energy"
  | "security"
  | "ai-science";

export const CATEGORIES: Category[] = [
  "defence",
  "infrastructure",
  "economy",
  "trade",
  "manufacturing",
  "space",
  "quality-of-life",
  "social",
  "real-estate",
  "energy",
  "security",
  "ai-science",
];

export const CATEGORY_LABELS: Record<Category, string> = {
  defence: "Defence",
  infrastructure: "Infrastructure",
  economy: "Economy",
  trade: "Trade",
  manufacturing: "Manufacturing",
  space: "Space",
  "quality-of-life": "Quality of life",
  social: "Social",
  "real-estate": "Real estate",
  energy: "Energy",
  security: "Internal security",
  "ai-science": "AI & science",
};

/**
 * How far the underlying claim is from a primary record.
 *
 *  - `official`     : Indian government primary release (PIB, ministry, RBI, budget doc)
 *  - `multilateral` : World Bank / UN / IMF / IEA style cross-country statistical body
 *  - `think-tank`   : SIPRI, IISS, FAS and similar — expert estimates, not records
 *  - `press`        : reported figure, no primary document located
 *  - `derived`      : computed here from other series (ratios, indices, growth rates)
 */
export type Provenance =
  | "official"
  | "multilateral"
  | "think-tank"
  | "press"
  | "derived";

/**
 * Confidence is about the *number*, not the source's prestige.
 *
 *  - `high`   : primary document, unambiguous definition, cross-checked
 *  - `medium` : reliable source but definition drifts between releases, or the
 *               figure is routinely revised
 *  - `low`    : estimate, single-sourced, or a contested/opaque methodology
 *               (nuclear warheads and defence order-books both live here)
 */
export type Confidence = "high" | "medium" | "low";

export type Frequency =
  | "annual"
  | "fiscal-year"
  | "quarterly"
  | "monthly"
  | "point-in-time";

export interface Source {
  id: string;
  /** Short human label, e.g. "PIB — Defence production FY25". */
  name: string;
  /** Organisation that stands behind the number. */
  publisher: string;
  url: string;
  provenance: Provenance;
  /** ISO date this URL was last checked by a human or the ETL. */
  accessed: string;
  /**
   * 1 = primary record holder for this quantity.
   * 2 = credible secondary compiler.
   * 3 = press report of a primary claim.
   */
  tier: 1 | 2 | 3;
}

export interface DataPoint {
  /** "2024" for calendar years, "FY2024-25" for Indian fiscal years. */
  period: string;
  /** null = genuinely unknown. Never fill gaps with zero or interpolation. */
  value: number | null;
  /** Overrides the series-level source when a single point came from elsewhere. */
  sourceId?: string;
  /** True when the publisher later restated this figure. */
  revised?: boolean;
  /** Point-specific caveat, surfaced in the chart tooltip. */
  note?: string;
}

export interface Series {
  id: string;
  title: string;
  /** One line explaining exactly what is being counted. */
  definition: string;
  category: Category;
  /** Full unit, e.g. "₹ crore (nominal)". */
  unit: string;
  /** Axis-length unit, e.g. "₹ cr". */
  unitShort: string;
  frequency: Frequency;
  /**
   * Direction of "good". null where the framing is contested — arms imports
   * and defence spending are deliberately null, not "bad" or "good".
   */
  higherIsBetter: boolean | null;
  points: DataPoint[];
  /** Series-level default sources. At least one is required. */
  sourceIds: string[];
  provenance: Provenance;
  confidence: Confidence;
  /** ISO date the series as a whole was last reconciled against sources. */
  lastVerified: string;
  /** Caveats shown under the chart. Definition breaks belong here. */
  notes?: string[];
  /** Peer-country values for the same measure, for honest benchmarking. */
  peers?: PeerValue[];
}

export interface PeerValue {
  country: string;
  iso3: string;
  value: number;
  period: string;
  sourceId: string;
}

/* ------------------------------------------------------------------ */
/* Charts                                                             */
/* ------------------------------------------------------------------ */

export type ChartKind =
  | "line"
  | "area"
  | "stacked-area"
  | "bar"
  | "column"
  | "stacked-bar"
  | "grouped-bar"
  | "scatter"
  | "dot"
  | "lollipop"
  | "slope"
  | "heatmap"
  | "small-multiples"
  | "dumbbell"
  | "waterfall"
  | "step"
  | "range";

/**
 * A transform turns one stored series into an additional, honest view of the
 * same data. Every transformed chart is labelled with how it was derived so a
 * reader can tell a measured number from a computed one.
 */
export type Transform =
  | "level" // as published
  | "yoy" // year-on-year % change
  | "index-2001" // rebased to first available year on/after 2001 = 100
  | "cagr" // trailing compound annual growth rate
  | "share" // share of series total
  | "per-capita" // divided by population
  | "delta"; // absolute change vs prior period

export interface ChartSpec {
  id: string;
  title: string;
  /** What the reader should take away. Shown under the title. */
  subtitle?: string;
  kind: ChartKind;
  category: Category;
  /** One or more series ids. Multi-series charts compare or stack them. */
  seriesIds: string[];
  transform: Transform;
  /** Peer comparison charts render the `peers` block instead of the time axis. */
  peerView?: boolean;
  /** Tags drive the gallery filter. */
  tags: string[];
  /** Optional editorial note rendered beneath the chart. */
  annotation?: string;
}

/* ------------------------------------------------------------------ */
/* Live tracker                                                       */
/* ------------------------------------------------------------------ */

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  outlet: string;
  publishedAt: string;
  summary?: string;
  /** Topic buckets assigned by keyword match in the ingest step. */
  topics: string[];
}

export interface PipelineRun {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: "ok" | "partial" | "failed";
  connectorsRun: number;
  connectorsFailed: number;
  seriesUpdated: number;
  messages: string[];
}

/* ------------------------------------------------------------------ */
/* Development events (map)                                           */
/* ------------------------------------------------------------------ */

export type EventCategory =
  | "startups"
  | "infrastructure"
  | "defence"
  | "roads-airports"
  | "pipelines"
  | "exports"
  | "trade-deals"
  | "psu-msme"
  | "manufacturing"
  | "energy"
  | "space"
  | "ports";

/**
 * A dated, geo-located development event.
 *
 * Events are reported activity, not measured data — they never feed a chart
 * series. Each carries the outlet that reported it and a link, so a reader can
 * check the claim rather than take the pin on trust.
 */
export interface DevEvent {
  id: string;
  title: string;
  category: EventCategory;
  /** ISO date the event was reported. */
  date: string;
  /** Gazetteer place id, or null when no location could be determined. */
  placeId: string | null;
  placeName: string | null;
  state: string | null;
  /** [longitude, latitude]; null when unplaceable. */
  coords: [number, number] | null;
  outlet: string;
  url: string;
  summary?: string;
  /**
   * `verified` — corroborated against a primary release or an official source.
   * `reported`  — single press report, taken at face value and labelled as such.
   */
  status: "verified" | "reported";
}
