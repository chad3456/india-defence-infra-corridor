/**
 * India's Gulf exposure and its drone trade, read from the committed file.
 *
 * Server-only. Everything is arithmetic over data/global/chokepoints.json.
 *
 * ── The distinction this file exists to keep ─────────────────────────────
 *
 * "Gulf oil" and "oil through Hormuz" are different quantities. Every helper
 * that returns a share takes the set it is summing over as an argument, so no
 * caller can produce a Hormuz number without saying which definition it used.
 * That is the whole reason this is a module rather than three lines in a page.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Chokepoint = "locked" | "bypass" | "outside";

export interface GulfEntry { name: string; chokepoint: Chokepoint; note: string }
export interface CountryValue { code: number; name: string; value: number }
export interface EnergyYear { year: number; sources: CountryValue[]; total: number; batchesFailed: number }
export interface EnergyLine { code: string; label: string; short: string; years: EnergyYear[] }

export interface Bilateral {
  year: number;
  partners: Array<{ code: number; name: string; imports: number; exports: number }>;
}

export interface DroneYear { year: number; exporters: CountryValue[]; importers: CountryValue[]; batchesFailed: number }

export interface Chokepoints {
  present: boolean;
  builtAt: string;
  source: string;
  unit: string;
  gulf: Record<string, GulfEntry>;
  /** Comtrade code to country name, published by the connector. */
  names: Record<string, string>;
  chokepointNote: string;
  droneNote: string;
  refusal: string;
  caveats: string[];
  energy: EnergyLine[];
  bilateral: Bilateral[];
  drones: {
    code: string;
    label: string;
    years: DroneYear[];
    indiaImportsBySource: CountryValue[];
    indiaExportsByDestination: CountryValue[];
    indiaPartnerYear: number | null;
  };
  diagnostics?: { calls: number; failed: number; duplicateRowsSummed: number };
}

const EMPTY: Chokepoints = {
  present: false, builtAt: "", source: "", unit: "", gulf: {}, names: {}, chokepointNote: "",
  droneNote: "", refusal: "", caveats: [], energy: [], bilateral: [],
  drones: { code: "", label: "", years: [], indiaImportsBySource: [], indiaExportsByDestination: [], indiaPartnerYear: null },
};

export function loadChokepoints(): Chokepoints {
  try {
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), "data/global/chokepoints.json"), "utf8"),
    ) as Partial<Chokepoints>;
    return { ...EMPTY, ...raw, present: (raw.energy?.length ?? 0) > 0 };
  } catch {
    return EMPTY;
  }
}

export function energyLine(d: Chokepoints, code: string): EnergyLine | undefined {
  return d.energy.find((l) => l.code === code);
}

export function energyYear(l: EnergyLine | undefined, year: number): EnergyYear | undefined {
  return l?.years.find((y) => y.year === year);
}

/**
 * The share of one year's imports coming from origins in a given set.
 *
 * `sets` is required and has no default. A default would let a caller write
 * `hormuzShare(year)` and get *some* number, and which number would depend on
 * a choice made in this file rather than on the page. The definition belongs
 * next to the sentence that uses it.
 */
export function shareFrom(
  d: Chokepoints,
  y: EnergyYear | undefined,
  sets: Chokepoint[],
): { value: number; dollars: number; countries: CountryValue[] } {
  if (!y || y.total <= 0) return { value: 0, dollars: 0, countries: [] };
  const countries = y.sources.filter((c) => {
    const g = d.gulf[String(c.code)];
    return g !== undefined && sets.includes(g.chokepoint);
  });
  const dollars = countries.reduce((a, b) => a + b.value, 0);
  return { value: (dollars / y.total) * 100, dollars, countries };
}

/** What a country's code says about its exposure, or undefined for non-Gulf. */
export function gulfOf(d: Chokepoints, code: number): GulfEntry | undefined {
  return d.gulf[String(code)];
}

/** The three-way split of one year, as shares that sum to 100. */
export function split(d: Chokepoints, y: EnergyYear | undefined): {
  locked: number; bypass: number; outside: number; elsewhere: number; total: number;
} {
  if (!y || y.total <= 0) return { locked: 0, bypass: 0, outside: 0, elsewhere: 0, total: 0 };
  const l = shareFrom(d, y, ["locked"]).value;
  const b = shareFrom(d, y, ["bypass"]).value;
  const o = shareFrom(d, y, ["outside"]).value;
  return { locked: l, bypass: b, outside: o, elsewhere: Math.max(0, 100 - l - b - o), total: y.total };
}

/**
 * A country's name, from the file's own map.
 *
 * Falls back to whatever the row carried, which is the bare code when the
 * endpoint declined to name it. Never invents one.
 */
export function nameOf(d: Chokepoints, c: CountryValue): string {
  return d.names[String(c.code)] ?? c.name;
}

export function rankOf(rows: CountryValue[], code: number): number {
  return rows.findIndex((r) => r.code === code) + 1;
}
export function valueOf(rows: CountryValue[], code: number): number {
  return rows.find((r) => r.code === code)?.value ?? 0;
}

export const INDIA_CODE = 699;
export const RUSSIA_CODE = 643;
export const ISRAEL_CODE = 376;
export const IRAN_CODE = 364;
export const QATAR_CODE = 634;
export const IRAQ_CODE = 368;

/** US dollars, as these pages print them. */
export function usd(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(abs >= 1e10 ? 0 : 1)}bn`;
  if (abs >= 1e6) return `$${Math.round(v / 1e6)}m`;
  if (abs >= 1e3) return `$${Math.round(v / 1e3)}k`;
  return `$${Math.round(v)}`;
}
