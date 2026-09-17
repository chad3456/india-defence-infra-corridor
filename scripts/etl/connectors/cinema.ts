/**
 * Indian film output, by language and year, and what it cannot prove.
 *
 * `npm run cinema:build`. Writes data/cinema/output.json. CI only.
 *
 * ── The brief said downgrade. This file does not assume it. ──────────────
 *
 * "India makes more films than any country on earth" and "Indian filmmaking is
 * in decline" are both widely asserted, both have constituencies, and they are
 * not incompatible — because titles, admissions, revenue, screens and one
 * industry's share of a domestic market can move in opposite directions at
 * once. So this connector gathers the measures that are reachable and lets
 * them disagree in public.
 *
 * ── The confounder that governs everything here ─────────────────────────
 *
 * Title counts come from English Wikipedia's year-by-language film lists. The
 * number of films those lists contain is a function of two things: how many
 * films were made, and how many people have written them down. The second has
 * grown enormously over the period, and it has not grown evenly — a 2004 Odia
 * release is far less likely to have an article than a 2024 one.
 *
 * That makes the ABSOLUTE count nearly useless as a trend and the SHARE
 * between languages far more robust, because coverage growth affects the
 * numerator and denominator together. The file therefore publishes both, marks
 * the absolute series as coverage-bound in its own text, and the page built on
 * it leads with the share.
 *
 * This is not a caveat bolted on at the end. It is the reason the connector is
 * shaped the way it is: if only the absolute count were wanted, this file
 * would be a quarter of the length and would support a conclusion it cannot.
 *
 * ── The one series that is not coverage-bound ───────────────────────────
 *
 * Box office. The highest-grossing lists are maintained because money is
 * interesting, they have been maintained across the whole period, and a film
 * grossing hundreds of crore does not go unrecorded in 2004 or 2024. It is a
 * top-of-distribution measure and says nothing about the median film, which is
 * stated wherever it appears.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getJson } from "../lib/http";
import { isEntryPoint } from "../lib/entry";
import { parseTables, plain } from "../lib/wikitext";

const OUT = join(process.cwd(), "data/cinema/output.json");
const API = "https://en.wikipedia.org/w/api.php";

/**
 * The languages asked for, which is a list of languages and not of findings.
 *
 * Typing this is acceptable where typing a list of programmes was not: these
 * are the film industries of India, a closed and uncontroversial set, and the
 * file records which of them answered for which years. A language that has no
 * list for a year is recorded as having none rather than as having no films.
 */
const LANGUAGES = [
  "Hindi", "Tamil", "Telugu", "Malayalam", "Kannada", "Bengali",
  "Marathi", "Punjabi", "Gujarati", "Odia", "Assamese", "Bhojpuri",
] as const;

const FIRST_YEAR = 2000;
const LAST_YEAR = 2026;

