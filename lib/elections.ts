/**
 * Reading the statewise election file from disk.
 *
 * Server-only: this imports node:fs. Anything a client component needs lives
 * in lib/elections-shared.ts and is re-exported here for server callers.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ElectionYear } from "./elections-shared";

export * from "./elections-shared";

export interface ElectionsData {
  present: boolean;
  builtAt: string | null;
  years: ElectionYear[];
  /** Seats in the Lok Sabha — the denominator for coverage. */
  house: number;
}

export const LOK_SABHA_SEATS = 543;

export function loadElections(): ElectionsData {
  try {
    const raw = readFileSync(join(process.cwd(), "data/elections/statewise.json"), "utf8");
    const parsed = JSON.parse(raw) as { builtAt?: string; years?: ElectionYear[] };
    const years = (parsed.years ?? []).sort((a, b) => a.year - b.year);
    return {
      present: years.length > 0,
      builtAt: parsed.builtAt ?? null,
      years,
      house: LOK_SABHA_SEATS,
    };
  } catch {
    return { present: false, builtAt: null, years: [], house: LOK_SABHA_SEATS };
  }
}
