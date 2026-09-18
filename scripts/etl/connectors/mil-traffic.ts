/**
 * Military aircraft broadcasting ADS-B, snapshot by snapshot.
 *
 * `npm run traffic:ingest`. Appends to data/defence/mil-traffic.json. Runs on
 * a schedule, because one call is a single instant and an instant is not a
 * pattern.
 *
 * ── The number that has to be on the page ────────────────────────────────
 *
 * The probe asked two independent aggregators how many military aircraft they
 * could see worldwide at one moment. adsb.lol said 374. adsb.fi said 404.
 *
 * Set that beside the catalogues: the United States alone is listed at several
 * thousand airframes, and the fourteen forces this site reads run to tens of
 * thousands between them. So a global military ADS-B feed sees something on
 * the order of one per cent of what exists, at any instant.
 *
 * That ratio is the most important thing this connector produces, and the page
 * built on it leads with it. Everything else here is a description of a
 * visible minority.
 *
 * ── Why the minority is not a random sample ──────────────────────────────
 *
 * Military aircraft are not obliged to broadcast ADS-B and routinely do not.
 * What appears in a public feed is systematically the traffic with the least
 * reason to hide: transports and tankers flying airways under civil rules,
 * trainers in domestic circuits, maritime patrol, VIP and government lift, and
 * anything crossing controlled airspace where a transponder is the price of
 * entry. Combat aircraft on operational sorties are systematically absent.
 *
 * So the composition of this feed is a fact about disclosure practice, not
 * about fleets. A country that appears often is a country whose transport arm
 * flies internationally with its transponder on; a country that never appears
 * may be flying just as much. Absence from this feed is not absence from the
 * sky, and any reading of it that treats the two as the same is wrong in a way
 * that looks quantitative.
 *
 * ── Two feeds, because one is a claim ────────────────────────────────────
 *
 * Both aggregators decide for themselves which hex codes are military, from
 * community-maintained lists of ICAO address ranges and registration blocks.
 * Those lists disagree. Reading both and recording the overlap turns "this is
 * military" from one service's say-so into something with a measured level of
 * agreement, and the disagreement is published rather than averaged away.
 *
 * ── What is kept, and what is not ────────────────────────────────────────
 *
 * Kept: how many aircraft each feed saw, how many both saw, the distribution
 * by type and by broad region, and positions rounded to a tenth of a degree
 * for the map. That is roughly eleven kilometres, which is the right
 * resolution for "there is military air activity over this part of the world"
 * and the wrong one for anything more specific.
 *
 * Not kept: registrations, and no aircraft is counted against a named
 * installation. Not because the raw feed hides either — it does not, and
 * ADS-B Exchange publishes both to anyone who asks — but because at four
 * hundred aircraft worldwide, a count near any one airfield is a number small
 * enough to be noise and precise enough to be believed. A statistic that
 * cannot support the reading it invites should not be printed.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getJson } from "../lib/http";
import { isEntryPoint } from "../lib/entry";

const OUT_DIR = join(process.cwd(), "data", "defence");
const OUT = join(OUT_DIR, "mil-traffic.json");

/** How many snapshots to keep. At one an hour this is a fortnight. */
const KEEP = 336;

interface Ac {
  hex?: string;
  flight?: string;
  t?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | string;
}
interface Feed { ac?: Ac[]; total?: number }

const FEEDS = [
  { id: "adsb.lol", url: "https://api.adsb.lol/v2/mil" },
  { id: "adsb.fi", url: "https://opendata.adsb.fi/api/v2/mil" },
];

/**
 * A coarse region for a coordinate, for a composition chart.
 *
 * Deliberately coarse — continents, not countries. A country assignment would
 * invite "how many military aircraft are over X", which at this sample size is
 * a question the data cannot answer. Naming a quarter of the planet makes the
 * grain of the claim visible in the claim itself.
 */
export function regionOf(lat: number, lon: number): string {
  if (lat > 34 && lon > -12 && lon < 45) return "Europe";
  if (lat > 40 && lon >= 45 && lon < 190) return "Northern Eurasia";
  if (lat > 12 && lon >= 25 && lon < 62) return "West Asia and the Gulf";
  if (lat > 5 && lon >= 62 && lon < 95) return "South Asia";
  if (lon >= 95 && lon < 150 && lat > 0) return "East Asia";
  if (lon >= 92 && lon < 142 && lat <= 0) return "Southeast Asia and Australasia";
  if (lat > 14 && lon >= -170 && lon < -50) return "North America";
  if (lat <= 14 && lon >= -82 && lon < -34) return "South America";
  if (lon >= -20 && lon < 55) return "Africa";
  if (lon >= 110 || lon < -170) return "Pacific";
  return "Elsewhere";
}

export interface Snapshot {
  at: string;
  /** What each feed saw, separately, so neither is taken on its own say-so. */
  perFeed: Array<{ id: string; ok: boolean; aircraft: number; withPosition: number; error?: string }>;
  /** Hex codes both feeds called military, and codes only one of them did. */
  agreement: { both: number; onlyFirst: number; onlySecond: number } | null;
  /** The union, deduplicated by hex. */
  aircraft: number;
  byRegion: Array<{ region: string; n: number }>;
  byType: Array<{ type: string; n: number }>;
  /** [lon, lat] rounded to a tenth of a degree — about eleven kilometres. */
  points: Array<[number, number]>;
}

