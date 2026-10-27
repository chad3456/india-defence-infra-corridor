/**
 * The /space register: every figure traces to a source that exists and every
 * source is cited, the parts are the model's parts, the places sit where
 * their names say, the timeline is in order, and the arithmetic the page
 * labels derived is right.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ORIGINS, PART_ORDER, circularPeriodMin, circularSpeedKms, citedIds, searchParts, type SpacePublished } from "../lib/space-story";

let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => { console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${!cond && detail ? `  ${detail}` : ""}`); if (!cond) failed++; };
const d = JSON.parse(readFileSync(join(process.cwd(), "data", "space-story", "published.json"), "utf8")) as SpacePublished;
const ids = new Set(d.sources.map((s) => s.id));

console.log("Sources");
ok("source ids are unique", ids.size === d.sources.length);
ok("every source has an https address, a tier and a kind", d.sources.every((s) => /^https:\/\//.test(s.url) && [1, 2, 3].includes(s.tier) && ["official", "press", "reference"].includes(s.kind)));
ok("a publication date, where given, is a date no later than access", d.sources.every((s) => s.published === null || (/^\d{4}-\d{2}-\d{2}$/.test(s.published) && s.published <= d.accessed)));
const cited = citedIds(d);
ok("every citation resolves", cited.every((c) => ids.has(c)), cited.filter((c) => !ids.has(c)).join(", "));
ok("every source is cited somewhere", d.sources.every((s) => cited.includes(s.id)), d.sources.filter((s) => !cited.includes(s.id)).map((s) => s.id).join(", "));

console.log("\nParts");
ok("the parts are the model's parts, in its order", d.parts.map((p) => p.id).join() === PART_ORDER.join());
ok("every part has a known origin with a label and colour", d.parts.every((p) => ORIGINS.includes(p.origin)) && ORIGINS.every((o) => d.origins[o]?.label && /^#[0-9a-f]{6}$/i.test(d.origins[o].colour)));
ok("every part says what it does and what it is on NISAR, with a source", d.parts.every((p) => p.does.length > 30 && p.inNisar.length > 10 && p.sources.length > 0));
ok("a part's stat carries its own source", d.parts.every((p) => p.stat === null || (p.stat.value.length > 0 && ids.has(p.stat.source))));
ok("the reflector and boom stats match the register's lengths", part("reflector").stat?.value === `${d.nisar.reflectorM} m` && part("boom").stat?.value === `${d.nisar.boomM} m`);
ok("search finds the radar parts by band and nothing for nonsense", searchParts(d.parts, "band").has("lband") && searchParts(d.parts, "band").has("sband") && searchParts(d.parts, "zzzz").size === 0);

console.log("\nNISAR, places, timeline");
ok("NISAR's orbit is plausible: 700–800 km, 97–99° inclination", d.nisar.orbit.altitudeKm > 700 && d.nisar.orbit.altitudeKm < 800 && d.nisar.orbit.inclinationDeg > 97 && d.nisar.orbit.inclinationDeg < 99);
ok("deployment ends after it starts, and after launch", d.nisar.deployed.to >= d.nisar.deployed.from && d.nisar.deployed.from > d.nisar.launch.date);
ok("every place has real coordinates and a source", d.places.every((p) => Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180 && ids.has(p.source)));
ok("Sriharikota is on India's east coast", (() => { const s = d.places.find((p) => p.id === "shar"); return !!s && s.lat > 13 && s.lat < 14.5 && s.lon > 79.8 && s.lon < 80.6; })());
ok("timeline is in date order", d.timeline.every((e, i) => i === 0 || e.date >= d.timeline[i - 1]!.date));
ok("only events after the access date are marked next", d.timeline.every((e) => (e.tone === "next") === (e.date > d.accessed.slice(0, e.date.length))));
ok("fleet rows add up to the total", d.fleet.rows.reduce((a, r) => a + r.n, 0) === d.fleet.total, String(d.fleet.rows.reduce((a, r) => a + r.n, 0)));

console.log("\nDerived arithmetic");
const per = circularPeriodMin(d.nisar.orbit.altitudeKm), v = circularSpeedKms(d.nisar.orbit.altitudeKm);
ok("a 747 km circular orbit takes about 99.6 minutes", Math.abs(per - 99.6) < 0.2, per.toFixed(2));
ok("and moves at about 7.48 km/s", Math.abs(v - 7.48) < 0.02, v.toFixed(3));
ok("geostationary height gives a sidereal day", Math.abs(circularPeriodMin(35_786) - 1436.1) < 1.5, circularPeriodMin(35_786).toFixed(1));

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);

function part(id: string) { return d.parts.find((p) => p.id === id)!; }
