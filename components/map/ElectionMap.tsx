"use client";

import { useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import topo from "@/data/geo/india-states.topo.json";
import HoverCard, { useHoverCard } from "@/components/charts/HoverCard";
import type { ElectionYear } from "@/lib/elections-shared";
import { nationalTurnout, turnoutShift } from "@/lib/elections-shared";

type StateProps = { name: string | null };

/**
 * Turnout is not a count, and that changes the scale.
 *
 * The atlas uses log-spaced buckets because a mapped-feature count is wildly
 * skewed — one state routinely holds a quarter of everything. Turnout is
 * bounded, clustered between the high fifties and the low eighties, and a log
 * scale over that range would be a straight line with extra steps. Worse would
 * be anchoring the scale at zero: no state has ever polled under 40%, so four
 * fifths of the ramp would go unused and every state would look identical.
 *
 * So the sequential view stretches across the observed range, and the legend
 * prints the two ends rather than saying "fewer / more" — a reader has to know
 * that dark means 76% and not 100%.
 */
const RAMP = ["var(--seq-100)", "var(--seq-250)", "var(--seq-400)", "var(--seq-550)", "var(--seq-700)"];
/** Diverging, for change between two elections. Midpoint is gray by design. */
const DIVERGING = ["var(--div-neg-2)", "var(--div-neg-1)", "var(--div-mid)", "var(--div-pos-1)", "var(--div-pos-2)"];
/** Upper edge of each diverging band, in percentage points. */
const CHANGE_BANDS = [-5, -1, 1, 5];
const CHANGE_LABELS = ["fell 5+", "fell 1–5", "within 1", "rose 1–5", "rose 5+"];

type View = "turnout" | "change" | "electors" | "seats";

const VIEWS: Array<{ id: View; label: string; unit: string; note: string }> = [
  { id: "turnout", label: "Turnout", unit: "%", note: "Share of registered electors who voted." },
  { id: "change", label: "Change since last election", unit: "pp", note: "Percentage points, against the same state in the previous election here." },
  { id: "electors", label: "Registered electors", unit: "electors", note: "The size of the roll, which is mostly the size of the state." },
  { id: "seats", label: "Lok Sabha seats", unit: "seats", note: "Seats the state sends. Fixed since the 1976 freeze on redistribution." },
];

export default function ElectionMap({ years }: { years: ElectionYear[] }) {
  const [yearIdx, setYearIdx] = useState(years.length - 1);
  const [view, setView] = useState<View>("turnout");
  const card = useHoverCard();

  const width = 560, height = 620;

  const { states, path } = useMemo(() => {
    const t = topo as unknown as Topology<{ india: GeometryCollection<StateProps> }>;
    const fc = feature(t, t.objects.india) as FeatureCollection<Geometry, StateProps>;
    const proj = geoMercator().fitSize([width, height], fc);
    return { states: fc, path: geoPath(proj) };
  }, []);

  const year = years[yearIdx];
  const previous = yearIdx > 0 ? years[yearIdx - 1] : undefined;
  const rowFor = useMemo(
    () => new Map((year?.rows ?? []).map((r) => [r.state, r])),
    [year],
  );

  // "Change" needs a previous election to compare against, so on the earliest
  // one it is not offered rather than shown as a column of zeroes.
  const canDiverge = previous !== undefined;
  const effectiveView: View = view === "change" && !canDiverge ? "turnout" : view;

  const values = useMemo(() => {
    if (!year) return {} as Record<string, number>;
    if (effectiveView === "change") {
      return previous ? turnoutShift(previous, year) : {};
    }
    const out: Record<string, number> = {};
    for (const r of year.rows) {
      out[r.state] =
        effectiveView === "turnout" ? r.turnoutPct
          : effectiveView === "electors" ? r.electors
            : r.seats;
    }
    return out;
  }, [year, previous, effectiveView]);

  const ranked = useMemo(
    () => Object.entries(values).sort((a, b) => b[1] - a[1]),
    [values],
  );

  const extent = useMemo(() => {
    const vs = Object.values(values);
    if (vs.length === 0) return { lo: 0, hi: 0 };
    return { lo: Math.min(...vs), hi: Math.max(...vs) };
  }, [values]);

  function fill(state: string): string {
    const v = values[state];
    if (v === undefined) return "url(#no-election-data)";

    if (effectiveView === "change") {
      // Fixed percentage-point bands, not fractions of the largest swing.
      // Scaling to the extreme makes the same movement change colour depending
      // on which pair of elections is on screen — and it makes the neutral band
      // mean "within a tenth of whatever the biggest mover did", which is not a
      // quantity anyone can hold in their head. A percentage point is.
      const i = CHANGE_BANDS.findIndex((b) => v < b);
      return DIVERGING[i === -1 ? DIVERGING.length - 1 : i]!;
    }

    const span = extent.hi - extent.lo;
    if (span <= 0) return RAMP[2]!;
    const i = Math.min(RAMP.length - 1, Math.floor(((v - extent.lo) / span) * RAMP.length));
    return RAMP[i]!;
  }

  const meta = VIEWS.find((v) => v.id === effectiveView)!;
  const fmt = (v: number) =>
    effectiveView === "turnout" ? `${v.toFixed(1)}%`
      : effectiveView === "change" ? `${v > 0 ? "+" : ""}${v.toFixed(1)} pp`
        : v.toLocaleString("en-IN");

  if (!year) return null;

  const national = nationalTurnout(year);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">Election</span>
          <select value={yearIdx} onChange={(e) => setYearIdx(Number(e.target.value))}
            className="rounded border border-gridline bg-surface-1 px-2 py-1 text-sm text-ink">
            {years.map((y, i) => <option key={y.year} value={i}>{y.year}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">Showing</span>
          <select value={view} onChange={(e) => setView(e.target.value as View)}
            className="w-60 rounded border border-gridline bg-surface-1 px-2 py-1 text-sm text-ink">
            {VIEWS.map((v) => (
              <option key={v.id} value={v.id} disabled={v.id === "change" && !canDiverge}>
                {v.label}{v.id === "change" && !canDiverge ? " — no earlier election here" : ""}
              </option>
            ))}
          </select>
        </label>
        <p className="ml-auto text-xs text-ink-2">
          <strong className="text-ink">{national.toFixed(1)}%</strong> national turnout ·{" "}
          <strong className="text-ink">{year.seatsTotal}</strong>/543 seats covered
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="min-w-0">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img"
            aria-label={`${meta.label} by state, ${year.year} general election`}>
            <defs>
              {/* Hatched: "not in this table" must not read as a low turnout. */}
              <pattern id="no-election-data" width="6" height="6" patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)">
                <rect width="6" height="6" fill="var(--surface-2)" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="var(--gridline)" strokeWidth="2" />
              </pattern>
            </defs>
            {states.features.map((f, i) => {
              const name = f.properties?.name ?? "";
              const row = rowFor.get(name);
              const v = values[name];
              return (
                <path
                  key={`${name}-${i}`}
                  d={path(f) ?? ""}
                  fill={fill(name)}
                  stroke="var(--gridline)"
                  strokeWidth={0.6}
                  onMouseMove={(e) =>
                    card.show(e, {
                      title: name,
                      subtitle: `${year.year} general election`,
                      rows: row
                        ? [
                            { label: "Turnout", value: `${row.turnoutPct.toFixed(1)}%` },
                            { label: "Voters", value: row.voters.toLocaleString("en-IN") },
                            { label: "Electors", value: row.electors.toLocaleString("en-IN") },
                            { label: "Seats", value: String(row.seats) },
                            ...(effectiveView === "change" && v !== undefined
                              ? [{ label: "Change", value: fmt(v) }]
                              : []),
                          ]
                        : undefined,
                      note: row?.merged
                        ? `Reported here as ${row.merged.join(" + ")}, summed because this map holds them as one polygon.`
                        : row
                          ? undefined
                          : "Not in the source table for this election.",
                    })
                  }
                  onMouseLeave={card.hide}
                >
                  <title>
                    {row
                      ? `${name} — ${row.turnoutPct.toFixed(1)}% turnout, ${row.seats} seats`
                      : `${name} — not in the source table for ${year.year}`}
                  </title>
                </path>
              );
            })}
          </svg>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
            {effectiveView === "change" ? (
              <>
                {/* Labelled in points, because a bare ramp from "fell" to
                    "rose" tells a reader the ordering and nothing about size. */}
                {DIVERGING.map((c, i) => (
                  <span key={c} className="inline-flex items-center gap-1">
                    <span className="inline-block h-3 w-7 rounded-sm" style={{ background: c }} />
                    <span className="tabular-nums">{CHANGE_LABELS[i]}</span>
                  </span>
                ))}
                <span>pp</span>
              </>
            ) : (
              <>
                <span className="tabular-nums">{fmt(extent.lo)}</span>
                {RAMP.map((c) => (
                  <span key={c} className="inline-block h-3 w-7 rounded-sm" style={{ background: c }} />
                ))}
                <span className="tabular-nums">{fmt(extent.hi)}</span>
              </>
            )}
            <span className="ml-2 inline-flex items-center gap-1">
              <span className="inline-block h-3 w-5 rounded-sm border border-gridline"
                style={{ background: "var(--surface-2)" }} />
              not in the table
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-ink-muted">{meta.note}</p>
        </div>

        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">
            Ranked · {meta.label}
          </p>
          <ol className="mt-2 space-y-0.5">
            {ranked.slice(0, 14).map(([st, v], i) => (
              <li key={st} className="flex items-baseline gap-2 text-xs">
                <span className="w-4 shrink-0 text-right tabular-nums text-ink-muted">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-ink-2">{st}</span>
                <span className="shrink-0 font-mono tabular-nums text-ink">{fmt(v)}</span>
              </li>
            ))}
          </ol>

          {year.rejected.length > 0 && (
            <div className="mt-4 rounded border border-gridline bg-surface-2 p-3">
              <p className="text-[11px] uppercase tracking-wide text-ink-muted">Not on this map</p>
              <ul className="mt-1 space-y-1">
                {year.rejected.map((r) => (
                  <li key={r.label} className="text-[11px] leading-snug text-ink-2">
                    <strong className="text-ink">{r.label}</strong> — {r.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <HoverCard hover={card.hover} />
    </div>
  );
}
