"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type WheelEvent as RWheelEvent } from "react";
import { MEASURE, MEASURES, NO_DATA, bandOf, quintiles, rampFor, ranked, stateKey, type MalDistrict, type MalMap, type MeasureId } from "@/lib/malnutrition";

/**
 * Child malnutrition, district by district, on a dark map you can pan, zoom,
 * search and click. Colours are WHO severity bands by default, or quintiles of
 * the measured districts in "spread" mode. A district with no measurement —
 * never surveyed, or carrying only an estimate inherited from the district it
 * was carved out of — is hatched and never coloured.
 */

type Mode = "who" | "spread";
type VB = [number, number, number, number];
const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v.toFixed(1)}%`);

export function MalnutritionMap({ data }: { data: MalMap }) {
  const [m, setM] = useState<MeasureId>("stunting");
  const [mode, setMode] = useState<Mode>("who");
  const [state, setState] = useState<string>("");
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const full: VB = useMemo(() => [0, 0, data.width, data.height], [data]);
  const [vb, setVb] = useState<VB>(full);
  const svg = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const def = MEASURE[m];
  const byId = useMemo(() => new Map(data.districts.map((d) => [d.id, d])), [data]);
  const states = useMemo(() => [...new Set(data.districts.filter((d) => MEASURES.some((k) => d.v[k] !== null)).map((d) => d.state))].sort(), [data]);

  // Bands: WHO thresholds, or quintiles of what is measured (derived).
  const measured = useMemo(() => data.districts.map((d) => d.v[m]).filter((x): x is number => x !== null), [data, m]);
  const bounds = useMemo(() => (mode === "who" ? def.bands.map((b) => b.from) : quintiles(measured)), [mode, def, measured]);
  const labels = useMemo(() => (mode === "who" ? def.bands.map((b) => b.label) : bounds.map((b, i) => `${b.toFixed(1)}${i < bounds.length - 1 ? `–${bounds[i + 1]!.toFixed(1)}` : "+"}%`)), [mode, def, bounds]);
  const colour = useCallback((v: number | null) => (v === null ? "url(#mal-hatch)" : rampFor(bandOf(v, bounds), bounds.length)), [bounds]);
  const counts = useMemo(() => { const c = bounds.map(() => 0); for (const v of measured) c[bandOf(v, bounds)]!++; return c; }, [bounds, measured]);
  const noData = data.districts.filter((d) => d.v[m] === null);
  const estimated = noData.filter((d) => d.est).length;

  // Zoom to a state: the union of its districts' boxes.
  const boxOf = useCallback((ids: string[]): VB | null => {
    const el = svg.current;
    if (!el) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const id of ids) {
      const p = el.querySelector<SVGPathElement>(`path[data-id="${CSS.escape(id)}"]`);
      if (!p) continue;
      const b = p.getBBox();
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
    }
    if (!Number.isFinite(x0)) return null;
    const pad = Math.max(x1 - x0, y1 - y0) * 0.08 + 6;
    const w = x1 - x0 + 2 * pad, h = y1 - y0 + 2 * pad;
    const ar = data.width / data.height;
    const W = Math.max(w, h * ar), H = W / ar;
    return [x0 - pad - (W - w) / 2, y0 - pad - (H - h) / 2, W, H];
  }, [data]);
  // Picking a district in another state clears the state filter without undoing the zoom onto the district.
  const keepView = useRef(false);
  useEffect(() => {
    if (keepView.current) { keepView.current = false; return; }
    if (!state) { setVb(full); return; }
    const b = boxOf(data.districts.filter((d) => d.state === state).map((d) => d.id));
    if (b) setVb(b);
  }, [state, boxOf, data, full]);

  // Pan, wheel-zoom and pinch.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; vb: VB; moved: boolean; pinch?: number } | null>(null);
  const toUnits = (dx: number, dy: number) => { const r = svg.current!.getBoundingClientRect(); return [(dx * vb[2]) / r.width, (dy * vb[3]) / r.height] as const; };
  const zoomAt = useCallback((f: number, cx?: number, cy?: number) => {
    setVb((cur) => {
      const r = svg.current?.getBoundingClientRect();
      const px = r && cx !== undefined ? cur[0] + ((cx - r.left) / r.width) * cur[2] : cur[0] + cur[2] / 2;
      const py = r && cy !== undefined ? cur[1] + ((cy - r.top) / r.height) * cur[3] : cur[1] + cur[3] / 2;
      const w = Math.min(full[2] * 1.2, Math.max(full[2] / 40, cur[2] * f)), h = (w * cur[3]) / cur[2];
      return [px - ((px - cur[0]) * w) / cur[2], py - ((py - cur[1]) * h) / cur[3], w, h];
    });
  }, [full]);
  const onWheel = (e: RWheelEvent) => { e.preventDefault(); zoomAt(e.deltaY > 0 ? 1.18 : 1 / 1.18, e.clientX, e.clientY); };
  useEffect(() => {
    // React's onWheel is passive; the page must not scroll while the map zooms.
    const el = svg.current;
    if (!el) return;
    const stop = (e: WheelEvent) => e.preventDefault();
    el.addEventListener("wheel", stop, { passive: false });
    return () => el.removeEventListener("wheel", stop);
  }, []);
  const onDown = (e: RPointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const ps = [...pointers.current.values()];
    drag.current = { x: e.clientX, y: e.clientY, vb, moved: false, pinch: ps.length === 2 ? Math.hypot(ps[0]!.x - ps[1]!.x, ps[0]!.y - ps[1]!.y) : undefined };
  };
  const onMove = (e: RPointerEvent) => {
    const id = (e.target as Element).getAttribute?.("data-id");
    const r = wrap.current?.getBoundingClientRect();
    if (e.pointerType === "mouse") setHover(id && r ? { id, x: e.clientX - r.left, y: e.clientY - r.top } : null);
    if (!pointers.current.has(e.pointerId) || !drag.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const ps = [...pointers.current.values()];
    if (ps.length === 2 && drag.current.pinch) {
      const d = Math.hypot(ps[0]!.x - ps[1]!.x, ps[0]!.y - ps[1]!.y);
      const f = drag.current.pinch / d, base = drag.current.vb;
      const w = Math.min(full[2] * 1.2, Math.max(full[2] / 40, base[2] * f)), h = (w * base[3]) / base[2];
      setVb([base[0] + (base[2] - w) / 2, base[1] + (base[3] - h) / 2, w, h]);
      drag.current.moved = true;
      return;
    }
    const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
    if (Math.hypot(dx, dy) > 4) drag.current.moved = true;
    if (drag.current.moved) { const [ux, uy] = toUnits(dx, dy); const b = drag.current.vb; setVb([b[0] - ux, b[1] - uy, b[2], b[3]]); }
  };
  const onUp = (e: RPointerEvent) => {
    const wasClick = drag.current && !drag.current.moved && pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    if (wasClick) {
      const id = (e.target as Element).getAttribute?.("data-id");
      setSel(id && id !== sel ? id : null);
    }
    if (pointers.current.size === 0) drag.current = null;
  };

  // The paths, drawn once per colouring: hover and selection are overlays.
  const paths = useMemo(() => data.districts.map((d) => (
    <path key={d.id} data-id={d.id} d={d.d} fill={colour(d.v[m])} stroke="#070b12" strokeWidth={0.6} vectorEffect="non-scaling-stroke"
      opacity={state && d.state !== state ? 0.28 : 1} />
  )), [data, colour, m, state]);

  const hv = hover ? byId.get(hover.id) : null;
  const sd = sel ? byId.get(sel) : null;
  const list = useMemo(() => ranked(data.districts.filter((d) => !state || d.state === state), m), [data, state, m]);
  const rankAll = useMemo(() => ranked(data.districts, m), [data, m]);
  const nat = data.national[m];
  const found = q.trim().length > 1 ? data.districts.filter((d) => `${d.name} ${d.state}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8) : [];
  const pick = (d: MalDistrict) => { setSel(d.id); setQ(""); if (state && d.state !== state) { keepView.current = true; setState(""); } const b = boxOf([d.id]); if (b) { const s = Math.max(b[2], full[2] / 5); setVb([b[0] + b[2] / 2 - s / 2, b[1] + b[3] / 2 - (s * full[3]) / full[2] / 2, s, (s * full[3]) / full[2]]); } };
  const legendRows = labels.map((l, i) => ({ l, c: rampFor(i, labels.length), n: counts[i] ?? 0, range: mode === "who" ? `${bounds[i]}${i < bounds.length - 1 ? `–${bounds[i + 1]}` : "+"}%` : "" }));

  return (
    <div className="mal">
      <div className="mal-controls">
        <div className="mal-tabs" role="tablist" aria-label="Measure">
          {MEASURES.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={k === m} onClick={() => setM(k)}>
              <b>{MEASURE[k].name}</b><span>{MEASURE[k].short}</span>
            </button>
          ))}
        </div>
        <div className="mal-row">
          <div className="mal-seg" role="radiogroup" aria-label="Colour by">
            <button type="button" role="radio" aria-checked={mode === "who"} onClick={() => setMode("who")}>{def.bandSource === "plain" ? "10-point bands" : "WHO severity"}</button>
            <button type="button" role="radio" aria-checked={mode === "spread"} onClick={() => setMode("spread")}>Spread (quintiles)</button>
          </div>
          <select className="mal-select" value={state} onChange={(e) => setState(e.target.value)} aria-label="Zoom to a state">
            <option value="">All India</option>
            {states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="relative">
            <input className="mal-search" placeholder="Find a district…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a district" />
            {found.length > 0 && (
              <ul className="mal-found">
                {found.map((d) => <li key={d.id}><button type="button" onClick={() => pick(d)}>{d.name}<span>{d.state}</span></button></li>)}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="mal-grid">
        <div ref={wrap} className="mal-mapwrap" onPointerLeave={() => setHover(null)}>
          <svg ref={svg} viewBox={vb.join(" ")} className="mal-svg" role="img" aria-label={`Map of ${def.name.toLowerCase()} in children under five, by district, NFHS-5`}
            onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
            <defs>
              <pattern id="mal-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="4" height="4" fill={NO_DATA} />
                <line x1="0" y1="0" x2="0" y2="4" stroke="#334155" strokeWidth="1.2" />
              </pattern>
            </defs>
            <g>{paths}</g>
            <path d={data.borders} fill="none" stroke="#c9d6e8" strokeOpacity={0.35} strokeWidth={0.8} vectorEffect="non-scaling-stroke" pointerEvents="none" />
            <path d={data.outline} fill="none" stroke="#e6eefb" strokeOpacity={0.7} strokeWidth={1.1} vectorEffect="non-scaling-stroke" pointerEvents="none" />
            {hv && <path d={hv.d} fill="none" stroke="#ffffff" strokeWidth={1.6} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
            {sd && <path d={sd.d} fill="none" stroke="#7fe0ff" strokeWidth={2.4} vectorEffect="non-scaling-stroke" pointerEvents="none" className="mal-sel" />}
          </svg>
          <div className="mal-zoom">
            <button type="button" aria-label="Zoom in" onClick={() => zoomAt(1 / 1.5)}>+</button>
            <button type="button" aria-label="Zoom out" onClick={() => zoomAt(1.5)}>−</button>
            <button type="button" aria-label="Reset view" onClick={() => { setState(""); setVb(full); }}>⟲</button>
          </div>
          <p className="mal-hint">Drag to pan · scroll or pinch to zoom · tap a district</p>
          {hv && hover && (
            <div className="mal-tip" style={{ left: Math.min(hover.x + 14, (wrap.current?.clientWidth ?? 600) - 230), top: hover.y + 14 }}>
              <b>{hv.name}</b><span>{hv.state}</span>
              <p className="mal-tip-v">{fmt(hv.v[m])} <small>{def.name.toLowerCase()}</small></p>
              {hv.v[m] !== null ? <p>{labels[bandOf(hv.v[m]!, bounds)]}{mode === "who" && def.bandSource !== "plain" ? " (WHO)" : ""} · India {fmt(nat.nfhs5)}</p>
                : <p>{hv.est ? "Only an estimate from its parent district exists; not shown" : "Not surveyed by NFHS-5"}</p>}
            </div>
          )}
        </div>

        <aside className="mal-side">
          <div className="mal-legend">
            <p className="mal-h">{def.name} · {mode === "who" ? (def.bandSource === "who-2019" ? "WHO–UNICEF prevalence thresholds" : def.bandSource === "who-anaemia" ? "WHO public-health significance" : "plain bands — WHO sets none for child underweight") : "quintiles of measured districts (derived)"}</p>
            <ul>
              {[...legendRows].reverse().map((r) => (
                <li key={r.l}>
                  <span className="mal-sw" style={{ background: r.c }} aria-hidden />
                  <span className="flex-1">{r.l}{r.range && <em> {r.range}</em>}</span>
                  <span className="mal-bar"><i style={{ width: `${(100 * r.n) / Math.max(1, measured.length)}%`, background: r.c }} /></span>
                  <b>{r.n}</b>
                </li>
              ))}
              <li><span className="mal-sw mal-sw-hatch" aria-hidden /><span className="flex-1">No measurement<em> {estimated} estimate{estimated === 1 ? "" : "s"} withheld</em></span><span className="mal-bar" /><b>{noData.length}</b></li>
            </ul>
            <p className="mal-note">District counts; {measured.length} districts measured. India: {fmt(nat.nfhs5)} in NFHS-5, {fmt(nat.nfhs4)} in NFHS-4.</p>
          </div>

          {sd ? (
            <div className="mal-card">
              <div className="flex items-start justify-between gap-2">
                <div><p className="mal-h">Selected district</p><h3>{sd.name}</h3><p className="mal-sub">{sd.state}</p></div>
                <button type="button" className="mal-x" aria-label="Clear selection" onClick={() => setSel(null)}>✕</button>
              </div>
              {MEASURES.map((k) => {
                const v = sd.v[k], st = data.states[stateKey(sd.state)]?.[k], n = data.national[k].nfhs5;
                const r = v === null ? -1 : ranked(data.districts, k).findIndex((d) => d.id === sd.id);
                const max = k === "anaemia" ? 100 : 70;
                return (
                  <div key={k} className="mal-measure">
                    <p><b>{MEASURE[k].name}</b> <span>{fmt(v)}</span>{r >= 0 && <em> · {r + 1} of {ranked(data.districts, k).length} worst</em>}</p>
                    <div className="mal-track">
                      {v !== null && <i style={{ width: `${(100 * v) / max}%`, background: rampFor(bandOf(v, MEASURE[k].bands.map((b) => b.from)), MEASURE[k].bands.length) }} />}
                      {typeof st === "number" && <s style={{ left: `${(100 * st) / max}%` }} title={`State ${st}%`} />}
                      {n !== null && <u style={{ left: `${(100 * n) / max}%` }} title={`India ${n}%`} />}
                    </div>
                    <p className="mal-sub">State {fmt(st)} · India {fmt(n)}</p>
                  </div>
                );
              })}
              <p className="mal-note">Tick marks: white is the state, blue is India. Ranks are among measured districts (derived).</p>
            </div>
          ) : (
            <div className="mal-card"><p className="mal-h">Tap a district</p><p className="mal-sub">for all four measures beside its state and India.</p></div>
          )}

          <div className="mal-card">
            <p className="mal-h">{state ? `${state}: ` : ""}highest {def.name.toLowerCase()}</p>
            <ol className="mal-list">
              {(showAll ? list : list.slice(0, 10)).map((d) => (
                <li key={d.id}><button type="button" onClick={() => pick(d)} aria-current={d.id === sel}>
                  <span className="mal-rank">{rankAll.findIndex((x) => x.id === d.id) + 1}</span>
                  <span className="flex-1">{d.name}{!state && <em> {d.state}</em>}</span>
                  <b>{fmt(d.v[m])}</b>
                </button></li>
              ))}
            </ol>
            {list.length > 10 && <button type="button" className="mal-more" onClick={() => setShowAll((v) => !v)}>{showAll ? "Show top 10" : `Show all ${list.length}`}</button>}
            {!showAll && list.length > 10 && (
              <>
                <p className="mal-h mt-3">Lowest</p>
                <ol className="mal-list">
                  {list.slice(-5).reverse().map((d) => (
                    <li key={d.id}><button type="button" onClick={() => pick(d)} aria-current={d.id === sel}>
                      <span className="mal-rank">{rankAll.findIndex((x) => x.id === d.id) + 1}</span>
                      <span className="flex-1">{d.name}{!state && <em> {d.state}</em>}</span>
                      <b>{fmt(d.v[m])}</b>
                    </button></li>
                  ))}
                </ol>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
