/**
 * Ingest source registry.
 *
 * Everything the pipeline reads is declared here and nowhere else. Adding a
 * ministry, a trade desk or a sector keyword is a one-line change; no ingest
 * code knows about any particular publisher.
 *
 * Three things are declared per feed:
 *
 * `kind` decides how an item is labelled downstream, so trust is a property of
 * the source rather than a hardcoded list somewhere in the parser:
 *   `official` — the primary release itself (PIB, PMO). Marked `verified`,
 *                because it is the record, not a report of one.
 *   `press`    — a report of someone else's announcement. Marked `reported`,
 *                including the reputable outlets, because reputable and primary
 *                are different things.
 *
 * `domains` says which sectors a feed is a useful source for. It does not
 * classify anything — the classifier still reads the story — but it is what
 * `npm run sources:verify` uses to prove every sector on the map is fed by at
 * least three independent working portals rather than resting on one desk that
 * might go dark.
 *
 * `discovery` marks a keyword-search feed. Those are built programmatically
 * from SECTOR_KEYWORDS below rather than pasted in, so widening coverage for a
 * sector means adding a phrase, not hand-writing another URL.
 */

import type { EventCategory } from "./types";

export type SourceKind = "official" | "press";

export interface FeedSource {
  id: string;
  name: string;
  feed: string;
  kind: SourceKind;
  /** Sectors this feed is expected to carry. Used by the coverage check. */
  domains: EventCategory[];
  /** A keyword search across many publishers rather than one publisher's desk. */
  discovery?: boolean;
  /**
   * The newsroom this feed represents, when the URL does not say.
   *
   * Set on site-scoped searches: a search restricted to swarajyamag.com is
   * Swarajya, and should count as Swarajya for sector coverage rather than as
   * an anonymous search.
   */
  publisherHost?: string;
  /** Skipped when a feed is known to be down; keeps the URL and the reason. */
  disabled?: boolean;
  note?: string;
}

const ALL_DOMAINS: EventCategory[] = [
  "startups",
  "infrastructure",
  "defence",
  "roads-airports",
  "pipelines",
  "exports",
  "trade-deals",
  "psu-msme",
  "manufacturing",
  "energy",
  "space",
  "ports",
];

/* ------------------------------------------------------------------ */
/* Official                                                            */
/* ------------------------------------------------------------------ */

/**
 * `Regid` is a PIB *regional office* code, not a ministry code — a wrong guess
 * on my part. The per-ministry feeds built from it returned valid XML with zero
 * items on the first live run, so they are gone rather than left generating
 * fourteen warnings a run. PIB's national feed carries every ministry's
 * releases anyway; the sector split happens in the classifier, not the source.
 */
export const OFFICIAL_SOURCES: FeedSource[] = [
  {
    id: "pib-national",
    name: "Press Information Bureau",
    feed: "https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3",
    kind: "official",
    domains: ALL_DOMAINS,
  },
  {
    id: "pmindia",
    name: "PMO India",
    feed: "https://www.pmindia.gov.in/en/feed/",
    kind: "official",
    domains: ALL_DOMAINS,
  },
  {
    id: "ddnews",
    name: "DD News",
    feed: "https://ddnews.gov.in/en/feed/",
    kind: "official",
    domains: ALL_DOMAINS,
    disabled: true,
    note: "Timed out on both probe runs of 2026-08-19; PIB and PMO carry the same releases.",
  },
  {
    id: "isro",
    name: "ISRO",
    feed: "https://www.isro.gov.in/rss.xml",
    kind: "official",
    domains: ["space"],
    disabled: true,
    note: "404 on the first live run; ISRO publishes no stable feed at this path.",
  },
  {
    id: "mea",
    name: "Ministry of External Affairs",
    feed: "https://www.mea.gov.in/rss-feed.htm",
    kind: "official",
    domains: ["trade-deals", "exports", "defence"],
    disabled: true,
    note: "403 even with a browser user-agent.",
  },
];

/* ------------------------------------------------------------------ */
/* Press desks                                                         */
/* ------------------------------------------------------------------ */

