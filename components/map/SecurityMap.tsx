"use client";

import { useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import topo from "@/data/geo/india-states.topo.json";
import {
  METRICS,
  METRIC_BY_ID,
  TRACKED_STATES,
  FIRST_YEAR,
  LAST_YEAR,
  byState,
  byYear,
  ranked,
  bucketsOf,
  bucketOf,
  type MetricId,
} from "@/lib/lwe-states";

/**
 * Left-wing extremism on the map, by state and year.
 *
 * ── Encoding ─────────────────────────────────────────────────────────────
 *
 * A choropleth of a continuous magnitude, so the colour is a sequential
 * single-hue ramp, palest to darkest. Untracked states are drawn in the
 * surface's own grey with a hatch, deliberately outside the ramp: "nobody
 * counted here" must not read as "a small number here", and the two are one
 * step apart on any scale that puts them on the same ramp.
 *
 * Buckets are quantiles, not equal widths. Chhattisgarh accounts for a third of
 * all recorded fatalities, and equal-width bins therefore produce one dark state
 * and seventeen pale ones in every single year — true, and useless as a map.
 * The legend says the steps are quantiles rather than implying a fixed number
 * of deaths per shade.
 *
 * Nothing here depends on reading a colour: every state's number is in the
 * ranked list beside the map, and in the table under it.
 */

type StateProps = { name: string | null };

const W = 560;
const H = 600;

/** The sequential ramp, palest to darkest, from the site's own tokens. */
const RAMP = ["var(--seq-100)", "var(--seq-250)", "var(--seq-400)", "var(--seq-550)", "var(--seq-700)"];

export default function SecurityMap() {
  const [metric, setMetric] = useState<MetricId>("total");
  const [from, setFrom] = useState(FIRST_YEAR);
  const [to, setTo] = useState(LAST_YEAR);

  const { states, path } = useMemo(() => {
    const t = topo as unknown as Topology<{ india: GeometryCollection<StateProps> }>;
    const fc = feature(t, t.objects.india) as FeatureCollection<Geometry, StateProps>;
    const proj = geoMercator().fitSize([W, H], fc);
    return { states: fc, path: geoPath(proj) };
  }, []);

  const allStates = useMemo(
    () =>
      states.features
        .map((f) => f.properties?.name)
        .filter((n): n is string => Boolean(n)),
    [states],
  );

  const values = useMemo(() => byState(metric, from, to, allStates), [metric, from, to, allStates]);
  const valueByState = useMemo(() => new Map(values.map((v) => [v.state, v.value])), [values]);
  const buckets = useMemo(() => bucketsOf(values), [values]);
  const list = useMemo(() => ranked(metric, from, to), [metric, from, to]);
  const trend = useMemo(() => byYear(metric), [metric]);

  const spec = METRIC_BY_ID.get(metric);
  const total = list.reduce((n, s) => n + (s.value ?? 0), 0);
  const partialYear = to === LAST_YEAR;

  function fill(state: string): string {
    const v = valueByState.get(state);
    if (v === null || v === undefined) return "url(#untracked)";
    if (v === 0) return "var(--surface-2)";
    return RAMP[bucketOf(v, buckets)] ?? RAMP[0]!;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      {/* ---------------- Panel ---------------- */}
      <div className="min-w-0">
        <h3 className="text-[12px] font-semibold tracking-tight">What to map</h3>
        <ul className="mt-2 space-y-0.5">
          {METRICS.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setMetric(m.id)}
                aria-pressed={metric === m.id}
                className={`w-full rounded px-2 py-1.5 text-left text-[12px] ${
                  metric === m.id
                    ? "bg-[color:var(--surface-2)] font-medium"
                    : "text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-2)]"
                }`}
              >
                {m.label}
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-4 border-t pt-3">
          <label className="flex items-baseline justify-between text-[11px] text-[color:var(--text-secondary)]">
            <span>From</span>
            <span className="tnum font-medium text-[color:var(--text-primary)]">{from}</span>
          </label>
          <input
            type="range"
            min={FIRST_YEAR}
            max={LAST_YEAR}
            value={from}
            onChange={(e) => {
              const v = Number(e.target.value);
              setFrom(v);
              if (v > to) setTo(v);
            }}
            className="mt-1 w-full"
            aria-label="First year"
          />
          <label className="mt-2 flex items-baseline justify-between text-[11px] text-[color:var(--text-secondary)]">
            <span>To</span>
            <span className="tnum font-medium text-[color:var(--text-primary)]">{to}</span>
          </label>
          <input
            type="range"
            min={FIRST_YEAR}
            max={LAST_YEAR}
            value={to}
            onChange={(e) => {
              const v = Number(e.target.value);
              setTo(v);
              if (v < from) setFrom(v);
            }}
            className="w-full"
            aria-label="Last year"
          />
        </div>

        {/* The national trend, so a year range is chosen against something. */}
        <div className="mt-4 border-t pt-3">
          <p className="text-[11px] text-[color:var(--text-muted)]">
            National, {FIRST_YEAR}–{LAST_YEAR}
          </p>
          <Sparkline points={trend} from={from} to={to} />
        </div>

        <div className="mt-4 border-t pt-3">
          <p className="tnum text-[18px] font-semibold">{total.toLocaleString("en-IN")}</p>
          <p className="text-[11px] leading-relaxed text-[color:var(--text-secondary)]">
            {spec?.short} recorded across {list.length} of the {TRACKED_STATES.length} states SATP
            tracks, {from}–{to}
            {partialYear ? ". The last year is still running and will grow." : "."}
          </p>
        </div>

        <ol className="mt-3 space-y-1">
          {list.slice(0, 10).map((s) => (
            <li key={s.state} className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className="truncate text-[color:var(--text-secondary)]">{s.state}</span>
              <span className="tnum shrink-0 text-[color:var(--text-muted)]">
                {(s.value ?? 0).toLocaleString("en-IN")}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* ---------------- Map ---------------- */}
      <div className="min-w-0">
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            role="img"
            aria-label={`Map of India shaded by ${spec?.label.toLowerCase()} from left-wing extremism, ${from} to ${to}. SATP publishes a datasheet for ${TRACKED_STATES.length} states; the rest are shown as not tracked.`}
            className="min-w-[420px]"
          >
            <defs>
              {/* Not tracked. Hatched rather than shaded, so it cannot be read
                  as a low value on the ramp. */}
              <pattern id="untracked" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="var(--surface-2)" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="var(--gridline)" strokeWidth="2" />
              </pattern>
            </defs>
            {states.features.map((f, i) => {
              const name = f.properties?.name ?? "";
              const v = valueByState.get(name);
              return (
                <path
                  key={`${name}-${i}`}
                  d={path(f) ?? ""}
                  fill={fill(name)}
                  // Gridline, not the page colour. Stroking boundaries in the
                  // plane colour works on light and disappears on dark, where
                  // the states with nothing recorded then read as holes punched
                  // in the country rather than as parts of it.
                  stroke="var(--gridline)"
                  strokeWidth="0.6"
                >
                  <title>
                    {v === null || v === undefined
                      ? `${name} — SATP publishes no left-wing-extremism datasheet for this state`
                      : `${name} — ${v.toLocaleString("en-IN")} ${spec?.short}, ${from}–${to}`}
                  </title>
                </path>
              );
            })}
          </svg>
        </div>

        <Legend buckets={buckets} unit={spec?.short ?? ""} />

        {spec?.note && (
          <p className="mt-3 max-w-[640px] text-[11px] leading-relaxed text-[color:var(--text-muted)]">
            {spec.note}
          </p>
        )}
      </div>
    </div>
  );
}

function Legend({ buckets, unit }: { buckets: number[]; unit: string }) {
  const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-[color:var(--text-muted)]">
      <span className="flex items-center gap-1">
        {RAMP.map((c, i) => (
          <span key={c} className="flex items-center gap-1">
            <span className="inline-block h-3 w-6" style={{ background: c }} />
            <span className="tnum">
              {i === 0
                ? `≤${fmt(buckets[0] ?? 0)}`
                : i === RAMP.length - 1
                  ? `>${fmt(buckets[buckets.length - 1] ?? 0)}`
                  : `≤${fmt(buckets[i] ?? 0)}`}
            </span>
          </span>
        ))}
        <span className="ml-1">{unit}</span>
      </span>
      {/* Three states of knowledge, not two. A state SATP tracks and found
          nothing in is a measurement; a state it does not track is an absence
          of one. Collapsing them would turn eighteen unexamined places into a
          confident zero. */}
      <span className="flex items-center gap-1.5">
        <span
          className="inline-block h-3 w-6 border"
          style={{ background: "var(--surface-2)", borderColor: "var(--gridline)" }}
          aria-hidden
        />
        none recorded
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="14" height="12" aria-hidden>
          <defs>
            <pattern
              id="untracked-key"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="6" height="6" fill="var(--surface-2)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--gridline)" strokeWidth="2" />
            </pattern>
          </defs>
          <rect width="14" height="12" fill="url(#untracked-key)" />
        </svg>
        not tracked by SATP
      </span>
      <span>steps are quantiles, so a shade is a rank rather than a fixed count</span>
    </div>
  );
}

/** The national series, with the chosen range picked out. */
function Sparkline({
  points,
  from,
  to,
}: {
  points: Array<{ year: number; value: number }>;
  from: number;
  to: number;
}) {
  const w = 260;
  const h = 46;
  const max = Math.max(1, ...points.map((p) => p.value));
  const step = w / Math.max(1, points.length);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="National total by year" className="mt-1">
      {points.map((p, i) => {
        const barH = (p.value / max) * (h - 4);
        const inRange = p.year >= from && p.year <= to;
        return (
          <rect
            key={p.year}
            x={i * step + 0.5}
            y={h - barH}
            width={Math.max(1.5, step - 1.5)}
            height={barH}
            fill={inRange ? "var(--seq-550)" : "var(--gridline)"}
          >
            <title>{`${p.year}: ${p.value.toLocaleString("en-IN")}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
