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
import { categorise, locate, idFor } from "../lib/classify";

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
}

interface Staged extends RawItem {
  source: FeedSource;
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
    for (const item of parsed) staged.push({ ...item, source });
    log(`  ${source.name.padEnd(34)} ${parsed.length} items`);
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
      outlet: s.source.name,
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

  for (const s of candidates) {
    const headlineText = `${s.title} ${s.summary ?? ""}`;

    // Classify on what we already have first; only spend a request when the
    // headline alone cannot both categorise and locate the story.
    let category = categorise(headlineText);
    let place = locate(s.title, s.summary ?? "");
    let body = "";

    if ((!category || !place) && articlesFetched < budget) {
      const art = await fetchArticle(s.url);
      articlesFetched++;
      if (art.ok) {
        body = art.text;
        category ??= categorise(s.title, body);
        place ??= locate(s.title, body);
      }
    }

    if (!category) continue;
    if (!place) {
      unplaceable++;
      continue;
    }

    events.push({
      id: idFor(s.source.id, s.url),
      title: s.title,
      category,
      date: s.publishedAt.slice(0, 10),
      placeId: place.id,
      placeName: place.name,
      state: place.state,
      coords: place.coords,
      outlet: s.source.name,
      url: s.url,
      // Prefer the feed's own summary; fall back to the opening of the body.
      summary: s.summary ?? (body ? body.slice(0, 280) : undefined),
      // Trust follows the source kind, not a hardcoded list.
      status: s.source.kind === "official" ? "verified" : "reported",
    });
  }

  log(`  fetched ${articlesFetched} article bodies`);
  log(`  ${events.length} events located, ${unplaceable} matched a sector but had no place`);

  return {
    items: items.slice(0, 400),
    events,
    errors,
    sourcesOk,
    sourcesTotal: ALL_SOURCES.length,
    articlesFetched,
    unplaceable,
  };
}
