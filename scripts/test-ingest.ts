/**
 * Ingest tests: feed parsing, article extraction, classification, geo-location.
 *
 * These cover the parts that decide whether a pin appears and where. Two of
 * them exist because of real production failures: CDATA-wrapped titles emptied
 * every item on the first live run, and headline-only classification missed
 * stories whose sector and state appear only in the body.
 */
import { readFileSync } from "node:fs";
import { parseFeed, stripTags, decodeEntities, stripOutletSuffix } from "./etl/lib/feed";
import { extractText } from "./etl/lib/extract";
import { categorise, locate, reportsAction } from "./etl/lib/classify";
import {
  ALL_SOURCES,
  DECLARED_SOURCES,
  DISCOVERY_SOURCES,
  SECTOR_KEYWORDS,
  X_HANDLES,
} from "../lib/sources";
import { publisherOf, namesAPublisher } from "./etl/lib/publisher";
import { mergeEvents } from "./etl/lib/merge";
import { dedupeEvents, similarity, titleTokens } from "./etl/lib/dedupe";
import type { DevEvent } from "../lib/types";

const failures: string[] = [];
function check(ok: boolean | undefined, label: string) {
  const pass = ok === true;
  console.log(`  ${pass ? "pass" : "FAIL"}  ${label}`);
  if (!pass) failures.push(label);
}

console.log("Feed parsing");
const rss = parseFeed(readFileSync("scripts/__fixtures__/rss.xml", "utf8"));
check(rss.length === 3, `parses every item (got ${rss.length}, want 3)`);
check(
  rss[0]?.title === "India’s defence exports cross record mark, DRDO tests new missile",
  "decodes numeric entities (&#8217; is a curly apostrophe)",
);
check(rss[0]?.url === "https://theprint.in/defence/exports-record/123456/", "takes the item link, not the channel link");
check(rss[1]?.title === "New expressway and metro corridor approved for Kanpur", "unwraps CDATA titles");
check(rss[0]?.publishedAt.startsWith("2026-08-18"), "parses pubDate");

const atom = parseFeed(readFileSync("scripts/__fixtures__/atom.xml", "utf8"));
check(atom.length === 2, `parses Atom entries (got ${atom.length}, want 2)`);
check(
  atom[0]?.url === "https://restofworld.org/2026/india-semiconductor/",
  "reads Atom self-closing <link href>",
);

console.log("");
console.log("Entity and tag handling");
check(stripTags("<p>Hello <b>world</b></p>") === "Hello world", "strips tags");
check(decodeEntities("&amp;lt;script&amp;gt;") === "&lt;script&gt;", "does not double-decode &amp;");
check(stripTags("<![CDATA[Kanpur plant]]>") === "Kanpur plant", "CDATA survives tag stripping");

console.log("");
console.log("Article extraction");
const html = `<html><head><style>.x{}</style><script>var a=1;</script></head>
<body><nav>Home About</nav>
<article>
<p>Short.</p>
<p>The Union Cabinet on Monday approved a new semiconductor fabrication unit to be built near Sanand in Gujarat at a cost of twelve thousand crore rupees.</p>
<p>The plant is expected to begin commercial production within three years, officials said at the briefing.</p>
</article>
<footer>Copyright</footer></body></html>`;
const text = extractText(html);
check(!text.includes("var a=1"), "drops script contents");
check(!text.includes("Home About"), "drops nav chrome");
check(!text.includes("Short."), "drops sub-40-character boilerplate paragraphs");
check(text.includes("semiconductor fabrication unit"), "keeps the body prose");

console.log("");
console.log("Classification");
check(categorise("ISRO launches PSLV with new satellite") === "space", "space");
check(categorise("DRDO conducts missile test off Odisha coast") === "defence", "defence");
check(categorise("India and EU sign free trade agreement") === "trade-deals", "trade deals");
check(categorise("New expressway opened in Uttar Pradesh") === "roads-airports", "roads & airports");
check(categorise("Adani commissions 500 MW solar park") === "energy", "energy");
check(categorise("Fintech startup raises $40 million in Series C funding") === "startups", "startups");
check(categorise("Semiconductor plant approved at Sanand") === "manufacturing", "manufacturing");
check(categorise("Actor wins award at film festival") === null, "unrelated story is not categorised");
check(
  categorise("New airport expressway approved") === "roads-airports",
  "ordered rules: airport expressway is roads-airports, not infrastructure",
);

