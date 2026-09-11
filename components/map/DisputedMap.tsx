"use client";

import { useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import topo from "@/data/geo/india-states.topo.json";
import HoverCard, { useHoverCard } from "@/components/charts/HoverCard";
import type { StateCount } from "@/lib/disputed";

type StateProps = { name: string | null };

/**
 * Entries in one book, by the state that book files them under.
 *
 * Not a dot map, and the reason is the data. The list gives a district and a
 * town, never a coordinate, and only twelve per cent of its place-names
 * resolve against this project's gazetteer. Dots would put a precise mark on
 * an imprecise record, and on this subject a spurious pin is worse than a
 * coarse shade.
 *
 * A choropleth carries its own risk — shading a country by "claims" can read
 * as shading it by events — so the legend, the title and the caption all say
 * this counts entries in a 1990 catalogue. Where the author looked is part of
 * what the shading shows: he worked largely from ASI district gazetteers and
 * epigraphic reports, which are far richer for some regions than others.
 *
 * The ramp is one hue at rising opacity. That is monotonic by construction,
 * which is the property a sequential scale has to have, and it holds in both
 * themes without a second set of steps.
 */

const STEPS = [0.1, 0.24, 0.4, 0.58, 0.8];

function bucketOf(n: number, breaks: number[]): number {
  let i = 0;
  while (i < breaks.length && n > breaks[i]!) i++;
  return Math.min(i, STEPS.length - 1);
}

export default function DisputedMap({ states }: { states: StateCount[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const card = useHoverCard();
  const width = 640, height = 700;

  const { paths, project } = useMemo(() => {
    const t = topo as unknown as Topology<{ india: GeometryCollection<StateProps> }>;
    const fc = feature(t, t.objects.india) as FeatureCollection<Geometry, StateProps>;
    const proj = geoMercator().fitSize([width, height], fc);
    const gp = geoPath(proj);
    return {
      paths: fc.features.map((f, i) => ({
        d: gp(f) ?? "",
        name: f.properties?.name ?? String(i),
      })),
      project: proj,
    };
  }, []);

  const byPolygon = useMemo(() => {
    const m = new Map<string, StateCount>();
    for (const s of states) if (s.polygon) m.set(s.polygon, s);
    return m;
  }, [states]);

  /**
   * Quantile breaks, not equal intervals.
   *
   * Uttar Pradesh holds 283 entries and Delhi one. Equal intervals would put
   * fourteen of sixteen states in the palest band and say nothing about any of
   * them; quantiles spend the ramp where the states actually are.
   */
  const breaks = useMemo(() => {
    const vals = states.map((s) => s.n).sort((a, b) => a - b);
    if (vals.length === 0) return [];
    return [0.2, 0.4, 0.6, 0.8].map((q) => vals[Math.floor(q * (vals.length - 1))] ?? 0);
  }, [states]);

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height: "auto" }}
        role="img"
        aria-label="Entries in Goel's 1990 catalogue, by the state it files them under"
      >
        {paths.map((p) => {
          const s = byPolygon.get(p.name);
          const on = hover === p.name;
          return (
            <path
              key={p.name}
              d={p.d}
              fill={s ? "var(--series-1)" : "var(--surface-2)"}
              fillOpacity={s ? STEPS[bucketOf(s.n, breaks)] : 1}
              stroke={on ? "var(--text-primary)" : "var(--gridline)"}
              strokeWidth={on ? 1.4 : 0.6}
              onMouseEnter={() => setHover(p.name)}
              onMouseMove={(e) =>
                card.show(e, {
                  title: p.name,
                  subtitle: s ? `filed by the book as ${s.book}` : "no entries",
                  rows: [{ label: "Entries in the list", value: s ? String(s.n) : "0" }],
                  note: "Entries in one 1990 catalogue, not a count of events.",
                })
              }
              onMouseLeave={() => { setHover(null); card.hide(); }}
            />
          );
        })}
      </svg>
      <HoverCard hover={card.hover} />

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="eyebrow">Entries in the list</span>
        <ul className="flex items-center gap-0">
          {STEPS.map((o, i) => (
            <li key={o} className="flex flex-col items-center">
              <span
                className="block h-[11px] w-[34px]"
                style={{ background: "var(--series-1)", opacity: o }}
              />
              <span className="mono mt-1 text-[10px] tabular-nums text-[color:var(--text-muted)]">
                {i === 0 ? "1" : `${(breaks[i - 1] ?? 0) + 1}`}
              </span>
            </li>
          ))}
          <li className="ml-1 self-start">
            <span className="mono text-[10px] tabular-nums text-[color:var(--text-muted)]">
              {Math.max(...states.map((s) => s.n))}
            </span>
          </li>
        </ul>
        <span className="flex items-center gap-1.5 text-[11px] text-[color:var(--text-muted)]">
          <span className="block h-[11px] w-[16px] bg-[var(--surface-2)] ring-1 ring-[color:var(--gridline)]" />
          no entries
        </span>
      </div>

      <p className="mt-3 max-w-[68ch] text-[11px] leading-relaxed text-[color:var(--text-muted)]">
        Shading counts entries in a 1990 catalogue, not events. Where the author looked is
        part of what this shows: he worked largely from Archaeological Survey district
        gazetteers and epigraphic reports, which are far fuller for some regions than
        others. Bands are quantiles, because Uttar Pradesh holds 283 entries and Delhi one.
      </p>
    </div>
  );
}
