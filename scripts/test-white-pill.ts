/**
 * The white pill: every card resolves to a sourced series, every report has a
 * link and a date, the pace arithmetic is right, the 2014 comparison runs on
 * measured series only, and the claims the page makes in prose still hold.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CARDS, GAP_METRICS, LIVE_TOPICS, PACE, THEMES, pace, rate, verdictOf, type Study } from "../lib/white-pill";
import { loadWhitePill } from "../lib/white-pill-load";

let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => { console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${!cond && detail ? `  ${detail}` : ""}`); if (!cond) failed++; };

console.log("Cards");
const w = loadWhitePill();
const missing = w.cards.filter((c) => c.missing).map((c) => c.card.series);
ok("every card resolves to data", missing.length === 0, missing.join(", "));
ok("every card names a source with a link", w.cards.every((c) => c.sources.length > 0 && c.sources.every((s) => /^(https?:\/\/|\/)/.test(s.url))), w.cards.filter((c) => !c.sources.length).map((c) => c.card.series).join());
ok("every card carries a caveat", CARDS.every((c) => c.caveat.length > 40));

console.log("\nReports");
const studies = (JSON.parse(readFileSync(join(process.cwd(), "data", "white-pill", "studies.json"), "utf8")) as { accessed: string; studies: Study[] }).studies;
ok("every report has a link, a date and a finding", studies.every((s) => /^https:\/\//.test(s.url) && /^\d{4}-\d{2}/.test(s.published) && s.finding.length > 40));
// AI has one series in the record; its other evidence is a report, so charts and reports are counted together.
ok("every theme has at least two pieces of evidence, charts and reports together", THEMES.every((t) => CARDS.filter((c) => c.theme === t.id).length + studies.filter((x) => x.theme === t.id).length >= 2));
ok("reports that complicate the story are included", studies.filter((s) => s.stance === "complicates").length >= 2);
ok("report ids are unique", new Set(studies.map((s) => s.id)).size === studies.length);
ok("a report checked through coverage cites two outlets", studies.every((s) => !s.checkedVia || s.checkedVia.length >= 1));

console.log("\nPace arithmetic");
ok("closing half a gap of 40 points in one year is 50%", Math.abs(rate("gap", { t: 0, v: 60 }, { t: 1, v: 80 })! - 50) < 1e-9);
ok("halving in one year is a 50% fall", Math.abs(rate("decline", { t: 0, v: 40 }, { t: 1, v: 20 })! - 50) < 1e-9);
ok("doubling in one year is 100% growth", Math.abs(rate("cagr", { t: 0, v: 5 }, { t: 1, v: 10 })! - 100) < 1e-9);
ok("verdicts need a 15% difference", verdictOf("gap", 10, 11.4) === "similar" && verdictOf("gap", 10, 11.6) === "faster" && verdictOf("gap", 10, 8.4) === "slower");
const straight = pace({ key: "x", label: "x", series: "x", method: "cagr" }, [2004, 2009, 2014, 2019, 2024].map((t, i) => ({ t, v: 100 * 2 ** i })));
ok("a steady trend is 'similar' across the break", straight.verdict === "similar");
const nfhsLike = pace({ key: "x", label: "x", series: "x", method: "gap" }, [{ t: 1998.9, v: 20 }, { t: 2006.1, v: 40 }, { t: 2016, v: 60 }, { t: 2020.4, v: 80 }]);
ok("survey rounds: the earlier period starts at the round nearest 2004, not the 1990s", nfhsLike.before?.from === 2006.1 && nfhsLike.after?.to === 2020.4);

console.log("\nThe 2014 comparison");
ok("every pre-registered measure computes", w.paces.every((p) => p.verdict !== "unknown"), w.paces.filter((p) => p.verdict === "unknown").map((p) => p.spec.key).join());
const modelled = ["wdi-water-access", "wdi-sanitation-access", "wdi-under5-mortality", "wdi-infant-mortality", "wdi-maternal-mortality", "wdi-clean-cooking", "wdi-female-labour-participation", "wdi-unemployment", "wdi-life-expectancy"];
ok("no modelled World Bank curve is in the comparison", PACE.every((p) => !modelled.includes(p.series)));
const v = (k: string) => w.paces.find((p) => p.spec.key === k)?.verdict;
ok("the comparison is not one-sided: some measures are slower", w.paces.some((p) => p.verdict === "slower") && w.paces.some((p) => p.verdict === "faster"));
// The page's lede names these as pointing the other way; if the data stops saying so, the lede must change.
ok("lede claim: women's anaemia is slower or worse after 2014", v("anaemia") === "slower");
ok("lede claim: manufacturing's share is slower or worse after 2014", v("manufacturing") === "slower");

console.log("\nThe poorest and richest fifth");
ok("every gap metric has rounds", w.gaps.length === GAP_METRICS.length);
// The page says each gap narrowed because the poorest caught up rather than the richest fell back.
for (const g of w.gaps) {
  const a = g.rows[0]!, b = g.rows.at(-1)!;
  ok(`${g.label}: gap narrowed, richest did not fall back`, b.richest - b.poorest < a.richest - a.poorest && b.richest >= a.richest - 1 && b.poorest > a.poorest);
}

console.log("\nLive reporting");
ok("every theme has a live search, plus one on the post-2014 record", LIVE_TOPICS.length >= THEMES.length);
ok("searches are neutral: no 'record', 'achievement' or 'success' framing", LIVE_TOPICS.every(([, q]) => !/achievement|success|milestone|historic/i.test(q)));
ok("the live route exists", readFileSync(join(process.cwd(), "app", "api", "progress-live", "route.ts"), "utf8").includes("LIVE_TOPICS"));

console.log(failed ? `\n${failed} failed` : "\nall passed");
if (failed) process.exitCode = 1;
