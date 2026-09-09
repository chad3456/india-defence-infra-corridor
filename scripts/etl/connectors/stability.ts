/**
 * Protest, repression and state breakdown, for every country that reports.
 *
 * `npm run stability:ingest`. Reads eighteen country-year datasets from Our
 * World in Data — V-Dem's regime and civic-space measures, UCDP's conflict
 * deaths, GTD's terrorism deaths, and the economic context a fair comparison
 * needs — and reduces them to one file the report can carry.
 *
 * ── What this is for, and what it refuses to be ──────────────────────────
 *
 * It was asked for as a "useful idiot index": a score per country for how far
 * activism has captured it. That index is not built here and cannot be, because
 * there is no dataset behind it, no published definition to implement, and
 * nothing to validate it against. A number with those three properties is not a
 * measurement, it is an assertion wearing a decimal point — and it would be
 * pointed at named countries and named movements.
 *
 * What can be measured is measured. How much room a country gives to
 * association, expression and civil society; how strong its rule of law and
 * state capacity are; whether it is currently at war with itself and how many
 * people that is killing. Those are four separate published series from three
 * separate research groups, and the interesting questions are in how they move
 * against each other rather than in any composite of them.
 *
 * ── Column resolution ────────────────────────────────────────────────────
 *
 * Every value column is found by name from the header row, never by position.
 * OWID adds and reorders columns between refreshes — "World region according
 * to OWID" appears in some of these files and not others — and a positional
 * read would silently start publishing region strings as democracy scores.
 *
 * ── Rows that are not countries ──────────────────────────────────────────
 *
 * These files carry continents, income groups, "World", and OWID's own codes
 * for places without ISO3 (OWID_ABK for Abkhazia, OWID_KOS for Kosovo). Every
 * one of them would be a fake country in a country ranking, and "World" would
 * usually rank mid-table and look entirely plausible. Only three-letter
 * all-caps codes survive, and the count is checked against a floor.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "../lib/http";
import { isEntryPoint } from "../lib/entry";

const ROOT = process.cwd();
const OUT = join(ROOT, "data", "global", "stability.json");
const OWID = "https://ourworldindata.org/grapher";

interface Spec {
  id: string;
  slug: string;
  /** Exact header of the value column. Resolved by name, never by position. */
  column: string;
  label: string;
  /** What the number is, in the units the source uses. */
  unit: string;
  /** Which of the two halves of the question it speaks to. */
  family: "civic-space" | "state-capacity" | "breakdown" | "context";
  source: string;
  /**
   * Null wherever the direction is genuinely contested. Democracy indices are
   * not marked "higher is better" here — that is the argument the report is
   * about, and a field on a data file is the wrong place to settle it.
   */
  higherIsBetter: boolean | null;
}

const SPECS: Spec[] = [
  // ── How much room the country gives to dissent (V-Dem) ────────────────
  { id: "assoc", slug: "freedom-of-association-index", column: "Freedom of Association Index",
    label: "Freedom of association", unit: "0-1 index", family: "civic-space",
    source: "vdem", higherIsBetter: null },
  { id: "expr", slug: "freedom-of-expression-index", column: "Freedom of expression index",
    label: "Freedom of expression", unit: "0-1 index", family: "civic-space",
    source: "vdem", higherIsBetter: null },
  { id: "civsoc", slug: "civil-society-participation-index", column: "Civil society participation index",
    label: "Civil society participation", unit: "0-1 index", family: "civic-space",
    source: "vdem", higherIsBetter: null },
  { id: "elecdem", slug: "electoral-democracy-index", column: "Electoral democracy index",
    label: "Electoral democracy", unit: "0-1 index", family: "civic-space",
    source: "vdem", higherIsBetter: null },
  { id: "libdem", slug: "liberal-democracy-index", column: "Liberal democracy index",
    label: "Liberal democracy", unit: "0-1 index", family: "civic-space",
    source: "vdem", higherIsBetter: null },
  { id: "partdem", slug: "participatory-democracy-index", column: "Participatory democracy index",
    label: "Participatory democracy", unit: "0-1 index", family: "civic-space",
    source: "vdem", higherIsBetter: null },
  { id: "regime", slug: "political-regime", column: "Political regime",
    label: "Regime type", unit: "0-3 category", family: "civic-space",
    source: "vdem", higherIsBetter: null },

  // ── Whether the state can actually do things (V-Dem, Hanson & Sigman) ──
  { id: "rulelaw", slug: "rule-of-law-index", column: "Rule of Law index",
    label: "Rule of law", unit: "0-1 index", family: "state-capacity",
    source: "vdem", higherIsBetter: true },
  { id: "statecap", slug: "state-capacity-index", column: "State Capacity Index",
    label: "State capacity", unit: "standardised score", family: "state-capacity",
    source: "hanson-sigman", higherIsBetter: true },
  { id: "corrupt", slug: "political-corruption-index", column: "Political Corruption Index",
    label: "Political corruption", unit: "0-1 index", family: "state-capacity",
    source: "vdem", higherIsBetter: false },

  // ── Breakdown, by definitions somebody else defends ────────────────────
  { id: "wardeaths", slug: "deaths-in-armed-conflicts", column: "Best estimate",
    label: "Deaths in armed conflicts", unit: "deaths per year", family: "breakdown",
    source: "ucdp", higherIsBetter: false },
  { id: "intrastate", slug: "number-of-state-based-conflicts", column: "Non-internationalized intrastate",
    label: "Internal armed conflicts", unit: "count", family: "breakdown",
    source: "ucdp", higherIsBetter: false },
  { id: "terror", slug: "terrorism-deaths", column: "Fatalities",
    label: "Terrorism deaths", unit: "deaths per year", family: "breakdown",
    source: "gtd", higherIsBetter: false },

  // ── Context, because poverty predicts breakdown better than protest ────
  { id: "gdppc", slug: "gdp-per-capita-worldbank", column: "GDP per capita",
    label: "GDP per capita", unit: "international $", family: "context",
    source: "worldbank", higherIsBetter: true },
  { id: "pop", slug: "population", column: "Population",
    label: "Population", unit: "people", family: "context",
    source: "owid-population", higherIsBetter: null },
  { id: "lifeexp", slug: "life-expectancy", column: "Life expectancy",
    label: "Life expectancy", unit: "years", family: "context",
    source: "owid-lifeexp", higherIsBetter: true },
];