async function readFeed(url: string): Promise<{ ok: boolean; ac: Ac[]; error?: string }> {
  const res = await getJson<Feed>(url, { timeoutMs: 30_000, retries: 1, cacheMs: 0 });
  if (!res.ok || !res.data) return { ok: false, ac: [], error: res.error ?? "no body" };
  return { ok: true, ac: res.data.ac ?? [] };
}

async function main(): Promise<void> {
  const perFeed: Snapshot["perFeed"] = [];
  const sets: Array<Set<string>> = [];
  /** hex -> the first record seen for it, across both feeds. */
  const union = new Map<string, Ac>();

  for (const f of FEEDS) {
    const r = await readFeed(f.url);
    const hexes = new Set<string>();
    let withPosition = 0;
    for (const a of r.ac) {
      const hex = (a.hex ?? "").trim().toLowerCase();
      if (hex === "") continue;
      hexes.add(hex);
      if (typeof a.lat === "number" && typeof a.lon === "number") withPosition++;
      if (!union.has(hex)) union.set(hex, a);
    }
    sets.push(hexes);
    perFeed.push({
      id: f.id, ok: r.ok, aircraft: hexes.size, withPosition,
      ...(r.error ? { error: r.error } : {}),
    });
    console.log(`  ${f.id}: ${r.ok ? `${hexes.size} aircraft, ${withPosition} with a position` : r.error}`);
  }

  if (perFeed.every((f) => !f.ok)) {
    throw new Error("no feed answered — refusing to append an empty snapshot");
  }

  /**
   * How far the two feeds agree about what "military" means.
   *
   * Both maintain their own list of ICAO address ranges and registration
   * blocks, and those lists differ. Publishing the overlap turns a
   * classification that is one service's editorial judgement into one with a
   * measured level of corroboration — and the gap is the interesting part, so
   * it is recorded rather than smoothed over by taking the union and moving on.
   */
  const [a, b] = sets;
  const agreement = a && b && perFeed[0]?.ok && perFeed[1]?.ok
    ? {
      both: [...a].filter((h) => b.has(h)).length,
      onlyFirst: [...a].filter((h) => !b.has(h)).length,
      onlySecond: [...b].filter((h) => !a.has(h)).length,
    }
    : null;

  const regions = new Map<string, number>();
  const types = new Map<string, number>();
  const points: Array<[number, number]> = [];
  for (const ac of union.values()) {
    const t = (ac.t ?? "").trim();
    if (t !== "") types.set(t, (types.get(t) ?? 0) + 1);
    if (typeof ac.lat !== "number" || typeof ac.lon !== "number") continue;
    const region = regionOf(ac.lat, ac.lon);
    regions.set(region, (regions.get(region) ?? 0) + 1);
    points.push([Number(ac.lon.toFixed(1)), Number(ac.lat.toFixed(1))]);
  }

  const snapshot: Snapshot = {
    at: new Date().toISOString(),
    perFeed,
    agreement,
    aircraft: union.size,
    byRegion: [...regions].map(([region, n]) => ({ region, n })).sort((x, y) => y.n - x.n),
    byType: [...types].map(([type, n]) => ({ type, n })).sort((x, y) => y.n - x.n),
    points,
  };

  await mkdir(OUT_DIR, { recursive: true });
  let snapshots: Snapshot[] = [];
  try {
    const prev = JSON.parse(await readFile(OUT, "utf8")) as { snapshots?: Snapshot[] };
    snapshots = prev.snapshots ?? [];
  } catch {
    // First run, or a file this shape does not recognise. Either way, start.
  }
  snapshots.push(snapshot);
  snapshots = snapshots.slice(-KEEP);

  await writeFile(OUT, JSON.stringify({
    builtAt: new Date().toISOString(),
    source:
      "adsb.lol and adsb.fi, two independent community ADS-B aggregators, each reading its /v2/mil "
      + "endpoint. Both decide for themselves which ICAO addresses are military, from "
      + "community-maintained lists that do not agree with each other.",
    method:
      "Both feeds are read at each snapshot and combined by ICAO hex. How far they agree is "
      + "recorded rather than averaged away. Positions are rounded to a tenth of a degree — about "
      + "eleven kilometres — which is the resolution the claim 'there is military air activity "
      + "over this region' can carry. Registrations are not kept, and no aircraft is counted "
      + "against a named installation.",
    refusal:
      "Absence from these feeds is not absence from the sky, and nothing here may be read as a "
      + "count of what is flying. Military aircraft are not obliged to broadcast ADS-B and "
      + "routinely do not.",
    cannotSay: [
      "How many military aircraft are airborne. Two aggregators see roughly 400 worldwide at once, against catalogued fleets in the tens of thousands — on the order of one per cent. The rest are not broadcasting.",
      "Whether a country is flying more or less than usual. What appears here is the traffic with the least reason to hide: transports and tankers on airways, trainers in circuits, maritime patrol, and government lift. Combat aircraft on operational sorties are systematically absent, so the composition is a fact about disclosure practice rather than about activity.",
      "Anything about a specific airfield. At this sample size a count near any one place is small enough to be noise and precise enough to be believed, which is the worst combination a statistic can have.",
      "What an aircraft is. The type code comes from the feed and is only as good as the community database behind it; a blank or wrong type is common and is left blank rather than guessed.",
    ],
    keptSnapshots: snapshots.length,
    keepLimit: KEEP,
    snapshots,
  }, null, 2) + "\n", "utf8");

  console.log(
    `\nWrote ${OUT}: ${union.size} aircraft this snapshot, ${snapshots.length} kept`
    + (agreement ? `, ${agreement.both} seen by both feeds` : ""),
  );
}

if (isEntryPoint(import.meta.url)) {
  void main();
}
