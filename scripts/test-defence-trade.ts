/**
 * The defence-adjacent customs layer, checked before it ships.
 *
 * `npm run test:defence-trade`.
 *
 * The danger on this dataset is not an arithmetic slip. It is that a correct
 * sum of HS chapter 93 gets shown, read and quoted as India's defence trade,
 * which it is not by roughly every order of magnitude in both directions at
 * once. So half the checks below are arithmetic and half are about whether the
 * file still says out loud what it is — because the caveat is the load-bearing
 * part, and a caveat is exactly the kind of thing a later edit trims for
 * length without noticing what it was holding up.
 *
 * Every failure prints what to do about it. A red line that says "consistency
 * check failed" and nothing else has cost this project more time than the bugs
 * it caught.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
// Pure readers only. The probe guards its own entry point, so importing it
// here cannot fire a live run — a lesson scripts/etl/lib/entry.ts exists for.
import { shapeOf, claimsNearby, exportLinks } from "./etl/probe-defence-exports";

const FILE = "data/defence/trade.json";
if (!existsSync(FILE)) {
  console.log(`\n  skip  ${FILE} not built yet — run \`npm run defence:trade\`.`);
  process.exit(0);
}

let bad = 0;
function ok(name: string, cond: boolean, detail = ""): void {
  if (!cond) bad++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  ::  " + detail}`);
}

interface GroupYear {
  year: number; reported: boolean;
  imports: number | null; exports: number | null; balance: number | null;
  codesPresent: string[]; codesAbsent: string[];
}
interface Group {
  id: string; label: string; codeRange: string; military: string;
  captures: string; misses: string; concordance?: string; subsetOf?: string;
  codes: Array<{ code: string; name: string }>;
  years: GroupYear[];
  composition: { year: number; lines: Array<{
    code: string; name: string; imports: number; exports: number;
    shareOfGroupTurnover: number; groupTurnover: number;
  }> } | null;
}
interface File {
  builtAt: string; source: string; classification: string; caveat: string;
  cannotSay: string[]; years: number[];
  denominators: Array<{ year: number; imports: number; exports: number; codesReported: number }>;
  groups: Group[]; checks: string[];
}

const d = JSON.parse(readFileSync(FILE, "utf8")) as File;

/** Years with a file on disk. Nothing in the output may name any other year. */
const onDisk: number[] = [];
for (const f of readdirSync("data/trade")) {
  const m = /^hs6-(\d{4})\.json$/.exec(f);
  if (m?.[1]) onDisk.push(Number(m[1]));
}
onDisk.sort((a, b) => a - b);

console.log("\nYears: only what was actually sampled");
ok("names at least one year", d.years.length > 0, "the file has no year axis at all");
{
  // The failure this guards against is a chart with a smooth line across a
  // decade that was never fetched. An invented year is worse than a gap
  // because it is invisible.
  const invented = d.years.filter((y) => !onDisk.includes(y));
  ok("no year appears that has no hs6 file",
    invented.length === 0,
    `${invented.join(", ")} are in the output but not in data/trade — the connector is ` +
    `synthesising years; check sampledYears()`);
}
{
  const dropped = onDisk.filter((y) => !d.years.includes(y));
  ok("every sampled year on disk is represented",
    dropped.length === 0,
    `${dropped.join(", ")} have files but are missing from the output — re-run ` +
    `\`npm run defence:trade\` so a newly ingested year is picked up`);
}
{
  const mismatched = d.groups.filter((g) => g.years.map((y) => y.year).join() !== d.years.join());
  ok("every group covers exactly the file's year axis",
    mismatched.length === 0,
    `${mismatched.map((g) => g.id).join(", ")} have a different year list; a group with its ` +
    `own axis will be plotted against the wrong ticks`);
}
{
  const denomYears = d.denominators.map((x) => x.year).join();
  ok("a denominator exists for every year", denomYears === d.years.join(),
    `denominators cover ${denomYears || "nothing"}; every share on the page needs its base`);
}

