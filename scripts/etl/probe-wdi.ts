/**
 * World Bank indicator discovery.
 *
 * `npm run wdi:probe`. Lists every indicator the World Bank publishes under the
 * topics this site covers, checks which of them actually carry Indian data
 * since 2001, and writes a report. Publishes no series.
 *
 * ── Why discovery rather than a longer hand-written list ─────────────────
 *
 * Expanding the catalogue by typing indicator codes from memory would be the
 * same mistake this project has made before, in a new costume. A wrong code
 * fails loudly, which is survivable; a *plausible* code for a slightly
 * different measure does not, and the site would carry a chart whose title and
 * contents disagree. The API knows every code, its official name, its unit and
 * its source note. Reading them is strictly better than recalling them.
 *
 * The coverage check is the other half. The World Bank lists thousands of
 * indicators and a large share have no Indian observations at all, or three
 * scattered years from a discontinued survey. An indicator that cannot draw a
 * line is not a metric, it is an empty chart with a citation, and this site
 * already has more of those than it wants.
 *
 * Runs in Actions like every other probe, and commits what it saw.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getJson } from "./lib/http";
import { WDI_INDICATORS } from "../../lib/wdi-catalogue";

const ROOT = process.cwd();
const BASE = "https://api.worldbank.org/v2";

/**
 * World Bank topics worth mining, with the site category each maps to.
 *
 * Topic ids are the API's own. The mapping is a judgement — "Private Sector"
 * carries both business-environment and infrastructure indicators — so it is a
 * starting suggestion the report records rather than a decision it makes.
 */
const TOPICS: Array<{ id: number; name: string; suggest: string }> = [
  { id: 1, name: "Agriculture & Rural Development", suggest: "social" },
  { id: 2, name: "Aid Effectiveness", suggest: "economy" },
  { id: 3, name: "Economy & Growth", suggest: "economy" },
  { id: 4, name: "Education", suggest: "social" },
  { id: 5, name: "Energy & Mining", suggest: "energy" },
  { id: 6, name: "Environment", suggest: "energy" },
  { id: 7, name: "Financial Sector", suggest: "economy" },
  { id: 8, name: "Health", suggest: "quality-of-life" },
  { id: 9, name: "Infrastructure", suggest: "infrastructure" },
  { id: 10, name: "Social Protection & Labor", suggest: "social" },
  { id: 11, name: "Poverty", suggest: "quality-of-life" },
  { id: 12, name: "Private Sector", suggest: "manufacturing" },
  { id: 13, name: "Public Sector", suggest: "economy" },
  { id: 14, name: "Science & Technology", suggest: "ai-science" },
  { id: 15, name: "Social Development", suggest: "social" },
  { id: 16, name: "Urban Development", suggest: "real-estate" },
  { id: 17, name: "Gender", suggest: "social" },
  { id: 18, name: "Millenium development goals", suggest: "social" },
  { id: 19, name: "Climate Change", suggest: "energy" },
  { id: 20, name: "External Debt", suggest: "economy" },
  { id: 21, name: "Trade", suggest: "trade" },
];

/** An indicator needs this many Indian observations since 2001 to be worth a chart. */
const MIN_POINTS = 8;
const START_YEAR = 2001;
/** Indicators checked per topic. The API orders them, and the tail is thin. */
const PER_TOPIC = 220;
/** Wall-clock ceiling, so a long run still commits what it found. */
const RUN_BUDGET_MS = 12 * 60_000;

interface Candidate {
  code: string;
  name: string;
  unit: string;
  topic: string;
  suggest: string;
  /** First 240 characters of the World Bank's own definition. */
  sourceNote: string;
  /** Indian observations since 2001. */
  points: number;
  firstYear: number | null;
  latestYear: number | null;
  /** True when this code is already in the site catalogue. */
  known: boolean;
}

type IndicatorRow = {
  id: string;
  name: string;
  unit: string;
  sourceNote: string;
  topics?: Array<{ id: string; value: string }>;
};

