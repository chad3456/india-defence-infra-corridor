/**
 * News evidence on the SC/ST Atrocities Act and PM SHRI, collected and graded.
 *
 * `npm run rights:ingest`. Appends to data/rights/news.json. Scheduled.
 *
 * ── The distinction this whole file exists to hold ───────────────────────
 *
 * Both subjects are argued about as "use and misuse", and on the SC/ST Act
 * that argument runs through one number that does not mean what it is used to
 * mean. So this classifier refuses to collapse four different things into one:
 *
 *   USE            A case registered, a conviction, an atrocity reported, a
 *                  school sanctioned. The Act or the scheme operating.
 *
 *   ACQUITTAL      A court acquitting. This is NOT a finding that a complaint
 *                  was false. An acquittal under this Act can follow from a
 *                  hostile witness, from intimidation of the complainant, from
 *                  an investigation that never gathered the caste-certificate
 *                  evidence the statute requires, or from a compromise reached
 *                  outside court. India's own official record discusses all of
 *                  these. No public dataset separates them.
 *
 *   ALLEGATION     Somebody SAYING the law is misused. A politician, a
 *                  litigant, an association. This is a statement about the
 *                  law, not evidence about it, and it is tagged with the fact
 *                  that someone said it rather than with what they said.
 *
 *   FALSE-FINDING  A court or an investigating agency finding a specific
 *                  complaint false — quashing it as fabricated, ordering
 *                  action against the complainant. This is the only tier that
 *                  is evidence of misuse, and it is the rarest.
 *
 * Every page built on this has to keep those four apart. Merging acquittals
 * into misuse is the specific error that makes most writing on this subject
 * wrong, and it is easy to make because the merged number is larger and reads
 * as more decisive.
 *
 * ── PM SHRI, where the dispute is about money and consent ────────────────
 *
 * Its facets are different: the scheme operating, versus states refusing its
 * memorandum, versus funds reported withheld over that refusal. That is a
 * dated, documented dispute rather than a matter of opinion.
 *
 * ── What this is not ─────────────────────────────────────────────────────
 *
 * Not verification. The collector counts newsrooms and classifies headlines;
 * it cannot check a claim, and three outlets running the same agency copy is
 * one source wearing three hats. Not a substitute for NCRB's series either —
 * news volume measures attention, and attention tracks outrage rather than
 * incidence.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "../lib/http";
import { isEntryPoint } from "../lib/entry";
import { parseFeed, stripOutletSuffix } from "../lib/feed";
import { titleTokens, similarity } from "../lib/dedupe";

const OUT_DIR = join(process.cwd(), "data", "rights");
const OUT = join(OUT_DIR, "news.json");
const GAP_MS = 1200;
/** Items older than this leave the register. */
const KEEP_DAYS = 1460;

let last = 0;
async function pace(): Promise<void> {
  const w = GAP_MS - (Date.now() - last);
  if (w > 0) await new Promise((r) => setTimeout(r, w));
  last = Date.now();
}

/**
 * The outlets, trimmed to those the probe found answering.
 *
 * A feed listed here that does not answer would quietly lower the
 * corroboration count on every item, so the list is the probe's output rather
 * than a wish list.
 */
export const FEEDS: Array<{ id: string; outlet: string; url: string }> = [
  { id: "thehindu-national", outlet: "The Hindu", url: "https://www.thehindu.com/news/national/feeder/default.rss" },
  { id: "indianexpress-india", outlet: "The Indian Express", url: "https://indianexpress.com/section/india/feed/" },
  { id: "indianexpress-edu", outlet: "The Indian Express (Education)", url: "https://indianexpress.com/section/education/feed/" },
  { id: "scroll", outlet: "Scroll.in", url: "https://scroll.in/feed" },
  { id: "thewire", outlet: "The Wire", url: "https://thewire.in/rss" },
  { id: "downtoearth", outlet: "Down To Earth", url: "https://www.downtoearth.org.in/rss" },
  { id: "hindustantimes", outlet: "Hindustan Times", url: "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml" },
  { id: "newindianexpress", outlet: "The New Indian Express", url: "https://www.newindianexpress.com/Nation/rssfeed/?id=170&getXmlFeed=true" },
  { id: "deccanherald", outlet: "Deccan Herald", url: "https://www.deccanherald.com/rss/national.rss" },
  { id: "telegraphindia", outlet: "The Telegraph India", url: "https://www.telegraphindia.com/feeds/rss.jsp?id=4" },
  { id: "thequint", outlet: "The Quint", url: "https://www.thequint.com/stories.rss" },
  { id: "newslaundry", outlet: "Newslaundry", url: "https://www.newslaundry.com/stories.rss" },
];

export type Subject = "scst" | "pmshri";
export type Facet = "use" | "acquittal" | "allegation" | "false-finding" | "dispute" | "unclassified";

