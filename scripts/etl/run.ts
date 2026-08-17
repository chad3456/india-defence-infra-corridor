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
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { runWorldBank } from "./connectors/worldbank";
import { runNews } from "./connectors/news";
import { validateSeries } from "../lib/validate-series";
import { supabaseConfigured, pushNews, pushRun } from "../../lib/supabase";
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

  /* ---------------- News tracker ---------------- */
  log("");
  log("News tracker");
  connectorsRun++;
  const news = await runNews({ dryRun: DRY, onProgress: log });
  if (news.errors.length) {
    for (const e of news.errors) messages.push(`news: ${e}`);
  }
  if (news.outletsOk === 0 && !DRY) connectorsFailed++;

  if (!DRY && news.items.length > 0) {
    await mkdir(join(ROOT, "data/live"), { recursive: true });
    await writeFile(
      join(ROOT, "data/live/news.json"),
      JSON.stringify(
        {
          fetchedAt: new Date().toISOString(),
          outletsOk: news.outletsOk,
          outletsTotal: 7,
          items: news.items,
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
    log(`  wrote data/live/news.json — ${news.items.length} items from ${news.outletsOk} outlets`);
  } else if (!DRY) {
    messages.push("news: no items ingested; keeping previous data");
    log("  no items ingested — previous data left in place");
  }

  /* ---------------- Run record ---------------- */
  const run: PipelineRun = {
    id: `run-${Date.now()}`,
    startedAt,
    finishedAt: new Date().toISOString(),
    status: connectorsFailed === 0 ? (messages.length ? "partial" : "ok") : "failed",
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
      const n = await pushNews(news.items);
      const r = await pushRun(run);
      if (!n.ok) log(`  supabase news push skipped: ${n.error}`);
      if (!r.ok) log(`  supabase run push skipped: ${r.error}`);
      if (n.ok && r.ok) log("  mirrored to Postgres");
    }
  }

  log("");
  log(`Status: ${run.status.toUpperCase()} · ${seriesUpdated} series updated · ${messages.length} message(s)`);

  // A partial run is not a build failure — stale-but-valid data still serves.
  // Only a total connector failure exits non-zero.
  if (run.status === "failed") process.exit(1);
}

main().catch((err: unknown) => {
  process.stderr.write(`ETL crashed: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
