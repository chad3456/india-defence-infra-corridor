/**
 * The story engine: it finds military and AI-military stories, and keeps them.
 *
 * `npm run warstories:ingest`. Appends to data/global/warstories.json.
 * Scheduled, because a feed is a window on the last few days and a register
 * is built by looking through it repeatedly.
 *
 * ── What "engine" means here, and what it does not ───────────────────────
 *
 * It means discover, classify, corroborate, grade and accumulate, running
 * without a parser written per outlet. Fourteen publishers are read, every
 * item is tested against a vocabulary of military-AI and drone-warfare terms,
 * items describing the same story across outlets are folded together, and the
 * number of independent publishers behind each story becomes its grade.
 *
 * It does NOT mean a language model writing prose. This pipeline has no model
 * key, and inventing a dependency on one would ship a step that silently does
 * nothing in CI. The engine surfaces and ranks stories with their sources
 * attached; it never composes a sentence that is then presented as reporting.
 * A story here is a headline somebody published, the outlets that published
 * it, and what the classifier made of it.
 *
 * ── Why GDELT is not in this file ────────────────────────────────────────
 *
 * It was the obvious backbone — a free, keyless index of global news — and it
 * refused. Four queries at eight-second intervals all came back 429 from
 * GitHub's runners, after four more had done the same at full speed. That is
 * not a service asking to be asked more slowly; it is one that does not serve
 * shared CI addresses. So the engine is built on publishers that answer, and
 * the register grows by accumulation over scheduled runs rather than by one
 * big query.
 *
 * ── Corroboration is the grade, and it is the point ──────────────────────
 *
 * A single outlet reporting an autonomous-weapons deployment is a lead. Three
 * unrelated outlets reporting it is a story. The engine cannot check a claim,
 * so the only quality signal available is how many independent newsrooms
 * carried it — and that signal is published per story rather than folded into
 * a score. Newsrooms are counted, not feeds: two desks of the same paper are
 * one publisher, which is the rule `lib/sources.ts` already uses.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "../lib/http";
import { isEntryPoint } from "../lib/entry";
import { parseFeed, stripOutletSuffix } from "../lib/feed";
import { titleTokens, similarity } from "../lib/dedupe";

const OUT_DIR = join(process.cwd(), "data", "global");
const OUT = join(OUT_DIR, "warstories.json");
const GAP_MS = 1200;
/** Stories older than this leave the register. Two years of military reporting. */
const KEEP_DAYS = 730;

let last = 0;
async function pace(): Promise<void> {
  const w = GAP_MS - (Date.now() - last);
  if (w > 0) await new Promise((r) => setTimeout(r, w));
  last = Date.now();
}

/**
 * The publishers, each one proved by the probe before it was added.
 *
 * Seven were added on this pass — the probe tried twelve and these answered.
 * Janes, Army Recognition, Shephard, NATO's newsroom and Military &
 * Aerospace Electronics all 404'd on every path tried, so they are absent
 * rather than present-and-broken: a feed in this list that does not answer
 * would quietly reduce corroboration on every story.
 */
const FEEDS: Array<{ id: string; outlet: string; url: string }> = [
  { id: "warzone", outlet: "The War Zone", url: "https://www.twz.com/feed" },
  { id: "idrw", outlet: "Indian Defence Research Wing", url: "https://idrw.org/feed/" },
  { id: "militarytimes", outlet: "Military Times", url: "https://www.militarytimes.com/arc/outboundfeeds/rss/" },
  { id: "armytimes", outlet: "Army Times", url: "https://www.armytimes.com/arc/outboundfeeds/rss/" },
  { id: "c4isrnet", outlet: "C4ISRNET", url: "https://www.c4isrnet.com/arc/outboundfeeds/rss/" },
  { id: "defensescoop", outlet: "DefenseScoop", url: "https://defensescoop.com/feed/" },
  { id: "defenceindustryeu", outlet: "Defence Industry Europe", url: "https://defence-industry.eu/feed/" },
  // The seven the arsenal agent already proved.
  { id: "defensenews", outlet: "Defense News", url: "https://www.defensenews.com/arc/outboundfeeds/rss/" },
  { id: "breakingdefense", outlet: "Breaking Defense", url: "https://breakingdefense.com/feed/" },
  { id: "defenseone", outlet: "Defense One", url: "https://www.defenseone.com/rss/all/" },
  { id: "navalnews", outlet: "Naval News", url: "https://www.navalnews.com/feed/" },
  { id: "defenceblog", outlet: "Defence Blog", url: "https://defence-blog.com/feed/" },
  { id: "ukmod", outlet: "UK Ministry of Defence", url: "https://www.gov.uk/government/organisations/ministry-of-defence.atom" },
  { id: "pib", outlet: "Press Information Bureau (India)", url: "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3" },
];

