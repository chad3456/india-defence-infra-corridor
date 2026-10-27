/**
 * The geography Protest Watch places headlines with and draws on: every
 * country's names from the site's world map (data/geo/world-ind.json), India's
 * states added to India's names (Punjab left out — Pakistan has one too), and
 * the map's outlines and label points on an Equal Earth projection. Node only.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { geoArea, geoEqualEarth, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, MultiPolygon } from "geojson";
import type { PwCountry } from "./protest-watch";

export const PW_MAP_W = 960, PW_MAP_H = 440;
type Props = { iso2: string; iso3: string; name: string; names?: string[]; label: [number, number]; tiny: boolean };
export interface PwShape { iso2: string; name: string; d: string }

function world(): Array<Feature<MultiPolygon, Props>> {
  const f = join(process.cwd(), "data", "geo", "world-ind.json");
  if (!existsSync(f)) return [];
  const fc = JSON.parse(readFileSync(f, "utf8")) as FeatureCollection<MultiPolygon, Props>;
  // Reverse any ring that d3-geo would read as "the whole sphere except this country".
  return fc.features.map((ft) => ({ ...ft, geometry: { ...ft.geometry, coordinates: ft.geometry.coordinates.map((poly) => (geoArea({ type: "Polygon", coordinates: [poly[0]!] }) > 2 * Math.PI ? poly.map((r) => [...r].reverse()) : poly)) } }));
}

export function protestGeo(): { countries: PwCountry[]; shapes: PwShape[] } {
  const features = world().filter((f) => f.properties.iso2);
  if (!features.length) return { countries: [], shapes: [] };
  const projection = geoEqualEarth().fitExtent([[4, 4], [PW_MAP_W - 4, PW_MAP_H - 4]], { type: "FeatureCollection", features } as FeatureCollection);
  const path = geoPath(projection).digits(1);
  let states: string[] = [];
  try { states = Object.keys((JSON.parse(readFileSync(join(process.cwd(), "data", "geo", "places.json"), "utf8")) as { states: Record<string, unknown> }).states).filter((s) => s !== "Punjab"); } catch { states = []; }
  const countries: PwCountry[] = features.map((f) => {
    const [x, y] = projection(f.properties.label) ?? [0, 0];
    const names = [...new Set([f.properties.name, ...(f.properties.names ?? []), ...(f.properties.iso2 === "IN" ? states : []), ...(f.properties.iso2 === "US" ? ["U.S.", "America", "American"] : []), ...(f.properties.iso2 === "GB" ? ["UK", "Britain", "British", "England", "Scotland", "Wales"] : [])])];
    return { iso2: f.properties.iso2, name: f.properties.name, names, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  });
  // Longer names first, so "South Sudan" is tried before "Sudan".
  countries.sort((a, b) => Math.max(...b.names.map((n) => n.length)) - Math.max(...a.names.map((n) => n.length)));
  const shapes = features.flatMap((f) => { const d = path(f); return d ? [{ iso2: f.properties.iso2, name: f.properties.name, d }] : []; });
  return { countries, shapes };
}
