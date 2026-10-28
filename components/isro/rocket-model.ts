/**
 * An Indian rocket as a holographic wireframe, one group per stage, so a
 * stage can be coloured, dimmed, picked or pulled away. The overall height is
 * the rocket's published height (one unit is one metre); how it divides
 * between stages, and most diameters, are drawn to be legible — see
 * lib/space-programme.ts.
 */
import * as THREE from "three";
import { layout, type Rocket, type StageKind } from "@/lib/space-programme";

export interface StagePart {
  id: string;
  kind: StageKind;
  group: THREE.Group;
  lines: THREE.LineBasicMaterial;
  fill: THREE.MeshBasicMaterial;
  apart: THREE.Vector3;
  centre: THREE.Vector3;
  radius: number;
  pick: THREE.Mesh[];
}

export interface RocketModel {
  rocket: Rocket;
  root: THREE.Group;
  parts: Record<string, StagePart>;
  order: string[];
  setApart(e: number): void;
  dispose(): void;
}

type Seg = number[];
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const push = (o: Seg, a: THREE.Vector3, b: THREE.Vector3) => o.push(a.x, a.y, a.z, b.x, b.y, b.z);

function ring(o: Seg, cx: number, y: number, cz: number, r: number, n: number) {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    push(o, v(cx + r * Math.cos(a0), y, cz + r * Math.sin(a0)), v(cx + r * Math.cos(a1), y, cz + r * Math.sin(a1)));
  }
}

/** A tube from y0 to y1, ruled with rings, closing in a cone (or an ogive) when it is a nose. */
function tube(o: Seg, cx: number, cz: number, r: number, y0: number, y1: number, nose: boolean, ogive: boolean) {
  const n = r > 1.2 ? 28 : 18;
  const h = y1 - y0;
  const noseH = nose ? Math.min(h * 0.5, r * (ogive ? 3.2 : 2.6)) : 0;
  const top = y1 - noseH;
  const rings = Math.max(2, Math.round((top - y0) / 1.6));
  for (let k = 0; k <= rings; k++) ring(o, cx, y0 + ((top - y0) * k) / rings, cz, r, n);
  const verts = n > 20 ? 14 : 10;
  for (let i = 0; i < verts; i++) {
    const a = (i / verts) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    push(o, v(cx + r * ca, y0, cz + r * sa), v(cx + r * ca, top, cz + r * sa));
    if (nose) {
      // The nose curves in: a few segments of a tangent ogive (or a straight cone).
      const segs = ogive ? 6 : 1;
      for (let s = 0; s < segs; s++) {
        const t0 = s / segs, t1 = (s + 1) / segs;
        const rr = (t: number) => (ogive ? r * Math.sqrt(Math.max(0, 1 - t * t)) : r * (1 - t));
        push(o, v(cx + rr(t0) * ca, top + noseH * t0, cz + rr(t0) * sa), v(cx + rr(t1) * ca, top + noseH * t1, cz + rr(t1) * sa));
      }
    }
  }
  if (nose && ogive) for (let k = 1; k < 4; k++) { const t = k / 4; ring(o, cx, top + noseH * t, cz, r * Math.sqrt(1 - t * t), n); }
}

/** Engine bells under a stage. */
function bells(o: Seg, cx: number, cz: number, y: number, r: number, count: number) {
  const br = Math.min(r * 0.42, 0.9), bh = br * 1.5;
  const at = count === 1 ? [[0, 0]] : Array.from({ length: count }, (_, k) => [r * 0.45 * Math.cos((k / count) * Math.PI * 2), r * 0.45 * Math.sin((k / count) * Math.PI * 2)]);
  for (const [dx, dz] of at) {
    ring(o, cx + dx!, y, cz + dz!, br * 0.4, 12);
    ring(o, cx + dx!, y - bh, cz + dz!, br, 16);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; push(o, v(cx + dx! + br * 0.4 * Math.cos(a), y, cz + dz! + br * 0.4 * Math.sin(a)), v(cx + dx! + br * Math.cos(a), y - bh, cz + dz! + br * Math.sin(a))); }
  }
}

