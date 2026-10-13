"use client";

import { useEffect, useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import topo from "@/data/geo/india-states.topo.json";
import HoverCard, { useHoverCard } from "@/components/charts/HoverCard";
import { INDICES, REGION, type FxRate, type IndexQuote, type LiveAircraft, type LiveHeadline } from "@/lib/live-shared";

interface Markets { fetchedAt: string; indices: IndexQuote[]; fx: { date?: string; rates: FxRate[]; ok: boolean; error?: string }; fxCheck: { updated?: string; rates: Array<{ code: string; other: number; gapPct: number }> } }
interface Military { fetchedAt: string; aircraft: LiveAircraft[]; globalByFeed: Record<string, number>; feedErrors: Record<string, string> }
interface News { fetchedAt: string; topics: Record<string, LiveHeadline[]> }
interface Official { fetchedAt: string; items: Array<{ title: string; url: string; published: string | null; outlet: string }>; feedsAsked: number; feedsAnswered: number }

/** Poll a route; keep the last good answer, and say when it was taken. */
function usePoll<T>(url: string, everyMs: number): { data: T | null; error: string | null; at: number | null } {
  const [state, set] = useState<{ data: T | null; error: string | null; at: number | null }>({ data: null, error: null, at: null });
  useEffect(() => {
    let live = true;
    const tick = async () => {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = (await r.json()) as T;
        if (live) set({ data: d, error: null, at: Date.now() });
      } catch (e) {
        if (live) set((s) => ({ ...s, error: e instanceof Error ? e.message : "failed" }));
      }
    };
    tick();
    const id = setInterval(tick, everyMs);
    return () => { live = false; clearInterval(id); };
  }, [url, everyMs]);
  return state;
}

