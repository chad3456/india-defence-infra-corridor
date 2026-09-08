/**
 * Reading a feed, against the shapes the register actually carries.
 *
 * The live route cannot be tested end to end from here: every Indian
 * government host is blocked from this machine, so the route correctly returns
 * nothing and the panel correctly says so. Reachability is already proven by
 * the committed pipeline, which fetches these same feeds from CI. What is not
 * proven, and is the part most likely to be wrong, is whether the parser reads
 * a feed correctly once one arrives.
 */
import { parseFeed, newestFirst, tagText } from "../lib/feed-parse";

let bad = 0;
function ok(name: string, cond: boolean, detail = ""): void {
  if (!cond) bad++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  " + detail}`);
}

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel>
<title>Press Information Bureau</title>
<item>
  <title>Cabinet approves semiconductor fab in Gujarat</title>
  <link>https://pib.gov.in/PressRelease.aspx?PRID=2001</link>
  <pubDate>Mon, 08 Sep 2026 09:15:00 +0530</pubDate>
</item>
<item>
  <title><![CDATA[PM inaugurates 6 Vande Bharat trains]]></title>
  <link>https://pib.gov.in/PressRelease.aspx?PRID=2002</link>
  <pubDate>Mon, 08 Sep 2026 07:00:00 +0530</pubDate>
</item>
<item>
  <title>Undated release</title>
  <link>https://pib.gov.in/PressRelease.aspx?PRID=2003</link>
</item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
<title>PMO India</title>
<entry>
  <title>PM chairs review on infrastructure</title>
  <link rel="alternate" href="https://pmindia.gov.in/en/news/1"/>
  <published>2026-09-08T04:30:00Z</published>
</entry>
<entry>
  <title>Statement on trade talks &amp; tariffs</title>
  <link rel="alternate" href="https://pmindia.gov.in/en/news/2"/>
  <updated>2026-09-07T18:00:00Z</updated>
</entry>
</feed>`;

console.log("\nRSS");
{
  const items = parseFeed(RSS, "PIB", "pib-national");
  ok("three items are read", items.length === 3, String(items.length));
  ok("a title is read", items[0]?.title === "Cabinet approves semiconductor fab in Gujarat", items[0]?.title);
  ok("a link is read", items[0]?.url === "https://pib.gov.in/PressRelease.aspx?PRID=2001");
  // A CDATA title is the common case on Indian government feeds.
  ok("a CDATA title is unwrapped",
    items[1]?.title === "PM inaugurates 6 Vande Bharat trains", items[1]?.title);
  // IST offsets must be converted, not truncated.
  ok("an IST date becomes the right UTC instant",
    items[0]?.published === "2026-09-08T03:45:00.000Z", String(items[0]?.published));
  ok("an item with no date is kept, dated null",
    items[2]?.published === null && items[2]?.title === "Undated release");
  ok("the outlet is attached", items.every((i) => i.outlet === "PIB"));
}

console.log("\nAtom");
{
  const items = parseFeed(ATOM, "PMO India", "pmindia");
  ok("two entries are read", items.length === 2, String(items.length));
  // Atom puts the URL in an attribute, where a body-only reader finds nothing.
  ok("a link in an href attribute is read",
    items[0]?.url === "https://pmindia.gov.in/en/news/1", items[0]?.url);
  ok("published is read", items[0]?.published === "2026-09-08T04:30:00.000Z");
  ok("updated is used when published is absent",
    items[1]?.published === "2026-09-07T18:00:00.000Z", String(items[1]?.published));
  ok("an escaped ampersand is unescaped",
    items[1]?.title === "Statement on trade talks & tariffs", items[1]?.title);
}

console.log("\nOrdering");
{
  const items = newestFirst(parseFeed(RSS, "PIB", "pib"));
  ok("newest first", items[0]?.title.startsWith("Cabinet approves") === true, items[0]?.title);
  // An undated item sorting high would put it above everything real.
  ok("an undated item sorts last",
    items[items.length - 1]?.published === null, String(items[items.length - 1]?.published));
}

console.log("\nRefusing malformed input");
{
  ok("empty input yields nothing", parseFeed("", "x", "x").length === 0);
  ok("html that is not a feed yields nothing",
    parseFeed("<html><body><p>hello</p></body></html>", "x", "x").length === 0);
  // An item without a link cannot be cited, so it is not carried.
  ok("an item with no link is dropped",
    parseFeed("<rss><item><title>No link here</title></item></rss>", "x", "x").length === 0);
  ok("an item with no title is dropped",
    parseFeed("<rss><item><link>https://x/1</link></item></rss>", "x", "x").length === 0);
  ok("an empty title is treated as no title", tagText("<title>   </title>", "title") === null);
  ok("a nonsense date is treated as no date",
    parseFeed("<rss><item><title>T</title><link>https://x/1</link><pubDate>soon</pubDate></item></rss>",
      "x", "x")[0]?.published === null);
}

if (bad > 0) { console.error(`\n${bad} feed test(s) failed.`); process.exit(1); }
console.log("\nAll feed tests passed.");
