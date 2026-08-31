"use client";

import { useEffect, useMemo, useRef } from "react";
import { geoOrthographic, geoPath, geoGraticule10 } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import topo from "@/data/geo/india-states.topo.json";

/**
 * The country, turning.
 *
 * ── Why this is not three.js ─────────────────────────────────────────────
 *
 * A WebGL scene would be decoration laid on top of the site. This is the site's
 * own geometry: `d3-geo`'s orthographic projection is a real spherical
 * projection — points behind the horizon are genuinely clipped, great circles
 * curve correctly, and rotating the projection rotates a sphere rather than
 * skewing a picture of one. It is three-dimensional maths rendered as SVG,
 * already a dependency, a few kilobytes rather than several hundred, and it
 * inherits the theme tokens and the accessibility of ordinary markup.
 *
 * ── What it is made of ───────────────────────────────────────────────────
 *
 * Every mark is data this site already publishes. The landmass is the same
 * topology the map page draws. The points are the dated developments the ingest
 * found — the actual events, at the actual coordinates, the most recent
 * brightest. Nothing here is invented to look good: when the pipeline finds
 * nothing for a week, the globe grows quieter, which is the honest behaviour.
 *
 * ── Motion ───────────────────────────────────────────────────────────────
 *
 * Rotation runs on requestAnimationFrame and writes path attributes directly,
 * never through React state — thirty-six polygons re-rendered sixty times a
 * second through the reconciler would cost more than the whole rest of the
 * page. It stops entirely under prefers-reduced-motion, and when the tab is
 * hidden, because an animation nobody is watching is just a drained battery.
 */

type StateProps = { name: string | null };

export interface GlobeEvent {
  coords: [number, number];
  /** 0 = oldest shown, 1 = newest. Drives size and opacity. */
  recency: number;
  title: string;
}

const SIZE = 520;

/**
 * Close orbit, not a spinning marble.
 *
 * The first version drew the whole sphere and spun it. India came out the size
 * of a thumbnail on an otherwise empty ball — the topology here is India's
 * states and nothing else, so a full globe is mostly blank ocean — and a full
 * rotation carried the subject out of frame for most of every cycle.
 *
 * So the projection is scaled until India fills the frame and the sphere's
 * horizon runs off the corners, and the rotation oscillates a few degrees
 * either side of centre rather than turning all the way round. The parallax is
 * real — this is still a sphere seen from a point above 22°N, 78°E — and the
 * subject never leaves the picture.
 */
const SCALE = 560;
/** Centre of the view: roughly the centroid of the Indian landmass. */
const CENTRE_LON = -78;
const TILT = -22;
/** Degrees either side of centre, and seconds for one full sweep. */
const SWING = 15;
const PERIOD_S = 34;

