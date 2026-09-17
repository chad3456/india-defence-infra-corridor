/**
 * The selector must not be able to see which way a series points.
 *
 * That is the whole honesty claim of /growth-100: the hundred indicators are
 * chosen by how much data exists, so the mix of rising and falling panels is a
 * result rather than an edit. A claim like that is worth exactly as much as
 * the test that holds it, because the failure mode — a selector that quietly
 * favours rises — produces a page that looks better and says less.
 *
 * So the test builds two registries identical in every respect except that one
 * has every series reversed in time, and asserts the same indicators are
 * chosen in the same order.
 */
import { buildPanels, selectPanels, tally, changeLabel } from "../lib/growth-panels";
import type { Registry, Indicator } from "../lib/owid";
import { sparkGeometry } from "../components/stories/Charts";

let failures = 0;
function check(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`  ${ok ? "pass" : "FAIL"}  ${name}${ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
}

/* The module reads shards off disk in production, so the fixture goes in
   through buildPanels' readSeries seam. ES module exports are read-only and
   cannot be monkeypatched, which is why the seam exists. */
const shards = new Map<string, Array<{ iso: string; years: number[]; values: number[] }>>();
const readSeries = (i: Indicator) => shards.get(i.slug) ?? [];

/**
 * `column` defaults to the slug, so two fixture indicators are two measures.
 *
 * It was the literal "v" for every one of them, which mattered the moment the
 * selector started collapsing charts that draw the same column. Every fixture
 * registry became one indicator wearing several slugs and four tests failed
 * at once — the right failure for the wrong reason, and a fixture that would
 * have hidden the opposite bug just as well.
 */
function ind(slug: string, category: string, over: Partial<Indicator> = {}): Indicator {
  return {
    slug, title: slug, subtitle: "", column: slug, unit: "u", shortUnit: "u",
    description: "", attribution: "a", citation: "c", timespan: "",
    category, tiers: { series: true, map: true }, countriesWithData: 6,
    hasIndia: true, shard: 0, firstYear: 2000, lastYear: 2020,
    ...over,
  };
}

function registry(slugs: Array<[string, string]>): Registry {
  return {
    present: true, builtAt: "", source: "", method: "", attribution: "", refusal: "",
    cannotSay: [], comparators: ["IND", "CHN", "USA", "BRA"],
    counts: { slugsDiscovered: 0, slugsAttempted: 0, indicators: slugs.length, withMapTier: slugs.length, withIndia: slugs.length, skipped: 0, shards: 1 },
    byCategory: [], discovery: "", stoppedEarly: "",
    indicators: slugs.map(([s, c]) => ind(s, c)),
  };
}

const YEARS = Array.from({ length: 21 }, (_, i) => 2000 + i);
function fill(slug: string, indiaValues: number[]): void {
  shards.set(slug, [
    { iso: "IND", years: YEARS, values: indiaValues },
    { iso: "CHN", years: YEARS, values: YEARS.map(() => 50) },
    { iso: "USA", years: YEARS, values: YEARS.map(() => 70) },
    { iso: "BRA", years: YEARS, values: YEARS.map(() => 30) },
  ]);
}

const rising = YEARS.map((_, i) => 10 + i * 5);
const falling = [...rising].reverse();

console.log("The selector is blind to direction");
{
  const reg = registry([["a", "Economy"], ["b", "Health"], ["c", "Energy"]]);
  fill("a", rising);
  fill("b", falling);
  fill("c", rising);
  const up = buildPanels(reg, { limit: 3, readSeries }).map((p) => p.indicator.slug);

  // Same registry, every series reversed. Coverage is identical; direction is not.
  fill("a", falling);
  fill("b", rising);
  fill("c", falling);
  const down = buildPanels(reg, { limit: 3, readSeries }).map((p) => p.indicator.slug);

  check("the same indicators are chosen when every series is reversed", up, down);
}

console.log("\nDirection is read, not judged");
{
  const reg = registry([["up", "Economy"], ["down", "Health"], ["flat", "Energy"]]);
  fill("up", rising);
  fill("down", falling);
  fill("flat", YEARS.map((_, i) => 100 + (i % 2)));
  const byslug = new Map(buildPanels(reg, { limit: 3, readSeries }).map((p) => [p.indicator.slug, p]));
  check("a rising series is 'rose'", byslug.get("up")?.direction, "rose");
  check("a falling series is 'fell'", byslug.get("down")?.direction, "fell");
  check("a 1% wobble is 'flat', not a trend", byslug.get("flat")?.direction, "flat");
  check("the tally counts them", tally([...byslug.values()]).rose, 1);
}

console.log("\nSubject balance");
{
  // Ten of each, so there is a real choice to get wrong.
  const many: Array<[string, string]> = [
    ...Array.from({ length: 10 }, (_, i) => [`h${i}`, "Health"] as [string, string]),
    ...Array.from({ length: 10 }, (_, i) => [`e${i}`, "Economy"] as [string, string]),
  ];
  const reg = registry(many);
  for (const [slug] of many) fill(slug, rising);
  const picked = buildPanels(reg, { limit: 12, readSeries });
  const health = picked.filter((p) => p.indicator.category === "Health").length;
  check("a subject-heavy registry does not produce a subject-heavy page", health, 6);
  check("and the page is filled", picked.length, 12);
}
{
  // When one subject is all there is, the page fills from it rather than
  // coming up short under a heading that promises a hundred.
  const only: Array<[string, string]> = Array.from({ length: 8 }, (_, i) => [`h${i}`, "Health"]);
  const reg = registry(only);
  for (const [slug] of only) fill(slug, rising);
  check("with nothing else available it still fills", buildPanels(reg, { limit: 6, readSeries }).length, 6);
}

console.log("\nChange labels carry a sign and no false precision");
{
  const reg = registry([["x", "Economy"]]);
  fill("x", YEARS.map((_, i) => 100 + i));
  const p = buildPanels(reg, { limit: 1, readSeries })[0]!;
  check("a 20% rise reads as +20.0%", changeLabel(p), "+20.0%");
  fill("x", YEARS.map((_, i) => 10 + i * 100));
  const big = buildPanels(reg, { limit: 1, readSeries })[0]!;
  check("a two-hundredfold rise reads as a multiple, not 20000%", changeLabel(big), "+201×");
}

/**
 * The three ways a panel can be wrong about what it is showing.
 *
 * All three shipped. Ninety panels went up with four of them drawing one
 * column under four titles, six labelled with a title naming two measures
 * when the number was one of them, and one whose headline figure was a
 * forecast for 2050 formatted exactly like a 2024 observation. Each looked
 * correct in isolation; the duplicates were only visible by reading four
 * cards and noticing the sparklines matched.
 */
console.log("\nA panel must be about what its title says");
{
  const reg = registry([["a", "Economy"], ["b", "Health"], ["c", "Energy"], ["d", "Society"]]);
  // b draws the same column as a, under its own title.
  reg.indicators[1]!.column = reg.indicators[0]!.column;
  reg.indicators[2]!.title = "Energy use vs. GDP per capita";
  reg.indicators[3]!.lastYear = new Date().getUTCFullYear() + 25;
  for (const [slug] of [["a"], ["b"], ["c"], ["d"]] as Array<[string]>) fill(slug, rising);

  const { panels, rejected } = selectPanels(reg, { limit: 10, readSeries });
  check("only one chart per column and unit survives", panels.map((p) => p.indicator.slug), ["a"]);
  check("the duplicate is counted", rejected.duplicateMeasure, 1);
  check("an \"X vs. Y\" title is held out", rejected.twoVariable, 1);
  check("a series ending in the future is held out", rejected.projection, 1);
}

{
  // Same column name, different unit, is not the same measurement — and
  // merging those would be this rule failing in the other direction.
  const reg = registry([["a", "Economy"], ["b", "Health"]]);
  reg.indicators[1]!.column = reg.indicators[0]!.column;
  reg.indicators[1]!.unit = "a different unit";
  fill("a", rising); fill("b", rising);
  const { panels, rejected } = selectPanels(reg, { limit: 10, readSeries });
  check("the same column in a different unit is kept", panels.length, 2);
  check("and nothing is counted as duplicate", rejected.duplicateMeasure, 0);
}

/**
 * The sparkline makes two choices nothing in its output reveals.
 *
 * On a linear axis, India's CO₂ emissions from 1858 sat inside one pixel of
 * the baseline for a hundred and twenty years and rendered as a flat rule with
 * a dot at each end — visually a two-point series, on a page about growth.
 * And the same series has no readings between 1866 and 1878, which the line
 * crossed with a single confident twelve-year segment.
 *
 * Both fixes are invisible by construction: a log sparkline is the same kind
 * of mark as a linear one, and a line that breaks over a gap looks like a line
 * that never had one.
 */
console.log("\nThe sparkline says which scale it is on and where the data stops");
{
  const steady = Array.from({ length: 20 }, (_, i) => ({ year: 2000 + i, value: 100 + i }));
  check("a narrow range stays linear", sparkGeometry(steady, 110, 34).logScale, false);

  const exponential = Array.from({ length: 20 }, (_, i) => ({ year: 2000 + i, value: 2 ** i }));
  check("a range over fiftyfold goes log", sparkGeometry(exponential, 110, 34).logScale, true);

  const withZero = [{ year: 2000, value: 0 }, ...exponential.slice(1)];
  check("a zero in the series keeps it linear", sparkGeometry(withZero, 110, 34).logScale, false);

  const negative = exponential.map((p, i) => (i === 3 ? { ...p, value: -5 } : p));
  check("a negative value keeps it linear", sparkGeometry(negative, 110, 34).logScale, false);

  check("a continuous series is one stroke", sparkGeometry(steady, 110, 34).segments, 1);

  const gapped = [
    ...Array.from({ length: 8 }, (_, i) => ({ year: 1858 + i, value: 10 + i })),
    ...Array.from({ length: 8 }, (_, i) => ({ year: 1878 + i, value: 30 + i })),
  ];
  check("a twelve-year hole breaks the line", sparkGeometry(gapped, 110, 34).segments, 2);

  const decadal = Array.from({ length: 8 }, (_, i) => ({ year: 1950 + i * 10, value: 10 + i }));
  check("a decadal series is not mistaken for a gapped annual one",
    sparkGeometry(decadal, 110, 34).segments, 1);
}

console.log(failures === 0 ? "\nAll panel selector tests passed." : `\n${failures} panel selector test(s) failed.`);
if (failures > 0) process.exit(1);
