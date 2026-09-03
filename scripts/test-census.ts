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
import { STATE_FACTS, mappingBaseline, readBias } from "../lib/census-shared";
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

/**
 * The mapping baseline decides whether a metric's leader is a real
 * concentration or just the best-mapped state, so a baseline that can be
 * moved by one metric makes every verdict on the page unreliable.
 *
 * That is not hypothetical: summing raw features let water wells — a quarter
 * of all features, 85% of them in one state — push Maharashtra's baseline to
 * 29%, after which its perfectly ordinary 12.8% of hospitals was reported as
 * under-representation. These cases hold the fix in place.
 */
console.log("\nmapping baseline");
{
  const st = (byState: Record<string, number>) => ({
    id: "m", total: Object.values(byState).reduce((a, b) => a + b, 0),
    byState, unplaced: 0, capped: false, fetchedAt: "",
  });

  // Ten ordinary metrics where A and B split the map evenly, plus one enormous
  // one that is almost all A. A must not run away with the baseline.
  const ordinary = Array.from({ length: 10 }, () => st({ A: 50, B: 50 }));
  const lopsided = st({ A: 100_000, B: 500 });
  const base = mappingBaseline([...ordinary, lopsided]);
  check("one huge metric cannot dominate the baseline",
    Math.abs((base.A ?? 0) - 0.5) < 0.02,
    `A baseline is ${(((base.A ?? 0)) * 100).toFixed(1)}%, expected about 50%`);
  check("baseline shares sum to one",
    Math.abs(Object.values(base).reduce((a, b) => a + b, 0) - 1) < 1e-9);

  // A state present in only one metric must not outrank one present in all.
  const sparse = mappingBaseline([st({ A: 10, B: 10 }), st({ A: 10, B: 10 }), st({ C: 10 })]);
  check("a state seen in one metric of three ranks below states seen in all",
    (sparse.C ?? 0) < (sparse.A ?? 0),
    `C ${((sparse.C ?? 0) * 100).toFixed(1)}% vs A ${((sparse.A ?? 0) * 100).toFixed(1)}%`);

  // The verdict itself. Ten states sharing the map evenly, so each has a 10%
  // baseline and a lift above 2.2x is actually reachable — with only two
  // states the highest possible lift is 2.0x and no metric could ever read as
  // a concentration, which is a property of the test, not of the data.
  const TEN = Object.fromEntries("ABCDEFGHIJ".split("").map((k) => [k, 10]));
  const flat = mappingBaseline(Array.from({ length: 10 }, () => st(TEN)));
  const proportional = readBias(st(TEN), flat);
  check("a leader at its own baseline reads as a mapping artifact",
    proportional?.verdict === "likely a mapping artifact",
    String(proportional?.verdict));
  const concentrated = readBias(st({ ...TEN, A: 500 }), flat);
  check("a leader far above its baseline reads as a real concentration",
    concentrated?.verdict === "a real concentration",
    `${concentrated?.verdict} at ${concentrated?.lift.toFixed(1)}x`);

  check("a metric with no features yields no reading",
    readBias(st({}), flat) === null);
}

console.log(bad === 0 ? "\nAll census tests passed." : `\n${bad} failing.`);
process.exit(bad === 0 ? 0 : 1);
