/**
 * The three.js stage behind /namesakes.
 *
 * India as a sheet of white card with an inked edge, the places as stacked
 * tokens, and a crowd of small white figures wandering over it — the register
 * of a hand-drawn board game. Built once on mount; `setPins` swaps the tokens
 * when the reader changes figure, and everything is disposed on unmount.
 *
 * ── What a picture here encodes ──────────────────────────────────────────
 *
 * A token is one place, at its own Wikidata coordinates, coloured by the
 * figure it is named after. Nothing else in the scene is data: the walkers
 * are decoration, and what they say is the name of a real token near them,
 * never a claim of their own. Places with no coordinates of their own are not
 * placed at all — the page lists them instead of pinning them to a capital.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";

export interface MapShape {
  /** Polygons in map units: [outer ring, ...holes], each ring [[x, y], ...]. */
  polygons: Array<Array<Array<[number, number]>>>;
  /** The country's outer edge and the borders between states, as polylines. */
  outline: Array<Array<[number, number]>>;
  borders: Array<Array<[number, number]>>;
}

export interface StagePin {
  /** Index into the page's place list, handed back on pick. */
  i: number;
  x: number;
  y: number;
  slot: number;
  name: string;
}

export interface StageCallbacks {
  onPick: (i: number | null) => void;
  onHover: (i: number | null, clientX: number, clientY: number) => void;
}

export interface Stage {
  setPins: (pins: StagePin[], colours: string[]) => void;
  focus: (i: number | null) => void;
  resetView: () => void;
  setWalkers: (on: boolean) => void;
  dispose: () => void;
}

const PAPER = "#f4f2ec";
const INK = "#1c1b19";
const SLAB = 0.55;
const TOKEN_R = 0.2;
const TOKEN_H = 0.12;

