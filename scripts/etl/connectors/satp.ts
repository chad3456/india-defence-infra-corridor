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
  ALL_SECURITY_SPECS,
  SECURITY_START_YEAR,
  type SecuritySeriesSpec,
} from "../../../lib/security-catalogue";
import { scoreSeries, type SecurityYear } from "../../../lib/security-index";
import { getText } from "../lib/http";
import { decodeEntities } from "../lib/feed";

/**
 * Where each theatre's datasheet lives, and which series it fills.
 *
 * `urls` is one proven path each, not a candidate list. The probe
 * (`npm run satp:probe`) confirmed both, so guessing is over.
 *
 * The list used to carry three extra left-wing-extremism slugs. Two of them
 * resolve to South Asia-wide aggregates: they answer, they parse, and one year
 * totals 28,355 deaths. The plausibility ceiling caught them, which is the only
 * reason the aggregate did not reach the site a second time under an Indian
 * label. Shotgunning slugs also hammers one host several times a run, which is
 * the most likely cause of the intermittent 403 on the real page.
 *
 * The Punjab probe found the same trap again, which is why `REFUSED` exists
 * below. `india-khalistan` and `india-sikhextremism` both answer 200 and both
 * return a well-formed seven-column table — reporting 8,429 deaths for 2000,
 * against 4,121 on SATP's own all-India page for the same year. Whatever they
 * are, they are not Punjab, and a connector that had trusted the slug would
 * have published a regional aggregate under a Khalistan label. Only
 * `india-punjab` returns Punjab.
 */

/**
 * Slugs that answer, parse, and mean something other than their name.
 *
 * Listed rather than deleted so nobody re-adds them from the same reasoning
 * that produced them the first time, and so the test can assert they are never
 * fetched.
 */
