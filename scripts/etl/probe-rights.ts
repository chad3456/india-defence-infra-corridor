/**
 * Can the SC/ST Atrocities Act and PM SHRI be reported on from the record?
 *
 *   npm run rights:probe
 *
 * ── Two subjects, one question ───────────────────────────────────────────
 *
 * Both are asked about in the same loaded way — "use and misuse" — and for
 * both, the honest answer depends entirely on whether a published series
 * exists or whether the numbers would have to come from me. So the probe asks
 * what each source actually returns before a line of either page is written.
 *
 * ── The SC/ST Act, and why "misuse" cannot be a metric ───────────────────
 *
 * The Scheduled Castes and Scheduled Tribes (Prevention of Atrocities) Act,
 * 1989 is one of the most contested statutes in India, and the contest runs
 * through a specific number: the acquittal rate. It is routinely offered as
 * proof that the Act is misused. It is not proof of that, and treating it as
 * though it were is the single most likely way for a page on this subject to
 * be confidently wrong.
 *
 * An acquittal under this Act can follow from a false complaint. It can also
 * follow from a hostile witness, from intimidation of the complainant, from an
 * investigation that never gathered the caste-certificate evidence the statute
 * requires, or from a compromise reached outside court. India's own official
 * record — NCRB's Crime in India, the Standing Committee reports, and the
 * Supreme Court's own judgments — discusses all of these. No public dataset
 * separates them.
 *
 * So the probe looks for what CAN be counted: cases registered, chargesheeting
 * rate, conviction rate, pendency, by state and by year, from NCRB. And it
 * looks for the record of the dispute itself — the 2018 judgment that diluted
 * the Act, the amendment that reversed it, the 2019 ruling that upheld the
 * amendment — because those are documented events with dates, and the argument
 * is reportable even where the underlying claim is not resolvable.
 *
 * ── PM SHRI, where the dispute is about money and consent ────────────────
 *
 * PM SHRI is a centrally sponsored scheme to upgrade schools, and several
 * states refused to sign its memorandum of understanding — with the central
 * government reported to have withheld separate education funds over that
 * refusal. That is a documented, datable dispute rather than a matter of
 * opinion, and it is the part of this subject that has a record.
 *
 * "Real testimonies" were asked for. Testimony cannot be generated; it can
 * only be quoted from someone who published it. The probe therefore asks
 * whether the reporting is reachable at all, so that anything quoted later
 * carries the outlet and the date that carried it.
 *
 * ── What this probe publishes ────────────────────────────────────────────
 *
 * Whether a source answered, in what shape, roughly how many rows it carries,
 * and whether its parameters do anything. No case count, no conviction rate,
 * no claim about either subject.
 */
import { join } from "node:path";
import { runProbe, type Target } from "./lib/probe-run";
import { isEntryPoint } from "./lib/entry";

const OUT = join(process.cwd(), "data", "live", "rights-probe.json");
const WIKI = "https://en.wikipedia.org/w/api.php";

