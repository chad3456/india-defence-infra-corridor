/**
 * Markets and the rupee, as they stand when a reader asks. Cached for a minute.
 *
 * Index quotes come from Moneycontrol's public price feed, which carries the
 * exchanges' own prices and states whether the market is open. Currency rates
 * are the ECB's daily reference rates (via Frankfurter), cross-checked against
 * a second daily feed. A source that does not answer is returned as
 * unavailable with its reason — never filled from an earlier reading.
 *
 * Yahoo Finance was the first choice and answers "429 Too Many Requests" to
 * data-centre addresses (data/live/live-sources-probe.json), so it is not used.
 * No keyless source for Brent or gold answered, so commodities are not shown.
 */
import { NextResponse } from "next/server";
import { CURRENCIES, INDICES, parseFrankfurter, parseMoneycontrol, type IndexQuote } from "@/lib/live-shared";

export const revalidate = 60;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function json(url: string, ms = 6_000): Promise<{ ok: boolean; body?: unknown; error?: string }> {
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(ms), next: { revalidate } });
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
    return { ok: true, body: await r.json() };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.name : "fetch failed" }; }
}

export async function GET(): Promise<NextResponse> {
  const symbols = CURRENCIES.map((c) => c.code).join(",");
  const [indices, ecb, er] = await Promise.all([
    Promise.all(INDICES.map(async (i): Promise<IndexQuote> => {
      const r = await json(`https://priceapi.moneycontrol.com/pricefeed/notapplicable/inidicesindia/${encodeURIComponent(i.symbol)}`);
      return r.ok ? parseMoneycontrol(i.id, r.body) : { id: i.id, ok: false, error: r.error };
    })),
    json(`https://api.frankfurter.app/latest?from=INR&to=${symbols}`, 9_000),
    json("https://open.er-api.com/v6/latest/INR"),
  ]);
  const fx = ecb.ok ? parseFrankfurter(ecb.body) : { rates: [] };
  // A second, independent daily feed: if the two disagree by more than 1%, say so.
  const erRates = (er.body as { rates?: Record<string, number>; time_last_update_utc?: string } | undefined);
  const check = fx.rates.map((r) => { const o = erRates?.rates?.[r.code]; return o ? { code: r.code, other: 1 / o, gapPct: Math.abs(1 / o - r.inr) / r.inr * 100 } : null; }).filter(Boolean);
  return NextResponse.json({
    fetchedAt: new Date().toISOString(),
    indices,
    fx: { ...fx, source: "European Central Bank reference rates, via Frankfurter", ok: ecb.ok, error: ecb.error },
    fxCheck: { source: "ExchangeRate-API open feed", updated: erRates?.time_last_update_utc, rates: check },
    sources: [
      { publisher: "Moneycontrol price feed (NSE and BSE index prices)", url: "https://www.moneycontrol.com/markets/indian-indices/" },
      { publisher: "European Central Bank via Frankfurter", url: "https://www.frankfurter.app" },
      { publisher: "ExchangeRate-API (open access)", url: "https://www.exchangerate-api.com" },
    ],
    verified: false,
    note: "Live readings, cached for a minute and never stored. Currency rates are daily reference rates, not live trades.",
  });
}
