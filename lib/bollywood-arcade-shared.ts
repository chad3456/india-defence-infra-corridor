/**
 * Types for the Reel Run game on /bollywood-villains, safe for the client.
 * The builder that reads the dataset is `bollywood-arcade.ts`.
 */

export type Direction = "up" | "down" | "flat";

export interface Lane {
  id: string;
  label: string;
  colour: string;
  /** What one unit of the tower is: a share of films, or words. */
  unit: "pct" | "words";
  /** Pooled over 1995–99 and 2021–25, the same arithmetic as the charts below. */
  early: number;
  late: number;
}

export interface YearPoint {
  year: number;
  films: number;
  /** One value per lane: the raw share of films, or words. */
  raw: number[];
  /** Per thousand words of plot summary, or null where that has no meaning. */
  per1k: Array<number | null>;
}

export interface Reel {
  lane: number;
  year: number;
  title: string;
  /** The sentence of the Wikipedia plot summary that matched — or, for the
   *  title level, the title itself. */
  quote: string;
}

export interface Level {
  id: string;
  title: string;
  tagline: string;
  question: string;
  /** Lane 0 is the one the question is about. */
  lanes: Lane[];
  answer: Direction;
  /** The direction the explanation was written to; the test holds `answer` to it. */
  expect: Direction;
  explain: string;
  series: YearPoint[];
  reels: Reel[];
  /** Films carrying the marker in all, of which `reels` is a sample. */
  totalFilms: number[];
}

export interface Arcade {
  levels: Level[];
  films: number;
  years: [number, number];
  spans: { early: [number, number]; late: [number, number] };
  reelsPerLaneYear: number;
  source: string;
  refusal: string;
}

export const DIRECTION_WORD: Record<Direction, string> = { up: "Rose", down: "Fell", flat: "Held flat" };

/** Up if the later span is more than 15% above the earlier, down if more than 15% below. */
export function direction(early: number, late: number): Direction {
  if (early <= 0) return late > 0 ? "up" : "flat";
  const r = late / early;
  return r > 1.15 ? "up" : r < 0.85 ? "down" : "flat";
}
