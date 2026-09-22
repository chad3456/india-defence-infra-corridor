/**
 * Does PM SHRI have a readable primary source, anywhere?
 *
 * The citation harvest found three pieces on this scheme against five hundred
 * and seven on the SC/ST Act. That gap is not an artefact of the collector. PM
 * SHRI has no encyclopaedia article, the ministry's page for it is a
 * JavaScript shell, the scheme's own portal renders its counts in the browser,
 * and Parliament's question API answers 404. Everything "reachable" so far has
 * been reachable and empty.
 *
 * A page about a scheme cannot be built out of three citations. So before
 * building one, this asks the narrow question the last three rounds kept
 * missing: is there one document, anywhere, that states how many PM SHRI
 * schools were sanctioned, to which states, and how much money was released?
 *
 * ── Where such a document would be ───────────────────────────────────────
 *
 * PIB, because the government announces its own schemes. The ministry's annual
 * report, because schemes appear in them with tables. The scheme's own portal,
 * if its browser-side data call can be made by a script too. Parliament, where
 * a minister has to answer state-wise and on the record — sansad.in's API
 * answered 404, so this tries the paths the site itself uses.
 *
 * ── The trap this round is still built around ────────────────────────────
 *
 * A government portal that is reachable is not a source. The scheme's portal
 * returns 200 and contains the words "PM SHRI" and "school" while carrying no
 * counts at all. So every target names the figure it is after and a 200
 * without it is recorded as a failure to answer.
 *
 * Publishes no school count, no funding figure and no claim about the scheme.
 */
import { runProbe, type Target } from "./lib/probe-run";

/** Numbers a school count would look like, and the states the dispute is about. */
const COUNTS = {
  bigNumbers: /\b\d{3,5}\b/g,
  schools: /\bschools?\b/gi,
  states: /\b(?:Tamil Nadu|Kerala|West Bengal|Delhi|Punjab|Karnataka|Jharkhand)\b/gi,
  crore: /\bcrore\b/gi,
  pmshri: /PM[\s-]?SHRI/gi,
};

