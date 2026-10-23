/**
 * Spatial India (api.spatialindia.com): a free, keyless API that joins public
 * district data — Census 2011, NFHS-5, NCRB, NJDG, RBI and more — onto one
 * frame of 800-odd districts. Shared by the scheduled connector, the /districts
 * page and the tests. No node imports.
 *
 * ── Its estimates are not our data ───────────────────────────────────────
 *
 * Census 2011 has 640 districts and NFHS-5 about 707; Spatial India has 808.
 * For a district created after a source was published it either inherits the
 * parent district's value or estimates one area-proportionally, and flags the
 * value as estimated. This site does not publish estimates: a flagged value
 * is drawn as a gap and counted as missing, never coloured as a measurement.
 */

export const SPATIAL_BASE = "https://api.spatialindia.com";

/** The first array of objects anywhere in a response: the API's envelope is not assumed. */
export function rowsOf(body: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(body)) return body.filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
  if (body && typeof body === "object") {
    for (const k of ["data", "districts", "results", "items", "rows", "features"]) {
      const v = (body as Record<string, unknown>)[k];
      if (Array.isArray(v)) return rowsOf(v);
    }
    for (const v of Object.values(body as Record<string, unknown>)) if (Array.isArray(v) && v.some((x) => x && typeof x === "object")) return rowsOf(v);
  }
  return [];
}

/** The district's identifier for boundaries: an objectid, else an LGD code, else an id. */
export function idOf(row: Record<string, unknown>): string | null {
  for (const re of [/^objectid$/i, /objectid/i, /^lgd_?(district_?)?code$/i, /^id$/i]) {
    const k = Object.keys(row).find((x) => re.test(x));
    if (k && (typeof row[k] === "string" || typeof row[k] === "number")) return String(row[k]);
  }
  return null;
}

/** Douglas–Peucker on one ring, then rounding: a district outline small enough to ship, close enough to read. */
export function simplifyRing(ring: number[][], tol: number): number[][] {
  if (ring.length < 5) return ring.map((p) => [round(p[0]!), round(p[1]!)]);
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, ring.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let max = 0, at = -1;
    const [ax, ay] = ring[a]!, [bx, by] = ring[b]!;
    const dx = bx! - ax!, dy = by! - ay!, len = Math.hypot(dx, dy) || 1e-12;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = ring[i]!;
      const d = Math.abs(dy * px! - dx * py! + bx! * ay! - by! * ax!) / len;
      if (d > max) { max = d; at = i; }
    }
    if (max > tol && at > 0) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  const out = ring.filter((_, i) => keep[i]).map((p) => [round(p[0]!), round(p[1]!)]);
  return out.length >= 4 ? out : ring.slice(0, 4).map((p) => [round(p[0]!), round(p[1]!)]);
}
const round = (x: number) => Math.round(x * 1e4) / 1e4;

export type Geometry = { type: "Polygon"; coordinates: number[][][] } | { type: "MultiPolygon"; coordinates: number[][][][] };
/** The geometry in a GeoJSON response (a geometry, a feature or a collection's first feature), simplified. */
export function geometryOf(body: unknown, tol = 0.004): Geometry | null {
  let g = body as { type?: string; coordinates?: unknown; geometry?: unknown; features?: Array<{ geometry?: unknown }> } | null;
  if (g?.type === "FeatureCollection") g = (g.features?.[0]?.geometry ?? null) as typeof g;
  else if (g?.type === "Feature") g = (g.geometry ?? null) as typeof g;
  if (!g || !Array.isArray(g.coordinates)) return null;
  if (g.type === "Polygon") return { type: "Polygon", coordinates: (g.coordinates as number[][][]).map((r) => simplifyRing(r, tol)) };
  if (g.type === "MultiPolygon") return { type: "MultiPolygon", coordinates: (g.coordinates as number[][][][]).map((p) => p.map((r) => simplifyRing(r, tol))) };
  return null;
}

/* ── What the page reads ───────────────────────────────────────────────── */

export interface SpatialDistricts { fetchedAt: string; source: string; pagination: string; count: number; rows: Array<Record<string, unknown>> }
export interface SpatialProbe { fetchedAt: string; endpoints: Array<{ path: string; status: number; contentType: string; sample: string }> }

/**
 * A field the page can map: numeric in enough districts to draw. Fields named
 * like identifiers, names, codes, flags or coordinates are not indicators.
 */
const NOT_INDICATOR = /^(id|objectid|name|district|state|state_?name|district_?name|lgd|lgd_?code|code|.*_code|lat|lon|lng|latitude|longitude|geometry|slug|url|.*_flag|.*_estimated|estimated.*|is_.*|.*_source|source.*|.*_year|year)$/i;
export function numericFields(rows: Array<Record<string, unknown>>, minShare = 0.5): string[] {
  const keys = new Set(rows.flatMap((r) => Object.keys(r)));
  return [...keys].filter((k) => !NOT_INDICATOR.test(k)).filter((k) => rows.filter((r) => typeof valueOf(r[k]) === "number").length >= rows.length * minShare).sort();
}

/**
 * A field's value in a row, whether the API gives a bare number or an object
 * such as { value, estimated, source }. A value flagged as estimated is null:
 * this site does not publish estimates.
 */
export function valueOf(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (o.estimated === true || o.is_estimated === true || o.imputed === true || o.inherited === true) return null;
    if (typeof o.value === "number" && Number.isFinite(o.value)) return o.value;
  }
  return null;
}
/** Whether a row marks a field's value as estimated, in either of the shapes the API might use. */
export function isEstimated(row: Record<string, unknown>, field: string): boolean {
  const v = row[field];
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (o.estimated === true || o.is_estimated === true || o.imputed === true || o.inherited === true) return true;
  }
  for (const k of [`${field}_estimated`, `${field}_is_estimated`, `is_${field}_estimated`]) if (row[k] === true) return true;
  const flags = row.estimated_fields ?? row.estimatedFields;
  return Array.isArray(flags) && flags.includes(field);
}
