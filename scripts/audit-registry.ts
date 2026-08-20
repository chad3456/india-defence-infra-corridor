/**
 * Registry audit.
 *
 * Fails the build if the chart gallery falls below its target size, if any spec
 * points at a series that does not exist and is not a known pending indicator,
 * or if ids collide.
 */
import { getRegistry, registryStats } from "../lib/registry";
import { getSeries, getAllSeries, sourcesForSeries } from "../lib/data";
import { WDI_BY_ID } from "../lib/wdi-catalogue";
import { SECURITY_BY_ID } from "../lib/security-catalogue";
import { INDIA_BY_ID } from "../lib/india-catalogue";

const TARGET = 250;

function main() {
  const registry = getRegistry();
  const stats = registryStats();
  const errors: string[] = [];

  const ids = new Set<string>();
  for (const spec of registry) {
    if (ids.has(spec.id)) errors.push(`Duplicate chart id: ${spec.id}`);
    ids.add(spec.id);

    for (const sid of spec.seriesIds) {
      // A pending spec is allowed to name a series no connector has filled
      // yet, provided a catalogue declares it. That is the promise; an id in
      // neither the data nor a catalogue is a typo.
      if (!getSeries(sid) && !WDI_BY_ID.has(sid) && !SECURITY_BY_ID.has(sid) && !INDIA_BY_ID.has(sid)) {
        errors.push(`Chart ${spec.id} references unknown series "${sid}"`);
      }
    }
    if (!spec.title.trim()) errors.push(`Chart ${spec.id} has no title`);
  }

  // Every loaded series must be traceable to at least one resolvable source.
  for (const s of getAllSeries()) {
    if (sourcesForSeries(s).length === 0) {
      errors.push(`Series ${s.id} resolves to no known source`);
    }
  }

  console.log("Chart registry");
  console.log(`  total charts   : ${stats.total}`);
  console.log(`  live now       : ${stats.live}`);
  console.log(`  awaiting ETL   : ${stats.pending}`);
  console.log("  by category    :");
  for (const [cat, n] of Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`      ${cat.padEnd(16)} ${n}`);
  }

  if (stats.total < TARGET) {
    errors.push(`Registry has ${stats.total} charts, below the target of ${TARGET}`);
  }

  if (errors.length) {
    console.error(`\n${errors.length} registry error(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log("\nRegistry audit passed.");
}

main();
