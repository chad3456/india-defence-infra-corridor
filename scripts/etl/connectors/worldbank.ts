/**
 * World Bank WDI connector.
 *
 * Free, keyless, versioned. Pulls the full 2001-present run for every indicator
 * in the catalogue, for India plus the fixed peer set, and emits typed Series
 * with the latest peer values attached for cross-country charts.
 *
 * The World Bank revises history, so this connector always rewrites the whole
 * series rather than appending — appending would freeze stale revisions in.
 */
import type { Series, DataPoint, PeerValue } from "../../../lib/types";
import { WDI_INDICATORS, PEERS, WDI_START_YEAR } from "../../../lib/wdi-catalogue";
import { getJson } from "../lib/http";

const BASE = "https://api.worldbank.org/v2";
const COUNTRIES = ["IND", ...PEERS.map((p) => p.iso3)].join(";");

/** World Bank returns [metadata, rows] — rows are null when the query is empty. */
type WbResponse = [
  { page: number; pages: number; total: number } | { message?: unknown[] },
  Array<{
    countryiso3code: string;
    date: string;
    value: number | null;
    indicator: { id: string; value: string };
  }> | null,
];

export interface ConnectorResult {
  series: Series[];
  errors: string[];
  fetched: number;
  /** True when the run budget stopped the loop before the catalogue ended. */
  stoppedEarly?: boolean;
}

export async function runWorldBank(
  opts: { dryRun?: boolean; onProgress?: (msg: string) => void } = {},
): Promise<ConnectorResult> {
  const out: Series[] = [];
  const errors: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const endYear = new Date().getFullYear();
  let fetched = 0;

  // A wall-clock ceiling, because the catalogue grew from a hundred indicators
  // to six hundred and forty and this connector makes one request each. A run
  // killed mid-loop by the workflow timeout takes the whole job's later steps
  // with it; a run that stops on its own hands back what it fetched, and the
  // write path carries the rest forward from what is already stored.
  const startedAt = Date.now();
  const BUDGET_MS = 13 * 60_000;
  let stoppedEarly = false;

  for (const ind of WDI_INDICATORS) {
    if (!opts.dryRun && Date.now() - startedAt > BUDGET_MS) {
      stoppedEarly = true;
      errors.push(
        `stopped after ${fetched} of ${WDI_INDICATORS.length} indicators — run budget spent; the rest keep their stored values`,
      );
      opts.onProgress?.(`  BUDGET SPENT — ${fetched}/${WDI_INDICATORS.length} fetched this run`);
      break;
    }
    const url =
      `${BASE}/country/${COUNTRIES}/indicator/${ind.code}` +
      `?format=json&per_page=20000&date=${WDI_START_YEAR}:${endYear}`;

    if (opts.dryRun) {
      opts.onProgress?.(`[dry-run] would fetch ${ind.code} (${ind.id})`);
      continue;
    }

    let res = await getJson<WbResponse>(url);

    // A handful of indicators return HTTP 400 for the full multi-country,
    // date-bounded query while answering the unbounded one fine. Retry once
    // without the date filter and trim the range here instead of dropping the
    // indicator — three indicators were lost this way on the first live run.
    if (!res.ok) {
      const fallback =
        `${BASE}/country/${COUNTRIES}/indicator/${ind.code}?format=json&per_page=20000`;
      const retry = await getJson<WbResponse>(fallback, { cacheMs: 0 });
      if (retry.ok) {
        opts.onProgress?.(`  ${ind.code.padEnd(22)} recovered via unbounded query`);
        res = retry;
      }
    }

    if (!res.ok || !res.data) {
      errors.push(`${ind.code}: ${res.error ?? "no data"}`);
      continue;
    }

    const all = Array.isArray(res.data) ? res.data[1] : null;
    // The fallback returns the full history, so bound the range here.
    const rows = all?.filter((r) => {
      const y = Number(r.date);
      return Number.isFinite(y) && y >= WDI_START_YEAR && y <= endYear;
    });
    if (!rows || rows.length === 0) {
      errors.push(`${ind.code}: empty result set`);
      continue;
    }
    fetched++;

    // India time series.
    const indiaRows = rows
      .filter((r) => r.countryiso3code === "IND" && r.value !== null)
      .sort((a, b) => Number(a.date) - Number(b.date));

    const points: DataPoint[] = indiaRows.map((r) => ({
      period: r.date,
      value: r.value,
    }));

    if (points.length === 0) {
      errors.push(`${ind.code}: no Indian observations`);
      continue;
    }

    // Latest available value per peer — not necessarily the same year, so the
    // period travels with each peer value and is rendered on the chart.
    const peers: PeerValue[] = [];
    for (const iso3 of ["IND", ...PEERS.map((p) => p.iso3)]) {
      const latest = rows
        .filter((r) => r.countryiso3code === iso3 && r.value !== null)
        .sort((a, b) => Number(b.date) - Number(a.date))[0];
      if (!latest || latest.value === null) continue;
      peers.push({
        country: iso3 === "IND" ? "India" : (PEERS.find((p) => p.iso3 === iso3)?.name ?? iso3),
        iso3,
        value: latest.value,
        period: latest.date,
        sourceId: "worldbank-wdi",
      });
    }

    const notes: string[] = [
      `World Bank indicator ${ind.code}. History is restated by the World Bank as national accounts are revised; this series is rewritten in full on every pipeline run rather than appended to.`,
    ];
    if (ind.note) notes.unshift(ind.note);

    // The World Bank redistributes SIPRI's military expenditure data rather
    // than compiling it. Attribute the originator, and drop confidence to
    // match: these are estimates, not national accounts.
    const isMilex = ind.code.startsWith("MS.MIL.");
    const sourceIds = isMilex ? ["worldbank-wdi", "sipri-milex"] : ["worldbank-wdi"];
    if (isMilex) {
      notes.push(
        "Compiled by SIPRI and redistributed by the World Bank. SIPRI estimates spending on a consistent cross-country definition that does not match India's own budget headings, so this will not tie to the Ministry of Defence allocation series.",
      );
    }
    if (peers.length > 1) {
      const periods = [...new Set(peers.map((p) => p.period))];
      if (periods.length > 1) {
        notes.push(
          `Peer comparison uses each country's latest available year (${periods.sort().join(", ")}), which are not all the same.`,
        );
      }
    }

    out.push({
      id: ind.id,
      title: ind.title,
      definition: ind.definition,
      category: ind.category,
      unit: ind.unit,
      unitShort: ind.unitShort,
      frequency: "annual",
      higherIsBetter: ind.higherIsBetter,
      points,
      sourceIds,
      provenance: "multilateral",
      confidence: "high",
      lastVerified: today,
      notes,
      peers: peers.length > 1 ? peers : undefined,
    });

    opts.onProgress?.(`  ${ind.code.padEnd(22)} ${points.length} points, ${peers.length} peers`);
  }

  return { series: out, errors, fetched, stoppedEarly };
}
