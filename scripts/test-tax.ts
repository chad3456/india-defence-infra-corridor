/**
 * The income-tax essay: every figure cites a source that exists, low-confidence
 * inputs say so, and the arithmetic the page shows — slab tax, per-person and
 * per-item counts, shares — is right on cases worked by hand.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { derive, howMany, iconUnit, newRegimeTax, priceInr, type TaxPublished } from "../lib/tax";

let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => { console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${!cond && detail ? `  ${detail}` : ""}`); if (!cond) failed++; };
const d = JSON.parse(readFileSync(join(process.cwd(), "data", "tax", "published.json"), "utf8")) as TaxPublished;
const ids = new Set(d.sources.map((s) => s.id));

console.log("Sources");
ok("source ids are unique", ids.size === d.sources.length);
ok("every source has an https address, an access date and a tier", d.sources.every((s) => /^https:\/\//.test(s.url) && /^\d{4}-\d{2}-\d{2}$/.test(s.accessed) && [1, 2, 3].includes(s.tier)));
const cited = [d.pit.source, d.pit.netDirectSource, ...d.filers.map((f) => f.source), d.zeroLiability.source, d.filerShareOfPopulation.source, d.bands.source, d.croreFilers.source,
  ...d.budget.rows.map((r) => r.source), d.gst.source, d.gdp.source, d.population.india.source, d.population.us.source, d.fx.source, d.us.pit.source, d.us.pitGdp.source, d.us.whoPays.source,
  ...d.taxToGdp.rows.map((r) => r.source), d.slabs.source, ...d.items.map((i) => i.source), ...d.items.flatMap((i) => (i.context ? [i.context] : []))];
ok("every citation resolves", cited.every((c) => ids.has(c)), cited.filter((c) => !ids.has(c)).join(", "));
ok("every source is cited", d.sources.every((s) => cited.includes(s.id)), d.sources.filter((s) => !cited.includes(s.id)).map((s) => s.id).join(", "));
ok("low-confidence inputs carry a note", [d.bands, ...d.items].filter((x) => "confidence" in x && x.confidence === "low").every((x) => !!x.notes));
ok("income bands add to about 100%", Math.abs(d.bands.rows.reduce((a, r) => a + r.share, 0) - 100) < 0.5);
ok("filers in year order and rising", d.filers.every((f, i) => i === 0 || (f.year > d.filers[i - 1]!.year && f.value >= d.filers[i - 1]!.value)));
ok("zero-liability returns are fewer than returns", d.zeroLiability.zero < d.zeroLiability.filed);
ok("every item has a positive price", d.items.every((i) => priceInr(i, d.fx.value) > 0));

console.log("\nSlab arithmetic (new regime, salaried), worked by hand");
const t = (g: number) => newRegimeTax(g, d.slabs).total;
ok("₹12.75 lakh: nothing (taxable ₹12 lakh, rebate)", t(1275000) === 0);
ok("₹13 lakh: ₹26,000 (marginal relief caps ₹63,750 at ₹25,000, plus cess)", t(1300000) === 26000, String(t(1300000)));
ok("₹15 lakh: ₹97,500 (₹93,750 plus cess)", t(1500000) === 97500, String(t(1500000)));
ok("₹20 lakh: ₹1,92,400 (₹1,85,000 plus cess)", t(2000000) === 192400, String(t(2000000)));
ok("₹50 lakh: ₹10,99,800 (₹10,57,500 plus cess)", t(5000000) === 1099800, String(t(5000000)));
ok("tax never falls as salary rises", Array.from({ length: 190 }, (_, i) => 300000 + i * 25000).every((g, i, a) => i === 0 || t(g) >= t(a[i - 1]!)));

console.log("\nDerived figures");
const x = derive(d);
ok("per Indian = tax ÷ population", Math.abs(x.perIndian - (d.pit.value * 1e7) / (d.population.india.value * 1e6)) < 1);
ok("a day is a 365th of the year", Math.abs(x.perDay * 365 - x.pitRs) < 1);
ok("income tax's share of spending is between 0 and 1", x.incomeTaxShareOfSpending > 0 && x.incomeTaxShareOfSpending < 1);
ok("payers per 100 fewer than filers per 100", x.payersPer100 < x.filersPer100);
ok("howMany counts whole units", howMany(100, 30) === 3 && howMany(10, 0) === 0);
ok("icon unit keeps the chart between 4 and 40 icons", [3, 57, 999, 31025, 149698431].every((n) => { const u = iconUnit(n); return n / u <= 40 && (n <= 40 || n / u >= 4); }));

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
