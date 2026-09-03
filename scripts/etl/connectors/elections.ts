/**
 * Statewise turnout in the last three general elections.
 *
 * The probe settled where this comes from. The Election Commission's own site
 * answers a fetch with a 1.2 KB JavaScript shell, and Lok Dhaba — the Trivedi
 * Centre compilation that would have been the better source — answers with 486
 * bytes of the same. Wikipedia's per-election articles carry the ECI numbers in
 * a table this project can already parse, so that is the door that is open.
 *
 * The table is the same shape in 2014, 2019 and 2024:
 *
 *   State/UT | Total electors | Total voters | Total turnout | Total seats
 *
 * ── Why the parse checks itself ──────────────────────────────────────────
 *
 * Columns are found by name, never by position, because these three articles
 * are edited independently and 2014 capitalises its headers differently from
 * the other two. But naming the column is not proof of reading it: the real
 * check is that voters divided by electors reproduces the turnout the table
 * states. A row that misses by more than a fifth of a point is a row where two
 * columns were swapped or a footnote was read as a digit, and it is dropped
 * with its reason recorded rather than published.
 *
 * That check is the whole reason to prefer this table over the phase-wise one
 * beside it, which has no internal arithmetic to test against.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "../lib/http";
import { parseTables, columnIndex, plain } from "../lib/wikitext";
import { STATE_FACTS } from "../../../lib/census-shared";

const ROOT = process.cwd();
const OUT = join(ROOT, "data/elections/statewise.json");
const WIKI = "https://en.wikipedia.org/w/index.php?action=raw&title=";

const ELECTIONS = [
  { year: 2014, page: "2014 Indian general election" },
  { year: 2019, page: "2019 Indian general election" },
  { year: 2024, page: "2024 Indian general election" },
] as const;

/** Total Lok Sabha seats — the sum every election's seat column must reach. */
const LOK_SABHA_SEATS = 543;
/** How far voters/electors may sit from the stated turnout before a row is rejected. */
const TURNOUT_TOLERANCE_PP = 0.2;

/**
 * Wikipedia writes state names the way the ECI does; the boundary file does
 * not. Only the differences are listed — anything already matching a
 * STATE_FACTS key resolves without help.
 *
 * Jammu and Kashmir is mapped to the boundary file's undivided unit on
 * purpose. Ladakh became a separate UT in 2019 and votes separately from 2024,
 * but the map this joins to has no Ladakh polygon, so its row is folded back
 * in and the fold is recorded rather than hidden.
 */
const ALIASES: Record<string, string> = {
  "delhi": "NCT of Delhi",
  "nct of delhi": "NCT of Delhi",
  "national capital territory of delhi": "NCT of Delhi",
  "jammu and kashmir": "Jammu & Kashmir",
  "ladakh": "Jammu & Kashmir",
  "arunachal pradesh": "Arunanchal Pradesh",
  "andaman and nicobar islands": "Andaman & Nicobar Island",
  "andaman & nicobar islands": "Andaman & Nicobar Island",
  "dadra and nagar haveli": "Dadara & Nagar Havelli",
  "dadra and nagar haveli and daman and diu": "Dadara & Nagar Havelli",
  "daman and diu": "Daman & Diu",
  "orissa": "Odisha",
  "pondicherry": "Puducherry",
  "uttaranchal": "Uttarakhand",
  "chhatisgarh": "Chhattisgarh",
};

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z& ]+/g, " ").replace(/\s+/g, " ").trim();

const BY_NORM = new Map(Object.keys(STATE_FACTS).map((k) => [norm(k), k]));

/** Boundary-file name, or null. A name that does not resolve is named, never guessed. */
function resolveState(raw: string): string | null {
  const n = norm(raw);
  if (n === "" || n === "total" || n.startsWith("total ")) return null;
  return BY_NORM.get(n) ?? ALIASES[n] ?? null;
}

/** Digits out of a wikitext cell, ignoring footnotes and separators. */
function num(cell: string): number | null {
  const t = plain(cell).replace(/\[[^\]]*\]/g, "").replace(/,/g, "");
  const m = t.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const v = Number(m[0]);
  return Number.isFinite(v) ? v : null;
}

export interface StateRow {
  state: string;
  electors: number;
  voters: number;
  /** As printed by the source, after being checked against voters/electors. */
  turnoutPct: number;
  seats: number;
  /** Set when more than one source row was folded into this state. */
  merged?: string[];
}

export interface ElectionYear {
  year: number;
  page: string;
  rows: StateRow[];
  seatsTotal: number;
  /** Rows the parse refused, and why. Published so the gaps are visible. */
  rejected: Array<{ label: string; reason: string }>;
}

