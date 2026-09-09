"use client";

import { useMemo } from "react";
import HoverCard, { useHoverCard } from "./HoverCard";

/**
 * Small multiples: many series at once, on one shape.
 *
 * The form exists for the case where a reader wants to compare *turning
 * points* across a family of related measures — did lending rates fall when
 * inflation did, did credit keep growing through it — and where drawing ten
 * full charts would put nine of them off the screen. Every cell shares the
 * same year span and the same height, so a shape in one cell means the same
 * thing as the same shape in another.
 *
 * ── What is deliberately not shared ─────────────────────────────────────
 *
 * The vertical scale. These ten series are in percent, index points and
 * ratios; forcing them onto one y-axis would flatten nine of them to a line
 * at the bottom. Each cell is scaled to its own range, which is the standard
 * compromise for small multiples and is a real limitation: the reader can
 * compare *when* two series moved, not *how much*. Each cell prints its own
 * high and low so the range is never a guess.
 */

export interface Spark {
  id: string;
  label: string;
  unitShort: string;
  /** Ascending by period. */
  data: Array<{ period: string; value: number }>;
}

const W = 150;
const H = 40;
const PAD = 3;

export default function SparkGrid({ items }: { items: Spark[] }) {
  const card = useHoverCard();

  // One year span for every cell, so the horizontal position of a turning
  // point means the same thing in each. A cell that starts later simply
  // starts later along the axis rather than being stretched to fill it.
  const span = useMemo(() => {
    const years = items.flatMap((s) =>
      s.data.map((d) => Number(d.period.match(/(19|20)\d{2}/)?.[0] ?? NaN)),
    ).filter(Number.isFinite);
    return years.length > 0
      ? { lo: Math.min(...years), hi: Math.max(...years) }
      : { lo: 2001, hi: 2025 };
  }, [items]);

  return (
    <div>
      <div className="grid gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((s) => {
          const pts = s.data
            .map((d) => ({ y: Number(d.period.match(/(19|20)\d{2}/)?.[0] ?? NaN), v: d.value, p: d.period }))
            .filter((d) => Number.isFinite(d.y));
          if (pts.length < 2) return null;

          const lo = Math.min(...pts.map((d) => d.v));
          const hi = Math.max(...pts.map((d) => d.v));
          const range = hi - lo || 1;
          const px = (y: number) =>
            PAD + ((y - span.lo) / Math.max(1, span.hi - span.lo)) * (W - 2 * PAD);
          const py = (v: number) => H - PAD - ((v - lo) / range) * (H - 2 * PAD);

          const d = pts.map((p, i) => `${i ? "L" : "M"}${px(p.y).toFixed(1)} ${py(p.v).toFixed(1)}`).join(" ");
          const last = pts[pts.length - 1]!;
          const first = pts[0]!;
          // Direction against the series' own first reading. Colour is never
          // the only carrier — the value and both endpoints are printed.
          const rising = last.v >= first.v;

          return (
            <figure key={s.id} className="m-0 min-w-0">
              <figcaption className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[12.5px] font-medium" title={s.label}>
                  {s.label}
                </span>
                <span className="mono shrink-0 text-[12px] tabular-nums">
                  {formatShort(last.v)}
                  <span className="ml-1 text-[10px] text-[color:var(--text-muted)]">
                    {s.unitShort}
                  </span>
                </span>
              </figcaption>

              <svg
                viewBox={`0 0 ${W} ${H}`}
                width="100%"
                height={H}
                className="mt-1.5 block overflow-visible"
                role="img"
                aria-label={`${s.label}: ${formatShort(first.v)} in ${first.p}, ${formatShort(last.v)} in ${last.p}.`}
                onMouseMove={(e) => {
                  // Nearest reading to the pointer along the shared year axis.
                  const box = e.currentTarget.getBoundingClientRect();
                  const frac = (e.clientX - box.left) / box.width;
                  const year = span.lo + frac * (span.hi - span.lo);
                  const near = pts.reduce((a, b) =>
                    Math.abs(b.y - year) < Math.abs(a.y - year) ? b : a);
                  card.show(e, {
                    title: s.label,
                    subtitle: near.p,
                    rows: [{ label: "Value", value: `${formatShort(near.v)} ${s.unitShort}` }],
                    note: `Range ${formatShort(lo)} to ${formatShort(hi)} across ${first.p}–${last.p}.`,
                  });
                }}
                onMouseLeave={card.hide}
              >
                <line
                  x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD}
                  stroke="var(--gridline)" strokeWidth="1"
                />
                <path
                  d={d}
                  fill="none"
                  stroke={rising ? "var(--series-1)" : "var(--series-2)"}
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <circle
                  cx={px(last.y)} cy={py(last.v)} r="2.4"
                  fill={rising ? "var(--series-1)" : "var(--series-2)"}
                />
              </svg>

              <p className="mono mt-1 flex justify-between text-[9.5px] tabular-nums text-[color:var(--text-muted)]">
                <span>{first.p} · {formatShort(first.v)}</span>
                <span>{last.p}</span>
              </p>
            </figure>
          );
        })}
      </div>
      <HoverCard hover={card.hover} />
    </div>
  );
}

/** Enough digits to distinguish, few enough to fit a 150px cell. */
function formatShort(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e12) return `${(v / 1e12).toFixed(1)}T`;
  if (a >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (a >= 1000) return `${(v / 1000).toFixed(1)}k`;
  if (a >= 100) return v.toFixed(0);
  if (a >= 10) return v.toFixed(1);
  return v.toFixed(2);
}
