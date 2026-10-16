/**
 * Plain-language pieces for the ministries' "at a glance" sections: a card
 * that asks a reader's question and answers it in one number and one
 * sentence, and the simple charts those cards carry.
 *
 * Every number reaching these components has already been checked by its
 * loader. The sentences are written by code from those numbers — never typed
 * — so they cannot drift from the chart beside them.
 */
import type { ReactNode } from "react";

export interface YearPoint { x: number; v: number | null }

/** A question, its answer, the sentence that explains it, a picture, and who counted. */
export function Insight({ q, answer, unit, sentence, children, source, derived, wide }: {
  q: string; answer: string; unit?: string; sentence: ReactNode; children?: ReactNode; source: ReactNode; derived?: boolean; wide?: boolean;
}) {
  return (
    <figure className={`story-card min-w-0 p-4 sm:p-5 ${wide ? "lg:col-span-2" : ""}`}>
      <p className="text-[13.5px] font-semibold leading-snug" style={{ color: "var(--story-ink-2)" }}>{q}</p>
      <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
        <span className="story-display text-[34px] leading-none tabular-nums sm:text-[40px]">{answer}</span>
        {unit && <span className="text-[13px]" style={{ color: "var(--story-ink-3)" }}>{unit}</span>}
      </p>
      <p className="mt-2 max-w-[62ch] text-[13.5px] leading-[1.55]" style={{ color: "var(--story-ink)" }}>{sentence}</p>
      {children && <div className="mt-3">{children}</div>}
      <p className="mono mt-3 text-[10.5px] leading-[1.5]" style={{ color: "var(--story-ink-3)" }}>
        {derived && <span className="mr-1 rounded-[3px] border px-1" style={{ borderColor: "var(--story-rule)" }}>calculated here</span>}
        {source}
      </p>
    </figure>
  );
}

/**
 * One bar per year across an unbroken run of years. A year with no figure is
 * drawn as an empty slot marked "–", so a missing year is never closed up
 * into a false neighbour. Only the first, last and highest bars carry values.
 */
export function YearBars({ points, colour = "var(--series-1)", format = (v: number) => v.toLocaleString("en-IN"), height = 170, unit = "" }: {
  points: YearPoint[]; colour?: string; format?: (v: number) => string; height?: number; unit?: string;
}) {
  const vals = points.filter((p) => p.v != null) as Array<{ x: number; v: number }>;
  if (!vals.length) return null;
  const lo = Math.min(0, ...vals.map((p) => p.v)), hi = Math.max(0, ...vals.map((p) => p.v));
  const W = Math.max(320, points.length * 30), padT = 18, padB = 22;
  const ph = height - padT - padB;
  const sy = (v: number) => padT + ((hi - v) / (hi - lo || 1)) * ph;
  const step = W / points.length, col = Math.max(6, Math.min(26, step * 0.68));
  const peak = vals.reduce((a, b) => (Math.abs(b.v) > Math.abs(a.v) ? b : a));
  const show = new Set([vals[0]!.x, vals.at(-1)!.x, peak.x]);
  const every = Math.max(1, Math.ceil(points.length / 9));
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${height}`} style={{ width: "100%", minWidth: 300, height: "auto" }} role="img"
        aria-label={points.map((p) => `${p.x}: ${p.v == null ? "no figure" : format(p.v) + (unit ? " " + unit : "")}`).join("; ")}>
        <line x1={0} x2={W} y1={sy(0)} y2={sy(0)} stroke="var(--story-ink-3)" strokeWidth={1} />
        {points.map((p, i) => {
          const x = i * step + (step - col) / 2;
          if (p.v == null) return (
            <g key={p.x}>
              <text x={x + col / 2} y={sy(0) - 4} textAnchor="middle" fontSize="10" fill="var(--story-ink-3)">–</text>
              <title>{`${p.x}: no figure`}</title>
            </g>
          );
          const top = Math.min(sy(p.v), sy(0)), h = Math.max(1, Math.abs(sy(p.v) - sy(0)));
          const r = Math.min(4, col / 2, h);
          // Rounded at the data end only; square where the bar meets the baseline.
          const d = p.v >= 0
            ? `M${x},${top + h}V${top + r}Q${x},${top} ${x + r},${top}H${x + col - r}Q${x + col},${top} ${x + col},${top + r}V${top + h}Z`
            : `M${x},${top}V${top + h - r}Q${x},${top + h} ${x + r},${top + h}H${x + col - r}Q${x + col},${top + h} ${x + col},${top + h - r}V${top}Z`;
          return (
            <g key={p.x}>
              <path d={d} fill={colour}><title>{`${p.x}: ${format(p.v)}${unit ? " " + unit : ""}`}</title></path>
              {show.has(p.x) && (
                <text x={x + col / 2} y={p.v >= 0 ? top - 4 : top + h + 11} textAnchor="middle" fontSize="10" fontWeight={600} fill="var(--story-ink)">{format(p.v)}</text>
              )}
            </g>
          );
        })}
        {points.map((p, i) => (i % every === 0 || i === points.length - 1) && (
          <text key={`l${p.x}`} x={i * step + step / 2} y={height - 6} textAnchor="middle" fontSize="10" fill="var(--story-ink-3)">{p.x}</text>
        ))}
      </svg>
    </div>
  );
}

/** Two or more parts of one whole, as one bar, each part labelled with its share. */
export function Split({ parts }: { parts: Array<{ label: string; v: number; colour: string }> }) {
  const total = parts.reduce((a, p) => a + p.v, 0);
  return (
    <div>
      <div className="flex h-5 w-full overflow-hidden rounded-[4px]" style={{ gap: 2 }}>
        {parts.map((p) => <span key={p.label} title={`${p.label}: ${((p.v / total) * 100).toFixed(0)}%`} style={{ width: `${(p.v / total) * 100}%`, background: p.colour }} />)}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px]" style={{ color: "var(--story-ink-2)" }}>
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5">
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 2, background: p.colour }} />
            {p.label} · <b className="tabular-nums">{((p.v / total) * 100).toFixed(0)}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Labelled horizontal bars for a few categories with long names. */
export function Rows({ rows, colour = "var(--series-1)", format = (v: number) => v.toLocaleString("en-IN") }: {
  rows: Array<{ label: string; v: number; note?: string }>; colour?: string; format?: (v: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.v)));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,10rem)_1fr] items-center gap-2 text-[12px] sm:grid-cols-[minmax(0,13rem)_1fr]">
          <span className="truncate" title={r.note ?? r.label} style={{ color: "var(--story-ink-2)" }}>{r.label}</span>
          <span className="flex min-w-0 items-center gap-2">
            <span style={{ width: `${(Math.abs(r.v) / max) * 100}%`, minWidth: 2, height: 10, background: colour, borderRadius: "0 4px 4px 0" }} />
            <span className="mono shrink-0 text-[11px] font-semibold tabular-nums">{format(r.v)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A plain statement that a number does not exist, so its absence is read as a finding, not an oversight. */
export function NotPublished({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-dashed px-3 py-2 text-[12.5px] leading-[1.5]" style={{ borderColor: "var(--story-rule)", color: "var(--story-ink-2)" }}>
      {children}
    </p>
  );
}
