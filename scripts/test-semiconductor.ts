/**
 * The chip figures, checked before they ship.
 *
 * Three ways this dataset can lie, in order of how convincing the lie would be:
 *
 *   A continuous line. Eleven of twenty-three years were sampled. A chart that
 *   joins 2018 to 2022 asserts a COVID-era trajectory that was never measured,
 *   and it would look exactly like every other line on the site. So the file
 *   must state that its coverage is sparse, must name the years it skipped,
 *   and every row must carry a correct count of the unsampled years before it.
 *
 *   An arithmetic slip. balance is the only derived figure in the file. If it
 *   ever stops equalling imports minus exports, a reader has no way to notice:
 *   all three numbers are large and plausible. Checked on every row.
 *
 *   A heading that contains less than its own parts. Chapter 85 is the
 *   denominator for every share on the page. If the prefix aggregation ever
 *   drops lines, the chapter total falls below the 8541+8542 subtotal it
 *   contains and every share silently inflates.
 *
 * These are checks on internal consistency, not on the world. Nothing here can
 * tell whether $23.45bn of integrated circuits in 2024 is the right number —
 * only UN Comtrade can say that, and data/trade/ is where it already said it.
 */
import { existsSync, readFileSync } from "node:fs";
import { segments, comparableRows, shareOfElectronics, changeBetween, sumImports } from "../lib/semiconductor";
import type { SemiTrade, SemiRow, SemiGroup } from "../lib/semiconductor";

const FILE = "data/semi/trade.json";
if (!existsSync(FILE)) {
  // Not a skip. This connector needs no network, so there is no excuse for the
  // file being missing and no later job that will produce it.
  console.log(`\n  FAIL ${FILE} is missing. Run \`npm run semi:trade\` — it reads data/trade/ and needs no network.\n`);
  process.exit(1);
}

let bad = 0;
function ok(name: string, cond: boolean, detail = ""): void {
  if (!cond) bad++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  — " + detail}`);
}

const d = JSON.parse(readFileSync(FILE, "utf8")) as SemiTrade;
const everyRow: Array<{ where: string; row: SemiRow }> = [
  ...d.groups.flatMap((g: SemiGroup) => g.rows.map((row) => ({ where: g.id, row }))),
  ...d.allMerchandise.map((row) => ({ where: "allMerchandise", row })),
];

console.log("\nArithmetic");
{
  const wrong = everyRow.filter(({ row }) => row.balance !== row.imports - row.exports);
  ok("balance is imports minus exports on every row", wrong.length === 0,
    wrong.slice(0, 3).map(({ where, row }) =>
      `${where} ${row.year}: ${row.balance} != ${row.imports} - ${row.exports}`).join(" / "));
}
ok("no figure is a fraction of a dollar",
  everyRow.every(({ row }) => Number.isInteger(row.imports) && Number.isInteger(row.exports)),
  "sub-dollar precision on a billion-dollar aggregate is false precision and breaks the balance check");
ok("no negative import or export figure",
  everyRow.every(({ row }) => row.imports >= 0 && row.exports >= 0));
ok("every figure is finite",
  everyRow.every(({ row }) => [row.imports, row.exports, row.balance].every(Number.isFinite)));

console.log("\nYear coverage");
{
  const sampled = new Set(d.sampledYears);
  const strays = everyRow.filter(({ row }) => !sampled.has(row.year));
  ok("no row carries a year that was never sampled", strays.length === 0,
    strays.slice(0, 3).map(({ where, row }) => `${where} ${row.year}`).join(" / "));
}
ok("the sampled and unsampled year lists do not overlap",
  d.unsampledYears.every((y) => !d.sampledYears.includes(y)),
  d.unsampledYears.filter((y) => d.sampledYears.includes(y)).join(", "));
ok("the sampled years are ascending and unique",
  d.sampledYears.every((y, i) => i === 0 || y > (d.sampledYears[i - 1] ?? -Infinity)));
{
  // The two lists must together account for every year in the span. A missing
  // year in neither list is a year the page would treat as though it did not
  // exist rather than as unmeasured.
  const first = d.sampledYears[0] ?? 0;
  const last = d.sampledYears[d.sampledYears.length - 1] ?? 0;
  const missing: number[] = [];
  for (let y = first; y <= last; y++) {
    if (!d.sampledYears.includes(y) && !d.unsampledYears.includes(y)) missing.push(y);
  }
  ok("every year in the span is either sampled or named as unsampled", missing.length === 0,
    missing.join(", "));
}
ok("the file says its coverage is sparse", /sparse/i.test(d.sparse),
  "a consumer that never reads this string will draw a continuous line");
