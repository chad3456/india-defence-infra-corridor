/**
 * What India's income tax buys (/income-tax): the sourced register's shape
 * and the arithmetic done on it. No node imports.
 *
 * Every input is a published figure in data/tax/published.json. Everything
 * computed here — counts of things the tax could buy, per-person figures,
 * shares, the tax on a given salary — is derived, and the page labels it so.
 */

export interface TaxSource { id: string; publisher: string; title: string; url: string; published: string | null; accessed: string; tier: 1 | 2 | 3; provenance: string }
export interface TaxItem { id: string; name: string; price?: number; priceUsd?: number; unit: "₹" | "$"; source: string; quote: string; icon: "phone" | "missile" | "jet" | "ship" | "moon" | "hospital" | "train"; confidence?: "low"; notes?: string; context?: string }
export interface TaxPublished {
  about: string; accessed: string; sources: TaxSource[];
  pit: { value: number; unit: string; year: string; includesStt: boolean; source: string; quote: string; netDirect: number; netDirectSource: string };
  filers: Array<{ year: string; value: number; source: string; notes?: string }>;
  zeroLiability: { year: string; filed: number; zero: number; unit: string; source: string; quote: string };
  filerShareOfPopulation: { year: string; value: number; source: string; quote: string };
  bands: { year: string; total: number; unit: string; source: string; confidence: "low"; notes: string; rows: Array<{ band: string; share: number }> };
  croreFilers: { year: string; value: number; source: string; quote: string };
  budget: { year: string; unit: string; rows: Array<{ id: string; label: string; value: number; source: string }> };
  gst: { year: string; gross: number; net: number; unit: string; source: string; notes: string };
  gdp: { year: string; value: number; unit: string; source: string };
  population: { india: { value: number; unit: string; year: string; source: string }; us: { value: number; unit: string; year: string; source: string } };
  fx: { value: number; label: string; source: string };
  us: { pit: { value: number; unit: string; year: string; source: string; quote: string }; pitGdp: { value: number; year: string; source: string; quote: string }; whoPays: { year: string; top1: number; top10: number; bottom50: number; source: string; notes: string } };
  taxToGdp: { rows: Array<{ label: string; value: number; year: string; source: string; notes?: string }> };
  slabs: { regime: string; source: string; bands: Array<[number | null, number]>; rebateUpTo: number; standardDeduction: number; cess: number; notes: string };
  items: TaxItem[];
}

export const CRORE = 1e7, LAKH = 1e5;

/** An item's price in rupees; a dollar price is converted at the page's stated rate. */
export const priceInr = (it: TaxItem, fx: number) => (it.price ?? (it.priceUsd ?? 0) * fx);

/** How many of something a sum would buy, whole units only. */
export const howMany = (rupees: number, price: number) => (price > 0 ? Math.floor(rupees / price) : 0);

/** Income tax under the new regime for a salaried person: standard deduction, slabs, the ₹12 lakh rebate with marginal relief, and 4% cess. No surcharge. */
export function newRegimeTax(gross: number, s: TaxPublished["slabs"]): { taxable: number; tax: number; total: number; effective: number } {
  const taxable = Math.max(0, gross - s.standardDeduction);
  let tax = 0, lower = 0;
  for (const [upper, rate] of s.bands) {
    const top = upper ?? Infinity;
    if (taxable > lower) tax += (Math.min(taxable, top) - lower) * (rate / 100);
    lower = top;
    if (taxable <= top) break;
  }
  if (taxable <= s.rebateUpTo) tax = 0;
  // Marginal relief: just above the rebate limit, tax may not exceed the income above it.
  else tax = Math.min(tax, taxable - s.rebateUpTo);
  const total = Math.round(tax * (1 + s.cess / 100));
  return { taxable, tax: Math.round(tax), total, effective: gross > 0 ? total / gross : 0 };
}

/** The figures the page derives from the register, each with its own inputs plain to see. */
export function derive(d: TaxPublished) {
  const pitRs = d.pit.value * CRORE;
  const indiaPop = d.population.india.value * 1e6, usPop = d.population.us.value * 1e6;
  const perIndian = pitRs / indiaPop;
  const perAmericanUsd = (d.us.pit.value * 1e9) / usPop;
  const latestFilers = d.filers.at(-1)!;
  const perFiler = pitRs / (latestFilers.value * CRORE);
  const b = Object.fromEntries(d.budget.rows.map((r) => [r.id, r.value])) as Record<string, number>;
  return {
    pitRs,
    perDay: pitRs / 365,
    perSecond: pitRs / (365 * 86_400),
    perIndian,
    perIndianUsd: perIndian / d.fx.value,
    perAmericanUsd,
    usMultiple: perAmericanUsd / (perIndian / d.fx.value),
    perFiler,
    pitGdp: (d.pit.value / LAKH / d.gdp.value) * 100,
    payersFy23: d.zeroLiability.filed - d.zeroLiability.zero,
    zeroShareFy23: d.zeroLiability.zero / d.zeroLiability.filed,
    filersPer100: (latestFilers.value * CRORE) / indiaPop * 100,
    payersPer100: ((d.zeroLiability.filed - d.zeroLiability.zero) * CRORE) / indiaPop * 100,
    incomeTaxShareOfSpending: b["income-tax"]! / b.spend!,
    incomeTaxVsInterest: b["income-tax"]! / b.interest!,
    incomeTaxVsDefence: b["income-tax"]! / b.defence!,
    gstVsPit: d.gst.gross / (d.pit.value / LAKH),
    spendPerSecond: (b.spend! * LAKH * CRORE) / (365 * 86_400),
  };
}

/** Indian digit grouping, with lakh and crore words for big sums. */
export function inr(v: number, digits = 0): string {
  const a = Math.abs(v);
  if (a >= 1e12) return `₹${(v / 1e12).toLocaleString("en-IN", { maximumFractionDigits: 2 })} lakh crore`;
  if (a >= CRORE) return `₹${(v / CRORE).toLocaleString("en-IN", { maximumFractionDigits: a >= 1e9 ? 0 : 1 })} crore`;
  if (a >= LAKH) return `₹${(v / LAKH).toLocaleString("en-IN", { maximumFractionDigits: 2 })} lakh`;
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: digits })}`;
}
/** A count in Indian words: 14.97 crore, 31 thousand. */
export function countIn(v: number): string {
  if (v >= CRORE) return `${(v / CRORE).toLocaleString("en-IN", { maximumFractionDigits: 2 })} crore`;
  if (v >= LAKH) return `${(v / LAKH).toLocaleString("en-IN", { maximumFractionDigits: 2 })} lakh`;
  return v.toLocaleString("en-IN");
}
/** The unit one icon stands for, so a count draws as between 4 and 40 icons. */
export function iconUnit(count: number): number {
  if (count <= 40) return 1;
  let u = 1;
  while (count / u > 40) u *= 10;
  return count / u < 4 ? u / 10 : u;
}
