/**
 * The three.js stage behind /space: a holographic NISAR, and a wireframe Earth
 * with the satellites India flies around it.
 *
 * Two worlds share one scene and cross-fade. The satellite world is drawn in
 * metres around the spacecraft; the Earth world is drawn with Earth's radius
 * as 20 units, in an inertial frame — the globe turns under it with sidereal
 * time, so a satellite's orbit stays put while the ground slides beneath it,
 * as it does in fact.
 *
 * ── What is a measurement and what is a picture ───────────────────────────
 *
 * Measurements: every satellite position on the globe is propagated in the
 * browser from CelesTrak's public element sets with SGP4, for the actual
 * current time (or a stated multiple of it); whether NISAR is sunlit and which
 * ground stations can see it are computed from those positions. The
 * reflector's and boom's lengths are NISAR's published ones.
 *
 * Pictures: the radar pulses, the downlink packets, the sun's rays, the star
 * sensor's sight lines and the launch path are diagrams of how a thing works,
 * not records of any moment. The launch path is schematic.
 */
import * as THREE from "three";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import landTopo from "world-atlas/land-110m.json";
import indiaTopo from "@/data/geo/india-states.topo.json";
import * as sgp4 from "@/lib/sgp4";
import { subsolarPoint, orbitRegime, eccentricity, periodMinutes } from "@/lib/satellites-shared";
import { PART_ORDER, circularPeriodMin, type LiveState, type Origin, type PartId } from "@/lib/space-story";
import { buildModel } from "./model";

export type SceneId =
  | "hero" | "orbit" | "launch" | "deploy" | "power" | "pointing" | "radar" | "data" | "heat"
  | "exploded" | "scale" | "ground" | "fleet" | "india";

export interface StageData {
  parts: Array<{ id: PartId; name: string; origin: Origin; stat: string | null }>;
  originColours: Record<Origin, string>;
  places: Array<{ id: string; name: string; kind: "launch" | "ground"; lat: number; lon: number }>;
  nisar: { altKm: number; inclinationDeg: number };
}

export interface LiveSat { name: string; line1: string; line2: string }

export interface Stage {
  setScene(id: SceneId): void;
  setActive(active: boolean): void;
  setLive(nisar: LiveSat | null, fleet: LiveSat[]): void;
  setWarp(x: number): void;
  onLive(cb: (s: LiveState | null, extra: { contacts: string[]; fleet: Record<string, number> }) => void): void;
  resize(): void;
  dispose(): void;
}

const C = {
  bg: "#02050b", holo: "#5fd4ff", dim: "#1b4a66", hot: "#ffffff", amber: "#ffb547", pink: "#ff6b8b", green: "#3ddc97",
  land: "#3c8fd0", grid: "#123047", india: "#ffb547", orbit: "#5fd4ff", gold: "#ffcf6b", star: "#cfe6ff",
  leo: "#5fd4ff", geo: "#ffb547", other: "#c9a2ff",
};

const RE = 20, KM = RE / 6371;
const rad = Math.PI / 180;

/** Earth-fixed lat/lon/alt to scene coordinates in the Earth group's own frame. */
function ecef(lat: number, lon: number, altKm = 0): THREE.Vector3 {
  const r = RE + altKm * KM, la = lat * rad, lo = lon * rad;
  return new THREE.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
}
/** Inertial km (TEME) to scene coordinates: scene y is Earth's axis. */
const eci = (p: { x: number; y: number; z: number }) => new THREE.Vector3(p.x * KM, p.z * KM, -p.y * KM);

const lineMat = (colour: string, opacity: number, depthTest = true) => {
  const m = new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, depthTest });
  m.userData.base = opacity;
  return m;
};
const pointsMat = (size: number, opacity = 1) => {
  const m = new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  m.userData.base = opacity;
  return m;
};
function segGeo(seg: number[]) { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3)); return g; }

