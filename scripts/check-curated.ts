/**
 * Validates `data/security/curated.json` without touching the network.
 *
 * Hand-entered figures are the one path into this site that no upstream will
 * contradict, so the gate is stricter than for scraped data: every point cites
 * a resolvable document, and one bad point rejects its whole series.
 */
import { readFileSync } from "node:fs";
import { buildCuratedSeries, readCurated } from "./etl/connectors/curated-security";
import { validateSeries } from "./lib/validate-series";
import type { Source } from "../lib/types";

async function main() {
  const root = process.cwd();
  const sources = JSON.parse(readFileSync("data/sources.json", "utf8")) as Source[];
  const { entries, error } = await readCurated(root);

  if (error) {
    process.stderr.write(`data/security/curated.json: ${error}\n`);
    process.exit(1);
  }

  if (entries.length === 0) {
    process.stdout.write(
      "data/security/curated.json is empty — nothing to check, and the curated charts stay pending.\n",
    );
    return;
  }

  const { series, errors, accepted } = buildCuratedSeries(entries, sources);

  for (const [id, n] of Object.entries(accepted)) {
    process.stdout.write(`  ok    ${id.padEnd(32)} ${n} point(s)\n`);
  }

  // Anything accepted here still has to clear the same publish gate as
  // everything else on the site.
  const gate = series.flatMap((s) => validateSeries(s).map((p) => `${s.id}: ${p}`));
  for (const e of [...errors, ...gate]) process.stdout.write(`  FAIL  ${e}\n`);

  if (errors.length + gate.length > 0) {
    process.stderr.write(`\n${errors.length + gate.length} problem(s) in curated security data.\n`);
    process.exit(1);
  }
  process.stdout.write(`\n${series.length} curated series validated.\n`);
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
