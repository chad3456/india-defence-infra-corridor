/**
 * The live tracker's parsers, against what the sources actually returned.
 *
 * The live routes read sources this sandbox cannot reach, so the parsers are
 * pinned to an answer the probe recorded, kept as a fixture
 * (scripts/__fixtures__/moneycontrol-nifty.json) so a later probe run that
 * records something else cannot take the test's input away.
 * The rules that matter most are the ones a live page is tempted to break: a
 * source that fails is unavailable, never a stale number; positions are
 * rounded; two aggregators seeing one aircraft count it once.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseFrankfurter, parseMoneycontrol, regionAircraft, splitOutlet, REGION } from "../lib/live-shared";

let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => { if (!cond) failed++; console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  " + detail}`); };

console.log("\nMarket quotes");
{
  const q = parseMoneycontrol("nifty", JSON.parse(readFileSync(join(process.cwd(), "scripts/__fixtures__/moneycontrol-nifty.json"), "utf8")));
  ok("Moneycontrol: price, previous close and change read", q.ok && q.price! > 1000 && q.previousClose! > 1000 && q.change != null, JSON.stringify(q));
  ok("the change reconciles with price minus previous close", Math.abs(q.price! - q.previousClose! - q.change!) < 0.05, `${q.price} - ${q.previousClose} vs ${q.change}`);
  ok("the exchange's own state and time are carried", !!q.marketState && !!q.updated);
}
ok("an empty answer is unavailable, not zero", parseMoneycontrol("x", {}).ok === false && parseMoneycontrol("x", { data: { pricecurrent: "" } }).ok === false);

const fx = parseFrankfurter({ date: "2026-10-12", rates: { USD: 0.010441, EUR: 0.009338 } });
ok("ECB rates per rupee are inverted to rupees per unit", Math.abs(fx.rates.find((r) => r.code === "USD")!.inr - 95.776) < 0.01, JSON.stringify(fx));
ok("a currency the answer lacks is left out, not guessed", !fx.rates.some((r) => r.code === "GBP"));

console.log("\nMilitary aircraft");
const feeds = [
  { id: "adsb.lol", ac: [{ hex: "a1", lat: 28.6139, lon: 77.209, flight: "IAF123 ", t: "C17", alt_baro: 31000, gs: 410.6 }, { hex: "b2", lat: 51.5, lon: -0.1 }, { hex: "c3", lat: 19.1, lon: 72.9, alt_baro: "ground" as const }] },
  { id: "adsb.fi", ac: [{ hex: "a1", lat: 28.6141, lon: 77.2088 }, { hex: "d4", lat: 12.9 }] },
];
const r = regionAircraft(feeds);
ok("only the region is kept", r.inRegion.length === 2 && r.inRegion.every((a) => a.lat >= REGION.south && a.lat <= REGION.north));
ok("one aircraft seen by both aggregators counts once, credited to both", r.inRegion.filter((a) => a.seenBy.length === 2).length === 1);
ok("positions are rounded to a tenth of a degree", r.inRegion.every((a) => Math.round(a.lat * 10) === a.lat * 10 && Math.round(a.lon * 10) === a.lon * 10));
ok("callsigns are trimmed and an aircraft on the ground says so", r.inRegion.some((a) => a.callsign === "IAF123") && r.inRegion.some((a) => a.alt === "ground"));
ok("an aircraft with no position is not placed", !r.inRegion.some((a) => Number.isNaN(a.lon)));
ok("worldwide counts are kept per aggregator", r.globalByFeed["adsb.lol"] === 3 && r.globalByFeed["adsb.fi"] === 2);
ok("no track history: the result carries no hex address", !JSON.stringify(r.inRegion).includes("hex"));

console.log("\nHeadlines");
ok("Google News titles split at the last ' - '", JSON.stringify(splitOutlet("RBI holds repo rate - a big decision - The Hindu")) === JSON.stringify({ title: "RBI holds repo rate - a big decision", outlet: "The Hindu" }));
ok("a short title is not split", splitOutlet("A - B").outlet === "");

console.log("\nThe live routes never store");
const routes = ["app/api/markets/route.ts", "app/api/military-live/route.ts", "app/api/news-live/route.ts"];
for (const f of routes) {
  const src = readFileSync(join(process.cwd(), f), "utf8");
  ok(`${f} writes nothing to disk`, !/writeFile|fs\.write|from "node:fs/.test(src));
  ok(`${f} labels its answer unverified`, /verified: false/.test(src));
}
void readdirSync; void statSync;

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
