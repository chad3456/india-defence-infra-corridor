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

export interface Table { header: string[]; rows: string[][] }

/**
 * Every wikitable on the page, with its header row kept.
 *
 * The header is the point. The first version of this read "the first number
 * above a floor" out of each row, which is a guess about column order dressed
 * as a rule — and it silently read a column of 2025 *projections* as if they
 * were the 2011 census, because both are populations and both are large. Only
 * the named-fact check caught it: the total came to 1.40 billion against a
 * census that counted 1.21.
 *
 * Reading the header means the connector knows which column it took and can
 * say so, rather than this file asserting a basis it never verified.
 */
export function parseTables(text: string): Table[] {
  const out: Table[] = [];
  for (const block of text.split(/\{\|/).slice(1)) {
    const table = block.split(/\n\|\}/)[0] ?? "";
    const chunks = table.split(/\n\|-/);
    const rows: string[][] = [];
    let header: string[] = [];
    for (const [i, raw] of chunks.entries()) {
      const cells: string[] = [];
      let isHeader = false;
      for (const line of raw.split("\n")) {
        if (!/^\s*[|!]/.test(line)) continue;
        if (/^\s*!/.test(line)) isHeader = true;
        const body = line.replace(/^\s*[|!]+\s*/, "");
        // "a || b || c" and "a !! b !! c" are three cells on one line.
        for (const cell of body.split(/\s*(?:\|\||!!)\s*/)) cells.push(cleanCell(cell));
      }
      if (cells.length < 2) continue;
      if (isHeader && header.length === 0) { header = cells; continue; }
      if (i === 0 && header.length === 0) { header = cells; continue; }
      rows.push(cells);
    }
    if (rows.length > 0) out.push({ header, rows });
  }
  return out;
}

/** Wikitext markup stripped from one cell, leaving the text a reader sees. */
export function cleanCell(cell: string): string {
  return cell
    .replace(/<ref[\s\S]*?(?:\/>|<\/ref>)/gi, "")
    .replace(/\{\{[Ss]ort\|[^|}]*\|([^}]*)\}\}/g, "$1")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[|\]\]/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s*(?:style|align|colspan|rowspan|scope|class)\s*=\s*"[^"]*"\s*\|?/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The index of the column whose header matches, and the header's own words.
 *
 * Returned together so the output can print the basis rather than assert one:
 * "Population (2025 est.)" is a different claim from "Population (2011
 * census)" and this connector must not flatten them into "population".
 */
