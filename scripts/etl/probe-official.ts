/**
 * Can the SC/ST Act and PM SHRI be reported from official numbers?
 *
 * Probe round two settled the evidence: Indian Kanoon supplies judgments, five
 * newsrooms supply coverage. Neither supplies a national count. How many cases
 * were registered under the Act, how many were chargesheeted, how many ended in
 * conviction and how many are pending — those come from NCRB's Crime in India
 * and from nowhere else. How many PM SHRI schools were sanctioned, to which
 * states, and how much money was released — those come from PIB releases and
 * from Parliament answers.
 *
 * Round two found NCRB serving a wall of PDFs, PM SHRI's own portal serving a
 * 1.2 KB JavaScript shell with no counts in it, and sansad.in serving a listing
 * page with twenty-four links. All three are "reachable" and none of them
 * answered the question. This round asks the narrower question that matters:
 * whether a specific document with a specific table can be fetched and read.
 *
 * ── The trap this round is built around ──────────────────────────────────
 *
 * A government portal that is reachable is not a source. `pmshrischools.
 * education.gov.in` returns 200 and contains the words "PM SHRI" and "school";
 * a probe looking for those words would have called it a hit. It is a shell
 * that renders its numbers in the browser, so a script reading it gets nothing
 * and a careless script reading it gets three incidental numbers that mean
 * nothing at all. Every target here therefore names the FIGURE it is after, and
 * a target that answers 200 without carrying that figure is recorded as a
 * failure to answer, not as a reachable host.
 *
 * ── What this file publishes ─────────────────────────────────────────────
 *
 * Whether a document answered, its shape, and how many times a named pattern
 * appeared in it. No case count, no conviction rate, no school count and no
 * claim about either subject. Counting the string "conviction" in a PDF is a
 * fact about the PDF.
 */
import { runProbe, type Target } from "./lib/probe-run";

/** NCRB: the national crime series, and the only source for the Act's own numbers. */
const NCRB: Target[] = [
  {
    id: "ncrb:index", kind: "ncrb",
    what: "NCRB Crime in India — the index of published years",
    url: "https://www.ncrb.gov.in/crime-in-india.html",
    settles: "Which years are published, and whether a year's page links a table file or only a PDF",
    look: ["Crime in India"],
    count: { pdfs: /\.pdf/gi, xlsx: /\.xlsx?\b/gi, csv: /\.csv\b/gi, yearLinks: /20\d\d/g },
  },
  {
    id: "ncrb:table-page", kind: "ncrb",
    what: "NCRB Crime in India — the year page that lists individual tables",
    url: "https://www.ncrb.gov.in/crime-in-india-table-addtional.html",
    settles: "Whether NCRB publishes per-table downloads, which would put the SC/ST table within reach without parsing a 600-page PDF",
    look: ["Table"],
    count: { pdfs: /\.pdf/gi, xlsx: /\.xlsx?\b/gi, csv: /\.csv\b/gi, links: /<a\s/gi },
    gapMs: 2500,
  },
  {
    id: "ncrb:year-2022", kind: "ncrb",
    what: "NCRB Crime in India 2022 — the year's own page",
    url: "https://www.ncrb.gov.in/crime-in-india-year-wise.html?year=2022",
    paired: "https://www.ncrb.gov.in/crime-in-india-year-wise.html?year=2018",
    settles: "Whether a year parameter is honoured, which decides whether the series can be walked year by year or must be hand-listed",
    look: ["Crime in India"],
    count: { pdfs: /\.pdf/gi, links: /<a\s/gi },
    gapMs: 2500,
  },
];

/**
 * The Ministry of Social Justice lays a report on the Act before Parliament
 * every year under section 21(4) of the statute. It carries exactly the
 * registration, chargesheet, conviction and pendency figures the Act is argued
 * about, from the government's own hand, with the caveats the government
 * itself attaches. If it is reachable it is a better source than NCRB, because
 * it is about this Act rather than about crime generally.
 */
const MSJE: Target[] = [
  {
    id: "msje:annual", kind: "msje",
    what: "Ministry of Social Justice — annual report page",
    url: "https://socialjustice.gov.in/common/76750",
    settles: "Whether the ministry's annual report, which carries the section 21(4) figures, is fetchable",
    look: ["Annual Report"],
    count: { pdfs: /\.pdf/gi, links: /<a\s/gi, years: /20\d\d/g },
  },
  {
    id: "msje:home", kind: "msje",
    what: "Ministry of Social Justice — documents index",
    url: "https://socialjustice.gov.in/",
    settles: "Whether the ministry site answers a script at all, and what document paths it uses",
    look: ["Social Justice"],
    count: { pdfs: /\.pdf/gi, links: /<a\s/gi },
    gapMs: 2500,
  },
];

