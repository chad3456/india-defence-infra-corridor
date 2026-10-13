/**
 * Military aircraft broadcasting ADS-B over India's neighbourhood, now.
 *
 * Two independent community aggregators (adsb.lol, adsb.fi), each asked for
 * the aircraft its own database flags as military, merged by transponder
 * address and cut to the region. Cached for thirty seconds.
 *
 * What this is not, stated wherever it is shown: a picture of military
 * activity. Military aircraft need not broadcast and mostly do not; what is
 * visible is the traffic with the least reason to hide. Positions are rounded
 * to a tenth of a degree (about 11 km), and the page shows no track history.
 */
import { NextResponse } from "next/server";
import { REGION, regionAircraft } from "@/lib/live-shared";

export const revalidate = 30;
const FEEDS = [
  { id: "adsb.lol", url: "https://api.adsb.lol/v2/mil" },
  { id: "adsb.fi", url: "https://opendata.adsb.fi/api/v2/mil" },
];

export async function GET(): Promise<NextResponse> {
  const answers = await Promise.all(FEEDS.map(async (f) => {
    try {
      const r = await fetch(f.url, { headers: { accept: "application/json", "user-agent": "bharat-tracker/1.0 (+live page)" }, signal: AbortSignal.timeout(8_000), next: { revalidate } });
      if (!r.ok) return { id: f.id, ac: [], error: `HTTP ${r.status}` };
      const j = (await r.json()) as { ac?: unknown[] };
      return { id: f.id, ac: (j.ac ?? []) as Parameters<typeof regionAircraft>[0][number]["ac"] };
    } catch (e) {
      return { id: f.id, ac: [], error: e instanceof Error ? e.name : "fetch failed" };
    }
  }));
  const { inRegion, globalByFeed } = regionAircraft(answers);
  return NextResponse.json({
    fetchedAt: new Date().toISOString(),
    region: REGION,
    aircraft: inRegion,
    globalByFeed,
    feedErrors: Object.fromEntries(answers.filter((a) => "error" in a && a.error).map((a) => [a.id, (a as { error: string }).error])),
    verified: false,
  });
}
