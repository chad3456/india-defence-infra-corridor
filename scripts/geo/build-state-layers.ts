/**
 * What is in each state, by name, for the map to answer a click with.
 *
 *   npm run geo:layers
 *
 * The ask this serves: choose a layer, click a state, and see the things in it
 * named — with a line saying why each one matters rather than a bare count.
 *
 * ── The join is the whole problem ────────────────────────────────────────
 *
 * Three of this site's datasets carry a state field or a coordinate, and none
 * of them was written to be joined to a map. So each layer here declares how
 * its rows reach a state, and the result records how many made it:
 *
 *   sacred    the source states it. 29 of 29 state names match the topology
 *             exactly, so nothing is normalised and nothing is guessed.
 *   airports  a coordinate, resolved by point-in-polygon against the same
 *             topology the map draws. An airport that lands in no polygon is
 *             recorded as unplaced rather than assigned to its nearest state.
 *   metro     a line's path, resolved by its midpoint for the same reason. A
 *             line that crosses a border belongs to one state here and the
 *             file says which rule put it there.
 *
 * ── The layer that is deliberately absent ────────────────────────────────
 *
 * The contested-sites list is not here, and the reason is worth writing down
 * because it looks joinable and is not. Its state names are the states of
 * 1990: its Adilabad sites sit under ANDHRA PRADESH, and Adilabad has been in
 * Telangana since 2014. Joining that list to a modern state map would move
 * hundreds of sites into the wrong state and the map would look entirely
 * normal while doing it. It keeps its own page, on its own boundaries.
 */
import { writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import topo from "../../data/geo/india-states.topo.json";

const ROOT = process.cwd();
const OUT = outPath(join(ROOT, "data", "geo", "state-layers.json"));
/**
 * Where to write. `--out <path>` exists so the check can regenerate into a
 * scratch file and diff, instead of overwriting the committed one and leaving
 * the working tree dirty every time the tests run.
 */
function outPath(fallback: string): string {
  const i = process.argv.indexOf("--out");
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}


interface StateProps { name: string | null }
interface Item {
  name: string;
  /** Why this one matters, in the words the source supports. */
  why: string;
  /** Where the claim in `why` came from, so a reader can weigh it. */
  basis: string;
  lat?: number;
  lon?: number;
}
interface Layer {
  id: string;
  label: string;
  /** One line the page prints above the list. */
  blurb: string;
  /** How rows reached a state, printed so a reader can discount it. */
  join: string;
  source: string;
  total: number;
  placed: number;
  /**
   * Rows the join could not put in a state, counted.
   *
   * Separate from `unplaced`, because that list is a capped sample and the
   * first version of this file had no count at all. `placed` plus the length
   * of the sample came to 3,388 against a total of 3,466, and the seventy-
   * eight rows in between were simply unaccounted for. A file that does not
   * balance is a file whose coverage claim cannot be checked.
   */
  unplacedCount: number;
  /**
   * Rows dropped as duplicates of one already counted.
   *
   * The third column the ledger needs. Chennai's Blue Line is tagged once per
   * direction; collapsing the pair is right, but without this the dropped row
   * left neither a placement nor an unplaced entry, and the total came up one
   * short with nothing anywhere to say why.
   */
  deduped: number;
  /** A sample of the unplaced, for diagnosis. Never a count — see above. */
  unplaced: string[];
  byState: Record<string, Item[]>;
}

/** placed + unplaced + deduped must equal total, or the layer does not balance. */
function balanced(l: Layer): Layer {
  if (l.placed + l.unplacedCount + l.deduped !== l.total) {
    throw new Error(
      `${l.id} does not balance: ${l.placed} placed + ${l.unplacedCount} unplaced + ` +
      `${l.deduped} deduped != ${l.total} rows`,
    );
  }
  return l;
}

const t = topo as unknown as Topology<{ india: GeometryCollection<StateProps> }>;
const fc = feature(t, t.objects.india) as FeatureCollection<Geometry, StateProps>;
const polys = fc.features.filter((f) => f.properties.name);

/** Bounding boxes, so a point test rejects 36 of 37 states in two comparisons. */
const boxes = polys.map((f) => {
  let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
  const walk = (co: unknown): void => {
    if (Array.isArray(co) && typeof co[0] === "number" && typeof co[1] === "number") {
      x0 = Math.min(x0, co[0]); x1 = Math.max(x1, co[0]);
      y0 = Math.min(y0, co[1]); y1 = Math.max(y1, co[1]);
      return;
    }
    if (Array.isArray(co)) for (const c of co) walk(c);
  };
  walk((f.geometry as { coordinates?: unknown }).coordinates);
  return { f, x0, y0, x1, y1 };
});

function stateAt(lon: number, lat: number): string | null {
  for (const b of boxes) {
    if (lon < b.x0 || lon > b.x1 || lat < b.y0 || lat > b.y1) continue;
    if (geoContains(b.f as Feature<Geometry, StateProps>, [lon, lat])) return b.f.properties.name;
  }
  return null;
}

const read = <T,>(p: string): T => JSON.parse(readFileSync(join(ROOT, p), "utf8")) as T;

/** Sentence case for a figure list, so "Shiva, Parvati" reads as prose. */
function listOf(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? "";
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

// ── Sacred sites ────────────────────────────────────────────────────────
function sacredLayer(): Layer {
  interface Ded { figure: string; basis: string }
  interface Site {
    qid: string; name: string; lat: number; lon: number; state: string | null;
    dedications: Ded[]; inception: string | null; heritage: string | null;
  }
  interface CanonSet { label: string; members: Array<{ name: string; qid: string | null }> }
  const atlas = read<{ sites: Site[]; canon?: CanonSet[] }>("data/sacred/atlas.json");

  // Canon membership by QID, so "one of the twelve Jyotirlingas" is asserted
  // from the tradition's own list rather than from a name that looks similar.
  const canonOf = new Map<string, string[]>();
  for (const set of atlas.canon ?? []) {
    for (const m of set.members) {
      if (!m.qid) continue;
      canonOf.set(m.qid, [...(canonOf.get(m.qid) ?? []), set.label]);
    }
  }

  const byState: Record<string, Item[]> = {};
  const unplaced: string[] = [];
  let noState = 0;
  for (const s of atlas.sites) {
    if (!s.state) { noState++; if (unplaced.length < 40) unplaced.push(s.name); continue; }
    const canon = canonOf.get(s.qid) ?? [];
    const figures = [...new Set(s.dedications.map((d) => d.figure))];
    const stated = s.dedications.some((d) => d.basis === "stated");

    const parts: string[] = [];
    if (canon.length > 0) parts.push(`One of the ${listOf(canon)}`);
    if (figures.length > 0) parts.push(`Dedicated to ${listOf(figures)}`);
    if (s.heritage) parts.push(s.heritage);
    if (s.inception) parts.push(`recorded from ${s.inception}`);

    const why = parts.length > 0
      ? parts.join(" · ")
      // The honest empty case. A blank cell would read as "nothing notable";
      // the sentence says the atlas holds the site and not a reason for it.
      : "Placed by coordinate. No dedication, date or heritage status is stated for it.";
    const basis = canon.length > 0
      ? "the tradition's own list of members"
      : stated ? "a dedication stated on the record"
      : figures.length > 0 ? "a figure inferred from the site's name"
      : "coordinates only";

    (byState[s.state] ??= []).push({ name: s.name, why, basis, lat: s.lat, lon: s.lon });
  }
  /**
   * Best-attested first, not alphabetical.
   *
   * The panel shows sixty of Kerala's eight hundred and fifty-two. Sorted by
   * name those sixty are every temple beginning with A, and almost all of them
   * carry the "no dedication, date or heritage status is stated" line — so the
   * layer's first impression is that the atlas knows nothing, when it holds a
   * Jyotirlinga and thirty World Heritage entries a few hundred rows down.
   * Ranking by how much is known puts the evidence where it can be seen and
   * leaves the thin rows for the reader who scrolls.
   */
  const evidence = (i: Item): number =>
    i.basis.startsWith("the tradition") ? 0
      : i.basis.startsWith("a dedication") ? 1
      : i.basis.startsWith("a figure") ? 2 : 3;
  for (const list of Object.values(byState)) {
    list.sort((a, b) => evidence(a) - evidence(b) || a.name.localeCompare(b.name));
  }

  return balanced({
    id: "sacred",
    label: "Temples & sacred sites",
    blurb:
      "Sites the atlas can place, with whatever the record says about each. Canon membership " +
      "comes from the tradition's own list; a dedication may be stated or inferred from the name, " +
      "and the difference is printed on every row.",
    join: "The source states the state. All 29 of its state names match the map's topology exactly.",
    source: "Wikidata, via the sacred geography connector.",
    total: atlas.sites.length,
    placed: Object.values(byState).reduce((n, l) => n + l.length, 0),
    unplacedCount: noState,
    deduped: 0,
    unplaced,
    byState,
  });
}

// ── Airports ────────────────────────────────────────────────────────────
function airportLayer(): Layer {
  interface A { name: string; iata: string; lon: number; lat: number }
  const rows = read<A[]>("data/mobility/airports.json");
  const byState: Record<string, Item[]> = {};
  const unplaced: string[] = [];
  for (const a of rows) {
    const st = stateAt(a.lon, a.lat);
    if (!st) { unplaced.push(`${a.name}${a.iata ? ` (${a.iata})` : ""}`); continue; }
    (byState[st] ??= []).push({
      name: a.name,
      // Deliberately thin. The airports file carries a name, a code and a
      // coordinate, and nothing about traffic, runway or status — so the line
      // says what is known rather than borrowing an importance from elsewhere.
      why: a.iata
        ? `Scheduled-service airport, IATA ${a.iata}. Passenger and movement figures are not in this dataset.`
        : "Airport with no IATA code in this dataset, which usually means it carries no scheduled service.",
      basis: "OurAirports via the mobility connector: name, code and coordinate only",
      lat: a.lat, lon: a.lon,
    });
  }
  for (const list of Object.values(byState)) list.sort((a, b) => a.name.localeCompare(b.name));
  return balanced({
    id: "airports",
    label: "Airports",
    blurb:
      "Every airport the mobility dataset holds a coordinate for, placed into the state whose " +
      "polygon contains it. Named and located only — this file knows nothing about how busy any " +
      "of them are.",
    join: "Point-in-polygon against the map's own topology. An airport in no polygon is listed unplaced, never assigned to a neighbour.",
    source: "OurAirports, via the mobility connector.",
    total: rows.length,
    placed: Object.values(byState).reduce((n, l) => n + l.length, 0),
    unplacedCount: unplaced.length,
    deduped: 0,
    unplaced,
    byState,
  });
}

// ── Metro lines ─────────────────────────────────────────────────────────
function metroLayer(): Layer {
  interface M {
    name: string; city: string; operator: string; stations: number;
    path: Array<[number, number]>;
  }
  const rows = read<M[]>("data/mobility/metro.json");
  const byState: Record<string, Item[]> = {};
  const unplaced: string[] = [];
  const seen = new Set<string>();
  let deduped = 0;
  for (const m of rows) {
    if (!Array.isArray(m.path) || m.path.length === 0) { unplaced.push(m.name); continue; }
    const mid = m.path[Math.floor(m.path.length / 2)]!;
    const st = stateAt(mid[0], mid[1]);
    if (!st) { unplaced.push(m.name); continue; }
    // Delhi Metro alone runs ~30 named line variants; one row per direction
    // would list the same line twice under the same state.
    const key = `${st}|${m.name}`;
    if (seen.has(key)) { deduped++; continue; }
    seen.add(key);
    (byState[st] ??= []).push({
      name: m.name,
      why:
        `${m.city}${m.stations ? `, ${m.stations} stations` : ""}` +
        `${m.operator ? ` · run by ${m.operator}` : ""}.`,
      basis: "OpenStreetMap relation tags: line name, station count and operator as tagged",
      lat: mid[1], lon: mid[0],
    });
  }
  for (const list of Object.values(byState)) list.sort((a, b) => a.name.localeCompare(b.name));
  return balanced({
    id: "metro",
    label: "Metro lines",
    blurb:
      "Urban rail lines as OpenStreetMap has them tagged, each placed by the state its midpoint " +
      "falls in. Station counts are tags rather than an operator's published figure.",
    join: "The line's midpoint, point-in-polygon. A line that crosses a state border appears once, under the state containing its middle.",
    source: "OpenStreetMap, via the mobility connector.",
    total: rows.length,
    placed: Object.values(byState).reduce((n, l) => n + l.length, 0),
    unplacedCount: unplaced.length,
    deduped,
    unplaced,
    byState,
  });
}

async function run(): Promise<void> {
  const layers = [sacredLayer(), airportLayer(), metroLayer()];

  await writeFile(OUT, JSON.stringify({
    builtAt: new Date().toISOString(),
    note:
      "Named things per state, for the map to answer a click with. Each layer records how its " +
      "rows reached a state and how many did not, because the join is where this kind of file " +
      "goes wrong invisibly.",
    refused: [
      {
        layer: "Contested religious sites",
        why:
          "Its state names are the states of 1990 — its Adilabad sites sit under ANDHRA PRADESH, " +
          "and Adilabad has been in Telangana since 2014. Joined to a modern map it would move " +
          "hundreds of sites into the wrong state while looking entirely normal. It keeps its " +
          "own page, on its own boundaries.",
      },
      {
        layer: "Defence establishments and production sites",
        why:
          "There is no per-state list of them in this repository. The defence data here is " +
          "national totals, trade codes and company names without locations, and inventing " +
          "coordinates for a factory is exactly the failure this site exists to avoid.",
      },
    ],
    layers,
  }, null, 2) + "\n", "utf8");

  for (const l of layers) {
    console.log(
      `  ${l.id.padEnd(10)} ${String(l.placed).padStart(5)} of ${String(l.total).padStart(5)} placed ` +
      `across ${String(Object.keys(l.byState).length).padStart(2)} states` +
      `${l.unplacedCount > 0 ? `, ${l.unplacedCount} unplaced` : ""}` +
      `${l.deduped > 0 ? `, ${l.deduped} deduplicated` : ""}`,
    );
  }
}

run().catch((err) => { console.error(err); process.exit(1); });
