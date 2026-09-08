/**
 * The hundred legible indicators, and whether they can actually be shown.
 *
 * A curated list of ids is a list of strings until something checks them. A
 * typo here does not throw — it renders an empty panel under a confident
 * heading, which is the worst failure available to a page whose whole promise
 * is that these numbers are real and comparable.
 *
 * So: every id must resolve to an ingested series, every series must carry
 * enough comparators to be worth comparing, and every indicator must carry the
 * sentence saying what it cannot tell you. That last one is a content rule
 * enforced as a test on purpose — a legible number is easy to over-read, and
 * the qualification is the part that stops it.
 */
import { readFileSync } from "node:fs";
import { EVERYDAY, EVERYDAY_THEMES, byTheme, SPARSE } from "../lib/everyday";
import { WDI_INDICATORS } from "../lib/wdi-catalogue";

let bad = 0;
function ok(name: string, cond: boolean, detail = ""): void {
  if (!cond) bad++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  " + detail}`);
}

interface Series {
  id: string; title: string; peers?: { iso3: string }[]; points?: unknown[];
  unit?: string; unitShort?: string; higherIsBetter?: boolean | null;
}
const wdi = JSON.parse(readFileSync("data/series/wdi.json", "utf8")) as Series[];
const have = new Map(wdi.map((s) => [s.id, s]));

console.log("\nThe list");
ok("a hundred indicators", EVERYDAY.length === 100, String(EVERYDAY.length));
ok("no indicator is listed twice",
  new Set(EVERYDAY.map((e) => e.id)).size === EVERYDAY.length);
ok("every theme has at least one", EVERYDAY_THEMES.every((t) => byTheme(t).length > 0),
  EVERYDAY_THEMES.filter((t) => byTheme(t).length === 0).join(", "));
ok("every indicator sits in a declared theme",
  EVERYDAY.every((e) => (EVERYDAY_THEMES as readonly string[]).includes(e.theme)));

console.log("\nEvery one resolves to real data");
{
  const missing = EVERYDAY.filter((e) => !have.has(e.id));
  ok("no id is missing from the ingested series", missing.length === 0,
    missing.map((e) => e.id).join(", "));

  const thin = EVERYDAY.filter((e) => ((have.get(e.id)?.peers ?? []).length) < 3);
  ok("every indicator carries at least three comparators", thin.length === 0,
    thin.map((e) => e.id).join(", "));

  // Two readings is the floor: enough to show a value and place it against
  // the comparators, which is what this page does.
  const tooThin = EVERYDAY.filter((e) => ((have.get(e.id)?.points ?? []).length) < 2);
  ok("every indicator has at least two readings", tooThin.length === 0,
    tooThin.map((e) => e.id).join(", "));

  // Anything under five is sparse enough that a trend line would mislead, and
  // must be declared rather than merely tolerated.
  const undeclared = EVERYDAY.filter(
    (e) => ((have.get(e.id)?.points ?? []).length) < 5 && SPARSE[e.id] === undefined);
  ok("every rarely-measured indicator is declared sparse, with a reason",
    undeclared.length === 0, undeclared.map((e) => e.id).join(", "));

  // And a declaration that no longer applies is stale — the series may have
  // gained readings since.
  const overDeclared = Object.keys(SPARSE).filter(
    (id) => ((have.get(id)?.points ?? []).length) >= 5);
  ok("no indicator is declared sparse that is no longer sparse",
    overDeclared.length === 0, overDeclared.join(", "));

  ok("every sparse declaration names an indicator that is on the list",
    Object.keys(SPARSE).every((id) => EVERYDAY.some((e) => e.id === id)),
    Object.keys(SPARSE).filter((id) => !EVERYDAY.some((e) => e.id === id)).join(", "));
}

