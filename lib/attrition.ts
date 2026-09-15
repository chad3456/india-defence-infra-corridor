/**
 * Photographed equipment losses and military-AI evidence, read from disk.
 *
 * Server-only. Two files, two very different evidentiary standards, and this
 * module exists mainly to stop a page mixing them up.
 *
 * ── The one rule every caller inherits ───────────────────────────────────
 *
 * Oryx's own section headings are the source's claim about itself. This
 * connector's parse is a claim about the source. `total()` returns the
 * source's, because it is the citable one; `parsed()` returns ours, for
 * showing how closely a script can reproduce a hand-maintained list. Nothing
 * here returns a figure that mixes them.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* ── Oryx ───────────────────────────────────────────────────────────── */

export type Status = "destroyed" | "damaged" | "abandoned" | "captured";

export interface Stated { total: number | null; byStatus: Partial<Record<Status, number>> }

export interface Section {
  heading: string;
  category: string;
  unmanned: "uav" | "ucav" | "loitering" | null;
  stated: Stated;
  parsed: {
    total: number;
    byStatus: Record<Status, number>;
    models: number;
    attributedToAModel?: number;
    unattributed?: number;
  };
  agrees: boolean;
  why: string;
}

export interface OryxPage {
  side: string;
  what: string;
  url: string;
  ok: boolean;
  bytes: number;
  sampleItem: string;
  rollUps: Array<{ heading: string; stated: Stated }>;
  sections: Section[];
}

export interface Instance {
  side: string;
  category: string;
  model: string;
  status: Status;
  statusAsWritten: string;
  evidence: string;
}

export interface ModelTally {
  category: string;
  model: string;
  counts: Record<Status, number>;
  total: number;
}

export interface Oryx {
  present: boolean;
  builtAt: string;
  source: string;
  method: string;
  undercount: string;
  refusal: string;
  cannotSay: string[];
  counts: {
    pages: number; sections: number; sectionsAgreed: number; sectionsSuppressed: number;
    models: number; losses: number; unmannedInstances: number;
  };
  postIndex: {
    total: number; posts: number;
    unmannedPosts: Array<{ title: string; url: string; published: string }>;
    note: string;
  };
  pages: OryxPage[];
  unmannedSections: Array<Section & { side: string }>;
  tallies: ModelTally[];
  unmannedInstances: Instance[];
}

const EMPTY_ORYX: Oryx = {
  present: false, builtAt: "", source: "", method: "", undercount: "", refusal: "",
  cannotSay: [],
  counts: { pages: 0, sections: 0, sectionsAgreed: 0, sectionsSuppressed: 0, models: 0, losses: 0, unmannedInstances: 0 },
  postIndex: { total: 0, posts: 0, unmannedPosts: [], note: "" },
  pages: [], unmannedSections: [], tallies: [], unmannedInstances: [],
};

export function loadOryx(): Oryx {
  try {
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), "data/global/oryx.json"), "utf8"),
    ) as Partial<Oryx>;
    return { ...EMPTY_ORYX, ...raw, present: (raw.pages?.length ?? 0) > 0 };
  } catch {
    return EMPTY_ORYX;
  }
}

/**
 * What a side's own page says its total loss is.
 *
 * The first roll-up heading on each page — "Russia - 24098, of which…". This
 * is Oryx's figure, quoted, not a sum this project computed, and it is the
 * only number on the page that should ever be described as "Oryx records".
 */
export function statedTotal(d: Oryx, side: string): Stated | null {
  return d.pages.find((p) => p.side === side)?.rollUps[0]?.stated ?? null;
}

/** Sections of a page, most losses first, whether or not they passed. */
export function sectionsOf(d: Oryx, side: string): Section[] {
  return [...(d.pages.find((p) => p.side === side)?.sections ?? [])]
    .sort((a, b) => (b.stated.total ?? 0) - (a.stated.total ?? 0));
}

/**
 * The unmanned sections' stated totals, per side.
 *
 * The heart of this story: what a photograph-verified archive of a drone war
 * holds about drones. Taken from the headings rather than the parse so the
 * figure is the source's.
 */
