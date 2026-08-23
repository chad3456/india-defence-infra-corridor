/**
 * Tests for the evidence ladder.
 *
 * This page grades the site's own reliability, which makes it the one page
 * whose errors are least likely to be caught by a reader — a wrong grade looks
 * exactly like a right one. So the classifier is tested against synthetic
 * series covering every rule, and the two claims the page makes in prose about
 * its own data are tested against the data itself.
 *
 * The attribution tests exist because the first version of that section was
 * wrong: it described a clean cutover at 2011 when two residual years survive
 * past it. The assertions below pin the shape so the prose cannot drift back.
 */
import {
  classify,
  grade,
  buildEvidenceMap,
  attributionSeries,
  attributionShape,
  RULES,
  RUNGS,
  CONTESTS,
  type Rung,
} from "../lib/epistemic";
import { getAllSeries, getAllSources, getSeries } from "../lib/data";
import { ALL_SECURITY_SPECS } from "../lib/security-catalogue";
import { INDIA_SERIES } from "../lib/india-catalogue";
import type { Series, Source, Provenance } from "../lib/types";
import lweStates from "../data/security/lwe-states.json";

const failures: string[] = [];
function check(ok: boolean | undefined, label: string, detail = "") {
  const pass = ok === true;
  console.log(`  ${pass ? "pass" : "FAIL"}  ${label}${pass || !detail ? "" : ` — ${detail}`}`);
  if (!pass) failures.push(label);
}

function src(id: string, tier: 1 | 2 | 3, provenance: Provenance = "official"): Source {
  return {
    id,
    name: id,
    publisher: id,
    url: `https://example.invalid/${id}`,
    provenance,
    accessed: "2026-01-01",
    tier,
  };
}

function series(over: Partial<Series> & { id: string; provenance: Provenance }): Series {
  return {
    title: over.id,
    definition: "test",
    category: "economy",
    unit: "x",
    unitShort: "x",
    frequency: "annual",
    higherIsBetter: true,
    points: [
      { period: "2020", value: 1 },
      { period: "2021", value: 2 },
    ],
    sourceIds: ["t1"],
    confidence: "high",
    lastVerified: "2026-01-01",
    ...over,
  } as Series;
}

const SOURCES = new Map([
  ["t1", src("t1", 1)],
  ["t2", src("t2", 2)],
  ["t3", src("t3", 3, "press")],
]);

console.log("Classifier — one case per rule");
{
  const cases: Array<[string, Series, Rung, number]> = [
    [
      "no values at all",
      series({ id: "empty", provenance: "official", points: [{ period: "2020", value: null }] }),
      "unmeasured",
      1,
    ],
    ["computed here", series({ id: "d", provenance: "derived" }), "construction", 2],
    ["expert estimate", series({ id: "tt", provenance: "think-tank" }), "estimate", 3],
    ["press report", series({ id: "pr", provenance: "press" }), "estimate", 4],
    ["multilateral compiler", series({ id: "ml", provenance: "multilateral" }), "compilation", 5],
    ["official, all tier 1", series({ id: "of", provenance: "official" }), "record", 6],
    [
      "official with a tier-2 source",
      series({ id: "of2", provenance: "official", sourceIds: ["t1", "t2"] }),
      "compilation",
      7,
    ],
  ];
  for (const [label, s, rung, ruleN] of cases) {
    const got = classify(s, SOURCES);
    check(got.rung === rung && got.ruleN === ruleN, label, `got ${got.rung} via rule ${got.ruleN}`);
  }

  // The rule the whole page turns on: one press-sourced point demotes a series
  // that would otherwise read as a record, because a reader now has to check in
  // two places.
  const mixed = series({
    id: "mixed",
    provenance: "official",
    points: [
      { period: "2020", value: 1 },
      { period: "2021", value: 2, sourceId: "t3" },
    ],
  });
  check(
    classify(mixed, SOURCES).rung === "compilation",
    "a single point from a lower tier demotes the whole series",
  );

  check(
    RULES.length === new Set(RULES.map((r) => r.n)).size && RULES.every((r, i) => r.n === i + 1),
    "the published rule list is numbered without gaps",
  );
  check(
    RULES.every((r) => RUNGS.some((g) => g.id === r.rung)),
    "every published rule names a rung that exists",
  );
}

console.log("");
console.log("Gaps");
{
  const holed = grade(
    series({
      id: "holed",
      provenance: "official",
      points: [
        { period: "2018", value: 1 },
        { period: "2019", value: null },
        { period: "2020", value: 3 },
      ],
    }),
    SOURCES,
  );
  check(holed.holes === 1 && holed.span?.[0] === 2018, "a missing year inside the span is a hole");

  const edge = grade(
    series({
      id: "edge",
      provenance: "official",
      points: [
        { period: "2018", value: null },
        { period: "2019", value: 1 },
        { period: "2020", value: 3 },
      ],
    }),
    SOURCES,
  );
  check(edge.holes === 0, "a missing year before the series starts is not a hole");
}

