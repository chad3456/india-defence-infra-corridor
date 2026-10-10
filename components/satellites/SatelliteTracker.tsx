"use client";

/**
 * The live satellite tracker on /satellites.
 *
 * Nothing here is a stored position. The page fetches element sets from
 * /api/tle (CelesTrak, with a weekly committed fallback) and runs SGP4 in the
 * browser against the clock, once a second, so every dot is a prediction for
 * this instant from an orbit measured hours or days ago. Each prediction's age
 * is carried to the screen, because SGP4 never fails on an old element set —
 * it just quietly drifts.
 *
 * Colour carries three things only, validated as a set on the dark map:
 * every other satellite (blue), India's fleet (orange, drawn larger and
 * ringed so colour is not the only cue), and the satellite you select (aqua,
 * with its ground track and the circle of ground it can see). Groups are
 * switched on and off rather than coloured: seven hues on a scatter of a
 * thousand dots cannot be told apart.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as satellite from "satellite.js";
import { geoCircle, geoEquirectangular, geoGraticule10, geoMercator, geoPath, type GeoProjection } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry, LineString } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import landTopo from "world-atlas/land-110m.json";
import indiaTopo from "@/data/geo/india-states.topo.json";
import {
  EARTH_RADIUS_KM, eccentricity, elevationDegrees, footprintRadiusKm, inclinationDeg, isOverIndia,
  orbitRegime, periodMinutes, subsolarPoint,
} from "@/lib/satellites-shared";
import { GROUPS, INDIAN_FLEET, type SatRecord, type TleFeed } from "@/lib/tle-source";

const C = { surface: "#0f1522", land: "#1c2537", india: "#25324a", other: "#3987e5", india_: "#d95926", sel: "#199e70" };

const CITIES: Array<{ name: string; lon: number; lat: number }> = [
  { name: "New Delhi", lon: 77.209, lat: 28.6139 },
  { name: "Mumbai", lon: 72.8777, lat: 19.076 },
  { name: "Bengaluru", lon: 77.5946, lat: 12.9716 },
  { name: "Chennai", lon: 80.2707, lat: 13.0827 },
  { name: "Kolkata", lon: 88.3639, lat: 22.5726 },
  { name: "Hyderabad", lon: 78.4867, lat: 17.385 },
  { name: "Guwahati", lon: 91.7362, lat: 26.1445 },
  { name: "Leh", lon: 77.5771, lat: 34.1526 },
  { name: "Port Blair", lon: 92.7265, lat: 11.6234 },
  { name: "Sriharikota", lon: 80.2304, lat: 13.7199 },
];

const SPEEDS = [1, 60, 600] as const;
/** Below this a satellite is too near the horizon to be worth looking for. */
const MIN_ELEVATION = 10;
const ALL_GROUPS = [...GROUPS.map((g) => g.label), INDIAN_FLEET];

interface Sat {
  rec: SatRecord;
  satrec: satellite.SatRec;
  period: number | null;
  incl: number | null;
  ecc: number | null;
}

interface Pos { lon: number; lat: number; alt: number; speed: number }

type View = "world" | "india";

const states = feature(
  indiaTopo as unknown as Topology<{ india: GeometryCollection<{ name: string | null }> }>,
  (indiaTopo as unknown as Topology<{ india: GeometryCollection<{ name: string | null }> }>).objects.india,
) as FeatureCollection<Geometry, { name: string | null }>;
const land = feature(
  landTopo as unknown as Topology<{ land: GeometryCollection }>,
  (landTopo as unknown as Topology<{ land: GeometryCollection }>).objects.land,
) as unknown as Feature<Geometry>;
const graticule = geoGraticule10();