/**
 * Countries whose full trajectory the report draws, and why each is here.
 *
 * Chosen before looking at the data, from the case studies the report argues
 * about, so the selection cannot be quietly tuned to make a line look better.
 * Both sides of the ledger are represented on purpose: five where mass
 * mobilisation was followed by state breakdown, seven where it was followed by
 * a consolidated democracy, and India, which is the subject of the rest of
 * this site.
 *
 * Egypt and Sudan were added on the second pass, after the first draft of the
 * report listed five breakdown cases against seven consolidations. That
 * imbalance was not a finding, it was a gap in the list — both are textbook
 * sequences of mass mobilisation followed by state failure, and leaving them
 * out quietly flattered the optimistic column.
 */
const TRAJECTORY = [
  "SYR", "LBY", "YEM", "VEN", "UKR", "EGY", "SDN",        // mobilisation then breakdown
  "POL", "ZAF", "CHL", "PHL", "TUN", "IDN", "KOR", "LKA", // then consolidation
  "IND", "USA", "FRA",                                    // context and comparison
];

const TRAJECTORY_INDICATORS = ["elecdem", "assoc", "statecap", "wardeaths"];

/** A country code, not a continent, an income band, or "World". */
const ISO3 = /^[A-Z]{3}$/;

/** RFC 4180 enough for OWID: quoted fields, doubled quotes inside them. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

interface Row { iso3: string; name: string; year: number; value: number; region: string | null }

interface Parsed { rows: Row[]; read: number; column: string }

async function load(spec: Spec): Promise<Parsed | null> {
  const res = await getText(`${OWID}/${spec.slug}.csv`, { cacheMs: 12 * 60 * 60 * 1000, timeoutMs: 90_000 });
  if (!res.ok || !res.data) {
    console.log(`  FAILED ${spec.id}: ${res.error}`);
    return null;
  }
  const lines = res.data.split("\n");
  const header = parseCsvLine(lines[0] ?? "");

  // By name. A positional read would publish region strings as scores the
  // first time OWID reorders a file.
  const cValue = header.indexOf(spec.column);
  const cCode = header.indexOf("Code");
  const cYear = header.indexOf("Year");
  const cName = header.indexOf("Entity");
  const cRegion = header.findIndex((h) => /^World region/.test(h));
  if (cValue < 0 || cCode < 0 || cYear < 0 || cName < 0) {
    console.log(`  FAILED ${spec.id}: no column "${spec.column}" in [${header.join(" | ")}]`);
    return null;
  }

  const rows: Row[] = [];
  let read = 0;
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw) continue;
    read++;
    const f = parseCsvLine(raw);
    const code = (f[cCode] ?? "").trim();
    if (!ISO3.test(code)) continue;           // continents, income groups, World
    const v = Number(f[cValue]);
    if (!Number.isFinite(v)) continue;        // OWID leaves gaps empty
    const y = Number(f[cYear]);
    if (!Number.isFinite(y)) continue;
    rows.push({
      iso3: code, name: (f[cName] ?? "").trim(), year: y, value: v,
      region: cRegion >= 0 ? ((f[cRegion] ?? "").trim() || null) : null,
    });
  }
  return { rows, read, column: spec.column };
}

/** Three decimals for indices, whole numbers for counts of people. */
function round(v: number, unit: string): number {
  if (/index|score|category/.test(unit)) return Math.round(v * 1000) / 1000;
  if (/people|deaths|count/.test(unit)) return Math.round(v);
  return Math.round(v * 100) / 100;
}