/**
 * The themes a story can belong to, as vocabularies rather than as one filter.
 *
 * Separate lists because the page wants to say how much of the reporting is
 * about which thing, and a single "is it military AI" boolean cannot. A story
 * may carry several.
 */
const THEMES: Array<{ id: string; label: string; terms: RegExp }> = [
  {
    id: "military-ai", label: "AI in military use",
    terms: /\b(artificial intelligence|machine learning|\bAI[- ](?:enabled|powered|driven|assisted)|algorithmic|neural network|large language model|decision support)\b/i,
  },
  {
    id: "autonomy", label: "Autonomous and unmanned systems",
    terms: /\b(autonomous|autonomy|unmanned|uncrewed|robotic|loyal wingman|CCA|collaborative combat aircraft|swarm)\b/i,
  },
  {
    id: "drone", label: "Drones and loitering munitions",
    terms: /\b(drone|UAV|UAS|quadcopter|FPV|loitering munition|kamikaze drone|counter-UAS|c-UAS)\b/i,
  },
  {
    id: "targeting", label: "Targeting, ISR and decision systems",
    terms: /\b(targeting|ISR|surveillance|reconnaissance|kill chain|sensor fusion|battle management|command and control|C2)\b/i,
  },
  {
    id: "cyber-ew", label: "Cyber and electronic warfare",
    terms: /\b(cyber|electronic warfare|\bEW\b|jamming|spoofing|GPS denial|signals intelligence|SIGINT)\b/i,
  },
];

/** A story is military at all only if it reads as military. */
const MILITARY = /\b(military|defen[cs]e|army|navy|air force|marine|warfare|combat|troops|soldier|pentagon|nato|armed forces|battalion|missile|munition|weapon|war)\b/i;

/**
 * Countries named in a headline, from a fixed list.
 *
 * Only the ones this site already tracks, because a general place-name
 * extractor over headlines produces confident nonsense — "Georgia" and
 * "Jordan" are people, "Turkey" is a bird, and none of those errors would be
 * visible in a country chart.
 */
const COUNTRIES: Array<{ iso: string; name: string; re: RegExp }> = [
  { iso: "USA", name: "United States", re: /\b(united states|u\.s\.|\bUS\b|american|pentagon|washington)\b/i },
  { iso: "IND", name: "India", re: /\b(india|indian|new delhi|drdo|hal\b)\b/i },
  { iso: "CHN", name: "China", re: /\b(china|chinese|beijing|pla\b)\b/i },
  { iso: "RUS", name: "Russia", re: /\b(russia|russian|moscow|kremlin)\b/i },
  { iso: "UKR", name: "Ukraine", re: /\b(ukraine|ukrainian|kyiv|kiev)\b/i },
  { iso: "ISR", name: "Israel", re: /\b(israel|israeli|idf\b)\b/i },
  { iso: "IRN", name: "Iran", re: /\b(iran|iranian|tehran)\b/i },
  { iso: "PAK", name: "Pakistan", re: /\b(pakistan|pakistani|islamabad)\b/i },
  { iso: "GBR", name: "United Kingdom", re: /\b(united kingdom|britain|british|royal air force|royal navy)\b/i },
  { iso: "FRA", name: "France", re: /\b(france|french|paris)\b/i },
  { iso: "DEU", name: "Germany", re: /\b(germany|german|berlin|bundeswehr)\b/i },
  { iso: "TUR", name: "Türkiye", re: /\b(turkey|türkiye|turkish|bayraktar|baykar)\b/i },
  { iso: "KOR", name: "South Korea", re: /\b(south korea|korean|seoul)\b/i },
  { iso: "JPN", name: "Japan", re: /\b(japan|japanese|tokyo)\b/i },
  { iso: "AUS", name: "Australia", re: /\b(australia|australian|canberra)\b/i },
  { iso: "TWN", name: "Taiwan", re: /\b(taiwan|taiwanese|taipei)\b/i },
  { iso: "PRK", name: "North Korea", re: /\b(north korea|pyongyang)\b/i },
  { iso: "SAU", name: "Saudi Arabia", re: /\b(saudi|riyadh)\b/i },
  { iso: "ARE", name: "United Arab Emirates", re: /\b(emirates|\bUAE\b|abu dhabi)\b/i },
  { iso: "POL", name: "Poland", re: /\b(poland|polish|warsaw)\b/i },
];