function lonLatLines(lines: number[][][], lift: number): number[] {
  const out: number[] = [];
  for (const l of lines) for (let i = 1; i < l.length; i++) {
    const a = ecef(l[i - 1]![1]!, l[i - 1]![0]!, lift), b = ecef(l[i]![1]!, l[i]![0]!, lift);
    out.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  return out;
}

interface Spec {
  world: "sat" | "earth";
  cam: { pos: [number, number, number]; look: [number, number, number] } | { lat: number; lon: number; dist: number; up?: number };
  highlight?: PartId[];
  colour?: "holo" | "origin";
  apart?: number;
  deploy?: "loop" | number;
  labels?: "highlight" | "numbers" | "none";
  fx?: Array<"limb" | "radar" | "downlink" | "sun" | "stars" | "scan" | "scale" | "wheels">;
  earth?: Array<"orbit" | "nisar" | "fleet" | "stations" | "launch" | "places" | "geo">;
  spin?: number;
}

const SPECS: Record<SceneId, Spec> = {
  hero: { world: "sat", cam: { pos: [-16, 9, 30], look: [3, 3.5, 0] }, fx: ["limb", "stars"], spin: 0.08 },
  orbit: { world: "earth", cam: { pos: [46, 38, 92], look: [0, 0, 0] }, earth: ["orbit", "nisar"] },
  launch: { world: "earth", cam: { lat: 4, lon: 92, dist: 52, up: 6 }, earth: ["launch", "places"] },
  deploy: { world: "sat", cam: { pos: [-14, 8, 30], look: [3, 4, 0] }, deploy: "loop", highlight: ["boom", "reflector"], labels: "highlight", fx: ["stars"] },
  power: { world: "sat", cam: { pos: [-18, 6, 14], look: [-1, 1, 0] }, highlight: ["solar", "battery"], labels: "highlight", fx: ["sun", "stars"] },
  pointing: { world: "sat", cam: { pos: [-11, 5, 9], look: [-0.5, 0.5, 0] }, highlight: ["wheels", "startrackers", "propulsion"], labels: "highlight", fx: ["stars", "wheels"] },
  radar: { world: "sat", cam: { pos: [-22, 4, 38], look: [5, -6, 0] }, highlight: ["reflector", "boom", "lband", "sband", "ris"], labels: "highlight", fx: ["limb", "radar"] },
  data: { world: "sat", cam: { pos: [20, -4, 46], look: [-4, -12, 4] }, highlight: ["recorder", "kaband", "gps", "ttc"], labels: "highlight", fx: ["limb", "downlink"] },
  heat: { world: "sat", cam: { pos: [-9, 4, 9], look: [0, 0.5, 0] }, highlight: ["thermal"], labels: "highlight", fx: ["sun"] },
  exploded: { world: "sat", cam: { pos: [-24, 14, 50], look: [3, 2.5, 0] }, apart: 1, colour: "origin", labels: "numbers", fx: ["stars"] },
  scale: { world: "sat", cam: { pos: [0, 6, 34], look: [4, 5, 0] }, fx: ["scan", "scale"] },
  ground: { world: "earth", cam: { lat: 12, lon: 82, dist: 70, up: 4 }, earth: ["stations", "nisar", "orbit"] },
  fleet: { world: "earth", cam: { pos: [60, 90, 300], look: [0, 0, 0] }, earth: ["fleet", "geo"] },
  india: { world: "earth", cam: { lat: 20, lon: 80, dist: 58, up: 2 }, earth: ["places", "fleet"] },
};

const PLACE_NUDGE: Record<string, [number, number]> = { blr: [-90, -4], "shar-gs": [60, 16], tvm: [-30, 16], pb: [20, 0], kulasekarapattinam: [0, 16] };
const NUM_NUDGE: Partial<Record<PartId, [number, number]>> = { sband: [50, -16], wheels: [-10, 14] };
const LABEL_NUDGE: Partial<Record<PartId, [number, number]>> = {
  ris: [-40, -40], lband: [-120, -12], sband: [-110, 26], ttc: [-90, 26], kaband: [80, 14], wheels: [50, -18], startrackers: [-50, 0], propulsion: [0, 22], battery: [0, 24],
};

export function createStage(canvas: HTMLCanvasElement, overlay: HTMLDivElement, data: StageData, reduced: boolean): Stage {
  const narrow = window.innerWidth < 720;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, narrow ? 1.5 : 1.75));
  renderer.setClearColor(C.bg);
  const labels = new CSS2DRenderer({ element: overlay });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 4000);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.62, 0.42, 0.18);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const disposables: Array<{ dispose(): void }> = [];
  const keep = <T extends { dispose(): void }>(x: T): T => { disposables.push(x); return x; };
  const partName = Object.fromEntries(data.parts.map((p) => [p.id, p])) as Record<PartId, StageData["parts"][number]>;

  /* ── Stars: decoration, never data ─────────────────────────────────── */
  const stars = (() => {
    const n = 1400, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    let s = 7;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < n; i++) {
      const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1), R = 1500;
      pos.set([R * Math.sin(ph) * Math.cos(th), R * Math.cos(ph), R * Math.sin(ph) * Math.sin(th)], i * 3);
      const b = 0.25 + 0.75 * r() ** 3; col.set([b * 0.8, b * 0.9, b], i * 3);
    }
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const p = new THREE.Points(g, keep(pointsMat(narrow ? 1.4 : 1.8, 0.9)));
    scene.add(p);
    return p;
  })();

  /* ── The satellite world ───────────────────────────────────────────── */
  const sat = new THREE.Group();
  scene.add(sat);
  const model = buildModel();
  disposables.push(model);
  sat.add(model.root);
  const partCol: Record<PartId, { cur: THREE.Color; want: THREE.Color; op: number; wantOp: number }> = {} as never;
  for (const id of PART_ORDER) partCol[id] = { cur: new THREE.Color(C.holo), want: new THREE.Color(C.holo), op: 1, wantOp: 1 };

  // A curve of Earth below the spacecraft: a graticule on a large sphere whose top sits 30 m down.
  const fxGroup: Record<string, THREE.Object3D> = {};
  {
    const g = new THREE.Group();
    const seg: number[] = [], R = 320, cy = -350;
    for (let la = 60; la <= 88; la += 2) {
      const ph = la * rad, r = R * Math.cos(ph), y = cy + R * Math.sin(ph);
      for (let i = 0; i < 96; i++) { const a0 = (i / 96) * Math.PI * 2, a1 = ((i + 1) / 96) * Math.PI * 2; seg.push(r * Math.cos(a0), y, r * Math.sin(a0), r * Math.cos(a1), y, r * Math.sin(a1)); }
    }
    for (let k = 0; k < 72; k++) {
      const a = (k / 72) * Math.PI * 2;
      for (let la = 60; la < 90; la += 2) { const p0 = la * rad, p1 = (la + 2) * rad; seg.push(R * Math.cos(p0) * Math.cos(a), cy + R * Math.sin(p0), R * Math.cos(p0) * Math.sin(a), R * Math.cos(p1) * Math.cos(a), cy + R * Math.sin(p1), R * Math.cos(p1) * Math.sin(a)); }
    }
    g.add(new THREE.LineSegments(keep(segGeo(seg)), keep(lineMat(C.grid, 0.55))));
    sat.add(g);
    fxGroup.limb = g;
  }

  // Radar: a fan from the reflector to a swath on the ground, pulses down, echoes up.
  const dishCentre = (model.parts.reflector.group.userData.dishCentre as THREE.Vector3).clone();
  const GROUND_Y = -30;
  const swath = [new THREE.Vector3(-4, GROUND_Y, -14), new THREE.Vector3(-4, GROUND_Y, 14), new THREE.Vector3(20, GROUND_Y, 14), new THREE.Vector3(20, GROUND_Y, -14)];
  const radar = (() => {
    const g = new THREE.Group();
    const seg: number[] = [];
    for (const c of swath) seg.push(dishCentre.x, dishCentre.y, dishCentre.z, c.x, c.y, c.z);
    for (let i = 0; i < 4; i++) { const a = swath[i]!, b = swath[(i + 1) % 4]!; seg.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    g.add(new THREE.LineSegments(keep(segGeo(seg)), keep(lineMat(C.holo, 0.35))));
    // The strip of ground being imaged, ruled across, scrolling as the satellite flies.
    const strip: number[] = [];
    for (let i = 0; i <= 28; i++) { const z = -14 + i; strip.push(-4, GROUND_Y + 0.02, z, 20, GROUND_Y + 0.02, z); }
    const stripLines = new THREE.LineSegments(keep(segGeo(strip)), keep(lineMat(C.green, 0.5)));
    g.add(stripLines);
    const pulses: THREE.LineLoop[] = [], echoes: THREE.LineLoop[] = [];
    for (let k = 0; k < 6; k++) {
      const p = new THREE.LineLoop(keep(segGeo([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])), keep(lineMat(C.holo, 0.9)));
      const e = new THREE.LineLoop(keep(segGeo([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])), keep(lineMat(C.pink, 0.8)));
      g.add(p, e); pulses.push(p); echoes.push(e);
    }
    sat.add(g);
    fxGroup.radar = g;
    return { pulses, echoes, stripLines };
  })();

  // Downlink: packets from the Ka-band dish to a ground station.
  const kaAt = new THREE.Vector3(0.9, -1.85, -0.2), stationAt = new THREE.Vector3(-14, GROUND_Y, 10);
  const downlink = (() => {
    const g = new THREE.Group();
    g.add(new THREE.LineSegments(keep(segGeo([kaAt.x, kaAt.y, kaAt.z, stationAt.x, stationAt.y, stationAt.z])), keep(lineMat(C.amber, 0.25))));
    const seg: number[] = [];
    // The station: a dish on a pedestal.
    for (let i = 0; i < 24; i++) { const a0 = (i / 24) * Math.PI * 2, a1 = ((i + 1) / 24) * Math.PI * 2; seg.push(stationAt.x + 1.6 * Math.cos(a0), stationAt.y + 2.2, stationAt.z + 1.6 * Math.sin(a0), stationAt.x + 1.6 * Math.cos(a1), stationAt.y + 2.2, stationAt.z + 1.6 * Math.sin(a1)); seg.push(stationAt.x + 1.6 * Math.cos(a0), stationAt.y + 2.2, stationAt.z + 1.6 * Math.sin(a0), stationAt.x, stationAt.y + 1.4, stationAt.z); }
    seg.push(stationAt.x, stationAt.y, stationAt.z, stationAt.x, stationAt.y + 1.4, stationAt.z);
    g.add(new THREE.LineSegments(keep(segGeo(seg)), keep(lineMat(C.amber, 0.9))));
    const n = 40, pos = new Float32Array(n * 3), col = new Float32Array(n * 3).fill(1);
    for (let i = 0; i < n; i++) col.set([1, 0.72, 0.3], i * 3);
    const pg = keep(new THREE.BufferGeometry()); pg.setAttribute("position", new THREE.BufferAttribute(pos, 3)); pg.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(pg, keep(pointsMat(narrow ? 3 : 4)));
    g.add(pts);
    sat.add(g);
    fxGroup.downlink = g;
    return { pg, n };
  })();

  // Sunlight: parallel rays arriving at the arrays.
  const sun = (() => {
    const g = new THREE.Group();
    const n = 260, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), seed = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { seed.set([Math.random(), -1.6 + Math.random() * 3.2, -6.5 + Math.random() * 13], i * 3); col.set([1, 0.85, 0.45], i * 3); }
    const pg = keep(new THREE.BufferGeometry()); pg.setAttribute("position", new THREE.BufferAttribute(pos, 3)); pg.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.add(new THREE.Points(pg, keep(pointsMat(narrow ? 2 : 2.6, 0.9))));
    sat.add(g);
    fxGroup.sun = g;
    return { pg, seed, n };
  })();

  // Star sensors' sight lines to three catalogue stars (illustrative).
  const sight = (() => {
    const g = new THREE.Group();
    const seg: number[] = [];
    for (const [sx, sy, sz] of [[-1.25, 1.2, 0.65], [-1.25, 1.2, -0.65]] as const) for (const t of [[-30, 40, 20], [-40, 30, -10], [-20, 45, -30]] as const) seg.push(sx, sy, sz, t[0], t[1], t[2] + sz * 4);
    g.add(new THREE.LineSegments(keep(segGeo(seg)), keep(lineMat(C.star, 0.35))));
    const sp: number[] = [];
    for (const t of [[-30, 40, 20], [-40, 30, -10], [-20, 45, -30], [-30, 40, 22.6], [-40, 30, -7.4], [-20, 45, -27.4]]) sp.push(...t);
    const pg = keep(new THREE.BufferGeometry()); pg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3)); pg.setAttribute("color", new THREE.Float32BufferAttribute(sp.map(() => 1), 3));
    g.add(new THREE.Points(pg, keep(pointsMat(5))));
    sat.add(g);
    fxGroup.wheels = g;
    return g;
  })();
  void sight;

  // X-ray scan: a ruled plane sweeping through the spacecraft.
  const scan = (() => {
    const seg: number[] = [];
    for (let i = 0; i <= 20; i++) { const x = -8 + i * 1.2; seg.push(x, 0, -8, x, 0, 8); }
    for (let j = 0; j <= 16; j++) { const z = -8 + j; seg.push(-8, 0, z, 16, 0, z); }
    const l = new THREE.LineSegments(keep(segGeo(seg)), keep(lineMat(C.green, 0.35)));
    sat.add(l);
    fxGroup.scan = l;
    return l;
  })();

  // Scale: dimension lines for the reflector and boom, and a 1.75 m person beside the bus.
  const scaleGroup = (() => {
    const g = new THREE.Group();
    const refl = model.parts.reflector, axis = refl.group.userData.axis as THREE.Vector3;
    const across = new THREE.Vector3().crossVectors(axis, new THREE.Vector3(0, 0, 1)).normalize();
    const a = dishCentre.clone().addScaledVector(across, -6).addScaledVector(axis, -1.6), b = dishCentre.clone().addScaledVector(across, 6).addScaledVector(axis, -1.6);
    const seg: number[] = [a.x, a.y, a.z, b.x, b.y, b.z];
    for (const p of [a, b]) { const q = p.clone().addScaledVector(axis, 0.6); seg.push(p.x, p.y, p.z, q.x, q.y, q.z); }
    // Person: head, body, arms, legs — 1.75 m, standing on the bus's base line.
    const px = -3.2, py = -1.3;
    for (let i = 0; i < 16; i++) { const t0 = (i / 16) * Math.PI * 2, t1 = ((i + 1) / 16) * Math.PI * 2; seg.push(px + 0.11 * Math.cos(t0), py + 1.62 + 0.11 * Math.sin(t0), 0, px + 0.11 * Math.cos(t1), py + 1.62 + 0.11 * Math.sin(t1), 0); }
    seg.push(px, py + 1.51, 0, px, py + 0.85, 0, px, py + 0.85, 0, px - 0.18, py, 0, px, py + 0.85, 0, px + 0.18, py, 0, px - 0.32, py + 1.0, 0, px + 0.32, py + 1.0, 0);
    g.add(new THREE.LineSegments(keep(segGeo(seg)), keep(lineMat(C.amber, 0.95))));
    sat.add(g);
    const mk = (at: THREE.Vector3, t: string, s?: string) => { const el = document.createElement("div"); el.className = "sp-lab sp-lab-dim"; el.innerHTML = `<b>${t}</b>${s ? `<span>${s}</span>` : ""}`; const o = new CSS2DObject(el); o.position.copy(at); g.add(o); return o; };
    mk(a.clone().lerp(b, 0.5).addScaledVector(axis, -0.8), "Ø 12 m", "reflector, published");
    const boomMid = new THREE.Vector3(0.95, 3.1, 0).addScaledVector(new THREE.Vector3(0.62, 0.785, 0).normalize(), 4.5);
    mk(boomMid.clone().add(new THREE.Vector3(-1.4, 0.8, 0)), "9 m", "boom, published");
    mk(new THREE.Vector3(px, py + 2.1, 0), "PERSON · 1.75 m", "for scale");
    fxGroup.scale = g;
    return g;
  })();
  void scaleGroup;

  /* Part labels: one per part, shown by the scene's rule. */
  const partLabels = {} as Record<PartId, CSS2DObject>;
  PART_ORDER.forEach((id, k) => {
    const el = document.createElement("div");
    el.className = "sp-lab";
    const p = partName[id];
    el.innerHTML = `<b>${p?.name ?? id}</b>${p?.stat ? `<span>${p.stat}</span>` : ""}`;
    el.dataset.n = String(k + 1).padStart(2, "0");
    // Neighbouring parts' labels would overprint: nudge the crowded ones apart on screen.

    const o = new CSS2DObject(el);
    o.position.copy(model.parts[id].centre);
    model.parts[id].group.add(o);
    o.visible = false;
    partLabels[id] = o;
  });

  /* ── The Earth world ───────────────────────────────────────────────── */
  const earthWorld = new THREE.Group();
  scene.add(earthWorld);
  const globe = new THREE.Group();
  earthWorld.add(globe);
  {
    const occluder = new THREE.Mesh(keep(new THREE.SphereGeometry(RE * 0.995, 64, 48)), keep(new THREE.MeshBasicMaterial({ color: "#030a14" })));
    occluder.renderOrder = -1;
    globe.add(occluder);
    const grat: number[] = [];
    for (let la = -75; la <= 75; la += 15) for (let lo = -180; lo < 180; lo += 3) { const a = ecef(la, lo, 2), b = ecef(la, lo + 3, 2); grat.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    for (let lo = -180; lo < 180; lo += 15) for (let la = -88; la < 88; la += 3) { const a = ecef(la, lo, 2), b = ecef(la + 3, lo, 2); grat.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    globe.add(new THREE.LineSegments(keep(segGeo(grat)), keep(lineMat(C.grid, 0.7))));
    const land = mesh(landTopo as unknown as Topology, (landTopo as unknown as Topology).objects.land as GeometryCollection).coordinates as number[][][];
    globe.add(new THREE.LineSegments(keep(segGeo(lonLatLines(land, 4))), keep(lineMat(C.land, 0.85))));
    const it = indiaTopo as unknown as Topology;
    const io = it.objects.india as GeometryCollection;
    const edge = mesh(it, io, (a, b) => a === b).coordinates as number[][][];
    const inner = mesh(it, io, (a, b) => a !== b).coordinates as number[][][];
    globe.add(new THREE.LineSegments(keep(segGeo(lonLatLines(edge, 6))), keep(lineMat(C.india, 1))));
    globe.add(new THREE.LineSegments(keep(segGeo(lonLatLines(inner, 5))), keep(lineMat(C.india, 0.28))));
    // Atmosphere: a faint ring at the limb.
    const atm = new THREE.Mesh(keep(new THREE.SphereGeometry(RE * 1.03, 64, 48)), keep(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
      uniforms: { uOp: { value: 1 } },
      vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }",
      fragmentShader: "uniform float uOp; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(0.25,0.6,1.0,1.0) * f * 0.9 * uOp; }",
    })));
    atm.userData.shader = true;
    earthWorld.add(atm);
  }

  // Places: launch sites amber, ISRO's tracking stations green.
  const placeGroup = new THREE.Group(), stationGroup = new THREE.Group(), launchGroup = new THREE.Group();
  globe.add(placeGroup, stationGroup, launchGroup);
  const stations = data.places.filter((p) => p.kind === "ground");
  const stationBeams = new Map<string, THREE.Line>();
  const placeLabel = (p: StageData["places"][number], cls: string, group: THREE.Group) => {
    const at = ecef(p.lat, p.lon, 30);
    const seg: number[] = [];
    const up = at.clone().normalize();
    const t1 = new THREE.Vector3().crossVectors(up, new THREE.Vector3(0, 1, 0)).normalize(), t2 = new THREE.Vector3().crossVectors(up, t1);
    for (let i = 0; i < 20; i++) { const a0 = (i / 20) * Math.PI * 2, a1 = ((i + 1) / 20) * Math.PI * 2; const p0 = at.clone().addScaledVector(t1, 0.35 * Math.cos(a0)).addScaledVector(t2, 0.35 * Math.sin(a0)), p1 = at.clone().addScaledVector(t1, 0.35 * Math.cos(a1)).addScaledVector(t2, 0.35 * Math.sin(a1)); seg.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z); }
    const tip = at.clone().addScaledVector(up, 1.4);
    seg.push(at.x, at.y, at.z, tip.x, tip.y, tip.z);
    group.add(new THREE.LineSegments(keep(segGeo(seg)), keep(lineMat(p.kind === "launch" ? C.amber : C.green, 1))));
    const el = document.createElement("div"); el.className = `sp-lab ${cls}`; el.innerHTML = `<b>${p.name}</b>`;
    const nudge = PLACE_NUDGE[p.id];
    if (nudge) { const f = narrow ? 0.45 : 1; el.style.marginLeft = `${nudge[0] * f}px`; el.style.marginTop = `${nudge[1] * f}px`; }
    const o = new CSS2DObject(el); o.position.copy(tip); group.add(o);
    return { at, o };
  };
  for (const p of data.places.filter((x) => x.kind === "launch")) placeLabel(p, "sp-lab-amber", placeGroup);
  for (const p of stations) {
    placeLabel(p, "sp-lab-green", stationGroup);
    const beam = new THREE.Line(keep(segGeo([0, 0, 0, 0, 0, 0])), keep(lineMat(C.green, 0.9, false)));
    beam.visible = false;
    earthWorld.add(beam);
    stationBeams.set(p.id, beam);
  }

  // The launch: a schematic climb from Sriharikota south over the Bay of Bengal into a polar orbit.
  const shar = data.places.find((p) => p.id === "shar") ?? { lat: 13.72, lon: 80.23 };
  const launchPath: THREE.Vector3[] = [];
  for (let i = 0; i <= 80; i++) {
    const t = i / 80;
    const lat = shar.lat - 32 * t, lon = shar.lon + 7 * Math.sin(t * Math.PI * 0.7) - 3 * t;
    const alt = 747 * (1 - (1 - t) ** 2.2);
    launchPath.push(ecef(lat, lon, alt));
  }
  {
    const seg: number[] = [];
    for (let i = 1; i < launchPath.length; i++) { const a = launchPath[i - 1]!, b = launchPath[i]!; seg.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    launchGroup.add(new THREE.LineSegments(keep(segGeo(seg)), keep(lineMat(C.amber, 0.55))));
    const end = launchPath[launchPath.length - 1]!;
    const el = document.createElement("div"); el.className = "sp-lab sp-lab-amber"; el.innerHTML = "<b>747 km orbit</b><span>schematic path</span>";
    const o = new CSS2DObject(el); o.position.copy(end); launchGroup.add(o);
  }
  const rocket = new THREE.Points(keep((() => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(new Array(30 * 3).fill(0), 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(Array.from({ length: 30 }, (_, i) => [1, 0.75 - i * 0.02, 0.3]).flat(), 3)); return g; })()), keep(pointsMat(narrow ? 4 : 5)));
  launchGroup.add(rocket);

  // NISAR's orbit and position; the fleet; the geostationary belt.
  const orbitLine = new THREE.Line(keep(segGeo([0, 0, 0, 0, 0, 0])), keep(lineMat(C.orbit, 1)));
  earthWorld.add(orbitLine);
  const nisarMark = new THREE.Group();
  {
    const seg: number[] = [];
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4, b = ((i + 1) / 4) * Math.PI * 2 + Math.PI / 4; seg.push(0.9 * Math.cos(a), 0.9 * Math.sin(a), 0, 0.9 * Math.cos(b), 0.9 * Math.sin(b), 0); }
    seg.push(-1.5, 0, 0, -0.5, 0, 0, 0.5, 0, 0, 1.5, 0, 0, 0, -1.5, 0, 0, -0.5, 0, 0, 0.5, 0, 0, 1.5, 0);
    nisarMark.add(new THREE.LineSegments(keep(segGeo(seg)), keep(lineMat(C.hot, 1, false))));
    const el = document.createElement("div"); el.className = "sp-lab sp-lab-hot"; el.innerHTML = "<b>NISAR</b><span>live position</span>";
    const o = new CSS2DObject(el); o.position.set(0, 2, 0); nisarMark.add(o);
    nisarMark.userData.label = el;
  }
  earthWorld.add(nisarMark);
  const trail = new THREE.Line(keep(segGeo(new Array(120 * 3).fill(0))), keep(lineMat(C.hot, 0.6)));
  earthWorld.add(trail);

  const geoRing = (() => {
    const seg: number[] = [], r = 42_164 * KM;
    for (let i = 0; i < 180; i++) { const a0 = (i / 180) * Math.PI * 2, a1 = ((i + 1) / 180) * Math.PI * 2; seg.push(r * Math.cos(a0), 0, r * Math.sin(a0), r * Math.cos(a1), 0, r * Math.sin(a1)); }
    const l = new THREE.LineSegments(keep(segGeo(seg)), keep(lineMat(C.geo, 0.25)));
    earthWorld.add(l);
    const el = document.createElement("div"); el.className = "sp-lab sp-lab-amber"; el.innerHTML = "<b>Geostationary belt</b><span>35,786 km up</span>";
    const o = new CSS2DObject(el); o.position.set(r * 0.7, 2, r * 0.7); l.add(o);
    return l;
  })();

  const FLEET_MAX = 300;
  const fleetGeo = keep(new THREE.BufferGeometry());
  fleetGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(FLEET_MAX * 3), 3));
  fleetGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(FLEET_MAX * 3), 3));
  fleetGeo.setDrawRange(0, 0);
  const fleetPts = new THREE.Points(fleetGeo, keep(pointsMat(narrow ? 3.5 : 4.5)));
  earthWorld.add(fleetPts);

  /* ── Live data ─────────────────────────────────────────────────────── */
  type Rec = { name: string; satrec: ReturnType<typeof sgp4.twoline2satrec>; regime: string; epochAge: number | null };
  let nisar: Rec | null = null;
  let fleet: Rec[] = [];
  let warp = 1, simMs = Date.now(), lastReal = performance.now();
  let liveCb: Parameters<Stage["onLive"]>[0] | null = null;
  const toRec = (s: LiveSat): Rec | null => {
    try {
      const satrec = sgp4.twoline2satrec(s.line1, s.line2);
      const per = periodMinutes(s.line2);
      const n = per ? 1440 / per : null;
      const a = n ? Math.cbrt(398_600.4418 / ((n * 2 * Math.PI) / 86_400) ** 2) : 7000;
      const alt = a - 6371;
      const epochYear = Number(s.line1.slice(18, 20)), epochDay = Number(s.line1.slice(20, 32));
      const epoch = Date.UTC(epochYear < 57 ? 2000 + epochYear : 1900 + epochYear, 0, 1) + (epochDay - 1) * 86_400_000;
      return { name: s.name, satrec, regime: orbitRegime(alt, per, eccentricity(s.line2)), epochAge: Number.isFinite(epoch) ? (Date.now() - epoch) / 86_400_000 : null };
    } catch { return null; }
  };
  function posAt(r: Rec, when: Date): { p: THREE.Vector3; lat: number; lon: number; alt: number; speed: number } | null {
    const pv = sgp4.propagate(r.satrec, when);
    if (!pv || typeof pv.position !== "object" || typeof pv.velocity !== "object") return null;
    const g = sgp4.eciToGeodetic(pv.position, sgp4.gstime(when));
    if (!Number.isFinite(g.height) || g.height < 80) return null;
    const v = pv.velocity;
    return { p: eci(pv.position), lat: sgp4.degreesLat(g.latitude), lon: sgp4.degreesLong(g.longitude), alt: g.height, speed: Math.hypot(v.x, v.y, v.z) };
  }

  /** The nominal orbit when no elements are to hand: a circle at the published height and inclination. */
  function nominalOrbit(): THREE.Vector3[] {
    const r = RE + data.nisar.altKm * KM, inc = data.nisar.inclinationDeg * rad, out: THREE.Vector3[] = [];
    for (let i = 0; i <= 180; i++) { const u = (i / 180) * Math.PI * 2; out.push(new THREE.Vector3(r * Math.cos(u), r * Math.sin(u) * Math.sin(inc), -r * Math.sin(u) * Math.cos(inc))); }
    return out;
  }
  function setLine(l: THREE.Line, pts: THREE.Vector3[]) {
    const g = l.geometry as THREE.BufferGeometry;
    const arr = new Float32Array(pts.length * 3);
    pts.forEach((p, i) => arr.set([p.x, p.y, p.z], i * 3));
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    g.computeBoundingSphere();
  }
  function rebuildOrbit(now: Date) {
    if (!nisar) { setLine(orbitLine, nominalOrbit()); return; }
    const pts: THREE.Vector3[] = [];
    const per = circularPeriodMin(data.nisar.altKm);
    for (let i = 0; i <= 160; i++) { const p = posAt(nisar, new Date(now.getTime() + (i / 160) * per * 60_000)); if (p) pts.push(p.p); }
    setLine(orbitLine, pts.length > 10 ? pts : nominalOrbit());
  }
  let orbitBuiltAt = 0;

  /** Is a point in Earth's shadow? A cylindrical shadow along the anti-sun line — computed, and good enough to call day or night. */
  function sunDir(when: Date): THREE.Vector3 {
    const [lon, lat] = subsolarPoint(when);
    return ecef(lat, lon).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), globe.rotation.y);
  }

  let fleetCounts: Record<string, number> = {};
  function updateLive(now: Date) {
    globe.rotation.y = sgp4.gstime(now);
    let nisarState: LiveState | null = null;
    const contacts: string[] = [];
    if (nisar) {
      const p = posAt(nisar, now);
      if (p) {
        nisarMark.visible = true;
        nisarMark.position.copy(p.p);
        const s = sunDir(now);
        const along = p.p.dot(s);
        const sunlit = along > 0 || p.p.clone().addScaledVector(s, -along).length() > RE;
        nisarState = { name: nisar.name, lat: p.lat, lon: p.lon, altKm: p.alt, speedKms: p.speed, sunlit, epochAgeDays: nisar.epochAge };
        // Which stations can see it, above 5 degrees.
        for (const st of stations) {
          const o = ecef(st.lat, st.lon).applyAxisAngle(new THREE.Vector3(0, 1, 0), globe.rotation.y);
          const d = p.p.clone().sub(o);
          const el = Math.asin(d.clone().normalize().dot(o.clone().normalize())) / rad;
          const beam = stationBeams.get(st.id)!;
          const vis = el > 5;
          beam.visible = vis && wantEarth.has("stations");
          if (vis) { contacts.push(st.name); setLine(beam, [o, p.p]); }
        }
        // A trail: the last twenty minutes.
        const tp: THREE.Vector3[] = [];
        for (let k = 0; k < 120; k++) { const q = posAt(nisar, new Date(now.getTime() - (119 - k) * 10_000)); if (q) tp.push(q.p); }
        if (tp.length > 2) setLine(trail, tp);
      }
    } else {
      // No elements: move a marker round the nominal orbit at the derived period, labelled as such.
      const per = circularPeriodMin(data.nisar.altKm) * 60_000;
      const pts = nominalOrbit(), u = ((now.getTime() % per) / per) * 180;
      nisarMark.visible = true;
      nisarMark.position.copy(pts[Math.floor(u)] ?? pts[0]!);
      (nisarMark.userData.label as HTMLElement).innerHTML = "<b>NISAR</b><span>nominal orbit — elements unavailable</span>";
      for (const b of stationBeams.values()) b.visible = false;
    }
    if (now.getTime() - orbitBuiltAt > 60_000 || Math.abs(now.getTime() - orbitBuiltAt) > 600_000) { rebuildOrbit(now); orbitBuiltAt = now.getTime(); }
    // The fleet.
    const pos = fleetGeo.attributes.position as THREE.BufferAttribute, col = fleetGeo.attributes.color as THREE.BufferAttribute;
    let k = 0;
    fleetCounts = {};
    const cLeo = new THREE.Color(C.leo), cGeo = new THREE.Color(C.geo), cOther = new THREE.Color(C.other);
    for (const r of fleet) {
      if (k >= FLEET_MAX) break;
      const p = posAt(r, now);
      if (!p) continue;
      pos.setXYZ(k, p.p.x, p.p.y, p.p.z);
      const c = r.regime === "LEO" ? cLeo : r.regime === "GEO" ? cGeo : cOther;
      col.setXYZ(k, c.r, c.g, c.b);
      fleetCounts[r.regime] = (fleetCounts[r.regime] ?? 0) + 1;
      k++;
    }
    fleetGeo.setDrawRange(0, k);
    pos.needsUpdate = true; col.needsUpdate = true;
    fleetGeo.computeBoundingSphere();
    liveCb?.(nisarState, { contacts, fleet: fleetCounts });
  }

  /* ── Scenes ────────────────────────────────────────────────────────── */
  let spec: Spec = SPECS.hero;
  let current: SceneId = "hero";
  let wantEarth = new Set<string>();
  const camPos = new THREE.Vector3(...(SPECS.hero.cam as { pos: [number, number, number] }).pos), camLook = new THREE.Vector3(3, 3.5, 0);
  const wantPos = camPos.clone(), wantLook = camLook.clone();
  let satFade = 1, earthFade = 0, apart = 0, deploy = 1, deployT = 0, spinAngle = 0, t = 0;
  let reach = 1;
  const fx = new Map<string, number>();

  function camFor(s: Spec): { pos: THREE.Vector3; look: THREE.Vector3 } {
    if ("pos" in s.cam) {
      const look = new THREE.Vector3(...s.cam.look);
      return { pos: new THREE.Vector3(...s.cam.pos).sub(look).multiplyScalar(reach).add(look), look };
    }
    // Earth-fixed: follow the ground as it turns.
    const d = ecef(s.cam.lat, s.cam.lon).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), globe.rotation.y);
    const look = d.clone().multiplyScalar(RE * 0.35).add(new THREE.Vector3(0, s.cam.up ?? 0, 0));
    return { pos: d.multiplyScalar(s.cam.dist * reach).add(new THREE.Vector3(0, (s.cam.up ?? 0) * 2, 0)), look };
  }

  function setScene(id: SceneId) {
    current = id;
    spec = SPECS[id];
    wantEarth = new Set(spec.earth ?? []);
    deployT = 0;
    const hl = new Set(spec.highlight ?? []);
    for (const pid of PART_ORDER) {
      const pc = partCol[pid];
      const origin = partName[pid]?.origin ?? "india";
      pc.want.set(spec.colour === "origin" ? data.originColours[origin] : hl.size && hl.has(pid) ? "#bff4ff" : C.holo);
      pc.wantOp = hl.size && !hl.has(pid) ? 0.12 : 1;
      partLabels[pid].visible = spec.labels === "numbers" || (spec.labels === "highlight" && hl.has(pid));
      const el = partLabels[pid].element;
      el.classList.toggle("sp-lab-num", spec.labels === "numbers");
      // Nudge crowded labels apart when the craft is assembled; pulled apart, they have room.
      const nudge = spec.labels === "highlight" ? LABEL_NUDGE[pid] : undefined;
      const num = spec.labels === "numbers" ? NUM_NUDGE[pid] : undefined;
      const nn = nudge ?? num, f = narrow ? 0.45 : 1;
      el.style.marginLeft = nn ? `${nn[0] * f}px` : "";
      el.style.marginTop = nn ? `${nn[1] * f}px` : "";
      el.style.setProperty("--c", spec.colour === "origin" ? data.originColours[origin] : "#bff4ff");
    }
    if (id === "heat") partCol.thermal.want.set(C.gold);
    if (reduced) { satFade = spec.world === "sat" ? 1 : 0; earthFade = 1 - satFade; apart = spec.apart ?? 0; }
  }

  function applyFade(root: THREE.Object3D, f: number) {
    root.visible = f > 0.01;
    if (!root.visible) return;
    root.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (!m) return;
      if ((m as THREE.ShaderMaterial).uniforms?.uOp) { (m as THREE.ShaderMaterial).uniforms.uOp!.value = f; return; }
      if (m.userData.base !== undefined && !m.userData.partOwned) m.opacity = m.userData.base * f * (m.userData.fx ?? 1);
    });
  }
  for (const id of PART_ORDER) { model.parts[id].lines.userData.partOwned = true; model.parts[id].fill.userData.partOwned = true; }

  let active = true, raf = 0, last = performance.now(), liveTick = 0;
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (!active) { last = now; lastReal = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    simMs += (now - lastReal) * warp; lastReal = now;
    if (!reduced) t += dt;
    const k = reduced ? 1 : 1 - Math.pow(0.02, dt), kc = reduced ? 1 : 1 - Math.pow(0.06, dt);

    // Live positions, four times a second (every frame when warped, so motion is smooth).
    liveTick -= dt;
    if (liveTick <= 0) { updateLive(new Date(simMs)); liveTick = warp > 1 ? 0.05 : 0.25; }

    satFade += ((spec.world === "sat" ? 1 : 0) - satFade) * Math.min(1, k * 1.6);
    earthFade += ((spec.world === "earth" ? 1 : 0) - earthFade) * Math.min(1, k * 1.6);
    applyFade(sat, satFade);
    applyFade(earthWorld, earthFade);
    (stars.material as THREE.PointsMaterial).opacity = 0.9;

    // Effects in and out.
    for (const name of ["limb", "radar", "downlink", "sun", "wheels", "scan", "scale"]) {
      const want = (spec.fx ?? []).includes(name as never) ? 1 : 0;
      const f = (fx.get(name) ?? 0) + (want - (fx.get(name) ?? 0)) * Math.min(1, k * 1.5);
      fx.set(name, f);
      const o = fxGroup[name];
      if (!o) continue;
      o.traverse((c) => { const m = (c as THREE.Mesh).material as THREE.Material | undefined; if (m) m.userData.fx = f; });
      o.visible = f > 0.01 && satFade > 0.01;
      o.traverse((c) => { if (c instanceof CSS2DObject) c.visible = o.visible && f > 0.5; });
    }
    for (const g of [placeGroup, stationGroup, launchGroup]) g.visible = false;
    placeGroup.visible = wantEarth.has("places") || wantEarth.has("launch");
    stationGroup.visible = wantEarth.has("stations");
    launchGroup.visible = wantEarth.has("launch");
    orbitLine.visible = wantEarth.has("orbit");
    nisarMark.visible = nisarMark.visible && wantEarth.has("nisar");
    trail.visible = wantEarth.has("nisar") && !!nisar;
    fleetPts.visible = wantEarth.has("fleet");
    geoRing.visible = wantEarth.has("geo");
    for (const g of [placeGroup, stationGroup, launchGroup, nisarMark, geoRing]) g.traverse((c) => { if (c instanceof CSS2DObject) c.visible = g.visible && earthFade > 0.5; });

    // Parts: colour and opacity ease to the scene's.
    for (const id of PART_ORDER) {
      const pc = partCol[id], mp = model.parts[id];
      pc.cur.lerp(pc.want, k);
      pc.op += (pc.wantOp - pc.op) * k;
      mp.lines.color.copy(pc.cur); mp.fill.color.copy(pc.cur);
      mp.lines.opacity = mp.lines.userData.base * pc.op * satFade;
      mp.fill.opacity = mp.fill.userData.base * pc.op * satFade * (current === "exploded" ? 2.2 : 1);
      if (partLabels[id].visible) partLabels[id].element.style.opacity = satFade > 0.6 ? "1" : "0";
    }

    // Pull apart and deploy.
    apart += ((spec.apart ?? 0) - apart) * k;
    if (spec.deploy === "loop" && !reduced) {
      deployT += dt;
      const cyc = deployT % 7;
      deploy = cyc < 1.2 ? 0 : cyc < 5 ? Math.min(1, (cyc - 1.2) / 3.2) : 1;
      deploy = deploy * deploy * (3 - 2 * deploy);
    } else deploy += (1 - deploy) * k;
    model.setApart(apart);
    model.setDeploy(deploy);

    // Spin of the whole craft in the hero, and a slow sway in the pointing scene (wheels turning the body).
    if (spec.spin && !reduced) spinAngle += spec.spin * dt;
    else spinAngle += (0 - spinAngle) * k * 0.5;
    const sway = current === "pointing" && !reduced ? Math.sin(t * 0.8) * 0.25 : 0;
    model.root.rotation.y = spinAngle + sway;

    // Effects that move.
    if (fxGroup.radar?.visible) {
      for (let i = 0; i < radar.pulses.length; i++) {
        const u = ((t * 0.55 + i / radar.pulses.length) % 1);
        const set = (l: THREE.LineLoop, f: number) => {
          const a = l.geometry.attributes.position as THREE.BufferAttribute;
          swath.forEach((c, j) => { const p = dishCentre.clone().lerp(c, f); a.setXYZ(j, p.x, p.y, p.z); });
          a.needsUpdate = true;
          (l.material as THREE.LineBasicMaterial).opacity = (l.material as THREE.LineBasicMaterial).userData.base * (fx.get("radar") ?? 0) * Math.sin(Math.PI * f) * satFade;
        };
        set(radar.pulses[i]!, u);
        set(radar.echoes[i]!, 1 - ((u + 0.5) % 1));
      }
      radar.stripLines.position.z = ((t * 2) % 1);
    }
    if (fxGroup.downlink?.visible) {
      const a = downlink.pg.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < downlink.n; i++) { const u = (t * 0.35 + i / downlink.n) % 1; const p = kaAt.clone().lerp(stationAt, u); a.setXYZ(i, p.x, p.y, p.z); }
      a.needsUpdate = true;
    }
    if (fxGroup.sun?.visible) {
      const a = sun.pg.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < sun.n; i++) { const u = (sun.seed[i * 3]! + t * 0.4) % 1; a.setXYZ(i, -40 + 38.7 * u, sun.seed[i * 3 + 1]!, sun.seed[i * 3 + 2]!); }
      a.needsUpdate = true;
    }
    if (fxGroup.scan?.visible) scan.position.y = -1.6 + 13 * (0.5 + 0.5 * Math.sin(t * 0.7));
    if (launchGroup.visible) {
      const a = rocket.geometry.attributes.position as THREE.BufferAttribute;
      const u = (t * 0.12) % 1.25;
      for (let i = 0; i < 30; i++) { const f = Math.max(0, Math.min(1, u - i * 0.004)); const p = launchPath[Math.floor(f * (launchPath.length - 1))]!; a.setXYZ(i, p.x, p.y, p.z); }
      a.needsUpdate = true;
    }

    // Camera.
    const want = camFor(spec);
    wantPos.copy(want.pos); wantLook.copy(want.look);
    camPos.lerp(wantPos, kc);
    camLook.lerp(wantLook, kc);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    stars.position.copy(camera.position);
    composer.render();
    labels.render(scene, camera);
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w / 2, h / 2);
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 56 : w / h < 1.2 ? 48 : 40;
    reach = w / h < 0.8 ? 1.5 : w / h < 1.2 ? 1.15 : 1;
    // Text cards sit on the left on wide screens and at the bottom on narrow ones.
    if (w / h > 1.1) camera.setViewOffset(w, h, -0.16 * w, 0, w, h);
    else camera.setViewOffset(w, h, 0, 0.16 * h, w, h);
    camera.updateProjectionMatrix();
  }

  resize();
  setScene("hero");
  raf = requestAnimationFrame(frame);

  return {
    setScene,
    setActive(a) { active = a; },
    setLive(n, f) {
      nisar = n ? toRec(n) : null;
      fleet = f.map(toRec).filter((r): r is Rec => !!r);
      orbitBuiltAt = 0;
      updateLive(new Date(simMs));
    },
    setWarp(x) { warp = x; if (x === 1) simMs = Date.now(); orbitBuiltAt = 0; },
    onLive(cb) { liveCb = cb; },
    resize,
    dispose() {
      cancelAnimationFrame(raf);
      for (const d of disposables) d.dispose();
      composer.dispose();
      renderer.dispose();
      overlay.replaceChildren();
    },
  };
}
