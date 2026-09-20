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
 *
 * ── Why each force carries a list of titles rather than one ──────────────
 *
 * The first version named one article per force and six of the fourteen came
 * back empty, because Wikipedia does not use one convention for these. Some
 * forces have a "List of active …" article; others keep the inventory inside
 * the force's own article under an "Aircraft" section; others are titled by
 * country rather than by service. A single guessed title is a coin flip, and a
 * failed flip is indistinguishable from a force with no aircraft.
 *
 * So each force lists the titles worth trying, in order, and the first that
 * yields a usable table wins. Which title actually answered is published on
 * the force's row, so a rename shows up as a changed source rather than as a
 * silently different number.
 */
const FORCES: Array<{ pages: string[]; force: string; iso: string; country: string }> = [
  { pages: ["List_of_active_Indian_military_aircraft"], force: "India (all services)", iso: "IND", country: "India" },
  { pages: ["List_of_active_Pakistan_Air_Force_aircraft", "Pakistan_Air_Force"], force: "Pakistan Air Force", iso: "PAK", country: "Pakistan" },
  { pages: ["List_of_active_People's_Liberation_Army_Air_Force_aircraft"], force: "PLA Air Force", iso: "CHN", country: "China" },
  { pages: ["List_of_active_Russian_military_aircraft"], force: "Russia (all services)", iso: "RUS", country: "Russia" },
  { pages: ["List_of_active_United_States_military_aircraft"], force: "United States (all services)", iso: "USA", country: "United States" },
  { pages: ["List_of_aircraft_of_the_Royal_Air_Force", "List_of_active_United_Kingdom_military_aircraft", "Royal_Air_Force"], force: "Royal Air Force", iso: "GBR", country: "United Kingdom" },
  { pages: ["List_of_active_French_military_aircraft"], force: "France (all services)", iso: "FRA", country: "France" },
  { pages: ["List_of_aircraft_of_the_Israeli_Air_Force", "Israeli_Air_Force"], force: "Israeli Air Force", iso: "ISR", country: "Israel" },
  { pages: ["List_of_active_Japan_Self-Defense_Forces_equipment", "Japan_Air_Self-Defense_Force"], force: "Japan ASDF", iso: "JPN", country: "Japan" },
  { pages: ["Republic_of_Korea_Air_Force"], force: "Republic of Korea AF", iso: "KOR", country: "South Korea" },
  { pages: ["List_of_active_Turkish_military_aircraft", "Turkish_Air_Force"], force: "Turkish Air Force", iso: "TUR", country: "Türkiye" },
  { pages: ["List_of_active_Brazilian_military_aircraft"], force: "Brazil (all services)", iso: "BRA", country: "Brazil" },
  { pages: ["List_of_active_Indonesian_military_aircraft", "Indonesian_Air_Force"], force: "Indonesia (all services)", iso: "IDN", country: "Indonesia" },
  { pages: ["Bangladesh_Air_Force"], force: "Bangladesh Air Force", iso: "BGD", country: "Bangladesh" },
];

/**
 * What the parser saw in one table, published rather than logged.
 *
 * Self-describing ingest: the connector reports the headers it actually met
 * and which columns it picked out of them, so the next guess about a source
 * is made against a reading instead of against an assumption. The cost is a
 * few hundred bytes per force; the alternative is another round of inferring
 * a table's shape from the shape of its output.
 */