console.log("\nArithmetic");
{
  // balance === imports - exports, on every reported row, exactly.
  const wrong: string[] = [];
  for (const g of d.groups) {
    for (const y of g.years) {
      if (!y.reported) continue;
      if (y.imports === null || y.exports === null || y.balance === null) {
        wrong.push(`${g.id} ${y.year}: reported but carries a null`);
        continue;
      }
      if (Math.abs(y.balance - (y.imports - y.exports)) > 1e-6) {
        wrong.push(`${g.id} ${y.year}: balance ${y.balance} != ${y.imports} - ${y.exports}`);
      }
    }
  }
  ok("balance equals imports minus exports everywhere", wrong.length === 0,
    wrong.slice(0, 3).join(" / ") + " — the sign convention is imports minus exports; " +
    "a surplus is negative and the page must say so");
}
{
  // Absence is not zero, in both directions.
  const zeroed = d.groups.flatMap((g) => g.years
    .filter((y) => !y.reported && (y.imports !== null || y.exports !== null || y.balance !== null))
    .map((y) => `${g.id} ${y.year}`));
  ok("an unreported group-year carries nulls, not zeroes", zeroed.length === 0,
    zeroed.slice(0, 3).join(", ") +
    " — a zero here would draw a line to the axis and assert that trade stopped");
  const nulled = d.groups.flatMap((g) => g.years
    .filter((y) => y.reported && y.codesPresent.length === 0)
    .map((y) => `${g.id} ${y.year}`));
  ok("a reported group-year names the codes it summed", nulled.length === 0,
    nulled.slice(0, 3).join(", "));
}
{
  // Presence bookkeeping: present + absent must account for every code, with
  // no code counted twice. This is what makes the coverage fraction on the
  // page mean anything.
  const broken = d.groups.flatMap((g) => g.years
    .filter((y) => {
      const all = [...y.codesPresent, ...y.codesAbsent];
      return all.length !== g.codes.length || new Set(all).size !== all.length;
    })
    .map((y) => `${g.id} ${y.year}: ${y.codesPresent.length}+${y.codesAbsent.length} vs ${g.codes.length}`));
  ok("present plus absent accounts for every code in the group, once",
    broken.length === 0, broken.slice(0, 3).join(" / "));
}
{
  // Subsets must nest. If 9301 ever exceeded chapter 93 the match predicates
  // disagree with the claimed nesting and every share is corrupt.
  const violations: string[] = [];
  for (const g of d.groups) {
    if (!g.subsetOf) continue;
    const parent = d.groups.find((p) => p.id === g.subsetOf);
    if (!parent) { violations.push(`${g.id} names a parent ${g.subsetOf} that is not a group`); continue; }
    for (const y of g.years) {
      const py = parent.years.find((p) => p.year === y.year);
      if (!y.reported || !py?.reported) continue;
      if ((y.imports ?? 0) > (py.imports ?? 0) + 1 || (y.exports ?? 0) > (py.exports ?? 0) + 1) {
        violations.push(`${g.id} > ${parent.id} in ${y.year}`);
      }
      const escaped = y.codesPresent.filter((c) => !py.codesPresent.includes(c));
      if (escaped.length > 0) violations.push(`${g.id} ${y.year} has codes its parent lacks: ${escaped.join(",")}`);
    }
  }
  ok("every subset group nests inside its parent", violations.length === 0,
    violations.slice(0, 3).join(" / ") + " — fix the match predicate, not the subsetOf field");
}
{
  // Composition shares are shares: they sum to at most one, and each carries
  // the denominator it was taken from.
  const bad2: string[] = [];
  for (const g of d.groups) {
    if (!g.composition) continue;
    const { year, lines } = g.composition;
    if (!d.years.includes(year)) bad2.push(`${g.id} composition names unsampled year ${year}`);
    const sum = lines.reduce((a, l) => a + l.shareOfGroupTurnover, 0);
    if (sum > 1.0001) bad2.push(`${g.id} composition shares sum to ${sum.toFixed(3)}`);
    for (const l of lines) {
      if (l.groupTurnover <= 0) { bad2.push(`${g.id} ${l.code} has no denominator`); continue; }
      const expect = (l.imports + l.exports) / l.groupTurnover;
      if (Math.abs(expect - l.shareOfGroupTurnover) > 1e-9) {
        bad2.push(`${g.id} ${l.code} share does not match its own numbers`);
      }
    }
  }
  ok("composition shares are consistent and carry their denominator",
    bad2.length === 0, bad2.slice(0, 3).join(" / "));
}
{
  // The group totals must still equal a fresh sum of the raw files. This is
  // the check that catches a match predicate quietly widening — the one class
  // of bug that changes every number on the page and breaks no other test.
  interface Row { code: string; m: number; x: number }
  const raw = new Map<number, Map<string, Row>>();
  for (const y of d.years) {
    const m = new Map<string, Row>();
    for (const r of JSON.parse(readFileSync(join("data/trade", `hs6-${y}.json`), "utf8")) as Row[]) {
      m.set(r.code, r);
    }
    raw.set(y, m);
  }
  const drift: string[] = [];
  for (const g of d.groups) {
    for (const y of g.years) {
      if (!y.reported) continue;
      const src = raw.get(y.year);
      let mi = 0, xi = 0;
      for (const c of y.codesPresent) {
        const r = src?.get(c);
        if (!r) { drift.push(`${g.id} ${y.year} claims code ${c} that is not in the file`); continue; }
        mi += r.m; xi += r.x;
      }
      if (Math.abs(mi - (y.imports ?? 0)) > 1 || Math.abs(xi - (y.exports ?? 0)) > 1) {
        drift.push(`${g.id} ${y.year}: file says ${y.imports}/${y.exports}, codes sum to ${mi}/${xi}`);
      }
    }
  }
  ok("group totals re-sum from the raw HS6 files", drift.length === 0,
    drift.slice(0, 3).join(" / ") + " — re-run the connector; the output is stale or the " +
    "code list and the totals were built from different passes");
}
{
  // Denominators must also be real, and must be bigger than any group in them.
  const wrong: string[] = [];
  for (const den of d.denominators) {
    for (const g of d.groups) {
      const y = g.years.find((r) => r.year === den.year);
      if (!y?.reported) continue;
      if ((y.imports ?? 0) > den.imports || (y.exports ?? 0) > den.exports) {
        wrong.push(`${g.id} ${den.year} exceeds all-commodity trade`);
      }
    }
    if (den.codesReported <= 0) wrong.push(`${den.year} denominator has no codes behind it`);
  }
  ok("no group exceeds the all-commodity denominator", wrong.length === 0, wrong.slice(0, 3).join(" / "));
}

