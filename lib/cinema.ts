/**
 * Indian film output, read from disk.
 *
 * Server-only. The one thing this module exists to enforce is the difference
 * between the two series in the file, because a caller that forgets it will
 * draw a conclusion the data cannot carry:
 *
 *   `shares` is robust. Coverage growth moves numerator and denominator
 *   together, so a language's share of listed titles is meaningful across
 *   twenty-six years.
 *
 *   `totals` is not. It is how many films English Wikipedia lists, which has
 *   risen partly because more films were made and partly because more people
 *   have written them down, and nothing separates the two.
 *
 * So `shareSeries` is the ordinary accessor and the absolute total is only
 * reachable through `coverageBoundTotal`, whose name is the warning.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface YearLanguage {
  year: number;
  language: string;
  films: number;
  tablesUsed: number;
  headersSeen: string[];
  listed: boolean;
  redirectedTo?: string;
}

export interface YearShare {
  year: number;
  total: number;
  byLanguage: Record<string, number>;
  shares: Record<string, number>;
}

export interface Grosser {
  rank: number | null;
  title: string;
  year: number | null;
  crore: number | null;
  grossAsWritten: string;
}

export interface Cinema {
  present: boolean;
  builtAt: string;
  source: string;
  coverage: string;
  boxOfficeNote: string;
  refusal: string;
  cannotSay: string[];
  checks?: Record<string, string>;
  years: { first: number; last: number };
  languages: string[];
  counts: {
    rowsAttempted: number;
    yearsListed: number;
    yearsMissing: number;
    yearsRedirected?: number;
    yearsDroppedAsRepeats?: number;
    titles: number;
    grossers: number;
  };
  missingLists: string[];
  redirectedLists?: string[];
  repeatedCountYears?: string[];
  grossNote: string;
  shares: YearShare[];
  rows: YearLanguage[];
  grossers: Grosser[];
}

const EMPTY: Cinema = {
  present: false, builtAt: "", source: "", coverage: "", boxOfficeNote: "", refusal: "",
  cannotSay: [], years: { first: 0, last: 0 }, languages: [],
  counts: { rowsAttempted: 0, yearsListed: 0, yearsMissing: 0, titles: 0, grossers: 0 },
  missingLists: [], grossNote: "", shares: [], rows: [], grossers: [],
};

export function loadCinema(): Cinema {
  try {
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), "data/cinema/output.json"), "utf8"),
    ) as Partial<Cinema>;
    return { ...EMPTY, ...raw, present: (raw.shares?.length ?? 0) > 0 };
  } catch {
    return EMPTY;
  }
}

/**
 * Years with enough coverage for a share to mean anything.
 *
 * A year in which only three languages were listed produces shares summing to
 * a hundred across three industries, which is arithmetically fine and
 * substantively a lie. Years are kept only where at least `minLanguages` of
 * the twelve reported, and the threshold is an argument so a caller has to
 * choose it rather than inherit it.
 */
export function usableYears(d: Cinema, minLanguages = 6): YearShare[] {
  return d.shares
    .filter((s) => Object.values(s.byLanguage).filter((n) => n > 0).length >= minLanguages)
    .sort((a, b) => a.year - b.year);
}

/** One language's share across the usable years. The robust series. */
export function shareSeries(d: Cinema, language: string, minLanguages = 6): Array<{ year: number; share: number }> {
  return usableYears(d, minLanguages).map((s) => ({ year: s.year, share: s.shares[language] ?? 0 }));
}

/**
 * The absolute count of listed titles.
 *
 * Named so that no caller reaches it by accident. See `coverage` in the file:
 * this is a count of Wikipedia articles, not of films, and its trend is partly
 * a trend in how much of Indian cinema has been written down.
 */
export function coverageBoundTotal(d: Cinema, year: number): number {
  return d.shares.find((s) => s.year === year)?.total ?? 0;
}

/** Mean share across a span, which is steadier than any single year. */
export function meanShare(d: Cinema, language: string, from: number, to: number, minLanguages = 6): number {
  const rows = usableYears(d, minLanguages).filter((s) => s.year >= from && s.year <= to);
  if (rows.length === 0) return 0;
  return rows.reduce((a, s) => a + (s.shares[language] ?? 0), 0) / rows.length;
}