export async function run(): Promise<void> {
  const latest = new Map<string, Record<string, { v: number; y: number }>>();
  const names = new Map<string, string>();
  const regions = new Map<string, string>();
  const trajectories: Record<string, Record<string, [number, number][]>> = {};
  const perIndicator: Record<string, { read: number; kept: number; countries: number; latestYear: number }> = {};
  let totalRead = 0, totalKept = 0;

  for (const spec of SPECS) {
    const parsed = await load(spec);
    if (!parsed) continue;
    totalRead += parsed.read;
    totalKept += parsed.rows.length;

    // Latest reading per country. OWID files are country-major and year-
    // ascending, but that is a property of today's file rather than a promise,
    // so the max is taken rather than the last row.
    const best = new Map<string, Row>();
    for (const r of parsed.rows) {
      const prev = best.get(r.iso3);
      if (!prev || r.year > prev.year) best.set(r.iso3, r);
      if (!names.has(r.iso3)) names.set(r.iso3, r.name);
      if (r.region && !regions.has(r.iso3)) regions.set(r.iso3, r.region);
    }
    for (const [iso3, r] of best) {
      const rec = latest.get(iso3) ?? {};
      rec[spec.id] = { v: round(r.value, spec.unit), y: r.year };
      latest.set(iso3, rec);
    }

    if (TRAJECTORY_INDICATORS.includes(spec.id)) {
      for (const iso3 of TRAJECTORY) {
        const series = parsed.rows
          .filter((r) => r.iso3 === iso3 && r.year >= 1960)
          .sort((a, b) => a.year - b.year)
          .map((r) => [r.year, round(r.value, spec.unit)] as [number, number]);
        if (series.length === 0) continue;
        (trajectories[iso3] ??= {})[spec.id] = series;
      }
    }

    perIndicator[spec.id] = {
      read: parsed.read,
      kept: parsed.rows.length,
      countries: best.size,
      latestYear: Math.max(...[...best.values()].map((r) => r.year)),
    };
    console.log(`  ok ${spec.id.padEnd(11)} ${String(parsed.rows.length).padStart(7)} rows  ${best.size} countries  to ${perIndicator[spec.id]!.latestYear}`);
  }

  const countries = [...latest.entries()]
    .map(([iso3, values]) => ({
      iso3,
      name: names.get(iso3) ?? iso3,
      region: regions.get(iso3) ?? null,
      values,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  /*
   * Self-checks. Every connector in this repo validates against something
   * externally verifiable, because a parse that silently reads the wrong
   * column produces a full, plausible, wrong file — and on this subject a
   * wrong file is a ranking of countries by an accusation.
   */
  const problems: string[] = [];
  if (countries.length < 150) problems.push(`only ${countries.length} countries, expected 150+`);

  const byDem = countries
    .filter((c) => c.values["elecdem"] !== undefined)
    .sort((a, b) => b.values["elecdem"]!.v - a.values["elecdem"]!.v);
  const top10 = byDem.slice(0, 10).map((c) => c.iso3);
  const bottom10 = byDem.slice(-10).map((c) => c.iso3);
  // Nordics at the top and North Korea/Eritrea at the bottom is the single
  // cheapest way to prove the democracy column is the democracy column.
  if (!top10.some((c) => ["NOR", "DNK", "SWE"].includes(c))) {
    problems.push(`no Nordic country in the democracy top 10: ${top10.join(",")}`);
  }
  if (!bottom10.some((c) => ["PRK", "ERI"].includes(c))) {
    problems.push(`neither North Korea nor Eritrea in the bottom 10: ${bottom10.join(",")}`);
  }

  // Syria's war deaths must peak in the war, not before it.
  const syr = trajectories["SYR"]?.["wardeaths"];
  if (syr && syr.length > 0) {
    const peak = syr.reduce((a, b) => (b[1] > a[1] ? b : a));
    if (peak[0] < 2011 || peak[0] > 2018) {
      problems.push(`Syria's deadliest year reads ${peak[0]}, outside the civil war`);
    }
  } else problems.push("no Syrian conflict-death trajectory");

  if (problems.length > 0) {
    console.error("\nSelf-checks failed:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`\nSelf-checks passed. Top by democracy: ${top10.slice(0, 3).join(", ")}. Bottom: ${bottom10.slice(-3).join(", ")}.`);

  await mkdir(join(ROOT, "data", "global"), { recursive: true });
  await writeFile(OUT, JSON.stringify({
    builtAt: new Date().toISOString(),
    observations: { read: totalRead, kept: totalKept },
    note: "Country-year values as published. No composite score is computed here, and none should be.",
    indicators: SPECS.map((s) => ({
      id: s.id, label: s.label, unit: s.unit, family: s.family,
      source: s.source, higherIsBetter: s.higherIsBetter,
      slug: s.slug, column: s.column,
      coverage: perIndicator[s.id] ?? null,
    })),
    countries,
    trajectories,
  }, null, 1) + "\n", "utf8");

  console.log(`\n${totalRead.toLocaleString()} rows read, ${totalKept.toLocaleString()} country-year values kept, ${countries.length} countries.`);
}

if (isEntryPoint(import.meta.url)) {
  run().catch((err) => { console.error(err); process.exit(1); });
}