export const PRESS_SOURCES: FeedSource[] = [
  /* --- General national --- */
  {
    id: "thehindu",
    name: "The Hindu",
    feed: "https://www.thehindu.com/news/national/feeder/default.rss",
    kind: "press",
    domains: ["defence", "infrastructure", "roads-airports"],
  },
  {
    id: "thehindu-business",
    name: "The Hindu (Business)",
    feed: "https://www.thehindu.com/business/feeder/default.rss",
    kind: "press",
    domains: ["manufacturing", "trade-deals", "exports", "psu-msme"],
  },
  {
    id: "thehindu-scitech",
    name: "The Hindu (Science & Tech)",
    feed: "https://www.thehindu.com/sci-tech/feeder/default.rss",
    kind: "press",
    domains: ["space", "defence"],
  },
  {
    id: "ndtv",
    name: "NDTV",
    feed: "https://feeds.feedburner.com/ndtvnews-india-news",
    kind: "press",
    domains: ["defence", "infrastructure", "roads-airports"],
  },
  {
    id: "ndtv-business",
    name: "NDTV Profit",
    feed: "https://feeds.feedburner.com/ndtvprofit-latest",
    kind: "press",
    domains: ["manufacturing", "startups", "energy", "psu-msme"],
  },
  {
    id: "indiatoday",
    name: "India Today",
    feed: "https://www.indiatoday.in/rss/1206578",
    kind: "press",
    domains: ["defence", "infrastructure", "space"],
  },
  {
    id: "swarajya",
    name: "Swarajya",
    feed: "https://swarajyamag.com/feed",
    kind: "press",
    domains: ["defence", "infrastructure", "roads-airports", "space", "manufacturing"],
    disabled: true,
    note: "Parses as a feed but has returned zero items on every run since 2026-08-18.",
  },
  {
    id: "opindia",
    name: "OpIndia",
    feed: "https://www.opindia.com/feed/",
    kind: "press",
    domains: ["defence", "infrastructure"],
  },
  {
    id: "restofworld",
    name: "Rest of World",
    feed: "https://restofworld.org/feed/latest/",
    kind: "press",
    domains: ["startups", "manufacturing"],
  },
  {
    id: "theprint",
    name: "ThePrint",
    feed: "https://theprint.in/feed/",
    kind: "press",
    domains: ["defence", "infrastructure"],
    disabled: true,
    note: "Answers 200 with an interstitial rather than the feed, from CI ranges.",
  },

  /* --- Economic Times, main site and verticals --- */
  {
    id: "economictimes",
    name: "Economic Times",
    feed: "https://economictimes.indiatimes.com/rssfeedstopstories.cms",
    kind: "press",
    domains: ALL_DOMAINS,
  },
  {
    id: "et-defence",
    name: "Economic Times (Defence)",
    feed: "https://economictimes.indiatimes.com/news/defence/rssfeeds/48781595.cms",
    kind: "press",
    domains: ["defence"],
    disabled: true,
    note: "Parses as a feed but has returned zero items on every run since 2026-08-18.",
  },
  {
    id: "et-industry",
    name: "Economic Times (Industry)",
    feed: "https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms",
    kind: "press",
    domains: ["manufacturing", "psu-msme", "infrastructure"],
  },
  {
    id: "et-infra",
    name: "Economic Times (Transport)",
    feed: "https://economictimes.indiatimes.com/industry/transportation/rssfeeds/13358350.cms",
    kind: "press",
    domains: ["roads-airports", "ports", "infrastructure"],
  },
  {
    id: "et-energy",
    name: "Economic Times (Energy)",
    feed: "https://economictimes.indiatimes.com/industry/energy/rssfeeds/13358368.cms",
    kind: "press",
    domains: ["energy", "pipelines"],
  },
  {
    id: "et-cons-products",
    name: "Economic Times (Manufacturing)",
    feed: "https://economictimes.indiatimes.com/industry/cons-products/rssfeeds/13352306.cms",
    kind: "press",
    domains: ["manufacturing"],
  },
  {
    id: "et-tech",
    name: "Economic Times (Technology)",
    feed: "https://economictimes.indiatimes.com/tech/rssfeedstopstories.cms",
    kind: "press",
    domains: ["startups", "space", "manufacturing"],
  },
  {
    id: "et-startups",
    name: "Economic Times (Startups)",
    feed: "https://economictimes.indiatimes.com/tech/startups/rssfeeds/78404506.cms",
    kind: "press",
    domains: ["startups"],
    disabled: true,
    note: "Parses as a feed but has returned zero items on every run since 2026-08-18.",
  },
  {
    id: "et-economy",
    name: "Economic Times (Economy)",
    feed: "https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms",
    kind: "press",
    domains: ["trade-deals", "exports", "infrastructure"],
  },
  {
    id: "et-foreign-trade",
    name: "Economic Times (Foreign Trade)",
    feed: "https://economictimes.indiatimes.com/news/economy/foreign-trade/rssfeeds/1977021501.cms",
    kind: "press",
    domains: ["exports", "trade-deals"],
  },
  // ET's standalone B2B verticals. Same publisher, different newsrooms, and the
  // only desks that cover pipelines, ports and PSU procurement in any depth.
  {
    id: "etenergyworld",
    name: "ETEnergyWorld",
    feed: "https://energy.economictimes.indiatimes.com/rss/topstories",
    kind: "press",
    domains: ["energy", "pipelines"],
  },
  {
    id: "etinfra",
    name: "ETInfra",
    feed: "https://infra.economictimes.indiatimes.com/rss/topstories",
    kind: "press",
    domains: ["infrastructure", "roads-airports", "ports"],
  },
  {
    id: "etmanufacturing",
    name: "ET Manufacturing",
    feed: "https://manufacturing.economictimes.indiatimes.com/rss/topstories",
    kind: "press",
    domains: ["manufacturing", "psu-msme"],
  },
  {
    id: "etauto",
    name: "ETAuto",
    feed: "https://auto.economictimes.indiatimes.com/rss/topstories",
    kind: "press",
    domains: ["manufacturing", "exports"],
  },
  {
    id: "etgovernment",
    name: "ETGovernment",
    feed: "https://government.economictimes.indiatimes.com/rss/topstories",
    kind: "press",
    domains: ["infrastructure", "psu-msme", "defence"],
  },

  /* --- Business Standard --- */
  {
    id: "bs-economy",
    name: "Business Standard (Economy)",
    feed: "https://www.business-standard.com/rss/economy-102.rss",
    kind: "press",
    domains: ["trade-deals", "exports"],
  },
  {
    id: "bs-companies",
    name: "Business Standard (Companies)",
    feed: "https://www.business-standard.com/rss/companies-101.rss",
    kind: "press",
    domains: ["manufacturing", "psu-msme", "startups"],
  },
  {
    id: "bs-industry",
    name: "Business Standard (Industry)",
    feed: "https://www.business-standard.com/rss/industry-217.rss",
    kind: "press",
    domains: ["manufacturing", "energy", "infrastructure"],
  },

  /* --- BusinessLine --- */
  {
    id: "thehindubusinessline",
    name: "BusinessLine",
    feed: "https://www.thehindubusinessline.com/economy/feeder/default.rss",
    kind: "press",
    domains: ["trade-deals", "exports", "infrastructure"],
  },
  {
    id: "bl-companies",
    name: "BusinessLine (Companies)",
    feed: "https://www.thehindubusinessline.com/companies/feeder/default.rss",
    kind: "press",
    domains: ["manufacturing", "energy", "psu-msme"],
  },
  {
    id: "bl-logistics",
    name: "BusinessLine (Logistics)",
    feed: "https://www.thehindubusinessline.com/economy/logistics/feeder/default.rss",
    kind: "press",
    domains: ["ports", "roads-airports", "pipelines"],
  },

  /* --- Financial Express --- */
  {
    id: "fe-defence",
    name: "Financial Express (Defence)",
    feed: "https://www.financialexpress.com/business/defence/feed/",
    kind: "press",
    domains: ["defence"],
    disabled: true,
    note: "403 to the pipeline and to a browser user-agent (probed 2026-08-19).",
  },
  {
    id: "fe-infrastructure",
    name: "Financial Express (Infrastructure)",
    feed: "https://www.financialexpress.com/business/infrastructure/feed/",
    kind: "press",
    domains: ["infrastructure", "roads-airports", "ports"],
    disabled: true,
    note: "403 to the pipeline and to a browser user-agent (probed 2026-08-19).",
  },
  {
    id: "fe-industry",
    name: "Financial Express (Industry)",
    feed: "https://www.financialexpress.com/business/industry/feed/",
    kind: "press",
    domains: ["manufacturing", "psu-msme"],
    disabled: true,
    note: "403 to the pipeline and to a browser user-agent (probed 2026-08-19).",
  },

  /* --- Livemint --- */
  {
    id: "mint-companies",
    name: "Mint (Companies)",
    feed: "https://www.livemint.com/rss/companies",
    kind: "press",
    domains: ["manufacturing", "startups", "psu-msme"],
  },
  {
    id: "mint-economy",
    name: "Mint (Economy)",
    feed: "https://www.livemint.com/rss/economy",
    kind: "press",
    domains: ["trade-deals", "exports", "infrastructure"],
  },
  {
    id: "mint-science",
    name: "Mint (Science)",
    feed: "https://www.livemint.com/rss/science",
    kind: "press",
    domains: ["space"],
  },

  /* --- Sector trade press --- */
  {
    id: "idrw",
    name: "IDRW",
    feed: "https://idrw.org/feed/",
    kind: "press",
    domains: ["defence"],
  },
  {
    id: "bharatshakti",
    name: "Bharat Shakti",
    feed: "https://bharatshakti.in/feed/",
    kind: "press",
    domains: ["defence"],
  },
  {
    id: "raksha-anirveda",
    name: "Raksha Anirveda",
    feed: "https://raksha-anirveda.com/feed/",
    kind: "press",
    domains: ["defence"],
    disabled: true,
    note: "200 with an interstitial rather than the feed (probed 2026-08-19).",
  },
  {
    id: "mercom",
    name: "Mercom India",
    feed: "https://mercomindia.com/feed/",
    kind: "press",
    domains: ["energy"],
  },
  {
    id: "saurenergy",
    name: "Saur Energy",
    feed: "https://www.saurenergy.com/feed",
    kind: "press",
    domains: ["energy"],
    disabled: true,
    note: "404 at this path (probed 2026-08-19).",
  },
  {
    id: "pv-magazine-india",
    name: "pv magazine India",
    feed: "https://www.pv-magazine-india.com/feed/",
    kind: "press",
    domains: ["energy", "manufacturing"],
  },
  {
    id: "metrorailnews",
    name: "Metro Rail News",
    feed: "https://www.metrorailnews.in/feed/",
    kind: "press",
    domains: ["infrastructure", "roads-airports"],
  },
  {
    id: "constructionworld",
    name: "Construction World",
    feed: "https://www.constructionworld.in/rss.php",
    kind: "press",
    domains: ["infrastructure", "roads-airports"],
    disabled: true,
    note: "200 with an interstitial rather than the feed (probed 2026-08-19).",
  },
  {
    id: "maritimegateway",
    name: "Maritime Gateway",
    feed: "https://www.maritimegateway.com/feed/",
    kind: "press",
    domains: ["ports", "pipelines"],
  },
  {
    id: "inc42",
    name: "Inc42",
    feed: "https://inc42.com/feed/",
    kind: "press",
    domains: ["startups"],
  },
  {
    id: "entrackr",
    name: "Entrackr",
    feed: "https://entrackr.com/feed/",
    kind: "press",
    domains: ["startups"],
    disabled: true,
    note: "404 at this path (probed 2026-08-19).",
  },
  {
    id: "yourstory",
    name: "YourStory",
    feed: "https://yourstory.com/feed",
    kind: "press",
    domains: ["startups", "psu-msme"],
  },
/* --- National dailies and wires ------------------------------------- */
  { id: "hindustantimes", name: "Hindustan Times", feed: "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml", kind: "press", domains: ["defence", "infrastructure", "roads-airports"] },
  { id: "tribuneindia", name: "The Tribune", feed: "https://www.tribuneindia.com/rss/feed?catId=17", kind: "press", domains: ["defence", "infrastructure"] },
  { id: "deccanherald", name: "Deccan Herald", feed: "https://www.deccanherald.com/rss/national.rss", kind: "press", domains: ["defence", "infrastructure", "manufacturing"] },
  { id: "newindianexpress", name: "The New Indian Express", feed: "https://www.newindianexpress.com/Nation/rssfeed/?id=170&getXmlFeed=true", kind: "press", domains: ["defence", "infrastructure"] },
  { id: "telegraphindia", name: "The Telegraph India", feed: "https://www.telegraphindia.com/feeds/rss.jsp?id=3", kind: "press", domains: ["defence", "infrastructure"] },
  { id: "thestatesman", name: "The Statesman", feed: "https://www.thestatesman.com/feed", kind: "press", domains: ["defence", "infrastructure"] },
  { id: "deccanchronicle", name: "Deccan Chronicle", feed: "https://www.deccanchronicle.com/rss_feed/", kind: "press", domains: ["defence", "infrastructure"] },
  { id: "aninews", name: "ANI", feed: "https://www.aninews.in/rss/national-news.xml", kind: "press", domains: ["defence", "infrastructure", "trade-deals"] },
  { id: "news18", name: "News18", feed: "https://www.news18.com/rss/india.xml", kind: "press", domains: ["defence", "infrastructure"] },
  { id: "zeenews", name: "Zee News", feed: "https://zeenews.india.com/rss/india-national-news.xml", kind: "press", domains: ["defence", "infrastructure"] },
  { id: "firstpost", name: "Firstpost", feed: "https://www.firstpost.com/rss/india.xml", kind: "press", domains: ["defence", "trade-deals"] },
  { id: "wionews", name: "WION", feed: "https://www.wionews.com/feeds/rss/india-news", kind: "press", domains: ["defence", "trade-deals"] },
  { id: "indiatvnews", name: "India TV", feed: "https://www.indiatvnews.com/rssnews/topstory-india.xml", kind: "press", domains: ["defence", "infrastructure"] },
  { id: "theweek", name: "The Week", feed: "https://www.theweek.in/news/india.rss", kind: "press", domains: ["defence", "infrastructure"] },
  { id: "outlookindia", name: "Outlook India", feed: "https://www.outlookindia.com/rss/main/magazine", kind: "press", domains: ["defence", "infrastructure"] },
  { id: "scroll", name: "Scroll.in", feed: "https://scroll.in/feed", kind: "press", domains: ["defence", "infrastructure", "psu-msme"] },
  { id: "thewire", name: "The Wire", feed: "https://thewire.in/rss", kind: "press", domains: ["defence", "psu-msme"] },
  { id: "organiser", name: "Organiser", feed: "https://organiser.org/feed/", kind: "press", domains: ["defence", "infrastructure"] },
  { id: "moneycontrol", name: "Moneycontrol", feed: "https://www.moneycontrol.com/rss/latestnews.xml", kind: "press", domains: ["manufacturing", "startups", "energy", "psu-msme"] },
  { id: "rediff", name: "Rediff News", feed: "https://www.rediff.com/rss/newsrss.xml", kind: "press", domains: ["defence", "infrastructure"] },
  { id: "indiaspend", name: "IndiaSpend", feed: "https://www.indiaspend.com/feed", kind: "press", domains: ["defence", "psu-msme", "infrastructure"] },

  /* --- Defence and strategic-affairs specialists ------------------------ */
  { id: "defence-capital", name: "Defence.Capital", feed: "https://defence.capital/feed/", kind: "press", domains: ["defence"] },
  { id: "indiandefensenews", name: "Indian Defence News", feed: "https://www.indiandefensenews.in/feeds/posts/default?alt=rss", kind: "press", domains: ["defence"] },
  { id: "forceindia", name: "FORCE Magazine", feed: "https://forceindia.net/feed/", kind: "press", domains: ["defence"] },
  { id: "stratnewsglobal", name: "StratNews Global", feed: "https://stratnewsglobal.com/feed/", kind: "press", domains: ["defence", "trade-deals"] },
  { id: "defenceaviationpost", name: "Defence Aviation Post", feed: "https://www.defenceaviationpost.com/feed/", kind: "press", domains: ["defence"] },

  /* --- Regional desks, for theatres the national papers under-cover ----- */
  { id: "greaterkashmir", name: "Greater Kashmir", feed: "https://www.greaterkashmir.com/feed/", kind: "press", domains: ["defence", "infrastructure"] },
  { id: "dailyexcelsior", name: "Daily Excelsior", feed: "https://www.dailyexcelsior.com/feed/", kind: "press", domains: ["defence", "infrastructure"] },
  { id: "kashmirlife", name: "Kashmir Life", feed: "https://kashmirlife.net/feed/", kind: "press", domains: ["defence"] },
  { id: "risingkashmir", name: "Rising Kashmir", feed: "https://risingkashmir.com/feed", kind: "press", domains: ["defence"] },
  { id: "eastmojo", name: "EastMojo", feed: "https://www.eastmojo.com/feed/", kind: "press", domains: ["defence", "infrastructure"] },
];


