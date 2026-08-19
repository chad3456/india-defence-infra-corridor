import type { FeedSource } from "../../../lib/sources";

/**
 * Which newsroom a feed belongs to.
 *
 * Sector coverage is counted in publishers, not feeds. Six Economic Times desks
 * are one newsroom's editorial judgement six times over: if ET goes down, all
 * six go with it, so counting them as six sources would report a resilience the
 * map does not have.
 *
 * Registered-domain-ish — the last two labels of the host, with the common
 * multi-label public suffixes folded in. Good enough to tell ET's desks apart
 * from six different publishers, which is all it is for.
 */
export function publisherOf(source: Pick<FeedSource, "id" | "feed" | "discovery">): string {
  // Each search feed reaches many publishers, but which ones is not knowable
  // until it runs, so it counts as its own source rather than as any of them.
  if (source.discovery) return `search:${source.id}`;
  try {
    const host = new URL(source.feed).hostname.replace(/^www\./, "");
    const parts = host.split(".");
    const suffix = parts.slice(-2).join(".");
    const multi = /^(co|com|net|org|gov|ac)\.(in|uk)$/.test(suffix);
    return parts.slice(multi ? -3 : -2).join(".");
  } catch {
    return source.id;
  }
}
