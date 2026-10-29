/**
 * Youth in India 2022 and the theme layer over NFHS-6: the statement reader's
 * row rules on synthetic grids, the committed extract against a fresh read of
 * the committed PDF, figures checked by eye against the printed pages, and the
 * themes, pairs and insights both datasets share.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readRows, YOUTH_INDICATORS, YOUTH_THEMES, YOUTH_PAIRS, YOUTH_PDF } from "../lib/youth-india";
import { THEMES, SEX_PAIRS, cellOf, gapOf, insights, markOf, type Nfhs6States } from "../lib/nfhs6";
import { joinStates } from "../lib/nfhs6-load";
import { malnutritionMap } from "../lib/malnutrition-map";
import { gateYouth, readYouth } from "./youth-india";

let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => { console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${!cond && detail ? `  ${detail}` : ""}`); if (!cond) failed++; };

async function main() {
  console.log("Row rules");
  const t = { id: "t", statement: "x", page: 1, printed: 1, values: 3, agency: "" };
  const r = readRows([
    ["Andaman and"], ["1", "1.0", "2.0", "3.0"], ["Nicobar Islands"],
    ["2", "Bihar", "(4.6)", "*", "NA"],
    ["Dadra and Nagar"], ["3", "7.0", "8.0"], ["Haveli", "9.0"],
    ["4", "Telangana", "Included in Andhra Pradesh", "5.0"],
    ["5", "Kerala", "1", "2", "3"], ["5", "Kerala", "1", "2", "3"],
    ["All India", "1.5", "2.5", "3.5"],
  ], t);
  ok("a name wrapped around its number's line is rejoined", r.rows.get("andamanandnicobarislands")?.values[2]?.v === 3);
  ok("(n) is a small sample, * suppressed, NA not available", r.rows.get("bihar")?.values.map((v) => v.mark).join("") === "sxn");
  ok("a split row is left out and listed, not right-aligned", !r.rows.has("dadraandnagar") && r.problems.some((p) => /2 values, expected 3/.test(p)), JSON.stringify(r.problems));
  ok("'Included in…' explains missing early columns", r.rows.get("telangana")?.values.map((v) => v.v).join() === ",,5");
  ok("a row printed twice with the same values is kept once, silently", r.rows.has("kerala") && !r.problems.some((p) => /Kerala/.test(p)));
  ok("'All India' is the national row", r.rows.get("india")?.values[0]?.v === 1.5);

  console.log("\nThe committed extract");
  const f = join(process.cwd(), "data", "youth", "states.json");
  ok("the PDF is committed", existsSync(join(process.cwd(), YOUTH_PDF)));
  ok("data/youth/states.json exists", existsSync(f));
  if (!existsSync(f) || !existsSync(join(process.cwd(), YOUTH_PDF))) { process.exitCode = 1; return; }
  const committed = JSON.parse(readFileSync(f, "utf8")) as Nfhs6States;
  const fresh = await readYouth(committed.fetchedAt);
  ok("a fresh read of the PDF gives the committed file exactly", JSON.stringify(fresh) + "\n" === readFileSync(f, "utf8"), "run npm run youth:build");
  ok("the gates pass", gateYouth(fresh).length === 0, gateYouth(fresh).slice(0, 3).join("; "));
  ok("only the split Dadra/Daman rows are left out", fresh.problems.length > 0 && fresh.problems.every((p) => /Dadra|Daman/.test(p)), JSON.stringify(fresh.problems));
  const g = committed.geos;
  // Figures read by eye from the printed pages.
  const row = (geo: string, n: number) => JSON.stringify(g[geo]?.find((x) => x[0] === n)?.slice(1, 5));
  ok("India, women 18–29 married by 18: 16.5 / 28.4 / 24.7, NFHS-4 27.9 (St. 9, p. 90)", row("India", 1) === "[16.5,28.4,24.7,27.9]", row("India", 1));
  ok("Bihar, the same: 29.2 / 42.4 / 40.3, NFHS-4 41.9", row("Bihar", 1) === "[29.2,42.4,40.3,41.9]", row("Bihar", 1));
  ok("Andaman's suppressed urban men's cell is marked, not zero", markOf(g["Andaman and Nicobar Islands"], 2, "urban") === "x" && cellOf(g["Andaman and Nicobar Islands"], 2, "urban") === null);
  ok("Kerala, female youth unemployment 51.2% (2020–21), 63.4% (2017–18) (St. 47, pp. 137–138)", cellOf(g.Kerala, 18, "total") === 51.2 && cellOf(g.Kerala, 18, "prev") === 63.4);
  ok("Bihar, female youth labour force participation 1.7% in 2017–18 (St. 46 (a), p. 135)", cellOf(g.Bihar, 15, "prev") === 1.7);
  ok("Telangana's GER in higher education reads from the right columns (St. 39, p. 126)", cellOf(g.Telangana, 7, "total") === 36.4 && cellOf(g.Telangana, 7, "prev") === 33.4);
  ok("India, GER higher secondary 53.8 (2020–21), 48.3 (2015–16) (St. 38, p. 125)", cellOf(g.India, 6, "total") === 53.8 && cellOf(g.India, 6, "prev") === 48.3);
  ok("India, GPI in higher education 1.01 (2019–20) (St. 41, p. 128)", cellOf(g.India, 10, "total") === 1.01);
  ok("India, 15–29 not literate 5.85% (2019–20), 8.07% (2017–18) (St. 30, pp. 113–114)", cellOf(g.India, 12, "total") === 5.85 && cellOf(g.India, 12, "prev") === 8.07);
  ok("the merged Dadra/Daman UT's 2020–21 row is read from its three-line name", cellOf(g["Dadra and Nagar Haveli and Daman and Diu"], 15, "total") === 21.4);
  const map = malnutritionMap();
  if (map) {
    const j = joinStates(g, map.districts);
    ok("the report's states join the map's (34 or more)", Object.keys(j.stateOf).length >= 34, `${Object.keys(j.stateOf).length}; unjoined ${j.unjoined.join(", ")}`);
  }

  console.log("\nThemes and pairs");
  const covered = (themes: typeof THEMES, ns: number[]) => ns.filter((n) => !themes.some((t) => t.ns.includes(n)));
  const n6 = join(process.cwd(), "data", "nfhs6", "states.json");
  const nfhs = existsSync(n6) ? (JSON.parse(readFileSync(n6, "utf8")) as Nfhs6States) : null;
  if (nfhs) {
    ok("every NFHS-6 indicator is in at least one theme", covered(THEMES, nfhs.indicators.map((i) => i.n)).length === 0, covered(THEMES, nfhs.indicators.map((i) => i.n)).join());
    ok("NFHS-6 pairs are women then men, with matching wording", SEX_PAIRS.every(([w, m]) => { const a = nfhs.indicators.find((i) => i.n === w)!, b = nfhs.indicators.find((i) => i.n === m)!; return (/^Women/.test(a.label) && /^Men/.test(b.label)) || (/· Women$/.test(a.section) && /· Men$/.test(b.section)); }));
    ok("India's schooling gap: women 46.4% − men 54.6% = −8.2 points", gapOf(nfhs.geos.India, 12, "total") === -8.2);
    const ins = insights(nfhs)!;
    ok("the largest national move is rotavirus vaccination, +49 points", ins.movers[0]?.n === 53 && ins.movers[0]?.change === 49);
    ok("state extremes never name a union territory", ins.themes.every((t) => t.extremes.every((e) => ![e.rise?.geo, e.fall?.geo].some((x) => x && /Andaman|Chandigarh|Lakshadweep|Ladakh|Delhi|Puducherry|Dadra|Jammu/.test(x)))));
  }
  ok("every Youth indicator is in at least one theme", covered(YOUTH_THEMES, YOUTH_INDICATORS.map((i) => i.n)).length === 0);
  ok("Youth pairs are female then male", YOUTH_PAIRS.every(([w, m]) => /(Female|Girls)$/.test(YOUTH_INDICATORS.find((i) => i.n === w)!.label) && /(Male|Boys)$/.test(YOUTH_INDICATORS.find((i) => i.n === m)!.label)));
  const yi = insights(committed)!;
  ok("Youth insights: female − male youth unemployment, India, −0.5 points (12.5 − 13.0)", yi.gaps.find((x) => /Unemployment/.test(x.short))?.now === -0.5);

  console.log(failed ? `\n${failed} failed` : "\nall passed");
  if (failed) process.exitCode = 1;
}
main();