/* ------------------------------------------------------------------ */
/* Keyword discovery                                                   */
/* ------------------------------------------------------------------ */

/**
 * Sector phrases, turned into search feeds at run time.
 *
 * A publisher's desk only carries what that desk wrote. A state-level plant
 * commissioning covered by one regional paper reaches the map through here or
 * not at all — which is the difference between eleven states on the map and
 * most of them.
 *
 * Phrases are quoted so the aggregator matches them intact; a bare `port`
 * matches Portugal, and a bare `corridor` matches wildlife corridors.
 */
export const SECTOR_KEYWORDS: Record<EventCategory, string[]> = {
  defence: ['"defence production"', '"defence export"', '"test-fired" India', '"inducted into" Indian Army'],
  space: ['ISRO launch', '"space startup" India', '"satellite" India launched'],
  "roads-airports": ['"national highway" inaugurated', '"new airport" India operational', '"expressway" opened India'],
  ports: ['"port" India commissioned cargo', '"container terminal" India'],
  pipelines: ['"gas pipeline" India commissioned', '"LNG terminal" India'],
  energy: ['"solar plant" India commissioned', '"nuclear power" India unit', '"transmission line" India charged'],
  manufacturing: ['"manufacturing plant" India inaugurated', '"semiconductor fab" India', '"PLI scheme" approved'],
  startups: ['India startup "raises" funding round', '"unicorn" India startup'],
  exports: ['India "record exports"', 'India export order signed'],
  "trade-deals": ['India "free trade agreement" signed', 'India "MoU signed" investment'],
  "psu-msme": ['"public sector undertaking" India order', 'MSME India cluster launched'],
  infrastructure: ['"foundation stone" India project', '"metro" India inaugurated', '"industrial park" India approved'],
};

