/**
 * The hundred panels, selected by coverage and never by direction.
 *
 * ── The trap this module exists to avoid ─────────────────────────────────
 *
 * "A hundred visual stories on India's growth" has an obvious implementation:
 * find the hundred indicators that rose the most and draw them. That produces
 * a wall of up-and-to-the-right which is not a finding about India, it is a
 * finding about the sort. Every country on earth has a hundred rising
 * indicators, and a page built that way would be a brochure with citations.
 *
 * So the selection rule here is mechanical and blind to direction: indicators
 * are ranked by how much DATA they have for India — length of series, recency,
 * comparator coverage — balanced across categories, and whatever they show is
 * what gets drawn. The mix of rising and falling panels is then a result
 * rather than a choice, and the page can report it.
 *
 * ── The judgement this module refuses to make ────────────────────────────
 *
 * Rising is not improving. CO2 per head rising is not the same kind of fact as
 * literacy rising, and OWID's metadata does not carry a reliable direction
 * flag. Rather than guess, nothing here labels a change as good or bad: panels
 * say "rose" and "fell", the page says plainly that it does not know which
 * direction is desirable for each indicator, and the reader supplies what the
 * data cannot.
 *
 * That refusal is the difference between a hundred charts and a hundred
 * claims.
 */
import {
  type Registry, type Indicator, seriesFor, countrySeries, latestOf,
} from "./owid";

export interface Panel {
  indicator: Indicator;
  india: Array<{ year: number; value: number }>;
  first: { year: number; value: number };
  last: { year: number; value: number };
  /** Percentage change first to last. Null when the first value is zero. */
  changePct: number | null;
  /** Absolute change, always defined. */
  changeAbs: number;
  direction: "rose" | "fell" | "flat";
  /** India's rank among the comparators that have a value, 1 = highest. */
  rank: number;
  of: number;
  /** How the selector scored it. Published so the ordering is inspectable. */
  score: number;
}

/**
 * Whether a change is big enough to call a direction.
 *
 * A tenth of a per cent over twenty years is a flat series with noise on it,
 * and calling that "rose" would put a hundred meaningless arrows on the page.
 */
const FLAT_BAND_PCT = 2;

/**
 * Coverage score: how much this indicator actually says about India.
 *
 * Deliberately made of things that are facts about the data rather than about
 * the values — span, point count, recency, how many comparators can be set
 * beside it. Nothing in this function can see whether the series goes up.
 */
function coverageScore(ind: Indicator, points: number, span: number, comparators: number): number {
  const recency = ind.lastYear ? Math.max(0, 1 - (2026 - ind.lastYear) / 20) : 0;
  return (
    Math.min(span, 60) * 1.0
    + Math.min(points, 60) * 0.5
    + recency * 30
    + comparators * 3
    + (ind.tiers.map ? 10 : 0)
  );
}

/**
 * Build the panels.
 *
 * `perCategory` caps how many any one subject can contribute, so a registry
 * that happens to carry three hundred health indicators cannot turn a page
 * about India's growth into a page about Indian health.
 */
