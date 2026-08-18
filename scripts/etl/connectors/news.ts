/**
 * News tracker connector.
 *
 * Aggregates public RSS/Atom feeds from the outlets specified for this project.
 * Deliberately dependency-free: a regex reader over a well-formed feed is more
 * predictable here than pulling an XML parser, and every field is escaped before
 * it reaches the page.
 *
 * This is a *tracker*, not a data source. Nothing ingested here is ever promoted
 * into a chart series — headlines flag that a number may have moved, a human
 * then verifies against the primary release. That separation is the whole point:
 * press reports of government figures are tier-3 evidence.
 */
import type { NewsItem, DevEvent, EventCategory } from "../../../lib/types";
import { detectPlace } from "../../../lib/gazetteer";
import { getText } from "../lib/http";

export interface Outlet {
  id: string;
  name: string;
  feed: string;
}

export const OUTLETS: Outlet[] = [
  { id: "theprint", name: "ThePrint", feed: "https://theprint.in/feed/" },
  {
    id: "thehindu",
    name: "The Hindu",
    feed: "https://www.thehindu.com/news/national/feeder/default.rss",
  },
  { id: "swarajya", name: "Swarajya", feed: "https://swarajyamag.com/feed" },
  { id: "opindia", name: "OpIndia", feed: "https://www.opindia.com/feed/" },
  { id: "ndtv", name: "NDTV", feed: "https://feeds.feedburner.com/ndtvnews-india-news" },
  { id: "indiatoday", name: "India Today", feed: "https://www.indiatoday.in/rss/1206578" },
  { id: "restofworld", name: "Rest of World", feed: "https://restofworld.org/feed/latest/" },
  {
    id: "economictimes",
    name: "Economic Times",
    feed: "https://economictimes.indiatimes.com/rssfeedstopstories.cms",
  },
  {
    id: "et-industry",
    name: "Economic Times (Industry)",
    feed: "https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms",
  },
  { id: "pib", name: "Press Information Bureau", feed: "https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3" },
];

/**
 * Outlets whose reporting is treated as corroborated on ingest.
 *
 * Only government wire services qualify: PIB is the primary release itself, so
 * an item from it is the record rather than a report of one. Everything else is
 * marked `reported` and says so on the pin — including the outlets the brief
 * named, because "reputable" and "primary" are different things.
 */
const PRIMARY_OUTLETS = new Set(["pib"]);

/** Topic buckets. A headline can match several. */
const TOPIC_RULES: Array<{ topic: string; re: RegExp }> = [
  { topic: "defence", re: /\b(defence|defense|military|army|navy|air force|drdo|hal|missile|rafale|tejas|brahmos|submarine|warship)\b/i },
  { topic: "exports", re: /\b(export|exports|shipment|trade surplus|outbound)\b/i },
  { topic: "infrastructure", re: /\b(highway|expressway|metro|airport|port|corridor|bridge|railway|infrastructure|nhai)\b/i },
  { topic: "manufacturing", re: /\b(manufactur|factory|plant|production|pli scheme|make in india|semiconductor|assembly)\b/i },
  { topic: "space", re: /\b(isro|satellite|launch vehicle|pslv|gslv|space|gaganyaan|chandrayaan)\b/i },
  { topic: "economy", re: /\b(gdp|inflation|rbi|budget|fiscal|rupee|economy|growth rate)\b/i },
  { topic: "energy", re: /\b(solar|renewable|nuclear power|coal|electricity|grid|energy)\b/i },
];

/**
 * CDATA must be unwrapped BEFORE any tag stripping.
 *
 * `<[^>]*>` treats an entire `<![CDATA[ ... ]]>` block as one tag, because the
 * first `>` in it is the one closing `]]>`. Stripping first therefore deletes
 * the content instead of revealing it — which silently emptied every title in
 * the WordPress-style feeds (ThePrint, Swarajya, OpIndia) and dropped every
 * item on the first live pipeline run.
 */
function unwrapCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function decodeEntities(s: string): string {
  return unwrapCdata(s)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    // &amp; last, so "&amp;lt;" does not decode twice into a real tag.
    .replace(/&amp;/g, "&")
    .trim();
}

