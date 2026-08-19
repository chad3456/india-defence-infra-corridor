import type { Series, Source, Category } from "./types";
import defenceRaw from "@/data/series/defence.json";
import infraRaw from "@/data/series/infrastructure.json";
import economyRaw from "@/data/series/economy.json";
import spaceRaw from "@/data/series/space.json";
import wdiRaw from "@/data/series/wdi.json";
import securityRaw from "@/data/series/security.json";
import securityCuratedRaw from "@/data/series/security-curated.json";
import sourcesRaw from "@/data/sources.json";

const ALL: Series[] = [
  ...(defenceRaw as Series[]),
  ...(infraRaw as Series[]),
  ...(economyRaw as Series[]),
  ...(spaceRaw as Series[]),
  ...(wdiRaw as Series[]),
  ...(securityRaw as Series[]),
  ...(securityCuratedRaw as Series[]),
];

const SERIES_BY_ID = new Map(ALL.map((s) => [s.id, s]));
const SOURCES_BY_ID = new Map((sourcesRaw as Source[]).map((s) => [s.id, s]));

export function getAllSeries(): Series[] {
  return ALL;
}

export function getSeries(id: string): Series | undefined {
  return SERIES_BY_ID.get(id);
}

export function getSeriesByCategory(category: Category): Series[] {
  return ALL.filter((s) => s.category === category);
}

export function getAllSources(): Source[] {
  return sourcesRaw as Source[];
}

export function getSource(id: string): Source | undefined {
  return SOURCES_BY_ID.get(id);
}

/** Every distinct source backing a series, series-level and point-level. */
export function sourcesForSeries(series: Series): Source[] {
  const ids = new Set<string>(series.sourceIds);
  for (const p of series.points) if (p.sourceId) ids.add(p.sourceId);
  return [...ids].map((id) => SOURCES_BY_ID.get(id)).filter((s): s is Source => Boolean(s));
}

/** Points that carry an actual number, in period order. */
export function definedPoints(series: Series) {
  return series.points.filter((p) => p.value !== null);
}

/**
 * Extract a sortable year from a period label.
 * "2024" -> 2024, "FY2024-25" -> 2024, "2020-2024" -> 2020, "Mar 2014" -> 2014.
 * Returns null for non-temporal labels like "Uttar Pradesh" or "PSLV".
 */
export function periodYear(period: string): number | null {
  const m = period.match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : null;
}

/** True when the series is a time series rather than a categorical breakdown. */
export function isTemporal(series: Series): boolean {
  const years = series.points.map((p) => periodYear(p.period));
  const withYears = years.filter((y) => y !== null);
  return withYears.length >= 2 && withYears.length === years.length;
}

export function sortedByPeriod(series: Series) {
  if (!isTemporal(series)) return series.points;
  return [...series.points].sort(
    (a, b) => (periodYear(a.period) ?? 0) - (periodYear(b.period) ?? 0),
  );
}

/** Series with at least `n` real values — used to gate transforms. */
export function hasAtLeast(series: Series, n: number): boolean {
  return definedPoints(series).length >= n;
}

export function latestPoint(series: Series) {
  const pts = sortedByPeriod(series).filter((p) => p.value !== null);
  return pts.length ? pts[pts.length - 1] : undefined;
}

export function firstPoint(series: Series) {
  const pts = sortedByPeriod(series).filter((p) => p.value !== null);
  return pts.length ? pts[0] : undefined;
}

export const DATA_COVERAGE = {
  seriesCount: ALL.length,
  sourceCount: (sourcesRaw as Source[]).length,
  pointCount: ALL.reduce((n, s) => n + s.points.filter((p) => p.value !== null).length, 0),
  wdiPending: (wdiRaw as Series[]).length === 0,
};
