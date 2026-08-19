/**
 * Pipeline orchestrator.
 *
 * Run with `npm run etl` (or `npm run etl:dry` to see what would be fetched
 * without touching the network).
 *
 * Contract:
 *   - Connectors never throw. Each returns its data plus its own errors.
 *   - A connector that fails leaves the previous committed data in place. The
 *     run is marked `partial`, and the site keeps serving the last good values
 *     rather than blanking a chart.
 *   - Output is written only after validation passes, so a malformed upstream
 *     response cannot land in the repo.
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { runWorldBank } from "./connectors/worldbank";
import { runSatp } from "./connectors/satp";
import { runCuratedSecurity } from "./connectors/curated-security";
import { runIngest } from "./connectors/ingest";
import { runX } from "./connectors/x";
import { mergeEvents, readStoredEvents } from "./lib/merge";
import { validateSeries } from "../lib/validate-series";
import { supabaseConfigured, pushNews, pushRun, pushSeries, pushEvents } from "../../lib/supabase";
import type { PipelineRun } from "../../lib/types";

const ROOT = process.cwd();
const DRY = process.argv.includes("--dry-run");

function log(msg: string) {
  process.stdout.write(`${msg}\n`);
}

async function main() {
  const startedAt = new Date().toISOString();
  const messages: string[] = [];
  let connectorsRun = 0;
  let connectorsFailed = 0;
  let seriesUpdated = 0;
  let eventsAdded = 0;

  log(`Bharat Tracker ETL — ${startedAt}${DRY ? " (dry run)" : ""}`);
  log("");

  /* ---------------- World Bank ---------------- */
  log("World Bank WDI");
  connectorsRun++;
  const wb = await runWorldBank({ dryRun: DRY, onProgress: log });
  if (wb.errors.length) {
    connectorsFailed += wb.errors.length > wb.fetched ? 1 : 0;
    for (const e of wb.errors) messages.push(`worldbank: ${e}`);
    log(`  ${wb.errors.length} indicator(s) failed`);
  }

  if (!DRY && wb.series.length > 0) {
    const problems = wb.series.flatMap((s) => validateSeries(s).map((p) => `${s.id}: ${p}`));
    if (problems.length > 0) {
      connectorsFailed++;
      messages.push(...problems.map((p) => `worldbank validation: ${p}`));
      log(`  VALIDATION FAILED — ${problems.length} problem(s), not writing wdi.json`);
      for (const p of problems.slice(0, 10)) log(`    - ${p}`);
    } else {
      await writeFile(
        join(ROOT, "data/series/wdi.json"),
        JSON.stringify(wb.series, null, 2) + "\n",
        "utf8",
      );
      seriesUpdated += wb.series.length;
      log(`  wrote data/series/wdi.json — ${wb.series.length} series`);
    }
  } else if (!DRY) {
    messages.push("worldbank: no series returned; keeping previous data");
    log("  no series returned — previous data left in place");
  }

  /* ---------------- SATP fatality datasheets ---------------- */
  log("");
  log("SATP — fatality datasheets");
  connectorsRun++;
  const satp = await runSatp({ dryRun: DRY, onProgress: log });
  for (const e of satp.errors) messages.push(`satp: ${e}`);

  if (!DRY && satp.series.length > 0) {
    const problems = satp.series.flatMap((s) => validateSeries(s).map((p) => `${s.id}: ${p}`));
    if (problems.length > 0) {
      connectorsFailed++;
      messages.push(...problems.map((p) => `satp validation: ${p}`));
      log(`  VALIDATION FAILED — ${problems.length} problem(s), not writing security.json`);
      for (const p of problems.slice(0, 10)) log(`    - ${p}`);
    } else {
      await writeFile(
        join(ROOT, "data/series/security.json"),
        JSON.stringify(satp.series, null, 2) + "\n",
        "utf8",
      );
      seriesUpdated += satp.series.length;
      log(`  wrote data/series/security.json — ${satp.series.length} series`);
    }
  } else if (!DRY) {
    messages.push("satp: no series returned; keeping previous data");
    log("  no series returned — previous data left in place");
  }

  /* ---------------- Hand-entered security figures ---------------- */
  log("");
  log("Curated security — hand-entered figures");
  connectorsRun++;
  const curated = await runCuratedSecurity({
    root: ROOT,
    sources: JSON.parse(await readFile(join(ROOT, "data/sources.json"), "utf8")),
    onProgress: log,
  });
  for (const e of curated.errors) messages.push(`curated: ${e}`);

  if (!DRY && curated.series.length > 0) {
    const problems = curated.series.flatMap((s) => validateSeries(s).map((p) => `${s.id}: ${p}`));
    if (problems.length > 0) {
      connectorsFailed++;
      messages.push(...problems.map((p) => `curated validation: ${p}`));
      log(`  VALIDATION FAILED — ${problems.length} problem(s), not writing security-curated.json`);
    } else {
      await writeFile(
        join(ROOT, "data/series/security-curated.json"),
        JSON.stringify(curated.series, null, 2) + "\n",
        "utf8",
      );
      seriesUpdated += curated.series.length;
      log(`  wrote data/series/security-curated.json — ${curated.series.length} series`);
    }
  }

  /* ---------------- Event ingest ---------------- */
  log("");
  log("Ingest — feeds and article bodies");
  connectorsRun++;
  const ingest = await runIngest({ dryRun: DRY, onProgress: log });
  for (const e of ingest.errors) messages.push(`ingest: ${e}`);
  const f = ingest.funnel;
  messages.push(
    `ingest funnel: ${f.itemsSeen} items -> ${f.candidates} candidates -> ` +
      `${f.events} events (lost: ${f.noCategory} no sector, ${f.notAnAction} not an action, ` +
      `${f.noPlace} no place)`,
  );
  if (ingest.sourcesOk === 0 && !DRY) connectorsFailed++;

  /* ---------------- X / official handles ---------------- */
  log("");
  log("X — official handles");
  connectorsRun++;
  const x = await runX({ dryRun: DRY, onProgress: log });
  for (const e of x.errors) messages.push(`x: ${e}`);
  if (!x.active && x.reason) messages.push(`x: ${x.reason}`);

  const allEvents = [...ingest.events, ...x.events];

  if (!DRY && ingest.items.length > 0) {
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
    log("");
    log(`  wrote data/live/news.json — ${ingest.items.length} items from ${ingest.sourcesOk}/${ingest.sourcesTotal} sources`);
  } else if (!DRY) {
    messages.push("ingest: no items; keeping previous data");
    log("  no items ingested — previous data left in place");
  }

  if (!DRY && allEvents.length > 0) {
    const stored = await readStoredEvents(ROOT);
    const merge = mergeEvents(stored, allEvents);
    if (merge.staleDropped > 0)
      log(`  dropped ${merge.staleDropped} stored event(s) that no longer pass the rules`);
    if (merge.collapsed > 0)
      log(`  collapsed ${merge.collapsed} duplicate report(s) of the same event`);
    if (merge.unchanged) {
      log(`  no change — data/events.json left at ${merge.events.length} events`);
    } else {
      await writeFile(
        join(ROOT, "data/events.json"),
        JSON.stringify(merge.events, null, 2) + "\n",
        "utf8",
      );
      log(`  wrote data/events.json — ${merge.added} new, ${merge.events.length} total`);
    }
    eventsAdded = merge.added;
  } else if (!DRY) {
    messages.push("ingest: no geo-locatable events this run; events.json unchanged");
    log("  no locatable events this run — data/events.json unchanged");
  }

  /* ---------------- Run record ---------------- */
  const run: PipelineRun = {
    id: `run-${Date.now()}`,
    startedAt,
    finishedAt: new Date().toISOString(),
    // Failed means the run produced nothing usable. One connector losing its
    // upstream, or failing validation, is a partial run — the others' output
    // is already validated and must still reach the repository. The first
    // live run of the SATP connector proved why: one series missing a note
    // discarded 82 freshly-fetched World Bank series and 57 events with it.
    status:
      connectorsFailed >= connectorsRun
        ? "failed"
        : connectorsFailed > 0 || messages.length > 0
          ? "partial"
          : "ok",
    connectorsRun,
    connectorsFailed,
    seriesUpdated,
    messages: messages.slice(0, 50),
  };

  if (!DRY) {
    await mkdir(join(ROOT, "data/live"), { recursive: true });
    await writeFile(
      join(ROOT, "data/live/last-run.json"),
      JSON.stringify(run, null, 2) + "\n",
      "utf8",
    );

    // Mirror to Postgres when configured. Optional by design — a database
    // failure here must not fail a run whose JSON output already landed.
    if (supabaseConfigured) {
      if (wb.series.length > 0) {
        const s = await pushSeries(wb.series);
        log(s.ok ? `  pushed ${wb.series.length} series to Postgres` : `  series push skipped: ${s.error}`);
      }
      const n = await pushNews(ingest.items);
      const ev = await pushEvents(allEvents);
      const r = await pushRun(run);
      if (!n.ok) log(`  news push skipped: ${n.error}`);
      if (!ev.ok) log(`  events push skipped: ${ev.error}`);
      if (!r.ok) log(`  run push skipped: ${r.error}`);
      if (n.ok && ev.ok && r.ok) log(`  mirrored to Postgres (${allEvents.length} events)`);
    }
  }

  log("");
  log(
    `Status: ${run.status.toUpperCase()} · ${seriesUpdated} series updated · ` +
      `${eventsAdded} new events · ${ingest.articlesFetched} article bodies read · ` +
      `${messages.length} message(s)`,
  );

  // A partial run is not a build failure — stale-but-valid data still serves,
  // and the connectors that did work have already written theirs. Only a run
  // where every connector failed exits non-zero.
  if (run.status === "failed") process.exit(1);
}

main().catch((err: unknown) => {
  process.stderr.write(`ETL crashed: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
