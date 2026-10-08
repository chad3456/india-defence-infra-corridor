/**
 * The /internet essay's charts, rendered on the server as SVG and HTML.
 *
 * Every country outline is emitted once, in <MapDefs>, and every map on the
 * page draws it with <use>, so seven maps cost one set of paths. Hover and
 * tap readouts come from data-tip attributes, read by <TipLayer>; with no
 * script the same text is in each shape's <title>.
 *
 * Colour: one sequential ramp for "more is more", one warm ramp for prices
 * (more is worse), one accent — saffron — for India, and neutral grey for
 * context. Categorical pairs were checked for colour-blind separation.
 */
import type { BarDatum, ChartBody, ChartView, LineSeries, MapLayer, MapShape, ScatterDatum } from "@/lib/internet-shared";

const RAMP = ["#1c2b4a", "#1f4a6e", "#1f6b8c", "#2a8fa6", "#4bb4bd", "#8fdcd2"];
const HOT = ["#2a2440", "#4a2c4f", "#71304f", "#9a3a4a", "#c4513f", "#ec7a3a"];
const NODATA = "#161d33";
export const INDIA = "#d4761a";
const BLUE = "#4f7fe0";
const GREEN = "#169e78";
const RED = "#e0465c";
const GREY = "#56617e";

const fmt = (v: number, unit = "") => {
  const a = Math.abs(v);
  const s = a >= 10000 ? Math.round(v).toLocaleString("en-IN") : a >= 100 ? String(Math.round(v)) : a >= 10 ? v.toFixed(1).replace(/\.0$/, "") : v.toFixed(2).replace(/0$/, "").replace(/\.0$/, "");
  return unit ? `${s} ${unit}` : s;
};

function classOf(v: number, breaks: number[]): number {
  let c = 0;
  for (const b of breaks) if (v >= b) c++;
  return c;
}

export function MapDefs({ shapes }: { shapes: MapShape[] }) {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        {shapes.map((s, i) => <path key={`${s.iso3}-${i}`} id={`ie-c-${s.iso3}-${i}`} d={s.d} />)}
      </defs>
    </svg>
  );
}

export function MapChart({ layer, shapes, w, h, pins }: { layer: MapLayer; shapes: MapShape[]; w: number; h: number; pins?: Array<{ x: number; y: number; label: string; id: string }> }) {
  const ramp = layer.invert ? HOT : RAMP;
  const bounds = [0, ...layer.breaks];
  return (
    <figure className="ie-mapfig">
      <svg viewBox={`0 0 ${w} ${h}`} className="ie-map" role="img" aria-label={`${layer.title}, ${layer.unit}, by country`}>
        {shapes.map((s, i) => {
          const v = layer.values[s.iso3];
          const fill = v === undefined ? NODATA : ramp[classOf(v, layer.breaks)];
          const tip = `${s.name}: ${v === undefined ? "no data" : fmt(v, layer.unit)}`;
          return (
            <use key={`${s.iso3}-${i}`} href={`#ie-c-${s.iso3}-${i}`} fill={fill} className={s.iso3 === "IND" ? "ie-in" : undefined} data-tip={tip}>
              <title>{tip}</title>
            </use>
          );
        })}
        {shapes.filter((s) => s.tiny && layer.values[s.iso3] !== undefined).map((s, i) => (
          <circle key={`dot-${s.iso3}-${i}`} cx={s.cx} cy={s.cy} r={2.6} fill={ramp[classOf(layer.values[s.iso3]!, layer.breaks)]} stroke="#0b1020" strokeWidth={0.6} data-tip={`${s.name}: ${fmt(layer.values[s.iso3]!, layer.unit)}`} />
        ))}
        {pins?.map((p, i) => (
          <g key={p.id} className="ie-pin" data-tip={p.label}>
            <circle cx={p.x} cy={p.y} r={9} />
            <text x={p.x} y={p.y + 4}>{i + 1}</text>
          </g>
        ))}
      </svg>
      <figcaption className="ie-legend">
        <span className="ie-legend-unit">{layer.unit}</span>
        <span className="ie-legend-ramp">
          {ramp.map((c, i) => (
            <span key={c} className="ie-legend-step">
              <i style={{ background: c }} />
              <b>{i === 0 ? `< ${fmt(layer.breaks[0]!)}` : i === ramp.length - 1 ? `${fmt(bounds[i]!)}+` : `${fmt(bounds[i]!)}–${fmt(layer.breaks[i]!)}`}</b>
            </span>
          ))}
          <span className="ie-legend-step"><i style={{ background: NODATA, outline: "1px solid #2a3554" }} /><b>no data</b></span>
        </span>
        <span className="ie-legend-in"><i /> India outlined</span>
      </figcaption>
    </figure>
  );
}

