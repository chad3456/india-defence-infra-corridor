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
  /** For a relation, the alignment lives here -- one geometry per member way. */
  members?: Array<{ type: string; ref: number; role: string; geometry?: Array<{ lat: number; lon: number }> }>;
  geometry?: Array<{ lat: number; lon: number }>;
  lat?: number; lon?: number;
  center?: { lat: number; lon: number };
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
  /**
   * Whether the line is running.
   *
   * OSM maps lines under construction as route relations too, so a total that
   * ignores this reports concrete that does not exist yet. Delhi came to 566 km
   * of mapped alignment against roughly 390 km actually operating, and most of
   * that gap is construction.
   */
  status: "operational" | "construction" | "proposed" | "unknown";
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
export interface Station {
  name: string; lon: number; lat: number;
  /** Station code where OSM carries one -- the only unambiguous key. */
  code: string | null;
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

/**
 * The alignment of a route.
 *
 * A relation has no geometry of its own -- it is a list of member ways, and
 * each of those carries the coordinates. Reading `el.geometry` on a relation
 * returns undefined, which is why the first run wrote eight Vande Bharat routes
 * with zero points each and no metro lines at all. Members with a role are
 * stops and platforms; only the unroled ways are track.
 */
function pathOf(el: OverpassEl): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  if (el.geometry) {
    for (const g of el.geometry) pts.push([Number(g.lon.toFixed(4)), Number(g.lat.toFixed(4))]);
  }
  for (const m of el.members ?? []) {
    if (m.role && m.role !== "") continue;
    for (const g of m.geometry ?? []) pts.push([Number(g.lon.toFixed(4)), Number(g.lat.toFixed(4))]);
  }
  return simplify(pts);
}

/**
 * Write a generated list, unless doing so would replace real data with none.
 *
 * On 14 September a scheduled run returned no airports — Overpass timed out,
 * or the query was throttled — and the connector wrote `[]` over a file that
 * held 148 of them and committed it. Every downstream join silently became
 * zero: the front page's airport layer went from 144 placed across 29 states
 * to nothing, and nothing anywhere reported a problem, because an empty list
 * is a perfectly valid list.
 *
 * The connector was already recording the failure — `errors.push("mobility: no
 * airports returned")` has been in this file all along. Recording it was not
 * enough, because the write happened anyway. "Record rather than throw" is the
 * right rule for a *finding*; an empty response from an upstream API is not a
 * finding about India's airports, it is a failed fetch, and the difference is
 * whether the previous file is still true.
 *
 * So: an empty result never overwrites a non-empty file. The old data stays,
 * the failure is recorded, and the run ends with an error the workflow can
 * see. A shrink that is merely large is allowed through — Overpass genuinely
 * returns fewer features some days — but it is logged, because a 90% drop is
 * usually the same problem arriving more quietly.
 */
async function writeList<T>(
  file: string, rows: T[], label: string, errors: string[], log: (s: string) => void,
): Promise<void> {
  const path = join(OUT_DIR, file);
  let previous = 0;
  try {
    const old = JSON.parse(await readFile(path, "utf8")) as unknown;
    if (Array.isArray(old)) previous = old.length;
  } catch {
    previous = 0;
  }

  if (rows.length === 0 && previous > 0) {
    errors.push(
      `mobility: ${label} came back empty while ${previous} are on disk — keeping the previous ` +
      "file rather than overwriting good data with nothing",
    );
    log(`${label}: EMPTY response, kept the existing ${previous} rows`);
    return;
  }
  if (previous > 0 && rows.length < previous * 0.5) {
    log(`${label}: ${rows.length} written, down from ${previous} — a large drop, worth a look`);
  }
  await writeFile(path, JSON.stringify(rows), "utf8");
  log(`${label} written: ${rows.length}`);
}

