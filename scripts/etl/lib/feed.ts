/**
 * Feed reading and parsing.
 *
 * Dependency-free by choice: a regex reader over a well-formed feed is more
 * predictable here than pulling an XML parser, and every field is escaped
 * before it reaches the page.
 *
 * CDATA is unwrapped BEFORE any tag stripping. `<[^>]*>` treats an entire
 * `<![CDATA[ ... ]]>` block as one tag, because the first `>` in it is the one
 * closing `]]>`. Stripping first therefore deletes the content instead of
 * revealing it — which silently emptied every title in the WordPress-style
 * feeds and dropped every item on the first live pipeline run.
 */

export interface RawItem {
  title: string;
  url: string;
  publishedAt: string;
  summary?: string;
}

export function unwrapCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

export function decodeEntities(s: string): string {
  return unwrapCdata(s)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    // &amp; last, so "&amp;lt;" does not decode twice into a real tag.
    .replace(/&amp;/g, "&")
    .trim();
}

export function stripTags(s: string): string {
  return decodeEntities(unwrapCdata(s).replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function pick(block: string, tags: string[]): string | null {
  for (const tag of tags) {
    const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
    if (m?.[1]) return m[1];
    // Atom self-closing link form.
    const self = block.match(new RegExp(`<${tag}[^>]*href=["']([^"']+)["'][^>]*/?>`, "i"));
    if (self?.[1]) return self[1];
  }
  return null;
}

export function parseFeed(xml: string): RawItem[] {
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) ?? [];
  const items: RawItem[] = [];

  for (const block of blocks) {
    const rawTitle = pick(block, ["title"]);
    const rawLink = pick(block, ["link", "guid"]);
    if (!rawTitle || !rawLink) continue;

    const title = stripTags(rawTitle);
    const url = decodeEntities(rawLink);
    if (!title || !/^https?:\/\//i.test(url)) continue;

    const rawDate = pick(block, ["pubDate", "published", "updated", "dc:date"]);
    const parsed = rawDate ? new Date(decodeEntities(rawDate)) : null;
    const publishedAt =
      parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();

    const rawSummary = pick(block, ["description", "summary", "content:encoded", "content"]);
    const summary = rawSummary ? stripTags(rawSummary).slice(0, 400) : undefined;

    items.push({ title, url, publishedAt, summary });
  }
  return items;
}
