/**
 * Readers for the Sindoor timeline and the story register.
 *
 * Two separate files with two separate failure modes, loaded independently so
 * that a missing one leaves the other page standing.
 *
 * Neither reader computes a total, a casualty figure or a verdict. The Sindoor
 * file is a record of statements with their claimants attached, and any
 * function here that merged the two national accounts into one sequence would
 * be used — so there is none.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type { Claimant, SindoorEntry } from "./warroom-shared";
export { CLAIMANT_TONE, CLAIMANT_LABEL } from "./warroom-shared";
import type { Claimant, SindoorEntry } from "./warroom-shared";

export interface Sindoor {
  present: boolean;
  builtAt: string;
  source: string;
  method: string;
  refusal: string;
  cannotSay: string[];
  counts: {
    entries: number; duplicatesDropped: number; withCitation: number;
    yearInferred: number; reported: number; days: number;
    byClaimant: Record<Claimant, number>;
  };
  perPage: Array<{ page: string; ok: boolean; sections: number; sentences: number; dated: number; withCitation: number }>;
  days: Array<{ date: string; n: number }>;
  entries: SindoorEntry[];
}

export interface Story {
  id: string;
  headline: string;
  firstSeen: string;
  lastSeen: string;
  themes: string[];
  countries: Array<{ iso: string; name: string }>;
  sources: Array<{ outlet: string; url: string; published: string }>;
}

export interface Warstories {
  present: boolean;
  builtAt: string;
  source: string;
  method: string;
  refusal: string;
  engineNote: string;
  cannotSay: string[];
  counts: {
    stories: number; createdThisRun: number; corroboratedThisRun: number;
    feedsAnswered: number; feedsTried: number; itemsSeen: number;
    corroboration: { one: number; two: number; threePlus: number };
  };
  byTheme: Array<{ id: string; label: string; n: number }>;
  byCountry: Array<{ iso: string; name: string; n: number }>;
  feeds: Array<{ outlet: string; ok: boolean; items: number; kept: number; error?: string }>;
  stories: Story[];
}

/*
 * Paths are built from literal segments, not from a variable.
 *
 * The first version took a relative path as an argument and joined it to
 * `process.cwd()`. The bundler cannot statically scope that, so it traced the
 * entire project — every source file and the whole public folder — into the
 * server output, and said so. Two constants cost nothing and keep the trace
 * to the two files actually read.
 */
const SINDOOR_PATH = join(process.cwd(), "data", "defence", "sindoor.json");
const STORIES_PATH = join(process.cwd(), "data", "global", "warstories.json");

function read<T extends object>(path: string, empty: T): T {
  try {
    return { ...JSON.parse(readFileSync(path, "utf8")), present: true } as T;
  } catch {
    return empty;
  }
}

const EMPTY_SINDOOR: Sindoor = {
  present: false, builtAt: "", source: "", method: "", refusal: "", cannotSay: [],
  counts: {
    entries: 0, duplicatesDropped: 0, withCitation: 0, yearInferred: 0, reported: 0, days: 0,
    byClaimant: { India: 0, Pakistan: 0, "third-party": 0, unattributed: 0 },
  },
  perPage: [], days: [], entries: [],
};

const EMPTY_STORIES: Warstories = {
  present: false, builtAt: "", source: "", method: "", refusal: "", engineNote: "", cannotSay: [],
  counts: {
    stories: 0, createdThisRun: 0, corroboratedThisRun: 0,
    feedsAnswered: 0, feedsTried: 0, itemsSeen: 0,
    corroboration: { one: 0, two: 0, threePlus: 0 },
  },
  byTheme: [], byCountry: [], feeds: [], stories: [],
};

export function loadSindoor(): Sindoor { return read(SINDOOR_PATH, EMPTY_SINDOOR); }
export function loadStories(): Warstories { return read(STORIES_PATH, EMPTY_STORIES); }


/* ── The AI incident register ────────────────────────────────────────── */

export interface AiIncident {
  ref: string;
  headline: string;
  /** force = an armed service or ministry; state = a government; adjacent = neither. */
  tier: "force" | "state" | "adjacent";
  occurred: string;
  deployer: string;
  developer: string;
  system: string;
  technology: string;
  purpose: string;
  links: string[];
}

export interface MilitaryAi {
  present: boolean;
  builtAt: string;
  sources: { incidents?: string; spending?: string };
  definition: string;
  refusal: string;
  cannotSay: string[];
  incidents: {
    totalRows: number;
    matched: number;
    byTier: { force: number; state: number; adjacent: number };
    byYear: Array<{ key: string; n: number }>;
    byDeployer: Array<{ key: string; n: number }>;
    byTechnology: Array<{ key: string; n: number }>;
    rows: AiIncident[];
  };
  spending: Array<{ term: string; ok: boolean; years: Array<{ year: number; amount: number }> }>;
}

const MILITARY_AI_PATH = join(process.cwd(), "data", "global", "military-ai.json");

const EMPTY_AI: MilitaryAi = {
  present: false, builtAt: "", sources: {}, definition: "", refusal: "", cannotSay: [],
  incidents: {
    totalRows: 0, matched: 0, byTier: { force: 0, state: 0, adjacent: 0 },
    byYear: [], byDeployer: [], byTechnology: [], rows: [],
  },
  spending: [],
};

export function loadMilitaryAi(): MilitaryAi { return read(MILITARY_AI_PATH, EMPTY_AI); }

/**
 * Which country a deployer belongs to, where the name says so.
 *
 * AIAAIC carries no country column — only a named deployer, which may be an
 * armed service, a ministry, a university or a company. So a country is
 * assigned only where the organisation's name contains one, and everything
 * else is left unassigned and counted.
 *
 * That leaves a thin and lopsided picture, which is the honest one: 23 of the
 * register's 55 military-matching rows name a force or a state at all, and a
 * country chart built on the other 32 would be a chart about which companies
 * happen to be named after places.
 */
const DEPLOYER_COUNTRY: Array<{ iso: string; name: string; re: RegExp }> = [
  { iso: "ISR", name: "Israel", re: /israel|idf\b/i },
  { iso: "CHN", name: "China", re: /\bchina|chinese|\bPLA\b|national university of defense technology|sensetime|megvii|hikvision|dahua/i },
  { iso: "USA", name: "United States", re: /united states|\bUS\b|u\.s\.|pentagon|department of defense|darpa|\bCIA\b|\bNSA\b|air force|army|navy|marine/i },
  { iso: "RUS", name: "Russia", re: /russia|kalashnikov|rostec/i },
  { iso: "UKR", name: "Ukraine", re: /ukrain/i },
  { iso: "GBR", name: "United Kingdom", re: /united kingdom|britain|british|\bMoD\b|royal air force|royal navy/i },
  { iso: "IND", name: "India", re: /\bindia|drdo|hindustan aeronautics/i },
  { iso: "IRN", name: "Iran", re: /iran/i },
  { iso: "TUR", name: "Türkiye", re: /turkey|türkiye|baykar|bayraktar|stm\b/i },
  { iso: "KOR", name: "South Korea", re: /south korea|hanwha|dodaam/i },
  { iso: "AUS", name: "Australia", re: /australia/i },
  { iso: "FRA", name: "France", re: /france|french|thales|dassault/i },
];

export function countryOfDeployer(deployer: string): { iso: string; name: string } | null {
  const hit = DEPLOYER_COUNTRY.find((c) => c.re.test(deployer));
  return hit ? { iso: hit.iso, name: hit.name } : null;
}
