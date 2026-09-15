/**
 * Where the world's chips are actually made, and where India stands in it.
 *
 * `npm run semi:world`. Writes data/semi/world.json. Runs in CI only — the
 * editing sandbox's egress refuses comtradeapi.un.org outright, so a local run
 * would report a fact about the sandbox and nothing about the source.
 *
 * ── The gap this fills ───────────────────────────────────────────────────
 *
 * data/semi/trade.json is India as reporter with partner pinned to 0, i.e. the
 * world. It can say how large India's chip bill is and how fast it grew. It
 * cannot say a single thing about anyone else, and it cannot say where one
 * dollar of that bill goes, because the partner dimension was deliberately
 * collapsed to keep the six-thousand-line HS6 ingest under the row cap.
 *
 * So the semiconductor story could compare India only to its own past. Three
 * questions it could not touch:
 *
 *   Who sells the chips?          reporter=every country, partner=world
 *   Who does India buy them from? reporter=India,        partner=every country
 *   Who sells the machines that   the same two, on HS 8486 — the tools that
 *   make the chips?               make wafers, a market narrower than the
 *                                 chip market itself and a better measure of
 *                                 who holds the capability rather than the
 *                                 assembly step.
 *
 * ── Why 8486 is in here and matters more than it looks ───────────────────
 *
 * 8542 counts chips crossing a border. A country that imports wafers, packages
 * them and re-exports scores on 8542 without owning any of the hard part;
 * that is precisely the stage India is entering, and a chart of 8542 exports
 * alone would read it as fabrication. 8486 is the lithography, deposition and
 * etch equipment. Almost nobody exports it — the concentration in that line is
 * the cleanest published evidence of where the capability sits, and it is the
 * line on which India is nearest to zero.
 *
 * ── Row cap discipline, inherited ────────────────────────────────────────
 *
 * The free preview tier caps at 500 rows and does not say it truncated. Every
 * request here is shaped so a complete answer is provably under the cap, and a
 * response at or above it is recorded as a failure rather than used. Reporters
 * are batched; one commodity and one flow per call. See comtrade.ts, which
 * learnt all of this the hard way.
 *
 * ── Self-describing ──────────────────────────────────────────────────────
 *
 * The artifact records the reporter list it was given, the batch sizes, the row
 * counts returned, and every failed call with its reason. The next guess about
 * this endpoint should be a reading of the last run, not a guess.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getJson } from "../lib/http";

const OUT = join(process.cwd(), "data/semi/world.json");

const INDIA = 699;
const CAP = 500;
const MIN_GAP_MS = 1_300;
/** Reporters per call. One commodity, one flow, so rows ≤ this. */
const BATCH = 120;

/**
 * The commodities, and what each one is evidence of.
 *
 * Deliberately three, not thirty. Each is a heading whose meaning survives
 * the HS revisions in the window, and each answers a different question about
 * the same industry.
 */
const LINES = [
  {
    code: "8542",
    label: "Electronic integrated circuits",
    short: "Chips",
    means: "Finished integrated circuits crossing a border. The headline chip trade line, and the one that counts a packaged import the same as a fabricated one.",
  },
  {
    code: "8486",
    label: "Machines for making semiconductor devices",
    short: "Fab equipment",
    means: "The lithography, deposition, etch and test tools that a fab is built out of. A far narrower market than chips, and the sharpest published proxy for who holds fabrication capability rather than assembly.",
  },
  {
    code: "8541",
    label: "Diodes, transistors, photosensitive devices",
    short: "Discretes & solar",
    means: "Discrete semiconductor devices — and, from 2017, mostly photovoltaic cells. Carried because it is genuinely semiconductor physics, flagged because charting it as chips would show a solar surge and call it a chip dependency.",
  },
] as const;

/** Years. Three, not eleven: this is a cross-section, not a trend line. */
const YEARS = [2014, 2019, 2024] as const;

interface Row {
  reporterCode?: number;
  reporterDesc?: string;
  partnerCode?: number;
  partnerDesc?: string;
  cmdCode?: string;
  flowCode?: string;
  period?: string | number;
  primaryValue?: number;
}
interface Envelope { count?: number | null; data?: Row[] }

interface ReporterRef { id?: string | number; text?: string; reporterCode?: number; reporterDesc?: string }

