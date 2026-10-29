"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NO_DATA, RAMP, bandOf } from "@/lib/malnutrition";
import { CHANGE_BOUNDS, CHANGE_LABELS, SEX_PAIRS, THEMES, cellOf, changeOf, displayLabel, fmtNum, gapOf, isPercent, markOf, pairOf, scaleFor, type Area, type Nfhs6Row, type Nfhs6States, type ThemeId } from "@/lib/nfhs6";
import { usePanZoom, type VB } from "./usePanZoom";

/**
 * Every NFHS-6 (2023–24) indicator on the dark map: by state from IIPS's
 * India and State/UT fact sheets, and by district once the district
 * compendiums have been read. Choose any of the fact sheet's indicators, the
 * 2023–24 level or the change since NFHS-5, and total, urban or rural.
 * Themes regroup the fact sheet's modules by subject; for an indicator
 * measured for both women and men, the map can show women's value minus
 * men's (derived).
 *
 * Colour shows magnitude, not a verdict: stunting and wasting use WHO's
 * thresholds as on the NFHS-5 map, every other indicator quintiles of the
 * geographies shown on a neutral blue ramp, and change a two-sided ramp that
 * says only "fell" or "rose".
 */

const BLUE = ["#1c4f8f", "#2a6bbd", "#3d8ae0", "#72abee", "#a9cdf6"] as const;
const CHANGE = ["#a9cdf6", "#3d8ae0", "#1c4f8f", "#383835", "#a5461a", "#f58a3d", "#ffc08a"] as const;
const GAP_LABELS = ["Women 5+ lower", "Women 2–5 lower", "Women 0.5–2 lower", "Within ±0.5", "Women 0.5–2 higher", "Women 2–5 higher", "Women 5+ higher"];
const MARK: Record<string, string> = { s: "based on 25–49 unweighted cases", x: "suppressed: fewer than 25 cases", n: "not available" };

export interface Nfhs6Geometry { width: number; height: number; districts: Array<{ id: string; name: string; state: string; d: string }>; outline: string; borders: string }

