"use client";

import { useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import topo from "@/data/geo/india-states.topo.json";
import HoverCard, { useHoverCard } from "@/components/charts/HoverCard";

type StateProps = { name: string | null };

export interface MobilityMapProps {
  metro: Array<{ id: number; name: string; city: string | null; colour: string | null; path: Array<[number, number]> }>;
  vande: Array<{ id: number; name: string; from: string | null; to: string | null; path: Array<[number, number]> }>;
  airports: Array<{ id: number; name: string; iata: string; lon: number; lat: number }>;
  flights: Array<[number, number, number]>;
  snapshotCount: number;
}

type Layer = "flights" | "metro" | "vande" | "airports";

const LAYERS: Array<{ id: Layer; label: string; hint: string }> = [
  { id: "flights", label: "Aircraft", hint: "pooled positions across every snapshot held" },
  { id: "vande", label: "Vande Bharat", hint: "named services, as mapped route relations" },
  { id: "metro", label: "Metro & light rail", hint: "alignments, not ridership" },
  { id: "airports", label: "Airports", hint: "aerodromes carrying an IATA code" },
];

/**
 * One map, four layers, each a different kind of claim.
 *
 * The layers are deliberately not merged into a single "connectivity" score.
 * A metro alignment is a fact about concrete, a pooled flight position is a
 * sample of a moment, and an airport is a point. Averaging them would produce a
 * number with no unit that nobody could check.
 */
export default function MobilityMap({ metro, vande, airports, flights, snapshotCount }: MobilityMapProps) {
  const [on, setOn] = useState<Record<Layer, boolean>>({
    flights: true, metro: true, vande: true, airports: false,
  });
  const [hover, setHover] = useState<string | null>(null);
  const card = useHoverCard();

  const width = 660, height = 700;

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

  function line(path: Array<[number, number]>): string {
    let d = "";
    for (let i = 0; i < path.length; i++) {
      const p = project(path[i]!);
      if (!p) continue;
      d += (d ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1);
    }
    return d;
  }

  // Flight positions are drawn as low-alpha dots; where the same corridor is
  // sampled repeatedly the dots stack and the trunk routes emerge on their own.
  const flightDots = useMemo(() => {
    const out: Array<{ x: number; y: number; ground: boolean }> = [];
    for (const [lon, lat, alt] of flights) {
      const p = project([lon, lat]);
      if (!p) continue;
      if (p[0] < 0 || p[0] > width || p[1] < 0 || p[1] > height) continue;
      out.push({ x: p[0], y: p[1], ground: alt === 0 });
    }
    return out;
  }, [flights, project]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {LAYERS.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setOn((s) => ({ ...s, [l.id]: !s[l.id] }))}
            aria-pressed={on[l.id]}
            title={l.hint}
            className={`rounded border px-2.5 py-1 text-xs transition-colors ${
              on[l.id]
                ? "border-baseline bg-surface-2 text-ink"
                : "border-gridline text-ink-muted hover:text-ink-2"
            }`}
          >
            {l.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-ink-muted">
          {hover ?? `${flights.length.toLocaleString("en-IN")} aircraft positions · ${snapshotCount} snapshot${snapshotCount === 1 ? "" : "s"}`}
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img"
        aria-label="India with metro alignments, Vande Bharat routes, airports and pooled aircraft positions">
        <g>
          {statePaths.map((s) => (
            <path key={s.key} d={s.d} fill="var(--surface-2)" stroke="var(--gridline)" strokeWidth={0.6} />
          ))}
        </g>

        {on.flights && (
          <g>
            {flightDots.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={p.ground ? 1.1 : 1.6}
                fill={p.ground ? "var(--baseline)" : "var(--series-4)"}
                opacity={p.ground ? 0.5 : 0.42} />
            ))}
          </g>
        )}

        {on.vande && (
          <g>
            {vande.map((v) => (
              <path key={v.id} d={line(v.path)} fill="none"
                stroke="var(--series-2)" strokeWidth={1.6} opacity={0.85}
                strokeLinejoin="round" strokeLinecap="round"
                onMouseEnter={() => setHover(v.name)}
                onMouseMove={(e) => card.show(e, {
                  title: v.name.replace(/^Train\s+/, ""),
                  subtitle: v.from && v.to ? `${v.from} → ${v.to}` : undefined,
                  note: "Alignment traced in OpenStreetMap.",
                })}
                onMouseLeave={() => { setHover(null); card.hide(); }} />
            ))}
          </g>
        )}

        {on.metro && (
          <g>
            {metro.map((m) => (
              <path key={m.id} d={line(m.path)} fill="none"
                stroke="var(--series-1)" strokeWidth={2.2} opacity={0.9}
                strokeLinejoin="round" strokeLinecap="round"
                onMouseEnter={() => setHover(`${m.city ?? "Metro"} — ${m.name}`)}
                onMouseMove={(e) => card.show(e, {
                  title: m.name,
                  subtitle: m.city ?? undefined,
                  note: "Mapped alignment, which may include sections under construction.",
                })}
                onMouseLeave={() => { setHover(null); card.hide(); }} />
            ))}
          </g>
        )}

        {on.airports && (
          <g>
            {airports.map((a) => {
              const p = project([a.lon, a.lat]);
              if (!p) return null;
              return (
                <circle key={a.id} cx={p[0]} cy={p[1]} r={5}
                  fill="transparent" stroke="var(--series-3)" strokeWidth={1}
                  onMouseEnter={() => setHover(`${a.iata} — ${a.name}`)}
                  onMouseMove={(e) => card.show(e, {
                    title: a.name,
                    subtitle: `IATA ${a.iata}`,
                    note: "A location only — nothing here says how busy it is.",
                  })}
                  onMouseLeave={() => { setHover(null); card.hide(); }} />
              );
            })}
          </g>
        )}
      </svg>
      <HoverCard hover={card.hover} />

      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-ink-muted">
        <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: "var(--series-4)" }} />Aircraft aloft</span>
        <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: "var(--baseline)" }} />On the ground</span>
        <span><span className="mr-1.5 inline-block h-0.5 w-4 align-middle" style={{ background: "var(--series-2)" }} />Vande Bharat</span>
        <span><span className="mr-1.5 inline-block h-0.5 w-4 align-middle" style={{ background: "var(--series-1)" }} />Metro &amp; light rail</span>
        <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full border align-middle" style={{ borderColor: "var(--series-3)" }} />Airport</span>
      </div>
    </div>
  );
}
