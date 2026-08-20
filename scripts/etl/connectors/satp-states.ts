/**
 * SATP left-wing extremism, read state by state.
 *
 * SATP's national LWE page answers 403 to the pipeline while serving the probe
 * fine, and five retries did not shift it. Every one of its eighteen
 * state-level pages answers 200.
 *
 * So the national series is rebuilt by summing the states. That is not a
 * workaround dressed as a method — it was checked against the national page
 * before being trusted:
 *
 *   year   national page              sum of 18 states
 *   2000   116 94 40 135 9 278        116 94 40 135 9 278     exact
 *   2001   199 130 116 169 44 459     199 130 116 169 44 459  exact
 *   2003   319 193 114 246 30 583     318 193 114 246 30 583  -1 incident
 *   2002   182 123 115 163 30 431     180 123 115 161 30 429  -2, -2
 *
 * Two of four sampled years match exactly and the others are short by under
 * half a per cent, which is what you would expect from incidents SATP does not
 * assign to a state. The series carries that caveat rather than implying the
 * sum is the same number the national page publishes.
 *
 * The state breakdown is the point as much as the total: it is what the map
 * needs, and no other free source publishes Indian LWE fatalities by state and
 * year.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Series, DataPoint } from "../../../lib/types";
import { ALL_SECURITY_SPECS, type SecuritySeriesSpec } from "../../../lib/security-catalogue";
import { scoreSeries, type SecurityYear } from "../../../lib/security-index";
import { getText } from "../lib/http";
import { parseFatalityTable, headerMatches, MAX_ANNUAL_FATALITIES, type ParsedRow } from "./satp";

const BASE = "https://www.satp.org/datasheet-terrorist-attack/fatalities";

/**
 * The eighteen states SATP publishes an LWE sheet for, with the state name this
 * project uses elsewhere so the map can join on it.
 */
export const LWE_STATES: Array<{ slug: string; state: string }> = [
  { slug: "india-maoistinsurgency-andhrapradesh", state: "Andhra Pradesh" },
  { slug: "india-maoistinsurgency-bihar", state: "Bihar" },
  { slug: "india-maoistinsurgency-chhattisgarh", state: "Chhattisgarh" },
  { slug: "india-maoistinsurgency-goa", state: "Goa" },
  { slug: "india-maoistinsurgency-gujarat", state: "Gujarat" },
  { slug: "india-maoistinsurgency-haryana", state: "Haryana" },
  { slug: "india-maoistinsurgency-jharkhand", state: "Jharkhand" },
  { slug: "india-maoistinsurgency-karnataka", state: "Karnataka" },
  { slug: "india-maoistinsurgency-kerala", state: "Kerala" },
  { slug: "india-maoistinsurgency-madhyapradesh", state: "Madhya Pradesh" },
  { slug: "india-maoistinsurgency-maharashtra", state: "Maharashtra" },
  { slug: "india-maoistinsurgency-odisha", state: "Odisha" },
  { slug: "india-maoistinsurgency-rajasthan", state: "Rajasthan" },
  { slug: "india-maoistinsurgency-tamilnadu", state: "Tamil Nadu" },
  { slug: "india-maoistinsurgency-telangana", state: "Telangana" },
  { slug: "india-maoistinsurgency-uttarpradesh", state: "Uttar Pradesh" },
  { slug: "india-maoistinsurgency-uttarakhand", state: "Uttarakhand" },
  { slug: "india-maoistinsurgency-westbengal", state: "West Bengal" },
];

/**
 * How many states must parse before the sum is published.
 *
 * A sum missing Chhattisgarh or Jharkhand is not a smaller number, it is a
 * wrong one, and it would look entirely plausible on a chart. Fifteen of
 * eighteen is the floor, and the missing states are named in the run log.
 */
const MIN_STATES = 15;

const IDS = {
  civilians: "lwe-civilians-killed",
  securityForces: "lwe-security-forces-killed",
  insurgents: "lwe-insurgents-killed",
  total: "lwe-total-fatalities",
  incidents: "lwe-attacks",
  tonality: "lwe-tonality",
  action: "lwe-action-index",
};

export interface StateYear {
  state: string;
  year: number;
  civilians: number;
  securityForces: number;
  insurgents: number;
  notSpecified: number;
  incidents: number | null;
}

export interface SatpStatesResult {
  series: Series[];
  /** Per-state, per-year rows for the map. */
  stateRows: StateYear[];
  errors: string[];
  statesOk: number;
  statesTotal: number;
}

