/**
 * The station matcher.
 *
 * A route drawn to the wrong city is worse than a route not drawn, so these
 * cases pin the refusals as hard as the hits. The null-code case is the one
 * that matters most: an absent code compared with `===` against another absent
 * code is a match, and it would place a train at whichever station happened to
 * be first in the file.
 */
import { buildMatcher } from "../lib/station-match";

const stations = [
  { name: "New Delhi", code: "NDLS", lon: 77.22, lat: 28.64 },
  { name: "Krantivira Sangolli Rayanna Railway Station", code: "SBC", lon: 77.57, lat: 12.98 },
  { name: "Chhatrapati Shivaji Maharaj Terminus", code: "CSMT", lon: 72.83, lat: 18.94 },
  { name: "Varanasi Junction", code: "BSB", lon: 82.98, lat: 25.32 },
  { name: "Solapur", code: "SUR", lon: 75.9, lat: 17.66 },
  { name: "Nanded", code: "NED", lon: 77.32, lat: 19.15 },
  { name: "Howrah Junction", code: "HWH", lon: 88.34, lat: 22.58 },
  { name: "Mysore Road", code: null, lon: 77.52, lat: 12.94 },
  { name: "Pul Bangash", code: null, lon: 77.21, lat: 28.67 },
];

let bad = 0;
function eq(q: string, want: string | null): void {
  const got = buildMatcher(stations).find(q);
  const gn = got ? got.name : null;
  if (gn === want) console.log(`  ok   ${JSON.stringify(q).padEnd(38)} -> ${JSON.stringify(gn)}`);
  else { bad++; console.log(`  FAIL ${JSON.stringify(q).padEnd(38)} -> ${JSON.stringify(gn)} (wanted ${JSON.stringify(want)})`); }
}

console.log("resolves the renames");
eq("KSR Bengaluru", "Krantivira Sangolli Rayanna Railway Station");
eq("Mumbai CSMT", "Chhatrapati Shivaji Maharaj Terminus");
eq("Hazur Sahib Nanded", "Nanded");
eq("New Delhi railway station", "New Delhi");
eq("New Delhi (NDLS)", "New Delhi");
eq("Varanasi", "Varanasi Junction");

console.log("\nrefuses rather than guessing");
// The live failure this encodes: Mysuru Junction is absent from the gazetteer,
// and "Mysore Road" is a different city's suburban stop 140 km away.
eq("Mysuru Junction", null);
eq("Madgaon Junction", null);
eq("Gomti Nagar", null);
eq("Some Place That Does Not Exist", null);
eq("", null);

console.log("\nan absent code never matches another absent code");
eq("(  )", null);
eq("Nowhere ()", null);

console.log(bad === 0 ? "\nAll station-matching tests passed." : `\n${bad} failing.`);
process.exit(bad === 0 ? 0 : 1);
