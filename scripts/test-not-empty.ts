/**
 * No committed dataset may be empty.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 *
 * On 14 September a scheduled mobility run got no airports back from Overpass
 * and wrote `[]` over a file holding 148 of them. The connector had recorded
 * the failure — "mobility: no airports returned" had been in that file all
 * along — and written the empty array anyway. The commit went through, and
 * every downstream join silently became zero: the front page's airport layer
 * dropped from 144 placed across 29 states to nothing, with no error anywhere,
 * because an empty list is a perfectly valid list.
 *
 * The connector is fixed so an empty result cannot overwrite a non-empty file.
 * This is the backstop, because that fix protects one connector and the same
 * shape of failure is available to every other one. Nothing here knows what
 * the right count is; it only knows that zero is never it.
 *
 * ── Why a floor rather than an exact count ───────────────────────────────
 *
 * A floor is checkable without being a second copy of the data. These numbers
 * are deliberately far below the real counts — they are there to catch a file
 * that has collapsed, not to pin it. Raising one because a dataset grew is
 * fine; lowering one to make a run pass is the thing this file exists to stop.
 */
import { existsSync, readFileSync } from "node:fs";

let bad = 0;
function ok(name: string, cond: boolean, detail = ""): void {
  if (!cond) bad++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  " + detail}`);
}

/** file → [path into the JSON, floor]. A bare "" means the root is the array. */
const FLOORS: Array<[string, string, number]> = [
  ["data/mobility/airports.json", "", 100],
  ["data/mobility/metro.json", "", 50],
  ["data/mobility/stations.json", "", 5000],
  ["data/mobility/vande-bharat.json", "", 1],
  ["data/sacred/atlas.json", "sites", 2000],
  ["data/sacred/disputed.json", "entries", 1000],
  ["data/global/drones.json", "types", 10],
  ["data/global/drones.json", "countries", 30],
  ["data/geo/state-layers.json", "layers", 3],
  ["data/geo/ascii-india.json", "grid", 20],
  ["data/defence/deals.json", "deals", 10],
  ["data/pillars/pillars.json", "literacyByState", 25],
];

function at(file: string, path: string): unknown {
  const raw: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (path === "") return raw;
  return (raw as Record<string, unknown>)[path];
}

console.log("\nNo committed dataset has collapsed to nothing");
for (const [file, path, floor] of FLOORS) {
  if (!existsSync(file)) {
    // A dataset that has never been built is a different state from one that
    // emptied itself, and only the second is a fault.
    console.log(`  skip  ${file} is not built in this checkout`);
    continue;
  }
  let n = -1;
  try {
    const v = at(file, path);
    n = Array.isArray(v) ? v.length : -1;
  } catch (err) {
    ok(`${file}${path ? ` → ${path}` : ""} parses`, false, String(err).slice(0, 90));
    continue;
  }
  ok(`${file}${path ? ` → ${path}` : ""} holds at least ${floor}`, n >= floor,
    n < 0 ? "not an array" : `${n} rows`);
}

console.log(bad === 0 ? "\nAll datasets are populated.\n" : `\n${bad} dataset(s) have collapsed.\n`);
process.exit(bad === 0 ? 0 : 1);
