/**
 * PDF structure probe.
 *
 * `npm run pdfs:probe`. Downloads the reports the source probe confirmed are
 * reachable, and reports what is inside them: page count, and for each page the
 * rows that look like a table, with the ones naming a state picked out.
 * Publishes no data.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 *
 * State-level penetration was asked for, and almost nothing publishes it in a
 * readable form. Ten candidates were probed: PMAY's two dashboards and NFHS
 * failed at DNS, PNGRB's statistics page 404s, and the Central Electricity
 * Authority and MoSPI answer with pages that link no data at all. Two things
 * came back: TRAI's quarterly performance report, which carries subscribers by
 * service area — the closest thing to a state breakdown Indian telecom
 * publishes — and PPAC's monthly reports on petroleum and gas.
 *
 * Both are PDFs, which is the format this project trusts least and has already
 * built a reader for. The reader rebuilds rows from text position, so a report
 * that turns out to be charts and prose rather than tables cannot be read at
 * all — and finding that out is the whole point of running this before writing
 * a connector rather than after.
 *
 * Runs in Actions. Nothing here reaches the site.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { extractTables } from "./lib/pdf-table";

const ROOT = process.cwd();

/** Confirmed reachable by the source probe. Nothing here is a guessed path. */
const DOCUMENTS = [
  {
    id: "trai-qpir",
    publisher: "TRAI",
    feeds: ["broadband-subscribers", "wireless-by-service-area", "internet-penetration"],
    url: "https://www.trai.gov.in/sites/default/files/2026-06/QPIR_22062026.pdf",
  },
  {
    id: "ppac-industry-consumption",
    publisher: "PPAC",
    feeds: ["gas-consumption", "petroleum-consumption-state"],
    url: "https://ppac.gov.in/download.php?file=menu/1787315734_ICR_July 26.pdf",
  },
];

/**
 * Indian states and union territories, for spotting a state-indexed table.
 *
 * A row naming three or more of these is almost certainly a header or a
 * state-by-state table, which is exactly what a penetration map needs and
 * exactly what most of these reports turn out not to have.
 */
const STATES =
  /(Andhra|Arunachal|Assam|Bihar|Chhattisgarh|Goa|Gujarat|Haryana|Himachal|Jharkhand|Karnataka|Kerala|Madhya Pradesh|Maharashtra|Manipur|Meghalaya|Mizoram|Nagaland|Odisha|Punjab|Rajasthan|Sikkim|Tamil Nadu|Telangana|Tripura|Uttar Pradesh|Uttarakhand|West Bengal|Delhi|Jammu|Ladakh|Puducherry|Chandigarh)/i;

/** Pages to read. These reports run to hundreds of pages; the tables are early. */
const MAX_PAGES = 90;

interface PageReport {
  page: number;
  rows: number;
  /** Rows whose first cell reads as a year. */
  yearRows: number;
  /** Rows mentioning an Indian state or union territory. */
  stateRows: number;
  /** The widest row on the page — a proxy for how table-like it is. */
  widestRow: number;
  /** A few rows as they came out, so a person can see the real shape. */
  sample: string[][];
  /**
   * The page's opening rows, in document order.
   *
   * The first version sorted the sample by width, which surfaced the widest
   * data row and discarded the page title and column headers with it. That
   * left tables whose columns could only be guessed at — five numbers beside a
   * state name, and no way to know which was subscribers and which was a
   * percentage change. Guessing a column's meaning from its position is
   * precisely how this project once published incident counts as civilian
   * deaths, so the header now comes back with the data.
   */
  opening: string[][];
}

interface Report {
  id: string;
  publisher: string;
  feeds: string[];
  url: string;
  status: "ok" | "failed";
  detail?: string;
  bytes?: number;
  pagesRead?: number;
  /** Pages carrying something state-indexed — the ones worth a connector. */
  statePages?: number[];
  pages?: PageReport[];
}

async function probe(doc: (typeof DOCUMENTS)[number]): Promise<Report> {
  const base = { id: doc.id, publisher: doc.publisher, feeds: doc.feeds, url: doc.url };
  try {
    const res = await fetch(doc.url, {
      headers: { "user-agent": "BharatTracker/0.1 data-pipeline", accept: "*/*" },
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) return { ...base, status: "failed", detail: `HTTP ${res.status}` };
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf[0] !== 0x25 || buf[1] !== 0x50) {
      return { ...base, status: "failed", detail: "not a PDF — first bytes are not %P" };
    }

    const tables = await extractTables(buf, { lastPage: MAX_PAGES });
    const pages: PageReport[] = tables.map((t) => {
      const stateRows = t.rows.filter((r) => STATES.test(r.join(" "))).length;
      const yearRowCount = t.rows.filter((r) => /^(19|20)\d{2}/.test((r[0] ?? "").trim())).length;
      return {
        page: t.page,
        rows: t.rows.length,
        yearRows: yearRowCount,
        stateRows,
        widestRow: Math.max(0, ...t.rows.map((r) => r.length)),
        // Wide rows first: a five-column row says more about a table's shape
        // than the page heading that happens to come first.
        sample: [...t.rows]
          .sort((a, b) => b.length - a.length)
          .slice(0, 4)
          .map((r) => r.slice(0, 10)),
        // Untouched order, so the title and header sit where they actually are.
        opening: t.rows.slice(0, 12).map((r) => r.slice(0, 12)),
      };
    });

    return {
      ...base,
      status: "ok",
      bytes: buf.length,
      pagesRead: pages.length,
      statePages: pages.filter((p) => p.stateRows >= 3).map((p) => p.page),
      pages,
    };
  } catch (err) {
    return { ...base, status: "failed", detail: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  const log = (m: string) => process.stdout.write(`${m}\n`);
  log(`Opening ${DOCUMENTS.length} report(s) — publishes nothing\n`);

  await mkdir(join(ROOT, "data/live"), { recursive: true });
  const reports: Report[] = [];
  const save = () =>
    writeFile(
      join(ROOT, "data/live/pdf-probe.json"),
      JSON.stringify({ probedAt: new Date().toISOString(), reports }, null, 2) + "\n",
      "utf8",
    );

  for (const doc of DOCUMENTS) {
    const r = await probe(doc);
    reports.push(r);
    await save();
    if (r.status === "failed") {
      log(`  FAIL ${r.id.padEnd(26)} ${r.detail}`);
      continue;
    }
    log(
      `  ok   ${r.id.padEnd(26)} ${String(r.bytes).padStart(9)}b  ${r.pagesRead} page(s) read  ` +
        `${r.statePages?.length ?? 0} with a state-indexed table`,
    );
    for (const p of (r.pages ?? []).filter((p) => p.stateRows >= 3).slice(0, 6)) {
      log(`         page ${p.page}: ${p.rows} rows, ${p.stateRows} name a state, widest ${p.widestRow} cells`);
      log(`            -- opening rows, in order --`);
      for (const row of p.opening.slice(0, 6)) log(`            | ${row.join(" | ").slice(0, 160)}`);
      log(`            -- widest rows --`);
      for (const row of p.sample.slice(0, 2)) log(`            | ${row.join(" | ").slice(0, 160)}`);
    }
  }

  await save();
  const usable = reports.filter((r) => (r.statePages?.length ?? 0) > 0);
  log("");
  log(`${reports.filter((r) => r.status === "ok").length}/${reports.length} opened · ${usable.length} carry a state-indexed table`);
  log("Wrote data/live/pdf-probe.json — read it before writing a connector.");
}

main().catch((err: unknown) => {
  process.stderr.write(`pdf probe crashed: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
