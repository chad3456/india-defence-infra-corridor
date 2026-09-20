/**
 * Every military airfield OpenStreetMap carries, with a country on each one.
 *
 * `npm run airbases:build`. Writes data/defence/airbases.json. CI only.
 *
 * ── Why OSM is the spine and OurAirports is not ──────────────────────────
 *
 * The probe measured both. OurAirports publishes a public-domain CSV of 86,095
 * aerodromes, which is far more complete than OSM for civil aviation — and it
 * carries no military flag at all. The only handle on it is the name, and
 * "air base" or "air force station" appears in 1,575 of those rows: a number
 * that counts English-language naming conventions rather than military
 * airfields, and which would silently omit every base in a country that does
 * not name them in English.
 *
 * OSM carries `military=airfield` as a tag, which is a statement about what the
 * object is rather than what it is called. 166 objects inside India's bounding
 * box, 161 of them with both a name and a centre. That is a spine.
 *
 * ── The bounding box has to be checked, not trusted ──────────────────────
 *
 * The probe tried to settle whether Overpass honours a bbox by asking for a
 * second box on the other side of the planet and comparing. That request came
 * back HTTP 429 — Overpass throttling, which is normal — so the question went
 * unanswered rather than answered wrongly.
 *
 * It is settled here instead, and better: every element this connector
 * receives is checked against the box that was asked for. A response holding
 * objects outside its own query is a response that ignored the query, and the
 * run refuses rather than publishing a world map built on a filter that does
 * nothing. That is a stronger check than the paired probe would have been,
 * because it runs on every request rather than once.
 *
 * ── Countries are assigned here, not asked for ───────────────────────────
 *
 * Overpass can filter by an ISO area, which would give the country for free
 * and cost one throttled request per country — around two hundred requests
 * against a service that returns 429 when pushed. Instead the world is swept
 * in a handful of regional boxes and each airfield is placed into a country
 * locally, by testing its coordinates against the same world atlas polygons
 * the site's maps are drawn from. No extra requests, exact boundaries, and the
 * assignment is reproducible without the network.
 *
 * ── What this is, and is not ─────────────────────────────────────────────
 *
 * It is a catalogue of installations that OpenStreetMap's contributors have
 * mapped and tagged as military airfields — public, crowd-sourced, and
 * visible in any satellite imagery viewer. It is not a survey: a country whose
 * mappers are active will look denser than one whose mappers are not, and that
 * is a fact about OSM rather than about airpower. The per-country counts are
 * published with that caveat attached to them rather than beside them.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getJson } from "../lib/http";
import { isEntryPoint } from "../lib/entry";
import { countryAt, loadWorld, loadFine } from "../lib/world-shapes";

const OUT_DIR = join(process.cwd(), "data", "defence");
const OUT = join(OUT_DIR, "airbases.json");
const OVERPASS = "https://overpass-api.de/api/interpreter";

/** Overpass throttles hard; a 429 is normal and worth waiting out. */
const PACE_MS = 6_000;
let last = 0;
async function pace(ms = PACE_MS): Promise<void> {
  const w = ms - (Date.now() - last);
  if (w > 0) await new Promise((r) => setTimeout(r, w));
  last = Date.now();
}

/**
 * The world in boxes small enough that Overpass will answer.
 *
 * A single planet-wide query for this tag times out. These are cut on ocean
 * where possible so that no airfield sits on a seam, and they overlap at the
 * edges — an object returned twice is deduplicated by its OSM id, which is
 * cheap, whereas an object returned by neither box is invisible.
 */
const BOXES: Array<{ id: string; box: [number, number, number, number] }> = [
  { id: "south-asia",      box: [5.0, 60.0, 40.0, 100.0] },
  { id: "east-asia",       box: [15.0, 95.0, 55.0, 150.0] },
  { id: "southeast-asia",  box: [-12.0, 92.0, 22.0, 142.0] },
  { id: "west-asia",       box: [10.0, 25.0, 45.0, 65.0] },
  { id: "europe",          box: [34.0, -12.0, 72.0, 45.0] },
  /*
   * Russia is three boxes, not one. A single box spanning 165 degrees of
   * longitude timed out on every one of its five attempts, and the run
   * published a Russian count built entirely on the European box's overlap —
   * 172 airfields, with everything east of 45°E missing and nothing in the
   * output saying so except a failure count of one.
   */
  { id: "russia-west",     box: [45.0, 25.0, 78.0, 70.0] },
  { id: "russia-central",  box: [45.0, 70.0, 78.0, 120.0] },
  { id: "russia-east",     box: [45.0, 120.0, 78.0, 190.0] },
  { id: "africa-north",    box: [8.0, -20.0, 38.0, 55.0] },
  { id: "africa-south",    box: [-36.0, -20.0, 10.0, 52.0] },
  { id: "north-america-w", box: [14.0, -170.0, 72.0, -100.0] },
  { id: "north-america-e", box: [14.0, -100.0, 72.0, -50.0] },
  { id: "south-america",   box: [-56.0, -82.0, 14.0, -34.0] },
  { id: "oceania",         box: [-48.0, 110.0, -8.0, 180.0] },
];

