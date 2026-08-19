/**
 * Event ingest.
 *
 * Two passes, deliberately:
 *
 *   1. Read every feed. Cheap, parallel-safe, gives title + summary.
 *   2. For items that look relevant, fetch the article body and re-classify
 *      against the full text. A headline like "Cabinet clears three projects"
 *      names neither its sector nor its state; the body does.
 *
 * The second pass is what turns a thin trickle of pins into real coverage, and
 * it is budgeted: a slow publisher costs one timeout, never the run.
 *
 * Nothing here is ever promoted into a chart series. Reported activity and
 * measured data stay separate — that separation is why the numbers on this site
 * can be trusted.
 */
import type { NewsItem, DevEvent } from "../../../lib/types";
import { ALL_SOURCES, type FeedSource } from "../../../lib/sources";
import { getText } from "../lib/http";
import { parseFeed, type RawItem } from "../lib/feed";
import { fetchArticle } from "../lib/extract";
import { categorise, locate, idFor, reportsAction } from "../lib/classify";

/** Topic tags for the headline tracker. An item can carry several. */
const TOPIC_RULES: Array<{ topic: string; re: RegExp }> = [
  { topic: "defence", re: /\b(defence|defense|military|army|navy|air force|drdo|missile|warship|submarine)\b/i },
  { topic: "exports", re: /\b(export|exports|shipment|trade surplus)\b/i },
  { topic: "infrastructure", re: /\b(highway|expressway|metro|airport|port|corridor|bridge|railway|infrastructure|nhai)\b/i },
  { topic: "manufacturing", re: /\b(manufactur|factory|plant|production|pli|make in india|semiconductor)\b/i },
  { topic: "space", re: /\b(isro|satellite|pslv|gslv|space|gaganyaan|chandrayaan)\b/i },
  { topic: "economy", re: /\b(gdp|inflation|rbi|budget|fiscal|rupee|economy)\b/i },
  { topic: "energy", re: /\b(solar|renewable|nuclear|coal|electricity|grid|energy|hydrogen)\b/i },
];

/**
 * Cheap pre-filter deciding which items are worth an article fetch.
 *
 * Broader than the category rules on purpose: this only decides what to spend a
 * request on, and being too strict here loses stories whose headline is vague
 * but whose body is exactly on topic — the case the second pass exists for.
 */
/** Per-feed item caps, so no single desk can crowd out the rest. */
const FEED_ITEM_CAP = 40;
const DISCOVERY_ITEM_CAP = 25;

const WORTH_FETCHING =
  /\b(project|projects|plant|factory|inaugurat|foundation stone|approved|approval|cabinet|commission|launch|launched|test|trial|order|contract|deal|agreement|mou|expansion|capacity|invest|crore|billion|export|corridor|terminal|highway|airport|port|metro|missile|satellite|semiconductor|solar|pipeline|startup|funding|unicorn)\b/i;

export interface IngestResult {
  items: NewsItem[];
  events: DevEvent[];
  errors: string[];
  sourcesOk: number;
  sourcesTotal: number;
  articlesFetched: number;
  /** Items that matched a sector but could not be placed — reported, not hidden. */
  unplaceable: number;
  /**
   * Where candidates were lost, so a low yield can be diagnosed from the run
   * log instead of guessed at. A drop concentrated in one stage is a rule to
   * fix; a drop spread evenly is just the world being uneventful.
   */
  funnel: {
    itemsSeen: number;
    candidates: number;
    noCategory: number;
    notAnAction: number;
    noPlace: number;
    events: number;
  };
}

interface Staged extends RawItem {
  source: FeedSource;
}

/**
 * Who to credit. A keyword-search feed carries the real publisher on each item;
 * a publisher's own desk is its own name. Crediting the aggregator would be the
 * one thing this site cannot do.
 */
function outletOf(s: Staged): string {
  return s.source.discovery && s.publisher ? s.publisher : s.source.name;
}

const AGGREGATOR_HOSTS = /(^|\.)news\.google\.com$/i;

