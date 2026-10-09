/**
 * The electronics atlas: who exports each of 200+ electronics lines, and how
 * much of India's supply of each comes from China.
 *
 * `npm run atlas:ingest`. Writes data/trade/electronics-atlas.json. Runs in
 * GitHub Actions: the editing sandbox cannot reach comtradeapi.un.org.
 *
 * Three questions, each asked of UN Comtrade's free preview endpoint, for
 * every line in lib/electronics-catalogue.ts:
 *
 *   world     Every reporter's exports to the world, one year, two lines per
 *             call (about 130 reporters each — comfortably under the 500-row
 *             cap, so a full answer cannot be a truncated one). Gives the
 *             world total as the sum of reporters, China's and India's shares
 *             and ranks, and the leading exporters.
 *   india     India's own imports from the world and from China, a hundred
 *             lines per call: how much of India's supply of each line is
 *             Chinese, by India's customs.
 *   mirror    China's own exports to India for the same lines: the other end
 *             of the same trade, by China's customs. The two never match —
 *             imports are valued with freight and insurance, exports without,
 *             and goods routed through third countries are counted
 *             differently — and the page shows India's figure and keeps this
 *             one as the check.
 *
 * The year is the latest one in which nearly as many countries have reported
 * as the year before, so a half-reported year cannot pass for a whole one.
 *
 * The probe findings recorded in connectors/comtrade.ts hold here: pin
 * partner2Code, motCode and customsCode or rows split; one period per call;
 * a 500-row answer is treated as truncated and refused.
 *
 * The anonymous preview endpoint rations calls: after seventy-odd in quick
 * succession it answers 403 to everything for a while. So a 403 or 429 earns
 * a cooling-off pause and a retry, not a failure; if the endpoint stays shut
 * through every pause, the run stops asking and keeps what it has. Runs are
 * resumable: a line already fetched for the same year in the last 25 days is
 * not fetched again, so a daily schedule fills the atlas in over a few runs
 * and then costs nothing until the month turns.
 *
 * A line whose calls fail keeps the previous run's data; the file is never
 * written with fewer lines than it had.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getJson } from "../lib/http";
import { isEntryPoint } from "../lib/entry";
import { CATALOGUE } from "../../../lib/electronics-catalogue";
import type { AtlasLine, ElectronicsAtlas } from "../../../lib/electronics-atlas-shared";

const ROOT = process.cwd();
const OUT = join(ROOT, "data", "trade", "electronics-atlas.json");
const API = "https://comtradeapi.un.org/public/v1/preview/C/A/HS";
const REF_PARTNERS = "https://comtradeapi.un.org/files/v1/app/reference/partnerAreas.json";
const CHINA = 156;
const INDIA = 699;
const CAP = 500;
const GAP_MS = 1_500;
/** Pauses after a 403 or 429 before the same call is tried again. */
const COOL_MS = [70_000, 140_000, 280_000, 560_000];
/** A previous file younger than this, for the same year, is resumed rather than refetched. */
const FRESH_MS = 25 * 86_400_000;
/** Aggregates and non-places that would double-count a world total. */
const NOT_A_COUNTRY = new Set([0, 97, 290, 471, 472, 492, 527, 568, 577, 636, 637, 697, 837, 838, 839, 849, 879, 899]);

interface Row { reporterCode?: number; partnerCode?: number; cmdCode?: string; primaryValue?: number }

const errors: string[] = [];
let calls = 0;
let last = 0;
/** Set once the endpoint has stayed shut through every cooling-off pause. */
let exhausted = false;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function query(params: Record<string, string>, label: string): Promise<Row[] | null> {
  if (exhausted) { errors.push(`${label}: skipped — rate limit not lifted`); return null; }
  const qs = new URLSearchParams({ motCode: "0", customsCode: "C00", partner2Code: "0", ...params });
  let res: Awaited<ReturnType<typeof getJson<{ data?: Row[] }>>> | null = null;
  for (let cool = 0; ; cool++) {
    const wait = GAP_MS - (Date.now() - last);
    if (wait > 0) await sleep(wait);
    last = Date.now();
    calls++;
    res = await getJson<{ data?: Row[] }>(`${API}?${qs}`, { timeoutMs: 120_000, retries: 3, cacheMs: 0 });
    const limited = !res.ok && /HTTP (403|429)/.test(res.error ?? "");
    if (!limited) break;
    if (cool >= COOL_MS.length) { exhausted = true; break; }
    console.log(`  ${label}: ${res.error} — pausing ${COOL_MS[cool]! / 1000}s`);
    await sleep(COOL_MS[cool]!);
  }
  if (!res.ok || !res.data) { errors.push(`${label}: ${res.error ?? "no data"}`); return null; }
  const rows = Array.isArray(res.data.data) ? res.data.data : [];
  if (rows.length >= CAP) { errors.push(`${label}: hit the ${CAP}-row cap — refused as truncated`); return null; }
  const seen = new Set<string>();
  for (const r of rows) {
    const k = `${r.reporterCode}:${r.partnerCode}:${r.cmdCode}`;
    if (seen.has(k)) { errors.push(`${label}: duplicate ${k} — refused`); return null; }
    seen.add(k);
  }
  return rows;
}

