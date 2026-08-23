import type { Series, Transform } from "./types";
import { definedPoints, periodYear, sortedByPeriod, isTemporal } from "./data";

export interface Datum {
  period: string;
  value: number;
  /** Original published value, kept for tooltips on derived charts. */
  raw?: number;
  note?: string;
  revised?: boolean;
  sourceId?: string;
}

/**
 * Apply a transform to a series.
 *
 * Every transform is lossless in the sense that it never invents a data point:
 * derived views are strictly shorter than or equal to the source series, and
 * gaps stay gaps. `yoy` and `delta` deliberately skip non-consecutive periods
 * rather than comparing across a hole in the data.
 */
export function applyTransform(series: Series, transform: Transform): Datum[] {
  const pts = sortedByPeriod(series)
    .filter((p) => p.value !== null)
    .map((p) => ({
      period: p.period,
      value: p.value as number,
      note: p.note,
      revised: p.revised,
      sourceId: p.sourceId,
    }));

  if (pts.length === 0) return [];

  switch (transform) {
    case "level":
      return pts;

    case "yoy": {
      const out: Datum[] = [];
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1]!;
        const cur = pts[i]!;
        const py = periodYear(prev.period);
        const cy = periodYear(cur.period);
        // Only compare genuinely adjacent periods.
        if (py !== null && cy !== null && cy - py !== 1) continue;
        if (prev.value === 0) continue;
        out.push({
          period: cur.period,
          value: ((cur.value - prev.value) / Math.abs(prev.value)) * 100,
          raw: cur.value,
        });
      }
      return out;
    }

    case "delta": {
      const out: Datum[] = [];
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1]!;
        const cur = pts[i]!;
        out.push({ period: cur.period, value: cur.value - prev.value, raw: cur.value });
      }
      return out;
    }

    case "index-2001": {
      const base = pts[0]!;
      if (base.value === 0) return [];
      return pts.map((p) => ({
        period: p.period,
        value: (p.value / base.value) * 100,
        raw: p.value,
      }));
    }

    case "share": {
      const total = pts.reduce((n, p) => n + p.value, 0);
      if (total === 0) return [];
      return pts.map((p) => ({
        period: p.period,
        value: (p.value / total) * 100,
        raw: p.value,
      }));
    }

    case "cagr": {
      const out: Datum[] = [];
      const base = pts[0]!;
      const baseYear = periodYear(base.period);
      if (baseYear === null || base.value <= 0) return [];
      for (let i = 1; i < pts.length; i++) {
        const cur = pts[i]!;
        const y = periodYear(cur.period);
        if (y === null || cur.value <= 0 || y === baseYear) continue;
        const years = y - baseYear;
        out.push({
          period: cur.period,
          value: (Math.pow(cur.value / base.value, 1 / years) - 1) * 100,
          raw: cur.value,
        });
      }
      return out;
    }

    case "per-capita":
      // Handled by the registry only when a population series is available;
      // falls back to level so a mis-specified chart degrades rather than lies.
      return pts;

    default:
      return pts;
  }
}

/** Whether a transform produces something meaningful for this series. */
export function transformIsValid(series: Series, transform: Transform): boolean {
  const n = definedPoints(series).length;
  // Time transforms need a time axis, and this did not check for one.
  //
  // A categorical series — suicide rate by age band, exports by destination,
  // launches by vehicle — has periods that are labels, not dates. Year-on-year
  // change between "10–19" and "20–29" is not a change over time; indexing an
  // age profile to "first year = 100" indexes it to whichever band happens to
  // sort first. Both rendered happily and meant nothing, which is worse than
  // failing.
  //
  // Share and level are unaffected: a share of total across categories is a
  // legitimate reading, and arguably the more natural one.
  const overTime = isTemporal(series);
  switch (transform) {
    case "level":
      return n >= 1;
    case "yoy":
      return overTime && applyTransform(series, "yoy").length >= 2;
    case "delta":
      return overTime && n >= 3;
    case "index-2001":
      return overTime && n >= 3 && (definedPoints(series)[0]?.value ?? 0) !== 0;
    case "share":
      return n >= 2 && definedPoints(series).every((p) => (p.value ?? 0) >= 0);
    case "cagr":
      return overTime && applyTransform(series, "cagr").length >= 2;
    case "per-capita":
      return false;
    default:
      return false;
  }
}

export const TRANSFORM_LABELS: Record<Transform, string> = {
  level: "As published",
  yoy: "Year-on-year change",
  "index-2001": "Indexed to first year = 100",
  cagr: "Compound annual growth since first year",
  share: "Share of total",
  "per-capita": "Per capita",
  delta: "Absolute change vs prior period",
};

export const TRANSFORM_UNITS: Record<Transform, string | null> = {
  level: null,
  yoy: "%",
  "index-2001": "index",
  cagr: "% p.a.",
  share: "%",
  "per-capita": null,
  delta: null,
};

export function formatNumber(v: number, unitShort: string): string {
  const abs = Math.abs(v);
  let s: string;
  if (abs >= 1e12) s = (v / 1e12).toFixed(2) + "T";
  else if (abs >= 1e9) s = (v / 1e9).toFixed(2) + "B";
  else if (abs >= 1e7) s = (v / 1e7).toFixed(2) + "Cr";
  else if (abs >= 1e5) s = (v / 1e5).toFixed(2) + "L";
  else if (abs >= 1000) s = v.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  else if (abs >= 10) s = v.toFixed(1).replace(/\.0$/, "");
  else s = v.toFixed(2).replace(/\.00$/, "");
  return unitShort ? `${s} ${unitShort}` : s;
}

export function formatAxis(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e12) return (v / 1e12).toFixed(1).replace(/\.0$/, "") + "T";
  if (abs >= 1e9) return (v / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  if (abs >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (abs >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  if (abs >= 10) return v.toFixed(0);
  if (abs === 0) return "0";
  return v.toFixed(1);
}
