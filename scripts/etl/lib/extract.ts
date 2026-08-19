/**
 * Article body extraction.
 *
 * A headline alone is a poor basis for categorising an event or locating it: a
 * story titled "Cabinet clears three projects" names its sector and its state
 * only in the body. This pulls enough of the body to classify against, without
 * a heavyweight readability dependency.
 *
 * The approach: cut everything that is definitely not prose (script, style,
 * nav, header, footer, aside, form), prefer a semantic container if the page
 * has one, then take the text of the paragraph cluster. Good enough for keyword
 * matching, which is all it feeds — this text is never published verbatim.
 */
import { getText } from "./http";
import { decodeEntities } from "./feed";

const STRIP_BLOCKS =
  /<(script|style|noscript|nav|header|footer|aside|form|svg|iframe)\b[\s\S]*?<\/\1>/gi;

/** Extract readable body text from an HTML document. */
export function extractText(html: string, maxChars = 4000): string {
  let doc = html.replace(STRIP_BLOCKS, " ");

  // Prefer a semantic container when the page provides one.
  const container =
    doc.match(/<article\b[\s\S]*?<\/article>/i)?.[0] ??
    doc.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ??
    doc;

  const paragraphs = [...container.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => decodeEntities((m[1] ?? "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim())
    // Drop boilerplate one-liners: cookie notices, bylines, share prompts.
    .filter((t) => t.length > 40);

  const text = paragraphs.join(" ");
  if (text.length >= 120) return text.slice(0, maxChars);

  // Fall back to the whole container when the page does not use <p> for prose.
  return decodeEntities(container.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars);
}

export interface ArticleResult {
  ok: boolean;
  text: string;
  error?: string;
  /** Where the fetch landed after redirects; the publisher, for aggregator links. */
  finalUrl?: string;
}

/**
 * Fetch and extract one article.
 *
 * Never throws and never blocks the run for long: a slow publisher costs one
 * timeout, not the pipeline. A failure here is not an error — the item simply
 * gets classified on its headline and summary alone.
 */
export async function fetchArticle(url: string, timeoutMs = 12_000): Promise<ArticleResult> {
  const res = await getText(url, {
    timeoutMs,
    retries: 1,
    cacheMs: 7 * 24 * 60 * 60 * 1000, // article bodies do not change
    accept: "text/html,application/xhtml+xml",
  });
  if (!res.ok || !res.data) return { ok: false, text: "", error: res.error };
  return { ok: true, text: extractText(res.data), finalUrl: res.finalUrl ?? url };
}
