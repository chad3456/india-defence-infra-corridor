/**
 * Tests for the constructed security indices and the SATP parser.
 *
 * These get their own file because they carry more risk than the rest of the
 * pipeline. Everything else on this site reports a number somebody else
 * published; this computes one, about people being killed, and publishes it
 * under a name that implies a judgement. If the arithmetic is wrong nobody
 * upstream will contradict it.
 */
import { readFileSync } from "node:fs";
import { tonality, actionIndex, scoreSeries, LIMITS, type SecurityYear } from "../lib/security-index";
import { parseFatalityTable } from "./etl/connectors/satp";
import { SECURITY_SERIES, DEFENCE_PENDING, ALL_SECURITY_SPECS } from "../lib/security-catalogue";
import { getAllSources } from "../lib/data";
import { validateSeries } from "./lib/validate-series";
import type { Series } from "../lib/types";

const failures: string[] = [];
function check(ok: boolean | undefined, label: string, detail = "") {
  const pass = ok === true;
  console.log(`  ${pass ? "pass" : "FAIL"}  ${label}${pass || !detail ? "" : ` — ${detail}`}`);
  if (!pass) failures.push(label);
}

const year = (y: number, c: number, s: number, i: number, extra: Partial<SecurityYear> = {}): SecurityYear => ({
  year: y,
  civilians: c,
  securityForces: s,
  insurgents: i,
  ...extra,
});

console.log("Tonality — bounds and direction");
{
  // A year the state dominates on every dimension it can be measured on.
  const decisive = tonality(year(2020, 5, 5, 200, { incidents: 50, arrests: 300, surrenders: 400 }), [
    year(2019, 100, 100, 20, { incidents: 500 }),
    year(2018, 100, 100, 20, { incidents: 500 }),
  ]);
  // A year the state is losing on every dimension.
  const yielding = tonality(year(2020, 400, 200, 5, { incidents: 900, arrests: 1, surrenders: 0 }), [
    year(2019, 50, 20, 200, { incidents: 100 }),
    year(2018, 50, 20, 200, { incidents: 100 }),
  ]);

  check(decisive.score > 0, `a dominant year scores positive (got ${decisive.score})`);
  check(yielding.score < 0, `a losing year scores negative (got ${yielding.score})`);
  check(decisive.score > yielding.score, "the ordering is the right way round");
  check(decisive.score <= 100 && decisive.score >= -100, `stays inside ±100 (got ${decisive.score})`);
  check(yielding.score <= 100 && yielding.score >= -100, `stays inside ±100 (got ${yielding.score})`);
  check(decisive.dimensions.length === 5, "reports all five dimensions");
  check(
    decisive.dimensions.every((d) => d.score >= -20 && d.score <= 20),
    "no dimension escapes ±20",
  );
  check(
    decisive.dimensions.every((d) => d.meaning.length > 20),
    "every dimension explains itself",
  );
}

console.log("");
console.log("Tonality — refuses to invent");
{
  const first = tonality(year(2004, 100, 100, 100));
  const containment = first.dimensions.find((d) => d.id === "containment");
  const dominance = first.dimensions.find((d) => d.id === "dominance");
  const attrition = first.dimensions.find((d) => d.id === "attrition");
  check(containment?.score === 0, "the first year has no trend, so containment scores zero");
  check(dominance?.score === 0, "and no baseline, so dominance scores zero");
  check(attrition?.score === 0, "unreported arrests score zero rather than being read as none");

  const withArrests = tonality(year(2004, 100, 100, 100, { arrests: 500 }));
  check(
    (withArrests.dimensions.find((d) => d.id === "attrition")?.score ?? 0) > 0,
    "reported arrests do move attrition",
  );

  const empty = tonality(year(2004, 0, 0, 0));
  check(empty.score === 0, `a year with no deaths scores zero, not NaN (got ${empty.score})`);
  check(Number.isFinite(empty.score), "and is a real number");
}

console.log("");
console.log("Tonality — civilian deaths are not free");
{
  const base = [year(2018, 50, 50, 100), year(2019, 50, 50, 100)];
  const clean = tonality(year(2020, 10, 50, 300), base);
  const bloody = tonality(year(2020, 400, 50, 300), base);
  check(
    clean.score > bloody.score,
    "the same neutralisations with more civilian deaths scores lower",
    `${clean.score} vs ${bloody.score}`,
  );
}

console.log("");
console.log("Action Index — bounds and direction");
{
  const history = [
    year(2017, 100, 100, 100, { incidents: 500, arrests: 100, surrenders: 100 }),
    year(2018, 100, 100, 100, { incidents: 500, arrests: 100, surrenders: 100 }),
    year(2019, 100, 100, 100, { incidents: 500, arrests: 100, surrenders: 100 }),
  ];
  const best = actionIndex(
    year(2020, 0, 0, 400, { incidents: 100, arrests: 500, surrenders: 500 }),
    history,
  );
  const worst = actionIndex(
    year(2020, 400, 100, 10, { incidents: 2000, arrests: 0, surrenders: 0 }),
    history,
  );
  const average = actionIndex(
    year(2020, 100, 100, 100, { incidents: 500, arrests: 100, surrenders: 100 }),
    history,
  );

  check(best.index <= 1.6 && best.index >= -1.6, `stays inside ±1.6 (got ${best.index})`);
  check(worst.index <= 1.6 && worst.index >= -1.6, `stays inside ±1.6 (got ${worst.index})`);
  check(best.index > 0 && worst.index < 0, `good year positive, bad year negative (${best.index} / ${worst.index})`);
  check(
    Math.abs(average.index) < 0.001,
    `a year exactly at the series average scores ~0 (got ${average.index})`,
  );
  check(best.components.length === 4, "reports all four components");
  check(
    best.components.every((c) => c.value >= -0.4 && c.value <= 0.4),
    "no component escapes ±0.4",
  );
  const civilian = worst.components.find((c) => c.id === "civilian-cost");
  check((civilian?.value ?? 0) < 0, "civilian deaths above average push the index down");
}

