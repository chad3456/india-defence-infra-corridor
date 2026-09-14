/**
 * What a probe can conclude from a response, and what it must not.
 *
 * Shared by the probes because the same three mistakes kept being made
 * independently in each of them.
 *
 * ── The mistake that cost the most ───────────────────────────────────────
 *
 * PIB's release archive answered a GET with 844 KB of HTML and a status 200,
 * and a probe recorded it as a source that could be crawled by date. It could
 * not: the page ignores its query string entirely and renders the same default
 * view for every date. A reachability probe cannot catch that, because every
 * individual answer is a genuine 200 with a plausible payload. Only asking
 * twice with different parameters and comparing the responses falsifies it.
 *
 * So `paired` is a first-class part of a target here. Any page that takes a
 * parameter gets asked for two different values, and the report says whether
 * the answers actually differed. A source that returns the same bytes for
 * 2016 and 2024 is not an archive; it is a landing page with a query string.
 *
 * ── The other two ────────────────────────────────────────────────────────
 *
 * A JavaScript application looks exactly like a page until you strip the tags
 * and find there is no prose underneath, so `shapeOf` measures that ratio
 * rather than trusting the content type.
 *
 * And a probe must publish counts, never values. A probe log that quotes a
 * figure beside a URL is a number with a filename where a citation should be,
 * and the next person to read it — including me — will treat it as sourced.
 * `countOf` exists so the answer to "does this page carry what we need" is a
 * number of matches and never one of the matches.
 */

export type Shape = "html" | "js-app" | "pdf" | "xml-feed" | "json" | "csv" | "empty";

export function shapeOf(body: string, contentType = ""): Shape {
  if (body.length < 200) return "empty";
  if (/^%PDF/.test(body) || /application\/pdf/i.test(contentType)) return "pdf";
  if (/^\s*[[{]/.test(body)) return "json";
  if (/<rss|<feed|<\?xml/i.test(body.slice(0, 600))) return "xml-feed";
  // A comma-delimited first line with no tags in the first kilobyte.
  const head = body.slice(0, 1000);
  if (!/</.test(head) && (head.match(/,/g)?.length ?? 0) > 3) return "csv";
  // A shell that ships no server-rendered prose is an application, not a page.
  const text = body.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ").trim();
  if (text.length < body.length / 40) return "js-app";
  return "html";
}

/** How many times a pattern matches. The count, never the matches. */
export function countOf(body: string, re: RegExp): number {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  return [...body.matchAll(g)].length;
}

/**
 * Whether two responses to different parameters are actually different.
 *
 * Byte length alone is not enough — PIB's three dates came back 844,412,
 * 844,413 and 844,416 bytes, which differ by a few bytes of timestamp and are
 * plainly the same page. So the comparison is on length within a tolerance and
 * on a cheap content fingerprint, and the verdict names which it was.
 */
export function differs(a: string, b: string): { differs: boolean; why: string } {
  if (a.length === 0 || b.length === 0) return { differs: false, why: "one response was empty" };
  const spread = Math.abs(a.length - b.length);
  const tol = Math.max(64, Math.round(Math.max(a.length, b.length) * 0.002));
  if (spread > tol) {
    return { differs: true, why: `${spread} bytes apart, beyond a ${tol}-byte tolerance` };
  }
  // Same size to within a rounding error. Fingerprint the middle, where a
  // page's data lives, rather than the chrome at either end.
  const mid = (s: string): string => s.slice(Math.floor(s.length * 0.3), Math.floor(s.length * 0.7));
  const same = mid(a) === mid(b);
  return same
    ? { differs: false, why: `same length to within ${tol} bytes and an identical middle — the parameter is ignored` }
    : { differs: true, why: "same length but different content" };
}
