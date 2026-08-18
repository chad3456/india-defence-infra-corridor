"use client";

import { useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import topo from "@/data/geo/india-states.topo.json";
import type { DevEvent, EventCategory } from "@/lib/types";
import { EVENT_CATEGORIES, CATEGORY_LABEL } from "@/lib/events";

type StateProps = { name: string | null };

/**
 * Category colours.
 *
 * Twelve categories is far past the eight a categorical palette can keep
 * separable, so hue is NOT the identity channel here: the panel row, the
 * tooltip and the pin label all name the category in text. Colour only groups
 * pins at a glance, and the selected category is additionally isolated by
 * dimming the rest.
 */
const CAT_COLOR: Record<EventCategory, string> = {
  infrastructure: "var(--series-1)",
  "roads-airports": "var(--series-2)",
  defence: "var(--series-3)",
  manufacturing: "var(--series-4)",
  startups: "var(--series-1)",
  exports: "var(--series-2)",
  "trade-deals": "var(--series-3)",
  energy: "var(--series-4)",
  pipelines: "var(--series-1)",
  ports: "var(--series-2)",
  space: "var(--series-3)",
  "psu-msme": "var(--series-4)",
};

type Mode = "recent" | "all";

interface Cluster {
  key: string;
  coords: [number, number];
  placeName: string;
  state: string;
  events: DevEvent[];
}

export default function DevelopmentMap({
  events,
  recentDays = 2,
  latestDate,
}: {
  events: DevEvent[];
  recentDays?: number;
  latestDate: string | null;
}) {
  const [mode, setMode] = useState<Mode>("all");
  const [category, setCategory] = useState<EventCategory | null>(null);
  const [selected, setSelected] = useState<Cluster | null>(null);

  const width = 620;
  const height = 660;

  const { states, path, projection } = useMemo(() => {
    const t = topo as unknown as Topology<{ india: GeometryCollection<StateProps> }>;
    const fc = feature(t, t.objects.india) as FeatureCollection<Geometry, StateProps>;
    const proj = geoMercator().fitSize([width, height], fc);
    return { states: fc, path: geoPath(proj), projection: proj };
  }, []);

  // The recent window is measured from the newest event, not from now — see
  // lib/events.ts. Recomputed here so the two panels always agree.
  const inWindow = useMemo(() => {
    if (mode === "all" || !latestDate) return events;
    const cutoff = new Date(new Date(latestDate).getTime() - recentDays * 86_400_000)
      .toISOString()
      .slice(0, 10);
    return events.filter((e) => e.date >= cutoff);
  }, [events, mode, recentDays, latestDate]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of inWindow) c[e.category] = (c[e.category] ?? 0) + 1;
    return c;
  }, [inWindow]);

  const visible = useMemo(
    () => (category ? inWindow.filter((e) => e.category === category) : inWindow),
    [inWindow, category],
  );

  // Group by place so a city with eight events is one pin showing "8".
  const clusters = useMemo(() => {
    const map = new Map<string, Cluster>();
    for (const e of visible) {
      if (!e.coords || !e.placeName) continue;
      const key = e.placeId ?? `${e.coords[0]},${e.coords[1]}`;
      const existing = map.get(key);
      if (existing) existing.events.push(e);
      else
        map.set(key, {
          key,
          coords: e.coords,
          placeName: e.placeName,
          state: e.state ?? "",
          events: [e],
        });
    }
    // Biggest last so heavy pins draw on top of light ones.
    return [...map.values()].sort((a, b) => a.events.length - b.events.length);
  }, [visible]);

  const unplaced = visible.filter((e) => !e.coords).length;
  const maxCount = Math.max(1, ...clusters.map((c) => c.events.length));

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      {/* ---------------- Left panel ---------------- */}
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border bg-[var(--surface-1)] p-3">
          <p className="text-[13px] leading-snug">
            <span className="text-[18px] font-semibold">{inWindow.length}</span>{" "}
            {inWindow.length === 1 ? "development" : "developments"}{" "}
            {mode === "recent" ? `in the last ${recentDays} days` : "on record"}
          </p>

          <div
            className="mt-2.5 flex rounded-md border p-0.5"
            role="group"
            aria-label="Time range"
          >
            {(
              [
                ["recent", `Last ${recentDays} days`],
                ["all", "All time"],
              ] as Array<[Mode, string]>
            ).map(([m, label]) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setSelected(null);
                }}
                aria-pressed={mode === m}
                className={`flex-1 rounded px-2 py-1 text-[11px] transition-colors ${
                  mode === m
                    ? "bg-[var(--text-primary)] text-[color:var(--surface-1)]"
                    : "text-[color:var(--text-secondary)] hover:bg-[var(--surface-2)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <nav className="overflow-hidden rounded-lg border bg-[var(--surface-1)]">
          <button
            onClick={() => {
              setCategory(null);
              setSelected(null);
            }}
            aria-pressed={category === null}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] transition-colors ${
              category === null ? "bg-[var(--surface-2)] font-medium" : "hover:bg-[var(--surface-2)]"
            }`}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full border"
              style={{ borderColor: "var(--text-muted)" }}
              aria-hidden
            />
            <span className="flex-1">All categories</span>
            <span className="tnum text-[11px] text-[color:var(--text-muted)]">
              {inWindow.length}
            </span>
          </button>

          <ul className="divide-y border-t">
            {EVENT_CATEGORIES.map((c) => {
              const n = counts[c.id] ?? 0;
              const active = category === c.id;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => {
                      setCategory(active ? null : c.id);
                      setSelected(null);
                    }}
                    disabled={n === 0}
                    aria-pressed={active}
                    title={c.hint}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] transition-colors ${
                      active ? "bg-[var(--surface-2)] font-medium" : "hover:bg-[var(--surface-2)]"
                    } ${n === 0 ? "cursor-default opacity-40" : ""}`}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: CAT_COLOR[c.id] }}
                      aria-hidden
                    />
                    <span className="flex-1 truncate">{c.label}</span>
                    <span className="tnum text-[11px] text-[color:var(--text-muted)]">{n}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {unplaced > 0 && (
          <p className="text-[10px] leading-snug text-[color:var(--text-muted)]">
            {unplaced} {unplaced === 1 ? "event" : "events"} in this view could not be placed to a
            city or state and {unplaced === 1 ? "is" : "are"} not pinned. An unplaceable event is
            listed but never guessed onto the map.
          </p>
        )}
      </div>

      {/* ---------------- Map ---------------- */}
      <div className="relative rounded-lg border bg-[var(--surface-1)] p-2">
        {events.length === 0 ? (
          <div className="flex h-[420px] flex-col items-center justify-center gap-2">
            <span className="eyebrow">no events ingested yet</span>
            <p className="max-w-[320px] text-center text-[11px] leading-snug text-[color:var(--text-muted)]">
              Events are built from the news pipeline. Run{" "}
              <span className="mono">npm run etl</span>, or wait for the scheduled Action.
            </p>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-auto w-full"
            role="img"
            aria-label={`Map of India showing ${visible.length} development events`}
          >
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

            <g>
              {clusters.map((c) => {
                const p = projection(c.coords);
                if (!p) return null;
                const n = c.events.length;
                // Area-proportional, so a cluster of 8 does not look 8x wider
                // than one of 1 — radius scales with the square root.
                const r = 5 + 9 * Math.sqrt(n / maxCount);
                const isSelected = selected?.key === c.key;
                const color = CAT_COLOR[c.events[0]!.category];
                return (
                  <g
                    key={c.key}
                    onClick={() => setSelected(isSelected ? null : c)}
                    style={{ cursor: "pointer" }}
                  >
                    <circle
                      cx={p[0]}
                      cy={p[1]}
                      r={r + 4}
                      fill={color}
                      fillOpacity={isSelected ? 0.22 : 0.1}
                    />
                    <circle
                      cx={p[0]}
                      cy={p[1]}
                      r={r}
                      fill={color}
                      fillOpacity={0.85}
                      stroke="var(--surface-1)"
                      strokeWidth={2}
                    />
                    {n > 1 && (
                      <text
                        x={p[0]}
                        y={p[1] + 3.5}
                        textAnchor="middle"
                        fontSize={10}
                        fontWeight={600}
                        fill="#fff"
                        className="tnum"
                        style={{ pointerEvents: "none" }}
                      >
                        {n}
                      </text>
                    )}
                    <title>{`${c.placeName}, ${c.state} — ${n} ${n === 1 ? "event" : "events"}`}</title>
                  </g>
                );
              })}
            </g>
          </svg>
        )}

        {/* Selected cluster detail */}
        {selected && (
          <div className="absolute bottom-3 left-3 right-3 max-h-[240px] overflow-auto rounded-lg border bg-[var(--surface-1)] p-3 shadow-sm">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <p className="text-[13px] font-medium">
                {selected.placeName}
                <span className="ml-1.5 text-[11px] font-normal text-[color:var(--text-muted)]">
                  {selected.state}
                </span>
              </p>
              <button
                onClick={() => setSelected(null)}
                className="eyebrow hover:text-[color:var(--text-primary)]"
              >
                close
              </button>
            </div>
            <ul className="divide-y">
              {selected.events.map((e) => (
                <li key={e.id} className="py-2">
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="group block"
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span
                        className="rounded-full px-1.5 py-px text-[9px] text-white"
                        style={{ background: CAT_COLOR[e.category] }}
                      >
                        {CATEGORY_LABEL[e.category]}
                      </span>
                      <span className="eyebrow">{e.outlet}</span>
                      <span className="text-[10px] text-[color:var(--text-muted)]">{e.date}</span>
                      <span
                        className="text-[9px] uppercase tracking-wide text-[color:var(--text-muted)]"
                        title={
                          e.status === "verified"
                            ? "From a government primary release"
                            : "Single press report, not corroborated against a primary source"
                        }
                      >
                        {e.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] leading-snug group-hover:underline">
                      {e.title}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
