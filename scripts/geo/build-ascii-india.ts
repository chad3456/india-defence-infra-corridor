/**
 * India as a character grid.
 *
 *   npm run geo:ascii
 *
 * ── Why a generated file rather than a build-time compute ────────────────
 *
 * The grid is a point-in-polygon test per cell against thirty-seven state
 * geometries, and a prototype took 6.3 seconds for four thousand cells. That
 * is tolerable once and intolerable on every render of a page that is
 * otherwise static, so it is computed here, committed, and read as data.
 *
 * It is deterministic — the same topology in, the same characters out — which
 * is what makes `npm run test:ascii` able to regenerate it and diff, the same
 * arrangement the SQL seed uses. A generated file that cannot be checked
 * against its generator is a hand-edited file with extra steps.
 *
 * ── Why the output is readable ───────────────────────────────────────────
 *
 * Each row is one string, one character per cell, `.` for sea and a symbol per
 * state. So the artifact is the map: open the JSON and India is visible in it.
 * That is not decoration. The failure this guards against is a projection or
 * an extent that quietly drops a territory, and a numeric array of state
 * indices would hide that completely while a picture shows it at a glance.
 *
 * ── What is in frame ─────────────────────────────────────────────────────
 *
 * Every feature in the topology, islands included. Fitting the mainland alone
 * would give a tighter picture and would silently drop the Andaman & Nicobar
 * Islands and Lakshadweep off the edge of it. Territory is not cropped for
 * composition here; the empty water between the mainland and the Andamans is
 * the Bay of Bengal, and it is supposed to be there.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { geoContains, geoMercator } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import topo from "../../data/geo/india-states.topo.json";

const OUT = outPath(join(process.cwd(), "data", "geo", "ascii-india.json"));
/**
 * Where to write. `--out <path>` exists so the check can regenerate into a
 * scratch file and diff, instead of overwriting the committed one and leaving
 * the working tree dirty every time the tests run.
 */
function outPath(fallback: string): string {
  const i = process.argv.indexOf("--out");
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}


/**
 * Columns, and how much taller a character cell is than it is wide.
 *
 * A monospace cell is roughly half as wide as it is tall, so a grid sampled on
 * square cells and printed as characters comes out stretched to twice India's
 * real height. 2.05 is the ratio the site's mono stack actually renders at;
 * the projection samples on that rectangle so the printed result is in
 * proportion rather than the sampling being.
 */
const COLS = 104;
const CELL_ASPECT = 2.05;

/**
 * The symbol alphabet, one character per state.
 *
 * Sixty-four printable characters that are unambiguous in a monospace font: no
 * `.` (which means sea), and no character that a reader could mistake for
 * another at small size. Thirty-seven states need thirty-seven of them.
 */
const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+~";

interface StateProps { name: string | null }

