/**
 * The world map, drawn from India's point of view.
 *
 *   npm run geo:world   (reads Natural Earth, writes data/geo/world-ind.json)
 *
 * world-atlas, which the other world maps here use, draws Natural Earth's
 * default view: Pakistan- and China-administered Kashmir drawn outside India.
 * Natural Earth also publishes each country's own view, and India's is only at
 * 1:10m — 13 MB, far too heavy to ship. This reduces it to something a page
 * can project on the server:
 *
 *   * each ring is simplified (Douglas–Peucker, TOLERANCE degrees);
 *   * rings smaller than MIN_SPAN degrees are dropped, except each country's
 *     largest, so no country disappears — a small island state keeps its
 *     outline and is also given a label point to draw a dot at;
 *   * coordinates are rounded to 0.01 degree.
 *
 * Codes come from the `_EH` columns, which Natural Earth fills where the plain
 * ISO column says -99 (France and Norway among them). Every name Natural Earth
 * knows a country by is kept, so sources that name countries rather than code
 * them (the submarine cable map) can be joined without a hand-written table.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "../etl/lib/http";
import { isEntryPoint } from "../etl/lib/entry";

const SRC = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries_ind.geojson";
const OUT = join(process.cwd(), "data", "geo", "world-ind.json");
const TOLERANCE = 0.06;
const MIN_SPAN = 0.35;

type Ring = number[][];
interface NeFeature {
  properties: Record<string, string | number | null>;
  geometry: { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] } | null;
}

export interface WorldCountry {
  iso3: string;
  isoN: string | null;
  iso2: string | null;
  name: string;
  names: string[];
  /** Natural Earth's label point, [lon, lat]. */
  label: [number, number];
  /** True when the country is small enough that its outline will not show. */
  tiny: boolean;
}

function perpendicular(p: number[], a: number[], b: number[]): number {
  const [x, y] = p as [number, number];
  const [x1, y1] = a as [number, number];
  const [x2, y2] = b as [number, number];
  const dx = x2 - x1, dy = y2 - y1;
  const len = dx * dx + dy * dy;
  if (len === 0) return Math.hypot(x - x1, y - y1);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

export function simplify(ring: Ring, tol: number): Ring {
  if (ring.length <= 4) return ring;
  const keep = new Uint8Array(ring.length);
  keep[0] = 1; keep[ring.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, ring.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let max = 0, idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpendicular(ring[i]!, ring[s]!, ring[e]!);
      if (d > max) { max = d; idx = i; }
    }
    if (max > tol && idx > 0) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  return ring.filter((_, i) => keep[i]);
}

function span(ring: Ring): number {
  let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
  for (const [x, y] of ring as Array<[number, number]>) { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, y); d = Math.max(d, y); }
  return Math.max(b - a, d - c);
}

const code = (v: unknown): string | null => (typeof v === "string" && v !== "-99" && v.trim() ? v.trim() : null);

async function main(): Promise<void> {
  const res = await getText(SRC, { timeoutMs: 120_000, retries: 3, cacheMs: 0 });
  if (!res.ok || !res.data) throw new Error(`Natural Earth unreachable: ${res.error}`);
  const src = JSON.parse(res.data) as { features: NeFeature[] };
  const features: Array<{ type: "Feature"; properties: WorldCountry; geometry: { type: "MultiPolygon"; coordinates: Ring[][] } }> = [];
  for (const f of src.features) {
    const p = f.properties;
    if (!f.geometry || p.ADM0_A3 === "ATA") continue;
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    const largest = polys.reduce((best, poly) => (span(poly[0]!) > span(best[0]!) ? poly : best), polys[0]!);
    const out: Ring[][] = [];
    for (const poly of polys) {
      if (poly !== largest && span(poly[0]!) < MIN_SPAN) continue;
      const rings = poly
        .map((r) => simplify(r, TOLERANCE).map(([x, y]) => [Math.round(x! * 100) / 100, Math.round(y! * 100) / 100]))
        .filter((r, i) => i === 0 || (r.length >= 4 && span(r) >= MIN_SPAN));
      if (rings[0] && rings[0].length >= 4) out.push(rings);
      else if (poly === largest) out.push([poly[0]!.map(([x, y]) => [Math.round(x! * 100) / 100, Math.round(y! * 100) / 100])]);
    }
    if (!out.length) continue;
    const names = [...new Set([p.NAME, p.NAME_LONG, p.ADMIN, p.NAME_EN, p.FORMAL_EN, p.BRK_NAME, p.NAME_SORT, p.NAME_ALT, p.GEOUNIT, p.SUBUNIT, p.NAME_CIAWF]
      .filter((n): n is string => typeof n === "string" && n.trim() !== ""))];
    features.push({
      type: "Feature",
      properties: {
        iso3: code(p.ISO_A3_EH) ?? String(p.ADM0_A3),
        isoN: code(p.ISO_N3_EH),
        iso2: code(p.ISO_A2_EH),
        name: String(p.NAME),
        names,
        label: [Number(p.LABEL_X), Number(p.LABEL_Y)],
        tiny: span(largest[0]!) < 1.2,
      },
      geometry: { type: "MultiPolygon", coordinates: out },
    });
  }
  const body = { source: SRC, generatedAt: new Date().toISOString(), tolerance: TOLERANCE, minSpan: MIN_SPAN, type: "FeatureCollection", features };
  const text = JSON.stringify(body);
  await writeFile(OUT, text + "\n", "utf8");
  console.log(`wrote ${OUT}: ${features.length} countries, ${(text.length / 1024).toFixed(0)} KB`);
}

if (isEntryPoint(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
