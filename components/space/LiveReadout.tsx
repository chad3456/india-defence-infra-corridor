"use client";

import type { LiveState } from "@/lib/space-story";

/** NISAR's position now, as the stage computed it, with what it was computed from. */

const fmt = (v: number, dp = 0) => v.toLocaleString("en-IN", { maximumFractionDigits: dp, minimumFractionDigits: dp });

export function LiveReadout({ live, feed, contacts, fleet, warp, setWarp }: {
  live: LiveState | null;
  feed: { status: "loading" | "ok" | "none"; origin?: string; nisar: boolean };
  contacts?: string[];
  fleet?: Record<string, number>;
  warp?: number;
  setWarp?: (x: number) => void;
}) {
  if (feed.status === "loading") return <p className="sp-hud-note">Fetching orbital elements…</p>;
  const fleetTotal = fleet ? Object.values(fleet).reduce((a, b) => a + b, 0) : 0;
  const fleetRow = fleet && fleetTotal > 0 && <div className="sp-hud-row"><span>Indian satellites drawn</span><b>{fleetTotal} · LEO {fleet.LEO ?? 0} · GEO {fleet.GEO ?? 0}</b></div>;
  if (!live) return (
    <>
      {fleetRow}
      <p className="sp-hud-note">{feed.status === "none" ? "Orbital elements could not be fetched; the orbit shown is the nominal one, at the published height and inclination." : "NISAR's elements are not in the feed; its orbit is drawn at the published height and inclination."}</p>
    </>
  );
  return (
    <>
      <p className="sp-hud-title"><span className="sp-dot" aria-hidden />{warp && warp > 1 ? `NISAR · TIME ×${warp}` : "NISAR · LIVE"}</p>
      <div className="sp-hud-row"><span>Latitude</span><b>{fmt(Math.abs(live.lat), 2)}° {live.lat >= 0 ? "N" : "S"}</b></div>
      <div className="sp-hud-row"><span>Longitude</span><b>{fmt(Math.abs(live.lon), 2)}° {live.lon >= 0 ? "E" : "W"}</b></div>
      <div className="sp-hud-row"><span>Altitude</span><b>{fmt(live.altKm)} km</b></div>
      <div className="sp-hud-row"><span>Orbital speed</span><b>{fmt(live.speedKms, 2)} km/s</b></div>
      <div className="sp-hud-row"><span>Sun</span><b>{live.sunlit ? "Sunlit" : "In Earth's shadow"}</b></div>
      {contacts && <div className="sp-hud-row"><span>Seen by ISRO stations</span><b>{contacts.length ? contacts.join(", ") : "none now"}</b></div>}
      {fleetRow}
      {setWarp && (
        <div className="mt-1.5 flex gap-1">
          {[1, 60, 600].map((x) => <button key={x} type="button" className="sp-chip" aria-pressed={warp === x} onClick={() => setWarp(x)}>{x === 1 ? "Live" : `×${x}`}</button>)}
        </div>
      )}
      <p className="sp-hud-note">Computed in your browser with SGP4 from CelesTrak elements{live.epochAgeDays !== null ? ` ${live.epochAgeDays < 1 ? "under a day" : `${fmt(live.epochAgeDays, 1)} days`} old` : ""}{feed.origin && feed.origin !== "live" ? `, partly from the weekly snapshot` : ""}. Sunlight and station contact (above 5°) are derived from the position.</p>
    </>
  );
}