/** Three-step toon ramp: lit, half, shade — the flat look of a printed drawing. */
function toonRamp(): THREE.DataTexture {
  const data = new Uint8Array([150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

/** A backface hull a little larger than the mesh: the ink line around a solid. */
function hullMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
}

function flat(points: Array<[number, number]>, y: number): number[] {
  const out: number[] = [];
  for (const [x, z] of points) out.push(x, y, -z);
  return out;
}

export function createStage(
  host: HTMLDivElement,
  shape: MapShape,
  cb: StageCallbacks,
  reducedMotion: boolean,
): Stage {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.touchAction = "none";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAPER);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 4;
  controls.maxDistance = 70;
  controls.maxPolarAngle = Math.PI * 0.42;
  controls.screenSpacePanning = false;

  const ramp = toonRamp();
  const bag: Array<{ dispose: () => void }> = [ramp];
  const keep = <T extends { dispose: () => void }>(x: T): T => { bag.push(x); return x; };

  // ── Light: one sun for the soft grey shadows, a fill so shade is not black.
  scene.add(new THREE.HemisphereLight("#ffffff", "#d9d5ca", 1.6));
  const sun = new THREE.DirectionalLight("#ffffff", 2.2);
  sun.position.set(-18, 40, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 120;
  sun.shadow.radius = 6;
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  const ground = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(400, 400)),
    keep(new THREE.ShadowMaterial({ color: "#3a3630", opacity: 0.16 })),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ── The country: extruded card, an inked outer edge, pencil state borders.
  const shapes: THREE.Shape[] = [];
  for (const poly of shape.polygons) {
    const [outer, ...holes] = poly;
    if (!outer || outer.length < 3) continue;
    const s = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const h of holes) if (h.length >= 3) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
    shapes.push(s);
  }
  const slabGeo = keep(new THREE.ExtrudeGeometry(shapes, { depth: SLAB, bevelEnabled: false }));
  slabGeo.rotateX(-Math.PI / 2);
  const slab = new THREE.Mesh(slabGeo, keep(new THREE.MeshToonMaterial({ color: "#ffffff", gradientMap: ramp })));
  slab.castShadow = true;
  slab.receiveShadow = true;
  scene.add(slab);

  const res = new THREE.Vector2(1, 1);
  const inkTop = keep(new LineMaterial({ color: INK, linewidth: 2.6, resolution: res }));
  const inkBase = keep(new LineMaterial({ color: INK, linewidth: 1.6, resolution: res }));
  const pencil = keep(new LineMaterial({ color: "#8d887c", linewidth: 1, resolution: res, dashed: false }));
  for (const line of shape.outline) {
    if (line.length < 2) continue;
    for (const [y, mat] of [[SLAB + 0.002, inkTop], [0.01, inkBase]] as const) {
      const g = keep(new LineGeometry());
      g.setPositions(flat(line, y));
      scene.add(new Line2(g, mat));
    }
  }
  const segs: number[] = [];
  for (const line of shape.borders) {
    for (let k = 1; k < line.length; k++) {
      const a = line[k - 1]!, b = line[k]!;
      segs.push(a[0], SLAB + 0.003, -a[1], b[0], SLAB + 0.003, -b[1]);
    }
  }
  if (segs.length) {
    const g = keep(new LineSegmentsGeometry());
    g.setPositions(segs);
    scene.add(new LineSegments2(g, pencil));
  }

  // ── Tokens: one instanced stack per colour slot, each with an ink rim.
  const tokenGeo = keep(new THREE.CylinderGeometry(TOKEN_R, TOKEN_R, TOKEN_H, 22));
  const rimGeo = keep(new THREE.CylinderGeometry(TOKEN_R * 1.22, TOKEN_R * 1.22, TOKEN_H * 1.5, 22));
  const hull = keep(hullMaterial());
  let tokenMeshes: THREE.InstancedMesh[] = [];
  let rimMeshes: THREE.InstancedMesh[] = [];
  let pinIndex: StagePin[][] = [];
  let allPins: StagePin[] = [];

  function clearTokens(): void {
    // Token colours are owned per set; the rims share the walkers' ink, which outlives them.
    for (const m of tokenMeshes) { scene.remove(m); (m.material as THREE.Material).dispose(); m.dispose(); }
    for (const m of rimMeshes) { scene.remove(m); m.dispose(); }
    tokenMeshes = []; rimMeshes = []; pinIndex = [];
  }

  /**
   * Tokens that share a spot are stacked, not overdrawn: a city with forty
   * Gandhi institutions grows a column, which is the honest picture of forty.
   */
  function setPins(pins: StagePin[], colours: string[]): void {
    clearTokens();
    allPins = pins;
    const stackAt = new Map<string, number>();
    const m4 = new THREE.Matrix4();
    colours.forEach((colour, slot) => {
      const mine = pins.filter((p) => p.slot === slot);
      if (!mine.length) return;
      const mat = new THREE.MeshToonMaterial({ color: colour, gradientMap: ramp });
      const mesh = new THREE.InstancedMesh(tokenGeo, mat, mine.length);
      const rim = new THREE.InstancedMesh(rimGeo, hull, mine.length);
      mesh.castShadow = true;
      mine.forEach((p, k) => {
        const key = `${Math.round(p.x * 6)}:${Math.round(p.y * 6)}`;
        const level = stackAt.get(key) ?? 0;
        stackAt.set(key, level + 1);
        const y = SLAB + TOKEN_H / 2 + level * (TOKEN_H * 1.08);
        m4.makeTranslation(p.x, y, -p.y);
        mesh.setMatrixAt(k, m4);
        rim.setMatrixAt(k, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
      rim.instanceMatrix.needsUpdate = true;
      mesh.userData.slot = tokenMeshes.length;
      scene.add(rim);
      scene.add(mesh);
      tokenMeshes.push(mesh);
      rimMeshes.push(rim);
      pinIndex.push(mine);
    });
    walkerTargets();
  }

  // ── Walkers: white capsules with ink hulls, strolling from token to token.
  const WALKERS = reducedMotion ? 0 : 28;
  const bodyGeo = keep(new THREE.CapsuleGeometry(0.2, 0.32, 4, 12));
  const headGeo = keep(new THREE.SphereGeometry(0.18, 16, 12));
  const hatGeo = keep(new THREE.CylinderGeometry(0.13, 0.18, 0.08, 14));
  const white = keep(new THREE.MeshToonMaterial({ color: "#ffffff", gradientMap: ramp }));
  const inkSolid = keep(new THREE.MeshToonMaterial({ color: "#2a2926", gradientMap: ramp }));
  const bodies = new THREE.InstancedMesh(bodyGeo, white, WALKERS);
  const bodyHull = new THREE.InstancedMesh(bodyGeo, hull, WALKERS);
  const heads = new THREE.InstancedMesh(headGeo, white, WALKERS);
  const headHull = new THREE.InstancedMesh(headGeo, hull, WALKERS);
  const hats = new THREE.InstancedMesh(hatGeo, inkSolid, WALKERS);
  for (const m of [bodies, heads, hats]) { m.castShadow = true; scene.add(m); }
  scene.add(bodyHull, headHull);
  bag.push(bodies, bodyHull, heads, headHull, hats);

  interface Walker { x: number; z: number; tx: number; tz: number; speed: number; phase: number; wait: number; hat: boolean; pin: StagePin | null }
  let rng = 20260930;
  const rand = () => { rng = (rng * 1664525 + 1013904223) >>> 0; return rng / 4294967296; };
  const walkers: Walker[] = Array.from({ length: WALKERS }, () => ({
    x: (rand() - 0.5) * 14, z: (rand() - 0.5) * 16, tx: 0, tz: 0,
    speed: 0.5 + rand() * 0.5, phase: rand() * 6, wait: rand() * 3, hat: rand() < 0.4, pin: null,
  }));
  function pickTarget(w: Walker): void {
    const p = allPins.length ? allPins[Math.floor(rand() * allPins.length)]! : null;
    w.pin = p;
    w.tx = p ? p.x + (rand() - 0.5) * 0.9 : (rand() - 0.5) * 14;
    w.tz = p ? -p.y + (rand() - 0.5) * 0.9 : (rand() - 0.5) * 16;
  }
  /** A new set of tokens: every walker is put down beside one, then sets off for another. */
  function walkerTargets(): void {
    walkers.forEach((w) => { pickTarget(w); w.x = w.tx; w.z = w.tz; w.wait = rand() * 2; pickTarget(w); });
  }
  let walkersOn = true;

  // Speech bubbles: plain DOM, positioned from projected coordinates.
  const bubbleLayer = document.createElement("div");
  bubbleLayer.className = "ns-bubbles";
  host.appendChild(bubbleLayer);
  const bubbles = walkers.map(() => {
    const b = document.createElement("div");
    b.className = "ns-bubble";
    b.hidden = true;
    bubbleLayer.appendChild(b);
    return { el: b, until: 0 };
  });
  const QUIPS = ["hm…", "ok", "here?", "named after who?", "which one?", "exactly", "sure", "oh hi", "look"];

  // ── Camera poses ─────────────────────────────────────────────────────
  const HOME = { target: new THREE.Vector3(0, 0, 2.5), pos: new THREE.Vector3(0, 25, 31) };
  let tween: { from: [THREE.Vector3, THREE.Vector3]; to: [THREE.Vector3, THREE.Vector3]; t: number } | null = null;
  function goTo(target: THREE.Vector3, pos: THREE.Vector3): void {
    if (reducedMotion) { controls.target.copy(target); camera.position.copy(pos); controls.update(); return; }
    tween = { from: [controls.target.clone(), camera.position.clone()], to: [target, pos], t: 0 };
  }
  function resetView(): void {
    const narrow = host.clientWidth < host.clientHeight;
    goTo(HOME.target.clone(), narrow ? new THREE.Vector3(0, 44, 40) : HOME.pos.clone());
  }
  camera.position.copy(HOME.pos);
  controls.target.copy(HOME.target);

  function focus(i: number | null): void {
    if (i === null) { resetView(); return; }
    const p = allPins.find((q) => q.i === i);
    if (!p) return;
    const t = new THREE.Vector3(p.x, SLAB, -p.y);
    goTo(t, t.clone().add(new THREE.Vector3(0, 6.5, 7.5)));
  }

  // ── Picking ──────────────────────────────────────────────────────────
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function hit(clientX: number, clientY: number): StagePin | null {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(tokenMeshes, false);
    const h = hits[0];
    if (!h || h.instanceId === undefined) return null;
    const slot = tokenMeshes.indexOf(h.object as THREE.InstancedMesh);
    return pinIndex[slot]?.[h.instanceId] ?? null;
  }
  let down: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
  const onUp = (e: PointerEvent) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 6) return; // a drag, not a tap
    const p = hit(e.clientX, e.clientY);
    cb.onPick(p ? p.i : null);
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const p = hit(e.clientX, e.clientY);
    renderer.domElement.style.cursor = p ? "pointer" : "grab";
    cb.onHover(p ? p.i : null, e.clientX, e.clientY);
  };
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);
  renderer.domElement.addEventListener("pointermove", onMove);

  // ── Size ─────────────────────────────────────────────────────────────
  function resize(): void {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = `${w}px`;
    renderer.domElement.style.height = `${h}px`;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    res.set(w, h);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();
  resetView();
  if (!reducedMotion) tween = null;
  {
    const narrow = host.clientWidth < host.clientHeight;
    camera.position.copy(narrow ? new THREE.Vector3(0, 44, 40) : HOME.pos);
    controls.update();
  }

  // ── Loop ─────────────────────────────────────────────────────────────
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const sOne = new THREE.Vector3(1, 1, 1);
  const sHull = new THREE.Vector3(1.28, 1.14, 1.28);
  const v = new THREE.Vector3();
  let raf = 0, last = performance.now(), visible = true;
  const io = new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); });
  io.observe(host);

  function tick(now: number): void {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible) return;
    if (tween) {
      tween.t = Math.min(1, tween.t + dt * 1.4);
      const e = 1 - (1 - tween.t) ** 3;
      controls.target.lerpVectors(tween.from[0], tween.to[0], e);
      camera.position.lerpVectors(tween.from[1], tween.to[1], e);
      if (tween.t >= 1) tween = null;
    }
    controls.update();

    const W = host.clientWidth, H = host.clientHeight;
    walkers.forEach((w, k) => {
      if (walkersOn) {
        if (w.wait > 0) w.wait -= dt;
        else {
          const dx = w.tx - w.x, dz = w.tz - w.z, d = Math.hypot(dx, dz);
          if (d < 0.08) {
            w.wait = 1.5 + rand() * 3;
            // Arrived: say the name of the place walked to, now and then.
            const b = bubbles[k]!;
            if (rand() < 0.55) {
              b.el.textContent = w.pin && rand() < 0.75 ? w.pin.name : QUIPS[Math.floor(rand() * QUIPS.length)]!;
              b.until = now + 2600;
            }
            pickTarget(w);
          } else {
            const step = Math.min(d, w.speed * dt * 1.6);
            w.x += (dx / d) * step; w.z += (dz / d) * step;
            w.phase += dt * 9;
          }
        }
      }
      const bob = Math.abs(Math.sin(w.phase)) * 0.05;
      const heading = Math.atan2(w.tx - w.x, w.tz - w.z);
      q.setFromAxisAngle(up, heading);
      const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(w.phase) * 0.12);
      q.multiply(tilt);
      const base = SLAB + 0.36 + bob * 1.6;
      m4.compose(v.set(w.x, base, w.z), q, sOne); bodies.setMatrixAt(k, m4);
      m4.compose(v.set(w.x, base, w.z), q, sHull); bodyHull.setMatrixAt(k, m4);
      m4.compose(v.set(w.x, base + 0.44, w.z), q, sOne); heads.setMatrixAt(k, m4);
      m4.compose(v.set(w.x, base + 0.44, w.z), q, sHull); headHull.setMatrixAt(k, m4);
      m4.compose(v.set(w.x, w.hat ? base + 0.62 : -5, w.z), q, sOne); hats.setMatrixAt(k, m4);

      const b = bubbles[k]!;
      if (b.until > now) {
        v.set(w.x, base + 0.85, w.z).project(camera);
        const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
        const on = v.z < 1 && x > 0 && x < W && y > 0 && y < H;
        b.el.hidden = !on;
        if (on) b.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      } else if (!b.el.hidden) b.el.hidden = true;
    });
    for (const m of [bodies, bodyHull, heads, headHull, hats]) m.instanceMatrix.needsUpdate = true;

    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(tick);

  return {
    setPins,
    focus,
    resetView,
    setWalkers(on: boolean) {
      walkersOn = on;
      if (!on) bubbles.forEach((b) => { b.until = 0; b.el.hidden = true; });
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointermove", onMove);
      controls.dispose();
      clearTokens();
      for (const x of bag) x.dispose();
      renderer.dispose();
      bubbleLayer.remove();
      renderer.domElement.remove();
    },
  };
}
