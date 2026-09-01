/**
 * A sparkline of the coverage ratio (exports over imports) across the sampled
 * years, on a log scale with a rule at parity.
 *
 * Log, because the interesting quantity is multiplicative: going from 0.1 to
 * 0.2 and from 5 to 10 are the same achievement, and a linear axis would show
 * only the second. The rule at 1.0 is the whole point of the chart — above it
 * India sells more than it buys.
 */
export default function CoverageSpark({
  years,
  width = 108,
  height = 26,
}: {
  years: Array<{ year: number; m: number; x: number }>;
  width?: number;
  height?: number;
}) {
  const pts = years
    .map((y) => ({ year: y.year, c: y.m > 0 ? y.x / y.m : y.x > 0 ? 50 : 0 }))
    .filter((p) => p.c > 0);
  if (pts.length < 2) {
    return <span className="text-[10px] text-ink-muted">no ratio</span>;
  }

  // Clamp to a readable window; extreme ratios compress everything else.
  const LO = 0.02;
  const HI = 50;
  const clamp = (v: number) => Math.max(LO, Math.min(HI, v));
  const ly = (v: number) => Math.log10(clamp(v));
  const lo = ly(LO);
  const hi = ly(HI);

  const x0 = pts[0]?.year ?? 0;
  const x1 = pts[pts.length - 1]?.year ?? 1;
  const span = x1 - x0 || 1;
  const px = (yr: number) => 1 + ((yr - x0) / span) * (width - 2);
  const py = (v: number) => height - 2 - ((ly(v) - lo) / (hi - lo)) * (height - 4);

  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${px(p.year).toFixed(1)},${py(p.c).toFixed(1)}`).join("");
  const last = pts[pts.length - 1];
  const parity = py(1);
  const above = (last?.c ?? 0) >= 1;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label={`Export-to-import ratio ${pts[0]?.c.toFixed(2)} in ${x0} to ${last?.c.toFixed(2)} in ${x1}`}>
      <line x1={0} y1={parity} x2={width} y2={parity} stroke="var(--baseline)" strokeWidth={1} strokeDasharray="2 2" />
      <path d={d} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
        stroke={above ? "var(--stage-reversed)" : "var(--stage-import-reliant)"} />
      <circle cx={px(last?.year ?? 0)} cy={py(last?.c ?? 0)} r={2.5}
        fill={above ? "var(--stage-reversed)" : "var(--stage-import-reliant)"}
        stroke="var(--surface-1)" strokeWidth={1.5} />
    </svg>
  );
}
