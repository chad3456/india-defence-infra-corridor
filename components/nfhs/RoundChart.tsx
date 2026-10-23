/**
 * One metric across every NFHS round: India, the poorest fifth and the
 * richest fifth, placed at each round's fieldwork year so the seven- and
 * nine-year gaps between rounds read as gaps. A round with no value breaks
 * the line; nothing is drawn across it. Server-rendered SVG, every point
 * titled and the India line labelled.
 */
import type { MetricSeries, Survey } from "@/lib/nfhs";

const W = 320, H = 168, L = 30, R = 10, T = 16, B = 30;
const LINES = [
  { key: "poorest", label: "Poorest fifth", colour: "var(--series-1)", width: 1.6 },
  { key: "richest", label: "Richest fifth", colour: "var(--series-2)", width: 1.6 },
  { key: "total", label: "India", colour: "var(--story-ink)", width: 2.6 },
] as const;

/** A value in its unit: "%" a share, "pp" a difference of shares, "children" per woman, otherwise a rate per 1,000. */
export const fmtV = (v: number | null, unit: string) => (v === null ? "—" : unit === "%" ? `${v.toFixed(1)}%` : unit === "pp" ? v.toFixed(1) : unit === "children" ? v.toFixed(1) : `${Math.round(v)}`);

export function RoundChart({ m, surveys, unit }: { m: MetricSeries; surveys: Survey[]; unit: string }) {
  const y0 = surveys[0]!.year - 1, y1 = surveys.at(-1)!.year + 1;
  const vals = m.points.flatMap((p) => [p.total, p.poorest, p.richest]).filter((v): v is number => v !== null);
  // A round top for the axis: the next round step above the highest value.
  const nice = (v: number) => { const e = 10 ** Math.floor(Math.log10(v)); return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((k) => k * e).find((k) => k >= v)!; };
  const top = unit === "%" ? Math.min(100, nice(Math.max(...vals) * 1.08)) : nice(Math.max(...vals) * 1.08);
  const x = (yr: number) => L + ((yr - y0) / (y1 - y0)) * (W - L - R);
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  const ticks = [0, top / 2, top].map((t) => Math.round(t * 100) / 100);
  const segs = (k: (typeof LINES)[number]["key"]) => {
    const out: string[] = [];
    m.points.forEach((p, i) => {
      const prev = m.points[i - 1];
      if (i > 0 && prev && prev[k] !== null && p[k] !== null) out.push(`M${x(surveys[i - 1]!.year)},${y(prev[k]!)}L${x(surveys[i]!.year)},${y(p[k]!)}`);
    });
    return out.join("");
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`${m.dhsLabel} by NFHS round`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--story-rule)" strokeWidth={0.6} />
          <text x={L - 4} y={y(t) + 3} textAnchor="end" fontSize={8.5} fill="var(--story-ink-3)">{t}</text>
        </g>
      ))}
      {surveys.map((s) => (
        <text key={s.id} x={x(s.year)} y={H - 10} textAnchor="middle" fontSize={8.5} fill="var(--story-ink-3)">{s.label}</text>
      ))}
      {LINES.map((ln) => (
        <g key={ln.key}>
          <path d={segs(ln.key)} fill="none" stroke={ln.colour} strokeWidth={ln.width} strokeLinecap="round" />
          {m.points.map((p, i) => p[ln.key] === null ? null : (
            <circle key={p.survey} cx={x(surveys[i]!.year)} cy={y(p[ln.key]!)} r={ln.key === "total" ? 3 : 2.2} fill={ln.colour} stroke="var(--story-card)" strokeWidth={1}>
              <title>{`${ln.label}, ${surveys[i]!.name} (${surveys[i]!.label}): ${fmtV(p[ln.key], unit)}`}</title>
            </circle>
          ))}
        </g>
      ))}
      {m.points.map((p, i) => p.total === null ? (
        <text key={p.survey} x={x(surveys[i]!.year)} y={H - B - 4} textAnchor="middle" fontSize={8} fill="var(--story-ink-3)">no value</text>
      ) : (
        <text key={p.survey} x={x(surveys[i]!.year)} y={y(p.total) - 7} textAnchor="middle" fontSize={9} fontWeight={700} fill="var(--story-ink)">{fmtV(p.total, unit)}</text>
      ))}
    </svg>
  );
}

export function ChartKey() {
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: "var(--story-ink-2)" }}>
      {LINES.slice().reverse().map((l) => (
        <span key={l.key} className="flex items-center gap-1.5"><span className="inline-block w-4 rounded" style={{ height: l.width + 0.5, background: l.colour }} />{l.label}</span>
      ))}
      <span>Wealth fifths rank households by an index of assets, not income.</span>
    </p>
  );
}