function isAggregatorLink(url: string): boolean {
  try {
    return AGGREGATOR_HOSTS.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

export async function runIngest(
  opts: {
    dryRun?: boolean;
    onProgress?: (msg: string) => void;
    /** Cap on article bodies fetched per run. Keeps CI time bounded. */
    articleBudget?: number;
  } = {},
): Promise<IngestResult> {
  const log = opts.onProgress ?? (() => {});
  const errors: string[] = [];
  const staged: Staged[] = [];
  let sourcesOk = 0;

  /* ---------------- Pass 1: feeds ---------------- */

  for (const source of ALL_SOURCES) {
    if (opts.dryRun) {
      log(`[dry-run] would fetch ${source.name} — ${source.feed}`);
      continue;
    }
    const res = await getText(source.feed, {
      cacheMs: 15 * 60 * 1000,
      timeoutMs: 20_000,
      accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
    });
    if (!res.ok || !res.data) {
      errors.push(`${source.name}: ${res.error ?? "no body"}`);
      log(`  ${source.name.padEnd(34)} FAILED (${res.error})`);
      continue;
    }
    // A 200 that is not XML is usually an interstitial or a consent wall, not
    // an empty feed. Saying which one it is makes the difference between "this
    // publisher has no news" and "this publisher is blocking us".
    const looksLikeFeed = /<(rss|feed|rdf:RDF)\b/i.test(res.data.slice(0, 2000));
    const parsed = looksLikeFeed ? parseFeed(res.data) : [];
    if (parsed.length === 0) {
      const why = looksLikeFeed ? "feed had no items" : "response was not a feed (blocked or interstitial)";
      errors.push(`${source.name}: ${why}`);
      log(`  ${source.name.padEnd(34)} 0 items — ${why}`);
      continue;
    }
    sourcesOk++;
    // Cap per feed. Without it a single high-volume desk decides what the run
    // looks at, and the long tail of sector desks never gets a body fetch.
    const kept = parsed.slice(0, source.discovery ? DISCOVERY_ITEM_CAP : FEED_ITEM_CAP);
    for (const item of kept) staged.push({ ...item, source });
    log(`  ${source.name.slice(0, 40).padEnd(42)} ${kept.length} items`);
  }

  if (opts.dryRun) {
    return {
      items: [],
      events: [],
      errors,
      sourcesOk: 0,
      sourcesTotal: ALL_SOURCES.length,
      articlesFetched: 0,
      unplaceable: 0,
      funnel: { itemsSeen: 0, candidates: 0, noCategory: 0, notAnAction: 0, noPlace: 0, events: 0 },
    };
  }

  // De-duplicate by URL across sources, newest first.
  const seen = new Set<string>();
  const unique = staged
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .filter((s) => {
      if (seen.has(s.url)) return false;
      seen.add(s.url);
      return true;
    });

  /* ---------------- Headline tracker ---------------- */

  const items: NewsItem[] = [];
  for (const s of unique) {
    const hay = `${s.title} ${s.summary ?? ""}`;
    const topics = TOPIC_RULES.filter((r) => r.re.test(hay)).map((r) => r.topic);
    if (topics.length === 0) continue;
    items.push({
      id: idFor(s.source.id, s.url),
      title: s.title,
      url: s.url,
      outlet: outletOf(s),
      publishedAt: s.publishedAt,
      summary: s.summary,
      topics,
    });
  }

  /* ---------------- Pass 2: article bodies ---------------- */

  const budget = opts.articleBudget ?? 120;
  const candidates = unique.filter((s) => WORTH_FETCHING.test(`${s.title} ${s.summary ?? ""}`));
  log("");
  log(`  ${candidates.length} candidates worth a body fetch, budget ${budget}`);

  const events: DevEvent[] = [];
  let articlesFetched = 0;
  let unplaceable = 0;
  let notAnAction = 0;
  let noCategory = 0;

  for (const s of candidates) {
    const headlineText = `${s.title} ${s.summary ?? ""}`;

    // Classify on what we already have first; only spend a request when the
    // headline alone cannot both categorise and locate the story.
    let category = categorise(headlineText);
    let place = locate(s.title, s.summary ?? "");
    let body = "";
    let url = s.url;

    // An aggregator link is always fetched, even when the headline already
    // classifies: following it is the only way to cite the publisher rather
    // than the index that pointed at it.
    const mustResolve = isAggregatorLink(s.url);
    if ((!category || !place || mustResolve) && articlesFetched < budget) {
      const art = await fetchArticle(s.url);
      articlesFetched++;
      if (art.ok) {
        body = art.text;
        category ??= categorise(s.title, body);
        place ??= locate(s.title, body);
        if (art.finalUrl && !isAggregatorLink(art.finalUrl)) url = art.finalUrl;
      }
    }

    if (!category) {
      noCategory++;
      continue;
    }

    // A development is something that was done. Without a completed or
    // committed action in the headline or the lede, this is commentary,
    // analysis or a speech — not an event, and not a pin.
    if (!reportsAction(`${s.title} ${(s.summary ?? "") || body.slice(0, 600)}`)) {
      notAnAction++;
      continue;
    }

    if (!place) {
      unplaceable++;
      continue;
    }

    events.push({
      id: idFor(s.source.id, url),
      title: s.title,
      category,
      date: s.publishedAt.slice(0, 10),
      placeId: place.id,
      placeName: place.name,
      state: place.state,
      coords: place.coords,
      outlet: outletOf(s),
      url,
      // Prefer the feed's own summary; fall back to the opening of the body.
      summary: s.summary ?? (body ? body.slice(0, 280) : undefined),
      // Trust follows the source kind, not a hardcoded list.
      status: s.source.kind === "official" ? "verified" : "reported",
    });
  }

  log(`  fetched ${articlesFetched} article bodies`);
  log("");
  log("  funnel:");
  log(`    ${unique.length} unique items`);
  log(`    ${candidates.length} looked like developments`);
  log(`    -${noCategory} no sector matched`);
  log(`    -${notAnAction} commentary or incident, not an action`);
  log(`    -${unplaceable} had a sector but no place`);
  log(`    =${events.length} events`);
  log(
    `  ${events.length} events located · ${notAnAction} were commentary not action · ` +
      `${unplaceable} matched a sector but had no place`,
  );

  return {
    items: items.slice(0, 400),
    events,
    errors,
    sourcesOk,
    sourcesTotal: ALL_SOURCES.length,
    articlesFetched,
    unplaceable,
    funnel: {
      itemsSeen: unique.length,
      candidates: candidates.length,
      noCategory,
      notAnAction,
      noPlace: unplaceable,
      events: events.length,
    },
  };
}