export async function run(opts: { onProgress?: (s: string) => void } = {}): Promise<{ errors: string[] }> {
  const log = opts.onProgress ?? (() => {});
  const errors: string[] = [];
  await mkdir(OUT_DIR, { recursive: true });

  // ── metro: one relation per line, with its alignment ──────────────
  const metroEls = await ask(
    '[out:json][timeout:180];area["ISO3166-1"="IN"][admin_level=2]->.in;' +
    'relation["route"~"^(subway|light_rail|monorail)$"](area.in);out geom;',
    "metro / light rail", log,
  );
  const metro: MetroLine[] = [];
  let dropped = 0;

  /** OSM records lifecycle in several competing ways; check all of them. */
  const statusOf = (t: Record<string, string>): MetroLine["status"] => {
    const raw = (t.state ?? t.status ?? t["route:state"] ?? "").toLowerCase();
    if (/construct/.test(raw) || t["construction:route"] || t.construction) return "construction";
    if (/propos|plan/.test(raw) || t["proposed:route"] || t.proposed) return "proposed";
    if (/(open|operational|in_use)/.test(raw)) return "operational";
    // An untagged route relation on a mapped network is, in practice, running:
    // mappers tag the exception, not the norm.
    return "unknown";
  };
  for (const el of metroEls) {
    const t = el.tags ?? {};
    const name = t.name ?? t["name:en"] ?? "";
    if (!name) continue;
    const path = pathOf(el);
    if (path.length < 2) { dropped++; continue; }
    metro.push({
      id: el.id, name,
      // OSM has no "city" tag on routes; the network name carries it
      city: t.network ?? t["network:short"] ?? null,
      operator: t.operator ?? null,
      colour: t.colour ?? t.color ?? null,
      path,
      stations: (el.members ?? []).filter((m) => /^stop/.test(m.role)).length,
      status: statusOf(t),
    });
  }
  if (metro.length === 0) errors.push("mobility: no metro relations carried a usable alignment");
  else if (dropped > 0) log(`  ${dropped} metro relation(s) had no member geometry and were skipped`);
  await writeList("metro.json", metro, "metro lines", errors, log);

  // ── Vande Bharat: the named services ──────────────────────────────
  const vbEls = await ask(
    '[out:json][timeout:180];relation["route"="train"]["name"~"Vande ?Bharat",i];out geom;',
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
  await writeList("vande-bharat.json", vande, "Vande Bharat routes", errors, log);

  // ── airports with IATA codes ──────────────────────────────────────
  /**
   * Nodes, ways *and* relations.
   *
   * Without the relation clause this query missed Indira Gandhi International
   * — India's busiest airport, mapped as a multipolygon relation — so the
   * dataset held 148 airports and not the one everybody would look for first.
   * The statewise page duly reported that the National Capital Territory has
   * no airport, which is the kind of visible wrongness that makes a reader
   * disbelieve the other thirty-four rows too.
   *
   * Nothing flagged it: 148 is a plausible number, every row in it was real,
   * and no structural check can know which airport is missing. Only naming one
   * can, which is what test:mobility now does.
   */
  const apEls = await ask(
    '[out:json][timeout:180];area["ISO3166-1"="IN"][admin_level=2]->.in;' +
    '(node["aeroway"="aerodrome"]["iata"](area.in);' +
    'way["aeroway"="aerodrome"]["iata"](area.in);' +
    'relation["aeroway"="aerodrome"]["iata"](area.in););out tags center;',
    "airports", log,
  );
  const airports: Airport[] = [];
  for (const el of apEls) {
    const t = el.tags ?? {};
    const iata = (t.iata ?? "").trim().toUpperCase();
    const lon = el.lon ?? el.center?.lon;
    const lat = el.lat ?? el.center?.lat;
    if (!/^[A-Z]{3}$/.test(iata) || lon === undefined || lat === undefined) continue;
    if (airports.some((a) => a.iata === iata)) continue;
    airports.push({
      id: el.id, name: t.name ?? t["name:en"] ?? iata, iata,
      lon: Number(lon.toFixed(4)), lat: Number(lat.toFixed(4)),
    });
  }
  if (airports.length === 0) errors.push("mobility: no airports returned");
  await writeList("airports.json", airports, "airports", errors, log);

  // ── railway stations, so a route's endpoints can be placed ────────
  //
  // Needed because most Vande Bharat services are not traced as OSM route
  // relations: without station coordinates a service list is a table with
  // nowhere to draw it. Names are stored as given plus a normalised key, since
  // "New Delhi", "New Delhi railway station" and "NDLS" all refer to one place
  // and a route table will use whichever it likes.
  // Nodes alone missed Madgaon, Mysuru Junction and Gomti Nagar -- all real,
  // all major, and all mapped as something other than a plain station node.
  // Ways and relations carry station areas, and `halt` carries the smaller
  // stops that route endpoints sometimes are. The alternative to widening this
  // was aliasing Mysuru onto "Mysore Road", which is a different city's
  // suburban stop: a wrong join dressed as a fix.
  const stEls = await ask(
    '[out:json][timeout:240];area["ISO3166-1"="IN"][admin_level=2]->.in;' +
    '(node["railway"~"^(station|halt)$"](area.in);' +
    ' way["railway"~"^(station|halt)$"](area.in);' +
    ' relation["railway"~"^(station|halt)$"](area.in););out tags center;',
    "railway stations", log,
  );
  const stations: Station[] = [];
  const seenSt = new Set<string>();
  for (const el of stEls) {
    const t = el.tags ?? {};
    const name = (t.name ?? t["name:en"] ?? "").trim();
    const lon = el.lon ?? el.center?.lon;
    const lat = el.lat ?? el.center?.lat;
    if (!name || lon === undefined || lat === undefined) continue;
    const key = name.toLowerCase();
    if (seenSt.has(key)) continue;
    seenSt.add(key);
    stations.push({
      name,
      code: (t["railway:ref"] ?? t.ref ?? "").trim().toUpperCase() || null,
      lon: Number(lon.toFixed(4)), lat: Number(lat.toFixed(4)),
    });
  }
  if (stations.length === 0) errors.push("mobility: no railway stations returned");
  await writeList("stations.json", stations, "railway stations", errors, log);

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
