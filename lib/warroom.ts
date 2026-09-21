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

