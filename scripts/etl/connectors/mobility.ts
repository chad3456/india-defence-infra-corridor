/**
 * Mobility: what moves, and where the lines actually run.
 *
 * Three sources, kept apart on purpose because they answer different
 * questions and mixing them would produce a number nobody could check.
 *
 *   OSM/Overpass   WHERE the network is. Metro alignments, Vande Bharat
 *                  route relations, airports. Geometry only.
 *   OpenSky        WHAT IS FLYING right now over India, as a snapshot.
 *                  A live count, not an annual total.
 *   operators      HOW MANY people or tonnes moved. Not here yet — it comes
 *                  from DGCA and Railways, and OSM cannot supply it.
 *
 * The distinction that matters: OSM knows a metro line exists and how long it
 * is. It does not know how many people rode it. Any chart on this data must say
 * "km of line" or "stations", never "ridership", and the shapes below make that
 * hard to get wrong by not carrying a ridership field at all.
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { getJson } from "../lib/http";

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, "data/mobility");
const OVERPASS = "https://overpass-api.de/api/interpreter";

/** Overpass throttles hard; a 429 is normal and worth waiting out. */
const PACE_MS = 6_000;
let last = 0;
async function pace(): Promise<void> {
  const w = PACE_MS - (Date.now() - last);
  if (w > 0) await new Promise((r) => setTimeout(r, w));
  last = Date.now();
}

interface OverpassEl {
  type: string; id: number;
  tags?: Record<string, string>;
  members?: Array<{ type: string; ref: number; role: string }>;
  geometry?: Array<{ lat: number; lon: number }>;
  lat?: number; lon?: number;
}
interface OverpassRes { elements?: OverpassEl[] }

async function ask(q: string, label: string, log: (s: string) => void): Promise<OverpassEl[]> {
  for (let attempt = 0; attempt < 4; attempt++) {
    await pace();
    const res = await getJson<OverpassRes>(OVERPASS + "?data=" + encodeURIComponent(q), {
      timeoutMs: 180_000, retries: 0, cacheMs: 12 * 3600_000,
    });
    if (res.ok && res.data?.elements) {
      log(`  ${label}: ${res.data.elements.length} elements`);
      return res.data.elements;
    }
    // 429 and 504 are Overpass saying "later", not "no".
    log(`  ${label}: ${res.error ?? "no elements"} (attempt ${attempt + 1})`);
    await new Promise((r) => setTimeout(r, 8000 * (attempt + 1)));
  }
  return [];
}

export interface MetroLine {
  id: number;
  name: string;
  city: string | null;
  operator: string | null;
  colour: string | null;
  /** Simplified alignment, [lon,lat] pairs. */
  path: Array<[number, number]>;
  stations: number;
}
export interface TrainRoute {
  id: number;
  name: string;
  from: string | null;
  to: string | null;
  path: Array<[number, number]>;
}
export interface Airport {
  id: number; name: string; iata: string; lon: number; lat: number;
}

