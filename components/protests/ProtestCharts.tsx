"use client";

/**
 * The protest tracker's charts. Every number arrives computed on the server
 * (lib/protest-charts.ts) from the coverage wire and the record; this file
 * only draws it and answers hover.
 *
 * One hue per chart, never a categorical set: each chart shows one measure,
 * and the small multiples carry identity by their titles. Ink stays in the
 * text tokens; the hue is only on marks.
 */
import { useState, type ReactNode } from "react";
import type { FigurePoint, HourBin } from "@/lib/protest-charts";

const HUE = "var(--series-1)";
const HUE_2 = "var(--series-2)";
const HOUR = 3_600_000;
const IST = 5.5 * HOUR;
const istLabel = (t: number) => {
  const d = new Date(t + IST);
  return `${d.getUTCDate()} Oct, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};

interface Tip { x: number; y: number; body: ReactNode }

function Frame({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <figure className="pc-card">
      <figcaption>
        <h4>{title}</h4>
        {note && <p>{note}</p>}
      </figcaption>
      {children}
    </figure>
  );
}

function Tooltip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return <div className="pc-tip" style={{ left: tip.x, top: tip.y }}>{tip.body}</div>;
}

/* ── 1. headlines per hour ─────────────────────────────────────────────── */
export function HourlyChart({ hours, marks }: { hours: HourBin[]; marks: Array<{ t: number; label: string }> }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const W = 520, H = 230, L = 30, R = 8, T = 30, B = 26;
  const max = Math.max(1, ...hours.map((h) => h.total));
  const top = Math.ceil(max / 10) * 10;
  const bw = (W - L - R) / hours.length;
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const x0 = hours[0]?.t ?? 0;
  const xOf = (t: number) => L + ((t - x0) / HOUR) * bw;
  return (
    <div className="pc-wrap" onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="pc-svg" role="img" aria-label={`Headlines per hour, peaking at ${max}.`}>
        {[0, top / 2, top].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className={v === 0 ? "pc-base" : "pc-grid"} />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" className="pc-tick">{v}</text>
          </g>
        ))}
        {hours.map((h, i) => (
          <rect key={h.t} x={L + i * bw + 1} y={y(h.total)} width={Math.max(1, bw - 2)} height={y(0) - y(h.total)} rx={Math.min(3, bw / 4)} fill={HUE}
            onMouseEnter={() => setTip({ x: Math.min(L + i * bw, W - 200) / W * 100, y: 0, body: <><b>{h.label} IST</b><span>{h.total} headline{h.total === 1 ? "" : "s"}</span>{h.top && <em>{h.top}</em>}</> })} />
        ))}
        {hours.map((h, i) => (new Date(h.t + IST).getUTCHours() % 6 === 0 ? (
          <text key={`l${h.t}`} x={L + i * bw} y={H - 10} className="pc-tick">{new Date(h.t + IST).getUTCHours() === 0 ? `${new Date(h.t + IST).getUTCDate()} Oct` : `${String(new Date(h.t + IST).getUTCHours()).padStart(2, "0")}:00`}</text>
        ) : null))}
        {marks.filter((m) => m.t >= x0 && m.t <= x0 + hours.length * HOUR).map((m, i) => (
          <g key={m.label}>
            <line x1={xOf(m.t)} x2={xOf(m.t)} y1={T - 8} y2={y(0)} className="pc-mark" />
            <text x={xOf(m.t) > W * 0.7 ? xOf(m.t) - 4 : xOf(m.t) + 4} y={T - 14 + (i % 2) * 12} textAnchor={xOf(m.t) > W * 0.7 ? "end" : "start"} className="pc-mark-label">{m.label}</text>
          </g>
        ))}
      </svg>
      <TooltipPct tip={tip} />
    </div>
  );
}

function TooltipPct({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return <div className="pc-tip" style={{ left: `${tip.x}%`, top: tip.y }}>{tip.body}</div>;
}

/* ── 2. themes, small multiples ────────────────────────────────────────── */
export function ThemeMultiples({ hours, themes }: { hours: HourBin[]; themes: Array<{ id: string; label: string; words: string }> }) {
  const [tip, setTip] = useState<{ theme: string; body: ReactNode; x: number } | null>(null);
  const W = 300, H = 92, B = 14;
  return (
    <div className="pc-multi">
      {themes.map((th) => {
        const vals = hours.map((h) => h.byTheme[th.id] ?? 0);
        const max = Math.max(1, ...vals);
        const total = vals.reduce((a, b) => a + b, 0);
        const bw = W / vals.length;
        return (
          <div key={th.id} className="pc-mini" onMouseLeave={() => setTip(null)}>
            <p><b>{th.label}</b> <span>{total} headlines · peak {max}/h</span></p>
            <svg viewBox={`0 0 ${W} ${H}`} className="pc-svg" role="img" aria-label={`${th.label}: ${total} headlines, peaking at ${max} an hour.`}>
              <line x1={0} x2={W} y1={H - B} y2={H - B} className="pc-base" />
              {vals.map((v, i) => v > 0 && (
                <rect key={i} x={i * bw + 0.5} y={(H - B) * (1 - v / max)} width={Math.max(1, bw - 1)} height={(H - B) * (v / max)} rx={1.5} fill={HUE}
                  onMouseEnter={() => setTip({ theme: th.id, x: (i * bw) / W * 100, body: <><b>{hours[i]!.label} IST</b><span>{v} of {hours[i]!.total} headlines</span></> })} />
              ))}
              <text x={0} y={H - 2} className="pc-tick">{hours[0]?.label.split(" ").slice(0, 2).join(" ")}</text>
              <text x={W} y={H - 2} textAnchor="end" className="pc-tick">{hours[hours.length - 1]?.label}</text>
            </svg>
            {tip?.theme === th.id && <div className="pc-tip" style={{ left: `${Math.min(tip.x, 60)}%`, top: 18 }}>{tip.body}</div>}
            <p className="pc-words">Words: {th.words}</p>
          </div>
        );
      })}
    </div>
  );
}

/* ── 3. the detention figure, as headlines stated it ───────────────────── */
export function FigureChart({ figures, from, to }: { figures: FigurePoint[]; from: number; to: number }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const W = 520, H = 250, L = 44, R = 44, T = 14, B = 26;
  if (figures.length === 0) return <p className="pc-empty">No headline has stated a detention figure yet.</p>;
  const lo = 10, hi = 10_000;
  const x = (t: number) => L + ((t - from) / Math.max(HOUR, to - from)) * (W - L - R);
  const y = (v: number) => T + (H - T - B) * (1 - (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)));
  // Direct labels for distinct values only, and only where they do not
  // collide with one already placed; the tooltip carries every point.
  const placed: Array<{ x: number; y: number }> = [];
  const labelled = new Set<number>();
  return (
    <div className="pc-wrap" onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="pc-svg" role="img" aria-label={`Detention figures stated in ${figures.length} headlines, from ${Math.min(...figures.map((f) => f.value))} to ${Math.max(...figures.map((f) => f.value))}.`}>
        {[10, 100, 1000, 10000].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="pc-grid" />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" className="pc-tick">{v.toLocaleString("en-IN")}</text>
          </g>
        ))}
        {Array.from({ length: Math.floor((to - from) / (6 * HOUR)) + 1 }, (_, i) => from + i * 6 * HOUR).map((t) => (
          <text key={t} x={x(t)} y={H - 10} className="pc-tick">{new Date(t + IST).getUTCHours() === 0 ? `${new Date(t + IST).getUTCDate()} Oct` : `${String(new Date(t + IST).getUTCHours()).padStart(2, "0")}:00`}</text>
        ))}
        {figures.map((f, i) => (
          <circle key={i} cx={x(f.t)} cy={y(f.value)} r={6} fill={HUE_2} stroke="var(--story-card)" strokeWidth={2}
            onMouseEnter={() => setTip({ x: Math.min(x(f.t), W - 220) / W * 100, y: Math.max(0, y(f.value) - 70), body: <><b>{f.value.toLocaleString("en-IN")}</b><span>{f.publisher}, {istLabel(f.t)} IST</span><em>{f.title}</em></> })} />
        ))}
        {(() => {
          // Second pass: a label for each distinct value, to the right of its
          // first point, only where its box touches no dot and no other label.
          const dots = figures.map((f) => ({ x: x(f.t), y: y(f.value) }));
          const out: ReactNode[] = [];
          for (const f of figures) {
            if (labelled.has(f.value)) continue;
            const text = f.value.toLocaleString("en-IN");
            const bx = x(f.t) + 9, by = y(f.value) - 8, bw = text.length * 7.5, bh = 14;
            const hitsDot = dots.some((d) => d.x + 6 > bx && d.x - 6 < bx + bw && d.y + 6 > by && d.y - 6 < by + bh);
            const hitsLabel = placed.some((p) => p.x < bx + bw && p.x + 40 > bx && Math.abs(p.y - by) < bh);
            if (hitsDot || hitsLabel || bx + bw > W) continue;
            labelled.add(f.value);
            placed.push({ x: bx, y: by });
            out.push(<text key={`l${f.value}`} x={bx} y={by + 11} className="pc-point-label">{text}</text>);
          }
          return out;
        })()}
      </svg>
      <TooltipPct tip={tip} />
    </div>
  );
}

/* ── 4. who published ──────────────────────────────────────────────────── */
export function PublisherBars({ rows, total }: { rows: Array<{ name: string; value: number }>; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol className="pc-bars">
      {rows.map((r) => (
        <li key={r.name} title={`${r.name}: ${r.value} of ${total} headlines`}>
          <span className="pc-bar-l">{r.name}</span>
          <span className="pc-bar-t"><i style={{ width: `${(r.value / max) * 100}%`, background: HUE }} /></span>
          <span className="pc-bar-v">{r.value}</span>
        </li>
      ))}
    </ol>
  );
}

/* ── 5. the restrictions, as a timeline ────────────────────────────────── */
export function RestrictionGantt({ rows, from, to }: { rows: Array<{ label: string; start: number; end: number | null; note: string }>; from: number; to: number }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const span = to - from;
  const pos = (t: number) => `${Math.max(0, Math.min(100, ((t - from) / span) * 100))}%`;
  const days: number[] = [];
  for (let t = from; t <= to; t += 24 * HOUR) days.push(t);
  return (
    <div className="pc-gantt" onMouseLeave={() => setTip(null)}>
      {rows.map((r) => (
        <div key={r.label} className="pc-gantt-row">
          <span className="pc-gantt-l">{r.label}</span>
          <span className="pc-gantt-t">
            <i style={{ left: pos(r.start), width: `calc(${pos(r.end ?? to)} - ${pos(r.start)})`, background: HUE }} className={r.end === null ? "open" : undefined}
              onMouseEnter={(e) => setTip({ x: (e.currentTarget.offsetLeft / (e.currentTarget.parentElement?.offsetWidth || 1)) * 60, y: 0, body: <><b>{r.label}</b><span>{istLabel(r.start)} → {r.end ? istLabel(r.end) : "still in force when last read"}</span><em>{r.note}</em></> })} />
          </span>
        </div>
      ))}
      <div className="pc-gantt-axis">
        <span />
        <span className="pc-gantt-days">{days.map((d) => <i key={d} style={{ left: pos(d) }}>{new Date(d + IST).getUTCDate()} Oct</i>)}</span>
      </div>
      <TooltipPct tip={tip} />
    </div>
  );
}

export { Frame, Tooltip };
