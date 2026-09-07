/**
 * What India is watching, from what India paid to watch.
 *
 * The obvious source was the ticketing platforms and they are shut. BookMyShow,
 * District and Paytm each answered 403 — to a plainly identified pipeline and
 * to the browser-agent retry this project already does for publishers that
 * refuse bots. Going further would mean defeating bot protection rather than
 * reading a page, so this reads what is open instead.
 *
 * What is open turns out to be a better measure anyway. A showtime count says
 * how many screens a distributor booked; box office says how many people
 * actually went. Wikipedia's per-language film lists carry worldwide gross
 * tables that are updated through a film's run, and this project already
 * parses its tables.
 *
 * ── Where the trend comes from ───────────────────────────────────────────
 *
 * Gross is cumulative, so a single reading says how a film has done, not how
 * it is doing. The difference between today's and yesterday's is what it
 * earned today — which is the thing worth charting, and the thing nobody
 * publishes. So every run appends a snapshot and the trend is built from them.
 * Day one is one point. That is stated on the page rather than disguised.
 *
 * Daily earnings carry the weekly cinema cycle, so the reading compares whole
 * weeks; see lib/cinema-shared.ts for why anything else charts the calendar.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "../lib/http";
import { parseTables, columnIndex, plain } from "../lib/wikitext";
import { isEntryPoint } from "../lib/entry";
import { filmId } from "../../../lib/cinema-shared";

const ROOT = process.cwd();
const OUT = join(ROOT, "data/cinema/box-office.json");
const WIKI = "https://en.wikipedia.org/w/index.php?action=raw&title=";

const LANGUAGES = ["Hindi", "Tamil", "Telugu", "Malayalam", "Kannada"] as const;

interface Snapshot {
  /** ISO date the snapshot was taken. */
  date: string;
  /** Worldwide gross in rupees crore, as reported that day. */
  croreGross: number;
}

interface FilmRecord {
  id: string;
  title: string;
  language: string;
  year: number;
  /** Best rank seen on its language leaderboard, lower is better. */
  bestRank: number | null;
  snapshots: Snapshot[];
}

interface Output {
  builtAt: string;
  /** Every run that has contributed, so gaps in the trend are visible. */
  runs: string[];
  films: Record<string, FilmRecord>;
  /** Rows read but not kept, with the reason. Published, not swallowed. */
  rejected: Array<{ source: string; label: string; reason: string }>;
  /**
   * What the tables actually looked like on the last run.
   *
   * Written because this connector is parsing pages it cannot fetch from the
   * machine it is written on, and two rounds have now been lost to guessing at
   * a table's shape. One run with this in it settles what the next fix should
   * be.
   */
  shapes?: Array<{
    source: string;
    headers: string[];
    rowWidths: Record<string, number>;
    sampleRows: string[][];
  }>;
}

/**
 * Rupees crore from a wikitext cell.
 *
 * Indian box office is quoted in crore and occasionally in billions of rupees;
 * a few rows quote dollars. Dollars are refused rather than converted, because
 * converting needs the rate on the day of the report and nobody records which
 * day that was — a converted figure would be a number I made up to one
 * significant figure.
 */
/**
 * Languages, which appear as a column on the cross-language list and are the
 * commonest thing to mistake for a title when the columns are off by one.
 */
const LANGUAGE_NAMES = new Set([
  "hindi", "tamil", "telugu", "malayalam", "kannada", "english", "marathi",
  "bengali", "punjabi", "gujarati", "odia", "assamese", "bhojpuri", "tulu",
]);

/**
 * Is this cell plausibly a film title, or is it a column we landed on by
 * mistake?
 *
 * The first run answered "Mythri Movie Makers" and "Telugu" when asked for
 * films, because a spanning header row had shifted every column by one. The
 * parser no longer does that, but a lexical check costs nothing and the
 * failure it guards is silent: a studio in a title column still looks like a
 * row.
 */
export function looksLikeTitle(title: string): { ok: true } | { reason: string } {
  const t = title.trim();
  if (t === "") return { reason: "empty" };
  if (LANGUAGE_NAMES.has(t.toLowerCase())) {
    return { reason: "this is a language, so the title column is misaligned" };
  }
  if (/\b(productions?|pictures|studios?|entertainments?|cinemas?|movie makers|films?)\b/i.test(t)
      && !/[:!?]/.test(t)) {
    return { reason: "this names a production house, so the title column is misaligned" };
  }
  return { ok: true };
}

