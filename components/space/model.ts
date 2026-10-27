/**
 * NISAR as a holographic wireframe: sixteen parts, each its own group with its
 * own materials, so a stage can colour, dim, highlight, hide or pull apart any
 * one of them.
 *
 * The layout follows NISAR's published arrangement — an ISRO bus, a radar
 * instrument structure carrying both radars' feeds on top of it, a boom that
 * unfolds to hold a 12 m reflector, two solar arrays — but it is a diagram,
 * not a blueprint. One unit is one metre. The reflector's 12 m and the boom's
 * 9 m are drawn true; the two arrays are drawn at about the 23 m² JPL
 * gives for them; every other part is placed and sized to be legible.
 */
import * as THREE from "three";
import { PART_ORDER, type PartId } from "@/lib/space-story";

export interface ModelPart {
  id: PartId;
  group: THREE.Group;
  lines: THREE.LineBasicMaterial;
  fill: THREE.MeshBasicMaterial;
  /** Where the part sits when assembled, and how far it moves when the model is pulled apart. */
  home: THREE.Vector3;
  apart: THREE.Vector3;
  /** The part's centre in model space, assembled — where its label and the camera's target go. */
  centre: THREE.Vector3;
  /** Rough size, for framing the camera on it. */
  radius: number;
  /** The meshes a ray can hit to pick the part. */
  pick: THREE.Mesh[];
}

export interface Model {
  root: THREE.Group;
  parts: Record<PartId, ModelPart>;
  /** Pull apart by `e` (0 assembled, 1 fully apart). */
  setApart(e: number): void;
  /** Fold the reflector and boom: 0 stowed for launch, 1 deployed. */
  setDeploy(d: number): void;
  dispose(): void;
}

/* ── Line builders: every shape is drawn as its edges, never as triangles ── */

type Seg = number[];
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function push(out: Seg, a: THREE.Vector3, b: THREE.Vector3) { out.push(a.x, a.y, a.z, b.x, b.y, b.z); }

function circle(out: Seg, c: THREE.Vector3, r: number, axis: "x" | "y" | "z", n = 32) {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    const p = (a: number) => axis === "y" ? v(c.x + r * Math.cos(a), c.y, c.z + r * Math.sin(a)) : axis === "x" ? v(c.x, c.y + r * Math.cos(a), c.z + r * Math.sin(a)) : v(c.x + r * Math.cos(a), c.y + r * Math.sin(a), c.z);
    push(out, p(a0), p(a1));
  }
}

/** A box's twelve edges plus panel lines on its faces. */
function box(out: Seg, c: THREE.Vector3, s: [number, number, number], panels: [number, number, number] = [1, 1, 1]) {
  const [w, h, d] = s.map((x) => x / 2) as [number, number, number];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    push(out, v(c.x + sx * w, c.y + sy * h, c.z - d), v(c.x + sx * w, c.y + sy * h, c.z + d));
    push(out, v(c.x + sx * w, c.y - h, c.z + sy * d), v(c.x + sx * w, c.y + h, c.z + sy * d));
    push(out, v(c.x - w, c.y + sx * h, c.z + sy * d), v(c.x + w, c.y + sx * h, c.z + sy * d));
  }
  // Panel lines: divide each face.
  for (let i = 1; i < panels[1]; i++) {
    const y = c.y - h + (2 * h * i) / panels[1];
    for (const sx of [-1, 1]) { push(out, v(c.x + sx * w, y, c.z - d), v(c.x + sx * w, y, c.z + d)); push(out, v(c.x - w, y, c.z + sx * d), v(c.x + w, y, c.z + sx * d)); }
  }
  for (let i = 1; i < panels[0]; i++) {
    const x = c.x - w + (2 * w * i) / panels[0];
    for (const sz of [-1, 1]) push(out, v(x, c.y - h, c.z + sz * d), v(x, c.y + h, c.z + sz * d));
  }
  for (let i = 1; i < panels[2]; i++) {
    const z = c.z - d + (2 * d * i) / panels[2];
    for (const sx of [-1, 1]) push(out, v(c.x + sx * w, c.y - h, z), v(c.x + sx * w, c.y + h, z));
  }
}

