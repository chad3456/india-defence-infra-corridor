/**
 * Which country a coordinate falls in, answered locally.
 *
 * ── Why this is not a request ────────────────────────────────────────────
 *
 * The obvious way to put a country on an OpenStreetMap object is to ask
 * Overpass for it — `area["ISO3166-1"="IN"]` filters to a country and the
 * answer needs no interpretation. It also costs one request per country
 * against a service that returns 429 when pushed, and there are near two
 * hundred of them.
 *
 * The world's borders are already in this repository, because every choropleth
 * on the site is drawn from them. Testing a point against those polygons is
 * exact, free, reproducible without the network, and — the part that matters —
 * it uses the same boundaries the reader will see the point drawn on. A
 * country assigned by one source and mapped by another will eventually
 * disagree at a border, and the disagreement will look like a bug in the data
 * rather than in the join.
 *
 * ── Disputed boundaries ──────────────────────────────────────────────────
 *
 * world-atlas derives from Natural Earth, whose depiction of contested borders
 * — Kashmir above all — is its own editorial position and not this project's.
 * A point in a disputed area is assigned to whichever polygon Natural Earth
 * draws around it, which is a statement about Natural Earth. Anything on this
 * site that reports a per-country count from these assignments has to say so,
 * and the site's existing disputed-territory notice covers the same ground.
 */
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";
import { alphaOf } from "../../../lib/iso";
import type { Feature, Geometry } from "geojson";

export interface WorldShapes {
  features: Array<Feature<Geometry, { name?: string }>>;
}

/**
 * The atlas, loaded once.
 *
 * 110m rather than 50m or 10m: the question here is which country a point is
 * in, not where the coastline is to the metre, and the coarse file is a
 * hundredth of the size. A point within a kilometre of a border may land on
 * the wrong side of it — which is why `countryAt` is used for counting and
 * never for adjudicating anything about a specific place.
 */
export async function loadWorld(): Promise<WorldShapes> {
  const topo = (await import("world-atlas/countries-110m.json", { with: { type: "json" } })).default;
  // topojson's types are loose here; the shape is a FeatureCollection.
  const fc = feature(topo as never, (topo as never as { objects: { countries: unknown } }).objects.countries as never);
  return { features: (fc as unknown as { features: WorldShapes["features"] }).features };
}

/**
 * The country containing a point, or null if it is at sea or on no polygon.
 *
 * Linear over the feature list, which is 177 polygons — fast enough for the
 * few thousand points this repo passes through it, and not fast enough for
 * millions. A spatial index would be the fix if that changes.
 */
export function countryAt(
  world: WorldShapes,
  lon: number,
  lat: number,
): { iso: string; name: string } | null {
  for (const f of world.features) {
    if (!geoContains(f, [lon, lat])) continue;
    /*
     * world-atlas keys features by ISO 3166-1 numeric, as a string with the
     * leading zero dropped for codes below 100. `alphaOf` already handles that
     * because the site's choropleths join the same way.
     */
    const iso = alphaOf(String(f.id ?? ""));
    if (!iso) return null;
    return { iso, name: f.properties?.name ?? iso };
  }
  return null;
}
