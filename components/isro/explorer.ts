/**
 * The rocket explorer's 3D view: one Indian rocket at a time, free to turn,
 * zoom, pull apart and pick stage by stage. Colours are the propellant each
 * stage burns, from the register.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import type { Rocket, StageKind } from "@/lib/space-programme";
import { buildRocket, person, type RocketModel } from "./rocket-model";

export type View = "front" | "side" | "top" | "reset";

export interface RocketExplorer {
  setRocket(r: Rocket): void;
  select(id: string | null): void;
  setApart(on: boolean): void;
  setSpin(on: boolean): void;
  view(v: View): void;
  zoom(f: number): void;
  rotate(dAz: number, dPol: number): void;
  onPick(cb: (id: string | null) => void): void;
  resize(): void;
  dispose(): void;
}

export function createRocketExplorer(canvas: HTMLCanvasElement, overlay: HTMLDivElement, colours: Record<StageKind, string>, reduced: boolean): RocketExplorer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor("#02050b");
  const labels = new CSS2DRenderer({ element: overlay });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 3000);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.42, 0.18);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !reduced;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;
  controls.autoRotateSpeed = 0.9;

  const gridSeg: number[] = [];
  for (let i = -30; i <= 30; i += 3) gridSeg.push(i, 0, -30, i, 0, 30, -30, 0, i, 30, 0, i);
  const gridGeo = new THREE.BufferGeometry(); gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(gridSeg, 3));
  const gridMat = new THREE.LineBasicMaterial({ color: "#0f2a3d", transparent: true, opacity: 0.6 });
  scene.add(new THREE.LineSegments(gridGeo, gridMat));
  const man = person("#ffb547");
  man.position.set(-7, 0, 4);
  scene.add(man);

  const lockEl = document.createElement("div");
  lockEl.className = "sp-lock";
  const lock = new CSS2DObject(lockEl);
  lock.visible = false;
  scene.add(lock);

  let model: RocketModel | null = null;
  let selected: string | null = null, hover: string | null = null;
  let apart = 0, apartWant = 0;
  let home = { pos: new THREE.Vector3(30, 24, 60), look: new THREE.Vector3(0, 20, 0) };
  const want = { pos: home.pos.clone(), look: home.look.clone(), active: false };
  const fly = (look: THREE.Vector3, dist: number) => {
    const dir = camera.position.clone().sub(controls.target).normalize();
    want.look.copy(look); want.pos.copy(look).addScaledVector(dir, dist); want.active = true;
  };

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const hit = (e: PointerEvent): string | null => {
    if (!model) return null;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(Object.values(model.parts).flatMap((p) => p.pick), false);
    return (h[0]?.object.userData.stage as string | undefined) ?? null;
  };
  let pickCb: ((id: string | null) => void) | null = null;
  let down: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
  const onUp = (e: PointerEvent) => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) pickCb?.(hit(e)); down = null; };
  const onMove = (e: PointerEvent) => { if (e.pointerType === "mouse" && !down) { hover = hit(e); canvas.style.cursor = hover ? "pointer" : "grab"; } };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointermove", onMove);
  controls.addEventListener("start", () => { want.active = false; });

  const centreOf = (id: string) => { const p = model!.parts[id]!; p.group.updateMatrixWorld(true); return p.centre.clone().add(p.group.position).add(p.group.children[0]?.position ?? new THREE.Vector3()); };

  let raf = 0, last = performance.now();
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const k = reduced ? 1 : 1 - Math.pow(0.004, dt);
    apart += (apartWant - apart) * k;
    if (model) {
      model.setApart(apart);
      for (const id of model.order) {
        const p = model.parts[id]!;
        const base = new THREE.Color(colours[p.kind]);
        const c = selected === id ? base.clone().lerp(new THREE.Color("#ffffff"), 0.5) : hover === id ? base.clone().lerp(new THREE.Color("#ffffff"), 0.25) : base;
        p.lines.color.copy(c); p.fill.color.copy(c);
        const op = selected && selected !== id ? 0.12 : 1;
        p.lines.opacity = p.lines.userData.base * op;
        p.fill.opacity = p.fill.userData.base * op * (selected === id ? 1.8 : 1.2);
      }
      if (selected) { lock.position.copy(centreOf(selected)); lock.visible = true; } else lock.visible = false;
    }
    if (want.active) {
      const kc = reduced ? 1 : 1 - Math.pow(0.01, dt);
      controls.target.lerp(want.look, kc); camera.position.lerp(want.pos, kc);
      if (camera.position.distanceTo(want.pos) < 0.05) want.active = false;
    }
    controls.update();
    composer.render();
    labels.render(scene, camera);
  }

  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false); composer.setSize(w, h); bloom.resolution.set(w / 2, h / 2); labels.setSize(w, h);
    camera.aspect = w / h; camera.fov = w / h < 0.8 ? 55 : 40; camera.updateProjectionMatrix();
  }
  resize();
  raf = requestAnimationFrame(frame);

  return {
    setRocket(r) {
      if (model) { scene.remove(model.root); model.dispose(); }
      model = buildRocket(r, colours);
      scene.add(model.root);
      selected = null; apart = 0;
      const H = r.heightM;
      home = { pos: new THREE.Vector3(H * 0.7, H * 0.62, H * 1.35 + 8), look: new THREE.Vector3(0, H * 0.48, 0) };
      controls.maxDistance = H * 5 + 40; controls.minDistance = 1.5;
      if (!camera.position.lengthSq() || !want.active) { camera.position.copy(home.pos); controls.target.copy(home.look); }
      want.pos.copy(home.pos); want.look.copy(home.look); want.active = true;
    },
    select(id) {
      selected = id;
      if (id && model) {
        const s = model.rocket.stages.find((x) => x.id === id);
        lockEl.innerHTML = `<i>TARGET LOCKED</i><b>${s?.name ?? id}</b>`;
        lockEl.style.setProperty("--c", colours[model.parts[id]!.kind]);
        fly(centreOf(id), Math.max(10, model.parts[id]!.radius * 4.2));
      }
    },
    setApart(on) { apartWant = on ? 1 : 0; },
    setSpin(on) { controls.autoRotate = on && !reduced; },
    view(v) {
      if (v === "reset") { selected = null; want.pos.copy(home.pos); want.look.copy(home.look); want.active = true; return; }
      const d = camera.position.distanceTo(controls.target);
      const dir = v === "front" ? new THREE.Vector3(0, 0.15, 1) : v === "side" ? new THREE.Vector3(1, 0.15, 0.01) : new THREE.Vector3(0.01, 1, 0.01);
      want.look.copy(controls.target); want.pos.copy(controls.target).add(dir.normalize().multiplyScalar(d)); want.active = true;
    },
    zoom(f) {
      const off = camera.position.clone().sub(controls.target).multiplyScalar(f);
      const len = Math.min(controls.maxDistance, Math.max(controls.minDistance, off.length()));
      want.look.copy(controls.target); want.pos.copy(controls.target).add(off.setLength(len)); want.active = true;
    },
    rotate(dAz, dPol) {
      const sph = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      sph.theta += dAz; sph.phi = Math.min(Math.PI - 0.05, Math.max(0.05, sph.phi + dPol));
      want.look.copy(controls.target); want.pos.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sph)); want.active = true;
    },
    onPick(cb) { pickCb = cb; },
    resize,
    dispose() {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointermove", onMove);
      controls.dispose(); model?.dispose(); gridGeo.dispose(); gridMat.dispose(); composer.dispose(); renderer.dispose();
      overlay.replaceChildren();
    },
  };
}
