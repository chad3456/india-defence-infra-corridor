/**
 * Ingest tests: feed parsing, article extraction, classification, geo-location.
 *
 * These cover the parts that decide whether a pin appears and where. Two of
 * them exist because of real production failures: CDATA-wrapped titles emptied
 * every item on the first live run, and headline-only classification missed
 * stories whose sector and state appear only in the body.
 */
import { readFileSync } from "node:fs";
import { parseFeed, stripTags, decodeEntities } from "./etl/lib/feed";
import { extractText } from "./etl/lib/extract";
import { categorise, locate } from "./etl/lib/classify";
import { ALL_SOURCES, X_HANDLES } from "../lib/sources";

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
check(locate("New plant in Greater Noida announced", "")?.name === "Noida", "matches multi-word aliases");

console.log("");
console.log("Source registry");
check(ALL_SOURCES.length >= 25, `at least 25 feeds configured (got ${ALL_SOURCES.length})`);
check(
  ALL_SOURCES.every((s) => /^https?:\/\//.test(s.feed)),
  "every feed URL is absolute",
);
check(
  new Set(ALL_SOURCES.map((s) => s.id)).size === ALL_SOURCES.length,
  "source ids are unique",
);
check(
  ALL_SOURCES.some((s) => s.kind === "official") && ALL_SOURCES.some((s) => s.kind === "press"),
  "both official and press sources are configured",
);
check(X_HANDLES.length >= 10, `at least 10 X handles configured (got ${X_HANDLES.length})`);
check(
  X_HANDLES.every((h) => !h.handle.startsWith("@")),
  "X handles are stored without a leading @",
);

console.log("");
if (failures.length) {
  console.error(`${failures.length} ingest test(s) failed.`);
  process.exit(1);
}
console.log("All ingest tests passed.");
