"use client";

/**
 * The /china-exports dashboard: Overview, Map, Products, Sources.
 *
 * Blue-and-white porcelain was China's first great export to the world, so
 * the page is drawn in it: cobalt on porcelain, one vermilion seal for China
 * itself. Identity in the mosaic is carried by glaze pattern, not hue, so the
 * whole dashboard stays in one ink and reads the same to every eye.
 *
 * Every number shown is a row in data/trade/china-exports.json or a sum,
 * share or multiple of those rows computed in lib/china-exports.ts, and the
 * derived ones say so where they appear.
 */
import { useMemo, useState, type ReactNode } from "react";
import { GROUP_LABEL, SOURCE, type ChinaView, type Group, type ProductView } from "@/lib/china-exports-shared";

const MAP_W = 960, MAP_H = 470;
const GROUPS: Group[] = ["sound", "music", "sky", "energy", "home", "play", "machines"];
/** Sequential cobalt, light to dark, on porcelain. */
const RAMP = ["#dbe4f3", "#a9bfe3", "#6f93cf", "#3a64b3", "#1b3a85"];
const NO_DATA = "#ebe7dc";

export function usd(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(v >= 1e10 ? 1 : 2)} bn`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(v >= 1e8 ? 0 : 1)} m`;
  if (v >= 1e3) return `$${Math.round(v / 1e3).toLocaleString("en-US")} k`;
  return `$${Math.round(v).toLocaleString("en-US")}`;
}
function qty(q: { value: number; unit: string } | null): string | null {
  if (!q) return null;
  const n = q.value >= 1e6 ? `${(q.value / 1e6).toFixed(1)} million` : q.value.toLocaleString("en-US");
  const unit = q.unit === "u" ? "units" : q.unit === "kg" ? "kg" : q.unit;
  return `${n} ${unit}`;
}

/* ─────────────────────────── Glaze patterns ─────────────────────────── */

function Patterns() {
  const w = "#ffffff";
  return (
    <defs>
      <pattern id="gz-sound" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="4" fill="none" stroke={w} strokeWidth="1" opacity=".55" /><circle cx="6" cy="6" r="1.5" fill={w} opacity=".55" /></pattern>
      <pattern id="gz-music" width="14" height="10" patternUnits="userSpaceOnUse"><path d="M0 5 Q3.5 0 7 5 T14 5" fill="none" stroke={w} strokeWidth="1.1" opacity=".55" /></pattern>
      <pattern id="gz-sky" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M4 8a4 3 0 0 1 8 0" fill="none" stroke={w} strokeWidth="1.1" opacity=".55" /><path d="M0 16a4 3 0 0 1 8 0" fill="none" stroke={w} strokeWidth="1.1" opacity=".55" /></pattern>
      <pattern id="gz-energy" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0v10" stroke={w} strokeWidth="1.6" opacity=".5" /></pattern>
      <pattern id="gz-home" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 6h12M6 0v12" stroke={w} strokeWidth=".9" opacity=".5" /><rect x="4.5" y="4.5" width="3" height="3" fill={w} opacity=".5" /></pattern>
      <pattern id="gz-play" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.4" fill={w} opacity=".6" /></pattern>
      <pattern id="gz-machines" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M0 0h7v7h7v7" fill="none" stroke={w} strokeWidth="1.1" opacity=".55" /></pattern>
      <pattern id="seal" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#c8372d" /><circle cx="3" cy="3" r=".9" fill="#f6d9d3" opacity=".6" /></pattern>
    </defs>
  );
}

/* ─────────────────────────── Squarified treemap ─────────────────────────── */

