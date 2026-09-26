/**
 * The three.js stage behind the Project Maven piece.
 *
 * One renderer, one scene, fourteen arrangements of it. Each scroll step asks
 * for an arrangement; groups fade in and out and the camera eases between
 * poses. Everything is built once on mount and disposed on unmount.
 *
 * ── What this must not do ────────────────────────────────────────────────
 *
 * It must not animate a strike. Nothing here explodes, burns, or is hit. The
 * van in the raid schematic stops where the book's description stops, and the
 * page says in words what happened next and who disputes it. Motion is the
 * most persuasive way to assert a sequence, and the sequences in this book
 * are exactly the parts two accounts disagree about.
 *
 * ── What the pictures are and are not ────────────────────────────────────
 *
 * The terrain, vehicles and people are generated, not footage. Where a
 * picture encodes a number — tiles for years of video, points for sorties,
 * cubes for targets a day, the share of objects boxed at a given detection
 * rate — the count is the book's figure, passed in from the verified record,
 * and the label says what one mark stands for. Where a picture encodes no
 * number, it carries none.
 */
import * as THREE from "three";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

export type StepId =
  | "feed" | "deluge" | "sorties" | "dots" | "layers" | "pixels" | "boxes"
  | "accuracy" | "chain" | "tempo" | "globe" | "van" | "sea" | "swarm" | "end";

export interface StageData {
  /** Counts the pictures are built from — all from the verified record. */
  counts: {
    videoYears: number; sorties2001: number; sorties2010: number;
    tempo: [number, number, number];
    pxPersonLo: number; pxPersonHi: number; pxWeapon: number; pxObject: number;
  };
  /** Label text, already worded and cited by the page. */
  text: Record<string, string>;
  layers: Array<{ label: string; quote: string }>;
  phases: string[];
  where: Array<{ name: string; kind: "deployed" | "support" | "watched"; position: [number, number]; cite: string }>;
  palette: { deployed: string; support: string; watched: string };
}

export interface Stage {
  setStep(id: StepId): void;
  /** Theatre for the accuracy step: a detection rate between 0 and 1, and a ground. */
  setAccuracy(rate: number, ground: "desert" | "jungle" | "snow"): void;
  setChain(withMaven: boolean): void;
  setTempo(level: 0 | 1 | 2): void;
  setActive(active: boolean): void;
  resize(): void;
  dispose(): void;
}

const AI_YELLOW = new THREE.Color("#ffd400");
const THERMAL = new THREE.Color("#eafff1");
const BG = new THREE.Color("#070b0a");

