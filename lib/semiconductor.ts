import raw from "@/data/semi/trade.json";

/**
 * India's chip and electronics trade, typed and shaped for the page.
 *
 * Nothing here computes a new number. The connector
 * (scripts/etl/connectors/semiconductor.ts) sums the committed HS6 files; this
 * module reads that file, adds up rows that are already in it, and divides one
 * of its figures by another. Every division returns its denominator alongside
 * the quotient, because the standing risk on this subject is a percentage that
 * reads as a fact about India when it is a fact about which heading you chose.
 *
 * ── The two traps this module exists to make hard ────────────────────────
 *
 * 1. The gap. Eleven of twenty-three years were sampled; 2005-2007, 2009-2011,
 *    2014-2016 and 2019-2021 were never fetched. A chart that joins 2018 to
 *    2022 with a straight line asserts a COVID trajectory nobody here measured.
 *    `segments()` exists so a caller gets broken runs by default and has to go
 *    out of its way to draw through a gap.
 *
 * 2. The heading. HS 8541 looks like a semiconductor series and is mostly
 *    solar panels from 2017 onward; HS 8517 is not comparable before 2012
 *    because handsets sat in 852520 until HS2007. `headline()` returns only
 *    the series safe to chart, `comparableRows()` drops the years a series
 *    does not mean the same thing in, and the diagnostic group is excluded
 *    from both — it exists to explain the 8517 truncation, not to be plotted
 *    beside it.
 *
 * The ISM side of this layer — approved fabs, sanctioned amounts, announced
 * capacities — is deliberately absent. See scripts/etl/probe-semiconductor.ts:
 * those are announcements, they have no connector yet, and until one exists
 * that cites a source per fact, this module has nothing to say about them.
 */

export type GroupRole = "headline" | "denominator" | "diagnostic";

export interface SemiRow {
  year: number;
  /** US$, nominal, not deflated, as reported by India. Whole dollars. */
  imports: number;
  exports: number;
  /** imports - exports. Positive means India is a net buyer. */
  balance: number;
  /** The HS6 subheadings that carried value in this year, as evidence. */
  codes: string[];
  /** Unsampled years immediately before this row. 0 means consecutive. */
  gapBefore: number;
  /** Set where the row itself looks wrong. Present it; do not silently drop it. */
  suspect?: string;
}

export interface SemiGroup {
  id: string;
  prefix: string;
  label: string;
  role: GroupRole;
  /** First sampled year from which the series means the same thing. */
  comparableFrom: number;
  what: string;
  rows: SemiRow[];
}

export interface SemiTrade {
  builtAt: string;
  source: string;
  unit: string;
  reporter: string;
  sampledYears: number[];
  unsampledYears: number[];
  sparse: string;
  note: string;
  refusal: string;
  groups: SemiGroup[];
  /** All chapters bar 99, so a share of total imports carries its denominator. */
  allMerchandise: SemiRow[];
}

export function loadSemiTrade(): SemiTrade {
  return raw as unknown as SemiTrade;
}

/** One group by id, or null. Callers must handle the null: the connector can
 *  legitimately omit a group whose heading reported nothing at all. */
export function semiGroup(id: string): SemiGroup | null {
  return loadSemiTrade().groups.find((g) => g.id === id) ?? null;
}

/** The series that are safe to chart as their own line. */
export function headlineGroups(): SemiGroup[] {
  return loadSemiTrade().groups.filter((g) => g.role === "headline");
}

export function semiRow(groupId: string, year: number): SemiRow | null {
  return semiGroup(groupId)?.rows.find((r) => r.year === year) ?? null;
}

/** The most recent sampled year for a group. */
export function latestRow(groupId: string): SemiRow | null {
  const rows = semiGroup(groupId)?.rows ?? [];
  return rows[rows.length - 1] ?? null;
}

/**
 * Rows only from the year a series started meaning the same thing.
 *
 * Not a filter for tidiness. Showing HS 8517 from 2002 puts a $0.58bn telecom
 * import bill on the chart for a year when India imported $0.58bn of handsets
 * under a different heading entirely, and the resulting line says India's
 * phone imports grew thirtyfold when much of that step is a code change.
 */
export function comparableRows(group: SemiGroup): SemiRow[] {
  return group.rows.filter((r) => r.year >= group.comparableFrom);
}

/**
 * Contiguous runs of sampled years.
 *
 * A chart should draw one path per segment. Joining segments is an assertion
 * about years that were never fetched, and the largest gap here — 2019, 2020,
 * 2021 — is precisely the stretch where a straight line would be most wrong
 * and most believed.
 */
