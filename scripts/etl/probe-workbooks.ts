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
 * ── Why it also dumps raw rows ───────────────────────────────────────────
 *
 * The first version reported a year-row count and the first year row, which is
 * enough to confirm a sheet is usable and useless for working out why one is
 * not. Several sheets that plainly hold a year-indexed table — EV registrations
 * on VAHAN, airport passenger traffic — reported zero year rows, and the report
 * gave no way to see what their first column actually contains. A sheet whose
 * period labels this project cannot parse looks exactly like a sheet with no
 * periods in it.
 *
 * So a sheet that names a period in its header but yields no year rows now has
 * its raw rows recorded, and any sheet named in `DUMP` is recorded in full.
 * That is the difference between guessing at a format and reading it.
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

/**
 * Sheets to record in full, whatever the row detector makes of them.
 *
 * Each is either already read by a connector or a candidate for one, and each
 * has been named from the header the previous probe run recorded — not guessed.
 */
const DUMP = new Set([
  "econ-survey-tabchart9::Chart IX.21", // mobile data revenue per GB — produces duplicate periods
  "econ-survey-tabchart9::Chart IX.12", // airport passenger traffic
  "econ-survey-tabchart8::Chart VIII.15", // EV registrations on VAHAN
  "econ-survey-tabchart8::Chart VIII.23", // recognised startups (already read)
  "econ-survey-tabchart10::Chart VIII.12", // passenger traffic, international and domestic
  "econ-survey-tabchart10::Chart VIII.17", // domestic tourist visits (already read)
  "econ-survey-tabchart10::Chart VIII.20", // wireless data usage by generation
  "econ-survey-tabchart6::Chart VI.4", // foodgrains and horticulture (already read)
  "econ-survey-tabchart5::ChartV. 6", // CPI and WPI headline
  "econ-survey-tabchart3::Chart III.9", // credit to agriculture and allied activities
]);

/** A header naming a period, so the sheet ought to have year rows. */
const PERIOD_HEADER = /\b(year|financial year|fy|period|month|quarter)\b/i;

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
  /**
   * The cells as they are, for sheets the row detector could not read and for
   * anything named in `DUMP`. Recorded so a period format can be looked at
   * rather than assumed.
   */
  rawRows?: string[][];
  /** Why the rows were recorded, so the report explains itself. */
  rawReason?: "named in DUMP" | "period header but no year rows";
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
    const sheets: SheetReport[] = tables.map((t) => {
      const named = DUMP.has(`${c.id}::${t.sheet}`);
      const unreadable =
        t.yearRows.length === 0 && t.rows.length > 2 && PERIOD_HEADER.test(t.header.join(" "));
      const report: SheetReport = {
        sheet: t.sheet,
        rows: t.rows.length,
        yearRows: t.yearRows.length,
        header: t.header.slice(0, 10),
        firstYearRow: t.yearRows[0]?.slice(0, 10) ?? null,
      };
      if (named || unreadable) {
        // Capped so a 200-row appendix cannot bloat the committed report; the
        // shape of a period column is visible in far fewer rows than that.
        report.rawRows = t.rows.slice(0, named ? 40 : 12).map((r) => r.slice(0, 12));
        report.rawReason = named ? "named in DUMP" : "period header but no year rows";
      }
      return report;
    });
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
    // The point of the run: sheets that should have parsed and did not.
    for (const s of (r.sheets ?? []).filter((s) => s.rawRows)) {
      log(`         RAW  "${s.sheet}" (${s.rawReason}) — ${s.rows} row(s)`);
      for (const row of (s.rawRows ?? []).slice(0, 8)) {
        log(`            | ${row.join(" | ").slice(0, 150)}`);
      }
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
  const unreadable = ok.reduce(
    (n, r) => n + (r.sheets ?? []).filter((s) => s.rawReason === "period header but no year rows").length,
    0,
  );
  log(`${ok.length}/${reports.length} workbooks opened · ${usable} sheet(s) carry a year-indexed table`);
  log(`${unreadable} sheet(s) name a period in the header and yielded no year rows — their cells are in the report`);
  log("Wrote data/live/workbook-probe.json — read it before writing a connector.");
}

main().catch((err: unknown) => {
  process.stderr.write(`workbook probe crashed: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