async function run(): Promise<void> {
  const t = topo as unknown as Topology<{ india: GeometryCollection<StateProps> }>;
  const fc = feature(t, t.objects.india) as FeatureCollection<Geometry, StateProps>;

  // A feature with no name cannot be labelled, clicked or joined to any data,
  // so it is drawn as land and carries no state. Dropping it instead would
  // punch a hole in the coastline.
  const named: Array<Feature<Geometry, StateProps>> = fc.features;
  const names = [...new Set(named.map((f) => f.properties.name).filter((n): n is string => Boolean(n)))]
    .sort((a, b) => a.localeCompare(b));
  if (names.length > ALPHABET.length) {
    throw new Error(`${names.length} states but only ${ALPHABET.length} symbols`);
  }
  const symbolOf = new Map(names.map((n, i) => [n, ALPHABET[i]!]));

  // Rows follow from the columns and the aspect, so the grid is square in
  // ground terms however many columns are asked for.
  const [[x0, y0], [x1, y1]] = boundsOf(fc);
  const lonSpan = x1 - x0;
  const latSpan = y1 - y0;
  const ROWS = Math.max(8, Math.round((COLS * (latSpan / lonSpan)) / CELL_ASPECT * 1.18));

  const proj = geoMercator().fitExtent(
    [[0, 0], [COLS, ROWS * CELL_ASPECT]],
    fc,
  );

  // Bounding boxes first. Testing every cell against every state is thirty-
  // seven polygon walks per cell; a box test rejects almost all of them in a
  // pair of comparisons and takes the run from six seconds to well under one.
  const boxes = named.map((f) => ({ f, b: boundsOf({ type: "FeatureCollection", features: [f] }) }));

  const rows: string[] = [];
  const cellsPerState = new Map<string, { n: number; sx: number; sy: number }>();
  let land = 0;

  for (let r = 0; r < ROWS; r++) {
    let line = "";
    for (let c = 0; c < COLS; c++) {
      const pt = proj.invert?.([c + 0.5, (r + 0.5) * CELL_ASPECT]);
      let hit: string | null = null;
      let isLand = false;
      if (pt) {
        for (const { f, b } of boxes) {
          if (pt[0] < b[0][0] || pt[0] > b[1][0] || pt[1] < b[0][1] || pt[1] > b[1][1]) continue;
          if (!geoContains(f, pt)) continue;
          isLand = true;
          hit = f.properties.name;
          break;
        }
      }
      if (isLand) land++;
      if (hit) {
        const e = cellsPerState.get(hit) ?? { n: 0, sx: 0, sy: 0 };
        e.n++; e.sx += c; e.sy += r;
        cellsPerState.set(hit, e);
      }
      // Unnamed land takes the last symbol slot so it still draws as coastline.
      line += hit ? symbolOf.get(hit)! : isLand ? "?" : ".";
    }
    rows.push(line);
  }

  // Trim blank rows and columns. The projection centres the subject inside the
  // extent it was given and the leftover is empty sea on one axis; keeping it
  // would put a hundred blank characters into every render.
  const keepRow = rows.map((l) => /[^.]/.test(l));
  const top = keepRow.indexOf(true);
  const bottom = keepRow.lastIndexOf(true);
  const kept = rows.slice(top, bottom + 1);
  let left = COLS, right = 0;
  for (const l of kept) {
    const a = l.search(/[^.]/);
    const b = l.length - 1 - [...l].reverse().join("").search(/[^.]/);
    if (a >= 0) { left = Math.min(left, a); right = Math.max(right, b); }
  }
  const grid = kept.map((l) => l.slice(left, right + 1));

  /**
   * Where a state's label belongs: its centre of mass in cells, not its
   * geographic centroid.
   *
   * They differ for the states shaped like a crescent, and a label placed at a
   * geographic centroid can land in a neighbour — or in the sea, for Kerala.
   * The mean of the cells actually assigned to a state is always inside it in
   * the only sense the grid has.
   */
  const anchors = [...cellsPerState.entries()]
    .map(([name, e]) => ({
      state: name,
      symbol: symbolOf.get(name)!,
      cells: e.n,
      col: Math.round(e.sx / e.n) - left,
      row: Math.round(e.sy / e.n) - top,
    }))
    .sort((a, b) => b.cells - a.cells);

  const missing = names.filter((n) => !cellsPerState.has(n));

  await writeFile(OUT, JSON.stringify({
    builtAt: new Date().toISOString(),
    source: "data/geo/india-states.topo.json, the same topology every map on this site draws.",
    note:
      "India sampled onto a character grid: one character per cell, '.' for sea, a symbol per " +
      "state, '?' for land the topology does not name. Generated by scripts/geo/build-ascii-" +
      "india.ts and checked by regenerating it.",
    projection: "Mercator, fitted to every feature including the island territories.",
    cols: grid[0]?.length ?? 0,
    rows: grid.length,
    cellAspect: CELL_ASPECT,
    landCells: land,
    /**
     * States the grid is too coarse to show.
     *
     * Recorded rather than ignored. At this resolution a cell is roughly sixty
     * kilometres across, so the small union territories can fall between
     * sample points entirely — and a state that is silently absent from the
     * map is exactly the kind of hole this file exists to make visible.
     */
    unsampled: missing,
    symbols: Object.fromEntries(names.map((n) => [symbolOf.get(n)!, n])),
    anchors,
    grid,
  }, null, 2) + "\n", "utf8");

  console.log(`  ${grid[0]?.length}×${grid.length} cells, ${land} land, ${anchors.length} states`);
  if (missing.length > 0) console.log(`  too small to sample: ${missing.join(", ")}`);
  for (const line of grid) console.log("  " + line.replace(/[^.]/g, "#"));
}

/** Lon/lat bounds of a collection, walked directly because d3.geoBounds clips. */
function boundsOf(fc: FeatureCollection<Geometry, StateProps>): [[number, number], [number, number]] {
  let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
  const walk = (co: unknown): void => {
    if (Array.isArray(co) && typeof co[0] === "number" && typeof co[1] === "number") {
      x0 = Math.min(x0, co[0]); x1 = Math.max(x1, co[0]);
      y0 = Math.min(y0, co[1]); y1 = Math.max(y1, co[1]);
      return;
    }
    if (Array.isArray(co)) for (const c of co) walk(c);
  };
  for (const f of fc.features) walk((f.geometry as { coordinates?: unknown }).coordinates);
  return [[x0, y0], [x1, y1]];
}

run().catch((err) => { console.error(err); process.exit(1); });
