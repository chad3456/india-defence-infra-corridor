/**
 * The NFHS rounds: the DHS survey parser names rounds correctly, the per-year
 * arithmetic refuses what it cannot compute, and the committed file holds
 * only plausible values, in round order, with every withheld value blank.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { METRICS, WITHHELD, comparableStates, currentStates, parseSurveys, perYear, type NfhsRounds } from "../lib/nfhs";

let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => { console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${!cond && detail ? `  ${detail}` : ""}`); if (!cond) failed++; };

console.log("Parsers");
const sv = parseSurveys({ Data: [
  { SurveyId: "IA2020DHS", SurveyYear: 2020, SurveyYearLabel: "2019-21", ReleaseDate: "2022-03-03" },
  { SurveyId: "IA1993DHS", SurveyYear: 1993, SurveyYearLabel: "1992-93" },
  { SurveyId: "IA1999DHS", SurveyYear: 1999, SurveyYearLabel: "1998-99" },
  { SurveyId: "IA2006DHS", SurveyYear: 2006, SurveyYearLabel: "2005-06" },
  { SurveyId: "IA2015DHS", SurveyYear: 2015, SurveyYearLabel: "2015-16" },
  { SurveyId: "IA2016SPA", SurveyYear: 2016 },
] });
ok("standard DHS rounds only, oldest first", sv.map((s) => s.id).join() === "IA1993DHS,IA1999DHS,IA2006DHS,IA2015DHS,IA2020DHS");
ok("rounds are named from NFHS-1", sv.map((s) => s.name).join() === "NFHS-1,NFHS-2,NFHS-3,NFHS-4,NFHS-5", sv.map((s) => s.name).join());
const noFirst = parseSurveys({ Data: [{ SurveyId: "IA1999DHS", SurveyYear: 1999 }, { SurveyId: "IA2006DHS", SurveyYear: 2006 }] });
ok("without NFHS-1 listed, 1998–99 is still NFHS-2", noFirst.map((s) => s.name).join() === "NFHS-2,NFHS-3");
ok("pace per year", perYear({ year: 1999, v: 95 }, { year: 2006, v: 74 }) === -3);
ok("no pace across a missing round or a non-increasing year", perYear({ year: 1999, v: null }, { year: 2006, v: 1 }) === null && perYear({ year: 2006, v: 1 }, { year: 2006, v: 2 }) === null);

console.log("\nThe committed file");
const f = join(process.cwd(), "data", "nfhs", "rounds.json");
if (!existsSync(f)) ok("data/nfhs/rounds.json exists", false);
else {
  const d = JSON.parse(readFileSync(f, "utf8")) as NfhsRounds;
  ok("rounds in fieldwork order, from 1998–99", d.surveys.every((s, i) => i === 0 || s.year > d.surveys[i - 1]!.year) && d.surveys[0]!.year >= 1998);
  ok("every metric is one the page defines", d.metrics.every((m) => METRICS.some((x) => x.key === m.key)));
  ok("one point per round, in round order", d.metrics.every((m) => m.points.length === d.surveys.length && m.points.every((p, i) => p.survey === d.surveys[i]!.id)));
  const vals = (m: NfhsRounds["metrics"][number]) => m.points.flatMap((p) => [p.total, p.urban, p.rural, p.poorest, p.richest, ...Object.values(p.states)]).filter((v): v is number => v !== null);
  for (const m of d.metrics) {
    const u = METRICS.find((x) => x.key === m.key)!.unit;
    const bad = vals(m).filter((v) => !(v >= 0 && (u === "%" ? v <= 100 : u === "children" ? v <= 10 : v <= 300)));
    ok(`${m.key}: every value in range for ${u}`, bad.length === 0, bad.slice(0, 5).join(", "));
  }
  for (const w of WITHHELD) {
    const m = d.metrics.find((x) => x.key === w.key);
    const p = m?.points.find((x) => x.survey === w.survey);
    ok(`withheld ${w.key} ${w.survey} is blank and recorded`, !p || (p.total === null && !Object.keys(p.states).length && d.withheld.some((x) => x.key === w.key && x.survey === w.survey)));
  }
  const comp = comparableStates(d), cur = currentStates(d);
  ok("1998–99 boundaries include the undivided states", comp.some((s) => /Bihar, inc Jharkhand/.test(s)));
  ok("today's states drop the aggregates and keep the new states", !cur.some((s) => /\binc\b|including/.test(s)) && ["Telangana", "Jharkhand", "Ladakh"].every((s) => cur.includes(s)), cur.join("|"));
}

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
