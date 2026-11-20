/**
 * Interrupted time-series ("segmented") regression, for asking whether an
 * annual series changed course at a break year. No node imports.
 *
 *   y_t = b0 + b1·(t − B) + b2·D_t + b3·D_t·(t − B) + e_t,   D_t = 1 if t ≥ B
 *
 * b1 is the trend before the break, b1 + b3 the trend after, b2 the jump in
 * level at the break, and b3 — the change in trend — is the number the
 * verdict rests on. A series that grows in proportion (dollars, counts) is
 * fitted on its logarithm, so its trends read as % a year.
 *
 * The error bars. Annual economic series are autocorrelated, so ordinary
 * least-squares intervals are too narrow. The usual fix, Newey–West errors,
 * was tried first and measured by simulation on this very design (22 years,
 * break at 2014): its "95%" intervals held the truth only 84% of the time
 * with no autocorrelation at all, and 64% at ρ = 0.6. Prais–Winsten did
 * little better. So the intervals here are calibrated by simulation instead:
 *
 *   1. Fit by OLS and take the lag-1 autocorrelation ρ̂ of the residuals.
 *   2. ρ̂ from twenty-odd residuals is badly biased toward zero (a true 0.9
 *      typically reads as 0.25). Following Andrews' median-unbiased idea, but
 *      leaning cautious, pick the AR(1) ρ under which the observed ρ̂ would
 *      sit at the 20th percentile of its own simulated distribution.
 *   3. Simulate AR(1) noise with that ρ on the series' own years, refit each
 *      draw, and take the 95th percentile of |t| as the critical value.
 *
 * Measured the same way, these intervals cover 94–98% for ρ up to 0.8 and
 * about 90% at 0.9. Above that, twenty-two years cannot tell a persistent
 * wander from a change of trend, and no method here pretends otherwise. The
 * simulation is seeded, so the same data always gives the same answer.
 */

export interface ItsFit {
  n: number;
  /** b0…b3 as above. */
  coef: [number, number, number, number];
  /** Plain OLS standard errors; the intervals use them with a simulated critical value. */
  se: [number, number, number, number];
  /** Trend before and after the break, in the series' own units a year (or % a year on the log scale). */
  before: number;
  after: number;
  /** Change in trend, with a 95% interval. */
  change: number;
  ci: [number, number];
  /** Jump in level at the break year. */
  jump: number;
  jumpCi: [number, number];
  r2: number;
  /** Residual autocorrelation as measured, and the cautious ρ the intervals were calibrated at. */
  rhoHat: number;
  rho: number;
  /** The simulated critical value of |t| for the change in trend (1.96–2.1 would be the textbook figure). */
  crit: number;
  fitted: Array<{ year: number; y: number }>;
}

function invert(m: number[][]): number[][] | null {
  const n = m.length;
  const a = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r]![c]!) > Math.abs(a[p]![c]!)) p = r;
    if (Math.abs(a[p]![c]!) < 1e-12) return null;
    [a[c], a[p]] = [a[p]!, a[c]!];
    const d = a[c]![c]!;
    for (let k = 0; k < 2 * n; k++) a[c]![k]! /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const f = a[r]![c]!; for (let k = 0; k < 2 * n; k++) a[r]![k]! -= f * a[c]![k]!; }
  }
  return a.map((row) => row.slice(n));
}

interface Design { X: number[][]; inv: number[][] }

function design(years: number[], breakYear: number): Design | null {
  const X = years.map((yr) => { const t = yr - breakYear, d = yr >= breakYear ? 1 : 0; return [1, t, d, d * t]; });
  const inv = invert([0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => X.reduce((s, r) => s + r[i]! * r[j]!, 0))));
  return inv ? { X, inv } : null;
}

function ols({ X, inv }: Design, y: number[]) {
  const n = y.length;
  const Xty = [0, 1, 2, 3].map((i) => X.reduce((s, r, t) => s + r[i]! * y[t]!, 0));
  const b = inv.map((row) => row.reduce((s, v, j) => s + v * Xty[j]!, 0)) as [number, number, number, number];
  const e = X.map((r, t) => y[t]! - r.reduce((s, v, j) => s + v * b[j]!, 0));
  const ee = e.reduce((s, v) => s + v * v, 0);
  const s2 = ee / (n - 4);
  const se = [0, 1, 2, 3].map((i) => Math.sqrt(Math.max(0, s2 * inv[i]![i]!))) as [number, number, number, number];
  const rho = ee > 1e-300 ? e.slice(1).reduce((s, v, i) => s + v * e[i]!, 0) / ee : 0;
  return { b, e, se, rho };
}

