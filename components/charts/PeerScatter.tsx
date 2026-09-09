"use client";

import { useMemo, useState } from "react";
import HoverCard, { useHoverCard } from "./HoverCard";

/**
 * Two measures against each other, six countries, India named.
 *
 * Every other cluster on this page ranks countries on one measure at a time.
 * That cannot answer whether two things travel together — whether deep bank
 * credit comes with liquid equity markets, or whether they are substitutes —
 * and a relationship is what a scatter is the only honest form for.
 *
 * Six points is a small scatter, and it is stated as such: with an n of six no
 * line is fitted and no correlation is quoted, because a coefficient on six
 * observations is a number that will move if one country revises. What the
 * chart supports is reading positions and naming outliers, which is what six
 * points can carry.
 *
 * Both axes are reader-chosen, because the interesting pairs are not knowable
 * in advance and picking two for them would be an argument disguised as a
 * default.
 */

export interface ScatterSeries {
  id: string;
  label: string;
  unitShort: string;
  /** Latest reading per country. */
  peers: Array<{ country: string; iso3: string; value: number; period: string }>;
}

const W = 620;
const H = 420;
const PAD = { top: 18, right: 22, bottom: 46, left: 62 };
const IND = "IND";

export default function PeerScatter({ series }: { series: ScatterSeries[] }) {
  const [xId, setXId] = useState(series[0]?.id ?? "");
  const [yId, setYId] = useState(series[1]?.id ?? series[0]?.id ?? "");
  const card = useHoverCard();

  const sx = series.find((s) => s.id === xId);
  const sy = series.find((s) => s.id === yId);

  const points = useMemo(() => {
    if (!sx || !sy) return [];
    const byIso = new Map(sy.peers.map((p) => [p.iso3, p]));
    return sx.peers
      .map((p) => {
        const q = byIso.get(p.iso3);
        return q ? { iso3: p.iso3, country: p.country, x: p.value, y: q.value, xp: p.period, yp: q.period } : null;
      })
      .filter((p) => p !== null);
  }, [sx, sy]);

  if (!sx || !sy) return null;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  // Padded to the data's own range rather than to zero: with six points on
  // measures that never approach zero, a zero baseline puts all six in one
  // corner and the relationship disappears.
  const pad = (lo: number, hi: number) => {
    const m = (hi - lo) * 0.12 || Math.abs(hi) * 0.12 || 1;
    return [lo - m, hi + m] as const;
  };
  const [xLo, xHi] = points.length ? pad(Math.min(...xs), Math.max(...xs)) : [0, 1];
  const [yLo, yHi] = points.length ? pad(Math.min(...ys), Math.max(...ys)) : [0, 1];
  const px = (v: number) => PAD.left + ((v - xLo) / (xHi - xLo || 1)) * (W - PAD.left - PAD.right);
  const py = (v: number) => H - PAD.bottom - ((v - yLo) / (yHi - yLo || 1)) * (H - PAD.top - PAD.bottom);

  const ticks = (lo: number, hi: number) => [lo, lo + (hi - lo) / 2, hi];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        {[
          { lbl: "Horizontal", val: xId, set: setXId },
          { lbl: "Vertical", val: yId, set: setYId },
        ].map((sel) => (
          <label key={sel.lbl} className="flex flex-col gap-1">
            <span className="eyebrow">{sel.lbl} axis</span>
            <select
              value={sel.val}
              onChange={(e) => sel.set(e.target.value)}
              className="max-w-[19rem] rounded border border-[color:var(--baseline)] bg-[var(--surface-1)] px-2 py-1.5 text-[12.5px]"
            >
              {series.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          /* See SlopeChart: a fixed height with a viewBox letterboxes. */
          style={{ minWidth: 480, height: "auto" }}
          role="img"
          aria-label={`${sy.label} against ${sx.label}, ${points.length} countries. ${points
            .map((p) => `${p.country}: ${fmt(p.x)} by ${fmt(p.y)}`)
            .join("; ")}.`}
        >
          {/* Grid first, so marks sit above it. */}
          {ticks(yLo, yHi).map((t) => (
            <g key={`y${t}`}>
              <line x1={PAD.left} x2={W - PAD.right} y1={py(t)} y2={py(t)}
                stroke="var(--gridline)" strokeWidth="1" />
              <text x={PAD.left - 8} y={py(t) + 3.5} textAnchor="end"
                className="mono" fontSize="9.5" fill="var(--text-muted)">{fmt(t)}</text>
            </g>
          ))}
          {ticks(xLo, xHi).map((t) => (
            <text key={`x${t}`} x={px(t)} y={H - PAD.bottom + 15} textAnchor="middle"
              className="mono" fontSize="9.5" fill="var(--text-muted)">{fmt(t)}</text>
          ))}

          <text x={(PAD.left + W - PAD.right) / 2} y={H - 8} textAnchor="middle"
            fontSize="10.5" fill="var(--text-secondary)">
            {withUnit(sx.label, sx.unitShort)}
          </text>
          <text transform={`translate(13 ${(PAD.top + H - PAD.bottom) / 2}) rotate(-90)`}
            textAnchor="middle" fontSize="10.5" fill="var(--text-secondary)">
            {withUnit(sy.label, sy.unitShort)}
          </text>

          {points.map((p) => {
            const isIndia = p.iso3 === IND;
            return (
              <g key={p.iso3}
                onMouseMove={(e) => card.show(e, {
                  title: p.country,
                  rows: [
                    { label: sx.label, value: `${fmt(p.x)} ${sx.unitShort} · ${p.xp}` },
                    { label: sy.label, value: `${fmt(p.y)} ${sy.unitShort} · ${p.yp}` },
                  ],
                  note: p.xp !== p.yp ? "The two readings are from different years." : undefined,
                })}
                onMouseLeave={card.hide}
                style={{ cursor: "default" }}
              >
                <circle cx={px(p.x)} cy={py(p.y)} r="13" fill="transparent" />
                <circle
                  cx={px(p.x)} cy={py(p.y)} r={isIndia ? 7 : 5}
                  fill={isIndia ? "var(--series-1)" : "var(--text-muted)"}
                  stroke="var(--surface-1)" strokeWidth="2"
                />
                {/* Every point is named, so identity never rests on colour. */}
                <text
                  x={px(p.x)} y={py(p.y) - (isIndia ? 12 : 10)}
                  textAnchor="middle" fontSize="10"
                  fontWeight={isIndia ? 600 : 400}
                  fill={isIndia ? "var(--text-primary)" : "var(--text-secondary)"}
                >
                  {p.country}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <p className="mt-2 text-[11.5px] leading-relaxed text-[color:var(--text-muted)]">
        Six countries, one reading each. No line is fitted and no correlation is quoted — a
        coefficient on six observations moves when one country revises. Axes are scaled to the
        six values, not to zero.
      </p>
      <HoverCard hover={card.hover} />
    </div>
  );
}

/** The unit, unless the title already says it. */
function withUnit(label: string, unit: string): string {
  if (!unit) return label;
  const bare = unit.replace(/[()]/g, "").trim();
  return label.toLowerCase().includes(bare.toLowerCase()) ? label : `${label} (${unit})`;
}

function fmt(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e12) return `${(v / 1e12).toFixed(1)}T`;
  if (a >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (a >= 1000) return `${(v / 1000).toFixed(1)}k`;
  if (a >= 10) return v.toFixed(0);
  return v.toFixed(1);
}
