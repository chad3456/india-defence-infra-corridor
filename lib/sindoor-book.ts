/**
 * Reader for the verified Sindoor book record.
 *
 * The connector that writes this file checks every fact against the book
 * before publishing it and fails if one no longer matches. Nothing here
 * re-checks that; the guarantee lives at write time, and a page that tried to
 * re-verify at render time would need the book in the deployment, which is the
 * one thing that must not ship.
 *
 * What this does enforce is the boundary. There is no function returning a
 * casualty figure, an aircraft-loss count, or a total of anything either
 * government claims about the other, because the file does not carry one and a
 * helper that looked like it might would eventually be given one.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const BOOK_PATH = join(process.cwd(), "data", "defence", "sindoor-book.json");
const FRAMES_PATH = join(process.cwd(), "public", "sindoor", "frames.json");

export type Tier = "india-official" | "author" | "pakistan-concession" | "third-party" | "contested";

export interface Cited { chapter: string; page: number | null }

export interface Target extends Cited {
  id: string; name: string; town: string;
  region: "PoJK" | "Pakistani Punjab";
  depthKm: number | null;
  agency: "IAF" | "Army";
  group: string; what: string;
  position: { lat: number; lon: number } | null;
}

export interface Site extends Cited {
  id: string; name: string; kind: string; tier: Tier;
  position: { lat: number; lon: number } | null;
}

export interface Beat extends Cited {
  id: string; date: string; label: string; what: string; tier: Tier;
}

export interface Weapon extends Cited {
  id: string; name: string; kind: string; origin: string; note: string;
}

export interface Dispute extends Cited {
  id: string; question: string; indiaSays: string; note: string;
}

export interface SindoorBook {
  present: boolean;
  builtAt: string;
  book: { title: string; author: string; publisher: string; year: number; note: string };
  method: string;
  refusal: string;
  tiers: Record<string, string>;
  cannotSay: string[];
  counts: {
    targets: number; airbases: number; beats: number; weapons: number; disputes: number;
    placed: number; unplaced: number; byTier: Record<string, number>;
  };
  targets: Target[];
  airbases: Site[];
  beats: Beat[];
  weapons: Weapon[];
  disputes: Dispute[];
}

const EMPTY: SindoorBook = {
  present: false, builtAt: "",
  book: { title: "", author: "", publisher: "", year: 0, note: "" },
  method: "", refusal: "", tiers: {}, cannotSay: [],
  counts: { targets: 0, airbases: 0, beats: 0, weapons: 0, disputes: 0, placed: 0, unplaced: 0, byTier: {} },
  targets: [], airbases: [], beats: [], weapons: [], disputes: [],
};

function read<T extends object>(path: string, empty: T): T {
  try {
    return { ...JSON.parse(readFileSync(path, "utf8")), present: true } as T;
  } catch {
    return empty;
  }
}

export function loadSindoorBook(): SindoorBook { return read(BOOK_PATH, EMPTY); }

export interface Frames {
  present: boolean;
  note: string;
  frames: string[];
  sitesInFrame: Array<{ id: string; name: string; kind?: string }>;
}

const EMPTY_FRAMES: Frames = { present: false, note: "", frames: [], sitesInFrame: [] };

/**
 * Which rendered frames exist.
 *
 * Read from the render's own manifest rather than from a list in the page,
 * so a page cannot ask for a frame that was never rendered — which shows up
 * as a broken image on a published page and as nothing at all in a test.
 */
export function loadFrames(): Frames { return read(FRAMES_PATH, EMPTY_FRAMES); }

/** Targets by which service the book says struck them. */
export function byAgency(b: SindoorBook): { IAF: Target[]; Army: Target[] } {
  return {
    IAF: b.targets.filter((t) => t.agency === "IAF"),
    Army: b.targets.filter((t) => t.agency === "Army"),
  };
}

/** Beats in date order, which is not the order they are curated in. */
export function inOrder(b: SindoorBook): Beat[] {
  return [...b.beats].sort((x, y) => x.date.localeCompare(y.date));
}

/**
 * The claims that cost their speaker something.
 *
 * Kept as its own accessor because it is the only tier on this subject that a
 * reader should weight heavily, and a page should have to ask for it by name
 * rather than find it mixed into a list.
 */
export function concessions(b: SindoorBook): Beat[] {
  return b.beats.filter((x) => x.tier === "pakistan-concession");
}