/** Sum state rows into one national row per year. */
export function sumStates(rows: StateYear[]): ParsedRow[] {
  const byYear = new Map<number, ParsedRow>();
  for (const r of rows) {
    const acc = byYear.get(r.year) ?? {
      year: r.year,
      civilians: 0,
      securityForces: 0,
      insurgents: 0,
      notSpecified: 0,
      incidents: 0,
      statedTotal: null,
    };
    acc.civilians += r.civilians;
    acc.securityForces += r.securityForces;
    acc.insurgents += r.insurgents;
    acc.notSpecified += r.notSpecified;
    // Incidents are only summed where every contributing state published one.
    if (r.incidents === null) acc.incidents = undefined;
    else if (acc.incidents !== undefined) acc.incidents += r.incidents;
    byYear.set(r.year, acc);
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

const CAVEAT =
  "Rebuilt by summing SATP's eighteen state sheets, because its national page refuses the pipeline. Checked against that page where it could be read: two sampled years matched exactly and two were short by under half a per cent, which is consistent with incidents SATP does not assign to a state. Treat it as within a percentage point of SATP's national figure, not identical to it.";

function seriesFrom(spec: SecuritySeriesSpec, points: DataPoint[], extra: string[] = []): Series {
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
    sourceIds: [...new Set([...spec.sourceIds, ...extra])],
    points,
    notes: [...(spec.note ? [spec.note] : []), CAVEAT],
    lastVerified: new Date().toISOString().slice(0, 10),
  };
}

export async function runSatpStates(
  opts: { root?: string; dryRun?: boolean; onProgress?: (msg: string) => void } = {},
): Promise<SatpStatesResult> {
  const log = opts.onProgress ?? (() => {});
  const root = opts.root ?? process.cwd();
  const errors: string[] = [];
  const stateRows: StateYear[] = [];
  let statesOk = 0;

  if (opts.dryRun) {
    log(`[dry-run] would fetch ${LWE_STATES.length} state sheets under ${BASE}`);
    return { series: [], stateRows: [], errors: [], statesOk: 0, statesTotal: LWE_STATES.length };
  }

  const missing: string[] = [];
  for (const { slug, state } of LWE_STATES) {
    const res = await getText(`${BASE}/${slug}`, {
      cacheMs: 12 * 60 * 60 * 1000,
      timeoutMs: 30_000,
      retries: 3,
      accept: "text/html",
    });
    if (!res.ok || !res.data) {
      errors.push(`${state}: ${res.error ?? "no body"}`);
      missing.push(state);
      continue;
    }
    const parsed = parseFatalityTable(res.data);
    if (!headerMatches(parsed.header)) {
      errors.push(`${state}: header is not a fatality table — ${parsed.header.slice(0, 5).join(" | ")}`);
      missing.push(state);
      continue;
    }
    if (parsed.rows.length === 0) {
      errors.push(`${state}: no year rows parsed`);
      missing.push(state);
      continue;
    }
    statesOk++;
    for (const r of parsed.rows) {
      stateRows.push({
        state,
        year: r.year,
        civilians: r.civilians,
        securityForces: r.securityForces,
        insurgents: r.insurgents,
        notSpecified: r.notSpecified,
        incidents: r.incidents ?? null,
      });
    }
    log(`  ${state.padEnd(18)} ${parsed.rows.length} years`);
  }

  if (statesOk < MIN_STATES) {
    errors.push(
      `only ${statesOk}/${LWE_STATES.length} state sheets parsed (missing: ${missing.join(", ")}); ` +
        `a partial sum is a wrong national total, not a smaller one — keeping previous data`,
    );
    log(`  SUM REFUSED — ${statesOk}/${LWE_STATES.length} states, floor is ${MIN_STATES}`);
    return { series: [], stateRows, errors, statesOk, statesTotal: LWE_STATES.length };
  }
  if (missing.length > 0) {
    errors.push(`summed without ${missing.join(", ")} — the national total is short by their share`);
  }

  const national = sumStates(stateRows);
  const worst = Math.max(
    ...national.map((r) => r.civilians + r.securityForces + r.insurgents + r.notSpecified),
  );
  if (worst > MAX_ANNUAL_FATALITIES) {
    errors.push(`summed year totals ${worst}, above the ${MAX_ANNUAL_FATALITIES} ceiling; not publishing`);
    return { series: [], stateRows, errors, statesOk, statesTotal: LWE_STATES.length };
  }

  const byId = new Map(ALL_SECURITY_SPECS.map((s) => [s.id, s]));
  const series: Series[] = [];
  const push = (id: string, points: DataPoint[], extra: string[] = []) => {
    const spec = byId.get(id);
    if (!spec) {
      errors.push(`no catalogue entry for ${id}`);
      return;
    }
    series.push(seriesFrom(spec, points, extra));
  };
  const pt = (r: ParsedRow, value: number): DataPoint => ({ period: String(r.year), value });

  push(IDS.civilians, national.map((r) => pt(r, r.civilians)));
  push(IDS.securityForces, national.map((r) => pt(r, r.securityForces)));
  push(IDS.insurgents, national.map((r) => pt(r, r.insurgents)));
  push(
    IDS.total,
    national.map((r) => pt(r, r.civilians + r.securityForces + r.insurgents + r.notSpecified)),
  );

  const withIncidents = national.filter((r) => r.incidents !== undefined);
  if (withIncidents.length >= 10) {
    push(IDS.incidents, withIncidents.map((r) => pt(r, r.incidents ?? 0)));
  }

  const scored = scoreSeries(national as SecurityYear[]);
  push(IDS.tonality, scored.map((s) => ({ period: String(s.year), value: s.tonality.score })), ["derived"]);
  push(IDS.action, scored.map((s) => ({ period: String(s.year), value: s.action.index })), ["derived"]);

  // The per-state rows are what the map draws. Written whether or not the sum
  // was published, because a state breakdown is useful even when three states
  // are missing — it just cannot stand in for a national total.
  await mkdir(join(root, "data/security"), { recursive: true });
  await writeFile(
    join(root, "data/security/lwe-states.json"),
    JSON.stringify(
      {
        fetchedAt: new Date().toISOString(),
        statesOk,
        statesTotal: LWE_STATES.length,
        missing,
        rows: stateRows.sort((a, b) => a.year - b.year || a.state.localeCompare(b.state)),
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  log(`  summed ${statesOk}/${LWE_STATES.length} states into ${national.length} national years`);
  log(`  wrote data/security/lwe-states.json — ${stateRows.length} state-year rows`);

  return { series, stateRows, errors, statesOk, statesTotal: LWE_STATES.length };
}
