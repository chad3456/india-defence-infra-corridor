/**
 * The three.js hall behind /museum.
 *
 * One long gallery, room after room, each painted its own colour, the
 * paintings in gilt frames under a wash of picture-light. The visitor walks
 * the centre line and turns to look; a tap on a painting walks them up to it.
 * Images are Wikimedia Commons renditions, loaded as the visitor nears each
 * room, so a phone does not fetch two hundred paintings to show eight.
 *
 * Nothing here alters a painting: no filter, crop or colour grade. A frame is
 * sized to the image's own proportions.
 */
import * as THREE from "three";
import type { GalleryRoom } from "@/lib/museum-shared";

export interface Hang { room: number; work: number }
export interface GalleryCallbacks {
  onRoom: (room: number) => void;
  onPick: (h: Hang | null) => void;
}
export interface Gallery {
  goRoom: (k: number) => void;
  step: (dir: 1 | -1) => void;
  focus: (h: Hang | null) => void;
  dispose: () => void;
}

const HALL_W = 9;        // wall to wall
const WALL_H = 5.2;
const EYE = 1.62;
const HANG_Y = 2.0;      // centre line of the paintings
const MAX_H = 1.75;      // tallest a painting is hung
const MAX_W = 2.6;
const GAP = 1.15;        // between paintings on a wall
const ENTRY = 4.2;       // the title wall's depth at each room's start

interface Placed { room: number; work: number; side: 1 | -1; z: number; w: number; h: number; mesh: THREE.Mesh; loaded: boolean }

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  return `#${((ch(n >> 16) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255)).toString(16).padStart(6, "0")}`;
}

function textCanvas(lines: Array<{ text: string; size: number; weight?: string; italic?: boolean }>, w: number, h: number, bg: string, fg: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
  const total = lines.reduce((s, l) => s + l.size * 1.35, 0);
  let y = h / 2 - total / 2;
  for (const l of lines) {
    g.font = `${l.italic ? "italic " : ""}${l.weight ?? "400"} ${l.size}px Georgia, "Times New Roman", serif`;
    // Wrap at the canvas width.
    const words = l.text.split(" "); let line = ""; const out: string[] = [];
    for (const word of words) { const t = line ? `${line} ${word}` : word; if (g.measureText(t).width > w * 0.86) { out.push(line); line = word; } else line = t; }
    out.push(line);
    for (const o of out) { y += l.size * 1.35 / out.length; g.fillText(o, w / 2, y); }
  }
  return c;
}

