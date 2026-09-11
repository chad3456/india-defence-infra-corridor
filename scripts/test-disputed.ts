/**
 * The disputed-sites catalogue, checked before it ships.
 *
 * These checks are mostly about framing rather than arithmetic. The dataset is
 * a list of claims from a contested book, and the ways it can go wrong are not
 * "a number is off" but "it stopped saying whose claims these are", or "it
 * grew a total", or "a mosque ended up in the temple atlas".
 */
import { existsSync, readFileSync } from "node:fs";

const FILE = "data/sacred/disputed.json";
if (!existsSync(FILE)) {
  console.log(`\n  skip  ${FILE} not built yet — run npm run disputed:ingest.`);
  process.exit(0);
}

let bad = 0;
function ok(name: string, cond: boolean, detail = ""): void {
  if (!cond) bad++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  " + detail}`);
}

interface Entry {
  state: string; district: string | null; place: string | null;
  monument: string; claim: string | null;
}
const d = JSON.parse(readFileSync(FILE, "utf8")) as {
  entries: Entry[]; states: string[]; framing: string; absent: string;
  noTotal: string; source: { author: string; title: string };
  claimTypes: Record<string, number>;
};

console.log("\nThe catalogue");
ok("carries the full list", d.entries.length >= 1200, String(d.entries.length));
ok("covers at least twelve states", d.states.length >= 12, String(d.states.length));
ok("every entry names a state", d.entries.every((e) => Boolean(e.state)));
ok("every entry names its monument", d.entries.every((e) => e.monument.length > 3));

{
  // The parser walks the document by indentation, and its failure is silent: a
  // heading misread as a place slides every later row into the wrong district.
  const long = d.entries.filter((e) => (e.place?.length ?? 0) > 48);
  ok("no place name is a runaway heading", long.length === 0,
    long.slice(0, 2).map((e) => e.place).join(" / "));
}
{
  // Reading the UTF-8 EPUB as latin1 turned every transliterated vowel into
  // mojibake across a list whose whole value is the spelling of place names.
  //
  // Matching a bare "Ã" was wrong and this test failed on correct data to
  // prove it: "Ãlamgîrî Masjid" is Aurangzeb Ālamgīr, and Ã is a long A in the
  // book's own transliteration. Double-encoding shows up as a digraph — Ã
  // followed by the accented byte — never as Ã alone.
  const mojibake = d.entries.filter((e) =>
    /Ã[\u0080-\u00bf]|Â[\u0080-\u00bf]|ï¿½/.test(e.monument + (e.place ?? "")));
  ok("transliteration survived the encoding", mojibake.length === 0,
    mojibake.slice(0, 2).map((e) => e.monument.slice(0, 40)).join(" / "));
}

console.log("\nFraming");
ok("says these are one author's claims, not a record of temples",
  /claims|assert/i.test(d.framing) && /not a record of temples/i.test(d.framing));
ok("names the author and the book",
  d.source.author.length > 0 && d.source.title.length > 0);
ok("says the work is contested", /contested/i.test(d.framing));
ok("says what the book does not contain",
  /no coordinates/i.test(d.absent) && /visitor/i.test(d.absent));
ok("refuses a total", /no total/i.test(d.noTotal));

{
  // The verdicts rest on different evidence — spolia, a site claim, a claim
  // about the building itself — and collapsing them would make the list say
  // something its author did not.
  const kinds = Object.keys(d.claimTypes);
  ok("keeps the verdicts apart rather than merging them", kinds.length >= 3,
    kinds.join(", "));
}

console.log("\nSeparation from the atlas");
if (existsSync("data/sacred/atlas.json")) {
  const atlas = JSON.parse(readFileSync("data/sacred/atlas.json", "utf8")) as {
    sites: Array<{ name: string }>;
  };
  const names = new Set(atlas.sites.map((s) => s.name.toLowerCase()));
  // Every entry here is a mosque, dargah, idgah or fort. None of it belongs in
  // a map of Hindu temples, and a leak would be invisible on the page.
  const leaked = d.entries.filter((e) => e.place && names.has(e.place.toLowerCase()) &&
    /masjid|dargah|idgah|mosque/i.test(e.monument)).length;
  ok("no disputed monument has been merged into the temple atlas", leaked === 0, String(leaked));
} else {
  console.log("  skip  atlas not built here");
}

console.log(bad === 0 ? "\nAll disputed-sites checks passed.\n" : `\n${bad} check(s) failed.\n`);
process.exit(bad === 0 ? 0 : 1);
