/**
 * Everything /corridors renders: the corridor register, both maps drawn as
 * SVG paths on the server, and the before-and-after-2014 regressions. Node
 * only. The maps are projected here so the browser receives finished paths,
 * not a world's worth of geometry.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { geoMercator, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import { definedPoints, getSeries, sourcesForSeries } from "./data";
import { its, type ItsFit } from "./its";
import { BREAK_YEAR, ECON, FROM_YEAR, verdictOf, type EconSpec, type Verdict } from "./corridors-economy";

type Waypoint = [number, number, string?];
export interface Corridor {
  id: string; name: string; scope: "international" | "national" | "industrial"; mode: string; partners: string[];
  started: number; startedNote: string; status: "operational" | "partly-operational" | "under-construction" | "stalled" | "framework";
  statusNote: string; progress?: number; progressLabel?: string; facts: string[];
  path?: Waypoint[]; lines?: Array<Array<[number, number]>>; seriesIds?: string[]; nodesFrom?: string; sources: string[];
}
interface CorridorFile { accessed: string; note: string; corridors: Corridor[]; logistics: { title: string; points: Array<[number, number]>; note: string; sources: string[] } }

export interface Route { id: string; d: string; mode: string }
export interface MapView { width: number; height: number; land: string; india: string; routes: Route[]; nodes: Array<{ id: string; name: string; x: number; y: number }>; labels: Array<{ id: string; x: number; y: number }> }

const ROOT = process.cwd();
const read = <T,>(...p: string[]) => JSON.parse(readFileSync(join(ROOT, ...p), "utf8")) as T;

/**
 * Thin a projected SVG path for display: drop points within `tol` pixels of
 * the last one kept, and rings smaller than `tol` across. At map scale the
 * difference cannot be seen; the page weighs a fraction of the original.
 */
