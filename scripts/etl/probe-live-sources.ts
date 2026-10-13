/**
 * Which live sources answer, and in what shape, before the /live page relies
 * on them. `npm run live:probe`. Writes data/live/live-sources-probe.json.
 * Publishes nothing. Runs in Actions: the editing sandbox reaches none of them.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isEntryPoint } from "./lib/entry";

const SOURCES: Array<[string, string]> = [
  ["yahoo nifty", "https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?interval=5m&range=1d"],
  ["yahoo usdinr", "https://query1.finance.yahoo.com/v8/finance/chart/INR%3DX?interval=5m&range=1d"],
  ["yahoo brent", "https://query1.finance.yahoo.com/v8/finance/chart/BZ%3DF?interval=5m&range=1d"],
  ["yahoo query2 sensex", "https://query2.finance.yahoo.com/v8/finance/chart/%5EBSESN?interval=5m&range=1d"],
  ["er-api usd", "https://open.er-api.com/v6/latest/USD"],
  ["frankfurter", "https://api.frankfurter.app/latest?from=USD&to=INR,EUR,CNY"],
  ["adsb.lol mil", "https://api.adsb.lol/v2/mil"],
  ["adsb.fi mil", "https://opendata.adsb.fi/api/v2/mil"],
  ["gnews economy", "https://news.google.com/rss/search?q=India+economy+when:1d&hl=en-IN&gl=IN&ceid=IN:en"],
  ["gnews defence", "https://news.google.com/rss/search?q=India+defence+military+when:1d&hl=en-IN&gl=IN&ceid=IN:en"],
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
