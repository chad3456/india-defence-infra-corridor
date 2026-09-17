/**
 * The OWID indicator registry, read from disk.
 *
 * Server-only. The registry is sharded — a thousand indicators' series is too
 * much to hold in one file and far too much to send to a browser — so every
 * accessor here takes a slug and loads only the shard it needs.
 *
 * ── The rule this module enforces ────────────────────────────────────────
 *
 * No indicator is returned without its unit and its attribution. They are not
 * optional decoration on a page with a thousand numbers on it: at that volume
 * a reader cannot possibly hold in their head what each one measures or who
 * measured it, so the unit travels with the value everywhere it goes, and a
 * chart component that does not print it is the bug.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface Indicator {
  slug: string;
  title: string;
  subtitle: string;
  column: string;
  unit: string;
  shortUnit: string;
  description: string;
  attribution: string;
  citation: string;
  timespan: string;
  category: string;
  tiers: { series: boolean; map: boolean };
  countriesWithData: number;
  hasIndia: boolean;
  shard: number;
  firstYear: number | null;
  lastYear: number | null;
}

export interface SeriesRow { iso: string; years: number[]; values: number[] }
export interface MapRow { iso: string; year: number; value: number }

export interface Registry {
  present: boolean;
  builtAt: string;
  source: string;
  method: string;
  attribution: string;
  refusal: string;
  cannotSay: string[];
  comparators: string[];
  counts: {
    slugsDiscovered: number;
    slugsAttempted: number;
    indicators: number;
    withMapTier: number;
    withIndia: number;
    skipped: number;
    shards: number;
  };
  byCategory: Array<{ key: string; n: number }>;
  discovery: string;
  stoppedEarly: string;
  indicators: Indicator[];
}

const EMPTY: Registry = {
  present: false, builtAt: "", source: "", method: "", attribution: "", refusal: "",
  cannotSay: [], comparators: [],
  counts: { slugsDiscovered: 0, slugsAttempted: 0, indicators: 0, withMapTier: 0, withIndia: 0, skipped: 0, shards: 0 },
  byCategory: [], discovery: "", stoppedEarly: "", indicators: [],
};

let cached: Registry | null = null;

export function loadRegistry(): Registry {
  if (cached) return cached;
  try {
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), "data/owid/index.json"), "utf8"),
    ) as Partial<Registry>;
    cached = { ...EMPTY, ...raw, present: (raw.indicators?.length ?? 0) > 0 };
  } catch {
    cached = EMPTY;
  }
  return cached;
}

export function indicator(d: Registry, slug: string): Indicator | undefined {
  return d.indicators.find((i) => i.slug === slug);
}

const shardCache = new Map<string, Record<string, unknown>>();

function readShard(kind: "series" | "map", shard: number): Record<string, unknown> {
  const key = `${kind}/${shard}`;
  const hit = shardCache.get(key);
  if (hit) return hit;
  try {
    const parsed = JSON.parse(
      readFileSync(join(process.cwd(), "data/owid", kind, `${shard}.json`), "utf8"),
    ) as Record<string, unknown>;
    shardCache.set(key, parsed);
    return parsed;
  } catch {
    shardCache.set(key, {});
    return {};
  }
}

/** One indicator's comparator series, or an empty list. Never a partial guess. */
export function seriesFor(ind: Indicator): SeriesRow[] {
  const rows = readShard("series", ind.shard)[ind.slug];
  return Array.isArray(rows) ? (rows as SeriesRow[]) : [];
}

/** One indicator's latest value per country, for the map. Empty when no map tier. */
export function mapFor(ind: Indicator): MapRow[] {
  if (!ind.tiers.map) return [];
  const rows = readShard("map", ind.shard)[ind.slug];
  return Array.isArray(rows) ? (rows as MapRow[]) : [];
}

/** The series for one country, with its years, as a chart wants it. */
export function countrySeries(rows: SeriesRow[], iso: string): Array<{ year: number; value: number }> {
  const row = rows.find((r) => r.iso === iso);
  if (!row) return [];
  return row.years
    .map((year, i) => ({ year, value: row.values[i] ?? Number.NaN }))
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => a.year - b.year);
}

/** The latest point of a country's series, or null. */
export function latestOf(rows: SeriesRow[], iso: string): { year: number; value: number } | null {
  const s = countrySeries(rows, iso);
  return s[s.length - 1] ?? null;
}

/**
 * A value printed with the precision it deserves and never more.
 *
 * OWID serves full float precision, and a modelled estimate rendered as
 * 41.6251280877573 claims a confidence nothing supports. Large numbers get
 * thousands separators, small ones get decimals, and nothing gets fifteen
 * significant figures.
 */
export function fmt(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${(v / 1e12).toFixed(2)} trillion`;
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)} billion`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)} million`;
  if (abs >= 1000) return Math.round(v).toLocaleString("en-US");
  if (abs >= 10) return v.toFixed(1);
  if (abs >= 1) return v.toFixed(2);
  if (abs === 0) return "0";
  return v.toPrecision(2);
}

/** The compact shape a picker sends to the browser. Never the whole registry. */
export interface PickerRow {
  slug: string;
  title: string;
  category: string;
  map: boolean;
  unit: string;
}

export function pickerRows(d: Registry): PickerRow[] {
  return d.indicators.map((i) => ({
    slug: i.slug,
    title: i.title,
    category: i.category,
    map: i.tiers.map,
    // The unit is in the picker too, because two indicators with near-identical
    // titles are routinely different measures of the same thing and the unit is
    // the only thing that tells them apart.
    unit: i.shortUnit || i.unit,
  }));
}