export function buildRocket(r: Rocket, colours: Record<StageKind, string>): RocketModel {
  const root = new THREE.Group();
  const parts: Record<string, StagePart> = {};
  const order: string[] = [];
  const disposables: Array<{ dispose(): void }> = [];
  const pieces = layout(r);
  const cores = pieces.filter((p) => p.stage.role !== "strapon");
  const H = r.heightM;

  pieces.forEach((p) => {
    const s = p.stage;
    const isFairing = s.role === "fairing";
    const col = new THREE.Color(colours[s.kind]);
    const lines = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const fill = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.025, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    lines.userData.base = 0.95; fill.userData.base = 0.025;
    disposables.push(lines, fill);
    const group = new THREE.Group();
    const pick: THREE.Mesh[] = [];
    // One line set per copy, so each strap-on can move out along its own direction.
    for (const [cx, cz] of p.at) {
      const seg: Seg = [];
      tube(seg, cx, cz, p.radius, p.y0, p.y1, p.nose, isFairing);
      if (s.role === "strapon" || cores[0]?.stage.id === s.id) bells(seg, cx, cz, p.y0, p.radius, s.role === "strapon" ? 1 : r.diameterM >= 3 ? 2 : 1);
      const below = cores[cores.indexOf(p) - 1];
      if (isFairing && below && below.radius < p.radius - 0.05) {
        // A fairing wider than the stage below sits on a short taper.
        for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; push(seg, v(below.radius * Math.cos(a), p.y0 - 0.9, below.radius * Math.sin(a)), v(p.radius * Math.cos(a), p.y0, p.radius * Math.sin(a))); }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
      const ls = new THREE.LineSegments(geo, lines);
      const g = new THREE.CylinderGeometry(p.radius, p.radius, p.y1 - p.y0, 14);
      const m = new THREE.Mesh(g, fill);
      m.position.set(cx, (p.y0 + p.y1) / 2, cz);
      m.userData.stage = s.id;
      const dir = Math.hypot(cx, cz) > 0 ? v(cx, 0, cz).normalize() : v(0, 0, 0);
      const copy = new THREE.Group();
      copy.add(ls, m);
      copy.userData.dir = dir;
      group.add(copy);
      pick.push(m);
      disposables.push(geo, g);
    }
    root.add(group);
    // Pulled apart: core stages rise in turn, strap-ons move outward.
    const k = cores.indexOf(p);
    const apart = s.role === "strapon" ? v(0, 0, 0) : v(0, Math.max(0, k) * H * 0.12, 0);
    group.userData.strapon = s.role === "strapon";
    group.userData.out = r.diameterM * 1.3 + 1;
    const cy = (p.y0 + p.y1) / 2;
    parts[s.id] = { id: s.id, kind: s.kind, group, lines, fill, apart, centre: v(s.role === "strapon" ? p.at[0]![0] : 0, cy, s.role === "strapon" ? p.at[0]![1] : 0), radius: Math.max(p.radius * (s.role === "strapon" ? 2.4 : 1.4), (p.y1 - p.y0) / 2), pick };
    order.push(s.id);
  });

  return {
    rocket: r, root, parts, order,
    setApart(e) {
      for (const id of order) {
        const p = parts[id]!;
        if (p.group.userData.strapon) for (const c of p.group.children) c.position.copy(c.userData.dir as THREE.Vector3).multiplyScalar(e * (p.group.userData.out as number));
        else p.group.position.copy(p.apart).multiplyScalar(e);
      }
    },
    dispose() { for (const x of disposables) x.dispose(); },
  };
}

/** A 1.75 m person, as lines, standing at the origin. */
export function person(colour: string): THREE.LineSegments {
  const s: Seg = [];
  for (let i = 0; i < 16; i++) { const t0 = (i / 16) * Math.PI * 2, t1 = ((i + 1) / 16) * Math.PI * 2; s.push(0.11 * Math.cos(t0), 1.62 + 0.11 * Math.sin(t0), 0, 0.11 * Math.cos(t1), 1.62 + 0.11 * Math.sin(t1), 0); }
  s.push(0, 1.51, 0, 0, 0.85, 0, 0, 0.85, 0, -0.18, 0, 0, 0, 0.85, 0, 0.18, 0, 0, -0.32, 1.0, 0, 0.32, 1.0, 0);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(s, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
}