/** Does the headline concern the Act, the scheme, or neither? */
export function subjectOf(text: string): Subject | null {
  const s = text.toLowerCase();
  if (/\bpm[- ]?shri\b|pm shri|pmshri/.test(s)) return "pmshri";
  if (/\bsc\/st\b|scheduled caste|scheduled tribe|\bdalit\b|\badivasi\b|atrocit|prevention of atrocities|\bsc-st\b/.test(s)) {
    return "scst";
  }
  return null;
}

/**
 * Which of the four things a headline is about.
 *
 * Ordered most-specific first, because the tiers overlap in language and the
 * strongest claim must win. "Court quashes case as fabricated" contains the
 * word "case" and would match `use` on a looser reading; it is a finding of
 * falsity and has to be read as one.
 *
 * The ordering is also the reason `allegation` sits above `acquittal`: a
 * headline reading "acquittal shows the law is misused" is somebody arguing,
 * not a court acquitting, and filing it as an acquittal would let an opinion
 * enter the record as an event.
 */
export function facetOf(text: string, subject: Subject): Facet {
  const s = text.toLowerCase();

  if (subject === "pmshri") {
    if (/refus|reject|decline|oppos|withheld|withhold|not sign|won'?t sign|pending dues|funds? (?:blocked|stalled|held)|row\b|dispute|protest|stand ?off/.test(s)) {
      return "dispute";
    }
    if (/sanction|launch|upgrad|approv|inaugurat|select|open|allot|fund released|crore/.test(s)) return "use";
    return "unclassified";
  }

  /*
   * A court or agency finding a specific complaint false. The only tier that
   * is evidence of misuse, and the rarest.
   */
  if (/\b(false|fabricat|frivolous|bogus|concoct)\w*\b[^.]{0,40}\b(case|complaint|fir|allegation)\b|\b(case|complaint|fir)\b[^.]{0,40}\b(false|fabricat|frivolous|bogus|concoct)/.test(s)
    || /quash\w*[^.]{0,40}\b(false|fabricat|frivolous|bogus)/.test(s)
    || /\baction against (?:the )?complainant\b|perjury/.test(s)) {
    return "false-finding";
  }

  /*
   * Somebody saying the law is misused. A statement about the law, not
   * evidence about it. Checked before acquittal so that an argument built on
   * an acquittal is filed as the argument it is.
   */
  if (/\bmisus\w*|\bmis-?use\b|\babus\w*\b[^.]{0,30}\b(act|law)\b|weaponis|weaponiz|\bmisapplied\b|blackmail/.test(s)) {
    return "allegation";
  }

  if (/\bacquit\w*|discharg\w*|\bexonerat\w*|set aside the conviction|benefit of doubt/.test(s)) {
    return "acquittal";
  }

  if (/\b(convict|sentenc|jailed|arrest|booked|fir\b|case registered|charge ?sheet|compensation|verdict|held guilty|atrocit|assault|murder|rape|lynch|beaten|humiliat|denied entry|social boycott)/.test(s)) {
    return "use";
  }

  return "unclassified";
}

export interface Item {
  id: string;
  headline: string;
  subject: Subject;
  facet: Facet;
  firstSeen: string;
  lastSeen: string;
  sources: Array<{ outlet: string; url: string; published: string }>;
}

interface Candidate { headline: string; url: string; published: string; outlet: string }

async function readFeedOf(f: { outlet: string; url: string }): Promise<{ ok: boolean; items: Candidate[]; error?: string }> {
  await pace();
  const res = await getText(f.url, { timeoutMs: 30_000, retries: 1, cacheMs: 0 });
  if (!res.ok || !res.data) return { ok: false, items: [], error: res.error ?? "no body" };
  const items = parseFeed(res.data).map((r): Candidate => ({
    headline: stripOutletSuffix(r.title ?? "", f.outlet).trim(),
    url: r.url ?? "",
    published: (r.publishedAt ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10),
    outlet: r.publisher?.trim() || f.outlet,
  })).filter((c) => c.headline !== "" && c.url !== "");
  return { ok: true, items };
}

