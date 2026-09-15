/**
 * Defence contracts the Government of India has announced, read from the
 * announcements themselves.
 *
 *   npm run deals:build
 *
 * ── How the probe arrived at this design ─────────────────────────────────
 *
 * Three rounds, and the second one was wrong in a way worth recording.
 *
 * Round one ruled out the Ministry of Defence: mod.gov.in refused at the
 * connection with and without the www, so its annual reports and the
 * contracts-concluded appendix in them are unreachable from this pipeline.
 * SIPRI's database and trade register both returned the same landing page.
 *
 * Round two found PIB's archive answering a GET — AllRelease.aspx with a day,
 * a month and a year, 844 KB of HTML, status 200 — and concluded the ledger
 * could be crawled from it. That conclusion was false. Round three asked the
 * same page for three different dates, including one in 2016, and got back
 * 844,412, 844,413 and 844,416 bytes with 525 links each: the page ignores its
 * query string entirely and renders the same default view every time. A
 * reachability probe cannot catch that, because every individual answer looks
 * like a success. Only asking twice and comparing does.
 *
 * Round three also found what does work: PressReleasePage.aspx?PRID=<id>
 * returns one release, 78 KB, the real thing. Individual releases are
 * addressable; the index over them is not.
 *
 * ── So: Wikipedia as the index, PIB as the source ────────────────────────
 *
 * Every row here is a press release fetched from pib.gov.in by its own id and
 * read directly. Wikipedia is used only to discover which ids exist — its
 * articles on Indian defence procurement cite PIB releases, and a citation is
 * a pointer, not a claim. Nothing an encyclopaedia says about a contract
 * reaches this file; only the government's own words about it do.
 *
 * That split is worth being explicit about, because the two halves have very
 * different standing. The provenance of every figure is primary. The coverage
 * is not: it is whatever has been cited by an editor, which will over-
 * represent the deals that made news and miss the ones that did not. The file
 * says so, and the page has to repeat it.
 *
 * ── Four measures that must never be added together ──────────────────────
 *
 * A CCS clearance, a DAC Acceptance of Necessity, a signed contract and a
 * delivery are four different events. An AoN is permission to begin procuring
 * and many never become contracts. Each row carries which of the four it is,
 * and the roll-up refuses to total across them.
 *
 * ── Money ────────────────────────────────────────────────────────────────
 *
 * A figure is recorded only when it appears in a sentence that also names a
 * cost, and the sentence travels with it so a reader can see what was read.
 * Units are recorded as written — crore, lakh, million — and never converted,
 * because the conversion is where a number quietly becomes a different number.
 * Where a release states two different figures, both are kept and the row is
 * marked ambiguous rather than one being chosen.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "../lib/http";
import { isEntryPoint } from "../lib/entry";

const ROOT = process.cwd();
const OUT = join(ROOT, "data", "defence", "deals.json");
const WIKI = "https://en.wikipedia.org/w/api.php";
const PIB = "https://www.pib.gov.in/PressReleasePage.aspx?PRID=";

/**
 * Where to look for citations, not what to believe.
 *
 * Titles the search API returned rather than titles anyone guessed — four of
 * eight guesses in the first probe came back as an error object. These are
 * read for their `pib.gov.in` references and for nothing else.
 */
const INDEX_ARTICLES = [
  "Defence industry of India",
  "Rafale deal controversy",
  "Dassault Rafale",
  "BrahMos",
  "Hindustan Aeronautics Limited",
  "Indian Navy",
  "Make in India",
  "S-400 missile system",
  "List of equipment of the Indian Army",
  "Defence Research and Development Organisation",
  "Bharat Electronics",
  "Mazagon Dock Shipbuilders",
  "Indian Air Force",
  "Tejas (aircraft)",
  "Arjun (tank)",
  "INS Vikrant (2013)",
  // Widened after the first run. The headline filter is strict enough that
  // precision is no longer the constraint; coverage is, and coverage here is
  // simply how many articles were read for citations.
  "Defence budget of India",
  "Atmanirbhar Bharat",
  "Indian Coast Guard",
  "Akash (missile)",
  "Pinaka multi-barrel rocket launcher",
  "HAL Prachand",
  "Bharat Dynamics",
  "Garden Reach Shipbuilders & Engineers",
  "Cochin Shipyard",
  "Arihant-class submarine",
  "Project 75I-class submarine",
  "Bharat Earth Movers",
  "Ordnance Factory Board",
  "Agni (missile)",
  "Indian Army",
  "Defence Space Agency",
  // Semiconductors. The same machinery — PIB releases discovered through an
  // encyclopaedia's citations and then read from the government's own page —
  // works for the fab approvals, and the Semicon India announcements are
  // exactly the kind of figure that gets quoted from memory and wrongly.
  "Semiconductor industry in India",
  "India Semiconductor Mission",
  "Micron Technology",
  "Tata Electronics",
  "Electronics industry in India",
];

