/**
 * India's tunnel boring machines (/tbm): the shape of the sourced register in
 * data/tbm/published.json, shared by the page, the 3D stage and the tests.
 * No node imports.
 *
 * Every figure in the register is quoted from the report it came from. News
 * reporting is the evidence here because no official register of TBMs in India
 * exists; each figure therefore carries its outlet, and where two outlets
 * disagree both are given. Nothing on the page is estimated.
 */

export interface TbmSource { id: string; publisher: string; title: string; url: string; published: string | null; accessed: string; tier: 1 | 2 | 3; provenance: "official" | "press" | "think-tank" | "multilateral" | "derived" }
export interface TbmClaim { id: string; claim: string; who: string; date: string; quote: string; sources: string[]; status: "stated" | "confirmed" | "reported"; check: string }
export type Origin = "india-assembled" | "china-built" | "unstated";
export interface TbmMachine { id: string; name: string; project: string; place: string; diameter: number | null; count: number | null; type: string; maker: string; builtIn: string; origin: Origin; status: string; date: string | null; sources: string[]; quote: string; notes?: string }
export interface TbmMaker { id: string; name: string; what: string; place: string | null; sources: string[] }
export type PartOrigin = "india" | "imported" | "mixed" | "unreported";
export interface TbmPart { id: string; name: string; does: string; india: string; where: PartOrigin }
export interface TbmEvent { date: string; what: string; sources: string[]; future?: boolean }
export interface TbmPublished {
  about: string;
  accessed: string;
  sources: TbmSource[];
  claims: TbmClaim[];
  controls: { announced: string; effective: string; by: string; covers: string; licence: string; threshold: string; sources: string[]; quote: string };
  machines: TbmMachine[];
  makers: TbmMaker[];
  parts: TbmPart[];
  timeline: TbmEvent[];
  trade: { label: string; rows: Array<{ year: string; value: number }>; sources: string[]; quote: string; caveat: string; context: string[] };
  searches: string[];
}

/** The parts in the order the stage draws them, front of the machine first. */
export const PART_ORDER = ["cutterhead", "drive", "shield", "thrust", "erector", "muck", "backup"] as const;
export type PartId = (typeof PART_ORDER)[number];

/** Where a place sits on the stage's map: from the site gazetteer, passed in by the page. */
export interface StagePlace { id: string; name: string; lon: number; lat: number }

/** Everything the 3D stage draws, already sourced and worded by the page. */
export interface TbmStageData {
  outline: Array<[number, number]>;
  borders: Array<[number, number]>;
  places: StagePlace[];
  /** Machines reported at each place: one bead each. `floor` marks a count that is a minimum. */
  beads: Array<{ place: string; count: number | null; floor: boolean; label: string }>;
  /** Diameters drawn to scale, in metres, each with the label the page gives it. */
  rings: Array<{ d: number; label: string; kind: "built" | "stated" | "target" | "planned" }>;
  parts: Array<{ id: PartId; name: string; where: PartOrigin }>;
}

/** What /api/tbm returns. Headlines are pointers to reporting, never figures. */
export interface TbmLive { fetchedAt: string; ok: boolean; headlines: Array<{ title: string; outlet: string; url: string; published: string | null; lang: string }> }

/** A TBM-related headline: India and a tunnelling term, so a "TBM" in another sense is dropped. */
export const isTbmHeadline = (t: string) =>
  /tunnel boring|\bTBMs?\b|टनल बोरिंग|सुरंग/i.test(t) && /india|indian|mumbai|delhi|chennai|kolkata|bengaluru|metro|bullet train|rail|beml|vaishnaw|herrenknecht|भारत|मुंबई|दिल्ली|चेन्नई|कोलकाता|मेट्रो|रेल/i.test(t);
