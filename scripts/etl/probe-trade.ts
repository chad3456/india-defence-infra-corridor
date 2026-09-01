/**
 * HS-code trade probe: can this project measure import substitution at all?
 *
 * `npm run trade:probe`. The question this site now wants to answer is which
 * products India used to buy in and now makes. That claim is only checkable at
 * commodity-code level — you need imports and exports for the same HS line
 * across years, for India and for the world.
 *
 * The sandbox cannot reach any of the candidate hosts (comtradeapi.un.org,
 * wits.worldbank.org and api.worldbank.org all answered 403 at CONNECT), so
 * this runs in Actions like every other probe here and commits what it saw.
 *
 * What it is establishing, in order of how badly a wrong guess would hurt:
 *
 *  1. Whether the free Comtrade preview endpoint answers without a key.
 *  2. The real per-call record cap, measured rather than remembered. This
 *     decides the whole ingest strategy: ~5,300 HS6 lines per flow per year
 *     against a 500-row cap is a different program from one against 100,000.
 *     A cap silently truncating a year would produce a product list that is
 *     wrong in the most dangerous way — plausible, ordered, and missing the
 *     tail.
 *  3. Whether AG2/AG4/AG6 aggregation levels behave as documented.
 *  4. Whether a subscription key is present in the environment, and whether it
 *     lifts the cap.
 *  5. WITS as a fallback, since it publishes bulk SDMX for free.
 *
 * Publishes no series. Writes a report after every check so a run killed by
 * the job timeout still leaves its findings behind.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getJson, getText } from "./lib/http";

const ROOT = process.cwd();
const OUT = join(ROOT, "data/live/trade-probe.json");

/** UN M49 code for India — Comtrade's reporter id, not the ISO number. */
const INDIA = 699;

/**
 * A key may be supplied as a repository secret. Absent is the expected case and
 * is not a failure: the point of the probe is to find out what the free tier
 * actually allows.
 */
const KEY = process.env.COMTRADE_KEY ?? "";

interface Check {
  name: string;
  url: string;
  /** Redacted before the report is written — a key must never reach the repo. */
  withKey: boolean;
  status: "ok" | "failed";
  httpError?: string;
  /** Records the API said it returned. */
  count?: number | null;
  /** Records actually present in the payload. */
  rows?: number;
  /** Distinct HS codes seen, which is what the ingest actually needs. */
  distinctCodes?: number;
  /** Set when rows lands exactly on a round number that smells like a cap. */
  suspectedCap?: number;
  /**
   * Fields that vary within a single commodity code.
   *
   * The first run returned 215 rows for one commodity in one year for one
   * flow, which means some dimension is splitting each line. Summing those
   * rows without knowing which one would double-count; picking the first would
   * under-count. This names the culprit instead of guessing.
   */
  splitBy?: Record<string, number>;
  elapsedMs?: number;
  sample?: unknown;
  note?: string;
}

const checks: Check[] = [];

/**
 * A batch of real HS6 codes, used to test whether naming codes explicitly is a
 * way past the 500-row cap. Drawn from the curated sectors so the answer also
 * confirms those codes exist and carry Indian trade.
 */
const EXPLICIT_BATCH = [
  "300490", "300420", "300210", "294190", "294110", "293629", "292242",
  "851712", "851713", "847130", "854231", "854232", "854239", "850760", "851770",
  "854233", "854190", "381800", "280461", "848620", "854143", "854140",
  "930690", "880240", "890610", "871000", "841112", "852610",
  "950300", "950450", "731940", "961610", "820551", "392690", "691110",
  "270900", "151190", "710812", "310210",
];

/** Round numbers a truncating API is likely to stop on. */
const CAP_SUSPECTS = new Set([100, 250, 500, 1000, 2500, 5000, 10_000, 50_000, 100_000]);

interface ComtradeRow {
  cmdCode?: string;
  cmdDesc?: string;
  primaryValue?: number;
  flowCode?: string;
  period?: string | number;
  reporterCode?: number;
  [k: string]: unknown;
}
interface ComtradeEnvelope {
  count?: number | null;
  data?: ComtradeRow[];
  error?: unknown;
}

function redact(url: string): string {
  return url.replace(/(subscription-key=)[^&]+/i, "$1REDACTED");
}

