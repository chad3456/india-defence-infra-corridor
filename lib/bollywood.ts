/**
 * Reader for the Hindi-film plot measures.
 *
 * ── The function that shapes the whole page ──────────────────────────────
 *
 * `corrected()` and `raw()` both exist, and every caller must pick one
 * knowingly. The raw share of films carrying a marker is the number a reader
 * expects; it is also confounded, because Wikipedia plot summaries grew from a
 * median of 212 words in the late nineties to 310 in the 2020s, and a longer
 * summary has more room to trip any pattern. The corrected series divides by
 * the text it searched.
 *
 * On this dataset the confound happens to work against the headline finding —
 * the markers fall even though there is more text to find them in — which is
 * the best position to be in and is not a reason to stop publishing both.
 *
 * ── What is deliberately absent ──────────────────────────────────────────
 *
 * There is no `influence()`, no `harmScore()`, and no function combining the
 * three tiers into one index. The tiers answer different questions at
 * different strengths, a sum of them would be a number with no referent, and a
 * page that had one would end up leading with it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PATH = join(process.cwd(), "data", "cinema", "bollywood-plots.json");

export type Tier = "presence" | "outcome" | "framing";

export interface MarkerDef { id: string; label: string; tier: Tier; note: string; pattern: string }

export interface Film {
  title: string;
  year: number;
  plotWords: number;
  endingWords: number;
  genres: string[];
  markers: string[];
  evidence: Array<{ marker: string; quote: string }>;
  titleWord: boolean;
}

/** One year's row. Marker columns are dynamic, hence the index signature. */
export type YearRow = { year: number; films: number; medianPlotWords: number; totalPlotWords: number; titleWord: number }
  & Record<string, number>;

export interface Bollywood {
  present: boolean;
  builtAt: string;
  instrument: string;
  source: string;
  method: string;
  confound: string;
  refusal: string;
  cannotSay: string[];
  markers: MarkerDef[];
  counts: {
    films: number; years: number; totalPlotWords: number; medianPlotWords: number;
    withAnyMarker: number; addedThisRun: number; carriedFromEarlierRuns: number;
    yearsWithNoList: number[];
  };
  perYear: Array<{ year: number; listTitle: string | null; listed: number; measured: number }>;
  series: YearRow[];
  films: Film[];
}

const EMPTY: Bollywood = {
  present: false, builtAt: "", instrument: "", source: "", method: "", confound: "", refusal: "",
  cannotSay: [], markers: [],
  counts: {
    films: 0, years: 0, totalPlotWords: 0, medianPlotWords: 0, withAnyMarker: 0,
    addedThisRun: 0, carriedFromEarlierRuns: 0, yearsWithNoList: [],
  },
  perYear: [], series: [], films: [],
};

export function loadBollywood(): Bollywood {
  try {
    return { ...JSON.parse(readFileSync(PATH, "utf8")), present: true } as Bollywood;
  } catch {
    return EMPTY;
  }
}

/** The raw share of films carrying a marker, as a percentage. Confounded. */
export function raw(b: Bollywood, id: string): Array<{ year: number; value: number }> {
  return b.series.map((s) => ({ year: s.year, value: (s[`${id}__shareOfFilms`] ?? 0) * 100 }));
}

/** The same marker per thousand words of summary. The corrected series. */
export function corrected(b: Bollywood, id: string): Array<{ year: number; value: number }> {
  return b.series.map((s) => ({ year: s.year, value: s[`${id}__per1kWords`] ?? 0 }));
}

/** Any column of the year table as a series. */
export function column(b: Bollywood, key: string): Array<{ year: number; value: number }> {
  return b.series.map((s) => ({ year: s.year, value: s[key] ?? 0 }));
}

/**
 * How many films carried a marker across a span of years, as a percentage.
 *
 * Pooled over the whole span rather than averaged across its years, because
 * averaging year percentages weights a year of sixty films the same as one of
 * a hundred and thirteen.
 */