export default function HeroGlobe({ events }: { events: GlobeEvent[] }) {
  const landRef = useRef<SVGPathElement>(null);
  const gratRef = useRef<SVGPathElement>(null);
  const pinsRef = useRef<SVGGElement>(null);
  const frame = useRef<number>(0);

  const { states, graticule } = useMemo(() => {
    const t = topo as unknown as Topology<{ india: GeometryCollection<StateProps> }>;
    return {
      states: feature(t, t.objects.india) as FeatureCollection<Geometry, StateProps>,
      graticule: geoGraticule10(),
    };
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const projection = geoOrthographic()
      .scale(SCALE)
      .translate([SIZE / 2, SIZE / 2])
      .clipAngle(90);
    const path = geoPath(projection);

    let elapsed = 0;
    let lon = CENTRE_LON;
    let last = performance.now();

    const draw = () => {
      projection.rotate([lon, TILT]);
      landRef.current?.setAttribute("d", path(states) ?? "");
      gratRef.current?.setAttribute("d", path(graticule) ?? "");

      // Points are placed by hand rather than through geoPath, because a
      // circle's radius should encode recency rather than scale with the
      // projection. The visibility test is the same one the projection uses:
      // a point is drawn only when it is on the near hemisphere.
      const g = pinsRef.current;
      if (g) {
        // Is this point on the near hemisphere? The cosine of the great-circle
        // angle to the projection centre, positive when the point faces the
        // viewer. Cheaper than asking the projection and gives the same answer.
        const inView = (lo: number, la: number) => {
          const φ1 = (la * Math.PI) / 180;
          const φ2 = (-TILT * Math.PI) / 180;
          const Δλ = ((lo + lon) * Math.PI) / 180;
          return Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(Δλ) > 0.02;
        };
        for (let i = 0; i < g.children.length; i++) {
          const node = g.children[i] as SVGCircleElement;
          const lo = Number(node.dataset.lon);
          const la = Number(node.dataset.lat);
          if (!inView(lo, la)) {
            node.setAttribute("opacity", "0");
            continue;
          }
          const xy = projection([lo, la]);
          if (!xy) {
            node.setAttribute("opacity", "0");
            continue;
          }
          node.setAttribute("cx", String(xy[0]));
          node.setAttribute("cy", String(xy[1]));
          node.setAttribute("opacity", node.dataset.opacity ?? "0.8");
        }
      }
    };

    draw();
    if (reduced) return;

    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      if (!document.hidden) {
        elapsed += dt / 1000;
        // A sine sweep, so the motion eases at each end instead of snapping.
        lon = CENTRE_LON + Math.sin((elapsed / PERIOD_S) * Math.PI * 2) * SWING;
        draw();
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [states, graticule]);

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="h-auto w-full max-w-[520px]"
      role="img"
      aria-label={`A slowly turning globe centred on India, with ${events.length} recent development events marked at the places they were reported.`}
    >
      <defs>
        <radialGradient id="globe-sea" cx="38%" cy="34%">
          <stop offset="0%" stopColor="var(--surface-2)" />
          <stop offset="100%" stopColor="var(--plane)" />
        </radialGradient>
        {/* The glow behind a pin. Kept faint: this is a data mark, not a firework. */}
        <radialGradient id="pin-glow">
          <stop offset="0%" stopColor="var(--series-2)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--series-2)" stopOpacity="0" />
        </radialGradient>

        {/*
          A kolam lattice was tried here as the texture of the empty sea — the
          southern Indian dot-and-loop drawing tradition, chosen over the flag
          and the Ashoka Chakra, which are regulated emblems and would be both
          legally careless and tonally wrong on a site arguing that the numbers
          rather than the symbols are what matter.

          It was removed because it did not work. At an opacity low enough not
          to compete it was indistinguishable from nothing, and at one high
          enough to read it fought the graticule — two line lattices over each
          other are noise, not texture. The graticule already carries the
          lattice; India and the live pins carry the subject. An ornament that
          only exists in a comment about it is not an ornament.
        */}
      </defs>

      {/* The sphere. At this scale its horizon falls outside the frame, which
          is the intended effect: the viewer is close above the subcontinent
          rather than looking at a marble from space. The SVG viewport clips it —
          letting it overflow put the sea on top of the headline. */}
      <rect width={SIZE} height={SIZE} rx="18" fill="url(#globe-sea)" />

      <path ref={gratRef} fill="none" className="stroke-[color:var(--gridline)]" strokeWidth="0.6" opacity="0.55" />
      <path
        ref={landRef}
        className="fill-[color:var(--series-1)]"
        opacity="0.92"
        stroke="var(--plane)"
        strokeWidth="0.5"
      />

      <g ref={pinsRef}>
        {events.map((e, i) => (
          <circle
            key={`${e.coords[0]}-${e.coords[1]}-${i}`}
            data-lon={e.coords[0]}
            data-lat={e.coords[1]}
            data-opacity={(0.35 + e.recency * 0.6).toFixed(2)}
            r={2.2 + e.recency * 3.4}
            className="fill-[color:var(--series-2)]"
            opacity="0"
          >
            <title>{e.title}</title>
          </circle>
        ))}
      </g>
    </svg>
  );
}
