/**
 * The trend reading, and the weekly cycle it exists to survive.
 *
 * Cinema attendance is violently weekly: a film sells a multiple of its
 * Tuesday on the following Saturday, every week of its run. A trend that
 * compares adjacent days would report every Monday as a collapse and every
 * Friday as a breakout, for every film, forever — a chart of the calendar
 * rather than of the films. The first case below is the one that matters: a
 * pure weekly cycle around a flat mean must read as "holding".
 */
import { readTrend, filmId, type Film, type Observation } from "../lib/cinema-shared";
import { parseCroreGross, looksLikeTitle } from "./etl/connectors/cinema";

let bad = 0;
function ok(name: string, cond: boolean, detail = ""): void {
  if (!cond) bad++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  " + detail}`);
}

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
/** A Monday, so the weekly shape below is unambiguous. */
const START = Date.parse("2026-01-05T00:00:00Z");

/** Weekday multipliers: quiet midweek, heavy weekend. Monday-indexed. */
const WEEK = [0.6, 0.55, 0.6, 0.7, 1.4, 2.0, 1.6];

function series(days: number, trendPerDay: number, base = 100): Observation[] {
  const out: Observation[] = [];
  for (let d = 0; d < days; d++) {
    const weekday = d % 7;
    out.push({
      date: iso(START + d * DAY),
      presence: base * Math.pow(trendPerDay, d) * WEEK[weekday]!,
    });
  }
  return out;
}

const film = (obs: Observation[], releaseDate: string | null = null): Film =>
  ({ id: "f", title: "F", language: null, releaseDate, observations: obs });

/** "Now" is the day after the last observation in a 21-day series. */
const NOW = new Date(START + 21 * DAY);

console.log("\nThe weekly cycle");
{
  // Flat underlying demand, pure weekly shape. Anything but "holding" here
  // means the reading is measuring the calendar.
  const r = readTrend(film(series(21, 1.0)), NOW);
  ok("a pure weekly cycle with flat demand reads as holding",
    r.momentum === "holding", `${r.momentum}, ratio ${r.ratio?.toFixed(3)}`);
  ok("and it compares two whole weeks", r.basis === "two weeks", r.basis);
  ok("the ratio is essentially 1", Math.abs((r.ratio ?? 0) - 1) < 0.02, String(r.ratio));

  // Ending on a Saturday peak, which a naive day-on-day reading would call a
  // breakout, and on a Monday trough, which it would call a collapse.
  const endSat = readTrend(film(series(19, 1.0)), NOW);   // 19 days -> ends Friday+
  const endMon = readTrend(film(series(22, 1.0)), NOW);
  ok("the verdict does not depend on which weekday it ends on",
    endSat.momentum === "holding" && endMon.momentum === "holding",
    `${endSat.momentum} / ${endMon.momentum}`);
}

console.log("\nReal movement is still seen");
{
  const up = readTrend(film(series(21, 1.04)), NOW);      // ~+4%/day
  ok("a film gaining 4% a day reads as climbing", up.momentum === "climbing",
    `${up.momentum}, ratio ${up.ratio?.toFixed(2)}`);

  const down = readTrend(film(series(21, 0.94)), NOW);    // ~-6%/day
  ok("a film losing 6% a day reads as fading", down.momentum === "fading",
    `${down.momentum}, ratio ${down.ratio?.toFixed(2)}`);

  // A drift too small to distinguish from noise should not be dressed up.
  const drift = readTrend(film(series(21, 1.005)), NOW);
  ok("a slight drift is holding, not climbing", drift.momentum === "holding",
    `${drift.momentum}, ratio ${drift.ratio?.toFixed(3)}`);
}

console.log("\nRefusing to say");
{
  ok("no observations means no reading",
    readTrend(film([]), NOW).momentum === "too early to say");

  const oneDay = readTrend(film(series(1, 1.0)), NOW);
  ok("one day is too early", oneDay.momentum === "too early to say", oneDay.momentum);
  ok("and it reports no basis", oneDay.basis === "none", oneDay.basis);

  const fiveDays = readTrend(film(series(5, 1.0)), NOW);
  ok("five days is still too early — less than a full week",
    fiveDays.momentum === "too early to say", `${fiveDays.momentum} on ${fiveDays.days}d`);

  // Between one week and two, the same weekday a week earlier is the crudest
  // comparison that is not just measuring the calendar.
  const nineDays = readTrend(film(series(9, 1.0)), NOW);
  ok("nine days falls back to the same weekday a week earlier",
    nineDays.basis === "same weekday", `${nineDays.basis} (${nineDays.momentum})`);
  ok("and that fallback still reads a flat film as holding",
    nineDays.momentum === "holding", nineDays.momentum);
}

