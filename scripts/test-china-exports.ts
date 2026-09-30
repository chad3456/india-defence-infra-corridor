/**
 * `npm run test:china-exports`
 *
 * Holds the committed file to what the page says about it: every value is a
 * reported number or an explicit gap, the destinations add up to the world
 * total they are drawn from, and a derived share is a share.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PRODUCTS, type ChinaExports } from "../lib/china-exports-shared";

let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) failed++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok || !detail ? "" : `  (${detail})`}`);
}

console.log("\nThe product register");
check("every code is six digits", PRODUCTS.every((p) => /^\d{6}$/.test(p.code)));
check("no code appears twice", new Set(PRODUCTS.map((p) => p.code)).size === PRODUCTS.length);
check("every product with a start year says why in its note", PRODUCTS.filter((p) => p.since && p.since >= 2022).every((p) => !!p.note));

const FILE = join(process.cwd(), "data", "trade", "china-exports.json");
console.log("\nThe committed data");
if (!existsSync(FILE)) {
  console.log("  (no data/trade/china-exports.json yet — the ingest workflow writes it)");
} else {
  const d = JSON.parse(readFileSync(FILE, "utf8")) as ChinaExports;
  const known = new Set(PRODUCTS.map((p) => p.code));
  check("every product is in the register", d.products.every((p) => known.has(p.code)));
  check("no negative value anywhere", d.products.every((p) =>
    p.trend.every((t) => t.value === null || t.value >= 0) && p.partners.every((x) => x.value > 0)));
  check("trend years ascend without repeats", d.products.every((p) => p.trend.every((t, k) => k === 0 || t.year > p.trend[k - 1]!.year)));
  // The destinations are the world total, split. If they stop adding up, a
  // splitting dimension has escaped or a page of partners was lost.
  const off = d.products.filter((p) => {
    const world = p.trend.find((t) => t.year === p.partnerYear)?.value;
    if (!world || !p.partners.length) return false;
    const sum = p.partners.reduce((s, x) => s + x.value, 0);
    return sum < world * 0.9 || sum > world * 1.1;
  });
  check("destinations add up to the world total, within 10%", off.length === 0, off.map((p) => p.code).join(", "));
  const badShare = d.products.filter((p) => p.share && !(p.share.china > 0 && p.share.china <= p.share.world));
  check("China's share is between nothing and everything", badShare.length === 0, badShare.map((p) => p.code).join(", "));
  const noPartner = d.products.filter((p) => p.partnerYear !== null && p.partners.length === 0);
  check("a product with a partner year has partners", noPartner.length === 0, noPartner.map((p) => p.code).join(", "));
  console.log(`  (${d.products.length} products, latest year ${d.latestYear}, ${d.errors.length} errors in the run)`);
}

console.log(failed ? `\n${failed} failed\n` : "\nall passed\n");
process.exit(failed ? 1 : 0);
