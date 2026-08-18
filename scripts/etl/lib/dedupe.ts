/**
 * Near-duplicate detection for events.
 *
 * One development is reported by many outlets. Vizhinjam Port beginning EXIM
 * operations arrived three times on one run — three genuine, independent
 * reports of a single event, which the map rendered as a cluster of three.
 * The cluster count should mean "three things happened here", not "three
 * papers covered one thing".
 *
 * Two events are the same when they share a place and a date and their titles
 * overlap heavily. Titles are compared as word sets rather than as strings,
 * because outlets rewrite headlines rather than copy them.
 */
import type { DevEvent } from "../../../lib/types";

const STOPWORDS = new Set([
  "the","a","an","of","in","on","at","to","for","and","or","as","is","are","was","were",
  "with","by","from","its","it","after","over","new","first","says","said","will","be",
]);

export function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

/**
 * Overlap coefficient — shared tokens over the smaller set, 0 to 1.
 *
 * Jaccard was tried first and rejected: it divides by the union, so a longer
 * rewrite of the same headline scores lower purely for being longer. Three
 * outlets' versions of the Vizhinjam story scored 0.45 against each other and
 * survived as three pins. The overlap coefficient measures what these titles
 * actually share, which is the question being asked.
 */
export function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / Math.min(a.size, b.size);
}

/** Count of tokens present in both sets. */
export function sharedTokens(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

// Only ever applied to events already sharing a place and a date, so this can
// be looser than it would need to be on its own.
const SAME_STORY = 0.5;

/**
 * Ratio alone is unsafe on short titles: two unrelated three-word headlines
 * from the same city on the same day can share one generic word and clear 0.5.
 * Requiring three shared meaningful words as well means a collapse is always
 * backed by real overlap, not by arithmetic on a small set.
 */
const MIN_SHARED_TOKENS = 3;

/**
 * Collapse near-duplicates, preferring the most authoritative report.
 *
 * An official source wins over press; among equals the earliest report wins,
 * since that is the one that actually broke it.
 */
export function dedupeEvents(events: DevEvent[]): DevEvent[] {
  const kept: Array<{ event: DevEvent; tokens: Set<string> }> = [];

  const ordered = [...events].sort((a, b) => {
    if (a.status !== b.status) return a.status === "verified" ? -1 : 1;
    return a.date.localeCompare(b.date);
  });

  for (const e of ordered) {
    const tokens = titleTokens(e.title);
    const dup = kept.find(
      (k) =>
        k.event.placeId === e.placeId &&
        k.event.date === e.date &&
        similarity(k.tokens, tokens) >= SAME_STORY &&
        sharedTokens(k.tokens, tokens) >= MIN_SHARED_TOKENS,
    );
    if (!dup) kept.push({ event: e, tokens });
  }

  return kept.map((k) => k.event).sort((a, b) => b.date.localeCompare(a.date));
}