console.log("\nHonesty of the file — these are load-bearing, not decoration");
ok("states the chapter-93 caveat in so many words",
  /chapter 93/i.test(d.caveat) && /not india's defence trade/i.test(d.caveat),
  "the caveat must say chapter 93 is NOT India's defence trade; without it the page's " +
  "headline number is a lie by omission");
ok("names chapter 93 a floor and a poor proxy",
  /floor/i.test(d.caveat) && /proxy/i.test(d.caveat),
  "the words 'floor' and 'proxy' are the framing the page prints; keep them");
ok("says where the missing defence trade actually sits",
  /chapter 88|8802/i.test(d.caveat) && /8906/i.test(d.caveat) && /8710/i.test(d.caveat),
  "the caveat must name aircraft, warships and armoured vehicles as being outside chapter 93");
ok("says missiles have no heading of their own", /missile/i.test(d.caveat));
ok("every group states what it captures",
  d.groups.every((g) => g.captures.length > 60),
  d.groups.filter((g) => g.captures.length <= 60).map((g) => g.id).join(", "));
ok("every group states what it misses",
  d.groups.every((g) => g.misses.length > 60),
  d.groups.filter((g) => g.misses.length <= 60).map((g) => g.id).join(", "));
ok("every group names its code range", d.groups.every((g) => g.codeRange.length > 5));
ok("the warship group says why it is nearly empty",
  /domestic|never cross|classification/i.test(groupMisses("warships-890610")),
  "naval shipbuilding for the Indian Navy does not cross a customs border; if that is not " +
  "said, the near-zero line reads as a finding about the shipyards");
ok("the not-warships group is labelled as not a defence measure",
  /never be charted|not a defence measure/i.test(groupMisses("other-vessels-890690")));
ok("the aircraft-parts group explains the 8803 to 8807 renumbering",
  /8807/.test(d.groups.find((g) => g.id === "aircraft-parts")?.concordance ?? ""),
  "without the concordance note the series looks like a collapse and a recovery");
ok("says country spread cannot come from these files",
  d.cannotSay.some((s) => /partner/i.test(s) && /absent|no partner/i.test(s)),
  "the HS6 files pin partner to World; destination spread is absent, not merely hard");
