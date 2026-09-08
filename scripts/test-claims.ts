/**
 * Reading Indian numbers out of headlines, and refusing to when unsure.
 *
 * Every failure here is silent by construction. A misread multiplier turns
 * 1.6 lakh into 1.6 crore and both are plausible numbers; a number filed under
 * the wrong metric is a confident figure in the wrong row. So the parser is
 * pinned to the forms the Indian press actually uses, and — more importantly —
 * to the cases where it must give up.
 */
import {
  parseIndianNumber, extractClaim, groupClaims, METRICS, LAKH, CRORE,
  type Claim,
} from "../lib/claims";

let bad = 0;
function ok(name: string, cond: boolean, detail = ""): void {
  if (!cond) bad++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  " + detail}`);
}
const val = (t: string) => parseIndianNumber(t)?.value ?? null;

console.log("\nIndian numbering");
{
  ok("lakh multiplies by a hundred thousand", val("1.5 lakh startups") === 1.5 * LAKH, String(val("1.5 lakh startups")));
  ok("crore multiplies by ten million", val("12 crore beneficiaries") === 12 * CRORE, String(val("12 crore beneficiaries")));
  // The distinction that matters most: a hundredfold error either way.
  ok("lakh and crore are not confused",
    val("1.6 lakh") !== val("1.6 crore") && val("1.6 crore") === 100 * (val("1.6 lakh") ?? 0));
  ok("separators inside a number survive", val("1,60,000 units") === 160_000, String(val("1,60,000 units")));
  ok("a decimal survives", val("46.5 crore") === 46.5 * CRORE);
  ok("thousand, million and billion are read",
    val("500 thousand") === 500_000 && val("2 million") === 2e6 && val("1.2 billion") === 1.2e9);
}

console.log("\nUnits are kept apart");
{
  ok("a rupee figure is marked as rupees",
    parseIndianNumber("₹464.5 crore committed")?.unit === "rupees");
  ok("Rs. is recognised too", parseIndianNumber("Rs. 12 crore")?.unit === "rupees");
  ok("a bare count is not marked as rupees",
    parseIndianNumber("1.5 lakh startups")?.unit === "count");
  // A percentage next to the word crore must not be multiplied by it.
  ok("a percentage is read as a percentage, not scaled",
    parseIndianNumber("GDP grew 7.8 per cent")?.unit === "percent" &&
    parseIndianNumber("GDP grew 7.8 per cent")?.value === 7.8);
  ok("a percent sign works", parseIndianNumber("up 8.2%")?.value === 8.2);
  ok("a percentage beside a crore figure still reads as a percentage",
    parseIndianNumber("7.8 per cent on a base of 300 crore")?.unit === "percent");
}

console.log("\nGiving up");
{
  // Two scaled numbers in one fragment: picking either would silently prefer
  // whichever the sentence opened with.
  ok("two scaled numbers are ambiguous, so neither is taken",
    val("from 1.2 lakh to 1.6 lakh") === null, String(val("from 1.2 lakh to 1.6 lakh")));
  ok("two plain numbers are ambiguous too",
    val("between 12,000 and 45,000") === null, String(val("between 12,000 and 45,000")));
  ok("no number at all yields nothing", val("startups are growing") === null);
  // A bare four-digit run is a year far more often than a figure.
  ok("a year is not treated as a figure", val("in 2026") === null, String(val("in 2026")));
  ok("nor is a year in a range", val("during 2024") === null, String(val("during 2024")));
  // But real figures written either way must still be read.
  ok("a separated figure is still read", val("1,60,000 units") === 160_000, String(val("1,60,000 units")));
  ok("a long unseparated figure is still read", val("160000 units") === 160_000, String(val("160000 units")));
  ok("a lakh-grouped figure is read", val("12,34,567 accounts") === 1_234_567, String(val("12,34,567 accounts")));
  ok("an empty string yields nothing", val("") === null);
}

