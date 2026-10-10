/**
 * Orbital elements, fetched rather than committed.
 *
 * Everything else on this site is committed data, because the machine it is
 * built on cannot reach the sources. Element sets are the exception and the
 * reason is arithmetic: they go stale within days in low orbit, so a useful
 * copy would have to be re-committed daily, and at roughly two hundred
 * kilobytes a run that is seventy megabytes of git history a year to hold a
 * file whose only value is being current.
 *
 * So this fetches them, caches for six hours, and the page propagates from
 * whatever it gets. When a group does not answer, its satellites come from the
 * weekly last-known-good copy in data/live/tle-snapshot.json instead, and the
 * feed says so — `origin` is live, mixed or snapshot, and every record keeps
 * its own element-set age — so a failed fetch shows older orbits labelled as
 * older rather than an empty sky. CelesTrak asks callers to cache rather than poll; six
 * hours is well inside what an element set stays good for and means about
 * twenty requests a day rather than twenty per visitor.
 *
 * Which groups are carried, and why Starlink is not, is in lib/tle-source.ts.
 */
import { NextResponse } from "next/server";
import { epochAgeDays } from "@/lib/satellites-shared";
import { buildRecords, feedRequests, summarise, USER_AGENT, type SatRecord, type TleFeed } from "@/lib/tle-source";
import snapshot from "@/data/live/tle-snapshot.json";

export type { SatRecord, TleFeed };

/** Six hours. Elements do not change faster than this is worth asking. */
export const revalidate = 21_600;

async function fetchTle(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": USER_AGENT }, next: { revalidate } });
    if (!res.ok) return null;
    const text = await res.text();
    return text.includes("\n1 ") ? text : null;
  } catch {
    return null;
  }
}

export async function GET(): Promise<NextResponse> {
  const now = new Date();
  const requests = feedRequests();
  const texts = await Promise.all(requests.map((r) => fetchTle(r.url)));
  const answers = requests.flatMap((r, i) => (texts[i] ? [{ label: r.label, text: texts[i]! }] : []));
  const failed = requests.filter((_, i) => !texts[i]).map((r) => r.key);
  const live = buildRecords(answers, now);

  // Groups that did not answer are filled from the weekly snapshot, with each
  // record's age recomputed against now so an old orbit reads as old.
  const snap = snapshot as TleFeed;
  const failedLabels = new Set(requests.filter((_, i) => !texts[i]).map((r) => r.label));
  const have = new Set(live.map((s) => s.noradId));
  const filled = snap.satellites
    .filter((s) => failedLabels.has(s.group) && !have.has(s.noradId))
    .map((s) => ({ ...s, epochAgeDays: epochAgeDays(s.line1, now) }));
  const satellites = [...live, ...filled];

  // An empty answer must not render as "nothing is up there".
  if (satellites.length === 0) {
    return NextResponse.json(
      { error: "CelesTrak returned nothing for any group, and there is no snapshot to fall back on", failed, satellites: [] },
      { status: 502 },
    );
  }

  const feed: TleFeed = {
    fetchedAt: now.toISOString(),
    source: "CelesTrak GP, https://celestrak.org",
    origin: filled.length === 0 ? "live" : live.length === 0 ? "snapshot" : "mixed",
    snapshotAt: filled.length > 0 ? snap.snapshotAt : null,
    satellites,
    ...summarise(satellites),
    failed,
  };
  return NextResponse.json(feed);
}