type PointRow = { date: string; value: number | null };

async function listTopic(topicId: number): Promise<IndicatorRow[]> {
  const url = `${BASE}/topic/${topicId}/indicator?format=json&per_page=${PER_TOPIC}`;
  const res = await getJson<[unknown, IndicatorRow[] | null]>(url);
  if (!res.ok || !res.data?.[1]) return [];
  return res.data[1];
}

/** How much Indian data an indicator actually has. One request per code. */
async function coverage(code: string): Promise<{ points: number; first: number | null; latest: number | null }> {
  const url =
    `${BASE}/country/IND/indicator/${encodeURIComponent(code)}` +
    `?format=json&per_page=200&date=${START_YEAR}:${new Date().getFullYear()}`;
  const res = await getJson<[unknown, PointRow[] | null]>(url);
  const rows = res.ok ? (res.data?.[1] ?? []) : [];
  const years = rows
    .filter((r) => r.value !== null)
    .map((r) => Number(r.date))
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => a - b);
  return {
    points: years.length,
    first: years[0] ?? null,
    latest: years[years.length - 1] ?? null,
  };
}

async function main() {
  const log = (m: string) => process.stdout.write(`${m}\n`);
  const startedAt = Date.now();
  const known = new Set(WDI_INDICATORS.map((i) => i.code));
  log(`Discovering World Bank indicators across ${TOPICS.length} topics — publishes nothing\n`);

  await mkdir(join(ROOT, "data/live"), { recursive: true });
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  let checked = 0;
  let cutShort = false;

  const save = async () =>
    writeFile(
      join(ROOT, "data/live/wdi-probe.json"),
      JSON.stringify(
        {
          probedAt: new Date().toISOString(),
          cutShort,
          checked,
          minPoints: MIN_POINTS,
          startYear: START_YEAR,
          candidates: [...candidates].sort((a, b) => b.points - a.points),
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );

  for (const topic of TOPICS) {
    if (Date.now() - startedAt > RUN_BUDGET_MS) {
      cutShort = true;
      log(`\nbudget spent — stopping before topic ${topic.name}`);
      break;
    }
    const list = await listTopic(topic.id);
    log(`${topic.name.padEnd(34)} ${String(list.length).padStart(4)} indicator(s) listed`);

    let kept = 0;
    for (const ind of list) {
      if (Date.now() - startedAt > RUN_BUDGET_MS) {
        cutShort = true;
        break;
      }
      if (!ind.id || seen.has(ind.id)) continue;
      seen.add(ind.id);
      // Aggregates, archived series and per-country modelled estimates are
      // listed alongside the real ones; the coverage check filters them out
      // more reliably than a name pattern would.
      checked++;
      const cov = await coverage(ind.id);
      if (cov.points < MIN_POINTS) continue;
      kept++;
      candidates.push({
        code: ind.id,
        name: (ind.name ?? "").replace(/\s+/g, " ").trim(),
        unit: (ind.unit ?? "").trim(),
        topic: topic.name,
        suggest: topic.suggest,
        sourceNote: (ind.sourceNote ?? "").replace(/\s+/g, " ").trim().slice(0, 240),
        points: cov.points,
        firstYear: cov.first,
        latestYear: cov.latest,
        known: known.has(ind.id),
      });
    }
    log(`${" ".repeat(34)} ${String(kept).padStart(4)} with >= ${MIN_POINTS} Indian points since ${START_YEAR}`);
    await save();
  }

  await save();
  const fresh = candidates.filter((c) => !c.known);
  log("");
  log(`${checked} indicator(s) checked · ${candidates.length} usable · ${fresh.length} not already in the catalogue`);
  if (cutShort) log("RUN CUT SHORT — the report holds what was checked before the budget ran out.");
  log("Wrote data/live/wdi-probe.json");
}

main().catch((err: unknown) => {
  process.stderr.write(`wdi probe crashed: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
