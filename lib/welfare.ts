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

/**
 * The article writes ministries as the abbreviations civil servants use.
 *
 * Expanded here because "MoRD" is not a word a reader knows, and a roster
 * grouped by initials is a roster nobody can scan. Unknown abbreviations are
 * left exactly as written rather than guessed at — an expansion invented for a
 * ministry that does not exist under that name would be worse than an
 * abbreviation.
 */
const MINISTRY: Record<string, string> = {
  MoRD: "Rural Development", MoF: "Finance", MoWCD: "Women & Child Development",
  MoST: "Science & Technology", MoE: "Education", MoHFW: "Health & Family Welfare",
  MoA: "Agriculture", MoAFW: "Agriculture & Farmers' Welfare", MoHUA: "Housing & Urban Affairs",
  MoJS: "Jal Shakti", MoUD: "Urban Development", MoLE: "Labour & Employment",
  MoP: "Power", MoMSME: "Micro, Small & Medium Enterprises", MoD: "Defence",
  MoR: "Railways", MoCF: "Chemicals & Fertilisers", MoYAS: "Youth Affairs & Sports",
  MoMA: "Minority Affairs", MoPR: "Panchayati Raj", MoSJE: "Social Justice & Empowerment",
  MoTA: "Tribal Affairs", MoCA: "Civil Aviation", MoCAFPD: "Consumer Affairs, Food & Public Distribution",
  MoSPI: "Statistics & Programme Implementation", MoLJ: "Law & Justice",
  "MoP&NG": "Petroleum & Natural Gas", MoFAHD: "Fisheries, Animal Husbandry & Dairying",
  "MoSD&E": "Skill Development & Entrepreneurship", MoHRD: "Human Resource Development",
  MoRTH: "Road Transport & Highways", MoWR: "Water Resources",
  "DPIIT (MoCI)": "Commerce & Industry (DPIIT)", MeitY: "Electronics & IT",
};

/**
 * The ministry's full name where it is known, and the abbreviation where not.
 *
 * Comma-separated lists are expanded part by part, because a scheme run
 * jointly is a real category and "MoF, MoSJE" tells a reader nothing. "List"
 * is the article's own section heading leaking through where a row had no
 * ministry cell, and it is relabelled rather than shown as if a ministry of
 * that name existed.
 */
export function ministryName(sector: string | null): string {
  if (!sector || sector === "List") return "not stated in the source";
  if (sector.includes(",")) {
    return sector.split(",").map((part) => {
      const k = part.trim();
      return MINISTRY[k] ?? k;
    }).join(" + ");
  }
  return MINISTRY[sector] ?? sector;
}

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
/** Central schemes grouped by the ministry that runs them, largest first. */
export function byMinistry(d: WelfareRecord): Array<{ ministry: string; raw: string; schemes: Scheme[] }> {
  const m = new Map<string, Scheme[]>();
  for (const s of centralSchemes(d)) {
    const k = s.sector ?? "unfiled";
    m.set(k, [...(m.get(k) ?? []), s]);
  }
  return [...m.entries()]
    .map(([raw, schemes]) => ({ ministry: ministryName(raw), raw, schemes }))
    .sort((a, b) => b.schemes.length - a.schemes.length || a.ministry.localeCompare(b.ministry));
}

/** Central schemes by the decade they were launched, where a year is known. */
export function byDecade(d: WelfareRecord): Array<{ decade: number; schemes: number }> {
  const m = new Map<number, number>();
  for (const s of centralSchemes(d)) {
    if (s.launched === null) continue;
    const dec = Math.floor(s.launched / 10) * 10;
    m.set(dec, (m.get(dec) ?? 0) + 1);
  }
  return [...m.entries()].map(([decade, schemes]) => ({ decade, schemes }))
    .sort((a, b) => a.decade - b.decade);
}

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
