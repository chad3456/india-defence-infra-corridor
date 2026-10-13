/**
 * The two chart shapes the public-order section needs that the story kit does
 * not have: annual counts as columns, and two to four series on one axis.
 *
 * Server-rendered SVG, scaled by width (see components/stories/Charts.tsx for
 * why). A year with no figure is drawn as a gap with "no data" under it, never
 * as a zero and never bridged — a missing year in a police count is a fact
 * about the record, and joining across it would invent the years between.
 */

export interface YearPoint { x: number; v: number | null }

const fmtDefault = (v: number) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-IN") : v % 1 ? v.toFixed(1) : String(v));

/** Annual counts as columns, every value printed, missing years marked. */
export function YearBars({
  points, height = 220, colour = "var(--series-1)", format = fmtDefault, mark, minWidth = 560,
}: {
  points: YearPoint[];
  /** The narrowest drawing area, in viewBox units: wider for a full-width card. */
  minWidth?: number;
  height?: number;
  colour?: string;
  format?: (v: number) => string;
  /** Years to pull out in full colour; the rest are tinted. */
  mark?: number[];
}) {
  if (points.length === 0) return <p className="mono text-[11px]" style={{ color: "var(--story-ink-3)" }}>No verified figures yet.</p>;
  const years = fill(points);
  // A minimum drawing width keeps a chart of six years from being drawn as
  // six giant columns: the columns stay narrow and the year spacing widens.
  const padL = 6, padT = 22, padB = 26;
  const w = Math.max(padL * 2 + years.length * 42, minWidth);
  const step = (w - padL * 2) / years.length;
  const col = Math.min(40, step * 0.78), gap = step - col;
  const plot = height - padT - padB;
  const max = Math.max(1, ...years.map((p) => p.v ?? 0));
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${height}`} style={{ width: "100%", minWidth: Math.min(w, 380), height: "auto" }} role="img"
        aria-label={years.map((p) => `${p.x}: ${p.v == null ? "no data" : format(p.v)}`).join("; ")}>
        <line x1={padL} x2={w - padL} y1={padT + plot} y2={padT + plot} stroke="var(--story-rule)" />
        {years.map((p, i) => {
          const x = padL + i * (col + gap) + gap / 2;
          const on = !mark || mark.includes(p.x);
          if (p.v == null) {
            return (
              <g key={p.x}>
                <text x={x + col / 2} y={padT + plot - 6} textAnchor="middle" fontSize="8.5" fill="var(--story-ink-3)">no data</text>
                <text x={x + col / 2} y={height - 8} textAnchor="middle" fontSize="10" fill="var(--story-ink-3)">{p.x}</text>
              </g>
            );
          }
          const h = Math.max(1, (p.v / max) * plot);
          return (
            <g key={p.x}>
              <rect x={x} y={padT + plot - h} width={col} height={h} rx={2} fill={colour} opacity={on ? 1 : 0.35} />
              <text x={x + col / 2} y={padT + plot - h - 5} textAnchor="middle" fontSize="9.5" fontWeight={600} fill="var(--story-ink)">{format(p.v)}</text>
              <text x={x + col / 2} y={height - 8} textAnchor="middle" fontSize="10" fill="var(--story-ink-3)">{p.x}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Fill the year range so a missing year is a visible gap, not a silent skip. */
function fill(points: YearPoint[]): YearPoint[] {
  const byX = new Map(points.map((p) => [p.x, p.v]));
  const xs = points.map((p) => p.x);
  const out: YearPoint[] = [];
  for (let x = Math.min(...xs); x <= Math.max(...xs); x++) out.push({ x, v: byX.has(x) ? byX.get(x)! : null });
  return out;
}

export interface Line { label: string; colour: string; points: YearPoint[]; dashed?: boolean }

function niceStep(x: number): number {
  const p = 10 ** Math.floor(Math.log10(x));
  const f = x / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

/** Two to four series on one axis, each labelled at its last point. Lines break at gaps. */
export function MultiLine({ lines, height = 240, format = fmtDefault }: { lines: Line[]; height?: number; format?: (v: number) => string }) {
  const all = lines.flatMap((l) => l.points.filter((p) => p.v != null));
  if (all.length < 2) return <p className="mono text-[11px]" style={{ color: "var(--story-ink-3)" }}>Not enough verified figures to draw.</p>;
  const x0 = Math.min(...all.map((p) => p.x)), x1 = Math.max(...all.map((p) => p.x));
  // Ticks on a round step (1, 2, 2.5 or 5 times a power of ten), so the axis
  // reads 0, 250, 500 rather than 0, 235.8, 471.5.
  const raw = Math.max(1, ...all.map((p) => p.v!));
  const step = niceStep(raw / 4);
  const max = Math.ceil(raw / step) * step;
  const W = 660, padL = 44, padR = 178, padT = 14, padB = 26;
  const pw = W - padL - padR, ph = height - padT - padB;
  const sx = (x: number) => padL + (x1 === x0 ? pw / 2 : ((x - x0) / (x1 - x0)) * pw);
  const sy = (v: number) => padT + ph - (v / max) * ph;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  // End labels, nudged apart so two lines ending close do not overprint.
  const ends = lines.map((l) => { const last = [...l.points].reverse().find((p) => p.v != null); return { l, last }; }).filter((e) => e.last);
  ends.sort((a, b) => sy(a.last!.v!) - sy(b.last!.v!));
  const placed: number[] = [];
  for (const e of ends) { let y = sy(e.last!.v!); for (const p of placed) if (Math.abs(p - y) < 13) y = p + 13; placed.push(y); (e as { y?: number }).y = y; }
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${height}`} style={{ width: "100%", minWidth: 480, height: "auto" }} role="img"
        aria-label={lines.map((l) => `${l.label}: ${l.points.filter((p) => p.v != null).map((p) => `${p.x} ${format(p.v!)}`).join(", ")}`).join(". ")}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={padL + pw} y1={sy(t)} y2={sy(t)} stroke="var(--story-rule)" strokeDasharray={t ? "2 3" : undefined} />
            <text x={padL - 6} y={sy(t) + 3} textAnchor="end" fontSize="9.5" fill="var(--story-ink-3)">{format(t)}</text>
          </g>
        ))}
        {[x0, ...(x1 - x0 > 6 ? [Math.round((x0 + x1) / 2)] : []), x1].map((x) => (
          <text key={x} x={sx(x)} y={height - 8} textAnchor="middle" fontSize="10" fill="var(--story-ink-3)">{x}</text>
        ))}
        {lines.map((l) => {
          const segs: YearPoint[][] = [];
          let cur: YearPoint[] = [];
          for (const p of fill(l.points)) { if (p.v == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push(p); }
          if (cur.length) segs.push(cur);
          return (
            <g key={l.label}>
              {segs.map((s, i) => s.length > 1
                ? <path key={i} d={s.map((p, j) => `${j ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.v!).toFixed(1)}`).join("")} fill="none" stroke={l.colour} strokeWidth={2.2} strokeDasharray={l.dashed ? "5 4" : undefined} />
                : null)}
              {l.points.filter((p) => p.v != null).map((p) => (
                <circle key={p.x} cx={sx(p.x)} cy={sy(p.v!)} r={2.6} fill={l.colour}><title>{`${l.label}, ${p.x}: ${format(p.v!)}`}</title></circle>
              ))}
            </g>
          );
        })}
        {ends.map((e) => (
          <text key={e.l.label} x={sx(e.last!.x) + 8} y={((e as { y?: number }).y ?? 0) + 3.5} fontSize="10.5" fontWeight={600} fill={e.l.colour}>
            {e.l.label} · {format(e.last!.v!)}
          </text>
        ))}
      </svg>
    </div>
  );
}