function Bars({ data, unit, reference, highlight }: { data: BarDatum[]; unit: string; reference?: { value: number; label: string }; highlight?: string[] }) {
  const max = Math.max(...data.map((d) => d.value), reference?.value ?? 0) * 1.04;
  return (
    <div className="ie-bars" role="table" aria-label={unit}>
      {data.map((d) => {
        const hi = highlight?.includes(d.iso3);
        return (
          <div key={d.iso3} className={`ie-bar${hi ? " hi" : ""}`} role="row" data-tip={`${d.name}: ${fmt(d.value, unit)}${d.label ? ` (${d.label})` : ""}`}>
            <span className="ie-bar-name" role="rowheader">{d.name}</span>
            <span className="ie-bar-track" role="cell">
              <span className="ie-bar-fill" style={{ width: `${(d.value / max) * 100}%` }} />
              {reference && <span className="ie-bar-ref" style={{ left: `${(reference.value / max) * 100}%` }} />}
            </span>
            <span className="ie-bar-val" role="cell">{fmt(d.value)}</span>
          </div>
        );
      })}
      <div className="ie-bars-foot">
        <span>{unit}</span>
        {reference && <span className="ie-ref-key"><i /> {reference.label}</span>}
      </div>
    </div>
  );
}

function Dumbbell({ data, unit, labels }: { data: BarDatum[]; unit: string; labels: [string, string] }) {
  const max = Math.max(...data.flatMap((d) => [d.value, d.value2 ?? 0])) * 1.04;
  return (
    <div className="ie-bars ie-dumb">
      <div className="ie-key">
        <span><i style={{ background: BLUE }} /> {labels[0]}</span>
        <span><i style={{ background: GREEN }} /> {labels[1]}</span>
      </div>
      {data.map((d) => {
        const a = (d.value / max) * 100, b = ((d.value2 ?? 0) / max) * 100;
        return (
          <div key={d.iso3} className={`ie-bar${d.iso3 === "IND" ? " hi" : ""}`} data-tip={`${d.name}: ${labels[0]} ${fmt(d.value, unit)}, ${labels[1]} ${fmt(d.value2 ?? 0, unit)}`}>
            <span className="ie-bar-name">{d.name}</span>
            <span className="ie-bar-track">
              <span className="ie-dumb-line" style={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(a - b)}%` }} />
              <span className="ie-dumb-dot" style={{ left: `${a}%`, background: BLUE }} />
              <span className="ie-dumb-dot" style={{ left: `${b}%`, background: GREEN }} />
            </span>
            <span className="ie-bar-val">{fmt(d.value)} / {fmt(d.value2 ?? 0)}</span>
          </div>
        );
      })}
      <div className="ie-bars-foot"><span>{unit}</span></div>
    </div>
  );
}

/** Each SVG chart is drawn twice — a wide and a narrow layout — and CSS shows one, so text stays legible on a phone. */
type Dim = { W: number; H: number };
const M = { l: 48, r: 92, t: 18, b: 40 };
const WIDE: Dim = { W: 960, H: 420 };
const NARROW: Dim = { W: 440, H: 380 };

function ticks(lo: number, hi: number, n = 5): number[] {
  const step = 10 ** Math.floor(Math.log10((hi - lo) / n));
  const err = ((hi - lo) / n) / step;
  const s = step * (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1);
  const out: number[] = [];
  for (let v = Math.ceil(lo / s) * s; v <= hi + 1e-9; v += s) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

function Lines({ series, unit, W, H }: { series: LineSeries[]; unit: string } & Dim) {
  const xs = series.flatMap((s) => s.points.map((p) => p[0]));
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const yMax = Math.max(100, ...series.flatMap((s) => s.points.map((p) => p[1])));
  const sx = (x: number) => M.l + ((x - x0) / (x1 - x0 || 1)) * (W - M.l - M.r);
  const sy = (y: number) => H - M.b - (y / yMax) * (H - M.t - M.b);
  // End labels, nudged apart so they never overlap.
  const ends = series.map((s) => ({ s, y: sy(s.points[s.points.length - 1]![1]) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i]!.y - ends[i - 1]!.y < 15) ends[i]!.y = ends[i - 1]!.y + 15;
  const ordered = [...series].sort((a, b) => Number(!!a.highlight) - Number(!!b.highlight));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ie-svg" role="img" aria-label={`Line chart, ${unit}`}>
      {ticks(0, yMax).map((t) => (
        <g key={t}><line x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} className="ie-grid" /><text x={M.l - 8} y={sy(t) + 4} className="ie-tick" textAnchor="end">{t}</text></g>
      ))}
      {ticks(x0, x1, 6).map((t) => <text key={t} x={sx(t)} y={H - M.b + 20} className="ie-tick" textAnchor="middle">{t}</text>)}
      {ordered.map((s) => (
        <g key={s.id}>
          <path d={s.points.map((p, i) => `${i ? "L" : "M"}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join("")} fill="none" stroke={s.highlight ? INDIA : s.id === "WLD" ? "#c7cfe2" : GREY} strokeWidth={s.highlight ? 3 : s.id === "WLD" ? 2 : 1.6} strokeDasharray={s.id === "WLD" ? "5 4" : undefined} />
          {s.points.map((p) => <circle key={p[0]} cx={sx(p[0])} cy={sy(p[1])} r={6} fill="transparent" data-tip={`${s.name}, ${p[0]}: ${fmt(p[1], unit)}`} />)}
        </g>
      ))}
      {ends.map(({ s, y }) => (
        <text key={s.id} x={W - M.r + 8} y={y + 4} className={`ie-end${s.highlight ? " hi" : ""}`}>{s.name.replace(" income", "").replace("Low & middle", "L&M")}</text>
      ))}
      <text x={M.l} y={M.t - 4} className="ie-axis">{unit}</text>
    </svg>
  );
}

