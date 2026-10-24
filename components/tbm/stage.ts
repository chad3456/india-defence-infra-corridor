/**
 * The three.js particle stage behind /tbm.
 *
 * One cloud of points, rearranged for each scroll step: a tunnel boring
 * machine assembling itself, flying apart into its parts, boring through rock,
 * India's machines drawn to scale, a map of where they are digging, and the
 * supply lines that feed them. Each particle eases from where it is to where
 * the step wants it, so every change of picture is a single continuous motion.
 *
 * ── What the pictures are and are not ────────────────────────────────────
 *
 * The machine is a generic diagram, not any one TBM, and not to scale. Three
 * pictures do encode numbers, all passed in from the sourced register: the
 * rings are each machine's reported diameter at true relative size; the map's
 * beads are one per machine named in reporting; and the parts' colours are
 * where reporting says each part is made. Everything else carries no number.
 * The supply map is schematic — Schwanau and Guangzhou are placed for
 * legibility, not by longitude.
 */
import * as THREE from "three";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { PART_ORDER, type PartId, type TbmStageData } from "@/lib/tbm";

export type StepId = "rock" | "machine" | "exploded" | "boring" | "sizes" | "claims" | "origin" | "map" | "supply" | "finale";

export interface Stage {
  setStep(id: StepId): void;
  setActive(active: boolean): void;
  resize(): void;
  dispose(): void;
}

/* The stage is always dark, in either site theme, so its colours are fixed. */
const C = {
  bg: "#04060c",
  part: { cutterhead: "#ffb547", drive: "#ff7d5c", shield: "#7cb6ff", thrust: "#9fa8ff", erector: "#c9a2ff", muck: "#7fe3c4", backup: "#71809e" } as Record<PartId, string>,
  lining: "#5d72a0", rock: ["#8a6d52", "#6b5642", "#a3866a", "#4e4034"], dust: "#2a3348",
  india: "#3ddc97", imported: "#ff6b6b", unreported: "#5b6377", mixedB: "#ffb547",
  ring: { built: "#7cb6ff", stated: "#ffb547", target: "#ff7d5c", planned: "#3ddc97" },
  map: "#5e86c9", border: "#2c3d5e", bead: "#ffb547", maker: "#3ddc97", stream: "#7cb6ff", china: "#ff6b6b", wall: "#ff4d4d",
};

/* Machine geometry, in stage units: a generic TBM along the x axis, cutterhead at the front (+x). */
const R = 5, XC = 9, SHIELD_LEN = 11, BACKUP_LEN = 26;
const N_DESKTOP = 34000, N_MOBILE = 17000;

/** How many particles each part takes, as a share of the machine's budget. */
const SHARE: Record<PartId | "lining", number> = { cutterhead: 0.2, drive: 0.07, shield: 0.2, thrust: 0.05, erector: 0.05, muck: 0.08, backup: 0.17, lining: 0.18 };

interface Scene {
  pos: Float32Array;
  col: Float32Array;
  size: Float32Array;
  /** Per particle: radians per second about the machine's axis (the cutterhead turning). */
  spin?: Float32Array;
  /** Per particle: units per second along -x, wrapping inside [lo, hi] (rock and lining streaming past an advancing machine). */
  flow?: Float32Array;
  lo?: Float32Array;
  hi?: Float32Array;
  /** Per particle: a curve to travel along and a starting phase (supply lines); `pos` then holds a small jitter. */
  curve?: Int16Array;
  phase?: Float32Array;
  curves?: Array<[THREE.Vector3, THREE.Vector3, THREE.Vector3]>;
  camera: { pos: [number, number, number]; look: [number, number, number] };
  labels: Array<{ at: [number, number, number]; html: string; cls?: string }>;
  /** Slow turn of the whole cloud, radians per second. */
  orbit?: number;
}