function propagate(s: Sat, when: Date): Pos | null {
  const pv = satellite.propagate(s.satrec, when);
  if (!pv || typeof pv.position !== "object" || typeof pv.velocity !== "object") return null;
  const geo = satellite.eciToGeodetic(pv.position, satellite.gstime(when));
  const v = pv.velocity;
  const alt = geo.height;
  if (!Number.isFinite(alt) || alt < 80) return null;
  // Speed over the ground is not the orbital speed; the page shows the
  // orbital speed, labelled as such.
  return {
    lon: satellite.degreesLong(geo.longitude), lat: satellite.degreesLat(geo.latitude), alt,
    speed: Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z),
  };
}

const fmtAge = (d: number | null) => (d === null ? "unknown" : d < 1 ? `${Math.max(1, Math.round(d * 24))} h` : `${d.toFixed(1)} days`);
const fmtKm = (v: number) => `${Math.round(v).toLocaleString("en-IN")} km`;
const ist = (d: Date) => d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const istDate = (d: Date) => d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });

export function SatelliteTracker() {
  const [feed, setFeed] = useState<TleFeed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState<Set<string>>(() => new Set(ALL_GROUPS));
  const [selected, setSelected] = useState<number | null>(null);
  const [view, setView] = useState<View>("world");
  const [city, setCity] = useState(CITIES[0]!);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [query, setQuery] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; id: number } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const posRef = useRef<Map<number, Pos>>(new Map());
  const screenRef = useRef<Array<{ id: number; x: number; y: number }>>([]);
  const clockRef = useRef({ real: Date.now(), sim: Date.now(), speed: 1 });
  const [size, setSize] = useState({ w: 0, h: 0 });

  /* ── load ── */
  useEffect(() => {
    let alive = true;
    fetch("/api/tle")
      .then(async (r) => {
        const j = await r.json() as TleFeed & { error?: string };
        if (!alive) return;
        if (!r.ok || j.satellites.length === 0) { setError(j.error ?? `the element-set feed answered ${r.status}`); return; }
        setFeed(j);
      })
      .catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    const q = new URLSearchParams(window.location.search).get("sat");
    if (q && /^\d+$/.test(q)) setSelected(Number(q));
    return () => { alive = false; };
  }, []);

  const sats = useMemo<Sat[]>(() => (feed?.satellites ?? []).flatMap((rec) => {
    try {
      const satrec = satellite.twoline2satrec(rec.line1, rec.line2);
      return [{ rec, satrec, period: periodMinutes(rec.line2), incl: inclinationDeg(rec.line2), ecc: eccentricity(rec.line2) }];
    } catch { return []; }
  }), [feed]);
  const byId = useMemo(() => new Map(sats.map((s) => [s.rec.noradId, s])), [sats]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sats) m.set(s.rec.group, (m.get(s.rec.group) ?? 0) + 1);
    return m;
  }, [sats]);
  const indianTotal = useMemo(() => sats.filter((s) => s.rec.indian).length, [sats]);

  /* ── size ── */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e!.contentRect.width);
      setSize({ w, h: Math.round(view === "world" ? w / 2 : Math.min(w * 1.1, 640)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  const projection = useMemo<GeoProjection | null>(() => {
    if (size.w === 0) return null;
    if (view === "world") return geoEquirectangular().fitExtent([[0, 0], [size.w, size.h]], { type: "Sphere" });
    // India and the sky around it, south past the equator so the
    // geostationary belt where India parks its GSAT and NavIC satellites is in
    // frame.
    // Corners as points, not a polygon: a polygon's winding decides which
    // side is inside, and the wrong one fits the rest of the world.
    return geoMercator().fitExtent([[8, 8], [size.w - 8, size.h - 30]], { type: "MultiPoint", coordinates: [[56, -12], [106, 40]] });
  }, [size, view]);

  /* ── draw ── */
  const draw = useCallback((when: Date) => {
    const cv = canvasRef.current;
    if (!cv || !projection) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // Both dimensions: switching views keeps the width and changes the height,
    // and a stale buffer is stretched to the new box rather than redrawn.
    const bw = Math.round(size.w * dpr), bh = Math.round(size.h * dpr);
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const path = geoPath(projection, ctx);
    ctx.fillStyle = C.surface;
    ctx.fillRect(0, 0, size.w, size.h);

    ctx.beginPath(); path(graticule); ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); path(land); ctx.fillStyle = C.land; ctx.fill();
    ctx.beginPath(); path(states); ctx.fillStyle = C.india; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.lineWidth = 0.6; ctx.stroke();

    // Night: everything more than 90 degrees from the point under the sun.
    const [sl, sb] = subsolarPoint(when);
    ctx.beginPath(); path(geoCircle().center([sl + 180, -sb]).radius(90)()); ctx.fillStyle = "rgba(0,0,0,0.32)"; ctx.fill();

    const sel = selected !== null ? byId.get(selected) : undefined;
    const selPos = selected !== null ? posRef.current.get(selected) : undefined;
    if (sel && selPos) {
      // What it can see: everything within the horizon circle.
      const r = (footprintRadiusKm(selPos.alt) / EARTH_RADIUS_KM) * (180 / Math.PI);
      ctx.beginPath(); path(geoCircle().center([selPos.lon, selPos.lat]).radius(r)());
      ctx.fillStyle = "rgba(25,158,112,0.12)"; ctx.fill(); ctx.strokeStyle = "rgba(25,158,112,0.7)"; ctx.lineWidth = 1; ctx.stroke();
      // Ground track: half an orbit behind, one ahead. Not drawn for orbits
      // longer than ten hours, which barely move over the ground.
      if (sel.period !== null && sel.period < 600) {
        const pts: Array<[number, number]> = [];
        const ahead: Array<[number, number]> = [];
        const step = sel.period / 160;
        for (let m = -sel.period / 2; m <= sel.period; m += step) {
          const p = propagate(sel, new Date(when.getTime() + m * 60_000));
          if (!p) continue;
          (m <= 0 ? pts : ahead).push([p.lon, p.lat]);
        }
        ahead.unshift([selPos.lon, selPos.lat]);
        ctx.setLineDash([3, 4]);
        ctx.beginPath(); path({ type: "LineString", coordinates: pts } as LineString); ctx.strokeStyle = "rgba(25,158,112,0.55)"; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath(); path({ type: "LineString", coordinates: ahead } as LineString); ctx.strokeStyle = C.sel; ctx.lineWidth = 2; ctx.stroke();
      }
    }

    // Observer.
    const o = projection([city.lon, city.lat]);
    if (o) {
      ctx.strokeStyle = "#f0efec"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(o[0] - 5, o[1]); ctx.lineTo(o[0] + 5, o[1]); ctx.moveTo(o[0], o[1] - 5); ctx.lineTo(o[0], o[1] + 5); ctx.stroke();
    }

    // Satellites: others first, India's fleet over them, the selection on top.
    const screen: Array<{ id: number; x: number; y: number }> = [];
    const layer = (indian: boolean) => {
      for (const s of sats) {
        // India's satellites show while either their group or the fleet is on.
        const shown = visible.has(s.rec.group) || (s.rec.indian && visible.has(INDIAN_FLEET));
        if (s.rec.indian !== indian || !shown) continue;
        const p = posRef.current.get(s.rec.noradId);
        if (!p) continue;
        const xy = projection([p.lon, p.lat]);
        if (!xy || xy[0] < -4 || xy[1] < -4 || xy[0] > size.w + 4 || xy[1] > size.h + 4) continue;
        screen.push({ id: s.rec.noradId, x: xy[0], y: xy[1] });
        ctx.beginPath();
        ctx.arc(xy[0], xy[1], indian ? 3.6 : 2.1, 0, Math.PI * 2);
        ctx.fillStyle = indian ? C.india_ : C.other;
        ctx.globalAlpha = indian ? 1 : 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;
        if (indian) { ctx.lineWidth = 1.2; ctx.strokeStyle = C.surface; ctx.stroke(); }
      }
    };
    layer(false);
    layer(true);
    screenRef.current = screen;

    // Name the two crewed stations, and the selection.
    ctx.font = "600 11px ui-sans-serif, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    const label = (id: number, text: string, color: string) => {
      const p = posRef.current.get(id);
      const xy = p && projection([p.lon, p.lat]);
      if (!xy) return;
      ctx.lineWidth = 3; ctx.strokeStyle = C.surface; ctx.strokeText(text, xy[0] + 7, xy[1]);
      ctx.fillStyle = color; ctx.fillText(text, xy[0] + 7, xy[1]);
    };
    if (visible.has("Space stations")) {
      if (selected !== 25544) label(25544, "ISS", "#f0efec");
      if (selected !== 48274) label(48274, "Tiangong", "#f0efec");
    }
    if (sel && selPos) {
      const xy = projection([selPos.lon, selPos.lat]);
      if (xy) {
        ctx.beginPath(); ctx.arc(xy[0], xy[1], 6, 0, Math.PI * 2);
        ctx.fillStyle = C.sel; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#f0efec"; ctx.stroke();
        label(sel.rec.noradId, sel.rec.name, "#f0efec");
      }
    }
  }, [projection, size, sats, byId, visible, selected, city]);

  /* ── clock and propagation ── */
  const tick = useCallback(() => {
    const c = clockRef.current;
    const when = new Date(c.sim + (Date.now() - c.real) * c.speed);
    const m = new Map<number, Pos>();
    for (const s of sats) {
      const p = propagate(s, when);
      if (p) m.set(s.rec.noradId, p);
    }
    posRef.current = m;
    setNow(when);
    draw(when);
  }, [sats, draw]);

  useEffect(() => {
    if (sats.length === 0) return;
    tick();
    const id = window.setInterval(tick, SPEEDS[speedIdx] === 1 ? 1000 : 250);
    return () => window.clearInterval(id);
  }, [sats, tick, speedIdx]);

  const setSpeed = (i: number) => {
    const c = clockRef.current;
    const simNow = c.sim + (Date.now() - c.real) * c.speed;
    clockRef.current = { real: Date.now(), sim: simNow, speed: SPEEDS[i]! };
    setSpeedIdx(i);
  };
  const backToNow = () => { clockRef.current = { real: Date.now(), sim: Date.now(), speed: 1 }; setSpeedIdx(0); tick(); };

  const select = (id: number | null) => {
    setSelected(id);
    const u = new URL(window.location.href);
    if (id === null) u.searchParams.delete("sat"); else u.searchParams.set("sat", String(id));
    window.history.replaceState(null, "", u);
  };

  const nearest = (clientX: number, clientY: number, radius: number) => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return null;
    const x = clientX - r.left, y = clientY - r.top;
    let best: { id: number; x: number; y: number } | null = null;
    let bd = radius * radius;
    for (const p of screenRef.current) {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  };

  /* ── derived lists, recomputed each tick ── */
  const lists = useMemo(() => {
    if (!now) return null;
    const over: Array<{ s: Sat; p: Pos; state: string }> = [];
    const up: Array<{ s: Sat; p: Pos; el: number }> = [];
    for (const s of sats) {
      const p = posRef.current.get(s.rec.noradId);
      if (!p) continue;
      // A cheap box before the exact test: only points near India can be in it.
      if (p.lon > 67 && p.lon < 98 && p.lat > 6 && p.lat < 37.5) {
        const st = isOverIndia(p.lon, p.lat, states);
        if (st !== null) over.push({ s, p, state: st });
      }
      const el = elevationDegrees([city.lon, city.lat], { lon: p.lon, lat: p.lat, altKm: p.alt });
      if (el >= MIN_ELEVATION) up.push({ s, p, el });
    }
    over.sort((a, b) => Number(b.s.rec.indian) - Number(a.s.rec.indian) || a.p.alt - b.p.alt);
    up.sort((a, b) => b.el - a.el);
    const fleet = sats.filter((s) => s.rec.indian).map((s) => ({ s, p: posRef.current.get(s.rec.noradId) ?? null }))
      .sort((a, b) => a.s.rec.name.localeCompare(b.s.rec.name, "en", { numeric: true }));
    return { over, up, fleet };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, sats, city]);

  const sel = selected !== null ? byId.get(selected) ?? null : null;
  const selPos = selected !== null ? posRef.current.get(selected) ?? null : null;
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return sats.filter((s) => s.rec.name.toLowerCase().includes(q) || String(s.rec.noradId) === q).slice(0, 8);
  }, [query, sats]);
  const live = SPEEDS[speedIdx] === 1 && now !== null && Math.abs(now.getTime() - Date.now()) < 5_000;
  const hoverSat = hover ? byId.get(hover.id) : undefined;
  const hoverPos = hover ? posRef.current.get(hover.id) : undefined;

  const toggle = (g: string) => setVisible((v) => { const n = new Set(v); if (n.has(g)) n.delete(g); else n.add(g); return n; });

  return (
    <div className="st">
      {/* status */}
      <div className="st-status" aria-live="polite">
        {error ? (
          <p className="st-warn"><b>No orbits to draw.</b> {error}. Nothing is shown rather than an empty sky passed off as one.</p>
        ) : !feed ? (
          <p>Fetching element sets from CelesTrak…</p>
        ) : (
          <>
            <p>
              <span className={`st-dot${live ? " on" : ""}`} aria-hidden="true" />
              <b>{!live ? `Time ×${SPEEDS[speedIdx]}` : feed.origin === "live" ? "Live" : "Real-time clock"}</b>
              {now && <> · {istDate(now)} {ist(now)} IST</>}
              {" "}· {sats.length.toLocaleString("en-IN")} objects, {indianTotal} of them India&rsquo;s
              {" "}· orbits from CelesTrak, median {fmtAge(feed.medianEpochDays)} old
            </p>
            {feed.origin !== "live" && (
              <p className="st-warn">
                {feed.origin === "snapshot" ? "CelesTrak did not answer, so every orbit comes" : `Some groups did not answer (${feed.failed.join(", ")}), so their orbits come`} from
                the weekly snapshot{feed.snapshotAt ? ` of ${istDate(new Date(feed.snapshotAt))}` : ""}. Older elements put satellites further from where they really are; each
                one&rsquo;s age is shown when you select it.
              </p>
            )}
          </>
        )}
      </div>

      {/* controls */}
      <div className="st-controls">
        <div className="st-chips" role="group" aria-label="Which satellites">
          {ALL_GROUPS.map((g) => (
            <button key={g} type="button" aria-pressed={visible.has(g)} onClick={() => toggle(g)} className={g === INDIAN_FLEET ? "in" : undefined}>
              {g === INDIAN_FLEET && <i aria-hidden="true" />}{g} <small>{g === INDIAN_FLEET ? indianTotal : counts.get(g) ?? 0}</small>
            </button>
          ))}
        </div>
        <div className="st-row">
          <div className="st-seg" role="group" aria-label="Map">
            <button type="button" aria-pressed={view === "world"} onClick={() => setView("world")}>World</button>
            <button type="button" aria-pressed={view === "india"} onClick={() => setView("india")}>India</button>
          </div>
          <div className="st-seg" role="group" aria-label="Clock speed">
            {SPEEDS.map((s, i) => <button key={s} type="button" aria-pressed={speedIdx === i} onClick={() => setSpeed(i)}>{s === 1 ? "Real time" : `×${s}`}</button>)}
            {!live && now && <button type="button" onClick={backToNow}>Back to now</button>}
          </div>
          <label className="st-search">
            <span className="sr-only">Find a satellite</span>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find: ISS, Cartosat, 25544…" />
            {matches.length > 0 && (
              <ul className="st-matches">
                {matches.map((s) => (
                  <li key={s.rec.noradId}><button type="button" onClick={() => { select(s.rec.noradId); setQuery(""); }}>{s.rec.name} <small>{s.rec.group}</small></button></li>
                ))}
              </ul>
            )}
          </label>
        </div>
      </div>

      {/* map */}
      <div className="st-map" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          style={{ width: size.w, height: size.h }}
          role="img"
          aria-label={`Map of ${sats.length} satellites at their predicted positions now${sel ? `; selected: ${sel.rec.name}` : ""}. The lists below carry the same information as text.`}
          onPointerMove={(e) => { const n = nearest(e.clientX, e.clientY, 12); setHover(n ? { x: n.x, y: n.y, id: n.id } : null); }}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => {
            // In a dense belt, select what the tooltip is already naming.
            if (hover) { select(hover.id); return; }
            const n = nearest(e.clientX, e.clientY, 16);
            select(n ? n.id : null);
          }}
        />
        {hover && hoverSat && hoverPos && (
          <div className="st-tip" style={{ left: Math.min(hover.x + 12, size.w - 190), top: Math.max(4, hover.y - 52) }}>
            <b>{hoverSat.rec.name}</b>
            <span>{hoverSat.rec.group} · {fmtKm(hoverPos.alt)} up</span>
          </div>
        )}
        <ul className="st-legend" aria-hidden="true">
          <li><i style={{ background: C.other }} />Satellite</li>
          <li><i className="ring" style={{ background: C.india_ }} />India&rsquo;s</li>
          <li><i style={{ background: C.sel }} />Selected, its track and the ground it can see</li>
          <li><i className="night" />Night</li>
          <li><b>+</b> {city.name}</li>
        </ul>
      </div>

      {/* selected */}
      {sel && (
        <section className="st-card st-sel" aria-label={`Selected: ${sel.rec.name}`}>
          <header>
            <div>
              <p className="st-kicker">{sel.rec.indian ? "India's fleet · " : ""}{sel.rec.group}</p>
              <h3>{sel.rec.name}</h3>
            </div>
            <button type="button" onClick={() => select(null)} aria-label="Clear selection">×</button>
          </header>
          {selPos ? (
            <dl className="st-facts">
              <div><dt>Above</dt><dd>{Math.abs(selPos.lat).toFixed(2)}°{selPos.lat >= 0 ? "N" : "S"}, {Math.abs(selPos.lon).toFixed(2)}°{selPos.lon >= 0 ? "E" : "W"}{(() => { const st = isOverIndia(selPos.lon, selPos.lat, states); return st ? ` — over ${st}` : ""; })()}</dd></div>
              <div><dt>Altitude</dt><dd>{fmtKm(selPos.alt)}</dd></div>
              <div><dt>Orbital speed</dt><dd>{selPos.speed.toFixed(2)} km/s</dd></div>
              <div><dt>Orbit</dt><dd>{orbitRegime(selPos.alt, sel.period, sel.ecc)}{sel.period !== null ? `, ${sel.period < 600 ? `${sel.period.toFixed(1)} min` : `${(sel.period / 60).toFixed(1)} h`} a lap` : ""}{sel.incl !== null ? `, ${sel.incl.toFixed(1)}° to the equator` : ""}</dd></div>
              <div><dt>Sees the ground within</dt><dd>{fmtKm(footprintRadiusKm(selPos.alt))} of the point beneath it</dd></div>
              <div><dt>From {city.name}</dt><dd>{(() => { const el = elevationDegrees([city.lon, city.lat], { lon: selPos.lon, lat: selPos.lat, altKm: selPos.alt }); return el >= 0 ? `${el.toFixed(0)}° above the horizon` : "below the horizon"; })()}</dd></div>
              <div><dt>Orbit measured</dt><dd>{fmtAge(sel.rec.epochAgeDays)} before the feed was fetched{(sel.rec.epochAgeDays ?? 0) > 3 ? " — old enough that this position may be tens of kilometres out" : ""}</dd></div>
              <div><dt>Catalogue</dt><dd>NORAD {sel.rec.noradId} · <a href={`https://celestrak.org/satcat/table-satcat.php?CATNR=${sel.rec.noradId}`} target="_blank" rel="noopener noreferrer">CelesTrak record</a></dd></div>
            </dl>
          ) : (
            <p className="st-note">No position: SGP4 could not propagate this element set to the current time.</p>
          )}
        </section>
      )}

      {/* lists */}
      {lists && (
        <div className="st-lists">
          <section className="st-card">
            <h3>Over India now <small>{lists.over.length}</small></h3>
            <p className="st-note">Satellites whose point on the ground is inside India&rsquo;s boundary this second. Low ones cross the country in a few minutes.</p>
            {lists.over.length === 0 ? <p className="st-empty">None of the tracked satellites is directly over India this second.</p> : (
              <ol className="st-list">
                {lists.over.slice(0, 14).map(({ s, p, state }) => (
                  <li key={s.rec.noradId}>
                    <button type="button" onClick={() => select(s.rec.noradId)} className={s.rec.indian ? "in" : undefined}>
                      <b>{s.rec.name}</b><span>{state} · {fmtKm(p.alt)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="st-card">
            <h3>
              Above the horizon from{" "}
              <select value={city.name} onChange={(e) => setCity(CITIES.find((c) => c.name === e.target.value)!)} aria-label="Observer city">
                {CITIES.map((c) => <option key={c.name}>{c.name}</option>)}
              </select>
              <small>{lists.up.length}</small>
            </h3>
            <p className="st-note">At least {MIN_ELEVATION}° up, highest first. Being above the horizon is not being visible to the eye: that needs the satellite in sunlight and the sky dark.</p>
            <ol className="st-list">
              {lists.up.slice(0, 14).map(({ s, p, el }) => (
                <li key={s.rec.noradId}>
                  <button type="button" onClick={() => select(s.rec.noradId)} className={s.rec.indian ? "in" : undefined}>
                    <b>{s.rec.name}</b><span>{el.toFixed(0)}° up · {orbitRegime(p.alt, s.period, s.ecc)}</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>

          <section className="st-card st-wide">
            <h3>India&rsquo;s fleet <small>{lists.fleet.length}</small></h3>
            <p className="st-note">Found by catalogue name, so a satellite whose name does not start with an Indian programme&rsquo;s is missing rather than miscounted. Includes satellites that no longer work but are still in orbit.</p>
            <div className="st-table-wrap">
              <table className="st-table">
                <thead><tr><th>Satellite</th><th>Orbit</th><th>Altitude</th><th>Now over</th><th>Orbit measured</th></tr></thead>
                <tbody>
                  {lists.fleet.map(({ s, p }) => {
                    const st = p && p.lon > 67 && p.lon < 98 && p.lat > 6 && p.lat < 37.5 ? isOverIndia(p.lon, p.lat, states) : null;
                    return (
                      <tr key={s.rec.noradId} aria-selected={selected === s.rec.noradId}>
                        <td><button type="button" onClick={() => select(s.rec.noradId)}>{s.rec.name}</button></td>
                        <td>{p ? orbitRegime(p.alt, s.period, s.ecc) : "—"}</td>
                        <td className="num">{p ? fmtKm(p.alt) : "—"}</td>
                        <td>{p ? (st ? st : `${Math.abs(p.lat).toFixed(0)}°${p.lat >= 0 ? "N" : "S"} ${Math.abs(p.lon).toFixed(0)}°${p.lon >= 0 ? "E" : "W"}`) : "no position"}</td>
                        <td className="num">{fmtAge(s.rec.epochAgeDays)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

