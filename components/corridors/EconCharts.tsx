/**
 * Charts for /corridors, server-rendered SVG: one indicator with its two
 * fitted trends either side of 2014, the timeline of when each corridor began
 * and where it stands, and a small line for a ranked series.
 */
import type { EconResult } from "@/lib/corridors-load";
import { BREAK_YEAR } from "@/lib/corridors-economy";

const r1 = (v: number) => Math.round(v * 10) / 10;

export function fmtLevel(v: number, unit: string): string {
  const a = Math.abs(v);
  const n = a >= 1e12 ? `${(v / 1e12).toFixed(2)} tn` : a >= 1e9 ? `${(v / 1e9).toFixed(a >= 1e11 ? 0 : 1)} bn` : a >= 1e6 ? `${(v / 1e6).toFixed(1)} m` : a >= 1000 ? Math.round(v).toLocaleString("en-IN") : a >= 100 ? v.toFixed(0) : v.toFixed(1);
  if (/^%/.test(unit)) return `${n}%`;
  if (/US\$|\$/.test(unit)) return `$${n}`;
  return unit && !/index|count|number/i.test(unit) ? `${n} ${unit}` : n;
}

export const trendUnit = (e: EconResult) => (e.spec.log ? "% a year" : /^%/.test(e.unit) ? "points a year" : `${e.unit} a year`);
const signed = (v: number, dp = 1) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(dp)}`;

export const VERDICT_LABEL: Record<string, string> = { better: "Improved faster after 2014", worse: "Slowed or worsened after 2014", steeper: "Steeper after 2014", flatter: "Flatter after 2014", unclear: "No clear change in trend" };

/** One indicator: its yearly values, the fitted trend before and after 2014, and the verdict. */
export function ItsCard({ e }: { e: EconResult }) {
  const W = 300, H = 128, L = 6, R = 6, T = 10, B = 18;
  const pts = e.points;
  if (!pts.length || !e.fit) return <article className="ec-card"><h4>{e.spec.label}</h4><p className="ec-note">Not enough years on both sides of 2014 to fit.</p></article>;
  const y0 = Math.min(...pts.map((p) => p.v)), y1 = Math.max(...pts.map((p) => p.v));
  const lg = e.spec.log;
  const f = (v: number) => (lg ? Math.log(v) : v);
  const lo = f(lg ? y0 : Math.min(0, y0)), hi = f(y1);
  const x = (yr: number) => r1(L + ((yr - pts[0]!.year) / Math.max(1, pts.at(-1)!.year - pts[0]!.year)) * (W - L - R));
  const y = (v: number) => r1(T + (1 - (f(v) - lo) / Math.max(1e-9, hi - lo)) * (H - T - B));
  const pre = e.fit.fitted.filter((p) => p.year < BREAK_YEAR), post = e.fit.fitted.filter((p) => p.year >= BREAK_YEAR);
  const line = (xs: typeof pre) => xs.map((p, i) => `${i ? "L" : "M"}${x(p.year)},${y(p.y)}`).join("");
  const counted = !e.spec.modelled;
  const v = counted ? e.verdict : "unclear";
  return (
    <article className={`ec-card ec-v-${v}`}>
      <div className="ec-head">
        <h4>{e.spec.label}</h4>
        <span className={`ec-pill ec-p-${v}`}>{counted ? VERDICT_LABEL[e.verdict] : "Modelled — not tested"}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${e.spec.label}: trend ${signed(e.fit.before)} ${trendUnit(e)} before 2014, ${signed(e.fit.after)} after`}>
        <line x1={x(BREAK_YEAR) - 0.5} x2={x(BREAK_YEAR) - 0.5} y1={T - 6} y2={H - B + 2} className="ec-break" />
        <text x={x(BREAK_YEAR) + 3} y={T} className="ec-tick">2014</text>
        {pts.map((p) => <circle key={p.year} cx={x(p.year)} cy={y(p.v)} r={2.4} className={p.year < BREAK_YEAR ? "ec-pt-pre" : "ec-pt-post"}><title>{`${p.year}: ${fmtLevel(p.v, e.unit)}`}</title></circle>)}
        <path d={line(pre)} className="ec-fit-pre" />
        <path d={line(post)} className="ec-fit-post" />
        <text x={L} y={H - 4} className="ec-tick">{pts[0]!.year}</text>
        <text x={W - R} y={H - 4} textAnchor="end" className="ec-tick">{pts.at(-1)!.year}</text>
      </svg>
      <dl className="ec-nums">
        <div><dt>Trend before</dt><dd>{signed(e.fit.before, e.spec.log ? 1 : 2)}</dd></div>
        <div><dt>Trend after</dt><dd>{signed(e.fit.after, e.spec.log ? 1 : 2)}</dd></div>
        <div><dt>Change, 95% range</dt><dd>{signed(e.fit.change, e.spec.log ? 1 : 2)} <small>({e.fit.ci.map((c) => c.toFixed(e.spec.log ? 1 : 2)).join(" to ")})</small></dd></div>
      </dl>
      <p className="ec-note">
        Trends in {trendUnit(e)}.{" "}
        {e.at2014 && e.latest ? <>Level: {fmtLevel(e.at2014.v, e.unit)} in 2014 → <b>{fmtLevel(e.latest.v, e.unit)}</b> in {e.latest.year}. </> : null}
        {e.fit.rho >= 0.9 ? "Strong year-to-year drift: the range is wide. " : ""}
        {e.fragile ? "The verdict changes when 2020–21 are left out. " : ""}
        {e.spec.modelled ? `${e.spec.modelled}: a smoothed curve cannot show a break, so it is not counted. ` : ""}
        {e.spec.note ?? ""}
      </p>
    </article>
  );
}