ok("the sparse note names the years that were skipped",
  d.unsampledYears.length > 0 && d.unsampledYears.every((y) => d.sparse.includes(String(y))),
  "the gap has to be nameable from the file alone");
ok("the sparse note warns against drawing through the gap",
  /continuous line|do not draw/i.test(d.sparse));
{
  // gapBefore is what a chart uses to break a path. If it is wrong the warning
  // in the prose is correct and the drawing is still wrong.
  const wrong: string[] = [];
  for (const g of d.groups) {
    g.rows.forEach((r, i) => {
      const prev = i > 0 ? g.rows[i - 1] : undefined;
      const expect = prev === undefined ? 0 : r.year - prev.year - 1;
      if (r.gapBefore !== expect) wrong.push(`${g.id} ${r.year}: ${r.gapBefore} != ${expect}`);
    });
  }
  ok("gapBefore counts the unsampled years before each row", wrong.length === 0, wrong.slice(0, 3).join(" / "));
}
{
  const bridged = d.groups.filter((g) =>
    segments(g.rows).some((seg) => seg.some((r, i) => i > 0 && r.gapBefore > 0)));
  ok("segments() never puts a gap inside one run", bridged.length === 0,
    bridged.map((g) => g.id).join(", "));
}

console.log("\nThe headings contain their own parts");
{
  const ch85 = d.groups.find((g) => g.id === "chapter85");
  const ic = d.groups.find((g) => g.id === "ic");
  const disc = d.groups.find((g) => g.id === "discrete");
  ok("chapter 85, HS 8542 and HS 8541 are all present",
    ch85 !== undefined && ic !== undefined && disc !== undefined);
  const failures: string[] = [];
  for (const y of d.sampledYears) {
    const c = ch85?.rows.find((r) => r.year === y);
    const a = ic?.rows.find((r) => r.year === y);
    const b = disc?.rows.find((r) => r.year === y);
    if (!c) { failures.push(`${y}: no chapter 85 row`); continue; }
    const subM = (a?.imports ?? 0) + (b?.imports ?? 0);
    const subX = (a?.exports ?? 0) + (b?.exports ?? 0);
    if (c.imports < subM) failures.push(`${y} imports ${c.imports} < ${subM}`);
    if (c.exports < subX) failures.push(`${y} exports ${c.exports} < ${subX}`);
  }
  ok("chapter 85 is at least its own 8541 + 8542 subtotal, every year and both flows",
    failures.length === 0, failures.slice(0, 3).join(" / "));

  const tooBig = d.groups.filter((g) => g.id !== "chapter85" && g.prefix.startsWith("85"))
    .flatMap((g) => g.rows.filter((r) => {
      const c = ch85?.rows.find((x) => x.year === r.year);
      return c !== undefined && (r.imports > c.imports || r.exports > c.exports);
    }).map((r) => `${g.id} ${r.year}`));
  ok("no chapter-85 sub-heading exceeds the chapter it sits in", tooBig.length === 0, tooBig.join(", "));
}
{
  // Every row must be traceable to the subheadings it summed, so a reader can
  // reproduce it from data/trade/ without rerunning anything.
  const bare = d.groups.flatMap((g) => g.rows
    .filter((r) => r.codes.length === 0 || r.codes.some((c) => !c.startsWith(g.prefix)))
    .map((r) => `${g.id} ${r.year}`));
  ok("every row lists the subheadings it summed, all inside its own heading",
    bare.length === 0, bare.slice(0, 3).join(" / "));
}
{
  const allTotal = d.allMerchandise.find((r) => r.year === 2024);
  const ch85 = d.groups.find((g) => g.id === "chapter85")?.rows.find((r) => r.year === 2024);
  ok("all-merchandise imports exceed chapter 85's, so it can serve as a denominator",
    allTotal !== undefined && ch85 !== undefined && allTotal.imports > ch85.imports,
    `${allTotal?.imports} vs ${ch85?.imports}`);
}