interface Rect { x: number; y: number; w: number; h: number }
function squarify<T>(items: Array<{ v: number; d: T }>, box: Rect): Array<Rect & { d: T; v: number }> {
  const out: Array<Rect & { d: T; v: number }> = [];
  const total = items.reduce((s, i) => s + i.v, 0);
  if (!total) return out;
  const scale = (box.w * box.h) / total;
  let rest = items.map((i) => ({ ...i, a: i.v * scale })).sort((a, b) => b.a - a.a);
  let r = { ...box };
  const worst = (row: number[], side: number) => {
    const s = row.reduce((a, b) => a + b, 0);
    return Math.max(...row.map((a) => Math.max((side * side * a) / (s * s), (s * s) / (side * side * a))));
  };
  while (rest.length) {
    const side = Math.min(r.w, r.h);
    const row: typeof rest = [];
    while (rest.length) {
      const next = [...row, rest[0]!];
      if (row.length && worst(next.map((x) => x.a), side) > worst(row.map((x) => x.a), side)) break;
      row.push(rest.shift()!);
    }
    const s = row.reduce((a, b) => a + b.a, 0);
    if (r.w >= r.h) {
      const w = s / r.h; let y = r.y;
      for (const it of row) { const h = it.a / w; out.push({ x: r.x, y, w, h, d: it.d, v: it.v }); y += h; }
      r = { x: r.x + w, y: r.y, w: r.w - w, h: r.h };
    } else {
      const h = s / r.w; let x = r.x;
      for (const it of row) { const w = it.a / h; out.push({ x, y: r.y, w, h, d: it.d, v: it.v }); x += w; }
      r = { x: r.x, y: r.y + h, w: r.w, h: r.h - h };
    }
  }
  return out;
}

/* ─────────────────────────── Pieces ─────────────────────────── */

function Tip({ at, children }: { at: { x: number; y: number } | null; children: ReactNode }) {
  if (!at) return null;
  return <div className="cx-tip" style={{ left: at.x + 14, top: at.y + 14 }}>{children}</div>;
}

function Spark({ p, w = 180, h = 46 }: { p: ProductView; w?: number; h?: number }) {
  const pts = p.trend;
  const vals = pts.map((t) => t.value ?? 0);
  const max = Math.max(1, ...vals);
  const x = (k: number) => (pts.length <= 1 ? w / 2 : (k / (pts.length - 1)) * (w - 8) + 4);
  const y = (v: number) => h - 4 - (v / max) * (h - 10);
  // A gap is a break in the line, never a dip to zero.
  let d = "", pen = false;
  pts.forEach((t, k) => {
    if (t.value === null) { pen = false; return; }
    d += `${pen ? "L" : "M"}${x(k).toFixed(1)} ${y(t.value).toFixed(1)}`;
    pen = true;
  });
  const lastK = pts.map((t) => t.value !== null).lastIndexOf(true);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="cx-spark" role="img" aria-label={`${p.name}: exports by year`}>
      <path d={`M4 ${h - 4}H${w - 4}`} stroke="#d8d2c4" strokeWidth="1" />
      <path d={d} fill="none" stroke="#1b3a85" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {lastK >= 0 && <circle cx={x(lastK)} cy={y(pts[lastK]!.value!)} r="3.4" fill="#1b3a85" stroke="#fff" strokeWidth="1.5" />}
      {pts.length > 1 && <>
        <text x="4" y={h} className="cx-spark-yr">{pts[0]!.year}</text>
        <text x={w - 4} y={h} textAnchor="end" className="cx-spark-yr">{pts[pts.length - 1]!.year}</text>
      </>}
    </svg>
  );
}

/* ─────────────────────────── Tabs ─────────────────────────── */

type Tab = "overview" | "map" | "products" | "sources";

