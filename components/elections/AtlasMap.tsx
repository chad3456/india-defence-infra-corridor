"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import topo from "@/data/geo/india-states.topo.json";
import HoverCard, { useHoverCard } from "@/components/charts/HoverCard";
import { ALLIANCE_COLOUR, ALLIANCE_LABEL, stateForPolygon, type Alliance } from "@/lib/elections-atlas-shared";

/** Per-state facts the map needs, assembled on the server. */
export interface AtlasMapRow {
  slug: string;
  name: string;
  legislature: boolean;
  chiefMinister?: string;
  party?: string;
  alliance?: Alliance;
  stateAlliance?: string;
  election?: number | null;
  /** Share of the pre-revision roll left out of the SIR draft, in percent. */
  sirShare?: number;
  sirLeftOut?: number;
  sirPhase?: string;
  /** Latest assembly and Lok Sabha elections read seat by seat. */
  assembly?: string;
  lokSabha?: string;
}

const RAMP = ["var(--seq-100)", "var(--seq-250)", "var(--seq-400)", "var(--seq-550)", "var(--seq-700)"];
/** Fixed bands in percent of the roll, so a colour means the same thing whatever else is on screen. */
const SIR_BANDS = [5, 10, 15, 20];
const SIR_LABELS = ["under 5%", "5–10%", "10–15%", "15–20%", "20%+"];

type View = "governs" | "sir";

export default function AtlasMap({ rows }: { rows: AtlasMapRow[] }) {
  const [view, setView] = useState<View>("governs");
  const card = useHoverCard();
  const router = useRouter();
  const width = 560, height = 620;

  const { polygons, path } = useMemo(() => {
    const t = topo as unknown as Topology<{ india: GeometryCollection<{ name: string | null }> }>;
    const fc = feature(t, t.objects.india) as FeatureCollection<Geometry, { name: string | null }>;
    const proj = geoMercator().fitSize([width, height], fc);
    return { polygons: fc, path: geoPath(proj) };
  }, []);

  const bySlug = useMemo(() => new Map(rows.map((r) => [r.slug, r])), [rows]);

  function fill(row: AtlasMapRow | undefined): string {
    if (!row) return "url(#atlas-none)";
    if (view === "governs") {
      if (!row.legislature) return "var(--surface-2)";
      return row.alliance ? ALLIANCE_COLOUR[row.alliance] : "url(#atlas-none)";
    }
    if (row.sirShare == null) return "url(#atlas-none)";
    const i = SIR_BANDS.findIndex((b) => row.sirShare! < b);
    return RAMP[i === -1 ? RAMP.length - 1 : i]!;
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { NDA: 0, INDIA: 0, Neither: 0 };
    for (const r of rows) {
      if (!r.alliance) continue;
      if (r.alliance === "NDA") c.NDA!++;
      else if (r.alliance === "INDIA") c.INDIA!++;
      else c.Neither!++;
    }
    return c;
  }, [rows]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2" role="tablist" aria-label="Map shading">
        {([["governs", "Who governs today"], ["sir", "SIR: share of roll left out of the draft"]] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)}
            className={`rounded-full border px-3 py-1 text-xs ${view === id ? "border-ink bg-ink text-[color:var(--surface-1)]" : "border-gridline text-ink-2 hover:text-ink"}`}>
            {label}
          </button>
        ))}
        {view === "governs" && (
          <p className="ml-auto text-xs text-ink-2">
            <strong className="text-ink">{counts.NDA}</strong> NDA · <strong className="text-ink">{counts.INDIA}</strong> INDIA ·{" "}
            <strong className="text-ink">{counts.Neither}</strong> neither, of {rows.filter((r) => r.legislature).length} governments
          </p>
        )}
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[640px]" role="img"
        aria-label={view === "governs" ? "Map of India shaded by the national alliance of each state's government" : "Map of India shaded by the share of each state's roll left out of its SIR draft"}>
        <defs>
          <pattern id="atlas-none" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--surface-2)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--gridline)" strokeWidth="2" />
          </pattern>
        </defs>
        {polygons.features.map((f, i) => {
          const poly = f.properties?.name ?? "";
          const st = poly ? stateForPolygon(poly) : undefined;
          const row = st ? bySlug.get(st.slug) : undefined;
          const ladakh = poly === "Jammu & Kashmir";
          return (
            <path key={`${poly}-${i}`} d={path(f) ?? ""} fill={fill(row)} stroke="var(--surface-1)" strokeWidth={0.8}
              className={row ? "cursor-pointer outline-none transition-opacity hover:opacity-80 focus-visible:opacity-70" : ""}
              tabIndex={row ? 0 : -1}
              onClick={() => row && router.push(`/elections/atlas/${row.slug}`)}
              onKeyDown={(e) => { if (row && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); router.push(`/elections/atlas/${row.slug}`); } }}
              onMouseMove={(e) => row && card.show(e, {
                title: row.name,
                subtitle: row.legislature ? `${row.party ?? "?"} · ${row.alliance ? ALLIANCE_LABEL[row.alliance] : ""}` : "No legislature: governed by the Centre",
                rows: [
                  ...(row.chiefMinister ? [{ label: "Chief minister", value: row.chiefMinister }] : []),
                  ...(row.stateAlliance && row.stateAlliance !== row.alliance ? [{ label: "State alliance", value: row.stateAlliance }] : []),
                  ...(row.election ? [{ label: "Elected", value: String(row.election) }] : []),
                  ...(row.sirLeftOut != null ? [{ label: `SIR draft, phase ${row.sirPhase}`, value: `${row.sirLeftOut.toLocaleString("en-IN")} left out${row.sirShare != null ? ` (${row.sirShare.toFixed(1)}%)` : ""}` }] : []),
                  ...(row.assembly ? [{ label: "Assembly results", value: row.assembly }] : []),
                  ...(row.lokSabha ? [{ label: "Lok Sabha results", value: row.lokSabha }] : []),
                ],
                note: ladakh ? "This boundary file predates the 2019 split; Ladakh, which has no legislature, is drawn inside Jammu and Kashmir. Click to open." : "Click to open the state's results and SIR breakdown.",
              })}
              onMouseLeave={card.hide}>
              <title>{row ? row.name : poly}</title>
            </path>
          );
        })}
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-ink-2">
        {view === "governs" ? (
          <>
            {(["NDA", "INDIA", "Other"] as Alliance[]).map((a) => (
              <span key={a} className="inline-flex items-center gap-1">
                <span className="inline-block h-3 w-5 rounded-sm" style={{ background: ALLIANCE_COLOUR[a] }} />{ALLIANCE_LABEL[a]}
              </span>
            ))}
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-5 rounded-sm border border-gridline" style={{ background: "var(--surface-2)" }} />No legislature
            </span>
          </>
        ) : (
          <>
            {RAMP.map((c, i) => (
              <span key={c} className="inline-flex items-center gap-1">
                <span className="inline-block h-3 w-5 rounded-sm" style={{ background: c }} />{SIR_LABELS[i]}
              </span>
            ))}
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-5 rounded-sm border border-gridline" style={{ background: "var(--surface-2)" }} />No SIR draft figure
            </span>
          </>
        )}
      </div>
      <HoverCard hover={card.hover} />
    </div>
  );
}
