/**
 * The statewise transport picture, and the denominators it needs.
 *
 * Server-only: reads from disk via lib/state-layers.
 *
 * ── What this can and cannot say ─────────────────────────────────────────
 *
 * It counts infrastructure that exists: airports with a code, metro lines,
 * railway stations, each placed into a state by point-in-polygon against the
 * map's own topology. That is a real measure of presence and it is not a
 * measure of service — nothing here knows how many trains stop, how often, at
 * what fare, or whether a wheelchair can board.
 *
 * "Accessibility" is at least three different claims: whether a service exists
 * near someone, whether they can afford it, and whether they can physically
 * use it. Only the first is measurable from anything this project can reach,
 * and the page says which one it means rather than using the word bare.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { layerSummaries, type LayerSummary } from "./state-layers";

export interface StateStat {
  state: string;
  population: number | null;
  area: number | null;
}

export interface StateStats {
  present: boolean;
  builtAt: string | null;
  source: string;
  /** The column heading the populations were actually read from. */
  populationBasis: string;
  areaBasis: string;
  basisNote: string;
  staleness: string;
  faults: string[];
  states: StateStat[];
}

const EMPTY: StateStats = {
  present: false, builtAt: null, source: "",
  populationBasis: "unknown", areaBasis: "unknown", basisNote: "", staleness: "",
  faults: [], states: [],
};

export function loadStateStats(): StateStats {
  try {
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), "data/geo/state-stats.json"), "utf8"),
    ) as Partial<StateStats>;
    const states = raw.states ?? [];
    return {
      ...EMPTY, ...raw, states,
      // "Built" is not "usable". A file whose parse produced nothing is
      // present on disk and absent as data, and the difference decides
      // whether a page draws rates or explains why it cannot.
      present: states.some((s) => s.population !== null),
    };
  } catch {
    return EMPTY;
  }
}

export interface Row {
  state: string;
  population: number | null;
  counts: Record<string, number>;
  /** Per million people, where a population is known. Null otherwise — never zero. */
  rates: Record<string, number | null>;
}

/**
 * Counts per state, and rates where a denominator exists.
 *
 * A missing population yields null rather than zero. Zero would sort with the
 * worst-served states and read as a finding about them, when it is a gap in
 * this project's own data.
 */
export function statewiseRows(layers: LayerSummary[], stats: StateStats): Row[] {
  const pop = new Map(stats.states.map((s) => [s.state, s.population]));
  const states = [...new Set(layers.flatMap((l) => Object.keys(l.counts)))].sort();
  return states.map((state) => {
    const population = pop.get(state) ?? null;
    const counts: Record<string, number> = {};
    const rates: Record<string, number | null> = {};
    for (const l of layers) {
      const n = l.counts[state] ?? 0;
      counts[l.id] = n;
      rates[l.id] = population && population > 0 ? (n / population) * 1_000_000 : null;
    }
    return { state, population, counts, rates };
  });
}

export function transportLayers(): LayerSummary[] {
  // The sacred layer is not transport, and it is the largest — including it
  // would make every chart on that page a chart about temples.
  return layerSummaries().filter((l) => l.id !== "sacred");
}
