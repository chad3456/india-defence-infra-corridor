/**
 * Header rows, and the off-by-one that read studios as films.
 *
 * A wikitable may carry several header rows: a spanning title above the real
 * headers, a second tier below them, or both. Flattening them into one list
 * put "Title" at index 2 on a table whose body had it at index 1, so every
 * page with a caption row was read one column off — the box office parse came
 * back with "Mythri Movie Makers" and "Telugu" as film titles, and kept only
 * the one language whose table happened to have no caption.
 *
 * Nothing errored. The rows looked like rows.
 */
import { parseTables, columnIndex, plain } from "./etl/lib/wikitext";

let bad = 0;
function ok(name: string, cond: boolean, detail = ""): void {
  if (!cond) bad++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  " + detail}`);
}

console.log("\nA plain table");
{
  const t = parseTables(`
{| class="wikitable"
! Rank !! Title !! Worldwide gross
|-
| 1 || Toxic || ₹337 crore
|-
| 2 || KD: The Devil || ₹24.22 crore
|}`)[0]!;
  ok("headers are read", t.headers.join("|") === "Rank|Title|Worldwide gross", t.headers.join("|"));
  ok("two body rows", t.rows.length === 2, String(t.rows.length));
  ok("title column resolves", columnIndex(t.headers, /^title$/i) === 1);
  ok("the title cell is the film", plain(t.rows[0]![1]!) === "Toxic", plain(t.rows[0]?.[1] ?? ""));
}

console.log("\nA spanning title above the headers — the shape that broke it");
{
  const t = parseTables(`
{| class="wikitable"
|-
! colspan="5" | Highest worldwide gross of 2026
|-
! Rank !! Title !! Production company !! Worldwide gross !! Ref
|-
| 1 || Toxic || KVN Productions || ₹337 crore || <ref>x</ref>
|-
| 2 || Coolie || Sun Pictures || ₹500 crore || <ref>y</ref>
|}`)[0]!;
  ok("both header rows are kept", t.headerRows.length === 2, String(t.headerRows.length));
  ok("the spanning row is not the chosen header",
    t.headers.length === 5, `${t.headers.length}: ${t.headers.join("|")}`);
  ok("the chosen header is the one matching the body",
    t.headers.join("|") === "Rank|Title|Production company|Worldwide gross|Ref", t.headers.join("|"));

  const cTitle = columnIndex(t.headers, /^title$/i);
  const cGross = columnIndex(t.headers, /worldwide\s+gross/i);
  ok("title resolves to column 1, not 2", cTitle === 1, String(cTitle));
  ok("the title cell is a film, not a studio",
    plain(t.rows[0]![cTitle]!) === "Toxic", plain(t.rows[0]?.[cTitle] ?? ""));
  ok("the gross cell is a gross, not a reference",
    /crore/.test(plain(t.rows[0]![cGross]!)), plain(t.rows[0]?.[cGross] ?? ""));
  ok("the second row lines up too",
    plain(t.rows[1]![cTitle]!) === "Coolie", plain(t.rows[1]?.[cTitle] ?? ""));
}

console.log("\nA two-tier header");
{
  const t = parseTables(`
{| class="wikitable"
|-
! rowspan="2" | Rank !! rowspan="2" | Title !! colspan="2" | Gross
|-
! India !! Worldwide
|-
| 1 || Toxic || ₹200 crore || ₹337 crore
|}`)[0]!;
  ok("both tiers are kept", t.headerRows.length === 2, String(t.headerRows.length));
  // The body has four columns; neither tier alone has four, so the widest wins
  // and the caller is at least not silently one column off on a real header.
  ok("a header is still produced", t.headers.length > 0, String(t.headers.length));
  ok("the body row is intact", t.rows[0]?.length === 4, String(t.rows[0]?.length));
}

console.log("\nCells written one per line");
{
  const t = parseTables(`
{| class="wikitable"
|-
! Rank
! Title
! Worldwide gross
|-
| 1
| Toxic
| ₹337 crore
|}`)[0]!;
  ok("one-per-line headers form a single row", t.headers.length === 3, t.headers.join("|"));
  ok("one-per-line cells form a single body row", t.rows.length === 1 && t.rows[0]!.length === 3,
    `${t.rows.length} rows, ${t.rows[0]?.length} cells`);
  ok("title still resolves", plain(t.rows[0]![1]!) === "Toxic", plain(t.rows[0]?.[1] ?? ""));
}

console.log("\nA table with no header at all");
{
  const t = parseTables(`
{| class="wikitable"
|-
| a || b
|}`)[0]!;
  ok("no headers, but the row survives", t.headers.length === 0 && t.rows.length === 1,
    `${t.headers.length} headers, ${t.rows.length} rows`);
}

if (bad > 0) { console.error(`\n${bad} wikitext test(s) failed.`); process.exit(1); }
console.log("\nAll wikitext tests passed.");
