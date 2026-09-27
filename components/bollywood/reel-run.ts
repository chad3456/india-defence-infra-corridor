/**
 * Reel Run: the three.js engine behind the game on /bollywood-villains.
 *
 * The player drives a clapperboard kart down a film-strip road that runs
 * from 1995 to 2025, one block per year. Beside the road, glowing towers show
 * each lane's measure for that year; on the road, film reels are real films
 * carrying the marker, and driving through one opens the plot sentence that
 * tripped it.
 *
 * ── What is data and what is decoration ─────────────────────────────────
 *
 * Data: the towers on the left (height = the year's value, one colour per
 * lane, scaled to the level's largest value), the reels (one film each, at
 * its release year, in its marker's lane), and the year billboards.
 * Decoration: the sky, stars, far skyline, road, bulbs and kart. The far
 * skyline is dim, uniform and a long way off so it cannot be read as bars.
 *
 * Built once per mount; a level swap rebuilds only the towers and reels.
 */
import * as THREE from "three";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import type { Level, Reel } from "@/lib/bollywood-arcade-shared";

export type Mode = "raw" | "per1k";

export interface RunStats { collected: number; missed: number; onRoad: number; bestCombo: number }

export interface Callbacks {
  onYear(year: number): void;
  onCollect(reel: Reel, combo: number): void;
  onMiss(): void;
  onFinish(stats: RunStats): void;
}

export interface ReelRun {
  load(level: Level, mode: Mode): void;
  setMode(mode: Mode): void;
  start(): void;
  pause(): void;
  steer(dir: -1 | 1): void;
  boost(on: boolean): void;
  /** Reduced motion: move one year at a time instead of driving. */
  stepYear(): void;
  setActive(on: boolean): void;
  resize(): void;
  dispose(): void;
}

const SEG = 14;
const LANES_X = [-2.4, 0, 2.4];
const ROAD_W = 9.6;