/** Drop points that add nothing at map scale. */
function simplify(pts: Array<[number, number]>, tol = 0.012): Array<[number, number]> {
  if (pts.length < 3) return pts;
  const out: Array<[number, number]> = [pts[0]!];
  for (const p of pts.slice(1, -1)) {
    const q = out[out.length - 1]!;
    if (Math.abs(p[0] - q[0]) > tol || Math.abs(p[1] - q[1]) > tol) out.push(p);
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

function pathOf(el: OverpassEl): Array<[number, number]> {
  if (!el.geometry) return [];
  return simplify(el.geometry.map((g) => [Number(g.lon.toFixed(4)), Number(g.lat.toFixed(4))] as [number, number]));
}

export async function run(opts: { onProgress?: (s: string) => void } = {}): Promise<{ errors: string[] }> {
  const log = opts.onProgress ?? (() => {});
  const errors: string[] = [];
  await mkdir(OUT_DIR, { recursive: true });

  // ── metro: one relation per line, with its alignment ──────────────
  const metroEls = await ask(
    '[out:json][timeout:180];area["ISO3166-1"="IN"][admin_level=2]->.in;' +
    'relation["route"="subway"](area.in);out tags geom;',
    "metro lines", log,
  );
  const metro: MetroLine[] = [];
  for (const el of metroEls) {
    const t = el.tags ?? {};
    const name = t.name ?? t["name:en"] ?? "";
    if (!name) continue;
    const path = pathOf(el);
    if (path.length < 2) continue;
    metro.push({
      id: el.id, name,
      // OSM has no "city" tag on routes; the network name carries it
      city: t.network ?? t["network:short"] ?? null,
      operator: t.operator ?? null,
      colour: t.colour ?? t.color ?? null,
      path,
      stations: (el.members ?? []).filter((m) => m.role === "stop" || m.role.startsWith("stop")).length,
    });
  }
  if (metro.length === 0) errors.push("mobility: no metro relations returned");
  await writeFile(join(OUT_DIR, "metro.json"), JSON.stringify(metro), "utf8");
  log(`metro lines written: ${metro.length}`);

  // ── Vande Bharat: the named services ──────────────────────────────
  const vbEls = await ask(
    '[out:json][timeout:180];relation["route"="train"]["name"~"Vande Bharat",i];out tags geom;',
    "Vande Bharat", log,
  );
  const vande: TrainRoute[] = [];
  for (const el of vbEls) {
    const t = el.tags ?? {};
    const name = t.name ?? "";
    if (!name) continue;
    vande.push({ id: el.id, name, from: t.from ?? null, to: t.to ?? null, path: pathOf(el) });
  }
  if (vande.length === 0) errors.push("mobility: no Vande Bharat relations returned");
  await writeFile(join(OUT_DIR, "vande-bharat.json"), JSON.stringify(vande), "utf8");
  log(`Vande Bharat routes written: ${vande.length}`);

  // ── airports with IATA codes ──────────────────────────────────────
  const apEls = await ask(
    '[out:json][timeout:180];area["ISO3166-1"="IN"][admin_level=2]->.in;' +
    'node["aeroway"="aerodrome"]["iata"](area.in);' +
    'way["aeroway"="aerodrome"]["iata"](area.in);out tags center;',
    "airports", log,
  );
  const airports: Airport[] = [];
  for (const el of apEls) {
    const t = el.tags ?? {};
    const iata = (t.iata ?? "").trim().toUpperCase();
    const lon = el.lon ?? (el as unknown as { center?: { lon: number } }).center?.lon;
    const lat = el.lat ?? (el as unknown as { center?: { lat: number } }).center?.lat;
    if (!/^[A-Z]{3}$/.test(iata) || lon === undefined || lat === undefined) continue;
    if (airports.some((a) => a.iata === iata)) continue;
    airports.push({
      id: el.id, name: t.name ?? t["name:en"] ?? iata, iata,
      lon: Number(lon.toFixed(4)), lat: Number(lat.toFixed(4)),
    });
  }
  if (airports.length === 0) errors.push("mobility: no airports returned");
  await writeFile(join(OUT_DIR, "airports.json"), JSON.stringify(airports), "utf8");
  log(`airports written: ${airports.length}`);

  // ── live flights: a snapshot, and labelled as one ─────────────────
  // Appended to a rolling file rather than replacing it, so the density map is
  // built from many snapshots instead of one instant. A single call is one
  // moment in the sky and would misrepresent "density" on its own.
  const sky = await getJson<{ time: number; states: unknown[][] | null }>(
    "https://opensky-network.org/api/states/all?lamin=6.5&lomin=68.0&lamax=36.0&lomax=97.5",
    { timeoutMs: 60_000, retries: 2, cacheMs: 0 },
  );
  if (!sky.ok || !sky.data?.states) {
    errors.push(`mobility: OpenSky snapshot failed: ${sky.error ?? "no states"}`);
  } else {
    const pts: Array<[number, number, number]> = [];
    for (const s of sky.data.states) {
      const lon = s[5], lat = s[6], alt = s[7] ?? s[13];
      const onGround = s[8];
      if (typeof lon !== "number" || typeof lat !== "number") continue;
      pts.push([
        Number(lon.toFixed(3)), Number(lat.toFixed(3)),
        onGround === true ? 0 : Math.round(typeof alt === "number" ? alt : 0),
      ]);
    }
    let prev: { snapshots: Array<{ at: string; n: number; pts: Array<[number, number, number]> }> } = { snapshots: [] };
    try { prev = JSON.parse(await readFile(join(OUT_DIR, "flights.json"), "utf8")); } catch { /* first run */ }
    prev.snapshots = [
      ...prev.snapshots.slice(-59),
      { at: new Date(sky.data.time * 1000).toISOString(), n: pts.length, pts },
    ];
    await writeFile(join(OUT_DIR, "flights.json"), JSON.stringify(prev), "utf8");
    log(`flight snapshot: ${pts.length} aircraft (${prev.snapshots.length} snapshots held)`);
  }

  return { errors };
}
