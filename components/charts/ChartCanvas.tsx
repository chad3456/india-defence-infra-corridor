"use client";

import { useMemo, useState, useId } from "react";
import { scaleLinear, scaleBand, scalePoint } from "d3-scale";
import { line as d3line, area as d3area, curveMonotoneX, curveStepAfter } from "d3-shape";
import type { ChartKind } from "@/lib/types";
import { formatAxis, formatNumber } from "@/lib/transforms";
import HoverCard, { useHoverCard } from "./HoverCard";

export interface SeriesInput {
  id: string;
  label: string;
  unitShort: string;
  data: Array<{ period: string; value: number; note?: string; revised?: boolean }>;
}

interface Props {
  kind: ChartKind;
  series: SeriesInput[];
  height?: number;
  /** Unit override for derived views (e.g. "%" for year-on-year). */
  unitOverride?: string | null;
  /** Draw a zero line — used for change/diverging charts. */
  zeroLine?: boolean;
}

const SERIES_VARS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];
const MARGIN = { top: 16, right: 18, bottom: 30, left: 46 };
const MAX_BAR = 24;

/** First 4-digit year in a period label, or null if the label is not temporal. */
function periodYearOf(period: string): number | null {
  const m = period.match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : null;
}

/** Compress a long period label for the axis: "FY2024-25" -> "FY25", "2024" -> "'24". */
function shortPeriod(p: string): string {
  const fy = p.match(/^FY(\d{4})-(\d{2})/);
  if (fy) return `FY${fy[2]}`;
  const range = p.match(/^(\d{4})-(\d{4})$/);
  if (range) return `${range[1]!.slice(2)}–${range[2]!.slice(2)}`;
  const yr = p.match(/^(\d{4})$/);
  if (yr) return `'${yr[1]!.slice(2)}`;
  return p.length > 12 ? p.slice(0, 11) + "…" : p;
}