export function ChinaDashboard({ v }: { v: ChinaView }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [code, setCode] = useState<string>(() => v.products.find((p) => p.code === "880622")?.code ?? v.products[0]?.code ?? "");
  const [tip, setTip] = useState<{ x: number; y: number; body: ReactNode } | null>(null);
  const year = v.latestYear;
  const current = v.products.filter((p) => p.latest?.year === year);

  const total = current.reduce((s, p) => s + (p.latest?.value ?? 0), 0);
  const biggest = [...current].sort((a, b) => (b.latest?.value ?? 0) - (a.latest?.value ?? 0))[0];
  const topShare = [...v.products].filter((p) => p.share).sort((a, b) => b.share!.pct - a.share!.pct)[0];
  const drones = current.filter((p) => p.group === "sky");
  const droneValue = drones.reduce((s, p) => s + (p.latest?.value ?? 0), 0);

  const tabs: Array<[Tab, string]> = [["overview", "Overview"], ["map", "The map"], ["products", "Every product"], ["sources", "Sources"]];

  return (
    <div className="cx" onMouseLeave={() => setTip(null)}>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden><Patterns /></svg>
      <nav className="cx-tabs" role="tablist" aria-label="Dashboard sections">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>

      {tab === "overview" && (
        <section className="cx-panel" role="tabpanel">
          <div className="cx-kpis">
            <div className="cx-kpi"><span className="cx-kpi-num">{usd(total)}</span><span className="cx-kpi-label">these {current.length} products together, {year}</span><span className="cx-kpi-note">Derived: a sum of Comtrade values</span></div>
            {biggest && <div className="cx-kpi"><span className="cx-kpi-num">{usd(biggest.latest!.value)}</span><span className="cx-kpi-label">{biggest.name}, the biggest of them</span></div>}
            {topShare && <div className="cx-kpi"><span className="cx-kpi-num">{topShare.share!.pct.toFixed(0)}%</span><span className="cx-kpi-label">of the world&rsquo;s {topShare.name.toLowerCase()} exports, {topShare.share!.year}</span><span className="cx-kpi-note">Derived: China ÷ all {topShare.share!.reporters} reporters</span></div>}
            {droneValue > 0 && <div className="cx-kpi"><span className="cx-kpi-num">{usd(droneValue)}</span><span className="cx-kpi-label">of drones, all four weight classes, {year}</span></div>}
          </div>

          <h2 className="cx-h2">The mosaic: every product, sized by what it earned in {year}</h2>
          <Mosaic products={current} onTip={setTip} />
          <div className="cx-legend">
            {GROUPS.map((g) => (
              <span key={g}><svg width="18" height="18"><rect width="18" height="18" rx="3" fill="#24449a" /><rect width="18" height="18" rx="3" fill={`url(#gz-${g})`} /></svg>{GROUP_LABEL[g]}</span>
            ))}
          </div>

          <h2 className="cx-h2">Who buys it: the top destinations across all {current.length} products, {year}</h2>
          <div className="cx-bars">
            {v.buyers.slice(0, 12).map((b) => (
              <div key={b.name} className="cx-bar-line" title={`${b.name}: ${usd(b.value)} across ${b.products} products`}>
                <span className="cx-bar-name">{b.name}</span>
                <span className="cx-bar-track"><span className="cx-bar" style={{ width: `${(b.value / v.buyers[0]!.value) * 100}%` }} /></span>
                <span className="cx-bar-val">{usd(b.value)}</span>
              </div>
            ))}
          </div>
          <p className="cx-note">Derived: each destination&rsquo;s value summed over the products on this page, as China reports them. Hong Kong often ranks high because goods pass through it on the way elsewhere.</p>
        </section>
      )}

      {tab === "map" && <MapTab v={v} code={code} setCode={setCode} onTip={setTip} />}

      {tab === "products" && (
        <section className="cx-panel" role="tabpanel">
          {GROUPS.map((g) => {
            const list = v.products.filter((p) => p.group === g);
            if (!list.length) return null;
            return (
              <div key={g} className="cx-group">
                <h2 className="cx-h2">{GROUP_LABEL[g]}</h2>
                <div className="cx-cards">
                  {list.map((p) => (
                    <article key={p.code} className="cx-card">
                      <div className="cx-card-head">
                        <svg width="26" height="26" aria-hidden><rect width="26" height="26" rx="6" fill="#24449a" /><rect width="26" height="26" rx="6" fill={`url(#gz-${g})`} /></svg>
                        <div><h3>{p.name}</h3><span className="cx-hs">HS {p.code.slice(0, 4)}.{p.code.slice(4)}</span></div>
                      </div>
                      <div className="cx-card-num">{usd(p.latest?.value)} <small>{p.latest?.year ?? ""}</small></div>
                      <Spark p={p} />
                      <dl className="cx-facts">
                        {p.multiple && <><dt>Since {p.multiple.from}</dt><dd>×{p.multiple.x.toFixed(p.multiple.x >= 10 ? 0 : 1)} <i>derived</i></dd></>}
                        {p.share && <><dt>Share of world exports, {p.share.year}</dt><dd>{p.share.pct.toFixed(0)}% <i>derived</i></dd></>}
                        {p.quantity && <><dt>Quantity, {p.latest?.year}</dt><dd>{qty(p.quantity)}</dd></>}
                        {p.top[0] && <><dt>Biggest buyer</dt><dd>{p.top[0].name} · {usd(p.top[0].value)}</dd></>}
                        {p.mirror && <><dt>Check, {p.mirror.year}</dt><dd>China says {usd(p.mirror.china)}; {p.mirror.reporters} importers say {usd(p.mirror.world)}</dd></>}
                      </dl>
                      {p.note && <p className="cx-card-note">{p.note}</p>}
                      <button className="cx-link" onClick={() => { setCode(p.code); setTab("map"); }}>See it on the map →</button>
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {tab === "sources" && <Sources v={v} />}

      {tip && <Tip at={tip}>{tip.body}</Tip>}
    </div>
  );
}

function Mosaic({ products, onTip }: { products: ProductView[]; onTip: (t: { x: number; y: number; body: ReactNode } | null) => void }) {
  const W = 1000, H = 520;
  const rects = useMemo(() => {
    // Groups first, then products inside each group, so a glaze reads as a region.
    const groups = GROUPS.map((g) => ({ g, v: products.filter((p) => p.group === g).reduce((s, p) => s + (p.latest?.value ?? 0), 0) })).filter((x) => x.v > 0);
    const outer = squarify(groups.map((x) => ({ v: x.v, d: x.g })), { x: 0, y: 0, w: W, h: H });
    return outer.flatMap((o) => squarify(
      products.filter((p) => p.group === o.d && (p.latest?.value ?? 0) > 0).map((p) => ({ v: p.latest!.value, d: p })),
      { x: o.x + 2, y: o.y + 2, w: Math.max(0, o.w - 4), h: Math.max(0, o.h - 4) },
    ));
  }, [products]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="cx-mosaic" role="img" aria-label="Products sized by export value">
      {rects.map((r) => {
        const big = r.w > 110 && r.h > 46;
        return (
          <g key={r.d.code}
            onMouseMove={(e) => onTip({ x: e.clientX, y: e.clientY, body: <><b>{r.d.name}</b><br />{usd(r.v)} · {r.d.latest?.year}{r.d.share ? <><br />{r.d.share.pct.toFixed(0)}% of world exports, {r.d.share.year}</> : null}</> })}
            onMouseLeave={() => onTip(null)}>
            <rect x={r.x + 1} y={r.y + 1} width={Math.max(0, r.w - 2)} height={Math.max(0, r.h - 2)} rx="6" fill="#24449a" />
            <rect x={r.x + 1} y={r.y + 1} width={Math.max(0, r.w - 2)} height={Math.max(0, r.h - 2)} rx="6" fill={`url(#gz-${r.d.group})`} />
            {big && <>
              <text x={r.x + 12} y={r.y + 26} className="cx-tile-name">{r.d.name}</text>
              <text x={r.x + 12} y={r.y + 46} className="cx-tile-val">{usd(r.v)}</text>
            </>}
          </g>
        );
      })}
    </svg>
  );
}

function MapTab({ v, code, setCode, onTip }: { v: ChinaView; code: string; setCode: (c: string) => void; onTip: (t: { x: number; y: number; body: ReactNode } | null) => void }) {
  const p = v.products.find((x) => x.code === code) ?? v.products[0];
  const values = useMemo(() => new Map(p?.byCountry ?? []), [p]);
  // Five bins by quantile of the destinations that bought any: the map shows
  // rank, and the legend prints the dollar edges so the rank has a size.
  const edges = useMemo(() => {
    const vs = [...values.values()].sort((a, b) => a - b);
    if (!vs.length) return [] as number[];
    return [0.2, 0.4, 0.6, 0.8].map((q) => vs[Math.min(vs.length - 1, Math.floor(q * vs.length))]!);
  }, [values]);
  const bin = (x: number) => edges.filter((e) => x >= e).length;
  const byId = useMemo(() => new Map(v.map.countries.map((c) => [c.id, c])), [v.map.countries]);
  const arcs = (p?.top ?? []).filter((t) => t.atlasId && byId.has(t.atlasId)).slice(0, 12);
  const maxArc = Math.max(1, ...arcs.map((a) => a.value));
  const [ox, oy] = v.map.origin;
  if (!p) return null;
  return (
    <section className="cx-panel" role="tabpanel">
      <div className="cx-picker">
        <label>
          <span>Product</span>
          <select value={code} onChange={(e) => setCode(e.target.value)}>
            {GROUPS.map((g) => (
              <optgroup key={g} label={GROUP_LABEL[g]}>
                {v.products.filter((x) => x.group === g).map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="cx-chips">
          {["880622", "851822", "920790", "920290", "850760", "854143", "870380"].map((c) => {
            const x = v.products.find((q) => q.code === c);
            return x ? <button key={c} className={c === code ? "on" : ""} onClick={() => setCode(c)}>{x.name}</button> : null;
          })}
        </div>
      </div>
      <div className="cx-mapwrap">
        <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="cx-map" role="img" aria-label={`World map of where China's ${p.name.toLowerCase()} went in ${p.latest?.year ?? ""}`}>
          <rect width={MAP_W} height={MAP_H} fill="#f3efe6" />
          {v.map.countries.map((c) => {
            const val = values.get(c.id);
            const isChina = c.id === "156";
            return (
              <path key={c.id} d={c.d}
                fill={isChina ? "url(#seal)" : val ? RAMP[bin(val)] : NO_DATA}
                stroke="#fbf9f4" strokeWidth=".6"
                onMouseMove={(e) => onTip({ x: e.clientX, y: e.clientY, body: isChina ? <><b>China</b><br />the exporter</> : <><b>{c.name}</b><br />{val ? `${usd(val)} · ${((val / p.partnerTotal) * 100).toFixed(1)}% of the total` : "no exports recorded"}</> })}
                onMouseLeave={() => onTip(null)} />
            );
          })}
          {arcs.map((a, k) => {
            const c = byId.get(a.atlasId!)!;
            const mx = (ox + c.cx) / 2, my = Math.min(oy, c.cy) - Math.abs(c.cx - ox) * 0.22 - 18;
            const w = 0.8 + Math.sqrt(a.value / maxArc) * 5;
            return <path key={a.atlasId} className="cx-arc" style={{ animationDelay: `${k * 0.12}s` }} d={`M${ox} ${oy} Q${mx} ${my} ${c.cx} ${c.cy}`} fill="none" stroke="#10275e" strokeWidth={w} strokeLinecap="round" opacity=".72" />;
          })}
          <circle cx={ox} cy={oy} r="7" fill="#c8372d" stroke="#fff" strokeWidth="2" />
        </svg>
        <div className="cx-maplegend">
          {RAMP.map((c, k) => (
            <span key={c}><i style={{ background: c }} />{k === 0 ? `under ${usd(edges[0])}` : k === RAMP.length - 1 ? `${usd(edges[k - 1])} and up` : `${usd(edges[k - 1])}–${usd(edges[k])}`}</span>
          ))}
          <span><i style={{ background: NO_DATA }} />none recorded</span>
          <span><i style={{ background: "#c8372d" }} />China</span>
        </div>
      </div>
      <div className="cx-mapside">
        <div>
          <h2 className="cx-h2">{p.name}</h2>
          <div className="cx-big">{usd(p.latest?.value)} <small>{p.latest?.year}</small></div>
          <p className="cx-mapfacts">
            To {p.destinations} destinations{p.quantity ? <> · {qty(p.quantity)}</> : null}{p.share ? <> · {p.share.pct.toFixed(0)}% of world exports in {p.share.year} <i>(derived)</i></> : null}
          </p>
          {p.mirror && <p className="cx-mapfacts">The check: China reports {usd(p.mirror.china)} for {p.mirror.year}; the {p.mirror.reporters} countries that report buying it from China say {usd(p.mirror.world)}. They never match exactly — importers count freight and insurance, exporters do not, and goods routed through Hong Kong are counted differently at each end.</p>}
          {p.note && <p className="cx-card-note">{p.note}</p>}
        </div>
        <div className="cx-bars">
          {p.top.slice(0, 12).map((t) => (
            <div key={t.name} className="cx-bar-line" title={`${t.name}: ${usd(t.value)}`}>
              <span className="cx-bar-name">{t.name}</span>
              <span className="cx-bar-track"><span className="cx-bar" style={{ width: `${(t.value / p.top[0]!.value) * 100}%` }} /></span>
              <span className="cx-bar-val">{usd(t.value)}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="cx-note">Arcs: the twelve biggest destinations, width by value. Colour: each destination&rsquo;s rank among all that bought any, in fifths. Values are China&rsquo;s reported exports (FOB) in current US dollars.</p>
    </section>
  );
}

function Sources({ v }: { v: ChinaView }) {
  const at = v.generatedAt ? new Date(v.generatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—";
  return (
    <section className="cx-panel cx-sources" role="tabpanel">
      <h2 className="cx-h2">Where every number comes from</h2>
      <ol>
        <li>
          <b><a href={SOURCE.url}>{SOURCE.name}</a></b>, {SOURCE.publisher}. China&rsquo;s exports as China reports them to the UN (reporter 156, flow: exports, valued free on board), by six-digit Harmonized System code, in current US dollars. Read through the public API, <code>{SOURCE.api}</code>, with partner2, mode of transport and customs procedure pinned to their totals so no row is counted twice. Accessed {at}; {v.calls} requests.
        </li>
        <li>
          <b>The mirror check</b>, same database: every other reporter&rsquo;s imports of the same codes from China. A second set of customs offices counting the same goods from the other end. Printed beside China&rsquo;s own figure, never blended with it.
        </li>
        <li>
          <b>China&rsquo;s share of world exports</b> is derived here: China&rsquo;s value divided by the sum of every reporter&rsquo;s exports of the code to the world, one year back from the latest, because most countries report late. Re-exporters such as Hong Kong and the Netherlands add to the world total, so the share is if anything understated.
        </li>
        <li>
          <b><a href="https://www.wcoomd.org/en/topics/nomenclature/instrument-and-tools/hs-nomenclature-2022-edition.aspx">The Harmonized System, 2022 edition</a></b>, World Customs Organization — for what each code covers. Drones, smartphones, solar panels and e-bikes got their own codes only in 2022; their lines start there, and earlier years are left blank rather than guessed.
        </li>
        <li>
          <b>Country outlines</b>: <a href="https://github.com/topojson/world-atlas">world-atlas</a> 1:110m, from <a href="https://www.naturalearthdata.com/">Natural Earth</a> (public domain). The map shows countries as Natural Earth draws them.
        </li>
      </ol>
      <h3 className="cx-h3">What this cannot say</h3>
      <ul>
        <li>An HS code is a customs category, not a product line. &ldquo;Electric guitars&rdquo; is HS 9207.90, which also holds other electrically amplified instruments; each product&rsquo;s card prints what its code covers.</li>
        <li>It counts value, not volume, except where Comtrade reports a quantity, which is shown when it does.</li>
        <li>It shows goods leaving China, not goods designed by Chinese companies and made elsewhere, nor components made in China and assembled elsewhere.</li>
        <li>A year with no reported value is a gap in the line. Nothing is filled in.</li>
      </ul>
      <h3 className="cx-h3">Further reading</h3>
      <p>
        Dan Wang, <i>Breakneck: China&rsquo;s Quest to Engineer the Future</i> (W. W. Norton, 2025) — the argument that China is run as an engineering state, building first and asking later, which is one way to read the export lines above. No figure on this page is taken from the book: its text is not in this project&rsquo;s library, so nothing from it could be checked, and nothing unchecked is printed.
      </p>
    </section>
  );
}