export function parseCroreGross(cell: string): { crore: number } | { reason: string } {
  const t = plain(cell).replace(/\[[^\]]*\]/g, "").replace(/&nbsp;/g, " ").trim();
  if (t === "" || /^[-–—]$/.test(t)) return { reason: "empty" };
  if (/\$|US\s*\$|USD/i.test(t)) return { reason: "quoted in dollars; no rate for the day it was reported" };

  const num = t.replace(/[₹,]/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!num) return { reason: "no number in the cell" };
  const v = Number(num[1]);
  if (!Number.isFinite(v) || v <= 0) return { reason: "not a positive number" };

  if (/crore/i.test(t)) return { crore: v };
  if (/billion/i.test(t)) return { crore: v * 100 };        // 1 billion rupees = 100 crore
  if (/lakh/i.test(t)) return { crore: v / 100 };
  if (/million/i.test(t)) return { crore: v / 10 };         // 1 million rupees = 0.1 crore
  return { reason: `no unit named alongside "${t.slice(0, 30)}"` };
}

export async function run(opts: { onProgress?: (s: string) => void } = {}): Promise<{ errors: string[] }> {
  const log = opts.onProgress ?? (() => {});
  const errors: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const year = new Date().getUTCFullYear();
  await mkdir(join(ROOT, "data/cinema"), { recursive: true });

  let out: Output = { builtAt: "", runs: [], films: {}, rejected: [] };
  try {
    out = JSON.parse(await readFile(OUT, "utf8")) as Output;
  } catch { /* first run */ }
  out.rejected = [];   // diagnostics describe this run, not every run ever
  out.shapes = [];

  const pages: Array<{ title: string; language: string | null }> = [
    { title: `List of Indian films of ${year}`, language: null },
    ...LANGUAGES.map((l) => ({ title: `List of ${l} films of ${year}`, language: l })),
  ];

  let kept = 0;
  let fellBack = 0;
  for (const page of pages) {
    const res = await getText(WIKI + encodeURIComponent(page.title), {
      timeoutMs: 45_000, retries: 2, cacheMs: 0,
    });
    if (!res.ok || res.data === null) {
      errors.push(`cinema: ${page.title}: ${res.error ?? "no body"}`);
      log(`  FAIL ${page.title}: ${res.error}`);
      continue;
    }

    // The leaderboard is the table naming a title and a worldwide gross. The
    // release calendars name a title too, which is why the gross column is
    // required rather than merely preferred.
    const tables = parseTables(res.data).filter(
      (t) => columnIndex(t.headers, /^title$/i) >= 0 &&
             columnIndex(t.headers, /worldwide\s+gross/i) >= 0,
    );
    if (tables.length === 0) {
      errors.push(`cinema: ${page.title}: no table naming a title and a worldwide gross`);
      log(`  FAIL ${page.title}: leaderboard table not found`);
      continue;
    }

    let pageKept = 0;
    for (const table of tables) {
      // If most of a table's rows are refused, the table was misread rather
      // than being full of unusual films — keeping the few that slipped
      // through would publish exactly the rows a misalignment happens to make
      // look valid. Counted first, applied before anything is written.
      let tableSeen = 0, tableUsable = 0;
      const cTitle = columnIndex(table.headers, /^title$/i);
      const cGross = columnIndex(table.headers, /worldwide\s+gross/i);
      const cRank = columnIndex(table.headers, /^rank$/i);
      const cLang = columnIndex(table.headers, /^language$/i);

      const widths: Record<string, number> = {};
      for (const r of table.rows) widths[String(r.length)] = (widths[String(r.length)] ?? 0) + 1;
      out.shapes!.push({
        source: page.title,
        headers: table.headers,
        rowWidths: widths,
        sampleRows: table.rows.slice(0, 3).map((r) => r.map((c) => plain(c).slice(0, 40))),
      });

      const usable: Array<{ title: string; crore: number; row: string[] }> = [];
      for (const row of table.rows) {
        const title = plain(row[cTitle] ?? "").replace(/\[[^\]]*\]/g, "").trim();
        if (title === "") continue;
        tableSeen++;

        const named = looksLikeTitle(title);
        if ("reason" in named) {
          out.rejected.push({ source: page.title, label: title, reason: named.reason });
          continue;
        }
        // The named column first. Where a table uses rowspan, later rows carry
        // fewer cells than the header describes and every positional index
        // after the span is wrong — so when the named cell yields nothing,
        // look for the one cell in the row that reads as a gross. Exactly one,
        // or none: two candidates mean the row is ambiguous and a guess would
        // be indistinguishable from a reading.
        let gross = parseCroreGross(row[cGross] ?? "");
        if ("reason" in gross) {
          const candidates = row
            .map((c) => parseCroreGross(c))
            .filter((r): r is { crore: number } => "crore" in r);
          if (candidates.length === 1) {
            gross = candidates[0]!;
            fellBack++;
          } else {
            out.rejected.push({
              source: page.title, label: title,
              reason: candidates.length === 0
                ? gross.reason
                : `${candidates.length} cells in the row read as a gross; ambiguous`,
            });
            continue;
          }
        }
        tableUsable++;
        usable.push({ title, crore: gross.crore, row });
      }

      if (tableSeen >= 3 && tableUsable / tableSeen < 0.4) {
        errors.push(`cinema: ${page.title}: a table yielded ${tableUsable} usable rows of ${tableSeen}; treated as misread`);
        log(`  SKIP a table on ${page.title}: ${tableUsable}/${tableSeen} rows usable — misread, not kept`);
        continue;
      }

      for (const { title, crore, row } of usable) {
        const gross = { crore };

        // Language comes from the column when the table has one, otherwise
        // from the page. A cross-language list without a language column would
        // otherwise silently inherit whichever page it came from.
        const language = cLang >= 0
          ? (plain(row[cLang] ?? "").trim() || page.language)
          : page.language;
        if (!language) {
          out.rejected.push({ source: page.title, label: title, reason: "no language, on a page that does not imply one" });
          continue;
        }

        const id = filmId(title, year);
        const existing = out.films[id];
        const rank = cRank >= 0 ? Number(plain(row[cRank] ?? "").replace(/\D/g, "")) : NaN;

        if (existing) {
          // One snapshot per film per day. A film listed on both its language
          // page and the all-India page must not be counted twice.
          const already = existing.snapshots.find((s) => s.date === today);
          if (already) already.croreGross = Math.max(already.croreGross, gross.crore);
          else existing.snapshots.push({ date: today, croreGross: gross.crore });
          if (Number.isFinite(rank)) {
            existing.bestRank = existing.bestRank === null ? rank : Math.min(existing.bestRank, rank);
          }
        } else {
          out.films[id] = {
            id, title, language, year,
            bestRank: Number.isFinite(rank) ? rank : null,
            snapshots: [{ date: today, croreGross: gross.crore }],
          };
        }
        pageKept++;
      }
    }
    kept += pageKept;
    log(`  ${page.title}: ${tables.length} leaderboard table(s), ${pageKept} row(s) kept`);
    await new Promise((r) => setTimeout(r, 900));
  }

  if (!out.runs.includes(today)) out.runs.push(today);
  out.runs.sort();
  out.builtAt = new Date().toISOString();

  const films = Object.values(out.films);
  const withTrend = films.filter((f) => f.snapshots.length >= 8).length;
  log(`films held: ${films.length}; rows kept this run: ${kept}; refused: ${out.rejected.length}`);
  if (fellBack > 0) log(`  ${fellBack} row(s) read their gross by searching the row, not by the named column`);
  for (const sh of out.shapes ?? []) {
    log(`  shape ${sh.source}: headers[${sh.headers.length}] ${sh.headers.join(" | ").slice(0, 120)}`);
    log(`         row widths ${JSON.stringify(sh.rowWidths)}`);
    for (const r of sh.sampleRows) log(`         row: ${r.join(" | ").slice(0, 150)}`);
  }
  log(`runs recorded: ${out.runs.length}; films with enough history for a trend: ${withTrend}`);
  for (const r of out.rejected.slice(0, 12)) log(`    refused ${r.label}: ${r.reason}`);

  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  return { errors };
}

if (isEntryPoint(import.meta.url)) {
  run({ onProgress: (s) => console.log(s) }).then((r) => {
    for (const e of r.errors) console.error("ERROR " + e);
    console.log(`\nwrote ${OUT}`);
  });
}
