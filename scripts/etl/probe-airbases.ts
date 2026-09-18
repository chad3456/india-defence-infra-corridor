/**
 * Can military airbases, air-force inventories and live military air traffic
 * be assembled from open sources that publish their own data?
 *
 *   npm run airbases:probe
 *
 * ── The three questions, and why the third is the hard one ───────────────
 *
 * WHERE THE BASES ARE is a solved problem in principle: OpenStreetMap carries
 * `military=airfield` on tens of thousands of objects, OurAirports publishes a
 * public-domain CSV of every aerodrome it knows, and Wikipedia keeps per-force
 * station lists. The probe asks which of them actually answer a script, how
 * many objects each holds, and whether the geometry comes with the tags.
 *
 * WHAT IS IN THE INVENTORY is a catalogue question. Wikipedia's per-country
 * "active military aircraft" lists are tables with a type, a role, an origin
 * and a number in service, and this repo already has the wikitext machinery to
 * read tables header-first. The probe asks whether those tables exist in the
 * shape the parser needs.
 *
 * WHAT IS FLYING RIGHT NOW is where the honest answer is mostly "you cannot
 * know". Military aircraft are not obliged to broadcast ADS-B and routinely do
 * not; the ones that appear in a public feed are a self-selected minority —
 * transports, tankers, trainers, maritime patrol, and anything transiting
 * civil airspace under civil rules. A tracker built on this shows what is
 * visible, which is not what is flying, and the difference is most of the
 * subject.
 *
 * That is a reason to label the page carefully, not a reason to skip it: the
 * visible fraction is genuinely informative — it is how the public learned the
 * shape of the Kabul airlift, of Ukraine resupply, and of tanker activity
 * before strikes — and it is the same material ADS-B Exchange, adsb.lol and
 * every OSINT researcher already publish. The probe asks which feeds answer
 * without a key, whether their geographic and military filters do anything,
 * and how many aircraft they actually see.
 *
 * ── What this probe deliberately does not do ─────────────────────────────
 *
 * It publishes no coordinate, no callsign, no registration and no count of
 * aircraft at any named place. It records only whether a source answered, in
 * what shape, roughly how many rows it appears to carry, and whether its query
 * parameters do anything. The same rule every probe in this repo follows, and
 * the reason it matters more here is that the raw material is more sensitive
 * than a trade statistic.
 */
import { join } from "node:path";
import { runProbe, type Target } from "./lib/probe-run";
import { isEntryPoint } from "./lib/entry";

const OUT = join(process.cwd(), "data", "live", "airbases-probe.json");
const WIKI = "https://en.wikipedia.org/w/api.php";
const OVERPASS = "https://overpass-api.de/api/interpreter";

