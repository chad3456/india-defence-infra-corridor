/**
 * The /malnutrition map, built on the server from committed files: district
 * outlines from Spatial India, simplified and projected to SVG paths; the
 * NFHS-5 district values, estimates removed; national and state figures from
 * the DHS Program's NFHS rounds. Node only.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { geoMercator, geoPath } from "d3-geo";
import { mesh } from "topojson-client";
import type { Feature, FeatureCollection, Geometry as GeoGeometry, MultiLineString } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import { idOf, simplifyRing, type Geometry, type SpatialDistricts, type SpatialValues } from "./spatial-india";
import { MEASURE, MEASURES, stateKey, type MalDistrict, type MalMap, type MeasureId } from "./malnutrition";

const read = <T,>(...p: string[]): T | null => { const f = join(process.cwd(), "data", ...p); return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as T) : null; };

const area = (r: number[][]) => r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]!; return a + (p[0]! * q[1]! - q[0]! * p[1]!); }, 0);
/** d3-geo wants outer rings clockwise; GeoJSON winds them the other way. */
const wind = (poly: number[][][]) => poly.map((r, i) => ((i === 0 ? area(r) > 0 : area(r) < 0) ? [...r].reverse() : r));

function simplify(g: Geometry, tol: number): GeoGeometry | null {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  const out = polys.map((poly) => poly.map((r) => simplifyRing(r, tol)).filter((r) => r.length >= 4)).filter((p) => p.length > 0).map(wind);
  return out.length ? { type: "MultiPolygon", coordinates: out } : null;
}

interface Rounds { fetchedAt: string; surveys: Array<{ id: string; name: string }>; metrics: Array<{ key: string; points: Array<{ survey: string; total: number | null; states?: Record<string, number | null> | Array<{ name: string; value: number | null }> }> }> }

let cached: MalMap | null = null;
export function malnutritionMap(width = 760, height = 860): MalMap | null {
  if (cached) return cached;
  const districts = read<SpatialDistricts>("spatial-india", "districts.json");
  const outlines = read<Record<string, Geometry>>("spatial-india", "outlines.json");
  const values = read<SpatialValues>("spatial-india", "values.json");
  const rounds = read<Rounds>("nfhs", "rounds.json");
  const topo = read<Topology>("geo", "india-states.topo.json");
  if (!districts || !outlines || !values) return null;

  const rows = new Map(districts.rows.map((r) => [idOf(r) ?? "", r]));
  const features: Array<Feature<GeoGeometry, { id: string }>> = [];
  for (const [id, g] of Object.entries(outlines)) {
    if (!rows.has(id)) continue;
    const s = simplify(g, 0.016);
    if (s) features.push({ type: "Feature", properties: { id }, geometry: s });
  }
  const fc: FeatureCollection<GeoGeometry, { id: string }> = { type: "FeatureCollection", features };
  const proj = geoMercator().fitExtent([[10, 10], [width - 10, height - 10]], fc);
  const path = geoPath(proj).digits(1);

  const out: MalDistrict[] = features.map((f) => {
    const r = rows.get(f.properties.id)!, vv = values.values[f.properties.id] ?? {};
    const v = {} as Record<MeasureId, number | null>;
    let est = false;
    for (const m of MEASURES) {
      const x = vv[MEASURE[m].spatialId];
      if (x && x[1]) est = true;
      v[m] = x && !x[1] && typeof x[0] === "number" ? x[0] : null;
    }
    return { id: f.properties.id, name: String(r.district ?? ""), state: String(r.state ?? ""), d: path(f) ?? "", v, est };
  }).filter((d) => d.d);

  let outline = "", borders = "";
  if (topo) {
    const obj = topo.objects.india as GeometryCollection;
    const edge = mesh(topo, obj, (a, b) => a === b) as MultiLineString;
    const inner = mesh(topo, obj, (a, b) => a !== b) as MultiLineString;
    outline = path(edge) ?? "";
    borders = path(inner) ?? "";
  }

  // National and state figures: NFHS-4 and NFHS-5 from the DHS Program.
  const national = {} as MalMap["national"];
  const states: MalMap["states"] = {};
  const sid = (name: string) => rounds?.surveys.find((s) => s.name === name)?.id;
  for (const m of MEASURES) {
    const series = rounds?.metrics.find((x) => x.key === MEASURE[m].roundsKey);
    const at = (name: string) => series?.points.find((p) => p.survey === sid(name));
    national[m] = { nfhs4: at("NFHS-4")?.total ?? null, nfhs5: at("NFHS-5")?.total ?? null };
    const st = at("NFHS-5")?.states;
    const entries: Array<[string, number | null]> = Array.isArray(st) ? st.map((x) => [x.name, x.value]) : Object.entries(st ?? {});
    for (const [name, val] of entries) if (typeof val === "number") (states[stateKey(name)] ??= {})[m] = val;
  }

  cached = {
    width, height, districts: out, outline, borders, national, states,
    fetchedAt: values.fetchedAt,
    attribution: (values.meta.attribution ?? []).find((a) => /NFHS|Family Health/i.test(a)) ?? "",
  };
  return cached;
}
