/**
 * Four pillars of the growth story, from the tables that carry them.
 *
 * Education, the defence industrial base, the space programme and digital
 * payments. All four were probed first; what follows reads only the tables the
 * probe confirmed exist, with the columns it reported.
 *
 * ── What each one is, and is not ─────────────────────────────────────────
 *
 * Literacy is a census measurement, so it is real and it is old — the last
 * completed census was 2011 and the 2021 round did not happen. A literacy map
 * is therefore a map of fifteen years ago, and saying "since 2014" over it
 * would be a lie about the data rather than a claim about India.
 *
 * The defence industry table gives founding years, which is the closest thing
 * to a startup count that exists here: a company founded after 2014 is a
 * company that did not exist before the policy did. It is a list of firms
 * someone thought notable enough to write down, not a registry, and the count
 * is a floor.
 *
 * Satellites give launch dates, so the series is launches per year — a real
 * cadence, and the one number about a space programme that cannot be spun.
 *
 * UPI gives volume and value per year, which is the clearest single series
 * about Indian digital infrastructure that anyone publishes.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "../lib/http";
import { parseTables, columnIndex, plain } from "../lib/wikitext";
import { isEntryPoint } from "../lib/entry";
import { resolveState } from "./elections";

const ROOT = process.cwd();
const OUT = join(ROOT, "data/pillars/pillars.json");
const WIKI = "https://en.wikipedia.org/w/index.php?action=raw&title=";

/** A number out of a cell, tolerating separators, footnotes and a % sign. */
function num(cell: string): number | null {
  const t = plain(cell).replace(/\[[^\]]*\]/g, "").replace(/[,%\s]/g, "");
  const m = /^-?\d+(\.\d+)?$/.exec(t);
  if (!m) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

/** The first four-digit year in a cell, which is how founding dates are written. */
function year(cell: string): number | null {
  const m = /\b(18\d{2}|19\d{2}|20\d{2})\b/.exec(plain(cell));
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1850 && y <= new Date().getUTCFullYear() + 1 ? y : null;
}

export interface LiteracyRow { state: string; byCensus: Record<string, number> }
export interface CompanyRow { name: string; founded: number | null; specialisation: string }
export interface YearRow { year: number; value: number }

interface Output {
  builtAt: string;
  sources: Record<string, string>;
  literacyByState: LiteracyRow[];
  /** Census years the literacy table actually carries. */
  censusYears: string[];
  defenceCompanies: CompanyRow[];
  satellitesByYear: YearRow[];
  upiVolumeMn: YearRow[];
  upiValueMn: YearRow[];
  rejected: Array<{ source: string; label: string; reason: string }>;
}

async function page(title: string): Promise<string | null> {
  const res = await getText(WIKI + encodeURIComponent(title), {
    timeoutMs: 45_000, retries: 2, cacheMs: 0,
  });
  await new Promise((r) => setTimeout(r, 800));
  return res.ok ? res.data : null;
}

