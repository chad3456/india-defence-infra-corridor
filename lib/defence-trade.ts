/**
 * The defence-adjacent customs layer, typed and shaped for the page.
 *
 * Read from disk rather than imported, for the same reason as lib/trade-data:
 * the connector is offline arithmetic over a resumable ingest, so at any
 * moment the file may be absent or built from a partial set of years, and the
 * page has to render honestly against that rather than fail to build.
 *
 * ── The one rule this module enforces ────────────────────────────────────
 *
 * Every share carries its denominator. Not in a footnote, not in a tooltip —
 * in the returned object, as a field, so that a component cannot render the
 * percentage without having the base in hand. "Defence trade is 0.1% of
 * exports" is a statement about the HS classification, not about India, and a
 * bare percentage detaches from that instantly.
 *
 * ── What this module deliberately does not do ────────────────────────────
 *
 * It does not sum the groups into a single "defence trade" total. It could:
 * the numbers add. But the sum would be wrong in both directions at once —
 * inflated by civil airliners in 8802 and civil aircraft parts in 8807, and
 * deflated by everything missing, which is radar, avionics, electronics,
 * missiles, engines and all services. A total that is simultaneously too big
 * and too small is not an estimate with error bars, it is a number with no
 * meaning, and giving it a name would make it quotable. Groups are shown
 * separately or not at all.
 *
 * It does not interpolate. Eleven years are sampled out of the period the site
 * covers, and the gaps stay gaps.
 *
 * It does not treat an absent code as a zero. A group-year with nothing
 * reported comes back with nulls and `reported: false`, because the ingest
 * drops rows that are zero on both flows and therefore cannot distinguish no
 * trade from a code not in force from a reporting gap. HS 8710 vanishes after
 * 2022 and India did not stop trading armoured vehicles.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const FILE = join(process.cwd(), "data", "defence", "trade.json");

export interface DefenceGroupYear {
  year: number;
  /** False when not one of the group's codes was reported that year. */
  reported: boolean;
  /** Null when `reported` is false. Absence is never rendered as zero. */
  imports: number | null;
  exports: number | null;
  balance: number | null;
  codesPresent: string[];
  codesAbsent: string[];
}

export interface DefenceTopLine {
  code: string;
  name: string;
  imports: number;
  exports: number;
  shareOfGroupTurnover: number;
  groupTurnover: number;
}

export interface DefenceGroup {
  id: string;
  label: string;
  codeRange: string;
  military: "military" | "mixed" | "civil-dominant";
  captures: string;
  misses: string;
  concordance?: string;
  subsetOf?: string;
  codes: Array<{ code: string; name: string }>;
  years: DefenceGroupYear[];
  composition: { year: number; lines: DefenceTopLine[] } | null;
}

export interface DefenceDenominator {
  year: number;
  imports: number;
  exports: number;
  codesReported: number;
}

export interface DefenceTrade {
  present: boolean;
  builtAt: string | null;
  source: string;
  classification: string;
  caveat: string;
  cannotSay: string[];
  years: number[];
  denominators: DefenceDenominator[];
  groups: DefenceGroup[];
  checks: string[];
}

const EMPTY: DefenceTrade = {
  present: false,
  builtAt: null,
  source: "",
  classification: "",
  caveat: "",
  cannotSay: [],
  years: [],
  denominators: [],
  groups: [],
  checks: [],
};

let cached: DefenceTrade | null = null;

export function getDefenceTrade(): DefenceTrade {
  if (cached) return cached;
  try {
    if (!existsSync(FILE)) { cached = EMPTY; return cached; }
    const raw = JSON.parse(readFileSync(FILE, "utf8")) as Omit<DefenceTrade, "present">;
    cached = { ...raw, present: Array.isArray(raw.groups) && raw.groups.length > 0 };
    return cached;
  } catch {
    cached = EMPTY;
    return cached;
  }
}

export function groupById(d: DefenceTrade, id: string): DefenceGroup | null {
  return d.groups.find((g) => g.id === id) ?? null;
}

/**
 * A share and the two numbers it was made from.
 *
 * `value` is null wherever the numerator is unreported or the denominator is
 * zero, so a component that renders a null gets a dash rather than a NaN or,
 * worse, a confident 0%.
 */
export interface Share {
  value: number | null;
  numerator: number | null;
  denominator: number;
  /** Sentence a component can print verbatim under the figure. */
  basis: string;
}

function share(numerator: number | null, denominator: number, basis: string): Share {
  const value = numerator === null || denominator <= 0 ? null : numerator / denominator;
  return { value, numerator, denominator, basis };
}

export interface GroupYearView extends DefenceGroupYear {
  /** This group's imports as a share of every commodity India imported that year. */
  importShare: Share;
  exportShare: Share;
  /** How many of the group's codes reported, out of how many exist. */
  coverage: { present: number; total: number };
}

