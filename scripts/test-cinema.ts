/**
 * The cinema reader, against the cases that already fooled it.
 *
 * Every assertion here is a bug that shipped. The connector produced a
 * completely plausible dataset in which Punjabi was 29% of all Indian film
 * titles for a decade, because ten years of requests had each been redirected
 * to one combined article and nothing compared where they landed. Nothing in
 * the output looked wrong; the counts were sensible, the tables were real film
 * tables, and only knowing the industry would have raised a question.
 */
import { filmRows, croreFrom, isSameYear } from "./etl/connectors/cinema";

let failures = 0;
function check(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`  ${ok ? "pass" : "FAIL"}  ${name}${ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
}

console.log("Redirect detection");
check("an exact title is the year asked for",
  isSameYear("List of Tamil films of 2019", "List of Tamil films of 2019", 2019), true);
check("a renamed article that keeps its year is still that year",
  isSameYear("List of Tamil films of 2019", "List of Tamil-language films of 2019", 2019), true);
check("a redirect to a combined list is not",
  isSameYear("List of Punjabi films of 2003", "List of Punjabi films", 2003), false);
check("nor is a redirect to the industry article",
  isSameYear("List of Assamese films of 2015", "Assamese cinema", 2015), false);
check("a different year is not this year",
  isSameYear("List of Hindi films of 2011", "List of Hindi films of 2012", 2011), false);

console.log("\nTable selection");
{
  const releases = `
{| class="wikitable"
! Title !! Director !! Cast !! Genre
|-
| A || B || C || D
|-
| E || F || G || H
|}`;
  check("a release table is counted", filmRows(releases).films, 2);

  const boxOffice = `
{| class="wikitable"
! Rank !! Title !! Director !! Worldwide gross
|-
| 1 || A || B || ₹100 crore
|-
| 2 || C || D || ₹80 crore
|}`;
  check("a highest-grossing table is not a release list", filmRows(boxOffice).films, 0);

  const awards = `
{| class="wikitable"
! Award !! Winner !! Year
|-
| Best Film || A || 2019
|}`;
  check("an award table has no director column and is skipped", filmRows(awards).films, 0);

  check("both together count only the release table",
    filmRows(releases + boxOffice).films, 2);
  check("and report one table used", filmRows(releases + boxOffice).tablesUsed, 1);
}

console.log("\nGross parsing");
check("a crore figure", croreFrom("₹1,000 crore"), 1000);
check("a billion figure becomes crore", croreFrom("$1.5 billion"), 150);
check("a lakh figure becomes crore", croreFrom("₹50 lakh"), 0.5);
check("a bare number is read as crore", croreFrom("250"), 250);
check("text with no number is null", croreFrom("not available"), null);

console.log(failures === 0 ? "\nAll cinema parser tests passed." : `\n${failures} cinema parser test(s) failed.`);
if (failures > 0) process.exit(1);