/** A small seeded generator, so the simulated critical values are the same on every build. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  const u = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s + 0.5) / 4294967296; };
  return () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
}

const GRID = Array.from({ length: 20 }, (_, i) => i * 0.05); // ρ = 0 … 0.95
const DRAWS = 1000;
/** How cautious the ρ choice is: the observed ρ̂ is placed at this quantile of its simulated spread. */
export const RHO_QUANTILE = 0.2;

interface Row { rho: number; rhoQ: number; crit3: number; crit2: number }
const tables = new Map<string, Row[]>();

/** For each ρ on the grid: where ρ̂ tends to land, and the 95th percentile of |t| for the jump and the trend change. */
function table(years: number[], breakYear: number, d: Design): Row[] {
  const key = `${breakYear}:${years.join(",")}`;
  const hit = tables.get(key);
  if (hit) return hit;
  const rows = GRID.map((rho, gi) => {
    const g = rng(1 + gi * 7919 + years.length * 104729);
    const rh: number[] = [], t2: number[] = [], t3: number[] = [];
    for (let k = 0; k < DRAWS; k++) {
      let e = g();
      const y = years.map((_, i) => (i === 0 ? e : (e = rho * e + Math.sqrt(1 - rho * rho) * g())));
      const f = ols(d, y);
      rh.push(f.rho); t2.push(Math.abs(f.b[2] / f.se[2])); t3.push(Math.abs(f.b[3] / f.se[3]));
    }
    const q = (xs: number[], p: number) => xs.sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))]!;
    return { rho, rhoQ: q(rh, RHO_QUANTILE), crit2: q(t2, 0.95), crit3: q(t3, 0.95) };
  });
  // Critical values should not fall as ρ rises; smooth out simulation noise.
  for (let i = 1; i < rows.length; i++) { rows[i]!.crit2 = Math.max(rows[i]!.crit2, rows[i - 1]!.crit2); rows[i]!.crit3 = Math.max(rows[i]!.crit3, rows[i - 1]!.crit3); }
  tables.set(key, rows);
  return rows;
}

/**
 * Fit the segmented regression. `log` fits ln(y) and reports trends as % a
 * year. Returns null with fewer than three points on either side of the break
 * or when a log fit meets a non-positive value.
 */
export function its(points: Array<{ year: number; v: number }>, breakYear: number, opts: { log?: boolean } = {}): ItsFit | null {
  const pts = points.filter((p) => Number.isFinite(p.v) && (!opts.log || p.v > 0)).sort((a, b) => a.year - b.year);
  if (opts.log && pts.length !== points.filter((p) => Number.isFinite(p.v)).length) return null;
  const pre = pts.filter((p) => p.year < breakYear).length, post = pts.length - pre;
  if (pre < 3 || post < 3) return null;
  const years = pts.map((p) => p.year);
  const d = design(years, breakYear);
  if (!d) return null;
  const y = pts.map((p) => (opts.log ? Math.log(p.v) : p.v));
  const { b, e, se, rho: rhoHat } = ols(d, y);
  const rows = table(years, breakYear, d);
  const row = rows.find((r) => r.rhoQ >= rhoHat) ?? rows[rows.length - 1]!;
  const n = pts.length;
  const ybar = y.reduce((s, v) => s + v, 0) / n;
  const r2 = 1 - e.reduce((s, v) => s + v * v, 0) / y.reduce((s, v) => s + (v - ybar) ** 2, 0);
  // On the log scale, report trends and the level jump as percentages.
  const pc = (x: number) => (opts.log ? (Math.exp(x) - 1) * 100 : x);
  const fitted = pts.map((p, t) => ({ year: p.year, y: opts.log ? Math.exp(y[t]! - e[t]!) : y[t]! - e[t]! }));
  const w3 = row.crit3 * se[3], w2 = row.crit2 * se[2];
  return {
    n, coef: b, se, r2, rhoHat, rho: row.rho, crit: row.crit3,
    before: pc(b[1]), after: pc(b[1] + b[3]),
    change: opts.log ? pc(b[1] + b[3]) - pc(b[1]) : b[3],
    // The interval on the change is computed on the model's own scale, then mapped, so its ends stay ordered.
    ci: opts.log ? [pc(b[1] + b[3] - w3) - pc(b[1]), pc(b[1] + b[3] + w3) - pc(b[1])] : [b[3] - w3, b[3] + w3],
    jump: pc(b[2]), jumpCi: [pc(b[2] - w2), pc(b[2] + w2)],
    fitted,
  };
}
