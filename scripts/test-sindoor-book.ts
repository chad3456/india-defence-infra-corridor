/**
 * Every fact this repository attributes to the Sindoor book is still in it.
 *
 * The facts in `sindoor-book.ts` were read out of a book and typed in by hand.
 * That is the step at which a number quietly becomes a slightly different
 * number, a camp moves ten kilometres, or a claim attributed to a Pakistani
 * officer ends up attributed to an Indian one — and none of those would look
 * wrong afterwards. They would look like a dataset.
 *
 * So this runs the same verification the connector runs, offline, against the
 * committed EPUB, as part of the ordinary test gate. The connector needs the
 * network for coordinates; this needs nothing, which means the check runs on
 * every commit rather than only when the pipeline does.
 *
 * It also checks the shape of the claims themselves — that a Pakistani
 * concession really is attributed to a Pakistani source, that no depth is
 * negative, that the nine targets split seven/two the way the book says. A
 * verified quote inside a malformed record is still a wrong page.
 */
import { findBook, readChapters, locate, norm, plainText, type Chapter } from "./etl/lib/epub";
import { TARGETS, AIRBASES, BEATS, WEAPONS, DISPUTES, BOOK } from "./etl/connectors/sindoor-book";

let failures = 0;
function check(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`  ${ok ? "pass" : "FAIL"}  ${name}${ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
}

const CHAPTERS: Record<string, string> = {
  c2G: "Foreword", c30: "1. The Roots of Terror", c9E: "2. The Blood Before the Storm",
  cC7: "3. Strategic Guidance", cE4: "4. The War Room", cNY: "5. The Four-Day War",
  cWJ: "6. Battle at the Line of Control", cZX: "7. Strategic Communication",
  c11W: "8. New Rules of Engagement",
};

console.log("The book is where it is expected to be");
let chapters: Chapter[] = [];
{
  const path = findBook("data", "Operation SINDOOR");
  chapters = readChapters(path, CHAPTERS);
  check("all nine chapters read", chapters.length, 9);
  check("every chapter has text", chapters.every((c) => c.text.length > 3000), true);
  check("the author is who the citation says", BOOK.author.includes("Dhillon"), true);
}

console.log("\nText extraction keeps what a citation needs");
{
  check("tags go", plainText("<p>Markaz <b>Taiba</b></p>").includes("Markaz Taiba"), true);
  check("page anchors survive as markers",
    /\[\[p75\]\]/.test(plainText('<a id="page_75"/>text')), true);
  check("a curly apostrophe matches a straight one",
    norm("Pakistan’s army"), norm("Pakistan's army"));
  check("an en-dash matches a hyphen", norm("9–10 May"), norm("9-10 May"));
}

console.log("\nEvery curated fact is still in the book");
{
  const all = [
    ...TARGETS.map((t) => ({ what: `target ${t.id}`, verify: t.verify })),
    ...AIRBASES.map((a) => ({ what: `site ${a.id}`, verify: a.verify })),
    ...BEATS.map((b) => ({ what: `beat ${b.id}`, verify: b.verify })),
    ...WEAPONS.map((w) => ({ what: `weapon ${w.id}`, verify: w.verify })),
    ...DISPUTES.map((d) => ({ what: `dispute ${d.id}`, verify: d.verify })),
  ];
  const missing = all.filter((x) => !locate(chapters, x.verify).found);
  check(`all ${all.length} verify`, missing.map((m) => m.what), []);

  /* A citation without a page is a citation to a whole book. */
  const pageless = all.filter((x) => locate(chapters, x.verify).page === null);
  check("every one resolves to a print page", pageless.map((p) => p.what), []);

  /*
   * And the check has to be capable of failing, or it proves nothing. A run
   * where every phrase matched because the matcher was broken would look
   * exactly like a run where every phrase was correct.
   */
  check("a phrase that is not in the book is reported missing",
    locate(chapters, "the quick brown fox jumped over the lazy dog").found, false);
}

console.log("\nThe records are shaped the way the book describes");
{
  check("nine targets", TARGETS.length, 9);
  check("two struck by the air force, as the book states",
    TARGETS.filter((t) => t.agency === "IAF").map((t) => t.town).sort(), ["Bahawalpur", "Muridke"]);
  check("seven struck by the army", TARGETS.filter((t) => t.agency === "Army").length, 7);
  check("no depth is negative or absurd",
    TARGETS.every((t) => t.depthKm === null || (t.depthKm > 0 && t.depthKm <= 500)), true);
  check("every target names a place to resolve", TARGETS.every((t) => t.place.length > 2), true);
  check("ids are unique", new Set(TARGETS.map((t) => t.id)).size, TARGETS.length);

  /*
   * The tier that carries the most weight must be the one that costs the
   * speaker something. A Pakistani concession attributed to an Indian source
   * would be the single most misleading error this dataset could contain, and
   * it would read as the strongest evidence on the page.
   */
  const conc = BEATS.filter((b) => b.tier === "pakistan-concession");
  check("at least one Pakistani concession is recorded", conc.length > 0, true);
  check("every concession names a Pakistani source",
    conc.every((b) => /Pakistan/i.test(b.what)), true);
  check("an Indian official claim is never filed as a Pakistani concession",
    BEATS.some((b) => b.tier === "pakistan-concession" && /Amit Shah|Ministry of External Affairs/i.test(b.what)), false);

  check("every beat has a date", BEATS.every((b) => /^\d{4}-\d{2}-\d{2}$/.test(b.date)), true);
  check("the first beat is the attack that triggered it", BEATS[0]?.date, "2025-04-22");
}

console.log("\nThe refusals hold");
{
  const prose = [...BEATS.map((b) => b.what), ...DISPUTES.map((d) => `${d.indiaSays} ${d.note}`)].join(" ");
  /*
   * No casualty total and no aircraft-loss total, for either country. These
   * are the two numbers the whole conflict is argued through and the two
   * neither government can be taken at its word on. The /sindoor page refuses
   * them and so does this.
   */
  check("no aircraft-loss tally is stated",
    /\b\d+\s+(?:aircraft|jets?|fighters?|planes?)\s+(?:were\s+)?(?:shot down|downed|lost|destroyed)/i.test(prose), false);
  check("no casualty total is stated",
    /\b\d+\s+(?:killed|dead|casualties|soldiers killed|civilians killed)\b/i.test(prose), false);
}

console.log(failures === 0 ? "\nAll Sindoor-book tests passed." : `\n${failures} Sindoor-book test(s) failed.`);
if (failures > 0) process.exit(1);
