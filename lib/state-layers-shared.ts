/**
 * Shapes the front-page map needs, with no node builtins so a client component
 * can import them. See lib/census-shared.ts for why this split exists at all.
 */

export interface LayerItem {
  name: string;
  /** Why this one matters, in the words the source supports. */
  why: string;
  /** Where the claim in `why` came from, so a reader can weigh it. */
  basis: string;
  lat?: number;
  lon?: number;
}

/** A layer with its rows stripped out: what the map itself needs to draw. */
export interface LayerSummary {
  id: string;
  label: string;
  blurb: string;
  join: string;
  source: string;
  total: number;
  placed: number;
  /** Rows the join could not put in a state. */
  unplacedCount: number;
  /** Rows dropped as duplicates of one already counted. */
  deduped: number;
  /** State name → how many named items it holds. */
  counts: Record<string, number>;
}

export interface RefusedLayer { layer: string; why: string }

export interface AsciiGrid {
  cols: number;
  rows: number;
  cellAspect: number;
  landCells: number;
  /** States too small to catch a sample point at this resolution. */
  unsampled: string[];
  /** Symbol character → state name. */
  symbols: Record<string, string>;
  anchors: Array<{ state: string; symbol: string; cells: number; col: number; row: number }>;
  grid: string[];
}

/** One state's items for one layer, as the route hands them back. */
export interface StateItems {
  state: string;
  layer: string;
  total: number;
  items: LayerItem[];
  truncated: boolean;
}

/**
 * Runs of identical symbol within a row.
 *
 * The grid is around six thousand cells. One DOM node per cell is six thousand
 * nodes re-styled on every pointer move, which drops frames on a phone before
 * anything else on the page has finished loading. A row crosses at most a
 * handful of states, so a run per state per row is a few hundred nodes for the
 * whole map and the hover maths is arithmetic rather than hit-testing.
 */
export interface Run { col: number; text: string; state: string | null }

export function runsOf(grid: AsciiGrid): Run[][] {
  return grid.grid.map((line) => {
    const runs: Run[] = [];
    let start = 0;
    for (let i = 1; i <= line.length; i++) {
      if (i < line.length && line[i] === line[start]) continue;
      const ch = line[start]!;
      runs.push({
        col: start,
        text: line.slice(start, i),
        state: ch === "." || ch === "?" ? null : grid.symbols[ch] ?? null,
      });
      start = i;
    }
    return runs;
  });
}

/**
 * The character a cell gets, from where its state sits in the layer's range.
 *
 * A ramp of weight rather than of shape: each step is denser ink than the one
 * before it, so the picture reads as a quantity even in one colour and even
 * printed. `·` is the floor and means a state with none of this thing — which
 * is a real reading and must not look like sea.
 */
export const RAMP = ["·", ":", "+", "*", "o", "O", "8", "#", "%", "@"] as const;

/**
 * Rank rather than magnitude, deliberately.
 *
 * These counts are extremely skewed: Tamil Nadu holds 969 temples and a dozen
 * states hold under ten. Scaled linearly the whole country is the floor
 * character and two states are the top one, which is a true statement and an
 * unreadable map. Ranking spreads the ramp over the states that exist, and the
 * panel prints the real number the moment anyone asks for one.
 */
export function rampIndexByRank(counts: Record<string, number>): Record<string, number> {
  const present = Object.entries(counts).filter(([, n]) => n > 0).sort((a, b) => a[1] - b[1]);
  const out: Record<string, number> = {};
  present.forEach(([state], i) => {
    const frac = present.length <= 1 ? 1 : i / (present.length - 1);
    out[state] = 1 + Math.round(frac * (RAMP.length - 2));
  });
  return out;
}
