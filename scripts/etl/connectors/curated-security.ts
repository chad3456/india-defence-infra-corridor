/**
 * Hand-entered security figures.
 *
 * Several series this project promises have no machine-readable table
 * anywhere: LWE-affected district counts, stone-pelting incidents, communal
 * incidents, J&K tourist arrivals, squadron strength. They live in MHA annual
 * reports, parliamentary answers and NCRB volumes — PDFs and prose, published
 * once a year, in a layout that changes.
 *
 * Scraping those is how the last set of wrong numbers happened. So these are
 * entered by hand into `data/security/curated.json`, and this connector's job
 * is to be strict about what it accepts:
 *
 *   - Every point cites its own source, not the series'. Each year of an
 *     MHA series comes from a different document, and a series-level citation
 *     would point at one of them and imply all.
 *   - Every cited source must resolve in `data/sources.json`.
 *   - A value the entry does not have is `null`, never omitted and never zero.
 *   - Nothing is published for a series with no entered points, so a declared
 *     series stays visibly pending rather than appearing as an empty line.
 *
 * The file ships empty. That is deliberate: an empty file is a promise not yet
 * kept, and figures typed from memory would be a promise broken.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { DataPoint, Series, Source } from "../../../lib/types";
import { ALL_SECURITY_SPECS } from "../../../lib/security-catalogue";
import { INDIA_SERIES } from "../../../lib/india-catalogue";

export interface CuratedPoint {
  period: string;
  value: number | null;
  /** Required. Which document this single figure came from. */
  sourceId: string;
  note?: string;
  revised?: boolean;
}

export interface CuratedSeriesEntry {
  seriesId: string;
  points: CuratedPoint[];
}

export interface CuratedResult {
  series: Series[];
  errors: string[];
  /** Points accepted per series, so a partial entry is visible in the log. */
  accepted: Record<string, number>;
}

const FILE = "data/security/curated.json";

/** Periods this project accepts: a calendar year or an Indian fiscal year. */
const PERIOD = /^(?:(19|20)\d{2}|FY(19|20)\d{2}-\d{2})$/;

export async function readCurated(root: string): Promise<{
  entries: CuratedSeriesEntry[];
  error?: string;
}> {
  try {
    const raw = await readFile(join(root, FILE), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { entries: [], error: `${FILE} is not an array` };
    return { entries: parsed as CuratedSeriesEntry[] };
  } catch (err) {
    // A missing file is the normal starting state, not an error.
    if (err instanceof Error && "code" in err && err.code === "ENOENT") return { entries: [] };
    return { entries: [], error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Validate entries against the catalogue and the source register.
 *
 * Returns the series it would publish plus every problem found. Nothing is
 * half-accepted: a series with one bad point is rejected whole, because a
 * silently shortened series about violence is the failure mode this whole
 * arrangement exists to avoid.
 */
export function buildCuratedSeries(
  entries: CuratedSeriesEntry[],
  sources: Source[],
): CuratedResult {
  const errors: string[] = [];
  const accepted: Record<string, number> = {};
  const series: Series[] = [];

  const specById = new Map([...ALL_SECURITY_SPECS, ...INDIA_SERIES].map((s) => [s.id, s]));
  const knownSources = new Set(sources.map((s) => s.id));
  const seen = new Set<string>();

  for (const entry of entries) {
    const spec = specById.get(entry.seriesId);
    if (!spec) {
      errors.push(`${entry.seriesId}: not declared in the security catalogue`);
      continue;
    }
    if (seen.has(entry.seriesId)) {
      errors.push(`${entry.seriesId}: declared twice in ${FILE}`);
      continue;
    }
    seen.add(entry.seriesId);

    if (!Array.isArray(entry.points) || entry.points.length === 0) {
      errors.push(`${entry.seriesId}: no points entered; leaving it pending`);
      continue;
    }

    const problems: string[] = [];
    const periods = new Set<string>();
    const points: DataPoint[] = [];

    for (const p of entry.points) {
      if (!PERIOD.test(p.period ?? "")) {
        problems.push(`period "${p.period}" is not a year or an Indian fiscal year`);
        continue;
      }
      if (periods.has(p.period)) {
        problems.push(`period ${p.period} entered twice`);
        continue;
      }
      periods.add(p.period);

      if (p.value !== null && !Number.isFinite(p.value)) {
        problems.push(`${p.period}: value is neither a number nor null`);
        continue;
      }
      if (typeof p.value === "number" && p.value < 0) {
        problems.push(`${p.period}: negative value`);
        continue;
      }
      // A figure without a document is the thing this file exists to prevent.
      if (!p.sourceId) {
        problems.push(`${p.period}: no sourceId — every hand-entered figure cites its document`);
        continue;
      }
      if (!knownSources.has(p.sourceId)) {
        problems.push(`${p.period}: sourceId "${p.sourceId}" is not in the source register`);
        continue;
      }

      points.push({
        period: p.period,
        value: p.value,
        sourceId: p.sourceId,
        ...(p.note ? { note: p.note } : {}),
        ...(p.revised ? { revised: true } : {}),
      });
    }

    if (problems.length > 0) {
      for (const pr of problems) errors.push(`${entry.seriesId}: ${pr}`);
      continue;
    }

    points.sort((a, b) => a.period.localeCompare(b.period));
    const citedSources = [...new Set(points.map((p) => p.sourceId).filter((id): id is string => Boolean(id)))];

    series.push({
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
      // The union of what the points actually cite, plus anything the
      // catalogue named. Derived from the data rather than asserted.
      sourceIds: [...new Set([...spec.sourceIds, ...citedSources])],
      points,
      notes: spec.note ? [spec.note] : [],
      lastVerified: new Date().toISOString().slice(0, 10),
    });
    accepted[spec.id] = points.length;
  }

  return { series, errors, accepted };
}

export async function runCuratedSecurity(
  opts: { root?: string; sources: Source[]; onProgress?: (msg: string) => void },
): Promise<CuratedResult> {
  const log = opts.onProgress ?? (() => {});
  const root = opts.root ?? process.cwd();

  const { entries, error } = await readCurated(root);
  if (error) {
    log(`  ${FILE} could not be read: ${error}`);
    return { series: [], errors: [`${FILE}: ${error}`], accepted: {} };
  }
  if (entries.length === 0) {
    const pending = [...ALL_SECURITY_SPECS, ...INDIA_SERIES].filter((s) => s.filledBy === "curated").length;
    log(`  ${FILE} is empty — ${pending} series stay pending`);
    return { series: [], errors: [], accepted: {} };
  }

  const result = buildCuratedSeries(entries, opts.sources);
  for (const [id, n] of Object.entries(result.accepted)) log(`  ${id.padEnd(32)} ${n} point(s)`);
  for (const e of result.errors) log(`  REJECTED ${e}`);
  return result;
}
