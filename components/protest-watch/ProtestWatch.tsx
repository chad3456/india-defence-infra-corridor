"use client";

import { useEffect, useMemo, useState } from "react";
import { CAUSES, OTHER, OUTCOMES, causeMeta, type Cause, type PwPayload } from "@/lib/protest-watch";

/**
 * Protest Watch, the live dashboard. Asks /api/protest-watch every minute for
 * the chosen window and draws the same measures for every cause: a world map,
 * a table of causes, one cause against all the rest, the losses headlines
 * report, and the latest reports. Every figure links to the headline it came
 * from; none is verified, and the page says so wherever a number appears.
 */

type Payload = PwPayload & { registerFrom?: string; pulse?: Array<{ t: string; v: number }> };
interface MapData { w: number; h: number; shapes: Array<{ iso2: string; name: string; d: string }>; points: Record<string, { name: string; x: number; y: number }> }

const WINDOWS = [{ h: 24, label: "24 hours" }, { h: 72, label: "3 days" }, { h: 168, label: "7 days" }];
const ago = (iso: string | null, now: number) => {
  if (!iso) return "undated";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  return s < 3600 ? `${Math.max(1, Math.round(s / 60))} min ago` : s < 86_400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86_400)} d ago`;
};
const n = (v: number) => v.toLocaleString("en-IN");
const pct = (v: number) => `${Math.round(v * 100)}%`;

export function ProtestWatch({ initial, map }: { initial: Payload; map: MapData }) {
  const [hours, setHours] = useState(initial.windowHours);
  const [data, setData] = useState<Payload>(initial);
  const [state, setState] = useState<"ok" | "loading" | "failed">("ok");
  const [now, setNow] = useState(() => Date.parse(initial.fetchedAt));
  const [cause, setCause] = useState<Cause | "all">("all");
  const [focus, setFocus] = useState<Cause>("palestine");
  const [country, setCountry] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const load = async () => {
      setState((s) => (s === "ok" ? "ok" : "loading"));
      try {
        const r = await fetch(`/api/protest-watch?hours=${hours}`, { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as Payload;
        if (live) { setData(j); setState("ok"); }
      } catch { if (live) setState("failed"); }
      if (live) setNow(Date.now());
    };
    void load();
    const t = setInterval(load, 60_000);
    return () => { live = false; clearInterval(t); };
  }, [hours]);

  const events = useMemo(() => data.events.filter((e) => (cause === "all" || e.cause === cause) && (!country || e.country === country)), [data.events, cause, country]);
  const withLosses = useMemo(() => data.events.filter((e) => e.losses.deaths || e.losses.injured || e.losses.arrested).sort((a, b) => ((b.losses.deaths ?? 0) * 1e6 + (b.losses.injured ?? 0) * 1e3 + (b.losses.arrested ?? 0)) - ((a.losses.deaths ?? 0) * 1e6 + (a.losses.injured ?? 0) * 1e3 + (a.losses.arrested ?? 0))).slice(0, 30), [data.events]);
  const maxCountry = Math.max(1, ...data.countries.map((c) => c.events));
  const f = data.causes.find((c) => c.id === focus);
  const rest = useMemo(() => {
    const others = data.causes.filter((c) => c.id !== focus);
    const ev = others.reduce((a, c) => a + c.events, 0), rep = others.reduce((a, c) => a + c.reports, 0);
    const viol = others.reduce((a, c) => a + c.violentShare * c.reports, 0);
    return { events: ev, reports: rep, headlines: others.reduce((a, c) => a + c.headlines, 0), violentShare: rep ? viol / rep : 0, arrested: others.reduce((a, c) => a + c.arrested, 0), injured: others.reduce((a, c) => a + c.injured, 0), deaths: others.reduce((a, c) => a + c.deaths, 0), countries: Math.max(0, ...others.map((c) => c.countries)) };
  }, [data.causes, focus]);
  const pulse = data.pulse ?? [];
  const pmax = Math.max(1, ...pulse.map((p) => p.v));

  return (
    <div>
      {/* Window and status */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-md border text-[12px] font-semibold" style={{ borderColor: "var(--story-rule)" }} role="group" aria-label="Window">
          {WINDOWS.map((w) => <button key={w.h} type="button" onClick={() => setHours(w.h)} aria-pressed={hours === w.h} className="px-3 py-1" style={{ background: hours === w.h ? "var(--story-ink)" : "transparent", color: hours === w.h ? "var(--story-card)" : "var(--story-ink-2)" }}>{w.label}</button>)}
        </div>
        <span className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: state === "failed" ? "var(--story-ink-3)" : "var(--s-hot)" }}>
          <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${state === "ok" ? "animate-pulse" : ""}`} style={{ background: "currentColor" }} />
          {state === "failed" ? "Live update failed; showing the last good read" : `Live · updated ${ago(data.fetchedAt, now)} · collector ran ${ago(data.registerAt, now)}`}
        </span>
      </div>

      {/* Headline numbers */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { v: n(data.totals.events), l: "protest events", s: "one cause, one country, one day" },
          { v: n(data.totals.countries), l: "countries", s: `${n(data.totals.unplaced)} reports name no place` },
          { v: n(data.totals.headlines), l: "protest headlines", s: "from ~25 news editions, 12 languages" },
          { v: pct(data.causes.reduce((a, c) => a + c.violentShare * c.reports, 0) / Math.max(1, data.totals.headlines)), l: "of reports describing violence", s: "deaths, injuries, damage or clashes" },
        ].map((k) => (
          <div key={k.l} className="story-card p-4"><p className="story-display text-[34px] leading-none tabular-nums">{k.v}</p><p className="mt-1.5 text-[13px] font-semibold">{k.l}</p><p className="text-[11px]" style={{ color: "var(--story-ink-3)" }}>{k.s}</p></div>
        ))}
      </div>

      {/* Map */}
      <div className="story-card mt-4 p-3 sm:p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[12px] font-semibold" style={{ color: "var(--story-ink-2)" }}>Where — circles sized by events, coloured by the most frequent cause{country ? ` · showing ${map.points[country]?.name ?? country}` : ""}</p>
          {country && <button type="button" onClick={() => setCountry(null)} className="text-[11.5px] underline">clear country</button>}
        </div>
        <svg viewBox={`0 0 ${map.w} ${map.h}`} className="mt-2 h-auto w-full" role="img" aria-label="Protest events by country">
          {map.shapes.map((s) => <path key={s.iso2 + s.name} d={s.d} fill="var(--story-rule)" stroke="var(--story-card)" strokeWidth={0.4} />)}
          {data.countries.map((c) => {
            const p = map.points[c.iso2];
            if (!p) return null;
            const r = 3 + 16 * Math.sqrt(c.events / maxCountry);
            return (
              <circle key={c.iso2} cx={p.x} cy={p.y} r={r} fill={causeMeta(c.top).colour} fillOpacity={0.62} stroke={country === c.iso2 ? "var(--story-ink)" : "var(--story-card)"} strokeWidth={country === c.iso2 ? 2 : 0.8} style={{ cursor: "pointer" }} onClick={() => setCountry(country === c.iso2 ? null : c.iso2)}>
                <title>{`${p.name}: ${c.events} events; most frequent cause ${causeMeta(c.top).label}`}</title>
              </circle>
            );
          })}
        </svg>
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">{[...CAUSES, OTHER].map((c) => <li key={c.id} className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c.colour }} />{c.label}</li>)}</ul>
      </div>

      {/* Causes table */}
      <div className="story-card mt-4 overflow-x-auto p-3 sm:p-4">
        <p className="text-[12px] font-semibold" style={{ color: "var(--story-ink-2)" }}>Every cause, measured the same way · press a row to filter the reports below</p>
        <table className="mt-2 w-full min-w-[720px] border-collapse text-[12.5px] tabular-nums">
          <thead>
            <tr className="text-left text-[10.5px] uppercase tracking-[0.05em]" style={{ color: "var(--story-ink-3)" }}>
              <th className="py-1.5 pr-2 font-semibold">Cause</th><th className="px-2 text-right font-semibold">Reports</th><th className="px-2 text-right font-semibold" title="Placed events: one cause, one country, one day">Events</th><th className="px-2 text-right font-semibold">Countries</th>
              <th className="px-2 text-right font-semibold" title="Headlines per event: how heavily each event is covered">Coverage</th>
              <th className="px-2 font-semibold">Outcomes reported</th>
              <th className="px-2 text-right font-semibold">Arrests</th><th className="px-2 text-right font-semibold">Injured</th><th className="pl-2 text-right font-semibold">Deaths</th>
            </tr>
          </thead>
          <tbody>
            {data.causes.map((c) => (
              <tr key={c.id} className="cursor-pointer border-t" style={{ borderColor: "var(--story-rule)", background: cause === c.id ? "var(--story-bg)" : undefined }} onClick={() => setCause(cause === c.id ? "all" : c.id)}>
                <td className="py-1.5 pr-2"><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: c.colour }} />{c.label}</td>
                <td className="px-2 text-right font-semibold">{n(c.reports)}</td>
                <td className="px-2 text-right">{n(c.events)}</td>
                <td className="px-2 text-right">{c.countries}</td>
                <td className="px-2 text-right">{c.events ? (c.headlines / c.events).toFixed(1) : "—"}</td>
                <td className="px-2"><div className="flex h-3 w-40 overflow-hidden rounded-sm">{OUTCOMES.map((o) => c.outcomes[o.id] ? <span key={o.id} title={`${o.label}: ${c.outcomes[o.id]} reports`} style={{ width: `${(100 * c.outcomes[o.id]) / c.reports}%`, background: o.colour }} /> : null)}</div></td>
                <td className="px-2 text-right">{c.arrested ? n(c.arrested) : "—"}</td>
                <td className="px-2 text-right">{c.injured ? n(c.injured) : "—"}</td>
                <td className="pl-2 text-right">{c.deaths ? n(c.deaths) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">{OUTCOMES.map((o) => <li key={o.id} className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: o.colour }} />{o.label}</li>)}</ul>
        <p className="mt-1.5 text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>Arrests, injuries and deaths are the sum, across events, of the largest figure any headline reported for each event — reported, not verified, and only where a headline tied them to the protest. Reports are every protest headline; events are reports that name a place, grouped by cause, country and day. Coverage is headlines per event; the outcome bar is over all reports.</p>
      </div>

      {/* One cause against the rest */}
      <div className="story-card mt-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[12px] font-semibold" style={{ color: "var(--story-ink-2)" }}>Compare one cause with all others</p>
          <select value={focus} onChange={(e) => setFocus(e.target.value as Cause)} aria-label="Cause to compare" className="rounded-md border bg-transparent px-2 py-1 text-[12.5px]" style={{ borderColor: "var(--story-rule)" }}>
            {[...CAUSES, OTHER].map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        {f ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { l: "Share of all reports", a: pct(f.reports / Math.max(1, data.totals.headlines)), b: pct(rest.reports / Math.max(1, data.totals.headlines)) },
              { l: "Coverage per event", a: f.events ? (f.headlines / f.events).toFixed(1) : "—", b: rest.events ? (rest.headlines / rest.events).toFixed(1) : "—" },
              { l: "Reports describing violence", a: pct(f.violentShare), b: pct(rest.violentShare) },
              { l: "Arrests per event", a: f.events ? (f.arrested / f.events).toFixed(1) : "—", b: rest.events ? (rest.arrested / rest.events).toFixed(1) : "—" },
              { l: "Injuries per event", a: f.events ? (f.injured / f.events).toFixed(2) : "—", b: rest.events ? (rest.injured / rest.events).toFixed(2) : "—" },
              { l: "Deaths per event", a: f.events ? (f.deaths / f.events).toFixed(2) : "—", b: rest.events ? (rest.deaths / rest.events).toFixed(2) : "—" },
            ].map((m) => (
              <div key={m.l} className="rounded-md border p-2.5" style={{ borderColor: "var(--story-rule)" }}>
                <p className="text-[10.5px] uppercase tracking-[0.05em]" style={{ color: "var(--story-ink-3)" }}>{m.l}</p>
                <p className="mt-1 text-[20px] font-black tabular-nums" style={{ color: f.colour === "var(--story-rule)" ? "var(--story-ink)" : f.colour }}>{m.a}</p>
                <p className="text-[11px]" style={{ color: "var(--story-ink-3)" }}>all others: {m.b}</p>
              </div>
            ))}
          </div>
        ) : <p className="mt-2 text-[12.5px]" style={{ color: "var(--story-ink-3)" }}>No events for this cause in the window.</p>}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Losses ledger */}
        <div className="story-card p-4">
          <p className="text-[12px] font-semibold" style={{ color: "var(--story-ink-2)" }}>Losses reported · largest first</p>
          {withLosses.length ? (
            <ul className="mt-2 divide-y text-[12.5px]" style={{ borderColor: "var(--story-rule)" }}>
              {withLosses.map((e) => (
                <li key={e.id} className="py-2" style={{ borderColor: "var(--story-rule)" }}>
                  <p className="flex flex-wrap gap-x-2 text-[11px] font-bold" style={{ color: "var(--story-ink-3)" }}>
                    <span style={{ color: causeMeta(e.cause).colour === "var(--story-rule)" ? "var(--story-ink-3)" : causeMeta(e.cause).colour }}>{causeMeta(e.cause).label}</span>
                    <span>{e.country ? map.points[e.country]?.name ?? e.country : "place not named"} · {e.day}</span>
                  </p>
                  <p className="mono mt-0.5 text-[12px] font-bold">{[e.losses.deaths ? `${n(e.losses.deaths)} dead` : "", e.losses.injured ? `${n(e.losses.injured)} injured` : "", e.losses.arrested ? `${n(e.losses.arrested)} arrested` : ""].filter(Boolean).join(" · ")}</p>
                  <a href={e.headlines[0]!.u} target="_blank" rel="noopener noreferrer" className="mt-0.5 block leading-snug hover:underline">{e.headlines[0]!.t}</a>
                  <span className="text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>{e.headlines[0]!.o}{e.n > 1 ? ` and ${e.n - 1} more report${e.n > 2 ? "s" : ""}` : ""}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-[12.5px]" style={{ color: "var(--story-ink-3)" }}>No headline in the window ties a number of deaths, injuries or arrests to a protest.</p>}
        </div>

        {/* Reports */}
        <div className="story-card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[12px] font-semibold" style={{ color: "var(--story-ink-2)" }}>Events{cause !== "all" ? ` · ${causeMeta(cause).label}` : ""}{country ? ` · ${map.points[country]?.name ?? country}` : ""} · {n(events.length)}</p>
            {(cause !== "all" || country) && <button type="button" onClick={() => { setCause("all"); setCountry(null); }} className="text-[11.5px] underline">show all</button>}
          </div>
          <ul className="mt-2 max-h-[640px] divide-y overflow-y-auto pr-1 text-[12.5px]" style={{ borderColor: "var(--story-rule)" }}>
            {events.slice(0, 120).map((e) => {
              const o = OUTCOMES.find((x) => x.id === e.outcome)!;
              return (
                <li key={e.id} className="py-2" style={{ borderColor: "var(--story-rule)" }}>
                  <p className="flex flex-wrap items-center gap-x-2 text-[11px]" style={{ color: "var(--story-ink-3)" }}>
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: causeMeta(e.cause).colour }} />
                    <b>{causeMeta(e.cause).label}</b><span>{e.country ? map.points[e.country]?.name ?? e.country : "place not named"}</span><span>{ago(e.latest, now)}</span>
                    <span className="rounded px-1.5 text-[10px] font-bold text-white" style={{ background: o.colour === "var(--s-cool)" ? "var(--s-cool)" : o.colour }}>{o.label}</span>
                  </p>
                  <a href={e.headlines[0]!.u} target="_blank" rel="noopener noreferrer" className="mt-0.5 block font-semibold leading-snug hover:underline">{e.headlines[0]!.t}</a>
                  <span className="text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>{e.headlines.slice(0, 3).map((h) => h.o).join(" · ")}{e.n > 3 ? ` +${e.n - 3}` : ""}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Coverage pulse and sources */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="story-card p-4">
          <p className="text-[12px] font-semibold" style={{ color: "var(--story-ink-2)" }}>Global protest coverage, past week (GDELT, share of monitored articles)</p>
          {pulse.length ? (
            <svg viewBox="0 0 600 120" className="mt-2 h-auto w-full" aria-label="Protest coverage over the past week">
              <path d={pulse.map((p, i) => `${i ? "L" : "M"}${(i / Math.max(1, pulse.length - 1)) * 600},${115 - (p.v / pmax) * 105}`).join("")} fill="none" stroke="var(--s-hot)" strokeWidth={1.6} />
            </svg>
          ) : <p className="mt-2 text-[12px]" style={{ color: "var(--story-ink-3)" }}>Awaiting the collector&apos;s first GDELT read.</p>}
        </div>
        <div className="story-card p-4">
          <p className="text-[12px] font-semibold" style={{ color: "var(--story-ink-2)" }}>Sources this read</p>
          <p className="mt-1 text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>{data.status.filter((s) => s.ok).length} of {data.status.length} answered · register from {data.registerFrom ?? "deployment"}</p>
          <ul className="mt-1.5 flex flex-wrap gap-1">{data.status.map((s) => <li key={s.id} title={s.error ?? `${s.count} items`} className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: s.ok ? "var(--story-bg)" : "transparent", color: s.ok ? "var(--story-ink-2)" : "var(--s-hot)", border: "1px solid var(--story-rule)" }}>{s.id}</li>)}</ul>
        </div>
      </div>
    </div>
  );
}
