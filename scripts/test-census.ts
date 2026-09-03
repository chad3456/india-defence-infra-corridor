/**
 * Every mapped state must have a denominator.
 *
 * The boundary file and the census disagree about seven spellings -- "NCT of
 * Delhi" for Delhi, "Jammu & Kashmir" for Jammu and Kashmir, and the file's own
 * typo "Arunanchal Pradesh" -- and a name that fails to resolve does not error.
 * It drops that state out of every per-capita and per-area view, silently. A
 * density map of India missing Delhi looks perfectly fine.
 */
import { readFileSync } from "node:fs";
import { feature } from "topojson-client";
import { STATE_FACTS } from "../lib/census-shared";
import { CENSUS_SPECS, CENSUS_GROUPS } from "../lib/census-specs";

let bad = 0;
function check(name: string, ok: boolean, detail?: string): void {
  if (ok) console.log(`  ok   ${name}`);
  else { bad++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}

const topo = JSON.parse(readFileSync("data/geo/india-states.topo.json", "utf8"));
const fc = feature(topo, topo.objects.india) as unknown as {
  features: Array<{ properties?: { name?: string | null } }>;
};
const polygons = fc.features.map((f) => f.properties?.name ?? "").filter(Boolean);

console.log("denominators");
const missing = polygons.filter((n) => !(n in STATE_FACTS));
check("every boundary polygon has population and area", missing.length === 0, missing.join(", "));

const unused = Object.keys(STATE_FACTS).filter((n) => !polygons.includes(n));
check("no population entry matches nothing on the map", unused.length === 0, unused.join(", "));

console.log("\nplausibility");
const pops = Object.values(STATE_FACTS).map((f) => f.pop);
const total = pops.reduce((a, b) => a + b, 0);
// 2011 census total was ~1.21bn; these 36 units should land near it.
check("populations sum to roughly the 2011 census total",
  total > 1.15e9 && total < 1.27e9, `${(total / 1e9).toFixed(3)}bn`);
check("no zero or negative population", pops.every((p) => p > 0));
check("no zero or negative area", Object.values(STATE_FACTS).every((f) => f.areaKm2 > 0));

console.log("\nmetric specs");
const ids = new Set(CENSUS_SPECS.map((s) => s.id));
check("metric ids are unique", ids.size === CENSUS_SPECS.length);
check("every metric sits in a declared group",
  CENSUS_SPECS.every((s) => (CENSUS_GROUPS as readonly string[]).includes(s.group)));
check("every metric has an Overpass filter", CENSUS_SPECS.every((s) => s.filter.trim().startsWith("[")));

console.log(bad === 0 ? "\nAll census tests passed." : `\n${bad} failing.`);
process.exit(bad === 0 ? 0 : 1);