// Regressions from the first live run.
check(
  categorise(
    "PM CARES swells to Rs 8,452 crore, 93% of funds in FDs",
    "The fund disbursed money for oxygen plants. DRDO was among the agencies involved in one project.",
  ) === null,
  "a single incidental body mention does not set a category (PM CARES was filed under defence)",
);
check(
  categorise(
    "Cabinet clears new proposals",
    "The missile test was conducted successfully. A second missile test follows next month.",
  ) === "defence",
  "two body mentions do set a category",
);

console.log("");
console.log("Action gate — a development is something that was done");
check(reportsAction("Vizhinjam Port Begins Export-Import Ops"), "accepts: begins operations");
check(reportsAction("Railway Board approves merger"), "accepts: approves");
check(reportsAction("TechnoSport to invest Rs 130 crore to expand Erode facility"), "accepts: invest/expand");
check(reportsAction("PM lays foundation stone for semiconductor plant"), "accepts: foundation stone");
check(reportsAction("India test-fires Agni-III missile"), "accepts: test-fires");
check(
  !reportsAction("‘Hindu marriage a contractual agreement’: Andhra HC"),
  "rejects: a court ruling (was pinned as defence)",
);
check(
  !reportsAction("Linking India’s rivers Part II: Why Bundelkhand needs the project"),
  "rejects: an opinion column (was pinned as infrastructure)",
);
check(
  !reportsAction("PM Modi urges youth to dream big"),
  "rejects: a speech (was pinned as startups)",
);
check(
  !reportsAction("States turn to solar subsidies to offset losses"),
  "rejects: an analysis piece (was pinned as energy)",
);
check(
  !reportsAction("Fire breaks out in old ATC building of Kolkata Airport, no injuries"),
  "rejects: an incident — the noun 'building' had cleared the gate",
);
check(
  !reportsAction("Two killed as under-construction bridge collapses"),
  "rejects: an incident even when it names construction",
);
check(reportsAction("Nitin Gadkari to build 500 km of new highway in Bihar"), "still accepts: build as a verb");
check(
  !reportsAction("SC dismisses Karnataka discoms' plea over Adani Power tariff"),
  "rejects: a court ruling on a power dispute (was pinned as energy)",
);
check(
  !reportsAction("NCLT approves resolution plan for steel maker"),
  "rejects: a tribunal order even though it says approves",
);
check(
  categorise("The Mines and Minerals Amendment Bill clears Parliament, defence use cited") !== "defence",
  "a passing mention of defence does not outrank the actual sector",
);
check(
  categorise("Defence ministry signs Rs 2,000 crore order for artillery") === "defence",
  "defence in context still classifies as defence",
);
check(
  categorise(
    "VFS Global launches first Model SRO in Pune",
    "The centre will streamline visa services. " + "x".repeat(700) + " The army was mentioned. The army again.",
  ) === null,
  "a category mentioned only past the lede is rejected (VFS Global was pinned as defence)",
);

console.log("");
console.log("Geo-location");
check(locate("Semiconductor plant approved at Sanand", "")?.state === "Gujarat", "city in the headline");
check(
  locate("Cabinet clears three new projects", "The units will come up near Coimbatore next year.")?.name ===
    "Coimbatore",
  "falls back to the body when the headline names no place",
);
check(
  locate("Metro line opens in Bengaluru", "Analysts in Mumbai said the route would help.")?.name === "Bengaluru",
  "headline wins over an incidental mention in the body",
);
check(locate("Exports rose sharply last quarter", "") === null, "returns null rather than guessing");
check(
  locate(
    "PM CARES swells to Rs 8,452 crore",
    "The fund was set up in 2020 to handle emergencies. " + "x".repeat(700) + " A hospital in Chennai received support.",
  ) === null,
  "a place named past the lede is ignored (PM CARES was pinned to Tamil Nadu)",
);
check(
  locate("New plant in Greater Noida announced", "")?.name === "Greater Noida",
  "longest name wins: Greater Noida is not collapsed into Noida",
);
check(locate("Metro line opens in Bangalore", "")?.name === "Bengaluru", "resolves an alias to its canonical name");
check(locate("New unit coming up in Gujarat", "")?.state === "Gujarat", "falls back to a state when no city is named");