export function unmannedTotal(d: Oryx, side: string): number {
  return sectionsOf(d, side)
    .filter((s) => s.unmanned !== null)
    .reduce((a, s) => a + (s.stated.total ?? 0), 0);
}

/** Instances for one side, newest-first is impossible — the source has no dates. */
export function instancesFor(d: Oryx, side: string): Instance[] {
  return d.unmannedInstances.filter((i) => i.side === side);
}

/* ── Military AI ────────────────────────────────────────────────────── */

export interface Incident {
  ref: string;
  headline: string;
  occurred: string;
  deployer: string;
  developer: string;
  system: string;
  technology: string;
  purpose: string;
  ethicalIssue: string;
  externalHarm: string;
  harmStatus: string;
  impactedArea: string;
  matched: string[];
  /** force: an armed force or ministry deployed it. state: a government. adjacent: neither. */
  tier: "force" | "state" | "adjacent";
  links: string[];
}

export interface Tally { key: string; n: number }

export interface SpendingSeries {
  term: string;
  ok: boolean;
  years: Array<{ year: number; amount: number }>;
  error?: string;
}

export interface MilitaryAi {
  present: boolean;
  builtAt: string;
  sources: { incidents: string; spending: string };
  definition: string;
  doubleCounting: string;
  tiers: string;
  refusal: string;
  cannotSay: string[];
  militaryFilter: string;
  incidents: {
    header: string[];
    totalRows: number;
    droppedRows: number;
    note: string;
    matched: number;
    byDeployer: Tally[];
    byTechnology: Tally[];
    byHarmStatus: Tally[];
    byTier: { force: number; state: number; adjacent: number };
    byYear: Tally[];
    rows: Incident[];
  };
  spending: SpendingSeries[];
}

const EMPTY_AI: MilitaryAi = {
  present: false, builtAt: "",
  sources: { incidents: "", spending: "" },
  definition: "", doubleCounting: "", tiers: "", refusal: "", cannotSay: [], militaryFilter: "",
  incidents: {
    header: [], totalRows: 0, droppedRows: 0, note: "", matched: 0,
    byDeployer: [], byTechnology: [], byHarmStatus: [],
    byTier: { force: 0, state: 0, adjacent: 0 }, byYear: [], rows: [],
  },
  spending: [],
};

export function loadMilitaryAi(): MilitaryAi {
  try {
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), "data/global/military-ai.json"), "utf8"),
    ) as Partial<MilitaryAi>;
    return {
      ...EMPTY_AI, ...raw,
      incidents: { ...EMPTY_AI.incidents, ...(raw.incidents ?? {}) },
      present: (raw.spending?.length ?? 0) > 0 || (raw.incidents?.matched ?? 0) > 0,
    };
  } catch {
    return EMPTY_AI;
  }
}

/**
 * One term's series. Never a sum across terms.
 *
 * An award whose description contains both "artificial intelligence" and
 * "machine learning" is in both series, so adding them double-counts. The
 * connector refuses to publish a combined total and this module gives no way
 * to compute one by accident.
 */
export function series(d: MilitaryAi, term: string): SpendingSeries | undefined {
  return d.spending.find((s) => s.term === term);
}

export function seriesTotal(s: SpendingSeries | undefined): number {
  return s?.years.reduce((a, b) => a + b.amount, 0) ?? 0;
}

/** Incidents an armed force or a government is recorded as having deployed. */
export function byTier(d: MilitaryAi, tier: Incident["tier"]): Incident[] {
  return d.incidents.rows.filter((r) => r.tier === tier);
}

/** Incidents whose harm the register records as having actually occurred. */
export function occurred(d: MilitaryAi): Incident[] {
  return d.incidents.rows.filter((r) => /occurr|happened|realis|materialis/i.test(r.harmStatus));
}

/** US dollars, as these pages print them. */
export function usd(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(abs >= 1e10 ? 0 : 2)}bn`;
  if (abs >= 1e6) return `$${Math.round(v / 1e6)}m`;
  if (abs >= 1e3) return `$${Math.round(v / 1e3)}k`;
  return `$${Math.round(v)}`;
}
