/**
 * Reading the welfare scheme record from disk.
 *
 * Server-only: imports node:fs.
 *
 * ── What the shape of this record says ───────────────────────────────────
 *
 * A long roster and an almost-empty coverage column. That is not an
 * unfinished dataset; it is what Indian scheme dashboards publish. Eight
 * sources were asked and named their refusals: the government's own myScheme
 * directory answered 401, PMAY-Gramin and Mission Antyodaya and Saubhagya and
 * the MGNREGA report server refused at the connection, Swachh Bharat returned
 * 404, PM-KISAN served a stub, and data.gov.in wants a key.
 *
 * So a page built on this must lead with the gap rather than bury it, and must
 * never fill a coverage cell from anywhere the connector did not read.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Grain = "household" | "village" | "beneficiary-count" | "state-aggregate";

export interface Scheme {
  name: string;
  sector: string | null;
  launched: number | null;
  article: string | null;
}

export interface CoverageRow {
  scheme: string;
  grain: Grain;
  state: string;
  measure: string;
  value: number;
  of: number | null;
  asOf: string | null;
  source: string;
}

export interface WelfareRecord {
  present: boolean;
  builtAt: string | null;
  rosterSource: string;
  coverageNote: string;
  fourGrains: string;
  launchYearNote: string;
  schemeCount: number;
  sectorCount: number;
  coverageRows: number;
  schemesWithCoverage: number;
  bySector: Array<{ sector: string; schemes: number }>;
  refused: Array<{ source: string; why: string }>;
  schemes: Scheme[];
  coverage: CoverageRow[];
}

const EMPTY: WelfareRecord = {
  present: false, builtAt: null, rosterSource: "", coverageNote: "", fourGrains: "",
  launchYearNote: "", schemeCount: 0, sectorCount: 0, coverageRows: 0, schemesWithCoverage: 0,
  bySector: [], refused: [], schemes: [], coverage: [],
};

export function loadWelfare(): WelfareRecord {
  try {
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), "data/schemes/welfare.json"), "utf8"),
    ) as Partial<WelfareRecord>;
    return { ...EMPTY, ...raw, present: (raw.schemes?.length ?? 0) > 0 };
  } catch {
    return EMPTY;
  }
}

/**
 * Central schemes and state schemes, told apart by the heading they sat under.
 *
 * The article files central schemes in a table under "List" and state schemes
 * in bulleted sections named for the state. That distinction matters more than
 * any other on the page: a central scheme runs everywhere and a state scheme
 * runs in one state, and a roster that mixes them implies a national programme
 * where there is a regional one.
 */
const STATES = new Set([
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Puducherry", "Jammu and Kashmir", "Ladakh",
]);

export function isStateScheme(s: Scheme): boolean {
  return s.sector !== null && STATES.has(s.sector);
}

export function centralSchemes(d: WelfareRecord): Scheme[] {
  return d.schemes.filter((s) => !isStateScheme(s));
}

export function stateSchemes(d: WelfareRecord): Scheme[] {
  return d.schemes.filter(isStateScheme);
}

/** State schemes grouped by their state, largest group first. */
export function byState(d: WelfareRecord): Array<{ state: string; schemes: Scheme[] }> {
  const m = new Map<string, Scheme[]>();
  for (const s of stateSchemes(d)) {
    const k = s.sector!;
    m.set(k, [...(m.get(k) ?? []), s]);
  }
  return [...m.entries()]
    .map(([state, schemes]) => ({ state, schemes }))
    .sort((a, b) => b.schemes.length - a.schemes.length);
}