/** Recency window applied to every keyword feed. Matches the map's 2-day mode. */
const DISCOVERY_WINDOW = "when:2d";

/**
 * Google News search RSS. No key, no quota, no account — a plain feed URL,
 * which is the only reason keyword discovery is affordable here at all. Items
 * carry `<source>`, so the real publisher survives the round trip.
 */
export function discoveryFeed(query: string): string {
  const q = encodeURIComponent(`${query} ${DISCOVERY_WINDOW}`);
  return `https://news.google.com/rss/search?q=${q}&hl=en-IN&gl=IN&ceid=IN:en`;
}

/**
 * Outlets worth keeping that no longer serve a usable feed.
 *
 * Financial Express answers 403 to everything, Swarajya's feed parses but has
 * been empty on every run, ThePrint serves an interstitial. Dropping them would
 * quietly remove desks this tracker was asked to follow, so each is reached
 * through a site-scoped search instead — the one mechanism here proven to
 * answer, and one that still credits the publisher, because the aggregator
 * names it on every item.
 *
 * This is a fallback, not a preference. A publisher's own feed is always better
 * and should be restored the moment it works again.
 */
const OUTLET_FALLBACKS: Array<{ id: string; name: string; host: string; domains: EventCategory[] }> = [
  {
    id: "swarajya",
    name: "Swarajya",
    host: "swarajyamag.com",
    domains: ["defence", "infrastructure", "roads-airports", "space", "manufacturing"],
  },
  {
    id: "theprint",
    name: "ThePrint",
    host: "theprint.in",
    domains: ["defence", "infrastructure"],
  },
  {
    id: "financialexpress",
    name: "Financial Express",
    host: "financialexpress.com",
    domains: ["defence", "infrastructure", "roads-airports", "manufacturing", "psu-msme"],
  },
  {
    id: "entrackr",
    name: "Entrackr",
    host: "entrackr.com",
    domains: ["startups"],
  },
  {
    id: "constructionworld",
    name: "Construction World",
    host: "constructionworld.in",
    domains: ["infrastructure", "roads-airports"],
  },
  {
    id: "raksha-anirveda",
    name: "Raksha Anirveda",
    host: "raksha-anirveda.com",
    domains: ["defence"],
  },
  {
    id: "saurenergy",
    name: "Saur Energy",
    host: "saurenergy.com",
    domains: ["energy"],
  },
];

