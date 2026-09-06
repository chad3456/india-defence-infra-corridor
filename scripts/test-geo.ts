/**
 * Does the boundary file put states where they actually are?
 *
 * It did not. The topology's latitude scale was 0.0028752730 when it should
 * have been 0.0030357485, which compressed every latitude towards the origin
 * at 6.75 N by about 5.3% — a distortion that grows with distance north, from
 * 0.15 degrees in Kerala to 1.25 degrees at Chandigarh.
 *
 * Nothing failed. Large states absorbed the error, because a 125 km shift
 * still leaves a city well inside a state 500 km across. Small northern
 * territories did not: the Delhi polygon sat at 27.3-27.7 N when Delhi is at
 * 28.4-28.9, so every feature in the real Delhi was counted as Uttar Pradesh
 * and the atlas reported that a city of 16.8 million has four hospitals and no
 * cash machines. The number looked odd; nothing said it was wrong.
 *
 * So the file is now checked against places whose coordinates are not in
 * dispute. Longitude was already right and is checked too, since the next
 * corruption need not be on the same axis.
 */
import { readFileSync } from "node:fs";
import { feature } from "topojson-client";
import { geoContains, geoBounds } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";

let bad = 0;
function ok(name: string, cond: boolean, detail = ""): void {
  if (!cond) bad++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  " + detail}`);
}

/**
 * City centres and the state each is in. Chosen to span the full latitude
 * range, because the distortion this guards against was proportional to
 * latitude and a southern-only sample would have passed throughout.
 */
const CITIES: Array<[string, number, number, string]> = [
  ["Thiruvananthapuram", 76.937, 8.524, "Kerala"],
  ["Coimbatore", 76.956, 11.017, "Tamil Nadu"],
  ["Bengaluru", 77.594, 12.972, "Karnataka"],
  ["Panaji", 73.828, 15.496, "Goa"],
  ["Hyderabad", 78.486, 17.385, "Telangana"],
  ["Mumbai", 72.877, 19.076, "Maharashtra"],
  ["Bhubaneswar", 85.819, 20.296, "Odisha"],
  ["Raipur", 81.630, 21.251, "Chhattisgarh"],
  ["Kolkata", 88.363, 22.572, "West Bengal"],
  ["Ahmedabad", 72.571, 23.023, "Gujarat"],
  ["Bhopal", 77.412, 23.259, "Madhya Pradesh"],
  ["Ranchi", 85.310, 23.344, "Jharkhand"],
  ["Agartala", 91.287, 23.831, "Tripura"],
  ["Aizawl", 92.718, 23.727, "Mizoram"],
  ["Imphal", 93.938, 24.817, "Manipur"],
  ["Patna", 85.138, 25.594, "Bihar"],
  ["Shillong", 91.883, 25.579, "Meghalaya"],
  ["Kohima", 94.110, 25.674, "Nagaland"],
  ["Guwahati", 91.736, 26.144, "Assam"],
  ["Jaipur", 75.787, 26.912, "Rajasthan"],
  ["Lucknow", 80.947, 26.847, "Uttar Pradesh"],
  ["Itanagar", 93.610, 27.084, "Arunanchal Pradesh"],
  ["Gangtok", 88.606, 27.331, "Sikkim"],
  ["Gurugram", 77.026, 28.457, "Haryana"],
  // The one the distortion actually broke, and the reason this file exists.
  ["Delhi", 77.209, 28.614, "NCT of Delhi"],
  ["Dehradun", 78.032, 30.316, "Uttarakhand"],
  ["Chandigarh", 76.778, 30.733, "Chandigarh"],
  ["Ludhiana", 75.857, 30.901, "Punjab"],
  ["Shimla", 77.173, 31.104, "Himachal Pradesh"],
  ["Srinagar", 74.797, 34.084, "Jammu & Kashmir"],
];

const raw = JSON.parse(readFileSync("data/geo/india-states.topo.json", "utf8")) as
  Topology<{ india: GeometryCollection<{ name: string | null }> }>;
const states = feature(raw, raw.objects.india) as FeatureCollection<Geometry, { name: string | null }>;

console.log("\nBoundary file");
const b = geoBounds(states);
// India spans roughly 68.1E-97.4E and 6.7N-37.1N. A file that does not reach
// its own extremes has been clipped or rescaled.
ok("west edge is near 68.1 E", Math.abs(b[0][0] - 68.1) < 0.6, b[0][0].toFixed(2));
ok("east edge is near 97.4 E", Math.abs(b[1][0] - 97.4) < 0.6, b[1][0].toFixed(2));
ok("south edge is near 6.7 N", Math.abs(b[0][1] - 6.7) < 0.6, b[0][1].toFixed(2));
ok("north edge is near 37.1 N", Math.abs(b[1][1] - 37.1) < 0.6, b[1][1].toFixed(2));

console.log("\nCities land in their own state");
let hits = 0;
const misses: string[] = [];
for (const [city, lon, lat, want] of CITIES) {
  const got = states.features.find((f) => geoContains(f, [lon, lat]))?.properties?.name ?? null;
  if (got === want) hits++;
  else misses.push(`${city} -> ${got ?? "no state"} (want ${want})`);
}
ok(`all ${CITIES.length} cities resolve to their own state`, misses.length === 0,
  "\n         " + misses.join("\n         "));

// A coarse outline can miss a coastal point by a few kilometres, which is
// tolerable; being in the wrong state is not. This states the tolerance.
console.log("\nResolution");
ok("Chennai's centre is within 10 km of the coastline as drawn",
  (() => {
    for (let d = 0; d <= 0.1; d += 0.01) {
      if (states.features.some((f) => geoContains(f, [80.271 - d, 13.083]))) return true;
    }
    return false;
  })(),
  "the drawn coast is more than 10 km inland of Chennai");

if (bad > 0) { console.error(`\n${bad} geography test(s) failed.`); process.exit(1); }
console.log(`\nAll geography tests passed (${hits}/${CITIES.length} cities).`);
