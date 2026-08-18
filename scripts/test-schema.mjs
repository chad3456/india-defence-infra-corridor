/**
 * Schema tests.
 *
 * Runs the real migration against Postgres-in-WASM, so the DDL and its
 * constraints are exercised before they reach a shared database. Checks:
 *
 *   1. the migration applies, and re-applies cleanly (the provisioning
 *      workflow re-runs it on every migration change)
 *   2. every editorial rule actually rejects the row it targets — an
 *      array_length() version of these constraints passed on empty arrays,
 *      which is the bug this test exists to catch
 *   3. nothing is created in `public`, which is the isolation guarantee that
 *      makes this safe in a database shared with other projects
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const failures = [];
function check(ok, label) {
  console.log(`  ${ok ? "pass" : "FAIL"}  ${label}`);
  if (!ok) failures.push(label);
}

const db = await new PGlite();
for (const r of ["anon", "authenticated", "service_role", "authenticator"]) {
  await db.exec(`create role ${r};`);
}

const sql = readFileSync("supabase/migrations/0001_init.sql", "utf8");

console.log("Schema tests");

try {
  await db.exec(sql);
  check(true, "migration applies");
} catch (e) {
  check(false, `migration applies — ${e.message}`);
  process.exit(1);
}

try {
  await db.exec(sql);
  check(true, "migration is idempotent");
} catch (e) {
  check(false, `migration is idempotent — ${e.message}`);
}

const objects = await db.query(
  `select table_name from information_schema.tables where table_schema='bharat_tracker' order by 1`,
);
const names = objects.rows.map((r) => r.table_name);
for (const expected of [
  "sources",
  "series",
  "data_points",
  "series_peers",
  "news_items",
  "pipeline_runs",
  "series_full",
  "coverage",
]) {
  check(names.includes(expected), `bharat_tracker.${expected} exists`);
}

const publicObjects = await db.query(
  `select count(*)::int n from information_schema.tables where table_schema='public'`,
);
check(publicObjects.rows[0].n === 0, "nothing created in the public schema");

await db.exec(
  `insert into bharat_tracker.sources values ('s1','n','p','https://x','official','2026-01-01',1,now());`,
);

const base = (id, overrides) => {
  const v = {
    provenance: "official",
    confidence: "high",
    notes: "{}",
    source_ids: "{s1}",
    category: "defence",
    ...overrides,
  };
  return `insert into bharat_tracker.series
    (id,title,definition,category,unit,unit_short,frequency,provenance,confidence,last_verified,notes,source_ids)
    values ('${id}','t','d','${v.category}','u','u','annual','${v.provenance}','${v.confidence}','2026-01-01','${v.notes}','${v.source_ids}')`;
};

const mustReject = [
  ["low-confidence series with no explanatory note", base("bad1", { confidence: "low", provenance: "press" })],
  ["think-tank estimate graded high confidence", base("bad2", { provenance: "think-tank", notes: "{note}" })],
  ["series citing no source", base("bad3", { source_ids: "{}" })],
  ["series with an unknown category", base("bad4", { category: "nonsense" })],
  ["source with an invalid tier", `insert into bharat_tracker.sources values ('s9','n','p','https://x','official','2026-01-01',9,now())`],
  ["pipeline run with an unknown status", `insert into bharat_tracker.pipeline_runs (id,started_at,status) values ('r1',now(),'weird')`],
];

for (const [label, q] of mustReject) {
  let rejected = false;
  try {
    await db.exec(q);
  } catch {
    rejected = true;
  }
  check(rejected, `rejects: ${label}`);
}

// A well-formed series must still round-trip through the read view.
await db.exec(base("good", {}));
await db.exec(`insert into bharat_tracker.data_points (series_id,period,value,source_id,ordinal) values
  ('good','FY2024-25',23622,'s1',0), ('good','FY2014-15',null,'s1',1);`);

const view = await db.query(`select points from bharat_tracker.series_full where id='good'`);
const points = view.rows[0].points;
check(Array.isArray(points) && points.length === 2, "series_full nests data points");
check(
  points.find((p) => p.period === "FY2014-15")?.value === null,
  "a null data point stays null (never zero-filled)",
);
check(
  points[0].period === "FY2024-25",
  "data points come back in authored order",
);

const cov = await db.query(`select * from bharat_tracker.coverage`);
check(cov.rows[0].point_count === 1, "coverage counts only non-null points");

await db.close();

console.log("");
if (failures.length) {
  console.error(`${failures.length} schema test(s) failed.`);
  process.exit(1);
}
console.log("All schema tests passed.");