function rand(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function textSprite(text: string, colour: string, px = 64): THREE.Sprite {
  const c = document.createElement("canvas");
  const g = c.getContext("2d")!;
  g.font = `900 ${px}px ui-sans-serif, system-ui, sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + 24;
  c.width = w; c.height = px + 24;
  g.font = `900 ${px}px ui-sans-serif, system-ui, sans-serif`;
  g.fillStyle = colour; g.textBaseline = "middle";
  g.fillText(text, 12, c.height / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(w / 60, c.height / 60, 1);
  return s;
}

export function createReelRun(canvas: HTMLCanvasElement, overlay: HTMLElement, cb: Callbacks, reducedMotion: boolean): ReelRun {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const css = new CSS2DRenderer({ element: overlay });

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog("#1a0b33", 40, 150);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 600);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.5, 0.45, 0.6);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const disposables: Array<{ dispose(): void }> = [];
  const keep = <T extends { dispose(): void }>(x: T): T => { disposables.push(x); return x; };

  /* ── Sky, stars, far skyline: decoration ────────────────────────────── */

  const sky = new THREE.Mesh(
    keep(new THREE.SphereGeometry(400, 32, 16)),
    keep(new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `varying vec3 vP;
        void main(){
          float h = normalize(vP).y;
          vec3 top = vec3(0.04,0.02,0.12); vec3 mid = vec3(0.42,0.08,0.42); vec3 low = vec3(0.08,0.03,0.18);
          vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.45, h)) : mix(mid, low, smoothstep(0.0, 0.2, -h));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    })),
  );
  scene.add(sky);
  {
    const r = rand(4); const n = 900; const pts = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = r() * Math.PI * 2; const ph = r() * 0.45 * Math.PI;
      pts.set([Math.cos(th) * Math.cos(ph) * 350, Math.sin(ph) * 350 + 10, Math.sin(th) * Math.cos(ph) * 350], i * 3);
    }
    const g = keep(new THREE.BufferGeometry()); g.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    scene.add(new THREE.Points(g, keep(new THREE.PointsMaterial({ color: "#ffe9ff", size: 1.2, fog: false }))));
  }
  const world = new THREE.Group();
  scene.add(world);

  /* ── The road: a film strip ─────────────────────────────────────────── */

  const roadU = { uLen: { value: 500 } };
  const road = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(ROAD_W, 1, 1, 1)),
    keep(new THREE.ShaderMaterial({
      uniforms: roadU,
      vertexShader: "varying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }",
      fragmentShader: `varying vec2 vW;
        void main(){
          float ax = abs(vW.x);
          vec3 c = vec3(0.07,0.04,0.13);
          // film-strip edges with sprocket holes
          if (ax > 3.7) {
            c = vec3(0.02,0.01,0.04);
            vec2 q = vec2(ax - 4.25, fract(vW.y / 1.6) - 0.5);
            if (abs(q.x) < 0.22 && abs(q.y) < 0.2) c = vec3(0.95,0.85,1.0);
          }
          // lane dividers, dashed
          float d = min(abs(vW.x - 1.2), abs(vW.x + 1.2));
          float dash = step(0.5, fract(vW.y / 3.0));
          c += vec3(0.1,0.85,1.0) * (1.0 - smoothstep(0.03, 0.08, d)) * dash * 1.4;
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    })),
  );
  road.rotation.x = -Math.PI / 2;
  world.add(road);

  const ground = new THREE.Mesh(keep(new THREE.PlaneGeometry(400, 1)), keep(new THREE.MeshBasicMaterial({ color: "#12082a" })));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02;
  world.add(ground);

  /* Marquee bulbs along both edges. */
  const BULBS = 520;
  const bulbs = new THREE.InstancedMesh(keep(new THREE.SphereGeometry(0.11, 8, 6)), keep(new THREE.MeshBasicMaterial({ color: 0xffffff })), BULBS);
  world.add(bulbs);
  const bulbOn = new THREE.Color("#ffd35a").multiplyScalar(1.6);
  const bulbOff = new THREE.Color("#5a3a10");

  /* Far skyline: dim and uniform, so it reads as scenery, not bars. */
  {
    const r = rand(9); const n = 140;
    const sk = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(1, 1, 1)), keep(new THREE.MeshBasicMaterial({ color: "#241040" })), n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1; const h = 6 + r() * 10; const w = 4 + r() * 5;
      m.compose(new THREE.Vector3(side * (70 + r() * 40), h / 2, -r() * 520 + 20), new THREE.Quaternion(), new THREE.Vector3(w, h, w));
      sk.setMatrixAt(i, m);
    }
    world.add(sk);
  }

  /* ── The kart: a clapperboard on wheels ─────────────────────────────── */

  const kart = new THREE.Group();
  {
    const body = new THREE.Mesh(keep(new THREE.BoxGeometry(1.2, 0.45, 1.8)), keep(new THREE.MeshBasicMaterial({ color: "#2b1a4a" })));
    body.position.y = 0.45;
    const stripes = document.createElement("canvas"); stripes.width = 128; stripes.height = 32;
    const g = stripes.getContext("2d")!;
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#111" : "#fff"; g.beginPath(); g.moveTo(i * 16, 32); g.lineTo(i * 16 + 16, 32); g.lineTo(i * 16 + 26, 0); g.lineTo(i * 16 + 10, 0); g.fill(); }
    const tex = keep(new THREE.CanvasTexture(stripes)); tex.colorSpace = THREE.SRGBColorSpace;
    const slate = new THREE.Mesh(keep(new THREE.BoxGeometry(1.2, 0.7, 0.08)), keep(new THREE.MeshBasicMaterial({ color: "#1b1b1b" })));
    slate.position.set(0, 1.0, 0.35);
    const clap = new THREE.Mesh(keep(new THREE.BoxGeometry(1.24, 0.18, 0.1)), keep(new THREE.MeshBasicMaterial({ map: tex })));
    clap.position.set(0, 1.45, 0.3); clap.rotation.x = -0.35;
    const wheelMat = keep(new THREE.MeshBasicMaterial({ color: "#ff3d9a" }));
    const wheelGeo = keep(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 16)); wheelGeo.rotateZ(Math.PI / 2);
    for (const [x, z] of [[-0.66, -0.6], [0.66, -0.6], [-0.66, 0.6], [0.66, 0.6]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat); w.position.set(x!, 0.28, z!); kart.add(w);
    }
    const lampMat = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color("#bff6ff").multiplyScalar(2.5) }));
    for (const x of [-0.4, 0.4]) {
      const l = new THREE.Mesh(keep(new THREE.SphereGeometry(0.09, 8, 6)), lampMat); l.position.set(x, 0.5, -0.92); kart.add(l);
    }
    kart.add(body, slate, clap);
  }
  scene.add(kart);

  /* Pickup sparks. */
  const SPARKS = 120;
  const sparkGeo = keep(new THREE.BufferGeometry());
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkVel = new Float32Array(SPARKS * 3);
  let sparkLife = 0;
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = keep(new THREE.PointsMaterial({ color: "#ffffff", size: 0.16, transparent: true, opacity: 0 }));
  scene.add(new THREE.Points(sparkGeo, sparkMat));
  function burst(at: THREE.Vector3, colour: string): void {
    const r = rand(Math.floor(performance.now()));
    for (let i = 0; i < SPARKS; i++) {
      sparkPos.set([at.x, at.y, at.z], i * 3);
      const th = r() * Math.PI * 2; const up = r();
      sparkVel.set([Math.cos(th) * (1 + r() * 3), 1 + up * 4, Math.sin(th) * (1 + r() * 3)], i * 3);
    }
    sparkMat.color.set(colour).multiplyScalar(2);
    sparkLife = 1;
  }

  /* ── Per-level content: towers, reels, billboards ───────────────────── */

  let level: Level | null = null;
  let mode: Mode = "raw";
  let levelGroup = new THREE.Group();
  world.add(levelGroup);
  let towers: THREE.InstancedMesh[] = [];
  let towerTarget: number[][] = [];
  let towerNow: number[][] = [];
  let reelMesh: THREE.InstancedMesh | null = null;
  let rimMesh: THREE.InstancedMesh | null = null;
  interface Placed { reel: Reel; x: number; z: number; state: 0 | 1 | 2; t: number }
  let placed: Placed[] = [];
  let valueTags: CSS2DObject[] = [];
  let y0 = 1995; let years = 31;
  const zOf = (year: number) => -(year - y0) * SEG;

  function values(l: Level, m: Mode): number[][] {
    return l.lanes.map((_, i) => l.series.map((p) => (m === "per1k" ? (p.per1k[i] ?? p.raw[i]) : p.raw[i]) ?? 0));
  }

  function clearLevel(): void {
    world.remove(levelGroup);
    levelGroup.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const mat = mesh.material as THREE.Material | undefined;
      if (mat) { (mat as THREE.SpriteMaterial).map?.dispose(); mat.dispose(); }
    });
    for (const t of valueTags) t.element.remove();
    levelGroup = new THREE.Group();
    world.add(levelGroup);
    towers = []; placed = []; valueTags = []; reelMesh = null; rimMesh = null;
  }

  function scaleTowers(m: Mode): void {
    if (!level) return;
    const v = values(level, m);
    const max = Math.max(...v.flat(), 0.0001);
    towerTarget = v.map((row) => row.map((x) => Math.max(0.04, (x / max) * 13)));
    if (towerNow.length !== towerTarget.length || reducedMotion) towerNow = towerTarget.map((r) => [...r]);
  }

  function load(l: Level, m: Mode): void {
    clearLevel();
    level = l; mode = m;
    y0 = l.series[0]?.year ?? 1995; years = l.series.length;
    const length = years * SEG + 60;
    road.scale.y = length; road.position.z = -length / 2 + 20;
    ground.scale.y = length; ground.position.z = road.position.z;

    /* Bulbs along the whole road. */
    const mm = new THREE.Matrix4(); const q = new THREE.Quaternion(); const one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < BULBS; i++) {
      const side = i % 2 ? 1 : -1;
      mm.compose(new THREE.Vector3(side * (ROAD_W / 2 + 0.35), 0.12, 20 - Math.floor(i / 2) * (length / (BULBS / 2))), q, one);
      bulbs.setMatrixAt(i, mm);
    }
    bulbs.instanceMatrix.needsUpdate = true;

    /* Towers: one row per lane on the left, one tower per year. */
    towers = l.lanes.map((lane, i) => {
      const colour = new THREE.Color(lane.colour).multiplyScalar(1.15);
      const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 1, 1.1), new THREE.MeshBasicMaterial({ color: colour }), years);
      im.userData.x = -(ROAD_W / 2 + 2.2 + i * 1.6);
      levelGroup.add(im);
      /* A floor strip in the lane colour, so each row is legible end to end. */
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(1.3, years * SEG), new THREE.MeshBasicMaterial({ color: new THREE.Color(lane.colour).multiplyScalar(0.35) }));
      strip.rotation.x = -Math.PI / 2; strip.position.set(im.userData.x as number, 0.01, -(years * SEG) / 2);
      levelGroup.add(strip);
      const tagEl = document.createElement("div");
      tagEl.className = "rr-tag";
      tagEl.style.borderColor = lane.colour;
      const tag = new CSS2DObject(tagEl);
      levelGroup.add(tag);
      valueTags.push(tag);
      return im;
    });
    towerNow = [];
    scaleTowers(m);

    /* Year billboards on the right, and a gate every five years. */
    for (const p of l.series) {
      const z = zOf(p.year) - SEG / 2;
      const s = textSprite(String(p.year), p.year % 5 === 0 ? "#ffe45c" : "#ff9ce0", p.year % 5 === 0 ? 72 : 48);
      s.position.set(ROAD_W / 2 + 2.6, p.year % 5 === 0 ? 3.2 : 2.2, z);
      levelGroup.add(s);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2, 6), new THREE.MeshBasicMaterial({ color: "#4a2a70" }));
      pole.position.set(ROAD_W / 2 + 2.6, 1, z); levelGroup.add(pole);
      if (p.year % 5 === 0) {
        const arch = new THREE.Mesh(new THREE.TorusGeometry(ROAD_W / 2 + 0.6, 0.12, 8, 48, Math.PI), new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff4fb0").multiplyScalar(1.8) }));
        arch.position.set(0, 0, zOf(p.year)); levelGroup.add(arch);
      }
    }

    /* Reels: real films, at their year, in their marker's lane. */
    const perSlot = new Map<string, number>();
    placed = l.reels.map((reel) => {
      const lanes = l.lanes.length;
      const x = lanes === 1 ? LANES_X[hash(reel.title) % 3]! : lanes === 2 ? LANES_X[reel.lane === 0 ? 0 : 2]! : LANES_X[reel.lane]!;
      const key = `${reel.year}:${x}`;
      const k = perSlot.get(key) ?? 0; perSlot.set(key, k + 1);
      return { reel, x, z: zOf(reel.year) - 3 - k * 3.4, state: 0 as const, t: 0 };
    });
    if (placed.length) {
      const disc = new THREE.CylinderGeometry(0.55, 0.55, 0.14, 20); disc.rotateX(Math.PI / 2);
      reelMesh = new THREE.InstancedMesh(disc, new THREE.MeshBasicMaterial({ color: 0xffffff }), placed.length);
      const rim = new THREE.TorusGeometry(0.6, 0.07, 6, 24);
      rimMesh = new THREE.InstancedMesh(rim, new THREE.MeshBasicMaterial({ color: 0xffffff }), placed.length);
      placed.forEach((p, i) => {
        const c = new THREE.Color(l.lanes[p.reel.lane]?.colour ?? "#fff");
        reelMesh!.setColorAt(i, c.clone().multiplyScalar(0.9));
        rimMesh!.setColorAt(i, c.clone().multiplyScalar(2.4));
      });
      levelGroup.add(reelMesh, rimMesh);
    }

    player.z = 12; player.lane = 1; player.x = 0; player.speed = 0;
    running = false; finished = false; lastYear = -1; combo = 0;
    stats = { collected: 0, missed: 0, onRoad: placed.length, bestCombo: 0 };
    place(0);
  }

  /* ── Player and loop ────────────────────────────────────────────────── */

  const player = { z: 12, x: 0, lane: 1, speed: 0 };
  let running = false; let finished = false; let boosting = false; let active = true;
  let lastYear = -1; let combo = 0;
  let stats: RunStats = { collected: 0, missed: 0, onRoad: 0, bestCombo: 0 };
  let t = 0; let bulbT = 0;
  const tmpM = new THREE.Matrix4(); const tmpQ = new THREE.Quaternion(); const tmpS = new THREE.Vector3(); const tmpP = new THREE.Vector3();

  function currentYear(): number {
    const y = y0 + Math.floor(-player.z / SEG);
    return Math.max(y0, Math.min(y0 + years - 1, y));
  }

  function collect(p: Placed): void {
    p.state = 1; p.t = 0;
    combo += 1; stats.collected += 1; stats.bestCombo = Math.max(stats.bestCombo, combo);
    burst(new THREE.Vector3(p.x, 0.9, p.z), level?.lanes[p.reel.lane]?.colour ?? "#fff");
    cb.onCollect(p.reel, combo);
  }
  function miss(p: Placed): void {
    p.state = 2; combo = 0; stats.missed += 1; cb.onMiss();
  }

  function place(dt: number): void {
    /* Towers ease toward their targets, and the current year's tags follow. */
    const year = currentYear();
    towers.forEach((im, i) => {
      const x = im.userData.x as number;
      for (let y = 0; y < years; y++) {
        const target = towerTarget[i]?.[y] ?? 0;
        const now = towerNow[i]?.[y] ?? target;
        const v = reducedMotion ? target : now + (target - now) * Math.min(1, dt * 4);
        if (towerNow[i]) towerNow[i]![y] = v;
        const near = y + y0 === year;
        tmpS.set(near ? 1.35 : 1, v, near ? 1.35 : 1);
        tmpP.set(x, v / 2, zOf(y + y0) - SEG / 2);
        tmpM.compose(tmpP, tmpQ.identity(), tmpS);
        im.setMatrixAt(y, tmpM);
      }
      im.instanceMatrix.needsUpdate = true;
      const tag = valueTags[i];
      if (tag && level) {
        const yi = year - y0;
        const h = towerNow[i]?.[yi] ?? 0;
        tag.position.set(x, h + 0.9, zOf(year) - SEG / 2);
        const p = level.series[yi];
        const v = p ? (mode === "per1k" ? p.per1k[i] : p.raw[i]) : null;
        const unit = level.lanes[i]?.unit;
        tag.element.textContent = v === null || v === undefined ? "" : unit === "words" ? `${Math.round(v)} words`
          : mode === "per1k" && p?.per1k[i] !== null ? `${v.toFixed(2)}/1k` : `${v.toFixed(1)}%`;
      }
    });

    /* Reels spin, bob, and shrink away when taken. */
    if (reelMesh && rimMesh) {
      placed.forEach((p, i) => {
        let s = 1;
        if (p.state === 1) { p.t += dt; s = Math.max(0, 1 - p.t * 3); }
        else if (p.state === 2) s = 0.55;
        const bob = p.state === 0 ? Math.sin(t * 3 + i) * 0.12 : 0;
        tmpQ.setFromEuler(new THREE.Euler(0, 0, t * 2.2 + i));
        tmpP.set(p.x, 0.95 + bob + (p.state === 1 ? p.t * 3 : 0), p.z);
        tmpS.setScalar(s);
        tmpM.compose(tmpP, tmpQ, tmpS);
        reelMesh!.setMatrixAt(i, tmpM); rimMesh!.setMatrixAt(i, tmpM);
      });
      reelMesh.instanceMatrix.needsUpdate = true; rimMesh.instanceMatrix.needsUpdate = true;
    }

    /* The kart. */
    const tx = LANES_X[player.lane]!;
    player.x += (tx - player.x) * (reducedMotion ? 1 : Math.min(1, dt * 10));
    kart.position.set(player.x, 0, player.z);
    kart.rotation.z = reducedMotion ? 0 : (player.x - tx) * 0.12;
    kart.position.y = running && !reducedMotion ? Math.abs(Math.sin(t * 14)) * 0.04 : 0;

    /* On a portrait screen, lean left so the towers stay in frame. */
    const lean = narrow ? -2.6 : 0;
    const camTarget = new THREE.Vector3(player.x * 0.6 + lean, 3.8, player.z + 7.8);
    if (reducedMotion) camera.position.copy(camTarget); else camera.position.lerp(camTarget, Math.min(1, dt * 5 + 0.001));
    camera.lookAt(player.x * 0.3 + lean * 1.2, 1.2, player.z - 12);

    if (year !== lastYear) { lastYear = year; cb.onYear(year); }
  }

  function advance(from: number, to: number): void {
    for (const p of placed) {
      if (p.state !== 0) continue;
      /* Taken if the kart swept over it in its lane; missed once it is behind. */
      const swept = p.z <= from + 0.8 && p.z >= to - 0.8;
      if (swept && Math.abs(p.x - LANES_X[player.lane]!) < 1.1) collect(p);
      else if (p.z > to + 0.8) miss(p);
    }
    const end = zOf(y0 + years - 1) - SEG;
    if (to < end && !finished) {
      finished = true; running = false;
      for (const p of placed) if (p.state === 0) { p.state = 2; stats.missed += 1; }
      cb.onFinish(stats);
    }
  }

  let raf = 0; let last = performance.now();
  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    if (!active) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!reducedMotion) t += dt;

    if (running && !reducedMotion) {
      const target = boosting ? 30 : 17;
      player.speed += (target - player.speed) * Math.min(1, dt * 2);
      const from = player.z; player.z -= player.speed * dt;
      advance(from, player.z);
    }

    bulbT += dt;
    if (bulbT > 0.14) {
      bulbT = 0;
      const phase = Math.floor(t * 7);
      for (let i = 0; i < BULBS; i++) bulbs.setColorAt(i, (Math.floor(i / 2) + phase) % 3 === 0 ? bulbOn : bulbOff);
      if (bulbs.instanceColor) bulbs.instanceColor.needsUpdate = true;
    }

    if (sparkLife > 0) {
      sparkLife = Math.max(0, sparkLife - dt * 1.4);
      for (let i = 0; i < SPARKS; i++) {
        for (let k = 0; k < 3; k++) sparkPos[i * 3 + k] = (sparkPos[i * 3 + k] ?? 0) + (sparkVel[i * 3 + k] ?? 0) * dt;
        sparkVel[i * 3 + 1] = (sparkVel[i * 3 + 1] ?? 0) - 9 * dt;
      }
      (sparkGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      sparkMat.opacity = sparkLife;
    }

    place(dt);
    composer.render();
    css.render(scene, camera);
  }

  let narrow = false;
  function resize(): void {
    const w = canvas.clientWidth || 800; const h = canvas.clientHeight || 450;
    narrow = w / h < 0.8;
    renderer.setSize(w, h, false); composer.setSize(w, h); css.setSize(w, h);
    camera.aspect = w / h; camera.fov = w / h < 0.8 ? 78 : 62; camera.updateProjectionMatrix();
  }
  resize();
  raf = requestAnimationFrame(frame);

  return {
    load,
    setMode(m) { mode = m; scaleTowers(m); },
    start() { if (!finished) running = true; },
    pause() { running = false; },
    steer(d) { player.lane = Math.max(0, Math.min(2, player.lane + d)); },
    boost(on) { boosting = on; },
    stepYear() {
      if (finished) return;
      const from = player.z;
      const next = Math.min(from, zOf(currentYear())) - SEG;
      player.z = next - 0.01;
      advance(from, player.z);
    },
    setActive(on) { active = on; },
    resize,
    dispose() {
      cancelAnimationFrame(raf);
      clearLevel();
      for (const d of disposables) d.dispose();
      composer.dispose();
      renderer.dispose();
      overlay.replaceChildren();
    },
  };
}