async function main(): Promise<void> {
  const feedStatus: Array<{ outlet: string; ok: boolean; items: number; kept: number; error?: string }> = [];
  const fresh: Array<Candidate & { subject: Subject; facet: Facet }> = [];

  for (const f of FEEDS) {
    const r = await readFeedOf(f);
    let kept = 0;
    for (const c of r.items) {
      const subject = subjectOf(c.headline);
      if (!subject) continue;
      fresh.push({ ...c, subject, facet: facetOf(c.headline, subject) });
      kept++;
    }
    feedStatus.push({ outlet: f.outlet, ok: r.ok, items: r.items.length, kept, ...(r.error ? { error: r.error } : {}) });
    console.log(`  ${f.outlet}: ${r.ok ? `${r.items.length} items, ${kept} on subject` : r.error}`);
  }

  if (feedStatus.every((f) => !f.ok)) {
    throw new Error("no feed answered — refusing to write over the stored register");
  }

  let stored: Item[] = [];
  try {
    const prev = JSON.parse(await readFile(OUT, "utf8")) as { items?: Item[] };
    stored = prev.items ?? [];
  } catch {
    // First run.
  }

  const byId = new Map(stored.map((i) => [i.id, i]));
  const tokens = new Map<string, Set<string>>();
  for (const i of stored) tokens.set(i.id, titleTokens(i.headline));

  let created = 0;
  let merged = 0;
  for (const c of fresh) {
    const t = titleTokens(c.headline);
    let hit: Item | null = null;
    for (const i of byId.values()) {
      if (i.subject !== c.subject) continue;
      const it = tokens.get(i.id);
      if (it && similarity(t, it) >= 0.6) { hit = i; break; }
    }
    if (hit) {
      // Newsrooms are counted, not feeds: a second item from an outlet already
      // on a story does not raise its corroboration.
      if (!hit.sources.some((x) => x.outlet === c.outlet)) {
        hit.sources.push({ outlet: c.outlet, url: c.url, published: c.published });
        merged++;
      }
      if (c.published > hit.lastSeen) hit.lastSeen = c.published;
      if (c.published < hit.firstSeen) hit.firstSeen = c.published;
      continue;
    }
    const item: Item = {
      id: c.url,
      headline: c.headline,
      subject: c.subject,
      facet: c.facet,
      firstSeen: c.published,
      lastSeen: c.published,
      sources: [{ outlet: c.outlet, url: c.url, published: c.published }],
    };
    byId.set(item.id, item);
    tokens.set(item.id, t);
    created++;
  }

  const cutoff = new Date(Date.now() - KEEP_DAYS * 86400_000).toISOString().slice(0, 10);
  const items = [...byId.values()]
    .filter((i) => i.lastSeen >= cutoff)
    .sort((a, b) => (b.sources.length - a.sources.length) || b.lastSeen.localeCompare(a.lastSeen));

  const tally = (subject: Subject): Record<Facet, number> => {
    const t: Record<Facet, number> = {
      use: 0, acquittal: 0, allegation: 0, "false-finding": 0, dispute: 0, unclassified: 0,
    };
    for (const i of items) if (i.subject === subject) t[i.facet]++;
    return t;
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT, JSON.stringify({
    builtAt: new Date().toISOString(),
    source: `${FEEDS.length} Indian newsrooms, read as RSS. Each was probed before being added.`,
    method:
      "Headlines are matched to a subject and then to one of four things: the law or scheme "
      + "operating, a court acquitting, somebody alleging misuse, or a court finding a specific "
      + "complaint false. Near-duplicate headlines are folded together and the independent "
      + "newsrooms behind each are counted. The register accumulates across scheduled runs.",
    refusal:
      "An acquittal is not recorded as misuse. An acquittal under this Act can follow from a "
      + "false complaint and can equally follow from a hostile witness, from intimidation of the "
      + "complainant, from an investigation that never gathered the evidence the statute "
      + "requires, or from a compromise outside court — and no public dataset separates them. "
      + "Only a court or agency finding a specific complaint false is filed as evidence of "
      + "misuse, and somebody saying the law is misused is filed as somebody saying so.",
    cannotSay: [
      "How often either law is misused. The only tier here that is evidence of misuse is a judicial or investigative finding about a specific complaint, and news coverage of those is sparse and unrepresentative.",
      "How often either is used. News volume measures attention, and attention tracks outrage rather than incidence. NCRB's own series is the count; this is the coverage of it.",
      "Whether any item is true. The collector counts newsrooms and classifies headlines; it cannot check a claim, and three outlets running one agency's copy is one source wearing three hats.",
      "Anything from before this register started. It accumulates forward from its first run.",
    ],
    counts: {
      items: items.length,
      createdThisRun: created,
      corroboratedThisRun: merged,
      feedsAnswered: feedStatus.filter((f) => f.ok).length,
      feedsTried: FEEDS.length,
      itemsSeen: feedStatus.reduce((a, f) => a + f.items, 0),
      bySubject: {
        scst: items.filter((i) => i.subject === "scst").length,
        pmshri: items.filter((i) => i.subject === "pmshri").length,
      },
    },
    facets: { scst: tally("scst"), pmshri: tally("pmshri") },
    feeds: feedStatus,
    items,
  }, null, 2) + "\n", "utf8");

  console.log(
    `\nWrote ${OUT}: ${items.length} items (${created} new, ${merged} corroborated). `
    + `SC/ST ${items.filter((i) => i.subject === "scst").length}, `
    + `PM SHRI ${items.filter((i) => i.subject === "pmshri").length}.`,
  );
}

if (isEntryPoint(import.meta.url)) {
  void main();
}
