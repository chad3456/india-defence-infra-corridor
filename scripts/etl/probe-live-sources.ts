/**
 * Which live sources answer, and in what shape, before the /live page relies
 * on them. `npm run live:probe`. Writes data/live/live-sources-probe.json.
 * Publishes nothing. Runs in Actions: the editing sandbox reaches none of them.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isEntryPoint } from "./lib/entry";

// The deployed routes themselves, to confirm production reads real data.
const SITES = ["https://india-defence-infra-corridor.vercel.app", "https://india-defence-infra-corridor-chhatgpt123-4291s-projects.vercel.app"];
const SOURCES: Array<[string, string]> = SITES.flatMap((site) => [
  [`prod markets ${site}`, `${site}/api/markets`],
  [`prod military ${site}`, `${site}/api/military-live`],
  [`prod news ${site}`, `${site}/api/news-live`],
] as Array<[string, string]>);

export async function run(): Promise<void> {
  const out: Array<Record<string, unknown>> = [];
  for (const [name, url] of SOURCES) {
    const t0 = Date.now();
    try {
      const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36", accept: "*/*" }, signal: AbortSignal.timeout(20_000) });
      const body = await r.text();
      const attrs = [...new Set([...body.matchAll(/data-(?:last-price|last-normal-market-timestamp|currency-code|exchange|tz-offset|is-crypto)="[^"]*"/g)].map((m) => m[0]))].slice(0, 20);
      const prev = /Previous close<\/div>[\s\S]{0,400}?>([\d,.]+)</.exec(body)?.[1];
      out.push({ name, url, status: r.status, ms: Date.now() - t0, bytes: body.length, cors: r.headers.get("access-control-allow-origin"), head: body.length < 6000 ? body : body.slice(0, 3000), attrs, previousClose: prev });
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
