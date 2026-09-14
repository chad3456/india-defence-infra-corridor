/**
 * Which welfare schemes publish their own coverage, and at what grain?
 *
 *   npm run welfare:probe
 *
 * The ask is a hundred schemes and how far each has reached into India's
 * villages. The number of schemes is the easy half — the government's own
 * myScheme portal lists well over a thousand — and the coverage is the hard
 * half, because "penetration" means something different for every scheme and
 * most of them publish nothing at village grain.
 *
 * ── Four grains, which must never be mixed ───────────────────────────────
 *
 * A scheme's own dashboard reports at whichever level its delivery happens:
 *
 *   Household. Jal Jeevan Mission reports tap connections per household, and
 *   PMAY-G houses sanctioned and completed. This is the strongest grain and
 *   the only one where "penetration" has an unambiguous denominator.
 *
 *   Village or habitation. Mission Antyodaya surveys villages directly and
 *   Saubhagya reported electrification by village. A percentage here is of
 *   villages, not of people, and the two diverge sharply because villages
 *   differ in size by orders of magnitude.
 *
 *   Beneficiary count. PM-KISAN and Ujjwala publish how many people received
 *   something, with no denominator at all. A count is not a penetration rate
 *   and becomes one only if someone supplies the eligible population — which
 *   is exactly the step where a tracker invents a number.
 *
 *   District or state aggregate. MGNREGA and most others. Useful, and not a
 *   village-level claim however it is worded.
 *
 * A tracker that puts all four in one column and calls it coverage would be
 * wrong about most rows while looking consistent. So this probe records which
 * grain each source publishes at, and the eventual dataset keeps them apart.
 *
 * ── What this file will not publish ──────────────────────────────────────
 *
 * No coverage figure, no beneficiary count, no spend. Only whether a source
 * answers, in what shape, at what grain, and how many rows it carries.
 */
import { join } from "node:path";
import { runProbe, type Target } from "./lib/probe-run";
import { isEntryPoint } from "./lib/entry";

const OUT = join(process.cwd(), "data", "live", "welfare-probe.json");
const WIKI = "https://en.wikipedia.org/w/api.php";