/** Languages ordered by their share in the most recent usable year. */
export function languagesByRecentShare(d: Cinema, minLanguages = 6): string[] {
  const years = usableYears(d, minLanguages);
  const last = years[years.length - 1];
  if (!last) return [...d.languages];
  return [...d.languages].sort((a, b) => (last.shares[b] ?? 0) - (last.shares[a] ?? 0));
}

/**
 * Whether a parsed gross is a gross at all.
 *
 * Wikitables use rowspan, and a row underneath a spanned cell has fewer cells
 * than the header has columns — so every index after it shifts left and the
 * "gross" column yields whatever happens to sit there. The result was
 * "Mehandi Laga Ke Rakhna, ₹2,017 crore", which is the release year read as a
 * revenue, and "Dhurandhar: The Revenge, ₹1,852.44 crore", which is not.
 *
 * A real gross cell says so: it carries a currency mark or the word crore,
 * lakh or billion. A bare four-digit number in the plausible range of years
 * is refused rather than published, because a figure that is silently a year
 * is worse than a missing one — it is in the right units, the right order of
 * magnitude, and wrong.
 *
 * Fixing the rowspan handling upstream would be better and costs a CI round
 * trip on the weakest leg of this story; this check costs nothing and refuses
 * the same rows.
 */
export function isRealGross(g: Grosser): boolean {
  const written = g.grossAsWritten;
  const hasMarker = /crore|lakh|billion|bn\b|₹|\$|€|£/i.test(written);
  if (hasMarker) return true;
  // No marker and a value that could be a year: refuse.
  const v = g.crore ?? 0;
  if (v >= 1900 && v <= 2100 && Number.isInteger(v)) return false;
  // No marker at all is still weak evidence; keep it only if it is implausible
  // as a year, which is most real box-office figures.
  return written.trim() !== "";
}

/**
 * The highest-grossing list, deduplicated.
 *
 * The article carries the same film in several tables — all-time, by year, by
 * language — so a raw read returns Dangal three times and a "top ten" that is
 * four films. Deduplicated on title and year, keeping the largest figure,
 * because the tables differ slightly and the largest is the one the all-time
 * table uses.
 */
export function topGrossers(d: Cinema, limit = 20): Grosser[] {
  const best = new Map<string, Grosser>();
  for (const g of d.grossers) {
    if (g.crore === null || g.title === "" || !isRealGross(g)) continue;
    /**
     * Keyed on the title alone, not on title and year.
     *
     * The same film appears in several tables and not all of them carry a year
     * column, so keying on both produced "Jawan (2023)" and "Jawan (—)" as two
     * entries and a top ten that was six films. An entry with a year always
     * beats one without; between two that both have one, the larger figure
     * wins, because the tables disagree slightly and the all-time table uses
     * the larger.
     */
    const key = g.title.toLowerCase().trim();
    const prev = best.get(key);
    if (!prev) { best.set(key, g); continue; }
    const betterYear = g.year !== null && prev.year === null;
    const worseYear = g.year === null && prev.year !== null;
    if (betterYear || (!worseYear && (prev.crore ?? 0) < g.crore)) best.set(key, g);
  }
  return [...best.values()]
    .sort((a, b) => (b.crore ?? 0) - (a.crore ?? 0))
    .slice(0, limit);
}

/**
 * How many of the deduplicated top films come from each release year.
 *
 * NOT a box-office time series. The list is an all-time ranking in nominal
 * rupees, so recent films dominate it for two reasons that have nothing to do
 * with how good the year was — prices rise, and a recent film is more likely
 * to be listed at all. It is published as a distribution of the list, which is
 * what it is.
 */
export function grossersByYear(d: Cinema): Array<{ year: number; n: number }> {
  const counts = new Map<number, number>();
  for (const g of topGrossers(d, 10_000)) {
    if (g.year === null) continue;
    counts.set(g.year, (counts.get(g.year) ?? 0) + 1);
  }
  return [...counts].map(([year, n]) => ({ year, n })).sort((a, b) => a.year - b.year);
}
