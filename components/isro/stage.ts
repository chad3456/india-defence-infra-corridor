/**
 * The three.js stage behind /space-programme: India's rockets lined up at
 * their published heights, and four schematic worlds — the Chandrayaan-3
 * route to the Moon, the Mars Orbiter's transfer, Aditya-L1's halo round L1,
 * and ISRO's centres on the map of India.
 *
 * ── What is to scale ──────────────────────────────────────────────────────
 *
 * The rockets' heights, against each other and against a 1.75 m person. The
 * Mars world keeps the ratio of Earth's and Mars's orbits and their periods,
 * so the planets' positions at launch and arrival follow; distances in the
 * Moon and Sun worlds are not to scale, and their labels say so. On the map,
 * pillar height is the number of ISRO units the centres page lists in a
 * city — derived.
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
import type { Centre, Rocket, StageKind } from "@/lib/space-programme";
import { buildRocket, person, type RocketModel } from "./rocket-model";

export type SceneId = "lineup" | "slv3" | "pslv" | "pslv-fail" | "gslv" | "lvm3" | "private" | "moon" | "mars" | "sun" | "map" | "finale";

export interface ProgrammeStageData {
  rockets: Rocket[];
  colours: Record<StageKind, string>;
  centres: Centre[];
  labels: { moonLanded: string; marsArrived: string; sunDistance: string };
}

export interface ProgrammeStage {
  setScene(id: SceneId): void;
  setActive(a: boolean): void;
  resize(): void;
  dispose(): void;
}

type World = "rockets" | "moon" | "mars" | "sun" | "map";
interface Spec {
  world: World;
  cam: { pos: [number, number, number]; look: [number, number, number] };
  focus?: string[];
  highlight?: { rocket: string; stage: string; colour: string };
  apart?: "loop" | number;
  spin?: number;
}

type Seg = number[];
const segGeo = (s: Seg) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(s, 3)); return g; };
const lineMat = (c: string, o: number) => { const m = new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false }); m.userData.base = o; return m; };
const circle = (s: Seg, r: number, n: number, f: (x: number, y: number) => [number, number, number]) => { for (let i = 0; i < n; i++) { const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2; s.push(...f(r * Math.cos(a0), r * Math.sin(a0)), ...f(r * Math.cos(a1), r * Math.sin(a1))); } };

/** A wireframe globe with coastlines, radius r, centred at c. */
function globe(r: number, c: THREE.Vector3, land: number[][][] | null, colour: string, landColour: string): THREE.Group {
  const g = new THREE.Group();
  const occ = new THREE.Mesh(new THREE.SphereGeometry(r * 0.99, 40, 30), new THREE.MeshBasicMaterial({ color: "#030a14" }));
  g.add(occ);
  const s: Seg = [];
  for (let la = -60; la <= 60; la += 30) { const y = r * Math.sin((la * Math.PI) / 180), rr = r * Math.cos((la * Math.PI) / 180); circle(s, rr, 48, (x, z) => [x, y, z]); }
  for (let lo = 0; lo < 180; lo += 30) { const a = (lo * Math.PI) / 180; circle(s, r, 48, (x, y) => [x * Math.cos(a), y, x * Math.sin(a)]); }
  g.add(new THREE.LineSegments(segGeo(s), lineMat(colour, 0.35)));
  if (land) {
    const ls: Seg = [];
    const p = (lon: number, lat: number) => { const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180; return [r * 1.005 * Math.cos(la) * Math.cos(lo), r * 1.005 * Math.sin(la), -r * 1.005 * Math.cos(la) * Math.sin(lo)] as const; };
    for (const line of land) for (let i = 1; i < line.length; i++) ls.push(...p(line[i - 1]![0]!, line[i - 1]![1]!), ...p(line[i]![0]!, line[i]![1]!));
    g.add(new THREE.LineSegments(segGeo(ls), lineMat(landColour, 0.9)));
  }
  g.position.copy(c);
  return g;
}

