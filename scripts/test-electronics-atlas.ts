/**
 * The electronics atlas measures what it says it measures.
 *
 * The catalogue is checked offline against the HS reference: every code must
 * exist, and the word each entry names must appear in its official
 * description, so a mistyped code cannot quietly measure a different product.
 * The ingested data, when present, is checked for the ways a trade table goes
 * wrong without crashing: a share over 100%, a country larger than the world,
 * a leader list out of order, a year that is mostly gaps.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CATALOGUE, SECTORS } from "../lib/electronics-catalogue";
import type { ElectronicsAtlas } from "../lib/electronics-atlas-shared";

let bad = 0;
function ok(name: string, cond: boolean, detail = ""): void {
  if (!cond) bad++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond || !detail ? "" : "  " + detail}`);
}

console.log("catalogue");
const universe = JSON.parse(readFileSync(join(process.cwd(), "data", "trade", "hs6-universe.json"), "utf8")) as { names: Record<string, string> };
ok("at least 200 lines", CATALOGUE.length >= 200, String(CATALOGUE.length));
ok("codes are unique", new Set(CATALOGUE.map((c) => c.hs)).size === CATALOGUE.length);
ok("codes are six digits", CATALOGUE.every((c) => /^\d{6}$/.test(c.hs)));
const missing = CATALOGUE.filter((c) => !universe.names[c.hs]).map((c) => c.hs);
ok("every code is in the HS reference", missing.length === 0, missing.join(", "));
const wrong = CATALOGUE.filter((c) => universe.names[c.hs] && !universe.names[c.hs]!.toLowerCase().includes(c.key.toLowerCase())).map((c) => `${c.hs} (${c.key})`);
ok("every entry's key word is in its official description", wrong.length === 0, wrong.join(", "));
for (const s of SECTORS) ok(`sector "${s.label}" has at least 5 lines`, CATALOGUE.filter((c) => c.sector === s.id).length >= 5);
ok("the AI supply chain is marked", CATALOGUE.filter((c) => c.ai).length >= 10);

console.log("\ningested data");
const file = join(process.cwd(), "data", "trade", "electronics-atlas.json");
if (!existsSync(file)) console.log("  (not yet generated)");
else {
  const d = JSON.parse(readFileSync(file, "utf8")) as ElectronicsAtlas;
  const lines = Object.values(d.lines);
  ok("at least half the catalogue lines have data (runs resume until all do)", lines.length >= CATALOGUE.length * 0.5, `${lines.length}/${CATALOGUE.length}`);
  ok("a recent year", d.year >= new Date().getUTCFullYear() - 3, String(d.year));
  ok("China and India never exceed the world", lines.every((l) => l.china <= l.world + 1 && l.india <= l.world + 1), lines.filter((l) => l.china > l.world + 1 || l.india > l.world + 1).map((l) => l.hs).join(","));
  ok("leaders are in descending order", lines.every((l) => l.top.every((t, i) => i === 0 || t.value <= l.top[i - 1]!.value)));
  ok("enough reporters behind each world total", lines.filter((l) => l.reporters >= 30).length >= lines.length * 0.9, lines.filter((l) => l.reporters < 30).map((l) => `${l.hs}:${l.reporters}`).join(" "));
  ok("India's imports from China never exceed its imports from the world", lines.every((l) => !l.indiaImports || l.indiaImports.world === null || l.indiaImports.china === null || l.indiaImports.china <= l.indiaImports.world * 1.001));
  const phone = d.lines["851713"];
  ok("smartphones: China leads and India is a top-10 exporter", !!phone && phone.chinaRank === 1 && (phone.indiaRank ?? 99) <= 10, JSON.stringify(phone && { c: phone.chinaRank, i: phone.indiaRank }));
  ok("official names travel with the data", Object.keys(d.officialNames).length >= CATALOGUE.length * 0.95);
}

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
