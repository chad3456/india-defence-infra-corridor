/**
 * The measurement's own traps, pinned.
 *
 * The finding this piece is built to avoid producing is a rising line that is
 * really a fact about Wikipedia. Everything below guards one step of that.
 */
import { filmsFromList, plotOf, genresOf, measure, MARKERS, TITLE_WORDS } from "./etl/connectors/bollywood";

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
  check("punishment is an outcome",
    MARKERS.find((m) => m.id === "villain-punished")?.tier, "outcome");

  /* Every marker publishes a note saying what it does not establish. */
  check("every marker carries a caveat", MARKERS.every((m) => m.note.length > 20), true);
  check("marker ids are unique", new Set(MARKERS.map((m) => m.id)).size, MARKERS.length);

  const plain = mk("A plot summary of reasonable length about two friends who open a restaurant together in a small town, work hard through a difficult first year, and find that it goes well for everyone in the end.");
  check("an ordinary plot trips nothing", plain?.markers, []);

  const unpunished = mk("A plot summary of reasonable length in which a young man joins a crew of thieves, rises through it over several years, and in the final scene the gangster escapes justice and becomes the new don of the city.");
  check("an unpunished criminal is detected", unpunished?.markers.includes("criminal-unpunished"), true);
  check("that is an outcome, not a presence claim",
    MARKERS.find((m) => m.id === "criminal-unpunished")?.tier, "outcome");
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

console.log("\nTitle words are titles, not plots");
{
  check("a crime word in the title is caught", TITLE_WORDS.test("Don 2"), true);
  check("an ordinary title is not", TITLE_WORDS.test("Dilwale Dulhania Le Jayenge"), false);
}

console.log(failures === 0 ? "\nAll Bollywood tests passed." : `\n${failures} Bollywood test(s) failed.`);
if (failures > 0) process.exit(1);