/** A cylinder along y: two end rings, a middle ring and n verticals. */
function cylinder(out: Seg, c: THREE.Vector3, r: number, h: number, n = 16, rings = 2) {
  for (let k = 0; k <= rings; k++) circle(out, v(c.x, c.y - h / 2 + (h * k) / rings, c.z), r, "y", n);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; push(out, v(c.x + r * Math.cos(a), c.y - h / 2, c.z + r * Math.sin(a)), v(c.x + r * Math.cos(a), c.y + h / 2, c.z + r * Math.sin(a))); }
}

function sphere(out: Seg, c: THREE.Vector3, r: number, lat = 7, lon = 12) {
  for (let i = 1; i < lat; i++) { const ph = (i / lat) * Math.PI; circle(out, v(c.x, c.y + r * Math.cos(ph), c.z), r * Math.sin(ph), "y", 28); }
  for (let j = 0; j < lon; j++) {
    const th = (j / lon) * Math.PI * 2;
    for (let i = 0; i < 16; i++) {
      const p0 = (i / 16) * Math.PI, p1 = ((i + 1) / 16) * Math.PI;
      push(out, v(c.x + r * Math.sin(p0) * Math.cos(th), c.y + r * Math.cos(p0), c.z + r * Math.sin(p0) * Math.sin(th)), v(c.x + r * Math.sin(p1) * Math.cos(th), c.y + r * Math.cos(p1), c.z + r * Math.sin(p1) * Math.sin(th)));
    }
  }
}

/** A flat grid of cells in the plane spanned by u and w from corner o. */
function grid(out: Seg, o: THREE.Vector3, u: THREE.Vector3, w: THREE.Vector3, nu: number, nw: number) {
  for (let i = 0; i <= nu; i++) { const a = o.clone().addScaledVector(u, i / nu); push(out, a, a.clone().add(w)); }
  for (let j = 0; j <= nw; j++) { const a = o.clone().addScaledVector(w, j / nw); push(out, a, a.clone().add(u)); }
}

/** A parabolic dish of radius r and depth dz opening along +y from the origin: ribs and rings. */
function dish(out: Seg, r: number, dz: number, ribs = 36, rings = 6) {
  const y = (rr: number) => dz * (rr / r) ** 2;
  for (let k = 0; k < ribs; k++) {
    const a = (k / ribs) * Math.PI * 2;
    for (let i = 0; i < 12; i++) { const r0 = (i / 12) * r, r1 = ((i + 1) / 12) * r; push(out, v(r0 * Math.cos(a), y(r0), r0 * Math.sin(a)), v(r1 * Math.cos(a), y(r1), r1 * Math.sin(a))); }
  }
  for (let j = 1; j <= rings; j++) { const rr = (j / rings) * r; circle(out, v(0, y(rr), 0), rr, "y", ribs * 2); }
}

function lineGeo(seg: Seg) { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3)); return g; }

const CYAN = new THREE.Color("#5fd4ff");