function Scatter({ data, x, y, logX, reference, W, H }: { data: ScatterDatum[]; x: string; y: string; logX?: boolean; reference?: { x?: number; label: string } } & Dim) {
  const xv = data.map((d) => d.x).filter((v) => !logX || v > 0);
  const lo = logX ? Math.log10(Math.min(...xv)) : 0, hi = logX ? Math.log10(Math.max(...xv)) : Math.max(...xv) * 1.05;
  const sx = (v: number) => M.l + (((logX ? Math.log10(v) : v) - lo) / (hi - lo || 1)) * (W - M.l - 24);
  const sy = (v: number) => H - M.b - (v / 100) * (H - M.t - M.b);
  const rMax = Math.max(...data.map((d) => d.r ?? 0));
  const rad = (r?: number) => (r && rMax ? 3 + Math.sqrt(r / rMax) * 22 : 4);
  const xt = logX ? [0.1, 0.3, 1, 3, 10, 30, 100, 300, 1000].filter((t) => Math.log10(t) >= lo - 0.01 && Math.log10(t) <= hi + 0.01) : ticks(0, hi);
  const label = new Set(["IND", "CHN", "USA", "NGA", "PAK", "BGD", "IDN", "BRA", "ETH", "COD"]);
  const sorted = [...data].sort((a, b) => (b.r ?? 0) - (a.r ?? 0));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ie-svg" role="img" aria-label={`Scatter: ${x} against ${y}`}>
      {[0, 25, 50, 75, 100].map((t) => <g key={t}><line x1={M.l} x2={W - 24} y1={sy(t)} y2={sy(t)} className="ie-grid" /><text x={M.l - 8} y={sy(t) + 4} className="ie-tick" textAnchor="end">{t}</text></g>)}
      {xt.map((t) => <text key={t} x={sx(t)} y={H - M.b + 20} className="ie-tick" textAnchor="middle">{t}</text>)}
      {reference?.x !== undefined && (
        <g><line x1={sx(reference.x)} x2={sx(reference.x)} y1={M.t} y2={H - M.b} className="ie-refline" /><text x={sx(reference.x) + 5} y={H - M.b - 8} className="ie-reftext">{reference.label}</text></g>
      )}
      {sorted.map((d) => (
        <circle key={d.iso3} cx={sx(d.x)} cy={sy(d.y)} r={rad(d.r)} className={d.iso3 === "IND" ? "ie-dot hi" : "ie-dot"} data-tip={`${d.name}: ${fmt(d.x)} · ${fmt(d.y)}%`} />
      ))}
      {sorted.filter((d) => label.has(d.iso3)).map((d) => (
        <text key={`l-${d.iso3}`} x={sx(d.x) + rad(d.r) + 3} y={sy(d.y) + 4} className={`ie-dotlabel${d.iso3 === "IND" ? " hi" : ""}`}>{d.name}</text>
      ))}
      <text x={M.l} y={M.t - 4} className="ie-axis">{y}</text>
      <text x={W - 24} y={H - 6} className="ie-axis" textAnchor="end">{x}</text>
    </svg>
  );
}

