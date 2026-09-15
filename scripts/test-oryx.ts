/**
 * The Oryx reader, against markup taken verbatim from the source.
 *
 * This test exists because three successive versions of that parser produced
 * plausible, wrong numbers — 5% short with every photograph attached to the
 * wrong vehicle, then 3.8x over from two double-counts compounding — and each
 * round trip to find out cost a CI run. The fixtures below are pasted from the
 * pages themselves, so the arithmetic can be checked in a second rather than
 * in four minutes.
 *
 * The named facts here are counts of entries in a sample whose losses can be
 * counted by eye. If a change makes one of these wrong, it has broken the
 * pairing between a loss and its receipt, which is the only thing this dataset
 * is for.
 */
import { parseItem, classify, statedTotals, textOf, vehiclesIn, enclosingHref } from "./etl/connectors/oryx";

let failures = 0;
function check(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`  ${ok ? "pass" : "FAIL"}  ${name}${ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
}

/** Verbatim from the Russian losses page, including the flag image. */
const CURRENT = `
  <details>
    <summary><img alt="" class="thumbborder" height="12" src="https://upload.wikimedia.org/wikipedia/commons/a/a9/Flag_of_the_Soviet_Union.svg" width="23" /> 2 T-54-3M:
    </summary>
    <a href="https://postimg.cc/zBC4NPVv">(1, destroyed)</a>
    <a href="https://postimg.cc/s29RHpfN">(1, damaged and abandoned)</a>
  </details>`;

/** The older layout, where the status was plain text and the link followed. */
const LEGACY = `<li>2 BMP-1: (1, destroyed) <a href="https://i.postimg.cc/aaa.jpg">1</a>, (2, captured) <a href="https://i.postimg.cc/bbb.jpg">2</a></li>`;

console.log("Oryx entry parsing");
{
  const r = parseItem(CURRENT);
  check("current layout: model name", r.model, "T-54-3M");
  check("current layout: one loss per anchor, not one per anchor plus one", r.losses.length, 2);
  check("current layout: first receipt belongs to the first loss",
    r.losses[0], { status: "destroyed", raw: "destroyed", evidence: "https://postimg.cc/zBC4NPVv" });
  check("current layout: a compound status counts once, under its later verb",
    r.losses[1], { status: "abandoned", raw: "damaged and abandoned", evidence: "https://postimg.cc/s29RHpfN" });
}
{
  const r = parseItem(LEGACY);
  check("legacy layout: model name", r.model, "BMP-1");
  check("legacy layout: both losses found", r.losses.length, 2);
  check("legacy layout: statuses", r.losses.map((l) => l.status), ["destroyed", "captured"]);
  check("legacy layout: the link that follows a status is its receipt",
    r.losses.map((l) => l.evidence),
    ["https://i.postimg.cc/aaa.jpg", "https://i.postimg.cc/bbb.jpg"]);
}
{
  // The bug that cost two CI runs was counting one loss under two patterns.
  // With a single bracket-based pass there is one pattern, so the invariant
  // worth pinning is that a block's losses equal its status brackets: two
  // blocks' worth of markup is four losses, not eight.
  const r = parseItem(CURRENT + LEGACY);
  check("losses equal status brackets, never a multiple of them", r.losses.length, 4);
}

{
  // The entries the anchor-based reader could not express, which is where the
  // last few per cent of every section went.
  const nested = `<details><summary>1 BTR-82A:</summary>
    <a href="https://postimg.cc/x1"><u>(1, destroyed)</u></a></details>`;
  const r1 = parseItem(nested);
  check("markup inside the link does not lose the loss", r1.losses.length, 1);
  check("and the receipt is still found", r1.losses[0]?.evidence, "https://postimg.cc/x1");

  const pair = `<details><summary>2 T-80BV:</summary>
    <a href="https://postimg.cc/x2">(1 and 2, destroyed)</a></details>`;
  const r2 = parseItem(pair);
  check("two vehicles in one photograph count as two", r2.losses.length, 2);
  check("and share the one receipt",
    r2.losses.map((l) => l.evidence), ["https://postimg.cc/x2", "https://postimg.cc/x2"]);

  const bare = `<details><summary>1 Msta-S:</summary>(1, captured)</details>`;
  const r3 = parseItem(bare);
  check("a loss with no link is still a loss", r3.losses.length, 1);
  check("and is flagged as having no receipt", r3.losses[0]?.evidence, "");

  const bracketName = `<details><summary>1 BM-21 (Grad):</summary>
    <a href="https://postimg.cc/x3">(1, destroyed)</a></details>`;
  check("a bracket in the model name is not a loss", parseItem(bracketName).losses.length, 1);
}

console.log("\nBracket arithmetic");
check("one number is one vehicle", vehiclesIn("1"), 1);
check("two numbers are two vehicles", vehiclesIn("1 and 2"), 2);
check("three, comma separated", vehiclesIn("1, 2, 3"), 3);
check("an empty token is still one", vehiclesIn(""), 1);
check("an enclosing anchor is found", enclosingHref('<a href="u">(1, destroyed)', 12), "u");
check("a closed anchor does not enclose", enclosingHref('<a href="u">x</a> (1, destroyed)', 22), "");

console.log("\nStatus classification");
check("damaged and captured is captured", classify("damaged and captured"), "captured");
check("damaged and abandoned is abandoned", classify("damaged and abandoned"), "abandoned");
check("destroyed", classify("destroyed"), "destroyed");
check("an unknown status is not guessed at", classify("sunk"), null);

console.log("\nHeading totals");
check("a plain section heading",
  statedTotals("Tanks (4447, of which destroyed: 3352, damaged: 165, abandoned: 392, captured: 538)"),
  { total: 4447, byStatus: { destroyed: 3352, damaged: 165, abandoned: 392, captured: 538 } });
check("an acronym in brackets does not become the totals",
  statedTotals("Mine-Resistant Ambush Protected (MRAP) Vehicles (64, of which destroyed: 48, damaged: 4)").total,
  64);
check("the page roll-up, written with a dash",
  statedTotals("Russia - 24098, of which: destroyed: 19065, damaged: 1000, abandoned: 1194, captured: 2839").total,
  24098);
check("a heading with no totals states none",
  statedTotals("Losses by type").total, null);

console.log("\nText extraction");
check("tags out, entities decoded", textOf("<b>T&#39;90</b>&nbsp;M"), "T'90 M");

console.log(failures === 0 ? "\nAll Oryx parser tests passed." : `\n${failures} Oryx parser test(s) failed.`);
if (failures > 0) process.exit(1);