export const FALLBACK_SOURCES: FeedSource[] = OUTLET_FALLBACKS.map((o) => ({
  id: `via-${o.id}`,
  name: o.name,
  feed: discoveryFeed(`site:${o.host}`),
  kind: "press" as const,
  domains: o.domains,
  discovery: true,
  publisherHost: o.host,
}));

/** One search feed per sector phrase, built rather than pasted. */
export const DISCOVERY_SOURCES: FeedSource[] = Object.entries(SECTOR_KEYWORDS).flatMap(
  ([domain, queries]) =>
    queries.map((query, i) => ({
      id: `find-${domain}-${i + 1}`,
      name: `Search: ${domain} — ${query.replace(/"/g, "")}`,
      feed: discoveryFeed(query),
      kind: "press" as const,
      domains: [domain as EventCategory],
      discovery: true,
    })),
);

/* ------------------------------------------------------------------ */

export const DECLARED_SOURCES: FeedSource[] = [
  ...OFFICIAL_SOURCES,
  ...PRESS_SOURCES,
  ...DISCOVERY_SOURCES,
  ...FALLBACK_SOURCES,
];

export const ALL_SOURCES: FeedSource[] = DECLARED_SOURCES.filter((s) => !s.disabled);

/** Feeds declared for a sector, whether or not they are currently reachable. */
export function sourcesForDomain(domain: EventCategory): FeedSource[] {
  return ALL_SOURCES.filter((s) => s.domains.includes(domain));
}

