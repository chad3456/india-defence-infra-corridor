/**
 * Can a story engine find military and AI-military reporting on its own, and
 * is Operation Sindoor reconstructable from sources that cite themselves?
 *
 *   npm run warstories:probe
 *
 * ── Why one probe for two things ─────────────────────────────────────────
 *
 * Both are the same question in different clothes: is there a published index
 * a script can walk, or would the thing have to be typed out by me? A timeline
 * I write from memory and a hundred stories I compose are the same failure —
 * confident prose with no source behind it — and this repository's whole
 * discipline exists to make that failure impossible rather than unlikely.
 *
 * ── The Operation Sindoor problem, stated plainly ────────────────────────
 *
 * It is a recent, contested military operation between two nuclear states.
 * India and Pakistan published incompatible accounts of it — of what was
 * struck, of what was lost, of who stopped first — and both governments are
 * interested parties. Casualty and aircraft-loss figures in particular are
 * claims by belligerents, not measurements.
 *
 * So the probe does not ask "what happened". It asks whether there is a
 * source that carries dated events WITH per-event citations, because a
 * timeline where each entry names who said it and when is a timeline a reader
 * can audit. One that merges both sides into a single authoritative sequence
 * would be this project inventing an account, which is exactly what it must
 * not do.
 *
 * ── The story engine problem ─────────────────────────────────────────────
 *
 * The arsenal connector already runs a seven-publisher news agent, and it
 * keeps a handful of items per run — fine for procurement, far short of the
 * hundred-plus AI-military stories wanted here. The existing AI register
 * matches 55 incidents out of AIAAIC's 2,260 rows, and AIAAIC is one
 * volunteer spreadsheet.
 *
 * GDELT is the candidate that would change the scale: a free, keyless index
 * of global news with a query API. If it answers, a story engine is a query
 * loop over a published index rather than a list of outlets someone chose.
 * The probe asks whether it answers, whether its query parameter does
 * anything, and how many articles a military-AI query actually returns.
 *
 * ── What this probe publishes ────────────────────────────────────────────
 *
 * Whether a source answered, in what shape, roughly how many rows it carries,
 * and whether its parameters do anything. No headline, no casualty figure, no
 * claim about what happened in May 2025.
 */
import { join } from "node:path";
import { runProbe, type Target } from "./lib/probe-run";
import { isEntryPoint } from "./lib/entry";

const OUT = join(process.cwd(), "data", "live", "warstories-probe.json");
const WIKI = "https://en.wikipedia.org/w/api.php";
const GDELT = "https://api.gdeltproject.org/api/v2/doc/doc";

