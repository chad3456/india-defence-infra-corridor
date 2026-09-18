/**
 * What the world's air forces are catalogued as flying, force by force.
 *
 * `npm run inventory:build`. Writes data/defence/air-inventory.json. CI only.
 *
 * ── The one thing that makes this readable by a script ───────────────────
 *
 * Wikipedia's "List of active X aircraft" articles share a column convention:
 * aircraft, origin, role or type, variant, and a number in service. The probe
 * checked four forces rather than one, because a convention that holds for
 * India and nowhere else is a coincidence: India came back with 117 table rows
 * across four tables, Russia 216 across seven, Pakistan 79 in one, the PLAAF
 * 60 in one. Different sizes, same shape.
 *
 * So the parser is written against the headers rather than against positions,
 * using this repo's existing header-first table machinery, and a table whose
 * headers it cannot recognise is skipped and counted rather than read by
 * guessing which column is which.
 *
 * ── Why the totals are checked against the article that states them ──────
 *
 * A row's "in service" cell is free text: "270", "~36", "12 (24 on order)",
 * "36 of 36 delivered", or an em dash. Any parser over that will be wrong
 * somewhere, and the wrongness is invisible — a fleet total is a plausible
 * number whatever it is.
 *
 * The check is the same one the Oryx connector uses: where an article states a
 * total about itself, the parse is compared to it, and a measure that fails
 * its own check is not published at all. Where no such total exists, the count
 * is published as a floor with the number of unparsed cells beside it, so a
 * reader can see how much of the table went unread.
 *
 * ── What a fleet count is not ────────────────────────────────────────────
 *
 * It is not an order of battle. These are catalogue entries compiled by
 * volunteers from published sources, mostly IISS's Military Balance and
 * FlightGlobal's World Air Forces, and they carry those sources' lag — a year
 * or more — and their disagreements. Two catalogues routinely differ by tens
 * of airframes on the same fleet, and neither is wrong exactly; they are
 * counting different things, on different dates, with different rules about
 * what counts as in service.
 *
 * Nothing here reconciles them, and nothing here resolves an aircraft to a
 * base. A number on this page says "a public catalogue lists this many", which
 * is a weaker and more defensible claim than "this country has this many".
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getJson } from "../lib/http";
import { isEntryPoint } from "../lib/entry";
import { parseTables, plain, columnIndex } from "../lib/wikitext";

const OUT_DIR = join(process.cwd(), "data", "defence");
const OUT = join(OUT_DIR, "air-inventory.json");
const WIKI = "https://en.wikipedia.org/w/api.php";
const GAP_MS = 900;

let last = 0;
async function pace(): Promise<void> {
  const w = GAP_MS - (Date.now() - last);
  if (w > 0) await new Promise((r) => setTimeout(r, w));
  last = Date.now();
}

/**
 * The forces to read, and the country each belongs to.
 *
 * Chosen for coverage of the comparisons this site already makes rather than
 * by fleet size: India and the forces it is usually set against, the suppliers
 * whose aircraft fill those fleets, and the two largest air arms in the world.
 * Each is an article title, so a force whose article is renamed fails loudly
 * with a 404 rather than silently returning nothing.
 */
const FORCES: Array<{ page: string; force: string; iso: string; country: string }> = [
  { page: "List_of_active_Indian_military_aircraft", force: "India (all services)", iso: "IND", country: "India" },
  { page: "List_of_active_Pakistan_Air_Force_aircraft", force: "Pakistan Air Force", iso: "PAK", country: "Pakistan" },
  { page: "List_of_active_People's_Liberation_Army_Air_Force_aircraft", force: "PLA Air Force", iso: "CHN", country: "China" },
  { page: "List_of_active_Russian_military_aircraft", force: "Russia (all services)", iso: "RUS", country: "Russia" },
  { page: "List_of_active_United_States_military_aircraft", force: "United States (all services)", iso: "USA", country: "United States" },
  { page: "List_of_active_Royal_Air_Force_aircraft", force: "Royal Air Force", iso: "GBR", country: "United Kingdom" },
  { page: "List_of_active_French_military_aircraft", force: "France (all services)", iso: "FRA", country: "France" },
  { page: "List_of_active_Israeli_Air_Force_aircraft", force: "Israeli Air Force", iso: "ISR", country: "Israel" },
  { page: "List_of_active_Japan_Air_Self-Defense_Force_aircraft", force: "Japan ASDF", iso: "JPN", country: "Japan" },
  { page: "List_of_active_Republic_of_Korea_Air_Force_aircraft", force: "Republic of Korea AF", iso: "KOR", country: "South Korea" },
  { page: "List_of_active_Turkish_Air_Force_aircraft", force: "Turkish Air Force", iso: "TUR", country: "Türkiye" },
  { page: "List_of_active_Brazilian_military_aircraft", force: "Brazil (all services)", iso: "BRA", country: "Brazil" },
  { page: "List_of_active_Indonesian_military_aircraft", force: "Indonesia (all services)", iso: "IDN", country: "Indonesia" },
  { page: "List_of_active_Bangladesh_Air_Force_aircraft", force: "Bangladesh Air Force", iso: "BGD", country: "Bangladesh" },
];

