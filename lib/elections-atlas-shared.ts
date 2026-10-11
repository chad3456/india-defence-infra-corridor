/**
 * Types for the election atlas (/elections/atlas). No node imports: the
 * connectors, loaders and client components all read them.
 */

/** The national alliance a state's governing party sits in. */
export type Alliance = "NDA" | "INDIA" | "Other" | "None";

export interface Governs {
  /** State or UT name as this site's boundary file spells it. */
  state: string;
  chiefMinister: string;
  party: string;
  alliance: Alliance;
  /** The state-level coalition name, where there is one (UDF, Kutami, NEDA …). */
  stateAlliance: string;
  cmConstituency: string;
  /** Year of the assembly election that produced the current government. */
  election: number | null;
}

export interface GovernsFile {
  fetchedAt: string;
  source: { publisher: string; title: string; url: string };
  states: Governs[];
  /** States and UTs with no legislature, governed by the Centre through an administrator. */
  noLegislature: string[];
}

/* ── SIR ── */
export type SirReason = "dead" | "shifted" | "absent" | "shiftedOrAbsent" | "duplicate" | "other";

export interface SirStage {
  date?: string;
  electors?: number;
  approx?: boolean;
  leftOut?: number;
  leftOutApprox?: boolean;
  reasons?: Partial<Record<SirReason, number>>;
  added?: number;
  removedAfterDraft?: number;
  removedAfterDraftReasons?: Partial<Record<SirReason, number>>;
  netRemoved?: number;
  note?: string;
  sources: string[];
}

export interface SirState { state: string; phase: string; before?: SirStage; draft?: SirStage; final?: SirStage }

export interface SirFile {
  about: string;
  accessed: string;
  reasons: Array<{ id: SirReason; label: string }>;
  phases: Array<{ id: string; label: string; coverage: string; ordered: string; note: string; sources: string[] }>;
  sources: Record<string, { publisher: string; title: string; url: string }>;
  states: SirState[];
}

/* ── States ── */
export interface AtlasState {
  slug: string;
  /** The name pages use. */
  name: string;
  /** Polygon name(s) in data/geo/india-states.topo.json, which predates the 2019 and 2020 boundary changes. */
  topo: string[];
  /** ECI's state code on its results pages (S04 = Bihar …). */
  eci: string;
  legislature: boolean;
}

/**
 * Every state and UT the atlas shows. ECI codes are the ones its results
 * portal uses in page names; Jammu and Kashmir has been U08 since 2019, and
 * Ladakh (U09) is drawn inside it because the boundary file is older than the split.
 */
export const ATLAS_STATES: AtlasState[] = [
  ["andhra-pradesh", "Andhra Pradesh", "Andhra Pradesh", "S01", true],
  ["arunachal-pradesh", "Arunachal Pradesh", "Arunanchal Pradesh", "S02", true],
  ["assam", "Assam", "Assam", "S03", true],
  ["bihar", "Bihar", "Bihar", "S04", true],
  ["goa", "Goa", "Goa", "S05", true],
  ["gujarat", "Gujarat", "Gujarat", "S06", true],
  ["haryana", "Haryana", "Haryana", "S07", true],
  ["himachal-pradesh", "Himachal Pradesh", "Himachal Pradesh", "S08", true],
  ["karnataka", "Karnataka", "Karnataka", "S10", true],
  ["kerala", "Kerala", "Kerala", "S11", true],
  ["madhya-pradesh", "Madhya Pradesh", "Madhya Pradesh", "S12", true],
  ["maharashtra", "Maharashtra", "Maharashtra", "S13", true],
  ["manipur", "Manipur", "Manipur", "S14", true],
  ["meghalaya", "Meghalaya", "Meghalaya", "S15", true],
  ["mizoram", "Mizoram", "Mizoram", "S16", true],
  ["nagaland", "Nagaland", "Nagaland", "S17", true],
  ["odisha", "Odisha", "Odisha", "S18", true],
  ["punjab", "Punjab", "Punjab", "S19", true],
  ["rajasthan", "Rajasthan", "Rajasthan", "S20", true],
  ["sikkim", "Sikkim", "Sikkim", "S21", true],
  ["tamil-nadu", "Tamil Nadu", "Tamil Nadu", "S22", true],
  ["tripura", "Tripura", "Tripura", "S23", true],
  ["uttar-pradesh", "Uttar Pradesh", "Uttar Pradesh", "S24", true],
  ["west-bengal", "West Bengal", "West Bengal", "S25", true],
  ["chhattisgarh", "Chhattisgarh", "Chhattisgarh", "S26", true],
  ["jharkhand", "Jharkhand", "Jharkhand", "S27", true],
  ["uttarakhand", "Uttarakhand", "Uttarakhand", "S28", true],
  ["telangana", "Telangana", "Telangana", "S29", true],
  ["andaman-and-nicobar-islands", "Andaman and Nicobar Islands", "Andaman & Nicobar Island", "U01", false],
  ["chandigarh", "Chandigarh", "Chandigarh", "U02", false],
  ["dadra-nagar-haveli-daman-diu", "Dadra and Nagar Haveli and Daman and Diu", "Dadara & Nagar Havelli|Daman & Diu", "U03", false],
  ["delhi", "Delhi", "NCT of Delhi", "U05", true],
  ["lakshadweep", "Lakshadweep", "Lakshadweep", "U06", false],
  ["puducherry", "Puducherry", "Puducherry", "U07", true],
  ["jammu-and-kashmir", "Jammu and Kashmir", "Jammu & Kashmir", "U08", true],
  ["ladakh", "Ladakh", "Jammu & Kashmir", "U09", false],
].map(([slug, name, topo, eci, legislature]) => ({ slug, name, topo: String(topo).split("|"), eci, legislature } as AtlasState));

