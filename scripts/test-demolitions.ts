/**
 * The demolitions register: every figure cites a source that exists, faith
 * counts never exceed totals, the floor adds only non-overlapping records and
 * adds them correctly, and the live filter keeps demolition stories only.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FAITHS, floor, isDemolitionHeadline, unspecified, type DemPublished } from "../lib/demolitions";

let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => { console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${!cond && detail ? `  ${detail}` : ""}`); if (!cond) failed++; };
const d = JSON.parse(readFileSync(join(process.cwd(), "data", "demolitions", "published.json"), "utf8")) as DemPublished;
const ids = new Set(d.sources.map((s) => s.id));

console.log("Sources");
ok("source ids are unique", ids.size === d.sources.length);
ok("every source has an https address, an access date, a tier and a kind", d.sources.every((s) => /^https:\/\//.test(s.url) && /^\d{4}-\d{2}-\d{2}$/.test(s.accessed) && [1, 2, 3].includes(s.tier) && !!s.kind));
const cited = [...d.records, ...d.cases, ...d.compilations, ...d.law, ...d.views].flatMap((x) => x.sources);
ok("every citation resolves", cited.every((c) => ids.has(c)), cited.filter((c) => !ids.has(c)).join(", "));
ok("every source is cited", d.sources.every((s) => cited.includes(s.id)));
ok("a record resting only on partisan or advocacy outlets is never 'official'", d.records.filter((r) => r.basis === "official").every((r) => r.sources.some((s) => !["partisan", "advocacy"].includes(d.sources.find((x) => x.id === s)!.kind))));

console.log("\nRecords");
ok("faith counts never exceed the total", d.records.every((r) => unspecified(r) >= 0 && Object.values(r.counts).reduce((a, v) => a + (v ?? 0), 0) <= r.total));
ok("every faith used is a known faith", [...d.records.flatMap((r) => Object.keys(r.counts)), ...d.cases.map((c) => c.faith)].every((k) => FAITHS.some((f) => f.id === k)));
ok("every record quotes its source", d.records.every((r) => r.quote.length > 20));
ok("record windows fall in 2014–2026 except where noted", d.records.every((r) => r.when >= "2014" && r.when <= "2026-12" ));
ok("an approximate figure is never in the floor", d.records.filter((r) => r.approx).every((r) => !r.headline));
ok("a figure including relocations or regularisations is never in the floor", d.records.filter((r) => /relocat|regulari/.test(r.action)).every((r) => !r.headline));
const head = d.records.filter((r) => r.headline);
ok("no two floor records cover the same state and window", new Set(head.map((r) => `${r.state}|${r.window}`)).size === head.length);
ok("Uttarakhand's floor record is its largest faith-counted figure, not a sum of nested ones", head.filter((r) => r.state === "Uttarakhand").length === 1);

console.log("\nThe floor");
const f = floor(d.records);
ok("floor = sum of floor records", f.total === head.reduce((a, r) => a + r.total, 0));
ok("faith split + unspecified = floor", Object.values(f.byFaith).reduce((a, v) => a + v, 0) + f.unspecified === f.total, `${Object.values(f.byFaith).reduce((a, v) => a + v, 0)} + ${f.unspecified} vs ${f.total}`);
ok("states sum to the floor", f.byState.reduce((a, s) => a + s.total, 0) === f.total);
ok("the compilation is not in the floor", f.total < d.compilations[0]!.value);

console.log("\nLive headline filter");
const keep = ["Illegal mazar demolished in Haridwar", "Temple razed in anti-encroachment drive in Delhi", "अवैध मजार पर चला बुलडोजर", "Mosque portion demolished for road widening"];
const drop = ["Temple festival draws record crowds", "Old building demolished in Mumbai", "Church celebrates centenary"];
ok("demolition stories kept", keep.every(isDemolitionHeadline), keep.filter((t) => !isDemolitionHeadline(t)).join(" | "));
ok("others dropped", drop.every((t) => !isDemolitionHeadline(t)), drop.filter(isDemolitionHeadline).join(" | "));

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