export interface StackGroup { label: string; colour: string; values: Record<number, number> }

/** Each year as a 100% column split into groups, with the year's total printed above it. */
export function StackColumns({ years, groups, height = 260 }: { years: number[]; groups: StackGroup[]; height?: number }) {
  const col = 56, gap = 18, padT = 24, padB = 26, padL = 8;
  const W = padL * 2 + years.length * (col + gap);
  const ph = height - padT - padB;
  return (
    <div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${height}`} style={{ width: "100%", maxWidth: 760, minWidth: Math.min(W, 520), height: "auto", display: "block", margin: "0 auto" }} role="img"
          aria-label={years.map((y) => `${y}: ${groups.map((g) => `${g.label} ${g.values[y] ?? 0}`).join(", ")}`).join("; ")}>
          {years.map((y, i) => {
            const total = groups.reduce((a, g) => a + (g.values[y] ?? 0), 0);
            const x = padL + i * (col + gap) + gap / 2;
            let acc = 0;
            return (
              <g key={y}>
                <text x={x + col / 2} y={padT - 7} textAnchor="middle" fontSize="9.5" fontWeight={600} fill="var(--story-ink)">{total.toLocaleString("en-IN")}</text>
                {groups.map((g) => {
                  const v = g.values[y] ?? 0;
                  const h = total ? (v / total) * ph : 0;
                  const yTop = padT + acc; acc += h;
                  return (
                    <g key={g.label}>
                      <rect x={x} y={yTop} width={col} height={Math.max(0, h - 0.6)} fill={g.colour}><title>{`${y}, ${g.label}: ${v.toLocaleString("en-IN")} (${total ? ((v / total) * 100).toFixed(1) : 0}%)`}</title></rect>
                      {h > 15 && <text x={x + col / 2} y={yTop + h / 2 + 3.5} textAnchor="middle" fontSize="9" fill="#fff" fontWeight={600}>{Math.round((v / total) * 100)}%</text>}
                    </g>
                  );
                })}
                <text x={x + col / 2} y={height - 8} textAnchor="middle" fontSize="10" fill="var(--story-ink-3)">{y}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: "var(--story-ink-2, var(--story-ink))" }}>
        {groups.map((g) => (
          <li key={g.label} className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: g.colour }} />{g.label}</li>
        ))}
      </ul>
    </div>
  );
}
