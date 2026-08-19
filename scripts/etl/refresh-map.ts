/**
 * Half-hourly map refresh.
 *
 * `npm run map:refresh` — the wrapper the schedule calls. It is the ingest half
 * of the pipeline only: feeds, article bodies, classification, merge. The World
 * Bank connector is not here, because a series that updates once a quarter has
 * no business being re-fetched forty-eight times a day.
 *
 * The contract this exists to keep:
 *
 *   - New reports appear. Anything the feeds carried since the last run that
 *     clears the sector, action, incident, legal and geo gates lands on the map.
 *   - Nothing else moves. When the half hour brought nothing new, the run
 *     writes no file, makes no commit, and the map keeps exactly what it had.
 *     Quiet is the normal outcome at this cadence and must cost nothing.
 *   - A bad half hour never destroys a good one. If every feed is unreachable,
 *     the stored set is left alone rather than replaced with a shorter one.
 *
 * Exit code is 0 whether or not anything changed. A refresh with no news is not
 * a failure, and a scheduled job that goes red on a quiet Sunday gets muted,
 * which is how real failures get missed.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runIngest } from "./connectors/ingest";
import { mergeEvents, readStoredEvents } from "./lib/merge";
import { ALL_SOURCES } from "../../lib/sources";
import { supabaseConfigured, pushEvents, pushNews } from "../../lib/supabase";

const ROOT = process.cwd();
const DRY = process.argv.includes("--dry-run");

/**
 * Bodies fetched per refresh. Lower than the full pipeline's budget on purpose:
 * at forty-eight runs a day, a generous budget is a lot of requests pointed at
 * publishers who are giving us their feed for free.
 */
const ARTICLE_BUDGET = 60;

function log(msg: string) {
  process.stdout.write(`${msg}\n`);
}

async function main() {
  const startedAt = new Date().toISOString();
  log(`Map refresh — ${startedAt}${DRY ? " (dry run)" : ""}`);
  log(`${ALL_SOURCES.length} feeds declared active`);
  log("");

  const ingest = await runIngest({
    dryRun: DRY,
    onProgress: log,
    articleBudget: ARTICLE_BUDGET,
  });

  if (DRY) {
    log("");
    log("Dry run — nothing fetched, nothing written.");
    return;
  }

  const f = ingest.funnel;
  log("");
  log(
    `Funnel: ${f.itemsSeen} items -> ${f.candidates} candidates -> ${f.events} events ` +
      `(lost: ${f.noCategory} no sector, ${f.notAnAction} not an action, ${f.noPlace} no place)`,
  );

  // Every feed failing is a network or policy problem, not a quiet news day.
  // Replacing the stored set on the strength of that would delete the map.
  if (ingest.sourcesOk === 0) {
    log("");
    log("No feed answered. Leaving the stored map untouched.");
    log("Status: SKIPPED");
    return;
  }

  const stored = await readStoredEvents(ROOT);
  const merge = mergeEvents(stored, ingest.events);

  log("");
  log(
    `Merge: ${merge.added} new, ${merge.updated} revised, ${merge.collapsed} duplicate report(s) ` +
      `collapsed, ${merge.staleDropped} stale row(s) dropped, ${merge.expired} past the horizon`,
  );

  if (merge.unchanged) {
    log("");
    log(`Nothing new this half hour. Map unchanged at ${stored.length} events.`);
    log("Status: NO CHANGE");
    return;
  }

  await writeFile(
    join(ROOT, "data/events.json"),
    JSON.stringify(merge.events, null, 2) + "\n",
    "utf8",
  );
  log(`Wrote data/events.json — ${merge.events.length} events`);

  // The headline tracker rides along: it is the same fetch, already paid for.
  if (ingest.items.length > 0) {
    await mkdir(join(ROOT, "data/live"), { recursive: true });
    await writeFile(
      join(ROOT, "data/live/news.json"),
      JSON.stringify(
        {
          fetchedAt: new Date().toISOString(),
          outletsOk: ingest.sourcesOk,
          outletsTotal: ingest.sourcesTotal,
          items: ingest.items,
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
    log(`Wrote data/live/news.json — ${ingest.items.length} headlines`);
  }

  await mkdir(join(ROOT, "data/live"), { recursive: true });
  await writeFile(
    join(ROOT, "data/live/last-refresh.json"),
    JSON.stringify(
      {
        startedAt,
        finishedAt: new Date().toISOString(),
        feedsOk: ingest.sourcesOk,
        feedsTotal: ingest.sourcesTotal,
        articlesFetched: ingest.articlesFetched,
        funnel: ingest.funnel,
        added: merge.added,
        updated: merge.updated,
        collapsed: merge.collapsed,
        staleDropped: merge.staleDropped,
        total: merge.events.length,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  if (supabaseConfigured) {
    const ev = await pushEvents(merge.events);
    const n = await pushNews(ingest.items);
    log(ev.ok ? "Mirrored events to Postgres" : `Events push skipped: ${ev.error}`);
    if (!n.ok) log(`News push skipped: ${n.error}`);
  }

  log("");
  log(`Status: UPDATED — ${merge.added} new event(s), ${merge.events.length} on the map`);
}

main().catch((err: unknown) => {
  process.stderr.write(
    `Map refresh crashed: ${err instanceof Error ? err.stack : String(err)}\n`,
  );
  process.exit(1);
});
