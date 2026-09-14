/**
 * The wikitable reader, checked against markup before it meets a network.
 *
 * ── The failure this guards ──────────────────────────────────────────────
 *
 * A wikitable cell may carry HTML attributes before a single pipe:
 * `scope="col" |Population (2011)`. The first version of the reader stripped
 * those by naming the attributes it expected, which left a bare `"` behind for
 * every attribute nobody had thought of — and that stray cell shifted the
 * header one place against the rows.
 *
 * The result was Uttar Pradesh's 2011 population reading 240,928, which is its
 * area in square kilometres: a number that is plausible, well-formed, in the
 * right column of the right table, and wrong by a factor of eight hundred.
 * Nothing structural would ever have noticed.
 *
 * So the cases below are the attribute forms these articles actually use, and
 * the last one checks the thing that matters — that a header and its rows line
 * up, which is the only property a shifted column violates.
 */
import { cleanCell, parseTables, columnMatching, readNumber } from "./etl/connectors/state-stats";

let bad = 0;
function ok(name: string, cond: boolean, detail = ""): void {
  if (!cond) bad++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  " + detail}`);
}

console.log("\nCell markup is stripped, whatever the attribute");
for (const [input, want] of [
  ['style="text-align:center"|Statehood', "Statehood"],
  ['scope="col" |Population (2011)', "Population (2011)"],
  ['data-sort-value="199812341" | 199,812,341', "199,812,341"],
  ['align=right|240,928', "240,928"],
  ['rowspan=2|Population (2024)', "Population (2024)"],
  ["[[Uttar Pradesh]]", "Uttar Pradesh"],
  ["[[Uttar Pradesh|UP]]", "UP"],
  ["{{sort|199|199,812,341}}", "199,812,341"],
  ["Plain cell", "Plain cell"],
] as Array<[string, string]>) {
  const got = cleanCell(input);
  ok(`${JSON.stringify(input).slice(0, 44)} → ${JSON.stringify(want)}`, got === want,
    `got ${JSON.stringify(got)}`);
}

console.log("\nHeaders line up with their rows");
{
  const wt = `{|class="wikitable"
|+Caption that is not a header row
|-
! State !! scope="col" |Population (2011) !! style="x"|Area (km 2 )
|-
| [[Uttar Pradesh]] || 199,812,341 || 240,928
|-
| [[Rajasthan]] || 68,548,437 || 342,239
|}`;
  const tables = parseTables(wt);
  const t = tables[0];
  ok("one table is found", tables.length === 1);
  ok("the caption is not the header",
    t?.header.join("|") === "State|Population (2011)|Area (km 2 )", JSON.stringify(t?.header));
  ok("two data rows", t?.rows.length === 2, String(t?.rows.length));

  const pop = columnMatching(t?.header ?? [], /population/i);
  const area = columnMatching(t?.header ?? [], /area/i);
  ok("the population column resolves", pop?.index === 1, JSON.stringify(pop));
  // The check that a shifted header fails and nothing else does.
  ok("and it reads the population, not the area",
    readNumber(t?.rows[0]?.[pop?.index ?? -1] ?? "") === 199812341,
    String(readNumber(t?.rows[0]?.[pop?.index ?? -1] ?? "")));
  ok("the area column reads the area",
    readNumber(t?.rows[0]?.[area?.index ?? -1] ?? "") === 240928);
  ok("the header keeps its own words, so the basis can be printed",
    pop?.label === "Population (2011)", pop?.label);
}

console.log("\nNumbers survive the markup around them");
for (const [input, want] of [
  ["199,812,341", 199812341],
  ["240,928", 240928],
  ["1,402,540,624<ref name=x/>", 1402540624],
  ["32", 32],
] as Array<[string, number]>) {
  ok(`${JSON.stringify(input)} → ${want}`, readNumber(input) === want, String(readNumber(input)));
}
ok("a cell with no number yields null", readNumber("Uttar Pradesh") === null);

console.log(bad === 0 ? "\nAll wikitable checks passed.\n" : `\n${bad} check(s) failed.\n`);
process.exit(bad === 0 ? 0 : 1);