export function segments(rows: SemiRow[]): SemiRow[][] {
  const out: SemiRow[][] = [];
  let run: SemiRow[] = [];
  for (const r of rows) {
    if (r.gapBefore > 0 && run.length > 0) {
      out.push(run);
      run = [];
    }
    run.push(r);
  }
  if (run.length > 0) out.push(run);
  return out;
}

/**
 * A share, and the two numbers it was made from.
 *
 * Returning a bare percentage is how a denominator gets lost between the
 * module that computed it and the sentence that prints it. Everything here
 * carries both sides and the name of the thing it is a share of, so a caller
 * physically cannot render "38%" without having been handed "of $83.4bn".
 */
export interface Share {
  year: number;
  /** The numerator, in US$. */
  value: number;
  /** The denominator, in US$. */
  denominator: number;
  /** What the denominator is, in words, for the caption. */
  of: string;
  /** value / denominator, 0-1. Null when the denominator is zero or absent. */
  fraction: number | null;
}

function share(year: number, value: number, denominator: number, of: string): Share {
  return {
    year, value, denominator, of,
    fraction: denominator > 0 ? value / denominator : null,
  };
}

/** A group's imports as a share of the whole electronics chapter, same year. */
export function shareOfElectronics(groupId: string, year: number): Share | null {
  const row = semiRow(groupId, year);
  const ch85 = semiRow("chapter85", year);
  if (!row || !ch85) return null;
  return share(year, row.imports, ch85.imports, "imports of HS chapter 85, electrical machinery and electronics");
}

/** A group's imports as a share of all merchandise imports, same year. */
export function shareOfMerchandise(groupId: string, year: number): Share | null {
  const row = semiRow(groupId, year);
  const all = loadSemiTrade().allMerchandise.find((r) => r.year === year);
  if (!row || !all) return null;
  return share(year, row.imports, all.imports, "India's merchandise imports, all chapters bar 99");
}

/**
 * Change between two sampled years, with both years named.
 *
 * Takes explicit years rather than "since 2002" or "over the last decade",
 * because the sampled set has holes and a phrase like "in the past ten years"
 * would silently resolve to whichever years happen to be on disk. If a caller
 * asks for a year that was never sampled it gets null, not the nearest one.
 */
export interface Change {
  from: SemiRow;
  to: SemiRow;
  /** Unsampled years between the two endpoints. */
  unmeasured: number;
  importsMultiple: number | null;
  importsDelta: number;
  balanceDelta: number;
}

export function changeBetween(groupId: string, fromYear: number, toYear: number): Change | null {
  const from = semiRow(groupId, fromYear);
  const to = semiRow(groupId, toYear);
  if (!from || !to) return null;
  const sampled = loadSemiTrade().sampledYears
    .filter((y) => y > fromYear && y < toYear).length;
  return {
    from, to,
    unmeasured: Math.max(0, toYear - fromYear - 1 - sampled),
    importsMultiple: from.imports > 0 ? to.imports / from.imports : null,
    importsDelta: to.imports - from.imports,
    balanceDelta: to.balance - from.balance,
  };
}

/** Rows a consumer must render as questionable, across every group. */
export function suspectRows(): Array<{ group: SemiGroup; row: SemiRow }> {
  const out: Array<{ group: SemiGroup; row: SemiRow }> = [];
  for (const g of loadSemiTrade().groups) {
    for (const r of g.rows) if (r.suspect) out.push({ group: g, row: r });
  }
  return out;
}

/**
 * Totalling several groups is almost always a mistake, so it takes a reason.
 *
 * The tempting sum is 8541 + 8542 as "semiconductors", which double-counts
 * nothing but adds four to six billion dollars of solar panels to the chip
 * bill. The signature forces the caller to write down why the sum is
 * legitimate, and that string is meant to end up on the page next to it.
 */
export function sumImports(groupIds: string[], year: number, because: string): {
  total: number; parts: Array<{ id: string; imports: number }>; because: string;
} | null {
  if (because.trim().length < 10) {
    throw new Error("sumImports needs a stated reason the sum is legitimate; it goes on the page beside the number");
  }
  const parts: Array<{ id: string; imports: number }> = [];
  for (const id of groupIds) {
    const row = semiRow(id, year);
    if (!row) return null;
    parts.push({ id, imports: row.imports });
  }
  return { total: parts.reduce((a, p) => a + p.imports, 0), parts, because };
}
