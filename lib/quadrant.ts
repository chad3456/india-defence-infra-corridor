/**
 * The development matrix.
 *
 * A two-by-two placing every comparable series on two axes:
 *
 *   Standing  — where India sits against its five comparators today.
 *   Momentum  — which way it has moved over the period.
 *
 * Both are signed by `higherIsBetter`, so "good" always points the same way
 * regardless of whether the underlying number rises or falls when things
 * improve. Undernourishment falling and exports rising both read as positive
 * momentum; that is the only way a mixed panel can share a quadrant scheme.
 *
 *   ┌───────────────────────┬───────────────────────┐
 *   │ HOLDING GROUND        │ COMPOUNDING           │
 *   │ ahead, losing pace    │ ahead, still gaining  │
 *   ├───────────────────────┼───────────────────────┤
 *   │ FALLING BEHIND        │ CATCHING UP           │
 *   │ behind, getting worse │ behind, closing fast  │
 *   └───────────────────────┴───────────────────────┘
 *
 * The names are deliberately not "good" and "bad". A series can be behind and
 * closing fast, which is the ordinary shape of development and is not failure;
 * and one can be ahead and stalling, which is not success. The quadrant that
 * usually matters most is holding ground — an advantage being spent — and it is
 * the one a league table of levels would hide entirely.
 *
 * ── What this is not ─────────────────────────────────────────────────────
 *
 * Every placement is computed from the series' own points and peer values.
 * Nothing is assigned by hand, which is the same rule the Tonality Score
 * follows and for the same reason: a matrix whose quadrants encode the
 * author's opinion is an argument wearing a chart's clothes.
 *
 * A series is placed only when it has enough history and at least two peers to
 * be compared against. Anything else is returned as unplaceable with a reason,
 * and the page says so rather than dropping it silently.
 */
import type { Series } from "./types";
import { definedPoints, periodYear } from "./data";

export type Quadrant = "compounding" | "catching-up" | "holding-ground" | "falling-behind";

export const QUADRANTS: Array<{
  id: Quadrant;
  label: string;
  meaning: string;
  /** Where it sits in the grid, for layout. */
  standing: "ahead" | "behind";
  momentum: "gaining" | "losing";
}> = [
  {
    id: "compounding",
    label: "Compounding",
    meaning: "Ahead of the comparators and still pulling away. The genuine strengths.",
    standing: "ahead",
    momentum: "gaining",
  },
  {
    id: "catching-up",
    label: "Catching up",
    meaning:
      "Behind the comparators but closing. The ordinary shape of development, and not a failure.",
    standing: "behind",
    momentum: "gaining",
  },
  {
    id: "holding-ground",
    label: "Holding ground",
    meaning:
      "Ahead, but the lead is narrowing. An advantage being spent — the quadrant a league table of levels hides.",
    standing: "ahead",
    momentum: "losing",
  },
  {
    id: "falling-behind",
    label: "Falling behind",
    meaning: "Behind the comparators and losing further ground. The honest failures.",
    standing: "behind",
    momentum: "losing",
  },
];

export interface Placement {
  seriesId: string;
  title: string;
  category: Series["category"];
  quadrant: Quadrant;
  /** −1 … +1. Positive means better than the median comparator. */
  standing: number;
  /** −1 … +1. Positive means improving in the direction that is good. */
  momentum: number;
  /** The values behind the two axes, so a reader can check the placement. */
  detail: {
    latest: number;
    latestPeriod: string;
    first: number;
    firstPeriod: string;
    peerMedian: number;
    peerCount: number;
    changePercent: number;
  };
  confidence: Series["confidence"];
}

export interface Unplaceable {
  seriesId: string;
  title: string;
  reason: string;
}

/** Series need this many defined points before a trend means anything. */
const MIN_POINTS = 5;
/** And this many peers before "ahead" or "behind" means anything. */
const MIN_PEERS = 2;

/** Squash an unbounded ratio into −1 … +1 without a hard cut-off. */
function squash(x: number, scale: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.tanh(x / scale);
}

function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2 : (s[mid] ?? 0);
}

/**
 * Place one series, or explain why it cannot be placed.
 *
 * `higherIsBetter: null` is a refusal, not an omission. Defence spending and
 * arms imports are deliberately undirected on this site — whether more is
 * better is the argument, not the data — so they cannot be scored on an axis
 * that runs from worse to better.
 */
