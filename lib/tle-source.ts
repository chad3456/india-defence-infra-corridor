/**
 * Which element sets the satellite tracker carries, and how a set of CelesTrak
 * answers becomes one feed.
 *
 * Shared by the live route (app/api/tle/route.ts), which asks CelesTrak at
 * request time, and the snapshot connector
 * (scripts/etl/connectors/tle-snapshot.ts), which asks it from GitHub Actions
 * once a week and commits the answer as a last-known-good copy. No node
 * imports: both sides, and the browser, read the types.
 *
 * The full active catalogue is about sixteen thousand objects, two-thirds of
 * them Starlink. Propagating all of it every second in a browser to answer a
 * question about a few hundred would be the wrong trade, so the feed carries
 * the groups that bear on the question — what is overhead, what is looking
 * down, what is parked above — plus India's own fleet. Starlink is left out on
 * purpose: ten thousand markers make one point, that there are a great many
 * Starlinks, which /internet already makes with a number.
 */
import { parseTle, epochAgeDays, isIndianSatellite, INDIAN_PREFIXES } from "./satellites-shared";

export const GP = "https://celestrak.org/NORAD/elements/gp.php";
export const USER_AGENT = "BharatTracker/0.1 (+https://github.com/chad3456/india-defence-infra-corridor)";

/** The groups worth carrying, as CelesTrak names them, with the label the page uses. */
export const GROUPS = [
  { id: "stations", label: "Space stations" },
  { id: "resource", label: "Earth observation" },
  { id: "science", label: "Science" },
  { id: "geo", label: "Geostationary" },
  { id: "gnss", label: "Navigation" },
  { id: "weather", label: "Weather" },
] as const;

export const INDIAN_FLEET = "Indian fleet";

export interface SatRecord {
  name: string;
  noradId: number;
  line1: string;
  line2: string;
  /** The page's label for the first group the satellite was found in. */
  group: string;
  indian: boolean;
  /** Days since the element set was generated, at the time the feed was built. */
  epochAgeDays: number | null;
}

export interface TleFeed {
  fetchedAt: string;
  source: string;
  /** live: every group answered just now. mixed: some groups came from the weekly snapshot. snapshot: none answered. */
  origin: "live" | "mixed" | "snapshot";
  /** When the snapshot behind any snapshot-sourced records was taken. */
  snapshotAt: string | null;
  satellites: SatRecord[];
  indianCount: number;
  oldestEpochDays: number | null;
  medianEpochDays: number | null;
  /** Groups that did not answer live, so a thin map is explained rather than silent. */
  failed: string[];
}

/** Every request a full feed needs: the groups, then India's fleet by name. */
export function feedRequests(): Array<{ key: string; label: string; url: string }> {
  return [
    ...GROUPS.map((g) => ({ key: g.id, label: g.label, url: `${GP}?GROUP=${g.id}&FORMAT=tle` })),
    // CelesTrak has no operator group and its SATCAT country filter returned
    // nothing when probed, so India's fleet is found by name; see
    // INDIAN_PREFIXES for what that misses.
    ...[...new Set(INDIAN_PREFIXES)].map((p) => ({ key: `name:${p}`, label: INDIAN_FLEET, url: `${GP}?NAME=${encodeURIComponent(p)}&FORMAT=tle` })),
  ];
}

/**
 * One feed from a list of answers, in request order. The first group a
 * satellite appears in wins, so a satellite in both `resource` and the Indian
 * sweep keeps its functional group and is still flagged Indian.
 */
export function buildRecords(answers: Array<{ label: string; text: string }>, now: Date): SatRecord[] {
  const byId = new Map<number, SatRecord>();
  for (const a of answers) {
    for (const t of parseTle(a.text)) {
      // CelesTrak's name search matches anywhere in the name, not at the
      // start: RISAT also returns MARISAT and TIGRISAT. The fleet sweep keeps
      // only what the prefix test calls Indian.
      if (a.label === INDIAN_FLEET && !isIndianSatellite(t.name)) continue;
      const existing = byId.get(t.noradId);
      if (existing) { existing.indian = existing.indian || isIndianSatellite(t.name); continue; }
      byId.set(t.noradId, {
        name: t.name, noradId: t.noradId, line1: t.line1, line2: t.line2,
        group: a.label, indian: isIndianSatellite(t.name),
        epochAgeDays: epochAgeDays(t.line1, now),
      });
    }
  }
  return [...byId.values()];
}

/** The feed's summary fields, computed from its records. */
export function summarise(satellites: SatRecord[]): Pick<TleFeed, "indianCount" | "oldestEpochDays" | "medianEpochDays"> {
  const ages = satellites.map((s) => s.epochAgeDays).filter((a): a is number => a !== null).sort((a, b) => a - b);
  return {
    indianCount: satellites.filter((s) => s.indian).length,
    oldestEpochDays: ages.length ? ages[ages.length - 1]! : null,
    medianEpochDays: ages.length ? ages[Math.floor(ages.length / 2)]! : null,
  };
}
