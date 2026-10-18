/**
 * Metropolitan France as an SVG path, and the projection that drew it, so the
 * live map can place GDELT's points with the same projection in the browser.
 * Computed on the server from Natural Earth (world-atlas, 1:50m): the outline
 * never reaches the client bundle as geometry, only as one path string.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { geoMercator, geoPath, geoCentroid } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { FRANCE_BOX, type Outline } from "./france-riots-shared";

export type { Outline };

let cached: Outline | null = null;

export function franceOutline(width = 520, height = 520): Outline {
  if (cached) return cached;
  const topo = JSON.parse(readFileSync(join(process.cwd(), "node_modules", "world-atlas", "countries-50m.json"), "utf8")) as Topology;
  const all = feature(topo, topo.objects.countries as GeometryCollection) as unknown as { features: Array<Feature<Polygon | MultiPolygon>> };
  const fr = all.features.find((f) => String(f.id) === "250");
  const polys = !fr ? [] : fr.geometry.type === "Polygon" ? [fr.geometry.coordinates] : fr.geometry.coordinates;
  // Keep the mainland and Corsica; overseas departments are other maps.
  const metro = polys.filter((p) => {
    const [lon, lat] = geoCentroid({ type: "Polygon", coordinates: p });
    return lon > FRANCE_BOX.west && lon < FRANCE_BOX.east && lat > FRANCE_BOX.south && lat < FRANCE_BOX.north;
  });
  const shape: Feature<MultiPolygon> = { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: metro } };
  const proj = geoMercator().fitExtent([[16, 16], [width - 16, height - 16]], shape);
  cached = { d: geoPath(proj)(shape) ?? "", scale: proj.scale(), translate: proj.translate() as [number, number], width, height };
  return cached;
}