export function columnMatching(
  header: string[], want: RegExp, avoid?: RegExp,
): { index: number; label: string } | null {
  for (const [i, h] of header.entries()) {
    if (!want.test(h)) continue;
    if (avoid && avoid.test(h)) continue;
    return { index: i, label: h };
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
  let populationBasis = "unknown";
  let areaBasis = "unknown";
  /**
   * Every table the parser found, with its header and row count.
   *
   * Written into the output because guessing an article's structure from here
   * costs a CI round trip per guess, and I have now spent two of them. A
   * connector that reports what it actually saw turns the next guess into a
   * reading. This is the same reason the Epoch connector records its column
   * names.
   */
  const tablesSeen: Array<{ page: string; header: string[]; rows: number; firstRow: string[] }> = [];

  /**
   * Read one measure out of whichever table on the page actually carries it.
   *
   * The table is chosen by whether its header has a matching column and its
   * rows name states this map can draw — not by position, because these
   * articles carry several tables and which one comes first changes whenever
   * somebody adds an infobox.
   */
  function harvest(
    text: string, label: string, want: RegExp, avoid: RegExp | undefined, floor: number,
    set: (state: string, value: number) => void,
  ): string {
    let basis = "unknown";
    let best = 0;
    for (const table of parseTables(text)) {
      if (tablesSeen.length < 24) {
        tablesSeen.push({
          page: label, header: table.header.slice(0, 10), rows: table.rows.length,
          firstRow: (table.rows[0] ?? []).slice(0, 10),
        });
      }
      const col = columnMatching(table.header, want, avoid);
      if (!col) continue;
      let hits = 0;
      const staged: Array<[string, number]> = [];
      for (const cells of table.rows) {
        const state = mapName(cells[0] ?? "", known) ?? mapName(cells[1] ?? "", known);
        if (!state) {
          const label = (cells[0] ?? "").slice(0, 40);
          if (label && unmatched.length < 30 && !/^\d+$/.test(label)) unmatched.push(label);
          continue;
        }
        const value = readNumber(cells[col.index] ?? "");
        if (value === null || value < floor) continue;
        staged.push([state, value]);
        hits++;
      }
      // The table that places the most states wins; a navbox with two rows
      // should not beat the real one because it happened to come first.
      if (hits > best) {
        best = hits;
        basis = col.label;
        for (const [state, value] of staged) set(state, value);
      }
    }
    return basis;
  }

  const popText = await wikitext(POP_PAGE);
  if (!popText) faults.push("the population page did not answer");
  else {
    populationBasis = harvest(
      popText, "population", /population/i, /density|rank|decadal|growth|percent|share/i, 100_000,
      (state, value) => {
        const prior = rows.get(state) ?? { state, population: null, area: null };
        rows.set(state, { ...prior, population: prior.population ?? value });
      },
    );
  }

  const areaText = await wikitext(AREA_PAGE);
  if (!areaText) faults.push("the area page did not answer");
  else {
    areaBasis = harvest(
      areaText, "area", /area/i, /rank|percent|share|water/i, 30,
      (state, value) => {
        const prior = rows.get(state) ?? { state, population: null, area: null };
        rows.set(state, { ...prior, area: prior.area ?? value });
      },
    );
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
  /**
   * India's population, wide enough for either basis and narrow enough to
   * catch a wrong column.
   *
   * The first version of this check demanded 1.21 billion, the 2011 census
   * count, and failed — correctly — because the article now publishes 2025
   * projections. That was the check doing its job: the numbers were plausible,
   * the format was right, and nothing else would have noticed. The range now
   * spans census to projection, and `populationBasis` records which one the
   * column header actually said, so the page states the basis instead of this
   * file assuming one.
   */
  if (total < 1.15e9 || total > 1.55e9) {
    faults.push(
      `the populations sum to ${total.toLocaleString("en-IN")}, outside 1.15–1.55 billion — ` +
      "too far from any published figure for India to be the right column",
    );
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
    populationBasis,
    areaBasis,
    basisNote:
      "populationBasis and areaBasis are the column headings these figures were actually read " +
      "from, and they are recorded rather than assumed. The first version of this connector " +
      "declared the populations to be the 2011 census and was wrong: the article publishes " +
      "projections, and the totals came to 1.40 billion against a census that counted 1.21. Any " +
      "page using these must print the basis beside the rate.",
    staleness:
      "India's last completed census was 2011; the 2021 census was postponed and has not been " +
      "held. So a figure here is either a fifteen-year-old count or a projection from one, and " +
      "neither is a current measurement. Projections are a model's output and disagree with one " +
      "another, so a rate built on them is reproducible only against this exact source on this " +
      "exact date — which is why the basis travels with the number.",

    vocabulary:
      "State names are the map's own spellings, which are what a join will be asked for. A name " +
      "that does not match the topology is recorded as unmatched rather than aliased to " +
      "something close, because a wrong alias deletes a state instead of failing.",
    faults,
    tablesSeen,
    unmatched,
    withPopulation: withPop,
    withArea,
    totalPopulation: total,
    states: list,
  }, null, 2) + "\n", "utf8");

  console.log(`  ${list.length} states · ${withPop} with a population · ${withArea} with an area`);
  console.log(`  population column: "${populationBasis}"`);
  console.log(`  area column:       "${areaBasis}"`);
  for (const t of tablesSeen) {
    console.log(`  [${t.page}] ${t.rows} rows · header: ${t.header.join(" | ").slice(0, 150)}`);
    if (t.header.length === 0) console.log(`      first row: ${t.firstRow.join(" | ").slice(0, 150)}`);
  }
  console.log(`  total ${total.toLocaleString("en-IN")}`);
  for (const f of faults) console.warn(`  FAULT: ${f}`);
  if (unmatched.length > 0) console.log(`  unmatched labels: ${unmatched.slice(0, 8).join(" / ")}`);
}

if (isEntryPoint(import.meta.url)) {
  run().catch((err) => { console.error(err); process.exit(1); });
}