console.log("");
console.log("Whole-site map");
{
  const map = buildEvidenceMap(getAllSeries(), getAllSources());
  check(
    map.graded.length === getAllSeries().length,
    "every stored series is graded",
    `${map.graded.length} of ${getAllSeries().length}`,
  );
  const rungTotal = RUNGS.reduce((n, r) => n + map.byRung[r.id].length, 0);
  check(rungTotal === map.graded.length, "the rungs partition the series exactly");
  const crossTotal = RUNGS.reduce(
    (n, r) => n + map.crossTab[r.id].high + map.crossTab[r.id].medium + map.crossTab[r.id].low,
    0,
  );
  check(crossTotal === map.graded.length, "the cross-tabulation totals to the same number");
  check(
    map.byCategory.reduce((n, c) => n + c.total, 0) === map.graded.length,
    "the sector breakdown totals to the same number",
  );

  // The page states this in prose. The build should refuse to let it become false.
  check(
    map.totals.lowConfidenceWithoutNote === 0,
    "no low-confidence series ships without a published caveat",
    `${map.totals.lowConfidenceWithoutNote} do`,
  );

  // The claim in the opening paragraph: compilation is the largest rung.
  const largest = RUNGS.reduce((a, b) =>
    map.byRung[a.id].length >= map.byRung[b.id].length ? a : b,
  );
  check(
    largest.id === "compilation",
    "compilation is the largest rung, as the page says",
    `largest is ${largest.id}`,
  );
}

console.log("");
console.log("The attribution break");
{
  const rows = attributionSeries(lweStates.rows);
  const shape = attributionShape(rows);

  check(rows.length > 15, "the state rows cover enough years to describe");
  check(
    shape.lastConsecutiveYear !== null && shape.firstZeroRunYear !== null,
    "both ends of the shape are found",
  );
  check(
    (shape.firstZeroRunYear ?? 0) > (shape.lastConsecutiveYear ?? 0),
    "the zero run starts after the populated run ends",
  );
  // The specific finding, pinned. If SATP restates and these move, the test
  // fails and the prose gets re-read rather than silently going stale.
  check(shape.lastConsecutiveYear === 2010, "the populated run ends in 2010", `${shape.lastConsecutiveYear}`);
  check(shape.firstZeroRunYear === 2015, "the unbroken zeros start in 2015", `${shape.firstZeroRunYear}`);
  check(
    shape.residuals.length === 2 && shape.residuals.every((r) => r.year > 2010 && r.year < 2015),
    "the two residual years sit between the runs",
    JSON.stringify(shape.residuals),
  );
  check(
    rows.slice(rows.findIndex((r) => r.year === shape.firstZeroRunYear)).every((r) => r.unattributed === 0),
    "nothing after the zero-run start is non-zero",
  );
}

console.log("");
console.log("Every empty chart says what is missing");
{
  // A declared series with no data and no stated blocker is the worst kind of
  // gap: it looks like work in progress and is indistinguishable from a
  // question nobody has looked into. If a spec ships empty, it has to name the
  // document that would fill it.
  const declared = [...ALL_SECURITY_SPECS, ...INDIA_SERIES];
  const empty = declared.filter((spec) => !getSeries(spec.id));
  // A series a connector fills needs no blocker: "fills on the next pipeline
  // run" is the answer, and it is true of every connector rather than of SATP
  // specifically. The exemption was written when SATP was the only one.
  const silent = empty.filter((spec) => !spec.blockedBy && spec.filledBy === "curated");
  check(
    silent.length === 0,
    `all ${empty.length} empty series name their blocker`,
    silent.map((s) => s.id).join(", "),
  );
  check(
    empty.every((spec) => !spec.blockedBy || spec.blockedBy.needs.trim().length > 30),
    "each blocker names a document rather than gesturing at one",
  );
  // And the converse: a series that is filled should not still claim to be
  // blocked, or the page contradicts its own chart.
  const stale = declared.filter((spec) => getSeries(spec.id) && spec.blockedBy);
  check(stale.length === 0, "no filled series still carries a blocker", stale.map((s) => s.id).join(", "));
}

console.log("");
console.log("Contested claims");
{
  check(CONTESTS.length > 0, "at least one contest is declared");
  check(
    CONTESTS.every((c) => c.sides.length >= 2 && c.settledBy.trim().length > 20),
    "every contest names both sides and what would settle it",
  );
  check(
    new Set(CONTESTS.map((c) => c.id)).size === CONTESTS.length,
    "contest ids are unique",
  );
  // A contest claiming both sides are held here has to be one the site can
  // actually show, or the page is asserting access it does not have.
  check(
    CONTESTS.filter((c) => c.weHold === "both").length >= 1,
    "at least one contest is demonstrable from data in this repository",
  );
}

console.log("");
if (failures.length) {
  console.error(`${failures.length} evidence test(s) failed.`);
  process.exit(1);
}
console.log("All evidence tests passed.");
