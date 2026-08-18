/**
 * Ingest source registry.
 *
 * Everything the pipeline reads is declared here and nowhere else. Adding a
 * ministry or an outlet is a one-line change; no ingest code knows about any
 * particular publisher.
 *
 * `kind` decides how an item is labelled downstream, so trust is a property of
 * the source rather than a hardcoded list somewhere in the parser:
 *   `official` — the primary release itself (PIB, a ministry, ISRO). Marked
 *                `verified`, because it is the record, not a report of one.
 *   `press`    — a report of someone else's announcement. Marked `reported`,
 *                including the reputable outlets, because reputable and primary
 *                are different things.
 */

export type SourceKind = "official" | "press";

export interface FeedSource {
  id: string;
  name: string;
  feed: string;
  kind: SourceKind;
  /** Skipped when a feed is known to be down; keeps the URL on record. */
  disabled?: boolean;
}

/**
 * PIB feeds.
 *
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
  },
  {
    id: "pmindia",
    name: "PMO India",
    feed: "https://www.pmindia.gov.in/en/feed/",
    kind: "official",
  },
  {
    id: "isro",
    name: "ISRO",
    feed: "https://www.isro.gov.in/rss.xml",
    kind: "official",
    // 404 on the first live run; ISRO publishes no stable feed at this path.
    disabled: true,
  },
  {
    id: "mea",
    name: "Ministry of External Affairs",
    feed: "https://www.mea.gov.in/rss-feed.htm",
    kind: "official",
    // 403 even with a browser user-agent.
    disabled: true,
  },
];

export const PRESS_SOURCES: FeedSource[] = [
  {
    id: "theprint",
    name: "ThePrint",
    feed: "https://theprint.in/feed/",
    kind: "press",
    // Answers 200 with an interstitial rather than the feed, from CI ranges.
    disabled: true,
  },
  {
    id: "thehindu",
    name: "The Hindu",
    feed: "https://www.thehindu.com/news/national/feeder/default.rss",
    kind: "press",
  },
  {
    id: "thehindu-business",
    name: "The Hindu (Business)",
    feed: "https://www.thehindu.com/business/feeder/default.rss",
    kind: "press",
  },
  { id: "swarajya", name: "Swarajya", feed: "https://swarajyamag.com/feed", kind: "press" },
  { id: "opindia", name: "OpIndia", feed: "https://www.opindia.com/feed/", kind: "press" },
  {
    id: "ndtv",
    name: "NDTV",
    feed: "https://feeds.feedburner.com/ndtvnews-india-news",
    kind: "press",
  },
  {
    id: "indiatoday",
    name: "India Today",
    feed: "https://www.indiatoday.in/rss/1206578",
    kind: "press",
  },
  {
    id: "restofworld",
    name: "Rest of World",
    feed: "https://restofworld.org/feed/latest/",
    kind: "press",
  },
  {
    id: "economictimes",
    name: "Economic Times",
    feed: "https://economictimes.indiatimes.com/rssfeedstopstories.cms",
    kind: "press",
  },
  {
    id: "et-industry",
    name: "Economic Times (Industry)",
    feed: "https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms",
    kind: "press",
  },
  {
    id: "et-defence",
    name: "Economic Times (Defence)",
    feed: "https://economictimes.indiatimes.com/news/defence/rssfeeds/48781595.cms",
    kind: "press",
  },
  {
    id: "et-infra",
    name: "Economic Times (Infrastructure)",
    feed: "https://economictimes.indiatimes.com/industry/transportation/rssfeeds/13358350.cms",
    kind: "press",
  },
  {
    id: "et-energy",
    name: "Economic Times (Energy)",
    feed: "https://economictimes.indiatimes.com/industry/energy/rssfeeds/13358368.cms",
    kind: "press",
  },
  {
    id: "bs-economy",
    name: "Business Standard (Economy)",
    feed: "https://www.business-standard.com/rss/economy-102.rss",
    kind: "press",
  },
  {
    id: "thehindubusinessline",
    name: "BusinessLine",
    feed: "https://www.thehindubusinessline.com/economy/feeder/default.rss",
    kind: "press",
  },
  // Additional desks from the publishers that answered reliably on the first
  // live run — ET, BusinessLine, The Hindu and Business Standard between them
  // carried 138 of 138 items.
  {
    id: "et-cons-products",
    name: "Economic Times (Manufacturing)",
    feed: "https://economictimes.indiatimes.com/industry/cons-products/rssfeeds/13352306.cms",
    kind: "press",
  },
  {
    id: "et-tech",
    name: "Economic Times (Technology)",
    feed: "https://economictimes.indiatimes.com/tech/rssfeedstopstories.cms",
    kind: "press",
  },
  {
    id: "et-startups",
    name: "Economic Times (Startups)",
    feed: "https://economictimes.indiatimes.com/tech/startups/rssfeeds/78404506.cms",
    kind: "press",
  },
  {
    id: "et-economy",
    name: "Economic Times (Economy)",
    feed: "https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms",
    kind: "press",
  },
  {
    id: "et-foreign-trade",
    name: "Economic Times (Foreign Trade)",
    feed: "https://economictimes.indiatimes.com/news/economy/foreign-trade/rssfeeds/1977021501.cms",
    kind: "press",
  },
  {
    id: "bl-companies",
    name: "BusinessLine (Companies)",
    feed: "https://www.thehindubusinessline.com/companies/feeder/default.rss",
    kind: "press",
  },
  {
    id: "bl-logistics",
    name: "BusinessLine (Logistics)",
    feed: "https://www.thehindubusinessline.com/economy/logistics/feeder/default.rss",
    kind: "press",
  },
  {
    id: "bs-companies",
    name: "Business Standard (Companies)",
    feed: "https://www.business-standard.com/rss/companies-101.rss",
    kind: "press",
  },
  {
    id: "bs-industry",
    name: "Business Standard (Industry)",
    feed: "https://www.business-standard.com/rss/industry-217.rss",
    kind: "press",
  },
  {
    id: "thehindu-national",
    name: "The Hindu (Science & Tech)",
    feed: "https://www.thehindu.com/sci-tech/feeder/default.rss",
    kind: "press",
  },
  {
    id: "ndtv-business",
    name: "NDTV Profit",
    feed: "https://feeds.feedburner.com/ndtvprofit-latest",
    kind: "press",
  },
];

export const ALL_SOURCES: FeedSource[] = [...OFFICIAL_SOURCES, ...PRESS_SOURCES].filter(
  (s) => !s.disabled,
);

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
