/**
 * Server-side loader for /china-exports.
 *
 * Reads data/trade/china-exports.json and projects the world map once, on the
 * server, so the page ships SVG path strings rather than a map library. Every
 * total, change and share the page prints is computed here from the committed
 * rows and named as derived where it is; the page writes no number of its own.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { geoEqualEarth, geoPath, geoCentroid } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
import world from "world-atlas/countries-110m.json";
import { PRODUCTS, type ChinaExports, type ChinaView, type MapCountry, type ProductView } from "./china-exports-shared";

export type { ChinaView, MapCountry, ProductView };

export const MAP_W = 960;
export const MAP_H = 470;

function projectMap(): ChinaView["map"] {
  const t = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
  const fc = feature(t, t.objects.countries);
  const features = (fc.features as Array<Feature<Geometry, { name: string }>>).filter((f) => f.properties?.name !== "Antarctica");
  const projection = geoEqualEarth().fitExtent([[6, 6], [MAP_W - 6, MAP_H - 6]], { type: "FeatureCollection", features });
  const path = geoPath(projection);
  const countries: MapCountry[] = [];
  for (const f of features) {
    const d = path(f);
    if (!d || f.id === undefined) continue;
    const [cx, cy] = projection(geoCentroid(f)) ?? [0, 0];
    countries.push({ id: String(f.id), name: f.properties?.name ?? String(f.id), d, cx: Math.round(cx * 10) / 10, cy: Math.round(cy * 10) / 10 });
  }
  // Where the arcs leave from: China's eastern seaboard, not its geographic
  // centroid in the western deserts — a drawing choice, not a data point.
  const origin = projection([117, 31]) ?? [0, 0];
  return { countries, origin: [Math.round(origin[0]), Math.round(origin[1])] };
}

export function loadChinaExports(): ChinaView {
  const map = projectMap();
  const file = join(process.cwd(), "data", "trade", "china-exports.json");
  if (!existsSync(file)) {
    return { present: false, generatedAt: null, latestYear: null, calls: 0, errorCount: 0, map, products: [], buyers: [] };
  }
  const raw = JSON.parse(readFileSync(file, "utf8")) as ChinaExports;
  const byCode = new Map(raw.products.map((p) => [p.code, p]));

  const products: ProductView[] = [];
  for (const meta of PRODUCTS) {
    const p = byCode.get(meta.code);
    if (!p) continue;
    const trend = p.trend.filter((t) => !meta.since || t.year >= meta.since);
    const known = trend.filter((t): t is { year: number; value: number } => t.value !== null && t.value > 0);
    const latest = known.length ? known[known.length - 1]! : null;
    const first = known[0];
    const multiple = first && latest && latest.year - first.year >= 3
      ? { from: first.year, to: latest.year, x: latest.value / first.value } : null;
    const partnerTotal = p.partners.reduce((s, x) => s + x.value, 0);
    products.push({
      code: meta.code, name: meta.name, group: meta.group, note: meta.note ?? null, since: meta.since ?? null,
      trend, latest, multiple,
      byCountry: p.partners.filter((x) => x.atlasId).map((x) => [x.atlasId!, x.value]),
      top: p.partners.slice(0, 15).map((x) => ({ name: x.name, value: x.value, atlasId: x.atlasId })),
      partnerTotal,
      destinations: p.partners.length,
      quantity: p.quantity,
      share: p.share ? { year: p.share.year, pct: (p.share.china / p.share.world) * 100, reporters: p.share.reporters } : null,
      mirror: p.mirror ? {
        year: p.mirror.year,
        china: p.trend.find((t) => t.year === p.mirror!.year)?.value ?? null,
        world: p.mirror.value,
        reporters: p.mirror.reporters,
      } : null,
    });
  }

  // Who buys, across everything on the page. Summed only within one year.
  const year = raw.latestYear;
  const acc = new Map<string, { name: string; atlasId: string | null; value: number; products: number }>();
  for (const p of raw.products) {
    if (p.partnerYear !== year) continue;
    for (const x of p.partners) {
      const k = String(x.m49);
      const a = acc.get(k) ?? { name: x.name, atlasId: x.atlasId, value: 0, products: 0 };
      a.value += x.value; a.products++;
      acc.set(k, a);
    }
  }
  const buyers = [...acc.values()].sort((a, b) => b.value - a.value).slice(0, 15);

  return {
    present: true, generatedAt: raw.generatedAt, latestYear: raw.latestYear, calls: raw.calls,
    errorCount: raw.errors.length, map, products, buyers,
  };
}