function stripTags(s: string): string {
  return decodeEntities(unwrapCdata(s).replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function pick(block: string, tags: string[]): string | null {
  for (const tag of tags) {
    const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
    if (m?.[1]) return m[1];
    // Atom self-closing link form.
    const self = block.match(new RegExp(`<${tag}[^>]*href=["']([^"']+)["'][^>]*/?>`, "i"));
    if (self?.[1]) return self[1];
  }
  return null;
}

export function parseFeedForTest(xml: string, outlet: Outlet): NewsItem[] {
  return parseFeed(xml, outlet);
}

function parseFeed(xml: string, outlet: Outlet): NewsItem[] {
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) ?? [];
  const items: NewsItem[] = [];

  for (const block of blocks) {
    const rawTitle = pick(block, ["title"]);
    const rawLink = pick(block, ["link"]);
    if (!rawTitle || !rawLink) continue;

    const title = stripTags(rawTitle);
    const url = decodeEntities(rawLink);
    if (!title || !/^https?:\/\//i.test(url)) continue;

    const rawDate = pick(block, ["pubDate", "published", "updated", "dc:date"]);
    const parsed = rawDate ? new Date(decodeEntities(rawDate)) : null;
    const publishedAt =
      parsed && !Number.isNaN(parsed.getTime())
        ? parsed.toISOString()
        : new Date().toISOString();

    const rawSummary = pick(block, ["description", "summary", "content"]);
    const summary = rawSummary ? stripTags(rawSummary).slice(0, 280) : undefined;

    const haystack = `${title} ${summary ?? ""}`;
    const topics = TOPIC_RULES.filter((r) => r.re.test(haystack)).map((r) => r.topic);

    // Only keep items relevant to this site's remit.
    if (topics.length === 0) continue;

    items.push({
      id: `${outlet.id}:${Buffer.from(url).toString("base64url").slice(0, 24)}`,
      title,
      url,
      outlet: outlet.name,
      publishedAt,
      summary,
      topics,
    });
  }
  return items;
}

/**
 * Event categorisation.
 *
 * Ordered: the first rule that matches wins, so a story about an airport
 * expressway lands in roads-airports rather than generic infrastructure.
 * Rules are deliberately narrow — an item matching none is kept as a headline
 * in the tracker but never becomes a map pin, because a mis-categorised pin is
 * worse than an absent one.
 */
const EVENT_RULES: Array<{ category: EventCategory; re: RegExp }> = [
  { category: "space", re: /\b(isro|pslv|gslv|lvm3|satellite launch|gaganyaan|chandrayaan|spadex|space station|in-space|skyroot|agnikul)\b/i },
  { category: "defence", re: /\b(drdo|hal |brahmos|tejas|agni-|akash missile|missile test|indian army|indian navy|indian air force|warship|submarine|frigate|destroyer|defence ministry|defence acquisition|defence corridor|ordnance|bharat dynamics|bharat electronics)\b/i },
  { category: "trade-deals", re: /\b(free trade agreement|\bfta\b|trade pact|trade deal|bilateral trade|cepa|ceca|trade agreement signed)\b/i },
  { category: "exports", re: /\b(export (record|order|deal|growth|surge)|exports (rose|rise|jump|surge|hit)|shipment to|first consignment)\b/i },
  { category: "pipelines", re: /\b(gas pipeline|oil pipeline|lng terminal|pipeline project|city gas distribution|gail )\b/i },
  { category: "ports", re: /\b(port|harbour|container terminal|transshipment|shipyard|jnpa|cargo terminal)\b/i },
  { category: "roads-airports", re: /\b(highway|expressway|airport|terminal building|runway|nhai|road project|flyover|udan|greenfield airport)\b/i },
  { category: "energy", re: /\b(solar|wind power|renewable|nuclear plant|nuclear reactor|power plant|transmission line|green hydrogen|electricity grid|battery storage)\b/i },
  { category: "startups", re: /\b(startup|start-up|unicorn|series [a-e] funding|seed round|venture capital|raises \$|funding round)\b/i },
  { category: "psu-msme", re: /\b(\bpsu\b|public sector undertaking|\bmsme\b|small enterprise|disinvestment|navratna|maharatna)\b/i },
  { category: "manufacturing", re: /\b(factory|manufacturing plant|semiconductor|chip fab|assembly line|production line|\bpli\b|make in india|new plant|foundry)\b/i },
  { category: "infrastructure", re: /\b(metro rail|metro line|railway|bullet train|smart city|water project|dam |bridge |urban development|infrastructure project)\b/i },
];

function categorise(text: string): EventCategory | null {
  for (const rule of EVENT_RULES) {
    if (rule.re.test(text)) return rule.category;
  }
  return null;
}

/**
 * Turn ingested headlines into map events.
 *
 * An item becomes an event only when it has BOTH a category and a place. That
 * is a deliberately high bar: the map's value is that every pin means
 * something specific happened somewhere specific.
 */
export function toEvents(items: NewsItem[], outletIds: Map<string, string>): DevEvent[] {
  const events: DevEvent[] = [];
  for (const item of items) {
    const text = `${item.title} ${item.summary ?? ""}`;
    const category = categorise(text);
    if (!category) continue;
    const place = detectPlace(text);
    if (!place) continue;

    events.push({
      id: item.id,
      title: item.title,
      category,
      date: item.publishedAt.slice(0, 10),
      placeId: place.id,
      placeName: place.name,
      state: place.state,
      coords: place.coords,
      outlet: item.outlet,
      url: item.url,
      summary: item.summary,
      status: PRIMARY_OUTLETS.has(outletIds.get(item.outlet) ?? "") ? "verified" : "reported",
    });
  }
  return events;
}

export interface NewsResult {
  items: NewsItem[];
  events: DevEvent[];
  errors: string[];
  outletsOk: number;
}

export async function runNews(
  opts: { dryRun?: boolean; onProgress?: (msg: string) => void } = {},
): Promise<NewsResult> {
  const errors: string[] = [];
  const all: NewsItem[] = [];
  let outletsOk = 0;

  // Sequential rather than parallel — polite to publishers, and the whole run
  // is well inside any reasonable CI budget.
  for (const outlet of OUTLETS) {
    if (opts.dryRun) {
      opts.onProgress?.(`[dry-run] would fetch ${outlet.name} — ${outlet.feed}`);
      continue;
    }
    const res = await getText(outlet.feed, {
      cacheMs: 15 * 60 * 1000,
      accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
    });
    if (!res.ok || !res.data) {
      errors.push(`${outlet.name}: ${res.error ?? "no body"}`);
      opts.onProgress?.(`  ${outlet.name.padEnd(14)} FAILED (${res.error})`);
      continue;
    }
    const items = parseFeed(res.data, outlet);
    all.push(...items);
    outletsOk++;
    opts.onProgress?.(`  ${outlet.name.padEnd(14)} ${items.length} relevant items`);
  }

  // Newest first, de-duplicated by URL.
  const seen = new Set<string>();
  const deduped = all
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .filter((i) => {
      if (seen.has(i.url)) return false;
      seen.add(i.url);
      return true;
    })
    .slice(0, 300);

  const outletIds = new Map(OUTLETS.map((o) => [o.name, o.id]));
  return { items: deduped, events: toEvents(deduped, outletIds), errors, outletsOk };
}