export function place(series: Series): Placement | Unplaceable {
  const base = { seriesId: series.id, title: series.title };

  if (series.higherIsBetter === null) {
    return {
      ...base,
      reason: "No agreed direction of good — placing it would smuggle in a judgement the data does not make.",
    };
  }

  const points = definedPoints(series);
  if (points.length < MIN_POINTS) {
    return { ...base, reason: `Only ${points.length} data point(s); a trend needs at least ${MIN_POINTS}.` };
  }

  const sorted = [...points].sort((a, b) => (periodYear(a.period) ?? 0) - (periodYear(b.period) ?? 0));
  const firstPoint = sorted[0];
  const lastPoint = sorted[sorted.length - 1];
  if (!firstPoint || !lastPoint || firstPoint.value === null || lastPoint.value === null) {
    return { ...base, reason: "Endpoints are missing." };
  }

  const peers = (series.peers ?? []).filter((p) => Number.isFinite(p.value));
  if (peers.length < MIN_PEERS) {
    return { ...base, reason: `Only ${peers.length} comparator value(s); needs ${MIN_PEERS}.` };
  }

  const dir = series.higherIsBetter ? 1 : -1;
  const latest = lastPoint.value;
  const first = firstPoint.value;
  const peerMedian = median(peers.map((p) => p.value));

  // Standing: how far from the median comparator, as a share of that median,
  // signed so positive always means better.
  const gap = peerMedian === 0 ? 0 : (latest - peerMedian) / Math.abs(peerMedian);
  const standing = squash(gap * dir, 0.5);

  // Momentum: growth measured multiplicatively, because this dataset is full
  // of series that grew several-fold over two decades. A share-of-start
  // measure saturates almost everything at the ceiling — the first version of
  // this chart drew forty points in a line along the top edge, which says
  // "they all went up" and nothing else. A doubling scores 0.3, ten-fold 0.8,
  // hundred-fold 0.98, so the spread stays readable across three orders of
  // magnitude.
  const changePercent = first === 0 ? 0 : ((latest - first) / Math.abs(first)) * 100;
  const canRatio = first > 0 && latest > 0;
  const growth = canRatio ? Math.log2(latest / first) : changePercent / 100;
  const momentum = squash(growth * dir, canRatio ? 3 : 1.5);

  const quadrant: Quadrant =
    standing >= 0
      ? momentum >= 0
        ? "compounding"
        : "holding-ground"
      : momentum >= 0
        ? "catching-up"
        : "falling-behind";

  return {
    ...base,
    category: series.category,
    quadrant,
    standing: Math.round(standing * 1000) / 1000,
    momentum: Math.round(momentum * 1000) / 1000,
    confidence: series.confidence,
    detail: {
      latest,
      latestPeriod: lastPoint.period,
      first,
      firstPeriod: firstPoint.period,
      peerMedian: Math.round(peerMedian * 1000) / 1000,
      peerCount: peers.length,
      changePercent: Math.round(changePercent * 10) / 10,
    },
  };
}

export function isPlaced(x: Placement | Unplaceable): x is Placement {
  return "quadrant" in x;
}

export interface MatrixResult {
  placed: Placement[];
  unplaceable: Unplaceable[];
  byQuadrant: Record<Quadrant, Placement[]>;
}

export function buildMatrix(all: Series[]): MatrixResult {
  const results = all.map(place);
  const placed = results.filter(isPlaced);
  const unplaceable = results.filter((r): r is Unplaceable => !isPlaced(r));

  const byQuadrant = {
    compounding: [] as Placement[],
    "catching-up": [] as Placement[],
    "holding-ground": [] as Placement[],
    "falling-behind": [] as Placement[],
  };
  for (const p of placed) byQuadrant[p.quadrant].push(p);
  // Strongest signal first within each quadrant.
  for (const q of Object.keys(byQuadrant) as Quadrant[]) {
    byQuadrant[q].sort(
      (a, b) => Math.hypot(b.standing, b.momentum) - Math.hypot(a.standing, a.momentum),
    );
  }

  return { placed, unplaceable, byQuadrant };
}
