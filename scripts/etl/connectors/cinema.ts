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

  const pages: Array<{ title: string; language: string | null }> = [
    { title: `List of Indian films of ${year}`, language: null },
    ...LANGUAGES.map((l) => ({ title: `List of ${l} films of ${year}`, language: l })),
  ];

  let kept = 0;
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
      const cTitle = columnIndex(table.headers, /^title$/i);
      const cGross = columnIndex(table.headers, /worldwide\s+gross/i);
      const cRank = columnIndex(table.headers, /^rank$/i);
      const cLang = columnIndex(table.headers, /^language$/i);

      for (const row of table.rows) {
        const title = plain(row[cTitle] ?? "").replace(/\[[^\]]*\]/g, "").trim();
        if (title === "") continue;

        const gross = parseCroreGross(row[cGross] ?? "");
        if ("reason" in gross) {
          out.rejected.push({ source: page.title, label: title, reason: gross.reason });
          continue;
        }

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