const fmt = (n: number, d = 2) => n.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
const ago = (iso: string | null | undefined, now: number) => {
  if (!iso) return "time not given";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  return s < 90 ? `${s}s ago` : s < 5400 ? `${Math.round(s / 60)} min ago` : s < 172800 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} days ago`;
};
const ist = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }) + " IST" : "");

function useNow(everyMs = 1000) {
  const [now, set] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => set(Date.now()), everyMs); return () => clearInterval(id); }, [everyMs]);
  return now;
}

export default function LiveTracker() {
  const markets = usePoll<Markets>("/api/markets", 60_000);
  const mil = usePoll<Military>("/api/military-live", 30_000);
  const news = usePoll<News>("/api/news-live", 120_000);
  const official = usePoll<Official>("/api/live", 60_000);
  const now = useNow();
  const [topic, setTopic] = useState("Economy");

  return (
    <div className="space-y-12">
      <Status now={now} items={[
        ["Markets", markets.at, markets.error, 60, markets.data ? markets.data.indices.filter((q) => q.ok).length + (markets.data.fx.rates.length ? 1 : 0) : null],
        ["Military aircraft", mil.at, mil.error, 30, mil.data ? Object.keys(mil.data.globalByFeed).length - Object.keys(mil.data.feedErrors).length : null],
        ["Headlines", news.at, news.error, 120, news.data ? Object.values(news.data.topics).filter((l) => l.length).length : null],
        ["Official feeds", official.at, official.error, 60, official.data ? official.data.feedsAnswered : null],
      ]} />

      <section>
        <h2 className="text-lg font-semibold text-ink">Markets and the rupee</h2>
        <p className="mt-1 text-xs text-ink-2">Index prices from the exchanges via Moneycontrol&rsquo;s feed; currency rates are the ECB&rsquo;s daily reference rates. Refreshes every minute.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {INDICES.map((i) => <IndexTile key={i.id} meta={i} q={markets.data?.indices.find((x) => x.id === i.id)} />)}
        </div>
        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Rupees per unit of currency</h3>
          {markets.data?.fx.rates.length ? (
            <>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {markets.data.fx.rates.map((r) => {
                  const chk = markets.data!.fxCheck.rates.find((c) => c.code === r.code);
                  return (
                    <div key={r.code} className="rounded-lg border border-gridline bg-surface-1 p-3">
                      <p className="text-[11px] text-ink-2">{r.label}</p>
                      <p className="text-lg font-semibold tabular-nums text-ink">₹{fmt(r.inr, r.inr < 5 ? 4 : 2)}</p>
                      <p className="text-[10px] text-ink-muted">{chk ? (chk.gapPct < 1 ? `second feed agrees (₹${fmt(chk.other, r.inr < 5 ? 4 : 2)})` : `second feed: ₹${fmt(chk.other, 2)} — ${chk.gapPct.toFixed(1)}% apart`) : "no second reading"}</p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-1 text-[11px] text-ink-muted">ECB reference rates for {markets.data.fx.date ?? "the latest business day"} (published once a working day, about 16:00 CET), cross-checked against a second daily feed{markets.data.fxCheck.updated ? ` updated ${markets.data.fxCheck.updated}` : ""}.</p>
            </>
          ) : <Unavailable what="Currency rates" error={markets.data?.fx.error ?? markets.error} />}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">Military aircraft over the region, now</h2>
        <MilitaryPanel m={mil.data} error={mil.error} now={now} />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">What is being reported</h2>
        <p className="mt-1 text-xs text-ink-2">Headlines from the last day, as aggregated by Google News, and the government&rsquo;s own feeds unfiltered. Reports, not facts: nothing here becomes a number on this site.</p>
        <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div>
            <div role="tablist" className="flex flex-wrap gap-1">
              {Object.keys(news.data?.topics ?? { Economy: [], Markets: [], Defence: [], Security: [] }).map((t) => (
                <button key={t} role="tab" aria-selected={topic === t} onClick={() => setTopic(t)}
                  className={`rounded-full border px-3 py-1 text-xs ${topic === t ? "border-ink bg-ink text-[color:var(--surface-1)]" : "border-gridline text-ink-2 hover:text-ink"}`}>
                  {t}{news.data?.topics[t] ? ` · ${news.data.topics[t]!.length}` : ""}
                </button>
              ))}
            </div>
            {news.data ? (
              (news.data.topics[topic] ?? []).length ? (
                <ol className="mt-3 divide-y divide-[color:var(--gridline)]">
                  {(news.data.topics[topic] ?? []).map((h) => (
                    <li key={h.url} className="py-2">
                      <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-sm text-ink hover:underline">{h.title}</a>
                      <p className="text-[11px] text-ink-muted">{h.outlet || "outlet not given"} · {ago(h.published, now)}</p>
                    </li>
                  ))}
                </ol>
              ) : <Unavailable what={`${topic} headlines`} error="the aggregator returned none" />
            ) : <Unavailable what="Headlines" error={news.error} loading={!news.error} />}
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Straight from the government&rsquo;s feeds</h3>
            {official.data ? (
              <>
                <p className="mt-1 text-[11px] text-ink-muted">{official.data.feedsAnswered} of {official.data.feedsAsked} official feeds answered.</p>
                <ol className="mt-2 divide-y divide-[color:var(--gridline)]">
                  {official.data.items.slice(0, 15).map((h) => (
                    <li key={h.url} className="py-1.5">
                      <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-xs text-ink hover:underline">{h.title}</a>
                      <p className="text-[10px] text-ink-muted">{h.outlet} · {ago(h.published, now)}</p>
                    </li>
                  ))}
                </ol>
              </>
            ) : <Unavailable what="Official feeds" error={official.error} loading={!official.error} />}
          </div>
        </div>
      </section>
    </div>
  );
}

/** Green only when a source behind the route answered: a route that replies "nothing answered" is not live. */
function Status({ items, now }: { items: Array<[string, number | null, string | null, number, number | null]>; now: number }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-lg border border-gridline bg-surface-2 px-4 py-2 text-[11px] text-ink-2" aria-live="polite">
      {items.map(([name, at, err, every, answered]) => {
        const fresh = at != null && now - at < every * 2000 && (answered ?? 0) > 0;
        const down = (err && !at) || (at != null && answered === 0);
        return (
          <span key={name} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${down ? "bg-[color:var(--div-neg-2)]" : fresh ? "bg-[color:var(--div-pos-2)]" : "bg-[color:var(--color-ink-muted)]"}`} />
            {name}: {at ? (answered === 0 ? `no source answered (checked ${Math.round((now - at) / 1000)}s ago)` : `updated ${Math.round((now - at) / 1000)}s ago, every ${every}s`) : err ? `unavailable (${err})` : "loading"}
          </span>
        );
      })}
    </div>
  );
}