let lastCall = 0;
async function pace(): Promise<void> {
  const wait = MIN_GAP_MS - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

/**
 * Codes in these rankings that are not one country.
 *
 * Comtrade's reporter list mixes countries with aggregates and with political
 * compromises, and three of them sit in the top ten of the chip trade. Left
 * unannotated they would be read as countries, and two of the most important
 * facts in this data would be invisible:
 *
 *   490 "Other Asia, nes" is Taiwan. The second largest chip exporter on earth
 *       has no name in United Nations trade statistics, because it has no seat.
 *       A ranking that prints the label verbatim tells the reader nothing; one
 *       that silently renames it asserts more than the source does. Both the
 *       code's own label and what it denotes are carried here.
 *
 *    97 "European Union" is an aggregate whose members are also reporters, so
 *       a ranking containing both double-counts. It is kept and flagged rather
 *       than dropped, because dropping it silently would make the EU vanish
 *       from a chart where it is genuinely the fourth largest seller of fab
 *       equipment.
 *
 *   344 Hong Kong is a country in this data and an entrepôt in reality: it is
 *       the largest chip exporter and the second largest importer, and it
 *       fabricates none. That is not a data error — it is the clearest
 *       available demonstration that an 8542 export is a shipment, not a
 *       wafer.
 */
export const NOT_ONE_COUNTRY: Record<number, { label: string; kind: "aggregate" | "unnamed" | "entrepot"; note: string }> = {
  97: { label: "European Union", kind: "aggregate",
    note: "An aggregate of member states that also report separately. Any ranking containing both double-counts." },
  490: { label: "Other Asia, nes", kind: "unnamed",
    note: "Comtrade's code for Taiwan, which has no UN seat and therefore no name in these statistics. Overwhelmingly Taiwanese trade." },
  344: { label: "China, Hong Kong SAR", kind: "entrepot",
    note: "A trans-shipment port. Chips pass through and are counted both in and out; almost none are fabricated there." },
  837: { label: "Bunkers", kind: "aggregate", note: "Ship and aircraft stores, not a territory." },
  838: { label: "Free Zones", kind: "aggregate", note: "Free-zone trade, not a territory." },
  839: { label: "Special Categories", kind: "aggregate", note: "Unallocated, not a territory." },
  899: { label: "Areas, nes", kind: "aggregate", note: "Unallocated residual." },
};

/**
 * The partner universe, from Comtrade's own reference file.
 *
 * `partnerCode=all` is a 400. The first run of this connector assumed it was
 * accepted because `reporterCode` takes a list and the docs read as though the
 * two behave alike; every India-by-partner call failed and the whole partner
 * dimension came back empty while the rest of the file looked complete. So the
 * partner list is fetched and batched exactly like the reporter list.
 */
async function partners(): Promise<{ codes: number[]; names: Map<number, string>; note: string }> {
  const url = "https://comtradeapi.un.org/files/v1/app/reference/partnerAreas.json";
  const res = await getJson<{ results?: ReporterRef[] } | ReporterRef[]>(url, {
    timeoutMs: 60_000, retries: 3, cacheMs: 0,
  });
  if (!res.ok || !res.data) return { codes: [], names: new Map(), note: `partner reference failed: ${res.error ?? "no body"}` };
  const list = Array.isArray(res.data) ? res.data : (res.data.results ?? []);
  const codes: number[] = [];
  const names = new Map<number, string>();
  for (const r of list) {
    const raw = (r as { PartnerCode?: number }).PartnerCode ?? r.reporterCode ?? r.id;
    const code = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
    const name = (r as { PartnerDesc?: string }).PartnerDesc ?? r.reporterDesc ?? r.text ?? "";
    if (!Number.isFinite(code) || code <= 0 || name === "") continue;
    if (names.has(code)) continue;
    names.set(code, name);
    codes.push(code);
  }
  return { codes, names, note: `${codes.length} partners from the reference file` };
}

/**
 * The reporter universe, from Comtrade's own reference file.
 *
 * Not a hand-typed list of M49 codes. A hand-typed list is a silent filter:
 * whatever is missing from it is missing from the answer, and nothing in the
 * output would show the absence. Asking the source which reporters exist means
 * the only countries missing from a ranking are countries that did not report.
 */
async function reporters(): Promise<{ codes: number[]; names: Map<number, string>; note: string }> {
  const url = "https://comtradeapi.un.org/files/v1/app/reference/Reporters.json";
  const res = await getJson<{ results?: ReporterRef[] } | ReporterRef[]>(url, {
    timeoutMs: 60_000, retries: 3, cacheMs: 0,
  });
  if (!res.ok || !res.data) {
    return { codes: [], names: new Map(), note: `reference fetch failed: ${res.error ?? "no body"}` };
  }
  const list = Array.isArray(res.data) ? res.data : (res.data.results ?? []);
  const codes: number[] = [];
  const names = new Map<number, string>();
  for (const r of list) {
    const raw = r.reporterCode ?? r.id;
    const code = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
    const name = r.reporterDesc ?? r.text ?? "";
    if (!Number.isFinite(code) || code <= 0 || name === "") continue;
    // 0 is "World" and the 97x/98x block is special aggregates, not countries.
    if (code >= 899) continue;
    if (names.has(code)) continue;
    names.set(code, name);
    codes.push(code);
  }
  return { codes, names, note: `${codes.length} reporters from the reference file` };
}

interface CallLog {
  what: string;
  url: string;
  ok: boolean;
  rows: number;
  error?: string;
}

const calls: CallLog[] = [];
/** Rows that arrived twice for one country — a pin that leaked. Surfaced, never hidden. */
let duplicates = 0;

async function ask(what: string, params: Record<string, string>): Promise<Row[] | null> {
  const qs = new URLSearchParams({
    // The three dimensions that split every line into fragments unless pinned.
    // Only one of them is ever unpinned per call, by the caller.
    partner2Code: "0",
    motCode: "0",
    customsCode: "C00",
    ...params,
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
    calls.push({
      what, url: url.slice(0, 200), ok: false, rows: rows.length,
      error: `hit the ${CAP}-row cap — the answer is truncated and cannot be told apart from a complete one`,
    });
    return null;
  }
  calls.push({ what, url: url.slice(0, 200), ok: true, rows: rows.length });
  return rows;
}

function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

export interface CountryValue { code: number; name: string; value: number }

export interface LineYear {
  /** Every reporter that reported exports of this line this year. */
  exporters: CountryValue[];
  /** Every reporter that reported imports of it. */
  importers: CountryValue[];
  /** Reporters that answered at all — the denominator for "X of N countries". */
  reportersAnswering: number;
  /** Reporter batches that failed, so a short ranking is never read as a short market. */
  batchesFailed: number;
}

export interface LineOut {
  code: string;
  label: string;
  short: string;
  means: string;
  years: Record<string, LineYear>;
  /** India's imports of this line by origin country, latest year. */
  indiaImportsBySource: CountryValue[];
  indiaExportsByDestination: CountryValue[];
  indiaPartnerYear: number | null;
}

/** One reporter batch, folded to one value per country. Refuses a duplicate. */
function fold(rows: Row[], names: Map<number, string>, key: "reporter" | "partner"): CountryValue[] {
  const out = new Map<number, CountryValue>();
  for (const r of rows) {
    const code = key === "reporter" ? r.reporterCode : r.partnerCode;
    if (typeof code !== "number" || code <= 0) continue;
    const name = (key === "reporter" ? r.reporterDesc : r.partnerDesc) ?? names.get(code) ?? String(code);
    const v = typeof r.primaryValue === "number" ? r.primaryValue : 0;
    const prev = out.get(code);
    // A repeat means a splitting dimension escaped its pin. Summing would
    // silently inflate; the sum is still taken but the duplicate is counted
    // and surfaced, because a ranking built on inflated values is worse than
    // a missing one.
    if (prev) { prev.value += v; duplicates++; continue; }
    out.set(code, { code, name, value: v });
  }
  return [...out.values()].filter((c) => c.value > 0).sort((a, b) => b.value - a.value);
}

async function main(): Promise<void> {
  const { codes, names, note } = await reporters();
  console.log(note);
  if (codes.length === 0) {
    throw new Error("no reporter universe — refusing to write a ranking built on a hand-typed country list");
  }
  const batches = chunk(codes, BATCH);

  const { codes: pCodes, names: partnerNames, note: pNote } = await partners();
  console.log(pNote);
  // Fall back to the reporter codes: they are drawn from the same area-code
  // list, so a missing partner reference costs coverage, not correctness.
  const partnerBatches = chunk(pCodes.length > 0 ? pCodes : codes, BATCH);
  const lines: LineOut[] = [];

  for (const line of LINES) {
    const years: Record<string, LineYear> = {};
    for (const year of YEARS) {
      const acc: Record<"X" | "M", CountryValue[]> = { X: [], M: [] };
      let failed = 0;
      for (const flow of ["X", "M"] as const) {
        for (const [i, batch] of batches.entries()) {
          const rows = await ask(`${line.code} ${flow} ${year} reporters[${i}]`, {
            reporterCode: batch.join(","),
            period: String(year),
            cmdCode: line.code,
            flowCode: flow,
            partnerCode: "0",
          });
          if (rows === null) { failed++; continue; }
          acc[flow].push(...fold(rows, names, "reporter"));
        }
      }
      acc.X.sort((a, b) => b.value - a.value);
      acc.M.sort((a, b) => b.value - a.value);
      years[String(year)] = {
        exporters: acc.X,
        importers: acc.M,
        reportersAnswering: new Set([...acc.X, ...acc.M].map((c) => c.code)).size,
        batchesFailed: failed,
      };
      console.log(
        `  ${line.code} ${year}: ${acc.X.length} exporters, ${acc.M.length} importers, ` +
        `${failed} batch(es) failed`,
      );
    }

    // India's own partner breakdown, latest year first, stepping back if the
    // latest is not yet published for India.
    let indiaImports: CountryValue[] = [];
    let indiaExports: CountryValue[] = [];
    let partnerYear: number | null = null;
    for (const year of [...YEARS].reverse()) {
      const got: Record<"M" | "X", CountryValue[]> = { M: [], X: [] };
      let anyFailed = false;
      for (const flow of ["M", "X"] as const) {
        for (const [i, batch] of partnerBatches.entries()) {
          const rows = await ask(`${line.code} India ${flow} ${year} partners[${i}]`, {
            reporterCode: String(INDIA), period: String(year), cmdCode: line.code,
            flowCode: flow, partnerCode: batch.join(","),
          });
          if (rows === null) { anyFailed = true; continue; }
          got[flow].push(...fold(rows, partnerNames, "partner"));
        }
      }
      if (got.M.length === 0 && got.X.length === 0) continue;
      // partnerCode 0 is "World" and would sit at the top of a list of
      // countries as though it were one. Drop it from the breakdown; the
      // world total is already in data/semi/trade.json.
      indiaImports = got.M.filter((c) => c.code !== 0).sort((a, b) => b.value - a.value);
      indiaExports = got.X.filter((c) => c.code !== 0).sort((a, b) => b.value - a.value);
      partnerYear = year;
      if (anyFailed) {
        console.log(`  ${line.code} ${year}: at least one partner batch failed — the breakdown is short, not complete`);
      }
      break;
    }
    console.log(`  ${line.code} India partners (${partnerYear ?? "none"}): ${indiaImports.length} sources`);

    lines.push({
      code: line.code, label: line.label, short: line.short, means: line.means,
      years,
      indiaImportsBySource: indiaImports,
      indiaExportsByDestination: indiaExports,
      indiaPartnerYear: partnerYear,
    });
  }

  const failedCalls = calls.filter((c) => !c.ok);
  const out = {
    builtAt: new Date().toISOString(),
    source:
      "UN Comtrade preview API (https://comtradeapi.un.org/public/v1/preview/C/A/HS), " +
      "reporter universe from https://comtradeapi.un.org/files/v1/app/reference/Reporters.json. " +
      "Annual, HS as reported, nominal US$, not deflated.",
    unit: "US$, nominal",
    years: YEARS,
    reporterUniverse: codes.length,
    notOneCountry: NOT_ONE_COUNTRY,
    batchSize: BATCH,
    refusal:
      "No country's capability is inferred from these numbers beyond what crossing a border shows. " +
      "A chip exported from a country was not necessarily fabricated there — packaging and test are " +
      "counted identically to fabrication, and re-exports through trade hubs are counted as exports. " +
      "That is exactly why HS 8486 (the tools) is carried alongside HS 8542 (the chips): the two " +
      "rankings disagree, and where they disagree is the interesting part. No wafer capacity, fab " +
      "count or process node appears here, because trade data cannot see any of them.",
    caveats: [
      "Mirror asymmetry is real and unsmoothed: the world's reported exports of a line never equal its reported imports, because exports are FOB and imports CIF, and because not every country reports every year. Both sides are published here; neither has been reconciled to the other.",
      "A country absent from a ranking did not report that line that year. It is not a country with no trade in it. `reportersAnswering` is the denominator.",
      "2024 is provisional for many reporters and missing for some. A country's rank can move when it files.",
    ],
    diagnostics: {
      calls: calls.length,
      failed: failedCalls.length,
      duplicateRowsSummed: duplicates,
      failures: failedCalls.slice(0, 40),
    },
    lines,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(
    `\nWrote ${OUT}: ${lines.length} lines, ${calls.length} calls, ${failedCalls.length} failed, ` +
    `${duplicates} duplicate row(s) summed.`,
  );
  if (duplicates > 0) {
    console.log("Duplicates mean a splitting dimension escaped its pin. Treat the values as upper bounds.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
