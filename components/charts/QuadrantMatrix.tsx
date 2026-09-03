"use client";

// A client component only so the hover card can live here: every other chart
// and map on the site answers a hover the same way, and the browser's native
// tooltip — delayed, unstyled, and impossible to place — is not that way.
import type { Placement, Quadrant } from "@/lib/quadrant";
import { QUADRANTS } from "@/lib/quadrant";
import { CATEGORY_LABELS } from "@/lib/types";
import HoverCard, { useHoverCard } from "./HoverCard";

/**
 * The development matrix: standing against momentum, as a labelled 2×2 scatter.
 *
 * ── Why only two colours ─────────────────────────────────────────────────
 *
 * Four quadrants suggests four hues. Four hues were tried and rejected: the
 * palette validator put the amber/red and green/amber pairs at ΔE 5–14 under
 * protanopia in dark mode, well under the floor, and no re-stepping fixed both
 * modes at once.
 *
 * Position already carries identity here. A point's quadrant is legible from
 * where it sits in a labelled grid, with no colour at all. So colour encodes
 * the one thing worth saying twice — which way the series is moving — as a
 * validated diverging pair. Blue gaining, orange losing, both passing all six
 * checks in light and dark against their own surfaces.
 *
 * Every quadrant is titled in its own cell, and a table view lists every
 * placement with its numbers, so identity is never colour alone and the
 * contrast warning on the light amber is discharged.
 */

const PAD = { top: 26, right: 30, bottom: 62, left: 58 };
const W = 760;
const H = 460;
/** Keeps a mark at ±1 fully inside the frame instead of half-clipped by it. */
const INSET = 9;

/** Validated in both modes — see the header comment before changing either. */
const GAINING_LIGHT = "#1d63a6";
const LOSING_LIGHT = "#c9402f";
const GAINING_DARK = "#5793e0";
const LOSING_DARK = "#e8604f";

function x(v: number, w: number) {
  const lo = PAD.left + INSET;
  const hi = w - PAD.right - INSET;
  return lo + ((v + 1) / 2) * (hi - lo);
}
function y(v: number, h: number) {
  const lo = PAD.top + INSET;
  const hi = h - PAD.bottom - INSET;
  return hi - ((v + 1) / 2) * (hi - lo);
}