function IndexTile({ meta, q }: { meta: (typeof INDICES)[number]; q?: IndexQuote }) {
  if (!q) return <div className="h-32 animate-pulse rounded-lg border border-gridline bg-surface-1" aria-label={`${meta.label} loading`} />;
  if (!q.ok) return <div className="rounded-lg border border-gridline bg-surface-1 p-3"><p className="text-sm text-ink">{meta.label}</p><p className="mt-1 text-xs text-ink-muted">Unavailable: {q.error}. No earlier reading is shown in its place.</p></div>;
  const up = (q.change ?? 0) >= 0;
  const range = q.week52High != null && q.week52Low != null && q.week52High > q.week52Low ? (q.price! - q.week52Low) / (q.week52High - q.week52Low) : null;
  return (
    <div className="rounded-lg border border-gridline bg-surface-1 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-ink">{meta.label}</p>
        <span className={`rounded px-1.5 text-[10px] uppercase ${q.marketState === "OPEN" ? "bg-[color:var(--div-pos-1)] text-ink" : "bg-surface-2 text-ink-muted"}`}>{q.marketState === "OPEN" ? "open" : "closed"}</span>
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{fmt(q.price!)}</p>
      {q.change != null && (
        <p className="text-xs tabular-nums" style={{ color: up ? "var(--div-pos-2)" : "var(--div-neg-2)" }}>
          {up ? "▲" : "▼"} {fmt(Math.abs(q.change))} ({up ? "+" : "−"}{Math.abs(q.changePct ?? 0).toFixed(2)}%) <span className="text-ink-muted">vs previous close {q.previousClose != null ? fmt(q.previousClose) : ""}</span>
        </p>
      )}
      {q.low != null && q.high != null && <p className="mt-1 text-[11px] text-ink-2">Day {fmt(q.low)} – {fmt(q.high)}</p>}
      {range != null && (
        <div className="mt-2">
          <div className="relative h-1.5 rounded-full bg-[color:var(--seq-100)]"><span className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded bg-[color:var(--seq-700)]" style={{ left: `calc(${range * 100}% - 2px)` }} /></div>
          <p className="mt-0.5 flex justify-between text-[10px] text-ink-muted"><span>52-wk low {fmt(q.week52Low!, 0)}</span><span>high {fmt(q.week52High!, 0)}</span></p>
        </div>
      )}
      <p className="mt-1 text-[10px] text-ink-muted">{meta.what}. Exchange time {ist(q.updated)}{q.oneYearPct != null ? ` · ${q.oneYearPct >= 0 ? "+" : ""}${q.oneYearPct.toFixed(1)}% over a year` : ""}.</p>
    </div>
  );
}

