"use client";

import { useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import topo from "@/data/geo/india-states.topo.json";
import HoverCard, { useHoverCard } from "@/components/charts/HoverCard";
import { literacyShift, type LiteracyRow } from "@/lib/pillars-shared";

type StateProps = { name: string | null };

/**
 * Literacy by state, and the change between any two censuses.
 *
 * The level view uses the sequential ramp across the observed range rather
 * than from zero: no state has ever been under about 30%, so a zero-anchored
 * scale would waste a third of the ramp and flatten the differences that are
 * the whole point.
 *
 * The change view uses the validated diverging ramp with fixed percentage-point
 * bands. Literacy has risen everywhere in every intercensal period, so a
 * scale relative to the extremes would paint the slowest riser as though it
 * had fallen. Fixed bands keep "rose a little" and "fell" as different
 * statements, even when nothing fell.
 */
const RAMP = ["var(--seq-100)", "var(--seq-250)", "var(--seq-400)", "var(--seq-550)", "var(--seq-700)"];
const DIVERGING = ["var(--div-neg-2)", "var(--div-neg-1)", "var(--div-mid)", "var(--div-pos-1)", "var(--div-pos-2)"];
/** Upper edge of each diverging band, in percentage points. */
const SHIFT_BANDS = [0, 5, 10, 15];
const SHIFT_LABELS = ["fell", "rose under 5", "5–10", "10–15", "rose 15+"];

export default function LiteracyMap({
  rows, censusYears,
}: { rows: LiteracyRow[]; censusYears: string[] }) {
  const latest = censusYears[censusYears.length - 1] ?? "";
  const [view, setView] = useState<"level" | "change">("level");
  const [year, setYear] = useState(latest);
  const [from, setFrom] = useState(censusYears[0] ?? "");
  const card = useHoverCard();

  const width = 560, height = 620;
  const { states, path } = useMemo(() => {
    const t = topo as unknown as Topology<{ india: GeometryCollection<StateProps> }>;
    const fc = feature(t, t.objects.india) as FeatureCollection<Geometry, StateProps>;
    return { states: fc, path: geoPath(geoMercator().fitSize([width, height], fc)) };
  }, []);

  const byState = useMemo(() => new Map(rows.map((r) => [r.state, r])), [rows]);

  const values = useMemo(() => {
    if (view === "change") return literacyShift(rows, from, year);
    const out: Record<string, number> = {};
    for (const r of rows) { const v = r.byCensus[year]; if (v !== undefined) out[r.state] = v; }
    return out;
  }, [rows, view, from, year]);

  const extent = useMemo(() => {
    const vs = Object.values(values);
    return vs.length === 0 ? { lo: 0, hi: 0 } : { lo: Math.min(...vs), hi: Math.max(...vs) };
  }, [values]);

  const ranked = useMemo(
    () => Object.entries(values).sort((a, b) => b[1] - a[1]),
    [values],
  );

  function fill(state: string): string {
    const v = values[state];
    if (v === undefined) return "url(#no-literacy)";
    if (view === "change") {
      const i = SHIFT_BANDS.findIndex((b) => v < b);
      return DIVERGING[i === -1 ? DIVERGING.length - 1 : i]!;
    }
    const span = extent.hi - extent.lo;
    if (span <= 0) return RAMP[2]!;
    return RAMP[Math.min(RAMP.length - 1, Math.floor(((v - extent.lo) / span) * RAMP.length))]!;
  }

  const fmt = (v: number) => view === "change" ? `${v > 0 ? "+" : ""}${v.toFixed(1)} pp` : `${v.toFixed(1)}%`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">Showing</span>
          <select value={view} onChange={(e) => setView(e.target.value as "level" | "change")}
            className="rounded border border-gridline bg-surface-1 px-2 py-1 text-sm text-ink">
            <option value="level">Literacy rate</option>
            <option value="change">Change between censuses</option>
          </select>
        </label>
        {view === "change" && (
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-ink-muted">From</span>
            <select value={from} onChange={(e) => setFrom(e.target.value)}
              className="rounded border border-gridline bg-surface-1 px-2 py-1 text-sm text-ink">
              {censusYears.filter((y) => y < year).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">
            {view === "change" ? "To" : "Census"}
          </span>
          <select value={year} onChange={(e) => setYear(e.target.value)}
            className="rounded border border-gridline bg-surface-1 px-2 py-1 text-sm text-ink">
            {censusYears.filter((y) => view === "level" || y > from).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <p className="ml-auto text-xs text-ink-2">
          <strong className="text-ink">{ranked.length}</strong> states
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="min-w-0">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img"
            aria-label={`Literacy by state, ${view === "change" ? `change ${from} to ${year}` : year}`}>
            <defs>
              <pattern id="no-literacy" width="6" height="6" patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)">
                <rect width="6" height="6" fill="var(--surface-2)" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="var(--gridline)" strokeWidth="2" />
              </pattern>
            </defs>
            {states.features.map((f, i) => {
              const name = f.properties?.name ?? "";
              const row = byState.get(name);
              const v = values[name];
              return (
                <path key={`${name}-${i}`} d={path(f) ?? ""} fill={fill(name)}
                  stroke="var(--gridline)" strokeWidth={0.6}
                  onMouseMove={(e) => card.show(e, {
                    title: name,
                    subtitle: view === "change" ? `${from} to ${year}` : `Census ${year}`,
                    rows: row
                      ? censusYears
                          .filter((y) => row.byCensus[y] !== undefined)
                          .slice(-4)
                          .map((y) => ({ label: y, value: `${row.byCensus[y]!.toFixed(1)}%` }))
                      : undefined,
                    note: v === undefined
                      ? "Not in the census table for this pair of years."
                      : view === "change" ? `Change: ${fmt(v)}` : undefined,
                  })}
                  onMouseLeave={card.hide}>
                  <title>{row ? `${name} — ${v !== undefined ? fmt(v) : "no figure"}` : `${name} — not in the table`}</title>
                </path>
              );
            })}
          </svg>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
            {view === "change" ? (
              DIVERGING.map((c, i) => (
                <span key={c} className="inline-flex items-center gap-1">
                  <span className="inline-block h-3 w-7 rounded-sm" style={{ background: c }} />
                  <span className="tabular-nums">{SHIFT_LABELS[i]}</span>
                </span>
              ))
            ) : (
              <>
                <span className="tabular-nums">{fmt(extent.lo)}</span>
                {RAMP.map((c) => <span key={c} className="inline-block h-3 w-7 rounded-sm" style={{ background: c }} />)}
                <span className="tabular-nums">{fmt(extent.hi)}</span>
              </>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">Ranked</p>
          <ol className="mt-2 space-y-0.5">
            {ranked.slice(0, 14).map(([st, v], i) => (
              <li key={st} className="flex items-baseline gap-2 text-xs">
                <span className="w-4 shrink-0 text-right tabular-nums text-ink-muted">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-ink-2">{st}</span>
                <span className="shrink-0 font-mono tabular-nums text-ink">{fmt(v)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <HoverCard hover={card.hover} />
    </div>
  );
}
