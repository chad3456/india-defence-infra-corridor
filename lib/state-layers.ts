/**
 * Reading the per-state named-item layers from disk.
 *
 * Server-only: imports node:fs. The shapes a client component needs are in
 * lib/state-layers-shared.ts.
 *
 * The full file is close to a megabyte — three thousand temples with a
 * sentence each — so nothing here hands it to a page wholesale. The map gets
 * counts, which are a few hundred bytes; the names arrive from the route when
 * someone clicks a state.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  AsciiGrid, LayerItem, LayerSummary, RefusedLayer, StateItems,
} from "./state-layers-shared";

export * from "./state-layers-shared";

interface RawLayer extends Omit<LayerSummary, "counts"> {
  unplaced: string[];
  byState: Record<string, LayerItem[]>;
}
interface RawFile { builtAt: string; note: string; refused: RefusedLayer[]; layers: RawLayer[] }

const EMPTY: RawFile = { builtAt: "", note: "", refused: [], layers: [] };

let cached: RawFile | null = null;
function load(): RawFile {
  if (cached) return cached;
  try {
    cached = JSON.parse(
      readFileSync(join(process.cwd(), "data/geo/state-layers.json"), "utf8"),
    ) as RawFile;
  } catch {
    cached = EMPTY;
  }
  return cached;
}

export function loadGrid(): AsciiGrid | null {
  try {
    return JSON.parse(
      readFileSync(join(process.cwd(), "data/geo/ascii-india.json"), "utf8"),
    ) as AsciiGrid;
  } catch {
    return null;
  }
}

/** Every layer, with its rows replaced by per-state counts. */
export function layerSummaries(): LayerSummary[] {
  return load().layers.map((l) => ({
    id: l.id, label: l.label, blurb: l.blurb, join: l.join, source: l.source,
    total: l.total, placed: l.placed, unplacedCount: l.unplacedCount, deduped: l.deduped,
    counts: Object.fromEntries(Object.entries(l.byState).map(([s, xs]) => [s, xs.length])),
  }));
}

export function refusedLayers(): RefusedLayer[] {
  return load().refused;
}

export function builtAt(): string {
  return load().builtAt;
}

/**
 * One state's items for one layer.
 *
 * Capped, because Tamil Nadu's temple list is 969 rows and nobody reads a
 * panel that long — but the cap is reported rather than hidden, so the page
 * can say "60 of 969" instead of implying the state holds sixty.
 */
export function itemsFor(layerId: string, state: string, limit = 60): StateItems | null {
  const l = load().layers.find((x) => x.id === layerId);
  if (!l) return null;
  const all = l.byState[state] ?? [];
  return {
    state, layer: layerId, total: all.length,
    items: all.slice(0, limit), truncated: all.length > limit,
  };
}
