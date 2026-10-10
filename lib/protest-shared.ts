/**
 * Types for the protest tracker at /protests/delhi-2026-10-10. No node
 * imports: the connector, the loader and the page all read them.
 *
 * The record is a set of attributed accounts, not an account. `voice` says
 * whose claim each one is; the page keeps the voices apart and never merges
 * them into a single narrative of what happened.
 */

export interface ProtestSource { publisher: string; title: string; url: string }

export type Voice = "police" | "government" | "organisers" | "opposition" | "rights" | "courts";

export interface ProtestAccount { voice: Voice; who: string; date: string; text: string; sources: string[] }

export interface ProtestPlace {
  id: string;
  name: string;
  lon: number;
  lat: number;
  kind: "protest" | "detention" | "restriction";
  radiusKm?: number;
  summary: string;
  sources: string[];
}

export interface ProtestCount { figure: number | null; label: string; scope: string; who: string; sources: string[] }

export interface ProtestRecord {
  id: string;
  title: string;
  about: string;
  accessed: string;
  demand: string;
  sources: Record<string, ProtestSource>;
  places: ProtestPlace[];
  counts: ProtestCount[];
  noOfficialCount: string;
  restrictions: Array<{ id: string; what: string; detail: string; sources: string[] }>;
  accounts: ProtestAccount[];
  timeline: Array<{ date: string; time?: string; what: string; sources: string[] }>;
}

export interface WireItem {
  title: string;
  publisher: string;
  url: string;
  publishedAt: string;
  /** The queries that returned this headline. */
  queries: string[];
}

export interface ProtestWire {
  updatedAt: string;
  source: string;
  queries: Array<{ q: string; returned: number; kept: number; error?: string }>;
  items: WireItem[];
}
