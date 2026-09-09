"use client";

import { useMemo } from "react";
import HoverCard, { useHoverCard } from "./HoverCard";

/**
 * Two dates, one line per measure, and the crossings are the subject.
 *
 * A pair of bar charts for "then" and "now" makes the reader hold eight
 * rankings in their head and diff them. A slope draws the diff: a line that
 * climbs past another line is a sector that overtook another sector, and that
 * crossing is the finding. It is the right form for exactly one question —
 * what moved between two points — and the wrong form for anything with a shape
 * in between, which is why the years in between are stated rather than drawn.
 *
 * ── Label collision ──────────────────────────────────────────────────────
 *
 * Eight labels down each edge will overlap wherever two values are close, and
 * overlapping labels are the failure mode this form is known for. Labels are
 * laid out with a minimum vertical gap, pushed apart in value order, and the
 * connector to each label's own value stays anchored to the true position —
 * so the text moves and the data does not.
 */

export interface SlopeRow {
  id: string;
  label: string;
  unitShort: string;
  from: { period: string; value: number };
  to: { period: string; value: number };
}

const W = 560;
const H = 380;
const PAD = { top: 26, bottom: 26, left: 168, right: 168 };
const MIN_GAP = 15;

/**
 * Push labels apart to a minimum spacing while keeping their order.
 *
 * One pass down and one pass up: the down pass guarantees the gap, the up pass
 * pulls the block back inside the box when the down pass has run it off the
 * bottom. Without the second pass a dense cluster near the floor walks the
 * last few labels outside the viewBox.
 */
function declutter(ys: number[], lo: number, hi: number): number[] {
  const out = [...ys];
  for (let i = 1; i < out.length; i++) {
    if (out[i]! - out[i - 1]! < MIN_GAP) out[i] = out[i - 1]! + MIN_GAP;
  }
  const overflow = out[out.length - 1]! - hi;
  if (overflow > 0) {
    for (let i = out.length - 1; i >= 0; i--) {
      out[i] = Math.min(out[i]!, hi - (out.length - 1 - i) * MIN_GAP);
      if (i > 0 && out[i]! - out[i - 1]! < MIN_GAP) out[i - 1] = out[i]! - MIN_GAP;
    }
  }
  return out.map((y) => Math.max(lo, y));
}

export default function SlopeChart({ rows }: { rows: SlopeRow[] }) {
  const card = useHoverCard();

  const model = useMemo(() => {
    const vals = rows.flatMap((r) => [r.from.value, r.to.value]);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const range = hi - lo || 1;
    const y = (v: number) => PAD.top + (1 - (v - lo) / range) * (H - PAD.top - PAD.bottom);

    // Labels are decluttered per side, in value order, so the pushing never
    // reorders them relative to the data.
    const left = [...rows].sort((a, b) => y(a.from.value) - y(b.from.value));
    const right = [...rows].sort((a, b) => y(a.to.value) - y(b.to.value));
    const leftY = declutter(left.map((r) => y(r.from.value)), PAD.top, H - PAD.bottom);
    const rightY = declutter(right.map((r) => y(r.to.value)), PAD.top, H - PAD.bottom);

    return {
      y,
      lo,
      hi,
      leftLabel: new Map(left.map((r, i) => [r.id, leftY[i]!])),
      rightLabel: new Map(right.map((r, i) => [r.id, rightY[i]!])),
    };
  }, [rows]);

  if (rows.length === 0) return null;
  const x0 = PAD.left;
  const x1 = W - PAD.right;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        /* No height attribute: with a viewBox and a fixed height,
           preserveAspectRatio letterboxes the drawing inside a wide box and
           the chart renders in the middle third of its container. */
        style={{ minWidth: 520, height: "auto" }}
        role="img"
        aria-label={`Slope chart, ${rows[0]!.from.period} to ${rows[0]!.to.period}, ${rows.length} measures.`}
      >
        {/* The two date axes. */}
        {[x0, x1].map((x, i) => (
          <line key={i} x1={x} x2={x} y1={PAD.top - 10} y2={H - PAD.bottom + 6}
            stroke="var(--gridline)" strokeWidth="1" />
        ))}
        <text x={x0} y={PAD.top - 16} textAnchor="middle"
          className="mono" fontSize="10" fill="var(--text-muted)">
          {rows[0]!.from.period}
        </text>
        <text x={x1} y={PAD.top - 16} textAnchor="middle"
          className="mono" fontSize="10" fill="var(--text-muted)">
          {rows[0]!.to.period}
        </text>

        {rows.map((r) => {
          const yFrom = model.y(r.from.value);
          const yTo = model.y(r.to.value);
          const up = r.to.value >= r.from.value;
          const colour = up ? "var(--series-1)" : "var(--series-2)";
          const lY = model.leftLabel.get(r.id)!;
          const rY = model.rightLabel.get(r.id)!;
          return (
            <g
              key={r.id}
              onMouseMove={(e) => card.show(e, {
                title: r.label,
                rows: [
                  { label: r.from.period, value: `${fmt(r.from.value)} ${r.unitShort}` },
                  { label: r.to.period, value: `${fmt(r.to.value)} ${r.unitShort}` },
                ],
                note: `${up ? "Up" : "Down"} ${fmt(Math.abs(r.to.value - r.from.value))} ${r.unitShort} between the two.`,
              })}
              onMouseLeave={card.hide}
              style={{ cursor: "default" }}
            >
              {/* A wide transparent stroke under the line gives the row a hit
                  target bigger than 2px without drawing anything. */}
              <line x1={x0} x2={x1} y1={yFrom} y2={yTo} stroke="transparent" strokeWidth="14" />
              <line x1={x0} x2={x1} y1={yFrom} y2={yTo} stroke={colour} strokeWidth="1.8" />
              <circle cx={x0} cy={yFrom} r="3" fill={colour} />
              <circle cx={x1} cy={yTo} r="3" fill={colour} />

              {/* Leaders from the true position to the decluttered label. */}
              <line x1={x0 - 4} x2={x0 - 12} y1={yFrom} y2={lY} stroke="var(--gridline)" strokeWidth="1" />
              <line x1={x1 + 4} x2={x1 + 12} y1={yTo} y2={rY} stroke="var(--gridline)" strokeWidth="1" />

              <text x={x0 - 15} y={lY + 3.5} textAnchor="end" fontSize="10.5" fill="var(--text-secondary)">
                {clip(r.label)}
              </text>
              <text x={x1 + 15} y={rY + 3.5} fontSize="10.5" fill="var(--text-secondary)">
                <tspan className="mono" fill="var(--text-primary)">{fmt(r.to.value)}</tspan>
                <tspan dx="5">{clip(r.label, 20)}</tspan>
              </text>
            </g>
          );
        })}
      </svg>
      <HoverCard hover={card.hover} />
    </div>
  );
}

function clip(s: string, n = 24): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function fmt(v: number): string {
  const a = Math.abs(v);
  if (a >= 1000) return v.toLocaleString("en", { maximumFractionDigits: 0 });
  if (a >= 10) return v.toFixed(1);
  return v.toFixed(2);
}