/** How many releases to fetch in one run. Each is ~78 KB. */
const MAX_RELEASES = 500;

type Measure = "contract" | "clearance" | "acceptance-of-necessity" | "delivery" | "unclassified";

interface Money {
  /** As written: "59,000" stays "59,000". */
  amount: string;
  currency: "INR" | "USD";
  /** crore, lakh, million, billion, or "" when the release states none. */
  unit: string;
  /** The sentence it was read from, trimmed. The evidence, not decoration. */
  sentence: string;
}

interface Deal {
  prid: string;
  url: string;
  title: string;
  /** ISO date where the release states one, else null. Never inferred. */
  date: string | null;
  ministry: string | null;
  /** Which of the four events this is. */
  measure: Measure;
  /** The words that decided `measure`, so the classification is checkable. */
  measureCue: string;
  money: Money[];
  /** True when the release states two different figures and neither was chosen. */
  ambiguousValue: boolean;
  /** Articles that cited this release. Discovery only — never evidence. */
  citedBy: string[];
}

async function wikitext(page: string): Promise<string | null> {
  const url = `${WIKI}?action=parse&page=${encodeURIComponent(page)}` +
    "&redirects=1&prop=wikitext&formatversion=2&format=json";
  const res = await getText(url, { cacheMs: 6 * 3600_000, retries: 2, timeoutMs: 45_000 });
  if (!res.ok || !res.data) return null;
  try {
    return (JSON.parse(res.data) as { parse?: { wikitext?: string } }).parse?.wikitext ?? null;
  } catch {
    return null;
  }
}

/** Every PIB release id an article cites. A pointer, nothing more. */
export function pridsIn(text: string): string[] {
  const out = new Set<string>();
  // Both hosts: pib.nic.in was the domain for most of the period and the
  // citations were never rewritten when it became pib.gov.in.
  for (const m of text.matchAll(/https?:\/\/[^\s|\]}"'<>]*pib[^\s|\]}"'<>]*?PRID=(\d{4,9})/gi)) {
    out.add(m[1]!);
  }
  return [...out];
}

/**
 * Visible text of an HTML page, with the chrome removed and the headline
 * given a sentence boundary.
 *
 * Both of those matter downstream. PIB puts "Press Release Page | Press
 * Information Bureau Ministry of Defence" in front of every headline and no
 * full stop after it, so a sentence splitter returns the chrome and the
 * headline and the first paragraph as one string — and the evidence quote
 * under a figure opened with the site's own navigation. Dropping the chrome
 * and breaking before the "Posted On:" stamp makes the headline its own
 * sentence, which is what it is.
 */
export function textOf(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&rsquo;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/Press Release Page\s*\|\s*Press Information Bureau/gi, " ")
    .replace(/azadi\s*ka\s*amrit\s*mahotsav/gi, " ")
    .replace(/\s*(Posted On\s*:)/gi, ". $1")
    .replace(/\s+/g, " ")
    .replace(/^\s*\.\s*/, "")
    .trim();
}

