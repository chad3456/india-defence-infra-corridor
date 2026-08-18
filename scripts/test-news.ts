/**
 * News connector parser tests.
 *
 * The first live pipeline run fetched all seven feeds successfully and still
 * produced zero items, so the fault was in parsing, not networking. These
 * fixtures cover both feed dialects and the shapes that broke it: CDATA,
 * numeric and named entities, Atom's self-closing <link href>, and a
 * channel-level <atom:link> that must not be mistaken for an item's link.
 */
import { readFileSync } from "node:fs";
import { parseFeedForTest } from "./etl/connectors/news";

const failures: string[] = [];
function check(ok: boolean | undefined, label: string) {
  ok = ok === true;
  console.log(`  ${ok ? "pass" : "FAIL"}  ${label}`);
  if (!ok) failures.push(label);
}

console.log("News parser tests");

const rss = parseFeedForTest(
  readFileSync("scripts/__fixtures__/rss.xml", "utf8"),
  { id: "theprint", name: "ThePrint", feed: "https://theprint.in/feed/" },
);

check(rss.length === 2, `RSS: keeps relevant items, drops the rest (got ${rss.length}, want 2)`);
check(
  rss[0]?.title === "India\u2019s defence exports cross record mark, DRDO tests new missile",
  "RSS: decodes numeric entities in the title (&#8217; is a curly apostrophe)",
);
check(rss[0]?.url === "https://theprint.in/defence/exports-record/123456/", "RSS: item link, not channel link");
check(rss[0]?.topics.includes("defence"), "RSS: tags defence");
check(rss[1]?.title === "New expressway and metro corridor approved for Kanpur", "RSS: unwraps CDATA titles");
check(rss[1]?.topics.includes("infrastructure"), "RSS: tags infrastructure");
check(rss[0]?.summary?.includes("Ministry of Defence") === true, "RSS: strips HTML from the description");
check(
  rss[0]?.publishedAt.startsWith("2026-08-18"),
  `RSS: parses pubDate (got ${rss[0]?.publishedAt})`,
);

const atom = parseFeedForTest(
  readFileSync("scripts/__fixtures__/atom.xml", "utf8"),
  { id: "restofworld", name: "Rest of World", feed: "https://restofworld.org/feed/latest/" },
);

check(atom.length === 2, `Atom: parses entries (got ${atom.length}, want 2)`);
check(
  atom[0]?.url === "https://restofworld.org/2026/india-semiconductor/",
  `Atom: reads self-closing <link href> (got ${atom[0]?.url})`,
);
check(atom[0]?.title.includes("India's") === true, "Atom: decodes &apos;");
check(atom[0]?.topics.includes("manufacturing"), "Atom: tags manufacturing");
check(atom[1]?.topics.includes("space"), "Atom: tags space");

console.log("");
if (failures.length) {
  console.error(`${failures.length} news parser test(s) failed.`);
  process.exit(1);
}
console.log("All news parser tests passed.");
