/**
 * Reading items out of an RSS or Atom feed.
 *
 * Split out of the live route so it can be tested. The route cannot be: every
 * Indian government host is blocked from the machine this is written on, so
 * the only thing that can be checked here is whether the parser reads a feed
 * correctly once one arrives — which is also the only part likely to be wrong.
 * Reachability is already proven by the committed pipeline, which fetches
 * these same feeds from CI.
 */

export interface LiveItem {
  title: string;
  url: string;
  /** ISO, as the feed states it. Null when the feed gives no usable date. */
  published: string | null;
  outlet: string;
  sourceId: string;
}

/** One tag's text content, unescaped enough to read. */
export function tagText(xml: string, name: string): string | null {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(xml);
  if (!m) return null;
  const t = m[1]!
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return t === "" ? null : t;
}

/**
 * Items from either format.
 *
 * RSS uses <item> with the link in the element body; Atom uses <entry> with it
 * in an href attribute. The register carries both, so both are read rather
 * than one being assumed.
 */
export function parseFeed(xml: string, outlet: string, sourceId: string): LiveItem[] {
  const blocks = [
    ...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi),
    ...xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi),
  ].map((m) => m[0]);

  const out: LiveItem[] = [];
  for (const b of blocks) {
    const title = tagText(b, "title");
    if (title === null) continue;
    const url = tagText(b, "link") ?? /<link[^>]*href="([^"]+)"/i.exec(b)?.[1] ?? null;
    if (url === null) continue;
    const raw = tagText(b, "pubDate") ?? tagText(b, "published")
      ?? tagText(b, "updated") ?? tagText(b, "dc:date");
    const t = raw !== null ? Date.parse(raw) : NaN;
    out.push({
      title, url,
      published: Number.isFinite(t) ? new Date(t).toISOString() : null,
      outlet, sourceId,
    });
  }
  return out;
}

/**
 * Newest first, with undated items last.
 *
 * A feed that gives no date cannot claim to be the newest thing on the page,
 * and sorting an empty string high would put every undated item at the top.
 */
export function newestFirst(items: LiveItem[]): LiveItem[] {
  return [...items].sort((a, b) => {
    if (a.published === null && b.published === null) return 0;
    if (a.published === null) return 1;
    if (b.published === null) return -1;
    return b.published.localeCompare(a.published);
  });
}