export function buildModel(): Model {
  const root = new THREE.Group();
  const disposables: Array<{ dispose(): void }> = [];
  const parts = {} as Record<PartId, ModelPart>;

  function part(id: PartId, seg: Seg, fills: THREE.BufferGeometry[], fillAt: THREE.Vector3[], apart: THREE.Vector3, opts: { fill?: number; quat?: THREE.Quaternion[] } = {}) {
    const group = new THREE.Group();
    const lines = new THREE.LineBasicMaterial({ color: CYAN.clone(), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const fill = new THREE.MeshBasicMaterial({ color: CYAN.clone(), transparent: true, opacity: opts.fill ?? 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    lines.userData.base = 0.9; fill.userData.base = opts.fill ?? 0.05;
    const lg = lineGeo(seg);
    group.add(new THREE.LineSegments(lg, lines));
    const pick: THREE.Mesh[] = [];
    fills.forEach((g, i) => { const m = new THREE.Mesh(g, fill); m.position.copy(fillAt[i]!); if (opts.quat?.[i]) m.quaternion.copy(opts.quat[i]!); m.userData.part = id; group.add(m); pick.push(m); disposables.push(g); });
    disposables.push(lg, lines, fill);
    lg.computeBoundingBox();
    const bb = lg.boundingBox!;
    const centre = bb.getCenter(new THREE.Vector3());
    const radius = bb.getSize(new THREE.Vector3()).length() / 2;
    group.userData.part = id;
    root.add(group);
    parts[id] = { id, group, lines, fill, home: new THREE.Vector3(), apart, centre, radius, pick };
  }

  /* The bus: ISRO's spacecraft, a box with two internal decks. */
  {
    const s: Seg = [];
    box(s, v(0, 0, 0), [2.2, 2.6, 2.2], [2, 3, 2]);
    part("bus", s, [new THREE.BoxGeometry(2.2, 2.6, 2.2)], [v(0, 0, 0)], v(0, 0, 0), { fill: 0.04 });
  }
  /* Thermal blankets: a looser shell around the bus, and a radiator panel on its shaded face. */
  {
    const s: Seg = [];
    box(s, v(0, 0, 0), [2.42, 2.82, 2.42], [5, 6, 5]);
    grid(s, v(-0.9, -1.1, -1.25), v(1.8, 0, 0), v(0, 2.2, 0), 9, 11);
    part("thermal", s, [new THREE.BoxGeometry(2.42, 2.82, 2.42)], [v(0, 0, 0)], v(-6.5, 1.5, 0), { fill: 0.02 });
  }
  {
    const s: Seg = [];
    box(s, v(-0.45, -0.75, 0.35), [0.9, 0.5, 0.7], [4, 1, 3]);
    part("battery", s, [new THREE.BoxGeometry(0.9, 0.5, 0.7)], [v(-0.45, -0.75, 0.35)], v(-3, -3.6, 3.5));
  }
  {
    // Four reaction wheels in a pyramid, so any three can point the craft.
    const s: Seg = [];
    const at = [v(0.35, 0.55, 0.3), v(0.75, 0.55, 0.3), v(0.55, 0.55, 0.7), v(0.55, 0.9, 0.5)];
    for (const c of at) { cylinder(s, c, 0.17, 0.08, 18, 1); push(s, v(c.x, c.y - 0.04, c.z), v(c.x, c.y + 0.04, c.z)); }
    part("wheels", s, at.map(() => new THREE.CylinderGeometry(0.17, 0.17, 0.08, 18)), at, v(3.5, 2.4, 4));
  }
  {
    // A propellant tank and four small thrusters at the base.
    const s: Seg = [];
    sphere(s, v(0.3, -0.45, -0.35), 0.55);
    const th = [v(0.95, -1.35, 0.95), v(-0.95, -1.35, 0.95), v(0.95, -1.35, -0.95), v(-0.95, -1.35, -0.95)];
    for (const c of th) { circle(s, v(c.x, c.y - 0.12, c.z), 0.09, "y", 12); circle(s, v(c.x, c.y + 0.06, c.z), 0.04, "y", 10); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; push(s, v(c.x + 0.04 * Math.cos(a), c.y + 0.06, c.z + 0.04 * Math.sin(a)), v(c.x + 0.09 * Math.cos(a), c.y - 0.12, c.z + 0.09 * Math.sin(a))); } }
    part("propulsion", s, [new THREE.SphereGeometry(0.55, 14, 10)], [v(0.3, -0.45, -0.35)], v(1.5, -5, -3));
  }
  {
    const s: Seg = [];
    box(s, v(-0.5, 0.6, -0.5), [0.6, 0.32, 0.45], [3, 1, 2]);
    part("recorder", s, [new THREE.BoxGeometry(0.6, 0.32, 0.45)], [v(-0.5, 0.6, -0.5)], v(-4, 2.6, -3));
  }
  {
    // Two star sensors on the bus's side, each a barrel with a sun-shade baffle.
    const s: Seg = [];
    const at = [v(-1.25, 0.85, 0.65), v(-1.25, 0.85, -0.65)];
    for (const c of at) { cylinder(s, c, 0.1, 0.28, 12, 1); circle(s, v(c.x, c.y + 0.32, c.z), 0.18, "y", 14); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; push(s, v(c.x + 0.1 * Math.cos(a), c.y + 0.14, c.z + 0.1 * Math.sin(a)), v(c.x + 0.18 * Math.cos(a), c.y + 0.32, c.z + 0.18 * Math.sin(a))); } }
    part("startrackers", s, at.map(() => new THREE.CylinderGeometry(0.14, 0.1, 0.4, 12)), at, v(-5, 4, 1.5));
  }
  {
    // Command and telemetry: small omni antennas at opposite corners.
    const s: Seg = [];
    const at = [v(1.05, -1.55, 1.05), v(-1.05, -1.55, -1.05)];
    for (const c of at) { push(s, v(c.x, c.y + 0.25, c.z), v(c.x, c.y - 0.25, c.z)); for (let k = 0; k < 6; k++) circle(s, v(c.x, c.y + 0.2 - k * 0.08, c.z), 0.06, "y", 10); }
    part("ttc", s, at.map(() => new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8)), at, v(0, -6.5, 4));
  }
  {
    // The Ka-band dish on a short mast below the bus.
    const s: Seg = [];
    push(s, v(0.9, -1.3, -0.2), v(0.9, -1.75, -0.2));
    const d: Seg = []; dish(d, 0.42, 0.14, 16, 3);
    const q = new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), v(0.4, -1, 0).normalize());
    for (let i = 0; i < d.length; i += 3) { const p = v(d[i]!, d[i + 1]!, d[i + 2]!).applyQuaternion(q).add(v(0.9, -1.85, -0.2)); s.push(p.x, p.y, p.z); }
    part("kaband", s, [new THREE.CylinderGeometry(0.42, 0.3, 0.16, 16)], [v(0.9, -1.85, -0.2)], v(3.5, -4.5, 0), { quat: [q] });
  }
  /* The radar instrument structure: an octagonal drum on top of the bus that carries both feeds. */
  {
    const s: Seg = [];
    cylinder(s, v(0, 2.2, 0), 1.05, 1.8, 8, 3);
    part("ris", s, [new THREE.CylinderGeometry(1.05, 1.05, 1.8, 8)], [v(0, 2.2, 0)], v(0, 4.2, 0));
  }
  {
    // The two feed arrays, side by side on the drum's face towards the reflector.
    const mk = (id: PartId, z0: number, nz: number, apart: THREE.Vector3) => {
      const s: Seg = [];
      grid(s, v(1.12, 1.45, z0), v(0, 1.5, 0), v(0, 0, 0.78), 8, nz);
      grid(s, v(1.2, 1.45, z0), v(0, 1.5, 0), v(0, 0, 0.78), 1, 1);
      part(id, s, [new THREE.BoxGeometry(0.08, 1.5, 0.78)], [v(1.16, 2.2, z0 + 0.39)], apart, { fill: 0.08 });
    };
    mk("lband", -0.86, 4, v(4.5, 1.5, -3.5));
    mk("sband", 0.08, 6, v(4.5, 1, 3.5));
  }
  {
    const s: Seg = [];
    const at = [v(-0.45, 3.16, 0.45), v(0.1, 3.16, -0.55)];
    for (const c of at) { cylinder(s, c, 0.13, 0.07, 14, 1); circle(s, v(c.x, c.y + 0.06, c.z), 0.06, "y", 10); }
    part("gps", s, at.map(() => new THREE.CylinderGeometry(0.13, 0.13, 0.08, 14)), at, v(-1.5, 7, 0));
  }

  /* The boom and reflector: built in their own frames so they can fold. */
  const HINGE = v(0.95, 3.1, 0);
  const BOOM_DIR = v(0.62, 0.785, 0).normalize();
  const BOOM = 9;
  const end = HINGE.clone().addScaledVector(BOOM_DIR, BOOM);
  {
    // A triangular truss in four hinged sections.
    const s: Seg = [];
    const side = v(0, 0, 1), up = new THREE.Vector3().crossVectors(BOOM_DIR, side).normalize();
    const corner = (t: number, k: number) => { const a = (k / 3) * Math.PI * 2; return HINGE.clone().addScaledVector(BOOM_DIR, t).addScaledVector(side, 0.16 * Math.cos(a)).addScaledVector(up, 0.16 * Math.sin(a)); };
    const N = 24;
    for (let i = 0; i < N; i++) {
      const t0 = (i / N) * BOOM, t1 = ((i + 1) / N) * BOOM;
      for (let k = 0; k < 3; k++) { push(s, corner(t0, k), corner(t1, k)); push(s, corner(t0, k), corner(t1, (k + 1) % 3)); }
      if (i % 6 === 0) for (let k = 0; k < 3; k++) push(s, corner(t0, k), corner(t0, (k + 1) % 3));
    }
    for (let h = 1; h < 4; h++) circle(s, HINGE.clone().addScaledVector(BOOM_DIR, (h / 4) * BOOM), 0.24, "z", 12);
    const mid = HINGE.clone().addScaledVector(BOOM_DIR, BOOM / 2);
    const q = new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), BOOM_DIR);
    part("boom", s, [new THREE.CylinderGeometry(0.2, 0.2, BOOM, 6)], [mid], v(2.4, 1.6, 0), { quat: [q] });
  }
  {
    // The reflector hangs off the boom's end by its rim and faces back down at the feeds.
    const FEED = v(1.16, 2.2, 0);
    const R = 6, DEPTH = 1.1;
    let c = end.clone().add(v(5.4, 0, 0));
    let axis = FEED.clone().sub(c).normalize();
    for (let it = 0; it < 8; it++) {
      axis = FEED.clone().sub(c).normalize();
      const toEnd = end.clone().sub(c);
      const inPlane = toEnd.addScaledVector(axis, -toEnd.dot(axis)).normalize();
      c = end.clone().addScaledVector(inPlane, -5.6);
    }
    const q = new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), axis);
    const d: Seg = []; dish(d, R, DEPTH, 40, 7);
    const s: Seg = [];
    for (let i = 0; i < d.length; i += 3) { const p = v(d[i]!, d[i + 1]!, d[i + 2]!).applyQuaternion(q).add(c); s.push(p.x, p.y, p.z); }
    const fillG = new THREE.CircleGeometry(R, 40); fillG.rotateX(-Math.PI / 2);
    part("reflector", s, [fillG], [c], v(4.5, 4.5, 0), { fill: 0.035, quat: [q] });
    parts.reflector.group.userData.dishCentre = c;
    parts.reflector.group.userData.axis = axis;
  }

  /* Two solar arrays, one each side of the bus, three panels apiece. */
  {
    const s: Seg = [];
    const fills: THREE.BufferGeometry[] = [], at: THREE.Vector3[] = [];
    for (const side of [-1, 1]) {
      push(s, v(-0.2, 0, side * 1.1), v(-0.2, 0, side * 1.75));
      for (let p = 0; p < 3; p++) {
        const z0 = side * (1.8 + p * 1.62);
        grid(s, v(-1.2, -1.2, Math.min(z0, z0 + side * 1.56)), v(0, 2.4, 0), v(0, 0, 1.56), 12, 8);
        const g = new THREE.PlaneGeometry(1.56, 2.4); g.rotateY(Math.PI / 2);
        fills.push(g); at.push(v(-1.2, 0, z0 + side * 0.78));
      }
    }
    part("solar", s, fills, at, v(0, -1.6, 0), { fill: 0.07 });
  }

  for (const id of PART_ORDER) parts[id].home.copy(parts[id].group.position);

  // The reflector and boom fold about the hinge for launch; deploy unfolds them.
  const hingeObj = { reflector: parts.reflector.group, boom: parts.boom.group };
  let apartE = 0, deployD = 1;
  function apply() {
    for (const id of PART_ORDER) {
      const p = parts[id];
      p.group.position.copy(p.home).addScaledVector(p.apart, apartE);
      p.group.quaternion.identity();
      p.group.scale.setScalar(1);
    }
    // Stowed, the boom swings down about its hinge against the drum and the
    // reflector is furled to a small bundle at the boom's tip.
    const qz = new THREE.Quaternion().setFromAxisAngle(v(0, 0, 1), (1 - deployD) * -2.25);
    const pivot = HINGE.clone().sub(HINGE.clone().applyQuaternion(qz));
    const boom = hingeObj.boom;
    boom.quaternion.copy(qz);
    boom.position.copy(pivot).addScaledVector(parts.boom.apart, apartE);
    const s = 0.06 + 0.94 * Math.min(1, Math.max(0, (deployD - 0.5) / 0.5));
    const tip = HINGE.clone().add(end.clone().sub(HINGE).applyQuaternion(qz));
    const refl = hingeObj.reflector;
    refl.quaternion.copy(qz);
    refl.scale.setScalar(s);
    refl.position.copy(pivot).multiplyScalar(s).addScaledVector(tip, 1 - s).addScaledVector(parts.reflector.apart, apartE);
  }
  apply();

  return {
    root, parts,
    setApart(e) { apartE = e; apply(); },
    setDeploy(d) { deployD = d; apply(); },
    dispose() { for (const x of disposables) x.dispose(); },
  };
}