export default function QuadrantMatrix({
  placed,
  highlight,
}: {
  placed: Placement[];
  /** Category to emphasise; everything else recedes rather than disappearing. */
  highlight?: string;
}) {
  const { hover, show, hide } = useHoverCard();
  const cx = x(0, W);
  const cy = y(0, H);

  return (
    <figure className="m-0">
      {/* The colour pair is defined once per mode here and referenced by the
          marks, so a mode switch cannot leave one mark on the wrong ramp. */}
      <style>{`
        .qm-gaining { fill: ${GAINING_LIGHT}; }
        .qm-losing  { fill: ${LOSING_LIGHT}; }
        @media (prefers-color-scheme: dark) {
          :root:not([data-theme="light"]) .qm-gaining { fill: ${GAINING_DARK}; }
          :root:not([data-theme="light"]) .qm-losing  { fill: ${LOSING_DARK}; }
        }
        :root[data-theme="dark"] .qm-gaining { fill: ${GAINING_DARK}; }
        :root[data-theme="dark"] .qm-losing  { fill: ${LOSING_DARK}; }
      `}</style>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label="Development matrix: standing against comparators on the horizontal axis, momentum over the period on the vertical axis"
          className="min-w-[560px]"
        >
          {/* Quadrant grounds, faint enough to stay behind the marks. */}
          {QUADRANTS.map((q) => {
            const left = q.standing === "behind";
            const top = q.momentum === "gaining";
            return (
              <g key={q.id}>
                <rect
                  x={left ? PAD.left : cx}
                  y={top ? PAD.top : cy}
                  width={(W - PAD.left - PAD.right) / 2}
                  height={(H - PAD.top - PAD.bottom) / 2}
                  fill={top ? "currentColor" : "none"}
                  opacity={top ? 0.02 : 0}
                />
                {/* Outside the frame entirely. Inside its own cell a label
                    still collided with a mark — the corners are not empty. */}
                <text
                  x={left ? PAD.left + 2 : W - PAD.right - 2}
                  y={top ? PAD.top - 8 : H - PAD.bottom + 16}
                  textAnchor={left ? "start" : "end"}
                  className="fill-[color:var(--text-muted)]"
                  fontSize="9.5"
                  letterSpacing="0.1em"
                >
                  {q.label.toUpperCase()}
                </text>
              </g>
            );
          })}

          {/* Axes through the origin — the quadrant boundaries are the story. */}
          <line x1={cx} y1={PAD.top} x2={cx} y2={H - PAD.bottom} className="stroke-[color:var(--baseline)]" strokeWidth="1" />
          <line x1={PAD.left} y1={cy} x2={W - PAD.right} y2={cy} className="stroke-[color:var(--baseline)]" strokeWidth="1" />
          <rect
            x={PAD.left}
            y={PAD.top}
            width={W - PAD.left - PAD.right}
            height={H - PAD.top - PAD.bottom}
            fill="none"
            className="stroke-[color:var(--gridline)]"
            strokeWidth="1"
          />

          {/* Axis ends, worded rather than numbered: the scale is a squashed
              ratio and a reader gains nothing from its decimals. */}
          <text x={PAD.left} y={H - 8} fontSize="10" className="fill-[color:var(--text-muted)]">
            ← behind comparators
          </text>
          <text x={W - PAD.right} y={H - 8} fontSize="10" textAnchor="end" className="fill-[color:var(--text-muted)]">
            ahead of comparators →
          </text>
          <text
            x={-(H / 2)}
            y={14}
            fontSize="10"
            transform="rotate(-90)"
            textAnchor="middle"
            className="fill-[color:var(--text-muted)]"
          >
            worsening ← momentum → improving
          </text>

          {/* Marks. A 2px surface ring keeps overlapping points readable, which
              matters here because the catching-up corner is crowded. */}
          {placed.map((p) => {
            const dim = highlight && p.category !== highlight;
            return (
              <circle
                key={p.seriesId}
                cx={x(p.standing, W)}
                cy={y(p.momentum, H)}
                r={dim ? 3.5 : 5}
                className={p.momentum >= 0 ? "qm-gaining" : "qm-losing"}
                opacity={dim ? 0.18 : 0.85}
                stroke="var(--plane)"
                strokeWidth="2"
                onMouseMove={(ev) =>
                  show(ev, {
                    title: p.title,
                    subtitle: CATEGORY_LABELS[p.category],
                    rows: [
                      { label: p.detail.firstPeriod, value: String(p.detail.first) },
                      { label: p.detail.latestPeriod, value: String(p.detail.latest) },
                      {
                        label: "change",
                        value: `${p.detail.changePercent > 0 ? "+" : ""}${p.detail.changePercent}%`,
                      },
                    ],
                    note: `Comparator median ${p.detail.peerMedian}, across ${p.detail.peerCount} countries.`,
                  })
                }
                onMouseLeave={hide}
              >
                {/* Kept for screen readers and touch, where there is no hover. */}
                <title>
                  {`${p.title}\n${CATEGORY_LABELS[p.category]}\n` +
                    `${p.detail.firstPeriod}: ${p.detail.first} → ${p.detail.latestPeriod}: ${p.detail.latest} ` +
                    `(${p.detail.changePercent > 0 ? "+" : ""}${p.detail.changePercent}%)\n` +
                    `comparator median: ${p.detail.peerMedian} across ${p.detail.peerCount} countries`}
                </title>
              </circle>
            );
          })}
        </svg>
      </div>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[color:var(--text-muted)]">
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden>
            <circle cx="5" cy="5" r="4" className="qm-gaining" />
          </svg>
          improving
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden>
            <circle cx="5" cy="5" r="4" className="qm-losing" />
          </svg>
          worsening
        </span>
        <span>{placed.length} series placed · hover a point for its numbers</span>
      </figcaption>
      <HoverCard hover={hover} />
    </figure>
  );
}

/** The same placements as a table, so nothing depends on reading a colour. */
export function QuadrantTable({ byQuadrant }: { byQuadrant: Record<Quadrant, Placement[]> }) {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      {QUADRANTS.map((q) => {
        const rows = byQuadrant[q.id];
        return (
          <section key={q.id} className="rounded-lg border p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-[13px] font-semibold tracking-tight">{q.label}</h3>
              <span className="tnum text-[11px] text-[color:var(--text-muted)]">{rows.length}</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-[color:var(--text-secondary)]">
              {q.meaning}
            </p>
            {rows.length === 0 ? (
              <p className="mt-3 text-[11px] text-[color:var(--text-muted)]">Nothing placed here.</p>
            ) : (
              <ul className="mt-3 space-y-1">
                {rows.slice(0, 12).map((p) => (
                  <li key={p.seriesId} className="flex items-baseline justify-between gap-3 text-[11px]">
                    <span className="text-[color:var(--text-secondary)]">{p.title}</span>
                    <span className="tnum shrink-0 text-[color:var(--text-muted)]">
                      {p.detail.changePercent > 0 ? "+" : ""}
                      {p.detail.changePercent}%
                    </span>
                  </li>
                ))}
                {rows.length > 12 && (
                  <li className="text-[11px] text-[color:var(--text-muted)]">
                    and {rows.length - 12} more
                  </li>
                )}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