const TARGETS: Target[] = [
  /*
   * PIB. The release detail page read fine in an earlier round — eighteen
   * paragraphs, a hundred and twenty-one numbers — but the release asked for
   * did not mention the scheme, so the id was wrong rather than the path. PIB
   * serves the same release under two paths, and only one of them may carry
   * the body, so both are asked.
   */
  {
    id: "pib:page", kind: "pib",
    what: "PIB — a release under the PressReleasePage path",
    url: "https://pib.gov.in/PressReleasePage.aspx?PRID=1855825",
    settles: "Whether a release carries its own body text under this path, so official claims can be quoted with a date and an id",
    look: ["PM SHRI", "school"],
    count: COUNTS,
  },
  {
    id: "pib:detail", kind: "pib",
    what: "PIB — the same release under the PressReleseDetail path",
    url: "https://pib.gov.in/PressReleseDetail.aspx?PRID=1855825",
    settles: "Whether the two PIB paths differ in what they carry, which decides which one a connector should read",
    look: ["PM SHRI", "school"],
    count: COUNTS,
    gapMs: 3000,
  },
  {
    id: "pib:education-ministry", kind: "pib",
    what: "PIB — releases filtered to the Ministry of Education",
    url: "https://pib.gov.in/PressReleasePage.aspx?PRID=2004056",
    paired: "https://pib.gov.in/PressReleasePage.aspx?PRID=1855825",
    settles: "Whether the release id is honoured — two different ids must return two different bodies, or the archive cannot be walked",
    look: ["PM SHRI"],
    count: COUNTS,
    gapMs: 3000,
  },

  /*
   * The scheme's own portal renders in the browser, so the HTML carries
   * nothing. If the call its JavaScript makes can be made by a script, that
   * call is the primary figure. Three plausible paths, because the portal
   * publishes no API documentation and a 404 is a cheap, clear answer.
   */
  {
    id: "portal:stats", kind: "portal",
    what: "PM SHRI portal — a statistics call",
    url: "https://pmshrischools.education.gov.in/api/dashboard/stats",
    settles: "Whether the portal's browser-side counts can be read by a script, which would make them the primary figure",
    look: ["school"],
    count: COUNTS,
    gapMs: 2500,
  },
  {
    id: "portal:statewise", kind: "portal",
    what: "PM SHRI portal — a state-wise call",
    url: "https://pmshrischools.education.gov.in/api/school/statewise",
    settles: "Whether the portal serves the state-wise distribution, which is where the whole dispute lives",
    look: ["state"],
    count: COUNTS,
    gapMs: 2500,
  },
  {
    id: "portal:root", kind: "portal",
    what: "PM SHRI portal — the shell itself, read again for a data island",
    url: "https://pmshrischools.education.gov.in/",
    settles: "Whether the shell embeds its counts in the page as JSON, which some government SPAs do",
    look: ["PM SHRI"],
    count: { ...COUNTS, json: /__NEXT_DATA__|window\.__|application\/json/gi },
    gapMs: 2500,
  },

  /*
   * Parliament. A minister answering state-wise, on a dated day, answerable
   * for it, is the best source that could exist for this scheme. The JSON API
   * answered 404 last round, so these are the paths the site's own pages use.
   */
  {
    id: "sansad:search", kind: "sansad",
    what: "Lok Sabha questions — the search the site's own page calls",
    url: "https://sansad.in/api/ls/question/questionsearch?subject=PM%20SHRI",
    settles: "Whether the question archive answers a script under any path, which would put dated state-wise figures within reach",
    look: ["question"],
    count: { records: /"quesNo"|"questionNo"|"subject"|"ministry"/gi },
    gapMs: 2500,
  },
  {
    id: "sansad:loksabha-page", kind: "sansad",
    what: "Lok Sabha questions — the human-readable archive",
    url: "https://sansad.in/ls/questions/questions-and-answers",
    paired: "https://sansad.in/ls/questions/questions-and-answers?page=2",
    settles: "Whether the archive pages at all, which decides whether it can be walked or only opened",
    look: ["question"],
    count: { links: /<a\s/gi, pdfs: /\.pdf/gi },
    gapMs: 2500,
  },

  /*
   * The ministry's annual report. Schemes appear in these with tables, and
   * unlike a portal it is a document rather than an application.
   */
  {
    id: "moe:annual", kind: "ministry",
    what: "Ministry of Education — the annual report listing",
    url: "https://www.education.gov.in/documents_reports",
    settles: "Whether the ministry publishes a report carrying the scheme's own numbers, as a document rather than an application",
    look: ["report"],
    count: { pdfs: /\.pdf/gi, links: /<a\s/gi, years: /20\d\d/g },
    gapMs: 2500,
  },
  {
    id: "moe:schemes", kind: "ministry",
    what: "Ministry of Education — the schemes listing",
    url: "https://www.education.gov.in/schemes",
    settles: "Whether the ministry lists the scheme with figures beside it",
    look: ["scheme"],
    count: COUNTS,
    gapMs: 2500,
  },

  /*
   * And the press, searched rather than subscribed to. The five feeds that
   * answer carry about a day of a general desk each; a site search would reach
   * the archive if it answers a script at all.
   */
  {
    id: "press:thehindu-search", kind: "press",
    what: "The Hindu — site search for the scheme",
    url: "https://www.thehindu.com/search/?q=PM%20SHRI",
    settles: "Whether a newsroom archive can be searched by a script, which is the only route to coverage older than a feed",
    look: ["PM SHRI"],
    count: { articles: /href="https:\/\/www\.thehindu\.com\/[a-z]/gi },
    gapMs: 3000,
  },
];

void runProbe(TARGETS, "data/live/pmshri-probe.json", {
  question:
    "Is there one document, anywhere, that a script can read, stating how many PM SHRI schools "
    + "were sanctioned, to which states, and how much money was released?",
  refusal:
    "This file publishes whether a document answered, its shape, and how many times a named "
    + "pattern appeared in it. It publishes no school count, no funding figure and no claim "
    + "about the scheme.",
  note:
    "The citation harvest found three pieces on this scheme against five hundred and seven on "
    + "the SC/ST Act. That gap is not an artefact of the collector: the scheme has no "
    + "encyclopaedia article, the ministry's page for it is a JavaScript shell, the portal "
    + "renders its counts in the browser, and Parliament's question API answers 404. Everything "
    + "reachable so far has been reachable and empty, which is why every target here names the "
    + "figure it is after.",
});
