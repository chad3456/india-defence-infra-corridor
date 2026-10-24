/**
 * The TBM register: every figure traces to a source that exists, sources
 * carry what the site requires of a source, the claims say how sure they are,
 * the machines' numbers are plausible, and the live headline filter keeps
 * tunnelling stories and drops other uses of "TBM".
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PART_ORDER, isTbmHeadline, type TbmPublished } from "../lib/tbm";

let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => { console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${!cond && detail ? `  ${detail}` : ""}`); if (!cond) failed++; };
const d = JSON.parse(readFileSync(join(process.cwd(), "data", "tbm", "published.json"), "utf8")) as TbmPublished;
const ids = new Set(d.sources.map((s) => s.id));

console.log("Sources");
ok("source ids are unique", ids.size === d.sources.length);
ok("every source has an https address, an access date, a tier and a provenance", d.sources.every((s) => /^https:\/\//.test(s.url) && /^\d{4}-\d{2}-\d{2}$/.test(s.accessed) && [1, 2, 3].includes(s.tier) && ["official", "press", "think-tank", "multilateral", "derived"].includes(s.provenance)));
ok("a publication date, where given, is a date no later than access", d.sources.every((s) => s.published === null || (/^\d{4}-\d{2}-\d{2}$/.test(s.published) && s.published <= s.accessed)));
const cited = [...d.claims.flatMap((c) => c.sources), ...d.controls.sources, ...d.machines.flatMap((m) => m.sources), ...d.makers.flatMap((m) => m.sources), ...d.timeline.flatMap((t) => t.sources), ...d.trade.sources, ...d.trade.context];
ok("every citation resolves", cited.every((c) => ids.has(c)), cited.filter((c) => !ids.has(c)).join(", "));
ok("every source is cited somewhere", d.sources.every((s) => cited.includes(s.id)), d.sources.filter((s) => !cited.includes(s.id)).map((s) => s.id).join(", "));

console.log("\nClaims and machines");
ok("every claim has a status, a quote and a check", d.claims.every((c) => ["stated", "confirmed", "reported"].includes(c.status) && c.quote.length > 20 && c.check.length > 20));
ok("a claim resting only on tier-3 sources is never 'confirmed'", d.claims.filter((c) => c.status === "confirmed").every((c) => c.sources.some((s) => d.sources.find((x) => x.id === s)!.tier < 3)));
ok("diameters are null or between 2 and 20 m", d.machines.every((m) => m.diameter === null || (m.diameter > 2 && m.diameter < 20)));
ok("counts are null or positive whole numbers", d.machines.every((m) => m.count === null || (Number.isInteger(m.count) && m.count > 0)));
ok("every machine carries the sentence it was read from", d.machines.every((m) => m.quote.length > 20));
ok("an origin other than 'unstated' says where", d.machines.filter((m) => m.origin !== "unstated").every((m) => !/^not stated/i.test(m.builtIn)));
ok("the parts are the stage's parts, in its order", d.parts.map((p) => p.id).join() === PART_ORDER.join());
ok("controls take effect after they are announced", d.controls.effective > d.controls.announced);
ok("timeline in date order; only future events marked ahead", d.timeline.every((e, i) => i === 0 || e.date >= d.timeline[i - 1]!.date) && d.timeline.every((e) => !e.future || e.date > d.accessed));
ok("trade values positive, with a caveat", d.trade.rows.every((r) => r.value > 0) && d.trade.caveat.length > 50);

console.log("\nLive headline filter");
const keep = ["India's largest TBM begins excavation for bullet train", "BEML to build tunnel boring machines in India", "China curbs tunnel boring machine exports, Indian metro projects hit", "मुंबई में टनल बोरिंग मशीन ने खुदाई शुरू की"];
const drop = ["TBM Energy posts quarterly loss", "Tunnel boring machine breaks record in Norway", "Delhi Metro fares to rise from Monday"];
ok("tunnelling stories about India kept", keep.every(isTbmHeadline), keep.filter((t) => !isTbmHeadline(t)).join(" | "));
ok("other TBMs and other subjects dropped", drop.every((t) => !isTbmHeadline(t)), drop.filter(isTbmHeadline).join(" | "));

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
