"use client";

import { useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import topo from "@/data/geo/india-states.topo.json";
import HoverCard, { useHoverCard } from "@/components/charts/HoverCard";
import type { CensusSpec } from "@/lib/census-specs";
import { CENSUS_GROUPS } from "@/lib/census-specs";
import type { MetricCount, Normalisation } from "@/lib/census-shared";
import { NORMALISATIONS, mappingBaseline, readBias } from "@/lib/census-shared";

type StateProps = { name: string | null };

export interface AtlasMapProps {
  specs: CensusSpec[];
  counts: Record<string, MetricCount>;
  facts: Record<string, { pop: number; areaKm2: number }>;
}

/** Five steps from the site's sequential ramp — magnitude, so one hue. */
const RAMP = ["var(--seq-100)", "var(--seq-250)", "var(--seq-400)", "var(--seq-550)", "var(--seq-700)"];

export default function AtlasMap({ specs, counts, facts }: AtlasMapProps) {
  const [metricId, setMetricId] = useState(specs[0]?.id ?? "");
  const [mode, setMode] = useState<Normalisation>("raw");
  const [group, setGroup] = useState<string>("all");
  const card = useHoverCard();

  const width = 560, height = 620;

  const { states, path } = useMemo(() => {
    const t = topo as unknown as Topology<{ india: GeometryCollection<StateProps> }>;
    const fc = feature(t, t.objects.india) as FeatureCollection<Geometry, StateProps>;
    const proj = geoMercator().fitSize([width, height], fc);
    return { states: fc, path: geoPath(proj) };
  }, []);

  const visible = useMemo(
    () => (group === "all" ? specs : specs.filter((s) => s.group === group)),
    [specs, group],
  );

  const spec = specs.find((s) => s.id === metricId) ?? specs[0];
  const count = spec ? counts[spec.id] : undefined;

  // Each state's share of every mapped feature: roughly, how much of the map it
  // drew. A metric whose leader merely matches its own baseline is telling you
  // about mappers, not about the thing.
  const baseline = useMemo(() => mappingBaseline(Object.values(counts)), [counts]);
  const bias = useMemo(() => (count ? readBias(count, baseline) : null), [count, baseline]);

  const { values, max, ranked } = useMemo(() => {
    if (!count) return { values: {} as Record<string, number>, max: 0, ranked: [] as Array<[string, number]> };
    const v: Record<string, number> = {};
    for (const [st, n] of Object.entries(count.byState)) {
      if (mode === "raw") { v[st] = n; continue; }
      const f = facts[st];
      if (!f) continue;
      v[st] = mode === "perMillion" ? (n / f.pop) * 1_000_000 : (n / f.areaKm2) * 10_000;
    }
    const r = Object.entries(v).sort((a, b) => b[1] - a[1]);
    return { values: v, max: r[0]?.[1] ?? 0, ranked: r };
  }, [count, mode, facts]);

  /**
   * Log-spaced buckets.
   *
   * Equal-width bins are useless here — one state often holds a quarter of
   * everything, so linear steps paint the country one pale shade. Quantiles
   * were the first fix and were worse in a different way: with only a dozen
   * states holding any of a given thing, the top quintile swallowed everything
   * above fifth place, and Maharashtra with 51 gurdwaras rendered as dark as
   * Himachal with 324.
   *
   * Log steps keep the ordering visible across that range, which is what a
   * choropleth of a skewed count actually needs.
   */
  const thresholds = useMemo(() => {
    const vals = ranked.map(([, v]) => v).filter((v) => v > 0);
    if (vals.length === 0) return [];
    const lo = Math.log10(Math.min(...vals));
    const hi = Math.log10(Math.max(...vals));
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return [];
    return [1, 2, 3, 4].map((i) => 10 ** (lo + ((hi - lo) * i) / 5));
  }, [ranked]);

  function fill(state: string): string {
    const v = values[state];
    if (v === undefined) return "url(#nodata)";
    if (v <= 0) return "var(--surface-2)";
    let i = 0;
    while (i < thresholds.length && v > (thresholds[i] ?? 0)) i++;
    return RAMP[Math.min(i, RAMP.length - 1)]!;
  }

  const unit = NORMALISATIONS.find((n) => n.id === mode)?.unit ?? "";
  const fmt = (v: number) =>
    mode === "raw" ? Math.round(v).toLocaleString("en-IN")
      : v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">Group</span>
          <select value={group} onChange={(e) => setGroup(e.target.value)}
            className="rounded border border-gridline bg-surface-1 px-2 py-1 text-sm text-ink">
            <option value="all">All {specs.length}</option>
            {CENSUS_GROUPS.filter((g) => specs.some((s) => s.group === g)).map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">What to count</span>
          <select value={metricId} onChange={(e) => setMetricId(e.target.value)}
            className="w-56 rounded border border-gridline bg-surface-1 px-2 py-1 text-sm text-ink">
            {visible.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">Measured</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as Normalisation)}
            className="rounded border border-gridline bg-surface-1 px-2 py-1 text-sm text-ink">
            {NORMALISATIONS.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
          </select>
        </label>
        {count && (
          <p className="ml-auto text-xs text-ink-2">
            <strong className="text-ink">{count.total.toLocaleString("en-IN")}</strong> mapped
            {count.capped && <span className="ml-1 text-[color:var(--status-warning)]">· truncated</span>}
          </p>
        )}
      </div>

      {count?.capped && (
        <p className="mb-3 rounded border border-gridline bg-surface-2 px-3 py-2 text-xs leading-relaxed text-ink-2">
          This count hit the query limit, so it is incomplete and the ranking below is not
          trustworthy. Overpass truncates instead of failing, which makes a cut-off count look
          exactly like a real one — it is flagged rather than drawn as fact.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="min-w-0">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img"
            aria-label={`${spec?.label ?? "Metric"} by state`}>
            <defs>
              {/* Hatched, so "not mapped here" cannot read as a low value. */}
              <pattern id="nodata" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="var(--surface-2)" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="var(--gridline)" strokeWidth="2" />
              </pattern>
            </defs>
            {states.features.map((f, i) => {
              const name = f.properties?.name ?? "";
              const v = values[name];
              const raw = count?.byState[name];
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
                      subtitle: spec?.label,
                      rows:
                        v === undefined
                          ? undefined
                          : [
                              { label: "Mapped", value: (raw ?? 0).toLocaleString("en-IN") },
                              ...(mode !== "raw" ? [{ label: unit, value: fmt(v) }] : []),
                            ],
                      note:
                        v === undefined
                          ? "Nothing of this kind is mapped here — which is not the same as none existing."
                          : undefined,
                    })
                  }
                  onMouseLeave={card.hide}
                >
                  <title>
                    {v === undefined
                      ? `${name} — none mapped`
                      : `${name} — ${(raw ?? 0).toLocaleString("en-IN")} mapped`}
                  </title>
                </path>
              );
            })}
          </svg>
          <HoverCard hover={card.hover} />

          <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-muted">
            <span>fewer</span>
            {RAMP.map((c) => (
              <span key={c} className="h-2.5 w-7 rounded-sm" style={{ background: c }} />
            ))}
            <span>more</span>
            <span className="ml-2 flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: "url(#nodata)", border: "1px solid var(--gridline)" }} />
              none mapped
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <h3 className="mb-2 text-[11px] uppercase tracking-wide text-ink-muted">
            Ranked · {NORMALISATIONS.find((n) => n.id === mode)?.label}
          </h3>
          <ol className="space-y-1">
            {ranked.slice(0, 12).map(([st, v], i) => (
              <li key={st} className="grid grid-cols-[1.1rem_1fr_3.6rem] items-center gap-1.5">
                <span className="font-mono text-[10px] text-ink-muted">{i + 1}</span>
                <span className="truncate text-xs text-ink-2" title={st}>{st}</span>
                <span className="text-right font-mono text-[11px] tabular-nums text-ink">{fmt(v)}</span>
              </li>
            ))}
          </ol>
          {bias && (
            <div className="mt-4 rounded border border-gridline bg-surface-2 p-3">
              <p className="text-[11px] uppercase tracking-wide text-ink-muted">Signal or artifact</p>
              <p className="mt-1 text-xs leading-snug text-ink-2">
                <strong className="text-ink">{bias.leader}</strong> holds{" "}
                <strong className="text-ink">{(bias.share * 100).toFixed(0)}%</strong> of this, and
                draws {(bias.baseline * 100).toFixed(0)}% of everything mapped in India.
              </p>
              <p className="mt-1.5 flex items-baseline gap-1.5 text-xs">
                <span className="font-mono tabular-nums text-ink">{bias.lift.toFixed(1)}×</span>
                <span className="text-ink-2">its own mapping share — {bias.verdict}.</span>
              </p>
              <p className="mt-1.5 text-[10.5px] leading-snug text-ink-muted">
                Near 1× means the lead is mapping density rather than the thing itself. Far above
                means a concentration real enough to show through the bias.
              </p>
            </div>
          )}
          {spec?.note && <p className="mt-3 text-[11px] leading-snug text-ink-muted">{spec.note}</p>}
          <p className="mt-3 text-[11px] leading-snug text-ink-muted">
            {NORMALISATIONS.find((n) => n.id === mode)?.note}
          </p>
        </div>
      </div>
    </div>
  );
}
