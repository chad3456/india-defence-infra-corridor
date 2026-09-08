/**
 * Reading the four growth pillars from disk.
 *
 * Server-only: imports node:fs. The shapes a client component needs are in
 * lib/pillars-shared.ts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LiteracyRow, CompanyRow, YearRow, PillarsData } from "./pillars-shared";

export * from "./pillars-shared";

export function loadPillars(): PillarsData {
  try {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "data/pillars/pillars.json"), "utf8")) as {
      builtAt?: string; censusYears?: string[];
      literacyByState?: LiteracyRow[]; defenceCompanies?: CompanyRow[];
      satellitesByYear?: YearRow[]; upiVolumeMn?: YearRow[]; upiValueMn?: YearRow[];
    };
    return {
      present: (raw.literacyByState?.length ?? 0) > 0,
      builtAt: raw.builtAt ?? null,
      censusYears: raw.censusYears ?? [],
      literacyByState: raw.literacyByState ?? [],
      defenceCompanies: raw.defenceCompanies ?? [],
      satellitesByYear: raw.satellitesByYear ?? [],
      upiVolumeMn: raw.upiVolumeMn ?? [],
      upiValueMn: raw.upiValueMn ?? [],
    };
  } catch {
    return {
      present: false, builtAt: null, censusYears: [], literacyByState: [],
      defenceCompanies: [], satellitesByYear: [], upiVolumeMn: [], upiValueMn: [],
    };
  }
}

export interface SchemeRow {
  state: string; ruralAccounts: number; urbanAccounts: number;
  totalAccounts: number; croreDeposits: number | null;
}
export interface SchemeData {
  present: boolean; asOf: string | null; rows: SchemeRow[]; refused: number;
}

export function loadSchemes(): SchemeData {
  try {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "data/schemes/jan-dhan.json"), "utf8")) as {
      asOf?: string | null; rows?: SchemeRow[]; rejected?: unknown[];
    };
    return {
      present: (raw.rows?.length ?? 0) > 0,
      asOf: raw.asOf ?? null,
      rows: raw.rows ?? [],
      refused: (raw.rejected ?? []).length,
    };
  } catch {
    return { present: false, asOf: null, rows: [], refused: 0 };
  }
}