console.log("\nWhat the file refuses to do");
ok("says HS 8541 is not a chip series", /8541 is not a chip series/i.test(d.refusal));
ok("says HS 8517 is not comparable before 2012", /8517.*not comparable before 2012/is.test(d.refusal));
ok("says nothing is smoothed or gap-filled", /smoothed|gap-filled/i.test(d.refusal));
ok("names its unit and says it is not deflated", /US\$/.test(d.unit) && /not deflated/i.test(d.unit));
ok("cites where the numbers came from", /Comtrade/i.test(d.source) && /data\/trade/.test(d.source));
{
  const telecom = d.groups.find((g) => g.id === "telecom");
  ok("the telecom series declares 2012 as its first comparable year",
    telecom?.comparableFrom === 2012, String(telecom?.comparableFrom));
  ok("comparableRows drops the years the telecom heading meant something else",
    telecom !== undefined && comparableRows(telecom).every((r) => r.year >= 2012));
  const diag = d.groups.find((g) => g.role === "diagnostic");
  ok("the pre-HS2007 handset heading is carried as a diagnostic, not a headline",
    diag !== undefined && diag.prefix === "852520",
    "without it the page truncates the 8517 axis at 2012 with no explanation");
  ok("the diagnostic heading stops before the years it would double-count",
    diag !== undefined && diag.rows.every((r) => r.year <= 2008));
}
{
  // The suspect row must still be suspect. If someone "fixes" 2008 by
  // interpolating it, this fails — which is the point: the flag is the
  // deliverable, a patched number would not be.
  const ic2008 = d.groups.find((g) => g.id === "ic")?.rows.find((r) => r.year === 2008);
  const ic2004 = d.groups.find((g) => g.id === "ic")?.rows.find((r) => r.year === 2004);
  ok("the 2008 integrated-circuit row is flagged as suspect",
    typeof ic2008?.suspect === "string" && ic2008.suspect.length > 40);
  ok("the 2008 row is flagged rather than corrected",
    ic2008 !== undefined && ic2004 !== undefined && ic2008.imports < ic2004.imports,
    "2008 now exceeds 2004, so someone adjusted a figure this project cannot source");
  ok("the flag says why it is suspect and that it was not corrected",
    /classification break/i.test(ic2008?.suspect ?? "") && /not corrected/i.test(ic2008?.suspect ?? ""));
}

console.log("\nShares carry their denominators");
{
  const s = shareOfElectronics("ic", 2024);
  ok("a share comes back with numerator, denominator and what the denominator is",
    s !== null && s.value > 0 && s.denominator > 0 && s.of.length > 10);
  ok("the fraction is the numerator over the denominator",
    s !== null && s.fraction !== null && Math.abs(s.fraction - s.value / s.denominator) < 1e-12);
  ok("the share of electronics is between 0 and 1",
    s !== null && s.fraction !== null && s.fraction > 0 && s.fraction < 1, String(s?.fraction));
}
{
  const c = changeBetween("ic", 2022, 2024);
  ok("a change between two sampled years reports how many years it did not measure",
    c !== null && c.unmeasured === 0, String(c?.unmeasured));
  const across = changeBetween("ic", 2018, 2022);
  ok("a change across a gap says three years were never sampled",
    across !== null && across.unmeasured === 3, String(across?.unmeasured));
  ok("a change to an unsampled year is null rather than the nearest year",
    changeBetween("ic", 2020, 2024) === null);
}
{
  let threw = false;
  try { sumImports(["ic", "discrete"], 2024, "why"); } catch { threw = true; }
  ok("summing headings without a stated reason throws", threw,
    "8541 + 8542 as 'semiconductors' adds billions of solar panels to the chip bill");
  const summed = sumImports(["ic", "discrete"], 2024,
    "both headings are semiconductor devices in the physics sense; stated only where the solar content is stated too");
  ok("a sum with a reason returns its parts", summed !== null && summed.parts.length === 2);
}

console.log(bad === 0 ? "\nAll semiconductor checks passed.\n" : `\n${bad} check(s) failed.\n`);
process.exit(bad === 0 ? 0 : 1);