export async function run(opts: { onProgress?: (s: string) => void } = {}): Promise<{ errors: string[] }> {
  const log = opts.onProgress ?? (() => {});
  const errors: string[] = [];
  const rejected: Output["rejected"] = [];
  await mkdir(join(ROOT, "data/pillars"), { recursive: true });

  const out: Output = {
    builtAt: new Date().toISOString(),
    sources: {
      literacy: "List of Indian states and union territories by literacy rate",
      defence: "Defence industry of India",
      satellites: "List of Indian satellites",
      upi: "Unified Payments Interface",
    },
    literacyByState: [], censusYears: [], defenceCompanies: [],
    satellitesByYear: [], upiVolumeMn: [], upiValueMn: [], rejected,
  };

  // ── Literacy, by state, across every census that published one ─────────
  const litWt = await page(out.sources.literacy!);
  if (litWt === null) errors.push("pillars: literacy page unreachable");
  else {
    const t = parseTables(litWt).find(
      (x) => columnIndex(x.headers, /^state/i) >= 0 &&
             x.headers.filter((h) => /^(19|20)\d{2}$/.test(h.trim())).length >= 3);
    if (!t) errors.push("pillars: no literacy table with a state column and census years");
    else {
      const cState = columnIndex(t.headers, /^state/i);
      const years = t.headers
        .map((h, i) => ({ h: h.trim(), i }))
        .filter((x) => /^(19|20)\d{2}$/.test(x.h));
      out.censusYears = years.map((y) => y.h);
      for (const row of t.rows) {
        const raw = plain(row[cState] ?? "").trim();
        if (raw === "") continue;
        const r = resolveState(raw);
        if (r.kind === "total") continue;
        if (r.kind === "refused") { rejected.push({ source: "literacy", label: raw, reason: r.reason }); continue; }
        const byCensus: Record<string, number> = {};
        for (const y of years) {
          const v = num(row[y.i] ?? "");
          // Literacy is a percentage. Anything outside 0-100 is a misread cell,
          // not a state where everyone reads twice.
          if (v !== null && v >= 0 && v <= 100) byCensus[y.h] = v;
        }
        if (Object.keys(byCensus).length === 0) {
          rejected.push({ source: "literacy", label: raw, reason: "no census column read as a percentage" });
          continue;
        }
        out.literacyByState.push({ state: r.state, byCensus });
      }
    }
  }

  // ── The defence industrial base, and when each firm started ────────────
  const defWt = await page(out.sources.defence!);
  if (defWt === null) errors.push("pillars: defence page unreachable");
  else {
    for (const t of parseTables(defWt)) {
      const cName = columnIndex(t.headers, /^name/i);
      const cEst = columnIndex(t.headers, /establish|founded/i);
      const cSpec = columnIndex(t.headers, /special/i);
      if (cName < 0 || cEst < 0) continue;
      for (const row of t.rows) {
        const name = plain(row[cName] ?? "").replace(/\[[^\]]*\]/g, "").trim();
        if (name === "") continue;
        out.defenceCompanies.push({
          name,
          founded: year(row[cEst] ?? ""),
          specialisation: cSpec >= 0 ? plain(row[cSpec] ?? "").slice(0, 90).trim() : "",
        });
      }
    }
  }

  // ── Satellites, counted by the year each went up ───────────────────────
  const satWt = await page(out.sources.satellites!);
  if (satWt === null) errors.push("pillars: satellites page unreachable");
  else {
    const perYear = new Map<number, number>();
    for (const t of parseTables(satWt)) {
      const cName = columnIndex(t.headers, /^name$/i);
      if (cName < 0) continue;
      // The launch date is not consistently headed across these tables, so it
      // is found by content: the first cell in the row carrying a full date.
      for (const row of t.rows) {
        if (plain(row[cName] ?? "").trim() === "") continue;
        const dated = row.map((c) => /\b\d{1,2}\s+\w+\s+(19|20)\d{2}\b/.test(plain(c)) ? year(c) : null)
          .find((y): y is number => y !== null);
        if (dated === undefined) continue;
        perYear.set(dated, (perYear.get(dated) ?? 0) + 1);
      }
    }
    out.satellitesByYear = [...perYear.entries()]
      .map(([year, value]) => ({ year, value }))
      .sort((a, b) => a.year - b.year);
  }

  // ── UPI, the clearest single series about digital infrastructure ───────
  const upiWt = await page(out.sources.upi!);
  if (upiWt === null) errors.push("pillars: UPI page unreachable");
  else {
    const t = parseTables(upiWt).find(
      (x) => columnIndex(x.headers, /^year$/i) >= 0 &&
             columnIndex(x.headers, /volume/i) >= 0);
    if (!t) errors.push("pillars: no UPI table with a year and a volume column");
    else {
      const cYear = columnIndex(t.headers, /^year$/i);
      const cVol = columnIndex(t.headers, /volume/i);
      const cVal = columnIndex(t.headers, /INR\s*value|value.*INR/i);
      for (const row of t.rows) {
        const y = year(row[cYear] ?? "");
        if (y === null) continue;
        const vol = num(row[cVol] ?? "");
        if (vol !== null) out.upiVolumeMn.push({ year: y, value: vol });
        if (cVal >= 0) {
          const val = num(row[cVal] ?? "");
          if (val !== null) out.upiValueMn.push({ year: y, value: val });
        }
      }
      out.upiVolumeMn.sort((a, b) => a.year - b.year);
      out.upiValueMn.sort((a, b) => a.year - b.year);
    }
  }

  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");

  const since2014 = out.defenceCompanies.filter((c) => c.founded !== null && c.founded >= 2014).length;
  log(`literacy: ${out.literacyByState.length} states across ${out.censusYears.join(", ")}`);
  log(`defence: ${out.defenceCompanies.length} companies, ${since2014} founded 2014 or later`);
  log(`satellites: ${out.satellitesByYear.length} years, ${out.satellitesByYear.reduce((s, r) => s + r.value, 0)} launches`);
  log(`UPI: ${out.upiVolumeMn.length} years of volume, ${out.upiValueMn.length} of value`);
  log(`refused: ${rejected.length}`);
  for (const r of rejected.slice(0, 10)) log(`  ${r.source}: ${r.label} — ${r.reason}`);
  return { errors };
}

if (isEntryPoint(import.meta.url)) {
  run({ onProgress: (s) => console.log(s) }).then((r) => {
    for (const e of r.errors) console.error("ERROR " + e);
    console.log(`\nwrote ${OUT}`);
  });
}
