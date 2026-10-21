/**
 * Luxury beliefs and India: every published figure traces to a source and
 * carries the sentence it was read from, the headline rule keeps India's
 * reporting on each area and drops the rest, and the DHS parsers read the
 * API's format and pick indicators by label.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AREAS, INDICATORS, belongsTo, gap, parseData, parseIndicators, pickIndicators, rank, type LbPublished, type NfhsRegister } from "../lib/luxury-beliefs";

let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => { console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${!cond && detail ? `  ${detail}` : ""}`); if (!cond) failed++; };
const pub = JSON.parse(readFileSync(join(process.cwd(), "data", "luxury-beliefs", "published.json"), "utf8")) as LbPublished;
const ids = new Set(pub.sources.map((s) => s.id));

console.log("Published figures");
ok("every source has an https address, an access date, a tier and a provenance", pub.sources.every((s) => /^https:\/\//.test(s.url) && /^\d{4}-\d{2}-\d{2}$/.test(s.accessed) && [1, 2, 3].includes(s.tier) && !!s.provenance));
ok("source ids are unique", ids.size === pub.sources.length);
const cited = [pub.concept.source, ...pub.concept.critiques.map((c) => c.source), ...pub.areas.flatMap((a) => a.figures.map((f) => f.source))];
ok("every figure and critique cites a source that exists", cited.every((c) => ids.has(c)), cited.filter((c) => !ids.has(c)).join(", "));
ok("every figure carries the sentence it was read from, and a display that shows its value", pub.areas.every((a) => a.figures.every((f) => f.quote.length > 15 && (f.value === null || f.display.replace(/,/g, "").includes(String(Math.abs(f.value)))))), pub.areas.flatMap((a) => a.figures).filter((f) => f.value !== null && !f.display.replace(/,/g, "").includes(String(Math.abs(f.value)))).map((f) => f.label).join(" | "));
ok("every area is one the page knows, once each, with the case against it and a verdict", new Set(pub.areas.map((a) => a.id)).size === pub.areas.length && pub.areas.every((a) => AREAS.some((x) => x.id === a.id) && a.against.length > 40 && a.verdict.length > 10));

console.log("\nLive headlines");
ok("an Indian headline on English-medium schools belongs to language", belongsTo("language", "Karnataka parents rush to English-medium schools despite NEP push"));
ok("a Hindi one on Bihar's liquor ban belongs to prohibition", belongsTo("prohibition", "बिहार में शराबबंदी के बावजूद जहरीली शराब से 5 की मौत"));
ok("the same subject abroad does not", !belongsTo("prohibition", "Hooch deaths in Kenya rise to 20"));
ok("an Indian headline off the subject does not", !belongsTo("farming", "India beat Australia in the second Test"));

console.log("\nDHS parsers");
const cat = parseIndicators({ Data: [
  { IndicatorId: "WE_AWBT_W_AGR", Label: "Agreement with wife beating for at least one specific reason", Definition: "Percentage of women who agree that a husband is justified in hitting or beating his wife for at least one specified reason" },
  { IndicatorId: "WE_AWBT_M_AGR", Label: "Agreement with wife beating for at least one specific reason", Definition: "Percentage of men who agree that a husband is justified in hitting or beating his wife for at least one specified reason" },
  { IndicatorId: "MA_MBAG_W_B18", Label: "Women age 20-24 married by age 18", Definition: "Percentage of women age 20-24 who were first married or in union before age 18" },
  { IndicatorId: "FE_FRTR_W_TFR", Label: "Total fertility rate 15-49", Definition: "Total fertility rate for the three years preceding the survey" },
  { IndicatorId: "FE_FRTR_W_TFR2", Label: "Total fertility rate 15-44 among the employed", Definition: "x" },
  { IndicatorId: 7, Label: "junk" },
] });
const picked = pickIndicators(cat);
ok("the catalogue's malformed rows are dropped", cat.length === 5);
ok("women's and men's versions are told apart by their definitions", picked.get("wifebeat_w")?.IndicatorId === "WE_AWBT_W_AGR" && picked.get("wifebeat_m")?.IndicatorId === "WE_AWBT_M_AGR");
ok("the headline indicator is preferred over its longer variants", picked.get("tfr")?.IndicatorId === "FE_FRTR_W_TFR");
ok("an indicator the catalogue lacks is not invented", !picked.has("stunting") && INDICATORS.length > picked.size);
const rows = parseData({ Data: [
  { IndicatorId: "X", SurveyId: "IA2020DHS", CharacteristicCategory: "Total", CharacteristicLabel: "Total", Value: 45.1, ByVariableLabel: "" },
  { IndicatorId: "X", SurveyId: "IA2020DHS", CharacteristicCategory: "Wealth quintile", CharacteristicLabel: "Highest", Value: 29.1, ByVariableLabel: "" },
  { IndicatorId: "X", SurveyId: "IA2020DHS", CharacteristicCategory: "Wealth quintile", CharacteristicLabel: "Lowest", Value: 56.0, ByVariableLabel: "" },
  { IndicatorId: "X", SurveyId: "IA2020DHS", CharacteristicCategory: "Region", CharacteristicLabel: "Bihar", Value: 40, ByVariableLabel: "" },
  { IndicatorId: "X", SurveyId: "IA2020DHS", CharacteristicCategory: "Wealth quintile", CharacteristicLabel: "Lowest", Value: 70, ByVariableLabel: "Age 15-19", IsPreferred: 0 },
  { IndicatorId: "X", SurveyId: "IA2020DHS", CharacteristicCategory: "Education", CharacteristicLabel: "No education", Value: null },
] });
ok("total, wealth and schooling rows kept; regions, sub-splits and empty values dropped", rows.length === 3 && rows[0]!.category === "Total");
const g = gap(rows.filter((r) => r.category !== "Total").map((r) => ({ category: r.category, label: r.label, value: r.value })), "wealth quintile");
ok("the gap runs from lowest to highest, whatever order the API returns", g?.low.label === "Lowest" && g.high.label === "Highest" && g.diff === -26.9);
ok("quintiles and schooling sort in their natural order", ["Highest", "Second", "Lowest", "Fourth", "Middle"].sort((a, b) => rank(a) - rank(b)).join() === "Lowest,Second,Middle,Fourth,Highest");

const nf = join(process.cwd(), "data", "luxury-beliefs", "nfhs.json");
if (existsSync(nf)) {
  console.log("\nThe NFHS file");
  const reg = JSON.parse(readFileSync(nf, "utf8")) as NfhsRegister;
  ok("every indicator is one the page asked for, with the DHS label it was matched by", reg.indicators.every((i) => INDICATORS.some((w) => w.key === i.key) && !!i.dhsLabel && !!i.id));
  ok("percentages are percentages", reg.indicators.filter((i) => !/fertility|ideal/i.test(i.title)).every((i) => Object.values(i.surveys).every((s) => s.rows.every((r) => r.value >= 0 && r.value <= 100))));
}

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
