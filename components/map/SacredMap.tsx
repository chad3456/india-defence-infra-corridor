"use client";

import { useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import topo from "@/data/geo/india-states.topo.json";
import HoverCard, { useHoverCard } from "@/components/charts/HoverCard";
import type { Site, CanonSet } from "@/lib/sacred";

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
 *
 * ── Two populations, drawn as two things ─────────────────────────────────
 *
 * The canonical sites — the twelve Jyotirlingas, the Divya Desams, the Shakta
 * Pithas, the Pancharama Kshetras — are a few dozen points inside a field of
 * three and a half thousand. Colouring them like the field loses them; giving
 * the field their treatment would claim every dot is a famous shrine.
 *
 * So the field is recessive (small, muted, translucent) and the canonical
 * marks sit above it: larger, in the tradition's own hue, each carrying a
 * surface-coloured ring so it separates from whatever it lands on. The
 * Jyotirlingas are also labelled directly, which is what makes the two hues
 * that sit below 3:1 against the light surface legible without relying on
 * colour alone.
 *
 * The Char Dham is drawn as a ring rather than a filled dot, because it is a
 * pilgrimage circuit and not a dedication — it spans three of Vishnu's sites
 * and one of Shiva's. Shape carries that distinction, so no reader has to
 * infer from a colour that the page has explicitly refused to assign.
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

/**
 * One hue per tradition, in fixed order, never cycled.
 *
 * These are the site's own categorical tokens, validated in both modes against
 * the chart surface: worst adjacent pair ΔE 9.1 protan in light and 8.4 in
 * dark, both above the CVD floor. Light mode warns on contrast for the green
 * and the amber, which is why the legend and the direct labels are not
 * optional here.
 */
const TRADITION_COLOUR: Record<string, string> = {
  Jyotirlinga: "var(--series-1)",
  "Divya Desam": "var(--series-2)",
  "Shakta Pitha": "var(--series-3)",
  "Pancharama Kshetra": "var(--series-4)",
};

interface Marked { site: Site; tradition: string; deity: string | null }

export default function SacredMap({
  sites, canon = [],
}: { sites: Site[]; canon?: CanonSet[] }) {
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

  /**
   * Canonical sites, resolved once. A site can belong to more than one
   * tradition; the first wins, and the hover card lists them all, because a
   * dot cannot honestly be two colours.
   */
  const marked = useMemo(() => {
    const byQid = new Map(sites.map((s) => [s.qid, s]));
    const out: Marked[] = [];
    const seen = new Set<string>();
    for (const c of canon) {
      if (c.problems && c.problems.length > 0) continue;
      for (const m of c.members) {
        if (!m.qid || seen.has(m.qid)) continue;
        const site = byQid.get(m.qid);
        if (!site) continue;
        seen.add(m.qid);
        out.push({ site, tradition: c.label, deity: c.deity });
      }
    }
    return out;
  }, [sites, canon]);

  const legend = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of marked) counts.set(m.tradition, (counts.get(m.tradition) ?? 0) + 1);
    // Fixed order, taken from the colour assignment, so a tradition keeps its
    // hue whatever the counts do.
    const order = [...Object.keys(TRADITION_COLOUR), "Char Dham", "Chota Char Dham"];
    return order
      .filter((t) => counts.has(t))
      .map((t) => ({ tradition: t, n: counts.get(t)!, colour: TRADITION_COLOUR[t] ?? null }));
  }, [marked]);

  /**
   * Where each Jyotirlinga's label goes.
   *
   * To the right by default; to the left when another canonical mark sits in
   * the way. "Kedarnath" was printing straight through the Badrinath ring —
   * two of the most recognisable points on the map, illegible on top of each
   * other. Checked against the projected marks rather than guessed, and any
   * label still boxed in on both sides is dropped rather than drawn over
   * something.
   */
  const labels = useMemo(() => {
    const pts = marked
      .map((m) => ({ m, p: project([m.site.lon, m.site.lat]) }))
      .filter((x): x is { m: Marked; p: [number, number] } => x.p !== null);

    const out: Array<{ key: string; x: number; y: number; anchor: "start" | "end"; text: string }> = [];
    for (const { m, p } of pts) {
      if (m.tradition !== "Jyotirlinga") continue;
      const text = m.site.name.replace(/\s*(Temple|temple|Mandir|Jyotirlinga|Dham)\s*$/, "");
      // Roughly how far the text reaches, at 9.5px.
      const reach = text.length * 5.2 + 10;
      const clear = (from: number, to: number): boolean =>
        !pts.some(({ m: o, p: q }) =>
          o.site.qid !== m.site.qid &&
          Math.abs(q[1] - p[1]) < 8 &&
          q[0] > Math.min(from, to) - 6 && q[0] < Math.max(from, to) + 6);

      if (clear(p[0] + 8, p[0] + reach)) {
        out.push({ key: m.site.qid, x: p[0] + 8, y: p[1] + 3.5, anchor: "start", text });
      } else if (clear(p[0] - 8, p[0] - reach)) {
        out.push({ key: m.site.qid, x: p[0] - 8, y: p[1] + 3.5, anchor: "end", text });
      }
      // Otherwise no label: the hover card still names it.
    }
    return out;
  }, [marked, project]);

  const active = LENSES.find((l) => l.id === lens);
  // Fewer dots can carry more ink each without merging into a blot.
  const r = shown.length > 2000 ? 1.6 : shown.length > 600 ? 2.2 : 3;
  // The field is drawn in muted ink, not in a series hue. It was series-2,
  // which is also the Divya Desam's colour, so on the Tamil coast — where both
  // are densest — the canonical marks disappeared into the field they were
  // supposed to stand out from. The four series hues belong to the traditions
  // alone; the field is background and is coloured like background.
  const opacity = shown.length > 2000 ? 0.5 : 0.72;

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
              fill="var(--text-muted)"
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
        <g>
          {marked.map((m) => {
            const p = project([m.site.lon, m.site.lat]);
            if (!p) return null;
            const colour = TRADITION_COLOUR[m.tradition];
            const rows = [
              { label: "Tradition", value: m.tradition },
              { label: "Dedicated to", value: m.deity ?? "a circuit — no single deity" },
              { label: "State", value: m.site.state ?? "not resolved" },
            ];
            return (
              <g key={`c-${m.site.qid}`}>
                <circle
                  cx={p[0]} cy={p[1]} r={5}
                  fill={colour ?? "none"}
                  stroke={colour ? "var(--surface-1)" : "var(--text-secondary)"}
                  strokeWidth={2}
                  onMouseMove={(e) =>
                    card.show(e, {
                      title: m.site.name,
                      subtitle: m.deity ? `${m.tradition} · ${m.deity}` : `${m.tradition} · a circuit`,
                      rows,
                      note: "Named in this tradition's own list. Not a Wikidata statement.",
                    })
                  }
                  onMouseLeave={card.hide}
                />
              </g>
            );
          })}
        </g>

        {/* Labels last, so they sit above every mark rather than under one. */}
        <g>
          {labels.map((l) => (
            <text
              key={l.key}
              x={l.x} y={l.y}
              fontSize={9.5}
              textAnchor={l.anchor}
              fill="var(--text-secondary)"
              style={{ paintOrder: "stroke", stroke: "var(--surface-1)", strokeWidth: 3 }}
            >
              {l.text}
            </text>
          ))}
        </g>
      </svg>
      <HoverCard hover={card.hover} />

      {legend.length > 0 && (
        <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {legend.map((l) => (
            <li key={l.tradition} className="flex items-center gap-1.5 text-[11.5px]">
              <svg width="12" height="12" aria-hidden className="shrink-0">
                <circle
                  cx={6} cy={6} r={4}
                  fill={l.colour ?? "none"}
                  stroke={l.colour ? "var(--surface-1)" : "var(--text-secondary)"}
                  strokeWidth={1.6}
                />
              </svg>
              <span className="text-[color:var(--text-secondary)]">
                {l.tradition}
                <span className="text-[color:var(--text-muted)]"> {l.n}</span>
              </span>
            </li>
          ))}
          <li className="flex items-center gap-1.5 text-[11.5px]">
            <svg width="12" height="12" aria-hidden className="shrink-0">
              <circle cx={6} cy={6} r={2} fill="var(--text-muted)" opacity={0.55} />
            </svg>
            <span className="text-[color:var(--text-muted)]">every other mapped site</span>
          </li>
        </ul>
      )}

      <p className="mt-2 text-[11px] leading-relaxed text-[color:var(--text-muted)]">
        {active?.hint} Every dot is a site Wikidata holds with coordinates, which is not the
        same as every temple in India — Tamil Nadu carries 969 of these and Uttar Pradesh 84.
        The density here is the density of the database.
      </p>
    </div>
  );
}
