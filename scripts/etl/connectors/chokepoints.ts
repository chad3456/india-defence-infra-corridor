/**
 * What India has at stake in the Gulf, and what its drone trade actually is.
 *
 * `npm run chokepoints`. Writes data/global/chokepoints.json. CI only — the
 * editing sandbox's egress refuses comtradeapi.un.org outright.
 *
 * ── Why these two subjects share a connector ─────────────────────────────
 *
 * Because they are the two measurable halves of one position. India's
 * unmanned-aircraft fleet is bought, overwhelmingly from Israel and the United
 * States; India's oil arrives past Iran. A war between those two parties puts
 * India on both sides of its own supply chain, and that is a fact about trade
 * flows rather than an opinion about diplomacy — so it can be measured.
 *
 * Neither half narrates the war. Nothing in this repository sources a timeline
 * of it, and a page that inferred one from trade data would be inventing
 * history from arithmetic.
 *
 * ── The Strait, carefully ────────────────────────────────────────────────
 *
 * "Gulf oil" and "oil through Hormuz" are not the same quantity and the
 * difference is the whole nuance:
 *
 *   Iraq, Kuwait, Qatar, Bahrain and Iran load at terminals inside the Gulf.
 *   Every barrel leaves through the Strait. There is no alternative.
 *
 *   Saudi Arabia has the East–West pipeline to Yanbu on the Red Sea and the
 *   UAE has Habshan–Fujairah, which reaches the Gulf of Oman. Both are real
 *   and both are far smaller than those countries' total exports, so a Saudi
 *   or Emirati barrel is *probably* a Hormuz barrel and not certainly one.
 *
 *   Oman loads at Mina al-Fahal, which is on the Gulf of Oman — outside the
 *   Strait. Omani crude is Gulf crude in every headline and is not exposed.
 *
 * So this file emits three sets, not one, and the page must print which it is
 * using. `chokepoint: "locked"` is the number with no escape route.
 *
 * ── The drone figure will look absurd, and it is right ───────────────────
 *
 * HS 8806 did not exist before the 2022 tariff revision, and India's whole
 * declared trade under it is a few million dollars a year against a fleet of
 * Herons and Reapers. That gap is not an error in the data. Military airframes
 * arrive government-to-government, under offset and licensed-production
 * agreements, or as "aircraft parts" in chapter 88 — and none of those cross a
 * customs border as an unmanned aircraft. The heading measures the commercial
 * drone trade. It is carried because it is the only published, comparable,
 * country-by-country drone number there is, and it is labelled everywhere.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getJson } from "../lib/http";

const OUT = join(process.cwd(), "data/global/chokepoints.json");

const INDIA = 699;
const CAP = 500;
const MIN_GAP_MS = 1_300;
const BATCH = 120;

/**
 * The Gulf, by whether a barrel can leave any other way.
 *
 * `locked` means every export terminal is inside the Strait of Hormuz.
 * `bypass` means the country has a pipeline to open water, smaller than its
 * total exports. `outside` means the terminals are already past the Strait.
 */
export const GULF: Record<number, {
  name: string;
  chokepoint: "locked" | "bypass" | "outside";
  note: string;
}> = {
  364: { name: "Iran", chokepoint: "locked",
    note: "Kharg Island and the other export terminals are inside the Gulf." },
  368: { name: "Iraq", chokepoint: "locked",
    note: "Basra Oil Terminal and Khor al-Amaya are inside the Gulf. The Iraq–Turkey pipeline serves the north and has been out of service for years." },
  414: { name: "Kuwait", chokepoint: "locked", note: "Mina al-Ahmadi is inside the Gulf." },
  634: { name: "Qatar", chokepoint: "locked",
    note: "Ras Laffan is inside the Gulf. Qatar's LNG has no pipeline route out." },
  48: { name: "Bahrain", chokepoint: "locked", note: "Sitra is inside the Gulf." },
  682: { name: "Saudi Arabia", chokepoint: "bypass",
    note: "Ras Tanura is inside the Gulf; the East–West pipeline reaches Yanbu on the Red Sea. Bypass capacity is a fraction of total exports." },
  784: { name: "United Arab Emirates", chokepoint: "bypass",
    note: "Most terminals are inside the Gulf; the Habshan–Fujairah pipeline reaches the Gulf of Oman. Bypass capacity is a fraction of total exports." },
  512: { name: "Oman", chokepoint: "outside",
    note: "Mina al-Fahal is on the Gulf of Oman, already past the Strait. Omani crude is Gulf crude in every headline and is not exposed to this chokepoint." },
};

