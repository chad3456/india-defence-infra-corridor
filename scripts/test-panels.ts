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
import { buildPanels, tally, changeLabel } from "../lib/growth-panels";
import type { Registry, Indicator } from "../lib/owid";

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

function ind(slug: string, category: string): Indicator {
  return {
    slug, title: slug, subtitle: "", column: "v", unit: "u", shortUnit: "u",
    description: "", attribution: "a", citation: "c", timespan: "",
    category, tiers: { series: true, map: true }, countriesWithData: 6,
    hasIndia: true, shard: 0, firstYear: 2000, lastYear: 2020,
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

console.log(failures === 0 ? "\nAll panel selector tests passed." : `\n${failures} panel selector test(s) failed.`);
if (failures > 0) process.exit(1);
