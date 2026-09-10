"use client";

import { useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import topo from "@/data/geo/india-states.topo.json";
import HoverCard, { useHoverCard } from "@/components/charts/HoverCard";
import type { Site } from "@/lib/sacred";

type StateProps = { name: string | null };

/**
 * Three and a half thousand temples, and what the map is really showing.
 *
 * Every dot is a site Wikidata holds with coordinates. That is a smaller and
 * stranger claim than "India's temples": Tamil Nadu carries 969 dots and Uttar
 * Pradesh 84, which is not a fact about where temples are but about who has
 * been entering them. The filters below are therefore filters on a database,
 * and the caption says so rather than letting the density read as devotion.
 *
 * Dots are drawn small and translucent so that overlap reads as density rather
 * than as a single large marker; at this count, opaque dots would merge the
 * Kerala coast into one solid band and lose the thing worth seeing.
 */

type Lens = "all" | "heritage" | "dated" | "dedicated";

const LENSES: Array<{ id: Lens; label: string; hint: string }> = [
  { id: "all", label: "Every mapped site", hint: "Everything Wikidata places." },
  { id: "heritage", label: "Carrying a heritage listing", hint: "Surveyed and protected by a state body." },
  { id: "dedicated", label: "With a stated dedication", hint: "Wikidata names the figure it is dedicated to." },
  { id: "dated", label: "With a founding date", hint: "A stated inception year." },
];

function passes(s: Site, lens: Lens): boolean {
  if (lens === "heritage") return Boolean(s.heritage);
  if (lens === "dated") return Boolean(s.inception);
  if (lens === "dedicated") return s.dedications.length > 0;
  return true;
}

export default function SacredMap({ sites }: { sites: Site[] }) {
  const [lens, setLens] = useState<Lens>("all");
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

  const shown = useMemo(() => {
    const out: Array<{ s: Site; x: number; y: number }> = [];
    for (const s of sites) {
      if (!passes(s, lens)) continue;
      const p = project([s.lon, s.lat]);
      if (!p) continue;
      out.push({ s, x: p[0], y: p[1] });
    }
    return out;
  }, [sites, lens, project]);

  const active = LENSES.find((l) => l.id === lens);
  // Fewer dots can carry more ink each without merging into a blot.
  const r = shown.length > 2000 ? 1.6 : shown.length > 600 ? 2.2 : 3;
  const opacity = shown.length > 2000 ? 0.42 : 0.7;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {LENSES.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setLens(l.id)}
            aria-pressed={lens === l.id}
            className="rounded-md border px-2.5 py-1.5 text-[12px] transition-colors"
            style={{
              borderColor: lens === l.id ? "var(--series-1)" : "var(--gridline)",
              color: lens === l.id ? "var(--text-primary)" : "var(--text-secondary)",
              background: lens === l.id ? "var(--surface-2)" : "transparent",
            }}
          >
            {l.label}
          </button>
        ))}
        <span className="mono ml-auto text-[12px] tabular-nums text-[color:var(--text-muted)]">
          {shown.length.toLocaleString("en-IN")} drawn
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height: "auto" }}
        role="img"
        aria-label={`${shown.length} temple sites across India, ${active?.label.toLowerCase()}`}
      >
        {statePaths.map((s) => (
          <path key={s.key} d={s.d} fill="var(--surface-2)" stroke="var(--gridline)" strokeWidth={0.6} />
        ))}
        <g>
          {shown.map(({ s, x, y }) => (
            <circle
              key={s.qid}
              cx={x} cy={y} r={r}
              fill="var(--series-2)"
              opacity={opacity}
              onMouseMove={(e) =>
                card.show(e, {
                  title: s.name,
                  subtitle: s.state ?? "state not resolved",
                  rows: [
                    {
                      label: "Dedicated to",
                      value: s.dedications.length > 0
                        ? s.dedications.map((d) => d.figure).join(", ")
                        : "not stated",
                    },
                    { label: "Founded", value: s.inception ? s.inception.slice(0, 4).replace(/^0+/, "") : "—" },
                    { label: "Listing", value: s.heritage ?? "—" },
                  ],
                  note: "As recorded by Wikidata. An absent field means nobody has entered one.",
                })
              }
              onMouseLeave={card.hide}
            />
          ))}
        </g>
      </svg>
      <HoverCard hover={card.hover} />

      <p className="mt-2 text-[11px] leading-relaxed text-[color:var(--text-muted)]">
        {active?.hint} Every dot is a site Wikidata holds with coordinates, which is not the
        same as every temple in India — Tamil Nadu carries 969 of these and Uttar Pradesh 84.
        The density here is the density of the database.
      </p>
    </div>
  );
}