export function createStage(canvas: HTMLCanvasElement, overlay: HTMLDivElement, data: ProgrammeStageData, reduced: boolean): ProgrammeStage {
  const narrow = window.innerWidth < 720;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, narrow ? 1.5 : 1.75));
  renderer.setClearColor("#02050b");
  const labels = new CSS2DRenderer({ element: overlay });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 5000);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.4, 0.22);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const disposables: Array<{ dispose(): void }> = [];
  const lab = (html: string, cls = "") => { const el = document.createElement("div"); el.className = `sp-lab ${cls}`; el.innerHTML = html; return new CSS2DObject(el); };
  const land = mesh(landTopo as unknown as Topology, (landTopo as unknown as Topology).objects.land as GeometryCollection).coordinates as number[][][];

  // Stars: decoration.
  {
    const n = 1200, pos = new Float32Array(n * 3);
    let s = 11; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < n; i++) { const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1); pos.set([2000 * Math.sin(ph) * Math.cos(th), 2000 * Math.cos(ph), 2000 * Math.sin(ph) * Math.sin(th)], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const st = new THREE.Points(g, new THREE.PointsMaterial({ color: "#9fbbd8", size: narrow ? 1.3 : 1.7, sizeAttenuation: false, transparent: true, opacity: 0.8 }));
    scene.add(st);
    disposables.push(g);
  }

  const worlds: Record<World, THREE.Group> = { rockets: new THREE.Group(), moon: new THREE.Group(), mars: new THREE.Group(), sun: new THREE.Group(), map: new THREE.Group() };
  for (const w of Object.values(worlds)) scene.add(w);
  const fade: Record<World, number> = { rockets: 1, moon: 0, mars: 0, sun: 0, map: 0 };

  /* ── Rockets, side by side at their published heights ────────────────── */
  const models = new Map<string, RocketModel>();
  const xAt = new Map<string, number>();
  let x = 0;
  for (const r of data.rockets) {
    const m = buildRocket(r, data.colours);
    disposables.push(m);
    const w = Math.max(r.diameterM * 3.4, 6);
    x += w / 2;
    m.root.position.x = x;
    xAt.set(r.id, x);
    worlds.rockets.add(m.root);
    const l = lab(`<b>${r.name}</b><span>${r.heightApprox ? "about " : ""}${r.heightM} m</span>`);
    l.position.set(0, r.heightM + 3, 0);
    m.root.add(l);
    m.root.userData.label = l;
    models.set(r.id, m);
    x += w / 2 + 3;
  }
  const rowMid = x / 2;
  {
    const p = person("#ffb547");
    p.position.set(-3, 0, 0);
    worlds.rockets.add(p);
    const l = lab("<b>Person · 1.75 m</b>", "sp-lab-amber"); l.position.set(-3, 3.2, 0); worlds.rockets.add(l);
    const s: Seg = [];
    for (let i = -10; i <= Math.ceil(x) + 10; i += 2) s.push(i, 0, -8, i, 0, 8);
    for (let k = -8; k <= 8; k += 2) s.push(-10, 0, k, x + 10, 0, k);
    worlds.rockets.add(new THREE.LineSegments(segGeo(s), lineMat("#0f2a3d", 0.6)));
  }

  /* ── The Moon: Chandrayaan-3's route, schematic ─────────────────────── */
  const moonAt = new THREE.Vector3(42, 0, 0);
  const moonPath: THREE.Vector3[] = [];
  {
    worlds.moon.add(globe(5, new THREE.Vector3(0, 0, 0), land, "#5fd4ff", "#3c8fd0"));
    worlds.moon.add(globe(1.5, moonAt, null, "#d9e4f2", "#d9e4f2"));
    // Earth-bound orbits, raised one by one with the apogee towards the Moon.
    const rp = 6;
    for (const ra of [9, 13, 18, 25, 32]) {
      const a = (rp + ra) / 2, e = (ra - rp) / (ra + rp), b = a * Math.sqrt(1 - e * e);
      for (let i = 0; i <= 120; i++) { const t = Math.PI + (i / 120) * Math.PI * 2; moonPath.push(new THREE.Vector3(a * Math.cos(t) + (a - rp), 0, b * Math.sin(t))); }
    }
    // Trans-lunar arc from perigee to the Moon.
    const p0 = new THREE.Vector3(-rp, 0, 0), c1 = new THREE.Vector3(6, 0, -26), c2 = new THREE.Vector3(34, 0, -12), p1 = moonAt.clone().add(new THREE.Vector3(-4.5, 0, 0));
    for (let i = 1; i <= 120; i++) { const t = i / 120, m = 1 - t; moonPath.push(new THREE.Vector3().addScaledVector(p0, m * m * m).addScaledVector(c1, 3 * m * m * t).addScaledVector(c2, 3 * m * t * t).addScaledVector(p1, t * t * t)); }
    // Lunar orbits, lowered, then the descent to the south polar region.
    for (const rr of [4.5, 3.4, 2.5, 1.9]) for (let i = 0; i <= 90; i++) { const t = Math.PI + (i / 90) * Math.PI * 2; moonPath.push(moonAt.clone().add(new THREE.Vector3(rr * Math.cos(t), 0, rr * Math.sin(t)))); }
    for (let i = 1; i <= 30; i++) { const t = i / 30; moonPath.push(moonAt.clone().add(new THREE.Vector3(-1.9 * (1 - t), -1.5 * t, 0.6 * Math.sin(t * Math.PI)))); }
    const s: Seg = [];
    for (let i = 1; i < moonPath.length; i++) s.push(...moonPath[i - 1]!.toArray(), ...moonPath[i]!.toArray());
    const path = new THREE.LineSegments(segGeo(s), lineMat("#ffb547", 0.75));
    worlds.moon.add(path);
    worlds.moon.userData.path = path;
    const put = (html: string, at: THREE.Vector3, cls = "sp-lab-amber") => { const l = lab(html, cls); l.position.copy(at); worlds.moon.add(l); };
    put("<b>Earth-bound orbit raising</b><span>apogee lifted each burn</span>", new THREE.Vector3(12, 2, 15));
    put("<b>Trans-lunar injection</b>", new THREE.Vector3(16, 2, -21));
    put("<b>Lunar orbits, lowered</b>", moonAt.clone().add(new THREE.Vector3(1, 2, -6.5)));
    put(`<b>Landing · ${data.labels.moonLanded}</b><span>near the south pole</span>`, moonAt.clone().add(new THREE.Vector3(0, -2, 6)), "sp-lab-hot");
    put("<b>Not to scale</b><span>the Moon is far further away</span>", new THREE.Vector3(2, -2, 12), "sp-lab-dim");
  }

  /* ── Mars: a Hohmann-style transfer, with the orbits' real proportions ─ */
  const RE_ORB = 24, RM_ORB = 24 * 1.524;
  const marsBits = (() => {
    const g = worlds.mars;
    const sun = new THREE.Mesh(new THREE.SphereGeometry(2.6, 24, 16), new THREE.MeshBasicMaterial({ color: "#ffc857" }));
    g.add(sun);
    const s: Seg = [];
    circle(s, RE_ORB, 128, (a, b) => [a, 0, b]);
    g.add(new THREE.LineSegments(segGeo(s), lineMat("#5fd4ff", 0.5)));
    const s2: Seg = [];
    circle(s2, RM_ORB, 160, (a, b) => [a, 0, b]);
    g.add(new THREE.LineSegments(segGeo(s2), lineMat("#ff6b4a", 0.5)));
    const a = (RE_ORB + RM_ORB) / 2, e = (RM_ORB - RE_ORB) / (RM_ORB + RE_ORB);
    const tr: Seg = [];
    const at = (th: number) => { const r = (a * (1 - e * e)) / (1 + e * Math.cos(th)); return new THREE.Vector3(r * Math.cos(th), 0, -r * Math.sin(th)); };
    for (let i = 1; i <= 120; i++) tr.push(...at(((i - 1) / 120) * Math.PI).toArray(), ...at((i / 120) * Math.PI).toArray());
    g.add(new THREE.LineSegments(segGeo(tr), lineMat("#ffb547", 0.9)));
    const earth = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), new THREE.MeshBasicMaterial({ color: "#5fd4ff" }));
    const mars = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), new THREE.MeshBasicMaterial({ color: "#ff6b4a" }));
    const craft = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshBasicMaterial({ color: "#ffffff" }));
    g.add(earth, mars, craft);
    const le = lab("<b>Earth</b>"); earth.add(le); le.position.set(0, 2.2, 0);
    const lm = lab("<b>Mars</b>"); mars.add(lm); lm.position.set(0, 2.2, 0);
    const lc = lab(`<b>Mars Orbiter</b><span>arrived ${data.labels.marsArrived}</span>`, "sp-lab-amber"); craft.add(lc); lc.position.set(0, 2.2, 0);
    const ls = lab("<b>Sun</b>", "sp-lab-amber"); ls.position.set(0, 4.5, 0); g.add(ls);
    return { at, earth, mars, craft };
  })();

  /* ── The Sun: Aditya-L1's halo round L1, not to scale ───────────────── */
  const sunBits = (() => {
    const g = worlds.sun;
    const sun = new THREE.Mesh(new THREE.SphereGeometry(6, 32, 24), new THREE.MeshBasicMaterial({ color: "#c98a2a" }));
    sun.position.set(-34, 0, 0);
    g.add(sun);
    g.add(globe(2.6, new THREE.Vector3(30, 0, 0), land, "#5fd4ff", "#3c8fd0"));
    const L1 = new THREE.Vector3(19, 0, 0);
    const s: Seg = [-28, 0, 0, 27.4, 0, 0];
    g.add(new THREE.LineSegments(segGeo(s), lineMat("#9fb3c8", 0.25)));
    const halo: Seg = [];
    circle(halo, 1, 96, (a, b) => [L1.x, L1.y + a * 6, L1.z + b * 9]);
    g.add(new THREE.LineSegments(segGeo(halo), lineMat("#ffb547", 0.85)));
    const mark: Seg = [];
    circle(mark, 0.6, 16, (a, b) => [L1.x + a, L1.y + b, L1.z]);
    g.add(new THREE.LineSegments(segGeo(mark), lineMat("#ffffff", 0.9)));
    const craft = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshBasicMaterial({ color: "#ffffff" }));
    g.add(craft);
    const put = (html: string, at: THREE.Vector3, cls = "") => { const l = lab(html, cls); l.position.copy(at); g.add(l); };
    put("<b>Sun</b>", new THREE.Vector3(-34, 9, 0), "sp-lab-amber");
    put("<b>Earth</b>", new THREE.Vector3(30, 4.5, 0));
    put(`<b>L1 · Aditya-L1</b><span>${data.labels.sunDistance}</span>`, new THREE.Vector3(19, 9.5, 0), "sp-lab-amber");
    put("<b>Not to scale</b><span>L1 is far closer to Earth than drawn</span>", new THREE.Vector3(0, -12, 0), "sp-lab-dim");
    return { L1, craft };
  })();

  /* ── The map: ISRO's centres ────────────────────────────────────────── */
  {
    const g = worlds.map;
    const k = 1.4, P = (lon: number, lat: number) => new THREE.Vector3((lon - 82.5) * k, 0, -(lat - 22) * k);
    const it = indiaTopo as unknown as Topology;
    const io = it.objects.india as GeometryCollection;
    const add = (lines: number[][][], c: string, o: number) => { const s: Seg = []; for (const l of lines) for (let i = 1; i < l.length; i++) s.push(...P(l[i - 1]![0]!, l[i - 1]![1]!).toArray(), ...P(l[i]![0]!, l[i]![1]!).toArray()); g.add(new THREE.LineSegments(segGeo(s), lineMat(c, o))); };
    add(mesh(it, io, (a, b) => a === b).coordinates as number[][][], "#5fd4ff", 0.9);
    add(mesh(it, io, (a, b) => a !== b).coordinates as number[][][], "#5fd4ff", 0.18);
    for (const c of data.centres) {
      const base = P(c.lon, c.lat), h = 1.2 + c.units.length * 1.6;
      const s: Seg = [base.x, 0, base.z, base.x, h, base.z];
      circle(s, 0.45, 18, (a, b) => [base.x + a, 0.02, base.z + b]);
      circle(s, 0.25, 12, (a, b) => [base.x + a, h, base.z + b]);
      const future = c.id === "kulas";
      g.add(new THREE.LineSegments(segGeo(s), lineMat(future ? "#9fb3c8" : "#ffb547", 1)));
      const l = lab(`<b>${c.city}</b><span>${c.units.length} unit${c.units.length > 1 ? "s" : ""}${future ? " · planned" : ""}</span>`, future ? "sp-lab-dim" : "sp-lab-amber");
      l.position.set(base.x, h + 0.9, base.z);
      // Bengaluru, Hassan and Sriharikota sit close: push the labels apart.
      const nudge: Record<string, [number, number]> = { hassan: [-70, 10], blr: [-40, -14], hyd: [50, -10], shar: [60, 0], mgiri: [-90, 18], tvm: [-80, 4], kulas: [70, 30] };
      const n = nudge[c.id];
      if (n) { l.element.style.marginLeft = `${n[0] * (narrow ? 0.5 : 1)}px`; l.element.style.marginTop = `${n[1]}px`; }
      g.add(l);
    }
  }

  /* ── Scenes ─────────────────────────────────────────────────────────── */
  const focusCam = (id: string, side = 1): Spec["cam"] => {
    const r = data.rockets.find((x) => x.id === id)!, cx = xAt.get(id) ?? 0, H = r.heightM;
    return { pos: [cx + side * H * 0.55, H * 0.6, H * 1.35 + 10], look: [cx, H * 0.48, 0] };
  };
  const SPECS: Record<SceneId, Spec> = {
    lineup: { world: "rockets", cam: { pos: [rowMid, 26, 112], look: [rowMid, 22, 0] } },
    slv3: { world: "rockets", cam: focusCam("slv3", -1), focus: ["slv3", "aslv"] },
    pslv: { world: "rockets", cam: focusCam("pslv"), focus: ["pslv"], apart: "loop" },
    "pslv-fail": { world: "rockets", cam: focusCam("pslv", -1), focus: ["pslv"], highlight: { rocket: "pslv", stage: "ps3", colour: "#ff4d4d" } },
    gslv: { world: "rockets", cam: focusCam("gslv"), focus: ["gslv"], highlight: { rocket: "gslv", stage: "cus", colour: "#f2e6ff" } },
    lvm3: { world: "rockets", cam: focusCam("lvm3", -1), focus: ["lvm3"], apart: "loop" },
    private: { world: "rockets", cam: { pos: [(xAt.get("sslv") ?? 0) + 12, 18, 62], look: [((xAt.get("sslv") ?? 0) + (xAt.get("vikram1") ?? 0)) / 2, 14, 0] }, focus: ["sslv", "vikram1"] },
    moon: { world: "moon", cam: { pos: [20, 62, 70], look: [20, 0, 0] } },
    mars: { world: "mars", cam: { pos: [0, 58, 52], look: [0, 0, 0] } },
    sun: { world: "sun", cam: { pos: [2, 34, 96], look: [2, 0, 0] } },
    map: { world: "map", cam: { pos: [-3, 44, 40], look: [-3, 0, -1] } },
    finale: { world: "rockets", cam: { pos: [rowMid + 20, 34, 104], look: [rowMid, 20, 0] }, spin: 0.05 },
  };

  let spec = SPECS.lineup, t = 0, apartE = 0, reach = 1;
  const camPos = new THREE.Vector3(...spec.cam.pos), camLook = new THREE.Vector3(...spec.cam.look);
  const want = { pos: camPos.clone(), look: camLook.clone() };
  const opacity = new Map<THREE.Material, number>();

  function aim() {
    want.look.set(...spec.cam.look);
    want.pos.set(...spec.cam.pos).sub(want.look).multiplyScalar(reach).add(want.look);
  }

  function setScene(id: SceneId) {
    spec = SPECS[id];
    aim();
    t = 0;
    if (reduced) { for (const w of Object.keys(fade) as World[]) fade[w] = w === spec.world ? 1 : 0; camPos.copy(want.pos); camLook.copy(want.look); }
  }

  /** Each material's target opacity this frame: its base, times its world's fade, times focus dimming. */
  function applyWorld(w: World, f: number) {
    const g = worlds[w];
    g.visible = f > 0.01;
    if (!g.visible) return;
    g.traverse((o) => {
      if (o instanceof CSS2DObject) { o.element.style.opacity = f > 0.6 ? "1" : "0"; return; }
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (!m || m.userData.base === undefined || m.userData.owned) return;
      m.opacity = m.userData.base * f;
    });
  }

  let active = true, raf = 0, last = performance.now();
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (!active) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!reduced) t += dt;
    const k = reduced ? 1 : 1 - Math.pow(0.02, dt), kc = reduced ? 1 : 1 - Math.pow(0.07, dt);
    for (const w of Object.keys(fade) as World[]) { fade[w] += ((w === spec.world ? 1 : 0) - fade[w]) * Math.min(1, k * 1.6); applyWorld(w, fade[w]); }

    // Rockets: focus dims the others; a highlighted stage pulses; pull-apart loops.
    const loop = spec.apart === "loop" && !reduced;
    const apartWant = loop ? (Math.sin(t * 0.7 - Math.PI / 2) > 0.2 ? 1 : 0) : typeof spec.apart === "number" ? spec.apart : 0;
    apartE += (apartWant - apartE) * k * 0.8;
    for (const [id, m] of models) {
      const inFocus = !spec.focus || spec.focus.includes(id);
      m.setApart(inFocus ? apartE : 0);
      (m.root.userData.label as CSS2DObject).element.style.opacity = fade.rockets > 0.6 && (inFocus || !spec.focus) ? "1" : "0.25";
      for (const sid of m.order) {
        const p = m.parts[sid]!;
        const hi = spec.highlight && spec.highlight.rocket === id && spec.highlight.stage === sid;
        const dimmed = spec.highlight && spec.highlight.rocket === id && !hi;
        const target = (inFocus ? (dimmed ? 0.22 : 1) : 0.1) * fade.rockets;
        const prev = opacity.get(p.lines) ?? target;
        const cur = prev + (target - prev) * k;
        opacity.set(p.lines, cur);
        p.lines.userData.owned = true; p.fill.userData.owned = true;
        const pulse = hi && !reduced ? 0.55 + 0.45 * Math.sin(t * 5) : 1;
        p.lines.opacity = p.lines.userData.base * cur * pulse;
        p.lines.color.set(hi ? spec.highlight!.colour : data.colours[p.kind]);
        p.fill.color.copy(p.lines.color);
        p.fill.opacity = p.fill.userData.base * cur * (hi ? 2.5 : 1);
      }
    }
    if (spec.spin && !reduced) worlds.rockets.rotation.y = Math.sin(t * spec.spin) * 0.12; else worlds.rockets.rotation.y *= 1 - k;

    // The Moon route draws itself, then the craft runs along it.
    if (worlds.moon.visible) {
      const path = worlds.moon.userData.path as THREE.LineSegments;
      const total = moonPath.length - 1, u = reduced ? 1 : Math.min(1, (t % 14) / 11);
      path.geometry.setDrawRange(0, Math.floor(u * total) * 2);
    }
    // Mars: from launch alignment to arrival, by the planets' periods (365 and 687 days) over a ~297-day transfer.
    if (worlds.mars.visible) {
      const u = reduced ? 1 : Math.min(1, (t % 12) / 9);
      const travel = 297 / 365 * Math.PI * 2, marsTravel = 297 / 687 * Math.PI * 2, mars0 = Math.PI - marsTravel;
      marsBits.earth.position.set(RE_ORB * Math.cos(u * travel), 0, -RE_ORB * Math.sin(u * travel));
      marsBits.mars.position.set(RM_ORB * Math.cos(mars0 + u * marsTravel), 0, -RM_ORB * Math.sin(mars0 + u * marsTravel));
      marsBits.craft.position.copy(marsBits.at(u * Math.PI));
    }
    if (worlds.sun.visible) { const a = t * 0.6; sunBits.craft.position.set(sunBits.L1.x, sunBits.L1.y + 6 * Math.cos(a), sunBits.L1.z + 9 * Math.sin(a)); }

    camPos.lerp(want.pos, kc); camLook.lerp(want.look, kc);
    camera.position.copy(camPos); camera.lookAt(camLook);
    composer.render();
    labels.render(scene, camera);
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); composer.setSize(w, h); bloom.resolution.set(w / 2, h / 2); labels.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 56 : w / h < 1.2 ? 48 : 40;
    reach = w / h < 0.8 ? 1.55 : w / h < 1.2 ? 1.15 : 1;
    aim();
    if (w / h > 1.1) camera.setViewOffset(w, h, -0.16 * w, 0, w, h); else camera.setViewOffset(w, h, 0, 0.16 * h, w, h);
    camera.updateProjectionMatrix();
  }

  resize();
  setScene("lineup");
  camPos.copy(want.pos); camLook.copy(want.look);
  raf = requestAnimationFrame(frame);

  return {
    setScene,
    setActive(a) { active = a; },
    resize,
    dispose() {
      cancelAnimationFrame(raf);
      for (const d of disposables) d.dispose();
      composer.dispose(); renderer.dispose();
      overlay.replaceChildren();
    },
  };
}