export function buildPanels(
  reg: Registry,
  {
    limit = 100,
    perCategory = 14,
    readSeries = seriesFor,
  }: {
    limit?: number;
    perCategory?: number;
    /**
     * How to fetch an indicator's series. Defaults to reading the shard files.
     *
     * A seam rather than a mock, because the honesty claim this module makes —
     * that the selector cannot see which way a series points — is only worth
     * the test that holds it, and ES module exports cannot be monkeypatched.
     * One optional parameter buys a test that reverses every series and
     * asserts the same indicators come out in the same order.
     */
    readSeries?: (ind: Indicator) => ReturnType<typeof seriesFor>;
  } = {},
): Panel[] {
  const scored: Panel[] = [];

  for (const ind of reg.indicators) {
    if (!ind.hasIndia) continue;
    const rows = readSeries(ind);
    const india = countrySeries(rows, "IND");
    if (india.length < 5) continue;

    const first = india[0]!;
    const last = india[india.length - 1]!;
    const span = last.year - first.year;
    if (span < 10) continue;

    const comparatorValues = reg.comparators
      .map((iso) => ({ iso, point: latestOf(rows, iso) }))
      .filter((c): c is { iso: string; point: { year: number; value: number } } => c.point !== null);
    if (comparatorValues.length < 3) continue;

    const changeAbs = last.value - first.value;
    const changePct = first.value === 0 ? null : (changeAbs / Math.abs(first.value)) * 100;
    const direction: Panel["direction"] =
      changePct === null
        ? (changeAbs > 0 ? "rose" : changeAbs < 0 ? "fell" : "flat")
        : Math.abs(changePct) < FLAT_BAND_PCT ? "flat" : changePct > 0 ? "rose" : "fell";

    const ordered = [...comparatorValues].sort((a, b) => b.point.value - a.point.value);
    const rank = ordered.findIndex((c) => c.iso === "IND") + 1;

    scored.push({
      indicator: ind,
      india,
      first,
      last,
      changePct,
      changeAbs,
      direction,
      rank,
      of: ordered.length,
      score: coverageScore(ind, india.length, span, comparatorValues.length),
    });
  }

  scored.sort((a, b) => b.score - a.score);

  /**
   * Round-robin across subjects, rather than a cap with a fallback.
   *
   * The first version capped each category and then, if the page came up
   * short, filled from whatever was left — which meant the cap was abandoned
   * exactly when it was doing something, and a registry heavy in one subject
   * produced a page heavy in that subject anyway. The test caught it: ten
   * health indicators and two economic ones gave ten health panels under a cap
   * of three.
   *
   * Taking one from each subject in turn needs no cap constant, always fills
   * the page, and degrades in the only sensible direction — when a subject
   * runs out, the others simply keep going. `perCategory` remains as a hard
   * ceiling for callers that want one.
   */
  const queues = new Map<string, Panel[]>();
  for (const p of scored) {
    const q = queues.get(p.indicator.category) ?? [];
    q.push(p);
    queues.set(p.indicator.category, q);
  }
  // Subjects ordered by their best indicator, so the strongest data leads.
  const order = [...queues.keys()].sort(
    (a, b) => (queues.get(b)?.[0]?.score ?? 0) - (queues.get(a)?.[0]?.score ?? 0),
  );
  const taken: Panel[] = [];
  const used = new Map<string, number>();
  let exhausted = false;
  while (taken.length < limit && !exhausted) {
    exhausted = true;
    for (const cat of order) {
      if (taken.length >= limit) break;
      const q = queues.get(cat);
      const n = used.get(cat) ?? 0;
      if (!q || n >= q.length || n >= perCategory) continue;
      taken.push(q[n]!);
      used.set(cat, n + 1);
      exhausted = false;
    }
  }
  // Ordered by evidence rather than by the round-robin's interleaving, so the
  // page reads strongest-first and the balance is a property of the set.
  taken.sort((a, b) => b.score - a.score);
  return taken;
}

export interface PanelTally {
  rose: number;
  fell: number;
  flat: number;
  categories: Array<{ key: string; n: number }>;
  medianSpan: number;
}

export function tally(panels: Panel[]): PanelTally {
  const categories = new Map<string, number>();
  for (const p of panels) categories.set(p.indicator.category, (categories.get(p.indicator.category) ?? 0) + 1);
  const spans = panels.map((p) => p.last.year - p.first.year).sort((a, b) => a - b);
  return {
    rose: panels.filter((p) => p.direction === "rose").length,
    fell: panels.filter((p) => p.direction === "fell").length,
    flat: panels.filter((p) => p.direction === "flat").length,
    categories: [...categories].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n),
    medianSpan: spans[Math.floor(spans.length / 2)] ?? 0,
  };
}

/** A change, printed with a sign and without false precision. */
export function changeLabel(p: Panel): string {
  if (p.changePct === null) return `${p.changeAbs >= 0 ? "+" : "−"}${Math.abs(p.changeAbs).toPrecision(3)}`;
  const v = Math.abs(p.changePct);
  const sign = p.changePct >= 0 ? "+" : "−";
  /**
   * Past a tenfold change a percentage stops being readable, so it becomes a
   * multiple of the starting value: +20,000% is 201× what it was. The first
   * version divided the percentage by a hundred and called that the multiple,
   * which is out by a factor of ten and reported a two-hundredfold rise as
   * twentyfold — a plausible number in the right units and wrong.
   */
  if (v >= 1000) {
    const multiple = 1 + v / 100;
    return `${sign}${multiple >= 100 ? Math.round(multiple) : multiple.toFixed(1)}×`;
  }
  if (v >= 100) return `${sign}${Math.round(v)}%`;
  return `${sign}${v.toFixed(1)}%`;
}
