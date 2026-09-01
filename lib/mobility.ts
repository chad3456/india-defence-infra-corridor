/**
 * Mobility data: where the network runs, and what is flying.
 *
 * Read from disk at build time. The three datasets are kept separate here for
 * the same reason the connector keeps them separate: they answer different
 * questions, and the one question none of them answers is how many people
 * travelled. There is deliberately no ridership field anywhere in this file.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "data/mobility");

export interface MetroLine {
  id: number; name: string; city: string | null; operator: string | null;
  colour: string | null; path: Array<[number, number]>; stations: number;
  status?: "operational" | "construction" | "proposed" | "unknown";
}
export interface TrainRoute {
  id: number; name: string; from: string | null; to: string | null;
  path: Array<[number, number]>;
}
export interface Airport { id: number; name: string; iata: string; lon: number; lat: number }
export interface FlightSnapshot { at: string; n: number; pts: Array<[number, number, number]> }

function read<T>(f: string, fallback: T): T {
  try {
    const p = join(DIR, f);
    if (!existsSync(p)) return fallback;
    return JSON.parse(readFileSync(p, "utf8")) as T;
  } catch { return fallback; }
}

/** Great-circle length of a polyline, km. */
export function pathKm(path: Array<[number, number]>): number {
  let km = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!, b = path[i]!;
    const dLat = ((b[1] - a[1]) * Math.PI) / 180;
    const dLon = ((b[0] - a[0]) * Math.PI) / 180;
    const la1 = (a[1] * Math.PI) / 180, la2 = (b[1] * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
    km += 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  return km;
}

/**
 * Length of the UNION of a set of alignments, km.
 *
 * Summing route lengths is the wrong measure for a network: two directions of
 * one line, and every route sharing a trunk section, each contribute their full
 * length. Summed that way Delhi came to 711 km against an operational network
 * of roughly 390.
 *
 * This walks every segment, snaps to a ~275 m grid and counts distinct cells,
 * so track traversed by four services counts once. It is an approximation --
 * cell size sets the resolution and diagonals cross more cells than they should
 * -- but it measures the right quantity, which the sum does not.
 */
export function unionKm(paths: Array<Array<[number, number]>>, cellDeg = 0.0025): number {
  const cells = new Set<string>();
  for (const path of paths) {
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!, b = path[i]!;
      const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const steps = Math.max(1, Math.ceil(span / (cellDeg * 0.5)));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        cells.add(
          Math.round((a[0] + (b[0] - a[0]) * t) / cellDeg) + "," +
          Math.round((a[1] + (b[1] - a[1]) * t) / cellDeg),
        );
      }
    }
  }
  // A cell is cellDeg across; at Indian latitudes a degree of longitude is
  // about 105 km and of latitude about 111, so ~0.27 km per cell.
  return cells.size * cellDeg * 108;
}

export interface Network {
  city: string;
  /** Distinct alignments, after collapsing the two directions of each. */
  lines: number;
  /** Union of track, km — shared trunk sections counted once. */
  km: number;
  /** Union of track excluding anything OSM marks as not yet running. */
  runningKm: number;
  /** Sum of route lengths, kept only to show how far apart the two measures are. */
  routeKm: number;
  stations: number;
  /** Raw relation count, kept so the collapse is visible rather than implied. */
  relations: number;
}

/**
 * Collapse the two directions of a route into one alignment.
 *
 * OSM maps each direction as its own relation -- Delhi's Blue Line appears as
 * "Noida Electronic City → Dwarka Sector 21" and again reversed -- so summing
 * km over relations reports roughly twice the network that exists. Two
 * directions of one branch share the same pair of endpoints in opposite order,
 * so an unordered endpoint pair is the key; a genuine second branch under the
 * same line name has different endpoints and survives as its own alignment.
 *
 * The longest member of each group is kept, because a partial trace of one
 * direction is common and the fuller one is the better record of the line.
 */
export function collapseDirections<T extends { name: string; path: Array<[number, number]> }>(lines: T[]): T[] {
  const groups = new Map<string, T>();
  for (const l of lines) {
    if (l.path.length < 2) continue;
    const a = l.path[0]!, b = l.path[l.path.length - 1]!;
    const r = (n: number) => n.toFixed(2);
    const ends = [`${r(a[0])},${r(a[1])}`, `${r(b[0])},${r(b[1])}`].sort().join("|");
    const base = l.name.split(" (")[0]!.trim().toLowerCase();
    const key = `${base}::${ends}`;
    const cur = groups.get(key);
    if (!cur || l.path.length > cur.path.length) groups.set(key, l);
  }
  return [...groups.values()];
}

export interface MobilityData {
  metro: MetroLine[];
  vande: TrainRoute[];
  airports: Airport[];
  snapshots: FlightSnapshot[];
  networks: Network[];
  present: boolean;
}

let cached: MobilityData | null = null;

export function getMobility(): MobilityData {
  if (cached) return cached;
  const metro = read<MetroLine[]>("metro.json", []);
  const vande = read<TrainRoute[]>("vande-bharat.json", []);
  const airports = read<Airport[]>("airports.json", []);
  const flights = read<{ snapshots: FlightSnapshot[] }>("flights.json", { snapshots: [] });

  // Group lines into networks by the OSM `network` tag, which is what actually
  // carries the city ("Delhi Metro", "Namma Metro"). Lines with no network tag
  // are grouped under Unattributed rather than guessed at from geography.
  const byNet = new Map<string, Network>();
  const rawByNet = new Map<string, number>();
  for (const l of metro) {
    const k = (l.city ?? l.operator ?? "Unattributed").trim();
    rawByNet.set(k, (rawByNet.get(k) ?? 0) + 1);
  }
  const pathsByNet = new Map<string, Array<Array<[number, number]>>>();
  const runningByNet = new Map<string, Array<Array<[number, number]>>>();
  for (const l of collapseDirections(metro)) {
    const key = (l.city ?? l.operator ?? "Unattributed").trim();
    const cur = byNet.get(key) ?? {
      city: key, lines: 0, km: 0, runningKm: 0, routeKm: 0, stations: 0, relations: rawByNet.get(key) ?? 0,
    };
    cur.lines += 1;
    cur.routeKm += pathKm(l.path);
    cur.stations += l.stations;
    byNet.set(key, cur);
    const ps = pathsByNet.get(key) ?? [];
    ps.push(l.path);
    pathsByNet.set(key, ps);
    if (l.status !== "construction" && l.status !== "proposed") {
      const rs = runningByNet.get(key) ?? [];
      rs.push(l.path);
      runningByNet.set(key, rs);
    }
  }
  // Union length is computed per network from all its alignments at once.
  for (const [key, ps] of pathsByNet) {
    const n = byNet.get(key);
    if (n) n.km = unionKm(ps);
  }
  for (const [key, ps] of runningByNet) {
    const n = byNet.get(key);
    if (n) n.runningKm = unionKm(ps);
  }
  const networks = [...byNet.values()].sort((a, b) => b.km - a.km);

  cached = {
    metro, vande, airports,
    snapshots: flights.snapshots ?? [],
    networks,
    present: metro.length > 0 || vande.length > 0 || airports.length > 0,
  };
  return cached;
}

/**
 * Aircraft positions pooled across every snapshot held.
 *
 * Density is a pattern over time, and one call to a live API is a single
 * instant. Pooling the rolling window is the difference between "where planes
 * were at 15:45 UTC" and "where planes tend to be".
 */
export function pooledFlights(d: MobilityData): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  for (const s of d.snapshots) for (const p of s.pts) out.push(p);
  return out;
}
