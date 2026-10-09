/**
 * Every figure the Breakneck page draws is still in the book, and every number
 * the page prints is one the book prints.
 *
 * The connector verifies each phrase against the EPUB when it runs. This
 * repeats that on every commit and adds what the connector cannot see by
 * itself: a record whose phrase says "fifteen million" can still carry a value
 * of 16,000,000, or a label that says 2023 when the phrase never does. So each
 * value, second value and every number in a label must be found among the
 * numbers of the record's own phrases — in digits, in words, or as the
 * fractions the book writes ("a quarter", "two-thirds", "twice").
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { numbersIn } from "./etl/lib/book-numbers";
import { build, loadBook, FIGURES, COHORTS } from "./etl/connectors/breakneck-book";
import type { BreakneckBook } from "../lib/breakneck-shared";

let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) failures++;
  console.log(`  ${ok ? "pass" : "FAIL"}  ${name}${ok || !detail ? "" : `\n        ${detail}`}`);
}

/** Fractions and multiples as the book writes them, as both ratios and percentages. */
const WORDS: Array<[RegExp, number[]]> = [
  [/\bhalf a million\b/, [500000]],
  [/\b(a |one[- ])?half\b/, [0.5, 50]],
  [/\b(a |one[- ])?quarter\b/, [0.25, 25]],
  [/\bthree[- ]quarters\b/, [0.75, 75]],
  [/\b(a |one[- ])?third\b/, [1 / 3, 100 / 3]],
  [/\btwo[- ]thirds\b/, [2 / 3, 200 / 3]],
  [/\b(a |one[- ])?tenth\b/, [0.1, 10]],
  [/\bone[- ]eighth\b/, [0.125, 12.5]],
  [/\bone[- ]fifteenth\b/, [1 / 15]],
  [/\btwice\b|\bdoubl/, [2]],
  [/\btriple\b/, [3]],
  [/\bone\b/, [1]],
];

export function valuesIn(phrases: string[]): number[] {
  const out: number[] = [];
  for (const p of phrases) {
    out.push(...numbersIn(p));
    const low = p.toLowerCase();
    for (const [re, vals] of WORDS) if (re.test(low)) out.push(...vals);
    for (const m of low.matchAll(/\b(\w+) and a half\b/g)) {
      const n = numbersIn(m[1]!)[0];
      if (n !== undefined) out.push(n + 0.5);
    }
  }
  return out;
}

const has = (pool: number[], v: number) => pool.some((p) => Math.abs(p - v) <= Math.max(0.5, Math.abs(v) * 0.005));

console.log("The fraction reader");
check("a quarter is 25%", has(valuesIn(["lost a quarter of its"]), 25));
check("two-thirds is about 67%", has(valuesIn(["lost two-thirds of their population"]), 67));
check("five and a half", has(valuesIn(["green for five and a half hours"]), 5.5));
check("half a million is 500,000", has(valuesIn(["there were half a million automobiles"]), 500000));
check("three dozen is 36", has(valuesIn(["only three dozen"]), 36));

console.log("\nEvery phrase is still in the book, on the page recorded");
const { out, missing } = build(loadBook());
check("every verify and also phrase is found in its chapter", missing.length === 0, missing.join("\n        "));
const committed = JSON.parse(readFileSync(join(process.cwd(), "data", "global", "breakneck-book.json"), "utf8")) as BreakneckBook;
const drift = out.figures.filter((f) => committed.figures.find((c) => c.id === f.id)?.page !== f.page).map((f) => f.id);
check("committed pages match a fresh read", drift.length === 0, `re-run npm run breakneck:book: ${drift.join(", ")}`);
const gone = FIGURES.filter((f) => !committed.figures.some((c) => c.id === f.id)).map((f) => f.id);
check("committed file has every figure", gone.length === 0, gone.join(", "));
check("every figure has a page", out.figures.every((f) => f.page !== null), out.figures.filter((f) => f.page === null).map((f) => f.id).join(", "));

console.log("\nEvery number the page prints is one the book prints");
const bad: string[] = [];
for (const f of FIGURES) {
  const pool = valuesIn([f.verify, ...(f.also ?? [])]);
  if (!has(pool, f.value)) bad.push(`${f.id}: value ${f.value}`);
  if (f.value2 !== undefined && !has(pool, f.value2)) bad.push(`${f.id}: value2 ${f.value2}`);
  for (const sv of f.series ?? []) {
    if (!has(pool, sv.value)) bad.push(`${f.id}: series ${sv.key} ${sv.value}`);
    for (const n of numbersIn(sv.key)) if (!has(pool, n)) bad.push(`${f.id}: ${n} in series key "${sv.key}"`);
  }
  for (const n of numbersIn(f.label)) if (!has(pool, n) && !(f.year && numbersIn(f.year).includes(n))) bad.push(`${f.id}: ${n} in the label`);
  if (f.year) for (const n of numbersIn(f.year)) if (!has(pool, n)) bad.push(`${f.id}: year ${n} is not in its phrases`);
}
check("values, second values, label numbers and years all come from the phrases", bad.length === 0, bad.join("\n        "));

const cohortBad = COHORTS.filter((e) => e.age > 0 && !has(valuesIn([e.verify]), e.age) && !has(valuesIn([e.verify]), e.year)).map((e) => e.id);
check("each cohort age or year is in its phrase", cohortBad.length === 0, cohortBad.join(", "));

console.log("\nThe record has the shape the page needs");
check("ids are unique", new Set(FIGURES.map((f) => f.id)).size === FIGURES.length);
for (const ch of ["c1", "c2", "c3", "c4", "c5", "c6", "c7"] as const) {
  const n = FIGURES.filter((f) => f.ch === ch).length;
  check(`chapter ${ch.slice(1)} has at least five figures (${n})`, n >= 5);
}
check("every figure names whose number it is", FIGURES.every((f) => f.credit.trim().length > 0));
check("phrases are citations, not passages (under 45 words)", FIGURES.every((f) => [f.verify, ...(f.also ?? [])].every((p) => p.split(/\s+/).length < 45)),
  FIGURES.filter((f) => f.verify.split(/\s+/).length >= 45).map((f) => f.id).join(", "));
check("the output carries no book prose", !JSON.stringify(committed).includes("verify"));

console.log("\nThe page asks only for figures that exist");
const page = readFileSync(join(process.cwd(), "app", "breakneck", "page.tsx"), "utf8");
const asked = [...new Set([...page.matchAll(/F\("([a-z0-9-]+)"\)/g)].map((x) => x[1]!))];
const known = new Set(FIGURES.map((f) => f.id));
check(`all ${asked.length} figure ids the page uses are verified figures`, asked.every((id) => known.has(id)), asked.filter((id) => !known.has(id)).join(", "));
const cardBlock = page.slice(page.indexOf("const cards"), page.indexOf(".map(([id, q])"));
const cardIds = [...cardBlock.matchAll(/\["([a-z0-9-]+)", "/g)].map((x) => x[1]!);
check(`all ${cardIds.length} flashcards point at verified figures`, cardIds.length > 0 && cardIds.every((id) => known.has(id)), cardIds.filter((id) => !known.has(id)).join(", "));

console.log(`\n${failures === 0 ? "All passed." : `${failures} failed.`}`);
process.exit(failures === 0 ? 0 : 1);