export function titleOf(html: string): string {
  const h = /<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(html) ?? /<title>([\s\S]*?)<\/title>/i.exec(html);
  return h ? textOf(h[1] ?? "").slice(0, 220) : "";
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/**
 * The release's own date, or null.
 *
 * Never inferred from anything else. A ledger whose dates are guessed from
 * ids or from the order a crawl happened to run in looks exactly like one
 * whose dates are read, and the difference only shows up in a chart.
 */
export function dateOf(text: string): string | null {
  // PIB stamps its releases "Posted On: 01 AUG 2024 5:14PM by PIB Delhi" — an
  // uppercase three-letter month, which a /[A-Z][a-z]+/ month pattern misses
  // entirely. The first version of this had that pattern, and the first
  // version of the test hid it behind an "or" that accepted null.
  const m = /\b(\d{1,2})\s+([A-Za-z]{3,12})\.?,?\s+(20\d{2})\b/.exec(text);
  if (!m) return null;
  const word = (m[2] ?? "").toLowerCase();
  const month = MONTHS.findIndex((name) => name === word || name.slice(0, 3) === word);
  if (month < 0) return null;
  const day = Number(m[1]);
  if (!Number.isFinite(day) || day < 1 || day > 31) return null;
  return `${m[3]}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function ministryOf(text: string): string | null {
  const m = /Ministry of ([A-Z][A-Za-z& ]{2,40}?)(?:\s{2,}|\s(?:Posted|azadi|Dated)|$)/.exec(text);
  return m ? `Ministry of ${(m[1] ?? "").trim()}` : null;
}

/**
 * Which of the four events a release is announcing.
 *
 * Ordered by strength of claim, and the cue that decided it is recorded. A
 * classifier that cannot be audited is a classifier nobody can correct, and
 * the whole point of keeping these four apart is that they are easy to
 * conflate in exactly this step.
 */
export function classify(text: string): { measure: Measure; cue: string } {
  const rules: Array<[Measure, RegExp]> = [
    ["acceptance-of-necessity",
      /\bAcceptance of Necessity\b|\bAoN\b|\bDefence Acquisition Council\b|\bDAC\b\s+(?:approves?|clears?|accords?)/i],
    ["clearance",
      /\bCabinet Committee on Security\b|\bCCS\b\s+(?:has\s+)?(?:approved|cleared)|\b(?:Union\s+)?Cabinet\b[^.]{0,40}\bapprove/i],
    ["contract",
      /\b(?:sign(?:s|ed|ing)?|ink(?:s|ed)?|conclude[ds]?|award(?:s|ed)?|place[sd]?|issue[sd]?)\b[^.]{0,80}\b(?:contracts?|agreements?|MoU|(?:supply\s+)?orders?)\b/i],
    ["delivery",
      /\b(?:deliver(?:s|ed|y)|hand(?:s|ed)\s+over|induct(?:s|ed|ion)|commission(?:s|ed))\b/i],
  ];
  for (const [measure, re] of rules) {
    const m = re.exec(text);
    if (m) return { measure, cue: (m[0] ?? "").slice(0, 90) };
  }
  return { measure: "unclassified", cue: "" };
}

/**
 * Money, read only out of a sentence that says it is a cost.
 *
 * A release mentions figures for many reasons — a production target, a
 * previous year's exports, a number of units. Taking the first currency-shaped
 * match on the page would attach whichever of those happened to come first to
 * the contract, and it would look entirely plausible.
 */
const COSTY = /\b(cost|costing|value|valued|worth|amount|approximately|price)\b/i;

/**
 * Sentences that state a threshold rather than a price.
 *
 * A DAC release about delegated financial powers says "for all procurement
 * cases up to Rs 300 crore" — a cost sentence by any word test, and not a
 * figure about any deal. Two of those landed in the ledger beside a real
 * ₹2.23 lakh crore approval, where they read as smaller contracts in the same
 * announcement.
 */
const THRESHOLD = /\b(up to|upto|above|below|exceeding|not exceeding|limit|ceiling|delegat|powers of|per case|and above)\b/i;

export function moneyIn(text: string): Money[] {
  const out: Money[] = [];
  const seen = new Map<string, number>();
  for (const raw of text.split(/(?<=[.!?])\s+/)) {
    if (!COSTY.test(raw)) continue;
    if (THRESHOLD.test(raw)) continue;
    /**
     * "lakh crore" is one unit, not a lakh.
     *
     * The DAC's releases are full of "Rs 1.45 lakh crore". A unit pattern that
     * tries `lakh` before `lakh crore` reads that as 1.45 lakh — a hundred
     * thousand rupees where the release means one and a half trillion, off by
     * a factor of ten million, and looking entirely ordinary in a table. The
     * compound alternatives come first for that reason. "Cr" is here because
     * PIB writes it: "contracts worth Rs 2580 Cr".
     */
    const re =
      /(₹|Rs\.?|INR|US\s?\$|\$)\s?([\d][\d,]*(?:\.\d+)?)\s*(lakh\s+crores?|thousand\s+crores?|crores?|lakhs?|billion|million|bn|mn|cr\.?)?\b/gi;
    for (const m of raw.matchAll(re)) {
      const sym = (m[1] ?? "").toUpperCase();
      const unit = (m[3] ?? "").toLowerCase()
        .replace(/\.$/, "").replace(/\s+/g, " ").replace(/s\b/g, "")
        .replace(/^cr$/, "crore");
      /**
       * The evidence is a window around the figure, not the first 300
       * characters of whatever the splitter called a sentence.
       *
       * PIB pages open with an unbroken run of navigation and headline
       * carrying no full stop, so the "sentence" holding a figure could be
       * thousands of characters long and a 300-character slice of it
       * routinely did not contain the figure at all. An evidence field that
       * does not contain the thing it is evidence for is worse than none: it
       * looks like a citation.
       */
      const at = m.index ?? 0;
      const window = raw.slice(Math.max(0, at - 150), at + 150).trim();
      const money: Money = {
        amount: m[2] ?? "",
        currency: sym.includes("$") || sym === "USD" ? "USD" : "INR",
        unit,
        sentence: (window.length < raw.length ? `…${window}…` : window),
      };
      // PIB serves the body more than once per page — in the article, in a
      // meta description, in a print block — so the same figure arrived six
      // and twelve times per release and the row read as a dozen separate
      // claims.
      //
      // The key deliberately excludes the unit. The same figure often appears
      // once spelled out and once bare — "Rs 2.23 lakh crore" in the headline
      // and "Rs 2.23" where the unit fell outside the window — and keying on
      // the unit let both through as two claims. Amount and currency identify
      // the figure; the entry that carries a unit wins, because it is the
      // more complete reading of the same fact.
      const key = `${money.amount}|${money.currency}`;
      const prior = seen.get(key);
      if (prior !== undefined) {
        if (money.unit && !out[prior]!.unit) out[prior] = money;
        continue;
      }
      seen.set(key, out.length);
      out.push(money);
    }
  }
  return out;
}

/** Two figures are the same claim when amount, currency and unit all match. */
export function distinctValues(money: Money[]): number {
  return new Set(money.map((m) => `${m.amount}|${m.currency}|${m.unit}`)).size;
}

/**
 * Is this release about a defence acquisition at all?
 *
 * Both halves are required. "Ministry of Defence" alone catches every
 * ceremonial release the ministry issues; a contract verb alone catches every
 * other ministry's contracts. The pair is what makes the filter mean
 * something, and a release that fails it is counted rather than dropped
 * silently so the yield is visible.
 */
export function isDefenceAcquisition(text: string): boolean {
  const defence =
    /\bMinistry of Defence\b|\bDefence Ministry\b|\bDefence Acquisition\b|\bDRDO\b|\bHindustan Aeronautics\b|\bBharat Electronics\b|\bIndian (?:Army|Navy|Air Force)\b/i;
  const acquisition =
    /\b(contract|agreement|MoU|procurement|acquisition|Acceptance of Necessity|order worth|capital acquisition)\b/i;
  return defence.test(text) && acquisition.test(text);
}

export async function run(): Promise<void> {
  // ── Discovery ─────────────────────────────────────────────────────────
  const citedBy = new Map<string, Set<string>>();
  const articlesRead: string[] = [];
  const articlesMissing: string[] = [];

  for (const page of INDEX_ARTICLES) {
    const text = await wikitext(page);
    if (!text) { articlesMissing.push(page); continue; }
    articlesRead.push(page);
    const found = pridsIn(text);
    for (const prid of found) {
      citedBy.set(prid, (citedBy.get(prid) ?? new Set()).add(page));
    }
    console.log(`  index  ${page.padEnd(44)} ${String(found.length).padStart(4)} PIB citations`);
  }

  const prids = [...citedBy.keys()].sort();
  console.log(`\n${prids.length} distinct release ids cited across ${articlesRead.length} articles\n`);

  // ── Reading the releases themselves ───────────────────────────────────
  const deals: Deal[] = [];
  let fetched = 0, dead = 0, notDefence = 0, notAnEvent = 0;

  for (const prid of prids.slice(0, MAX_RELEASES)) {
    const res = await getText(`${PIB}${prid}`, { cacheMs: 30 * 24 * 3600_000, retries: 1, timeoutMs: 45_000 });
    if (!res.ok || !res.data) { dead++; continue; }
    fetched++;
    const html = res.data;
    const body = textOf(html);
    if (!isDefenceAcquisition(body)) { notDefence++; continue; }

    /**
     * Classified from the headline, and dropped when the headline says nothing.
     *
     * Classifying from the body put "VICE ADMIRAL AJAY KOCHHAR ASSUMES CHARGE"
     * in the ledger as a delivery, because a flag officer's biography mentions
     * ships he commissioned. It also admitted a budget statement, a naval
     * exercise, a year-end review and a parliamentary answer about Rafale —
     * thirteen rows of thirty-six, every one of them a plausible-looking entry
     * in a defence deals table.
     *
     * A PIB headline is declarative and states the event: "MoD inks two
     * contracts worth Rs 62,700 crore with HAL", "DAC clears proposals worth
     * Rs 2.38 lakh crore". So the headline decides, and a release whose
     * headline names none of the four events is counted as not-an-event rather
     * than filed under whichever measure its body happened to mention.
     */
    const { measure, cue } = classify(titleOf(html));
    if (measure === "unclassified") { notAnEvent++; continue; }
    const money = moneyIn(body);
    deals.push({
      prid,
      url: `${PIB}${prid}`,
      title: titleOf(html),
      date: dateOf(body),
      ministry: ministryOf(body),
      measure,
      measureCue: cue,
      money,
      ambiguousValue: distinctValues(money) > 1,
      citedBy: [...(citedBy.get(prid) ?? [])],
    });

    // Written after every release, so a run killed part-way still leaves what
    // it read. A job that throws before committing leaves only a log.
    if (deals.length % 20 === 0) await save(deals, meta());
  }

  function meta() {
    const byMeasure: Record<string, number> = {};
    for (const d of deals) byMeasure[d.measure] = (byMeasure[d.measure] ?? 0) + 1;
    return {
      articlesRead, articlesMissing,
      citedIds: prids.length,
      fetched, dead, notDefence, notAnEvent,
      withDate: deals.filter((d) => d.date).length,
      withValue: deals.filter((d) => d.money.length > 0).length,
      ambiguous: deals.filter((d) => d.ambiguousValue).length,
      byMeasure,
    };
  }

  await save(deals, meta());

  const m = meta();
  console.log(
    `\n${deals.length} defence acquisition releases from ${fetched} fetched ` +
    `(${notDefence} were not acquisitions, ${notAnEvent} announced no event, ${dead} did not answer)`,
  );
  console.log(`  dated: ${m.withDate}   with a stated figure: ${m.withValue}   ambiguous: ${m.ambiguous}`);
  for (const [k, v] of Object.entries(m.byMeasure)) console.log(`  ${k.padEnd(24)} ${v}`);
}

async function save(deals: Deal[], meta: Record<string, unknown>): Promise<void> {
  await mkdir(join(ROOT, "data", "defence"), { recursive: true });
  await writeFile(OUT, JSON.stringify({
    builtAt: new Date().toISOString(),
    source:
      "Press Information Bureau releases, each fetched from pib.gov.in by its own release id " +
      "and read directly.",
    discovery:
      "Wikipedia articles on Indian defence procurement, read only for the PIB release ids they " +
      "cite. Nothing an encyclopaedia says about a contract is in this file; only the " +
      "government's own words about it are.",
    coverageWarning:
      "The provenance of every figure here is primary. The coverage is not. A release is in " +
      "this file because an encyclopaedia editor cited it, which over-represents the deals that " +
      "made news and misses the ones that did not. This is a sample of announced contracts, " +
      "never the set of them, and it must not be summed and called India's defence spending.",
    fourMeasures:
      "A CCS clearance, a DAC Acceptance of Necessity, a signed contract and a delivery are " +
      "four different events. An AoN is permission to begin procuring and many never become " +
      "contracts. Every row carries which of the four it is and no total crosses them.",
    eventNote:
      "A release is in this file only when its own headline names one of the four events. " +
      "Classifying from the body admitted a flag officer's appointment as a delivery, because " +
      "his biography mentions ships he commissioned — along with a budget statement, a naval " +
      "exercise and a parliamentary answer. A PIB headline states the event; the body mentions " +
      "everything.",
    valueNote:
      "A figure is recorded only from a sentence that also names a cost, and that sentence is " +
      "kept beside it. Units are as written and never converted — the conversion is where a " +
      "number quietly becomes a different number. Where a release states two different figures " +
      "both are kept and the row is marked ambiguous rather than one being chosen.",
    ...meta,
    deals,
  }, null, 2) + "\n", "utf8");
}

if (isEntryPoint(import.meta.url)) {
  run().catch((err) => { console.error(err); process.exit(1); });
}