/** The atlas state a polygon of the boundary file is drawn for. Ladakh shares J&K's polygon, so J&K is returned. */
export function stateForPolygon(polygon: string): AtlasState | undefined {
  return ATLAS_STATES.find((s) => s.legislature && s.topo.includes(polygon)) ?? ATLAS_STATES.find((s) => s.topo.includes(polygon));
}
export function atlasStateByEci(code: string): AtlasState | undefined {
  return ATLAS_STATES.find((s) => s.eci === code);
}

const norm = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/^nct of /, "").replace(/[^a-z]/g, "");
const BY_NORM = new Map(ATLAS_STATES.map((s) => [norm(s.name), s]));

/** Resolve any of the spellings the sources use ("NCT of Delhi", "Keralam" is aliased upstream) to an atlas state. */
export function atlasState(name: string): AtlasState | undefined {
  return BY_NORM.get(norm(name));
}
export function atlasStateBySlug(slug: string): AtlasState | undefined {
  return ATLAS_STATES.find((s) => s.slug === slug);
}

/** The sum of the reasons given for a SIR stage, and how far short of (or over) the stated total it falls. */
export function reasonGap(stage: SirStage | undefined): { attributed: number; unattributed: number } | null {
  if (!stage?.reasons || stage.leftOut == null) return null;
  const attributed = Object.values(stage.reasons).reduce((a, b) => a + (b ?? 0), 0);
  return { attributed, unattributed: stage.leftOut - attributed };
}

/* ── Results, seat by seat ── */
export type House = "AC" | "PC";

export interface Candidate {
  name: string;
  party: string;
  /** Total votes, as ECI prints them (EVM plus postal). */
  votes: number;
  evm?: number;
  postal?: number;
}

export interface Seat {
  no: number;
  name: string;
  /** Candidates in ECI's order, NOTA included as party "None of the Above". */
  candidates: Candidate[];
  /** The archived ECI page this seat was read from. */
  url: string;
  /** Wayback timestamp of that page (yyyymmddhhmmss). */
  snapshot: string;
  /** ECI's own status line, when the page carries one ("Result Declared" …). */
  status?: string;
}

export interface StateResult {
  folder: string;
  house: House;
  /** ECI state code. */
  state: string;
  label: string;
  /** Counting day. */
  date: string;
  seats: Seat[];
  /** Seats in the house for this state, where ECI's page listing says so. */
  expectedSeats?: number;
  /** Party tally from ECI's own party-wise page, kept as a cross-check of the seats above. */
  partyTally?: Array<{ party: string; won: number }>;
  fetchedAt: string;
}

export interface ElectionIndexEntry {
  folder: string;
  house: House;
  label: string;
  date: string;
  /** ECI state code → seats read. */
  states: Record<string, number>;
}

/**
 * The site's first three categorical slots, which pass its colour checks in
 * both themes. Alliance, not party: a state's map colour says which side of
 * national politics its government sits on.
 */
export const ALLIANCE_COLOUR: Record<Alliance, string> = {
  NDA: "var(--series-2)",
  INDIA: "var(--series-1)",
  Other: "var(--series-3)",
  None: "var(--series-3)",
};
export const ALLIANCE_LABEL: Record<Alliance, string> = {
  NDA: "NDA",
  INDIA: "INDIA bloc",
  Other: "Neither alliance",
  None: "Neither alliance",
};

/** Indian number words, for large counts in prose and labels. */
export const lakh = (n: number) => (n >= 1e7 ? `${(n / 1e7).toFixed(2)} crore` : n >= 1e5 ? `${(n / 1e5).toFixed(1)} lakh` : n.toLocaleString("en-IN"));