/**
 * One group's series, with each share already carrying its base.
 *
 * The denominator is all-commodity trade for the same year from the same
 * files, so numerator and denominator are always the same vintage, the same
 * reporter and the same flow definition. Using a published national trade
 * total from elsewhere would look more authoritative and would silently mix
 * two datasets whose coverage differs.
 */
export function groupSeries(d: DefenceTrade, groupId: string): GroupYearView[] {
  const g = groupById(d, groupId);
  if (!g) return [];
  const denom = new Map(d.denominators.map((x) => [x.year, x]));
  return g.years.map((y) => {
    const base = denom.get(y.year);
    const mBase = base?.imports ?? 0;
    const xBase = base?.exports ?? 0;
    return {
      ...y,
      importShare: share(y.imports, mBase,
        `of US$${(mBase / 1e9).toFixed(1)}bn total merchandise imports reported for ${y.year}`),
      exportShare: share(y.exports, xBase,
        `of US$${(xBase / 1e9).toFixed(1)}bn total merchandise exports reported for ${y.year}`),
      coverage: { present: y.codesPresent.length, total: g.codes.length },
    };
  });
}

/** Years in which the group reported anything, ascending. Gaps are not filled. */
export function reportedYears(d: DefenceTrade, groupId: string): number[] {
  return (groupById(d, groupId)?.years ?? []).filter((y) => y.reported).map((y) => y.year);
}

/**
 * The latest year in which a group reported, with its shares.
 *
 * Deliberately "latest reported" and not "latest sampled": a headline tile
 * reading 2024 with a dash in it is confusing, and one reading 2024 with a
 * zero in it is false. Naming the year the figure is actually from is the only
 * version that is neither.
 */
export function latestReported(d: DefenceTrade, groupId: string): GroupYearView | null {
  const series = groupSeries(d, groupId);
  for (let i = series.length - 1; i >= 0; i--) {
    const row = series[i];
    if (row?.reported) return row;
  }
  return null;
}

/**
 * Groups arranged for the page, with the subsets attached to their parents.
 *
 * A subset shown as a sibling reads as an additional group and invites the
 * reader to add it to the total it is already inside — 9301 sits within
 * chapter 93, and a column of nine groups would have counted it twice.
 */
export interface GroupTree {
  group: DefenceGroup;
  subsets: DefenceGroup[];
}

export function groupTree(d: DefenceTrade): GroupTree[] {
  const parents = d.groups.filter((g) => !g.subsetOf);
  return parents.map((group) => ({
    group,
    subsets: d.groups.filter((g) => g.subsetOf === group.id),
  }));
}

/**
 * The comparison the page is built to make.
 *
 * Chapter 93 next to the aircraft and vessel groups, in one year, so the
 * reader can see for themselves that the chapter called "arms and ammunition"
 * is one or two orders of magnitude smaller than the lines that actually
 * carry defence-adjacent hardware — and that those lines are mostly civil.
 * This is the argument of the page, and it is made of numbers already in the
 * file rather than of a claim in prose.
 */
export interface ScaleRow {
  id: string;
  label: string;
  military: DefenceGroup["military"];
  imports: number | null;
  exports: number | null;
  misses: string;
  /** The single biggest code inside the group that year, if it reported. */
  dominatedBy: { code: string; name: string; share: number } | null;
}

export function scaleComparison(d: DefenceTrade, year: number): ScaleRow[] {
  return d.groups
    .filter((g) => !g.subsetOf)
    .map((g) => {
      const y = g.years.find((r) => r.year === year);
      const top = g.composition?.year === year ? g.composition.lines[0] : undefined;
      return {
        id: g.id,
        label: g.label,
        military: g.military,
        imports: y?.reported ? y.imports : null,
        exports: y?.reported ? y.exports : null,
        misses: g.misses,
        dominatedBy: top
          ? { code: top.code, name: top.name, share: top.shareOfGroupTurnover }
          : null,
      };
    })
    .sort((a, b) => ((b.imports ?? 0) + (b.exports ?? 0)) - ((a.imports ?? 0) + (a.exports ?? 0)));
}

/**
 * US$ for the page: millions under a billion, billions above.
 *
 * Grouped en-US and not en-IN, even on a site about India, because the figure
 * is in dollars: a dollar amount in lakh-crore grouping reads as a rupee
 * amount at a glance and the two differ by a factor of eighty-odd. Rupee
 * figures, when this project ever has any, get the Indian grouping.
 */
export function usd(n: number | null): string {
  if (n === null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `US$${(n / 1e9).toFixed(2)}bn`;
  if (abs >= 1e6) return `US$${(n / 1e6).toFixed(1)}m`;
  return `US$${Math.round(n).toLocaleString("en-US")}`;
}

/** A share as a percentage, or a dash. Never "0%" for an unreported year. */
export function pct(s: Share): string {
  if (s.value === null) return "—";
  if (s.value > 0 && s.value < 0.0001) return "<0.01%";
  return `${(s.value * 100).toFixed(2)}%`;
}
