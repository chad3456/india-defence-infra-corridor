/**
 * X (Twitter) connector — official handles.
 *
 * READING X COSTS MONEY, PER POST. As of February 2026 X bills pay-per-use at
 * roughly $0.005 per post read; the free tier is closed to new developers and
 * the old $200/month Basic tier is closed to new signups. Scraping instead
 * would need an authenticated session and would breach the terms of service.
 *
 * So this connector is token-gated AND budgeted. Left at its defaults it reads
 * a few hundred posts a day, not a few hundred thousand:
 *
 *   - `X_MAX_POSTS_PER_HANDLE` (default 10) caps posts per handle per fetch.
 *   - Timelines are cached for 20 hours, so the connector effectively runs once
 *     a day even though the pipeline runs every six. Without this the same
 *     posts would be re-billed four times over.
 *   - Every run logs the reads it made and what they cost, so the bill is
 *     visible in the run log rather than at the end of the month.
 *
 * Without a token it reports itself inactive and the pipeline carries on. The
 * PIB, PMO and ministry feeds carry the same announcements, from the source
 * those handles are quoting, for nothing.
 *
 * No post text is ever committed to the repository. Handles are configuration;
 * content is fetched at run time like every other feed.
 */
import type { DevEvent } from "../../../lib/types";
import { X_HANDLES } from "../../../lib/sources";
import { getJson } from "../lib/http";
import { categorise, locate, idFor, reportsAction } from "../lib/classify";

const API = "https://api.x.com/2";

interface XUser {
  id: string;
  username: string;
  name: string;
}

interface XTweet {
  id: string;
  text: string;
  created_at: string;
}

export interface XResult {
  events: DevEvent[];
  errors: string[];
  active: boolean;
  handlesOk: number;
  /** Posts actually read from the API this run — what you are billed for. */
  postsRead: number;
  /** Estimated cost of this run, in US dollars. */
  estimatedCostUsd: number;
  /** Reason the connector did nothing, when inactive. */
  reason?: string;
}

/** X pay-per-use rate for a post read, February 2026. */
const USD_PER_POST_READ = 0.005;

/**
 * Timelines are cached for 20 hours rather than the pipeline's 6-hour cadence.
 * A cached response costs nothing; without this the same posts are re-billed on
 * every run of the day.
 */
const TIMELINE_CACHE_MS = 20 * 60 * 60 * 1000;

function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` };
}

export async function runX(
  opts: { dryRun?: boolean; onProgress?: (msg: string) => void } = {},
): Promise<XResult> {
  const log = opts.onProgress ?? (() => {});
  const token = process.env.X_BEARER_TOKEN;

  if (!token) {
    const reason =
      "X_BEARER_TOKEN not set — reading X is paid per post since February 2026, so this " +
      "connector is inactive. Official announcements still arrive via the PIB, PMO and " +
      "ministry feeds at no cost.";
    log(`  inactive: ${reason}`);
    return {
      events: [],
      errors: [],
      active: false,
      handlesOk: 0,
      postsRead: 0,
      estimatedCostUsd: 0,
      reason,
    };
  }

  const maxPerHandle = Math.max(5, Math.min(100, Number(process.env.X_MAX_POSTS_PER_HANDLE ?? 10)));

  if (opts.dryRun) {
    const worstCase = X_HANDLES.length * maxPerHandle;
    log(
      `[dry-run] would read up to ${worstCase} posts across ${X_HANDLES.length} handles ` +
        `(~$${(worstCase * USD_PER_POST_READ).toFixed(2)} at $${USD_PER_POST_READ}/read)`,
    );
    return { events: [], errors: [], active: true, handlesOk: 0, postsRead: 0, estimatedCostUsd: 0 };
  }

  const errors: string[] = [];
  const events: DevEvent[] = [];
  let handlesOk = 0;
  let postsRead = 0;

  // Resolve usernames to ids in one call — the API takes up to 100 at a time,
  // and this is far cheaper against the rate limit than one lookup per handle.
  const usernames = X_HANDLES.map((h) => h.handle).join(",");
  const userRes = await getJson<{ data?: XUser[]; errors?: unknown[] }>(
    `${API}/users/by?usernames=${encodeURIComponent(usernames)}`,
    { headers: authHeaders(token), cacheMs: 24 * 60 * 60 * 1000, retries: 2 },
  );

  if (!userRes.ok || !userRes.data?.data) {
    const reason = `handle lookup failed: ${userRes.error ?? "no data"}`;
    log(`  ${reason}`);
    return {
      events: [],
      errors: [reason],
      active: true,
      handlesOk: 0,
      postsRead: 0,
      estimatedCostUsd: 0,
      reason,
    };
  }

  const byUsername = new Map(userRes.data.data.map((u) => [u.username.toLowerCase(), u]));

  for (const handle of X_HANDLES) {
    const user = byUsername.get(handle.handle.toLowerCase());
    if (!user) {
      errors.push(`${handle.handle}: not resolved`);
      continue;
    }

    const res = await getJson<{ data?: XTweet[] }>(
      `${API}/users/${user.id}/tweets?max_results=${maxPerHandle}` +
        `&tweet.fields=created_at&exclude=retweets,replies`,
      { headers: authHeaders(token), cacheMs: TIMELINE_CACHE_MS, retries: 2 },
    );

    if (!res.ok) {
      // 429 is the normal state on the cheaper tiers; report it, do not fail.
      errors.push(`${handle.handle}: ${res.error}`);
      log(`  ${handle.handle.padEnd(22)} ${res.error}`);
      continue;
    }
    handlesOk++;

    const tweets = res.data?.data ?? [];
    // Only a live fetch is billed; a cache hit costs nothing.
    if (!res.fromCache) postsRead += tweets.length;
    let placed = 0;
    for (const t of tweets) {
      const category = categorise(t.text);
      if (!category) continue;
      // Same gate as the feed path: a post about a topic is not an event.
      if (!reportsAction(t.text)) continue;
      const place = locate(t.text, "");
      if (!place) continue;

      const url = `https://x.com/${user.username}/status/${t.id}`;
      events.push({
        id: idFor(`x-${user.username}`, url),
        // Posts run long and carry hashtags; keep a headline-length excerpt.
        title: t.text.replace(/\s+/g, " ").slice(0, 180),
        category,
        date: (t.created_at ?? new Date().toISOString()).slice(0, 10),
        placeId: place.id,
        placeName: place.name,
        state: place.state,
        coords: place.coords,
        outlet: `${handle.name} (X)`,
        url,
        summary: t.text.replace(/\s+/g, " ").slice(0, 280),
        // A minister's own post is an announcement, not a corroborated record:
        // it states intent as often as completion. Never graded verified.
        status: "reported",
      });
      placed++;
    }
    log(`  ${handle.handle.padEnd(22)} ${tweets.length} posts, ${placed} located`);
  }

  const estimatedCostUsd = postsRead * USD_PER_POST_READ;
  log(
    `  ${postsRead} posts read this run (~$${estimatedCostUsd.toFixed(3)}), ` +
      `${events.length} became events`,
  );

  return { events, errors, active: true, handlesOk, postsRead, estimatedCostUsd };
}