/** The two belligerents, as trading partners. */
const BELLIGERENTS: Record<number, string> = { 376: "Israel", 364: "Iran" };

/**
 * The energy lines, and what each one is.
 *
 * Crude is the headline. The gases are carried separately because Qatar is
 * India's largest LNG supplier and sits inside the Strait with no pipeline
 * alternative at all — a fact a crude-only chart hides completely.
 */
const ENERGY = [
  { code: "270900", label: "Crude petroleum", short: "Crude" },
  { code: "271111", label: "Natural gas, liquefied", short: "LNG" },
  { code: "271112", label: "Propane, liquefied", short: "Propane" },
  { code: "271113", label: "Butanes, liquefied", short: "Butane" },
] as const;

/** Refined products, the other direction: India sells these back out. */
/**
 * Refined products, asked at heading level.
 *
 * The first run asked for "271000" and got nothing, five years running, with
 * no error — because 2710 has no ".00" subheading: its six-digit lines are
 * 271012, 271019, 271020, 271091 and 271099. A code that does not exist
 * returns an empty answer that looks exactly like a country with no trade.
 * The heading is asked instead, which Comtrade accepts.
 */
const REFINED = { code: "2710", label: "Refined petroleum products", short: "Refined" };

const DRONES = { code: "8806", label: "Unmanned aircraft", short: "Drones" };

const ENERGY_YEARS = [2014, 2019, 2022, 2023, 2024] as const;
const BILATERAL_YEARS = [2014, 2017, 2019, 2022, 2023, 2024] as const;
const DRONE_YEARS = [2022, 2023, 2024] as const;

interface Row {
  reporterCode?: number; reporterDesc?: string;
  partnerCode?: number; partnerDesc?: string;
  cmdCode?: string; flowCode?: string;
  period?: string | number; primaryValue?: number;
}
interface Envelope { count?: number | null; data?: Row[] }
interface AreaRef { id?: string | number; text?: string; reporterCode?: number; reporterDesc?: string }