const rand = mulberry(20261022);
function mulberry(seed: number) { let a = seed; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
const hex = (h: string) => new THREE.Color(h);

/** Which part each particle index belongs to in the machine scenes — fixed, so a part's particles stay a part across scenes. */
function partRanges(n: number): Record<PartId | "lining", [number, number]> {
  const out = {} as Record<PartId | "lining", [number, number]>;
  let at = 0;
  for (const k of [...PART_ORDER, "lining"] as const) { const c = Math.floor(n * SHARE[k]); out[k] = [at, at + c]; at += c; }
  out.lining[1] = n;
  return out;
}

/** One point of a part, in machine coordinates; `explode` shifts each part along the axis. */
function partPoint(part: PartId | "lining", i: number, count: number): [number, number, number, number] {
  const f = i / count;
  switch (part) {
    case "cutterhead": {
      // Rim, six spokes, a hub and disc cutters, on a thin disc at the front.
      const u = rand();
      if (u < 0.28) { const a = rand() * Math.PI * 2, r = R * (0.9 + 0.1 * rand()); return [XC + 0.3 * rand(), r * Math.cos(a), r * Math.sin(a), 1]; }
      if (u < 0.62) { const k = Math.floor(rand() * 6), a = (k / 6) * Math.PI * 2 + gauss() * 0.06, r = R * (0.12 + 0.8 * rand()); return [XC + 0.25 * rand(), r * Math.cos(a), r * Math.sin(a), 1]; }
      if (u < 0.72) { const a = rand() * Math.PI * 2, r = R * 0.16 * Math.sqrt(rand()); return [XC + 0.5 * rand(), r * Math.cos(a), r * Math.sin(a), 1.2]; }
      // Disc cutters: tight bright clusters at fixed radii on the spokes and between them.
      const c = Math.floor(rand() * 54), ring = 0.2 + 0.72 * ((c % 9) / 8), a0 = (Math.floor(c / 9) / 6) * Math.PI * 2 + ((c % 2) ? 0.26 : 0);
      return [XC + 0.45 + 0.15 * rand(), R * ring * Math.cos(a0) + gauss() * 0.12, R * ring * Math.sin(a0) + gauss() * 0.12, 1.7];
    }
    case "drive": {
      if (rand() < 0.55) { const a = rand() * Math.PI * 2, r = R * (0.42 + 0.06 * gauss()); return [XC - 1.2 + 0.6 * rand(), r * Math.cos(a), r * Math.sin(a), 1.1]; }
      const m = Math.floor(rand() * 8), a = (m / 8) * Math.PI * 2, r = R * 0.62;
      return [XC - 1.6 - 2.2 * rand(), r * Math.cos(a) + gauss() * 0.22, r * Math.sin(a) + gauss() * 0.22, 0.9];
    }
    case "shield": {
      // A cut-away shell: the side facing the viewer (+z) is left open so the inside shows.
      let a = rand() * Math.PI * 2;
      if (Math.sin(a) > 0.55) a += Math.PI;
      const x = XC - 0.5 - SHIELD_LEN * rand();
      return [x, R * 1.0 * Math.cos(a), R * 1.0 * Math.sin(a), 0.8];
    }
    case "thrust": {
      const k = Math.floor(rand() * 16), a = (k / 16) * Math.PI * 2, r = R * 0.82;
      return [XC - 5 - 4.5 * rand(), r * Math.cos(a) + gauss() * 0.1, r * Math.sin(a) + gauss() * 0.1, 0.9];
    }
    case "erector": {
      const u = rand();
      if (u < 0.6) { const a = rand() * Math.PI * 2, r = R * (0.55 + 0.04 * gauss()); return [XC - 9.8 + 0.4 * rand(), r * Math.cos(a), r * Math.sin(a), 1]; }
      const t = rand(), a = 0.9;
      return [XC - 10 + 0.6 * rand(), R * 0.55 * Math.cos(a) * (1 - t) + R * 0.85 * t * Math.cos(a + 0.6), R * 0.55 * Math.sin(a) * (1 - t) + R * 0.85 * t * Math.sin(a + 0.6), 1.1];
    }
    case "muck": {
      // A screw conveyor rising from the bottom of the chamber towards the rear, as a helix.
      const t = rand(), x = XC - 1 - (SHIELD_LEN + 4) * t, cy = -R * 0.6 + R * 0.7 * t, th = t * 60 + (rand() < 0.5 ? 0 : Math.PI);
      return [x, cy + 0.55 * Math.cos(th), 0.55 * Math.sin(th), 1];
    }
    case "backup": {
      // Four gantries: box frames behind the shield, drawn as their edges.
      const g = Math.floor(rand() * 4), x0 = XC - SHIELD_LEN - 1.5 - g * (BACKUP_LEN / 4), len = BACKUP_LEN / 4 - 0.8;
      const e = Math.floor(rand() * 12), t = rand(), w = R * 0.7, h = R * 0.62;
      const cx = [x0, x0 - len], cy = [-h, h], cz = [-w, w];
      const pick = (v: number[], b: number) => v[b]!;
      let p: [number, number, number];
      if (e < 4) p = [x0 - len * t, pick(cy, e & 1), pick(cz, (e >> 1) & 1)];
      else if (e < 8) p = [pick(cx, (e - 4) & 1), -h + 2 * h * t, pick(cz, ((e - 4) >> 1) & 1)];
      else p = [pick(cx, (e - 8) & 1), pick(cy, ((e - 8) >> 1) & 1), -w + 2 * w * t];
      return [p[0], p[1] + gauss() * 0.04, p[2] + gauss() * 0.04, 0.7];
    }
    case "lining": {
      // Rings of concrete segments behind the shield, with the joints left as gaps.
      const ring = Math.floor(f * 22), x = XC - SHIELD_LEN - 0.4 - ring * 1.25 - 0.9 * rand();
      let a = rand() * Math.PI * 2;
      if ((a * 7 / (Math.PI * 2)) % 1 < 0.04) a += 0.05;
      if (Math.sin(a) > 0.55) a += Math.PI;
      return [x, R * 1.04 * Math.cos(a), R * 1.04 * Math.sin(a), 0.6];
    }
  }
}

const EXPLODE: Record<PartId | "lining", number> = { cutterhead: 14, drive: 9, shield: 3, thrust: -3, erector: -8, muck: -13, backup: -19, lining: -26 };

export function createStage(canvas: HTMLCanvasElement, overlay: HTMLDivElement, data: TbmStageData, reduced: boolean): Stage {
  const narrow = window.innerWidth < 720;
  const n = narrow ? N_MOBILE : N_DESKTOP;
  const ranges = partRanges(n);
  const partOf = new Array<PartId | "lining">(n);
  for (const [k, [a, b]] of Object.entries(ranges) as Array<[PartId | "lining", [number, number]]>) for (let i = a; i < b; i++) partOf[i] = k;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(hex(C.bg));
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.inset = "0";
  overlay.appendChild(labelRenderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 600);
  const group = new THREE.Group();
  scene.add(group);

  /* The particles. */
  const geo = new THREE.BufferGeometry();
  const cur = new Float32Array(n * 3), curCol = new Float32Array(n * 3), curSize = new Float32Array(n);
  for (let i = 0; i < n; i++) { cur[i * 3] = (rand() - 0.5) * 120; cur[i * 3 + 1] = (rand() - 0.5) * 80; cur[i * 3 + 2] = (rand() - 0.5) * 80; curSize[i] = 0.5; }
  geo.setAttribute("position", new THREE.BufferAttribute(cur, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(curCol, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(curSize, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 1 } },
    vertexShader: `
      attribute vec3 aColor; attribute float aSize; varying vec3 vColor;
      uniform float uScale;
      void main() {
        vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        vec2 c = gl_PointCoord - 0.5; float d = length(c);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vColor * (0.55 + 0.6 * a), a * 0.9);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  group.add(points);

  /* Scene builders. */
  const empty = (): Pick<Scene, "pos" | "col" | "size"> => ({ pos: new Float32Array(n * 3), col: new Float32Array(n * 3), size: new Float32Array(n) });
  const put = (s: Pick<Scene, "pos" | "col" | "size">, i: number, p: [number, number, number], c: THREE.Color, size: number) => {
    s.pos[i * 3] = p[0]; s.pos[i * 3 + 1] = p[1]; s.pos[i * 3 + 2] = p[2];
    s.col[i * 3] = c.r; s.col[i * 3 + 1] = c.g; s.col[i * 3 + 2] = c.b; s.size[i] = size;
  };
  const partCols = Object.fromEntries(PART_ORDER.map((p) => [p, hex(C.part[p])])) as Record<PartId, THREE.Color>;
  const liningCol = hex(C.lining);
  const machinePts: Array<[number, number, number, number]> = [];
  for (let i = 0; i < n; i++) { const k = partOf[i]!; const [a, b] = ranges[k]; machinePts.push(partPoint(k, i - a, b - a)); }

  const dim = (c: THREE.Color, f: number) => c.clone().multiplyScalar(f);
  const lab = (text: string, sub?: string) => `<span class="tbm-lab-t">${text}</span>${sub ? `<span class="tbm-lab-s">${sub}</span>` : ""}`;

  function machine(opts: { explode?: boolean; colour?: (k: PartId | "lining", i: number) => THREE.Color; spin?: boolean }): Pick<Scene, "pos" | "col" | "size" | "spin"> {
    const s = { ...empty(), spin: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      const k = partOf[i]!, [x, y, z, sz] = machinePts[i]!;
      const dx = opts.explode ? EXPLODE[k] * 1.1 : 0;
      const c = opts.colour ? opts.colour(k, i) : k === "lining" ? liningCol : partCols[k];
      put(s, i, [x + dx, y, z], c, sz * (narrow ? 1.3 : 1));
      if (opts.spin && k === "cutterhead") s.spin[i] = 0.9;
    }
    return s;
  }

  const sceneOf: Record<StepId, () => Scene> = {
    rock: () => {
      // The opening picture: a cutterhead seen face-on, turning, breaking out of banded rock.
      const s = { ...empty(), spin: new Float32Array(n) };
      const rc = C.rock.map(hex), amber = hex(C.part.cutterhead), hot = hex(C.part.drive);
      const RH = 11;
      for (let i = 0; i < n; i++) {
        const u = i / n;
        if (u < 0.36) {
          const v = rand();
          let r: number, a: number, size = 1.1, c = amber;
          if (v < 0.3) { a = rand() * Math.PI * 2; r = RH * (0.92 + 0.08 * rand()); }
          else if (v < 0.66) { a = (Math.floor(rand() * 6) / 6) * Math.PI * 2 + gauss() * 0.04; r = RH * (0.1 + 0.85 * rand()); }
          else if (v < 0.76) { a = rand() * Math.PI * 2; r = RH * 0.14 * Math.sqrt(rand()); c = hot; size = 1.4; }
          else { const k = Math.floor(rand() * 54); a = (Math.floor(k / 9) / 6) * Math.PI * 2 + (k % 2 ? 0.26 : 0) + gauss() * 0.02; r = RH * (0.2 + 0.72 * ((k % 9) / 8)) + gauss() * 0.15; size = 2.2; }
          put(s, i, [gauss() * 0.3, r * Math.cos(a), r * Math.sin(a)], c, size);
          s.spin[i] = 0.35;
        } else {
          // Rock around and behind the face, in bands, thinning near the cut.
          let y = (rand() - 0.5) * 60, z = (rand() - 0.5) * 90;
          const rr = Math.hypot(y, z);
          if (rr < RH * 1.05) { const f = (RH * 1.05 + rand() * 6) / Math.max(rr, 0.01); y *= f; z *= f; }
          const band = Math.min(3, Math.max(0, Math.floor((y + 30) / 15)));
          put(s, i, [-2 - rand() * 18, y, z], dim(rc[band]!, 0.8 + 0.6 * rand()), 1 + rand() * 1.2);
        }
      }
      return { ...s, camera: { pos: [46, 4, 10], look: [0, 0, 0] }, labels: [] };
    },
    machine: () => ({ ...machine({ spin: true }), camera: { pos: [-6, 10, 40], look: [-4, 0, 0] }, labels: [], orbit: 0.05 }),
    exploded: () => ({
      ...machine({ explode: true }),
      camera: { pos: [-6, 18, 78], look: [-7, 0, 0] },
      labels: data.parts.map((p, k) => ({ at: [EXPLODE[p.id] * 1.1 + partCentreX(p.id), R + 2.4 + (k % 2) * 2.4, 0] as [number, number, number], html: lab(narrow ? String(k + 1).padStart(2, "0") : `${String(k + 1).padStart(2, "0")} ${p.name}`) })),
    }),
    boring: () => {
      const base = machine({ spin: true });
      const flow = new Float32Array(n), lo = new Float32Array(n), hi = new Float32Array(n);
      const s: Scene = { ...base, flow, lo, hi, camera: { pos: [14, 9, 40], look: [5, 0, 0] }, labels: [] };
      const rc = C.rock.map(hex);
      // The back-up particles become the ground ahead: rock streams towards the face and vanishes into it,
      // while lining rings stream away behind the shield, so the machine appears to advance ring by ring.
      const tail = XC - SHIELD_LEN - 0.4;
      for (let i = 0; i < n; i++) {
        const k = partOf[i]!;
        if (k === "backup") {
          let a = rand() * Math.PI * 2;
          if (Math.sin(a) > 0.4) a += Math.PI;
          const r = R * 1.35 * Math.sqrt(rand());
          put(s, i, [XC + 0.7 + rand() * 16, r * Math.cos(a), r * Math.sin(a)], dim(rc[i % 4]!, 1.25), 1.6);
          flow[i] = 2.4; lo[i] = XC + 0.7; hi[i] = XC + 16.7;
        } else if (k === "lining") {
          flow[i] = 2.4; lo[i] = tail - 28; hi[i] = tail;
        } else if (k === "muck") {
          flow[i] = 4; lo[i] = XC - 1 - (SHIELD_LEN + 4); hi[i] = XC - 1;
        }
      }
      return s;
    },
    sizes: () => ringScene(data.rings.filter((r) => r.kind === "built"), true),
    claims: () => ringScene(data.rings.filter((r) => r.kind !== "built"), false),
    origin: () => {
      const where = Object.fromEntries(data.parts.map((p) => [p.id, p.where]));
      const col = (k: PartId | "lining", i: number) => {
        if (k === "lining") return dim(liningCol, 0.6);
        const w = where[k];
        return hex(w === "india" ? C.india : w === "imported" ? C.imported : w === "mixed" ? (i % 2 ? C.india : C.imported) : C.unreported);
      };
      return { ...machine({ colour: col, spin: true }), camera: { pos: [-2, 12, 44], look: [-4, 0, 0] }, labels: [], orbit: 0.06 };
    },
    map: () => mapScene(),
    supply: () => supplyScene(),
    finale: () => ({ ...machine({ spin: true }), camera: { pos: [24, 8, 36], look: [-3, 0, 0] }, labels: [], orbit: 0.08 }),
  };

  function partCentreX(id: PartId): number {
    const [a, b] = ranges[id];
    let sx = 0;
    for (let i = a; i < b; i++) sx += machinePts[i]![0];
    return sx / Math.max(1, b - a);
  }

  /** Circles at each diameter's true relative size, standing on one ground line, and a person for scale. */
  function ringScene(rings: TbmStageData["rings"], person: boolean): Scene {
    const s = empty();
    const total = rings.reduce((a, r) => a + r.d, 0) || 1;
    const budget = Math.floor(n * (person ? 0.86 : 0.9));
    let i = 0;
    const labels: Scene["labels"] = [];
    const maxD = Math.max(...rings.map((r) => r.d), 1);
    rings.forEach((r, k) => {
      const c = hex(C.ring[r.kind]);
      const cnt = Math.floor((budget * r.d) / total), rad = r.d / 2;
      for (let j = 0; j < cnt && i < n; j++, i++) {
        let a = (j / cnt) * Math.PI * 2;
        const dashed = r.kind === "target" || r.kind === "planned";
        if (dashed && Math.floor((a / (Math.PI * 2)) * 48) % 2) a += (Math.PI * 2) / 96;
        put(s, i, [rad * Math.cos(a) + gauss() * 0.03, rad + rad * Math.sin(a) + gauss() * 0.03, (k - rings.length / 2) * 0.05], c, 0.9);
      }
      // Labels sit around each ring's top, alternating sides, so near-equal sizes do not overprint.
      const la = Math.PI / 2 + (k % 2 ? 1 : -1) * (0.25 + 0.17 * k);
      labels.push({ at: [rad * Math.cos(la), rad + rad * Math.sin(la) + 0.3, 0], html: lab(r.label), cls: `tbm-ring-${r.kind}` });
    });
    if (person) {
      // A 1.8 m figure: head, body, legs, standing on the ground line.
      const pc = hex("#ffffff");
      for (; i < budget + Math.floor(n * 0.04) && i < n; i++) {
        const u = rand();
        const p: [number, number, number] = u < 0.25 ? [0.13 * gauss(), 1.62 + 0.11 * gauss(), 0] : u < 0.7 ? [0.16 * gauss(), 0.95 + 0.55 * (rand() - 0.5) * 1.1, 0] : [(rand() < 0.5 ? -0.1 : 0.1) + 0.03 * gauss(), 0.45 * rand() + 0.02, 0];
        put(s, i, [p[0], p[1], 0.4], pc, 0.7);
      }
      labels.push({ at: [0, 2.35, 0.4], html: lab("1.8 m person"), cls: "tbm-ring-person" });
    }
    // Leftovers: a faint ground line.
    const gc = hex(C.dust);
    for (; i < n; i++) put(s, i, [(rand() - 0.5) * maxD * 1.6, -0.05 + gauss() * 0.02, gauss() * 0.3], gc, 0.6);
    return { ...s, camera: { pos: [0, maxD * 0.55, maxD * 1.75], look: [0, maxD * 0.48, 0] }, labels };
  }

  const MAP_K = 1.25;
  const proj = (lon: number, lat: number, k = MAP_K, ox = 0, oy = 0): [number, number] => [(lon - 82.5) * k + ox, (lat - 22.5) * k + oy];

  function mapScene(): Scene {
    const s = empty();
    let i = 0;
    const oc = hex(C.map), bc = hex(C.border);
    const outlineBudget = Math.floor(n * 0.42), borderBudget = Math.floor(n * 0.12);
    for (let j = 0; j < outlineBudget && data.outline.length; j++, i++) {
      const [lon, lat] = data.outline[j % data.outline.length]!;
      const [x, y] = proj(lon, lat);
      put(s, i, [x + gauss() * 0.08, y + gauss() * 0.08, gauss() * 0.06], oc, 0.8);
    }
    for (let j = 0; j < borderBudget && data.borders.length; j++, i++) {
      const [lon, lat] = data.borders[j % data.borders.length]!;
      const [x, y] = proj(lon, lat);
      put(s, i, [x + gauss() * 0.05, y + gauss() * 0.05, 0], bc, 0.55);
    }
    // Beads: one per machine named in reporting, stacked upward at its place.
    const labels: Scene["labels"] = [];
    const byPlace = new Map(data.places.map((p) => [p.id, p]));
    const beads = data.beads.filter((b) => byPlace.has(b.place));
    const perBead = 110;
    const beadCol = hex(C.bead), makerCol = hex(C.maker);
    for (const b of beads) {
      const pl = byPlace.get(b.place)!;
      const [x, y] = proj(pl.lon, pl.lat);
      const cnt = b.count ?? 0;
      for (let k = 0; k < Math.max(cnt, 1); k++) {
        for (let j = 0; j < perBead && i < n; j++, i++) {
          const th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1), r = cnt ? 0.42 : 0.55;
          const hollow = !cnt;
          const p: [number, number, number] = hollow
            ? [x + r * Math.cos(th) * 1.4, y + r * Math.sin(th) * 1.4, 0.6]
            : [x + r * Math.sin(ph) * Math.cos(th), y + r * Math.sin(ph) * Math.sin(th), 0.6 + k * 0.95 + r * Math.cos(ph)];
          put(s, i, p, hollow ? dim(beadCol, 0.6) : beadCol, 0.85);
        }
      }
      labels.push({ at: [x + 0.9, y, 0.6 + Math.max(cnt, 1) * 0.95], html: lab(pl.name, b.label), cls: "tbm-map" });
    }
    // Where machines are made in India: a green ring at the place.
    for (const m of data.places.filter((p) => p.id.startsWith("maker:"))) {
      const [x, y] = proj(m.lon, m.lat);
      for (let j = 0; j < 500 && i < n; j++, i++) { const a = rand() * Math.PI * 2; put(s, i, [x + 1.6 * Math.cos(a), y + 1.6 * Math.sin(a), 0.1], makerCol, 0.9); }
      const east = m.id === "maker:chennai";
      labels.push({ at: [x + (east ? 4.2 : -4.6), y - 1.9, 0], html: lab(m.name), cls: "tbm-map tbm-maker" });
    }
    const dc = hex(C.dust);
    for (; i < n; i++) put(s, i, [(rand() - 0.5) * 70, (rand() - 0.5) * 60, -2 - rand() * 6], dc, 0.5);
    return { ...s, camera: { pos: [0, -34, 40], look: [0, -1, 0] }, labels };
  }

  function supplyScene(): Scene {
    const s = empty();
    let i = 0;
    const k = 0.75, ox = 0, oy = -2;
    const oc = dim(hex(C.map), 0.8);
    const outlineBudget = Math.floor(n * 0.28);
    for (let j = 0; j < outlineBudget && data.outline.length; j++, i++) {
      const [lon, lat] = data.outline[j % data.outline.length]!;
      const [x, y] = proj(lon, lat, k, ox, oy);
      put(s, i, [x + gauss() * 0.06, y + gauss() * 0.06, 0], oc, 0.7);
    }
    const at = (id: string): THREE.Vector3 => { const p = data.places.find((x) => x.id === id); const [x, y] = p ? proj(p.lon, p.lat, k, ox, oy) : [0, 0]; return new THREE.Vector3(x, y, 0); };
    // Schematic, not by longitude: Germany far to the west, Guangzhou to the east.
    const schwanau = new THREE.Vector3(-22, 27, 0), guangzhou = new THREE.Vector3(29, 6, 0);
    const chennai = at("maker:chennai"), mumbai = at("mumbai"), kolkata = at("kolkata");
    const lift = (a: THREE.Vector3, b: THREE.Vector3, h: number) => new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2 + h, 6);
    const curves: Scene["curves"] = [
      [schwanau, lift(schwanau, chennai, 14), chennai],
      [chennai, lift(chennai, mumbai, 3), mumbai],
      [chennai, lift(chennai, kolkata, 3), kolkata],
      [guangzhou, lift(guangzhou, mumbai, 12), mumbai],
    ];
    const curve = new Int16Array(n).fill(-1), phase = new Float32Array(n);
    const share = [0.2, 0.09, 0.09, 0.2];
    const cols = [hex(C.stream), hex(C.maker), hex(C.maker), hex(C.china)];
    share.forEach((sh, c) => {
      const cnt = Math.floor(n * sh);
      for (let j = 0; j < cnt && i < n; j++, i++) { curve[i] = c; phase[i] = rand(); put(s, i, [gauss() * 0.35, gauss() * 0.35, gauss() * 0.35], cols[c]!, 0.8); }
    });
    // The wall: China's licence requirement from 18 November, across the Guangzhou line.
    const wc = hex(C.wall), wx = 21;
    for (let j = 0; j < Math.floor(n * 0.06) && i < n; j++, i++) put(s, i, [wx + gauss() * 0.25, -6 + 24 * rand(), (rand() - 0.5) * 10], wc, 0.9);
    // Nodes.
    const nodeCol = hex("#ffffff");
    for (const p of [schwanau, guangzhou]) for (let j = 0; j < 700 && i < n; j++, i++) { const th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1), r = 1.4; put(s, i, [p.x + r * Math.sin(ph) * Math.cos(th), p.y + r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph)], nodeCol, 0.8); }
    const dc = hex(C.dust);
    for (; i < n; i++) put(s, i, [(rand() - 0.5) * 120, (rand() - 0.5) * 70, -4 - rand() * 8], dc, 0.45);
    return {
      ...s, curve, phase, curves,
      camera: { pos: [0, -12, 84], look: [0, 4, 0] },
      labels: [
        { at: [schwanau.x, schwanau.y + 2.6, 0], html: lab("Schwanau, Germany", "Herrenknecht's main plant: core components"), cls: "tbm-node" },
        { at: [guangzhou.x, guangzhou.y + 2.6, 0], html: lab("Guangzhou, China", "most large Herrenknecht machines"), cls: "tbm-node tbm-china" },
        { at: [chennai.x + 1.5, chennai.y - 1.5, 0], html: lab("Chennai", "assembly in India"), cls: "tbm-node tbm-maker" },
        { at: [wx, 20, 0], html: lab("Licence required", "from 18 Nov 2026"), cls: "tbm-node tbm-china" },
      ],
    };
  }

  /* State. */
  let target: Scene = sceneOf.rock();
  let current: StepId = "rock";
  const camPos = new THREE.Vector3(...target.camera.pos), camLook = new THREE.Vector3(...target.camera.look);
  const wantPos = camPos.clone(), wantLook = camLook.clone();
  let labelObjs: CSS2DObject[] = [];
  let active = true, raf = 0, last = performance.now(), t = 0, orbitAngle = 0;
  const cache = new Map<StepId, Scene>();

  function setLabels(sc: Scene) {
    for (const o of labelObjs) { group.remove(o); o.element.remove(); }
    labelObjs = sc.labels.map((l) => {
      const el = document.createElement("div");
      el.className = `tbm-lab ${l.cls ?? ""}`;
      el.innerHTML = l.html;
      const o = new CSS2DObject(el);
      o.position.set(...l.at);
      group.add(o);
      return o;
    });
  }

  /** Narrow screens see each picture from further back, along the same line of sight. */
  let reach = 1;
  function aim() {
    wantLook.set(...target.camera.look);
    wantPos.set(...target.camera.pos).sub(wantLook).multiplyScalar(reach).add(wantLook);
  }

  function setStep(id: StepId) {
    if (id === current && cache.has(id)) return;
    current = id;
    target = cache.get(id) ?? sceneOf[id]();
    cache.set(id, target);
    aim();
    orbitAngle = 0;
    group.rotation.y = 0;
    setLabels(target);
    if (reduced) { snap(); }
  }

  function snap() {
    cur.set(target.pos); curCol.set(target.col); curSize.set(target.size);
    camPos.copy(wantPos); camLook.copy(wantLook);
    geo.attributes.position!.needsUpdate = true; geo.attributes.aColor!.needsUpdate = true; geo.attributes.aSize!.needsUpdate = true;
  }

  const tmp = new THREE.Vector3();
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (!active) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!reduced) t += dt;
    const ease = reduced ? 1 : 1 - Math.pow(0.03, dt);
    const sc = target;
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      let x = sc.pos[j]!, y = sc.pos[j + 1]!, z = sc.pos[j + 2]!;
      const sp = sc.spin?.[i] ?? 0;
      if (sp) { const a = sp * t, ca = Math.cos(a), sa = Math.sin(a); const ny = y * ca - z * sa; z = y * sa + z * ca; y = ny; }
      const fl = sc.flow?.[i] ?? 0;
      if (fl) { const w0 = sc.lo![i]!, span = sc.hi![i]! - w0; x = w0 + ((((x - fl * t) - w0) % span) + span) % span; }
      const cv = sc.curve?.[i] ?? -1;
      if (cv >= 0 && sc.curves) {
        const [a, b, c] = sc.curves[cv]!, u = ((sc.phase![i]! + t * 0.12) % 1);
        const m = 1 - u;
        tmp.set(m * m * a.x + 2 * m * u * b.x + u * u * c.x, m * m * a.y + 2 * m * u * b.y + u * u * c.y, m * m * a.z + 2 * m * u * b.z + u * u * c.z);
        x += tmp.x; y += tmp.y; z += tmp.z;
        // A stream from Guangzhou stops at the wall.
        if (cv === 3 && x < 21 && u > 0.1) { x = 21.4 + Math.abs(x - 21) * 0.02; }
      }
      // Flowing particles jump across the wrap rather than streaking: snap instead of easing.
      const moving = fl !== 0 || cv >= 0;
      const jump = moving && Math.abs(cur[j]! - x) + Math.abs(cur[j + 1]! - y) > 8;
      const e = jump ? 1 : moving ? Math.max(ease, 0.35) : ease;
      cur[j] = cur[j]! + (x - cur[j]!) * e;
      cur[j + 1] = cur[j + 1]! + (y - cur[j + 1]!) * e;
      cur[j + 2] = cur[j + 2]! + (z - cur[j + 2]!) * e;
      curCol[j] = curCol[j]! + (sc.col[j]! - curCol[j]!) * ease;
      curCol[j + 1] = curCol[j + 1]! + (sc.col[j + 1]! - curCol[j + 1]!) * ease;
      curCol[j + 2] = curCol[j + 2]! + (sc.col[j + 2]! - curCol[j + 2]!) * ease;
      curSize[i] = curSize[i]! + (sc.size[i]! - curSize[i]!) * ease;
    }
    geo.attributes.position!.needsUpdate = true;
    geo.attributes.aColor!.needsUpdate = true;
    geo.attributes.aSize!.needsUpdate = true;
    if (!reduced && sc.orbit) { orbitAngle += sc.orbit * dt; group.rotation.y = Math.sin(orbitAngle) * 0.35; }
    camPos.lerp(wantPos, reduced ? 1 : 1 - Math.pow(0.08, dt));
    camLook.lerp(wantLook, reduced ? 1 : 1 - Math.pow(0.08, dt));
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    labelRenderer.setSize(w, h);
    camera.aspect = w / h;
    // Narrow screens see the same picture from further back.
    camera.fov = w / h < 0.8 ? 58 : w / h < 1.2 ? 50 : 42;
    reach = w / h < 0.8 ? 1.45 : w / h < 1.2 ? 1.15 : 1;
    if (target) aim();
    // The text cards sit on the left on wide screens and at the bottom on narrow ones: shift the picture into the free space.
    if (w / h > 1.1) camera.setViewOffset(w, h, -0.17 * w, 0, w, h);
    else camera.setViewOffset(w, h, 0, 0.14 * h, w, h);
    camera.updateProjectionMatrix();
    // Point sizes are in world units: a size of 1 is about a tenth of a stage unit across.
    mat.uniforms.uScale!.value = h * renderer.getPixelRatio() * 0.11;
  }

  resize();
  setStep("rock");
  snap();
  raf = requestAnimationFrame(frame);

  return {
    setStep,
    setActive(a) { active = a; },
    resize,
    dispose() {
      cancelAnimationFrame(raf);
      for (const o of labelObjs) o.element.remove();
      labelRenderer.domElement.remove();
      geo.dispose(); mat.dispose(); renderer.dispose();
    },
  };
}
