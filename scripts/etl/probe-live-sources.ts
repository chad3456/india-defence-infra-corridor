/**
 * Which live sources answer, and in what shape, before the /live page relies
 * on them. `npm run live:probe`. Writes data/live/live-sources-probe.json.
 * Publishes nothing. Runs in Actions: the editing sandbox reaches none of them.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isEntryPoint } from "./lib/entry";

const SOURCES: Array<[string, string]> = [
  ["moneycontrol nifty", "https://priceapi.moneycontrol.com/pricefeed/notapplicable/inidicesindia/in%3BNSX"],
  ["moneycontrol banknifty", "https://priceapi.moneycontrol.com/pricefeed/notapplicable/inidicesindia/in%3Bnbx"],
  ["moneycontrol vix", "https://priceapi.moneycontrol.com/pricefeed/notapplicable/inidicesindia/in%3BIDXN"],
  ["google finance nifty", "https://www.google.com/finance/quote/NIFTY_50:INDEXNSE"],
  ["google finance usdinr", "https://www.google.com/finance/quote/USD-INR"],
  ["google finance brent", "https://www.google.com/finance/quote/BZW00:NYMEX"],
  ["google finance gold", "https://www.google.com/finance/quote/GCW00:COMEX"],
  ["google finance vix", "https://www.google.com/finance/quote/INDIAVIX:INDEXNSE"],
];

export async function run(): Promise<void> {
  const out: Array<Record<string, unknown>> = [];
  for (const [name, url] of SOURCES) {
    const t0 = Date.now();
    try {
      const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36", accept: "*/*" }, signal: AbortSignal.timeout(20_000) });
      const body = await r.text();
      const attrs = [...new Set([...body.matchAll(/data-(?:last-price|last-normal-market-timestamp|currency-code|exchange|tz-offset|is-crypto)="[^"]*"/g)].map((m) => m[0]))].slice(0, 20);
      const prev = /Previous close<\/div>[\s\S]{0,400}?>([\d,.]+)</.exec(body)?.[1];
      out.push({ name, url, status: r.status, ms: Date.now() - t0, bytes: body.length, cors: r.headers.get("access-control-allow-origin"), head: body.length < 6000 ? body : body.slice(0, 300), attrs, previousClose: prev });
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