export function thin(d: string, tol = 1.2): string {
  const out: string[] = [];
  for (const ring of d.split(/(?=M)/)) {
    const pts = [...ring.matchAll(/[ML]\s*(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as [number, number]);
    if (pts.length < 2) continue;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    if (Math.max(...xs) - Math.min(...xs) < tol && Math.max(...ys) - Math.min(...ys) < tol) continue;
    const kept: Array<[number, number]> = [pts[0]!];
    for (let i = 1; i < pts.length - 1; i++) { const [x, y] = pts[i]!, [lx, ly] = kept[kept.length - 1]!; if (Math.hypot(x - lx, y - ly) >= tol) kept.push([x, y]); }
    kept.push(pts[pts.length - 1]!);
    if (kept.length < 3 && /Z/.test(ring)) continue;
    out.push(`M${kept.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join("L")}${/Z/.test(ring) ? "Z" : ""}`);
  }
  return out.join("");
}

function routesFor(c: Corridor, path: ReturnType<typeof geoPath>): Route[] {
  const out: Route[] = [];
  if (c.path) for (let i = 0; i < c.path.length - 1; i++) {
    const a = c.path[i]!, b = c.path[i + 1]!;
    const d = path({ type: "LineString", coordinates: [[a[0], a[1]], [b[0], b[1]]] } as GeoPermissibleObjects);
    if (d) out.push({ id: c.id, d, mode: a[2] ?? "road" });
  }
  for (const line of c.lines ?? []) {
    const d = path({ type: "LineString", coordinates: line } as GeoPermissibleObjects);
    if (d) out.push({ id: c.id, d, mode: "industrial" });
  }
  return out;
}

export function loadCorridors() {
  const file = read<CorridorFile>("data", "corridors", "corridors.json");
  const geoCorr = read<{ cities: Record<string, [number, number]>; defenceCorridorNodes: Array<{ id: string; name: string; corridor: string; city: string }> }>("data", "geo", "corridors.json");

  // ── The world view: Europe to the Russian Far East. ──
  const W = 1000, H = 560;
  const world = read<FeatureCollection<Geometry, { iso3: string; name: string }>>("data", "geo", "world-ind.json");
  const frame: Feature = { type: "Feature", properties: {}, geometry: { type: "MultiPoint", coordinates: [[-8, 58], [150, 58], [150, -8], [-8, -8]] } };
  const wp = geoMercator().fitExtent([[0, 0], [W, H]], frame);
  const wpath = geoPath(wp).digits(1);
  const inView = world.features.filter((f) => {
    const [[x0, y0], [x1, y1]] = wpath.bounds(f);
    return x1 > -50 && x0 < W + 50 && y1 > -50 && y0 < H + 50;
  });
  const worldView: MapView = {
    width: W, height: H,
    land: thin(inView.filter((f) => f.properties.iso3 !== "IND").map((f) => wpath(f) ?? "").join(""), 2.2),
    india: thin(inView.filter((f) => f.properties.iso3 === "IND").map((f) => wpath(f) ?? "").join(""), 0.8),
    routes: file.corridors.filter((c) => c.scope === "international").flatMap((c) => routesFor(c, wpath)),
    nodes: [],
    labels: file.corridors.filter((c) => c.scope === "international" && c.path).map((c) => {
      const mid = c.path![Math.floor((c.path!.length - 1) / 2)]!;
      const [x, y] = wp([mid[0], mid[1]]) ?? [0, 0];
      return { id: c.id, x: Math.round(x), y: Math.round(y) };
    }),
  };

  // ── The India view. ──
  const IW = 560, IH = 620;
  const topo = read<Topology<{ india: GeometryCollection<{ name: string | null }> }>>("data", "geo", "india-states.topo.json");
  const states = feature(topo, topo.objects.india) as FeatureCollection<Geometry, { name: string | null }>;
  const ip = geoMercator().fitSize([IW, IH], states);
  const ipath = geoPath(ip).digits(1);
  const indiaView: MapView = {
    width: IW, height: IH,
    land: thin(states.features.map((f) => ipath(f) ?? "").join(""), 0.9),
    india: "",
    routes: file.corridors.filter((c) => c.scope !== "international").flatMap((c) => routesFor(c, ipath)),
    nodes: geoCorr.defenceCorridorNodes.map((n) => {
      const ll = geoCorr.cities[n.city];
      const [x, y] = ll ? ip(ll) ?? [0, 0] : [0, 0];
      return { id: n.id, name: n.name, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    }),
    labels: [],
  };

  // Series a corridor cites from the site's record.
  const series = (id: string) => { const s = getSeries(id); return s ? { id, title: s.title, unit: s.unitShort, points: definedPoints(s).map((p) => ({ period: p.period, value: p.value as number })) } : null; };
  const corridorSeries = Object.fromEntries(file.corridors.flatMap((c) => c.seriesIds ?? []).map((id) => [id, series(id)]));
  const expressways = series("expressway-length");

  return { file, worldView, indiaView, corridorSeries, expressways, economy: loadEconomy() };
}

export interface EconResult {
  spec: EconSpec;
  unit: string;
  fit: ItsFit | null;
  exCovid: ItsFit | null;
  verdict: Verdict;
  /** The verdict changes when 2020–21 are left out. */
  fragile: boolean;
  points: Array<{ year: number; v: number }>;
  at2014: { year: number; v: number } | null;
  latest: { year: number; v: number } | null;
  meanBefore: number | null;
  meanAfter: number | null;
  sources: Array<{ name: string; url: string }>;
}

export function loadEconomy(): EconResult[] {
  return ECON.map((spec) => {
    const s = getSeries(spec.id);
    const points = s ? definedPoints(s).map((p) => ({ year: Number(p.period), v: p.value as number })).filter((p) => p.year >= FROM_YEAR && Number.isFinite(p.year)) : [];
    const fit = its(points, BREAK_YEAR, { log: spec.log });
    const exCovid = its(points.filter((p) => p.year !== 2020 && p.year !== 2021), BREAK_YEAR, { log: spec.log });
    const verdict = fit ? verdictOf(spec, fit.ci) : "unclear";
    const v2 = exCovid ? verdictOf(spec, exCovid.ci) : verdict;
    const mean = (xs: typeof points) => (xs.length ? xs.reduce((a, p) => a + p.v, 0) / xs.length : null);
    return {
      spec, unit: s?.unitShort ?? "", fit, exCovid, verdict, fragile: v2 !== verdict, points,
      at2014: points.find((p) => p.year === BREAK_YEAR) ?? null, latest: points.at(-1) ?? null,
      meanBefore: mean(points.filter((p) => p.year < BREAK_YEAR)), meanAfter: mean(points.filter((p) => p.year >= BREAK_YEAR)),
      sources: s ? sourcesForSeries(s).map((x) => ({ name: x.name, url: x.url })) : [],
    };
  });
}
