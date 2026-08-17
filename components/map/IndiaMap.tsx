"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import topo from "@/data/geo/india-states.topo.json";
import corridors from "@/data/geo/corridors.json";

type Cities = Record<string, [number, number]>;
type StateProps = { name: string | null };

interface Expressway {
  id: string;
  name: string;
  path: string[];
  lengthKm: number;
  openedYear: number;
  status: string;
  note?: string;
}

const MIN_YEAR = 2001;
const MAX_YEAR = 2026;

export default function IndiaMap() {
  const [year, setYear] = useState(MAX_YEAR);
  const [playing, setPlaying] = useState(false);
  const [showNodes, setShowNodes] = useState(true);
  const [hovered, setHovered] = useState<Expressway | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const width = 620;
  const height = 660;

  const { states, path, projection } = useMemo(() => {
    const t = topo as unknown as Topology<{ india: GeometryCollection<StateProps> }>;
    const fc = feature(t, t.objects.india) as FeatureCollection<Geometry, StateProps>;
    const proj = geoMercator().fitSize([width, height], fc);
    return { states: fc, path: geoPath(proj), projection: proj };
  }, []);

  const cities = corridors.cities as unknown as Cities;
  const expressways = corridors.expressways as Expressway[];
  const nodes = corridors.defenceCorridorNodes;

  // Timelapse loop.
  useEffect(() => {
    if (!playing) {
      if (timer.current) clearInterval(timer.current);
      return;
    }
    timer.current = setInterval(() => {
      setYear((y) => {
        if (y >= MAX_YEAR) {
          setPlaying(false);
          return MAX_YEAR;
        }
        return y + 1;
      });
    }, 550);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing]);

  function project(cityId: string): [number, number] | null {
    const c = cities[cityId];
    if (!c) return null;
    return projection(c) ?? null;
  }

  function lineFor(e: Expressway): string {
    const pts = e.path.map(project).filter((p): p is [number, number] => p !== null);
    if (pts.length < 2) return "";
    return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  }

  const visible = expressways.filter((e) => e.openedYear <= year);
  const operationalKm = visible
    .filter((e) => e.status === "operational")
    .reduce((n, e) => n + e.lengthKm, 0);
  const inProgressKm = visible
    .filter((e) => e.status !== "operational")
    .reduce((n, e) => n + e.lengthKm, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <div className="relative rounded-lg border bg-[var(--surface-1)] p-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={`Map of India showing major expressway corridors open as of ${year}`}>
          {/* states */}
          <g>
            {states.features.map((f, i) => (
              <path
                key={i}
                d={path(f) ?? ""}
                fill="var(--surface-2)"
                stroke="var(--gridline)"
                strokeWidth={0.5}
              />
            ))}
          </g>

          {/* expressway corridors */}
          <g>
            {visible.map((e) => {
              const isOp = e.status === "operational";
              const active = hovered?.id === e.id;
              return (
                <g key={e.id}>
                  {/* wide invisible hit target */}
                  <path
                    d={lineFor(e)}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={14}
                    onMouseEnter={() => setHovered(e)}
                    onMouseLeave={() => setHovered(null)}
                    style={{ cursor: "pointer" }}
                  />
                  <path
                    d={lineFor(e)}
                    fill="none"
                    stroke={isOp ? "var(--series-1)" : "var(--series-2)"}
                    strokeWidth={active ? 4 : 2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={isOp ? undefined : "5 4"}
                    opacity={active ? 1 : 0.9}
                  />
                  {e.path.map((c) => {
                    const p = project(c);
                    if (!p) return null;
                    return (
                      <circle
                        key={`${e.id}-${c}`}
                        cx={p[0]}
                        cy={p[1]}
                        r={2.5}
                        fill={isOp ? "var(--series-1)" : "var(--series-2)"}
                        stroke="var(--surface-1)"
                        strokeWidth={1.5}
                      />
                    );
                  })}
                </g>
              );
            })}
          </g>

          {/* defence corridor nodes — only once the corridors were announced (2018) */}
          {showNodes && year >= 2018 && (
            <g>
              {nodes.map((n) => {
                const p = project(n.city);
                if (!p) return null;
                return (
                  <g key={n.id}>
                    <circle
                      cx={p[0]}
                      cy={p[1]}
                      r={5}
                      fill="var(--series-3)"
                      fillOpacity={0.25}
                      stroke="var(--series-3)"
                      strokeWidth={1.5}
                    />
                    <title>{`${n.name} — ${n.corridor} defence corridor node`}</title>
                  </g>
                );
              })}
            </g>
          )}

          {/* year stamp */}
          <text
            x={width - 14}
            y={40}
            textAnchor="end"
            fontSize={40}
            fontWeight={600}
            fill="var(--text-primary)"
            opacity={0.12}
            className="tnum"
          >
            {year}
          </text>
        </svg>

        {hovered && (
          <div className="pointer-events-none absolute left-3 top-3 max-w-[240px] rounded border bg-[var(--surface-1)] px-2.5 py-2 shadow-sm">
            <p className="text-[12px] font-medium">{hovered.name}</p>
            <p className="tnum mt-0.5 text-[11px] text-[color:var(--text-secondary)]">
              {hovered.lengthKm.toLocaleString("en-IN")} km · opened {hovered.openedYear} ·{" "}
              {hovered.status}
            </p>
            {hovered.note && (
              <p className="mt-1 text-[10px] leading-snug text-[color:var(--text-muted)]">
                {hovered.note}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="space-y-4">
        <div className="rounded-lg border bg-[var(--surface-1)] p-3">
          <div className="flex items-baseline justify-between">
            <span className="eyebrow">year</span>
            <span className="tnum text-[20px] font-semibold leading-none">{year}</span>
          </div>
          <input
            type="range"
            min={MIN_YEAR}
            max={MAX_YEAR}
            value={year}
            onChange={(e) => {
              setPlaying(false);
              setYear(Number(e.target.value));
            }}
            className="mt-3 w-full accent-[var(--series-1)]"
            aria-label="Year"
          />
          <div className="mt-1 flex justify-between text-[10px] text-[color:var(--text-muted)]">
            <span>{MIN_YEAR}</span>
            <span>{MAX_YEAR}</span>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                if (year >= MAX_YEAR) setYear(MIN_YEAR);
                setPlaying((p) => !p);
              }}
              className="flex-1 rounded border px-2 py-1.5 text-[11px] transition-colors hover:bg-[var(--surface-2)]"
            >
              {playing ? "❚❚ pause" : "▶ play timelapse"}
            </button>
            <button
              onClick={() => {
                setPlaying(false);
                setYear(MIN_YEAR);
              }}
              className="rounded border px-2 py-1.5 text-[11px] transition-colors hover:bg-[var(--surface-2)]"
            >
              reset
            </button>
          </div>
        </div>

        <div className="rounded-lg border bg-[var(--surface-1)] p-3">
          <p className="eyebrow">as of {year}</p>
          <dl className="mt-2 space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <dt className="text-[color:var(--text-secondary)]">Corridors open</dt>
              <dd className="tnum font-medium">
                {visible.filter((e) => e.status === "operational").length}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[color:var(--text-secondary)]">Operational km</dt>
              <dd className="tnum font-medium">{operationalKm.toLocaleString("en-IN")}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[color:var(--text-secondary)]">In-progress km</dt>
              <dd className="tnum font-medium">{inProgressKm.toLocaleString("en-IN")}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border bg-[var(--surface-1)] p-3">
          <p className="eyebrow mb-2">legend</p>
          <ul className="space-y-1.5 text-[11px]">
            <li className="flex items-center gap-2">
              <span className="h-0.5 w-5 rounded" style={{ background: "var(--series-1)" }} />
              <span className="text-[color:var(--text-secondary)]">Operational expressway</span>
            </li>
            <li className="flex items-center gap-2">
              <span
                className="h-0.5 w-5 rounded"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(90deg, var(--series-2) 0 5px, transparent 5px 9px)",
                }}
              />
              <span className="text-[color:var(--text-secondary)]">Partly open / under construction</span>
            </li>
            <li className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full border"
                style={{ borderColor: "var(--series-3)", background: "color-mix(in srgb, var(--series-3) 25%, transparent)" }}
              />
              <span className="text-[color:var(--text-secondary)]">Defence corridor node</span>
            </li>
          </ul>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-[11px]">
            <input
              type="checkbox"
              checked={showNodes}
              onChange={(e) => setShowNodes(e.target.checked)}
              className="accent-[var(--series-3)]"
            />
            <span className="text-[color:var(--text-secondary)]">Show defence corridor nodes</span>
          </label>
        </div>

        <p className="text-[10px] leading-snug text-[color:var(--text-muted)]">
          Corridor lines are schematic — straight segments between real geocoded endpoint cities,
          not surveyed alignments. Opening years are the load-bearing fact here; the geometry only
          shows roughly where and when capacity appeared.
        </p>
      </div>
    </div>
  );
}
