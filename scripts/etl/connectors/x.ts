/**
 * X (Twitter) connector — official handles.
 *
 * X has no free read tier: the v2 API's free plan is write-only, and reading
 * timelines needs Basic ($200/month at the time of writing) or above. Scraping
 * the site instead would need an authenticated session and would breach the
 * terms of service.
 *
 * So this connector is token-gated. With `X_BEARER_TOKEN` set it pulls the
 * recent posts of the handles in `sources.ts` and turns the ones that name a
 * sector and a place into map events. Without it, it reports that it is
 * inactive and the pipeline carries on — the official PIB, PMO and ministry
 * feeds carry the same announcements, from the source those handles are
 * quoting.
 *
 * No post text is ever committed to the repository. Handles are configuration;
 * content is fetched at run time like every other feed.
 */
import type { DevEvent } from "../../../lib/types";
import { X_HANDLES } from "../../../lib/sources";
import { getJson } from "../lib/http";
import { categorise, locate, idFor } from "../lib/classify";

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
  /** Reason the connector did nothing, when inactive. */
  reason?: string;
}

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
      "X_BEARER_TOKEN not set — the X API has no free read tier, so this connector is inactive. " +
      "Official announcements still arrive via the PIB, PMO and ministry feeds.";
    log(`  inactive: ${reason}`);
    return { events: [], errors: [], active: false, handlesOk: 0, reason };
  }

  if (opts.dryRun) {
    log(`[dry-run] would read ${X_HANDLES.length} handles via the X API`);
    return { events: [], errors: [], active: true, handlesOk: 0 };
  }

  const errors: string[] = [];
  const events: DevEvent[] = [];
  let handlesOk = 0;

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
    return { events: [], errors: [reason], active: true, handlesOk: 0, reason };
  }

  const byUsername = new Map(userRes.data.data.map((u) => [u.username.toLowerCase(), u]));

  for (const handle of X_HANDLES) {
    const user = byUsername.get(handle.handle.toLowerCase());
    if (!user) {
      errors.push(`${handle.handle}: not resolved`);
      continue;
    }

    const res = await getJson<{ data?: XTweet[] }>(
      `${API}/users/${user.id}/tweets?max_results=50&tweet.fields=created_at&exclude=retweets,replies`,
      { headers: authHeaders(token), cacheMs: 30 * 60 * 1000, retries: 2 },
    );

    if (!res.ok) {
      // 429 is the normal state on the cheaper tiers; report it, do not fail.
      errors.push(`${handle.handle}: ${res.error}`);
      log(`  ${handle.handle.padEnd(22)} ${res.error}`);
      continue;
    }
    handlesOk++;

    const tweets = res.data?.data ?? [];
    let placed = 0;
    for (const t of tweets) {
      const category = categorise(t.text);
      if (!category) continue;
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

  return { events, errors, active: true, handlesOk };
}
