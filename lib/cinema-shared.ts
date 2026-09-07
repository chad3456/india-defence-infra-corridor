/**
 * Whether a film is climbing or dying, from repeated observations of it.
 *
 * No source publishes this. What is rising and what is fading is not a field
 * on any page — it is the difference between two observations, so the only way
 * to have it is to have watched, and the first day of watching is a single
 * point however confidently a page is dressed.
 *
 * ── The trap this exists to avoid ────────────────────────────────────────
 *
 * Cinema is violently weekly. A film sells a multiple of its Tuesday on the
 * following Saturday, every week, for its whole run. Comparing the latest
 * observation to yesterday's would therefore report every Monday as a collapse
 * and every Friday as a breakout, for every film, forever — a chart of the
 * calendar rather than of the films.
 *
 * So nothing here compares adjacent days. A verdict needs either two whole
 * weeks to average over, or at minimum the same weekday a week earlier, and
 * below that the honest answer is that it is too early to say. That costs the
 * page a fortnight of confident-looking output it would have had no business
 * showing.
 */

/** One snapshot of one film. */
export interface Observation {
  /** ISO date, YYYY-MM-DD, of when the snapshot was taken. */
  date: string;
  /**
   * How much of the market the film occupied at that moment.
   *
   * Deliberately source-defined — showtimes counted, cinemas listed, a chart
   * position inverted. What matters for a trend is that the same quantity is
   * measured the same way each day, not what it is called.
   */
  presence: number;
}

export interface Film {
  /** Stable id: normalised title, plus year when one is known. */
  id: string;
  title: string;
  language: string | null;
  /** ISO date, when the source gives one. */
  releaseDate: string | null;
  observations: Observation[];
}

export type Momentum =
  | "too early to say"
  | "opening"
  | "climbing"
  | "holding"
  | "fading";

export interface TrendReading {
  momentum: Momentum;
  /** Latest week against the one before, as a ratio. Null when not computable. */
  ratio: number | null;
  /** How the comparison was made, so the reader knows what they are looking at. */
  basis: "two weeks" | "same weekday" | "none";
  /** Days of observation behind the reading. */
  days: number;
  latest: number | null;
}

/** Below this many days, a weekly cycle cannot be told from a real change. */
const MIN_DAYS_FOR_WEEKDAY = 8;
const MIN_DAYS_FOR_WEEKS = 14;
/** How far from 1 a ratio must sit before it is movement rather than noise. */
const CLIMB = 1.15;
const FADE = 0.85;

const dayMs = 86_400_000;
const asTime = (iso: string) => Date.parse(iso + "T00:00:00Z");

/** Observations sorted oldest first, with any duplicate dates collapsed. */
function tidy(obs: Observation[]): Observation[] {
  const byDate = new Map<string, number>();
  for (const o of obs) if (Number.isFinite(o.presence)) byDate.set(o.date, o.presence);
  return [...byDate.entries()]
    .map(([date, presence]) => ({ date, presence }))
    .sort((a, b) => asTime(a.date) - asTime(b.date));
}

/** Mean presence over the window ending at `end`, inclusive, spanning `days`. */
function windowMean(obs: Observation[], end: number, days: number): number | null {
  const start = end - (days - 1) * dayMs;
  const inside = obs.filter((o) => {
    const t = asTime(o.date);
    return t >= start && t <= end;
  });
  if (inside.length === 0) return null;
  return inside.reduce((s, o) => s + o.presence, 0) / inside.length;
}

/**
 * How a film is doing, or an admission that it is too early to know.
 *
 * `releaseDate` is used only to distinguish a film that is genuinely new from
 * one this project simply has not watched for long — those look identical in
 * the observations and mean very different things.
 */
export function readTrend(film: Film, now: Date = new Date()): TrendReading {
  const obs = tidy(film.observations);
  const latest = obs[obs.length - 1]?.presence ?? null;
  if (obs.length === 0) {
    return { momentum: "too early to say", ratio: null, basis: "none", days: 0, latest: null };
  }

  const first = asTime(obs[0]!.date);
  const last = asTime(obs[obs.length - 1]!.date);
  const days = Math.round((last - first) / dayMs) + 1;

  // A film released within the last week has no previous week to be compared
  // against, and calling that "too early to say" hides the one thing about it
  // that is actually known.
  if (film.releaseDate !== null) {
    const sinceRelease = (now.getTime() - asTime(film.releaseDate)) / dayMs;
    if (sinceRelease >= 0 && sinceRelease < 7) {
      return { momentum: "opening", ratio: null, basis: "none", days, latest };
    }
  }

  if (days >= MIN_DAYS_FOR_WEEKS) {
    const thisWeek = windowMean(obs, last, 7);
    const lastWeek = windowMean(obs, last - 7 * dayMs, 7);
    if (thisWeek !== null && lastWeek !== null && lastWeek > 0) {
      const ratio = thisWeek / lastWeek;
      return { momentum: verdict(ratio), ratio, basis: "two weeks", days, latest };
    }
  }

  if (days >= MIN_DAYS_FOR_WEEKDAY) {
    // Same weekday a week earlier: the crudest comparison that is not simply
    // measuring which day of the week it is.
    const weekAgo = obs.find((o) => asTime(o.date) === last - 7 * dayMs);
    if (weekAgo && weekAgo.presence > 0 && latest !== null) {
      const ratio = latest / weekAgo.presence;
      return { momentum: verdict(ratio), ratio, basis: "same weekday", days, latest };
    }
  }

  return { momentum: "too early to say", ratio: null, basis: "none", days, latest };
}

function verdict(ratio: number): Momentum {
  if (ratio >= CLIMB) return "climbing";
  if (ratio <= FADE) return "fading";
  return "holding";
}

/** A stable id from a title, so the same film matches across snapshots. */
export function filmId(title: string, year?: number | null): string {
  const slug = title
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return year ? `${slug}-${year}` : slug;
}