export default function ChartCanvas({
  kind,
  series,
  height = 240,
  unitOverride,
  zeroLine = false,
}: Props) {
  // The crosshair needs the hovered index; the card needs client coordinates.
  // They are tracked separately because the card lives on a fixed layer above
  // the page, not inside this component's box.
  const [hover, setHover] = useState<{ i: number } | null>(null);
  const { hover: card, show, hide } = useHoverCard();
  const [showTable, setShowTable] = useState(false);
  const clipId = useId().replace(/:/g, "");

  const width = 560; // viewBox width; SVG scales responsively

  /**
   * Union of periods across series.
   *
   * Multi-series charts routinely combine series with different coverage, so
   * the union must be ordered by time rather than by first appearance —
   * otherwise a series that starts later pushes its periods to the end of the
   * axis and the chart silently misstates the sequence. Non-temporal labels
   * (state names, vehicle families) keep their authored order.
   */
  const periods = useMemo(() => {
    const out: string[] = [];
    for (const s of series) for (const d of s.data) if (!out.includes(d.period)) out.push(d.period);

    const years = out.map(periodYearOf);
    const allTemporal = years.every((y) => y !== null);
    if (!allTemporal) return out;

    return [...out].sort((a, b) => (periodYearOf(a) ?? 0) - (periodYearOf(b) ?? 0));
  }, [series]);

  const values = useMemo(
    () => series.flatMap((s) => s.data.map((d) => d.value)).filter((v) => Number.isFinite(v)),
    [series],
  );

  const isBandKind =
    kind === "column" || kind === "bar" || kind === "stacked-bar" || kind === "grouped-bar";
  const isHorizontal = kind === "bar" || kind === "lollipop" || kind === "dumbbell";

  /**
   * Horizontal charts put category names on the y-axis, and those run long
   * ("Uttar Pradesh", "Telecom / computer / information"). A fixed left margin
   * clipped them mid-word. Size the gutter to the longest label instead — a
   * label that will not fit is never silently cropped.
   */
  const margin = useMemo(() => {
    if (!isHorizontal) return MARGIN;
    const longest = periods.reduce((n, p) => Math.max(n, p.length), 0);
    // ~4.6px per character at 9px type, clamped so the plot keeps its room.
    const gutter = Math.min(150, Math.max(46, Math.round(longest * 4.6) + 14));
    return { ...MARGIN, left: gutter };
  }, [isHorizontal, periods]);

  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const unit = unitOverride ?? series[0]?.unitShort ?? "";

  const { yMin, yMax } = useMemo(() => {
    if (values.length === 0) return { yMin: 0, yMax: 1 };
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    if (kind === "stacked-bar") {
      // Stacks sum per period.
      const sums = periods.map((p) =>
        series.reduce((n, s) => n + (s.data.find((d) => d.period === p)?.value ?? 0), 0),
      );
      hi = Math.max(hi, ...sums);
    }
    const hasNeg = lo < 0;
    if (!hasNeg) lo = 0;
    if (hi === lo) hi = lo + 1;
    const pad = (hi - lo) * 0.08;
    return { yMin: hasNeg ? lo - pad : 0, yMax: hi + pad };
  }, [values, kind, periods, series]);

  if (values.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-[11px] mono text-[color:var(--text-muted)] border border-dashed rounded"
        style={{ height }}
      >
        awaiting data
      </div>
    );
  }

  /* ----------------------------- scales ----------------------------- */

  const yScale = scaleLinear().domain([yMin, yMax]).range([innerH, 0]).nice(4);
  const catScale = scaleBand<string>().domain(periods).range([0, innerH]).padding(0.28);
  const bandScale = scaleBand<string>().domain(periods).range([0, innerW]).padding(0.28);
  const pointScale = scalePoint<string>().domain(periods).range([0, innerW]).padding(0.5);
  const xScale = scaleLinear().domain([yMin, yMax]).range([0, innerW]).nice(4);

  const yTicks = yScale.ticks(4);
  const xTicks = xScale.ticks(4);

  const colorOf = (i: number) => SERIES_VARS[i % SERIES_VARS.length]!;

  /* --------------------------- interaction -------------------------- */

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width - margin.left;
    const relY = ((e.clientY - rect.top) / rect.height) * height - margin.top;
    if (periods.length === 0) return;

    let idx: number;
    if (isHorizontal) {
      idx = Math.max(
        0,
        Math.min(periods.length - 1, Math.floor(relY / (innerH / periods.length))),
      );
    } else {
      idx = Math.max(
        0,
        Math.min(periods.length - 1, Math.round((relX / innerW) * (periods.length - 1))),
      );
    }
    setHover({ i: idx });
    const period = periods[idx];
    if (period === undefined) return;
    const rows = rowsFor(period);
    if (rows.length === 0) { hide(); return; }
    show(e, {
      title: period,
      rows: rows.map((r) => ({ label: r.label, value: formatNumber(r.d!.value, unit), colour: r.color })),
      note: noteFor(rows),
    });
  }

  function onLeave() {
    setHover(null);
    hide();
  }

  /** The series that actually carry a reading at this period, in series order. */
  function rowsFor(period: string) {
    return series
      .map((sr, i) => ({ label: sr.label, color: colorOf(i), d: sr.data.find((x) => x.period === period) }))
      .filter((r) => r.d);
  }

  /**
   * A revision is a caveat about the number, so it travels with it. Where a
   * point carries its own note that is more specific, and wins the line.
   */
  function noteFor(rows: ReturnType<typeof rowsFor>): string | undefined {
    const own = rows.find((r) => r.d?.note)?.d?.note;
    const revised = rows.some((r) => r.d?.revised) ? "Revised figure." : undefined;
    return [revised, own].filter(Boolean).join(" ") || undefined;
  }

  const hoveredPeriod = hover ? periods[hover.i] : null;

  /* ----------------------------- marks ------------------------------ */

  function renderMarks() {
    const out: React.ReactNode[] = [];

    series.forEach((s, si) => {
      const color = colorOf(si);
      const pts = periods
        .map((p) => {
          const d = s.data.find((x) => x.period === p);
          return d ? { period: p, value: d.value } : null;
        })
        .filter((d): d is { period: string; value: number } => d !== null);

      if (pts.length === 0) return;

      /* ---- line-family ---- */
      if (kind === "line" || kind === "step" || kind === "area" || kind === "stacked-area") {
        const curve = kind === "step" ? curveStepAfter : curveMonotoneX;
        const lx = (d: { period: string }) => pointScale(d.period) ?? 0;
        const ly = (d: { value: number }) => yScale(d.value);

        if (kind === "area" || kind === "stacked-area") {
          const areaGen = d3area<{ period: string; value: number }>()
            .x(lx)
            .y0(yScale(Math.max(0, yMin)))
            .y1(ly)
            .curve(curve);
          out.push(
            <path key={`a-${s.id}`} d={areaGen(pts) ?? ""} fill={color} opacity={0.1} />,
          );
        }

        const lineGen = d3line<{ period: string; value: number }>().x(lx).y(ly).curve(curve);
        out.push(
          <path
            key={`l-${s.id}`}
            d={lineGen(pts) ?? ""}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />,
        );

        // End marker with a 2px surface ring, plus a direct end-label.
        const last = pts[pts.length - 1]!;
        out.push(
          <circle
            key={`e-${s.id}`}
            cx={lx(last)}
            cy={ly(last)}
            r={4}
            fill={color}
            stroke="var(--surface-1)"
            strokeWidth={2}
          />,
        );
        return;
      }

      /* ---- column ---- */
      if (kind === "column") {
        const bw = Math.min(MAX_BAR, bandScale.bandwidth());
        pts.forEach((d) => {
          const x = (bandScale(d.period) ?? 0) + (bandScale.bandwidth() - bw) / 2;
          const y0 = yScale(Math.max(0, yMin));
          const y = yScale(d.value);
          const h = Math.abs(y - y0);
          const neg = d.value < 0;
          out.push(
            <rect
              key={`c-${s.id}-${d.period}`}
              x={x}
              y={neg ? y0 : y}
              width={bw}
              height={Math.max(1, h)}
              fill={color}
              rx={4}
              ry={4}
            />,
          );
          // Square off the baseline end so growth reads from a single baseline.
          out.push(
            <rect
              key={`cs-${s.id}-${d.period}`}
              x={x}
              y={neg ? y0 : Math.max(y, y0 - Math.max(1, h) + 4)}
              width={bw}
              height={4}
              fill={color}
            />,
          );
        });
        return;
      }

      /* ---- grouped column ---- */
      if (kind === "grouped-bar") {
        const inner = scaleBand<string>()
          .domain(series.map((x) => x.id))
          .range([0, bandScale.bandwidth()])
          .padding(0.12);
        const bw = Math.min(MAX_BAR, inner.bandwidth());
        pts.forEach((d) => {
          const x = (bandScale(d.period) ?? 0) + (inner(s.id) ?? 0) + (inner.bandwidth() - bw) / 2;
          const y0 = yScale(Math.max(0, yMin));
          const y = yScale(d.value);
          out.push(
            <rect
              key={`g-${s.id}-${d.period}`}
              x={x}
              y={Math.min(y, y0)}
              width={bw}
              height={Math.max(1, Math.abs(y - y0))}
              fill={color}
              rx={4}
              ry={4}
            />,
          );
        });
        return;
      }

      /* ---- stacked column (2px surface gap between segments) ---- */
      if (kind === "stacked-bar") {
        const bw = Math.min(MAX_BAR * 1.4, bandScale.bandwidth());
        pts.forEach((d) => {
          const below = series
            .slice(0, si)
            .reduce((n, o) => n + (o.data.find((x) => x.period === d.period)?.value ?? 0), 0);
          const x = (bandScale(d.period) ?? 0) + (bandScale.bandwidth() - bw) / 2;
          const yTop = yScale(below + d.value);
          const yBot = yScale(below);
          const h = Math.max(1, yBot - yTop - 2); // 2px surface gap
          out.push(
            <rect
              key={`s-${s.id}-${d.period}`}
              x={x}
              y={yTop}
              width={bw}
              height={h}
              fill={color}
              rx={si === series.length - 1 ? 4 : 0}
            />,
          );
        });
        return;
      }

      /* ---- horizontal bar ---- */
      if (kind === "bar") {
        const bh = Math.min(MAX_BAR, catScale.bandwidth());
        pts.forEach((d) => {
          const y = (catScale(d.period) ?? 0) + (catScale.bandwidth() - bh) / 2;
          const x0 = xScale(Math.max(0, yMin));
          const x = xScale(d.value);
          out.push(
            <rect
              key={`b-${s.id}-${d.period}`}
              x={Math.min(x, x0)}
              y={y}
              width={Math.max(1, Math.abs(x - x0))}
              height={bh}
              fill={color}
              rx={4}
              ry={4}
            />,
          );
        });
        return;
      }

      /* ---- lollipop ---- */
      if (kind === "lollipop") {
        pts.forEach((d) => {
          const y = (catScale(d.period) ?? 0) + catScale.bandwidth() / 2;
          const x0 = xScale(Math.max(0, yMin));
          const x = xScale(d.value);
          out.push(
            <line
              key={`ll-${s.id}-${d.period}`}
              x1={x0}
              y1={y}
              x2={x}
              y2={y}
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
            />,
          );
          out.push(
            <circle
              key={`lc-${s.id}-${d.period}`}
              cx={x}
              cy={y}
              r={4.5}
              fill={color}
              stroke="var(--surface-1)"
              strokeWidth={2}
            />,
          );
        });
        return;
      }
    });

    /* ---- dumbbell: pairs the first two series per category ---- */
    if (kind === "dumbbell") {
      periods.forEach((p) => {
        const a = series[0]?.data.find((d) => d.period === p);
        const b = series[1]?.data.find((d) => d.period === p);
        const y = (catScale(p) ?? 0) + catScale.bandwidth() / 2;
        if (a && b) {
          out.push(
            <line
              key={`db-${p}`}
              x1={xScale(a.value)}
              y1={y}
              x2={xScale(b.value)}
              y2={y}
              stroke="var(--baseline)"
              strokeWidth={2}
              strokeLinecap="round"
            />,
          );
        }
        [a, b].forEach((d, di) => {
          if (!d) return;
          out.push(
            <circle
              key={`dc-${p}-${di}`}
              cx={xScale(d.value)}
              cy={y}
              r={4.5}
              fill={colorOf(di)}
              stroke="var(--surface-1)"
              strokeWidth={2}
            />,
          );
        });
      });
    }

    return out;
  }

  /* -------------------- direct labels (selective) -------------------- */

  function renderDirectLabels() {
    const out: React.ReactNode[] = [];
    // Label only the endpoint of each series on line-family charts, and the
    // extreme on bar-family charts. Never a value on every point.
    if (kind === "line" || kind === "step" || kind === "area" || kind === "stacked-area") {
      series.forEach((s, si) => {
        const pts = periods
          .map((p) => s.data.find((x) => x.period === p))
          .filter((d): d is NonNullable<typeof d> => Boolean(d));
        const last = pts[pts.length - 1];
        if (!last) return;
        const x = pointScale(last.period) ?? 0;
        const y = yScale(last.value);
        const anchor = x > innerW - 60 ? "end" : "start";
        // Where series converge at the right edge their end-labels overlap.
        // Push each series' label to its own band rather than letting them
        // collide — stacking them onto one another is worse than no label.
        const collides = series.length > 1;
        out.push(
          <text
            key={`dl-${s.id}`}
            x={anchor === "end" ? x - 8 : x + 8}
            y={collides ? y - 9 + si * 12 : y - 8}
            textAnchor={anchor}
            className="tnum"
            fontSize={10}
            fill="var(--text-secondary)"
          >
            {formatAxis(last.value)}
          </text>,
        );
      });
      return out;
    }

    if (kind === "bar" || kind === "lollipop") {
      const s = series[0];
      if (!s) return out;
      s.data.forEach((d) => {
        const y = (catScale(d.period) ?? 0) + catScale.bandwidth() / 2;
        out.push(
          <text
            key={`dlb-${d.period}`}
            x={xScale(d.value) + 9}
            y={y + 3.5}
            className="tnum"
            fontSize={10}
            fill="var(--text-secondary)"
          >
            {formatAxis(d.value)}
          </text>,
        );
      });
    }
    return out;
  }

  /* ------------------------------ render ---------------------------- */

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto touch-none"
        role="img"
        aria-label={series.map((s) => s.label).join(", ")}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={innerW} height={innerH} />
          </clipPath>
        </defs>

        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* gridlines — hairline, solid, recessive */}
          {isHorizontal
            ? xTicks.map((t) => (
                <line
                  key={`gx-${t}`}
                  x1={xScale(t)}
                  y1={0}
                  x2={xScale(t)}
                  y2={innerH}
                  stroke="var(--gridline)"
                  strokeWidth={1}
                />
              ))
            : yTicks.map((t) => (
                <line
                  key={`gy-${t}`}
                  x1={0}
                  y1={yScale(t)}
                  x2={innerW}
                  y2={yScale(t)}
                  stroke="var(--gridline)"
                  strokeWidth={1}
                />
              ))}

          {zeroLine && yMin < 0 && (
            <line
              x1={0}
              y1={yScale(0)}
              x2={innerW}
              y2={yScale(0)}
              stroke="var(--baseline)"
              strokeWidth={1}
            />
          )}

          {/* crosshair */}
          {hover && !isHorizontal && hoveredPeriod && (
            <line
              x1={
                isBandKind
                  ? (bandScale(hoveredPeriod) ?? 0) + bandScale.bandwidth() / 2
                  : (pointScale(hoveredPeriod) ?? 0)
              }
              y1={0}
              x2={
                isBandKind
                  ? (bandScale(hoveredPeriod) ?? 0) + bandScale.bandwidth() / 2
                  : (pointScale(hoveredPeriod) ?? 0)
              }
              y2={innerH}
              stroke="var(--baseline)"
              strokeWidth={1}
            />
          )}

          <g clipPath={`url(#${clipId})`}>{renderMarks()}</g>
          {renderDirectLabels()}

          {/* axes */}
          <line
            x1={0}
            y1={innerH}
            x2={innerW}
            y2={innerH}
            stroke="var(--baseline)"
            strokeWidth={1}
          />

          {isHorizontal
            ? periods.map((p) => (
                <text
                  key={`ty-${p}`}
                  x={-8}
                  y={(catScale(p) ?? 0) + catScale.bandwidth() / 2 + 3}
                  textAnchor="end"
                  fontSize={9}
                  fill="var(--text-muted)"
                >
                  {/* The gutter was measured against the full label, so print
                      it whole rather than truncating text that already fits. */}
                  {p}
                </text>
              ))
            : yTicks.map((t) => (
                <text
                  key={`tly-${t}`}
                  x={-8}
                  y={yScale(t) + 3}
                  textAnchor="end"
                  fontSize={9}
                  className="tnum"
                  fill="var(--text-muted)"
                >
                  {formatAxis(t)}
                </text>
              ))}

          {!isHorizontal &&
            periods.map((p, i) => {
              // Thin x labels when crowded so they never collide.
              const step = Math.ceil(periods.length / 8);
              if (i % step !== 0 && i !== periods.length - 1) return null;
              const x = isBandKind
                ? (bandScale(p) ?? 0) + bandScale.bandwidth() / 2
                : (pointScale(p) ?? 0);
              return (
                <text
                  key={`tx-${p}`}
                  x={x}
                  y={innerH + 14}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--text-muted)"
                >
                  {shortPeriod(p)}
                </text>
              );
            })}

          {isHorizontal &&
            xTicks.map((t) => (
              <text
                key={`tlx-${t}`}
                x={xScale(t)}
                y={innerH + 14}
                textAnchor="middle"
                fontSize={9}
                className="tnum"
                fill="var(--text-muted)"
              >
                {formatAxis(t)}
              </text>
            ))}
        </g>
      </svg>

      {/* The card is the shared one, on a fixed layer: charts and maps answer a
          hover the same way, and it can leave this box rather than being
          clamped inside it. */}
      <HoverCard hover={card} />

      {/* legend — always present for 2+ series */}
      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {series.map((s, i) => (
            <span key={s.id} className="flex items-center gap-1.5 text-[11px]">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: colorOf(i) }}
                aria-hidden
              />
              <span className="text-[color:var(--text-secondary)]">{s.label}</span>
            </span>
          ))}
        </div>
      )}

      {/* table view — the relief mechanism for sub-3:1 hues, and the a11y fallback */}
      <button
        onClick={() => setShowTable((v) => !v)}
        className="mt-2 eyebrow hover:text-[color:var(--text-primary)] transition-colors"
        aria-expanded={showTable}
      >
        {showTable ? "hide table" : "show table"}
      </button>

      {showTable && (
        <div className="mt-2 max-h-56 overflow-auto rounded border">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-[var(--surface-2)]">
              <tr>
                <th className="px-2 py-1 text-left font-medium">Period</th>
                {series.map((s) => (
                  <th key={s.id} className="px-2 py-1 text-right font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p} className="border-t">
                  <td className="px-2 py-1">{p}</td>
                  {series.map((s) => {
                    const d = s.data.find((x) => x.period === p);
                    return (
                      <td key={s.id} className="tnum px-2 py-1 text-right">
                        {d ? formatNumber(d.value, unit) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
