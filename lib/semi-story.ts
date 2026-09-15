/**
 * The semiconductor story's numbers, computed from the committed trade file.
 *
 * Server-only. Everything here is arithmetic on data/semi/trade.json — no
 * figure is typed in, so a rebuild of that file moves this page and a typo
 * cannot.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface TradeRow {
  year: number;
  imports: number;
  exports: number;
  balance: number;
  codes: string[];
  gapBefore: number;
  suspect?: string;
}
export interface Group {
  id: string;
  prefix?: string;
  label: string;
  role: string;
  comparableFrom?: number;
  what: string;
  rows: TradeRow[];
}
export interface SemiTrade {
  present: boolean;
  builtAt: string;
  source: string;
  unit: string;
  sampledYears: number[];
  unsampledYears: number[];
  sparse: string;
  note: string;
  refusal: string;
  groups: Group[];
  allMerchandise: TradeRow[];
}

const EMPTY: SemiTrade = {
  present: false, builtAt: "", source: "", unit: "", sampledYears: [], unsampledYears: [],
  sparse: "", note: "", refusal: "", groups: [], allMerchandise: [],
};

export function loadSemi(): SemiTrade {
  try {
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), "data/semi/trade.json"), "utf8"),
    ) as Partial<SemiTrade>;
    return { ...EMPTY, ...raw, present: (raw.groups?.length ?? 0) > 0 };
  } catch {
    return EMPTY;
  }
}

export function group(d: SemiTrade, id: string): Group | undefined {
  return d.groups.find((g) => g.id === id);
}

/** The latest row of a group, or undefined when the group is empty. */
export function latest(g: Group | undefined): TradeRow | undefined {
  return g?.rows[g.rows.length - 1];
}

/** The row for a year, so a comparison can name its own years. */
export function at(g: Group | undefined, year: number): TradeRow | undefined {
  return g?.rows.find((r) => r.year === year);
}

/** US dollars as the story prints them: $23.4bn, $268m, $340m. */
export function usd(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(abs >= 1e10 ? 1 : 2)}bn`;
  if (abs >= 1e6) return `$${Math.round(v / 1e6)}m`;
  if (abs >= 1e3) return `$${Math.round(v / 1e3)}k`;
  return `$${Math.round(v)}`;
}

/**
 * The file's `balance` is imports minus exports — a DEFICIT, where positive
 * means India bought more than it sold.
 *
 * Reading it the other way is the mistake this page made first, and the page
 * printed "+$-4.4bn" and "a swing of $0 in 0 years" before anyone noticed.
 * Nothing about the sign is wrong in the data; the assumption about it was.
 * These two functions exist so the convention is named once and no caller has
 * to remember which way round it goes.
 */
export function deficit(r: TradeRow): number { return r.balance; }
export function surplus(r: TradeRow): number { return -r.balance; }
export function inSurplus(r: TradeRow): boolean { return r.balance < 0; }

/** The row with the largest deficit — the worst year, on this convention. */
export function worstDeficit(g: Group): TradeRow {
  return g.rows.reduce((w, r) => (r.balance > w.balance ? r : w), g.rows[0]!);
}

/** A signed trade balance printed as a reader expects: surplus positive. */
export function signedSurplus(r: TradeRow): string {
  const v = surplus(r);
  return `${v >= 0 ? "+" : "−"}${usd(Math.abs(v))}`;
}
