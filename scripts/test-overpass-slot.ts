/**
 * The slot parser decides whether the census ingest waits or asks again.
 *
 * The first live run had no such decision to make: it used a fixed seven-second
 * gap, was rate-limited after 24 queries, and spent the next eleven minutes
 * failing at the connection level once every seven seconds. These cases are the
 * real shapes of the /api/status body, so that the code reads what the service
 * actually said rather than assuming it is welcome.
 */
import { parseSlotWait } from "./etl/connectors/census";

let failed = 0;
function check(name: string, got: number | null, want: number | null): void {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `  (got ${got}, want ${want})`}`);
}

console.log("\nOverpass slot status");

check("free slots means go now", parseSlotWait(
`Connected as: 3086312051
Current time: 2026-09-03T05:12:41Z
Rate limit: 2
2 slots available now.
Currently running queries (pid, space limit, time limit, start time, endpoint):
`), 0);

check("a single free slot also means go now", parseSlotWait(
`Connected as: 3086312051
Rate limit: 2
1 slot available now.
`), 0);

check("busy: waits for the soonest slot, plus a margin", parseSlotWait(
`Connected as: 3086312051
Current time: 2026-09-03T05:12:41Z
Rate limit: 2
Slot available after: 2026-09-03T05:14:04Z, in 83 seconds.
Slot available after: 2026-09-03T05:15:41Z, in 180 seconds.
`), 85_000);

check("a slot already due is not a negative wait", parseSlotWait(
`Rate limit: 2
Slot available after: 2026-09-03T05:12:00Z, in -4 seconds.
`), 2_000);

// Some mirrors advertise no rate limit at all. That is the opposite of having
// no slots left, and the two must not be confused.
check("no rate limit at all means go now", parseSlotWait(
`Connected as: 0
Current time: 2026-09-03T05:12:41Z
Rate limit: 0
`), 0);

// A status page that says nothing we understand is not permission to proceed.
check("unparseable status is a refusal, not a green light", parseSlotWait(
  "<html><body>502 Bad Gateway</body></html>"), null);
check("empty status is a refusal", parseSlotWait(""), null);

// The wait must come from the status page, never from a countdown that happens
// to appear in surrounding prose.
check("busy wins over a stray rate-limit line", parseSlotWait(
`Rate limit: 0
Slot available after: 2026-09-03T05:14:04Z, in 30 seconds.
`), 32_000);

if (failed > 0) {
  console.error(`\n${failed} slot test(s) failed.`);
  process.exit(1);
}
console.log("\nAll Overpass slot tests passed.");
