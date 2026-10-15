/**
 * Monthly series on a month axis, and fiscal-year columns, for /ministries.
 *
 * Server-rendered SVG scaled by width. A month with no figure breaks the line;
 * it is never bridged, because a gap in a ministry's releases is a fact about
 * the record and a straight line across it would invent the months between.
 * Negative values (trade balances) get a zero line and bars that hang below it.
 */

export interface MonthPoint { m: string; v: number }
export interface MonthLine { label: string; colour: string; points: MonthPoint[]; dashed?: boolean }

const idx = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1));

function step(x: number): number {
  const p = 10 ** Math.floor(Math.log10(Math.max(x, 1e-9)));
  const f = x / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

export function MonthLines({ lines, height = 250, unit = "US$ bn", format = fmt, wide = false }: { lines: MonthLine[]; height?: number; unit?: string; format?: (v: number) => string; wide?: boolean }) {
  const all = lines.flatMap((l) => l.points);
  if (all.length < 2) return <p className="mono text-[11px]" style={{ color: "var(--story-ink-3)" }}>Not enough verified figures to draw.</p>;
  const i0 = Math.min(...all.map((p) => idx(p.m))), i1 = Math.max(...all.map((p) => idx(p.m)));
  const lo = Math.min(0, ...all.map((p) => p.v)), hi = Math.max(0, ...all.map((p) => p.v));
  const st = step((hi - lo) / 4 || 1);
  const ymin = Math.floor(lo / st) * st, ymax = Math.ceil(hi / st) * st;
  const W = wide ? 1040 : 680, padL = 46, padR = 150, padT = 12, padB = 26;
  const pw = W - padL - padR, ph = height - padT - padB;
  const sx = (i: number) => padL + (i1 === i0 ? pw / 2 : ((i - i0) / (i1 - i0)) * pw);
  const sy = (v: number) => padT + ph - ((v - ymin) / (ymax - ymin || 1)) * ph;
  const years: number[] = [];
  for (let y = Math.ceil(i0 / 12); y * 12 <= i1; y++) years.push(y);
  const every = Math.max(1, Math.ceil(years.length / 8));
  const ends = lines.map((l) => { const s = [...l.points].sort((a, b) => idx(a.m) - idx(b.m)); return { l, last: s[s.length - 1] }; }).filter((e) => e.last);
  ends.sort((a, b) => sy(a.last!.v) - sy(b.last!.v));
  const ys: number[] = [];
  for (const e of ends) { let y = sy(e.last!.v); for (const p of ys) if (Math.abs(p - y) < 13) y = p + 13; ys.push(y); (e as { y?: number }).y = y; }
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${height}`} style={{ width: "100%", minWidth: 420, height: "auto" }} role="img"
        aria-label={lines.map((l) => `${l.label}: ${l.points.length} months, last ${l.points.at(-1)?.m} ${format(l.points.at(-1)?.v ?? 0)} ${unit}`).join(". ")}>
        {Array.from({ length: Math.round((ymax - ymin) / st) + 1 }, (_, k) => ymin + k * st).map((t) => (
          <g key={t}>
            <line x1={padL} x2={padL + pw} y1={sy(t)} y2={sy(t)} stroke={t === 0 ? "var(--story-ink-3)" : "var(--story-rule)"} strokeDasharray={t === 0 ? undefined : "2 3"} />
            <text x={padL - 6} y={sy(t) + 3} textAnchor="end" fontSize="9.5" fill="var(--story-ink-3)">{format(t)}</text>
          </g>
        ))}
        {years.filter((_, k) => k % every === 0).map((y) => (
          <text key={y} x={sx(y * 12)} y={height - 8} textAnchor="middle" fontSize="10" fill="var(--story-ink-3)">{y}</text>
        ))}
        {lines.map((l) => {
          const s = [...l.points].sort((a, b) => idx(a.m) - idx(b.m));
          const segs: MonthPoint[][] = [];
          let cur: MonthPoint[] = [];
          for (const p of s) { if (cur.length && idx(p.m) - idx(cur[cur.length - 1]!.m) > 1) { segs.push(cur); cur = []; } cur.push(p); }
          if (cur.length) segs.push(cur);
          return (
            <g key={l.label}>
              {segs.map((g, k) => g.length > 1
                ? <path key={k} d={g.map((p, j) => `${j ? "L" : "M"}${sx(idx(p.m)).toFixed(1)},${sy(p.v).toFixed(1)}`).join("")} fill="none" stroke={l.colour} strokeWidth={1.8} strokeDasharray={l.dashed ? "5 4" : undefined} />
                : <circle key={k} cx={sx(idx(g[0]!.m))} cy={sy(g[0]!.v)} r={2.4} fill={l.colour} />)}
              {s.map((p) => <circle key={p.m} cx={sx(idx(p.m))} cy={sy(p.v)} r={6} fill="transparent"><title>{`${l.label}, ${p.m}: ${format(p.v)} ${unit}`}</title></circle>)}
            </g>
          );
        })}
        {ends.map((e) => (
          <text key={e.l.label} x={sx(idx(e.last!.m)) + 7} y={((e as { y?: number }).y ?? 0) + 3.5} fontSize="10.5" fontWeight={600} fill={e.l.colour}>{e.l.label} · {format(e.last!.v)}</text>
        ))}
      </svg>
    </div>
  );
}

/** Columns with values printed; negative values hang below a zero line. */
export function LabelBars({ bars, height = 220, colour = "var(--series-1)", format = fmt }: { bars: Array<{ label: string; v: number; mark?: boolean }>; height?: number; colour?: string; format?: (v: number) => string }) {
  if (bars.length === 0) return <p className="mono text-[11px]" style={{ color: "var(--story-ink-3)" }}>No verified figures yet.</p>;
  const lo = Math.min(0, ...bars.map((b) => b.v)), hi = Math.max(0, ...bars.map((b) => b.v));
  const padT = 20, padB = 30, W = Math.max(560, bars.length * 44 + 12);
  const ph = height - padT - padB;
  const sy = (v: number) => padT + ((hi - v) / (hi - lo || 1)) * ph;
  const stepX = (W - 12) / bars.length, col = Math.min(36, stepX * 0.75);
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${height}`} style={{ width: "100%", minWidth: 400, height: "auto" }} role="img" aria-label={bars.map((b) => `${b.label}: ${format(b.v)}`).join("; ")}>
        <line x1={6} x2={W - 6} y1={sy(0)} y2={sy(0)} stroke="var(--story-ink-3)" />
        {bars.map((b, i) => {
          const x = 6 + i * stepX + (stepX - col) / 2;
          const top = Math.min(sy(b.v), sy(0)), h = Math.max(1, Math.abs(sy(b.v) - sy(0)));
          return (
            <g key={b.label}>
              <rect x={x} y={top} width={col} height={h} rx={2} fill={colour} opacity={b.mark === false ? 0.45 : 1}><title>{`${b.label}: ${format(b.v)}`}</title></rect>
              <text x={x + col / 2} y={b.v >= 0 ? top - 4 : top + h + 11} textAnchor="middle" fontSize="9" fontWeight={600} fill="var(--story-ink)">{format(b.v)}</text>
              <text x={x + col / 2} y={height - 10} textAnchor="middle" fontSize="9" fill="var(--story-ink-3)">{b.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