interface El {
  type: string;
  id: number;
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
}
interface Res { elements?: El[] }

export interface Airbase {
  /** OSM type and id together, so the record can be checked against source. */
  osm: string;
  name: string;
  /** ISO 3166-1 alpha-3, assigned locally from the coordinates. */
  iso: string | null;
  country: string | null;
  lat: number;
  lon: number;
  /** Which branch, when OSM says. Most objects do not. */
  operator: string | null;
  /** `military=airfield`, or a civil aerodrome carrying a military tag. */
  kind: "military-airfield" | "joint-use";
  /** ICAO code when the object carries one, which makes it checkable. */
  icao: string | null;
}

/** Centre of an element, whichever way OSM expresses it. */
function centreOf(el: El): { lat: number; lon: number } | null {
  if (typeof el.lat === "number" && typeof el.lon === "number") return { lat: el.lat, lon: el.lon };
  if (el.center) return { lat: el.center.lat, lon: el.center.lon };
  return null;
}

async function ask(query: string, label: string): Promise<El[] | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    await pace();
    const res = await getJson<Res>(`${OVERPASS}?data=${encodeURIComponent(query)}`, {
      timeoutMs: 180_000, retries: 0, cacheMs: 0,
    });
    if (res.ok && res.data?.elements) return res.data.elements;
    // 429 and 504 are Overpass saying "later", not "no".
    console.log(`  ${label}: ${res.error ?? "no elements"} (attempt ${attempt + 1})`);
    await new Promise((r) => setTimeout(r, 10_000 * (attempt + 1)));
  }
  return null;
}