console.log("");
console.log("Scoring a whole series");
{
  const years = [
    year(2004, 400, 200, 100, { incidents: 800 }),
    year(2005, 380, 190, 150, { incidents: 780 }),
    year(2006, 300, 150, 200, { incidents: 700 }),
    year(2007, 200, 100, 250, { incidents: 500 }),
  ];
  const scored = scoreSeries(years);
  check(scored.length === 4, "one result per year");
  check(scored[0]?.tonality.dimensions.every((d) => d.id.length > 0) === true, "dimensions are labelled");
  // The first year cannot see the future; the last should see three years back.
  check(
    (scored[0]?.tonality.dimensions.find((d) => d.id === "dominance")?.score ?? 1) === 0,
    "the earliest year has no baseline",
  );
  check(
    (scored[3]?.tonality.dimensions.find((d) => d.id === "containment")?.score ?? 0) !== 0,
    "a later year does have a trend",
  );
  const improving = (scored[3]?.tonality.score ?? 0) > (scored[0]?.tonality.score ?? 0);
  check(improving, "a campaign that improves every year trends upward");
}

console.log("");
console.log("SATP table parsing");
{
  const html = readFileSync("scripts/__fixtures__/satp-fatalities.html", "utf8");
  const { rows, skipped } = parseFatalityTable(html);
  check(rows.length === 17, `parses every readable year (got ${rows.length}, want 17)`);
  check(rows[0]?.year === 2004, "starts at 2004");
  check(rows[0]?.civilians === 466 && rows[0]?.insurgents === 87, "reads the columns in order");
  check(
    rows.some((r) => r.year === 2009 && r.civilians === 591),
    "strips thousands separators from the total column without confusing the parts",
  );
  check(!rows.some((r) => r.year === 1999), "ignores years before the series starts");
  check(!rows.some((r) => r.year === 2020), "drops a row whose column did not parse");
  check(skipped.length === 1, `and says so (got ${skipped.length} skip message(s))`);
  check(new Set(rows.map((r) => r.year)).size === rows.length, "a repeated header block does not duplicate years");
  check(rows.every((r) => r.civilians >= 0 && r.securityForces >= 0), "no negative counts survive");
  check(
    rows[rows.length - 1]?.year === 2021,
    `ends at the last readable year (got ${rows.at(-1)?.year})`,
  );
}

console.log("");
console.log("Catalogue");
{
  const ids = ALL_SECURITY_SPECS.map((s) => s.id);
  check(new Set(ids).size === ids.length, "series ids are unique");
  check(
    SECURITY_SERIES.every((s) => s.sourceIds.length > 0),
    "every SATP-filled series cites a source",
  );
  const known = new Set(getAllSources().map((s) => s.id));
  const missing = SECURITY_SERIES.flatMap((s) => s.sourceIds).filter((id) => !known.has(id));
  check(missing.length === 0, "every cited source id resolves", missing.join(", "));
  check(
    SECURITY_SERIES.filter((s) => s.provenance === "derived").every((s) => s.confidence === "low"),
    "the constructed indices are graded low confidence",
  );
  check(
    SECURITY_SERIES.filter((s) => s.provenance === "derived").every((s) =>
      s.sourceIds.includes("derived"),
    ),
    "and are labelled as computed here",
  );
  check(
    SECURITY_SERIES.every((s) => s.provenance !== "think-tank" || s.confidence !== "high"),
    "no compilation is graded high confidence",
  );
  check(
    DEFENCE_PENDING.every((s) => Boolean(s.note) || s.sourceIds.length > 0),
    "a series awaiting hand-entry says what it is waiting for",
  );
  check(LIMITS.length >= 5, `the index ships its limits (got ${LIMITS.length})`);

  // Run the real publish gate over a synthetic series built from each spec.
  // A catalogue entry that cannot pass validation is a chart that will never
  // appear, and the first run found exactly that: two low-confidence indices
  // with no note explaining the uncertainty. Catching it here costs a second;
  // catching it in Actions cost a whole pipeline run.
  const asSeries = (spec: (typeof ALL_SECURITY_SPECS)[number]): Series => ({
    id: spec.id,
    title: spec.title,
    definition: spec.definition,
    category: spec.category,
    unit: spec.unit,
    unitShort: spec.unitShort,
    frequency: spec.frequency,
    provenance: spec.provenance,
    confidence: spec.confidence,
    higherIsBetter: spec.higherIsBetter,
    sourceIds: spec.sourceIds,
    points: [
      { period: "2004", value: 1 },
      { period: "2005", value: 2 },
    ],
    notes: spec.note ? [spec.note] : [],
    lastVerified: "2026-08-19",
  });
  for (const spec of SECURITY_SERIES) {
    const problems = validateSeries(asSeries(spec));
    check(problems.length === 0, `${spec.id} would pass the publish gate`, problems.join("; "));
  }
}

console.log("");
if (failures.length) {
  console.error(`${failures.length} security test(s) failed.`);
  process.exit(1);
}
console.log("All security tests passed.");
