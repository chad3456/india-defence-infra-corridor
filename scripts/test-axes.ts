/**
 * The 12-axis test: the questionnaire's balance and neutrality rules, the
 * scoring arithmetic, share codes, and the V-Party anchors — including the
 * direction of every V-Party scale, checked against cases not in dispute.
 */
import { AXES, ITEMS, MIN_ANSWERS, combine, decodeProfile, describe, encodeProfile, mixedOrder, scoreAll, scoreAxis, type Answers } from "../lib/axes";
import { ANCHOR_MAP, anchorScores, governingParty } from "../lib/axes-anchors";
import { loadVParty } from "../lib/axes-load";

let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => { console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${!cond && detail ? `  ${detail}` : ""}`); if (!cond) failed++; };

console.log("The questionnaire");
ok("twelve axes, distinct ids", AXES.length === 12 && new Set(AXES.map((a) => a.id)).size === 12);
ok("eight statements per axis, four for each pole", AXES.every((a) => { const its = ITEMS.filter((i) => i.axis === a.id); return its.length === 8 && its.filter((i) => i.key < 0).length === 4; }));
ok("no statement repeats", new Set(ITEMS.map((i) => i.text.toLowerCase())).size === ITEMS.length);
const names = /\b(India|Pakistan|China|America|United States|Britain|Europe|Russia|Israel|Hindu|Muslim|Christian|Sikh|BJP|Congress|Republican|Democrat|Labour|Tory|Modi|Trump|Biden|Putin|Xi)\b/i;
ok("no statement names a country, party, person or particular faith", ITEMS.every((i) => !names.test(i.text)), ITEMS.filter((i) => names.test(i.text)).map((i) => i.id).join());
const loaded = /\b(evil|stupid|naive|extremist|radical|fascist|communist|woke|elite-loving|nanny state|so-called)\b/i;
ok("no statement uses loaded words", ITEMS.every((i) => !loaded.test(i.text)), ITEMS.filter((i) => loaded.test(i.text)).map((i) => i.id).join());
ok("statements are single sentences of reasonable length", ITEMS.every((i) => i.text.length <= 120 && /\.$/.test(i.text)));
ok("mixed order is a fixed permutation of all statements", mixedOrder().length === ITEMS.length && new Set(mixedOrder().map((i) => i.id)).size === ITEMS.length && mixedOrder()[0]!.id === mixedOrder()[0]!.id);

console.log("\nScoring");
const all = (v: number): Answers => Object.fromEntries(ITEMS.map((i) => [i.id, v]));
ok("agreeing with everything scores 0 on every axis (acquiescence cancels)", scoreAll(all(2)).every((s) => s.score === 0));
ok("disagreeing with everything scores 0 too", scoreAll(all(-2)).every((s) => s.score === 0));
const right: Answers = Object.fromEntries(ITEMS.map((i) => [i.id, i.key > 0 ? 2 : -2]));
ok("strongly for every right-keyed statement and against every left-keyed one is +100", scoreAll(right).every((s) => s.score === 100));
const half: Answers = Object.fromEntries(ITEMS.map((i) => [i.id, i.key > 0 ? 1 : -1]));
ok("mild answers give ±50", scoreAll(half).every((s) => s.score === 50));
const three: Answers = Object.fromEntries(ITEMS.filter((i) => i.axis === "economy").slice(0, MIN_ANSWERS - 1).map((i) => [i.id, 2]));
ok(`fewer than ${MIN_ANSWERS} answers leaves an axis unscored`, scoreAxis("economy", three).score === null);
const oneSide: Answers = Object.fromEntries(ITEMS.filter((i) => i.axis === "economy" && i.key > 0).map((i) => [i.id, 2]));
ok("answers on only one side of an axis leave it unscored", scoreAxis("economy", oneSide).score === null && /one side/.test(scoreAxis("economy", oneSide).why ?? ""));
const withNull: Answers = { ...right, "economy-1": null, "economy-5": null };
ok("'no record' is left out, not counted as the middle", scoreAxis("economy", withNull).score === 100 && scoreAxis("economy", withNull).answered === 6);
ok("sourced answers are counted", scoreAxis("economy", right, { "economy-1": "https://example.org", "economy-2": " " }).cited === 1);
ok("bands are words for distance, not ideology", describe(AXES[0]!, 10) === "Centre" && describe(AXES[0]!, -60) === "Clearly collective" && describe(AXES[0]!, 90) === "Strongly market");
const pooled = combine([scoreAll(right), scoreAll(half), scoreAll(all(0))]);
ok("several raters: mean and range", pooled.every((p) => p.mean === 50 && p.min === 0 && p.max === 100 && p.raters === 3));

console.log("\nShare codes");
const prof = { v: 1 as const, kind: "leader" as const, subject: "A leader, Prime Minister 2020–", answers: { ...half, "trade-3": null }, evidence: { "economy-2": "https://example.org/budget-speech" }, rater: "Rater ✓", at: "2026-10-31" };
const back = decodeProfile(encodeProfile(prof));
ok("a profile survives encoding", !!back && back.subject === prof.subject && back.rater === prof.rater && back.answers["trade-3"] === null && back.answers["economy-1"] === -1 && back.evidence["economy-2"] === prof.evidence["economy-2"]);
ok("a full link decodes as well as a bare code", !!decodeProfile(`https://x.test/political-axes#p=${encodeProfile(prof)}`));
ok("rubbish does not decode", decodeProfile("not-a-code") === null && decodeProfile("") === null);

console.log("\nV-Party anchors");
const vp = loadVParty();
ok("the V-Party extract is committed", !!vp);
if (vp) {
  const P = vp.parties;
  ok("1,500+ coded parties in 150+ countries", P.length >= 1500 && new Set(P.map((p) => p.country)).size >= 150, `${P.length} parties`);
  for (const m of ANCHOR_MAP) for (const k of m.vars) {
    const vals = P.map((p) => p.v[k]).filter((x): x is number => typeof x === "number");
    const top = Math.max(...vals);
    ok(`${k}: present, inside its ${m.range.join("–")} scale, and reaching near its top (${top})`, vals.length > 1000 && vals.every((x) => x >= m.range[0] - 0.01 && x <= m.range[1] + 0.01) && top >= m.range[0] + 0.85 * (m.range[1] - m.range[0]));
  }
  const raw = vp.file.parties;
  const corr = (a: string, b: string) => {
    const pr = raw.map((p) => [p.v[a], p.v[b]] as const).filter(([x, y]) => typeof x === "number" && typeof y === "number") as Array<[number, number]>;
    const mx = pr.reduce((s, [x]) => s + x, 0) / pr.length, my = pr.reduce((s, [, y]) => s + y, 0) / pr.length;
    let c = 0, vx = 0, vy = 0;
    for (const [x, y] of pr) { c += (x - mx) * (y - my); vx += (x - mx) ** 2; vy += (y - my) ** 2; }
    return c / Math.sqrt(vx * vy);
  };
  ok("pluralism components run against V-Dem's anti-pluralism index (higher = more pluralist)", ["v2paplur_osp", "v2paminor_osp", "v2paviol_osp"].every((k) => corr(k, "v2xpa_antiplural") < -0.5));
  ok("populism components run with V-Dem's populism index", ["v2paanteli_osp", "v2papeople_osp"].every((k) => corr(k, "v2xpa_popul") > 0.5));
  const find = (country: string, abbr: string) => P.find((p) => p.country === country && p.abbr === abbr);
  const s = (country: string, abbr: string, axis: string) => anchorScores(find(country, abbr) ?? { v: {} }).find((x) => x.axis === axis)?.score ?? NaN;
  const cases: Array<[string, boolean]> = [
    ["AfD more 'National' than the German Greens", s("Germany", "AfD", "nation") > s("Germany", "B90/Grue", "nation") + 50],
    ["US Republicans more 'Market' than the Democrats", s("United States of America", "Rep", "economy") > s("United States of America", "Dem", "economy") + 30],
    ["UK Labour more 'Redistribution' than the Conservatives", s("United Kingdom", "Lab", "welfare") < s("United Kingdom", "Con", "welfare") - 50],
    ["US Republicans more 'Religious' than the Democrats", s("United States of America", "Rep", "religion") > s("United States of America", "Dem", "religion")],
    ["CDU more 'Religious' than Die Linke", s("Germany", "CDU", "religion") > s("Germany", "Linke", "religion")],
    ["AfD more 'Traditional' than the German Greens", s("Germany", "AfD", "social") > s("Germany", "B90/Grue", "social") + 50],
    ["AfD more 'Populist' than the CDU", s("Germany", "AfD", "populism") > s("Germany", "CDU", "populism") + 50],
    ["Die Linke more 'Collective' than the CDU", s("Germany", "Linke", "economy") < s("Germany", "CDU", "economy") - 30],
  ];
  for (const [name, cond] of cases) ok(name, cond);
  ok("India's governing party in V-Party's latest coding is the BJP", governingParty(P, "India")?.abbr === "BJP");
  ok("an axis without a V-Party measure gets no anchor", !ANCHOR_MAP.some((m) => ["trade", "environment", "liberty", "world", "force"].includes(m.axis)));
}

console.log(failed ? `\n${failed} failed` : "\nall passed");
if (failed) process.exitCode = 1;