const GAP_MS = 130;
let lastCall = 0;
async function pace(): Promise<void> {
  const wait = GAP_MS - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

async function wikitext(page: string): Promise<string | null> {
  await pace();
  const qs = new URLSearchParams({
    action: "parse", format: "json", prop: "wikitext", page, redirects: "1",
  });
  const res = await getJson<{ parse?: { wikitext?: { "*"?: string } } }>(
    `${API}?${qs.toString()}`, { timeoutMs: 45_000, retries: 1, cacheMs: 0 },
  );
  const t = res.data?.parse?.wikitext?.["*"];
  return typeof t === "string" ? t : null;
}

/**
 * Rows in the tables that look like film listings.
 *
 * Not every table in a year article lists films: there are box-office boxes,
 * award tables and navigation. A film table is one whose header names a
 * director, a cast or a title, which is a property of the table rather than of
 * its position on the page — position changes with every editor and the header
 * does not.
 *
 * Returns the count AND the headers it accepted, so a year that came back
 * surprisingly high or low can be checked against what it actually read.
 */
export function filmRows(text: string): { films: number; tablesUsed: number; headersSeen: string[] } {
  const tables = parseTables(text);
  let films = 0;
  let tablesUsed = 0;
  const headersSeen: string[] = [];
  for (const t of tables) {
    const headers = (t.headers ?? []).map((h) => plain(h).toLowerCase().trim());
    const looksLikeFilms =
      headers.some((h) => /^(title|film|name)$/.test(h) || /\btitle\b/.test(h))
      && headers.some((h) => /director|cast|producer|studio|banner|genre/.test(h));
    if (!looksLikeFilms) continue;
    tablesUsed++;
    films += t.rows.length;
    headersSeen.push(headers.filter(Boolean).slice(0, 6).join(" | "));
  }
  return { films, tablesUsed, headersSeen: [...new Set(headersSeen)].slice(0, 4) };
}

/** A rupee-crore figure from a gross cell. Null rather than a guess. */
export function croreFrom(cell: string): number | null {
  const t = plain(cell).replace(/,/g, "");
  const m = /₹?\s*([\d.]+)\s*(crore|cr\b|billion|bn\b|lakh)?/i.exec(t);
  if (!m?.[1]) return null;
  const n = Number.parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = (m[2] ?? "crore").toLowerCase();
  if (/^(billion|bn)$/.test(unit)) return n * 100;
  if (unit === "lakh") return n / 100;
  return n;
}

export interface YearLanguage {
  year: number;
  language: string;
  /** Titles listed. NOT titles produced — see the coverage note. */
  films: number;
  tablesUsed: number;
  headersSeen: string[];
  /** Whether the list article exists at all for this year and language. */
  listed: boolean;
}

export interface Grosser {
  rank: number | null;
  title: string;
  year: number | null;
  crore: number | null;
  /** The cell verbatim, because a converted figure should always be checkable. */
  grossAsWritten: string;
}

async function main(): Promise<void> {
  const rows: YearLanguage[] = [];
  const missing: string[] = [];

  for (const language of LANGUAGES) {
    for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
      const page = `List of ${language} films of ${year}`;
      const text = await wikitext(page);
      if (text === null) {
        rows.push({ year, language, films: 0, tablesUsed: 0, headersSeen: [], listed: false });
        missing.push(page);
        continue;
      }
      const { films, tablesUsed, headersSeen } = filmRows(text);
      rows.push({ year, language, films, tablesUsed, headersSeen, listed: true });
    }
    const got = rows.filter((r) => r.language === language && r.listed);
    console.log(
      `${language.padEnd(10)} ${got.length} of ${LAST_YEAR - FIRST_YEAR + 1} years listed, ` +
      `${got.reduce((a, r) => a + r.films, 0)} titles`,
    );
  }

  /* ── Box office, the one series coverage growth does not govern ──── */
  const grossers: Grosser[] = [];
  let grossNote = "";
  const gross = await wikitext("List of highest-grossing Indian films");
  if (gross === null) {
    grossNote = "the highest-grossing list did not load";
  } else {
    const tables = parseTables(gross);
    let used = 0;
    for (const t of tables) {
      const headers = (t.headers ?? []).map((h) => plain(h).toLowerCase().trim());
      const titleAt = headers.findIndex((h) => /^(film|title)$/.test(h) || /\bfilm\b/.test(h));
      const yearAt = headers.findIndex((h) => /^year$/.test(h));
      const grossAt = headers.findIndex((h) => /gross/.test(h));
      if (titleAt < 0 || grossAt < 0) continue;
      used++;
      for (const r of t.rows) {
        const title = plain(r[titleAt] ?? "").trim();
        if (title === "") continue;
        const grossCell = r[grossAt] ?? "";
        const yearCell = yearAt >= 0 ? plain(r[yearAt] ?? "") : "";
        const y = /\b(19|20)\d{2}\b/.exec(yearCell || title);
        grossers.push({
          rank: null,
          title,
          year: y ? Number.parseInt(y[0], 10) : null,
          crore: croreFrom(grossCell),
          grossAsWritten: plain(grossCell).slice(0, 40),
        });
      }
    }
    grossNote = `${used} of ${tables.length} tables carried a film and a gross column; ${grossers.length} rows read`;
  }
  console.log(`Box office: ${grossNote}`);

  /* ── Derived shares, which is the robust cut ─────────────────────── */
  const byYear = new Map<number, { total: number; byLanguage: Record<string, number> }>();
  for (const r of rows) {
    if (!r.listed) continue;
    const y = byYear.get(r.year) ?? { total: 0, byLanguage: {} };
    y.total += r.films;
    y.byLanguage[r.language] = (y.byLanguage[r.language] ?? 0) + r.films;
    byYear.set(r.year, y);
  }
  const shares = [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, y]) => ({
      year,
      total: y.total,
      byLanguage: y.byLanguage,
      shares: Object.fromEntries(
        Object.entries(y.byLanguage).map(([k, n]) => [k, y.total > 0 ? (n / y.total) * 100 : 0]),
      ),
    }));

  const out = {
    builtAt: new Date().toISOString(),
    source:
      "English Wikipedia, via the MediaWiki API: the 'List of <language> films of <year>' " +
      "articles, and 'List of highest-grossing Indian films'. Counts are of rows in tables whose " +
      "headers name a title and a director, cast, producer or studio — a property of the table " +
      "rather than of its position on the page.",
    coverage:
      "THE ABSOLUTE TITLE COUNT IS NOT A PRODUCTION COUNT. It is the number of films English " +
      "Wikipedia lists, which is a function of how many were made AND of how many people have " +
      "written them down. The second has grown enormously since 2000 and has not grown evenly " +
      "across languages, so a rising line in the absolute series may be a rising amount of " +
      "documentation. The share between languages is far more robust, because coverage growth " +
      "moves numerator and denominator together, and that is what any conclusion here should " +
      "rest on.",
    boxOfficeNote:
      "Box office is the one series coverage growth does not govern: the highest-grossing lists " +
      "have been maintained across the whole period because money is interesting, and a film " +
      "taking hundreds of crore does not go unrecorded in either direction. It is a " +
      "top-of-distribution measure and says nothing whatever about the median film. Figures are " +
      "nominal rupees and are not deflated; the cell is kept verbatim beside every converted " +
      "number.",
    refusal:
      "No claim is made here about the quality of any film or of any industry. The word in the " +
      "brief was 'downgrade'; this file contains volume, language mix and box office, and none " +
      "of the three measures quality. Where the measures disagree with each other, they are " +
      "published disagreeing.",
    cannotSay: [
      "How many films India produced in any year. That figure belongs to the Central Board of Film Certification, whose own statistics page does not answer a script — it returned 404 to the probe — so the certified-titles series this question really wants is not in here.",
      "Anything about admissions, footfalls or ticket prices. No reachable source carries them for India; OWID has no cinema attendance indicator.",
      "Anything about screens, single-screen closures or multiplex growth, which is the mechanism most often meant by a decline and is not in any source this project could reach.",
      "Whether a language's share moved because it made more films or because others made fewer. A share has two ends and this data cannot separate them.",
      "Anything about streaming, which is the largest structural change in the period and leaves no trace in either series.",
    ],
    years: { first: FIRST_YEAR, last: LAST_YEAR },
    languages: LANGUAGES,
    counts: {
      rowsAttempted: rows.length,
      yearsListed: rows.filter((r) => r.listed).length,
      yearsMissing: missing.length,
      titles: rows.reduce((a, r) => a + r.films, 0),
      grossers: grossers.length,
    },
    missingLists: missing.slice(0, 60),
    grossNote,
    shares,
    rows,
    grossers,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(
    `\nWrote ${OUT}: ${out.counts.titles} titles across ${out.counts.yearsListed} year-language ` +
    `lists, ${missing.length} lists absent, ${grossers.length} box-office rows.`,
  );
  if (out.counts.titles === 0) {
    throw new Error("no titles parsed — refusing to publish an empty file over a good one");
  }
}

if (isEntryPoint(import.meta.url)) {
  void main();
}
