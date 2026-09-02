"use client";

import { useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import topo from "@/data/geo/india-states.topo.json";
import HoverCard, { useHoverCard } from "@/components/charts/HoverCard";

type StateProps = { name: string | null };

export interface VandeRoute {
  title: string; name: string; trainNumbers: string[];
  from: string | null; to: string | null;
  distanceKm: number | null; frequency: string | null;
  a: [number, number] | null; b: [number, number] | null; drawable: boolean;
}
export interface Hub { name: string; coord: [number, number]; services: number }

/**
 * The Vande Bharat network as origin-to-destination links.
 *
 * These are links, not alignments. A line here says a service runs between two
 * stations; it does not claim the train travels that path, because the track it
 * actually follows is mapped for only eight of these routes. Drawing a
 * confident curve across the middle of India would imply a survey nobody did,
 * so the arcs are deliberately shallow and the caption says what they are.
 */
export default function VandeMap({
  routes, hubs, tracedCount,
}: { routes: VandeRoute[]; hubs: Hub[]; tracedCount: number }) {
  const [hover, setHover] = useState<VandeRoute | null>(null);
  const [minKm, setMinKm] = useState(0);
  const card = useHoverCard();

  const width = 640, height = 700;

  const { statePaths, project } = useMemo(() => {
    const t = topo as unknown as Topology<{ india: GeometryCollection<StateProps> }>;
    const fc = feature(t, t.objects.india) as FeatureCollection<Geometry, StateProps>;
    const proj = geoMercator().fitSize([width, height], fc);
    const gp = geoPath(proj);
    return {
      statePaths: fc.features.map((f, i) => ({ d: gp(f) ?? "", key: f.properties?.name ?? String(i) })),
      project: proj,
    };
  }, []);

  const shown = useMemo(
    () => routes.filter((r) => r.drawable && (r.distanceKm ?? 0) >= minKm),
    [routes, minKm],
  );

  /** A shallow arc: enough to separate overlapping pairs, not enough to imply a path. */
  function arc(r: VandeRoute): string {
    const p = project(r.a!), q = project(r.b!);
    if (!p || !q) return "";
    const [x1, y1] = p, [x2, y2] = q;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const bend = Math.min(28, len * 0.13);
    return `M${x1.toFixed(1)},${y1.toFixed(1)} Q${(mx - (dy / len) * bend).toFixed(1)},${(my + (dx / len) * bend).toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
  }

  const maxHub = Math.max(1, ...hubs.map((h) => h.services));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-ink-2">
          <span className="text-ink-muted">Min route length</span>
          <input
            type="range" min={0} max={1500} step={50} value={minKm}
            onChange={(e) => setMinKm(Number(e.target.value))}
            className="w-40 accent-[color:var(--series-2)]"
          />
          <span className="font-mono tabular-nums">{minKm} km</span>
        </label>
        <span className="ml-auto text-xs text-ink-muted">
          {hover
            ? `${hover.name.replace(/ Vande Bharat Express$/, "")} · ${hover.trainNumbers.join("/")} · ${hover.distanceKm ?? "?"} km`
            : `${shown.length} of ${routes.length} routes drawn`}
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img"
        aria-label={`Vande Bharat network: ${shown.length} origin-to-destination links across India`}>
        {statePaths.map((s) => (
          <path key={s.key} d={s.d} fill="var(--surface-2)" stroke="var(--gridline)" strokeWidth={0.6} />
        ))}

        <g>
          {shown.map((r) => (
            <path
              key={r.title}
              d={arc(r)}
              fill="none"
              stroke="var(--series-2)"
              strokeWidth={hover?.title === r.title ? 2.6 : 1.1}
              opacity={hover ? (hover.title === r.title ? 1 : 0.16) : 0.5}
              strokeLinecap="round"
              onMouseEnter={() => setHover(r)}
              onMouseMove={(e) =>
                card.show(e, {
                  title: r.name.replace(/ Vande Bharat Express$/, ""),
                  subtitle: `${r.from ?? "?"} → ${r.to ?? "?"}`,
                  rows: [
                    { label: "Train numbers", value: r.trainNumbers.join(" / ") || "—" },
                    { label: "Distance", value: r.distanceKm ? `${r.distanceKm} km` : "—" },
                    { label: "Frequency", value: r.frequency ?? "—" },
                  ],
                  note: "A link between endpoints, not the track the train runs on.",
                })
              }
              onMouseLeave={() => { setHover(null); card.hide(); }}
            />
          ))}
        </g>

        <g>
          {hubs.map((h) => {
            const p = project(h.coord);
            if (!p) return null;
            const r = 2 + (h.services / maxHub) * 6;
            return (
              <g key={h.name}>
                <circle
                  cx={p[0]} cy={p[1]} r={Math.max(r, 5)}
                  fill="var(--series-1)" opacity={0.85}
                  onMouseMove={(e) =>
                    card.show(e, {
                      title: h.name,
                      rows: [{ label: "Services here", value: String(h.services) }],
                      note: "Counted once per service that starts or ends at this station.",
                    })
                  }
                  onMouseLeave={card.hide}
                />
                {h.services >= 4 && (
                  <text x={p[0] + r + 3} y={p[1] + 3} fontSize={9} fill="var(--text-secondary)">
                    {h.name.replace(/ (Junction|Central|Terminus|Jn)$/i, "")}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <HoverCard hover={card.hover} />

      <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
        Each line links a service&rsquo;s two endpoints. It is not the track the train runs on —
        only {tracedCount} of these routes have a mapped alignment, so drawing the rest as real
        paths would imply a survey nobody did. Circle size is how many services start or end at
        that station.
      </p>
    </div>
  );
}
