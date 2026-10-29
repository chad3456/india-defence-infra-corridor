"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NO_DATA, RAMP, bandOf } from "@/lib/malnutrition";
import { CHANGE_BOUNDS, CHANGE_LABELS, cellOf, changeOf, displayLabel, fmtNum, isPercent, markOf, scaleFor, type Area, type Nfhs6Row, type Nfhs6States } from "@/lib/nfhs6";
import { usePanZoom, type VB } from "./usePanZoom";

/**
 * Every NFHS-6 (2023–24) indicator on the dark map: by state from IIPS's
 * India and State/UT fact sheets, and by district once the district
 * compendiums have been read. Choose any of the fact sheet's indicators, the
 * 2023–24 level or the change since NFHS-5, and total, urban or rural.
 *
 * Colour shows magnitude, not a verdict: stunting and wasting use WHO's
 * thresholds as on the NFHS-5 map, every other indicator quintiles of the
 * geographies shown on a neutral blue ramp, and change a two-sided ramp that
 * says only "fell" or "rose".
 */

const BLUE = ["#1c4f8f", "#2a6bbd", "#3d8ae0", "#72abee", "#a9cdf6"] as const;
const CHANGE = ["#a9cdf6", "#3d8ae0", "#1c4f8f", "#383835", "#a5461a", "#f58a3d", "#ffc08a"] as const;
const MARK: Record<string, string> = { s: "based on 25–49 unweighted cases", x: "suppressed: fewer than 25 cases", n: "not available" };

export interface Nfhs6Geometry { width: number; height: number; districts: Array<{ id: string; name: string; state: string; d: string }>; outline: string; borders: string }

