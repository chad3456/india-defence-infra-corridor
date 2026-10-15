/**
 * The commerce.gov.in front end's own API, read out of its bundle and called
 * the way the page calls it. Finds the endpoint behind "Data-Related Releases"
 * and records what one answer looks like. Writes data/ministry/commerce-api-probe.json.
 *
 * The header the bundle sends is public — it ships to every visitor's
 * browser inside the page's JavaScript — and is read from the bundle at run
 * time rather than written here.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getText } from "./lib/http";

const OUT = join(process.cwd(), "data", "ministry", "commerce-api-probe.json");
const BASE = "https://www.commerce.gov.in/ministryofcommerce/";

async function main() {
  const home = await getText("https://www.commerce.gov.in/", { timeoutMs: 45_000, retries: 1, cacheMs: 0 });
  const src = home.data?.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];
  const js = src ? (await getText(`https://www.commerce.gov.in${src}`, { timeoutMs: 60_000, retries: 1, cacheMs: 0 })).data ?? "" : "";
  const queries = [...new Set([...js.matchAll(/query:\s*\(?[^)]*\)?\s*=>\s*(?:\(\{\s*url:\s*)?[`"']([^`"']{3,200})[`"']/g)].map((m) => m[1]!))];
  const keys = [...new Set([...js.matchAll(/set\("apiKey",\s*"([^"]+)"\)/g)].map((m) => m[1]!))];
  const drr = [...js.matchAll(/.{0,300}(?:drr|data-related|dataRelated|data_related).{0,300}/gi)].map((m) => m[0]).slice(0, 30);
  console.log(`bundle ${src}: ${queries.length} queries, ${keys.length} keys`);
  const calls: unknown[] = [];
  const cands = queries.filter((q) => /press|release|drr|data/i.test(q)).slice(0, 25);
  for (const q of cands) {
    const url = BASE + q.replace(/^\//, "").replace(/\$\{[^}]+\}/g, "1");
    for (const key of [undefined, ...keys.slice(0, 1)]) {
      await new Promise((r) => setTimeout(r, 1200));
      const res = await getText(url, { timeoutMs: 45_000, retries: 0, cacheMs: 0, headers: key ? { apiKey: key } : {} });
      calls.push({ q, url, withKey: !!key, ok: res.ok, status: res.error, bytes: res.data?.length, head: res.data?.slice(0, 3000) });
      console.log(`  ${url} key=${!!key}: ${res.ok ? res.data?.length : res.error}`);
      if (res.ok) break;
    }
  }
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({ probedAt: new Date().toISOString(), bundle: src, queries, keyCount: keys.length, drr, calls }, null, 1));
}
main().catch((e) => { console.error(e); });

/* ── The PIB API the commerce site uses for its general releases ───────── */
async function pib() {
  const home = await getText("https://www.commerce.gov.in/", { timeoutMs: 45_000, retries: 1, cacheMs: 0 });
  const src = home.data?.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];
  const js = src ? (await getText(`https://www.commerce.gov.in${src}`, { timeoutMs: 60_000, retries: 1, cacheMs: 0 })).data ?? "" : "";
  const around = [...js.matchAll(/.{0,600}(?:apipibcommerce|Getsearch|getreldescription|Gettop15daysrel).{0,600}/g)].map((m) => m[0]).slice(0, 12);
  const base = "https://archive.pib.gov.in/apipibcommerce/api/";
  const tries = [
    `${base}Gettop15daysrel`,
    `${base}Getsearch?searchtext=foreign%20trade`,
    `${base}Getsearch?search=India%27s%20Foreign%20Trade`,
    `${base}Getsearch?keyword=foreign%20trade&fromdate=01/01/2005&todate=31/12/2005`,
  ];
  const calls: unknown[] = [];
  for (const u of tries) {
    await new Promise((r) => setTimeout(r, 1500));
    const res = await getText(u, { timeoutMs: 45_000, retries: 0, cacheMs: 0 });
    calls.push({ url: u, ok: res.ok, status: res.error, bytes: res.data?.length, head: res.data?.slice(0, 2500) });
    console.log(`  ${u}: ${res.ok ? res.data?.length : res.error}`);
  }
  const out = join(process.cwd(), "data", "ministry", "pib-api-probe.json");
  await writeFile(out, JSON.stringify({ probedAt: new Date().toISOString(), around, calls }, null, 1));
}
pib().catch((e) => console.error(e));