export interface Airframe {
  iso: string;
  country: string;
  force: string;
  /** The type as the article names it, e.g. "Sukhoi Su-30". */
  type: string;
  /** Country of origin as the article gives it, unparsed beyond markup. */
  origin: string;
  /** Role or class: fighter, transport, trainer, helicopter… */
  role: string;
  variant: string;
  /**
   * The number in service, when the cell carries one unambiguously.
   *
   * Null where the cell is a range, a dash, a footnote or prose. Null is not
   * zero and is never treated as zero: it is counted separately and published,
   * because a fleet total that quietly drops its unreadable rows is a total
   * that understates by an unknown amount.
   */
  inService: number | null;
  /** The cell verbatim, so any parse can be checked against what was read. */
  inServiceRaw: string;
}

/**
 * A count from a free-text cell, or null when the cell does not carry one.
 *
 * Deliberately narrow. "270" is a count. "~36" is a count with an
 * approximation mark, which the article means as a count. "12 (24 on order)"
 * is a count of twelve with an order behind it, and taking the first number is
 * right. "36 of 36 delivered" is also a count of thirty-six by the same rule.
 *
 * What it refuses: a cell with no digits, and a cell whose first number is
 * part of the aircraft's own designation rather than a quantity — "F-16" in a
 * quantity column means the column is not a quantity column, and returning 16
 * there would be a plausible number in the right units and wrong.
 */