console.log("\nEvery one explains itself");
{
  // A question a person would ask, not a variable name.
  const noQ = EVERYDAY.filter((e) => e.question.length < 12 || !e.question.includes("?"));
  ok("every indicator asks a plain question", noQ.length === 0,
    noQ.map((e) => e.id).join(", "));

  const noWhy = EVERYDAY.filter((e) => e.why.length < 30);
  ok("every indicator says why it tracks growth", noWhy.length === 0,
    noWhy.map((e) => e.id).join(", "));

  // The rule this page exists to enforce.
  const noCaveat = EVERYDAY.filter((e) => e.butNot.length < 30);
  ok("every indicator says what it cannot tell you", noCaveat.length === 0,
    noCaveat.map((e) => e.id).join(", "));

  // A caveat that just repeats the reason is not a caveat.
  const lazy = EVERYDAY.filter((e) => e.butNot.trim() === e.why.trim());
  ok("no caveat merely restates the reason", lazy.length === 0,
    lazy.map((e) => e.id).join(", "));
}

console.log("\nThe ingested file still agrees with the catalogue it came from");
{
  /*
   * title, unit, unitShort and higherIsBetter are copied verbatim out of the
   * catalogue by the World Bank connector, which makes the committed file a
   * cache — and a cache nothing checks will drift. It had: both GFDD access
   * series were carried as unit "index" when their own definitions say per
   * 100,000 adults, so the page printed "44 index" under a chart, and open
   * defecation had no direction, so a row about people with nowhere to go
   * reported "no better direction" instead of ranking India last.
   */
  const drift: string[] = [];
  for (const ind of WDI_INDICATORS) {
    const s = have.get(ind.id);
    if (!s) continue;
    if (s.title !== ind.title) drift.push(`${ind.id}.title`);
    if (s.unit !== ind.unit) drift.push(`${ind.id}.unit`);
    if (s.unitShort !== ind.unitShort) drift.push(`${ind.id}.unitShort`);
    if (s.higherIsBetter !== ind.higherIsBetter) drift.push(`${ind.id}.higherIsBetter`);
  }
  ok("no ingested series carries metadata the catalogue has since changed",
    drift.length === 0, `${drift.length}: ${drift.slice(0, 6).join(", ")}`);
}

console.log("\nThe page can actually draw them");
{
  // India is the subject of every row. Without it there is no value line and
  // no rank, and the row would render as six anonymous dots.
  const noIndia = EVERYDAY.filter(
    (e) => !(have.get(e.id)?.peers ?? []).some((p) => p.iso3 === "IND"));
  ok("every indicator carries India itself", noIndia.length === 0,
    noIndia.map((e) => e.id).join(", "));

  const nav = readFileSync("components/ui/Nav.tsx", "utf8");
  ok("the page is reachable from the nav", nav.includes('"/everyday"'));
}

console.log("\nThe two the request named are handled in writing");
{
  const src = readFileSync("lib/everyday.ts", "utf8");
  // Both were asked for by name and neither exists comparably. The file has to
  // say so, or the next person to read it will assume they were forgotten.
  ok("the file explains why air conditioner sales are absent",
    /air conditioner/i.test(src) && /assembles/i.test(src));
  ok("the file explains why house prices are absent",
    /square foot|house price/i.test(src));
  // And the substitute offered for appliances must actually be in the list.
  ok("the substitute offered for appliances is present",
    EVERYDAY.some((e) => e.id === "wdi-electricity-per-capita"));

  // And the page has to say it too — the docblock is for whoever edits the
  // file, not for the reader who wondered where air conditioners went.
  const page = readFileSync("app/everyday/page.tsx", "utf8");
  ok("the page tells the reader about air conditioner sales", /air conditioner/i.test(page));
  ok("the page tells the reader about house prices", /square foot/i.test(page));
}

if (bad > 0) { console.error(`\n${bad} everyday test(s) failed.`); process.exit(1); }
console.log(`\nAll everyday tests passed (${EVERYDAY.length} indicators).`);
