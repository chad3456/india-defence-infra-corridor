/**
 * Merging new events into the stored set.
 *
 * The map accumulates. A refresh that simply overwrote the file would show only
 * the last half hour, which is a ticker, not a tracker. So every run merges,
 * and the merge does three things beyond adding rows:
 *
 *   - Re-checks stored rows against the *current* rules. Ingest rules get
 *     tightened whenever a false pin turns up, and without this a row written
 *     under a looser rule stays on the map for ever. Seeded rows are
 *     hand-verified and exempt.
 *   - Collapses duplicate reports of one event, so three outlets covering one
 *     port commissioning is one pin.
 *   - Drops anything past the horizon. Beyond two years the map is history,
 *     not a tracker.
 *
 * Shared by the full pipeline and the half-hourly map refresh so the two can
 * never disagree about what the stored set should look like.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { DevEvent } from "../../../lib/types";
import { reportsAction } from "./classify";
import { dedupeEvents } from "./dedupe";

/** Two years. Beyond that the map is history, not a tracker. */
const HORIZON_DAYS = 730;

export interface MergeOutcome {
  events: DevEvent[];
  added: number;
  updated: number;
  staleDropped: number;
  collapsed: number;
  expired: number;
  /** True when nothing about the stored set changed, so nothing needs writing. */
  unchanged: boolean;
}

export async function readStoredEvents(root: string): Promise<DevEvent[]> {
  try {
    return JSON.parse(await readFile(join(root, "data/events.json"), "utf8")) as DevEvent[];
  } catch {
    return [];
  }
}

/** Stable key for "is this the same row", independent of key order. */
function fingerprint(e: DevEvent): string {
  return [e.id, e.title, e.category, e.date, e.placeId, e.outlet, e.url, e.status].join(" ");
}

export function mergeEvents(
  stored: DevEvent[],
  incoming: DevEvent[],
  now = Date.now(),
): MergeOutcome {
  const revalidated = stored.filter(
    (e) => e.id.startsWith("seed-") || reportsAction(`${e.title} ${e.summary ?? ""}`),
  );
  const staleDropped = stored.length - revalidated.length;

  const byId = new Map(revalidated.map((e) => [e.id, e]));
  let added = 0;
  let updated = 0;
  for (const e of incoming) {
    const prior = byId.get(e.id);
    if (!prior) added++;
    else if (fingerprint(prior) !== fingerprint(e)) updated++;
    byId.set(e.id, e);
  }

  const deduped = dedupeEvents([...byId.values()]);
  const collapsed = byId.size - deduped.length;

  const cutoff = new Date(now - HORIZON_DAYS * 86_400_000).toISOString().slice(0, 10);
  const events = deduped.filter((e) => e.date >= cutoff);
  const expired = deduped.length - events.length;

  // Compare against what was stored, not against the intermediate sets: a run
  // that re-reports the same stories must leave the file, and the git history,
  // untouched.
  const before = stored.map(fingerprint).sort().join("\n");
  const after = events.map(fingerprint).sort().join("\n");

  return {
    events,
    added,
    updated,
    staleDropped,
    collapsed,
    expired,
    unchanged: before === after,
  };
}
