/**
 * Workbook probe.
 *
 * `npm run workbooks:probe`. Downloads the spreadsheets the source probe found
 * and reports what is inside each one: sheet names, header rows, and how many
 * rows start with a year. Publishes no data.
 *
 * The source probe answers "is there a file"; this answers "is the file any
 * use". Between them, a connector gets written against a known shape instead
 * of a hopeful one — which is the whole reason this project has probes at all.
 *
 * Runs in Actions. The development sandbox's network policy denies these hosts.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readWorkbook } from "./lib/sheet-table";

const ROOT = process.cwd();

/**
 * The Economic Survey's statistical tables, as spreadsheets.
 *
 * Found by the source probe on the Survey landing page. Everybody cites the
 * Survey PDF; these sit beside it and have real cells.
 */
const SURVEY = Array.from({ length: 12 }, (_, i) => ({
  id: `econ-survey-tabchart${i + 1}`,
  publisher: "Ministry of Finance, Economic Survey",
  url: `https://www.indiabudget.gov.in/economicsurvey/doc/tabchart/tabchart${i + 1}.xlsx`,
}));

const OTHERS = [
  {
    id: "amfi-latest",
    publisher: "AMFI",
    url: "https://portal.amfiindia.com/spages/amjul2026repo.xls",
  },
];

interface SheetReport {
  sheet: string;
  rows: number;
  yearRows: number;
  header: string[];
  firstYearRow: string[] | null;
}

interface Report {
  id: string;
  publisher: string;
  url: string;
  status: "ok" | "failed";
  detail?: string;
  bytes?: number;
  sheets?: SheetReport[];
  /** Sheets with at least three year rows — the ones worth a connector. */
  usableSheets?: number;
}

async function probe(c: { id: string; publisher: string; url: string }): Promise<Report> {
  const base = { id: c.id, publisher: c.publisher, url: c.url };
  try {
    const res = await fetch(c.url, {
      headers: { "user-agent": "BharatTracker/0.1 data-pipeline", accept: "*/*" },
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return { ...base, status: "failed", detail: `HTTP ${res.status}` };
    const buf = new Uint8Array(await res.arrayBuffer());
    const tables = await readWorkbook(buf);
    const sheets: SheetReport[] = tables.map((t) => ({
      sheet: t.sheet,
      rows: t.rows.length,
      yearRows: t.yearRows.length,
      header: t.header.slice(0, 10),
      firstYearRow: t.yearRows[0]?.slice(0, 10) ?? null,
    }));
    return {
      ...base,
      status: "ok",
      bytes: buf.length,
      sheets,
      usableSheets: sheets.filter((s) => s.yearRows >= 3).length,
    };
  } catch (err) {
    return { ...base, status: "failed", detail: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  const log = (m: string) => process.stdout.write(`${m}\n`);
  const candidates = [...SURVEY, ...OTHERS];
  log(`Opening ${candidates.length} workbooks — publishes nothing\n`);

  const reports: Report[] = [];
  for (const c of candidates) {
    const r = await probe(c);
    reports.push(r);
    if (r.status === "failed") {
      log(`  FAIL ${r.id.padEnd(26)} ${r.detail}`);
      continue;
    }
    log(`  ok   ${r.id.padEnd(26)} ${String(r.bytes).padStart(9)}b  ${r.sheets?.length} sheet(s), ${r.usableSheets} usable`);
    for (const s of (r.sheets ?? []).filter((s) => s.yearRows >= 3).slice(0, 6)) {
      log(`         "${s.sheet}" — ${s.yearRows} year rows`);
      if (s.header.length) log(`            header: ${s.header.join(" | ").slice(0, 150)}`);
      if (s.firstYearRow) log(`            first:  ${s.firstYearRow.join(" | ").slice(0, 150)}`);
    }
  }

  await mkdir(join(ROOT, "data/live"), { recursive: true });
  await writeFile(
    join(ROOT, "data/live/workbook-probe.json"),
    JSON.stringify({ probedAt: new Date().toISOString(), reports }, null, 2) + "\n",
    "utf8",
  );

  const ok = reports.filter((r) => r.status === "ok");
  const usable = ok.reduce((n, r) => n + (r.usableSheets ?? 0), 0);
  log("");
  log(`${ok.length}/${reports.length} workbooks opened · ${usable} sheet(s) carry a year-indexed table`);
  log("Wrote data/live/workbook-probe.json — read it before writing a connector.");
}

main().catch((err: unknown) => {
  process.stderr.write(`workbook probe crashed: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
