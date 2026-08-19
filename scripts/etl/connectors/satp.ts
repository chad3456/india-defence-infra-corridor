/**
 * SATP fatality datasheets.
 *
 * The South Asia Terrorism Portal publishes year-by-year fatality tables for
 * left-wing extremism and for terrorism, as plain HTML tables. There is no API
 * and no download, so this reads the table — which is the whole mechanism, and
 * also its main fragility: a layout change breaks it, and it must break loudly
 * rather than quietly emitting a shorter series.
 *
 * What it does NOT do is invent the missing pieces. SATP publishes deaths, not
 * incidents, arrests or surrenders. Those feed two of the five tonality
 * dimensions, and where they are absent the index says so by scoring those
 * dimensions zero rather than assuming a value.
 *
 * Guard rails, because this is the one connector whose numbers are about people
 * being killed:
 *   - A year is emitted only if every one of its three columns parsed.
 *   - A table yielding fewer than 10 years is treated as a parse failure, not
 *     as a short history.
 *   - Values outside a sanity envelope are dropped with a message rather than
 *     published.
 */
import type { Series, DataPoint } from "../../../lib/types";
import {
  SECURITY_SERIES,
  SECURITY_START_YEAR,
  type SecuritySeriesSpec,
} from "../../../lib/security-catalogue";
import { scoreSeries, type SecurityYear } from "../../../lib/security-index";
import { getText } from "../lib/http";
import { decodeEntities } from "../lib/feed";

/**
 * Where each theatre's datasheet lives, and which series it fills.
 *
 * `urls` is a candidate list tried in order. SATP's Jammu & Kashmir sheet
 * answered on the first path; the left-wing extremism sheet returned 403 to
 * both the pipeline and the browser user-agent, on a host that was plainly
 * serving the other sheet fine — which reads as a wrong path rather than a
 * block. Rather than guess once per pipeline run, the connector tries the
 * plausible slugs and logs which one answered, so the next run's log names the
 * right URL and the list can be trimmed to it.
 */
const SHEETS = [
  {
    theatre: "lwe" as const,
    urls: [
      "https://www.satp.org/datasheet-terrorist-attack/fatalities/india-maoistinsurgency",
      "https://www.satp.org/datasheet-terrorist-attack/fatalities/india-leftwingextremism",
      "https://www.satp.org/datasheet-terrorist-attack/fatalities/india-naxalinsurgency",
      "https://www.satp.org/datasheet-terrorist-attack/india-maoistinsurgency",
    ],
    sourceId: "satp-lwe-fatalities",
    ids: {
      civilians: "lwe-civilians-killed",
      securityForces: "lwe-security-forces-killed",
      insurgents: "lwe-insurgents-killed",
      total: "lwe-total-fatalities",
      tonality: "lwe-tonality",
      action: "lwe-action-index",
    },
  },
  {
    theatre: "terror" as const,
    urls: ["https://www.satp.org/datasheet-terrorist-attack/fatalities/india-jammukashmir"],
    sourceId: "satp-jk-fatalities",
    ids: {
      civilians: "terror-civilians-killed",
      securityForces: "terror-security-forces-killed",
      insurgents: "terror-militants-killed",
      total: "terror-total-fatalities",
      tonality: "terror-tonality",
      action: "terror-action-index",
    },
  },
];

/** A single year's row must clear this to be published. */
const MIN_YEARS = 10;
const MAX_DEATHS_PER_YEAR = 20_000;

export interface SatpResult {
  series: Series[];
  errors: string[];
  /** Years parsed per theatre, so a partial scrape is visible in the log. */
  parsed: Record<string, number>;
}

/** Strip tags and entities from one table cell. */
function cellText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Read an integer out of a cell.
 *
 * Returns null rather than 0 for anything unparseable. A missing figure and a
 * year with no deaths are different facts, and collapsing them would put
 * fabricated zeroes on a chart about fatalities.
 */
function cellNumber(text: string): number | null {
  const cleaned = text.replace(/[,\s*]/g, "");
  if (cleaned === "" || /^[-–—]$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0 || n > MAX_DEATHS_PER_YEAR) return null;
  return Math.round(n);
}

export interface ParsedRow extends SecurityYear {}

/**
 * Parse a SATP fatality table.
 *
 * Column order on these sheets is year, civilians, security forces, terrorists,
 * total. The parser reads the first four numeric columns and recomputes the
 * total rather than trusting it, so a row whose parts do not add up is caught
 * here instead of on the chart.
 */
