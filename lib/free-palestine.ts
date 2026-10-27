/**
 * Free Palestine, Inc.? (/free-palestine-inc): the checked register's shape
 * and the few derived figures the essay shows. No node imports.
 *
 * The page tests a thesis rather than asserting it. Every figure comes from
 * data/free-palestine/published.json with its source; claims in circulation
 * carry a verdict; shares and ratios are computed here and labelled derived.
 */

export type Verdict = "supported" | "partly" | "understated" | "claimed" | "contradicted" | "unverified" | "removed";
export const VERDICTS: Record<Verdict, { label: string; colour: string; blurb: string }> = {
  supported: { label: "Supported", colour: "var(--s-cool)", blurb: "The record says so." },
  partly: { label: "Partly right", colour: "var(--series-2)", blurb: "Something happened, but not as described." },
  understated: { label: "Understated", colour: "var(--series-1)", blurb: "The record is larger." },
  claimed: { label: "One side's claim", colour: "var(--series-4)", blurb: "Sourced to a party to the conflict; not independently verified." },
  contradicted: { label: "Contradicted", colour: "var(--s-hot)", blurb: "The record says otherwise." },
  unverified: { label: "No evidence found", colour: "var(--story-ink-3)", blurb: "Nothing found either way." },
  removed: { label: "Removed", colour: "var(--story-ink)", blurb: "Not a factual claim; left out." },
};

export interface FpSource { id: string; publisher: string; title: string; url: string; published: string | null; accessed: string; tier: 1 | 2 | 3; kind: string }
export interface FpPublished {
  about: string; accessed: string; sources: FpSource[];
  ledger: Array<{ id: string; label: string; value: number; approx?: boolean; unit: string; asOf: string; source: string; note?: string }>;
  attention: {
    platforms: Array<{ platform: string; pro: number; proTag: string; con: number; conTag: string; unit: string }>;
    platformsSource: string; platformsAsOf: string; platformsNote: string;
    usTiktok: { pro: number; proTag: string; con: number; conTag: string; window: string; source: string };
    rafah: { shares: number; range: string; asOf: string; sources: string[]; india: string };
    search: { text: string; source: string };
    gap: string;
  };
  merch: {
    keffiyeh: { value: number; unit: string; what: string; source: string; via: string };
    hirbawi: { value: string; what: string; source: string; quote: string; quoteWho: string; quoteSource: string };
    catalogue: string[]; catalogueNote: string;
    india: { text: string; source: string };
    donations: string;
  };
  money: Array<{ id: string; label: string; value: number; unit: string; source: string; basis: string; note?: string }>;
  protest: {
    us: Array<{ label: string; value: number; plus?: boolean; source: string }>;
    offCampus: { text: string; source: string };
    abroad: Array<{ date: string; where: string; what: string; sources: string[] }>;
  };
  aid: Array<{ label: string; value: string; source: string; basis: string }>;
  election: { text: string; source: string };
  claims: Array<{ claim: string; verdict: Verdict; finding: string; sources: string[] }>;
  tests: Array<{ test: string; for: string; against: string; evidence: string }>;
  searches: string[];
}

/** The figures the essay computes from the register. */
export function derive(d: FpPublished) {
  const v = (id: string) => d.ledger.find((x) => x.id === id)!.value;
  const p = (label: RegExp) => d.protest.us.find((x) => label.test(x.label))!.value;
  const protests = p(/protests logged/i), damage = p(/property damage/i), injuries = p(/police injuries/i);
  const unrwa24 = d.money.find((m) => m.id === "unrwausa-2024")!.value;
  return {
    deadPerIsraeliKilled: v("dead") / v("oct7"),
    damageShare: damage / protests,
    injuryShare: injuries / protests,
    peacefulShare: 1 - damage / protests,
    unrwaShareOfRebuild: (unrwa24 * 1e6) / (v("rebuild") * 1e9),
    us20ShareOfRebuild: (d.money.find((m) => m.id === "us20")!.value * 1e6) / (v("rebuild") * 1e9),
    proConRatio: d.attention.platforms.map((x) => ({ platform: x.platform, ratio: x.pro / x.con })),
  };
}

/** Whole numbers in Indian grouping, or with M/K for very large counts. */
export const big = (n: number) => (n >= 1e6 ? `${(n / 1e6).toLocaleString("en-US", { maximumFractionDigits: 1 })}M` : n.toLocaleString("en-IN"));