const wikiPage = (page: string, kind: string, settles: string, look: string[] = []): Target => ({
  id: `wiki:${page}`,
  kind,
  what: page.replace(/_/g, " "),
  url: `${WIKI}?action=parse&format=json&prop=wikitext&page=${encodeURIComponent(page)}&redirects=1`,
  // MediaWiki serves wikitext as a JSON string value, so a real newline in it
  // is the two characters backslash and n. Counting the raw body would miss
  // every line-anchored pattern.
  decode: "parse.wikitext.*",
  look,
  count: {
    refs: /<ref[\s>]/g,
    citeNews: /\{\{\s*cite (news|web|press release)/gi,
    // A dated line is the unit a timeline is built from.
    datedLines: /\b\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b/gi,
    isoDates: /\bdate\s*=\s*\d{4}-\d{2}-\d{2}/gi,
    sections: /^==[^=]/gm,
    tableRows: /^\|-/gm,
  },
  settles,
});

/**
 * A GDELT article-list query. `mode=artlist` returns matching articles with
 * their outlet, url, date and language.
 */
const gdelt = (
  id: string, what: string, query: string, settles: string, paired?: string,
): Target => ({
  id,
  kind: "story-engine",
  what,
  url: `${GDELT}?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=250&format=json&timespan=3months`,
  ...(paired
    ? { paired: `${GDELT}?query=${encodeURIComponent(paired)}&mode=artlist&maxrecords=250&format=json&timespan=3months` }
    : {}),
  /*
   * Eight seconds between GDELT calls. The first pass fired four in a row and
   * got three 429s and an empty 200 — which reads like a service that refuses
   * scripts and is really one asking to be asked more slowly. GDELT publishes
   * no rate limit; this is well under one request every five seconds, which is
   * the figure its user community settles on.
   */
  gapMs: 8000,
  look: ["articles", "url", "domain"],
  count: { articles: /"url"\s*:/g, domains: /"domain"\s*:/g, english: /"language"\s*:\s*"English"/g },
  settles,
});

const TARGETS: Target[] = [
  /* ── Operation Sindoor: is there a citable sequence? ───────────────── */
  wikiPage(
    "Operation_Sindoor",
    "sindoor",
    "Whether the operation has an article at all, how heavily cited it is, and whether it carries dated events rather than only narrative",
    ["timeline", "May 2025", "Indian Air Force", "Pakistan", "ceasefire"],
  ),
  /*
   * The first pass settled two of these and they are kept so the answers stay
   * on the record. "2025 India–Pakistan conflict" returned counts identical to
   * "Operation Sindoor" down to the last reference, so the two titles are one
   * article and a connector reading both would double every event.
   * "Timeline of the 2025 India–Pakistan conflict" returned nothing at all:
   * there is no dedicated timeline article, so the sequence has to be read out
   * of the main article's prose.
   */
  wikiPage(
    "2025_India–Pakistan_conflict",
    "sindoor",
    "Whether this is a separate article or a redirect — identical counts would mean one article under two names",
    ["timeline", "ceasefire", "strike"],
  ),
  wikiPage(
    "Pahalgam_attack",
    "sindoor",
    "Whether the triggering event is documented separately, which the timeline has to open on",
    ["April 2025", "Jammu and Kashmir"],
  ),
  {
    id: "pib:releases",
    kind: "sindoor",
    what: "PIB — the Indian government's own release archive, as a search",
    url: "https://www.pib.gov.in/allRel.aspx",
    look: ["Ministry", "Release"],
    count: { links: /href=/g, dates: /\d{2}\/\d{2}\/\d{4}/g },
    settles: "Whether India's own releases are reachable, so official claims can be quoted as claims rather than paraphrased",
  },

  /* ── The story engine ──────────────────────────────────────────────── */
  gdelt(
    "gdelt:military-ai",
    "GDELT — global news index, queried for military AI",
    '("artificial intelligence" OR "machine learning" OR autonomous) (military OR defence OR defense OR army OR "armed forces")',
    "Whether a keyless global news index answers, and how many military-AI articles it holds for one quarter",
    // The paired query asks about something unrelated. Identical answers would
    // mean the query parameter is decorative — the trap PIB's archive set.
    "recipes baking sourdough bread",
  ),
  gdelt(
    "gdelt:drone-strike",
    "The same index, queried for drone strikes",
    '("drone strike" OR "UAV strike" OR "loitering munition") (attack OR strike OR killed OR targeted)',
    "Whether drone-strike reporting is reachable at volume through the same mechanism",
  ),
  gdelt(
    "gdelt:sindoor",
    "The same index, queried for the operation",
    '"Operation Sindoor"',
    "Whether contemporaneous reporting on the operation is retrievable by name, which is what a timeline's citations would be checked against",
  ),
  {
    id: "gdelt:timeline-mode",
    kind: "story-engine",
    what: "GDELT timeline mode — article volume over time rather than a list",
    url: `${GDELT}?query=${encodeURIComponent('("artificial intelligence") (military OR defence)')}&mode=timelinevol&format=json&timespan=12months`,
    look: ["timeline", "date", "value"],
    count: { points: /"date"\s*:/g },
    settles: "Whether attention over time is measurable, which is a chart the story engine could carry",
  },

  /* ── AI-military and drone incident registers ──────────────────────── */
  {
    id: "aiaaic:csv",
    kind: "ai-register",
    what: "AIAAIC — the volunteer AI incidents register this site already reads",
    url: "https://docs.google.com/spreadsheets/d/1Bn55B4xz21-_Rgdr8BBb2lt0n_4rzLGxFADMlVW0PYI/export?format=csv&gid=888071280",
    look: ["Headline", "Type", "Sector"],
    count: { rows: /\n/g, military: /military|defen[cs]e|army|navy|air force/gi },
    settles: "Whether the existing register still answers, and how many of its rows look military at all",
  },
  {
    id: "airwars:api",
    kind: "ai-register",
    what: "Airwars — a civilian-harm register of air and drone strikes",
    url: "https://airwars.org/wp-json/wp/v2/posts?per_page=20",
    look: ["title", "link"],
    count: { posts: /"link"\s*:/g },
    settles: "Whether a second, independent strike register is machine-readable without a key",
  },
  {
    id: "acleddata:probe",
    kind: "ai-register",
    what: "ACLED — conflict event data, to confirm whether it needs a key",
    url: "https://api.acleddata.com/acled/read?limit=5",
    look: ["data", "event_date"],
    count: { events: /"event_date"\s*:/g },
    settles: "Whether the standard conflict-event dataset is usable here, or is key-gated and therefore out",
  },

  /* ── A wider publisher set, for the engine's corroboration tier ────── */
  ...[
    // Five of these answered on the first pass: The War Zone (40 items), IDRW
    // (30), Military Times (25), C4ISRNET (25) and DefenseScoop (10). Janes,
    // Army Recognition and National Defense Magazine all 404'd on the feed
    // paths guessed for them, so those three are replaced here with different
    // candidates rather than dropped — a publisher with no RSS may still have
    // one under another path, and a 404 is about the path, not the outlet.
    ["warzone", "The War Zone", "https://www.twz.com/feed"],
    ["defencenewsin", "Defence News India (IDRW)", "https://idrw.org/feed/"],
    ["militarytimes", "Military Times", "https://www.militarytimes.com/arc/outboundfeeds/rss/"],
    ["c4isrnet", "C4ISRNET", "https://www.c4isrnet.com/arc/outboundfeeds/rss/"],
    ["defensescoop", "DefenseScoop", "https://defensescoop.com/feed/"],
    ["armyrecognition2", "Army Recognition (alternate path)", "https://www.armyrecognition.com/feed"],
    ["janes2", "Janes (alternate path)", "https://www.janes.com/rss/defence-news"],
    ["shephard", "Shephard Media", "https://www.shephardmedia.com/feed/"],
    ["armytimes", "Army Times", "https://www.armytimes.com/arc/outboundfeeds/rss/"],
    ["defenseindustry", "Defence Industry Europe", "https://defence-industry.eu/feed/"],
    ["militaryaero", "Military & Aerospace Electronics", "https://www.militaryaerospace.com/rss"],
    ["nato", "NATO newsroom", "https://www.nato.int/cps/en/natohq/news.rss"],
  ].map(([id, outlet, url]): Target => ({
    id: `feed:${id}`,
    kind: "publisher",
    what: `${outlet} — RSS`,
    url: url!,
    look: ["<item", "<title"],
    count: { items: /<item[\s>]/g, links: /<link[\s>]/g },
    settles: `Whether ${outlet} answers a script, so the engine can corroborate rather than trust one outlet`,
  })),
];

async function main(): Promise<void> {
  await runProbe(TARGETS, OUT, {
    question:
      "Can a story engine discover military and AI-military reporting from a published index "
      + "rather than a hand-kept list, and is Operation Sindoor reconstructable from sources that "
      + "cite themselves per event?",
    refusal:
      "No headline, no casualty figure, no loss claim and no account of what happened in May 2025 "
      + "is published here. Only whether a source answered, in what shape, roughly how many rows "
      + "it carries, and whether its query parameters do anything.",
    note:
      "Operation Sindoor is a recent, contested operation between two nuclear-armed states whose "
      + "governments published incompatible accounts of it. Aircraft losses and casualties in "
      + "particular are claims by belligerents rather than measurements. Anything built on this "
      + "has to carry each claim with the claimant attached and the two accounts side by side; a "
      + "single authoritative sequence merging them would be this project inventing an account. "
      + "The probe therefore asks whether a source carries dated events with per-event citations, "
      + "not what those events were.",
  });
}

if (isEntryPoint(import.meta.url)) {
  void main();
}
