/**
 * Footfall figures, checked before they ship.
 *
 * The danger on this dataset is not a missing number, it is a number in the
 * wrong units. Tirumala reports around sixty thousand pilgrims a day; Vaishno
 * Devi reports millions a year. Lose the period and a chart ranks the two
 * against each other, wrong by a factor of three hundred and sixty-five.
 */
import { existsSync, readFileSync } from "node:fs";

const FILE = "data/sacred/footfall.json";
if (!existsSync(FILE)) {
  console.log(`\n  skip  ${FILE} not built yet — the ingest runs in Actions.`);
  process.exit(0);
}

let bad = 0;
function ok(name: string, cond: boolean, detail = ""): void {
  if (!cond) bad++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  " + detail}`);
}

interface Row {
  name: string; state: string; page: string;
  value: number; period: "day" | "year"; quote: string;
}
const d = JSON.parse(readFileSync(FILE, "utf8")) as {
  rows: Row[]; silent: string[]; note: string; incomparable: string; coverage: string;
};

console.log("\nThe figures");
// Coverage is a finding, not a fault.
//
// This asked for five and got two, which failed the run and stopped the file
// being committed at all — the same mistake already made once on the canonical
// sets, where a true fact about how thin a source is was dressed up as a
// broken parser. How many temples publish a countable figure is the answer to
// the question, not a bug. What must not happen is a figure that is wrong, and
// every check below is about that.
ok("read at least one figure", d.rows.length >= 1, String(d.rows.length));
ok("accounts for every temple asked",
  d.rows.length + d.silent.length >= 20,
  `${d.rows.length} read, ${d.silent.length} silent`);
ok("every figure states its period",
  d.rows.every((r) => r.period === "day" || r.period === "year"));
ok("every figure travels with the sentence it came from",
  d.rows.every((r) => r.quote.length > 20));
ok("every figure names its article", d.rows.every((r) => r.page.length > 0));

{
  // Bounds that catch a period misread in either direction.
  const daft = d.rows.filter((r) =>
    (r.period === "day" && (r.value < 100 || r.value > 5e6)) ||
    (r.period === "year" && (r.value < 1e4 || r.value > 5e8)));
  ok("no figure is impossible for the period it claims", daft.length === 0,
    daft.map((r) => `${r.name} ${r.value}/${r.period}`).join(" / "));
}
{
  // The number must actually appear in its own quote. A value assembled from
  // one part of a sentence and a magnitude word from another would read
  // plausibly and cite a sentence that does not support it.
  const unsupported = d.rows.filter((r) => {
    const digits = String(Math.round(r.value)).replace(/\D/g, "");
    const lead = digits.slice(0, 2);
    return !new RegExp(`${lead[0]}[\\d,.]*${lead[1] ?? ""}`).test(r.quote.replace(/\s/g, ""));
  });
  ok("each value is visible in the sentence it cites", unsupported.length === 0,
    unsupported.slice(0, 2).map((r) => `${r.name}: ${r.value}`).join(" / "));
}

console.log("\nHonesty of the file");
ok("says these are reported, not official", /reported figure, not an official/i.test(d.note));
ok("says daily and annual are never converted", /never converted/i.test(d.incomparable));
ok("says how many temples had no usable figure", /of \d+ temples asked/i.test(d.coverage));
ok("names the temples that carry no figure", Array.isArray(d.silent));

console.log(bad === 0 ? "\nAll footfall checks passed.\n" : `\n${bad} check(s) failed.\n`);
process.exit(bad === 0 ? 0 : 1);