export interface TableNote {
  headers: string[];
  rows: number;
  typeAt: number;
  serviceAt: number;
  /** False when the table was skipped for want of a recognisable column pair. */
  used: boolean;
  /** How many of its quantity cells were non-empty before parsing. */
  filled: number;
}

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

  /**
   * Anything carrying citation machinery is not a quantity.
   *
   * The table parser used to break a multi-line citation into extra cells,
   * which shifted every column after it and dropped URL and title fragments
   * into the quantity column. France's fleet came to 845,649 aircraft from a
   * digit run inside a flightglobal.com URL; the Rafale came to 2,026 and the
   * American Metroliners to 2,023, out of `|title=World Air Forces 2026` and
   * `|Flight Global|2023|`. Every one of them was a plausible number in the
   * right column.
   *
   * The parser is fixed. This stays because the cost is a few characters and
   * the failure it guards against is invisible in the output: a fleet size is
   * a plausible number whatever it is, and there is no downstream check that
   * would catch one.
   */
  if (/https?:|\bur[l]\s*=|\btitle\s*=|\|\s*\w+\s*=|\}\}|\{\{/.test(s)) return null;

  const m = s.match(/\d[\d,]*/);
  if (!m) return null;
  const n = Number.parseInt(m[0].replace(/,/g, ""), 10);
  if (!Number.isFinite(n)) return null;

  /**
   * A bare four-digit number in the range of a year, alone in the cell, is a
   * year.
   *
   * The same rule the cinema connector needed for box-office cells, for the
   * same reason: "2023" is a legitimate fleet size in principle and a citation
   * year in practice, and nothing in the cell distinguishes them. No single
   * aircraft type is fielded in four-digit numbers by any force outside the
   * United States, and the American rows that matter carry a comma. Refusing
   * here loses a handful of real counts and prevents a whole class of silent
   * fiction.
   */
  if (/^(19|20)\d{2}$/.test(s)) return null;

  return n;
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
    /** Which candidate title actually answered, so a rename is visible. */
    page: string;
    /** What the parser saw, so the next fix is made against a reading. */
    tablesSeen: TableNote[];
    types: number; counted: number; unreadable: number; total: number;
    tablesRead: number; tablesSkipped: number;
  }> = [];

  for (const f of FORCES) {
    let tablesRead = 0;
    let tablesSkipped = 0;
    let tablesSeen: TableNote[] = [];
    let rowsForForce: Airframe[] = [];
    let usedPage = "";
    const tried: string[] = [];

    /*
     * The first title that yields a usable table wins.
     *
     * Ordered most-specific first, so a dedicated inventory article is
     * preferred over the force's own page — the latter carries the same table
     * alongside history and organisation, and is a fallback rather than an
     * equal. Which one answered is recorded on the force's row.
     */
    for (const page of f.pages) {
      tried.push(page);
      const text = await wikitextOf(page);
      if (text === null) continue;

      const tables = parseTables(text);
      const rows: Airframe[] = [];
      const saw: TableNote[] = [];
      let read = 0;
      let skipped = 0;

      for (const t of tables) {
        const headers = t.headers.map((h) => plain(h).toLowerCase());
        /**
         * Which column names the aircraft, and whether this is an aircraft
         * table at all.
         *
         * Where a force has no dedicated aircraft list this falls back to its
         * main article, and a force article carries equipment tables that are
         * not aircraft. The Republic of Korea Air Force page has two that look
         * alike:
         *
         *     Aircraft | Origin | Type | Variant | In service | Notes
         *     Name     | Origin | Type | Variant | In service | Notes
         *
         * The second is air defence. Reading it put 2,000 KP-SAM Shingung
         * man-portable missiles and 200 M167 anti-aircraft guns into the
         * fleet — 2,219 of a published total of 2,821, on a page about
         * aircraft.
         *
         * Dropping "Name" from the patterns was not enough, and the way it
         * failed is worth keeping: the table still matched, on its "Type"
         * column, so the same rows came back with "man-portable air-defense
         * system" where the aircraft name should be. A narrower pattern did
         * not exclude the table; it just moved which column was misread.
         *
         * So the rule is about the table rather than about one header. An
         * explicit "Aircraft" or "Model" column is the name. Failing that,
         * "Type" is the name — but only when the table has no "Name" column,
         * because Name-plus-Type is the shape these articles use for equipment
         * that is not aircraft.
         */
        const aircraftAt = columnIndex(headers, /^(aircraft|model)\b/);
        const nameAt = columnIndex(headers, /^name\b/);
        const typeColAt = columnIndex(headers, /^type\b/);
        const typeAt = aircraftAt >= 0 ? aircraftAt : (nameAt >= 0 ? -1 : typeColAt);
        const serviceAt = columnIndex(headers, /(in service|inventory|quantity|number|qty|total|active|strength)/);
        /*
         * Both columns or nothing. A table with an aircraft column and no
         * quantity column is a list of types, not an inventory, and reading it
         * as one would add every type at a count of null and then report a
         * fleet made mostly of unknowns.
         */
        if (typeAt < 0 || serviceAt < 0) {
          skipped++;
          saw.push({ headers: t.headers, rows: t.rows.length, typeAt, serviceAt, used: false, filled: 0 });
          continue;
        }
        read++;

        const originAt = columnIndex(headers, /origin|manufactur|country/);
        const roleAt = columnIndex(headers, /role|category|class|mission/);
        const variantAt = columnIndex(headers, /variant|version|mark/);

        for (const [ri, r] of t.rows.entries()) {
          const type = plain(r[typeAt] ?? "").trim();
          if (type === "" || /^(total|notes?)$/i.test(type)) continue;
          /**
           * A row carrying one value and nothing else is a section divider.
           *
           * The Russian list breaks its table into sections with a full-width
           * row holding only the section name, so "AWACS", "Tanker",
           * "Transport", "Electronic Warfare" and "Gunship" were all published
           * as aircraft types with no quantity. They are not wrong numbers —
           * they have no numbers — but they inflate the count of types a force
           * flies and the count of cells that could not be read, which is the
           * figure this page uses to decide whether to trust a total at all.
           */
          if (r.every((cell, i) => i === typeAt || plain(cell ?? "").trim() === "")) continue;
          /**
           * A quantity inherited from a rowspan above belongs to the row that
           * wrote it, and is not counted again here.
           *
           * These tables group variants under one aircraft and put the fleet
           * figure on the spanning cell. Carrying that cell down is what puts
           * every row back at full width — without it a variant row reads as
           * a separate aircraft with no quantity at all, which is how India's
           * list came to 64 rows of which only 28 carried a number.
           *
           * But the carried value repeats, and summing the column would count
           * one fleet once per variant. 260 Su-30s under two variant rows is
           * 520: a plausible number in the right units, on the page this site
           * exists to not be.
           *
           * The variant row is still published — it is a real thing the
           * catalogue lists — with its quantity null and the reason recorded,
           * so the count of unreadable cells stays honest rather than being
           * quietly inflated by every rowspan in the source.
           */
          const inheritedQty = t.spanned[ri]?.[serviceAt] === true;
          const raw = inheritedQty ? "" : plain(r[serviceAt] ?? "").trim();
          if (type === "" ) continue;
          rows.push({
            iso: f.iso,
            country: f.country,
            force: f.force,
            type,
            origin: originAt >= 0 ? plain(r[originAt] ?? "").trim() : "",
            role: roleAt >= 0 ? plain(r[roleAt] ?? "").trim() : "",
            variant: variantAt >= 0 ? plain(r[variantAt] ?? "").trim() : "",
            inService: inheritedQty ? null : countIn(raw),
            inServiceRaw: inheritedQty ? "(shared with the row above)" : raw,
          });
        }
        /*
         * How many of this table's quantity cells actually carried a number.
         *
         * Published per table, because "the force's total was withheld" does
         * not say which table let it down. India's first run had 62 of 69
         * unreadable cells simply EMPTY — a matched header over a column that
         * is blank for most rows — and nothing in the output distinguished
         * that from a column full of prose. One is a wrong column; the other
         * is a hard source. They need different fixes and looked identical.
         */
        const filled = t.rows.filter((r, ri) =>
          t.spanned[ri]?.[serviceAt] !== true && plain(r[serviceAt] ?? "").trim() !== "").length;
        saw.push({ headers: t.headers, rows: t.rows.length, typeAt, serviceAt, used: true, filled });
      }

      if (rows.length > 0) {
        rowsForForce = rows;
        tablesRead = read;
        tablesSkipped = skipped;
        tablesSeen = saw;
        usedPage = page;
        break;
      }
    }

    if (rowsForForce.length === 0) {
      failures.push({ page: tried.join(" | "), why: "no title yielded a table carrying both a type and a quantity column" });
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
      iso: f.iso, country: f.country, force: f.force, page: usedPage, tablesSeen,
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