export function pooled(b: Bollywood, id: string, from: number, to: number): number {
  const rows = b.series.filter((s) => s.year >= from && s.year <= to);
  const films = rows.reduce((a, s) => a + s.films, 0);
  const hits = rows.reduce((a, s) => a + (s[`${id}__films`] ?? 0), 0);
  return films > 0 ? (hits / films) * 100 : 0;
}

/**
 * The share of films whose title carries a crime word, by year.
 *
 * A share and not a count, because films measured per year varies from sixty
 * to a hundred and thirteen and a raw count would read that variation as a
 * trend in titling.
 */
export function titleWordShare(b: Bollywood): Array<{ year: number; value: number }> {
  return b.series.map((s) => ({
    year: s.year,
    value: s.films > 0 ? (s.titleWord / s.films) * 100 : 0,
  }));
}

/** Films carrying a crime word in their title, pooled the same way. */
export function pooledTitleWord(b: Bollywood, from: number, to: number): number {
  const rows = b.series.filter((s) => s.year >= from && s.year <= to);
  const films = rows.reduce((a, s) => a + s.films, 0);
  const hits = rows.reduce((a, s) => a + s.titleWord, 0);
  return films > 0 ? (hits / films) * 100 : 0;
}

/**
 * Reckonings per escape, by year.
 *
 * The one ratio on the page, and the only place two markers are combined.
 * It is defensible where a sum would not be because both sides are the same
 * kind of measurement over the same scope — what the closing passage
 * describes — so their ratio has a referent: how often a story that ends in
 * something ends in an answer rather than an exit.
 *
 * A year with no escapes returns null rather than infinity, and the chart
 * draws a break. That has not happened in this range and would be a real
 * finding if it did.
 */
export function reckoningPerEscape(b: Bollywood): Array<{ year: number; value: number }> {
  return b.series
    .map((s) => {
      const r = s["ending-reckoning__films"] ?? 0;
      const e = s["ending-escape__films"] ?? 0;
      return e > 0 ? { year: s.year, value: r / e } : null;
    })
    .filter((x): x is { year: number; value: number } => x !== null);
}

/** Markers of one tier, in the order the connector declares them. */
export function tierMarkers(b: Bollywood, tier: Tier): MarkerDef[] {
  return b.markers.filter((m) => m.tier === tier);
}

/**
 * Markers that never fired, or fired on under half a per cent across thirty
 * years.
 *
 * Published as its own list rather than drawn as thirty flat charts. A marker
 * that finds nothing is either a real absence in the corpus or a broken
 * pattern, the page cannot always tell which, and the honest move is to name
 * them and say so rather than let a flat line imply a measured zero.
 */
export function nullResults(b: Bollywood): MarkerDef[] {
  return b.markers.filter((m) => pooled(b, m.id, 1900, 2100) < 0.5);
}

/** Every film carrying a marker, newest first, for the evidence list. */
export function filmsWith(b: Bollywood, id: string): Film[] {
  return b.films.filter((f) => f.markers.includes(id)).sort((a, c) => c.year - a.year);
}

/** The most common genres, for the mix chart. */
export function topGenres(b: Bollywood, n = 8): string[] {
  const m = new Map<string, number>();
  for (const f of b.films) for (const g of f.genres) m.set(g, (m.get(g) ?? 0) + 1);
  return [...m].sort((a, c) => c[1] - a[1]).slice(0, n).map(([g]) => g);
}

/** One genre's share of films, by year. */
export function genreShare(b: Bollywood, genre: string): Array<{ year: number; value: number }> {
  const years = b.series.map((s) => s.year);
  return years.map((y) => {
    const inYear = b.films.filter((f) => f.year === y);
    const n = inYear.filter((f) => f.genres.includes(genre)).length;
    return { year: y, value: inYear.length > 0 ? (n / inYear.length) * 100 : 0 };
  });
}