async function comtrade(name: string, params: Record<string, string>, useKey: boolean): Promise<void> {
  const qs = new URLSearchParams(params);
  if (useKey && KEY) qs.set("subscription-key", KEY);
  const url = `https://comtradeapi.un.org/public/v1/preview/C/A/HS?${qs.toString()}`;
  const started = Date.now();
  // cacheMs 0: a probe measuring live caps must not read yesterday's answer.
  const res = await getJson<ComtradeEnvelope>(url, { timeoutMs: 90_000, retries: 2, cacheMs: 0 });
  const elapsedMs = Date.now() - started;

  if (!res.ok || !res.data) {
    checks.push({ name, url: redact(url), withKey: useKey && !!KEY, status: "failed", httpError: res.error, elapsedMs });
    await flush();
    return;
  }
  const rows = Array.isArray(res.data.data) ? res.data.data : [];
  const distinct = new Set(rows.map((r) => r.cmdCode).filter(Boolean));
  const check: Check = {
    name,
    url: redact(url),
    withKey: useKey && !!KEY,
    status: "ok",
    count: res.data.count ?? null,
    rows: rows.length,
    distinctCodes: distinct.size,
    elapsedMs,
    sample: rows.slice(0, 2).map((r) => ({
      cmdCode: r.cmdCode,
      cmdDesc: typeof r.cmdDesc === "string" ? r.cmdDesc.slice(0, 90) : null,
      flowCode: r.flowCode,
      period: r.period,
      primaryValue: r.primaryValue,
    })),
  };
  // Which fields take more than one value inside a single commodity code?
  if (rows.length > 1) {
    const first = rows[0]?.cmdCode;
    const sameCode = rows.filter((r) => r.cmdCode === first);
    if (sameCode.length > 1) {
      const varying: Record<string, number> = {};
      const keys = new Set<string>();
      for (const r of sameCode) for (const k of Object.keys(r)) keys.add(k);
      for (const k of keys) {
        const vals = new Set(sameCode.map((r) => JSON.stringify(r[k])));
        if (vals.size > 1) varying[k] = vals.size;
      }
      check.splitBy = varying;
    }
  }
  if (CAP_SUSPECTS.has(rows.length)) {
    check.suspectedCap = rows.length;
    check.note =
      `returned exactly ${rows.length} rows — treat as a cap, not a complete answer, ` +
      `until a request known to have fewer results comes back short`;
  }
  checks.push(check);
  await flush();
}

async function plain(name: string, url: string, expect: RegExp): Promise<void> {
  const started = Date.now();
  const res = await getText(url, { timeoutMs: 60_000, retries: 1, cacheMs: 0 });
  const elapsedMs = Date.now() - started;
  if (!res.ok || res.data === null) {
    checks.push({ name, url, withKey: false, status: "failed", httpError: res.error, elapsedMs });
  } else {
    const body = res.data;
    checks.push({
      name,
      url,
      withKey: false,
      status: expect.test(body) ? "ok" : "failed",
      httpError: expect.test(body) ? undefined : `body did not match ${expect}`,
      rows: body.length,
      elapsedMs,
      sample: body.slice(0, 1500),
    });
  }
  await flush();
}

