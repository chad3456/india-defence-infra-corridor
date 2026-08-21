/**
 * Read a table out of a spreadsheet — local file or URL.
 *
 *   npm run sheet:read -- data/pdf/econ-survey-tabchart1.xlsx
 *   npm run sheet:read -- <file|url> --sheet "Table 1.1"
 *   npm run sheet:read -- <file|url> --years        # data rows only
 *   npm run sheet:read -- <file|url> --list         # sheet names only
 *
 * Publishes nothing. Prints the cells for a person to compare against the
 * source before any figure is entered in data/security/curated.json with its
 * citation — the same discipline as the PDF reader, for the same reason.
 *
 * A URL works from CI, where the network does; in the development sandbox only
 * local files will load, because the network policy denies these hosts.
 */
import { readFileSync } from "node:fs";
import { readWorkbook, parseCellNumber } from "./etl/lib/sheet-table";
import { getText } from "./etl/lib/http";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function load(target: string): Promise<Uint8Array> {
  if (!/^https?:\/\//i.test(target)) return new Uint8Array(readFileSync(target));
  // getText decodes as text, which would corrupt a binary workbook, so the
  // fetch is done directly here.
  const res = await fetch(target, {
    headers: { "user-agent": "BharatTracker/0.1 data-pipeline", accept: "*/*" },
  });
  if (!res.ok) throw new Error(`${target} -> HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function main() {
  const target = process.argv[2];
  if (!target || target.startsWith("--")) {
    process.stderr.write(
      "usage: npm run sheet:read -- <file.xlsx|url> [--sheet NAME] [--years] [--list]\n",
    );
    process.exit(1);
  }

  const tables = await readWorkbook(await load(target));

  if (process.argv.includes("--list")) {
    for (const t of tables) {
      process.stdout.write(
        `${t.sheet}  —  ${t.rows.length} row(s), ${t.yearRows.length} year row(s)\n`,
      );
    }
    return;
  }

  const only = arg("sheet");
  const yearsOnly = process.argv.includes("--years");

  for (const t of tables) {
    if (only && t.sheet !== only) continue;
    if (t.rows.length === 0) continue;
    process.stdout.write(`\n── sheet "${t.sheet}" — ${t.rows.length} rows, ${t.yearRows.length} with a year\n`);
    if (t.header.length > 0) process.stdout.write(`   header: ${t.header.slice(0, 10).join("  │  ")}\n`);
    const rows = yearsOnly ? t.yearRows : t.rows.slice(0, 30);
    for (const r of rows.slice(0, 40)) {
      process.stdout.write(`   ${r.slice(0, 10).join("  │  ")}\n`);
    }
    if (t.yearRows.length > 0 && !yearsOnly) {
      process.stdout.write(`\n   parsed numerically:\n`);
      for (const r of t.yearRows.slice(0, 10)) {
        const nums = r.slice(1, 8).map((c) => parseCellNumber(c));
        process.stdout.write(`     ${r[0]}  ${nums.map((n) => (n === null ? "—" : n)).join("  ")}\n`);
      }
    }
  }

  process.stdout.write(
    "\nNothing published. Check these against the source, then enter figures in\n" +
      "data/security/curated.json with a sourceId naming the workbook and sheet.\n",
  );
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
