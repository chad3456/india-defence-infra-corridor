/**
 * The mela's arithmetic, pinned.
 *
 * A cheerful page about a government's record is the page on this site most
 * likely to be read uncritically, which makes its numbers the ones that most
 * need to be right. Each test below guards one way a before-and-after chart
 * flatters or libels without anyone typing a wrong digit.
 */
import {
  termOf, inTerm, nearest, rungsOf, paceOf, spanWords, fmt, type Obs,
} from "../lib/mela-shared";
import { PROGRAMMES } from "../lib/mela-programmes";
import { mentionsYear, mapBatch } from "./etl/connectors/mela-verify";

let failures = 0;
function check(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`  ${ok ? "pass" : "FAIL"}  ${name}${ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
}
const o = (year: number, value: number, period = String(year)): Obs => ({ year, value, period });

console.log("Terms, from a launch year");
{
  check("2014 is Term I", termOf(2014), "I");
  check("2018 is Term I", termOf(2018), "I");
  /* A year cannot say which side of 30 May 2019 a scheme fell. Guessing
     would assign some schemes to the wrong government term. */
  check("2019 is a boundary, not a guess", termOf(2019), "I/II");
  check("2023 is Term II", termOf(2023), "II");
  check("2024 is a boundary", termOf(2024), "II/III");
  check("2025 is Term III", termOf(2025), "III");
  check("2013 is before", termOf(2013), "before");
  check("a boundary year shows under both terms", [inTerm("I/II", "I"), inTerm("I/II", "II"), inTerm("I/II", "III")], [true, true, false]);
  check("all shows everything", inTerm("before", "all"), true);
}

console.log("\nRungs are observations, never interpolations");
{
  const obs = [o(2011, 35), o(2014, 53), o(2017, 80), o(2021, 78), o(2024, 89)];
  const r = rungsOf(obs);
  check("start is 2014", r[0]?.obs?.year, 2014);
  /* The World Bank's account-ownership survey has no 2019. The rung reports
     the 2017 survey, labelled 2017 — never a 2019 value drawn between two. */
  check("Term I end is the nearest real survey, 2017", r[1]?.obs?.year, 2017);
  check("Term II end is 2024", r[2]?.obs?.year, 2024);
  check("latest is not repeated when it is the Term II rung", r[3]?.obs, null);

  /* The start never looks forward. A record of what a government did must
     not start from a reading taken after it took office. */
  const late = [o(2016, 10), o(2020, 20), o(2025, 30)];
  check("no start is taken from after 2014", rungsOf(late)[0]?.obs, null);

  const gap = [o(2014, 1), o(2025, 9)];
  const g = rungsOf(gap);
  check("a missing term end is a gap", [g[1]?.obs, g[2]?.obs], [null, null]);
  check("and the latest still shows", g[3]?.obs?.year, 2025);

  check("nearest prefers the earlier on a tie", nearest([o(2018, 1), o(2020, 2)], 2019, 2, 2)?.year, 2018);
  check("nearest respects its window", nearest([o(2010, 1)], 2014, 2, 0), null);

  /* A fiscal-year series carries its own label through, so "FY2013-14"
     is what the page prints, not "2013". */
  const fy = rungsOf([o(2013, 91287, "FY2013-14"), o(2024, 146342, "FY2024-25")]);
  check("a fiscal year keeps its label", fy[0]?.obs?.period, "FY2013-14");
}

console.log("\nThe pace comparison");
{
  /*
   * The case the gap-closure measure exists for. Electricity access rose 20.7
   * points in the decade before 2014 and 14.8 after. In points per year that
   * is a slowdown — and it is wrong, because the last fifteen points are the
   * remote hamlets. As a share of the remaining gap: 58% closed before, 99%
   * after.
   */
  const elec = [o(2004, 64.4), o(2014, 85.1), o(2024, 99.9)];
  const p = paceOf(elec, "gap-up", "up");
  check("gap closed before 2014", Math.round(p?.before.value ?? 0), 58);
  check("gap closed since", Math.round(p?.after.value ?? 0), 99);
  check("so it reads as faster, not slower", p?.verdict, "improved faster than the decade before");

  /* The same data scored in points would have said the opposite. */
  const asPoints = paceOf(elec, "pp", "up");
  check("points per year would have called it slower", asPoints?.verdict, "improved more slowly than the decade before");

  /* Infant mortality: lower is better, measured as a relative fall. */
  const imr = paceOf([o(2004, 58.5), o(2014, 38.2), o(2024, 23.3)], "gap-down", "up");
  check("a relative fall is printed as a fall", spanWords("gap-down", imr!.before), "fell 35%");
  check("similar pace is called similar", imr?.verdict, "improved at about the pace of the decade before");

  /* Manufacturing's share: falling in both periods, faster after. The page
     must be able to say that, and say it plainly. */
  const mfg = paceOf([o(2004, 15.8), o(2014, 15.1), o(2025, 13.5)], "pp", "up");
  check("a worsening is called a worsening", mfg?.verdict, "worsened, and faster than the decade before");

  const turn = paceOf([o(2004, 34.8), o(2014, 26.6), o(2025, 32.4)], "pp", "up");
  check("a turnaround is recognised", turn?.verdict, "turned around after worsening in the decade before");

  const rev = paceOf([o(2004, 0.8), o(2014, 1.7), o(2025, 1.0)], "pp", "up");
  check("a reversal is recognised", rev?.verdict, "reversed: improved in the decade before, worsened since");

  check("no 2004 reading, no comparison", paceOf([o(2014, 1), o(2024, 2)], "pp", "up"), null);
  check("fewer than five years since, no comparison", paceOf([o(2004, 1), o(2014, 2), o(2017, 3)], "pp", "up"), null);
  check("an unscored direction gets no praise or blame",
    paceOf([o(2004, 2.8), o(2014, 2.5), o(2024, 2.3)], "pp", "neither")?.verdict,
    "moved, in a direction this page does not score");
}

console.log("\nFormatting");
{
  check("Indian digit grouping", fmt(146342, "int"), "1,46,342");
  check("rupees in crore", fmt(38424, "inr-cr"), "₹38,424 cr");
  check("dollars in trillions", fmt(3.956e12, "usd-tn"), "$3.96tn");
  check("a count in crore", fmt(592365564, "crore"), "59.2 crore");
}

console.log("\nThe curated list");
{
  const ids = PROGRAMMES.map((p) => p.id);
  check("ids are unique", new Set(ids).size, ids.length);
  check("every programme names an article", PROGRAMMES.every((p) => p.article.length > 2), true);
  check("every year is plausible", PROGRAMMES.every((p) => p.year >= 1947 && p.year <= 2026), true);
  /*
   * The list must contain what a government would leave out, or it is an
   * advertisement. These three are pinned so a later edit cannot quietly drop
   * them.
   */
  for (const id of ["farm-laws", "demonetisation", "dbt"]) {
    check(`the list keeps "${id}"`, ids.includes(id), true);
  }
  check("a pre-2014 programme is marked as such", termOf(PROGRAMMES.find((p) => p.id === "dbt")!.year), "before");
  check("every stall has at least three programmes",
    ["infrastructure", "defence", "finance", "manufacturing", "innovation", "education", "rural", "women", "health", "digital", "trade"]
      .every((s) => PROGRAMMES.filter((p) => p.stall === s).length >= 3), true);
  check("notes are neutral lines, not verdicts",
    PROGRAMMES.some((p) => /\b(?:historic|landmark|revolutionary|massive success|failed)\b/i.test(p.note ?? "")), false);
}

console.log("\nVerification reads what it claims to");
{
  check("a year inside a larger number does not count", mentionsYear("population 120165 people", 2016), false);
  check("a year as a year counts", mentionsYear("launched on 28 August 2014 by", 2014), true);
  check("a year before a comma counts", mentionsYear("in 2016, the", 2016), true);

  /* A redirect must not read as a missing article. */
  const body = { query: {
    redirects: [{ from: "Swachh Bharat Abhiyan", to: "Swachh Bharat Mission" }],
    pages: [{ title: "Swachh Bharat Mission", extract: "launched in 2014", fullurl: "https://en.wikipedia.org/wiki/Swachh_Bharat_Mission" }],
  } };
  const m = mapBatch(body, ["Swachh Bharat Abhiyan"]);
  check("a redirect resolves to its target", m.get("Swachh Bharat Abhiyan")?.title, "Swachh Bharat Mission");
  const miss = mapBatch({ query: { pages: [{ title: "Nope", missing: true }] } }, ["Nope"]);
  check("a missing page is missing", miss.get("Nope")?.title, null);
  check("an unreadable response is missing, not verified", mapBatch(null, ["X"]).get("X")?.title, null);
}

console.log(failures === 0 ? "\nAll mela tests passed." : `\n${failures} mela test(s) failed.`);
if (failures > 0) process.exit(1);
