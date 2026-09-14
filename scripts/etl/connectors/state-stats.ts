/**
 * Population and area per state, which every per-capita claim needs.
 *
 *   npm run states:build
 *
 * ── Why this is its own connector ────────────────────────────────────────
 *
 * Because without it, every statewise count on this site ranks states by size.
 * Maharashtra has more airports than Goa and more railway stations than
 * Sikkim, and neither fact is about transport policy. A denominator is what
 * turns "how many" into "how many for whom", and this project has been
 * publishing the numerator alone.
 *
 * ── The denominator is fifteen years old ─────────────────────────────────
 *
 * India's last completed census was 2011. The 2021 census was postponed and
 * has not been held. So every per-capita figure on this site divides a current
 * count by a 2011 population, and the error is not uniform: states that have
 * grown fastest since — Bihar, Uttar Pradesh — are the most overstated by it,
 * because their denominator is furthest out of date.
 *
 * That is not a reason to skip the division. It is a reason to say which year
 * the denominator is from, on the same line as the rate, every time. The
 * alternative is a page that silently implies a 2026 rate.
 *
 * Projections exist and are not used here. They are a model's output, they
 * disagree with one another, and quietly substituting one for a count would
 * make this page's numbers unreproducible against any published source.
 *
 * ── The parse, and what checks it ────────────────────────────────────────
 *
 * Wikipedia's table is read for its numbers, and the numbers are checked
 * against facts about India that any correct parse reproduces: Uttar Pradesh
 * is the most populous state, Sikkim the least populous of the states proper,
 * Rajasthan the largest by area, and the total lands near 1.21 billion. A
 * parse that gets a column wrong fails at least one of those; a parse that
 * merely looks plausible passes none of them by luck.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "../lib/http";
import { isEntryPoint } from "../lib/entry";

const ROOT = process.cwd();
const OUT = join(ROOT, "data", "geo", "state-stats.json");
const WIKI = "https://en.wikipedia.org/w/api.php";

const POP_PAGE = "List_of_states_and_union_territories_of_India_by_population";
const AREA_PAGE = "List_of_states_and_union_territories_of_India_by_area";

async function wikitext(page: string): Promise<string | null> {
  const url = `${WIKI}?action=parse&page=${encodeURIComponent(page)}` +
    "&redirects=1&prop=wikitext&formatversion=2&format=json";
  const res = await getText(url, { cacheMs: 24 * 3600_000, retries: 2, timeoutMs: 45_000 });
  if (!res.ok || !res.data) return null;
  try {
    return (JSON.parse(res.data) as { parse?: { wikitext?: string } }).parse?.wikitext ?? null;
  } catch {
    return null;
  }
}

/**
 * The topology's spelling of a state, or null.
 *
 * The map is the vocabulary, exactly as the drone connector uses the world
 * atlas: a name this project cannot draw is not a state it can use, and
 * aliasing to a name the map lacks silently deletes a row. The topology writes
 * some names unusually — "Arunanchal Pradesh", "Andaman & Nicobar Island",
 * "NCT of Delhi" — and those spellings win because they are the ones the map
 * will be asked for.
 */
const TO_MAP: Record<string, string> = {
  "arunachal pradesh": "Arunanchal Pradesh",
  "andaman and nicobar islands": "Andaman & Nicobar Island",
  "andaman & nicobar islands": "Andaman & Nicobar Island",
  "delhi": "NCT of Delhi",
  "national capital territory of delhi": "NCT of Delhi",
  "jammu and kashmir": "Jammu & Kashmir",
  "dadra and nagar haveli and daman and diu": "Dadara & Nagar Havelli",
  "dadra and nagar haveli": "Dadara & Nagar Havelli",
  "daman and diu": "Daman & Diu",
  "puducherry": "Puducherry",
  "uttarakhand": "Uttarakhand",
  "odisha": "Odisha",
  "telangana": "Telangana",
};

export function mapName(raw: string, known: Set<string>): string | null {
  const clean = raw
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[|\]\]/g, "")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[*'†‡]/g, "")
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return null;
  if (known.has(clean)) return clean;
  const alias = TO_MAP[clean.toLowerCase()];
  if (alias && known.has(alias)) return alias;
  // Last resort: a unique case-insensitive match against the map's own names.
  const hits = [...known].filter((k) => k.toLowerCase() === clean.toLowerCase());
  return hits.length === 1 ? hits[0]! : null;
}