export function Nfhs6Map({ geo, data, stateOf, districtRows }: {
  geo: Nfhs6Geometry;
  data: Nfhs6States;
  /** Each map state name → the fact sheet's geography name. */
  stateOf: Record<string, string>;
  /** NFHS-6 district rows by map district id, once the compendiums are read. */
  districtRows: Record<string, Nfhs6Row[]> | null;
}) {
  const first = data.indicators.find((i) => /\bstunted\b/i.test(i.label))?.n ?? data.indicators[0]?.n ?? 1;
  const [n, setN] = useState(first);
  const [level, setLevel] = useState<"states" | "districts">(districtRows ? "districts" : "states");
  const [show, setShow] = useState<"level" | "change">("level");
  const [area, setArea] = useState<Area>("total");
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [q, setQ] = useState("");
  const [profile, setProfile] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const full: VB = useMemo(() => [0, 0, geo.width, geo.height], [geo]);
  const { vb, setVb, zoomAt, handlers, fit } = usePanZoom(svg, full, (id) => setSel(id && id !== sel ? id : null));
  const ind = data.indicators.find((i) => i.n === n)!;
  const byId = useMemo(() => new Map(geo.districts.map((d) => [d.id, d])), [geo]);
  const sections = useMemo(() => [...new Set(data.indicators.map((i) => (i.section || "Other").split(" · ")[0]!))], [data]);
  const sectionOf = (i: { section: string }) => (i.section || "Other").split(" · ")[0]!;
  const unit = isPercent(ind.unit) ? "%" : "";
  const fmt = (v: number | null) => (v === null ? "—" : `${fmtNum(v)}${unit}`);
  const fmtD = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : "±"}${fmtNum(Math.abs(v))}${unit ? " pts" : ""}`);
  const useArea: Area | "prev" = level === "districts" ? "total" : area;

  // Rows for each map district: its state's, or its own.
  const rowsFor = (id: string): Nfhs6Row[] | undefined => {
    if (level === "districts") return districtRows?.[id];
    const d = byId.get(id);
    return d ? data.geos[stateOf[d.state] ?? ""] : undefined;
  };
  const valueFor = (rows: Nfhs6Row[] | undefined) => (show === "change" ? changeOf(rows, n) : cellOf(rows, n, useArea));

  // The geographies shown, for the scale and the ranking.
  const shown = useMemo(() => {
    if (level === "districts" && districtRows) return geo.districts.filter((d) => districtRows[d.id]).map((d) => ({ key: d.id, name: d.name, sub: d.state, rows: districtRows[d.id]! }));
    return Object.entries(data.geos).filter(([g]) => g !== "India").map(([g, rows]) => ({ key: g, name: g, sub: "", rows }));
  }, [level, districtRows, geo, data]);
  const values = shown.map((s) => valueFor(s.rows)).filter((v): v is number => v !== null);
  const scale = useMemo(() => scaleFor(ind, show === "change" ? [] : values), [ind, show, values.join(",")]);
  const isWho = scale.kind !== "quintile";
  const bounds = show === "change" ? CHANGE_BOUNDS : scale.bounds;
  const labels = show === "change" ? CHANGE_LABELS : scale.labels;
  const colourOf = (v: number | null) => {
    if (v === null) return "url(#n6-hatch)";
    const k = bandOf(v, bounds);
    if (show === "change") return CHANGE[k]!;
    const ramp = isWho ? RAMP : BLUE;
    return ramp[ramp.length - bounds.length + k] ?? ramp[ramp.length - 1]!;
  };
  const counts = bounds.map(() => 0);
  for (const v of shown.map((s) => valueFor(s.rows))) if (v !== null) counts[bandOf(v, bounds)]!++;

  const paths = useMemo(() => geo.districts.map((d) => {
    const c = colourOf(valueFor(rowsFor(d.id)));
    const st = level === "states";
    return <path key={d.id} data-id={d.id} d={d.d} fill={c} stroke={st && !c.startsWith("url") ? c : "#070b12"} strokeWidth={st ? 0.4 : 0.6} vectorEffect="non-scaling-stroke" />;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [geo, n, level, show, area, bounds.join(","), districtRows]);

  const selD = sel ? byId.get(sel) : null;
  const selGeo = selD ? (level === "districts" ? selD.name : stateOf[selD.state] ?? selD.state) : null;
  const selRows = selD ? rowsFor(selD.id) : undefined;
  const india = data.geos.India;
  const hv = hover ? byId.get(hover.id) : null;
  const hvRows = hv ? rowsFor(hv.id) : undefined;
  const ranked = [...shown].map((s) => ({ ...s, v: valueFor(s.rows) })).filter((s) => s.v !== null).sort((a, b) => b.v! - a.v!);
  const maxAbs = Math.max(1, ...ranked.map((r) => Math.abs(r.v!)));
  const filtered = q.trim() ? data.indicators.filter((i) => `${i.n} ${displayLabel(i)} ${i.section}`.toLowerCase().includes(q.trim().toLowerCase())) : data.indicators;

  // Selecting a state's row in the ranking zooms to it.
  const zoomToGeo = (key: string) => {
    if (level === "districts") { setSel(key); fit([key], full[2] / 5); return; }
    const ids = geo.districts.filter((d) => stateOf[d.state] === key).map((d) => d.id);
    if (ids[0]) { setSel(ids[0]); fit(ids); }
  };
  useEffect(() => { if (!districtRows && level === "districts") setLevel("states"); }, [districtRows, level]);

  return (
    <div className="mal">
      <div className="mal-controls">
        <div className="mal-row">
          <div className="n6-pick">
            <input className="mal-search" placeholder={`Search ${data.indicators.length} indicators…`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search indicators" />
            <select className="mal-select n6-select" value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="Indicator">
              {sections.map((s) => {
                const list = filtered.filter((i) => sectionOf(i) === s);
                return list.length ? <optgroup key={s} label={s}>{list.map((i) => <option key={i.n} value={i.n}>{i.n}. {displayLabel(i)}</option>)}</optgroup> : null;
              })}
            </select>
          </div>
        </div>
        <div className="mal-row">
          <div className="mal-seg" role="radiogroup" aria-label="Level">
            <button type="button" role="radio" aria-checked={level === "states"} onClick={() => setLevel("states")}>States</button>
            <button type="button" role="radio" aria-checked={level === "districts"} disabled={!districtRows} title={districtRows ? "" : "District fact sheets not yet read"} onClick={() => setLevel("districts")}>Districts</button>
          </div>
          <div className="mal-seg" role="radiogroup" aria-label="Show">
            <button type="button" role="radio" aria-checked={show === "level"} onClick={() => setShow("level")}>2023–24</button>
            <button type="button" role="radio" aria-checked={show === "change"} onClick={() => setShow("change")}>Change since 2019–21</button>
          </div>
          {level === "states" && show === "level" && (
            <div className="mal-seg" role="radiogroup" aria-label="Area">
              {(["total", "urban", "rural"] as Area[]).map((a) => <button key={a} type="button" role="radio" aria-checked={area === a} onClick={() => setArea(a)}>{a[0]!.toUpperCase() + a.slice(1)}</button>)}
            </div>
          )}
        </div>
      </div>

      <div className="mal-grid">
        <div ref={wrap} className="mal-mapwrap" onPointerLeave={() => setHover(null)}
          onPointerMove={(e) => { const id = (e.target as Element).getAttribute?.("data-id"); const r = wrap.current?.getBoundingClientRect(); if (e.pointerType === "mouse") setHover(id && r ? { id, x: e.clientX - r.left, y: e.clientY - r.top } : null); }}>
          <svg ref={svg} viewBox={vb.join(" ")} className="mal-svg" role="img" aria-label={`Map of ${displayLabel(ind)}, NFHS-6, by ${level === "states" ? "state" : "district"}`} {...handlers} onPointerCancel={handlers.onPointerUp}>
            <defs>
              <pattern id="n6-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="4" height="4" fill={NO_DATA} /><line x1="0" y1="0" x2="0" y2="4" stroke="#334155" strokeWidth="1.2" />
              </pattern>
            </defs>
            <g>{paths}</g>
            <path d={geo.borders} fill="none" stroke="#c9d6e8" strokeOpacity={level === "states" ? 0.6 : 0.35} strokeWidth={0.8} vectorEffect="non-scaling-stroke" pointerEvents="none" />
            <path d={geo.outline} fill="none" stroke="#e6eefb" strokeOpacity={0.7} strokeWidth={1.1} vectorEffect="non-scaling-stroke" pointerEvents="none" />
            {selD && (level === "states"
              ? geo.districts.filter((d) => d.state === selD.state).map((d) => <path key={d.id} d={d.d} fill="none" stroke="#7fe0ff" strokeWidth={1.4} vectorEffect="non-scaling-stroke" pointerEvents="none" />)
              : <path d={selD.d} fill="none" stroke="#7fe0ff" strokeWidth={2.4} vectorEffect="non-scaling-stroke" pointerEvents="none" className="mal-sel" />)}
          </svg>
          <div className="mal-zoom">
            <button type="button" aria-label="Zoom in" onClick={() => zoomAt(1 / 1.5)}>+</button>
            <button type="button" aria-label="Zoom out" onClick={() => zoomAt(1.5)}>−</button>
            <button type="button" aria-label="Reset view" onClick={() => { setSel(null); setVb(full); }}>⟲</button>
          </div>
          <p className="mal-hint">Drag to pan · scroll or pinch to zoom · tap a {level === "states" ? "state" : "district"}</p>
          {hv && hover && (
            <div className="mal-tip" style={{ left: Math.min(hover.x + 14, (wrap.current?.clientWidth ?? 600) - 230), top: hover.y + 14 }}>
              <b>{level === "states" ? stateOf[hv.state] ?? hv.state : hv.name}</b><span>{level === "states" ? "state figure" : hv.state}</span>
              <p className="mal-tip-v">{show === "change" ? fmtD(valueFor(hvRows)) : fmt(valueFor(hvRows))}</p>
              {(() => { const m = markOf(hvRows, n, show === "change" ? "total" : useArea); return m ? <p>{MARK[m]}</p> : null; })()}
              {!hvRows && <p>{level === "states" ? "Not in the NFHS-6 fact sheets (Manipur was not surveyed)" : "No NFHS-6 district figure joined"}</p>}
            </div>
          )}
        </div>

        <aside className="mal-side">
          <div className="mal-legend">
            <p className="mal-h">{ind.n}. {displayLabel(ind)}{ind.unit && !isPercent(ind.unit) ? ` (${ind.unit})` : ""}</p>
            <p className="mal-note" style={{ marginTop: 4 }}>{show === "change" ? "Change from NFHS-5 (2019–21) to NFHS-6 (2023–24), total, in points — derived." : scale.kind === "quintile" ? `Quintiles of the ${level} shown (derived); colour shows magnitude only.` : scale.kind === "plain-underweight" ? "Plain ten-point bands — WHO sets none for underweight." : "WHO–UNICEF prevalence thresholds."}</p>
            <ul>
              {labels.map((l, i) => ({ l, c: show === "change" ? CHANGE[i]! : (isWho ? RAMP : BLUE)[(isWho ? RAMP : BLUE).length - bounds.length + i]!, n: counts[i] ?? 0 })).reverse().map((r) => (
                <li key={r.l}><span className="mal-sw" style={{ background: r.c }} aria-hidden /><span className="flex-1">{r.l}</span><span className="mal-bar"><i style={{ width: `${(100 * r.n) / Math.max(1, values.length)}%`, background: r.c }} /></span><b>{r.n}</b></li>
              ))}
              <li><span className="mal-sw mal-sw-hatch" aria-hidden /><span className="flex-1">No figure</span><span className="mal-bar" /><b>{shown.length - values.length}</b></li>
            </ul>
            <p className="mal-note">India: {fmt(cellOf(india, n, "total"))} in NFHS-6 (urban {fmt(cellOf(india, n, "urban"))}, rural {fmt(cellOf(india, n, "rural"))}); {fmt(cellOf(india, n, "prev"))} in NFHS-5.</p>
          </div>

          {selD && selGeo ? (
            <div className="mal-card">
              <div className="flex items-start justify-between gap-2">
                <div><p className="mal-h">Selected {level === "states" ? "state" : "district"}</p><h3>{selGeo}</h3>{level === "districts" && <p className="mal-sub">{selD.state}</p>}</div>
                <button type="button" className="mal-x" aria-label="Clear selection" onClick={() => setSel(null)}>✕</button>
              </div>
              {selRows ? (
                <>
                  <table className="n6-mini">
                    <tbody>
                      <tr><td>NFHS-6 total</td><td>{fmt(cellOf(selRows, n, "total"))}</td></tr>
                      {level === "states" && <tr><td>Urban · Rural</td><td>{fmt(cellOf(selRows, n, "urban"))} · {fmt(cellOf(selRows, n, "rural"))}</td></tr>}
                      <tr><td>NFHS-5 total</td><td>{fmt(cellOf(selRows, n, "prev"))}</td></tr>
                      <tr><td>Change (derived)</td><td>{fmtD(changeOf(selRows, n))}</td></tr>
                      <tr><td>India, NFHS-6</td><td>{fmt(cellOf(india, n, "total"))}</td></tr>
                    </tbody>
                  </table>
                  <button type="button" className="mal-more" onClick={() => setProfile((v) => !v)}>{profile ? "Hide" : "Show"} all {data.indicators.length} indicators for {selGeo}</button>
                  {profile && (
                    <div className="n6-profile">
                      {sections.map((s) => (
                        <div key={s}>
                          <p className="mal-h mt-3">{s}</p>
                          <table className="n6-mini">
                            <tbody>
                              {data.indicators.filter((i) => sectionOf(i) === s).map((i) => {
                                const u = isPercent(i.unit) ? "%" : "";
                                const v = cellOf(selRows, i.n, "total"), p = cellOf(selRows, i.n, "prev"), c = changeOf(selRows, i.n);
                                return (
                                  <tr key={i.n} className={i.n === n ? "n6-on" : ""} onClick={() => setN(i.n)}>
                                    <td>{i.n}. {displayLabel(i)}</td>
                                    <td>{v === null ? "—" : `${fmtNum(v)}${u}`}</td>
                                    <td className="n6-dim">{p === null ? "—" : fmtNum(p)}</td>
                                    <td className="n6-dim">{c === null ? "" : `${c > 0 ? "+" : ""}${fmtNum(c)}`}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ))}
                      <p className="mal-note">Columns: NFHS-6 total, NFHS-5 total, change in points (derived). Click a row to map it.</p>
                    </div>
                  )}
                </>
              ) : <p className="mal-sub mt-2">{level === "states" ? "Not in the NFHS-6 fact sheets." : "No NFHS-6 district figure joined."}</p>}
            </div>
          ) : (
            <div className="mal-card"><p className="mal-h">Tap a {level === "states" ? "state" : "district"}</p><p className="mal-sub">for its figures, and every indicator side by side with NFHS-5.</p></div>
          )}

          <div className="mal-card">
            <p className="mal-h">{level === "states" ? "States" : "Districts"}, highest first</p>
            <ol className="mal-list">
              {ranked.slice(0, level === "states" ? 40 : 15).map((r, i) => (
                <li key={r.key}><button type="button" onClick={() => zoomToGeo(r.key)} aria-current={selGeo === r.name}>
                  <span className="mal-rank">{i + 1}</span>
                  <span className="flex-1">{r.name}{r.sub && <em> {r.sub}</em>}</span>
                  <span className="mal-bar"><i style={{ width: `${(100 * Math.abs(r.v!)) / maxAbs}%`, background: colourOf(r.v) }} /></span>
                  <b>{show === "change" ? fmtD(r.v) : fmt(r.v)}</b>
                </button></li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
