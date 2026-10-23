/**
 * The district map's geometry and catalogue, computed on the server from the
 * scheduled job's files: each district's outline becomes one SVG path string,
 * so no geometry library or boundary file reaches the browser.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { geoMercator, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry as GeoGeometry } from "geojson";
import { VALUES_VERSION, idOf, type DistrictMapData, type Geometry, type SpatialDistricts, type SpatialValues } from "./spatial-india";

export type { DistrictMapData, DistrictShape } from "./spatial-india";

const DIR = join(process.cwd(), "data", "spatial-india");
const read = <T,>(f: string): T | null => { const p = join(DIR, f); return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : null; };

/**
 * d3-geo reads polygons on the sphere: an outer ring must run clockwise, or it
 * is taken as everything except the district and fills the whole frame.
 * GeoJSON (RFC 7946) winds them the other way, so each ring is set right here.
 */
const area = (r: number[][]) => r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]!; return a + (p[0]! * q[1]! - q[0]! * p[1]!); }, 0);
const wind = (poly: number[][][]) => poly.map((r, i) => ((i === 0 ? area(r) > 0 : area(r) < 0) ? [...r].reverse() : r));
function rewind(g: Geometry): Geometry {
  return g.type === "Polygon" ? { type: "Polygon", coordinates: wind(g.coordinates) } : { type: "MultiPolygon", coordinates: g.coordinates.map(wind) };
}

let cached: DistrictMapData | null = null;
export function districtMap(width = 640, height = 720): DistrictMapData | null {
  if (cached) return cached;
  const districts = read<SpatialDistricts>("districts.json"), outlines = read<Record<string, Geometry>>("outlines.json"), values = read<SpatialValues>("values.json");
  if (!districts || !outlines || !values) return null;
  const byId = new Map(districts.rows.map((r) => [idOf(r) ?? "", r]));
  const features: Array<Feature<GeoGeometry, { id: string }>> = Object.entries(outlines).filter(([id]) => byId.has(id)).map(([id, g]) => ({ type: "Feature", properties: { id }, geometry: rewind(g) as GeoGeometry }));
  const fc: FeatureCollection<GeoGeometry, { id: string }> = { type: "FeatureCollection", features };
  const proj = geoMercator().fitExtent([[8, 8], [width - 8, height - 8]], fc);
  const path = geoPath(proj).digits(1);
  const shapes = features.map((f) => {
    const r = byId.get(f.properties.id)!;
    return { id: f.properties.id, name: String(r.district ?? r.name ?? ""), state: String(r.state ?? ""), d: path(f) ?? "" };
  }).filter((s) => s.d);
  // Measured = a value that is not flagged as estimated: the only kind this site publishes.
  const indicators = values.indicators.map((ind) => ({ ...ind, measured: Object.values(values.values).filter((v) => { const x = v[ind.id]; return !!x && x[0] !== null && !x[1]; }).length }));
  // Published only with good coverage: outlines and values for at least 90% of districts, and values that carry the estimated flag.
  const withValues = Object.keys(values.values).length;
  // DISTRICT_MAP_MIN_SHARE exists for local previews only; production uses the 90% floor.
  const floor = Number(process.env.DISTRICT_MAP_MIN_SHARE ?? 0.9);
  if (values.version !== VALUES_VERSION || shapes.length < districts.count * floor || withValues < districts.count * floor) return null;
  cached = { width, height, shapes, indicators, meta: values.meta, fetchedAt: values.fetchedAt, districts: districts.count, outlines: shapes.length };
  return cached;
}

/** One indicator's values by district, estimates removed. */
export function indicatorValues(id: string): { values: Record<string, number>; estimated: number; missing: number } | null {
  const values = read<SpatialValues>("values.json");
  if (!values || values.version !== VALUES_VERSION || !values.indicators.some((i) => i.id === id)) return null;
  const out: Record<string, number> = {};
  let estimated = 0, missing = 0;
  for (const [d, v] of Object.entries(values.values)) {
    const x = v[id];
    if (!x || x[0] === null) missing++;
    else if (x[1]) estimated++;
    else out[d] = x[0];
  }
  return { values: out, estimated, missing };
}
