/**
 * The Reel Run game's levels, built from the same dataset as the charts.
 *
 * Nothing here is a new measurement. Each level is one or more of the page's
 * existing markers; its towers are the per-year shares the charts draw; its
 * "early" and "late" figures are `pooled()` over the same two spans the page
 * compares; and its reels are real films, each carrying the plot sentence
 * that tripped the marker. `npm run test:bollywood-arcade` checks all three
 * against the dataset, so the game cannot drift from the charts beneath it.
 *
 * Only a sample of films rides the road — at most a few per lane per year,
 * chosen by a hash of the title so the pick is stable and not the author's.
 * The towers count every film.
 *
 * Markers the page lists as null results (under half a per cent across
 * thirty years) are not given a level: a flat road would imply a measured
 * zero the page itself declines to claim.
 */
import { loadBollywood, pooled, pooledTitleWord, nullResults, type Bollywood } from "./bollywood";
import { direction, type Arcade, type Direction, type Lane, type Level, type Reel } from "./bollywood-arcade-shared";

const EARLY: [number, number] = [1995, 1999];
const LATE: [number, number] = [2021, 2025];
export const REELS_PER_LANE_YEAR = 3;

/** Validated together for the dark stage: magenta, blue, amber. */
export const LANE_COLOURS = ["#d9368f", "#1a9bd6", "#b98400"];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * `expect` is what the explanation text was written to. The builder never uses
 * it — the answer is computed — but the test fails if the two part, so a
 * re-ingest that changed a direction cannot leave a level explaining the
 * opposite of what its towers show.
 */
interface Spec { id: string; title: string; tagline: string; question: string; markers: string[]; explain: string; expect: Direction }

const SPECS: Spec[] = [
  {
    id: "revenge", title: "Revenge Road",
    tagline: "Collect the films whose plot runs on revenge.",
    question: "Across thirty years, did revenge as a plot driver rise or fall?",
    markers: ["revenge"],
    explain: "Revenge roughly halves — and plot summaries got longer over the same years, which should have pushed the count up, not down.",
    expect: "down",
  },
  {
    id: "underworld", title: "Underworld Expressway",
    tagline: "Left lane: organised crime. Right lane: police or state shown corrupt.",
    question: "Did organised crime on screen rise or fall?",
    markers: ["underworld", "police-corrupt"],
    explain: "Both fall, and corrupt police fall hardest.",
    expect: "down",
  },
  {
    id: "titles", title: "Title Card Alley",
    tagline: "Films with a crime word in the title — Don, Gangster, Daaku.",
    question: "Did crime words in film titles rise or fall?",
    markers: ["__title"],
    explain: "A collapse, not a drift — the steepest fall of anything measured on this page.",
    expect: "down",
  },
  {
    id: "endings", title: "The Last Reel",
    tagline: "How films end. Left: a reckoning. Middle: reconciliation. Right: the wrongdoer still standing.",
    question: "Did films ending in a reckoning — arrest, sentence, death — rise or fall?",
    markers: ["ending-reckoning", "ending-reconciliation", "ending-escape"],
    explain: "Reckonings halve while escapes hold flat, so a film that ends on wrongdoing is now far less likely to end with it answered for. The one finding that goes the way the original question expected.",
    expect: "down",
  },
  {
    id: "framing", title: "Framing Street",
    tagline: "Left: the wrongdoer feared and admired. Right: a rise-to-power arc.",
    question: "Were wrongdoers framed as feared and admired more often, or less?",
    markers: ["feared-respected", "rise-to-power"],
    explain: "Somewhat less. These markers are rarer than the others, so a few films either way move them.",
    expect: "down",
  },
  {
    id: "words", title: "The Long Summary",
    tagline: "The trap in the data: how long the Wikipedia plot summaries are.",
    question: "Did the plot summaries this all rests on get longer or shorter?",
    markers: ["__words"],
    explain: "Longer. More text means more room to trip any pattern, so every count should have drifted upward on its own. That the markers fell anyway is what makes the finding worth printing.",
    expect: "up",
  },
];

function mean(xs: number[]): number { return xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0; }

function laneFor(b: Bollywood, id: string, i: number): Lane {
  const colour = LANE_COLOURS[i] ?? LANE_COLOURS[0]!;
  if (id === "__title") {
    return { id, label: "Crime word in the title", colour, unit: "pct",
      early: pooledTitleWord(b, ...EARLY), late: pooledTitleWord(b, ...LATE) };
  }
  if (id === "__words") {
    const span = (s: [number, number]) => mean(b.series.filter((r) => r.year >= s[0] && r.year <= s[1]).map((r) => r.medianPlotWords));
    return { id, label: "Median plot summary, words", colour, unit: "words", early: span(EARLY), late: span(LATE) };
  }
  const m = b.markers.find((x) => x.id === id);
  if (!m) throw new Error(`Reel Run level uses marker "${id}", which the dataset does not define`);
  return { id, label: m.label, colour, unit: "pct", early: pooled(b, id, ...EARLY), late: pooled(b, id, ...LATE) };
}

export function buildArcade(b: Bollywood = loadBollywood()): Arcade {
  const nulls = new Set(nullResults(b).map((m) => m.id));
  const levels: Level[] = SPECS
    .filter((s) => s.markers.every((m) => !nulls.has(m)))
    .map((s): Level => {
      const lanes = s.markers.map((id, i) => laneFor(b, id, i));
      const series = b.series.map((r) => ({
        year: r.year,
        films: r.films,
        raw: s.markers.map((id) => id === "__title" ? (r.films ? (r.titleWord / r.films) * 100 : 0)
          : id === "__words" ? r.medianPlotWords
            : (r[`${id}__shareOfFilms`] ?? 0) * 100),
        per1k: s.markers.map((id) => id.startsWith("__") ? null : (r[`${id}__per1kWords`] ?? 0)),
      }));
      const reels: Reel[] = [];
      const totalFilms: number[] = [];
      s.markers.forEach((id, lane) => {
        if (id === "__words") { totalFilms.push(0); return; }
        const films = b.films.filter((f) => id === "__title" ? f.titleWord : f.markers.includes(id));
        totalFilms.push(films.length);
        const byYear = new Map<number, typeof films>();
        for (const f of films) byYear.set(f.year, [...(byYear.get(f.year) ?? []), f]);
        for (const [year, fs] of byYear) {
          fs.sort((a, c) => hash(a.title + id) - hash(c.title + id));
          for (const f of fs.slice(0, REELS_PER_LANE_YEAR)) {
            const quote = id === "__title" ? f.title : f.evidence.find((e) => e.marker === id)?.quote;
            if (quote) reels.push({ lane, year, title: f.title, quote });
          }
        }
      });
      reels.sort((a, c) => a.year - c.year || a.lane - c.lane);
      const key = lanes[0]!;
      return {
        id: s.id, title: s.title, tagline: s.tagline, question: s.question, explain: s.explain,
        lanes, answer: direction(key.early, key.late), expect: s.expect, series, reels, totalFilms,
      };
    });
  const years = b.series.map((r) => r.year);
  return {
    levels,
    films: b.counts.films,
    years: [Math.min(...years), Math.max(...years)],
    spans: { early: EARLY, late: LATE },
    reelsPerLaneYear: REELS_PER_LANE_YEAR,
    source: b.source,
    refusal: b.refusal,
  };
}