async function flush(): Promise<void> {
  await mkdir(join(ROOT, "data/live"), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      {
        probedAt: new Date().toISOString(),
        keyPresent: KEY.length > 0,
        purpose: "establish whether HS6 import/export series for India are reachable, and at what cap",
        checks,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
}

async function main(): Promise<void> {
  console.log(`Trade probe. Comtrade key ${KEY ? "present" : "absent"}.`);

  // 1. Does the free endpoint answer at all? Smallest possible ask.
  await comtrade("comtrade/total-imports-2023", {
    reporterCode: String(INDIA), period: "2023", partnerCode: "0", cmdCode: "TOTAL", flowCode: "M",
  }, false);

  // 2-4. Granularity ladder. AG2 is ~97 lines, AG4 ~1,200, AG6 ~5,300 — so the
  // row counts these come back with expose the cap directly.
  for (const [level, label] of [["AG2", "hs2"], ["AG4", "hs4"], ["AG6", "hs6"]] as const) {
    await comtrade(`comtrade/${label}-imports-2023`, {
      reporterCode: String(INDIA), period: "2023", partnerCode: "0", cmdCode: level, flowCode: "M",
    }, false);
  }

  // 5. Both flows in one call, which halves the request count if allowed.
  await comtrade("comtrade/hs6-both-flows-2023", {
    reporterCode: String(INDIA), period: "2023", partnerCode: "0", cmdCode: "AG6", flowCode: "M,X",
  }, false);

  // 6. Multiple years in one call — the ingest needs ~25 of them.
  await comtrade("comtrade/hs2-multiyear", {
    reporterCode: String(INDIA), period: "2015,2016,2017,2018,2019", partnerCode: "0", cmdCode: "AG2", flowCode: "M",
  }, false);

  // 7. Whether the cap lifts with a key, if one was supplied.
  if (KEY) {
    await comtrade("comtrade/hs6-imports-2023-keyed", {
      reporterCode: String(INDIA), period: "2023", partnerCode: "0", cmdCode: "AG6", flowCode: "M",
    }, true);
  }

  // 7b. Collapse attempts. One commodity came back as 215 rows, so some
  // dimension is splitting each line. Comtrade's newer API carries mode of
  // transport, customs procedure and a second partner; if the split is one of
  // those, pinning it should return a single row per commodity. Whichever of
  // these collapses the answer is the one the ingest must pin.
  await comtrade("comtrade/total-pinned-mot-customs-p2", {
    reporterCode: String(INDIA), period: "2023", partnerCode: "0", cmdCode: "TOTAL", flowCode: "M",
    motCode: "0", customsCode: "C00", partner2Code: "0",
  }, false);
  await comtrade("comtrade/total-pinned-mot-only", {
    reporterCode: String(INDIA), period: "2023", partnerCode: "0", cmdCode: "TOTAL", flowCode: "M",
    motCode: "0",
  }, false);
  await comtrade("comtrade/hs6-pinned-2023", {
    reporterCode: String(INDIA), period: "2023", partnerCode: "0", cmdCode: "AG6", flowCode: "M",
    motCode: "0", customsCode: "C00", partner2Code: "0",
  }, false);

  // 7c. Getting past the cap.
  //
  // Round two settled the shape: pinning partner2Code, motCode and customsCode
  // gives exactly one row per commodity, and the answer stops at 500. Roughly
  // 5,300 HS6 lines therefore need paging, and the preview endpoint has no
  // offset. The way through is to name the codes explicitly in batches, which
  // needs the HS6 universe from somewhere. These check both halves.
  await comtrade("comtrade/explicit-code-batch", {
    reporterCode: String(INDIA), period: "2023", partnerCode: "0", flowCode: "M,X",
    cmdCode: EXPLICIT_BATCH.join(","),
    motCode: "0", customsCode: "C00", partner2Code: "0",
  }, false);

  // Does count report the true total when the answer is truncated, or just
  // echo the cap? Round two saw count=500 next to rows=500, which cannot be
  // distinguished from a genuine 500. A request known to exceed the cap
  // settles whether the envelope can ever be trusted to say "there is more".
  await comtrade("comtrade/cap-honesty-hs6-all", {
    reporterCode: String(INDIA), period: "2023", partnerCode: "0", cmdCode: "AG6", flowCode: "M",
    motCode: "0", customsCode: "C00", partner2Code: "0", maxRecords: "100000",
  }, false);

  // Reference files: the code universe, if Comtrade will hand it over.
  for (const ref of ["HS", "H6", "H5"]) {
    await plain(
      `comtrade/reference-${ref}`,
      `https://comtradeapi.un.org/files/v1/app/reference/${ref}.json`,
      /\{|\[/,
    );
  }

  // 8. Fallbacks. WITS publishes free bulk SDMX; the World Bank API is already
  // used elsewhere in this pipeline and doubles as a reachability control — if
  // it fails here, the network is the problem, not the trade hosts.
  await plain(
    "wits/sdmx-india-imports",
    "https://wits.worldbank.org/API/V1/SDMX/V21/datasource/tradestats-trade/reporter/ind/year/2020/partner/wld/product/all/indicator/MPRT-TRD-VL",
    /<|Series|Obs/i,
  );
  // WITS answered, but a 7kB body for "all products" is far too small to be
  // 5,300 commodity lines. These establish what its product dimension actually
  // is before anything is built on it.
  await plain(
    "wits/sdmx-datasource-list",
    "https://wits.worldbank.org/API/V1/SDMX/V21/datasource/tradestats-trade/",
    /./,
  );
  await plain(
    "wits/product-codelist",
    "https://wits.worldbank.org/API/V1/wits/datasource/trn/product/all",
    /</,
  );
  await plain(
    "wits/nomenclature-h5-products",
    "https://wits.worldbank.org/API/V1/wits/datasource/tradestats-trade/product/ALL",
    /</,
  );
  await plain(
    "worldbank/control",
    "https://api.worldbank.org/v2/country/IND/indicator/NE.IMP.GNFS.ZS?format=json&per_page=3",
    /indicator/i,
  );

  const ok = checks.filter((c) => c.status === "ok").length;
  console.log(`\n${ok}/${checks.length} checks ok. Report: data/live/trade-probe.json`);
  for (const c of checks) {
    const cap = c.suspectedCap ? ` CAP?${c.suspectedCap}` : "";
    console.log(
      `  ${c.status === "ok" ? "ok  " : "FAIL"} ${c.name.padEnd(34)} rows=${c.rows ?? "-"} distinct=${c.distinctCodes ?? "-"} count=${c.count ?? "-"}${cap} ${c.httpError ?? ""}`,
    );
  }
}

main().catch(async (err) => {
  console.error(err);
  await flush();
  process.exit(1);
});