export interface Story {
  /** Stable id: the earliest url seen for this story. */
  id: string;
  headline: string;
  /** ISO date of the earliest report seen. */
  firstSeen: string;
  lastSeen: string;
  themes: string[];
  countries: Array<{ iso: string; name: string }>;
  /** One entry per independent newsroom. This length is the grade. */
  sources: Array<{ outlet: string; url: string; published: string }>;
}

/** Which themes a text belongs to. Several, or none. */
export function themesOf(text: string): string[] {
  return THEMES.filter((t) => t.terms.test(text)).map((t) => t.id);
}

/** Countries a headline names, from the fixed list. */
export function countriesOf(text: string): Array<{ iso: string; name: string }> {
  return COUNTRIES.filter((c) => c.re.test(text)).map((c) => ({ iso: c.iso, name: c.name }));
}

/**
 * Is this a military story at all?
 *
 * A theme match alone is not enough: "AI" and "drone" both appear constantly
 * in civil reporting, and a register that let those in would be a register of
 * technology news with a military-sounding name. Both tests must pass.
 */
export function isMilitaryStory(text: string): boolean {
  return MILITARY.test(text) && themesOf(text).length > 0;
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
    /*
     * The feed's own `publisher` wins where it has one. Keyword-search feeds
     * aggregate hundreds of newsrooms and carry the real one per item, and
     * attributing those to the aggregator would put three papers' coverage
     * under one name — which on a register whose grade IS the newsroom count
     * would deflate every story it touched.
     */
    outlet: r.publisher?.trim() || f.outlet,
  })).filter((c) => c.headline !== "" && c.url !== "");
  return { ok: true, items };
}