function chunks<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

/** Reporters of world exports for the probe lines in a year. */
async function reporterCount(year: number): Promise<number> {
  const rows = await query({ partnerCode: "0", flowCode: "X", period: String(year), cmdCode: "851713,847130" }, `probe ${year}`);
  if (!rows) return 0;
  return new Set(rows.filter((r) => !NOT_A_COUNTRY.has(r.reporterCode ?? 0)).map((r) => r.reporterCode)).size;
}

export async function run(): Promise<void> {
  const previous: ElectronicsAtlas | null = existsSync(OUT) ? JSON.parse(await readFile(OUT, "utf8")) as ElectronicsAtlas : null;
  const namesRes = await getJson<{ results?: Array<{ id: number; text: string }> }>(REF_PARTNERS, { timeoutMs: 60_000, retries: 2 });
  const names = new Map<number, string>((namesRes.data?.results ?? []).map((r) => [r.id, r.text]));
  names.set(490, "Taiwan (as 'Other Asia, nes')");
  const universe = JSON.parse(await readFile(join(ROOT, "data", "trade", "hs6-universe.json"), "utf8")) as { names: Record<string, string> };

  // ── Which year: the latest that is nearly as fully reported as the one before.
  // A recent previous file fixes the year, so a resumed run spends no calls on it.
  const age = previous ? Date.now() - Date.parse(previous.generatedAt) : Infinity;
  const resume = previous !== null && age < FRESH_MS;
  const thisYear = new Date().getUTCFullYear();
  let year = resume ? previous!.year : thisYear - 2;
  if (!resume) {
    for (let y = thisYear - 1; y >= thisYear - 3; y--) {
      const n = await reporterCount(y);
      const before = await reporterCount(y - 1);
      console.log(`  ${y}: ${n} reporters; ${y - 1}: ${before}`);
      if (n > 0 && before > 0 && n >= before * 0.9) { year = y; break; }
    }
  }
  console.log(`using ${year}${resume ? " (resuming the previous run)" : ""}`);

  const codes = CATALOGUE.map((c) => c.hs);
  const kept: Record<string, AtlasLine> = previous && previous.year === year ? { ...previous.lines } : {};
  const todo = resume ? codes.filter((c) => !kept[c]) : codes;
  if (resume && todo.length === 0) { console.log("every line is already fetched for this year — nothing to do"); return; }
  console.log(`${todo.length} line(s) to fetch`);

  // ── India's imports from the world and from China, and China's exports to
  // India: a handful of calls for every line, so asked first.
  const imports = new Map<string, AtlasLine["indiaImports"]>();
  for (const batch of chunks(codes, 100)) {
    const rows = await query({ reporterCode: String(INDIA), partnerCode: `0,${CHINA}`, flowCode: "M", period: String(year), cmdCode: batch.join(",") }, `india imports ${batch[0]}…`);
    if (!rows) continue;
    for (const c of batch) {
      const w = rows.find((r) => String(r.cmdCode) === c && r.partnerCode === 0)?.primaryValue;
      const cn = rows.find((r) => String(r.cmdCode) === c && r.partnerCode === CHINA)?.primaryValue;
      imports.set(c, { year, world: typeof w === "number" ? w : null, china: typeof cn === "number" ? cn : (typeof w === "number" ? 0 : null) });
    }
    console.log(`  india imports ${batch.length} lines`);
  }
  const mirror = new Map<string, number>();
  for (const batch of chunks(codes, 200)) {
    const rows = await query({ reporterCode: String(CHINA), partnerCode: String(INDIA), flowCode: "X", period: String(year), cmdCode: batch.join(",") }, `china to india ${batch[0]}…`);
    if (!rows) continue;
    for (const c of batch) {
      const v = rows.find((r) => String(r.cmdCode) === c)?.primaryValue;
      if (typeof v === "number") mirror.set(c, v);
    }
    console.log(`  china to india ${batch.length} lines`);
  }

  // ── World: every reporter's exports. Three lines a call; a call that hits
  // the row cap is asked again one line at a time.
  const lines: Record<string, AtlasLine> = {};
  const worldOf = (c: string, rows: Row[]) => {
    const mine = rows.filter((r) => String(r.cmdCode) === c && typeof r.primaryValue === "number" && r.primaryValue > 0 && !NOT_A_COUNTRY.has(r.reporterCode ?? 0));
    if (mine.length === 0) { errors.push(`world ${c}: no reporters`); return; }
    mine.sort((a, b) => (b.primaryValue ?? 0) - (a.primaryValue ?? 0));
    const world = mine.reduce((s2, r) => s2 + (r.primaryValue ?? 0), 0);
    const rankOf = (m49: number) => { const i2 = mine.findIndex((r) => r.reporterCode === m49); return i2 < 0 ? null : i2 + 1; };
    lines[c] = {
      hs: c, year, reporters: mine.length, world,
      china: mine.find((r) => r.reporterCode === CHINA)?.primaryValue ?? 0, chinaRank: rankOf(CHINA),
      india: mine.find((r) => r.reporterCode === INDIA)?.primaryValue ?? 0, indiaRank: rankOf(INDIA),
      top: mine.slice(0, 6).map((r) => ({ m49: r.reporterCode!, name: names.get(r.reporterCode!) ?? `Reporter ${r.reporterCode}`, value: r.primaryValue! })),
      indiaImports: null, chinaToIndia: null,
    };
  };
  for (const batch of chunks(todo, 3)) {
    if (exhausted) break;
    const before = errors.length;
    const rows = await query({ partnerCode: "0", flowCode: "X", period: String(year), cmdCode: batch.join(",") }, `world ${batch}`);
    if (rows) { for (const c of batch) worldOf(c, rows); console.log(`  world ${batch.join(",")}`); continue; }
    if (!errors.slice(before).some((e) => e.includes("row cap"))) continue;
    for (const c of batch) {
      const one = await query({ partnerCode: "0", flowCode: "X", period: String(year), cmdCode: c }, `world ${c}`);
      if (one) { worldOf(c, one); console.log(`  world ${c}`); }
    }
  }

  const fresh = Object.keys(lines).length;
  // Lines not fetched this run keep what the previous run of the same year had.
  for (const c of codes) if (!lines[c] && kept[c]) lines[c] = kept[c]!;
  // The two India questions are re-asked every run; a failed one keeps the old answer.
  for (const c of codes) {
    const l = lines[c];
    if (!l) continue;
    l.indiaImports = imports.get(c) ?? kept[c]?.indiaImports ?? null;
    l.chinaToIndia = mirror.get(c) ?? kept[c]?.chinaToIndia ?? null;
  }
  const total = Object.keys(lines).length;
  const had = previous ? Object.keys(previous.lines).length : 0;
  if (fresh === 0 || total < had) throw new Error(`${fresh} fresh line(s), ${total} in all against ${had} before; keeping the previous file\n${errors.slice(0, 30).join("\n")}`);

  const officialNames = Object.fromEntries(codes.map((c) => [c, universe.names[c] ?? ""]));
  const out: ElectronicsAtlas = { generatedAt: new Date().toISOString(), year, lines, officialNames, calls, errors: errors.slice(0, 200) };
  await mkdir(join(ROOT, "data", "trade"), { recursive: true });
  await writeFile(OUT, JSON.stringify(out) + "\n", "utf8");
  console.log(`\nwrote ${OUT}: ${year}, ${fresh} fresh and ${total}/${codes.length} in all, ${calls} calls, ${errors.length} errors${exhausted ? " — stopped at the rate limit; the next run resumes" : ""}`);
  for (const e of errors.slice(0, 40)) console.log(`  ${e}`);
}

if (isEntryPoint(import.meta.url)) {
  run().catch((e) => { console.error(e); process.exit(1); });
}
