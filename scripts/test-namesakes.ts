/**
 * `npm run test:namesakes`
 *
 * Two halves. The first holds the sentence rules to the cases that break naive
 * matching — every one of them a real shape of Wikipedia sentence. The second
 * holds the committed dataset to the rule the page is built on: nothing is
 * pinned as "named after" without a stated source a reader can open.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findNamingSentence, firstNamingSentence, roadFigure, sentences, clusterRoads, type FigureWords } from "./etl/lib/namesake-match";
import { FIGURES } from "../lib/namesakes-shared";
import { articleText } from "./etl/connectors/namesakes";

let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) failed++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok || !detail ? "" : `  (${detail})`}`);
}
const fig = (id: string): FigureWords => {
  const f = FIGURES.find((x) => x.id === id);
  if (!f) throw new Error(`no figure ${id}`);
  return f;
};
const hits = (text: string, id: string) => findNamingSentence(text, fig(id));

console.log("\nSentence splitting");
check("initials do not end a sentence",
  sentences("The road is named after M. K. Gandhi. It runs north.").length === 2);
check("titles do not end a sentence",
  sentences("It was opened by Dr. Rajendra Prasad in 1952. It is old.").length === 2);

console.log("\nGods: what must count");
check("Lord Rama", hits("The town is believed to be named after Lord Rama, who rested here during his exile.", "rama")?.needsContext === false);
check("Rama with Ramayana context", hits("According to local legend, the village was named after Rama, the hero of the Ramayana.", "rama")?.needsContext === false);
check("Hanuman", hits("Hanumangarh takes its name from Lord Hanuman, as the fort was captured on a Tuesday.", "hanuman")?.needsContext === false);
check("Krishna with the deity named", hits("The locality derives its name from the Hindu god Krishna.", "krishna")?.needsContext === false);
check("Rama's possessive still ends the name", hits("It is named after Lord Rama's visit to the hill.", "rama") !== null);
check("Lord Rama Temple is still Rama", hits("The village was named after the Lord Rama Temple built by the king.", "rama") !== null);

console.log("\nGods: what must not count");
check("Krishnanagar is a king, not the god",
  hits("Krishnanagar was named after Maharaja Krishnachandra Roy of Nadia.", "krishna") === null);
check("a king whose name begins with Krishna",
  hits("The town was named after Raja Krishna Chandra, its founder.", "krishna") === null);
check("Krishna district is a river",
  hits("The district is named after the Krishna River, which flows through it.", "krishna") === null);
check("the river Krishna",
  hits("The district takes its name from the river Krishna.", "krishna") === null);
check("Ram Manohar Lohia is not Ram",
  hits("The hospital was renamed in honour of Ram Manohar Lohia in 1970.", "rama") === null);
check("Rama Rao is not Rama",
  hits("The colony is named after N. T. Rama Rao, the former chief minister.", "rama") === null);
check("Maruti the car is not Hanuman",
  hits("The company was named after Maruti, and its first car launched in 1983.", "hanuman")?.needsContext !== false);
check("a person called Radha goes to review, not the map",
  hits("The school is named after Radha, the founder's daughter.", "radha")?.needsContext === true);
check("mentioned but not as a namesake",
  hits("Lord Rama is worshipped in the temple, which was built in 1820.", "rama") === null);
check("a verb too far from the name",
  hits("The fort was named by the Rathores who ruled it for generations before any temple to Lord Rama was raised.", "rama") === null);

console.log("\nGandhis");
check("Rajiv Gandhi, institution name following",
  hits("The airport is named after Rajiv Gandhi, the former Prime Minister of India.", "rajiv") !== null);
check("in memory of Indira Gandhi",
  hits("The canal was renamed in memory of Indira Gandhi after her assassination in 1984.", "indira") !== null);
check("Mahatma Gandhi",
  hits("The city was named after Mahatma Gandhi.", "mahatma") !== null);
check("M. K. Gandhi, initials",
  hits("The hall was named after M. K. Gandhi in 1948.", "mahatma") !== null);
check("Indira Gandhi is not the Mahatma",
  hits("The stadium was named after Indira Gandhi in 1985.", "mahatma") === null);
check("Rajiv Gandhi is not Indira",
  hits("It is named after Rajiv Gandhi.", "indira") === null);

console.log("\nWikitext to prose");
{
  // A made-up article in real wikitext shapes: an infobox with templates inside
  // templates, a reference, a heading, a table and an image caption.
  const text = articleText(`{{Infobox settlement|name = Sample|pop = {{formatnum:22310}}}}
'''Sample''' is a town.<ref>{{cite web|url=x}}</ref>
== Etymology ==
The name is derived from [[Rama|Lord Rama]], who rested here.
{| class="wikitable"
| a || b
|}
[[File:Sample.jpg|thumb|The [[temple]] at Sample]]`);
  check("templates, refs, tables and files are gone", !/[{}|]|cite web|thumb/.test(text), text);
  check("a heading does not glue onto the sentence under it",
    hits(text, "rama")?.sentence === "The name is derived from Lord Rama, who rested here.");
}

console.log("\nLookalikes");
check("any namesake sentence is found",
  firstNamingSentence("Krishnagiri is a town. The name means black hill, after the dark granite hills around it.")?.startsWith("The name means") === true);

console.log("\nRoads");
check("M.G. Road is the Mahatma", roadFigure("M.G. Road") === "mahatma");
check("MG Road", roadFigure("MG Road") === "mahatma");
check("Mahatma Gandhi Marg", roadFigure("Mahatma Gandhi Marg") === "mahatma");
check("Rajiv Gandhi Salai", roadFigure("Rajiv Gandhi Salai") === "rajiv");
check("Indira Gandhi Road", roadFigure("Indira Gandhi Road") === "indira");
check("a bare Gandhi Road is kept apart", roadFigure("Gandhi Road") === "gandhi");
check("Gandhi Nagar is not a road", roadFigure("Gandhi Nagar") === null);
check("MG Road Metro is not a road name", roadFigure("MGR Road") === null);
const clustered = clusterRoads([
  { key: "mg road", lat: 12.975, lon: 77.605 }, { key: "mg road", lat: 12.976, lon: 77.612 },
  { key: "mg road", lat: 12.974, lon: 77.62 }, { key: "mg road", lat: 19.0, lon: 72.8 },
]);
check("ways that chain count as one road, a far one as another", clustered.length === 2, `got ${clustered.length}`);

console.log("\nThe committed dataset");
const FILE = join(process.cwd(), "data", "namesakes", "namesakes.json");
if (!existsSync(FILE)) {
  console.log("  (no data/namesakes/namesakes.json yet — the ingest workflow writes it)");
} else {
  const d = JSON.parse(readFileSync(FILE, "utf8")) as {
    places: Array<{ qid: string; name: string; lat: number | null; lon: number | null; review?: boolean; evidence: Array<{ figure: string; tier: string; quote?: string; url: string }> }>;
    figures: Array<{ id: string; qid: string | null }>;
  };
  const ids = new Set(d.figures.map((f) => f.id));
  check("every figure resolved to a Wikidata item", d.figures.every((f) => f.qid && /^Q\d+$/.test(f.qid)),
    d.figures.filter((f) => !f.qid).map((f) => f.id).join(", "));
  // A place held for review has no evidence yet, by design: its sentence is
  // waiting for a reader. Every other place must carry some.
  const noEvidence = d.places.filter((p) => p.evidence.length === 0 && !p.review);
  check("every place carries evidence, or is held for review", noEvidence.length === 0, noEvidence.slice(0, 3).map((p) => p.name).join(", "));
  const badUrl = d.places.flatMap((p) => p.evidence).filter((e) => !/^https:\/\/(www\.wikidata\.org|en\.wikipedia\.org)\//.test(e.url));
  check("every piece of evidence links to its source", badUrl.length === 0, `${badUrl.length} without`);
  const badFig = d.places.flatMap((p) => p.evidence).filter((e) => !ids.has(e.figure));
  check("evidence names only known figures", badFig.length === 0);
  const quoteless = d.places.flatMap((p) => p.evidence).filter((e) => e.tier === "quoted" && !(e.quote && e.quote.length > 10));
  check("a quoted tier always carries its quote", quoteless.length === 0);
  const outside = d.places.filter((p) => p.lat !== null && p.lon !== null && (p.lat < 6 || p.lat > 37.6 || p.lon < 67 || p.lon > 97.5));
  check("every pin is inside India's box", outside.length === 0, outside.slice(0, 3).map((p) => p.name).join(", "));
  const dup = d.places.length - new Set(d.places.map((p) => p.qid)).size;
  check("no item appears twice", dup === 0, `${dup} duplicates`);
  console.log(`  (${d.places.length} places)`);
}

console.log(failed ? `\n${failed} failed\n` : "\nall passed\n");
process.exit(failed ? 1 : 0);
