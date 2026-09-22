/**
 * The measurement's own traps, pinned.
 *
 * The finding this piece is built to avoid producing is a rising line that is
 * really a fact about Wikipedia. Everything below guards one step of that.
 */
import { filmsFromList, plotOf, genresOf, measure, endingOf, MARKERS, TITLE_WORDS } from "./etl/connectors/bollywood";

let failures = 0;
function check(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`  ${ok ? "pass" : "FAIL"}  ${name}${ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
}

console.log("A year list yields films, not the furniture around them");
{
  const wt = `
{| class="wikitable"
|-
! Title !! Director
|-
| [[Rangeela]] || [[Ram Gopal Varma]]
|-
| [[Bombay (1995 film)|Bombay]] || [[Mani Ratnam]]
|-
| [[January]] || nobody
|-
| [[Category:1995 films]] ||
|}`;
  const got = filmsFromList(wt);
  check("films are taken from rows", got.includes("Rangeela"), true);
  check("a piped title keeps its article name", got.includes("Bombay (1995 film)"), true);
  /*
   * The lists link months, categories and every actor alive. Taking every link
   * on the page would have filed "January" as a 1995 release.
   */
  check("a month is not a film", got.includes("January"), false);
  check("a category is not a film", got.some((t) => t.startsWith("Category:")), false);
  check("the first link in a row wins, not every link", got.includes("Ram Gopal Varma"), false);
}

console.log("\nA plot section comes out clean");
{
  const wt = `
'''Rangeela''' is a film.
== Plot ==
Munna is a [[tout]] who sells tickets.<ref>{{cite web|url=http://x}}</ref> He falls for [[Mili (character)|Mili]].
== Cast ==
* Someone`;
  const p = plotOf(wt);
  check("the plot is found", /Munna is a tout/.test(p), true);
  check("references are stripped", /cite web|http/.test(p), false);
  check("a piped link keeps its display text", /falls for Mili/.test(p), true);
  check("the next section is not swallowed", /Cast|Someone/.test(p), false);
  check("no plot section yields nothing", plotOf("== Cast ==\n* x"), "");
  check("a synopsis heading also counts", /He waits/.test(plotOf("== Synopsis ==\nHe waits.")), true);
}

console.log("\nGenres come off the infobox");
{
  /*
   * The bug this pins lost genres from most films silently. Capturing the
   * field up to the next pipe is the obvious reading of infobox syntax and is
   * wrong, because a wikilink contains a pipe: `[[Action film|Action]], Drama`
   * captured "[[Action film" and discarded the rest. A film with fewer genres
   * looks exactly like a film with fewer genres.
   */
  check("a piped wikilink does not truncate the field",
    genresOf("| genre = [[Action film|Action]], Drama"), ["action", "drama"]);
  check("an unlinked field still works",
    genresOf("| genre = Comedy, Romance"), ["comedy", "romance"]);
  check("the next infobox field is not swallowed",
    genresOf("| genre = [[Thriller film|Thriller]] | runtime = 120 minutes"), ["thriller"]);
  check("no genre field yields nothing", genresOf("| director = X"), []);
}

console.log("\nMarkers are what they say and nothing more");
{
  const mk = (plot: string) => measure("T", 2000, `== Plot ==\n${plot}`);

  const revenge = mk("A plot summary of reasonable length about a man who returns to his village, discovers what was done to his family, and sets out to avenge his brother's death.");
  check("revenge is detected", revenge?.markers.includes("revenge"), true);
  check("the matching sentence is published", (revenge?.evidence ?? []).some((e) => e.marker === "revenge" && e.quote.length > 10), true);

  /*
   * The tiers must not collapse. Presence is the weakest claim on the page —
   * a film can be about revenge and be against it — and the whole argument
   * depends on it never being counted as endorsement.
   */
  const tiers = new Set(MARKERS.map((m) => m.tier));
  check("three tiers exist", [...tiers].sort(), ["framing", "outcome", "presence"]);
  check("revenge is presence, not framing",
    MARKERS.find((m) => m.id === "revenge")?.tier, "presence");
  check("being called a hero is framing, not presence",
    MARKERS.find((m) => m.id === "hero-word")?.tier, "framing");
  check("an ending in a reckoning is an outcome",
    MARKERS.find((m) => m.id === "ending-reckoning")?.tier, "outcome");

  /* Every marker publishes a note saying what it does not establish. */
  check("every marker carries a caveat", MARKERS.every((m) => m.note.length > 20), true);
  check("marker ids are unique", new Set(MARKERS.map((m) => m.id)).size, MARKERS.length);

  const plain = mk("A plot summary of reasonable length about two friends who open a restaurant together in a small town, work hard through a difficult first year, and find that it goes well for everyone in the end.");
  check("an ordinary plot trips nothing", plain?.markers, []);

  /*
   * Outcome markers see only the ending, so this fixture puts the escape in
   * the last sentence where a resolution actually lives.
   */
  const unpunished = mk("A plot summary of reasonable length in which a young man joins a crew of thieves and works for them. He is pursued for years by a determined officer. In the final scene he escapes and becomes the new don of the city.");
  check("an ending with the wrongdoer still standing is detected",
    unpunished?.markers.includes("ending-escape"), true);
  check("that is an outcome, not a presence claim",
    MARKERS.find((m) => m.id === "ending-escape")?.tier, "outcome");

  /*
   * The scoping that makes the outcome tier mean anything. A reckoning in the
   * second act is a plot event; only the resolution is an outcome. Without
   * this, a film that kills a henchman halfway and lets the real villain win
   * counts as a film where crime was punished.
   */
  const midFilmDeath = mk("A plot summary in which the henchman is shot dead early on by the police during a raid on the warehouse. The investigation then stalls for years and nothing more is done. The case is quietly closed and the family moves away.");
  check("a reckoning in the second act is not an ending in a reckoning",
    midFilmDeath?.markers.includes("ending-reckoning"), false);

  const endsInArrest = mk("A plot summary in which a man builds a business over many years and is admired in his town for it. Rivals come and go and the business grows. In the closing scene he is arrested and sentenced for what he did.");
  check("a reckoning in the closing lines is one",
    endsInArrest?.markers.includes("ending-reckoning"), true);
}

console.log("\nThe length confound is measurable, which is the point");
{
  const short = measure("S", 2000, "== Plot ==\nA short plot summary of the kind Wikipedia carried in the nineteen-nineties: he seeks revenge for the killing of his father, and by the close of the film he finds it.");
  const long = measure("L", 2020, `== Plot ==\nA long plot summary of the kind Wikipedia carries now: he seeks revenge for his father. ${"The story continues at length with much incident and many characters. ".repeat(20)}`);
  check("both trip the same marker",
    [short?.markers.includes("revenge"), long?.markers.includes("revenge")], [true, true]);
  /*
   * And the longer one is recorded as longer. This is the number every rate on
   * the page is divided by: without it, a marker found in a 600-word summary
   * and one found in an 80-word summary count the same, and the period's
   * growth in summary length becomes a growth in cinema's violence.
   */
  check("plot length is recorded", (long?.plotWords ?? 0) > (short?.plotWords ?? 0) * 5, true);

  /* Too short to measure at all is dropped rather than counted as clean. */
  check("a stub plot is not a film with no markers", measure("X", 2000, "== Plot ==\nHe wins."), null);
}

console.log("\nThe ending is where an outcome lives");
{
  const five = "One. Two. Three. Four. Five.";
  /* A quarter of the sentences, floored at two: a three-sentence summary has
     no measurable ending otherwise. */
  check("a short summary still has an ending", endingOf("One. Two. Three."), "Two. Three.");
  check("a quarter is taken from a longer one", endingOf(five), "Four. Five.");
  /* And capped, because in a forty-sentence summary a quarter is still most of
     the third act — which is the mid-film material this scoping excludes. */
  const forty = Array.from({ length: 40 }, (_, i) => `S${i}.`).join(" ");
  check("the ending is capped at six sentences", endingOf(forty).split(/\s+/).length, 6);
  check("an empty plot has an empty ending", endingOf(""), "");
}

console.log("\nTitle words are titles, not plots");
{
  check("a crime word in the title is caught", TITLE_WORDS.test("Don 2"), true);
  check("an ordinary title is not", TITLE_WORDS.test("Dilwale Dulhania Le Jayenge"), false);
}

console.log(failures === 0 ? "\nAll Bollywood tests passed." : `\n${failures} Bollywood test(s) failed.`);
if (failures > 0) process.exit(1);