const STATUS_CLS: Record<string, string> = { operational: "op", "partly-operational": "part", "under-construction": "build", stalled: "stall", framework: "frame" };

/** When each corridor was begun, and where it stands: a bar from its start to today, coloured by status. */
export function CorridorTimeline({ rows, now = 2026 }: { rows: Array<{ id: string; name: string; started: number; status: string }>; now?: number }) {
  const Y0 = 1999, Y1 = 2028, W = 920, L = 250, R = 20, RH = 24;
  const H = rows.length * RH + 34;
  const x = (yr: number) => r1(L + ((yr - Y0) / (Y1 - Y0)) * (W - L - R));
  return (
    <figure className="ec-gantt">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="When each corridor was begun and where it stands">
        {[2000, 2005, 2010, 2015, 2020, 2025].map((yr) => <g key={yr}><line x1={x(yr)} x2={x(yr)} y1={14} y2={H - 6} className="ec-grid" /><text x={x(yr)} y={10} textAnchor="middle" className="ec-tick">{yr}</text></g>)}
        <line x1={x(2014.4)} x2={x(2014.4)} y1={14} y2={H - 6} className="ec-break" />
        <text x={x(2014.4) + 4} y={26} className="ec-tickb">May 2014</text>
        {rows.map((r, i) => (
          <g key={r.id} transform={`translate(0,${30 + i * RH})`}>
            <text x={L - 10} y={12} textAnchor="end" className="ec-gname">{r.name.replace(/\s*\(.*\)$/, "")}</text>
            <rect x={x(r.started)} y={3} width={Math.max(4, x(now) - x(r.started))} height={13} rx={4} className={`ec-bar ec-b-${STATUS_CLS[r.status] ?? "frame"}`}><title>{`${r.name}: begun ${r.started}`}</title></rect>
            <circle cx={x(r.started)} cy={9.5} r={4} className="ec-start" />
          </g>
        ))}
      </svg>
    </figure>
  );
}

/** A ranked series: lower is better, so the axis runs best at the top. */
export function RankLine({ points, label }: { points: Array<[number, number]>; label: string }) {
  const W = 360, H = 150, L = 34, R = 14, T = 16, B = 22;
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const x = (yr: number) => r1(L + ((yr - Math.min(...xs)) / Math.max(1, Math.max(...xs) - Math.min(...xs))) * (W - L - R));
  const lo = Math.min(...ys) - 5, hi = Math.max(...ys) + 5;
  const y = (rank: number) => r1(T + ((rank - lo) / (hi - lo)) * (H - T - B));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ec-rank" role="img" aria-label={label}>
      <path d={points.map((p, i) => `${i ? "L" : "M"}${x(p[0])},${y(p[1])}`).join("")} className="ec-rankline" />
      {points.map((p) => <g key={p[0]}><circle cx={x(p[0])} cy={y(p[1])} r={4.5} className="ec-rankdot" /><text x={x(p[0])} y={y(p[1]) - 9} textAnchor="middle" className="ec-rankv">{p[1]}</text><text x={x(p[0])} y={H - 5} textAnchor="middle" className="ec-tick">{p[0]}</text></g>)}
      <text x={4} y={T + 2} className="ec-tick">better ↑</text>
    </svg>
  );
}