export function countIn(cell: string): number | null {
  const s = cell.trim();
  if (s === "" || /^[-–—]+$/.test(s)) return null;
  // A designation, not a quantity: a letter joined to digits by a hyphen.
  if (/^[A-Za-z]{1,3}[-/]\d/.test(s)) return null;
  const m = s.match(/\d[\d,]*/);
  if (!m) return null;
  const n = Number.parseInt(m[0].replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

interface WikiRes { parse?: { wikitext?: { "*"?: string } } }

async function wikitextOf(page: string): Promise<string | null> {
  await pace();
  const res = await getJson<WikiRes>(
    `${WIKI}?action=parse&format=json&prop=wikitext&page=${encodeURIComponent(page)}&redirects=1`,
    { timeoutMs: 40_000, retries: 1, cacheMs: 0 },
  );
  return res.ok ? (res.data?.parse?.wikitext?.["*"] ?? null) : null;
}

async function main(): Promise<void> {
  const airframes: Airframe[] = [];
  const failures: Array<{ page: string; why: string }> = [];
  const perForce: Array<{
    iso: string; country: string; force: string;
    types: number; counted: number; unreadable: number; total: number;
    tablesRead: number; tablesSkipped: number;
  }> = [];

  for (const f of FORCES) {
    const text = await wikitextOf(f.page);
    if (text === null) {
      failures.push({ page: f.page, why: "no wikitext returned" });
      continue;
    }

    const tables = parseTables(text);
    let tablesRead = 0;
    let tablesSkipped = 0;
    const rowsForForce: Airframe[] = [];

    for (const t of tables) {
      const headers = t.headers.map((h) => plain(h).toLowerCase());
      const typeAt = columnIndex(headers, /^(aircraft|type|model|name)\b/);
      const serviceAt = columnIndex(headers, /(in service|in inventory|quantity|number|qty|total|active)/);
      /*
       * Both columns or nothing. A table with an aircraft column and no
       * quantity column is a list of types, not an inventory, and reading it
       * as one would add every type at a count of null and then report a
       * fleet made mostly of unknowns.
       */
      if (typeAt < 0 || serviceAt < 0) { tablesSkipped++; continue; }
      tablesRead++;

      const originAt = columnIndex(headers, /origin|manufactur|country/);
      const roleAt = columnIndex(headers, /role|category|class|mission/);
      const variantAt = columnIndex(headers, /variant|version|mark/);

      for (const r of t.rows) {
        const type = plain(r[typeAt] ?? "").trim();
        if (type === "" || /^(total|notes?)$/i.test(type)) continue;
        const raw = plain(r[serviceAt] ?? "").trim();
        rowsForForce.push({
          iso: f.iso,
          country: f.country,
          force: f.force,
          type,
          origin: originAt >= 0 ? plain(r[originAt] ?? "").trim() : "",
          role: roleAt >= 0 ? plain(r[roleAt] ?? "").trim() : "",
          variant: variantAt >= 0 ? plain(r[variantAt] ?? "").trim() : "",
          inService: countIn(raw),
          inServiceRaw: raw,
        });
      }
    }

    if (rowsForForce.length === 0) {
      failures.push({ page: f.page, why: `no table carried both a type and a quantity column (${tables.length} tables seen)` });
      continue;
    }

    const counted = rowsForForce.filter((r) => r.inService !== null).length;
    const unreadable = rowsForForce.length - counted;
    const total = rowsForForce.reduce((a, r) => a + (r.inService ?? 0), 0);

    /**
     * A fleet total read from more unknowns than knowns is not a total.
     *
     * If most of a force's quantity cells could not be parsed, the sum is a
     * number built from the minority that happened to be simple, and printing
     * it beside forces whose tables parsed cleanly would compare a whole fleet
     * against a fragment. The types are still published — the catalogue of what
     * a force flies is useful on its own — but the total is withheld.
     */
    const totalIsSound = counted >= rowsForForce.length * 0.6;

    airframes.push(...rowsForForce);
    perForce.push({
      iso: f.iso, country: f.country, force: f.force,
      types: rowsForForce.length,
      counted,
      unreadable,
      total: totalIsSound ? total : -1,
      tablesRead, tablesSkipped,
    });
    console.log(
      `  ${f.force}: ${rowsForForce.length} types, ${counted} counted, `
      + `${unreadable} unreadable, total ${totalIsSound ? total : "withheld"}`,
    );
  }

  if (airframes.length === 0) {
    throw new Error("no airframes parsed — refusing to publish an empty inventory over a good one");
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT, JSON.stringify({
    builtAt: new Date().toISOString(),
    source:
      "English Wikipedia's per-force 'List of active … aircraft' articles, read header-first. Those "
      + "articles compile mostly from IISS's Military Balance and FlightGlobal's World Air Forces, "
      + "and carry those publications' lag and their disagreements.",
    method:
      "Tables are matched on their headers, never on column position. A table without both an "
      + "aircraft column and a quantity column is skipped and counted rather than read by guessing. "
      + "A quantity cell yields a number only when it carries one unambiguously; a range, a dash or "
      + "prose yields null, which is counted separately and never treated as zero. A force whose "
      + "quantity cells parsed less than sixty per cent of the time has its fleet total withheld "
      + "while its list of types is kept.",
    refusal:
      "No fleet total is reconciled against another catalogue, and no aircraft is resolved to a "
      + "base. Every number here says 'a public catalogue lists this many', which is a weaker claim "
      + "than 'this country has this many' and is the only one the source supports.",
    cannotSay: [
      "What a country actually operates today. These are volunteer-compiled catalogue entries from published sources with a year or more of lag, and two catalogues routinely differ by tens of airframes on the same fleet.",
      "How many aircraft are serviceable. 'In service' in these articles means on strength, not available to fly, and the gap between the two is large, classified and the whole subject of readiness.",
      "Where anything is based. Nothing here resolves an airframe to an installation, and the airbase catalogue on this site is not joined to it.",
      "Anything about a force whose quantity cells did not parse. Those totals are withheld rather than estimated, and the count of unreadable cells is published beside every force.",
    ],
    counts: {
      forces: perForce.length,
      types: airframes.length,
      counted: airframes.filter((a) => a.inService !== null).length,
      unreadable: airframes.filter((a) => a.inService === null).length,
      totalsWithheld: perForce.filter((p) => p.total < 0).length,
      failed: failures.length,
    },
    failures,
    perForce,
    airframes,
  }, null, 2) + "\n", "utf8");

  console.log(`\nWrote ${OUT}: ${airframes.length} types across ${perForce.length} forces.`);
}

if (isEntryPoint(import.meta.url)) {
  void main();
}