const wikiPage = (page: string, kind: string, settles: string, look: string[] = []): Target => ({
  id: `wiki:${page}`,
  kind,
  what: page.replace(/_/g, " "),
  url: `${WIKI}?action=parse&format=json&prop=wikitext&page=${encodeURIComponent(page)}&redirects=1`,
  decode: "parse.wikitext.*",
  look,
  count: {
    refs: /<ref[\s>]/g,
    citeNews: /\{\{\s*cite (news|web|press release)/gi,
    tables: /\{\|\s*class=/g,
    tableRows: /^\|-/gm,
    sections: /^==[^=]/gm,
    years: /\b(19|20)\d{2}\b/g,
  },
  settles,
});

const feed = (id: string, outlet: string, url: string, kind = "press"): Target => ({
  id: `feed:${id}`,
  kind,
  what: `${outlet} — RSS`,
  url,
  look: ["<item", "<title"],
  count: { items: /<item[\s>]/g },
  settles: `Whether ${outlet} answers a script, so its reporting can be collected with attribution`,
});

const TARGETS: Target[] = [
  /* ── The statute, and the record of the argument about it ──────────── */
  wikiPage(
    "Scheduled_Castes_and_Scheduled_Tribes_(Prevention_of_Atrocities)_Act,_1989",
    "scst",
    "Whether the Act has a cited article carrying its amendment history and the litigation over it",
    ["1989", "amendment", "Supreme Court", "atrocities"],
  ),
  wikiPage(
    "Subhash_Kashinath_Mahajan_v._State_of_Maharashtra",
    "scst",
    "Whether the 2018 judgment that diluted the Act is documented separately, with dates",
    ["2018", "Supreme Court", "arrest"],
  ),
  wikiPage(
    "Caste-related_violence_in_India",
    "scst",
    "Whether the wider record carries incident-level material with citations",
    ["Dalit", "violence", "police"],
  ),
  {
    id: "ncrb:site",
    kind: "scst",
    what: "NCRB — the agency that publishes Crime in India, the only national series here",
    url: "https://www.ncrb.gov.in/crime-in-india.html",
    look: ["Crime in India", "pdf"],
    count: { links: /href=/g, pdfs: /\.pdf/gi, years: /\b20\d{2}\b/g },
    settles: "Whether the official crime series is reachable, and in what form — a table, or a wall of PDFs",
  },
  {
    id: "datagov:ncrb",
    kind: "scst",
    what: "data.gov.in catalogue search for NCRB atrocities datasets",
    url: "https://api.data.gov.in/catalog?format=json&filters%5Btitle%5D=atrocities&api-key=579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b",
    look: ["records", "title"],
    count: { records: /"title"\s*:/g },
    settles: "Whether India's open-data portal carries the series as data rather than as a PDF, using its published demo key",
  },
  {
    id: "indiankanoon:search",
    kind: "scst",
    what: "Indian Kanoon — free-text search over Indian judgments",
    url: "https://indiankanoon.org/search/?formInput=scheduled%20castes%20prevention%20of%20atrocities%20act",
    // The paired request asks for something unrelated. Identical answers would
    // mean the query does nothing — the trap PIB's archive set.
    paired: "https://indiankanoon.org/search/?formInput=marine%20insurance%20contract",
    look: ["result", "docsource"],
    count: { results: /class="result_title"/g, links: /href="\/doc/g },
    settles: "Whether the judgment corpus is searchable without a key, which would put the litigation record within reach",
  },

  /* ── PM SHRI ───────────────────────────────────────────────────────── */
  wikiPage(
    "PM_SHRI_Schools",
    "pmshri",
    "Whether the scheme has a cited article carrying its rollout and the states' refusals",
    ["PM SHRI", "memorandum", "schools"],
  ),
  {
    id: "pmshri:portal",
    kind: "pmshri",
    what: "The scheme's own portal",
    url: "https://pmshrischools.education.gov.in/",
    look: ["PM SHRI", "school"],
    count: { links: /href=/g, numbers: /\b\d{3,6}\b/g },
    settles: "Whether the scheme publishes its own school counts, which would be the primary figure",
  },
  {
    id: "pib:search-pmshri",
    kind: "pmshri",
    what: "PIB press release search for the scheme",
    url: "https://www.pib.gov.in/PressReleseDetail.aspx?PRID=1855825",
    look: ["PM SHRI", "Ministry"],
    count: { paras: /<p[\s>]/g, numbers: /\b\d{3,6}\b/g },
    settles: "Whether the government's own releases are readable, so official claims can be quoted as claims",
  },
  {
    id: "sansad:questions",
    kind: "pmshri",
    what: "Parliament question archive — where schemes are answered on the record",
    url: "https://sansad.in/ls/questions/questions-and-answers",
    look: ["question", "answer"],
    count: { links: /href=/g },
    settles: "Whether Parliament Q&A is reachable, which is the densest source of scheme figures with dates",
  },

  /* ── The press, for both subjects ──────────────────────────────────── */
  ...[
    ["thehindu-national", "The Hindu — National", "https://www.thehindu.com/news/national/feeder/default.rss"],
    ["indianexpress-india", "The Indian Express — India", "https://indianexpress.com/section/india/feed/"],
    ["indianexpress-edu", "The Indian Express — Education", "https://indianexpress.com/section/education/feed/"],
    ["scroll", "Scroll.in", "https://scroll.in/feed"],
    ["thewire", "The Wire", "https://thewire.in/rss"],
    ["downtoearth", "Down To Earth", "https://www.downtoearth.org.in/rss"],
    ["hindustantimes", "Hindustan Times — India", "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml"],
    ["newindianexpress", "The New Indian Express", "https://www.newindianexpress.com/Nation/rssfeed/?id=170&getXmlFeed=true"],
    ["deccanherald", "Deccan Herald — National", "https://www.deccanherald.com/rss/national.rss"],
    ["telegraphindia", "The Telegraph India", "https://www.telegraphindia.com/feeds/rss.jsp?id=4"],
    ["thequint", "The Quint", "https://www.thequint.com/stories.rss"],
    ["newslaundry", "Newslaundry", "https://www.newslaundry.com/stories.rss"],
  ].map(([id, outlet, url]) => feed(id!, outlet!, url!)),
];

async function main(): Promise<void> {
  await runProbe(TARGETS, OUT, {
    question:
      "Is there a published record — official series, judgments, Parliament answers, press "
      + "reporting — from which the SC/ST (Prevention of Atrocities) Act and the PM SHRI scheme "
      + "can be reported, or would the numbers have to come from me?",
    refusal:
      "No case count, no conviction rate, no school count and no claim about either subject is "
      + "published here. Only whether a source answered, in what shape, roughly how many rows it "
      + "appears to carry, and whether its query parameters do anything.",
    note:
      "'Misuse' is the framing both subjects are usually argued about, and on the SC/ST Act it "
      + "runs through one number: the acquittal rate, routinely offered as proof the Act is "
      + "abused. It is not proof of that. An acquittal can follow from a false complaint; it can "
      + "equally follow from a hostile witness, intimidation of the complainant, an investigation "
      + "that never gathered the evidence the statute requires, or a compromise outside court — "
      + "all of which India's own official record discusses, and none of which any public dataset "
      + "separates. So this probe looks for what can be counted (registrations, chargesheeting, "
      + "convictions, pendency, by state and year) and for the documented history of the dispute "
      + "itself, which has dates and judgments. Anything built on it must present the argument as "
      + "an argument with named positions, and must not let the acquittal rate stand in as a "
      + "misuse metric.",
  });
}

if (isEntryPoint(import.meta.url)) {
  void main();
}
