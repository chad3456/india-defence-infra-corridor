/**
 * The game on /bollywood-villains shows the same numbers as the charts.
 *
 * Reel Run is built from the committed film dataset. These checks hold it to
 * that: each lane's early and late figures are the page's own `pooled()`
 * arithmetic, each reel is a real film carrying the marker with the very
 * sentence that matched, the road never carries more films than the dataset
 * has, and each level's computed answer still agrees with the explanation
 * written for it.
 */
import { loadBollywood, pooled, pooledTitleWord } from "../lib/bollywood";
import { buildArcade, REELS_PER_LANE_YEAR, LANE_COLOURS } from "../lib/bollywood-arcade";
import { direction } from "../lib/bollywood-arcade-shared";

let failures = 0;
function check(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`  ${ok ? "pass" : "FAIL"}  ${name}${ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
}

console.log("Direction is called the same way everywhere");
check("a halving is down", direction(22, 11), "down");
check("a small wobble is flat", direction(7.4, 7.3), "flat");
check("growth is up", direction(212, 310), "up");
check("nothing to something is up", direction(0, 1), "up");

const b = loadBollywood();
if (!b.present) { console.log("\nNo film dataset in this checkout; nothing further to check."); process.exit(0); }
const a = buildArcade(b);

console.log("\nLevels");
check("there are levels", a.levels.length >= 4, true);
check("each level's answer agrees with its explanation", a.levels.filter((l) => l.answer !== l.expect).map((l) => l.id), []);
check("lane colours come from the validated palette",
  a.levels.every((l) => l.lanes.every((x) => LANE_COLOURS.includes(x.colour))), true);

console.log("\nThe game's figures are the charts' figures");
{
  const bad: string[] = [];
  for (const l of a.levels) for (const lane of l.lanes) {
    if (lane.id.startsWith("__")) continue;
    if (Math.abs(lane.early - pooled(b, lane.id, 1995, 1999)) > 1e-9) bad.push(`${l.id}/${lane.id} early`);
    if (Math.abs(lane.late - pooled(b, lane.id, 2021, 2025)) > 1e-9) bad.push(`${l.id}/${lane.id} late`);
  }
  const t = a.levels.find((l) => l.id === "titles")?.lanes[0];
  if (t && Math.abs(t.early - pooledTitleWord(b, 1995, 1999)) > 1e-9) bad.push("titles early");
  check("pooled early and late match the page", bad, []);
  const series = a.levels.every((l) => l.series.length === b.series.length);
  check("every level covers every year", series, true);
}

console.log("\nEvery reel is a real film with its real sentence");
{
  const bad: string[] = [];
  const slots = new Map<string, number>();
  for (const l of a.levels) for (const r of l.reels) {
    const lane = l.lanes[r.lane]!;
    const f = b.films.find((x) => x.title === r.title && x.year === r.year);
    if (!f) { bad.push(`${l.id}: ${r.title} is not in the dataset`); continue; }
    if (lane.id === "__title") { if (!f.titleWord || r.quote !== f.title) bad.push(`${l.id}: ${r.title} title`); }
    else if (!f.evidence.some((e) => e.marker === lane.id && e.quote === r.quote)) bad.push(`${l.id}: ${r.title} quote`);
    const k = `${l.id}:${r.lane}:${r.year}`;
    slots.set(k, (slots.get(k) ?? 0) + 1);
  }
  check("no reel is invented and no sentence altered", bad.slice(0, 5), []);
  check(`no more than ${REELS_PER_LANE_YEAR} reels per lane per year`, [...slots.values()].every((n) => n <= REELS_PER_LANE_YEAR), true);
  check("null-result markers get no level", a.levels.some((l) => l.lanes.some((x) => ["honour", "robin-hood", "hero-word"].includes(x.id))), false);
}

console.log(failures === 0 ? "\nAll Reel Run tests passed." : `\n${failures} Reel Run test(s) failed.`);
if (failures > 0) process.exit(1);
