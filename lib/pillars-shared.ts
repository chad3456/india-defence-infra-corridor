/**
 * Shapes the four growth dashboards render, with no node builtins so a client
 * component can import them. See lib/census-shared.ts for why this split
 * exists at all.
 */
export interface LiteracyRow { state: string; byCensus: Record<string, number> }
export interface CompanyRow { name: string; founded: number | null; specialisation: string }
export interface YearRow { year: number; value: number }

export interface PillarsData {
  present: boolean;
  builtAt: string | null;
  censusYears: string[];
  literacyByState: LiteracyRow[];
  defenceCompanies: CompanyRow[];
  satellitesByYear: YearRow[];
  upiVolumeMn: YearRow[];
  upiValueMn: YearRow[];
}

/**
 * Companies grouped by the year they were founded, cumulative.
 *
 * The interesting reading is not how many exist but when they arrived: a
 * cumulative line makes the slope after 2014 visible in a way a bar per year
 * does not, and the slope is the claim being tested.
 */
export function cumulativeByYear(companies: CompanyRow[], from = 1950): YearRow[] {
  const dated = companies
    .map((c) => c.founded)
    .filter((y): y is number => y !== null && y >= from)
    .sort((a, b) => a - b);
  if (dated.length === 0) return [];
  const out: YearRow[] = [];
  let n = 0;
  for (let y = dated[0]!; y <= dated[dated.length - 1]!; y++) {
    n += dated.filter((d) => d === y).length;
    out.push({ year: y, value: n });
  }
  return out;
}

/** Change in literacy between two censuses, in percentage points. */
export function literacyShift(rows: LiteracyRow[], from: string, to: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const a = r.byCensus[from];
    const b = r.byCensus[to];
    // Only states present in both. A state that did not exist at the earlier
    // census has no change to report, and inventing a zero would put it in the
    // middle of the scale as though it had stood still.
    if (a !== undefined && b !== undefined) out[r.state] = b - a;
  }
  return out;
}
