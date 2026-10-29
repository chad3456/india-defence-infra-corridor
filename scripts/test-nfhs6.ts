/**
 * NFHS-6: the page parser against real fact-sheet pages (a committed fixture
 * of seven pages, including the ones that once misread), the committed
 * extract's integrity, its agreement with independent reporting, and the join
 * from the fact sheets' state names to the map's.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parsePage, cellOf, changeOf, scaleFor, displayLabel, isPercent, sameLabel, misprinted, type Nfhs6States } from "../lib/nfhs6";
import { loadNfhs6, districtKey } from "../lib/nfhs6-load";
import { malnutritionMap } from "../lib/malnutrition-map";

let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => { console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${!cond && detail ? `  ${detail}` : ""}`); if (!cond) failed++; };
const fx = JSON.parse(readFileSync(join(process.cwd(), "scripts", "fixtures", "nfhs6-pages.json"), "utf8")) as { pages: Array<{ page: number; f: Array<[string, number, number]> }> };
const page = (n: number) => parsePage(fx.pages.find((p) => p.page === n)!.f.map(([text, x, y]) => ({ text, x, y })));

console.log("Parser, on real pages");
const p26 = page(26), p27 = page(27), p28 = page(28);
ok("India p.26: heading, four columns, indicators 1–40, no problems", p26.geo === "India" && p26.columns.join() === "urban,rural,total,prev" && p26.rows.length === 40 && p26.rows[0]!.n === 1 && p26.problems.length === 0, JSON.stringify(p26.problems));
ok("the first heading on a page is kept", p26.rows[0]!.section === "Population and Household Profile", p26.rows[0]!.section);
const st = p27.rows.find((r) => r.n === 69)!;
ok("India stunting reads 23.9 / 30.9 / 29.3 / 35.5", st.cells.urban?.v === 23.9 && st.cells.rural?.v === 30.9 && st.cells.total?.v === 29.3 && st.cells.prev?.v === 35.5);
ok("a two-line label's values (sat between its lines) join it", p27.rows.find((r) => r.n === 41)?.cells.total?.v === 82.8);
ok("footnote marks are not values and not label text", p27.rows.every((r) => !/\s\d{1,2},?$/.test(r.label)) && p28.rows.find((r) => r.n === 101)?.label === "Men age 15 years and above who consume alcohol");
ok("units come off the label", p26.rows.find((r) => r.n === 18)?.unit === "children per woman" && p27.rows.find((r) => r.n === 65)?.unit === "%");
ok("kg/m² survives extraction", /kg\/m²\)/.test(p28.rows.find((r) => r.n === 74)!.label));
ok("Women/Men sub-heads carry their block", /^Blood Sugar Level.* · Women$/.test(p28.rows.find((r) => r.n === 78)!.section) && /· Men$/.test(p28.rows.find((r) => r.n === 81)!.section));
ok("Andhra Pradesh's spaced layout reads 40 rows", page(31).rows.length === 40 && page(31).problems.length === 0);
const p107 = page(107);
ok("split digits ('1 1 .') read as #11, and #10 keeps one value per column", p107.rows.some((r) => r.n === 11) && p107.problems.length === 0, JSON.stringify(p107.problems.slice(0, 3)));
ok("Uttar Pradesh p.127 reads 1–40 whole", page(127).rows.length === 40);
const p49 = page(49);
ok("Chhattisgarh p.49 reads #86, printed with #84's wording", p49.rows.some((r) => r.n === 86) && misprinted(86, p49.rows.find((r) => r.n === 86)!.label));
ok("labels compare through clipped letters, not through different words", sameLabel("Births attended by skilled health personnel", "Births attended by skilled health personne") && !sameLabel("Mildly elevated blood pressure", "Elevated blood pressure or taking medicine"));

console.log("\nThe committed extract");
const f = join(process.cwd(), "data", "nfhs6", "states.json");
ok("data/nfhs6/states.json exists", existsSync(f));
if (existsSync(f)) {
  const d = JSON.parse(readFileSync(f, "utf8")) as Nfhs6States;
  ok("India and 35 states/UTs (Manipur was not surveyed)", Object.keys(d.geos).length === 36 && !!d.geos.India && !Object.keys(d.geos).some((g) => /manipur/i.test(g)));
  ok("101 indicators, numbered 1–101", d.indicators.length === 101 && d.indicators.every((i, k) => i.n === k + 1));
  ok("every geography carries all 101", Object.values(d.geos).every((r) => r.length === 101));
  const pctOk = Object.values(d.geos).every((rows) => rows.every((r) => !isPercent(d.indicators[r[0] - 1]!.unit) || r.slice(1, 5).every((v) => v === null || (typeof v === "number" && v >= 0 && v <= 100))));
  ok("every percentage is between 0 and 100", pctOk);
  ok("every indicator has a section", d.indicators.every((i) => i.section.length > 3));
  const I = d.geos.India;
  // Independent reporting of NFHS-6 (ORF, Business Standard, Vyasaa): stunting 29.3, underweight 31.8, severe wasting 5.2.
  ok("agrees with independent reporting: stunting 29.3, underweight 31.8, severe wasting 5.2", cellOf(I, 69, "total") === 29.3 && cellOf(I, 72, "total") === 31.8 && cellOf(I, 71, "total") === 5.2);
  ok("NFHS-5 column agrees with the DHS Program's NFHS-5: stunting 35.5, underweight 32.1", cellOf(I, 69, "prev") === 35.5 && cellOf(I, 72, "prev") === 32.1);
  ok("change is derived to one decimal", changeOf(I, 69) === -6.2);
  ok("stunting colours by WHO thresholds; an unrelated indicator by quintiles", scaleFor(d.indicators[68]!, []).kind === "who-stunting" && scaleFor(d.indicators[13]!, [1, 2, 3, 4, 5]).kind === "quintile");
  ok("indicators that share wording say whose they are", displayLabel(d.indicators[77]!) !== displayLabel(d.indicators[80]!));
  const pub = JSON.parse(readFileSync(join(process.cwd(), "data", "malnutrition", "published.json"), "utf8")) as { nfhs6: { national: Array<{ measure: string; value: number | null }> } };
  const n = (m: string) => pub.nfhs6.national.find((x) => x.measure === m)?.value;
  ok("/malnutrition's NFHS-6 figures are the fact sheet's", n("stunting") === cellOf(I, 69, "total") && n("wasting") === cellOf(I, 70, "total") && n("underweight") === cellOf(I, 72, "total"));
}

console.log("\nJoining to the map");
const m = malnutritionMap();
if (m) {
  const j = loadNfhs6(m.districts);
  const surveyed = new Set(m.districts.filter((d) => !/manipur/i.test(d.state)).map((d) => d.state));
  ok("every map state but Manipur joins a fact-sheet geography", j.unjoined.states.filter((s) => !/manipur/i.test(s)).length === 0 && [...surveyed].every((s) => j.stateOf[s]), j.unjoined.states.join(", "));
  ok("district keys ignore case, spacing and the word 'district'", districtKey("Uttar Pradesh", "Sant Kabir Nagar District") === districtKey("Uttar Pradesh", "Sant Kabir Nagar"));
}

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
