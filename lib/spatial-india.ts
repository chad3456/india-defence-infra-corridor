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
  for (const re of [/^objectid$/i, /objectid/i, /^lgd_?(district_?)?code$/i, /^dist(rict)?_?lgd$/i, /^id$/i]) {
    const k = Object.keys(row).find((x) => re.test(x));
    if (k && (typeof row[k] === "string" || typeof row[k] === "number")) return String(row[k]);
  }
  return null;
}

/** Douglas–Peucker on one ring, then rounding: a district outline small enough to ship, close enough to read. */
export function simplifyRing(ring: number[][], tol: number): number[][] {
  // A ring smaller than the tolerance in both directions is a sliver: dropped, whatever its point count.
  const xs = ring.map((p) => p[0]!), ys = ring.map((p) => p[1]!);
  if (Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) < tol) return [];
  if (ring.length < 5) return ring.map((p) => [round(p[0]!), round(p[1]!)]);
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, ring.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let max = 0, at = -1;
    const [ax, ay] = ring[a]!, [bx, by] = ring[b]!;
    const dx = bx! - ax!, dy = by! - ay!, len = Math.hypot(dx, dy);
    for (let i = a + 1; i < b; i++) {
      const [px, py] = ring[i]!;
      // A closed ring starts and ends on the same point: measure from that point, not from a zero-length line.
      const d = len < 1e-12 ? Math.hypot(px! - ax!, py! - ay!) : Math.abs(dy * px! - dx * py! + bx! * ay! - by! * ax!) / len;
      if (d > max) { max = d; at = i; }
    }
    if (max > tol && at > 0) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  const out = ring.filter((_, i) => keep[i]).map((p) => [round(p[0]!), round(p[1]!)]);
  return out.length >= 4 ? out : [];
}
const round = (x: number) => Math.round(x * 1e4) / 1e4;

export type Geometry = { type: "Polygon"; coordinates: number[][][] } | { type: "MultiPolygon"; coordinates: number[][][][] };
/** The geometry in a GeoJSON response (a geometry, a feature or a collection's first feature), simplified. */
export function geometryOf(body: unknown, tol = 0.004): Geometry | null {
  let g = body as { type?: string; coordinates?: unknown; geometry?: unknown; features?: Array<{ geometry?: unknown }> } | null;
  if (g?.type === "FeatureCollection") g = (g.features?.[0]?.geometry ?? null) as typeof g;
  else if (g?.type === "Feature") g = (g.geometry ?? null) as typeof g;
  if (!g || !Array.isArray(g.coordinates)) return null;
  // Rings that simplify away (islets smaller than the tolerance) are dropped, not faked.
  const poly = (p: number[][][]) => {
    const rings = p.map((r) => simplifyRing(r, tol));
    // An outer ring that vanishes takes its holes with it; a hole that vanishes is just dropped.
    return rings[0] && rings[0].length >= 4 ? [rings[0], ...rings.slice(1).filter((r) => r.length >= 4)] : [];
  };
  if (g.type === "Polygon") { const c = poly(g.coordinates as number[][][]); return c.length ? { type: "Polygon", coordinates: c } : null; }
  if (g.type === "MultiPolygon") { const c = (g.coordinates as number[][][][]).map(poly).filter((p) => p.length); return c.length ? { type: "MultiPolygon", coordinates: c } : null; }
  return null;
}

/* ── What the page reads ───────────────────────────────────────────────── */

export interface SpatialDistricts { fetchedAt: string; source: string; pagination: string; count: number; rows: Array<Record<string, unknown>> }
/** One indicator as /v1/indicators describes it. */
export interface SpatialIndicator { id: string; name: string; description?: string; unit?: string; source?: string; vintage?: string; category?: string[]; polarity?: string; caveat?: string; estimation_method?: string; coverage?: number; status?: string }
/** Indicator values by district: [value, estimated] pairs, keyed by objectid then indicator id. */
export interface SpatialValues { fetchedAt: string; method: string; meta: { dataset_version?: string; attribution?: string[]; citation?: string }; indicators: SpatialIndicator[]; values: Record<string, Record<string, [number | null, boolean]>> }

/**
 * The values in one district record, whatever shape the API gives them:
 * { indicator_id: number } or { indicator_id: { value, estimated } } or a list
 * of { id, value, estimated }.
 */
export function valuesIn(rec: Record<string, unknown>, ids: Set<string>): Record<string, [number | null, boolean]> {
  const out: Record<string, [number | null, boolean]> = {};
  const take = (id: string, v: unknown) => {
    if (!ids.has(id)) return;
    if (typeof v === "number" || v === null) { out[id] = [typeof v === "number" && Number.isFinite(v) ? v : null, false]; return; }
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      const val = typeof o.value === "number" && Number.isFinite(o.value) ? o.value : null;
      out[id] = [val, o.estimated === true || o.is_estimated === true];
    }
  };
  const walk = (o: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(o)) {
      if (ids.has(k)) take(k, v);
      else if (Array.isArray(v)) for (const x of v) { if (x && typeof x === "object") { const r = x as Record<string, unknown>; const id = typeof r.id === "string" ? r.id : typeof r.indicator === "string" ? r.indicator : typeof r.indicator_id === "string" ? r.indicator_id : null; if (id) take(id, r); } }
      else if (v && typeof v === "object" && !Array.isArray(v)) walk(v as Record<string, unknown>);
    }
  };
  walk(rec);
  return out;
}
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

/** What the district map receives from the server: outlines as SVG paths, and the indicator catalogue. */
export interface DistrictShape { id: string; name: string; state: string; d: string }
export interface DistrictMapData {
  width: number; height: number; shapes: DistrictShape[];
  indicators: Array<SpatialIndicator & { measured: number }>;
  meta: SpatialValues["meta"]; fetchedAt: string | null; districts: number; outlines: number;
}