/**
 * Official X/Twitter handles worth following for announcements.
 *
 * Read by the X connector, which only runs when X_BEARER_TOKEN is set — the API
 * has no free read tier. These are handles, not content: no post text is ever
 * committed to the repository, it is fetched at run time like every other feed.
 */
export const X_HANDLES: Array<{ handle: string; name: string; kind: SourceKind }> = [
  { handle: "narendramodi", name: "Narendra Modi", kind: "official" },
  { handle: "PMOIndia", name: "PMO India", kind: "official" },
  { handle: "AmitShah", name: "Amit Shah", kind: "official" },
  { handle: "rajnathsingh", name: "Rajnath Singh", kind: "official" },
  { handle: "DefenceMinIndia", name: "Ministry of Defence", kind: "official" },
  { handle: "nitin_gadkari", name: "Nitin Gadkari", kind: "official" },
  { handle: "MORTHIndia", name: "Ministry of Road Transport", kind: "official" },
  { handle: "PiyushGoyal", name: "Piyush Goyal", kind: "official" },
  { handle: "CommerceMinIndia", name: "Ministry of Commerce", kind: "official" },
  { handle: "isro", name: "ISRO", kind: "official" },
  { handle: "DRDO_India", name: "DRDO", kind: "official" },
  { handle: "AshwiniVaishnaw", name: "Ashwini Vaishnaw", kind: "official" },
  { handle: "RailMinIndia", name: "Ministry of Railways", kind: "official" },
  { handle: "shipmin_india", name: "Ministry of Ports & Shipping", kind: "official" },
  { handle: "MoCA_GoI", name: "Ministry of Civil Aviation", kind: "official" },
  { handle: "mnreindia", name: "Ministry of New & Renewable Energy", kind: "official" },
  { handle: "PIB_India", name: "PIB India", kind: "official" },
];