/**
 * PIB is the government's own press wire. Round two read one release fine, so
 * the release DETAIL page is readable; what was never settled is whether PIB
 * can be SEARCHED, which is the difference between quoting one release somebody
 * already found and collecting the scheme's announcements over four years.
 *
 * The paired URL is the important part. PIB's archive has a documented habit of
 * accepting a parameter and ignoring it, returning the same page for every
 * value — which reads as a working search right up until the data is wrong.
 */
const PIB: Target[] = [
  {
    id: "pib:release-known", kind: "pib",
    what: "PIB — the PM SHRI launch release, read directly",
    url: "https://pib.gov.in/PressReleasePage.aspx?PRID=1855825",
    settles: "Whether a release page carries its own text, so official claims can be quoted as claims with a date and a release id",
    look: ["PM SHRI", "school"],
    count: { paras: /<p[\s>]/gi, numbers: /\b\d[\d,]{2,}\b/g, dates: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+20\d\d/gi },
  },
  {
    id: "pib:ministry-list", kind: "pib",
    what: "PIB — releases filtered to the Ministry of Education",
    url: "https://pib.gov.in/allRel.aspx",
    paired: "https://pib.gov.in/indexd.aspx",
    settles: "Whether PIB's release listing can be walked, which decides whether the scheme's announcements can be collected or only quoted one at a time",
    look: ["Release"],
    count: { links: /<a\s/gi, prids: /PRID=\d+/gi },
    gapMs: 3000,
  },
];

/**
 * Parliament answers are the densest source of scheme figures that exist: a
 * minister tabling a state-wise school count on a dated day, on the record,
 * answerable for it. Round two reached the listing page and found twenty-four
 * links, which is a menu and not an archive. This asks whether the search
 * behind that menu answers a script.
 */
const SANSAD: Target[] = [
  {
    id: "sansad:ls-api", kind: "sansad",
    what: "Lok Sabha question search — the JSON the page calls",
    url: "https://sansad.in/api_ls/question/questionsearch?loksabha=18&session=&qtype=&ministry=&member=&subject=PM%20SHRI",
    settles: "Whether the question archive is queryable as data, which would put dated state-wise figures within reach",
    look: ["question"],
    count: { records: /"quesNo"|"questionNo"|"subject"/gi },
  },
  {
    id: "sansad:rs", kind: "sansad",
    what: "Rajya Sabha question archive",
    url: "https://sansad.in/rs/questions/questions-and-answers",
    settles: "Whether the upper house archive uses the same shape as the lower, so one reader serves both",
    look: ["question"],
    count: { links: /<a\s/gi, pdfs: /\.pdf/gi },
    gapMs: 2500,
  },
  {
    id: "eduministry:dashboard", kind: "pmshri",
    what: "Ministry of Education — the PM SHRI scheme page",
    url: "https://www.education.gov.in/pm-shri",
    settles: "Whether the ministry publishes the school count itself, which would be the primary figure rather than a press restatement",
    look: ["PM SHRI"],
    count: { numbers: /\b\d[\d,]{2,}\b/g, pdfs: /\.pdf/gi, states: /\b(?:Tamil Nadu|Kerala|West Bengal|Delhi|Punjab)\b/gi },
    gapMs: 2500,
  },
  {
    id: "pmshri:portal-api", kind: "pmshri",
    what: "The PM SHRI portal's own data call",
    url: "https://pmshrischools.education.gov.in/api/v1/dashboard",
    settles: "Whether the shell page's numbers come from a call a script can make too — the portal renders in the browser, so the HTML carries nothing",
    look: ["school"],
    count: { numbers: /\b\d[\d,]{2,}\b/g },
    gapMs: 2500,
  },
];

void runProbe(
  [...NCRB, ...MSJE, ...PIB, ...SANSAD],
  "data/live/official-probe.json",
  {
    question:
      "Can the SC/ST (Prevention of Atrocities) Act and the PM SHRI scheme be reported from "
      + "official numbers — registrations, chargesheets, convictions, pendency, sanctioned "
      + "schools, funds released — or only from judgments and press coverage?",
    refusal:
      "This file publishes whether a document answered, its shape, and how many times a named "
      + "pattern appeared in it. It publishes no case count, no conviction rate, no school count "
      + "and no claim about either subject. Counting the string 'conviction' in a PDF is a fact "
      + "about the PDF.",
    note:
      "A reachable government portal is not a source. The scheme's own portal returns 200 and "
      + "contains the words 'PM SHRI' and 'school' while carrying no counts at all, because it "
      + "renders them in the browser. Every target here names the figure it is after, so a 200 "
      + "without that figure is recorded as a failure to answer rather than as a working source.",
  },
);