function Columns({ data, unit, labels, claim, W, H }: { data: Array<{ label: string; value: number; value2?: number }>; unit: string; labels?: [string, string]; claim?: boolean } & Dim) {
  const two = data.some((d) => d.value2 !== undefined);
  const max = Math.max(...data.flatMap((d) => [d.value, d.value2 ?? 0])) * 1.12;
  const cw = (W - M.l - 16) / data.length;
  const sy = (v: number) => H - M.b - (v / max) * (H - M.t - M.b - 10);
  const c1 = claim ? GREY : two ? (labels?.[0] === "launched" ? RED : BLUE) : BLUE;
  const c2 = labels?.[1] === "re-entered" ? GREY : INDIA;
  const single = data.length <= 3 && !two;
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="ie-svg" role="img" aria-label={`Column chart, ${unit}`}>
        {ticks(0, max / 1.12).map((t) => <g key={t}><line x1={M.l} x2={W - 16} y1={sy(t)} y2={sy(t)} className="ie-grid" /><text x={M.l - 8} y={sy(t) + 4} className="ie-tick" textAnchor="end">{fmt(t)}</text></g>)}
        {data.map((d, i) => {
          const x = M.l + i * cw;
          const bw = two ? cw * 0.38 : cw * (single ? 0.5 : 0.62);
          const x1 = two ? x + cw * 0.1 : x + (cw - bw) / 2;
          const fill = single ? (i === 0 ? RED : i === 1 ? BLUE : GREY) : c1;
          return (
            <g key={d.label} data-tip={`${d.label}: ${fmt(d.value, unit)}${d.value2 !== undefined && labels ? `; ${labels[1]} ${fmt(d.value2)}` : ""}`}>
              <rect x={x1} y={sy(d.value)} width={bw} height={Math.max(0, sy(0) - sy(d.value))} fill={fill} rx={2} strokeDasharray={claim ? "4 3" : undefined} stroke={claim ? "#9aa6c4" : undefined} fillOpacity={claim ? 0.35 : 1} />
              {d.value2 !== undefined && <rect x={x1 + bw + 2} y={sy(d.value2)} width={bw} height={Math.max(0, sy(0) - sy(d.value2))} fill={c2} rx={2} />}
              {(data.length <= (W < 500 ? 5 : 10) || single) && <text x={x1 + (two ? bw : bw / 2)} y={sy(Math.max(d.value, d.value2 ?? 0)) - 6} className="ie-colval" textAnchor="middle">{fmt(d.value)}{d.value2 !== undefined ? ` · ${fmt(d.value2)}` : ""}</text>}
              <text x={x + cw / 2} y={H - M.b + 18} className="ie-tick" textAnchor="middle">{(data.length > 12 || (W < 500 && data.length > 5)) && i % 2 ? "" : W < 500 && single ? d.label.split(" ")[0] : d.label}</text>
            </g>
          );
        })}
        <text x={M.l} y={M.t - 4} className="ie-axis">{unit}</text>
      </svg>
    </>
  );
}

