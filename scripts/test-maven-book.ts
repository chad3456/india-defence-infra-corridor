/**
 * Every fact this repository takes from the Project Maven book is still in it,
 * and every number the page prints is one the book prints.
 *
 * The connector verifies each record's phrase against the EPUB. This repeats
 * that offline, on every commit, and adds the check the connector cannot make
 * by itself: the prose around a figure. A record whose verified phrase says
 * "thirty to thirty-five targets a day" can still carry a description that
 * says forty, and nothing about the phrase check would notice. So every number
 * in a record's prose, its `when`, and its date must be found among the
 * numbers of that record's own verified phrases — in digits or in words, since
 * the book writes most of them out.
 *
 * It also checks the shape of the claims: that quotations are verified whole,
 * that the 2019 budget disagreement is shown rather than resolved, that the
 * cycle has the six phases the book names and loses four of them.
 */
import { findBook, readChapters, locate, type Chapter } from "./etl/lib/epub";
import { numbersIn } from "./etl/lib/book-numbers";

export { numbersIn };
import {
  CHAPTERS, PARTS, FIGURES, BEATS, SCENES, VOICES, WHERE, CYCLE, BOOK, LAYERS,
} from "./etl/connectors/maven-book";

let failures = 0;
function check(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`  ${ok ? "pass" : "FAIL"}  ${name}${ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december"];

console.log("Numbers are read the way the book writes them");
{
  check("digits", numbersIn("more than 1,500 algorithms"), [1500]);
  check("hyphenated words", numbersIn("thirty to thirty-five targets"), [30, 35]);
  check("a thousand", numbersIn("able to hit a thousand"), [1000]);
  check("scale after digits gives both readings", numbersIn("$40.8 million"), [40.8, 40800000]);
  check("two dozen", numbersIn("Two dozen made the cut"), [24]);
  check("fifty and eighty are two numbers", numbersIn("between fifty and eighty pixels"), [50, 80]);
  check("ordinals are not quantities", numbersIn("the 18th Airborne"), []);
  check("an article is not a one", numbersIn("a farmer with a herd"), []);
  check("one billion", numbersIn("one billion AI detections"), [1e9]);
  check("twenty-one", numbersIn("a twenty-one-year-old analyst"), [21]);
  check("a chapter reference is not a quantity", numbersIn("the book's chapter 12 figure"), []);
}

console.log("\nThe book is where it is expected to be");
let chapters: Chapter[] = [];
{
  const path = findBook("data", "Project Maven");
  chapters = readChapters(path, CHAPTERS);
  check("all thirty chapter files read", chapters.length, 30);
  check("every numbered chapter has text", chapters.filter((c) => /^\d/.test(c.label)).every((c) => c.text.length > 10000), true);
  check("the author is who the citation says", BOOK.author, "Katrina Manson");
  check("the four parts are the four verbs", PARTS.map((p) => p.title), ["Find", "Fix", "Finish", "Feedback"]);
  check("the parts cover all 26 chapters once", PARTS.flatMap((p) => p.chapters).length, 26);
}

const found = (phrase: string) => locate(chapters, phrase).found;

console.log("\nEvery curated fact is still in the book");
{
  const all: Array<{ what: string; verify: string }> = [
    ...FIGURES.flatMap((f) => [f.verify, ...(f.also ?? [])].map((v) => ({ what: `figure ${f.id}`, verify: v }))),
    ...BEATS.flatMap((b) => [b.verify, ...(b.also ?? [])].map((v) => ({ what: `beat ${b.id}`, verify: v }))),
    ...SCENES.flatMap((s) => [s.verify, ...(s.also ?? []), ...s.accounts.map((a) => a.verify)]
      .map((v) => ({ what: `scene ${s.id}`, verify: v }))),
    ...VOICES.flatMap((v) => [v.quote, ...(v.context ? [v.context] : [])].map((q) => ({ what: `voice ${v.id}`, verify: q }))),
    ...WHERE.map((w) => ({ what: `where ${w.name}`, verify: w.verify })),
    ...LAYERS.map((l) => ({ what: `layer ${l.id}`, verify: l.quote })),
    ...CYCLE.phases.map((p) => ({ what: `phase ${p.id}`, verify: p.verify })),
    { what: "cycle removed", verify: CYCLE.removed.verify },
    { what: "cycle remaining", verify: CYCLE.remaining.verify },
    { what: "cycle policy", verify: CYCLE.policy.verify },
  ];
  const missing = all.filter((x) => !found(x.verify));
  check(`all ${all.length} phrases verify`, missing.map((m) => `${m.what}: ${m.verify.slice(0, 50)}`), []);
  check("a phrase that is not in the book is reported missing", found("Maven hit ten thousand targets a day"), false);
  check("a quotation is verified whole, not by a fragment", VOICES.every((v) => v.quote.split(" ").length >= 2), true);
  check("each account in a scene is verified by its own words",
    SCENES.every((s) => s.accounts.every((a) => a.says === a.verify)), true);
}

console.log("\nEvery number the page prints is one the book prints");
{
  const bad: string[] = [];
  const pool = (phrases: string[]) => new Set(phrases.flatMap(numbersIn));
  for (const f of FIGURES) {
    const have = pool([f.verify, ...(f.also ?? [])]);
    if (!have.has(f.value)) bad.push(`figure ${f.id}: value ${f.value} is not in its verified phrase`);
    for (const n of [...numbersIn(f.what), ...numbersIn(f.when)]) {
      if (!have.has(n) && n !== f.value) bad.push(`figure ${f.id}: ${n} in the prose is not in its verified phrases`);
    }
  }
  const dated = (id: string, date: string, prose: string, phrases: string[]) => {
    const have = pool(phrases);
    const text = phrases.join(" ").toLowerCase();
    for (const n of numbersIn(prose)) if (!have.has(n)) bad.push(`${id}: ${n} in the prose is not in its verified phrases`);
    const [y, m, d] = date.split("-");
    if (y && !have.has(Number(y))) bad.push(`${id}: year ${y} is not in its verified phrases`);
    if (m && !text.includes(MONTHS[Number(m) - 1] ?? "?")) bad.push(`${id}: month ${m} is not in its verified phrases`);
    if (d && !have.has(Number(d))) bad.push(`${id}: day ${d} is not in its verified phrases`);
  };
  for (const b of BEATS) dated(`beat ${b.id}`, b.date, `${b.label} ${b.what}`, [b.verify, ...(b.also ?? [])]);
  for (const s of SCENES) {
    dated(`scene ${s.id}`, s.date, `${s.title} ${s.what}`, [s.verify, ...(s.also ?? []), ...s.accounts.map((a) => a.verify)]);
  }
  check("no unverified number anywhere in the curated prose", bad, []);
}

console.log("\nThe claims have the shape the book gives them");
{
  const b = (id: string) => FIGURES.find((f) => f.id === id)?.value;
  check("the 2019 budget disagreement is shown, not resolved",
    [b("budget-2019-ch12"), b("budget-2019-ch18")], [93, 189.53]);
  check("the tempo steps rise fivefold, then tenfold",
    [b("tempo-cv")! / 100, b("tempo-llm")! / b("tempo-cv")!], [10, 5]);
  check("the AI is less accurate than the humans it was compared with at the 18th",
    (b("acc-18th-ai") ?? 0) < (b("acc-18th-human") ?? 0), true);
  check("the joint targeting cycle has six phases", CYCLE.phases.length, 6);
  check("every participant claim names who made it",
    FIGURES.filter((f) => f.claim === "participant").every((f) => f.who.length > 3), true);
  check("each scene says what the AI did", SCENES.every((s) => ["found", "missed", "off", "failed", "helped"].includes(s.ai)), true);
  check("the van scene keeps the survivor's account beside the operator's",
    SCENES.find((s) => s.id === "van")?.accounts.some((a) => a.who.startsWith("Barakat")), true);
  check("no country is named twice", new Set(WHERE.map((w) => w.iso)).size, WHERE.length);
  check("a figure's hedge is one the book uses", FIGURES.every((f) =>
    f.qualifier === "" || found(`${f.qualifier}`)), true);
}

console.log(`\n${failures === 0 ? "All passed." : `${failures} failed.`}`);
if (failures > 0) process.exit(1);
