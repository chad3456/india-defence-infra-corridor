/**
 * /space-programme: every figure traces to a source and every source is
 * cited, the rockets' drawings fill their published heights, the milestones
 * are in order, and the derived day counts are right.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { citedIds, daysBetween, layout, sharesSum, type ProgrammePublished } from "../lib/space-programme";

let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => { console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${!cond && detail ? `  ${detail}` : ""}`); if (!cond) failed++; };
const d = JSON.parse(readFileSync(join(process.cwd(), "data", "space-programme", "published.json"), "utf8")) as ProgrammePublished;
const ids = new Set(d.sources.map((s) => s.id));

console.log("Sources");
ok("source ids are unique", ids.size === d.sources.length);
ok("every source is https, with a tier", d.sources.every((s) => /^https:\/\//.test(s.url) && [1, 2, 3].includes(s.tier)));
ok("publication dates are no later than access", d.sources.every((s) => s.published === null || s.published <= d.accessed));
const cited = citedIds(d);
ok("every citation resolves", cited.every((c) => ids.has(c)), [...new Set(cited.filter((c) => !ids.has(c)))].join(", "));
ok("every source is cited", d.sources.every((s) => cited.includes(s.id)), d.sources.filter((s) => !cited.includes(s.id)).map((s) => s.id).join(", "));

console.log("\nRockets");
ok("seven rockets", d.rockets.length === 7);
for (const r of d.rockets) {
  ok(`${r.name}: stages fill its height`, Math.abs(sharesSum(r) - 1) < 1e-9, sharesSum(r).toFixed(3));
  const top = Math.max(...layout(r).filter((p) => p.stage.role !== "strapon").map((p) => p.y1));
  ok(`${r.name}: drawn ${top.toFixed(2)} m tall, its published ${r.heightM} m`, Math.abs(top - r.heightM) < 1e-6);
  ok(`${r.name}: strap-ons are shorter than the rocket`, layout(r).filter((p) => p.stage.role === "strapon").every((p) => p.y1 < r.heightM));
  ok(`${r.name}: height, payload and story are sourced`, r.heightSources.length > 0 && r.payloadSources.length > 0 && r.storySources.length > 0 && r.stages.every((s) => s.sources.length > 0));
}
ok("heights are plausible (15–60 m) and GSLV is the tallest", d.rockets.every((r) => r.heightM > 15 && r.heightM < 60) && d.rockets.reduce((a, b) => (b.heightM > a.heightM ? b : a)).id === "gslv");
ok("an approximate height says so", d.rockets.filter((r) => r.heightApprox).every((r) => r.id === "vikram1"));
ok("a stage's propellant mass is a positive number or absent", d.rockets.every((r) => r.stages.every((s) => s.propellantT === null || s.propellantT > 0)));

console.log("\nMilestones and missions");
ok("milestones are in date order", d.milestones.every((m, i) => i === 0 || m.date >= d.milestones[i - 1]!.date));
ok("only events after access are 'next', and a window carries a label", d.milestones.every((m) => (m.tone === "next") === (m.date > d.accessed.slice(0, m.date.length)) && (m.date.length > 7 || m.tone !== "next" || !!m.label)));
ok("Chandrayaan-3: 40 days from launch to landing", daysBetween(d.missions.moon.launch, d.missions.moon.landed) === 40);
ok("Mars Orbiter: 323 days from launch to Mars orbit", daysBetween(d.missions.mars.launch, d.missions.mars.arrived) === 323);
ok("Aditya-L1 arrived after it launched", d.missions.sun.arrived > d.missions.sun.launch);
ok("mission costs rest on named sources", d.missions.moon.costSources.length > 0 && d.missions.mars.costSources.length > 0);

console.log("\nCentres");
ok("every centre is inside India's bounding box", d.centres.every((c) => c.lat > 6 && c.lat < 37 && c.lon > 68 && c.lon < 98));
ok("every centre lists at least one unit and a source", d.centres.every((c) => c.units.length > 0 && ids.has(c.source)));

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