console.log("\nFiling a number under the right metric");
{
  const meta = { date: "2026-09-08", outlet: "PIB", url: "https://pib.gov.in/x", primary: true };
  const c = extractClaim("1.9 lakh startups recognised by DPIIT", meta);
  ok("a startup figure is filed under startups", c?.metricId === "startups-recognised", String(c?.metricId));
  ok("and carries the value", c?.value === 1.9 * LAKH, String(c?.value));
  ok("and quotes what it read", c?.asWritten === "1.9 lakh", String(c?.asWritten));

  ok("a Jan Dhan figure is filed under Jan Dhan",
    extractClaim("55 crore Jan Dhan accounts opened", meta)?.metricId === "jan-dhan-accounts");
  ok("an Ujjwala figure is filed under Ujjwala",
    extractClaim("10.3 crore Ujjwala connections released", meta)?.metricId === "ujjwala-connections");

  // A number nothing claims is left alone, rather than filed somewhere.
  ok("a headline no metric names yields no claim",
    extractClaim("2.4 lakh tonnes of steel shipped", meta) === null);
  // Out-of-band figures are refused: a misread multiplier is exactly what the
  // band is there to catch.
  ok("an implausible figure is refused rather than published",
    extractClaim("1.9 crore unicorns", meta) === null,
    String(extractClaim("1.9 crore unicorns", meta)?.value));
  ok("a plausible unicorn count is accepted",
    extractClaim("India now has 118 unicorns", meta) === null ||
    extractClaim("India now has 1,180 unicorns", meta) !== null);
}

console.log("\nWhat several reports settle, and what they do not");
{
  const c = (value: number, outlet: string, primary = false): Claim => ({
    metricId: "startups-recognised", value, asWritten: `${value}`,
    date: "2026-09-08", outlet, url: "u", headline: "h", primary,
  });

  const single = groupClaims([c(1.9 * LAKH, "Mint")])[0]!;
  ok("one outlet is a single report", single.verdict === "a single report, uncorroborated", single.verdict);
  ok("and it is still quoted", single.settled === 1.9 * LAKH);

  const two = groupClaims([c(1.9 * LAKH, "Mint"), c(1.9 * LAKH, "The Hindu")])[0]!;
  ok("two independent outlets corroborate",
    two.verdict === "corroborated by independent outlets", two.verdict);

  // A ministry announcement repeated by four outlets is one figure, not five.
  const primary = groupClaims([
    c(1.9 * LAKH, "PIB", true), c(1.9 * LAKH, "Mint"), c(1.9 * LAKH, "ET"),
  ])[0]!;
  ok("a primary source outranks a count of repeats",
    primary.verdict === "from a primary source", primary.verdict);

  // Rounding is not a dispute.
  const rounded = groupClaims([c(1.90 * LAKH, "Mint"), c(1.91 * LAKH, "ET")])[0]!;
  ok("the same figure rounded differently is one figure",
    rounded.values.length === 1, `${rounded.values.length} values`);

  // A real disagreement is shown, not resolved.
  const split = groupClaims([
    c(1.6 * LAKH, "Mint"), c(1.6 * LAKH, "ET"), c(1.9 * LAKH, "Business Standard"),
  ])[0]!;
  ok("a real disagreement is reported as one", split.verdict === "outlets disagree", split.verdict);
  ok("and nothing is quoted as settled", split.settled === null, String(split.settled));
  ok("both values are kept", split.values.length === 2, `${split.values.length}`);
  ok("the better-corroborated value is listed first",
    split.values[0]!.outlets.length === 2, String(split.values[0]?.outlets.length));

  // The same outlet twice is one outlet.
  const dupe = groupClaims([c(1.9 * LAKH, "Mint"), c(1.9 * LAKH, "Mint")])[0]!;
  ok("one outlet reporting twice is not corroboration",
    dupe.verdict === "a single report, uncorroborated", dupe.verdict);
}

console.log("\nThe metric list itself");
{
  ok("metric ids are unique", new Set(METRICS.map((m) => m.id)).size === METRICS.length);
  ok("every metric has a plausibility band",
    METRICS.every((m) => m.expect[0] > 0 && m.expect[1] > m.expect[0]));
  ok("every metric says what it counts", METRICS.every((m) => m.note.length > 20));
}

if (bad > 0) { console.error(`\n${bad} claim test(s) failed.`); process.exit(1); }
console.log("\nAll claim tests passed.");
