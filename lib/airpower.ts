/**
 * Reading the three airpower files, and the one join the page is allowed.
 *
 * The bases, the inventories and the live feed are three separate sources with
 * three separate failure modes, and each is loaded independently so that one
 * missing file leaves the other two sections standing rather than blanking the
 * page.
 *
 * The join this module does NOT provide is base-to-aircraft. Nothing in any of
 * the three sources supports it — the inventories are national totals and the
 * live feed sees a few hundred aircraft worldwide — and a function here that
 * offered it would be used.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "data", "defence");

export interface Airbase {
  osm: string;
  name: string;
  iso: string | null;
  country: string | null;
  lat: number;
  lon: number;
  operator: string | null;
  kind: "military-airfield" | "joint-use";
  icao: string | null;
}

export interface Airframe {
  iso: string;
  country: string;
  force: string;
  type: string;
  origin: string;
  role: string;
  variant: string;
  inService: number | null;
  inServiceRaw: string;
}

export interface ForceRow {
  iso: string; country: string; force: string;
  /** Which Wikipedia title actually answered, so a rename is visible. */
  page: string;
  types: number; counted: number; unreadable: number;
  /** -1 when the parse was too partial to publish a total. */
  total: number;
  tablesRead: number; tablesSkipped: number;
}

export interface TrafficSnapshot {
  at: string;
  perFeed: Array<{ id: string; ok: boolean; aircraft: number; withPosition: number; error?: string }>;
  agreement: { both: number; onlyFirst: number; onlySecond: number } | null;
  aircraft: number;
  byRegion: Array<{ region: string; n: number }>;
  byType: Array<{ type: string; n: number }>;
  points: Array<[number, number]>;
}

export interface Bases {
  present: boolean;
  builtAt: string;
  source: string;
  method: string;
  refusal: string;
  cannotSay: string[];
  counts: {
    airfields: number; jointUse: number; countries: number;
    withIcao: number; unplaced: number; outsideBox: number; boxesFailed: number;
  };
  byCountry: Array<{ iso: string; country: string; n: number; jointUse: number }>;
  bases: Airbase[];
}

export interface Inventory {
  present: boolean;
  builtAt: string;
  source: string;
  method: string;
  refusal: string;
  cannotSay: string[];
  counts: { forces: number; types: number; counted: number; unreadable: number; totalsWithheld: number; failed: number };
  perForce: ForceRow[];
  airframes: Airframe[];
}

export interface Traffic {
  present: boolean;
  builtAt: string;
  source: string;
  method: string;
  refusal: string;
  cannotSay: string[];
  keptSnapshots: number;
  snapshots: TrafficSnapshot[];
}

function read<T extends object>(file: string, empty: T): T {
  try {
    return { ...JSON.parse(readFileSync(join(DIR, file), "utf8")), present: true } as T;
  } catch {
    return empty;
  }
}

const EMPTY_BASES: Bases = {
  present: false, builtAt: "", source: "", method: "", refusal: "", cannotSay: [],
  counts: { airfields: 0, jointUse: 0, countries: 0, withIcao: 0, unplaced: 0, outsideBox: 0, boxesFailed: 0 },
  byCountry: [], bases: [],
};
const EMPTY_INVENTORY: Inventory = {
  present: false, builtAt: "", source: "", method: "", refusal: "", cannotSay: [],
  counts: { forces: 0, types: 0, counted: 0, unreadable: 0, totalsWithheld: 0, failed: 0 },
  perForce: [], airframes: [],
};
const EMPTY_TRAFFIC: Traffic = {
  present: false, builtAt: "", source: "", method: "", refusal: "", cannotSay: [],
  keptSnapshots: 0, snapshots: [],
};

export function loadBases(): Bases { return read("airbases.json", EMPTY_BASES); }
export function loadInventory(): Inventory { return read("air-inventory.json", EMPTY_INVENTORY); }
export function loadTraffic(): Traffic { return read("mil-traffic.json", EMPTY_TRAFFIC); }

/**
 * Where an aircraft was designed, in buckets a reader can hold in their head.
 *
 * The origin cell is free text after markup is stripped — "Soviet Union",
 * "Soviet Union / Russia", "United States", "India", "France/Germany/Spain".
 * Grouping it is a judgement, and the judgement made here is the coarse one:
 * which bloc supplied the airframe, because that is the question a fleet's
 * origin mix is usually asked to answer.
 *
 * Two rules keep it honest. Soviet and Russian origin are one bucket, because
 * an Su-30 is the same supply relationship whichever state signed the first
 * contract, and splitting them would make every post-Soviet fleet look
 * diversified. And anything unrecognised goes to `other` and is COUNTED — a
 * bucket that quietly absorbs failures is how an origin chart comes to be
 * about the classifier rather than about the fleet.
 */
export type Origin = "domestic" | "russian" | "western" | "chinese" | "other";

export function originOf(cell: string, countryIso: string): Origin {
  const s = cell.toLowerCase();
  const home: Record<string, RegExp> = {
    IND: /\bindia\b/, PAK: /\bpakistan\b/, CHN: /\bchina\b/, RUS: /\brussia|soviet\b/,
    USA: /united states|\busa\b|\bu\.s\./, GBR: /united kingdom|britain|\buk\b/,
    FRA: /\bfrance\b/, ISR: /\bisrael\b/, JPN: /\bjapan\b/, KOR: /south korea|republic of korea/,
    TUR: /turkey|türkiye/, BRA: /\bbrazil\b/, IDN: /indonesia/, BGD: /bangladesh/,
  };
  const mine = home[countryIso];
  if (mine && mine.test(s)) return "domestic";
  if (/soviet|russia|ussr/.test(s)) return "russian";
  if (/china|prc\b/.test(s)) return "chinese";
  if (/united states|\busa\b|\bu\.s\.|france|germany|italy|spain|united kingdom|britain|sweden|netherlands|canada|brazil|israel|switzerland|poland|czech|europe/.test(s)) {
    return "western";
  }
  return "other";
}

/** The origin mix of one force, as counts of airframes with a readable quantity. */
export function originMix(
  airframes: Airframe[],
  iso: string,
): { counts: Record<Origin, number>; unreadable: number } {
  const counts: Record<Origin, number> = { domestic: 0, russian: 0, western: 0, chinese: 0, other: 0 };
  let unreadable = 0;
  for (const a of airframes) {
    if (a.iso !== iso) continue;
    if (a.inService === null) { unreadable++; continue; }
    counts[originOf(a.origin, iso)] += a.inService;
  }
  return { counts, unreadable };
}

/** The most recent snapshot, or null when none has been taken. */
export function latestSnapshot(t: Traffic): TrafficSnapshot | null {
  return t.snapshots.length > 0 ? (t.snapshots[t.snapshots.length - 1] ?? null) : null;
}

/**
 * The fleet totals this page is willing to print.
 *
 * A force whose total was withheld by the connector is excluded here rather
 * than shown as zero or as a dash in a ranking — a bar chart with a gap in it
 * invites the reader to fill the gap in, and the number they will guess is
 * worse than the absence.
 */
export function printableTotals(inv: Inventory): ForceRow[] {
  return inv.perForce.filter((f) => f.total >= 0).sort((a, b) => b.total - a.total);
}
