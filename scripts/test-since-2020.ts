/**
 * /elections/since-2020: the NDA line-ups reproduce the totals reported
 * independently, every alliance party is spelled as ECI spells it, every row
 * says where it came from, and the page's prose claims still hold.
 */
import { loadResultIndex, loadStateResult } from "../lib/elections-atlas";
import { loadSince2020 } from "../lib/since-2020";

let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => { console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${!cond && detail ? `  ${detail}` : ""}`); if (!cond) failed++; };

const { file, elections, ls2024 } = loadSince2020();
const row = (key: string) => elections.find((e) => e.key === key);

console.log("Lok Sabha 2024, counted");
ok("543 seats read", ls2024.seats === 543, String(ls2024.seats));
ok("BJP 240", ls2024.bjpSeats === 240, String(ls2024.bjpSeats));
ok("BJP vote share within 0.05 points of the reported 36.56%", Math.abs(ls2024.bjpShare - 36.56) < 0.05, ls2024.bjpShare.toFixed(3));
// The prose says the BJP lost its own majority and governs through its allies.
ok("prose: the BJP alone is short of 272 and the NDA is above it", ls2024.bjpSeats < 272 && ls2024.ndaSeats >= 272);

console.log("\nNDA line-ups reproduce reported totals");
for (const r of file.reportedNda) {
  const got = r.key === "PcResultGenJune2024" ? ls2024.ndaSeats : row(r.key)?.ndaSeats;
  ok(`${r.key}: NDA ${r.seats}`, got === r.seats, String(got));
}
// Widely reported totals, kept here as checks on the line-ups.
const known: Record<string, number> = { "ResultAcGenMar2022:S24": 273, "ResultAcGenNov2024:S13": 230, "ResultAcGenNov2024:S27": 24, "AcResultGenJune2024:S01": 164, "ResultAcGenMar2023:S17": 37, "ResultAcGenMar2023:S23": 33 };
for (const [k, n] of Object.entries(known)) ok(`${k}: NDA ${n}`, row(k)?.ndaSeats === n, String(row(k)?.ndaSeats));

console.log("\nAlliance names match ECI's spelling");
for (const [key, parties] of Object.entries(file.alliances)) {
  if (key.startsWith("_") || !Array.isArray(parties)) continue;
  const [folder, code] = key.split(":");
  const entry = loadResultIndex().find((e) => e.folder === folder);
  const names = new Set<string>();
  for (const st of code ? [code] : Object.keys(entry?.states ?? {})) for (const seat of loadStateResult(folder!, st)?.seats ?? []) for (const c of seat.candidates) names.add(c.party);
  const missing = parties.filter((p) => !names.has(p));
  ok(`${key}: every partner fielded candidates under that name`, missing.length === 0, missing.join(", "));
}

console.log("\nEvery row is accounted for");
ok("every election says whether the NDA formed the government", elections.every((e) => e.ndaGovernment !== null), elections.filter((e) => e.ndaGovernment === null).map((e) => e.key).join());
ok("every reported row cites two sources", elections.filter((e) => e.basis === "reported").every((e) => e.sources.length >= 2));
ok("vote shares are blank, not estimated, where seats were not all read", elections.filter((e) => e.basis === "tally").every((e) => e.bjpShare === null && e.ndaShare === null));
ok("no election before the pandemic", elections.every((e) => e.date >= "2020-03"));
ok("seats never exceed the house", elections.every((e) => e.bjpSeats <= e.house && (e.ndaSeats ?? 0) <= e.house));
ok("events are dated and in order", file.events.every((e, i, a) => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && (i === 0 || a[i - 1]!.date <= e.date)));
ok("no figure is taken from a social-media post", JSON.stringify(file).match(/https?:\/\/(x|twitter)\.com/) === null);

console.log("\nLokniti figures are on the pages cited");
(async () => {
  const { extractTables } = await import("./etl/lib/pdf-table");
  const { readFileSync } = await import("node:fs");
  const L = (file as unknown as { lokniti2024: { pdf: string; voteCheck: { page: number; bjp: number }; anotherChance: { pages: number[]; yes: number; no: number }; reasonsYes: { page: number; rows: Array<[string, number]> }; reasonsNo: { page: number; rows: Array<[string, number]> } } }).lokniti2024;
  const bytes = new Uint8Array(readFileSync(L.pdf));
  const page = async (n: number) => (await extractTables(bytes.slice(), { firstPage: n, lastPage: n }))[0]?.rows.map((r) => r.join(" | ")).join("\n") ?? "";
  const p2 = await page(L.voteCheck.page);
  ok(`BJP ${L.voteCheck.bjp}% of the sample's vote, page ${L.voteCheck.page}`, new RegExp(`Bharatiya Jan?ta Party \\| \\d+ \\| [\\d.]+ \\| ${L.voteCheck.bjp}`).test(p2));
  ok("the sample's BJP vote is within a point of the counted 2024 share", Math.abs(L.voteCheck.bjp - ls2024.bjpShare) < 1);
  const p24 = await page(24);
  ok("'another chance': yes and no on page 24", p24.includes(`02: Yes | 9117 | ${L.anotherChance.yes}`) && p24.includes(`01: No | 7593 | ${L.anotherChance.no}`));
  for (const [label, v] of L.reasonsNo.rows) ok(`no: ${label} ${v}%`, p24.includes(label.split("/")[0]!) && p24.includes(`| ${v}`));
  const p25 = await page(L.reasonsYes.page);
  for (const [label, v] of L.reasonsYes.rows.filter(([l]) => !/Governed the country well/.test(l))) ok(`yes: ${label} ${v}%`, p25.includes(label.split("/")[0]!.split(",")[0]!) && p25.includes(`| ${v}`));
  ok("yes: Governed the country well 15.0% (page 24)", p24.includes("Governed the country well") && p24.includes("| 15.0"));
  console.log(failed ? `\n${failed} failed` : "\nall passed");
  if (failed) process.exitCode = 1;
})();
