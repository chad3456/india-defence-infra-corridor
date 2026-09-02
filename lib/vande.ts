/**
 * The Vande Bharat network, assembled for drawing.
 *
 * Two counts live here and both are true, which is the first thing the page has
 * to get right. There are 81 route ARTICLES and 166 distinct TRAIN NUMBERS,
 * because a route runs in both directions and each direction is numbered
 * separately. "161 Vande Bharat trains" and "81 Vande Bharat routes" are the
 * same network described in different units, and picking one silently would
 * make the other look wrong.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildMatcher, type StationLike } from "./station-match";

const DIR = join(process.cwd(), "data/mobility");

export interface RawService {
  title: string; name: string; trainNumbers: string[];
  from: string | null; to: string | null;
  fromCode: string | null; toCode: string | null;
  distanceKm: number | null; stops: number | null;
  frequency: string | null; status: string | null; operator: string | null;
  firstService: string | null; avgSpeedKmh: number | null; journeyTime: string | null;
}

export interface PlacedService extends RawService {
  a: [number, number] | null;
  b: [number, number] | null;
  /** True only when both endpoints resolved to a station. */
  drawable: boolean;
}

export interface VandeData {
  present: boolean;
  builtAt: string | null;
  services: PlacedService[];
  routes: number;
  trainNumbers: number;
  drawable: number;
  /** Endpoint names that no station matched — reported, never approximated. */
  unplaced: string[];
  totalRouteKm: number;
  /** Busiest endpoints, by how many services start or end there. */
  hubs: Array<{ name: string; coord: [number, number]; services: number }>;
}

function read<T>(f: string, fallback: T): T {
  try {
    const p = join(DIR, f);
    if (!existsSync(p)) return fallback;
    return JSON.parse(readFileSync(p, "utf8")) as T;
  } catch { return fallback; }
}

let cached: VandeData | null = null;

export function getVande(): VandeData {
  if (cached) return cached;
  const file = read<{ builtAt?: string; services?: RawService[] }>("vande-services.json", {});
  const stations = read<StationLike[]>("stations.json", []);
  const raw = file.services ?? [];
  if (raw.length === 0 || stations.length === 0) {
    cached = {
      present: false, builtAt: file.builtAt ?? null, services: [], routes: 0,
      trainNumbers: 0, drawable: 0, unplaced: [], totalRouteKm: 0, hubs: [],
    };
    return cached;
  }

  const m = buildMatcher(stations);
  // Query with the code appended when there is one: the code is the surer key,
  // and the matcher tries it before it tries the name.
  const q = (name: string | null, code: string | null): string =>
    !name ? "" : code ? `${name} (${code})` : name;

  const services: PlacedService[] = raw.map((s) => {
    const sa = m.find(q(s.from, s.fromCode));
    const sb = m.find(q(s.to, s.toCode));
    const a: [number, number] | null = sa ? [sa.lon, sa.lat] : null;
    const b: [number, number] | null = sb ? [sb.lon, sb.lat] : null;
    return { ...s, a, b, drawable: a !== null && b !== null };
  });

  const nums = new Set<string>();
  for (const s of raw) for (const n of s.trainNumbers) nums.add(n);

  // Hubs: count each service once per distinct endpoint, so a service that
  // starts and ends at the same station cannot count twice.
  const hubCount = new Map<string, { coord: [number, number]; n: number }>();
  for (const s of services) {
    const ends: Array<[string | null, [number, number] | null]> = [[s.from, s.a], [s.to, s.b]];
    const seen = new Set<string>();
    for (const [name, coord] of ends) {
      if (!name || !coord) continue;
      if (seen.has(name)) continue;
      seen.add(name);
      const cur = hubCount.get(name) ?? { coord, n: 0 };
      cur.n += 1;
      hubCount.set(name, cur);
    }
  }

  cached = {
    present: true,
    builtAt: file.builtAt ?? null,
    services,
    routes: raw.length,
    trainNumbers: nums.size,
    drawable: services.filter((s) => s.drawable).length,
    unplaced: [...new Set(m.misses().filter(Boolean))].sort(),
    totalRouteKm: raw.reduce((t, s) => t + (s.distanceKm ?? 0), 0),
    hubs: [...hubCount.entries()]
      .map(([name, v]) => ({ name, coord: v.coord, services: v.n }))
      .sort((x, y) => y.services - x.services)
      .slice(0, 14),
  };
  return cached;
}

/**
 * Cumulative services over time, from the stated first-service dates.
 *
 * Only services with a parseable date count. The rest are reported as a
 * shortfall rather than being dropped into the earliest bucket, which would
 * invent a launch that did not happen.
 */
export function growth(d: VandeData): { points: Array<{ year: number; count: number }>; dated: number } {
  const years: number[] = [];
  for (const s of d.services) {
    const m = /(\d{4})/.exec(s.firstService ?? "");
    const y = m ? Number(m[1]) : NaN;
    if (Number.isFinite(y) && y >= 2018 && y <= 2030) years.push(y);
  }
  years.sort((a, b) => a - b);
  const out: Array<{ year: number; count: number }> = [];
  const lo = years[0] ?? 2019;
  const hi = years[years.length - 1] ?? 2026;
  for (let y = lo; y <= hi; y++) {
    out.push({ year: y, count: years.filter((v) => v <= y).length });
  }
  return { points: out, dated: years.length };
}