const TARGETS: Target[] = [
  // ── The roster: how many schemes are there, and who says so ───────────
  {
    id: "myscheme-api", kind: "roster",
    what: "myScheme, the government's own scheme search API",
    url: "https://api.myscheme.gov.in/search/v4/schemes?lang=en&q=%5B%5D&keyword=&sort=&from=0&size=100",
    count: { entries: /"schemeShortTitle"|"schemeName"/g },
    // Page two must not be page one. A paginated API that ignores `from` would
    // give a roster of a hundred repeated as often as you asked for it.
    paired: "https://api.myscheme.gov.in/search/v4/schemes?lang=en&q=%5B%5D&keyword=&sort=&from=100&size=100",
    settles:
      "The roster itself: names, ministries, eligibility and tags for every central and state " +
      "scheme the government publishes. If this answers, the hundred schemes are a query.",
  },
  {
    id: "myscheme-web", kind: "roster",
    what: "myScheme portal",
    url: "https://www.myscheme.gov.in/search",
    look: ["scheme"],
    settles: "Where the API lives, if its path has moved.",
  },
  {
    id: "ogd-catalog", kind: "roster",
    what: "data.gov.in catalogue search",
    url: "https://www.data.gov.in/catalogs",
    look: ["catalog"],
    settles: "Whether the open-data portal is browsable without the API key this project lacks.",
  },
  {
    id: "ogd-api", kind: "roster",
    what: "data.gov.in resource API, unauthenticated",
    url: "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?format=json&limit=5",
    settles:
      "What an unauthenticated call returns. The key has been asked for and not yet supplied, " +
      "so the answer decides whether this route is open at all.",
  },

  // ── Household grain: the strongest ────────────────────────────────────
  {
    id: "jjm-india", kind: "household",
    what: "Jal Jeevan Mission, national dashboard",
    url: "https://ejalshakti.gov.in/jjmreport/JJMIndia.aspx",
    look: ["household", "tap"],
    count: { tableRows: /<tr/gi },
    settles:
      "Tap connections per rural household by state and district — the clearest household-grain " +
      "coverage series any Indian scheme publishes.",
  },
  {
    id: "jjm-state", kind: "household",
    what: "Jal Jeevan Mission, one state",
    url: "https://ejalshakti.gov.in/jjmreport/JJMState.aspx?Rep=0&RP=Y&APP=NRDWP",
    count: { tableRows: /<tr/gi },
    settles: "Whether the district drill-down is addressable by GET.",
  },
  {
    id: "pmayg-dash", kind: "household",
    what: "PMAY-Gramin, physical progress",
    url: "https://pmayg.nic.in/netiayHome/PBI/PBIReport.aspx",
    look: ["houses", "progress"],
    count: { tableRows: /<tr/gi },
    settles: "Rural houses sanctioned and completed by state — household grain, dated.",
  },
  {
    id: "pmayg-home", kind: "household",
    what: "PMAY-Gramin portal",
    url: "https://pmayg.nic.in/netiay/home.aspx",
    look: ["awaas"],
    settles: "Navigation, if the report path has moved.",
  },

  // ── Village grain: the one the ask actually names ─────────────────────
  {
    id: "mission-antyodaya", kind: "village",
    what: "Mission Antyodaya, village survey",
    url: "https://missionantyodaya.nic.in/",
    look: ["village", "gram panchayat"],
    settles:
      "The only national survey that measures villages directly — infrastructure and service " +
      "availability per village. If it is readable, 'penetration in villages' has a real source.",
  },
  {
    id: "antyodaya-report", kind: "village",
    what: "Mission Antyodaya, report endpoint",
    url: "https://missionantyodaya.nic.in/ma2020/reports/reportlist.html",
    look: ["report"],
    settles: "Whether the survey's own tables are addressable.",
  },
  {
    id: "saubhagya", kind: "village",
    what: "Saubhagya, household electrification",
    url: "https://saubhagya.gov.in/",
    look: ["electrification"],
    settles: "Village and household electrification, which the scheme declared complete in 2019.",
  },
  {
    id: "sbm-gramin", kind: "village",
    what: "Swachh Bharat Mission Gramin",
    url: "https://sbm.gov.in/sbmdashboard/",
    look: ["swachh"],
    settles: "ODF status by village, which is a village-grain claim by construction.",
  },
  {
    id: "lgd-directory", kind: "village",
    what: "Local Government Directory",
    url: "https://lgdirectory.gov.in/",
    look: ["panchayat", "village"],
    settles:
      "The denominator. Any village-grain percentage needs a count of villages per state, and " +
      "this is the register the government uses for it.",
  },

  // ── Beneficiary counts, which are not coverage ────────────────────────
  {
    id: "pmkisan", kind: "beneficiary",
    what: "PM-KISAN dashboard",
    url: "https://pmkisan.gov.in/Dashboard.aspx",
    look: ["beneficiar"],
    count: { tableRows: /<tr/gi },
    settles: "Beneficiaries paid by state — a count with no denominator, and it must stay one.",
  },
  {
    id: "ujjwala", kind: "beneficiary",
    what: "PM Ujjwala Yojana",
    url: "https://www.pmuy.gov.in/",
    look: ["connection"],
    settles: "LPG connections released, likewise a count rather than a rate.",
  },
  {
    id: "nrega-report", kind: "beneficiary",
    what: "MGNREGA, public reports",
    url: "https://nreganarep.nic.in/netnrega/dynamic_work_details.aspx",
    look: ["nrega"],
    settles: "Person-days and households employed, by state and district.",
  },
  {
    id: "jan-dhan", kind: "beneficiary",
    what: "PM Jan Dhan Yojana progress",
    url: "https://pmjdy.gov.in/statewise-at-a-glance",
    look: ["accounts"],
    count: { tableRows: /<tr/gi },
    settles: "Already ingested for one date; this checks whether the series can be extended.",
  },

  // ── An index of what exists ───────────────────────────────────────────
  {
    id: "wiki-schemes", kind: "wiki",
    what: "Wikipedia: list of Indian government schemes",
    url: `${WIKI}?action=parse&page=${encodeURIComponent("List_of_schemes_of_the_government_of_India")}&redirects=1&prop=wikitext&formatversion=2&format=json`,
    decode: "parse.wikitext",
    count: { tableRows: /^\s*\|-/gm, links: /\[\[/g },
    settles: "A fallback roster if myScheme refuses, and a cross-check on it if it does not.",
  },
];

export async function run(): Promise<void> {
  await runProbe(TARGETS, OUT, {
    question:
      "Which welfare schemes publish their own coverage, and at what grain — household, " +
      "village, bare beneficiary count, or district aggregate?",
    refusal:
      "No coverage figure, beneficiary count or spend is recorded here. Only whether a source " +
      "answers, in what shape, and how many rows it carries.",
    fourGrains:
      "Household, village, beneficiary count and district aggregate are four different things. " +
      "A beneficiary count has no denominator and is not a penetration rate; supplying one is " +
      "exactly the step where a tracker invents a number. A village percentage is of villages " +
      "and not of people, and the two diverge sharply because villages differ in size by orders " +
      "of magnitude. The eventual dataset keeps them in separate columns.",
    denominator:
      "Any village-grain percentage needs a count of villages per state. The Local Government " +
      "Directory is the register the government itself uses, and it is probed here for that " +
      "reason rather than for its own sake.",
  });
}

if (isEntryPoint(import.meta.url)) {
  run().catch((err) => { console.error(err); process.exit(1); });
}
