"use client";

import { useEffect, useMemo, useState } from "react";
import type { DistrictMapData } from "@/lib/spatial-india";

/**
 * India by district, one indicator at a time, from Spatial India's
 * harmonised government data. Five quantile classes of measured values; a
 * district with no measurement — never covered by the source, or a value
 * Spatial India estimated rather than measured — is hatched, not coloured.
 */

type Payload = { values: Record<string, number>; estimated: number; missing: number };
const STEPS = [18, 36, 54, 72, 90];
const hue = (polarity?: string) => (polarity === "negative" ? "var(--s-hot)" : polarity === "positive" ? "var(--s-cool)" : "var(--series-1)");
const fmt = (v: number, unit?: string) => {
  const a = Math.abs(v);
  const s = a >= 1e7 ? `${(v / 1e6).toFixed(1)}M` : a >= 1e5 ? `${(v / 1e3).toFixed(0)}K` : a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toFixed(2);
  return unit === "%" ? `${s}%` : unit ? `${s} ${unit}` : s;
};

export default function DistrictMap({ data }: { data: DistrictMapData }) {
  const usable = useMemo(() => data.indicators.filter((i) => i.measured >= 50).sort((a, b) => a.name.localeCompare(b.name)), [data]);
  const cats = useMemo(() => [...new Set(usable.flatMap((i) => i.category ?? ["Other"]))].sort(), [usable]);
  const [cat, setCat] = useState<string>(cats.includes("Demographics") ? "Demographics" : cats[0] ?? "");
  const [q, setQ] = useState("");
  const inCat = usable.filter((i) => (!cat || (i.category ?? ["Other"]).includes(cat)) && (!q || `${i.name} ${i.source}`.toLowerCase().includes(q.toLowerCase())));
  const [id, setId] = useState<string>(() => usable.find((i) => /literacy/i.test(i.name))?.id ?? usable[0]?.id ?? "");
  const ind = usable.find((i) => i.id === id);
  const [vals, setVals] = useState<Payload | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "failed">("loading");
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let live = true;
    setState("loading");
    fetch(`/api/districts?id=${encodeURIComponent(id)}`).then((r) => (r.ok ? r.json() : Promise.reject(r.status))).then((j: Payload) => { if (live) { setVals(j); setState("ok"); } }).catch(() => live && setState("failed"));
    return () => { live = false; };
  }, [id]);

  // Quantile breaks over measured values only.
  const breaks = useMemo(() => {
    const v = Object.values(vals?.values ?? {}).sort((a, b) => a - b);
    return v.length ? [0.2, 0.4, 0.6, 0.8].map((p) => v[Math.floor(p * (v.length - 1))]!) : [];
  }, [vals]);
  const classOf = (v: number) => breaks.filter((b) => v > b).length;
  const fill = (did: string) => {
    const v = vals?.values[did];
    if (v === undefined) return "url(#d-hatch)";
    return `color-mix(in srgb, ${hue(ind?.polarity)} ${STEPS[classOf(v)]}%, var(--story-card))`;
  };
  const ranked = useMemo(() => {
    const byId = new Map(data.shapes.map((s) => [s.id, s]));
    return Object.entries(vals?.values ?? {}).map(([d, v]) => ({ d, v, s: byId.get(d) })).filter((x) => x.s).sort((a, b) => b.v - a.v);
  }, [vals, data.shapes]);
  const focus = pinned ?? hover;
  const focusShape = data.shapes.find((s) => s.id === focus);
  const focusRank = ranked.findIndex((r) => r.d === focus);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <div className="flex flex-wrap gap-1.5">
          {cats.map((c) => (
            <button key={c} type="button" onClick={() => setCat(c)} className="rounded-full border px-2.5 py-0.5 text-[11.5px]"
              style={{ borderColor: c === cat ? "var(--story-ink)" : "var(--story-rule)", fontWeight: c === cat ? 700 : 500 }}>{c}</button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select value={id} onChange={(e) => { setId(e.target.value); setPinned(null); }} aria-label="Indicator" className="max-w-full rounded-md border bg-transparent px-2 py-1 text-[12.5px]" style={{ borderColor: "var(--story-rule)" }}>
            {(inCat.some((i) => i.id === id) ? inCat : [...(ind ? [ind] : []), ...inCat]).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search indicators…" aria-label="Search indicators" className="min-w-[10rem] flex-1 rounded-md border bg-transparent px-2 py-1 text-[12px]" style={{ borderColor: "var(--story-rule)" }} />
        </div>

        <div className="relative mt-3">
          <svg viewBox={`0 0 ${data.width} ${data.height}`} style={{ width: "100%", height: "auto", maxHeight: 760 }} role="img" aria-label={ind ? `${ind.name} by district` : "Districts of India"}>
            <defs>
              <pattern id="d-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="5" height="5" fill="var(--story-card)" /><line x1="0" y1="0" x2="0" y2="5" stroke="var(--story-rule)" strokeWidth="2" />
              </pattern>
            </defs>
            {data.shapes.map((s) => (
              <path key={s.id} d={s.d} fill={fill(s.id)} stroke={s.id === focus ? "var(--story-ink)" : "var(--story-card)"} strokeWidth={s.id === focus ? 1.4 : 0.35}
                onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover(null)} onClick={() => setPinned(pinned === s.id ? null : s.id)} style={{ cursor: "pointer" }}>
                <title>{`${s.name}, ${s.state}: ${vals?.values[s.id] !== undefined ? fmt(vals.values[s.id]!, ind?.unit) : "no measured value"}`}</title>
              </path>
            ))}
          </svg>
          {state === "loading" && <p className="absolute left-2 top-2 rounded bg-[color:var(--story-card)] px-2 py-0.5 text-[11px]" style={{ color: "var(--story-ink-3)" }}>Loading…</p>}
          {state === "failed" && <p className="absolute left-2 top-2 rounded bg-[color:var(--story-card)] px-2 py-0.5 text-[11px]" style={{ color: "var(--s-hot)" }}>Could not load this indicator.</p>}
        </div>

        {breaks.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px]" style={{ color: "var(--story-ink-2)" }}>
            {STEPS.map((p, i) => (
              <span key={p} className="flex items-center gap-1">
                <span className="inline-block h-3 w-4 rounded-[2px]" style={{ background: `color-mix(in srgb, ${hue(ind?.polarity)} ${p}%, var(--story-card))`, outline: "1px solid var(--story-rule)" }} />
                {i === 0 ? `≤ ${fmt(breaks[0]!, ind?.unit)}` : i === 4 ? `> ${fmt(breaks[3]!, ind?.unit)}` : `${fmt(breaks[i - 1]!, ind?.unit)}–${fmt(breaks[i]!, ind?.unit)}`}
              </span>
            ))}
            <span className="flex items-center gap-1"><svg width="16" height="12" aria-hidden><rect width="16" height="12" fill="url(#d-hatch)" /></svg>No measured value</span>
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-4">
        {ind && (
          <div className="story-card p-4">
            <p className="text-[16px] font-bold leading-snug">{ind.name}</p>
            {ind.description && <p className="mt-1 text-[12.5px] leading-[1.5]" style={{ color: "var(--story-ink-2)" }}>{ind.description}</p>}
            <dl className="mt-2 grid grid-cols-[6rem_minmax(0,1fr)] gap-y-1 text-[11.5px]">
              <dt style={{ color: "var(--story-ink-3)" }}>Source</dt><dd>{ind.source}{ind.vintage ? `, ${ind.vintage}` : ""}</dd>
              <dt style={{ color: "var(--story-ink-3)" }}>Unit</dt><dd>{ind.unit ?? "—"}</dd>
              <dt style={{ color: "var(--story-ink-3)" }}>Measured in</dt><dd>{Object.keys(vals?.values ?? {}).length || ind.measured} of {data.districts} districts{vals ? ` · ${vals.estimated} estimated by Spatial India, not shown · ${vals.missing} not covered` : ""}</dd>
              {ind.caveat && (<><dt style={{ color: "var(--story-ink-3)" }}>Caveat</dt><dd>{ind.caveat}</dd></>)}
            </dl>
          </div>
        )}
        <div className="story-card p-4">
          {focusShape ? (
            <>
              <p className="text-[15px] font-bold">{focusShape.name}</p>
              <p className="text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>{focusShape.state}{pinned ? " · pinned — click again to release" : ""}</p>
              <p className="mono mt-2 text-[24px] font-bold tabular-nums">{vals?.values[focusShape.id] !== undefined ? fmt(vals.values[focusShape.id]!, ind?.unit) : "—"}</p>
              <p className="text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>{focusRank >= 0 ? `Rank ${focusRank + 1} of ${ranked.length} measured districts, highest first` : "No measured value: the source did not cover this district, or Spatial India estimated it."}</p>
            </>
          ) : <p className="text-[12.5px]" style={{ color: "var(--story-ink-3)" }}>Hover over a district, or press one to pin it.</p>}
        </div>
        {ranked.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {([["Highest", ranked.slice(0, 8)], ["Lowest", ranked.slice(-8).reverse()]] as const).map(([label, rows]) => (
              <div key={label} className="story-card p-3">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.06em]" style={{ color: "var(--story-ink-3)" }}>{label}</p>
                <ol className="mt-1.5 space-y-0.5 text-[11.5px]">
                  {rows.map((r) => (
                    <li key={r.d} className="flex justify-between gap-2"><button type="button" className="truncate text-left hover:underline" onClick={() => setPinned(r.d)}>{r.s!.name} <span style={{ color: "var(--story-ink-3)" }}>· {r.s!.state}</span></button><span className="mono shrink-0 tabular-nums">{fmt(r.v, ind?.unit)}</span></li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