async function main(): Promise<void> {
  const feedStatus: Array<{ outlet: string; ok: boolean; items: number; kept: number; error?: string }> = [];
  const fresh: Candidate[] = [];

  for (const f of FEEDS) {
    const r = await readFeedOf(f);
    const kept = r.items.filter((c) => isMilitaryStory(c.headline));
    fresh.push(...kept);
    feedStatus.push({ outlet: f.outlet, ok: r.ok, items: r.items.length, kept: kept.length, ...(r.error ? { error: r.error } : {}) });
    console.log(`  ${f.outlet}: ${r.ok ? `${r.items.length} items, ${kept.length} kept` : r.error}`);
  }

  /*
   * A run where no feed answered must not publish an empty register over a
   * full one. A run where feeds answered and nothing matched is different and
   * is allowed — it means a quiet few days, and the stored register stands.
   */
  if (feedStatus.every((f) => !f.ok)) {
    throw new Error("no feed answered — refusing to write over the stored register");
  }

  /** The register as it stands, before this run. */
  let stored: Story[] = [];
  let builtBefore = "";
  try {
    const prev = JSON.parse(await readFile(OUT, "utf8")) as { stories?: Story[]; builtAt?: string };
    stored = prev.stories ?? [];
    builtBefore = prev.builtAt ?? "";
  } catch {
    // First run.
  }

  /*
   * Fold each new item into the register: onto an existing story when the
   * headlines are near-duplicates, otherwise as a new one.
   *
   * Newsrooms are counted, not feeds — a second item from an outlet already
   * on a story does not raise its corroboration, which is the rule that stops
   * one paper's three desks looking like three confirmations.
   */
  const byId = new Map(stored.map((s) => [s.id, s]));
  const tokensOf = new Map<string, Set<string>>();
  for (const s of stored) tokensOf.set(s.id, titleTokens(s.headline));

  let merged = 0;
  let created = 0;
  for (const c of fresh) {
    const t = titleTokens(c.headline);
    let hit: Story | null = null;
    for (const s of byId.values()) {
      const st = tokensOf.get(s.id);
      if (st && similarity(t, st) >= 0.6) { hit = s; break; }
    }
    if (hit) {
      if (!hit.sources.some((x) => x.outlet === c.outlet)) {
        hit.sources.push({ outlet: c.outlet, url: c.url, published: c.published });
        merged++;
      }
      if (c.published > hit.lastSeen) hit.lastSeen = c.published;
      if (c.published < hit.firstSeen) hit.firstSeen = c.published;
      continue;
    }
    const story: Story = {
      id: c.url,
      headline: c.headline,
      firstSeen: c.published,
      lastSeen: c.published,
      themes: themesOf(c.headline),
      countries: countriesOf(c.headline),
      sources: [{ outlet: c.outlet, url: c.url, published: c.published }],
    };
    byId.set(story.id, story);
    tokensOf.set(story.id, t);
    created++;
  }

  const cutoff = new Date(Date.now() - KEEP_DAYS * 86400_000).toISOString().slice(0, 10);
  const stories = [...byId.values()]
    .filter((s) => s.lastSeen >= cutoff)
    .sort((a, b) => (b.sources.length - a.sources.length) || b.lastSeen.localeCompare(a.lastSeen));

  const byTheme = THEMES.map((t) => ({
    id: t.id, label: t.label,
    n: stories.filter((s) => s.themes.includes(t.id)).length,
  })).sort((a, b) => b.n - a.n);

  const countryCounts = new Map<string, { iso: string; name: string; n: number }>();
  for (const s of stories) {
    for (const c of s.countries) {
      const row = countryCounts.get(c.iso) ?? { iso: c.iso, name: c.name, n: 0 };
      row.n++;
      countryCounts.set(c.iso, row);
    }
  }

  const corroboration = { one: 0, two: 0, threePlus: 0 };
  for (const s of stories) {
    if (s.sources.length >= 3) corroboration.threePlus++;
    else if (s.sources.length === 2) corroboration.two++;
    else corroboration.one++;
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT, JSON.stringify({
    builtAt: new Date().toISOString(),
    previousBuild: builtBefore,
    source:
      `${FEEDS.length} defence and security publishers, read as RSS. Each was probed before being `
      + "added; outlets whose feeds did not answer are absent rather than listed and broken.",
    method:
      "Every item is tested twice — once against a military vocabulary and once against five "
      + "theme vocabularies — and kept only when both match, because 'AI' and 'drone' appear "
      + "constantly in civil reporting. Items whose headlines are near-duplicates are folded into "
      + "one story and the outlets behind it are counted, so a story's grade is the number of "
      + "independent newsrooms carrying it. The register accumulates across scheduled runs and "
      + "drops stories not seen for two years.",
    refusal:
      "Nothing here is written by this project. A story is a headline someone else published, the "
      + "outlets that published it, and what a keyword classifier made of it. No prose is "
      + "generated, no claim is verified, and a high corroboration count means many newsrooms "
      + "carried something — not that it is true.",
    engineNote:
      "GDELT was the intended backbone and refused: four queries at eight-second intervals all "
      + "returned 429 from GitHub's runners, after four more had done so at full speed. That is a "
      + "service which does not serve shared CI addresses, so the register grows by accumulation "
      + "over scheduled runs rather than by one large query.",
    cannotSay: [
      "Whether any story is true. The engine counts newsrooms; it cannot check a claim, and three outlets running the same agency copy is one source wearing three hats.",
      "What a country is actually doing with military AI. This is a register of what was reported in English-language defence media, which over-covers the United States and NATO and under-covers everyone else by a wide margin.",
      "Anything about the period before this register started. It accumulates forward from its first run and cannot see a story that was published before that.",
      "Which stories matter. Ordering is by corroboration and recency, both mechanical. Neither is a judgement about significance.",
    ],
    counts: {
      stories: stories.length,
      createdThisRun: created,
      corroboratedThisRun: merged,
      feedsAnswered: feedStatus.filter((f) => f.ok).length,
      feedsTried: FEEDS.length,
      itemsSeen: feedStatus.reduce((a, f) => a + f.items, 0),
      corroboration,
    },
    byTheme,
    byCountry: [...countryCounts.values()].sort((a, b) => b.n - a.n),
    feeds: feedStatus,
    stories,
  }, null, 2) + "\n", "utf8");

  console.log(
    `\nWrote ${OUT}: ${stories.length} stories (${created} new, ${merged} corroborated this run). `
    + `${corroboration.threePlus} carried by three or more newsrooms.`,
  );
}

if (isEntryPoint(import.meta.url)) {
  void main();
}
