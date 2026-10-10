/**
 * A weekly last-known-good copy of the element sets the satellite tracker
 * carries.
 *
 * `npm run tle:snapshot`. Writes data/live/tle-snapshot.json. Runs in GitHub
 * Actions: the editing sandbox cannot reach celestrak.org.
 *
 * The tracker fetches elements live (app/api/tle/route.ts) because they go
 * stale within days in low orbit. This copy exists for when that fetch fails —
 * CelesTrak down, rate-limited, or a group not answering — so the map shows
 * week-old orbits labelled as week-old rather than an empty sky. Weekly, not
 * daily: at about two hundred kilobytes a run, daily would put seventy
 * megabytes a year into git for a file whose only virtue is being current, and
 * the live route already is.
 *
 * Written only after validation: enough objects, the space station present,
 * an Indian fleet found, and no element set older than a month. A failed run
 * leaves the previous copy in place.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "../lib/http";
import { isEntryPoint } from "../lib/entry";
import { buildRecords, feedRequests, summarise, type TleFeed } from "../../../lib/tle-source";

const OUT = join(process.cwd(), "data", "live", "tle-snapshot.json");
const GAP_MS = 1_000;

export function validate(feed: TleFeed): string[] {
  const problems: string[] = [];
  if (feed.satellites.length < 500) problems.push(`only ${feed.satellites.length} objects`);
  if (!feed.satellites.some((s) => s.noradId === 25544)) problems.push("no ISS (25544)");
  if (feed.indianCount < 20) problems.push(`only ${feed.indianCount} Indian satellites`);
  if (feed.medianEpochDays !== null && feed.medianEpochDays > 30) problems.push(`median element set ${feed.medianEpochDays.toFixed(0)} days old`);
  return problems;
}

export async function run(): Promise<void> {
  const now = new Date();
  const answers: Array<{ label: string; text: string }> = [];
  const failed: string[] = [];
  for (const r of feedRequests()) {
    const res = await getText(r.url, { timeoutMs: 60_000, retries: 3, cacheMs: 0 });
    if (res.ok && res.data) answers.push({ label: r.label, text: res.data });
    // CelesTrak answers 404 to a name that matches nothing: empty, not failed.
    else if (res.error === "HTTP 404" && r.key.startsWith("name:")) console.log(`  ${r.key}: no objects by that name`);
    else failed.push(`${r.key}: ${res.error ?? "no data"}`);
    await new Promise((s) => setTimeout(s, GAP_MS));
  }
  const satellites = buildRecords(answers, now);
  const feed: TleFeed = {
    fetchedAt: now.toISOString(), source: "CelesTrak GP, https://celestrak.org", origin: "snapshot", snapshotAt: now.toISOString(),
    satellites, ...summarise(satellites), failed,
  };
  const problems = validate(feed);
  console.log(`${satellites.length} objects, ${feed.indianCount} Indian, median element set ${feed.medianEpochDays?.toFixed(2)} days; ${failed.length} request(s) failed`);
  for (const f of failed) console.log(`  ${f}`);
  if (problems.length > 0) {
    const kept = existsSync(OUT) ? JSON.parse(await readFile(OUT, "utf8")) as TleFeed : null;
    throw new Error(`refusing to write: ${problems.join("; ")}${kept?.snapshotAt ? ` — keeping the snapshot of ${kept.snapshotAt}` : ""}`);
  }
  await mkdir(join(process.cwd(), "data", "live"), { recursive: true });
  await writeFile(OUT, JSON.stringify(feed) + "\n", "utf8");
  console.log(`wrote ${OUT}`);
}

if (isEntryPoint(import.meta.url)) {
  run().catch((e) => { console.error(e); process.exit(1); });
}
