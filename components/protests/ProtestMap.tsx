/**
 * A schematic map of the places reported on 10 October, rendered on the
 * server: Delhi's boundary, the reported sites, and the circle of the mobile
 * data suspension. No street detail — positions are the landmarks' own, placed
 * by this site, and the map says so. Every mark is labelled, and kind is shown
 * by shape as well as colour.
 */
import { geoCircle, geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import indiaTopo from "@/data/geo/india-states.topo.json";
import type { ProtestPlace } from "@/lib/protest-shared";

const topo = indiaTopo as unknown as Topology<{ india: GeometryCollection<{ name: string | null }> }>;
const states = feature(topo, topo.objects.india) as FeatureCollection<Geometry, { name: string | null }>;
const delhi = states.features.find((f) => f.properties?.name === "NCT of Delhi");

const KIND: Record<ProtestPlace["kind"], { label: string; color: string }> = {
  protest: { label: "Protest site", color: "var(--s-cool)" },
  detention: { label: "Detentions reported", color: "var(--s-hot)" },
  restriction: { label: "Mobile data suspended", color: "var(--s-mid)" },
};

/** Labels that would collide at the zoom level are nudged; the rest sit to the right. */
const NUDGE: Record<string, [number, number, "start" | "end"]> = {
  "connaught-place": [8, -8, "start"],
  "jantar-mantar": [-8, 4, "end"],
  "shutdown-centre": [8, 14, "start"],
};

export function ProtestMap({ places, view }: { places: ProtestPlace[]; view: "delhi" | "central" }) {
  const W = 420, H = view === "delhi" ? 440 : 360;
  const proj = geoMercator();
  if (view === "delhi" && delhi) proj.fitExtent([[10, 10], [W - 10, H - 10]], delhi);
  else proj.fitExtent([[10, 10], [W - 10, H - 10]], { type: "MultiPoint", coordinates: [[77.17, 28.585], [77.27, 28.655]] });
  const path = geoPath(proj);
  const ring = places.find((p) => p.radiusKm);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pr-map" role="img"
      aria-label={`Schematic map of ${view === "delhi" ? "Delhi" : "central New Delhi"}: ${places.map((p) => `${p.name} (${KIND[p.kind].label.toLowerCase()})`).join("; ")}.`}>
      <defs><clipPath id={`clip-${view}`}><rect width={W} height={H} rx={8} /></clipPath></defs>
      <g clipPath={`url(#clip-${view})`}>
        <rect width={W} height={H} fill="var(--story-card)" />
        {/* The outline is the site's simplified state boundary: right for the
            whole of Delhi, but at the central zoom its eastern edge would cut
            through New Delhi, so it is drawn only on the overview. */}
        {view === "delhi" && delhi && <path d={path(delhi) ?? undefined} fill="var(--story-bg)" stroke="var(--story-ink-3)" strokeWidth={1} />}
        {view === "delhi" && (() => {
          const a = proj([77.17, 28.655]), b = proj([77.27, 28.585]);
          if (!a || !b) return null;
          return (
            <g>
              <rect x={a[0]} y={a[1]} width={b[0] - a[0]} height={b[1] - a[1]} fill="none" stroke="var(--story-ink-2)" strokeWidth={1} strokeDasharray="3 3" />
              <text x={b[0]} y={a[1] - 6} textAnchor="end" className="pr-map-label">Central New Delhi</text>
            </g>
          );
        })()}
        {ring && (
          <path d={path(geoCircle().center([ring.lon, ring.lat]).radius((ring.radiusKm! / 6371) * (180 / Math.PI))()) ?? undefined}
            fill="var(--s-mid)" fillOpacity={0.1} stroke="var(--s-mid)" strokeWidth={1.5} strokeDasharray="5 4" />
        )}
        {places.map((p) => {
          const xy = proj([p.lon, p.lat]);
          if (!xy || xy[0] < 0 || xy[0] > W || xy[1] < 0 || xy[1] > H) return null;
          const [dx, dy, anchor] = view === "central" && NUDGE[p.id] ? NUDGE[p.id]! : [8, 4, "start" as const];
          // On the overview, the central cluster is labelled on the detailed map instead.
          const inCentre = p.lon > 77.17 && p.lon < 77.27 && p.lat > 28.585 && p.lat < 28.655;
          const labelled = view === "central" || !inCentre;
          const c = KIND[p.kind].color;
          return (
            <g key={p.id}>
              {p.kind === "detention" && <rect x={xy[0] - 5} y={xy[1] - 5} width={10} height={10} rx={2} fill={c} stroke="var(--story-card)" strokeWidth={2} />}
              {p.kind === "protest" && <circle cx={xy[0]} cy={xy[1]} r={6} fill="var(--story-card)" stroke={c} strokeWidth={3} />}
              {p.kind === "restriction" && <path d={`M${xy[0] - 5} ${xy[1]}h10M${xy[0]} ${xy[1] - 5}v10`} stroke={c} strokeWidth={2} />}
              {labelled && <text x={xy[0] + dx} y={xy[1] + dy} textAnchor={anchor} className="pr-map-label">{p.name === "Indira Gandhi International Airport" ? "IGI Airport" : p.name}</text>}
            </g>
          );
        })}
        {view === "central" && <text x={W - 10} y={H - 10} textAnchor="end" className="pr-map-note">about 8 km across</text>}
      </g>
    </svg>
  );
}

export function ProtestMapLegend() {
  return (
    <ul className="pr-legend">
      <li><svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="var(--s-cool)" strokeWidth="2.5" /></svg>Protest site</li>
      <li><svg width="14" height="14" aria-hidden="true"><rect x="2" y="2" width="10" height="10" rx="2" fill="var(--s-hot)" /></svg>Detentions reported</li>
      <li><svg width="22" height="14" aria-hidden="true"><path d="M1 7h20" stroke="var(--s-mid)" strokeWidth="2" strokeDasharray="5 3" /></svg>Mobile data suspended within 4 km</li>
    </ul>
  );
}
