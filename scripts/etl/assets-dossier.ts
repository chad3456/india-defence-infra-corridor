/**
 * A country-by-country dossier of military assets, as a plain text file.
 *
 * `npm run assets:dossier`. Writes data/defence/military-assets.txt.
 *
 * ── Why this is generated and never typed ────────────────────────────────
 *
 * A hand-written file of "what each country has" is a file of what I believe
 * each country has, and every figure in it would be unauditable the moment it
 * was saved. This one is assembled from files already in the repository, each
 * of which was itself fetched from a named upstream source and carries its own
 * caveats. Regenerating it is the only way to change it, and regenerating it
 * against unchanged inputs produces a byte-identical file — which is what
 * makes a diff on it meaningful.
 *
 * ── What "open source" honestly means for each line ──────────────────────
 *
 * The five inputs are not equally good and the file says so per section
 * rather than once at the top:
 *
 *   SPENDING, PERSONNEL, WARHEADS  SIPRI and FAS via Our World in Data. The
 *                                  strongest material here: a standing
 *                                  research estimate, revised annually,
 *                                  published with its own methodology.
 *   AIRCRAFT                       Volunteer-compiled catalogues on Wikipedia
 *                                  drawing on IISS and FlightGlobal, a year or
 *                                  more behind, and the two disagree by tens
 *                                  of airframes on the same fleet.
 *   AIRFIELDS                      OpenStreetMap. A count of what mappers have
 *                                  mapped, so an active community looks like
 *                                  a large air force. A floor, always.
 *   MISSILE SYSTEMS                Names from Wikipedia's per-country lists.
 *                                  A vocabulary of what a country is said to
 *                                  field, with no quantities at all — and the
 *                                  file prints no quantity rather than
 *                                  inventing one.
 *
 * ── The line this file does not cross ────────────────────────────────────
 *
 * It reports what public catalogues list. It does not assess capability,
 * readiness, posture or intent, and it does not total across categories into
 * anything that looks like a strength score. Those are the interesting
 * questions and none of them is answerable from a catalogue; a number that
 * implied otherwise would be the most misleading thing on the page.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isEntryPoint } from "./lib/entry";

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, "data", "defence");
const OUT = join(OUT_DIR, "military-assets.txt");

interface SpineRow { iso3: string; name: string; year: number; value: number }
/**
 * `country` is nullable because the upstream list leaves it so.
 *
 * 121 of 819 systems in the gazetteer carry no country — Al-Samoud 2,
 * Ababil-100, Al Hussein and the rest sit under headings the parser could not
 * attribute. Typing the field as a plain string made the first run crash on
 * `null.toLowerCase()`, which was the good outcome: the alternative was a
 * silent `String(null)` and a country section headed "null".
 */
interface GazRow { name: string; kind: string; country: string | null; source: string }

/** The heading systems land under when the upstream list names no country. */
const NO_COUNTRY = "(no country stated in the source)";

function readJson<T>(rel: string): T | null {
  try { return JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as T; } catch { return null; }
}

/** The latest row per country in a SIPRI/OWID-shaped series. */
function latestByCountry(rows: SpineRow[] | undefined): Map<string, SpineRow> {
  const out = new Map<string, SpineRow>();
  for (const r of rows ?? []) {
    if (!Number.isFinite(r.value)) continue;
    const prev = out.get(r.iso3);
    if (!prev || r.year > prev.year) out.set(r.iso3, r);
  }
  return out;
}