console.log("");
console.log("Duplicate collapsing");
check(
  similarity(
    titleTokens("Vizhinjam Port Begins Export-Import Ops, Opens New Gateway"),
    titleTokens("Vizhinjam Port begins EXIM operations, opens gateway for India"),
  ) >= 0.5,
  "two rewrites of one headline read as the same story",
);
check(
  similarity(titleTokens("Delhi airport expands capacity"), titleTokens("Chennai metro line opens")) < 0.5,
  "unrelated headlines do not",
);

const mk = (id: string, title: string, status: DevEvent["status"], outlet: string): DevEvent => ({
  id, title, category: "ports", date: "2026-08-18", placeId: "vizhinjam",
  placeName: "Vizhinjam", state: "Kerala", coords: [76.98, 8.38], outlet,
  url: `https://example.com/${id}`, status,
});
const collapsed = dedupeEvents([
  mk("a", "Vizhinjam Port Begins Export-Import Ops, Opens New Gateway", "reported", "NDTV"),
  mk("b", "Vizhinjam Port begins EXIM operations, opens gateway for India", "verified", "PIB"),
  mk("c", "Vizhinjam Port Begins Full-Fledged Export-Import Operations", "reported", "ET"),
  mk("d", "Saatvik Solar signs pact for 3.6 GW cell plant", "reported", "ET"),
]);
check(collapsed.length === 2, `three reports of one event collapse to one (got ${collapsed.length} of 2 expected)`);
check(
  collapsed.some((e) => e.outlet === "PIB"),
  "the official report is the one kept",
);
check(collapsed.some((e) => e.title.includes("Saatvik")), "a genuinely different event survives");