function Waffle({ cells, per, W }: { cells: Array<{ label: string; value: number; tone: "red" | "blue" | "grey" }>; per: number } & Dim) {
  const cols = W > 600 ? 46 : 22;
  const gap = (W - 8) / cols;
  const tone = { red: RED, blue: BLUE, grey: GREY };
  const dots: Array<{ i: number; c: string; tip: string }> = [];
  for (const cell of cells) {
    const n = Math.round(cell.value / per);
    for (let k = 0; k < n; k++) dots.push({ i: dots.length, c: tone[cell.tone], tip: `${cell.label}: ${cell.value.toLocaleString("en-IN")}` });
  }
  const rows = Math.ceil(dots.length / cols);
  const H = rows * gap + 6;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ie-svg" role="img" aria-label={cells.map((c) => `${c.label}: ${c.value}`).join("; ")}>
      {dots.map((d) => (
        <circle key={d.i} cx={4 + (d.i % cols) * gap + gap / 2} cy={3 + Math.floor(d.i / cols) * gap + gap / 2} r={gap * 0.36} fill={d.c} data-tip={d.tip} />
      ))}
    </svg>
  );
}

function Twice({ wide, render }: { wide: Dim; render: (d: Dim) => React.ReactNode }) {
  return (
    <>
      <div className="ie-v-wide">{render(wide)}</div>
      <div className="ie-v-narrow" aria-hidden>{render(NARROW)}</div>
    </>
  );
}

export function ChartBodyView({ body, shapes, w, h }: { body: ChartBody; shapes: MapShape[]; w: number; h: number }) {
  switch (body.kind) {
    case "map": return <MapChart layer={body.layer} shapes={shapes} w={w} h={h} />;
    case "bars": return <Bars data={body.data} unit={body.unit} reference={body.reference} highlight={body.highlight} />;
    case "dumbbell": return <Dumbbell data={body.data} unit={body.unit} labels={body.labels} />;
    case "lines": return <Twice wide={WIDE} render={(d) => <Lines series={body.series} unit={body.unit} {...d} />} />;
    case "scatter": return <Twice wide={WIDE} render={(d) => <Scatter data={body.data} x={body.x} y={body.y} logX={body.logX} reference={body.reference} {...d} />} />;
    case "columns": {
      const two = body.data.some((d) => d.value2 !== undefined);
      const c1 = body.claim ? GREY : body.labels?.[0] === "launched" ? RED : BLUE;
      const c2 = body.labels?.[1] === "re-entered" ? GREY : INDIA;
      return (
        <>
          {two && body.labels && (
            <div className="ie-key">
              <span><i style={{ background: c1 }} /> {body.labels[0]}</span>
              <span><i style={{ background: c2 }} /> {body.labels[1]}</span>
            </div>
          )}
          <Twice wide={WIDE} render={(d) => <Columns data={body.data} unit={body.unit} labels={body.labels} claim={body.claim} {...d} />} />
        </>
      );
    }
    case "waffle": {
      const tone = { red: RED, blue: BLUE, grey: GREY };
      return (
        <>
          <div className="ie-key ie-key-col">
            {body.cells.map((c) => <span key={c.label}><i style={{ background: tone[c.tone] }} /> <b>{c.value.toLocaleString("en-IN")}</b> {c.label}</span>)}
            <span className="ie-key-note">Each dot is {body.per} satellites.</span>
          </div>
          <Twice wide={WIDE} render={(d) => <Waffle cells={body.cells} per={body.per} {...d} />} />
        </>
      );
    }
    case "awaiting": return <div className="ie-awaiting"><b>Awaiting data</b><span>{body.reason}. Nothing is drawn in its place.</span></div>;
  }
}

export function Chart({ c, shapes, w, h }: { c: ChartView; shapes: MapShape[]; w: number; h: number }) {
  return (
    <section className={`ie-chart ie-${c.body.kind}`} id={c.id} aria-labelledby={`${c.id}-t`}>
      <header>
        <span className="ie-n">{String(c.n).padStart(2, "0")}</span>
        <h3 id={`${c.id}-t`}>{c.title}</h3>
        <p className="ie-dek">{c.dek}</p>
      </header>
      <ChartBodyView body={c.body} shapes={shapes} w={w} h={h} />
      <footer className="ie-foot">
        <span>Source: <a href={c.sourceUrl} rel="noopener noreferrer" target="_blank">{c.source}</a></span>
        {c.derived && <span className="ie-derived"><b>Derived.</b> {c.derived}</span>}
        {c.note && <span>{c.note}</span>}
        {c.also?.map((a) => <span key={a.url}>See also: <a href={a.url} rel="noopener noreferrer" target="_blank">{a.label}</a></span>)}
        {c.body.kind === "map" && c.body.layer.note && <span>{c.body.layer.note}</span>}
      </footer>
    </section>
  );
}