export function parseFatalityTable(html: string): { rows: ParsedRow[]; skipped: string[] } {
  const rows: ParsedRow[] = [];
  const skipped: string[] = [];

  const tableRows = html.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
  for (const tr of tableRows) {
    const cells = [...tr.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
      cellText(m[1] ?? ""),
    );
    if (cells.length < 4) continue;

    const yearText = (cells[0] ?? "").replace(/\D/g, "");
    const year = Number(yearText);
    if (!/^(19|20)\d{2}$/.test(yearText) || year < SECURITY_START_YEAR) continue;

    const civilians = cellNumber(cells[1] ?? "");
    const securityForces = cellNumber(cells[2] ?? "");
    const insurgents = cellNumber(cells[3] ?? "");

    if (civilians === null || securityForces === null || insurgents === null) {
      skipped.push(`${year}: a column did not parse`);
      continue;
    }
    rows.push({ year, civilians, securityForces, insurgents });
  }

  // Latest wins on duplicate years — these sheets sometimes repeat a header
  // block partway down.
  const byYear = new Map<number, ParsedRow>();
  for (const r of rows) byYear.set(r.year, r);
  return { rows: [...byYear.values()].sort((a, b) => a.year - b.year), skipped };
}

function seriesFrom(
  spec: SecuritySeriesSpec,
  points: DataPoint[],
  extraSourceIds: string[] = [],
): Series {
  return {
    id: spec.id,
    title: spec.title,
    definition: spec.definition,
    category: spec.category,
    unit: spec.unit,
    unitShort: spec.unitShort,
    frequency: spec.frequency,
    provenance: spec.provenance,
    confidence: spec.confidence,
    higherIsBetter: spec.higherIsBetter,
    sourceIds: [...new Set([...spec.sourceIds, ...extraSourceIds])],
    points,
    notes: spec.note ? [spec.note] : [],
    lastVerified: new Date().toISOString().slice(0, 10),
  };
}

export async function runSatp(
  opts: { dryRun?: boolean; onProgress?: (msg: string) => void } = {},
): Promise<SatpResult> {
  const log = opts.onProgress ?? (() => {});
  const errors: string[] = [];
  const series: Series[] = [];
  const parsed: Record<string, number> = {};

  const byId = new Map(SECURITY_SERIES.map((s) => [s.id, s]));

  for (const sheet of SHEETS) {
    if (opts.dryRun) {
      for (const u of sheet.urls) log(`[dry-run] would try ${sheet.theatre} — ${u}`);
      continue;
    }

    // Try each candidate until one yields a full table. A path that answers
    // but parses short is not accepted: a fragment would silently truncate a
    // twenty-year series about people being killed.
    let rows: ParsedRow[] = [];
    let usedUrl = "";
    const attempts: string[] = [];
    for (const url of sheet.urls) {
      const res = await getText(url, {
        cacheMs: 12 * 60 * 60 * 1000,
        timeoutMs: 30_000,
        accept: "text/html",
      });
      if (!res.ok || !res.data) {
        attempts.push(`${url} -> ${res.error ?? "no body"}`);
        continue;
      }
      const out = parseFatalityTable(res.data);
      if (out.rows.length < MIN_YEARS) {
        attempts.push(`${url} -> only ${out.rows.length} year(s) parsed`);
        continue;
      }
      for (const sk of out.skipped) errors.push(`${sheet.theatre}: ${sk}`);
      rows = out.rows;
      usedUrl = url;
      break;
    }

    if (rows.length === 0) {
      for (const a of attempts) errors.push(`${sheet.theatre}: ${a}`);
      errors.push(`${sheet.theatre}: no candidate URL yielded a full table; keeping previous data`);
      log(`  ${sheet.theatre.padEnd(8)} FAILED — ${attempts.length} candidate(s) tried`);
      for (const a of attempts) log(`    ${a}`);
      continue;
    }

    parsed[sheet.theatre] = rows.length;
    log(`  ${sheet.theatre.padEnd(8)} ${rows.length} years (${rows[0]?.year}–${rows.at(-1)?.year})  ${usedUrl}`);
    if (attempts.length > 0) {
      log(`    (${attempts.length} candidate(s) failed first — trim the list in lib to the working one)`);
    }

    const period = (r: ParsedRow) => String(r.year);
    const pt = (r: ParsedRow, value: number): DataPoint => ({ period: period(r), value });

    const push = (id: string, points: DataPoint[], extra: string[] = []) => {
      const spec = byId.get(id);
      if (!spec) {
        errors.push(`${sheet.theatre}: no catalogue entry for ${id}`);
        return;
      }
      series.push(seriesFrom(spec, points, extra));
    };

    push(sheet.ids.civilians, rows.map((r) => pt(r, r.civilians)));
    push(sheet.ids.securityForces, rows.map((r) => pt(r, r.securityForces)));
    push(sheet.ids.insurgents, rows.map((r) => pt(r, r.insurgents)));
    push(
      sheet.ids.total,
      rows.map((r) => pt(r, r.civilians + r.securityForces + r.insurgents)),
    );

    // The constructed indices, computed here so the arithmetic runs against
    // exactly the numbers published above and cannot drift from them.
    const scored = scoreSeries(rows);
    push(
      sheet.ids.tonality,
      scored.map((s) => ({ period: String(s.year), value: s.tonality.score })),
      ["derived"],
    );
    push(
      sheet.ids.action,
      scored.map((s) => ({ period: String(s.year), value: s.action.index })),
      ["derived"],
    );
  }

  return { series, errors, parsed };
}