/* ── Deterministic noise, so the terrain is the same for every reader ─── */

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, y: number): number {
  const xi = Math.floor(x); const yi = Math.floor(y);
  const xf = x - xi; const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf); const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi); const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1); const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function heightAt(x: number, z: number): number {
  let h = 0; let amp = 1; let f = 0.045;
  for (let o = 0; o < 4; o++) { h += amp * vnoise(x * f + 11.3, z * f - 4.7); amp *= 0.5; f *= 2.1; }
  return (h - 0.9) * 3.2;
}
function rand(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/* ── Small builders ───────────────────────────────────────────────────── */

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  if (g) draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function label(text: string, cls = "mv-label"): CSS2DObject {
  const el = document.createElement("div");
  el.className = cls;
  el.textContent = text;
  const o = new CSS2DObject(el);
  return o;
}

/** A square frame: a four-segment ring turned 45 degrees. */
function squareFrame(inner: number): THREE.BufferGeometry {
  const g = new THREE.RingGeometry(inner * Math.SQRT2 / 2, Math.SQRT2 / 2, 4, 1);
  g.rotateZ(Math.PI / 4);
  return g;
}

interface Group {
  obj: THREE.Group;
  fade: number;
  target: number;
  mats: THREE.Material[];
  labels: CSS2DObject[];
}

export function createStage(canvas: HTMLCanvasElement, overlay: HTMLElement, data: StageData, reducedMotion: boolean): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setClearColor(BG, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const css = new CSS2DRenderer({ element: overlay });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
  camera.position.set(0, 14, 26);

  const groups: Record<string, Group> = {};
  const makeGroup = (id: string): Group => {
    const g: Group = { obj: new THREE.Group(), fade: 0, target: 0, mats: [], labels: [] };
    g.obj.visible = false;
    scene.add(g.obj);
    groups[id] = g;
    return g;
  };
  const own = <M extends THREE.Material>(g: Group, m: M, base = 1): M => {
    m.transparent = true;
    m.userData.base = base;
    m.opacity = 0;
    g.mats.push(m);
    return m;
  };
  const tag = (g: Group, o: CSS2DObject, at: THREE.Vector3, parent: THREE.Object3D = g.obj): CSS2DObject => {
    o.position.copy(at);
    parent.add(o);
    g.labels.push(o);
    return o;
  };

  let time = 0;

  /* ── Terrain ─────────────────────────────────────────────────────────── */

  const terrain = makeGroup("terrain");
  const PAL = {
    desert: [new THREE.Color("#1d1a10"), new THREE.Color("#8f8a63")],
    jungle: [new THREE.Color("#07160b"), new THREE.Color("#3f7a3d")],
    snow: [new THREE.Color("#2a3338"), new THREE.Color("#dfe8ec")],
  } as const;
  const terrainUniforms = {
    uLow: { value: PAL.desert[0].clone() },
    uHigh: { value: PAL.desert[1].clone() },
    uLine: { value: new THREE.Color("#9dffb8") },
    uBg: { value: BG.clone() },
    uOpacity: { value: 0 },
    uTime: { value: 0 },
  };
  {
    const geo = new THREE.PlaneGeometry(90, 90, 180, 180);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();
    const mat = new THREE.ShaderMaterial({
      uniforms: terrainUniforms,
      transparent: true,
      vertexShader: /* glsl */`
        varying float vH; varying vec2 vXZ; varying float vDepth;
        void main() {
          vH = position.y; vXZ = position.xz;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uLow; uniform vec3 uHigh; uniform vec3 uLine; uniform vec3 uBg;
        uniform float uOpacity; uniform float uTime;
        varying float vH; varying vec2 vXZ; varying float vDepth;
        void main() {
          float h = clamp((vH + 2.5) / 5.0, 0.0, 1.0);
          vec3 col = mix(uLow, uHigh, h);
          float k = vH * 1.4;
          float f = fract(k);
          float contour = 1.0 - smoothstep(0.0, fwidth(k) * 1.2, min(f, 1.0 - f));
          vec2 g = abs(fract(vXZ / 6.0 - 0.5) - 0.5) / fwidth(vXZ / 6.0);
          float grid = 1.0 - min(min(g.x, g.y), 1.0);
          col += uLine * (contour * 0.22 + grid * 0.08);
          col = mix(col, uBg, smoothstep(26.0, 70.0, vDepth));
          gl_FragColor = vec4(col, uOpacity);
          #include <colorspace_fragment>
        }`,
    });
    mat.userData.base = 1;
    terrain.mats.push(mat);
    terrain.obj.add(new THREE.Mesh(geo, mat));
  }

  /* ── Vehicles and people on it ───────────────────────────────────────── */

  const actors = makeGroup("actors");
  const R = rand(7);
  interface Actor { kind: "vehicle" | "person"; road: number; t: number; speed: number; cx: number; cz: number; r: number; p: number; roll: number }
  const ACTORS: Actor[] = [];
  for (let i = 0; i < 26; i++) ACTORS.push({ kind: "vehicle", road: i % 4, t: R() * 80 - 40, speed: 0.6 + R() * 1.2, cx: 0, cz: 0, r: 0, p: R() * 6.28, roll: R() });
  const villages = [[-12, -6], [9, 4], [-4, 10], [15, -12]];
  for (let i = 0; i < 48; i++) {
    const v = villages[i % villages.length] ?? [0, 0];
    ACTORS.push({ kind: "person", road: -1, t: 0, speed: 0.15 + R() * 0.25, cx: (v[0] ?? 0) + (R() - 0.5) * 6, cz: (v[1] ?? 0) + (R() - 0.5) * 6, r: 0.6 + R() * 1.8, p: R() * 6.28, roll: R() });
  }
  const roadZ = (road: number, x: number) => [-14, -2, 7, 16][road]! + Math.sin(x * 0.08 + road) * 3;
  const vehicleMat = own(actors, new THREE.MeshBasicMaterial({ color: THERMAL }));
  const personMat = own(actors, new THREE.MeshBasicMaterial({ color: THERMAL }));
  const nV = ACTORS.filter((a) => a.kind === "vehicle").length;
  const nP = ACTORS.length - nV;
  const vehicles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.42, 0.48), vehicleMat, nV);
  const people = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.11, 0.34, 2, 6), personMat, nP);
  actors.obj.add(vehicles, people);
  const actorPos = ACTORS.map(() => new THREE.Vector3());

  function placeActors(): void {
    const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const s = new THREE.Vector3(1, 1, 1);
    let iv = 0; let ip = 0;
    ACTORS.forEach((a, i) => {
      const p = actorPos[i]!;
      if (a.kind === "vehicle") {
        const x = ((a.t + time * a.speed + 45) % 90) - 45;
        const z = roadZ(a.road, x);
        p.set(x, heightAt(x, z) + 0.25, z);
        const dz = roadZ(a.road, x + 0.5) - z;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(dz, 0.5));
        m.compose(p, q, s); vehicles.setMatrixAt(iv++, m);
      } else {
        const ang = a.p + time * a.speed;
        const x = a.cx + Math.cos(ang) * a.r; const z = a.cz + Math.sin(ang * 0.7) * a.r;
        p.set(x, heightAt(x, z) + 0.3, z);
        q.identity(); m.compose(p, q, s); people.setMatrixAt(ip++, m);
      }
    });
    vehicles.instanceMatrix.needsUpdate = true;
    people.instanceMatrix.needsUpdate = true;
  }

  /* ── Detections: dots and boxes ──────────────────────────────────────── */

  const dets = makeGroup("dots");
  const dotMat = own(dets, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const haloMat = own(dets, new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false }), 0.18);
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 10, 8), dotMat, ACTORS.length);
  const halos = new THREE.InstancedMesh(new THREE.SphereGeometry(0.45, 12, 10), haloMat, ACTORS.length);
  dets.obj.add(dots, halos);

  const boxes = makeGroup("boxes");
  const thickMat = own(boxes, new THREE.MeshBasicMaterial({ color: AI_YELLOW, side: THREE.DoubleSide, depthTest: false }));
  const thick = new THREE.InstancedMesh(squareFrame(0.62), thickMat, ACTORS.length);
  thick.renderOrder = 5;
  boxes.obj.add(thick);

  const thin = makeGroup("thin");
  const thinMat = own(thin, new THREE.MeshBasicMaterial({ color: AI_YELLOW, side: THREE.DoubleSide, depthTest: false }));
  const thinBoxes = new THREE.InstancedMesh(squareFrame(0.9), thinMat, ACTORS.length);
  thinBoxes.renderOrder = 5;
  thin.obj.add(thinBoxes);

  let detectRate = 1;
  function placeDetections(): void {
    const m = new THREE.Matrix4(); const s = new THREE.Vector3(); const p = new THREE.Vector3();
    const q = camera.quaternion;
    ACTORS.forEach((a, i) => {
      const at = actorPos[i]!;
      const seen = a.roll < detectRate;
      p.copy(at).setY(at.y + 0.9);
      s.setScalar(seen ? 1 : 0);
      m.compose(p, q, s); dots.setMatrixAt(i, m); halos.setMatrixAt(i, m);
      p.copy(at).setY(at.y + 0.1);
      s.setScalar(seen ? (a.kind === "vehicle" ? 1.5 : 0.95) : 0);
      m.compose(p, q, s); thick.setMatrixAt(i, m); thinBoxes.setMatrixAt(i, m);
    });
    for (const im of [dots, halos, thick, thinBoxes]) im.instanceMatrix.needsUpdate = true;
  }

  /* The cloud that became a school bus. */
  const sky = makeGroup("sky");
  {
    const puff = canvasTexture(128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
      gr.addColorStop(0, "rgba(220,235,230,0.9)"); gr.addColorStop(1, "rgba(220,235,230,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    });
    const r = rand(3);
    for (let i = 0; i < 14; i++) {
      const sp = new THREE.Sprite(own(sky, new THREE.SpriteMaterial({ map: puff, depthWrite: false }), 0.8));
      sp.position.set(-3 + r() * 7, 9 + r() * 1.6, -18 + r() * 3);
      sp.scale.setScalar(2.2 + r() * 2.4);
      sky.obj.add(sp);
    }
    const fb = new THREE.Mesh(squareFrame(0.9), own(sky, new THREE.MeshBasicMaterial({ color: AI_YELLOW, side: THREE.DoubleSide, depthTest: false })));
    fb.position.set(0.5, 9.8, -16.5); fb.scale.set(6.5, 3.4, 1); fb.renderOrder = 6;
    sky.obj.add(fb);
    tag(sky, label(data.text.schoolBus ?? "", "mv-label mv-ai"), new THREE.Vector3(0.5, 12, -16.5));
  }

  /* ── The deluge: tiles of video, one per year of footage ─────────────── */

  const deluge = makeGroup("deluge");
  const delugeU = { uOpacity: { value: 0 }, uTime: { value: 0 }, uProgress: { value: 0 } };
  {
    const n = data.counts.videoYears;
    const cols = 10; const rows = Math.ceil(n / cols);
    const geo = new THREE.PlaneGeometry(1.5, 0.84);
    const mat = new THREE.ShaderMaterial({
      uniforms: delugeU, transparent: true, side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        attribute float aIndex; varying float vI; varying vec2 vUv;
        void main() {
          vI = aIndex; vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform float uOpacity; uniform float uTime; uniform float uProgress;
        varying float vI; varying vec2 vUv;
        float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
          if (vI > uProgress) discard;
          vec2 cell = floor(vUv * vec2(48.0, 27.0));
          float n = h(cell + floor(uTime * 12.0) + vI * 7.0);
          vec3 col = mix(vec3(0.05, 0.09, 0.07), vec3(0.55, 0.85, 0.65), n * 0.35);
          float edge = step(0.03, vUv.x) * step(vUv.x, 0.97) * step(0.05, vUv.y) * step(vUv.y, 0.95);
          col = mix(vec3(0.62, 0.95, 0.72), col, edge);
          gl_FragColor = vec4(col, uOpacity);
          #include <colorspace_fragment>
        }`,
    });
    mat.userData.base = 1;
    deluge.mats.push(mat);
    const tiles = new THREE.InstancedMesh(geo, mat, n);
    const idx = new Float32Array(n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const c = i % cols; const r = Math.floor(i / cols);
      m.makeTranslation((c - (cols - 1) / 2) * 1.62, 0.6 + r * 0.95, 0);
      tiles.setMatrixAt(i, m);
      idx[i] = i / n;
    }
    geo.setAttribute("aIndex", new THREE.InstancedBufferAttribute(idx, 1));
    deluge.obj.add(tiles);
    tag(deluge, label(data.text.deluge ?? "", "mv-label mv-big"), new THREE.Vector3(0, 0.6 + rows * 0.95 + 0.6, 0));
    tag(deluge, label(data.text.delugeKey ?? "", "mv-label mv-key"), new THREE.Vector3(0, -0.3, 0));
  }

  /* ── Sorties: one point each ─────────────────────────────────────────── */

  const sorties = makeGroup("sorties");
  {
    const block = (count: number, side: number, x0: number): THREE.Points => {
      const pts = new Float32Array(count * 3);
      const step = 0.26;
      for (let i = 0; i < count; i++) {
        const x = i % side; const y = Math.floor(i / (side * side)); const z = Math.floor(i / side) % side;
        pts.set([x0 + (x - side / 2) * step, y * step, (z - side / 2) * step], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pts, 3));
      return new THREE.Points(g, own(sorties, new THREE.PointsMaterial({ color: THERMAL, size: 0.12, sizeAttenuation: true })));
    };
    const a = data.counts.sorties2001; const b = data.counts.sorties2010;
    sorties.obj.add(block(a, 6, -8), block(b, 20, 4));
    tag(sorties, label(data.text.sorties2001 ?? "", "mv-label mv-big"), new THREE.Vector3(-8, 2.2, 0));
    tag(sorties, label(data.text.sorties2010 ?? "", "mv-label mv-big"), new THREE.Vector3(4, 6.4, 0));
    tag(sorties, label(data.text.sortiesKey ?? "", "mv-label mv-key"), new THREE.Vector3(-2, -1, 3));
  }

  /* ── Layers of a network learning to see ─────────────────────────────── */

  const layers = makeGroup("layers");
  {
    const draws: Array<(g: CanvasRenderingContext2D) => void> = [
      (g) => { // an input frame: a road, two vehicles, a person
        g.fillStyle = "#0e1a14"; g.fillRect(0, 0, 256, 256);
        g.strokeStyle = "#3d5c4a"; g.lineWidth = 18; g.beginPath(); g.moveTo(0, 170); g.bezierCurveTo(90, 140, 160, 200, 256, 150); g.stroke();
        g.fillStyle = "#eafff1"; g.fillRect(60, 150, 26, 14); g.fillRect(170, 160, 26, 14);
        g.beginPath(); g.arc(120, 90, 6, 0, 7); g.fill();
      },
      (g) => { // lines at angles
        g.fillStyle = "#08110d"; g.fillRect(0, 0, 256, 256); g.strokeStyle = "#9dffb8"; g.lineWidth = 3;
        const r = rand(11);
        for (let i = 0; i < 90; i++) { const x = r() * 256; const y = r() * 256; const a = Math.floor(r() * 4) * Math.PI / 4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); g.stroke(); }
      },
      (g) => { // shapes: rods, cones, circles
        g.fillStyle = "#08110d"; g.fillRect(0, 0, 256, 256); g.strokeStyle = "#9dffb8"; g.lineWidth = 3;
        const r = rand(12);
        for (let i = 0; i < 26; i++) {
          const x = 20 + r() * 216; const y = 20 + r() * 216;
          if (i % 3 === 0) { g.beginPath(); g.arc(x, y, 9, 0, 7); g.stroke(); }
          else if (i % 3 === 1) { g.beginPath(); g.moveTo(x - 10, y); g.lineTo(x + 10, y); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke(); }
          else { g.beginPath(); g.moveTo(x, y - 10); g.lineTo(x + 8, y + 10); g.lineTo(x - 8, y + 10); g.closePath(); g.stroke(); }
        }
      },
      (g) => { // parts: eyes, fingers, wheels
        g.fillStyle = "#08110d"; g.fillRect(0, 0, 256, 256); g.strokeStyle = "#9dffb8"; g.fillStyle = "#9dffb8"; g.lineWidth = 3;
        const r = rand(13);
        for (let i = 0; i < 12; i++) {
          const x = 30 + r() * 196; const y = 30 + r() * 196;
          if (i % 2 === 0) { g.beginPath(); g.ellipse(x, y, 16, 9, 0, 0, 7); g.stroke(); g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
          else { g.beginPath(); g.arc(x, y, 12, 0, 7); g.stroke(); g.beginPath(); g.arc(x, y, 4, 0, 7); g.stroke(); }
        }
      },
      (g) => { // things: a person, a vehicle
        g.fillStyle = "#08110d"; g.fillRect(0, 0, 256, 256); g.fillStyle = "#eafff1";
        g.beginPath(); g.arc(80, 70, 16, 0, 7); g.fill(); g.fillRect(66, 90, 28, 70); g.fillRect(66, 160, 10, 50); g.fillRect(84, 160, 10, 50);
        g.fillRect(140, 150, 90, 36); g.fillRect(160, 128, 50, 26);
        g.fillStyle = "#08110d"; g.beginPath(); g.arc(160, 188, 10, 0, 7); g.arc(210, 188, 10, 0, 7); g.fill();
        g.strokeStyle = "#ffd400"; g.lineWidth = 4; g.strokeRect(54, 44, 52, 172); g.strokeRect(130, 118, 110, 86);
      },
    ];
    draws.forEach((d, i) => {
      const tex = canvasTexture(256, 256, d);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), own(layers, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }), i === 0 ? 1 : 0.92));
      const x = (i - 2) * 3.6;
      mesh.position.set(x, 2.4, -Math.abs(i - 2) * 0.6);
      mesh.rotation.y = -(i - 2) * 0.12;
      layers.obj.add(mesh);
      const head = i === 0 ? (data.text.layerInput ?? "") : `${i}. ${data.layers[i - 1]?.label ?? ""}`;
      tag(layers, label(head, "mv-label mv-big"), new THREE.Vector3(x, 4.3, mesh.position.z));
      if (i > 0) tag(layers, label(`“${data.layers[i - 1]?.quote ?? ""}”`, "mv-label mv-quote"), new THREE.Vector3(x, i % 2 === 1 ? 0.4 : -0.9, mesh.position.z));
    });
  }

  {
    const am = own(layers, new THREE.MeshBasicMaterial({ color: "#9dffb8" }), 0.7);
    for (let i = 0; i < 4; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 12), am);
      cone.rotation.z = -Math.PI / 2;
      cone.position.set((i - 1.5) * 3.6, 2.4, -0.3);
      layers.obj.add(cone);
    }
  }

  /* ── Pixels: what a person, a weapon, an object are to a satellite ───── */

  const pixels = makeGroup("pixels");
  {
    const W = 34; const H = 20; const sz = 0.34;
    const cells: Array<{ x: number; y: number; c: THREE.Color }> = [];
    const person = new Set<string>();
    /* The person is drawn with as many pixels as the book's upper figure. */
    const target = data.counts.pxPersonHi;
    const cx = 10; const cy = 10;
    const r = rand(5);
    const order: Array<[number, number]> = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) order.push([x, y]);
    order.sort((a, b) => Math.hypot((a[0] - cx) * 1.6, a[1] - cy) - Math.hypot((b[0] - cx) * 1.6, b[1] - cy));
    for (const [x, y] of order.slice(0, target)) person.add(`${x},${y}`);
    const weapon = new Set<string>();
    for (let k = 0; k < data.counts.pxWeapon; k++) weapon.add(`${16 + k},${15 - k}`);
    const object = new Set<string>();
    for (const [x, y] of order.map(([x, y]) => [x + 16, y] as [number, number]).filter(([x]) => x < W).slice(0, data.counts.pxObject)) object.add(`${x},${y}`);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = `${x},${y}`;
      const n = 0.07 + r() * 0.06;
      const c = weapon.has(k) ? AI_YELLOW.clone() : person.has(k) ? THERMAL.clone().multiplyScalar(0.55 + r() * 0.4)
        : object.has(k) ? new THREE.Color(data.palette.support) : new THREE.Color(n, n * 1.4, n * 1.1);
      cells.push({ x, y, c });
    }
    const mat = own(pixels, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(sz * 0.92, sz * 0.92, sz * 0.4), mat, cells.length);
    const m = new THREE.Matrix4();
    cells.forEach((c, i) => {
      m.makeTranslation((c.x - W / 2) * sz, (H / 2 - c.y) * sz + 0.2, 0);
      im.setMatrixAt(i, m); im.setColorAt(i, c.c);
    });
    pixels.obj.add(im);
    tag(pixels, label(data.text.pxPerson ?? "", "mv-label"), new THREE.Vector3((cx - W / 2) * sz, (H / 2) * sz + 0.9, 0));
    tag(pixels, label(data.text.pxWeapon ?? "", "mv-label mv-ai"), new THREE.Vector3((18 - W / 2) * sz + 0.8, (H / 2 - 13) * sz, 0.2));
    tag(pixels, label(data.text.pxObject ?? "", "mv-label"), new THREE.Vector3((26 - W / 2) * sz, (H / 2) * sz + 0.9, 0));
    tag(pixels, label(data.text.pxKey ?? "", "mv-label mv-key"), new THREE.Vector3(0, -(H / 2) * sz - 0.6, 0));
  }

  /* ── The targeting cycle: six phases, and the people in it ───────────── */

  const chain = makeGroup("chain");
  const humans: Array<{ o: THREE.Group; home: THREE.Vector3; out: THREE.Vector3; leaves: boolean }> = [];
  const chips: THREE.Mesh[] = [];
  let withMaven = false;
  let chainK = 0;
  {
    const ringMat = own(chain, new THREE.MeshBasicMaterial({ color: "#3b5a4a" }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(7, 0.05, 8, 96), ringMat);
    ring.rotation.x = Math.PI / 2;
    chain.obj.add(ring);
    const nodeMat = own(chain, new THREE.MeshBasicMaterial({ color: "#9dffb8" }));
    data.phases.forEach((ph, i) => {
      const a = (i / data.phases.length) * Math.PI * 2 - Math.PI / 2;
      const p = new THREE.Vector3(Math.cos(a) * 7, 0, Math.sin(a) * 7);
      const node = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.2, 24), nodeMat);
      node.position.copy(p);
      chain.obj.add(node);
      tag(chain, label(`${i + 1}. ${ph}`, "mv-label mv-phase"), p.clone().multiplyScalar(1.28).setY(0.6));
    });
    const skin = own(chain, new THREE.MeshBasicMaterial({ color: THERMAL }));
    const chipMat = own(chain, new THREE.MeshBasicMaterial({ color: AI_YELLOW }));
    const n = data.phases.length;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2 + Math.PI / n;
      const home = new THREE.Vector3(Math.cos(a) * 3.4, 0, Math.sin(a) * 3.4);
      const out = new THREE.Vector3(Math.cos(a) * 16, 0, Math.sin(a) * 16);
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 2, 8), skin); body.position.y = 0.65;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin); head.position.y = 1.55;
      g.add(body, head); g.position.copy(home);
      chain.obj.add(g);
      /* Which four leave is not the book's claim; it names only the two that
       * remain, as steps rather than as positions on this ring. */
      humans.push({ o: g, home, out, leaves: i % 3 !== 0 });
      const chip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), chipMat);
      chip.position.copy(home).setY(0.5); chip.scale.setScalar(0);
      chain.obj.add(chip); chips.push(chip);
    }
    tag(chain, label(data.text.chainCount ?? "", "mv-label mv-big"), new THREE.Vector3(0, 0.1, 0));
  }
  function placeChain(dt: number): void {
    const target = withMaven ? 1 : 0;
    chainK = reducedMotion ? target : chainK + (target - chainK) * Math.min(1, dt * 2.2);
    humans.forEach((h, i) => {
      const k = h.leaves ? chainK : 0;
      h.o.position.lerpVectors(h.home, h.out, k);
      h.o.scale.setScalar(1 - k * 0.6);
      const chip = chips[i];
      if (chip) { chip.scale.setScalar(h.leaves ? chainK : 0); chip.rotation.y = time * 0.6; }
    });
    const el = groups.chain?.labels.at(-1)?.element;
    if (el) el.textContent = withMaven ? (data.text.chainAfter ?? "") : (data.text.chainBefore ?? "");
  }

  /* ── Tempo: one cube per target a day ────────────────────────────────── */

  const tempo = makeGroup("tempo");
  const TMAX = data.counts.tempo[2];
  const tempoMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), own(tempo, new THREE.MeshBasicMaterial({ color: 0xffffff })), TMAX);
  let tempoShown = 0; let tempoTarget = 0;
  {
    const m = new THREE.Matrix4();
    const [a, b] = data.counts.tempo;
    const blocksAcross = 10;
    for (let i = 0; i < TMAX; i++) {
      const blk = Math.floor(i / 100); const j = i % 100;
      const bx = blk % blocksAcross; const bz = Math.floor(blk / blocksAcross);
      const x = (bx - (blocksAcross - 1) / 2) * 2.3 + ((j % 10) - 4.5) * 0.2;
      const z = (2 - bz) * 2.3 + (Math.floor(j / 10) - 4.5) * 0.2;
      m.makeTranslation(x, 0, z);
      tempoMesh.setMatrixAt(i, m);
      tempoMesh.setColorAt(i, i < a ? THERMAL : i < b ? AI_YELLOW : new THREE.Color(data.palette.support));
    }
    tempoMesh.count = 0;
    tempo.obj.add(tempoMesh);
    tag(tempo, label("", "mv-label mv-big"), new THREE.Vector3(0, 1.4, 0));
  }
  /* Each level frames what it adds: one block, one row, the whole field. */
  const TEMPO_VIEW: Array<{ pos: [number, number, number]; look: [number, number, number]; tag: [number, number, number] }> = [
    { pos: [-10.35, 8, 8.5], look: [-10.35, 0, 4.6], tag: [-10.35, 1.6, 4.6] },
    { pos: [0, 13, 15], look: [0, 0, 4.6], tag: [0, 1.6, 3.2] },
    { pos: [0, 21, 18], look: [0, 0, 0], tag: [0, 1.6, -6.2] },
  ];
  let tempoLevel: 0 | 1 | 2 = 0;
  function placeTempo(dt: number): void {
    tempoShown = reducedMotion ? tempoTarget : tempoShown + (tempoTarget - tempoShown) * Math.min(1, dt * 2.5);
    if (Math.abs(tempoTarget - tempoShown) < 1) tempoShown = tempoTarget;
    tempoMesh.count = Math.round(tempoShown);
    const el = groups.tempo?.labels.at(-1)?.element;
    if (el) el.textContent = `${data.text[`tempo${tempoLevel}`] ?? ""} · ${data.text.tempoKey ?? ""}`;
    groups.tempo?.labels.at(-1)?.position.set(...TEMPO_VIEW[tempoLevel]!.tag);
  }

  /* ── The globe ───────────────────────────────────────────────────────── */

  const globe = makeGroup("globe");
  const spin = new THREE.Group();
  globe.obj.add(spin);
  /* Open on the Middle East and the Horn of Africa, where the book's story starts. */
  spin.rotation.set(0.32, -2.45, 0);
  const markers: THREE.Mesh[] = [];
  const toXYZ = (lon: number, lat: number, r: number) => {
    const phi = (90 - lat) * Math.PI / 180; const th = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
  };
  {
    spin.add(new THREE.Mesh(new THREE.SphereGeometry(5, 64, 48), own(globe, new THREE.MeshBasicMaterial({ color: "#0d1713" }))));
    const kinds = { deployed: data.palette.deployed, support: data.palette.support, watched: data.palette.watched };
    for (const w of data.where) {
      const mk = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), own(globe, new THREE.MeshBasicMaterial({ color: kinds[w.kind] })));
      mk.position.copy(toXYZ(w.position[0], w.position[1], 5.06));
      mk.userData = { name: w.name, kind: w.kind, cite: w.cite };
      spin.add(mk); markers.push(mk);
    }
    /* Outlines load after first paint; the markers do not wait for them. */
    void Promise.all([import("world-atlas/countries-110m.json"), import("topojson-client")]).then(([topoMod, tj]) => {
      const topo = (topoMod as unknown as { default: unknown }).default ?? topoMod;
      const mesh = tj.mesh(topo as never, (topo as { objects: { countries: never } }).objects.countries) as unknown as { coordinates: number[][][] };
      const pts: number[] = [];
      for (const line of mesh.coordinates) {
        for (let i = 1; i < line.length; i++) {
          const a = line[i - 1]!; const b = line[i]!;
          const va = toXYZ(a[0]!, a[1]!, 5.01); const vb = toXYZ(b[0]!, b[1]!, 5.01);
          pts.push(va.x, va.y, va.z, vb.x, vb.y, vb.z);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const lm = own(globe, new THREE.LineBasicMaterial({ color: "#4f7a64" }));
      lm.opacity = groups.globe?.fade ?? 0;
      spin.add(new THREE.LineSegments(g, lm));
    }).catch(() => { /* the globe still shows its markers */ });
  }
  const tip = document.createElement("div");
  tip.className = "mv-tip";
  tip.style.opacity = "0";
  overlay.appendChild(tip);
  let drag: { x: number; y: number } | null = null;
  let spinVel = reducedMotion ? 0 : 0.035;
  const pointer = new THREE.Vector2();
  const ray = new THREE.Raycaster();

  /* ── The van: a schematic of the book's description ──────────────────── */

  const van = makeGroup("van");
  const vanPath: THREE.Vector3[] = [new THREE.Vector3(6, 0.2, -11), new THREE.Vector3(6, 0.2, 3), new THREE.Vector3(-2.5, 0.2, 3)];
  const vanMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 1), own(van, new THREE.MeshBasicMaterial({ color: THERMAL })));
  const vanBox = new THREE.Mesh(squareFrame(0.85), own(van, new THREE.MeshBasicMaterial({ color: AI_YELLOW, side: THREE.DoubleSide, depthTest: false })));
  vanBox.renderOrder = 6;
  let vanT = 0;
  {
    const lineMat = own(van, new THREE.LineBasicMaterial({ color: "#5c7d6b" }));
    const seg = (pts: number[][]) => {
      const g = new THREE.BufferGeometry().setFromPoints(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)));
      van.obj.add(new THREE.Line(g, lineMat));
    };
    seg([[6, -14], [6, 3]]);            // the road south through the village
    seg([[-9, 3], [12, 3]]);             // the road at the T-junction, running west
    seg([[-12, -2], [-6, -2], [-6, 4], [-12, 4], [-12, -2]]); // the compound's wall
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(34, 30), own(van, new THREE.MeshBasicMaterial({ color: "#0b1210" })));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02;
    van.obj.add(ground);
    const hut = own(van, new THREE.MeshBasicMaterial({ color: "#1c2a23" }));
    const r = rand(9);
    for (let i = 0; i < 22; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.9), hut);
      b.position.set(8 + r() * 6, 0, -12 + r() * 13); van.obj.add(b);
    }
    van.obj.add(vanMesh, vanBox);
    tag(van, label(data.text.vanCompound ?? "", "mv-label"), new THREE.Vector3(-9, 0.5, -3.2));
    tag(van, label(data.text.vanVillage ?? "", "mv-label"), new THREE.Vector3(11, 0.5, -13));
    tag(van, label(data.text.vanJunction ?? "", "mv-label"), new THREE.Vector3(7.6, 0.5, 4.4));
    tag(van, label("N ↑", "mv-label mv-key"), new THREE.Vector3(-14, 0.5, -12));
    tag(van, label(data.text.vanKey ?? "", "mv-label mv-key"), new THREE.Vector3(0, 0.5, 9.5));
    tag(van, label(data.text.vanDetect ?? "", "mv-label mv-ai"), new THREE.Vector3(0, 1.4, 0), vanMesh);
  }
  function placeVan(dt: number): void {
    vanT = reducedMotion ? 1 : Math.min(1, vanT + dt * 0.14);
    const total = 14 + 8.5;
    const d = vanT * total;
    const p = d <= 14 ? vanPath[0]!.clone().lerp(vanPath[1]!, d / 14) : vanPath[1]!.clone().lerp(vanPath[2]!, (d - 14) / 8.5);
    vanMesh.position.copy(p);
    vanMesh.rotation.y = d <= 14 ? 0 : Math.PI / 2;
    vanBox.position.copy(p).setY(0.5);
    vanBox.quaternion.copy(camera.quaternion);
    vanBox.scale.setScalar(1.8);
  }

  /* ── Under the sea ───────────────────────────────────────────────────── */

  const sea = makeGroup("sea");
  const rings: THREE.Mesh[] = [];
  const sub = new THREE.Group();
  let spec: THREE.CanvasTexture | null = null;
  let specCtx: CanvasRenderingContext2D | null = null;
  {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(80, 80, 1, 1), own(sea, new THREE.MeshBasicMaterial({ color: "#0e2a33", side: THREE.DoubleSide }), 0.35));
    water.rotation.x = -Math.PI / 2; sea.obj.add(water);
    const bedGeo = new THREE.PlaneGeometry(80, 80, 80, 80); bedGeo.rotateX(-Math.PI / 2);
    const bp = bedGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < bp.count; i++) bp.setY(i, -9 + heightAt(bp.getX(i) * 0.7, bp.getZ(i) * 0.7) * 0.8);
    sea.obj.add(new THREE.Mesh(bedGeo, own(sea, new THREE.MeshBasicMaterial({ color: "#1a3b44", wireframe: true }), 0.35)));
    const hull = own(sea, new THREE.MeshBasicMaterial({ color: "#c9e4ea" }));
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, 5, 4, 12), hull); body.rotation.z = Math.PI / 2;
    const sail = new THREE.Mesh(new THREE.BoxGeometry(1, 0.9, 0.3), hull); sail.position.set(0.6, 0.9, 0);
    sub.add(body, sail); sub.position.set(-6, -4.5, -2); sea.obj.add(sub);
    const ringMat = own(sea, new THREE.MeshBasicMaterial({ color: "#7fd6e8", side: THREE.DoubleSide, depthWrite: false }), 0.5);
    for (let i = 0; i < 4; i++) {
      const rg = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 64), ringMat.clone());
      (rg.material as THREE.Material).userData.base = 0.5;
      sea.mats.push(rg.material as THREE.Material);
      rg.rotation.x = -Math.PI / 2; rg.userData.phase = i / 4;
      sea.obj.add(rg); rings.push(rg);
    }
    const arr = own(sea, new THREE.MeshBasicMaterial({ color: AI_YELLOW }));
    for (let i = 0; i < 16; i++) {
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), arr);
      h.position.set(4 + i * 0.7, -1.2 - i * 0.05, 5); sea.obj.add(h);
    }
    spec = canvasTexture(256, 128, (g) => { g.fillStyle = "#04090b"; g.fillRect(0, 0, 256, 128); });
    specCtx = (spec.image as HTMLCanvasElement).getContext("2d");
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), own(sea, new THREE.MeshBasicMaterial({ map: spec, side: THREE.DoubleSide })));
    panel.position.set(6, 3.5, -7); panel.rotation.y = -0.2;
    sea.obj.add(panel);
    tag(sea, label(data.text.seaSpec ?? "", "mv-label mv-key"), new THREE.Vector3(6, 6, -7));
    tag(sea, label(data.text.seaArray ?? "", "mv-label mv-ai"), new THREE.Vector3(9.5, -0.2, 5));
    tag(sea, label(data.text.seaKey ?? "", "mv-label mv-big"), new THREE.Vector3(0, 0, 0), sub);
    groups.sea!.labels.at(-1)!.position.set(0, 2.2, 0);
  }
  let specX = 0;
  function placeSea(dt: number): void {
    sub.position.x = -6 + Math.sin(time * 0.1) * 3;
    rings.forEach((rg) => {
      const k = ((time * 0.12 + (rg.userData.phase as number)) % 1);
      rg.position.copy(sub.position);
      rg.scale.setScalar(1 + k * 8);
      const m = rg.material as THREE.MeshBasicMaterial;
      m.opacity = (1 - k) * 0.5 * (groups.sea?.fade ?? 0);
    });
    if (specCtx && spec && !reducedMotion) {
      specX = (specX + dt * 40) % 256;
      const x = Math.floor(specX);
      specCtx.fillStyle = "#04090b"; specCtx.fillRect(x, 0, 3, 128);
      for (let y = 0; y < 128; y += 2) {
        const band = y === 38 || y === 40 || y === 76 ? 0.9 : 0;
        const v = Math.min(1, band + Math.random() * 0.25);
        specCtx.fillStyle = `rgba(127,214,232,${v.toFixed(2)})`;
        specCtx.fillRect(x, y, 3, 2);
      }
      spec.needsUpdate = true;
    }
  }

  /* ── A swarm of uncrewed boats ───────────────────────────────────────── */

  const swarm = makeGroup("swarm");
  const boats: Array<{ o: THREE.Mesh; x: number; z: number; ph: number }> = [];
  {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(90, 90, 60, 60), own(swarm, new THREE.MeshBasicMaterial({ color: "#12323b", wireframe: true }), 0.4));
    water.rotation.x = -Math.PI / 2; swarm.obj.add(water);
    const hullMat = own(swarm, new THREE.MeshBasicMaterial({ color: THERMAL }));
    const hull = new THREE.ConeGeometry(0.2, 0.85, 4); hull.rotateX(Math.PI / 2);
    const r = rand(21);
    for (let i = 0; i < 64; i++) {
      const o = new THREE.Mesh(hull, hullMat);
      const x = (i % 8 - 3.5) * 1.8 + (r() - 0.5); const z = (Math.floor(i / 8) - 3.5) * 1.8 + (r() - 0.5);
      o.position.set(x, 0.2, z); swarm.obj.add(o); boats.push({ o, x, z, ph: r() * 6 });
    }
    tag(swarm, label(data.text.swarmKey ?? "", "mv-label mv-big"), new THREE.Vector3(0, 3, -9));
  }
  function placeSwarm(): void {
    for (const b of boats) {
      b.o.position.set(b.x + Math.sin(time * 0.3 + b.ph) * 0.4, 0.2 + Math.sin(time * 1.4 + b.ph) * 0.05, b.z - ((time * 0.8) % 12) + 6);
    }
  }

  /* ── The end: one dot ────────────────────────────────────────────────── */

  const end = makeGroup("end");
  const lastDot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 16), own(end, new THREE.MeshBasicMaterial({ color: 0xffffff })));
  const lastHalo = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 16), own(end, new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false }), 0.07));
  end.obj.add(lastDot, lastHalo);

  /* ── Steps: which groups, which pose ─────────────────────────────────── */

  interface Pose { pos: [number, number, number]; look: [number, number, number]; show: string[]; orbit?: boolean }
  const POSES: Record<StepId, Pose> = {
    feed: { pos: [0, 15, 27], look: [0, 0, 0], show: ["terrain", "actors"], orbit: true },
    deluge: { pos: [0, 5.5, 17], look: [0, 4, 0], show: ["deluge"] },
    sorties: { pos: [-1, 7, 21], look: [-1.5, 2.2, 0], show: ["sorties"] },
    dots: { pos: [0, 11, 19], look: [0, 0, 0], show: ["terrain", "actors", "dots"], orbit: true },
    layers: { pos: [1.5, 4, 22], look: [0, 2, 0], show: ["layers"] },
    pixels: { pos: [0, 0.2, 15], look: [0, 0.2, 0], show: ["pixels"] },
    boxes: { pos: [0, 5, 15], look: [0, 4.5, -10], show: ["terrain", "actors", "boxes", "sky"] },
    accuracy: { pos: [0, 16, 22], look: [0, 0, 0], show: ["terrain", "actors", "thin"], orbit: true },
    chain: { pos: [0, 23, 17], look: [0, 0, 0.5], show: ["chain"] },
    tempo: { pos: [-10.35, 8, 8.5], look: [-10.35, 0, 4.6], show: ["tempo"] },
    globe: { pos: [0, 2, 15.5], look: [0, 0, 0], show: ["globe"] },
    van: { pos: [0.5, 38, 5], look: [0.5, 0, -1], show: ["van"] },
    sea: { pos: [1, 10, 22], look: [1, -3.5, 0], show: ["sea"] },
    swarm: { pos: [0, 15, 25], look: [0, 0, 0], show: ["swarm"] },
    end: { pos: [0, 0, 9], look: [0, 0, 0], show: ["end"] },
  };
  let step: StepId = "feed";
  const camPos = new THREE.Vector3(...POSES.feed.pos);
  const camLook = new THREE.Vector3(...POSES.feed.look);
  const lookNow = camLook.clone();
  let firstStep = true;

  function setStep(id: StepId): void {
    step = id;
    const pose = POSES[id];
    for (const [gid, g] of Object.entries(groups)) g.target = pose.show.includes(gid) ? 1 : 0;
    camPos.set(...pose.pos); camLook.set(...pose.look);
    if (id === "tempo") { camPos.set(...TEMPO_VIEW[tempoLevel]!.pos); camLook.set(...TEMPO_VIEW[tempoLevel]!.look); }
    if (id === "deluge") delugeU.uProgress.value = reducedMotion ? 1 : 0;
    if (id === "van") vanT = 0;
    if (id === "dots") detectRate = 1;
    if (id === "boxes") detectRate = 0.85;
    if (firstStep || reducedMotion) {
      camera.position.copy(camPos); lookNow.copy(camLook);
      for (const g of Object.values(groups)) g.fade = g.target;
      firstStep = false;
    }
  }

  /* ── Pointer: drag the globe, hover its markers ──────────────────────── */

  const onDown = (e: PointerEvent) => { if (step === "globe") { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); } };
  const onUp = (e: PointerEvent) => { drag = null; if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); };
  const onMove = (e: PointerEvent) => {
    if (step !== "globe") { tip.style.opacity = "0"; return; }
    if (drag) {
      spin.rotation.y += (e.clientX - drag.x) * 0.006;
      spin.rotation.x = Math.max(-0.8, Math.min(0.8, spin.rotation.x + (e.clientY - drag.y) * 0.004));
      drag = { x: e.clientX, y: e.clientY }; spinVel = 0;
    }
    const rect = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects(markers, false)[0];
    if (hit) {
      const u = hit.object.userData as { name: string; kind: string; cite: string };
      tip.textContent = `${u.name} — ${data.text[`kind_${u.kind}`] ?? u.kind} (${u.cite})`;
      tip.style.left = `${e.clientX - rect.left + 12}px`;
      tip.style.top = `${e.clientY - rect.top + 12}px`;
      tip.style.opacity = "1";
    } else tip.style.opacity = "0";
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointermove", onMove);

  /* ── Loop ────────────────────────────────────────────────────────────── */

  let active = true;
  let raf = 0;
  let last = performance.now();
  const up = new THREE.Vector3(0, 1, 0);

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    if (!active) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!reducedMotion) time += dt;

    const k = reducedMotion ? 1 : Math.min(1, dt * 2.4);
    for (const g of Object.values(groups)) {
      g.fade += (g.target - g.fade) * k;
      if (Math.abs(g.target - g.fade) < 0.002) g.fade = g.target;
      g.obj.visible = g.fade > 0.003;
      for (const m of g.mats) {
        const base = (m.userData.base as number | undefined) ?? 1;
        if (m instanceof THREE.ShaderMaterial) (m.uniforms.uOpacity as { value: number }).value = g.fade * base;
        else if (!(m instanceof THREE.MeshBasicMaterial && rings.some((r) => r.material === m))) m.opacity = g.fade * base;
      }
      for (const l of g.labels) {
        l.element.style.opacity = String(g.fade);
        l.visible = g.fade > 0.05;
      }
    }

    const pose = POSES[step];
    const target = camPos.clone();
    if (pose.orbit && !reducedMotion) target.applyAxisAngle(up, Math.sin(time * 0.05) * 0.35);
    camera.position.lerp(target, k * 0.8);
    lookNow.lerp(camLook, k * 0.8);
    camera.lookAt(lookNow);

    terrainUniforms.uTime.value = time;
    delugeU.uTime.value = time;
    if (step === "deluge") delugeU.uProgress.value = Math.min(1, delugeU.uProgress.value + dt * 0.45);

    if (groups.actors!.obj.visible) placeActors();
    if (groups.dots!.obj.visible || groups.boxes!.obj.visible || groups.thin!.obj.visible) placeDetections();
    if (groups.chain!.obj.visible) placeChain(dt);
    if (groups.tempo!.obj.visible) placeTempo(dt);
    if (groups.van!.obj.visible) placeVan(dt);
    if (groups.sea!.obj.visible) placeSea(dt);
    if (groups.swarm!.obj.visible) placeSwarm();
    if (groups.globe!.obj.visible && !drag) spin.rotation.y += dt * spinVel;
    if (groups.end!.obj.visible) lastHalo.scale.setScalar(1 + Math.sin(time * 1.6) * 0.15);

    renderer.render(scene, camera);
    css.render(scene, camera);
  }

  function resize(): void {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    css.setSize(w, h);
    camera.aspect = w / h;
    /* On a portrait phone, pull back so the wide arrangements still fit. */
    camera.fov = w / h < 0.8 ? 62 : 45;
    /* The wide arrangements shrink to fit a portrait screen rather than crop. */
    for (const id of ["layers", "pixels", "chain", "van"]) groups[id]?.obj.scale.setScalar(w / h < 0.8 ? 0.6 : 1);
    /*
     * The text sits in a column on the left on a wide screen and along the
     * bottom on a narrow one, so the picture is centred in what is left.
     */
    if (w >= 900) camera.setViewOffset(w, h, -Math.round(w * 0.17), 0, w, h);
    else camera.setViewOffset(w, h, 0, Math.round(h * 0.17), w, h);
    camera.updateProjectionMatrix();
  }

  resize();
  setStep("feed");
  raf = requestAnimationFrame(frame);

  return {
    setStep,
    setAccuracy(rate, ground) {
      detectRate = rate;
      const [lo, hi] = PAL[ground];
      terrainUniforms.uLow.value.copy(lo);
      terrainUniforms.uHigh.value.copy(hi);
    },
    setChain(v) { withMaven = v; },
    setTempo(level) {
      tempoTarget = data.counts.tempo[level];
      tempoLevel = level;
      if (step === "tempo") { camPos.set(...TEMPO_VIEW[level]!.pos); camLook.set(...TEMPO_VIEW[level]!.look); }
    },
    setActive(v) { active = v; },
    resize,
    dispose() {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointermove", onMove);
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        const mats = Array.isArray(mat) ? mat : mat ? [mat] : [];
        for (const m of mats) {
          const mm = m as THREE.MeshBasicMaterial;
          mm.map?.dispose();
          m.dispose();
        }
      });
      renderer.dispose();
      overlay.replaceChildren();
    },
  };
}
