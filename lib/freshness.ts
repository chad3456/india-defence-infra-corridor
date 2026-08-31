/**
 * How current the map actually is.
 *
 * The map reads events the ingest workflow commits, and the workflow is
 * scheduled every thirty minutes. It does not run every thirty minutes. Over
 * the last fifteen scheduled runs the gaps were 117 minutes at best, 708 at
 * worst, with a median of 269 — GitHub deprioritises frequent cron schedules,
 * and a half-hourly schedule on a non-default branch is among the first
 * things it drops.
 *
 * That gap between the promise and the delivery is the thing worth exposing. A
 * map with no timestamp reads as live, and a reader has no way to tell whether
 * a quiet map means a quiet day or a pipeline that stopped four hours ago. So
 * the age is computed from what the last run actually wrote and shown on the
 * page, with a threshold beyond which the page says so plainly rather than
 * letting a stale map speak for itself.
 */
import refresh from "@/data/live/last-refresh.json";

export interface RefreshState {
  /** When the ingest last began, as the run recorded it. */
  startedAt: string;
  /** Minutes since then. */
  ageMinutes: number;
  /** Feeds that answered, and how many were tried. */
  feedsOk: number;
  feedsTotal: number;
  /** Events added and updated on that run. */
  added: number;
  updated: number;
  /** Events held on the map. */
  total: number;
  /** True when the data is older than a reader should assume. */
  stale: boolean;
  /** A short human phrase: "14 minutes ago", "4 hours ago". */
  ago: string;
}

/**
 * Past this, the page says the map is behind.
 *
 * Set from the observed median rather than the scheduled interval. Warning at
 * thirty minutes would mean warning almost always, which trains a reader to
 * ignore it; six hours is beyond the worst normal gap and so means something.
 */
const STALE_AFTER_MINUTES = 6 * 60;

function phrase(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${Math.round(minutes)} minute${Math.round(minutes) === 1 ? "" : "s"} ago`;
  const hours = minutes / 60;
  if (hours < 48) return `${Math.round(hours)} hour${Math.round(hours) === 1 ? "" : "s"} ago`;
  return `${Math.round(hours / 24)} days ago`;
}

interface RefreshFile {
  startedAt?: string;
  feedsOk?: number;
  feedsTotal?: number;
  added?: number;
  updated?: number;
  total?: number;
}

export function refreshState(now: Date = new Date()): RefreshState | null {
  const f = refresh as RefreshFile;
  if (!f.startedAt) return null;
  const started = new Date(f.startedAt);
  if (Number.isNaN(started.getTime())) return null;

  const ageMinutes = Math.max(0, (now.getTime() - started.getTime()) / 60_000);
  return {
    startedAt: f.startedAt,
    ageMinutes,
    feedsOk: f.feedsOk ?? 0,
    feedsTotal: f.feedsTotal ?? 0,
    added: f.added ?? 0,
    updated: f.updated ?? 0,
    total: f.total ?? 0,
    stale: ageMinutes > STALE_AFTER_MINUTES,
    ago: phrase(ageMinutes),
  };
}

export const STALE_THRESHOLD_HOURS = STALE_AFTER_MINUTES / 60;
