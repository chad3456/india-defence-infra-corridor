/**
 * What the feeds are saying right now.
 *
 * The committed pipeline is the record: it runs on a schedule, validates what
 * it reads, cross-checks against primary sources, and only then writes. That
 * is what makes the site's numbers worth anything, and it is also why the
 * record is hours old — a six-hourly cron cannot be live and should not
 * pretend to be.
 *
 * This is the other half. It fetches the official feeds when someone asks,
 * caches for a minute, and returns what is on them at that moment. Nothing
 * here is verified, cross-checked or committed, and the page must label it
 * accordingly — a headline that arrived ninety seconds ago is fresher and
 * weaker than one the pipeline has been over.
 *
 * ── Why only the official feeds ──────────────────────────────────────────
 *
 * The full register is 89 feeds. Fetching all of them per request would make
 * the route slow enough that nobody waits for it, and would hammer 89
 * publishers on every page load. The official tier — PIB, the PMO, ministry
 * feeds — is small, is the tier whose claims are primary rather than
 * repeated, and is the one a reader most wants to see unfiltered.
 */
import { NextResponse } from "next/server";
import { OFFICIAL_SOURCES } from "@/lib/sources";
import { parseFeed, newestFirst, type LiveItem } from "@/lib/feed-parse";

/** A minute. Long enough to protect the publishers, short enough to be live. */
export const revalidate = 60;

/** No single slow feed may hold up the whole answer. */
const PER_FEED_TIMEOUT_MS = 6_000;
const MAX_ITEMS = 60;

async function readFeed(src: { id: string; name: string; feed: string }): Promise<LiveItem[]> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), PER_FEED_TIMEOUT_MS);
  try {
    const res = await fetch(src.feed, {
      signal: ctl.signal,
      headers: {
        // Several government feeds reject anything that identifies as a bot,
        // including for feeds published for the public to read.
        "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
      },
      next: { revalidate },
    });
    if (!res.ok) return [];
    return parseFeed(await res.text(), src.name, src.id);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(): Promise<NextResponse> {
  const fetchedAt = new Date().toISOString();
  const settled = await Promise.all(OFFICIAL_SOURCES.map((s) => readFeed(s)));

  const seen = new Set<string>();
  const items: LiveItem[] = [];
  for (const list of settled) {
    for (const it of list) {
      if (seen.has(it.url)) continue;
      seen.add(it.url);
      items.push(it);
    }
  }
  const answered = settled.filter((l) => l.length > 0).length;
  return NextResponse.json({
    fetchedAt,
    items: newestFirst(items).slice(0, MAX_ITEMS),
    /** Stated so a thin list reads as feeds being down, not as a quiet news day. */
    feedsAsked: OFFICIAL_SOURCES.length,
    feedsAnswered: answered,
    verified: false,
    note: "Straight from the publishers' feeds, uncorroborated. The committed record is the checked version.",
  });
}
