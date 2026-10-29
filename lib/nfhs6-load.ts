/**
 * NFHS-6 for the /malnutrition map, from the connector's committed files.
 * Node only. Joins the fact sheets' state names, and — once the district
 * compendiums have been read — their district names, to the map's districts.
 * A name that does not join is left out and counted, never guessed.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { stateKey } from "./malnutrition";
import type { Nfhs6Row, Nfhs6States } from "./nfhs6";

const DIR = join(process.cwd(), "data", "nfhs6");
const read = <T,>(f: string): T | null => (existsSync(join(DIR, f)) ? (JSON.parse(readFileSync(join(DIR, f), "utf8")) as T) : null);

export interface Nfhs6District { district: string; state: string; rows: Nfhs6Row[] }

/** District names as the two sources spell them, reduced to one key. */
export const districtKey = (state: string, district: string) => `${stateKey(state)}|${district.toLowerCase().replace(/\bdistrict\b/g, "").replace(/[^a-z]/g, "")}`;

export function loadNfhs6(mapDistricts: Array<{ id: string; name: string; state: string }>): {
  states: Nfhs6States | null;
  stateOf: Record<string, string>;
  districtRows: Record<string, Nfhs6Row[]> | null;
  unjoined: { states: string[]; districts: number };
} {
  const states = read<Nfhs6States>("states.json");
  const stateOf: Record<string, string> = {};
  const unjoinedStates: string[] = [];
  if (states) {
    const byKey = new Map(Object.keys(states.geos).filter((g) => g !== "India").map((g) => [stateKey(g), g]));
    for (const s of new Set(mapDistricts.map((d) => d.state))) {
      const g = byKey.get(stateKey(s));
      if (g) stateOf[s] = g; else unjoinedStates.push(s);
    }
  }
  const dist = read<{ geos: Record<string, Nfhs6District> }>("districts.json");
  let districtRows: Record<string, Nfhs6Row[]> | null = null;
  let unjoinedDistricts = 0;
  if (dist) {
    const byKey = new Map(Object.values(dist.geos).map((g) => [districtKey(g.state, g.district), g.rows]));
    districtRows = {};
    for (const d of mapDistricts) {
      const rows = byKey.get(districtKey(d.state, d.name));
      if (rows) districtRows[d.id] = rows;
    }
    unjoinedDistricts = byKey.size - Object.keys(districtRows).length;
  }
  return { states, stateOf, districtRows, unjoined: { states: unjoinedStates, districts: unjoinedDistricts } };
}