export async function run(opts: { onProgress?: (s: string) => void } = {}): Promise<{ errors: string[] }> {
  const log = opts.onProgress ?? (() => {});
  const errors: string[] = [];
  await mkdir(join(ROOT, "data/elections"), { recursive: true });

  let years: ElectionYear[] = [];
  try {
    const prev = JSON.parse(await readFile(OUT, "utf8")) as { years?: ElectionYear[] };
    years = prev.years ?? [];
  } catch { /* first run */ }

  for (const e of ELECTIONS) {
    const res = await getText(WIKI + encodeURIComponent(e.page), {
      timeoutMs: 45_000, retries: 2, cacheMs: 0,
    });
    if (!res.ok || res.data === null) {
      errors.push(`elections: ${e.year}: ${res.error ?? "no body"}`);
      log(`  FAIL ${e.year}: ${res.error}`);
      continue;
    }

    // The wanted table is the one naming all four columns. The phase-wise
    // turnout table beside it also names a state and a turnout, but carries no
    // electors or voters and so cannot be checked against itself.
    const table = parseTables(res.data).find((t) =>
      columnIndex(t.headers, /^state\s*\/?\s*(ut|union)/i) >= 0 &&
      columnIndex(t.headers, /total\s+electors/i) >= 0 &&
      columnIndex(t.headers, /total\s+voters/i) >= 0 &&
      columnIndex(t.headers, /total\s+turnout/i) >= 0);

    if (!table) {
      errors.push(`elections: ${e.year}: no table naming state, electors, voters and turnout`);
      log(`  FAIL ${e.year}: table not found`);
      continue;
    }

    const cState = columnIndex(table.headers, /^state\s*\/?\s*(ut|union)/i);
    const cElectors = columnIndex(table.headers, /total\s+electors/i);
    const cVoters = columnIndex(table.headers, /total\s+voters/i);
    const cTurnout = columnIndex(table.headers, /total\s+turnout/i);
    const cSeats = columnIndex(table.headers, /total\s+seats/i);

    const byState = new Map<string, StateRow>();
    const rejected: Array<{ label: string; reason: string }> = [];

    for (const row of table.rows) {
      const label = plain(row[cState] ?? "").trim();
      if (label === "") continue;
      const state = resolveState(label);
      if (state === null) { rejected.push({ label, reason: "state name not on the map" }); continue; }

      const electors = num(row[cElectors] ?? "");
      const voters = num(row[cVoters] ?? "");
      const turnoutPct = num(row[cTurnout] ?? "");
      const seats = cSeats >= 0 ? num(row[cSeats] ?? "") : null;
      if (electors === null || voters === null || turnoutPct === null) {
        rejected.push({ label, reason: "a column was not a number" });
        continue;
      }

      // The check that makes the parse trustworthy.
      const implied = (voters / electors) * 100;
      if (!Number.isFinite(implied) || Math.abs(implied - turnoutPct) > TURNOUT_TOLERANCE_PP) {
        rejected.push({
          label,
          reason: `turnout says ${turnoutPct}% but voters/electors gives ${implied.toFixed(2)}%`,
        });
        continue;
      }

      const existing = byState.get(state);
      if (existing) {
        // Ladakh folded into the undivided J&K polygon, and the like. Summing
        // electors and voters keeps the ratio honest; the stated turnout is
        // recomputed rather than averaged, which would weight a small UT the
        // same as a large state.
        existing.electors += electors;
        existing.voters += voters;
        existing.seats += seats ?? 0;
        existing.turnoutPct = Number(((existing.voters / existing.electors) * 100).toFixed(2));
        existing.merged = [...(existing.merged ?? [existing.state]), label];
      } else {
        byState.set(state, { state, electors, voters, turnoutPct, seats: seats ?? 0 });
      }
    }

    const rows = [...byState.values()].sort((a, b) => b.electors - a.electors);
    const seatsTotal = rows.reduce((s, r) => s + r.seats, 0);
    years = years.filter((y) => y.year !== e.year);
    years.push({ year: e.year, page: e.page, rows, seatsTotal, rejected });
    years.sort((a, b) => a.year - b.year);

    if (seatsTotal !== LOK_SABHA_SEATS) {
      // Not fatal — a rejected row takes its seats with it — but it says the
      // coverage is short, and by how much.
      log(`  NOTE ${e.year}: seats sum to ${seatsTotal}, not ${LOK_SABHA_SEATS}`);
    }
    log(`  ${e.year}: ${rows.length} states, ${seatsTotal}/${LOK_SABHA_SEATS} seats, ${rejected.length} row(s) refused`);
    for (const r of rejected) log(`      refused ${r.label}: ${r.reason}`);

    // Written after every election: a job killed part-way keeps what it has.
    await writeFile(OUT, JSON.stringify({ builtAt: new Date().toISOString(), years }, null, 2) + "\n", "utf8");
    await new Promise((r) => setTimeout(r, 800));
  }

  return { errors };
}

if (process.argv[1]?.includes("elections")) {
  run({ onProgress: (s) => console.log(s) }).then((r) => {
    for (const e of r.errors) console.error("ERROR " + e);
    console.log(`\nwrote ${OUT}`);
  });
}
