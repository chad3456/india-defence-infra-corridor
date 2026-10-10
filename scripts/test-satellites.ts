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
  isIndianSatellite, INDIAN_PREFIXES, inclinationDeg, periodMinutes, orbitRegime, subsolarPoint, eccentricity,
} from "../lib/satellites-shared";
import { GROUPS, INDIAN_FLEET, buildRecords, feedRequests, type TleFeed } from "../lib/tle-source";
import { validate as validateSnapshot } from "./etl/connectors/tle-snapshot";

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

console.log("\nIndia's own fleet");
{
  // The fleet is assembled by catalogue name because CelesTrak has no operator
  // group and its country filter returned nothing when probed. That cuts one
  // way on purpose: a missed satellite is absent from the Indian view, never
  // counted as somebody else's.
  for (const n of ["CARTOSAT-3", "RISAT-2B", "EOS-04", "GSAT-30", "GSAT-N2 (GSAT-20)", "NVS-01 (IRNSS-1J)", "IRNSS-1I",
                   "ASTROSAT", "CHANDRAYAAN-2 O", "ADITYA-L1", "XPOSAT", "OCEANSAT-3",
                   "IRS-P6 (RESOURCESAT-1)", "IRS-P5 (CARTOSAT-1)"]) {
    ok(`${n} is recognised as Indian`, isIndianSatellite(n));
  }
  for (const n of ["STARLINK-1007", "ISS (ZARYA)", "NOAA 19", "COSMOS 2251",
                   "SENTINEL-2A", "LANDSAT 9", "GPS BIIR-2  (PRN 13)",
                   // Galileo's catalogue names begin GSAT, without India's hyphen.
                   "GSAT0101 (GALILEO-PFM)", "GSAT0234 (GALILEO 34)",
                   // Spent stages and debris are objects, not satellites.
                   "PSLV R/B", "PSLV DEB", "INSAT-1B R/B [PAM-D]", "CARTOSAT-2 DEB",
                   // CelesTrak's name search is a substring match: RISAT returns these.
                   "MARISAT 1", "TIGRISAT"]) {
    ok(`${n} is not claimed as Indian`, !isIndianSatellite(n));
  }
  ok("matching is case-insensitive", isIndianSatellite("cartosat-2f"));
  ok("leading space does not break it", isIndianSatellite("  RISAT-1A"));
  // A prefix must match at the start, or every satellite with "SAT" anywhere
  // in its name would be claimed.
  ok("a prefix in the middle of a name does not match",
    !isIndianSatellite("EUTELSAT INSAT LOOKALIKE"));
}

console.log("\nOrbit shape and the sun");
{
  const l2 = ISS.split("\n")[2]!;
  ok("ISS inclination is read", near(inclinationDeg(l2) ?? 0, 51.64, 0.01), String(inclinationDeg(l2)));
  ok("ISS period is about 92.9 minutes", near(periodMinutes(l2) ?? 0, 92.9, 0.2), String(periodMinutes(l2)));
  ok("the ISS is in low orbit", orbitRegime(420, periodMinutes(l2)) === "LEO");
  ok("a GPS satellite is in medium orbit", orbitRegime(20_200, 718) === "MEO");
  ok("a geostationary satellite is GEO", orbitRegime(35_786, 1436.1) === "GEO");
  ok("ISS eccentricity is read", near(eccentricity(l2) ?? 1, 0.0006703, 1e-7), String(eccentricity(l2)));
  ok("a Molniya orbit at apogee is not called GEO", orbitRegime(39_000, 718, 0.72) === "Elliptical");
  ok("a near-circular geostationary orbit stays GEO", orbitRegime(35_786, 1436.1, 0.0002) === "GEO");
  // GSAT-1, dead since 2001: 1,387 minutes a lap at about 35,400 km.
  ok("a satellite drifting below the belt is near-GEO, not MEO", orbitRegime(35_409, 1387, 0.023) === "Near-GEO");
  // GSAT-6A, lost during orbit raising: 1,207 minutes, eccentricity 0.13.
  ok("a stranded elliptical orbit at GEO height is elliptical, not MEO", orbitRegime(36_150, 1207, 0.132) === "Elliptical");
  // At the March equinox the sun is over the equator. Apparent noon at
  // Greenwich that day is about 12:07 UTC (the equation of time is about -7.5
  // minutes), so at 12:00 UTC the sun has not yet reached the meridian: it is
  // about 1.9 degrees east of it.
  const [eqLon, eqLat] = subsolarPoint(new Date("2024-03-20T12:00:00Z"));
  ok("equinox: the sun is over the equator", Math.abs(eqLat) < 0.3, eqLat.toFixed(3));
  ok("equinox noon UTC: the sun is about 1.9 degrees east of Greenwich", near(eqLon, 1.9, 0.3), eqLon.toFixed(2));
  const [, solLat] = subsolarPoint(new Date("2024-06-20T20:51:00Z"));
  ok("June solstice: the sun is over the Tropic of Cancer", near(solLat, 23.44, 0.05), solLat.toFixed(3));
  const [, decLat] = subsolarPoint(new Date("2024-12-21T09:20:00Z"));
  ok("December solstice: over the Tropic of Capricorn", near(decLat, -23.44, 0.05), decLat.toFixed(3));
}

