/**
 * Shapes the deals page renders, with no node builtins so a client component
 * can import them. See lib/census-shared.ts for why this split exists at all.
 */

export type Measure =
  | "contract" | "clearance" | "acceptance-of-necessity" | "delivery" | "unclassified";

export interface Money {
  amount: string;
  currency: "INR" | "USD";
  unit: string;
  sentence: string;
}

export interface Deal {
  prid: string;
  url: string;
  title: string;
  date: string | null;
  ministry: string | null;
  measure: Measure;
  measureCue: string;
  money: Money[];
  ambiguousValue: boolean;
  citedBy: string[];
}

export interface Deals {
  present: boolean;
  builtAt: string | null;
  source: string;
  discovery: string;
  coverageWarning: string;
  fourMeasures: string;
  valueNote: string;
  articlesRead: string[];
  articlesMissing: string[];
  citedIds: number;
  fetched: number;
  dead: number;
  notDefence: number;
  /** Releases whose own headline named none of the four events. */
  notAnEvent: number;
  eventNote: string;
  withDate: number;
  withValue: number;
  ambiguous: number;
  byMeasure: Record<string, number>;
  deals: Deal[];
}

/**
 * What each of the four measures means, in one sentence each.
 *
 * On the page rather than in a footnote, because the entire risk with this
 * dataset is a reader treating an Acceptance of Necessity as a purchase. The
 * label alone does not carry that; the sentence has to be next to the number.
 */
export const MEASURE_LABEL: Record<Measure, { label: string; means: string }> = {
  "contract": {
    label: "Contract signed",
    means: "A contract has been signed. This is the strongest of the four and the only one that is a commitment to buy.",
  },
  "clearance": {
    label: "Cabinet clearance",
    means: "The Cabinet Committee on Security approved the acquisition. Approval to proceed, not a signature.",
  },
  "acceptance-of-necessity": {
    label: "Acceptance of Necessity",
    means: "The Defence Acquisition Council agreed the requirement exists. Permission to begin procuring — many never become contracts.",
  },
  "delivery": {
    label: "Delivery or induction",
    means: "Equipment was handed over or inducted. It says nothing about what was paid or when it was ordered.",
  },
  "unclassified": {
    label: "Not classified",
    means: "The release is a defence acquisition release but names none of the four events in a form this reader recognises.",
  },
};

export const MEASURE_ORDER: Measure[] = [
  "contract", "clearance", "acceptance-of-necessity", "delivery", "unclassified",
];

/**
 * Releases per year, per measure, kept apart.
 *
 * Deliberately not a stacked series. Stacking implies the bars sum to
 * something, and a clearance plus a contract plus a delivery for the same
 * aircraft is one procurement counted three times. Small multiples make the
 * shapes comparable without ever drawing the total.
 */
export function byYear(deals: Deal[]): Array<{ measure: Measure; years: Array<{ year: number; n: number }> }> {
  const out: Array<{ measure: Measure; years: Array<{ year: number; n: number }> }> = [];
  const dated = deals.filter((d) => d.date);
  if (dated.length === 0) return out;
  const years = dated.map((d) => Number(d.date!.slice(0, 4))).filter(Number.isFinite);
  const lo = Math.min(...years), hi = Math.max(...years);
  for (const measure of MEASURE_ORDER) {
    const mine = dated.filter((d) => d.measure === measure);
    if (mine.length === 0) continue;
    const buckets: Array<{ year: number; n: number }> = [];
    for (let y = lo; y <= hi; y++) {
      buckets.push({ year: y, n: mine.filter((d) => d.date!.startsWith(String(y))).length });
    }
    out.push({ measure, years: buckets });
  }
  return out;
}

/** A figure as the release wrote it. Never converted, never normalised. */
export function asWritten(m: Money): string {
  const sym = m.currency === "USD" ? "US$" : "₹";
  return `${sym}${m.amount}${m.unit ? ` ${m.unit}` : ""}`;
}
