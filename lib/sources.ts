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
 * PIB serves one feed per ministry. `Regid` selects the ministry; the ids below
 * are the ones whose output is relevant to this site. A dead id simply returns
 * nothing and is reported as a connector warning — no code change needed.
 */
const PIB = (regid: number, name: string): FeedSource => ({
  id: `pib-${regid}`,
  name: `PIB — ${name}`,
  feed: `https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=${regid}`,
  kind: "official",
});

export const OFFICIAL_SOURCES: FeedSource[] = [
  {
    id: "pib-all",
    name: "Press Information Bureau",
    feed: "https://www.pib.gov.in/ViewRss.aspx?reg=1&lang=1",
    kind: "official",
  },
  PIB(3, "Defence"),
  PIB(13, "Road Transport & Highways"),
  PIB(15, "Civil Aviation"),
  PIB(24, "Ports, Shipping & Waterways"),
  PIB(30, "Railways"),
  PIB(36, "Power"),
  PIB(38, "New & Renewable Energy"),
  PIB(42, "Commerce & Industry"),
  PIB(46, "Petroleum & Natural Gas"),
  PIB(52, "Science & Technology"),
  PIB(58, "Space"),
  PIB(62, "Heavy Industries"),
  PIB(69, "Electronics & IT"),
  PIB(78, "MSME"),
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
  },
  {
    id: "mea",
    name: "Ministry of External Affairs",
    feed: "https://www.mea.gov.in/rss-feed.htm",
    kind: "official",
  },
];

export const PRESS_SOURCES: FeedSource[] = [
  { id: "theprint", name: "ThePrint", feed: "https://theprint.in/feed/", kind: "press" },
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
