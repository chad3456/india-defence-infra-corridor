/**
 * Reading the defence deals ledger from disk.
 *
 * Server-only: imports node:fs. The shapes a client component needs are in
 * lib/deals-shared.ts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Deals } from "./deals-shared";

export * from "./deals-shared";

const EMPTY: Deals = {
  present: false, builtAt: null,
  source: "", discovery: "", coverageWarning: "", fourMeasures: "", valueNote: "",
  articlesRead: [], articlesMissing: [], citedIds: 0, fetched: 0, dead: 0, notDefence: 0,
  withDate: 0, withValue: 0, ambiguous: 0, byMeasure: {}, deals: [],
};

export function loadDeals(): Deals {
  try {
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), "data/defence/deals.json"), "utf8"),
    ) as Partial<Deals> & { builtAt?: string };
    return { ...EMPTY, ...raw, present: (raw.deals?.length ?? 0) > 0 };
  } catch {
    return EMPTY;
  }
}