const wikiPage = (page: string, settles: string, look: string[] = []): Target => ({
  id: `wiki:${page}`,
  kind: "inventory",
  what: page.replace(/_/g, " "),
  url: `${WIKI}?action=parse&format=json&prop=wikitext&page=${encodeURIComponent(page)}&redirects=1`,
  // MediaWiki serves wikitext as a JSON string value, so a real newline in it
  // is the two characters backslash and n. A pattern anchored with ^ in
  // multiline mode can never match the raw body — this decodes first.
  decode: "parse.wikitext.*",
  look,
  count: { tableRows: /^\|-/gm, tables: /\{\|\s*class=/g, refs: /<ref[\s>]/g },
  settles,
});

/** Overpass takes the query in the URL; `out count` returns totals, not objects. */
const overpass = (
  id: string, what: string, query: string, settles: string, paired?: string,
): Target => ({
  id,
  kind: "airbase-geometry",
  what,
  url: `${OVERPASS}?data=${encodeURIComponent(query)}`,
  ...(paired ? { paired: `${OVERPASS}?data=${encodeURIComponent(paired)}` } : {}),
  look: ["elements"],
  count: { elements: /"type"\s*:/g, tags: /"tags"\s*:/g, lat: /"lat"\s*:/g },
  settles,
});

const TARGETS: Target[] = [
  /* ── Where the bases are ───────────────────────────────────────────── */
  {
    id: "ourairports:csv",
    kind: "airbase-catalogue",
    what: "OurAirports — a public-domain CSV of every aerodrome it knows",
    url: "https://davidmegginson.github.io/ourairports-data/airports.csv",
    look: ["ident", "type", "latitude_deg", "iso_country", "name"],
    count: {
      rows: /\n/g,
      // Military fields are not flagged by a column, so the only handle is the
      // name. Counting the handle tells us whether that approach is viable at
      // all before a connector is built on it.
      airBaseNamed: /air (base|force base|station)/gi,
      closed: /"closed"/g,
    },
    settles: "Whether a single public-domain file carries the world's aerodromes, and whether military ones are identifiable in it",
  },
  overpass(
    "overpass:mil-airfield-count",
    "OpenStreetMap — how many military airfields exist worldwide",
    '[out:json][timeout:60];nwr["military"="airfield"];out count;',
    "Whether OSM's military airfield tag is populated enough to be a spine",
  ),
  overpass(
    "overpass:mil-airfield-india",
    "The same tag inside India's bounding box, with tags and centres",
    '[out:json][timeout:90];nwr["military"="airfield"](6.5,68.0,36.0,97.5);out tags center;',
    "Whether the objects carry names and coordinates, or only geometry",
    // The paired request asks a box on the other side of the planet. Identical
    // answers would mean the bbox is decorative — the trap PIB's archive set.
    '[out:json][timeout:90];nwr["military"="airfield"](-44.0,112.0,-10.0,154.0);out tags center;',
  ),
  overpass(
    "overpass:aerodrome-military",
    "Civil-tagged aerodromes that also carry a military tag",
    '[out:json][timeout:90];nwr["aeroway"="aerodrome"]["military"](6.5,68.0,36.0,97.5);out tags center;',
    "Whether joint-use fields are reachable by a second tag rather than missed",
  ),
  wikiPage(
    "List_of_Indian_Air_Force_stations",
    "Whether a force's own station list is a table this repo can read",
    ["command", "state", "squadron", "air force station"],
  ),
  wikiPage(
    "List_of_United_States_Air_Force_installations",
    "Whether the same shape holds for a second, much larger air force",
    ["base", "state", "command"],
  ),

  /* ── What is in the inventory ──────────────────────────────────────── */
  wikiPage(
    "List_of_active_Indian_military_aircraft",
    "Whether aircraft inventories are tables with a type, a role and a number in service",
    ["origin", "role", "in service", "variant"],
  ),
  wikiPage(
    "List_of_active_People's_Liberation_Army_Air_Force_aircraft",
    "Whether the inventory shape generalises past India",
    ["origin", "role", "in service"],
  ),
  wikiPage(
    "List_of_active_Russian_military_aircraft",
    "A third force, to see whether the columns are a convention or a coincidence",
    ["origin", "role", "in service"],
  ),
  wikiPage(
    "List_of_active_Pakistan_Air_Force_aircraft",
    "A fourth, and the one most often set beside India's",
    ["origin", "role", "in service"],
  ),

  /* ── What is flying right now ──────────────────────────────────────── */
  {
    id: "adsblol:mil",
    kind: "live-traffic",
    what: "adsb.lol — aircraft its community feeders have tagged as military",
    url: "https://api.adsb.lol/v2/mil",
    look: ["ac", "hex", "flight"],
    count: {
      aircraft: /"hex"\s*:/g,
      withCallsign: /"flight"\s*:/g,
      withPosition: /"lat"\s*:/g,
      typed: /"t"\s*:/g,
    },
    settles: "Whether a free, keyless feed of military ADS-B exists at all, and how many aircraft it sees worldwide at one instant",
  },
  {
    id: "adsblol:point",
    kind: "live-traffic",
    what: "The same service asked for a radius around Delhi",
    url: "https://api.adsb.lol/v2/point/28.6/77.2/250",
    // Asked again for a radius around Sydney. If the two come back the same,
    // the coordinates are decorative and the feed cannot be walked by region.
    paired: "https://api.adsb.lol/v2/point/-33.9/151.2/250",
    look: ["ac"],
    count: { aircraft: /"hex"\s*:/g, withPosition: /"lat"\s*:/g },
    settles: "Whether the feed can be queried by region, which decides whether a per-airbase view is possible",
  },
  {
    id: "adsbfi:mil",
    kind: "live-traffic",
    what: "adsb.fi — a second independent aggregator's military feed",
    url: "https://opendata.adsb.fi/api/v2/mil",
    look: ["ac", "hex"],
    count: { aircraft: /"hex"\s*:/g, withCallsign: /"flight"\s*:/g },
    settles: "Whether a second feed corroborates the first, so neither is taken on its own say-so",
  },
  {
    id: "opensky:states",
    kind: "live-traffic",
    what: "OpenSky states over India, for the identifiers this repo does not currently keep",
    url: "https://opensky-network.org/api/states/all?lamin=6.5&lomin=68.0&lamax=36.0&lomax=97.5",
    look: ["states", "time"],
    count: { rows: /\],\s*\[/g },
    settles: "Whether the existing flight feed carries an ICAO address and callsign, which is what would let military traffic be separated from civil",
  },
];

async function main(): Promise<void> {
  await runProbe(TARGETS, OUT, {
    question:
      "Can military airbases, air-force inventories and live military air traffic be assembled "
      + "from open sources that publish their own data, without a key and without a scraper per site?",
    refusal:
      "No coordinate, no callsign, no registration and no count of aircraft at any named place is "
      + "published here. Only whether a source answered, in what shape, roughly how many rows it "
      + "appears to carry, and whether its query parameters do anything.",
    note:
      "The live-traffic answer is expected to be partial and the page built on it has to say so. "
      + "Military aircraft are not obliged to broadcast ADS-B and routinely do not, so a public "
      + "feed shows a self-selected minority — transports, tankers, trainers, maritime patrol, and "
      + "anything transiting civil airspace under civil rules. Absence from these feeds is not "
      + "absence from the sky, and a tracker that lets a reader infer otherwise is worse than no "
      + "tracker. What the visible fraction does support is a record of publicly observable "
      + "movement, which is the same material ADS-B Exchange and adsb.lol already publish.",
  });
}

if (isEntryPoint(import.meta.url)) {
  void main();
}
