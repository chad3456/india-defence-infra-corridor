/**
 * The register behind /space: how a satellite works, told through NISAR, and
 * where India stands in space. Types and small helpers only — no node
 * imports, because the page, the 3D stage and the explorer all read them.
 *
 * The model drawn on the page is NISAR's layout, not its blueprint. Only the
 * reflector (12 m) and the boom (9 m) are drawn at their published lengths;
 * every other part is placed and sized to be legible. What each part is, who
 * built it and every figure about it comes from the register.
 */

export type PartId =
  | "reflector" | "boom" | "lband" | "sband" | "ris" | "recorder" | "kaband" | "gps"
  | "bus" | "solar" | "battery" | "wheels" | "startrackers" | "propulsion" | "thermal" | "ttc";

/** The order parts are listed in, and numbered by, everywhere. */
export const PART_ORDER: PartId[] = [
  "reflector", "boom", "lband", "sband", "ris", "recorder", "kaband", "gps",
  "bus", "solar", "battery", "wheels", "startrackers", "propulsion", "thermal", "ttc",
];

export type Origin = "india" | "india-bus" | "us" | "joint";
export const ORIGINS: Origin[] = ["india", "india-bus", "us", "joint"];

export interface SpaceSource {
  id: string;
  publisher: string;
  title: string;
  url: string;
  published: string | null;
  tier: 1 | 2 | 3;
  kind: "official" | "press" | "reference";
}

export interface SpacePart {
  id: PartId;
  group: string;
  name: string;
  origin: Origin;
  does: string;
  inNisar: string;
  sources: string[];
  stat: { value: string; label: string; source: string } | null;
}

export interface SpacePlace { id: string; name: string; kind: "launch" | "ground"; lat: number; lon: number; note?: string; source: string }

export interface SpacePublished {
  about: string;
  accessed: string;
  sources: SpaceSource[];
  nisar: {
    launch: { vehicle: string; date: string; time: string; site: string; sources: string[] };
    massKg: number; massSource: string; massNote: string;
    orbit: { altitudeKm: number; inclinationDeg: number; kind: string; sources: string[]; note: string };
    reflectorM: number; boomM: number; reflectorSources: string[];
    deployed: { from: string; to: string; source: string };
    firstLight: { date: string; what: string; source: string };
    kaGbps: number; recorderTbit: number;
    split: { india: string; us: string; sources: string[] };
    swathKm: number; repeatDays: number; coverageSources: string[];
  };
  parts: SpacePart[];
  origins: Record<Origin, { label: string; colour: string }>;
  dependence: { satellitesImportedPct: string; launchersImportedPct: string; what: string; source: string; progress: string; progressSource: string };
  fleet: { total: number; rows: Array<{ kind: string; n: number }>; source: string; note: string; catalogueSource: string; plan: string; planSource: string };
  places: SpacePlace[];
  /** `label` replaces the date where the date is a window, not a day. */
  timeline: Array<{ date: string; label?: string; what: string; tone: "win" | "loss" | "next"; sources: string[] }>;
  money: {
    budget: { value: number; unit: string; year: string; change: string; source: string };
    unspent: { text: string; source: string };
    economy: { now: number; nowShare: string; target: number; targetYear: number; targetShare: string; source: string; note: string };
  };
  live: { source: string; note: string };
}

/** Every source id the register cites, so a test can prove each resolves and none is idle. */
export function citedIds(d: SpacePublished): string[] {
  const n = d.nisar;
  return [
    ...n.launch.sources, n.massSource, ...n.orbit.sources, ...n.reflectorSources, n.deployed.source, n.firstLight.source,
    ...n.split.sources, ...n.coverageSources,
    ...d.parts.flatMap((p) => [...p.sources, ...(p.stat ? [p.stat.source] : [])]),
    d.dependence.source, d.dependence.progressSource, d.fleet.source, d.fleet.catalogueSource, d.fleet.planSource,
    ...d.places.map((p) => p.source), ...d.timeline.flatMap((t) => t.sources),
    d.money.budget.source, d.money.unspent.source, d.money.economy.source, d.live.source,
  ];
}

/**
 * The period of a circular orbit at this height, minutes — Kepler's third law
 * with Earth's standard gravitational parameter. Derived, and labelled so
 * wherever it is shown.
 */
export function circularPeriodMin(altKm: number): number {
  const MU = 398_600.4418, R = 6371;
  const a = R + altKm;
  return (2 * Math.PI * Math.sqrt((a * a * a) / MU)) / 60;
}

/** Orbital speed of a circular orbit at this height, km/s. Derived. */
export function circularSpeedKms(altKm: number): number {
  return Math.sqrt(398_600.4418 / (6371 + altKm));
}

/** Which part ids match a free-text search over name, group and description. */
export function searchParts(parts: SpacePart[], q: string): Set<PartId> {
  const t = q.trim().toLowerCase();
  if (!t) return new Set(parts.map((p) => p.id));
  return new Set(parts.filter((p) => `${p.name} ${p.group} ${p.does} ${p.inNisar}`.toLowerCase().includes(t)).map((p) => p.id));
}

/** Live state of one satellite, as the page shows it. Computed in the browser from public elements. */
export interface LiveState {
  name: string;
  lat: number;
  lon: number;
  altKm: number;
  speedKms: number;
  sunlit: boolean;
  epochAgeDays: number | null;
}
