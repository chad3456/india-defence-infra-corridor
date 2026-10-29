/**
 * Build data/youth/states.json from the committed copy of MoSPI's "Youth in
 * India 2022". Reads only the state-wise statements lib/youth-india.ts names,
 * gates the result, and writes nothing if a gate fails.
 *
 *   npm run youth:build           # write data/youth/states.json
 *   npm run youth:build -- --check   # fail if the committed file differs from a fresh read
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractTables } from "./etl/lib/pdf-table";
import { YOUTH_INDICATORS, YOUTH_PDF, YOUTH_TABLES, buildYouth } from "../lib/youth-india";

const OUT = join(process.cwd(), "data", "youth", "states.json");

export async function readYouth(builtAt: string) {
  const bytes = new Uint8Array(readFileSync(join(process.cwd(), YOUTH_PDF)));
  const grids: Record<string, string[][]> = {};
  for (const t of YOUTH_TABLES) {
    const [table] = await extractTables(bytes.slice(), { firstPage: t.page, lastPage: t.page });
    grids[t.id] = table?.rows ?? [];
  }
  return buildYouth(grids, builtAt);
}

export function gateYouth(out: Awaited<ReturnType<typeof readYouth>>): string[] {
  const fails: string[] = [];
  const india = out.geos.India;
  if (!india) fails.push("no India row");
  if (Object.keys(out.geos).length < 31) fails.push(`only ${Object.keys(out.geos).length} geographies`);
  for (const i of YOUTH_INDICATORS) if (!india?.some((r) => r[0] === i.n && r[3] !== null)) fails.push(`India has no value for #${i.n}`);
  for (const [g, rows] of Object.entries(out.geos)) for (const r of rows) {
    const unit = YOUTH_INDICATORS.find((i) => i.n === r[0])!.unit;
    // Gross enrolment ratios can pass 100; shares cannot.
    const cap = /Gross enrolment/.test(YOUTH_INDICATORS.find((i) => i.n === r[0])!.label) ? 200 : unit === "%" ? 100 : 50;
    for (const v of r.slice(1, 5)) if (typeof v === "number" && (v < 0 || v > cap)) fails.push(`${g} #${r[0]}: ${v} out of range`);
  }
  return fails;
}

async function main() {
  const check = process.argv.includes("--check");
  const committed = existsSync(OUT) ? (JSON.parse(readFileSync(OUT, "utf8")) as { fetchedAt: string }) : null;
  const out = await readYouth(check && committed ? committed.fetchedAt : new Date().toISOString());
  const fails = gateYouth(out);
  if (fails.length) { console.error(`youth: gate failed\n  ${fails.join("\n  ")}`); process.exitCode = 1; return; }
  const text = JSON.stringify(out) + "\n";
  if (check) {
    if (!committed || readFileSync(OUT, "utf8") !== text) { console.error("youth: data/youth/states.json differs from a fresh read of the PDF — run npm run youth:build"); process.exitCode = 1; return; }
    console.log("youth: committed file matches the PDF");
    return;
  }
  mkdirSync(join(process.cwd(), "data", "youth"), { recursive: true });
  writeFileSync(OUT, text);
  console.log(`youth: ${Object.keys(out.geos).length} geographies, ${out.indicators.length} indicators, ${out.problems.length} rows left out`);
  for (const p of out.problems) console.log(`  ${p}`);
}

if (process.argv[1] && /youth-india\.ts$/.test(process.argv[1])) main();
