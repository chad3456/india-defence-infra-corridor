/**
 * Data validation gate.
 *
 * Runs in CI and before every build. If this fails, the site does not ship —
 * which is the point: the whole value of this project is that a number on a
 * chart can be traced back to a named source.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Series, Source } from "../lib/types";
import { validateSeries } from "./lib/validate-series";

const ROOT = process.cwd();
const SERIES_FILES = [
  "data/series/defence.json",
  "data/series/infrastructure.json",
  "data/series/economy.json",
  "data/series/space.json",
  "data/series/wdi.json",
];

async function readJson<T>(rel: string): Promise<T> {
  return JSON.parse(await readFile(join(ROOT, rel), "utf8")) as T;
}

async function main() {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sources = await readJson<Source[]>("data/sources.json");
  const sourceIds = new Set(sources.map((s) => s.id));

  // Source register integrity.
  const seenSource = new Set<string>();
  for (const s of sources) {
    if (seenSource.has(s.id)) errors.push(`duplicate source id "${s.id}"`);
    seenSource.add(s.id);
    if (!s.url?.trim()) errors.push(`source "${s.id}" has no URL`);
    if (!/^https?:\/\//.test(s.url) && !s.url.startsWith("/")) {
      errors.push(`source "${s.id}" has a malformed URL: ${s.url}`);
    }
    if (!s.publisher?.trim()) errors.push(`source "${s.id}" has no publisher`);
    if (![1, 2, 3].includes(s.tier)) errors.push(`source "${s.id}" has invalid tier ${s.tier}`);
  }

  let total = 0;
  let points = 0;
  const seenSeries = new Set<string>();
  const byConfidence: Record<string, number> = { high: 0, medium: 0, low: 0 };

  for (const file of SERIES_FILES) {
    let list: Series[];
    try {
      list = await readJson<Series[]>(file);
    } catch (err) {
      errors.push(`${file}: unreadable — ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    if (!Array.isArray(list)) {
      errors.push(`${file}: expected an array`);
      continue;
    }

    for (const s of list) {
      total++;
      points += s.points?.filter((p) => p.value !== null).length ?? 0;
      byConfidence[s.confidence] = (byConfidence[s.confidence] ?? 0) + 1;

      if (seenSeries.has(s.id)) errors.push(`duplicate series id "${s.id}" (${file})`);
      seenSeries.add(s.id);

      for (const p of validateSeries(s, sourceIds)) {
        errors.push(`${file} › ${s.id}: ${p}`);
      }

      // Warn (not fail) where a claim rests only on press reporting.
      const allTier3 = s.sourceIds.every((id) => sources.find((x) => x.id === id)?.tier === 3);
      if (allTier3 && s.confidence !== "low") {
        warnings.push(
          `${s.id}: rests only on tier-3 press sources but is graded ${s.confidence}`,
        );
      }
    }
  }

  // Every source in the register should actually be used by something.
  const usedSources = new Set<string>();
  for (const file of SERIES_FILES) {
    try {
      const list = await readJson<Series[]>(file);
      for (const s of list) {
        s.sourceIds.forEach((id) => usedSources.add(id));
        s.points.forEach((p) => p.sourceId && usedSources.add(p.sourceId));
        s.peers?.forEach((p) => usedSources.add(p.sourceId));
      }
    } catch {
      /* already reported above */
    }
  }
  // Sources the ETL attaches at run time, which are legitimately unused until
  // the pipeline has run at least once.
  const ETL_ACTIVATED = new Set(["worldbank-wdi", "sipri-milex"]);
  for (const s of sources) {
    if (!usedSources.has(s.id) && !ETL_ACTIVATED.has(s.id)) {
      warnings.push(`source "${s.id}" is registered but unused`);
    }
  }

  /* ---------------- Development events ---------------- */
  const events = await readJson<Array<Record<string, unknown>>>("data/events.json");
  const EVENT_CATS = new Set([
    "startups","infrastructure","defence","roads-airports","pipelines","exports",
    "trade-deals","psu-msme","manufacturing","energy","space","ports",
  ]);
  const seenEvent = new Set<string>();
  for (const e of events) {
    const id = String(e.id ?? "");
    if (!id) errors.push("an event has no id");
    if (seenEvent.has(id)) errors.push(`duplicate event id "${id}"`);
    seenEvent.add(id);
    if (!EVENT_CATS.has(String(e.category))) errors.push(`event "${id}": unknown category "${e.category}"`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(e.date))) errors.push(`event "${id}": date must be YYYY-MM-DD`);
    // An event without a working link is unverifiable, which defeats the point.
    if (!/^https?:\/\//.test(String(e.url ?? ""))) errors.push(`event "${id}": missing or malformed url`);
    if (!e.outlet) errors.push(`event "${id}": no outlet named`);
    if (e.status !== "verified" && e.status !== "reported") {
      errors.push(`event "${id}": status must be verified or reported`);
    }
    const coords = e.coords as [number, number] | null;
    if (coords !== null) {
      const [lon, lat] = coords ?? [];
      // Bounding box for India, so a transposed lat/lon cannot ship.
      if (!(lon >= 68 && lon <= 98 && lat >= 6 && lat <= 38)) {
        errors.push(`event "${id}": coords ${JSON.stringify(coords)} fall outside India`);
      }
    }
  }

  console.log("Data validation");
  console.log(`  series       : ${total}`);
  console.log(`  data points  : ${points}`);
  console.log(`  sources      : ${sources.length}`);
  console.log(`  map events   : ${events.length}`);
  console.log(
    `  confidence   : ${byConfidence.high} high · ${byConfidence.medium} medium · ${byConfidence.low} low`,
  );

  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  ! ${w}`);
  }

  if (errors.length) {
    console.error(`\n${errors.length} error(s):`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    process.exit(1);
  }

  console.log("\nValidation passed.");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
