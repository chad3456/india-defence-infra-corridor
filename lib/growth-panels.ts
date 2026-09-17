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
  { limit = 100, perCategory = 14 }: { limit?: number; perCategory?: number } = {},
): Panel[] {
  const scored: Panel[] = [];

  for (const ind of reg.indicators) {
    if (!ind.hasIndia) continue;
    const rows = seriesFor(ind);
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

  const taken: Panel[] = [];
  const perCat = new Map<string, number>();
  for (const p of scored) {
    if (taken.length >= limit) break;
    const cat = p.indicator.category;
    const n = perCat.get(cat) ?? 0;
    if (n >= perCategory) continue;
    perCat.set(cat, n + 1);
    taken.push(p);
  }
  // If the per-category cap left the page short, fill from what is left rather
  // than publishing eighty panels under a heading that says a hundred.
  if (taken.length < limit) {
    const have = new Set(taken.map((p) => p.indicator.slug));
    for (const p of scored) {
      if (taken.length >= limit) break;
      if (have.has(p.indicator.slug)) continue;
      taken.push(p);
    }
  }
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
  if (v >= 1000) return `${sign}${Math.round(v / 100) / 10}×`;
  if (v >= 100) return `${sign}${Math.round(v)}%`;
  return `${sign}${v.toFixed(1)}%`;
}
