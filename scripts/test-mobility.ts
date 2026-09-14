/**
 * The mobility datasets must contain the things everyone would look for.
 *
 * ── Why a list of names ──────────────────────────────────────────────────
 *
 * Because a count cannot catch what is missing. The airports file held 148
 * rows, every one of them a real airport, and did not include Indira Gandhi
 * International — India's busiest, and the first one any reader would check.
 * It was absent because the Overpass query asked for nodes and ways and not
 * relations, and IGI is mapped as a multipolygon. Nothing about 148 looks
 * wrong, and the statewise page reported that the National Capital Territory
 * has no airport.
 *
 * So these checks name specific things. A named fact is the only kind of check
 * that catches an absence, and the six busiest airports plus the four largest
 * metro systems are facts about India that no correct dataset omits.
 *
 * These are floors, not an inventory. Adding a name because you noticed it
 * missing is the intended use; removing one to make a run pass is not.
 */
import { existsSync, readFileSync } from "node:fs";

let bad = 0;
function ok(name: string, cond: boolean, detail = ""): void {
  if (!cond) bad++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  " + detail}`);
}

const AIRPORTS = "data/mobility/airports.json";
const METRO = "data/mobility/metro.json";
const STATIONS = "data/mobility/stations.json";

if (!existsSync(AIRPORTS)) {
  console.log("\n  skip  the mobility datasets are not built in this checkout.");
  process.exit(0);
}

console.log("\nThe airports everybody would look for");
{
  interface A { name: string; iata: string; lon: number; lat: number }
  const rows = JSON.parse(readFileSync(AIRPORTS, "utf8")) as A[];
  const codes = new Set(rows.map((a) => a.iata));
  // The six busiest by passenger traffic. Any of these missing means the query
  // is not asking for something it should.
  for (const [code, where] of [
    ["DEL", "Delhi, Indira Gandhi International — the busiest, and a relation in OSM"],
    ["BOM", "Mumbai, Chhatrapati Shivaji Maharaj International"],
    ["BLR", "Bengaluru, Kempegowda International"],
    ["MAA", "Chennai International"],
    ["HYD", "Hyderabad, Rajiv Gandhi International"],
    ["CCU", "Kolkata, Netaji Subhash Chandra Bose International"],
  ] as Array<[string, string]>) {
    ok(`${code} is present — ${where}`, codes.has(code));
  }
  ok("no IATA code appears twice", codes.size === rows.length,
    `${rows.length - codes.size} duplicates`);
  ok("every airport has a coordinate inside India's bounding box",
    rows.every((a) => a.lon > 65 && a.lon < 100 && a.lat > 5 && a.lat < 38),
    rows.filter((a) => !(a.lon > 65 && a.lon < 100 && a.lat > 5 && a.lat < 38))
      .slice(0, 3).map((a) => `${a.iata} ${a.lon},${a.lat}`).join(" / "));
}

console.log("\nThe metro systems everybody would look for");
{
  interface M { name: string; city: string | null }
  const rows = JSON.parse(readFileSync(METRO, "utf8")) as M[];
  const blob = rows.map((m) => `${m.name} ${m.city ?? ""}`).join(" | ").toLowerCase();
  // By the network's own name, not the city's. The first version of this
  // checked for "bengaluru" and failed — because the system is called Namma
  // Metro and OpenStreetMap tags it that way. That was the check being wrong
  // about India rather than the data being wrong, which is its own hazard: a
  // named-fact test is only as good as the fact it names.
  for (const [system, city] of [
    ["delhi metro", "Delhi"],
    ["mumbai metro", "Mumbai"],
    ["namma metro", "Bengaluru — the network is named Namma Metro"],
    ["chennai metro", "Chennai"],
    ["kolkata metro", "Kolkata"],
    ["hyderabad metro", "Hyderabad"],
  ] as Array<[string, string]>) {
    ok(`a line belongs to ${system} — ${city}`, blob.includes(system));
  }
}

console.log("\nThe stations everybody would look for");
{
  interface S { name: string; code: string }
  const rows = JSON.parse(readFileSync(STATIONS, "utf8")) as S[];
  const codes = new Set(rows.map((s) => s.code));
  for (const [code, name] of [
    ["NDLS", "New Delhi"],
    ["CSMT", "Chhatrapati Shivaji Maharaj Terminus"],
    ["HWH", "Howrah Junction"],
    ["MAS", "Chennai Central"],
  ] as Array<[string, string]>) {
    ok(`${code} is present — ${name}`, codes.has(code));
  }
}

console.log(bad === 0 ? "\nAll mobility checks passed.\n" : `\n${bad} check(s) failed.\n`);
process.exit(bad === 0 ? 0 : 1);
