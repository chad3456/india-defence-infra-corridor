/**
 * Postgres <-> JSON sync.
 *
 *   npm run db:push    seed/refresh Postgres from the committed JSON
 *   npm run db:pull    hydrate the JSON from Postgres (runs before a build)
 *   npm run db:check   report row counts and verify the schema is reachable
 *
 * Postgres in the `bharat_tracker` schema is the store of record. The JSON in
 * `data/` is a build-time cache of it, committed so the site still builds with
 * no database configured at all — which is what keeps a Supabase outage from
 * being a site outage.
 *
 * `db:pull` deliberately refuses to overwrite good JSON with an empty or
 * invalid result set: a database that answers with nothing must not be able to
 * blank the site.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Series, Source } from "../../lib/types";
import { validateSeries } from "../lib/validate-series";
import {
  supabaseConfigured,
  getReadClient,
  fetchSeries,
  fetchSources,
  pushSeries,
  pushSources,
  SCHEMA,
} from "../../lib/supabase";

const ROOT = process.cwd();
const SEED_FILES = [
  "data/series/defence.json",
  "data/series/infrastructure.json",
  "data/series/economy.json",
  "data/series/space.json",
  "data/series/wdi.json",
];

const mode = process.argv[2] ?? "check";

async function readJson<T>(rel: string): Promise<T> {
  return JSON.parse(await readFile(join(ROOT, rel), "utf8")) as T;
}

function log(m: string) {
  process.stdout.write(m + "\n");
}

async function loadLocal(): Promise<{ series: Series[]; sources: Source[] }> {
  const sources = await readJson<Source[]>("data/sources.json");
  const series: Series[] = [];
  for (const f of SEED_FILES) series.push(...(await readJson<Series[]>(f)));
  return { series, sources };
}

async function doPush() {
  const { series, sources } = await loadLocal();
  log(`Pushing ${sources.length} sources and ${series.length} series to ${SCHEMA}…`);

  // Sources first — data_points reference them.
  const s1 = await pushSources(sources);
  if (!s1.ok) {
    log(`  sources FAILED: ${s1.error}`);
    process.exit(1);
  }
  log(`  sources ok`);

  const s2 = await pushSeries(series);
  if (!s2.ok) {
    log(`  series FAILED: ${s2.error}`);
    process.exit(1);
  }
  const points = series.reduce((n, s) => n + s.points.length, 0);
  log(`  series ok — ${points} data points, ${series.reduce((n, s) => n + (s.peers?.length ?? 0), 0)} peer values`);
  log("\nPush complete.");
}

async function doPull() {
  log(`Pulling from ${SCHEMA}…`);
  const [series, sources] = await Promise.all([fetchSeries(), fetchSources()]);

  if (!series || series.length === 0 || !sources || sources.length === 0) {
    log("  database returned nothing — keeping committed JSON (this is not an error)");
    return;
  }

  // Never let a bad remote payload land in the repo.
  const sourceIds = new Set(sources.map((s) => s.id));
  const problems = series.flatMap((s) => validateSeries(s, sourceIds).map((p) => `${s.id}: ${p}`));
  if (problems.length > 0) {
    log(`  VALIDATION FAILED — ${problems.length} problem(s), keeping committed JSON`);
    for (const p of problems.slice(0, 10)) log(`    - ${p}`);
    process.exit(1);
  }

  // Regroup by the file each series belongs to, so diffs stay readable.
  const buckets: Record<string, Series[]> = {
    "data/series/defence.json": [],
    "data/series/infrastructure.json": [],
    "data/series/economy.json": [],
    "data/series/space.json": [],
    "data/series/wdi.json": [],
  };
  for (const s of series) {
    if (s.id.startsWith("wdi-")) buckets["data/series/wdi.json"]!.push(s);
    else if (s.category === "defence") buckets["data/series/defence.json"]!.push(s);
    else if (s.category === "infrastructure") buckets["data/series/infrastructure.json"]!.push(s);
    else if (s.category === "space") buckets["data/series/space.json"]!.push(s);
    else buckets["data/series/economy.json"]!.push(s);
  }

  for (const [file, list] of Object.entries(buckets)) {
    list.sort((a, b) => a.id.localeCompare(b.id));
    await writeFile(join(ROOT, file), JSON.stringify(list, null, 2) + "\n", "utf8");
    log(`  wrote ${file} — ${list.length} series`);
  }
  await writeFile(
    join(ROOT, "data/sources.json"),
    JSON.stringify([...sources].sort((a, b) => a.id.localeCompare(b.id)), null, 2) + "\n",
    "utf8",
  );
  log(`  wrote data/sources.json — ${sources.length} sources`);
  log("\nPull complete.");
}

async function doCheck() {
  const client = getReadClient();
  if (!client) {
    log("No Supabase credentials configured — the site will build from committed JSON.");
    return;
  }
  const { data, error } = await client.from("coverage").select("*").maybeSingle();
  if (error) {
    log(`Schema "${SCHEMA}" not reachable: ${error.message}`);
    log("");
    log("Most likely one of:");
    log(`  - the migration has not been applied yet`);
    log(`  - "${SCHEMA}" is not in Settings -> API -> Exposed schemas`);
    process.exit(1);
  }
  log(`Schema "${SCHEMA}" reachable.`);
  log(JSON.stringify(data, null, 2));
}

async function main() {
  if (!supabaseConfigured && mode !== "check") {
    log("No Supabase credentials configured (need a URL and a key).");
    log("Set NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY, or the");
    log("SUPABASE_URL / SUPABASE_ANON_KEY pair injected by the Vercel integration.");
    // Not an error: a build with no database is a supported configuration.
    return;
  }
  if (mode === "push") return doPush();
  if (mode === "pull") return doPull();
  return doCheck();
}

main().catch((err: unknown) => {
  process.stderr.write((err instanceof Error ? err.stack : String(err)) + "\n");
  process.exit(1);
});
