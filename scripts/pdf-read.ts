/**
 * Read a table out of a committed PDF.
 *
 *   npm run pdf:read -- data/pdf/econ-survey-2025-appendix.pdf --pages 12-14
 *   npm run pdf:read -- <file> --pages 12 --years          # data rows only
 *   npm run pdf:read -- <file> --pages 12 --json           # machine-readable
 *
 * Prints the reconstructed grid. It publishes nothing, on purpose: the output
 * is for a person to compare against the page before any figure is entered
 * into data/security/curated.json with its citation.
 *
 * That separation is the whole point. Layout reconstruction is a guess, and a
 * guess that reads plausibly is how wrong numbers reached this site before.
 * Here the document is pinned in the repository and can be read directly, so
 * the guess is checkable rather than trusted.
 */
import { readFileSync } from "node:fs";
import { extractTables, parseIndianNumber, yearRows } from "./etl/lib/pdf-table";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const file = process.argv[2];
  if (!file || file.startsWith("--")) {
    process.stderr.write("usage: npm run pdf:read -- <file.pdf> [--pages 3-5] [--years] [--json]\n");
    process.exit(1);
  }

  const range = arg("pages");
  const [from, to] = range ? range.split("-") : [];
  const firstPage = from ? Number(from) : undefined;
  const lastPage = to ? Number(to) : firstPage;

  const yearsOnly = process.argv.includes("--years");
  const asJson = process.argv.includes("--json");

  const data = new Uint8Array(readFileSync(file));
  const tables = await extractTables(data, { firstPage, lastPage, yearsOnly });

  if (asJson) {
    process.stdout.write(JSON.stringify(tables, null, 2) + "\n");
    return;
  }

  for (const t of tables) {
    process.stdout.write(`\n── page ${t.page} — ${t.rows.length} row(s)\n`);
    for (const r of t.rows) {
      process.stdout.write(`  ${r.join("  │  ")}\n`);
    }
    if (!yearsOnly) {
      const yr = yearRows(t.rows);
      if (yr.length > 0) {
        process.stdout.write(`\n  ${yr.length} row(s) start with a year. Parsed numerically:\n`);
        for (const r of yr) {
          const nums = r.slice(1).map((c) => parseIndianNumber(c));
          process.stdout.write(`    ${r[0]}  ${nums.map((n) => (n === null ? "—" : n)).join("  ")}\n`);
        }
      }
    }
  }
  process.stdout.write(
    "\nNothing published. Check these against the page, then enter figures in\n" +
      "data/security/curated.json with a sourceId naming the document and page.\n",
  );
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
