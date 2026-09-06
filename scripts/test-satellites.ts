/**
 * The orbital arithmetic, checked against things with known answers.
 *
 * Every function here produces a confident-looking number from any input, so
 * none of them fail loudly when they are wrong. A footprint radius off by a
 * factor is still a plausible number of kilometres; an elevation with the
 * wrong sign still renders. These cases pin them to values that can be
 * checked independently.
 */
import { readFileSync } from "node:fs";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import * as satellite from "satellite.js";
import {
  parseTle, tleEpoch, epochAgeDays, footprintRadiusKm,
  distanceKm, isOverIndia, elevationDegrees, EARTH_RADIUS_KM,
} from "../lib/satellites-shared";

let bad = 0;
function ok(name: string, cond: boolean, detail = ""): void {
  if (!cond) bad++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  " + detail}`);
}
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

/* A real ISS element set. Epoch is 2024 day 100.5 = 2024-04-09T12:00Z. */
const ISS = [
  "ISS (ZARYA)",
  "1 25544U 98067A   24100.50000000  .00016717  00000+0  30777-3 0  9993",
  "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.49810350 12345",
].join("\n");

console.log("\nTLE parsing");
{
  const sats = parseTle(ISS);
  ok("one satellite from one triple", sats.length === 1, `got ${sats.length}`);
  ok("name is read", sats[0]?.name === "ISS (ZARYA)");
  ok("NORAD id is read from line 1", sats[0]?.noradId === 25544, String(sats[0]?.noradId));

  // A truncated set is not a partially usable orbit.
  ok("a triple missing line 2 is dropped",
    parseTle("ISS (ZARYA)\n1 25544U 98067A   24100.50000000  .00016717  00000+0  30777-3 0  9993").length === 0);
  ok("blank input yields nothing", parseTle("").length === 0);
  ok("two satellites parse as two",
    parseTle(ISS + "\n" + ISS.replace("25544", "25545")).length === 2);
}

console.log("\nepoch");
{
  const e = tleEpoch(ISS.split("\n")[1]!);
  ok("epoch decodes to the right instant",
    e?.toISOString() === "2024-04-09T12:00:00.000Z", String(e?.toISOString()));
  // The pivot at 57 is Sputnik: 57 means 1957, 56 means 2056.
  ok("two-digit year pivots at 57",
    tleEpoch("1 00001U 00001A   57001.00000000  .00000000  00000+0  00000+0 0  9990")
      ?.getUTCFullYear() === 1957);
  ok("years under 57 are this century",
    tleEpoch("1 00001U 00001A   24001.00000000  .00000000  00000+0  00000+0 0  9990")
      ?.getUTCFullYear() === 2024);
  const age = epochAgeDays(ISS.split("\n")[1]!, new Date("2024-04-19T12:00:00Z"));
  ok("age is measured in days", near(age ?? -1, 10, 1e-6), String(age));
  ok("a malformed line has no epoch", tleEpoch("nonsense") === null);
}

console.log("\nfootprint");
{
  // arccos(6371/6921) = 0.4014 rad -> 2557 km. Independently checkable.
  ok("550 km gives a ~2,560 km horizon radius",
    near(footprintRadiusKm(550), 2557, 15), footprintRadiusKm(550).toFixed(0));
  // Geostationary sees roughly a third of the planet: half-angle ~81.3 deg.
  ok("geostationary sees about a third of the globe",
    near(footprintRadiusKm(35786), 9054, 60), footprintRadiusKm(35786).toFixed(0));
  ok("a satellite on the ground sees nothing", footprintRadiusKm(0) === 0);
  ok("higher always sees further", footprintRadiusKm(800) > footprintRadiusKm(400));
}

console.log("\ndistance");
{
  // Delhi to Chennai is about 1,760 km.
  const d = distanceKm([77.209, 28.614], [80.271, 13.083]);
  ok("Delhi to Chennai is about 1,760 km", near(d, 1760, 40), d.toFixed(0));
  ok("a point is no distance from itself", distanceKm([77, 28], [77, 28]) === 0);
  // Antipodes are half the circumference.
  ok("antipodes are half a circumference apart",
    near(distanceKm([0, 0], [180, 0]), Math.PI * EARTH_RADIUS_KM, 1));
}