function MilitaryPanel({ m, error, now }: { m: Military | null; error: string | null; now: number }) {
  const card = useHoverCard();
  const W = 520, H = 520;
  const { path, proj, states } = useMemo(() => {
    const t = topo as unknown as Topology<{ india: GeometryCollection<{ name: string | null }> }>;
    const fc = feature(t, t.objects.india) as FeatureCollection<Geometry, { name: string | null }>;
    const box = { type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, // Clockwise in longitude/latitude: d3 is spherical, and the other winding
          // means "everything except this box", which shrank India to a speck.
          coordinates: [[[REGION.west, REGION.south], [REGION.west, REGION.north], [REGION.east, REGION.north], [REGION.east, REGION.south], [REGION.west, REGION.south]]] } };
    const proj = geoMercator().fitExtent([[4, 4], [W - 4, H - 4]], box);
    return { path: geoPath(proj), proj, states: fc };
  }, []);
  if (!m) return <Unavailable what="Aircraft" error={error} loading={!error} />;
  const both = m.aircraft.filter((a) => a.seenBy.length > 1).length;
  const global = Math.max(0, ...Object.values(m.globalByFeed));
  return (
    <div className="mt-2">
      <p className="max-w-3xl text-xs leading-relaxed text-ink-2">
        <strong className="text-ink">{m.aircraft.length}</strong> aircraft flagged military are broadcasting position between {REGION.south}°N–{REGION.north}°N and {REGION.west}°E–{REGION.east}°E right now, of about {global.toLocaleString("en-IN")} worldwide.
        That is not a picture of military activity: military aircraft need not broadcast, and the ones that do are mostly transports, tankers and training flights.
        Combat sorties are almost never visible. Positions are rounded to a tenth of a degree (about 11 km), and no tracks are kept.
      </p>
      <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[560px] rounded-lg border border-gridline bg-surface-1" role="img" aria-label={`${m.aircraft.length} military aircraft broadcasting over South Asia`}>
          {states.features.map((f, i) => <path key={i} d={path(f) ?? ""} fill="var(--gridline)" stroke="var(--surface-1)" strokeWidth={0.6} />)}
          {m.aircraft.map((a, i) => {
            const p = proj([a.lon, a.lat]);
            if (!p) return null;
            return (
              <g key={i} onMouseMove={(e) => card.show(e, { title: a.callsign ?? "No callsign broadcast", subtitle: a.type ? `Type ${a.type}` : "Type not given", rows: [{ label: "Altitude", value: a.alt === "ground" ? "on the ground" : a.alt != null ? `${a.alt.toLocaleString("en-IN")} ft` : "—" }, { label: "Speed", value: a.speed != null ? `${a.speed} kt` : "—" }, { label: "Seen by", value: a.seenBy.join(" and ") }], note: "Position rounded to about 11 km." })} onMouseLeave={card.hide}>
                <circle cx={p[0]} cy={p[1]} r={9} fill="transparent" />
                <circle cx={p[0]} cy={p[1]} r={4} fill="var(--series-2)" stroke="var(--surface-1)" strokeWidth={1.2} />
              </g>
            );
          })}
        </svg>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">Broadcasting now</p>
          {m.aircraft.length ? (
            <ol className="mt-2 max-h-[440px] space-y-1 overflow-auto text-xs">
              {[...m.aircraft].sort((a, b) => (b.alt === "ground" ? -1 : b.alt ?? 0) - (a.alt === "ground" ? -1 : a.alt ?? 0)).map((a, i) => (
                <li key={i} className="flex justify-between gap-2 border-b border-gridline pb-1">
                  <span className="truncate text-ink">{a.callsign ?? "—"} <span className="text-ink-muted">{a.type ?? ""}</span></span>
                  <span className="shrink-0 tabular-nums text-ink-2">{a.alt === "ground" ? "ground" : a.alt != null ? `${Math.round(a.alt / 100) * 100} ft` : ""}</span>
                </li>
              ))}
            </ol>
          ) : <p className="mt-2 text-xs text-ink-2">None visible in the region at this moment. That says nothing about how many are flying.</p>}
          <p className="mt-2 text-[11px] text-ink-muted">
            adsb.lol saw {m.globalByFeed["adsb.lol"] ?? 0} and adsb.fi {m.globalByFeed["adsb.fi"] ?? 0} worldwide; {both} of those in the region were seen by both.
            {Object.keys(m.feedErrors).length ? ` Not answering: ${Object.entries(m.feedErrors).map(([k, v]) => `${k} (${v})`).join(", ")}.` : ""} As of {ago(m.fetchedAt, now)}.
          </p>
        </div>
      </div>
      <HoverCard hover={card.hover} />
    </div>
  );
}

function Unavailable({ what, error, loading }: { what: string; error?: string | null; loading?: boolean }) {
  return <p className="mt-3 rounded border border-gridline bg-surface-2 p-3 text-xs text-ink-2">{loading ? `${what}: loading…` : `${what} unavailable${error ? ` (${error})` : ""}. Nothing older is shown in its place.`}</p>;
}