let lastCall = 0;
async function pace(): Promise<void> {
  const wait = MIN_GAP_MS - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

interface CallLog { what: string; url: string; ok: boolean; rows: number; error?: string }
const calls: CallLog[] = [];
let duplicates = 0;

async function ask(what: string, params: Record<string, string>): Promise<Row[] | null> {
  const qs = new URLSearchParams({
    partner2Code: "0", motCode: "0", customsCode: "C00", ...params,
  });
  const url = `https://comtradeapi.un.org/public/v1/preview/C/A/HS?${qs.toString()}`;
  await pace();
  const res = await getJson<Envelope>(url, { timeoutMs: 120_000, retries: 3, cacheMs: 0 });
  if (!res.ok || !res.data) {
    calls.push({ what, url: url.slice(0, 200), ok: false, rows: 0, error: res.error ?? "no data" });
    return null;
  }
  const rows = Array.isArray(res.data.data) ? res.data.data : [];
  if (rows.length >= CAP) {
    calls.push({ what, url: url.slice(0, 200), ok: false, rows: rows.length,
      error: `hit the ${CAP}-row cap — truncated and indistinguishable from complete` });
    return null;
  }
  calls.push({ what, url: url.slice(0, 200), ok: true, rows: rows.length });
  return rows;
}

async function areas(file: string, codeKey: string, descKey: string): Promise<number[]> {
  // Names are recorded as a side effect, because every caller needs them and
  // none of them should have to ask twice.
  const res = await getJson<{ results?: AreaRef[] } | AreaRef[]>(
    `https://comtradeapi.un.org/files/v1/app/reference/${file}`,
    { timeoutMs: 60_000, retries: 3, cacheMs: 0 },
  );
  if (!res.ok || !res.data) return [];
  const list = Array.isArray(res.data) ? res.data : (res.data.results ?? []);
  const out: number[] = [];
  const seen = new Set<number>();
  for (const r of list) {
    const raw = (r as Record<string, unknown>)[codeKey] ?? r.reporterCode ?? r.id;
    const name = (r as Record<string, unknown>)[descKey] ?? r.reporterDesc ?? r.text;
    const code = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
    if (!Number.isFinite(code) || code <= 0 || typeof name !== "string" || name === "") continue;
    if (seen.has(code)) continue;
    seen.add(code);
    if (!NAMES.has(code)) NAMES.set(code, name);
    out.push(code);
  }
  return out;
}

function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

export interface CountryValue { code: number; name: string; value: number }

/**
 * Code → name, from Comtrade's own reference files.
 *
 * The preview endpoint does not return reporterDesc or partnerDesc on every
 * call, and the first run of this connector fell back to String(code) for
 * every row — so the file came back complete, correct and unreadable, with
 * "643" where "Russian Federation" should have been. The reference files were
 * already being fetched for their codes; their names are now kept too.
 */
const NAMES = new Map<number, string>();

function fold(rows: Row[], key: "reporter" | "partner"): CountryValue[] {
  const out = new Map<number, CountryValue>();
  for (const r of rows) {
    const code = key === "reporter" ? r.reporterCode : r.partnerCode;
    if (typeof code !== "number" || code <= 0) continue;
    const name = (key === "reporter" ? r.reporterDesc : r.partnerDesc)
      ?? NAMES.get(code) ?? String(code);
    const v = typeof r.primaryValue === "number" ? r.primaryValue : 0;
    const prev = out.get(code);
    if (prev) { prev.value += v; duplicates++; continue; }
    out.set(code, { code, name, value: v });
  }
  return [...out.values()].filter((c) => c.value > 0).sort((a, b) => b.value - a.value);
}

interface EnergyYear { year: number; sources: CountryValue[]; total: number; batchesFailed: number }

async function main(): Promise<void> {
  const partnerCodes = await areas("partnerAreas.json", "PartnerCode", "PartnerDesc");
  const reporterCodes = (await areas("Reporters.json", "reporterCode", "reporterDesc"))
    .filter((c) => c < 899);
  console.log(`${partnerCodes.length} partners, ${reporterCodes.length} reporters`);
  if (partnerCodes.length === 0) {
    throw new Error("no partner universe — refusing to build an origin breakdown on a typed list");
  }
  const pBatches = chunk(partnerCodes, BATCH);
  const rBatches = chunk(reporterCodes, BATCH);

  /* ── Energy: where India's barrels and cargoes come from ─────────── */
  const energy: Array<{ code: string; label: string; short: string; years: EnergyYear[] }> = [];
  for (const line of [...ENERGY, REFINED]) {
    const years: EnergyYear[] = [];
    for (const year of ENERGY_YEARS) {
      // Refined product is asked on the export side: India sells it back out.
      const flow = line.code === REFINED.code ? "X" : "M";
      const got: CountryValue[] = [];
      let failed = 0;
      for (const [i, batch] of pBatches.entries()) {
        const rows = await ask(`${line.code} ${flow} ${year} partners[${i}]`, {
          reporterCode: String(INDIA), period: String(year), cmdCode: line.code,
          flowCode: flow, partnerCode: batch.join(","),
        });
        if (rows === null) { failed++; continue; }
        got.push(...fold(rows, "partner"));
      }
      // partnerCode 0 is "World": the total, not a country. Kept as the
      // denominator rather than left in a list of origins.
      const world = got.find((c) => c.code === 0)?.value ?? 0;
      // 0 is "World" — the total, not a country — and India-as-its-own-partner
      // is a re-import artefact of the residual codes, not an origin. Both are
      // dropped from a list of origins and the world figure is kept as the
      // denominator.
      const sources = got
        .filter((c) => c.code !== 0 && c.code !== INDIA)
        .sort((a, b) => b.value - a.value);
      const total = world > 0 ? world : sources.reduce((a, b) => a + b.value, 0);
      years.push({ year, sources, total, batchesFailed: failed });
      console.log(`  ${line.code} ${flow} ${year}: ${sources.length} partners, total ${(total / 1e9).toFixed(1)}bn, ${failed} failed`);
    }
    energy.push({ code: line.code, label: line.label, short: line.short, years });
  }

  /* ── India's own trade with the two belligerents ─────────────────── */
  const bilateral: Array<{ year: number; partners: Array<{ code: number; name: string; imports: number; exports: number }> }> = [];
  for (const year of BILATERAL_YEARS) {
    const partners: Array<{ code: number; name: string; imports: number; exports: number }> = [];
    for (const [code, name] of Object.entries(BELLIGERENTS)) {
      const rows = await ask(`TOTAL ${name} ${year}`, {
        reporterCode: String(INDIA), period: String(year), cmdCode: "TOTAL",
        flowCode: "M,X", partnerCode: code,
      });
      if (rows === null) continue;
      let imports = 0, exports = 0;
      for (const r of rows) {
        const v = typeof r.primaryValue === "number" ? r.primaryValue : 0;
        if (r.flowCode === "M") imports += v;
        else if (r.flowCode === "X") exports += v;
      }
      partners.push({ code: Number(code), name, imports, exports });
    }
    bilateral.push({ year, partners });
    console.log(`  bilateral ${year}: ${partners.map((p) => `${p.name} M${(p.imports / 1e9).toFixed(1)}bn X${(p.exports / 1e9).toFixed(1)}bn`).join("  ")}`);
  }

  /* ── Drones, worldwide and for India ─────────────────────────────── */
  const droneYears: Array<{ year: number; exporters: CountryValue[]; importers: CountryValue[]; batchesFailed: number }> = [];
  for (const year of DRONE_YEARS) {
    const acc: Record<"X" | "M", CountryValue[]> = { X: [], M: [] };
    let failed = 0;
    for (const flow of ["X", "M"] as const) {
      for (const [i, batch] of rBatches.entries()) {
        const rows = await ask(`8806 ${flow} ${year} reporters[${i}]`, {
          reporterCode: batch.join(","), period: String(year), cmdCode: DRONES.code,
          flowCode: flow, partnerCode: "0",
        });
        if (rows === null) { failed++; continue; }
        acc[flow].push(...fold(rows, "reporter"));
      }
    }
    acc.X.sort((a, b) => b.value - a.value);
    acc.M.sort((a, b) => b.value - a.value);
    droneYears.push({ year, exporters: acc.X, importers: acc.M, batchesFailed: failed });
    console.log(`  8806 ${year}: ${acc.X.length} exporters, ${acc.M.length} importers, ${failed} failed`);
  }

  let droneSources: CountryValue[] = [];
  let droneDests: CountryValue[] = [];
  let dronePartnerYear: number | null = null;
  for (const year of [...DRONE_YEARS].reverse()) {
    const got: Record<"M" | "X", CountryValue[]> = { M: [], X: [] };
    for (const flow of ["M", "X"] as const) {
      for (const [i, batch] of pBatches.entries()) {
        const rows = await ask(`8806 India ${flow} ${year} partners[${i}]`, {
          reporterCode: String(INDIA), period: String(year), cmdCode: DRONES.code,
          flowCode: flow, partnerCode: batch.join(","),
        });
        if (rows === null) continue;
        got[flow].push(...fold(rows, "partner"));
      }
    }
    if (got.M.length === 0 && got.X.length === 0) continue;
    droneSources = got.M.filter((c) => c.code !== 0 && c.code !== INDIA).sort((a, b) => b.value - a.value);
    droneDests = got.X.filter((c) => c.code !== 0 && c.code !== INDIA).sort((a, b) => b.value - a.value);
    dronePartnerYear = year;
    break;
  }
  console.log(`  8806 India partners (${dronePartnerYear ?? "none"}): ${droneSources.length} sources, ${droneDests.length} destinations`);

  const failedCalls = calls.filter((c) => !c.ok);
  const out = {
    builtAt: new Date().toISOString(),
    source:
      "UN Comtrade preview API (https://comtradeapi.un.org/public/v1/preview/C/A/HS), India as " +
      "reporter for the energy and bilateral series and every reporting country for HS 8806. " +
      "Annual, HS as reported, nominal US$, not deflated.",
    unit: "US$, nominal",
    gulf: GULF,
    names: Object.fromEntries([...NAMES].map(([k, v]) => [String(k), v])),
    chokepointNote:
      "Gulf-origin and Hormuz-transiting are different quantities. Iraq, Kuwait, Qatar, Bahrain " +
      "and Iran load only inside the Strait. Saudi Arabia and the UAE have pipelines to open " +
      "water whose capacity is a fraction of their exports, so their barrels are probably but " +
      "not certainly Hormuz barrels. Oman's terminals are already past the Strait. Any figure " +
      "for 'oil through Hormuz' must say which of the three sets it used.",
    droneNote:
      "HS 8806 is unmanned aircraft as customs sees them, and it did not exist before the 2022 " +
      "tariff revision. It is a commercial-drone measure. Military airframes arrive " +
      "government-to-government, under offset and licensed-production agreements, or as parts " +
      "in chapter 88, and none of those cross a border as an unmanned aircraft — which is why " +
      "India's whole declared 8806 trade is a few million dollars against a fleet of Herons and " +
      "Reapers. It is carried because it is the only published country-by-country drone trade " +
      "figure there is.",
    refusal:
      "This file contains no account of any conflict. It records trade flows and nothing else. " +
      "No causation is asserted between any figure here and any event: a fall in a country's " +
      "share between two sampled years may be a war, a price move, a refinery outage, a " +
      "sanctions regime or a long-run commercial shift, and annual customs data cannot " +
      "distinguish them. No shipping movement, insurance rate, tanker position or freight cost " +
      "appears here, because none is sourced.",
    caveats: [
      "Origin is country of consignment as India's customs record it, not the wellhead. A cargo lifted in one Gulf state, stored at Fujairah and re-sold arrives as whatever the last seller was.",
      "Years are sampled, not continuous. The gap between them is unmeasured.",
      "Values are nominal dollars. Crude is a price times a volume, and the price moved by a factor of three across this window — a falling dollar share can be a rising barrel count.",
      "HS 8806 exists only from 2022. There is no earlier drone trade series to compare against, at any level of effort.",
    ],
    years: { energy: ENERGY_YEARS, bilateral: BILATERAL_YEARS, drones: DRONE_YEARS },
    diagnostics: {
      calls: calls.length,
      failed: failedCalls.length,
      duplicateRowsSummed: duplicates,
      failures: failedCalls.slice(0, 40),
    },
    energy,
    bilateral,
    drones: {
      code: DRONES.code,
      label: DRONES.label,
      years: droneYears,
      indiaImportsBySource: droneSources,
      indiaExportsByDestination: droneDests,
      indiaPartnerYear: dronePartnerYear,
    },
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`\nWrote ${OUT}: ${calls.length} calls, ${failedCalls.length} failed, ${duplicates} duplicates.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