console.log("");
console.log("Source registry");
check(ALL_SOURCES.length >= 20, `at least 20 feeds configured (got ${ALL_SOURCES.length})`);
check(
  ALL_SOURCES.every((s) => /^https?:\/\//.test(s.feed)),
  "every feed URL is absolute",
);
check(
  new Set(DECLARED_SOURCES.map((s) => s.id)).size === DECLARED_SOURCES.length,
  "source ids are unique",
);
check(
  ALL_SOURCES.some((s) => s.kind === "official") && ALL_SOURCES.some((s) => s.kind === "press"),
  "both official and press sources are configured",
);
check(
  DECLARED_SOURCES.filter((s) => s.disabled).every((s) => Boolean(s.note)),
  "a disabled feed records why it was disabled",
);
check(
  ALL_SOURCES.every((s) => s.domains.length > 0),
  "every feed declares at least one sector",
);

// The live check in `npm run sources:verify` proves these feeds actually
// answer. This proves we bothered to declare enough of them in the first
// place, which is the half that can be checked without the network.
const DOMAINS = [...new Set(DECLARED_SOURCES.flatMap((s) => s.domains))];
for (const domain of DOMAINS) {
  const publishers = new Set(
    ALL_SOURCES.filter((s) => s.domains.includes(domain) && namesAPublisher(s)).map(publisherOf),
  );
  check(
    publishers.size >= 3,
    `${domain}: at least 3 distinct publishers declared (got ${publishers.size})`,
  );
}

check(
  publisherOf({ id: "a", feed: "https://economictimes.indiatimes.com/x.cms" }) ===
    publisherOf({ id: "b", feed: "https://energy.economictimes.indiatimes.com/rss/topstories" }),
  "one newsroom's several desks count as one publisher",
);
check(
  publisherOf({ id: "c", feed: "https://www.thehindubusinessline.com/economy/feeder/default.rss" }) !==
    publisherOf({ id: "d", feed: "https://www.thehindu.com/business/feeder/default.rss" }),
  "different publishers are not folded together",
);

console.log("");
console.log("Keyword discovery");
check(
  DISCOVERY_SOURCES.length === Object.values(SECTOR_KEYWORDS).flat().length,
  `one search feed per sector phrase (got ${DISCOVERY_SOURCES.length})`,
);
check(
  DISCOVERY_SOURCES.every((s) => s.discovery === true && /^https:\/\/news\.google\.com\/rss\/search\?q=/.test(s.feed)),
  "search feeds are built, not pasted",
);
check(
  DISCOVERY_SOURCES.every((s) => !/[ "']/.test(s.feed)),
  "search queries are URL-encoded, not pasted raw",
);
check(
  DISCOVERY_SOURCES.every((s) => new URL(s.feed).searchParams.get("q") !== null),
  "every search feed carries a q parameter",
);
check(
  DISCOVERY_SOURCES.every((s) => s.feed.includes("when%3A2d")),
  "search feeds ask only for the last two days",
);
check(
  Object.keys(SECTOR_KEYWORDS).length === 12,
  `every map sector has search phrases (got ${Object.keys(SECTOR_KEYWORDS).length})`,
);

console.log("");
console.log("Aggregator attribution");
const gnews = parseFeed(readFileSync("scripts/__fixtures__/gnews.xml", "utf8"));
check(gnews.length === 2, `parses aggregator items (got ${gnews.length}, want 2)`);
check(gnews[0]?.publisher === "The Hindu", "reads the publisher out of <source>");
check(
  gnews[0]?.title === "Vizhinjam port handles record container volume",
  "drops the ' - Outlet' suffix the aggregator appends",
);
check(
  stripOutletSuffix("A story - with a dash in it", "The Hindu") ===
    "A story - with a dash in it",
  "a dash that is not the outlet name is left alone",
);

console.log("");
console.log("Merging a refresh");
const base: DevEvent = {
  id: "a",
  title: "Coastal berth commissioned at Paradip port",
  category: "ports",
  date: "2026-08-18",
  placeId: "paradip",
  placeName: "Paradip",
  state: "Odisha",
  coords: [86.61, 20.31],
  outlet: "BusinessLine",
  url: "https://example.test/a",
  status: "reported",
};
check(mergeEvents([base], [base]).unchanged, "re-reporting the same story changes nothing");
check(mergeEvents([base], []).unchanged, "a quiet run leaves the stored map alone");
// A different id but the same story is not a new event — that is the duplicate
// collapse doing its job — so this has to be a genuinely different development.
const another: DevEvent = {
  ...base,
  id: "b",
  title: "Semiconductor assembly unit inaugurated at Sanand",
  category: "manufacturing",
  placeId: "sanand",
  placeName: "Sanand",
  state: "Gujarat",
  coords: [72.38, 22.99],
  url: "https://example.test/b",
};
const withNew = mergeEvents([base], [another]);
check(withNew.added === 1 && !withNew.unchanged, "a genuinely new report is added");
check(
  mergeEvents([base], [{ ...base, id: "b2", url: "https://example.test/b2" }]).events.length === 1,
  "a second outlet's report of the same story does not add a pin",
);
const commentary = mergeEvents(
  [{ ...base, id: "c", title: "What the port debate tells us about coastal policy", summary: "" }],
  [],
);
check(
  commentary.staleDropped === 1 && commentary.events.length === 0,
  "a stored row that no longer passes the rules is dropped",
);
check(
  mergeEvents([{ ...base, id: "seed-1", title: "Seeded, hand-verified, no action verb" }], [])
    .events.length === 1,
  "seeded rows are exempt from the re-check",
);
const old = mergeEvents([{ ...base, id: "d", date: "2020-01-01" }], []);
check(old.expired === 1 && old.events.length === 0, "events past the two-year horizon expire");

console.log("");
if (failures.length) {
  console.error(`${failures.length} ingest test(s) failed.`);
  process.exit(1);
}
console.log("All ingest tests passed.");
