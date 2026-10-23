/**
 * Spatial India: the parsers read the API's shapes, outlines simplify without
 * collapsing, and — the rule that matters — a value the API flags as
 * estimated never reaches the map.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { geometryOf, idOf, rowsOf, simplifyRing, valuesIn, type SpatialDistricts, type SpatialValues } from "../lib/spatial-india";
import { indicatorValues } from "../lib/spatial-india-map";

let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => { console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${!cond && detail ? `  ${detail}` : ""}`); if (!cond) failed++; };

console.log("Parsers");
ok("rows found inside the API's envelope", rowsOf({ meta: {}, total: 2, districts: [{ objectid: 1 }, { objectid: 2 }] }).length === 2 && rowsOf([{ a: 1 }]).length === 1 && rowsOf({ x: 1 }).length === 0);
ok("districts addressed by objectid before any other code", idOf({ objectid: 7, dist_lgd: "465", id: 9 }) === "7" && idOf({ dist_lgd: "465" }) === "465");
const ring: number[][] = [];
for (let i = 0; i <= 200; i++) { const a = (i / 200) * 2 * Math.PI; ring.push([77 + 0.3 * Math.cos(a), 28 + 0.2 * Math.sin(a)]); }
ring[200] = ring[0]!;
const s = simplifyRing(ring, 0.004);
ok("a closed ring simplifies to a closed ring, not to four points", s.length > 8 && s.length < 100 && JSON.stringify(s[0]) === JSON.stringify(s.at(-1)), String(s.length));
const g = geometryOf({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [ring, [[77, 28], [77.0001, 28], [77, 28.0001], [77, 28]]] } }] });
ok("a hole smaller than the tolerance is dropped; the outline stays", g?.type === "Polygon" && g.coordinates.length === 1);
ok("an outline that vanishes is no outline", geometryOf({ type: "Polygon", coordinates: [[[77, 28], [77.0001, 28], [77, 28.0001], [77, 28]]] }) === null);
const v = valuesIn({ objectid: 1, indicators: [{ id: "a", value: 5, estimated: true }, { id: "b", value: null }], c: 7, d: { value: 2, estimated: false }, z: 9 }, new Set(["a", "b", "c", "d"]));
const sorted = (o: object) => JSON.stringify(Object.entries(o).sort());
ok("values read from every shape the API might use, with their estimated flags; others ignored", sorted(v) === sorted({ a: [5, true], b: [null, false], c: [7, false], d: [2, false] }), JSON.stringify(v));

const dir = join(process.cwd(), "data", "spatial-india");
if (existsSync(join(dir, "values.json"))) {
  console.log("\nThe committed files");
  const vals = JSON.parse(readFileSync(join(dir, "values.json"), "utf8")) as SpatialValues;
  const dists = JSON.parse(readFileSync(join(dir, "districts.json"), "utf8")) as SpatialDistricts;
  const ids = new Set(dists.rows.map(idOf));
  ok("every value is a number or null with a true/false estimated flag", Object.values(vals.values).every((r) => Object.values(r).every((x) => Array.isArray(x) && (x[0] === null || typeof x[0] === "number") && typeof x[1] === "boolean")));
  ok("every district with values is a district", Object.keys(vals.values).every((d) => ids.has(d)));
  ok("every indicator names its source", vals.indicators.every((i) => !!i.id && !!i.name && !!i.source));
  ok("the attribution the licence requires is on record", (vals.meta.attribution?.length ?? 0) > 0);
  const est = vals.indicators.find((i) => Object.values(vals.values).some((r) => r[i.id]?.[1] === true));
  if (est) {
    const served = indicatorValues(est.id)!;
    const flagged = Object.entries(vals.values).filter(([, r]) => r[est.id]?.[1] === true).map(([d]) => d);
    ok(`no estimated value is served for the map (${est.id})`, flagged.every((d) => !(d in served.values)) && served.estimated === flagged.length);
  }
}
if (existsSync(join(dir, "outlines.json"))) {
  const outlines = JSON.parse(readFileSync(join(dir, "outlines.json"), "utf8")) as Record<string, { type: string; coordinates: unknown[] }>;
  ok("outlines are polygons with real rings", Object.values(outlines).every((o) => (o.type === "Polygon" || o.type === "MultiPolygon") && o.coordinates.length > 0));
}

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