async function main(): Promise<void> {
  const world = await loadWorld();
  const found = new Map<string, Airbase>();
  const failures: Array<{ box: string; why: string }> = [];
  /** Elements returned outside the box that was asked for. */
  let outsideBox = 0;
  let checkedBox = 0;
  let unplaced = 0;

  for (const { id, box } of BOXES) {
    const [s, w, n, e] = box;
    const bbox = `${s},${w},${n},${e}`;
    /*
     * Two tags in one query rather than two queries, because Overpass is the
     * scarce resource here. `military=airfield` is the primary; an aerodrome
     * carrying any military tag is the joint-use case, which the first tag
     * misses on fields that are mapped as civil airports with a military
     * presence.
     */
    const query =
      `[out:json][timeout:180];(`
      + `nwr["military"="airfield"](${bbox});`
      + `nwr["aeroway"="aerodrome"]["military"](${bbox});`
      + `);out tags center;`;

    const elements = await ask(query, id);
    if (elements === null) {
      failures.push({ box: id, why: "no answer after five attempts" });
      continue;
    }

    let kept = 0;
    for (const el of elements) {
      const c = centreOf(el);
      if (!c) continue;
      checkedBox++;
      /*
       * The filter is checked rather than trusted.
       *
       * A response carrying objects outside the box it was asked for is a
       * response that ignored the box, and every per-country count downstream
       * would then be a count of something else. A small margin allows for a
       * large object whose centre sits just outside its own bounding box.
       */
      if (c.lat < s - 1 || c.lat > n + 1 || c.lon < w - 1 || c.lon > e + 1) {
        outsideBox++;
        continue;
      }
      const tags = el.tags ?? {};
      const name = (tags["name:en"] ?? tags["name"] ?? "").trim();
      if (name === "") continue;

      const key = `${el.type}/${el.id}`;
      found.set(key, {
        osm: key,
        name,
        // Countries are assigned after the sweep, in one pass, so the finer
        // atlas is loaded at most once and only if something needs it.
        iso: null,
        country: null,
        lat: Number(c.lat.toFixed(4)),
        lon: Number(c.lon.toFixed(4)),
        operator: tags["operator"] ?? tags["operator:type"] ?? null,
        kind: tags["military"] === "airfield" ? "military-airfield" : "joint-use",
        icao: tags["icao"] ?? tags["ref:icao"] ?? null,
      });
      kept++;
    }
    console.log(`  ${id}: ${elements.length} elements, ${kept} named airfields`);
  }

  /**
   * A response that ignored its own bounding box invalidates every count.
   *
   * Not a warning. If more than a handful of objects came back outside the box
   * that was asked for, the filter is not doing what this connector assumes,
   * and the per-country map built on it would be confidently wrong. The probe
   * could not settle this — its paired request was throttled — so it is
   * settled here, on every request, and it is fatal.
   */
  if (checkedBox > 0 && outsideBox / checkedBox > 0.02) {
    throw new Error(
      `${outsideBox} of ${checkedBox} elements came back outside the box they were asked for. `
      + "Overpass is not honouring the bounding box; refusing to publish country counts built on it.",
    );
  }

  /**
   * Place every airfield, and re-ask the finer atlas about the ones that miss.
   *
   * The coarse atlas handles the great majority and is a tenth of the size.
   * Its failures are all coastal or island fields, where a kilometre of
   * imprecision in the coastline puts a real airfield in the sea — 131 of
   * 1,990 on the first sweep, which is eight per cent of the catalogue absent
   * from every per-country count with nothing in the output naming which.
   */
  for (const b of found.values()) {
    const place = countryAt(world, b.lon, b.lat);
    if (place) { b.iso = place.iso; b.country = place.name; }
  }
  const misses = [...found.values()].filter((b) => b.iso === null);
  if (misses.length > 0) {
    console.log(`  ${misses.length} airfields unplaced at 110m; re-asking the 50m atlas.`);
    await loadFine(world);
    for (const b of misses) {
      const place = countryAt(world, b.lon, b.lat);
      if (place) { b.iso = place.iso; b.country = place.name; }
    }
  }
  unplaced = [...found.values()].filter((b) => b.iso === null).length;

  const bases = [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
  if (bases.length === 0) {
    throw new Error("no airfields found — refusing to publish an empty catalogue over a good one");
  }

  const byCountry = new Map<string, { iso: string; country: string; n: number; jointUse: number }>();
  for (const b of bases) {
    if (!b.iso) continue;
    const row = byCountry.get(b.iso) ?? { iso: b.iso, country: b.country ?? b.iso, n: 0, jointUse: 0 };
    row.n++;
    if (b.kind === "joint-use") row.jointUse++;
    byCountry.set(b.iso, row);
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT, JSON.stringify({
    builtAt: new Date().toISOString(),
    source:
      "OpenStreetMap, via the Overpass API. Objects tagged military=airfield, plus civil "
      + "aerodromes carrying a military tag, which is how joint-use fields are usually mapped.",
    method:
      "The world is swept in twelve overlapping regional boxes, because a single planet-wide "
      + "query for this tag times out. Objects returned twice are deduplicated by OSM id. Every "
      + "element is checked against the box it was asked for, and a run in which more than two "
      + "per cent fall outside it fails rather than publishing counts built on a filter that did "
      + "nothing. Countries are assigned locally by testing each coordinate against the same "
      + "world atlas polygons the site's maps are drawn from, rather than by asking Overpass once "
      + "per country.",
    refusal:
      "An object with no name is not published, because a record that cannot be checked against "
      + "the source is not a record. Nothing here is a coordinate this project derived, inferred "
      + "or refined: every position is the centre OpenStreetMap already publishes.",
    cannotSay: [
      "How many military airfields a country has. This counts what OpenStreetMap's contributors have mapped and tagged, so a country with active mappers looks denser than one without, and that is a fact about OSM rather than about airpower. Treat every count as a floor.",
      "Whether an airfield is in use. OSM carries no reliable status for these, and a field mapped in 2014 may be closed, expanded or repurposed.",
      "What is based at one. Nothing here reads aircraft to installations; the inventory data on this site is national and does not resolve to a base.",
      "Anything about facilities that are not mapped. Absence here is absence from a public map, which is not absence from the ground.",
      "Anything about a region whose sweep failed. Overpass returns 429 and 504 under load, and a box that never answered leaves a hole in the catalogue with no other trace: the countries inside it are undercounted by an unknown amount rather than missing. Any failed box is named in `failures`, and a count for a country inside one is not a count.",
    ],
    counts: {
      airfields: bases.length,
      jointUse: bases.filter((b) => b.kind === "joint-use").length,
      countries: byCountry.size,
      withIcao: bases.filter((b) => b.icao !== null).length,
      unplaced,
      outsideBox,
      boxesFailed: failures.length,
    },
    failures,
    byCountry: [...byCountry.values()].sort((a, b) => b.n - a.n),
    bases,
  }, null, 2) + "\n", "utf8");

  console.log(
    `\nWrote ${OUT}: ${bases.length} airfields across ${byCountry.size} countries `
    + `(${unplaced} outside any country polygon, ${failures.length} boxes failed).`,
  );
}

if (isEntryPoint(import.meta.url)) {
  void main();
}