console.log("\nA new release is not the same as a short watch");
{
  // Both have few observations; they mean entirely different things.
  const justOut = readTrend(
    film(series(3, 1.0), iso(NOW.getTime() - 2 * DAY)), NOW);
  ok("a film released two days ago is opening, not unknown",
    justOut.momentum === "opening", justOut.momentum);

  const longOutBrieflyWatched = readTrend(
    film(series(3, 1.0), iso(START - 200 * DAY)), NOW);
  ok("a film out for months that we have only just started watching is too early to say",
    longOutBrieflyWatched.momentum === "too early to say",
    longOutBrieflyWatched.momentum);
}

console.log("\nIdentity");
{
  ok("a title becomes a stable id", filmId("Pushpa 2: The Rule", 2024) === "pushpa-2-the-rule-2024",
    filmId("Pushpa 2: The Rule", 2024));
  ok("punctuation and case do not change it",
    filmId("Jawan") === filmId("JAWAN!") && filmId("Jawan") === "jawan");
  ok("an apostrophe is dropped, not turned into a gap",
    filmId("Munna Bhai M.B.B.S.") === "munna-bhai-m-b-b-s", filmId("Munna Bhai M.B.B.S."));
  ok("different films get different ids", filmId("Devara", 2024) !== filmId("Devara", 2025));
}

console.log("\nReading a gross figure");
{
  const crore = (c: string) => { const r = parseCroreGross(c); return "crore" in r ? r.crore : null; };
  ok("crore is read directly", crore("₹1,200 crore") === 1200, String(crore("₹1,200 crore")));
  ok("a decimal survives", crore("₹12.5 crore") === 12.5, String(crore("₹12.5 crore")));
  // A billion rupees is a hundred crore; getting this backwards would be a
  // hundredfold error that still looks like a plausible box office number.
  ok("billions of rupees become crore", crore("₹1.5 billion") === 150, String(crore("₹1.5 billion")));
  ok("millions of rupees become crore", crore("₹500 million") === 50, String(crore("₹500 million")));
  ok("lakh becomes crore", crore("₹250 lakh") === 2.5, String(crore("₹250 lakh")));
  ok("a reference marker does not become the number",
    crore("₹340 crore[12]") === 340, String(crore("₹340 crore[12]")));

  const why = (c: string) => { const r = parseCroreGross(c); return "reason" in r ? r.reason : null; };
  // Converting dollars needs the rate on the day of the report, which nobody
  // records. A converted figure would be invented.
  ok("dollars are refused rather than converted",
    (why("$150 million") ?? "").includes("dollars"), String(why("$150 million")));
  ok("a bare number with no unit is refused",
    (why("₹1,200") ?? "").includes("no unit"), String(why("₹1,200")));
  ok("an empty cell is refused", why("") === "empty");
  ok("a dash is refused", why("—") === "empty");
  ok("prose with no number is refused", why("not yet reported") !== null);
}

console.log("\nIs that a film, or a column we landed on by mistake?");
{
  const why = (t: string) => { const r = looksLikeTitle(t); return "reason" in r ? r.reason : null; };
  ok("a real film passes", why("Toxic") === null);
  ok("a film with punctuation passes", why("Pushpa 2: The Rule") === null);
  ok("a film with a long name passes", why("Theertharoopa Thandeyavarige") === null);

  // The two shapes the first run actually produced.
  ok("a language is refused, and says why",
    (why("Telugu") ?? "").includes("misaligned"), String(why("Telugu")));
  ok("a production house is refused",
    (why("Mythri Movie Makers") ?? "").includes("misaligned"), String(why("Mythri Movie Makers")));
  ok("another production house is refused",
    (why("Vishesh Films") ?? "").includes("misaligned"), String(why("Vishesh Films")));
  ok("an empty cell is refused", why("") === "empty");
}

if (bad > 0) { console.error(`\n${bad} cinema test(s) failed.`); process.exit(1); }
console.log("\nAll cinema tests passed.");