ok("says the official export figure is not derivable here",
  d.cannotSay.some((s) => /official|ministry of defence/i.test(s)));
ok("lists more than three things it cannot say", d.cannotSay.length > 3, String(d.cannotSay.length));
ok("records the structural checks the connector ran", d.checks.length > 0);
ok("names its source and classification vintage",
  /comtrade/i.test(d.source) && d.classification.length > 5);

function groupMisses(id: string): string {
  return d.groups.find((g) => g.id === id)?.misses ?? "";
}

/**
 * The probe's offline logic, checked offline.
 *
 * The probe itself cannot be run meaningfully from a sandbox with no egress —
 * it will come back all-dead and prove nothing. But its readers are pure
 * functions and they are where the interesting failure lives: `shapeOf` is the
 * thing that separates "200 OK, 180kB" from "200 OK, 180kB of empty React
 * shell", which is what several Indian government sites have actually returned
 * every previous time this project probed them. A probe that scores a shell as
 * a success sends the next session off to write a connector against nothing.
 */
console.log("\nThe probe's readers, exercised without a network");
{
  const shell =
    "<html><head><title>DDP</title></head><body><div id=\"root\"></div>" +
    "<script src=\"/static/js/main.js\"></script></body></html>";
  ok("a rendered shell is not mistaken for a page", shapeOf(shell, "https://x/") === "js-app",
    `read as ${shapeOf(shell, "https://x/")}; a shell scored as html is a false positive that ` +
    "costs the next session a whole connector");
  ok("real prose is html",
    shapeOf(`<html><body><p>${"The Department of Defence Production said ".repeat(30)}</p></body></html>`,
      "https://x/") === "html");
  ok("a PDF is recognised by its magic bytes", shapeOf("%PDF-1.7\n...", "https://x/a.pdf") === "pdf");
  ok("an RSS feed is not called html",
    shapeOf("<?xml version=\"1.0\"?><rss version=\"2.0\"><channel><item/></channel></rss>", "https://x/") === "xml-feed");
  ok("json is recognised", shapeOf("{\"parse\":{\"wikitext\":\"x\"}}", "https://x/api") === "json");
  ok("an OWID csv is recognised",
    shapeOf("Entity,Code,Year,Value\nIndia,IND,2024,1\n", "https://x/g.csv") === "csv");
  ok("an empty 200 is called empty", shapeOf("", "https://x/") === "empty");
}
{
  const page =
    "<p>Defence exports touched a record in the last financial year, up 12 per cent.</p>" +
    "<p>The minister opened a new facility in Kanpur.</p>";
  const claims = claimsNearby(page);
  ok("an export sentence with a number is picked up", claims.length === 1, JSON.stringify(claims));
  ok("a sentence with no number is not", !claims.some((c) => /Kanpur/.test(c)));
  ok("prose with no export claim yields nothing",
    claimsNearby("<p>The ministry held a review meeting on Tuesday in New Delhi at 11 am.</p>").length === 0);
}
{
  const nav =
    "<a href=\"/defence-exports\">Defence Exports</a>" +
    "<a href=\"/documents/annual-report\">Annual Report 2024-25</a>" +
    "<a href=\"/contact\">Contact us</a>";
  const links = exportLinks(nav, "https://www.ddpmod.gov.in/");
  ok("export and annual-report links are harvested", links.length === 2, JSON.stringify(links));
  ok("relative hrefs are resolved against the page",
    links.every((l) => l.includes("https://www.ddpmod.gov.in/")), JSON.stringify(links));
  ok("unrelated links are left out", !links.some((l) => /Contact/.test(l)));
}

console.log("\nThe numbers, for the eye");
for (const g of d.groups) {
  const last = [...g.years].reverse().find((y) => y.reported);
  console.log(
    `  ${g.id.padEnd(24)} ${last ? `${last.year}: m ${fmt(last.imports)} x ${fmt(last.exports)}` : "never reported"}`,
  );
}
function fmt(n: number | null): string {
  return n === null ? "—" : `${(n / 1e6).toFixed(1)}m`.padStart(9);
}

console.log(bad === 0 ? "\nAll defence-trade checks passed.\n" : `\n${bad} check(s) failed.\n`);
process.exit(bad === 0 ? 0 : 1);
