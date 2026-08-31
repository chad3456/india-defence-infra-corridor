/**
 * Checking this site's numbers against the Indian government's own.
 *
 * Most of what is published here is multilateral — 696 series from the World
 * Bank against 37 from Indian official releases — and the evidence page already
 * says what that means: a multilateral body republishes national statistics it
 * does not collect, so those series are compilations rather than records.
 *
 * This goes one step further and *checks*. Where the site holds both a figure
 * from an Indian ministry and the World Bank's figure for the same quantity,
 * the two are compared year by year and the gap is published. A reader does not
 * have to take either on trust: they can see how far apart they are, in which
 * years, and read the reason.
 *
 * ── Why the gaps are expected, and why that is the point ─────────────────
 *
 * None of these pairs should match exactly, and a pair that matched exactly
 * would be the suspicious one — it would suggest one source is simply
 * republishing the other with no independent compilation. What matters is
 * whether the gap is small and stable, which means two bodies measuring the
 * same thing slightly differently, or large and erratic, which means they are
 * not measuring the same thing at all.
 *
 * So every pair carries the definitional difference in words. Foodgrains are
 * cereals plus pulses and the World Bank counts cereals alone, so a persistent
 * shortfall of roughly the pulse harvest is the correct result rather than a
 * discrepancy. Saying that up front is the difference between a check and an
 * accusation.
 *
 * ── What this is not ─────────────────────────────────────────────────────
 *
 * Not an adjudication. Where two sources differ this site does not declare a
 * winner, because it has no standing to: both are published by bodies with
 * better access to the underlying returns than this project has. The gap is
 * reported and the reader decides what it means.
 */
import type { Series } from "./types";
import { getSeries, definedPoints, periodYear } from "./data";

export interface Pair {
  id: string;
  /** What both series are trying to measure. */
  quantity: string;
  /** The Indian government series id. */
  officialId: string;
  /** The multilateral series id. */
  multilateralId: string;
  /**
   * Multiply the official value by this to reach the multilateral's unit.
   *
   * Stated per pair rather than inferred. A unit mismatch silently applied is
   * how a comparison turns into a fabricated discrepancy.
   */
  officialScale: number;
  /** The unit both are expressed in after scaling. */
  unit: string;
  /**
   * The ratio the official figure is expected to bear to the multilateral one.
   *
   * One where they should agree. Two where India counts an event twice and the
   * other counts it once — domestic air passengers, where a terminal figure
   * records a traveller on departure and again on arrival. Without this the
   * comparison flags a known and understood factor of two as a discrepancy
   * every single year, which trains a reader to ignore the flag.
   */
  expectedRatio: number;
  /** Why the two will not agree exactly, in words a reader can check. */
  expectedDifference: string;
  /** Beyond this, the gap is worth a reader's attention rather than routine. */
  tolerancePercent: number;
}

export const PAIRS: Pair[] = [
  {
    id: "foodgrains",
    quantity: "Foodgrain output in a crop year",
    officialId: "foodgrains-production",
    multilateralId: "wdi-ag-prd-crel-mt",
    // Official is million tonnes; the World Bank series is tonnes.
    officialScale: 1_000_000,
    unit: "tonnes",
    expectedRatio: 1,
    expectedDifference:
      "This one runs the wrong way and the site does not know why. Foodgrains are cereals plus pulses and the World Bank counts cereals alone, so India's figure should sit above it — instead it sits five to seven per cent below, consistently, across twelve years. Something in the two definitions does not line up the way the labels imply: a different crop-year boundary, or the Bank's cereal aggregate including what India books separately. Recorded rather than explained away, because a stable unexplained gap is more useful to a reader than a confident wrong reason.",
    tolerancePercent: 20,
  },
  {
    id: "merchandise-exports",
    quantity: "Merchandise exports in a year",
    officialId: "merchandise-exports",
    multilateralId: "wdi-merch-exports",
    // Official is US$ billion; the World Bank series is US dollars.
    officialScale: 1_000_000_000,
    unit: "current US$",
    expectedRatio: 1,
    expectedDifference:
      "The same quantity on two calendars. India reports the financial year April to March; the World Bank reports calendar years. A gap of a few per cent that moves with the trade cycle is the calendar, not a disagreement about the trade.",
    tolerancePercent: 10,
  },
  {
    id: "air-passengers",
    quantity: "Domestic air passengers in a year",
    officialId: "domestic-air-passengers",
    multilateralId: "wdi-air-passengers",
    officialScale: 1,
    unit: "passengers",
    // Terminals count a traveller twice, carriers once.
    expectedRatio: 2,
    expectedDifference:
      "Different objects counted, and the data confirms it. India's figure is passengers handled at domestic terminals, which records a traveller on departure and again on arrival; the World Bank counts passengers carried by registered carriers, which records them once. The observed ratio sits near two, which is what that difference predicts — so the comparison is made against a ratio of two rather than against equality, and it is a departure from two that would mean something.",
    tolerancePercent: 20,
  },
];

