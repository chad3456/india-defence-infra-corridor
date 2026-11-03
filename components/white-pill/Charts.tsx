/**
 * The white pill's charts, server-rendered SVG: a sparkline card for a series,
 * bars for a series whose periods are categories, a poorest-and-richest
 * dumbbell for a survey gap, and a before-and-after pace row for 2014.
 */
import type { Pace } from "@/lib/white-pill";
import { UNIT } from "@/lib/white-pill";

export interface CardPoint { label: string; t: number | null; v: number }

export function fmt(v: number, unit = ""): string {
  const a = Math.abs(v);
  const n = a >= 1e9 ? `${(v / 1e9).toFixed(a >= 1e10 ? 0 : 1)}bn` : a >= 1e6 ? `${(v / 1e6).toFixed(a >= 1e7 ? 0 : 1)}m` : a >= 1000 ? Math.round(v).toLocaleString("en-IN") : a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toFixed(a >= 1 ? 1 : 2);
  if (unit === "%") return `${n}%`;
  if (/^₹/.test(unit)) return `₹${n}${unit.replace(/^₹\s*/, " ")}`;
  if (/US\$|current US\$|\$/.test(unit)) return `$${n}`;
  return unit ? `${n} ${unit}` : n;
}

/** A line for a time series, or bars when its periods are categories. */
export function Spark({ points, unit, better }: { points: CardPoint[]; unit: string; better: boolean | null }) {
  const W = 280, H = 84, P = 6;
  if (!points.length) return <p className="wp-await">Awaiting data</p>;
  const temporal = points.every((p) => p.t !== null) && points.length > 1;
  if (!temporal) {
    const max = Math.max(...points.map((p) => p.v), 1);
    return (
      <div className="wp-bars">
        {points.map((p) => (
          <div key={p.label} className="wp-barrow">
            <span>{p.label}</span>
            <i style={{ width: `${(100 * p.v) / max}%` }} />
            <b>{fmt(p.v, unit)}</b>
          </div>
        ))}
      </div>
    );
  }
  const ts = points.map((p) => p.t!), vs = points.map((p) => p.v);
  const t0 = Math.min(...ts), t1 = Math.max(...ts);
  const lo = Math.min(0, ...vs), hi = Math.max(...vs) * 1.06 || 1;
  const x = (t: number) => P + ((t - t0) / Math.max(1e-9, t1 - t0)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - lo) / (hi - lo)) * (H - 2 * P);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.t!).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const area = `${line}L${x(t1).toFixed(1)},${(H - P).toFixed(1)}L${x(t0).toFixed(1)},${(H - P).toFixed(1)}Z`;
  const first = points[0]!, last = points.at(-1)!;
  const up = last.v > first.v;
  const good = better === null ? null : up === better;
  const tone = good === null ? "var(--series-1)" : good ? "var(--wp-good)" : "var(--wp-bad)";
  return (
    <figure className="wp-spark">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${first.label}: ${fmt(first.v, unit)}; ${last.label}: ${fmt(last.v, unit)}`}>
        <path d={area} fill={tone} opacity={0.1} />
        <path d={line} fill="none" stroke={tone} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {points.length <= 12 && points.map((p) => <circle key={p.label} cx={x(p.t!)} cy={y(p.v)} r={2.2} fill="var(--surface-1)" stroke={tone} strokeWidth={1.3} />)}
        <circle cx={x(last.t!)} cy={y(last.v)} r={3.6} fill={tone} />
      </svg>
      <figcaption>
        <span>{first.label} <b>{fmt(first.v, unit)}</b></span>
        <span className="wp-arrow" style={{ color: tone }} aria-hidden>→</span>
        <span>{last.label} <b>{fmt(last.v, unit)}</b></span>
      </figcaption>
    </figure>
  );
}

/** Poorest fifth against richest fifth across survey rounds: the gap is the bar between them. */
export function GapRows({ rows }: { rows: Array<{ round: string; poorest: number; richest: number }> }) {
  return (
    <div className="wp-gaps">
      {rows.map((r) => (
        <div key={r.round} className="wp-gaprow">
          <span className="wp-gapround">{r.round}</span>
          <div className="wp-gaptrack">
            <i style={{ left: `${Math.min(r.poorest, r.richest)}%`, width: `${Math.abs(r.richest - r.poorest)}%` }} />
            <b className="wp-poor" style={{ left: `${r.poorest}%` }} title={`Poorest fifth: ${r.poorest}%`} />
            <b className="wp-rich" style={{ left: `${r.richest}%` }} title={`Richest fifth: ${r.richest}%`} />
          </div>
          <span className="wp-gapval">{fmt(r.richest - r.poorest)} pts</span>
        </div>
      ))}
    </div>
  );
}

/** One indicator's pace before and after 2014, on its own scale. */
export function PaceRow({ p }: { p: Pace }) {
  if (!p.before || !p.after) return null;
  const max = Math.max(Math.abs(p.before.rate), Math.abs(p.after.rate), 1e-6);
  const neg = Math.min(p.before.rate, p.after.rate) < 0;
  const pos = (v: number) => (neg ? 50 + (v / max) * 48 : (v / max) * 96);
  const show = (v: number) => (p.spec.method === "points" ? `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}` : `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`);
  const yr = (t: number) => String(Math.floor(t));
  return (
    <li className={`wp-pace wp-${p.verdict}`}>
      <div className="wp-pacehead">
        <b>{p.spec.label}</b>
        <span className={`wp-verdict wp-v-${p.verdict}`}>{p.verdict === "faster" ? "Faster after 2014" : p.verdict === "slower" ? "Slower after 2014" : "About the same"}</span>
      </div>
      <div className="wp-pacetrack" aria-hidden>
        {neg && <i className="wp-pacezero" />}
        <b className="wp-pre" style={{ left: `${pos(p.before.rate)}%` }} />
        <b className="wp-post" style={{ left: `${pos(p.after.rate)}%` }} />
      </div>
      <p className="wp-pacenums">
        <span className="wp-pre-t">{yr(p.before.from)}–{yr(p.before.to)}: <b>{show(p.before.rate)}</b></span>
        <span className="wp-post-t">{yr(p.after.from)}–{yr(p.after.to)}: <b>{show(p.after.rate)}</b></span>
        <span className="wp-unit">{UNIT[p.spec.method]}</span>
      </p>
      {p.spec.note && <p className="wp-pacenote">{p.spec.note}</p>}
    </li>
  );
}
