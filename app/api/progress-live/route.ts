/**
 * Live reporting for /white-pill: what is being reported on each theme in the
 * last three days, good news and bad. Cached for two minutes.
 *
 * Headlines from Google News's keyless RSS search. A headline is a pointer to
 * a report, not a fact: nothing here is verified, nothing becomes a number on
 * the site, and the page says so. The searches are neutral on purpose — a
 * progress tracker that only searched for good news would be advertising.
 */
import { NextResponse } from "next/server";
import { parseFeed, newestFirst } from "@/lib/feed-parse";
import { splitOutlet, type LiveHeadline } from "@/lib/live-shared";
import { LIVE_TOPICS } from "@/lib/white-pill";

export const revalidate = 120;

async function topic(name: string, q: string): Promise<LiveHeadline[]> {
  try {
    const r = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`, {
      headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" },
      signal: AbortSignal.timeout(6_000), next: { revalidate },
    });
    if (!r.ok) return [];
    return newestFirst(parseFeed(await r.text(), "Google News", "gnews")).slice(0, 12).map((it) => {
      const s = splitOutlet(it.title);
      return { title: s.title, outlet: s.outlet, url: it.url, published: it.published, topic: name };
    });
  } catch { return []; }
}

export async function GET(): Promise<NextResponse> {
  const lists = await Promise.all(LIVE_TOPICS.map(([n, q]) => topic(n, q)));
  return NextResponse.json({
    fetchedAt: new Date().toISOString(),
    topics: Object.fromEntries(LIVE_TOPICS.map(([n], i) => [n, lists[i]])),
    verified: false,
    note: "Headlines as aggregated by Google News in the last three days. Reports, not facts; nothing here enters the site's record.",
  });
}
