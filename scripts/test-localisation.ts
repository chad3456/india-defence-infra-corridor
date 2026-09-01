/**
 * Tests for the import-substitution classifier.
 *
 * The classifier is the one place on the made-in-India dashboard where a
 * judgement gets made, and it gets made thousands of times without anybody
 * looking. These cases pin the behaviour that matters: that a reversal built on
 * collapsing demand is not reported as a reversal, that a thin line is refused
 * rather than graded, and that the assembly check can actually contradict the
 * finished-good line.
 */
import {
  classifyLine, assemblySignature, coverage, nearRevision, RULES,
  type LocalisationLine, type TradeYear,
} from "../lib/localisation";

let failures = 0;
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Build a line from [year, imports, exports] triples. */
function line(rows: Array<[number, number, number]>): LocalisationLine {
  const years: TradeYear[] = rows.map(([year, m, x]) => ({ year, m, x }));
  return { code: "999999", description: "test", chapter: "99", years };
}

const M = 1_000_000;

console.log("coverage");
check("exports over imports", coverage(100, 50) === 0.5);
check("exports with no imports is infinite, not zero", coverage(0, 50) === Number.POSITIVE_INFINITY);
check("nothing either way is zero", coverage(0, 0) === 0);

console.log("\nclassifyLine");

// A genuine reversal: imports flat, exports overtake them.
const reversal = classifyLine(line([
  [2002, 100 * M, 10 * M], [2003, 110 * M, 12 * M], [2004, 105 * M, 15 * M],
  [2022, 120 * M, 300 * M], [2023, 130 * M, 340 * M], [2024, 125 * M, 360 * M],
]));
check("net importer to net exporter is a reversal", reversal.stage === "reversed", reversal.stage);
check("reversal reports the windows it used", reversal.openYears.length === 3 && reversal.closeYears.length === 3);

// The trap: imports collapsed, exports did nothing. Coverage improves on
// arithmetic alone and this must not be sold as a win.
const collapse = classifyLine(line([
  [2002, 100 * M, 40 * M], [2003, 100 * M, 40 * M], [2004, 100 * M, 40 * M],
  [2022, 20 * M, 40 * M], [2023, 20 * M, 40 * M], [2024, 20 * M, 41 * M],
]));
check("demand collapse is flagged", collapse.flags.includes("demand"), JSON.stringify(collapse.flags));
check("demand collapse is not reported as a reversal", collapse.stage !== "reversed", collapse.stage);

// Both sides growing together in proportion: entrepot-shaped.
const reexport = classifyLine(line([
  [2002, 100 * M, 100 * M], [2003, 100 * M, 100 * M], [2004, 100 * M, 100 * M],
  [2022, 300 * M, 300 * M], [2023, 310 * M, 310 * M], [2024, 320 * M, 320 * M],
]));
check("proportional two-way growth is flagged as re-export", reexport.flags.includes("reexport"), JSON.stringify(reexport.flags));

// Dependence getting worse, on a line that is a net importer throughout.
const deepening = classifyLine(line([
  [2002, 100 * M, 50 * M], [2003, 100 * M, 50 * M], [2004, 100 * M, 50 * M],
  [2022, 400 * M, 50 * M], [2023, 420 * M, 52 * M], [2024, 450 * M, 51 * M],
]));
check("imports outrunning exports is deepening", deepening.stage === "deepening", deepening.stage);

// The bug this ladder was rebuilt to fix. Refined petroleum exports nine times
// what it imports, and its ratio still fell from a higher one. Calling that
// "dependence is increasing" was simply false, so level is settled before
// trend: a net exporter can never land in an import-dependence category.
const bigExporterLosingGround = classifyLine(line([
  [2002, 100 * M, 2000 * M], [2003, 100 * M, 2000 * M], [2004, 100 * M, 2000 * M],
  [2022, 2700 * M, 24500 * M], [2023, 2800 * M, 24000 * M], [2024, 2700 * M, 24600 * M],
]));
check("a large net exporter whose ratio fell is never 'deepening'",
  bigExporterLosingGround.stage !== "deepening", bigExporterLosingGround.stage);
check("a net exporter at both ends is 'holding'",
  bigExporterLosingGround.stage === "holding", bigExporterLosingGround.stage);
check("...and it is genuinely a net exporter",
  bigExporterLosingGround.closeX > bigExporterLosingGround.closeM);

// The mirror of a reversal: sold it, now buys it.
const slipped = classifyLine(line([
  [2002, 20 * M, 200 * M], [2003, 22 * M, 210 * M], [2004, 21 * M, 190 * M],
  [2022, 400 * M, 90 * M], [2023, 420 * M, 88 * M], [2024, 450 * M, 92 * M],
]));
check("net exporter to net importer is 'slipped'", slipped.stage === "slipping", slipped.stage);

// No stage on the import-dependence arm may hold a net exporter.
const IMPORT_STAGES = new Set(["narrowing", "import-reliant", "deepening"]);
for (const [name, v] of [
  ["reversal", reversal], ["deepening", deepening], ["slipped", slipped],
  ["big exporter", bigExporterLosingGround],
] as const) {
  if (IMPORT_STAGES.has(v.stage)) {
    check(`${name}: an import-dependence stage implies a net importer now`,
      v.closeCoverage < 1, `coverage ${v.closeCoverage}`);
  }
}

// Too small to mean anything, even though the ratio moved enormously.
const thin = classifyLine(line([
  [2002, 40_000, 1_000], [2003, 41_000, 1_100], [2004, 39_000, 900],
  [2022, 45_000, 90_000], [2023, 46_000, 95_000], [2024, 44_000, 99_000],
]));
check("tiny trade is refused, not graded", thin.stage === "thin", thin.stage);
check("the refusal threshold is the published one", RULES.minTradeUsd === 5_000_000);

// Grew from nothing into real trade — must NOT be refused as thin.
const grew = classifyLine(line([
  [2002, 200_000, 0], [2003, 210_000, 0], [2004, 190_000, 1_000],
  [2022, 50 * M, 200 * M], [2023, 55 * M, 220 * M], [2024, 52 * M, 240 * M],
]));
check("a line that grew into real trade is graded", grew.stage !== "thin", grew.stage);

// Not enough years to have two windows.
const short = classifyLine(line([[2022, 100 * M, 200 * M], [2023, 100 * M, 200 * M]]));
check("too few years is thin", short.stage === "thin", short.stage);

console.log("\nassemblySignature");
const inputsDeepening = [deepening, deepening, deepening, reversal];
const sig = assemblySignature(reversal, inputsDeepening);
check("finished good up, inputs down reads as assembly",
  sig?.verdict === "assembly-signature", JSON.stringify(sig));
check("assembly verdict counts its evidence", sig?.inputsTotal === 4 && sig?.inputsDeepening === 3);

const integrated = assemblySignature(reversal, [reversal, reversal, reversal, reversal]);
check("finished good and inputs both up reads as integrated",
  integrated?.verdict === "integrated", JSON.stringify(integrated));

check("no usable inputs returns null rather than a guess",
  assemblySignature(reversal, [thin, thin]) === null);
check("no inputs at all returns null", assemblySignature(reversal, []) === null);

console.log("\nHS revisions");
check("2017 is a revision year", nearRevision(2017));
check("2016 is within slack of 2017", nearRevision(2016));
check("2019 is clear of any revision", !nearRevision(2019));

console.log(failures === 0 ? "\nAll localisation tests passed." : `\n${failures} failing.`);
process.exit(failures === 0 ? 0 : 1);