export const REFUSED_SLUGS = [
  "india-khalistan",
  "india-sikhextremism",
] as const;
const SHEETS = [
  // Left-wing extremism is not here. SATP's national LWE page answers 403 to
  // the pipeline while serving the probe, so that theatre is rebuilt from the
  // eighteen state sheets in satp-states.ts, which all answer 200.
  {
    theatre: "terror" as const,
    urls: ["https://www.satp.org/datasheet-terrorist-attack/fatalities/india-jammukashmir"],
    sourceId: "satp-jk-fatalities",
    ids: {
      civilians: "terror-civilians-killed",
      securityForces: "terror-security-forces-killed",
      insurgents: "terror-militants-killed",
      total: "terror-total-fatalities",
      incidents: "terror-attacks",
      tonality: "terror-tonality",
      action: "terror-action-index",
    },
  },
  {
    // Punjab. SATP's yearly table starts in 2000, which is a decade after the
    // insurgency it is named for ended — the peak years, 1981 to 1993, appear
    // on the page only as a single aggregate with no rows. So this series is
    // the aftermath and any revival, not the insurgency, and the catalogue
    // entries say so in their own text rather than leaving a reader to infer a
    // resolved conflict from a flat line near zero.
    theatre: "punjab" as const,
    urls: ["https://www.satp.org/datasheet-terrorist-attack/fatalities/india-punjab"],
    sourceId: "satp-punjab-fatalities",
    ids: {
      civilians: "punjab-civilians-killed",
      securityForces: "punjab-security-forces-killed",
      insurgents: "punjab-militants-killed",
      total: "punjab-total-fatalities",
      incidents: "punjab-attacks",
      // No tonality or action index. Both are built to read a conflict's
      // direction from its casualty mix, and Punjab records single-digit
      // totals in most years — several are zero. A willpower score computed
      // from four deaths would be numerology with a decimal point.
      tonality: null,
      action: null,
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

export interface ParsedRow extends SecurityYear {
  /** Deaths the sheet could not attribute to a category. Part of its total. */
  notSpecified: number;
  /** The total the page itself states, when it publishes one. */
  statedTotal: number | null;
}

export interface ParsedTable {
  rows: ParsedRow[];
  skipped: string[];
  /** The header row as read, so a wrong table is diagnosable from the log. */
  header: string[];
  /** Rows whose three parts did not add up to the page's own total. */
  mismatched: number;
}

/**
 * The column headings a fatality sheet must present.
 *
 * This is the check that was missing. Without it the parser reads the first
 * four numeric columns of whatever table it lands on and publishes them under
 * labels it has no evidence for — which is what happened: a table was found,
 * the columns were not the columns assumed, and 13,142 security force deaths
 * reached the site for a year in which nothing of the kind occurred.
 *
 * Matching the header is not sufficient on its own, so the stated total is
 * cross-checked too. Between them, a wrong table is rejected rather than
 * relabelled.
 */
const COLUMNS = {
  year: /^year$/i,
  incidents: /incident/i,
  civilians: /civilian/i,
  securityForces: /security\s*force|\bsfs?\b|police/i,
  insurgents: /terrorist|militant|maoist|extremist|insurgent|naxal|cadre/i,
  notSpecified: /not\s*specified/i,
  total: /^total$/i,
} as const;

export type ColumnMap = Partial<Record<keyof typeof COLUMNS, number>>;

/**
 * Find each column by its heading rather than by counting from the left.
 *
 * The first version counted positions, assuming `year | civilians | security
 * forces | terrorists | total`. The real sheet is `Year | Incidents of Killing
 * | Civilians | Security Forces | Terrorists/Insurgents/Extremists | Not
 * Specified | Total` — seven columns, with an incident count second. So every
 * figure landed one place to the left of its label: incidents were published as
 * civilian deaths, civilian deaths as security force deaths, and so on.
 *
 * Reading the heading costs nothing and survives a column being inserted, which
 * counting never does.
 */
export function resolveColumns(header: string[]): ColumnMap {
  const map: ColumnMap = {};
  for (const [key, re] of Object.entries(COLUMNS) as Array<[keyof typeof COLUMNS, RegExp]>) {
    const i = header.findIndex((h) => re.test(h));
    if (i !== -1) map[key] = i;
  }
  return map;
}

/** The columns a sheet must present to be usable at all. */
const REQUIRED: Array<keyof typeof COLUMNS> = [
  "year",
  "civilians",
  "securityForces",
  "insurgents",
];

/**
 * Parse a SATP fatality table.
 *
 * Column order on these sheets is year, civilians, security forces, terrorists,
 * total. The parser reads the first four numeric columns and recomputes the
 * total rather than trusting it, so a row whose parts do not add up is caught
 * here instead of on the chart.
 */
export function parseFatalityTable(html: string): ParsedTable {
  const rows: ParsedRow[] = [];
  const skipped: string[] = [];
  let header: string[] = [];
  let cols: ColumnMap = {};
  let mismatched = 0;

  const tableRows = html.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
  for (const tr of tableRows) {
    const cells = [...tr.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
      cellText(m[1] ?? ""),
    );
    if (cells.length < 4) continue;

    const looksLikeYear = (c: string) => /^(19|20)\d{2}$/.test(c.replace(/\D/g, ""));

    // The first row that is not a data row, and that names the columns we
    // need, is the header. Rows are read only once it is found.
    if (header.length === 0 && !looksLikeYear(cells[0] ?? "")) {
      const candidate = resolveColumns(cells);
      if (REQUIRED.every((k) => candidate[k] !== undefined)) {
        header = cells;
        cols = candidate;
      }
      continue;
    }
    if (header.length === 0) continue;

    const at = (k: keyof typeof COLUMNS): string | null => {
      const i = cols[k];
      return i === undefined ? null : (cells[i] ?? "");
    };

    // SATP marks partial years with an asterisk; cellNumber strips it.
    const yearText = (at("year") ?? "").replace(/\D/g, "");
    const year = Number(yearText);
    if (!/^(19|20)\d{2}$/.test(yearText) || year < SECURITY_START_YEAR) continue;

    const civilians = cellNumber(at("civilians") ?? "");
    const securityForces = cellNumber(at("securityForces") ?? "");
    const insurgents = cellNumber(at("insurgents") ?? "");

    if (civilians === null || securityForces === null || insurgents === null) {
      skipped.push(`${year}: a column did not parse`);
      continue;
    }

    const notSpecifiedCell = at("notSpecified");
    const notSpecified = notSpecifiedCell === null ? 0 : (cellNumber(notSpecifiedCell) ?? 0);
    const incidentsCell = at("incidents");
    const incidents = incidentsCell === null ? undefined : (cellNumber(incidentsCell) ?? undefined);

    // Cross-check against the page's own total. "Not specified" deaths are part
    // of the total but belong to no category, so they count here and are not
    // silently folded into one of the three.
    const totalCell = at("total");
    const statedTotal = totalCell === null ? null : cellNumber(totalCell);
    const computed = civilians + securityForces + insurgents + notSpecified;
    if (statedTotal !== null && statedTotal !== computed) {
      mismatched++;
      skipped.push(`${year}: parts sum to ${computed} but the page states ${statedTotal}`);
      continue;
    }

    rows.push({
      year,
      civilians,
      securityForces,
      insurgents,
      notSpecified,
      ...(incidents === undefined ? {} : { incidents }),
      statedTotal,
    });
  }

  // Latest wins on duplicate years — these sheets sometimes repeat a header
  // block partway down.
  const byYear = new Map<number, ParsedRow>();
  for (const r of rows) byYear.set(r.year, r);
  return {
    rows: [...byYear.values()].sort((a, b) => a.year - b.year),
    skipped,
    header,
    mismatched,
  };
}

/** Does this table present the columns a fatality sheet must present? */
export function headerMatches(header: string[]): boolean {
  const cols = resolveColumns(header);
  return REQUIRED.every((k) => cols[k] !== undefined);
}

/**
 * A ceiling on annual deaths for one Indian internal conflict.
 *
 * The worst year of the Kashmir insurgency ran to roughly 4,500 deaths. A
 * table claiming five figures in a year is not this conflict, and the old
 * 20,000 envelope was loose enough to wave 19,370 straight through.
 */
export const MAX_ANNUAL_FATALITIES = 6_000;

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

  // Every catalogue entry, not just the fatality block: the incident series
  // live alongside the hand-entered ones but are filled from this table.
  const byId = new Map(ALL_SECURITY_SPECS.map((s) => [s.id, s]));

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
      // SATP answered this exact URL for the probe and 403'd it for the
      // pipeline minutes later, which reads as throttling rather than a block.
      // More retries, and the backoff in getText spaces them out.
      const res = await getText(url, {
        cacheMs: 12 * 60 * 60 * 1000,
        timeoutMs: 30_000,
        retries: 5,
        accept: "text/html",
      });
      if (!res.ok || !res.data) {
        attempts.push(`${url} -> ${res.error ?? "no body"}`);
        continue;
      }
      const out = parseFatalityTable(res.data);

      // Always log what was found, whether or not it is accepted. The wrong
      // table was only identifiable after the fact because nothing recorded
      // what had actually been read.
      log(`    ${url}`);
      log(`      header: ${out.header.slice(0, 5).join(" | ") || "(none found)"}`);
      const sample = out.rows[0];
      if (sample) {
        log(
          `      first row: ${sample.year} civ=${sample.civilians} sf=${sample.securityForces} ` +
            `adv=${sample.insurgents} stated=${sample.statedTotal ?? "-"}`,
        );
      }

      if (!headerMatches(out.header)) {
        attempts.push(`${url} -> header is not a fatality table: ${out.header.slice(0, 5).join(" | ")}`);
        continue;
      }
      if (out.rows.length < MIN_YEARS) {
        attempts.push(`${url} -> only ${out.rows.length} year(s) parsed, ${out.mismatched} row(s) did not add up`);
        continue;
      }
      const worst = Math.max(
        ...out.rows.map((r) => r.civilians + r.securityForces + r.insurgents),
      );
      if (worst > MAX_ANNUAL_FATALITIES) {
        attempts.push(
          `${url} -> a year totals ${worst} deaths, above the ${MAX_ANNUAL_FATALITIES} ceiling for one Indian internal conflict; this is not the table it claims to be`,
        );
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
      rows.map((r) => pt(r, r.civilians + r.securityForces + r.insurgents + r.notSpecified)),
    );

    // The incident count is in the same table, so the attacks-by-year series
    // needs no separate source and no hand entry.
    const withIncidents = rows.filter((r) => r.incidents !== undefined);
    if (withIncidents.length >= MIN_YEARS) {
      push(
        sheet.ids.incidents,
        withIncidents.map((r) => pt(r, r.incidents ?? 0)),
      );
    } else {
      errors.push(
        `${sheet.theatre}: incident column absent or short (${withIncidents.length} year(s)); attacks series left pending`,
      );
    }

    // The constructed indices, computed here so the arithmetic runs against
    // exactly the numbers published above and cannot drift from them.
    if (sheet.ids.tonality && sheet.ids.action) {
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
  }

  return { series, errors, parsed };
}
