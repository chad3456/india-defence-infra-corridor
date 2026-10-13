/**
 * What is being reported in the last day, by topic. Cached for two minutes.
 *
 * Headlines from Google News's keyless RSS search, which aggregates many
 * outlets. A headline is a pointer to a report, not a fact: nothing here is
 * verified, nothing becomes a number on the site, and the page says so.
 */
import { NextResponse } from "next/server";
import { parseFeed, newestFirst } from "@/lib/feed-parse";
import { splitOutlet, type LiveHeadline } from "@/lib/live-shared";

export const revalidate = 120;
const TOPICS: Array<[string, string]> = [
  ["Economy", "India economy OR RBI OR inflation OR GDP OR rupee when:1d"],
  ["Markets", "Sensex OR Nifty OR \"stock market\" India when:1d"],
  ["Defence", "India defence OR \"Indian Army\" OR \"Indian Navy\" OR \"Indian Air Force\" when:1d"],
  ["Security", "India border OR LAC OR LoC OR terror OR Maoist when:1d"],
];

async function topic(name: string, q: string): Promise<LiveHeadline[]> {
  try {
    const r = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`, {
      headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" },
      signal: AbortSignal.timeout(6_000), next: { revalidate },
    });
    if (!r.ok) return [];
    return newestFirst(parseFeed(await r.text(), "Google News", "gnews")).slice(0, 25).map((it) => {
      const s = splitOutlet(it.title);
      return { title: s.title, outlet: s.outlet, url: it.url, published: it.published, topic: name };
    });
  } catch { return []; }
}

export async function GET(): Promise<NextResponse> {
  const lists = await Promise.all(TOPICS.map(([n, q]) => topic(n, q)));
  return NextResponse.json({
    fetchedAt: new Date().toISOString(),
    topics: Object.fromEntries(TOPICS.map(([n], i) => [n, lists[i]])),
    verified: false,
    note: "Headlines as aggregated by Google News in the last day. Reports, not facts; nothing here enters the site's record.",
  });
}