/** A soft pool of light, drawn once, laid on the wall above every painting. */
function lightPool(): THREE.Texture {
  const c = document.createElement("canvas"); c.width = 256; c.height = 256;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(128, 70, 6, 128, 120, 150);
  r.addColorStop(0, "rgba(255,236,200,0.55)"); r.addColorStop(0.5, "rgba(255,226,180,0.18)"); r.addColorStop(1, "rgba(255,220,170,0)");
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function woodFloor(): THREE.Texture {
  const c = document.createElement("canvas"); c.width = 512; c.height = 512;
  const g = c.getContext("2d")!;
  let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = `hsl(${24 + rnd() * 6}, ${32 + rnd() * 10}%, ${20 + rnd() * 6}%)`;
    g.fillRect(i * 64, 0, 63, 512);
    g.strokeStyle = "rgba(0,0,0,0.12)";
    for (let k = 0; k < 14; k++) { const x = i * 64 + rnd() * 64; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 4, 170, x - 4, 340, x + 2, 512); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function createGallery(host: HTMLDivElement, rooms: GalleryRoom[], cb: GalleryCallbacks, reducedMotion: boolean): Gallery {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.touchAction = "none";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0f0d0b");
  scene.fog = new THREE.Fog("#0f0d0b", 14, 34);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 200);
  const bag: Array<{ dispose: () => void }> = [];
  const keep = <T extends { dispose: () => void }>(x: T): T => { bag.push(x); return x; };

  scene.add(new THREE.HemisphereLight("#fff4e2", "#2a2018", 1.5));
  const key = new THREE.DirectionalLight("#ffe9c8", 0.6);
  key.position.set(0, 10, 4); scene.add(key);

  const pool = keep(lightPool());
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  const frameMat = keep(new THREE.MeshStandardMaterial({ color: "#b48a3c", metalness: 0.75, roughness: 0.38 }));
  const innerMat = keep(new THREE.MeshStandardMaterial({ color: "#efe6d2", roughness: 0.9 }));

  // ── Lay out the rooms along −z ───────────────────────────────────────
  const placed: Placed[] = [];
  const roomStart: number[] = [];
  let z = 0;
  rooms.forEach((room, ri) => {
    roomStart.push(z);
    const sizes = room.works.map((w) => {
      const a = w.image.width / Math.max(1, w.image.height);
      let h = MAX_H, wd = h * a;
      if (wd > MAX_W) { wd = MAX_W; h = wd / a; }
      return { w: wd, h };
    });
    const cursor = { [1]: z - ENTRY, [-1]: z - ENTRY } as Record<1 | -1, number>;
    room.works.forEach((w, wi) => {
      const side: 1 | -1 = wi % 2 === 0 ? -1 : 1;
      const s = sizes[wi]!;
      const pz = cursor[side] - s.w / 2;
      cursor[side] -= s.w + GAP;
      placed.push({ room: ri, work: wi, side, z: pz, w: s.w, h: s.h, mesh: null as unknown as THREE.Mesh, loaded: false });
    });
    const end = Math.min(cursor[1], cursor[-1]) - 1.2;
    const len = z - end;

    // Walls, floor and ceiling of this room.
    const wallMat = keep(new THREE.MeshStandardMaterial({ color: room.wall, roughness: 0.95 }));
    for (const side of [-1, 1] as const) {
      const wall = new THREE.Mesh(keep(new THREE.PlaneGeometry(len, WALL_H)), wallMat);
      wall.position.set(side * HALL_W / 2, WALL_H / 2, z - len / 2);
      wall.rotation.y = -side * Math.PI / 2;
      scene.add(wall);
      const skirting = new THREE.Mesh(keep(new THREE.BoxGeometry(0.05, 0.22, len)), keep(new THREE.MeshStandardMaterial({ color: shade(room.wall, -0.45) })));
      skirting.position.set(side * (HALL_W / 2 - 0.03), 0.11, z - len / 2);
      scene.add(skirting);
    }
    const floorTex = woodFloor(); keep(floorTex); floorTex.repeat.set(HALL_W / 3, len / 3);
    const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(HALL_W, len)), keep(new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55, metalness: 0.05 })));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, z - len / 2); scene.add(floor);
    const ceil = new THREE.Mesh(keep(new THREE.PlaneGeometry(HALL_W, len)), keep(new THREE.MeshStandardMaterial({ color: "#efe9df", roughness: 1 })));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, WALL_H, z - len / 2); scene.add(ceil);
    const sky = new THREE.Mesh(keep(new THREE.PlaneGeometry(HALL_W * 0.4, len * 0.9)), keep(new THREE.MeshBasicMaterial({ color: "#fff7e8" })));
    sky.rotation.x = Math.PI / 2; sky.position.set(0, WALL_H - 0.01, z - len / 2); scene.add(sky);

    // The title wall: an arch at the room's entrance, lettered like a museum.
    const title = new THREE.CanvasTexture(textCanvas([
      { text: room.title.toUpperCase(), size: 64, weight: "700" },
      { text: room.line, size: 34, italic: true },
      { text: `${room.works.length} works`, size: 28 },
    ], 1400, 420, shade(room.wall, -0.25), "#f4ead6"));
    keep(title); title.colorSpace = THREE.SRGBColorSpace;
    for (const side of [-1, 1] as const) {
      const pier = new THREE.Mesh(keep(new THREE.BoxGeometry(2.2, WALL_H, 0.4)), keep(new THREE.MeshStandardMaterial({ color: shade(room.wall, -0.2), roughness: 0.9 })));
      pier.position.set(side * (HALL_W / 2 - 1.1), WALL_H / 2, z - 0.2);
      scene.add(pier);
    }
    const lintel = new THREE.Mesh(keep(new THREE.BoxGeometry(HALL_W, 1.3, 0.4)), keep(new THREE.MeshStandardMaterial({ color: shade(room.wall, -0.2), roughness: 0.9 })));
    lintel.position.set(0, WALL_H - 0.65, z - 0.2); scene.add(lintel);
    const plaque = new THREE.Mesh(keep(new THREE.PlaneGeometry(4.6, 1.38)), keep(new THREE.MeshBasicMaterial({ map: title })));
    plaque.position.set(0, WALL_H - 0.65, z + 0.01); scene.add(plaque);

    z = end;
    void ri;
  });
  const hallEnd = z;
  const endWall = new THREE.Mesh(keep(new THREE.PlaneGeometry(HALL_W, WALL_H)), keep(new THREE.MeshStandardMaterial({ color: "#1d1915" })));
  endWall.position.set(0, WALL_H / 2, hallEnd); scene.add(endWall);

  // ── Hang the paintings: a placeholder until the image arrives ────────
  const pickables: THREE.Mesh[] = [];
  for (const p of placed) {
    const room = rooms[p.room]!; const w = room.works[p.work]!;
    const x = p.side * (HALL_W / 2 - 0.06);
    const group = new THREE.Group();
    group.position.set(x, HANG_Y, p.z);
    group.rotation.y = -p.side * Math.PI / 2;
    const fw = p.w + 0.36, fh = p.h + 0.36;
    const frame = new THREE.Mesh(keep(new THREE.BoxGeometry(fw, fh, 0.08)), frameMat);
    frame.position.z = 0.02; group.add(frame);
    const mount = new THREE.Mesh(keep(new THREE.PlaneGeometry(p.w + 0.18, p.h + 0.18)), innerMat);
    mount.position.z = 0.065; group.add(mount);
    const placeholder = new THREE.CanvasTexture(textCanvas([{ text: w.title, size: 40, italic: true }, { text: "loading…", size: 26 }], 512, 512, "#d9d0bc", "#5a5040"));
    keep(placeholder); placeholder.colorSpace = THREE.SRGBColorSpace;
    const canvasMesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(p.w, p.h)), new THREE.MeshBasicMaterial({ map: placeholder }));
    canvasMesh.position.z = 0.07;
    canvasMesh.userData = { room: p.room, work: p.work };
    group.add(canvasMesh);
    const glow = new THREE.Mesh(keep(new THREE.PlaneGeometry(fw * 1.7, fh * 1.6)), keep(new THREE.MeshBasicMaterial({ map: pool, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    glow.position.set(0, 0.35, 0.005); group.add(glow);
    // A small label beside the painting, as galleries hang them.
    const label = new THREE.CanvasTexture(textCanvas([
      { text: w.title, size: 30, weight: "700" },
      { text: [w.artist, w.year].filter(Boolean).join(", ") || " ", size: 24 },
    ], 512, 180, "#f6f1e6", "#2a241c"));
    keep(label); label.colorSpace = THREE.SRGBColorSpace;
    const lab = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.62, 0.22)), keep(new THREE.MeshBasicMaterial({ map: label })));
    lab.position.set(fw / 2 + 0.45, -p.h / 2 + 0.2, 0.02); group.add(lab);
    scene.add(group);
    p.mesh = canvasMesh;
    pickables.push(canvasMesh);
  }

  function loadNear(cz: number): void {
    for (const p of placed) {
      if (p.loaded || Math.abs(p.z - cz) > 26) continue;
      p.loaded = true;
      const w = rooms[p.room]!.works[p.work]!;
      loader.load(w.image.thumb, (t) => {
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; keep(t);
        const m = p.mesh.material as THREE.MeshBasicMaterial;
        m.map = t; m.needsUpdate = true;
      }, undefined, () => {
        const failed = new THREE.CanvasTexture(textCanvas([{ text: w.title, size: 38, italic: true }, { text: "image unavailable — see the catalogue", size: 22 }], 512, 512, "#d9d0bc", "#5a5040"));
        failed.colorSpace = THREE.SRGBColorSpace; keep(failed);
        const m = p.mesh.material as THREE.MeshBasicMaterial; m.map = failed; m.needsUpdate = true;
      });
    }
  }

  // ── Walking and looking ──────────────────────────────────────────────
  const pos = new THREE.Vector3(0, EYE, 2.5);
  let yaw = 0, pitch = -0.02;
  let target: { pos: THREE.Vector3; yaw: number; pitch: number } | null = null;
  let currentRoom = -1;

  function roomAt(zz: number): number {
    let k = 0;
    for (let i = 0; i < roomStart.length; i++) if (zz <= roomStart[i]! + 0.5) k = i;
    return k;
  }
  function goRoom(k: number): void {
    const s = roomStart[Math.max(0, Math.min(rooms.length - 1, k))]!;
    target = { pos: new THREE.Vector3(0, EYE, s + 2.2), yaw: 0, pitch: -0.02 };
    if (reducedMotion) { pos.copy(target.pos); yaw = 0; pitch = -0.02; target = null; }
    cb.onPick(null);
  }
  function step(dir: 1 | -1): void {
    const nz = Math.min(2.5, Math.max(hallEnd + 2, pos.z - dir * 3.2));
    target = { pos: new THREE.Vector3(0, EYE, nz), yaw, pitch };
    if (reducedMotion) { pos.copy(target.pos); target = null; }
  }
  function focus(h: Hang | null): void {
    if (!h) return;
    const p = placed.find((q) => q.room === h.room && q.work === h.work);
    if (!p) return;
    // Stand in front of it, at a distance its size asks for.
    const d = Math.max(1.6, Math.max(p.w, p.h) * 1.15);
    const x = p.side * (HALL_W / 2 - 0.06 - d);
    target = { pos: new THREE.Vector3(x, EYE, p.z), yaw: p.side * -Math.PI / 2 * -1, pitch: (HANG_Y - EYE) / d * 0.6 };
    target.yaw = p.side === 1 ? -Math.PI / 2 : Math.PI / 2;
    if (reducedMotion) { pos.copy(target.pos); yaw = target.yaw; pitch = target.pitch; target = null; }
  }

  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  let drag: { x: number; y: number; yaw: number; pitch: number; moved: number } | null = null;
  const el = renderer.domElement;
  const onDown = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY, yaw, pitch, moved: 0 }; el.setPointerCapture(e.pointerId); };
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
    yaw = drag.yaw + dx * 0.004; pitch = Math.max(-0.5, Math.min(0.5, drag.pitch + dy * 0.003));
    target = null;
  };
  const onUp = (e: PointerEvent) => {
    if (!drag) return;
    const moved = drag.moved; drag = null;
    if (moved > 6) return;
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    if (hit) { const h = hit.object.userData as Hang; focus(h); cb.onPick(h); } else cb.onPick(null);
  };
  const onWheel = (e: WheelEvent) => { e.preventDefault(); const nz = Math.min(2.5, Math.max(hallEnd + 2, pos.z + e.deltaY * 0.01)); pos.z = nz; target = null; };
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("wheel", onWheel, { passive: false });

  function resize(): void {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    el.style.width = `${w}px`; el.style.height = `${h}px`;
    camera.aspect = w / h;
    camera.fov = w < h ? 74 : 62;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(host); resize();

  let raf = 0, last = performance.now(), visible = true;
  const io = new IntersectionObserver((es) => { visible = es.some((x) => x.isIntersecting); }); io.observe(host);
  function tick(now: number): void {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!visible) return;
    if (target) {
      const k = 1 - Math.pow(0.0025, dt);
      pos.lerp(target.pos, k);
      let dy = target.yaw - yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      yaw += dy * k; pitch += (target.pitch - pitch) * k;
      if (pos.distanceTo(target.pos) < 0.01 && Math.abs(dy) < 0.003) target = null;
    }
    camera.position.copy(pos);
    camera.rotation.set(pitch, yaw, 0, "YXZ");
    loadNear(pos.z);
    const r = roomAt(pos.z);
    if (r !== currentRoom) { currentRoom = r; cb.onRoom(r); }
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(tick);

  return {
    goRoom, step, focus,
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp); el.removeEventListener("wheel", onWheel);
      for (const p of placed) { const m = p.mesh.material as THREE.MeshBasicMaterial; m.map?.dispose(); m.dispose(); }
      for (const x of bag) x.dispose();
      renderer.dispose(); el.remove();
    },
  };
}
