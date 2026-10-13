/**
 * Which live sources answer, and in what shape, before the /live page relies
 * on them. `npm run live:probe`. Writes data/live/live-sources-probe.json.
 * Publishes nothing. Runs in Actions: the editing sandbox reaches none of them.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isEntryPoint } from "./lib/entry";

const SOURCES: Array<[string, string]> = [
  ["stooq nifty", "https://stooq.com/q/l/?s=^nsei&f=sd2t2ohlcvp&h&e=csv"],
  ["stooq multi", "https://stooq.com/q/l/?s=^nsei+^bsesn+cb.f+gc.f+ng.f+usdinr+eurinr+^spx&f=sd2t2ohlcvp&h&e=csv"],
  ["stooq intraday nifty", "https://stooq.com/q/d/l/?s=^nsei&i=5"],
  ["moneycontrol nifty", "https://priceapi.moneycontrol.com/pricefeed/notapplicable/inidicesindia/in%3BNSX"],
  ["moneycontrol sensex", "https://priceapi.moneycontrol.com/pricefeed/notapplicable/inidicesindia/in%3BSEN"],
  ["google finance nifty", "https://www.google.com/finance/quote/NIFTY_50:INDEXNSE"],
  ["google finance brent", "https://www.google.com/finance/quote/BZW00:NYMEX"],
  ["yahoo spark", "https://query1.finance.yahoo.com/v7/finance/spark?symbols=%5ENSEI&range=1d&interval=5m"],
  ["er-api inr", "https://open.er-api.com/v6/latest/INR"],
];

export async function run(): Promise<void> {
  const out: Array<Record<string, unknown>> = [];
  for (const [name, url] of SOURCES) {
    const t0 = Date.now();
    try {
      const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36", accept: "*/*" }, signal: AbortSignal.timeout(20_000) });
      const body = await r.text();
      out.push({ name, url, status: r.status, ms: Date.now() - t0, bytes: body.length, cors: r.headers.get("access-control-allow-origin"), head: body.slice(0, 1200) });
      console.log(`  ${r.status} ${name} ${body.length}b`);
    } catch (e) {
      out.push({ name, url, status: 0, error: String(e) });
      console.log(`  ERR ${name} ${e}`);
    }
  }
  await mkdir(join(process.cwd(), "data", "live"), { recursive: true });
  await writeFile(join(process.cwd(), "data", "live", "live-sources-probe.json"), JSON.stringify({ probedAt: new Date().toISOString(), sources: out }, null, 1) + "\n", "utf8");
}

if (isEntryPoint(import.meta.url)) run().catch((e) => { console.error(e); process.exit(1); });
