/**
 * Election types and the arithmetic over them.
 *
 * Split from lib/elections.ts because the map component needs these and the
 * loader needs node:fs — and a client component that transitively imports a
 * node builtin fails the Turbopack build with "the chunking context does not
 * support external modules". This is the second time that has happened here
 * (lib/census-shared.ts exists for the same reason), so scripts/test-client-
 * bundle.ts now fails the suite before the build does.
 */
export interface StateRow {
  state: string;
  electors: number;
  voters: number;
  turnoutPct: number;
  seats: number;
  merged?: string[];
}

export interface ElectionYear {
  year: number;
  page: string;
  rows: StateRow[];
  seatsTotal: number;
  rejected: Array<{ label: string; reason: string }>;
}

export interface ElectionsData {
  present: boolean;
  builtAt: string | null;
  years: ElectionYear[];
  /** Seats in the Lok Sabha — the denominator for coverage. */
  house: number;
}

export const LOK_SABHA_SEATS = 543;

/** National turnout, recomputed from the parts rather than taken on trust. */
export function nationalTurnout(y: ElectionYear): number {
  const electors = y.rows.reduce((s, r) => s + r.electors, 0);
  const voters = y.rows.reduce((s, r) => s + r.voters, 0);
  return electors === 0 ? 0 : (voters / electors) * 100;
}

/**
 * Change in a state's turnout between two elections, in percentage points.
 *
 * Only states present in both are returned. A state that appears in one and
 * not the other has no change to report, and inventing a zero for it would put
 * it in the middle of a diverging scale as though it had held steady.
 */
export function turnoutShift(from: ElectionYear, to: ElectionYear): Record<string, number> {
  const before = new Map(from.rows.map((r) => [r.state, r.turnoutPct]));
  const out: Record<string, number> = {};
  for (const r of to.rows) {
    const b = before.get(r.state);
    if (b !== undefined) out[r.state] = r.turnoutPct - b;
  }
  return out;
}