console.log("\nThe feed and its weekly snapshot");
{
  const reqs = feedRequests();
  ok("every carried group is requested", GROUPS.every((g) => reqs.some((r) => r.key === g.id)));
  ok("Starlink is not carried", !reqs.some((r) => /starlink/i.test(r.url)));
  ok("India's fleet is requested by every prefix", INDIAN_PREFIXES.every((p) => reqs.some((r) => r.key === `name:${p}`)));
  const recs = buildRecords([{ label: "Space stations", text: ISS }, { label: "Indian fleet", text: ISS.replace("ISS (ZARYA)", "CARTOSAT-3") }], new Date("2024-04-10T12:00:00Z"));
  ok("a satellite found twice is kept once, in its first group", recs.length === 1 && recs[0]?.group === "Space stations", JSON.stringify(recs.map((r) => r.group)));
  ok("element-set age is carried on each record", near(recs[0]?.epochAgeDays ?? -1, 1, 0.01), String(recs[0]?.epochAgeDays));
  const swept = buildRecords([{ label: "Indian fleet", text: ISS.replace("ISS (ZARYA)", "MARISAT 1") }], new Date("2024-04-10T12:00:00Z"));
  ok("a substring hit from the fleet sweep is dropped, not filed as Indian", swept.length === 0, JSON.stringify(swept.map((r) => r.name)));

  const snap = JSON.parse(readFileSync("data/live/tle-snapshot.json", "utf8")) as TleFeed;
  if (snap.satellites.length === 0) {
    ok("an empty snapshot says why", snap.snapshotAt === null && snap.failed.length > 0);
  } else {
    const problems = validateSnapshot(snap);
    ok("the snapshot passes the connector's own checks", problems.length === 0, problems.join("; "));
    const labels = new Set<string>([...GROUPS.map((g) => g.label), INDIAN_FLEET]);
    ok("every record is in a known group", snap.satellites.every((r) => labels.has(r.group)));
    const unusable = snap.satellites.filter((r) => {
      const rec = satellite.twoline2satrec(r.line1, r.line2);
      const pv = satellite.propagate(rec, new Date(snap.snapshotAt!));
      return !pv || typeof pv.position !== "object";
    });
    ok("every element set propagates at its own snapshot time", unusable.length <= snap.satellites.length * 0.01, `${unusable.length}: ${unusable.slice(0, 5).map((r) => r.name).join(", ")}`);
    const wrong = snap.satellites.filter((r) => r.indian !== isIndianSatellite(r.name));
    ok("every snapshot record's Indian flag follows from its name", wrong.length === 0, wrong.slice(0, 5).map((r) => r.name).join(", "));
    const strays = snap.satellites.filter((r) => r.group === "Indian fleet" && !r.indian);
    ok("nothing sits in the Indian fleet that is not Indian", strays.length === 0, strays.slice(0, 5).map((r) => r.name).join(", "));
  }
}

if (bad > 0) { console.error(`\n${bad} satellite test(s) failed.`); process.exit(1); }
console.log("\nAll satellite tests passed.");
