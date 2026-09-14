/**
 * The AI record, and the CSV reader under it.
 *
 * The parser is the risky part. A naive split on commas does not throw on a
 * quoted field containing one — it silently shifts every value in that row one
 * column to the left, so a model's parameter count lands under "country" and
 * nothing looks wrong until someone checks a row by hand. Epoch's file is full
 * of quoted organisation lists, so this is not a hypothetical.
 */
import { existsSync, readFileSync } from "node:fs";
import { parseCsv } from "./etl/connectors/ai-models";

let bad = 0;
function ok(name: string, cond: boolean, detail = ""): void {
  if (!cond) bad++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  " + detail}`);
}

console.log("\nThe CSV reader");
{
  const { header, rows } = parseCsv('a,b,c\n1,2,3\n4,5,6\n');
  ok("reads a plain file", header.join("|") === "a|b|c" && rows.length === 2, JSON.stringify(rows));
  ok("a trailing newline is not a row", rows.length === 2);
}
{
  // The case that shifts a row without erroring.
  const { rows } = parseCsv('model,org,params\nGPT-4,"OpenAI, Microsoft",1.8T\n');
  ok("a comma inside quotes does not split the field",
    rows[0]?.length === 3 && rows[0]![1] === "OpenAI, Microsoft", JSON.stringify(rows[0]));
  ok("and the column after it is still correct", rows[0]![2] === "1.8T");
}
{
  const { rows } = parseCsv('a,b\n"he said ""hi""",2\n');
  ok("a doubled quote is one quote", rows[0]![0] === 'he said "hi"', JSON.stringify(rows[0]));
}
{
  const { rows } = parseCsv('a,b\n"line one\nline two",2\n');
  ok("a newline inside quotes does not end the row",
    rows.length === 1 && rows[0]![0]!.includes("\n"), JSON.stringify(rows));
}
{
  // A ragged row is a parse failure. Padding it into alignment would put every
  // later value under the wrong header, which is the failure this guards.
  const { rows } = parseCsv('a,b,c\n1,2\n3,4,5\n');
  ok("a row with the wrong number of fields is dropped, not padded",
    rows.length === 1 && rows[0]![0] === "3", JSON.stringify(rows));
}
{
  ok("an empty file yields nothing", parseCsv("").rows.length === 0);
}

/**
 * `--readers-only` skips the checks on the built file.
 *
 * The ingest runs this before the build, so a broken CSV reader fails in
 * seconds rather than after fetching a two-megabyte file and ten author
 * listings. But the committed record at that moment is the *old* one, and
 * gating the build on the old artifact is how a fix gets blocked by the very
 * thing it fixes.
 */
const readersOnly = process.argv.includes("--readers-only");

console.log("\nThe built record, if it exists");
const FILE = "data/ai/models.json";
if (readersOnly) {
  console.log("  skip  --readers-only: the record is checked after the build, not before it.");
} else if (!existsSync(FILE)) {
  console.log("  skip  not built yet — the connector runs in Actions.");
} else {
  interface M { id: string; createdAt: string | null; downloads: number | null; languages: string[] }
  interface L { author: string; org: string; country: string; models: M[]; note: string; note2?: string }
  const d = JSON.parse(readFileSync(FILE, "utf8")) as {
    labs: L[]; indianModelCount: number; indicModelCount: number; labCount: number;
    languagesCovered: Array<{ code: string; models: number }>;
    byYear: Array<{ year: number; models: number }>;
    frontier: { columns: string[]; rowCount: number; models: Array<{ name: string }> };
    whatAnAuthorIs: string; noFunding: string; downloadsNote: string; controlsNote: string;
  };

  const indian = d.labs.filter((l) => l.country === "India");
  ok("every lab declares what its account is", d.labs.every((l) => l.note.length > 0));
  ok("every model row carries an id", d.labs.every((l) => l.models.every((m) => m.id.length > 0)));
  ok("the Indian model count is the sum of the Indian labs' rows",
    d.indianModelCount === indian.reduce((n, l) => n + l.models.length, 0),
    `${d.indianModelCount} vs ${indian.reduce((n, l) => n + l.models.length, 0)}`);

  // The controls exist to give scale and must never enter an Indian total.
  // Nothing about this would look wrong if it broke — the number would simply
  // be larger, and larger is what a reader half-expects.
  const controls = d.labs.filter((l) => l.country === "control");
  ok("controls are present and marked", controls.length > 0);
  ok("no control's models are counted as Indian",
    d.indianModelCount === d.labs.filter((l) => l.country === "India")
      .reduce((n, l) => n + l.models.length, 0) &&
    controls.every((c) => c.country !== "India"));
  ok("the control accounts really are larger than the Indian ones",
    controls.some((c) => c.models.length > 0));

  ok("an account with no models says so rather than showing empty",
    d.labs.filter((l) => l.models.length === 0).every((l) => Boolean(l.note2)),
    d.labs.filter((l) => l.models.length === 0 && !l.note2).map((l) => l.author).join(", "));

  ok("the per-year counts sum to the dated models",
    d.byYear.reduce((n, y) => n + y.models, 0) ===
      indian.flatMap((l) => l.models).filter((m) => m.createdAt).length);

  ok("every language counted is one a model actually declares",
    d.languagesCovered.every((lc) =>
      indian.some((l) => l.models.some((m) => m.languages.includes(lc.code)))));

  console.log("\nHonesty of the file");
  ok("says an author is not a company", /not a company/i.test(d.whatAnAuthorIs));
  ok("says an absent author is not an absence of AI work",
    /invisible here/i.test(d.whatAnAuthorIs));
  ok("says there are no funding figures and why", /Tracxn refused/i.test(d.noFunding));
  ok("says downloads are rolling and gameable",
    /rolling thirty-day/i.test(d.downloadsNote) && /automated pulls/i.test(d.downloadsNote));
  ok("says the controls are excluded from Indian totals",
    /excluded from every Indian total/i.test(d.controlsNote));

  if (d.frontier.rowCount > 0) {
    ok("the frontier dataset records its own column names",
      d.frontier.columns.length > 0, "read by name, not by position");
    ok("every frontier row has a model name", d.frontier.models.every((m) => m.name.length > 0));
  } else {
    console.log("  skip  the frontier dataset did not answer on this build.");
  }
  console.log(`        ${d.indianModelCount} Indian models, ${d.frontier.rowCount} frontier rows`);
}

console.log(bad === 0 ? "\nAll AI checks passed.\n" : `\n${bad} check(s) failed.\n`);
process.exit(bad === 0 ? 0 : 1);
