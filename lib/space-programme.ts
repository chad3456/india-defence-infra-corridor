/**
 * The register behind /space-programme: India's rockets, missions, centres
 * and record. Types, the arithmetic the page labels derived, and the layout
 * the 3D stage and the rocket explorer both draw from. No node imports.
 *
 * ── What the rocket drawings encode ─────────────────────────────────────
 *
 * Each rocket's overall height is its published height, so the line-up is
 * to scale. LVM3's 5 m fairing is ISRO's figure. How the height divides
 * between stages, the diameters of most rockets, and the strap-ons' sizes
 * are drawn to be legible and are not measurements; the page says so.
 */

export type StageKind = "solid" | "liquid" | "cryo" | "fairing";
export type StageRole = "core" | "strapon" | "fairing";

export interface Stage {
  id: string;
  name: string;
  kind: StageKind;
  role: StageRole;
  /** Share of the rocket's height (schematic). Core stages and the fairing sum to 1. */
  share: number;
  count: number;
  propellantT: number | null;
  engine: string | null;
  note: string;
  sources: string[];
}

export interface Rocket {
  id: string;
  name: string;
  era: string;
  heightM: number;
  heightApprox?: boolean;
  heightSources: string[];
  diameterM: number;
  liftoffT: number | null;
  liftoffSources: string[];
  payload: string;
  payloadSources: string[];
  story: string;
  storySources: string[];
  stages: Stage[];
}

export interface Source { id: string; publisher: string; title: string; url: string; published: string | null; tier: 1 | 2 | 3; kind: string }
export interface Milestone { date: string; label?: string; what: string; tone: "win" | "loss" | "next"; sources: string[] }
export interface Centre { id: string; city: string; lat: number; lon: number; units: string[]; role: string; source: string }

export interface ProgrammePublished {
  about: string;
  accessed: string;
  sources: Source[];
  kinds: Record<StageKind, { label: string; colour: string }>;
  rockets: Rocket[];
  milestones: Milestone[];
  missions: {
    moon: { launch: string; vehicle: string; landed: string; costCrore: number; costSources: string[]; sources: string[] };
    mars: { launch: string; vehicle: string; arrived: string; costCrore: number; costSources: string[]; sources: string[]; ended: string; endedSources: string[] };
    sun: { launch: string; vehicle: string; arrived: string; distance: string; cruiseDays: number; sources: string[] };
  };
  centres: Centre[];
  record: { pslvFlights: number; pslvFlightsSources: string[]; lvm3Streak: number; lvm3StreakSources: string[]; hundredth: { date: string; what: string; sources: string[] } };
  money: {
    budget: { value: number; unit: string; year: string; change: string; source: string };
    unspent: { text: string; source: string };
    economy: { now: number; nowShare: string; target: number; targetYear: number; targetShare: string; source: string; note: string };
    fleet: { total: number; rows: Array<{ kind: string; n: number }>; source: string };
    dependence: { satellitesImportedPct: string; launchersImportedPct: string; what: string; source: string; progress: string; progressSource: string };
  };
}

/** Every source id the register cites. */
export function citedIds(d: ProgrammePublished): string[] {
  return [
    ...d.rockets.flatMap((r) => [...r.heightSources, ...r.liftoffSources, ...r.payloadSources, ...r.storySources, ...r.stages.flatMap((s) => s.sources)]),
    ...d.milestones.flatMap((m) => m.sources),
    ...d.missions.moon.sources, ...d.missions.moon.costSources,
    ...d.missions.mars.sources, ...d.missions.mars.costSources, ...d.missions.mars.endedSources,
    ...d.missions.sun.sources,
    ...d.centres.map((c) => c.source),
    ...d.record.pslvFlightsSources, ...d.record.lvm3StreakSources, ...d.record.hundredth.sources,
    d.money.budget.source, d.money.unspent.source, d.money.economy.source, d.money.fleet.source, d.money.dependence.source, d.money.dependence.progressSource,
  ];
}

/** Whole days between two ISO dates — derived. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Drawn diameters for strap-ons and wide fairings, in metres. Only LVM3's 5 m fairing is a published figure. */
const STRAP_D: Record<string, number> = { aslv: 0.55, pslv: 1.0, gslv: 2.1, lvm3: 3.2 };
const FAIRING_D: Record<string, number> = { lvm3: 5, gslv: 3.4 };

export interface Piece {
  stage: Stage;
  /** Bottom and top, metres above the pad. */
  y0: number;
  y1: number;
  radius: number;
  /** Centres of each copy in the horizontal plane: one at the axis for a core stage, a ring for strap-ons. */
  at: Array<[number, number]>;
  /** A nose: the fairing ends in a cone. */
  nose: boolean;
}

/** Where each stage sits, bottom to top, for a rocket of its published height. */
export function layout(r: Rocket): Piece[] {
  const R = r.diameterM / 2;
  const pieces: Piece[] = [];
  let y = 0;
  for (const s of r.stages.filter((x) => x.role !== "strapon")) {
    const h = s.share * r.heightM;
    const radius = s.role === "fairing" ? (FAIRING_D[r.id] ?? r.diameterM) / 2 : R;
    pieces.push({ stage: s, y0: y, y1: y + h, radius, at: [[0, 0]], nose: s.role === "fairing" });
    y += h;
  }
  for (const s of r.stages.filter((x) => x.role === "strapon")) {
    const rs = (STRAP_D[r.id] ?? r.diameterM * 0.4) / 2;
    const ring = R + rs + 0.05;
    const at: Array<[number, number]> = Array.from({ length: s.count }, (_, k) => {
      const a = (k / s.count) * Math.PI * 2 + Math.PI / 4;
      return [ring * Math.cos(a), ring * Math.sin(a)];
    });
    pieces.push({ stage: s, y0: 0.4, y1: 0.4 + s.share * r.heightM, radius: rs, at, nose: true });
  }
  return pieces;
}

/** Core stages and fairing must fill the rocket exactly. */
export function sharesSum(r: Rocket): number {
  return r.stages.filter((s) => s.role !== "strapon").reduce((a, s) => a + s.share, 0);
}
