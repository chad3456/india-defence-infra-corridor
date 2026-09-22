/**
 * Reading a committed EPUB.
 *
 * Two of the books in `data/` are commercial titles, and the rule this file
 * exists to enforce is that a connector reads them to VERIFY facts rather than
 * to copy them. Nothing here returns a whole chapter to a caller that wants to
 * publish it: the useful export is `locate`, which answers "does this sentence
 * appear in this book, and on what page" — which is what a citation needs and
 * is not a substitute for the book.
 *
 * ── Page anchors ─────────────────────────────────────────────────────────
 *
 * Calibre-produced EPUBs carry the print pagination as empty elements with
 * `id="page_NN"`. Those are the only reason a citation here can name a page
 * rather than a chapter, so they are converted to inline markers before the
 * tags are stripped, and `locate` walks backwards from a match to the nearest
 * one. A claim that cannot be placed on a page is reported as such rather than
 * given the chapter's first page, which would be a fabricated citation.
 */
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

export interface Chapter { id: string; label: string; text: string }

/** Tags out, page anchors kept as `[[pNN]]`, whitespace collapsed. */
export function plainText(xhtml: string): string {
  let s = xhtml.replace(/<[^>]*id="page_(\d+)"[^>]*\/?>/g, " [[p$1]] ");
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<\/(p|div|h\d|li|tr)>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8216;|&lsquo;/g, "‘").replace(/&quot;|&#8220;|&#8221;/g, '"')
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)));
  return s.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
}

/** The one EPUB in a directory, by a distinguishing fragment of its filename. */
export function findBook(dir: string, nameFragment: string): string {
  const hit = readdirSync(dir).find(
    (f) => f.toLowerCase().endsWith(".epub") && f.toLowerCase().includes(nameFragment.toLowerCase()),
  );
  if (!hit) throw new Error(`No EPUB matching "${nameFragment}" in ${dir}. This connector reads a committed book, not a feed.`);
  return join(dir, hit);
}

/** Named chapters out of an EPUB, by their internal paths. */
export function readChapters(epubPath: string, map: Record<string, string>): Chapter[] {
  return Object.entries(map).map(([id, label]) => {
    const raw = execFileSync("unzip", ["-p", epubPath, `OEBPS/${id}.xhtml`], {
      encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
    });
    return { id, label, text: plainText(raw) };
  });
}

/**
 * Normalise for matching, not for display.
 *
 * Typographic apostrophes, non-breaking spaces and en-dashes all differ
 * between what a reader copies out of a book and what the file holds, and a
 * verification that fails on a curly quote teaches nothing. Case and
 * punctuation go; word order and spelling stay, because those are what is
 * being checked.
 */
export function norm(s: string): string {
  return s
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/ /g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9' -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface Located {
  found: boolean;
  chapter: string;
  chapterLabel: string;
  /** Print page from the nearest preceding anchor, or null if none precedes it. */
  page: number | null;
}

/**
 * Where a phrase sits in the book.
 *
 * Returns the chapter and the print page, or `found: false`. A caller that
 * wants to publish a claim sourced to this book must get `found: true` back
 * first, which is the whole point: a curated fact that no longer matches the
 * text it was taken from stops being publishable rather than quietly ageing.
 */
export function locate(chapters: Chapter[], phrase: string): Located {
  const needle = norm(phrase);
  for (const ch of chapters) {
    const hay = norm(ch.text);
    const at = hay.indexOf(needle);
    if (at < 0) continue;
    /*
     * Walk back through the ORIGINAL text to the nearest page anchor. The
     * normalised string has different offsets, so the anchor is found in the
     * normalised text instead. `[[p75]]` loses its brackets to spaces and
     * survives as the bare token `p75`, which is what the pattern matches —
     * deliberately without allowing a space, so a sentence containing "p 75"
     * cannot be mistaken for a page anchor.
     */
    const before = hay.slice(0, at);
    const anchors = [...before.matchAll(/\bp(\d{1,4})\b/g)];
    const lastAnchor = anchors[anchors.length - 1];
    const page = lastAnchor ? Number.parseInt(lastAnchor[1] ?? "", 10) : null;
    return {
      found: true, chapter: ch.id, chapterLabel: ch.label,
      page: Number.isFinite(page) ? page : null,
    };
  }
  return { found: false, chapter: "", chapterLabel: "", page: null };
}