console.log("\nelevation");
{
  const overhead = { lon: 77.209, lat: 28.614, altKm: 500 };
  ok("directly overhead is 90 degrees",
    near(elevationDegrees([77.209, 28.614], overhead), 90, 0.01),
    elevationDegrees([77.209, 28.614], overhead).toFixed(2));

  // At the edge of the footprint the satellite is exactly on the horizon.
  const r = footprintRadiusKm(500);
  const edgeLat = 28.614 + (r / EARTH_RADIUS_KM) * (180 / Math.PI);
  const atEdge = elevationDegrees([77.209, 28.614], { lon: 77.209, lat: edgeLat, altKm: 500 });
  ok("at the footprint edge it sits on the horizon", near(atEdge, 0, 0.5), atEdge.toFixed(2));

  // Beyond it, below the horizon — the sign is what makes "visible" mean
  // something, so it must be negative rather than merely small.
  const beyond = elevationDegrees([77.209, 28.614], { lon: 77.209, lat: edgeLat + 10, altKm: 500 });
  ok("past the footprint it is below the horizon", beyond < 0, beyond.toFixed(2));

  // Higher is always higher in the sky from the same ground offset.
  const low = elevationDegrees([77, 28], { lon: 78, lat: 28, altKm: 400 });
  const high = elevationDegrees([77, 28], { lon: 78, lat: 28, altKm: 800 });
  ok("a higher satellite sits higher in the sky", high > low, `${low.toFixed(1)} vs ${high.toFixed(1)}`);
}

console.log("\nover India");
{
  const t = JSON.parse(readFileSync("data/geo/india-states.topo.json", "utf8")) as
    Topology<{ india: GeometryCollection<{ name: string | null }> }>;
  const states = feature(t, t.objects.india) as FeatureCollection<Geometry, { name: string | null }>;

  ok("a point over Delhi resolves to a state", isOverIndia(77.209, 28.614, states) !== null,
    String(isOverIndia(77.209, 28.614, states)));
  // Five kilometres inland of Chennai's centre. The outline is simplified and
  // draws the coast about that far in, so a sub-satellite point on the
  // shoreline itself can read as sea. At 7.7 km/s that is under a second of
  // flight, which is the accuracy this claim is good for — stated here rather
  // than discovered later.
  ok("a point over Chennai resolves to Tamil Nadu",
    isOverIndia(80.20, 13.083, states) === "Tamil Nadu",
    String(isOverIndia(80.20, 13.083, states)));
  ok("a point over the mid-Atlantic is not over India", isOverIndia(-30, 0, states) === null);
  ok("a point over Beijing is not over India", isOverIndia(116.4, 39.9, states) === null);
  // Just outside the west coast: sea, not India.
  ok("a point in the Arabian Sea is not over India", isOverIndia(68.0, 18.0, states) === null);
}

console.log("\nSGP4 end to end");
{
  const sats = parseTle(ISS);
  const rec = satellite.twoline2satrec(sats[0]!.line1, sats[0]!.line2);
  const when = new Date("2024-04-09T12:30:00Z");
  const pv = satellite.propagate(rec, when);
  ok("propagation returns a position",
    pv != null && typeof pv.position !== "boolean");
  if (pv != null && typeof pv.position !== "boolean") {
    const gmst = satellite.gstime(when);
    const geo = satellite.eciToGeodetic(pv.position, gmst);
    const altKm = geo.height;
    const lat = satellite.degreesLat(geo.latitude);
    const lon = satellite.degreesLong(geo.longitude);
    // The ISS orbits at roughly 400-430 km and never leaves +/-51.6 degrees,
    // which is its inclination. Both are properties of this orbit, not of the
    // instant, so they hold whenever the propagation is right.
    ok("altitude is in the ISS band", altKm > 380 && altKm < 440, altKm.toFixed(1));
    ok("latitude is within the orbital inclination",
      Math.abs(lat) <= 51.7, lat.toFixed(2));
    ok("longitude is a real longitude", lon >= -180 && lon <= 180, lon.toFixed(2));
  }
}

if (bad > 0) { console.error(`\n${bad} satellite test(s) failed.`); process.exit(1); }
console.log("\nAll satellite tests passed.");