export interface YearComparison {
  year: number;
  official: number;
  multilateral: number;
  /** Official minus multilateral, in the shared unit. */
  difference: number;
  /** The gap as a share of the multilateral figure, before any expected ratio. */
  percent: number;
  /** How far the observed ratio sits from the expected one, as a share. */
  excessPercent: number;
}

export interface PairResult {
  pair: Pair;
  /** Both series were found and share at least one year. */
  comparable: boolean;
  /** Why not, when they are not. */
  reason?: string;
  years: YearComparison[];
  /**
   * Median absolute departure from the expected ratio, as a share.
   *
   * The headline number for the pair: near zero means the two bodies agree once
   * their definitions are accounted for, and a large value means they do not.
   */
  medianPercent: number | null;
  /** Years where the gap exceeded the stated tolerance. */
  outliers: YearComparison[];
  officialTitle?: string;
  multilateralTitle?: string;
}

/** Values by year, taking the first defined value for each year. */
function byYear(series: Series): Map<number, number> {
  const out = new Map<number, number>();
  for (const p of definedPoints(series)) {
    const y = periodYear(p.period);
    if (y === null || p.value === null) continue;
    if (!out.has(y)) out.set(y, p.value);
  }
  return out;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2 : (s[mid] ?? 0);
}

export function comparePair(pair: Pair): PairResult {
  const official = getSeries(pair.officialId);
  const multi = getSeries(pair.multilateralId);
  const base: PairResult = {
    pair,
    comparable: false,
    years: [],
    medianPercent: null,
    outliers: [],
    officialTitle: official?.title,
    multilateralTitle: multi?.title,
  };

  if (!official) return { ...base, reason: `${pair.officialId} is not on the site` };
  if (!multi) return { ...base, reason: `${pair.multilateralId} is not on the site` };

  const a = byYear(official);
  const b = byYear(multi);
  const shared = [...a.keys()].filter((y) => b.has(y)).sort((x, y) => x - y);
  if (shared.length === 0) {
    return { ...base, reason: "the two series share no year" };
  }

  const years: YearComparison[] = shared.map((year) => {
    const officialValue = (a.get(year) ?? 0) * pair.officialScale;
    const multilateral = b.get(year) ?? 0;
    const difference = officialValue - multilateral;
    const expected = multilateral * pair.expectedRatio;
    return {
      year,
      official: officialValue,
      multilateral,
      difference,
      percent: multilateral === 0 ? 0 : (difference / multilateral) * 100,
      // Measured against what the definitions predict, not against equality.
      excessPercent: expected === 0 ? 0 : ((officialValue - expected) / expected) * 100,
    };
  });

  return {
    ...base,
    comparable: true,
    years,
    medianPercent: median(years.map((y) => Math.abs(y.excessPercent))),
    outliers: years.filter((y) => Math.abs(y.excessPercent) > pair.tolerancePercent),
  };
}

export function buildVerification(): PairResult[] {
  return PAIRS.map(comparePair);
}