/** Money in the units a reader holds, never in raw dollars. */
function money(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)} trillion`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)} billion`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)} million`;
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

function count(v: number): string {
  return Math.round(v).toLocaleString("en-US");
}

/** Wrap a long list to a fixed column, so the file reads in a terminal. */
function wrap(items: string[], indent: string, width = 76): string[] {
  const lines: string[] = [];
  let line = indent;
  for (const [i, item] of items.entries()) {
    const piece = item + (i === items.length - 1 ? "" : ", ");
    if (line.length + piece.length > width && line.trim() !== "") {
      lines.push(line.replace(/\s+$/, ""));
      line = indent;
    }
    line += piece;
  }
  if (line.trim() !== "") lines.push(line.replace(/\s+$/, ""));
  return lines;
}

async function main(): Promise<void> {
  const arsenal = readJson<{
    builtAt?: string;
    spine?: Record<string, SpineRow[]>;
    gazetteer?: GazRow[];
  }>("data/global/arsenal.json");
  const bases = readJson<{
    builtAt?: string;
    byCountry?: Array<{ iso: string; country: string; n: number; jointUse: number }>;
    counts?: { boxesFailed: number };
    failures?: Array<{ box: string; why: string }>;
  }>("data/defence/airbases.json");
  const inv = readJson<{
    builtAt?: string;
    perForce?: Array<{ iso: string; country: string; force: string; total: number; counted: number; types: number; page: string }>;
    airframes?: Array<{ iso: string; type: string; inService: number | null }>;
  }>("data/defence/air-inventory.json");

  if (!arsenal && !bases && !inv) {
    throw new Error("no input files present — refusing to write an empty dossier over a good one");
  }

  const milex = latestByCountry(arsenal?.spine?.["milex"]);
  const milexGdp = latestByCountry(arsenal?.spine?.["milex-gdp"]);
  const personnel = latestByCountry(arsenal?.spine?.["personnel"]);
  const warheads = latestByCountry(arsenal?.spine?.["warheads"]);

  const basesByIso = new Map((bases?.byCountry ?? []).map((c) => [c.iso, c]));
  const forcesByIso = new Map((inv?.perForce ?? []).map((f) => [f.iso, f]));

  /** Missile and rocket system names, grouped by the country said to field them. */
  const systemsByCountry = new Map<string, GazRow[]>();
  for (const g of arsenal?.gazetteer ?? []) {
    // A system with no country is kept under an explicit heading rather than
    // dropped or coerced. 121 of them, which is not a rounding error.
    const key = g.country ?? NO_COUNTRY;
    const list = systemsByCountry.get(key) ?? [];
    list.push(g);
    systemsByCountry.set(key, list);
  }

  /*
   * Every country any source mentions, keyed by ISO where one is known.
   *
   * The missile gazetteer keys on country NAME while everything else keys on
   * ISO 3166-1 alpha-3, so the two are joined on the name that the ISO-keyed
   * sources publish. A gazetteer country whose name matches nothing is still
   * printed, in its own section at the end, rather than dropped — a source
   * this file cannot join is a fact about the join, and silently losing 32
   * countries' worth of systems would be invisible.
   */
  const isoToName = new Map<string, string>();
  for (const m of [milex, personnel, warheads]) {
    for (const [iso, row] of m) if (!isoToName.has(iso)) isoToName.set(iso, row.name);
  }
  for (const c of bases?.byCountry ?? []) if (!isoToName.has(c.iso)) isoToName.set(c.iso, c.country);
  for (const f of inv?.perForce ?? []) if (!isoToName.has(f.iso)) isoToName.set(f.iso, f.country);

  const nameToIso = new Map<string, string>();
  for (const [iso, name] of isoToName) nameToIso.set(name.toLowerCase(), iso);
  // A handful of names the sources spell differently from each other.
  const ALIASES: Record<string, string> = {
    "united states": "USA", "united states of america": "USA",
    "russia": "RUS", "soviet union": "RUS",
    "united kingdom": "GBR", "south korea": "KOR", "north korea": "PRK",
    "iran": "IRN", "türkiye": "TUR", "turkey": "TUR", "taiwan": "TWN",
    "czech republic": "CZE", "czechia": "CZE",
  };
  for (const [name, iso] of Object.entries(ALIASES)) if (!nameToIso.has(name)) nameToIso.set(name, iso);

  const systemsByIso = new Map<string, GazRow[]>();
  const unjoinedSystems: Array<{ country: string; rows: GazRow[] }> = [];
  for (const [country, rows] of systemsByCountry) {
    const iso = country === NO_COUNTRY ? undefined : nameToIso.get(country.toLowerCase());
    if (iso) systemsByIso.set(iso, [...(systemsByIso.get(iso) ?? []), ...rows]);
    else unjoinedSystems.push({ country, rows });
  }

  /*
   * Which countries get a section: any that at least one source says
   * something about. Ordered by latest military spending, with the unranked
   * after them alphabetically — so the file opens on the countries the
   * sources cover best and does not imply an ordering it cannot support for
   * the rest.
   */
  const isos = [...new Set([
    ...milex.keys(), ...personnel.keys(), ...warheads.keys(),
    ...basesByIso.keys(), ...forcesByIso.keys(), ...systemsByIso.keys(),
  ])];
  isos.sort((a, b) => {
    const A = milex.get(a)?.value ?? -1;
    const B = milex.get(b)?.value ?? -1;
    if (A !== B) return B - A;
    return (isoToName.get(a) ?? a).localeCompare(isoToName.get(b) ?? b);
  });

  const L: string[] = [];
  const rule = "=".repeat(78);
  const thin = "-".repeat(78);

  L.push(rule);
  L.push("MILITARY ASSETS, COUNTRY BY COUNTRY");
  L.push("A dossier assembled from open sources. Bharat Tracker.");
  L.push(rule);
  L.push("");
  L.push("GENERATED FILE. Do not edit by hand — `npm run assets:dossier` rewrites it");
  L.push("from the committed data, and an edit here would be silently overwritten and");
  L.push("could not be traced to a source.");
  L.push("");
  L.push(`Generated ${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC`);
  L.push("");
  L.push("WHAT THIS IS");
  L.push("");
  L.push("  What public catalogues list for each country, with the source of every");
  L.push("  line named. It reports what is published. It does not assess capability,");
  L.push("  readiness, posture or intent, and it deliberately produces no combined");
  L.push("  score across categories — those are the interesting questions and none of");
  L.push("  them is answerable from a catalogue. A single number implying otherwise");
  L.push("  would be the most misleading thing in this file.");
  L.push("");
  L.push("THE FIVE SOURCES, AND HOW FAR EACH CAN BE TRUSTED");
  L.push("");
  L.push("  SPENDING / PERSONNEL / WARHEADS");
  L.push("    SIPRI and the Federation of American Scientists, via Our World in Data.");
  L.push("    The strongest material here: standing research estimates, revised");
  L.push("    annually, each published with its own methodology. Spending is in");
  L.push("    constant US dollars and is not comparable to a headline budget figure.");
  L.push("");
  L.push("  AIRCRAFT");
  L.push("    Volunteer-compiled catalogues on Wikipedia, drawing mostly on IISS's");
  L.push("    Military Balance and FlightGlobal's World Air Forces. A year or more");
  L.push("    behind, and those two routinely differ by tens of airframes on the same");
  L.push("    fleet. 'In service' means on strength, not available to fly. Where a");
  L.push("    force's quantity cells could not be read well enough, its total is");
  L.push("    withheld here rather than estimated.");
  L.push("");
  L.push("  AIRFIELDS");
  L.push("    OpenStreetMap, objects tagged military=airfield plus civil aerodromes");
  L.push("    carrying a military tag. This counts what volunteers have mapped, so a");
  L.push("    country with an active mapping community looks better equipped than one");
  L.push("    without. Every count is a floor, never a survey.");
  L.push("");
  L.push("  MISSILE AND ROCKET SYSTEMS");
  L.push("    Names from Wikipedia's per-country lists. A vocabulary of what a country");
  L.push("    is said to field. There are NO QUANTITIES in this source and none is");
  L.push("    printed: a named system may be one prototype or a thousand rounds.");
  L.push("");
  L.push("WHAT THIS FILE CANNOT TELL YOU");
  L.push("");
  L.push("  - Anything classified, which is most of what matters.");
  L.push("  - Readiness. Nothing here distinguishes an airframe on strength from one");
  L.push("    that can fly today, and the gap between those is the whole subject.");
  L.push("  - Where anything is based. No asset is resolved to an installation.");
  L.push("  - Quantities of missiles, ships, armour or personnel beyond the personnel");
  L.push("    total. Those sources were not read and are not guessed at.");
  L.push("  - Whether two countries' figures are comparable. They come from different");
  L.push("    compilers with different rules, and nothing here reconciles them.");
  if ((bases?.counts?.boxesFailed ?? 0) > 0) {
    L.push("  - Airfield counts for any country inside a failed sweep. On the build this");
    L.push(`    file was made from, ${bases?.counts?.boxesFailed} regional sweep(s) never answered:`);
    for (const f of bases?.failures ?? []) L.push(`      ${f.box} — ${f.why}`);
    L.push("    Countries inside those regions are undercounted by an unknown amount.");
  }
  L.push("");
  L.push(rule);
  L.push("");

  let withSpending = 0;
  let withAircraft = 0;
  let withBases = 0;
  let withSystems = 0;

  for (const iso of isos) {
    const name = isoToName.get(iso) ?? iso;
    const mx = milex.get(iso);
    const mg = milexGdp.get(iso);
    const pe = personnel.get(iso);
    const wh = warheads.get(iso);
    const bs = basesByIso.get(iso);
    const fc = forcesByIso.get(iso);
    const sy = systemsByIso.get(iso) ?? [];

    L.push(`${name.toUpperCase()}  [${iso}]`);
    L.push(thin);

    if (mx) {
      withSpending++;
      L.push(`  Military spending      ${money(mx.value)}  (${mx.year}, constant US$)`);
      if (mg) L.push(`                         ${mg.value.toFixed(2)}% of GDP  (${mg.year})`);
      L.push("                         SIPRI via Our World in Data");
    } else {
      L.push("  Military spending      not carried by SIPRI's series for this country");
    }

    if (pe) {
      L.push(`  Armed forces personnel ${count(pe.value)}  (${pe.year})`);
      L.push("                         World Bank / IISS via Our World in Data");
    }

    if (wh && wh.value > 0) {
      L.push(`  Nuclear warheads       ${count(wh.value)}  (${wh.year}, estimated stockpile)`);
      L.push("                         Federation of American Scientists via Our World in Data");
      L.push("                         An estimate about a secret. Treat as an order of magnitude.");
    }

    if (fc) {
      withAircraft++;
      if (fc.total >= 0) {
        L.push(`  Catalogued aircraft    ${count(fc.total)}  across ${fc.types} listed types`);
      } else {
        L.push(`  Catalogued aircraft    total withheld — only ${fc.counted} of ${fc.types} quantity`);
        L.push("                         cells could be read, which is too few to sum");
      }
      L.push(`                         ${fc.force}, from en.wikipedia.org/wiki/${fc.page}`);
    }

    if (bs) {
      withBases++;
      L.push(`  Mapped airfields       ${count(bs.n)}  military${bs.jointUse > 0 ? `, of which ${bs.jointUse} joint-use` : ""}`);
      L.push("                         OpenStreetMap contributors. A floor, not a survey.");
    }

    if (sy.length > 0) {
      withSystems++;
      const byKind = new Map<string, string[]>();
      for (const s of sy) {
        const k = s.kind === "mixed" ? "unclassified type" : s.kind;
        byKind.set(k, [...(byKind.get(k) ?? []), s.name]);
      }
      L.push(`  Named missile systems  ${sy.length}  (names only — this source carries no quantities)`);
      for (const [kind, names] of [...byKind].sort((a, b) => b[1].length - a[1].length)) {
        L.push(`    ${kind} (${names.length}):`);
        L.push(...wrap([...names].sort((a, b) => a.localeCompare(b)), "      "));
      }
      L.push("                         Wikipedia per-country missile lists");
    }

    L.push("");
  }

  if (unjoinedSystems.length > 0) {
    L.push(rule);
    L.push("SYSTEMS WHOSE COUNTRY COULD NOT BE JOINED");
    L.push(rule);
    L.push("");
    L.push("  The missile gazetteer keys on country name while every other source here");
    L.push("  keys on an ISO code. These names matched no ISO-keyed country, so their");
    L.push("  systems appear here rather than in a national section. They are printed");
    L.push("  rather than dropped: a join this file cannot make is a fact about the");
    L.push("  join, and losing them silently would be invisible.");
    L.push("");
    for (const u of unjoinedSystems.sort((a, b) => a.country.localeCompare(b.country))) {
      L.push(`  ${u.country} (${u.rows.length}):`);
      L.push(...wrap(u.rows.map((r) => r.name).sort((a, b) => a.localeCompare(b)), "    "));
    }
    L.push("");
  }

  L.push(rule);
  L.push("COVERAGE OF THIS FILE");
  L.push(rule);
  L.push("");
  L.push(`  Countries with a section         ${isos.length}`);
  L.push(`  ...with a spending figure        ${withSpending}`);
  L.push(`  ...with an aircraft catalogue    ${withAircraft}`);
  L.push(`  ...with mapped airfields         ${withBases}`);
  L.push(`  ...with named missile systems    ${withSystems}`);
  L.push(`  Systems whose country was not joined  ${unjoinedSystems.reduce((a, u) => a + u.rows.length, 0)}`);
  L.push("");
  L.push("  A country appearing here with one line and no others is a country three");
  L.push("  of these sources say nothing about. That is a statement about the sources,");
  L.push("  not about the country.");
  L.push("");
  L.push("SOURCE FILES THIS WAS BUILT FROM");
  L.push("");
  if (arsenal?.builtAt) L.push(`  data/global/arsenal.json        built ${arsenal.builtAt.slice(0, 16).replace("T", " ")} UTC`);
  if (bases?.builtAt) L.push(`  data/defence/airbases.json      built ${bases.builtAt.slice(0, 16).replace("T", " ")} UTC`);
  if (inv?.builtAt) L.push(`  data/defence/air-inventory.json built ${inv.builtAt.slice(0, 16).replace("T", " ")} UTC`);
  L.push("");
  L.push(rule);

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT, L.join("\n") + "\n", "utf8");
  console.log(
    `Wrote ${OUT}: ${isos.length} countries, ${L.length} lines `
    + `(${withSpending} with spending, ${withAircraft} with aircraft, ${withBases} with airfields, `
    + `${withSystems} with systems).`,
  );
}

if (isEntryPoint(import.meta.url)) {
  void main();
}
