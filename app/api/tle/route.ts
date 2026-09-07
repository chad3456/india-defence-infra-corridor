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
 * whatever it gets. CelesTrak asks callers to cache rather than poll; six
 * hours is well inside what an element set stays good for and means about
 * twenty requests a day rather than twenty per visitor.
 *
 * The full active catalogue is 16,032 objects and 2.7 MB, of which 10,721 are
 * Starlink. Carrying all of it would mean propagating sixteen thousand orbits
 * per tick in a browser to answer a question about a few hundred. So this
 * carries the groups that bear on the question — what is overhead, what is
 * looking down, what is parked above — plus India's own fleet.
 */
import { NextResponse } from "next/server";
import { parseTle, epochAgeDays, isIndianSatellite, INDIAN_PREFIXES } from "@/lib/satellites-shared";

/** Six hours. Elements do not change faster than this is worth asking. */
export const revalidate = 21_600;

const GP = "https://celestrak.org/NORAD/elements/gp.php";

/**
 * The groups worth carrying, and why each one is here.
 *
 * `starlink` is deliberately absent. It is two thirds of everything in orbit
 * and would drown every other object on the map while adding one fact —
 * that there are a great many Starlinks — which does not need ten thousand
 * markers to make.
 */
const GROUPS = [
  { id: "stations", label: "Space stations" },
  { id: "resource", label: "Earth observation" },
  { id: "science", label: "Science" },
  { id: "geo", label: "Geostationary" },
  { id: "gnss", label: "Navigation" },
  { id: "weather", label: "Weather" },
] as const;

export interface SatRecord {
  name: string;
  noradId: number;
  line1: string;
  line2: string;
  group: string;
  indian: boolean;
  /** Days since the element set was generated. Negative means it is projected. */
  epochAgeDays: number | null;
}

async function fetchTle(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "BharatTracker/0.1 (+https://github.com/chad3456/india-defence-infra-corridor)" },
      next: { revalidate },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function GET(): Promise<NextResponse> {
  const byId = new Map<number, SatRecord>();
  const failed: string[] = [];
  const now = new Date();

  const add = (text: string, group: string): void => {
    for (const t of parseTle(text)) {
      // First group wins, so a satellite in both `resource` and the Indian
      // sweep keeps its functional group and is still flagged Indian.
      const existing = byId.get(t.noradId);
      if (existing) { existing.indian = existing.indian || isIndianSatellite(t.name); continue; }
      byId.set(t.noradId, {
        name: t.name, noradId: t.noradId, line1: t.line1, line2: t.line2,
        group, indian: isIndianSatellite(t.name),
        epochAgeDays: epochAgeDays(t.line1, now),
      });
    }
  };

  for (const g of GROUPS) {
    const text = await fetchTle(`${GP}?GROUP=${g.id}&FORMAT=tle`);
    if (text === null) { failed.push(g.id); continue; }
    add(text, g.label);
  }

  // India's own fleet, by name. CelesTrak has no operator group and its
  // country filter returned nothing when probed, so this is the available
  // route; see INDIAN_PREFIXES for what it therefore misses.
  for (const prefix of INDIAN_PREFIXES) {
    const text = await fetchTle(`${GP}?NAME=${encodeURIComponent(prefix)}&FORMAT=tle`);
    if (text === null) { failed.push(`name:${prefix}`); continue; }
    add(text, "Indian fleet");
  }

  const satellites = [...byId.values()];

  // An empty answer must not render as "nothing is up there".
  if (satellites.length === 0) {
    return NextResponse.json(
      { error: "CelesTrak returned nothing for any group", failed, satellites: [] },
      { status: 502 },
    );
  }

  const ages = satellites.map((s) => s.epochAgeDays).filter((a): a is number => a !== null);
  return NextResponse.json({
    fetchedAt: now.toISOString(),
    source: "CelesTrak GP, https://celestrak.org",
    satellites,
    indianCount: satellites.filter((s) => s.indian).length,
    /** Stated so the page can say how much to trust a position. */
    oldestEpochDays: ages.length ? Math.max(...ages) : null,
    medianEpochDays: ages.length ? ages.sort((a, b) => a - b)[Math.floor(ages.length / 2)]! : null,
    /** Groups that did not answer, so a thin map is explained rather than silent. */
    failed,
  });
}