/**
 * The live France riots tracker (/france-riots), October 2026.
 *
 * Kept apart from FEEDS: these are not sector feeds for the development map and
 * are not counted towards any sector's publisher floor. Every source is asked
 * at run time; nothing about a publisher is assumed to work until a run says so,
 * and a source that stops answering is shown as unavailable.
 */
export const FRANCE_RIOTS = {
  /** The story's start: the student protests that preceded the riots. Older items are another story. */
  since: "2026-10-01T00:00:00Z",
  /** The days the page opens on: Friday 16 to Sunday 18 October, Paris time (UTC+2). */
  focus: { from: "2026-10-15T22:00:00Z", to: "2026-10-18T22:00:00Z", label: "16–18 October" },
  /** Google News keyless RSS, asked in French and in English. */
  newsQueries: {
    fr: ["émeutes France", "manifestations violences France", "interpellations manifestation Paris", "Nuñez bilan manifestations", "mobilisation étudiants vie chère", "Paris casseurs pillages", "Paris violences nuit 17 octobre"],
    en: ["France riots", "France protests violence", "Paris protests arrests", "France student protests cost of living", "Paris riots looting", "Paris clashes police tear gas"],
  },
  /** Google News restricted to government sites: their own announcements, as indexed. */
  officialSites: ["interieur.gouv.fr", "elysee.fr", "info.gouv.fr", "prefecturedepolice.interieur.gouv.fr", "gendarmerie.interieur.gouv.fr"],
  /** Bing News RSS, asked for article addresses the job can read for officials' figures. */
  bingQueries: {
    fr: ["émeutes interpellations bilan", "violences manifestations ministre de l'Intérieur", "manifestation 17 octobre bilan blessés", "en direct manifestation 17 octobre", "Paris émeutes vidéos", "direct violences Paris manifestation",
      "magasins pillés 17 octobre", "émeutes coût dégâts assureurs", "émeutes Marseille pillages", "émeutes immigration accuse", "émeutes commerçants tourisme impact"],
    en: ["France riots arrests interior minister", "France protests injured police", "Paris riots damage", "France protests live updates", "Paris riots video", "Paris riots live",
      "France riots shops looted", "France riots cost damage insurers", "France riots blame immigration", "France riots economy tourism"],
  },
  /** GDELT DOC 2.0 query: multilingual, every outlet GDELT monitors. */
  gdeltQuery: '(émeutes OR émeutiers OR "riots" OR "rioters" OR "violences urbaines") (France OR Paris OR Lyon OR Marseille OR Bordeaux OR Lille OR Nantes OR Toulouse)',
  /**
   * Outlets' YouTube channels, by public handle; the scheduled job resolves each
   * to the channel id its feed needs, trying the handles in order.
   */
  youtube: [
    { handles: ["France24_en", "FRANCE24English", "france24english"], name: "FRANCE 24 English" },
    { handles: ["FRANCE24"], name: "FRANCE 24 (français)" },
    { handles: ["BFMTV"], name: "BFMTV" },
    { handles: ["franceinfo"], name: "franceinfo" },
    { handles: ["lemondefr", "LeMonde", "lemonde"], name: "Le Monde" },
    { handles: ["LeParisien"], name: "Le Parisien" },
    { handles: ["euronews"], name: "euronews" },
    { handles: ["euronewsfr"], name: "euronews (en français)" },
    { handles: ["Reuters"], name: "Reuters" },
    { handles: ["AP"], name: "Associated Press" },
    { handles: ["AFP", "afpnewsagency", "AFPTV", "afpfr"], name: "AFP" },
    { handles: ["aljazeeraenglish"], name: "Al Jazeera English" },
    { handles: ["guardiannews"], name: "Guardian News" },
    { handles: ["SkyNews"], name: "Sky News" },
    { handles: ["BBCNews"], name: "BBC News" },
    { handles: ["dwnews"], name: "DW News" },
  ],
  /**
   * X accounts searched for posts about the riots: French institutions, public
   * officials and newsrooms only. Private individuals are not searched, so the
   * tracker never names one. Read only with X_BEARER_TOKEN and within the
   * daily budget; only post ids are stored, never text.
   */
  xAccounts: [
    "Interieur_Gouv", "prefpolice", "PoliceNationale", "Gendarmerie", "Elysee", "EmmanuelMacron",
    "AFP", "afpfr", "Reuters", "FRANCE24", "France24_en", "BFMTV", "franceinfo", "lemondefr", "Le_Figaro", "le_Parisien", "euronews",
  ],
  /**
   * Public accounts on X whose posts about the riots a reader may want to follow:
   * institutions, politicians across the French parties, reporters filming on the
   * ground, and commentators abroad — chosen to span views, labelled by role,
   * never ranked. The page links to each account and to an X search of its posts;
   * it does not endorse what any of them says.
   */
  accounts: [
    { group: "French government and security forces", list: [
      ["EmmanuelMacron", "Emmanuel Macron", "President of the Republic"], ["SebLecornu", "Sébastien Lecornu", "Prime Minister"], ["NunezLaurent", "Laurent Nuñez", "Interior Minister"],
      ["Interieur_Gouv", "Ministère de l'Intérieur", "Interior Ministry"], ["prefpolice", "Préfecture de police", "Paris police prefecture"], ["PoliceNationale", "Police nationale", "National police"], ["Gendarmerie", "Gendarmerie nationale", "Gendarmerie"],
    ] },
    { group: "French politicians, across the parties", list: [
      ["J_Bardella", "Jordan Bardella", "Rassemblement national"], ["MLP_officiel", "Marine Le Pen", "Rassemblement national"], ["ZemmourEric", "Éric Zemmour", "Reconquête"], ["ECiotti", "Éric Ciotti", "UDR"],
      ["BrunoRetailleau", "Bruno Retailleau", "Les Républicains"], ["YaelBRAUNPIVET", "Yaël Braun-Pivet", "President of the National Assembly"], ["rglucks1", "Raphaël Glucksmann", "Place publique"],
      ["faureolivier", "Olivier Faure", "Parti socialiste"], ["JLMelenchon", "Jean-Luc Mélenchon", "La France insoumise"],
    ] },
    { group: "Reporters filming on the ground", list: [
      ["RemyBuisine", "Rémy Buisine", "Journalist, Brut"], ["ClementLanot", "Clément Lanot", "Freelance video journalist"],
    ] },
    { group: "Commentators and politicians abroad", list: [
      ["GadSaad", "Gad Saad", "Academic and commentator"], ["JDVance", "JD Vance", "US Vice President"], ["realDonaldTrump", "Donald Trump", "US President"], ["elonmusk", "Elon Musk", "Owner of X"],
      ["visegrad24", "Visegrád 24", "News aggregator account"], ["DrEliDavid", "Eli David", "Commentator"], ["WalidPhares", "Walid Phares", "Commentator"],
    ] },
  ],
  /** Newsrooms' round-the-clock live streams on YouTube, by the channel handle the job resolves. */
  liveStreams: [
    ["FRANCE24", "FRANCE 24 (français)"], ["France24_en", "FRANCE 24 English"], ["franceinfo", "franceinfo"], ["BFMTV", "BFMTV"], ["euronewsfr", "euronews (français)"],
    ["euronews", "euronews (English)"], ["aljazeeraenglish", "Al Jazeera English"], ["SkyNews", "Sky News"], ["dwnews", "DW News"],
  ],
  /** Public webcams and live searches: tourist and city cameras, not police CCTV, which is not public. */
  webcams: [
    { name: "Live streams from Paris, now (YouTube search)", url: "https://www.youtube.com/results?search_query=Paris+live&sp=EgJAAQ%253D%253D" },
    { name: "Live streams from Marseille, now (YouTube search)", url: "https://www.youtube.com/results?search_query=Marseille+live&sp=EgJAAQ%253D%253D" },
    { name: "Live streams from Lyon, now (YouTube search)", url: "https://www.youtube.com/results?search_query=Lyon+live&sp=EgJAAQ%253D%253D" },
    { name: "SkylineWebcams — Paris", url: "https://www.skylinewebcams.com/en/webcam/france/ile-de-france/paris.html" },
    { name: "EarthCam — Paris", url: "https://www.earthcam.com/world/france/paris/" },
    { name: "Viewsurf — French city webcams", url: "https://www.viewsurf.com/" },
  ],
  /** Foreign governments' travel advice for France: what they tell their citizens. */
  advisories: [
    { id: "uk-fcdo", name: "UK Foreign, Commonwealth & Development Office", url: "https://www.gov.uk/api/content/foreign-travel-advice/france", page: "https://www.gov.uk/foreign-travel-advice/france" },
  ],
} as const;