export function Nfhs6Map({ geo, data, stateOf, districtRows, rounds = { now: "2023–24", prev: "2019–21", nowName: "NFHS-6", prevName: "NFHS-5" }, missing = "Not in the NFHS-6 fact sheets (Manipur was not surveyed)" }: {
  geo: Nfhs6Geometry;
  data: Nfhs6States;
  /** The dataset's rounds; an indicator's own now/prev labels override them. */
  rounds?: { now: string; prev: string; nowName: string; prevName: string };
  /** Why a state has no figure. */
  missing?: string;
  /** Each map state name → the fact sheet's geography name. */
  stateOf: Record<string, string>;
  /** NFHS-6 district rows by map district id, once the compendiums are read. */
  districtRows: Record<string, Nfhs6Row[]> | null;
}) {
  const first = data.indicators.find((i) => /\bstunted\b/i.test(i.label))?.n ?? data.indicators[0]?.n ?? 1;
  const [n, setN] = useState(first);
  const [level, setLevel] = useState<"states" | "districts">(districtRows ? "districts" : "states");
  const [show, setShow] = useState<"level" | "change" | "gap">("level");
  const [theme, setTheme] = useState<ThemeId | (string & {}) | "all">("all");
  const themes = data.themes ?? THEMES;
  const pairs = data.pairs ?? SEX_PAIRS;
  const [area, setArea] = useState<Area>("total");
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [q, setQ] = useState("");
  const [profile, setProfile] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const full: VB = useMemo(() => [0, 0, geo.width, geo.height], [geo]);
  const { vb, setVb, zoomAt, handlers, fit } = usePanZoom(svg, full, (id) => setSel(id && id !== sel ? id : null));
  const ind = data.indicators.find((i) => i.n === n) ?? data.indicators[0]!;
  const nowR = ind.now ?? rounds.now, prevR = ind.prev ?? rounds.prev;
  const nowN = ind.now ? ind.now : rounds.nowName, prevN = ind.prev ? ind.prev : rounds.prevName;
  const byId = useMemo(() => new Map(geo.districts.map((d) => [d.id, d])), [geo]);
  const sections = useMemo(() => [...new Set(data.indicators.map((i) => (i.section || "Other").split(" · ")[0]!))], [data]);
  const sectionOf = (i: { section: string }) => (i.section || "Other").split(" · ")[0]!;
  const unit = isPercent(ind.unit) ? "%" : "";
  const fmt = (v: number | null) => (v === null ? "—" : `${fmtNum(v, ind.unit)}${unit}`);
  const fmtD = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : "±"}${fmtNum(Math.abs(v), ind.unit)}${unit ? " pts" : ""}`);
  const useArea: Area | "prev" = level === "districts" ? "total" : area;

  // Rows for each map district: its state's, or its own.
  const rowsFor = (id: string): Nfhs6Row[] | undefined => {
    if (level === "districts") return districtRows?.[id];
    const d = byId.get(id);
    return d ? data.geos[stateOf[d.state] ?? ""] : undefined;
  };
  const pair = pairOf(n, pairs);
  const valueFor = (rows: Nfhs6Row[] | undefined) => (show === "change" ? changeOf(rows, n) : show === "gap" ? gapOf(rows, n, useArea, pairs) : cellOf(rows, n, useArea));
  const hasAreas = useMemo(() => Object.values(data.geos).some((rows) => rows.some((r) => r[0] === n && (r[1] !== null || r[2] !== null))), [data, n]);
  useEffect(() => { if (show === "gap" && !pair) setShow("level"); }, [show, pair]);

  // The geographies shown, for the scale and the ranking.
  const shown = useMemo(() => {
    if (level === "districts" && districtRows) return geo.districts.filter((d) => districtRows[d.id]).map((d) => ({ key: d.id, name: d.name, sub: d.state, rows: districtRows[d.id]! }));
    return Object.entries(data.geos).filter(([g]) => g !== "India").map(([g, rows]) => ({ key: g, name: g, sub: "", rows }));
  }, [level, districtRows, geo, data]);
  const values = shown.map((s) => valueFor(s.rows)).filter((v): v is number => v !== null);
  const scale = useMemo(() => scaleFor(ind, show !== "level" ? [] : values), [ind, show, values.join(",")]);
  const diverging = show !== "level";
  const isWho = scale.kind !== "quintile";
  const bounds = diverging ? CHANGE_BOUNDS : scale.bounds;
  const labels = show === "change" ? CHANGE_LABELS : show === "gap" ? GAP_LABELS : scale.labels;
  const colourOf = (v: number | null) => {
    if (v === null) return "url(#n6-hatch)";
    const k = bandOf(v, bounds);
    if (diverging) return CHANGE[k]!;
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
  const inTheme = theme === "all" ? null : new Set(themes.find((t) => t.id === theme)?.ns ?? []);
  const themed = inTheme ? data.indicators.filter((i) => inTheme.has(i.n)) : data.indicators;
  const filtered = q.trim() ? themed.filter((i) => `${i.n} ${displayLabel(i)} ${i.section}`.toLowerCase().includes(q.trim().toLowerCase())) : themed;
  const pickTheme = (t: string) => {
    setTheme(t);
    const th = themes.find((x) => x.id === t);
    if (th && !th.ns.includes(n)) setN(th.lead[0] ?? th.ns[0]!);
    if (t === "sex" && pairOf(th?.lead[0] ?? 0, pairs)) setShow("gap");
  };
  const fmtG = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : "±"}${fmtNum(Math.abs(v))} pts`);
  const fmtV = (v: number | null) => (show === "change" ? fmtD(v) : show === "gap" ? fmtG(v) : fmt(v));

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
        <div className="n6-themes" role="radiogroup" aria-label="Theme">
          {[{ id: "all", name: `All ${data.indicators.length}`, ns: [] as number[] }, ...themes].map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={theme === t.id} onClick={() => pickTheme(t.id)}>{t.name}{t.id !== "all" && <em> {t.ns.length}</em>}</button>
          ))}
        </div>
        {theme !== "all" && <p className="mal-note n6-blurb">{themes.find((t) => t.id === theme)?.blurb} Grouped by this site; the figures are {data.source.publisher.split(",")[0]}&apos;s.</p>}
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
            <button type="button" role="radio" aria-checked={show === "level"} onClick={() => setShow("level")}>{nowR}</button>
            <button type="button" role="radio" aria-checked={show === "change"} disabled={!data.indicators.length || Object.values(data.geos).every((rows) => rows.every((r) => r[0] !== n || r[4] === null))} onClick={() => setShow("change")}>Change since {prevR}</button>
            <button type="button" role="radio" aria-checked={show === "gap"} disabled={!pair} title={pair ? "" : "Not measured for both women and men"} onClick={() => setShow("gap")}>Women − men</button>
          </div>
          {level === "states" && show !== "change" && hasAreas && (
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
              <p className="mal-tip-v">{fmtV(valueFor(hvRows))}</p>
              {show === "gap" && pair && <p>Women {fmt(cellOf(hvRows, pair.women, useArea))} · men {fmt(cellOf(hvRows, pair.men, useArea))}</p>}
              {(() => { const m = markOf(hvRows, n, show === "change" ? "total" : useArea); return m ? <p>{MARK[m]}</p> : null; })()}
              {!hvRows && <p>{level === "states" ? missing : "No NFHS-6 district figure joined"}</p>}
            </div>
          )}
        </div>

        <aside className="mal-side">
          <div className="mal-legend">
            <p className="mal-h">{show === "gap" && pair ? `${pair.short}: women − men (#${pair.women} − #${pair.men})` : `${ind.n}. ${displayLabel(ind)}${ind.unit && !isPercent(ind.unit) ? ` (${ind.unit})` : ""}`}</p>
            <p className="mal-note" style={{ marginTop: 4 }}>{show === "change" ? `Change from ${prevN} to ${nowN}, total, in ${unit ? "points" : "the indicator's units"} — derived.` : show === "gap" ? `Women's figure minus men's, ${useArea}, ${nowN}, in points — derived. Colour shows which is higher, not which is better.` : scale.kind === "quintile" ? `Quintiles of the ${level} shown (derived); colour shows magnitude only.` : scale.kind === "plain-underweight" ? "Plain ten-point bands — WHO sets none for underweight." : "WHO–UNICEF prevalence thresholds."}</p>
            <ul>
              {labels.map((l, i) => ({ l, c: diverging ? CHANGE[i]! : (isWho ? RAMP : BLUE)[(isWho ? RAMP : BLUE).length - bounds.length + i]!, n: counts[i] ?? 0 })).reverse().map((r) => (
                <li key={r.l}><span className="mal-sw" style={{ background: r.c }} aria-hidden /><span className="flex-1">{r.l}</span><span className="mal-bar"><i style={{ width: `${(100 * r.n) / Math.max(1, values.length)}%`, background: r.c }} /></span><b>{r.n}</b></li>
              ))}
              <li><span className="mal-sw mal-sw-hatch" aria-hidden /><span className="flex-1">No figure</span><span className="mal-bar" /><b>{shown.length - values.length}</b></li>
            </ul>
            {show === "gap" && pair ? <p className="mal-note">India: women {fmt(cellOf(india, pair.women, "total"))}, men {fmt(cellOf(india, pair.men, "total"))} — a gap of {fmtG(gapOf(india, n, "total", pairs))} ({prevN}: {fmtG(gapOf(india, n, "prev", pairs))}).</p> :
            <p className="mal-note">India: {fmt(cellOf(india, n, "total"))} in {nowN}{hasAreas ? <> (urban {fmt(cellOf(india, n, "urban"))}, rural {fmt(cellOf(india, n, "rural"))})</> : null}; {fmt(cellOf(india, n, "prev"))} in {prevN}.</p>}
            {(ind.note || ind.cite) && <p className="mal-note">{ind.note} {ind.cite && <span className="n6-dim">Read from {ind.cite}.</span>}</p>}
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
                      <tr><td>{nowN} total</td><td>{fmt(cellOf(selRows, n, "total"))}</td></tr>
                      {level === "states" && hasAreas && <tr><td>Urban · Rural</td><td>{fmt(cellOf(selRows, n, "urban"))} · {fmt(cellOf(selRows, n, "rural"))}</td></tr>}
                      <tr><td>{prevN} total</td><td>{fmt(cellOf(selRows, n, "prev"))}</td></tr>
                      <tr><td>Change (derived)</td><td>{fmtD(changeOf(selRows, n))}</td></tr>
                      {pair && <tr><td>Women · men</td><td>{fmt(cellOf(selRows, pair.women, "total"))} · {fmt(cellOf(selRows, pair.men, "total"))}</td></tr>}
                      <tr><td>India, {nowN}</td><td>{fmt(cellOf(india, n, "total"))}</td></tr>
                    </tbody>
                  </table>
                  <button type="button" className="mal-more" onClick={() => setProfile((v) => !v)}>{profile ? "Hide" : "Show"} {theme === "all" ? `all ${data.indicators.length}` : `the ${themed.length} ${(themes.find((t) => t.id === theme)?.name ?? "").toLowerCase()}`} indicators for {selGeo}</button>
                  {profile && (
                    <div className="n6-profile">
                      {sections.filter((s) => themed.some((i) => sectionOf(i) === s)).map((s) => (
                        <div key={s}>
                          <p className="mal-h mt-3">{s}</p>
                          <table className="n6-mini">
                            <tbody>
                              {themed.filter((i) => sectionOf(i) === s).map((i) => {
                                const u = isPercent(i.unit) ? "%" : "";
                                const v = cellOf(selRows, i.n, "total"), p = cellOf(selRows, i.n, "prev"), c = changeOf(selRows, i.n);
                                return (
                                  <tr key={i.n} className={i.n === n ? "n6-on" : ""} onClick={() => setN(i.n)}>
                                    <td>{i.n}. {displayLabel(i)}</td>
                                    <td>{v === null ? "—" : `${fmtNum(v, i.unit)}${u}`}</td>
                                    <td className="n6-dim">{p === null ? "—" : fmtNum(p, i.unit)}</td>
                                    <td className="n6-dim">{c === null ? "" : `${c > 0 ? "+" : ""}${fmtNum(c, i.unit)}`}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ))}
                      <p className="mal-note">Columns: latest total, earlier round&apos;s total, change (derived). {data.themes ? "Rounds differ by indicator; the legend names them. " : ""}Click a row to map it.</p>
                    </div>
                  )}
                </>
              ) : <p className="mal-sub mt-2">{level === "states" ? missing : "No NFHS-6 district figure joined."}</p>}
            </div>
          ) : (
            <div className="mal-card"><p className="mal-h">Tap a {level === "states" ? "state" : "district"}</p><p className="mal-sub">for its figures, and every indicator side by side with {rounds.prevName}.</p></div>
          )}

          <div className="mal-card">
            <p className="mal-h">{level === "states" ? "States" : "Districts"}, highest first</p>
            <ol className="mal-list">
              {ranked.slice(0, level === "states" ? 40 : 15).map((r, i) => (
                <li key={r.key}><button type="button" onClick={() => zoomToGeo(r.key)} aria-current={selGeo === r.name}>
                  <span className="mal-rank">{i + 1}</span>
                  <span className="flex-1">{r.name}{r.sub && <em> {r.sub}</em>}</span>
                  <span className="mal-bar"><i style={{ width: `${(100 * Math.abs(r.v!)) / maxAbs}%`, background: colourOf(r.v) }} /></span>
                  <b>{fmtV(r.v)}</b>
                </button></li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
