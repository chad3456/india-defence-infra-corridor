/**
 * The X-ray explorer's 3D view: the same NISAR model as the story, free to
 * turn, zoom, pull apart and pick part by part. Colours are who built each
 * part, from the register; nothing here carries a number the panels beside
 * it do not source.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { PART_ORDER, type Origin, type PartId } from "@/lib/space-story";
import { buildModel } from "./model";

export type View = "front" | "side" | "top" | "reset";

export interface Explorer {
  select(id: PartId | null): void;
  setShown(ids: Set<PartId>): void;
  setApart(on: boolean): void;
  setSpin(on: boolean): void;
  view(v: View): void;
  zoom(f: number): void;
  rotate(dAz: number, dPol: number): void;
  onPick(cb: (id: PartId | null) => void): void;
  resize(): void;
  dispose(): void;
}

const HOME = { pos: new THREE.Vector3(-17, 10, 26), look: new THREE.Vector3(3, 3.5, 0) };
const VIEWS: Record<Exclude<View, "reset">, THREE.Vector3> = {
  front: new THREE.Vector3(0, 3, 32), side: new THREE.Vector3(32, 4, 0.01), top: new THREE.Vector3(0.01, 34, 0.01),
};

export function createExplorer(canvas: HTMLCanvasElement, overlay: HTMLDivElement, parts: Array<{ id: PartId; name: string; origin: Origin }>, colours: Record<Origin, string>, reduced: boolean): Explorer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor("#02050b");
  const labels = new CSS2DRenderer({ element: overlay });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 2000);
  camera.position.copy(HOME.pos);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.42, 0.18);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(HOME.look);
  controls.enableDamping = !reduced;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1.2;
  controls.maxDistance = 120;
  controls.autoRotateSpeed = 0.8;
  controls.screenSpacePanning = true;

  // A faint floor grid, so the turning model has somewhere to stand.
  const gridSeg: number[] = [];
  for (let i = -20; i <= 20; i += 2) gridSeg.push(i, -4, -20, i, -4, 20, -20, -4, i, 20, -4, i);
  const gridGeo = new THREE.BufferGeometry(); gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(gridSeg, 3));
  const gridMat = new THREE.LineBasicMaterial({ color: "#0f2a3d", transparent: true, opacity: 0.6, depthWrite: false });
  scene.add(new THREE.LineSegments(gridGeo, gridMat));

  const model = buildModel();
  scene.add(model.root);
  const byId = Object.fromEntries(parts.map((p) => [p.id, p])) as Record<PartId, (typeof parts)[number]>;

  // One label, on the locked part.
  const lockEl = document.createElement("div");
  lockEl.className = "sp-lock";
  const lock = new CSS2DObject(lockEl);
  lock.visible = false;
  scene.add(lock);

  let selected: PartId | null = null, hover: PartId | null = null;
  let shown = new Set<PartId>(PART_ORDER);
  let apart = 0, apartWant = 0;
  const want = { target: HOME.look.clone(), pos: HOME.pos.clone(), active: false };
  const state = Object.fromEntries(PART_ORDER.map((id) => [id, { col: new THREE.Color(colours[byId[id]?.origin ?? "india"]), op: 1 }])) as Record<PartId, { col: THREE.Color; op: number }>;

  function targetOf(id: PartId) {
    const p = model.parts[id];
    return p.centre.clone().applyMatrix4(p.group.matrixWorld);
  }
  function fly(target: THREE.Vector3, dist: number) {
    const dir = camera.position.clone().sub(controls.target).normalize();
    want.target.copy(target);
    want.pos.copy(target).addScaledVector(dir, dist);
    want.active = true;
  }

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickables = () => PART_ORDER.filter((id) => shown.has(id)).flatMap((id) => model.parts[id].pick);
  function hit(ev: PointerEvent): PartId | null {
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    // Small parts sit inside the bus and the thermal shell: prefer the smallest part the ray passes through.
    const hits = ray.intersectObjects(pickables(), false);
    if (!hits.length) return null;
    const ids = [...new Set(hits.map((h) => h.object.userData.part as PartId))];
    ids.sort((a, b) => model.parts[a].radius - model.parts[b].radius);
    return ids[0] ?? null;
  }
  let pickCb: ((id: PartId | null) => void) | null = null;
  let down: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
  const onUp = (e: PointerEvent) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) pickCb?.(hit(e));
    down = null;
  };
  const onMove = (e: PointerEvent) => { if (e.pointerType === "mouse" && !down) { hover = hit(e); canvas.style.cursor = hover ? "pointer" : "grab"; } };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointermove", onMove);
  controls.addEventListener("start", () => { want.active = false; });

  let raf = 0, last = performance.now();
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const k = reduced ? 1 : 1 - Math.pow(0.004, dt);
    apart += (apartWant - apart) * k;
    model.setApart(apart);
    model.root.updateMatrixWorld(true);
    for (const id of PART_ORDER) {
      const p = model.parts[id], s = state[id];
      const base = new THREE.Color(colours[byId[id]?.origin ?? "india"]);
      const isSel = selected === id, isHover = hover === id;
      const wantCol = isSel ? base.clone().lerp(new THREE.Color("#ffffff"), 0.55) : isHover ? base.clone().lerp(new THREE.Color("#ffffff"), 0.3) : base;
      const wantOp = !shown.has(id) ? 0.03 : selected && !isSel ? 0.07 : 1;
      s.col.lerp(wantCol, k); s.op += (wantOp - s.op) * k;
      p.lines.color.copy(s.col); p.fill.color.copy(s.col);
      p.lines.opacity = p.lines.userData.base * s.op;
      p.fill.opacity = p.fill.userData.base * s.op * (isSel ? 4 : 1.6);
    }
    if (selected) { lock.position.copy(targetOf(selected)); lock.visible = true; } else lock.visible = false;
    if (want.active) {
      const kc = reduced ? 1 : 1 - Math.pow(0.01, dt);
      controls.target.lerp(want.target, kc);
      camera.position.lerp(want.pos, kc);
      if (camera.position.distanceTo(want.pos) < 0.02) want.active = false;
    }
    controls.update();
    composer.render();
    labels.render(scene, camera);
  }

  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w / 2, h / 2);
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 55 : 40;
    camera.updateProjectionMatrix();
  }
  resize();
  raf = requestAnimationFrame(frame);

  return {
    select(id) {
      selected = id;
      if (id) {
        lockEl.innerHTML = `<i>TARGET LOCKED</i><b>${byId[id]?.name ?? id}</b>`;
        lockEl.style.setProperty("--c", colours[byId[id]?.origin ?? "india"]);
        model.root.updateMatrixWorld(true);
        fly(targetOf(id), Math.max(3.2, model.parts[id].radius * 2.6));
      }
    },
    setShown(ids) { shown = ids; },
    setApart(on) { apartWant = on ? 1 : 0; if (!selected) fly(HOME.look.clone().add(new THREE.Vector3(on ? 1 : 0, on ? 1 : 0, 0)), on ? 44 : HOME.pos.distanceTo(HOME.look)); },
    setSpin(on) { controls.autoRotate = on && !reduced; },
    view(v) {
      if (v === "reset") { selected = null; want.target.copy(HOME.look); want.pos.copy(HOME.pos); want.active = true; return; }
      const d = camera.position.distanceTo(controls.target);
      want.target.copy(controls.target);
      want.pos.copy(controls.target).add(VIEWS[v].clone().normalize().multiplyScalar(d));
      want.active = true;
    },
    zoom(f) {
      const off = camera.position.clone().sub(controls.target).multiplyScalar(f);
      const len = Math.min(controls.maxDistance, Math.max(controls.minDistance, off.length()));
      want.target.copy(controls.target);
      want.pos.copy(controls.target).add(off.setLength(len));
      want.active = true;
    },
    rotate(dAz, dPol) {
      const off = camera.position.clone().sub(controls.target);
      const sph = new THREE.Spherical().setFromVector3(off);
      sph.theta += dAz; sph.phi = Math.min(Math.PI - 0.05, Math.max(0.05, sph.phi + dPol));
      want.target.copy(controls.target);
      want.pos.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sph));
      want.active = true;
    },
    onPick(cb) { pickCb = cb; },
    resize,
    dispose() {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointermove", onMove);
      controls.dispose();
      model.dispose();
      gridGeo.dispose(); gridMat.dispose();
      composer.dispose();
      renderer.dispose();
      overlay.replaceChildren();
    },
  };
}