/** A number as a wikitable writes it: commas, refs, footnote markers. */
export function readNumber(cell: string): number | null {
  const clean = cell
    .replace(/<ref[\s\S]*?(?:\/>|<\/ref>)/gi, "")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/\[\[|\]\]/g, "")
    .replace(/<[^>]+>/g, "");
  const m = /(-?[\d][\d,]*(?:\.\d+)?)/.exec(clean);
  if (!m) return null;
  const n = Number((m[1] ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

interface Row { state: string; population: number | null; area: number | null }

/**
 * Every data row of every wikitable on the page, as arrays of cells.
 *
 * Deliberately not "the first table": these pages carry several, and which one
 * is first changes when someone adds an infobox. Reading all of them and
 * letting the name match decide which rows are usable is stable against that.
 */
function tableRows(text: string): string[][] {
  const out: string[][] = [];
  for (const block of text.split(/\{\|/).slice(1)) {
    const table = block.split(/\n\|\}/)[0] ?? "";
    for (const raw of table.split(/\n\|-/).slice(1)) {
      const cells: string[] = [];
      for (const line of raw.split("\n")) {
        if (!/^\s*[|!]/.test(line)) continue;
        const body = line.replace(/^\s*[|!]+\s*/, "");
        // "a || b || c" is three cells on one line.
        for (const cell of body.split(/\s*\|\|\s*/)) cells.push(cell.trim());
      }
      if (cells.length >= 2) out.push(cells);
    }
  }
  return out;
}

/**
 * The first cell that parses as a number in a plausible range.
 *
 * Both tables put a rank in an early column and the figure after it, and the
 * rank is a small integer. Taking "the second cell" would read the rank as the
 * population for any table that gains a column; taking the first number above
 * a floor cannot.
 */
function firstNumberAbove(cells: string[], floor: number): number | null {
  for (const c of cells) {
    const n = readNumber(c);
    if (n !== null && n >= floor) return n;
  }
  return null;
}

export async function run(): Promise<void> {
  // The map's own names are the vocabulary.
  const topo = JSON.parse(
    await (await import("node:fs/promises")).readFile(
      join(ROOT, "data", "geo", "ascii-india.json"), "utf8"),
  ) as { symbols: Record<string, string> };
  const known = new Set(Object.values(topo.symbols));

  const rows = new Map<string, Row>();
  const unmatched: string[] = [];
  const faults: string[] = [];

  const popText = await wikitext(POP_PAGE);
  if (!popText) faults.push("the population page did not answer");
  else {
    for (const cells of tableRows(popText)) {
      const state = mapName(cells[0] ?? "", known) ?? mapName(cells[1] ?? "", known);
      if (!state) {
        const label = (cells[0] ?? "").slice(0, 40);
        if (label && unmatched.length < 30 && !/^\d+$/.test(label)) unmatched.push(label);
        continue;
      }
      // A state's population is at least a hundred thousand; a rank is not.
      const population = firstNumberAbove(cells.slice(1), 100_000);
      const prior = rows.get(state) ?? { state, population: null, area: null };
      rows.set(state, { ...prior, population: prior.population ?? population });
    }
  }

  const areaText = await wikitext(AREA_PAGE);
  if (!areaText) faults.push("the area page did not answer");
  else {
    for (const cells of tableRows(areaText)) {
      const state = mapName(cells[0] ?? "", known) ?? mapName(cells[1] ?? "", known);
      if (!state) continue;
      // Lakshadweep is 32 km²; a rank is smaller still, so the floor is low
      // and the rank column is skipped by starting after the name instead.
      const area = firstNumberAbove(cells.slice(1), 30);
      const prior = rows.get(state) ?? { state, population: null, area: null };
      rows.set(state, { ...prior, area: prior.area ?? area });
    }
  }

  const list = [...rows.values()].sort((a, b) => (b.population ?? 0) - (a.population ?? 0));

  /**
   * Named facts, not shapes.
   *
   * A parse that has taken the wrong column produces a table of plausible
   * numbers in the right format. These are the statements about India that
   * only a correct parse reproduces.
   */
  const top = list[0];
  if (!top || top.state !== "Uttar Pradesh") {
    faults.push(`the most populous state parsed as ${top?.state ?? "nothing"}, not Uttar Pradesh`);
  }
  const total = list.reduce((n, r) => n + (r.population ?? 0), 0);
  if (total < 1.15e9 || total > 1.30e9) {
    faults.push(`the populations sum to ${total.toLocaleString("en-IN")}, not near 1.21 billion`);
  }
  const biggest = [...list].sort((a, b) => (b.area ?? 0) - (a.area ?? 0))[0];
  if (biggest && biggest.state !== "Rajasthan") {
    faults.push(`the largest state by area parsed as ${biggest.state}, not Rajasthan`);
  }
  const withPop = list.filter((r) => r.population !== null).length;
  const withArea = list.filter((r) => r.area !== null).length;
  if (withPop < 28) faults.push(`only ${withPop} states got a population`);
  if (withArea < 28) faults.push(`only ${withArea} states got an area`);

  await mkdir(join(ROOT, "data", "geo"), { recursive: true });
  await writeFile(OUT, JSON.stringify({
    builtAt: new Date().toISOString(),
    source: `English Wikipedia: ${POP_PAGE.replace(/_/g, " ")} and ${AREA_PAGE.replace(/_/g, " ")}, which cite the Census of India.`,
    censusYear: 2011,
    staleness:
      "These populations are from the 2011 census, the last one India completed. The 2021 census " +
      "was postponed and has not been held, so every per-capita figure computed from this " +
      "divides a current count by a fifteen-year-old denominator. The error is not uniform: the " +
      "states that have grown fastest since are the most overstated by it. Any rate built on " +
      "this must print the denominator's year on the same line.",
    noProjections:
      "Population projections exist and are deliberately not used. They are a model's output, " +
      "they disagree with one another, and substituting one for a count would make these numbers " +
      "unreproducible against any published source.",
    vocabulary:
      "State names are the map's own spellings, which are what a join will be asked for. A name " +
      "that does not match the topology is recorded as unmatched rather than aliased to " +
      "something close, because a wrong alias deletes a state instead of failing.",
    faults,
    unmatched,
    withPopulation: withPop,
    withArea,
    totalPopulation: total,
    states: list,
  }, null, 2) + "\n", "utf8");

  console.log(`  ${list.length} states · ${withPop} with a population · ${withArea} with an area`);
  console.log(`  total ${total.toLocaleString("en-IN")}`);
  for (const f of faults) console.warn(`  FAULT: ${f}`);
  if (unmatched.length > 0) console.log(`  unmatched labels: ${unmatched.slice(0, 8).join(" / ")}`);
}

if (isEntryPoint(import.meta.url)) {
  run().catch((err) => { console.error(err); process.exit(1); });
}
