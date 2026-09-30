/**
 * What China exports to the world: speakers to drones to guitars.
 *
 * `npm run china-exports:ingest`. Writes data/trade/china-exports.json. Runs
 * in GitHub Actions: the editing sandbox cannot reach comtradeapi.un.org.
 *
 * Every value is UN Comtrade's, in current US dollars, as China reports its
 * exports (FOB) to the UN — nothing is estimated, interpolated or converted.
 * Four questions, each asked of the free preview endpoint:
 *
 *   trend    China's exports of each product to the world, one call per year.
 *   partners China's exports of each product by destination, latest year, one
 *            product per call (about 230 destinations — well under the 500-row
 *            cap, so a 500-row answer can be read as truncation, not luck).
 *   share    Every reporter's exports of each product to the world, one year
 *            back from the latest (most countries report late), so China's
 *            share can be computed. Derived, and labelled so on the page.
 *   mirror   What every other reporter says it imported from China. The
 *            independent check: a second set of customs offices counting the
 *            same goods from the other end. It never matches exactly —
 *            imports are valued with freight and insurance (CIF), exports
 *            without (FOB), and goods routed through Hong Kong are counted
 *            differently at each end — and the page prints both rather than
 *            choosing.
 *
 * The probe findings recorded in connectors/comtrade.ts hold here too: pin
 * partner2Code, motCode and customsCode or rows split; one period per call;
 * the endpoint returns no descriptions, so products are named in
 * lib/china-exports-shared.ts.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getJson } from "../lib/http";
import { isEntryPoint } from "../lib/entry";
import { PRODUCTS, type ChinaExports, type PartnerValue, type ProductData, type TrendPoint } from "../../../lib/china-exports-shared";

const ROOT = process.cwd();
const OUT = join(ROOT, "data", "trade", "china-exports.json");
const API = "https://comtradeapi.un.org/public/v1/preview/C/A/HS";
const REF_PARTNERS = "https://comtradeapi.un.org/files/v1/app/reference/partnerAreas.json";
const CHINA = 156;
const FIRST_YEAR = 2015;
const CAP = 500;
const GAP_MS = 1_500;

/**
 * Comtrade's partner codes are UN M49, which match ISO 3166-1 numeric — and so
 * world-atlas ids — except for a handful Comtrade keeps its own variant of.
 */
const M49_TO_ISO: Record<number, number> = { 842: 840, 251: 250, 579: 578, 757: 756, 699: 356, 381: 380, 58: 56 };
/** Aggregates and non-places: never drawn on the map. */
const NOT_A_COUNTRY = new Set([0, 97, 290, 471, 472, 490, 492, 527, 568, 577, 636, 637, 697, 837, 838, 839, 849, 879, 899]);

interface Row {
  reporterCode?: number;
  partnerCode?: number;
  cmdCode?: string;
  flowCode?: string;
  period?: string | number;
  primaryValue?: number;
  qty?: number | null;
  qtyUnitAbbr?: string | null;
}

const errors: string[] = [];
let calls = 0;
let last = 0;

async function query(params: Record<string, string>, label: string): Promise<Row[] | null> {
  const wait = GAP_MS - (Date.now() - last);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  calls++;
  const qs = new URLSearchParams({ motCode: "0", customsCode: "C00", partner2Code: "0", ...params });
  const res = await getJson<{ data?: Row[] }>(`${API}?${qs}`, { timeoutMs: 120_000, retries: 3, cacheMs: 0 });
  if (!res.ok || !res.data) { errors.push(`${label}: ${res.error ?? "no data"}`); return null; }
  const rows = Array.isArray(res.data.data) ? res.data.data : [];
  if (rows.length >= CAP) { errors.push(`${label}: hit the ${CAP}-row cap — refused as truncated`); return null; }
  return rows;
}

/** A second row for the same key means a splitting dimension escaped the pins. */
function unique(rows: Row[], key: (r: Row) => string, label: string): boolean {
  const seen = new Set<string>();
  for (const r of rows) {
    const k = key(r);
    if (seen.has(k)) { errors.push(`${label}: duplicate ${k} — refused`); return false; }
    seen.add(k);
  }
  return true;
}

function chunks<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

async function partnerNames(): Promise<Map<number, string>> {
  const res = await getJson<{ results?: Array<{ id: number; text: string }> }>(REF_PARTNERS, { timeoutMs: 60_000, retries: 2 });
  const out = new Map<number, string>();
  for (const r of res.data?.results ?? []) out.set(r.id, r.text);
  if (!out.size) errors.push("partner names: reference list unavailable; falling back to map names");
  return out;
}

async function atlasNames(): Promise<Map<string, string>> {
  const t = (await import("world-atlas/countries-110m.json", { with: { type: "json" } })).default as unknown as {
    objects: { countries: { geometries: Array<{ id?: string; properties?: { name?: string } }> } };
  };
  return new Map(t.objects.countries.geometries.filter((g) => g.id).map((g) => [g.id!, g.properties?.name ?? g.id!]));
}

export async function run(): Promise<void> {
  const codes = PRODUCTS.map((p) => p.code);
  const names = await partnerNames();
  const atlas = await atlasNames();

  // ── Trend: China to the world, one call per year ─────────────────────
  const trend = new Map<string, TrendPoint[]>(codes.map((c) => [c, []]));
  const thisYear = new Date().getUTCFullYear();
  let latestYear: number | null = null;
  for (let year = FIRST_YEAR; year <= thisYear; year++) {
    const rows = await query({ reporterCode: String(CHINA), partnerCode: "0", flowCode: "X", period: String(year), cmdCode: codes.join(",") }, `trend ${year}`);
    if (rows === null) { for (const c of codes) trend.get(c)!.push({ year, value: null }); continue; }
    if (!unique(rows, (r) => String(r.cmdCode), `trend ${year}`)) { for (const c of codes) trend.get(c)!.push({ year, value: null }); continue; }
    if (rows.length > 0) latestYear = year;
    const by = new Map(rows.map((r) => [String(r.cmdCode), r.primaryValue]));
    // A code with no row that year is a gap, not a zero: the code may not have
    // existed yet, or China may not have reported it. Never filled in.
    for (const c of codes) { const v = by.get(c); trend.get(c)!.push({ year, value: typeof v === "number" ? v : null }); }
    console.log(`  trend ${year}: ${rows.length} products`);
  }
  if (latestYear === null) throw new Error("no year returned any data; keeping the previous file");
  // Trailing years with nothing reported yet are dropped, not kept as gaps.
  for (const c of codes) trend.set(c, trend.get(c)!.filter((p) => p.year <= latestYear!));

  // ── Partners: one product per call, latest year ──────────────────────
  const partners = new Map<string, PartnerValue[]>();
  const quantity = new Map<string, ProductData["quantity"]>();
  for (const c of codes) {
    const rows = await query({ reporterCode: String(CHINA), flowCode: "X", period: String(latestYear), cmdCode: c }, `partners ${c}`);
    if (rows === null || !unique(rows, (r) => String(r.partnerCode), `partners ${c}`)) continue;
    const world = rows.find((r) => r.partnerCode === 0);
    if (world && typeof world.qty === "number" && world.qty > 0 && world.qtyUnitAbbr) quantity.set(c, { value: world.qty, unit: world.qtyUnitAbbr });
    const list: PartnerValue[] = [];
    for (const r of rows) {
      const m49 = r.partnerCode ?? 0;
      if (m49 === 0 || typeof r.primaryValue !== "number" || r.primaryValue <= 0) continue;
      const iso = String(M49_TO_ISO[m49] ?? m49).padStart(3, "0");
      const atlasId = NOT_A_COUNTRY.has(m49) || !atlas.has(iso) ? null : iso;
      list.push({ m49, name: names.get(m49) ?? atlas.get(iso) ?? `Partner ${m49}`, atlasId, value: r.primaryValue });
    }
    list.sort((a, b) => b.value - a.value);
    partners.set(c, list);
    console.log(`  partners ${c}: ${list.length}`);
  }

  // ── Share and mirror: every reporter, a year back ────────────────────
  const shareYear = latestYear - 1;
  const share = new Map<string, ProductData["share"]>();
  const mirror = new Map<string, ProductData["mirror"]>();
  for (const batch of chunks(codes, 2)) {
    const rows = await query({ partnerCode: "0", flowCode: "X", period: String(shareYear), cmdCode: batch.join(",") }, `share ${batch}`);
    if (rows && unique(rows, (r) => `${r.reporterCode}:${r.cmdCode}`, `share ${batch}`)) {
      for (const c of batch) {
        const mine = rows.filter((r) => String(r.cmdCode) === c && typeof r.primaryValue === "number");
        const world = mine.reduce((s, r) => s + (r.primaryValue ?? 0), 0);
        const china = mine.find((r) => r.reporterCode === CHINA)?.primaryValue ?? 0;
        if (world > 0 && china > 0) share.set(c, { year: shareYear, china, world, reporters: mine.length });
      }
    }
    const back = await query({ partnerCode: String(CHINA), flowCode: "M", period: String(shareYear), cmdCode: batch.join(",") }, `mirror ${batch}`);
    if (back && unique(back, (r) => `${r.reporterCode}:${r.cmdCode}`, `mirror ${batch}`)) {
      for (const c of batch) {
        const mine = back.filter((r) => String(r.cmdCode) === c && typeof r.primaryValue === "number");
        const value = mine.reduce((s, r) => s + (r.primaryValue ?? 0), 0);
        if (value > 0) mirror.set(c, { year: shareYear, value, reporters: mine.length });
      }
    }
    console.log(`  share + mirror ${batch.join(",")}`);
  }

  const products: ProductData[] = codes.map((c) => ({
    code: c,
    trend: trend.get(c)!,
    partners: partners.get(c) ?? [],
    partnerYear: partners.has(c) ? latestYear : null,
    quantity: quantity.get(c) ?? null,
    share: share.get(c) ?? null,
    mirror: mirror.get(c) ?? null,
  }));

  const out: ChinaExports = { generatedAt: new Date().toISOString(), latestYear, products, calls, errors: errors.slice(0, 200) };
  const withData = products.filter((p) => p.trend.some((t) => t.value !== null)).length;
  if (withData < codes.length / 2) throw new Error(`only ${withData} of ${codes.length} products returned data; keeping the previous file`);
  await mkdir(join(ROOT, "data", "trade"), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 1) + "\n", "utf8");
  console.log(`\nwrote ${OUT}: latest ${latestYear}, ${withData}/${codes.length} products with data, ${calls} calls, ${errors.length} errors`);
  for (const e of errors.slice(0, 40)) console.log(`  ${e}`);
}

if (isEntryPoint(import.meta.url)) {
  run().catch((e) => { console.error(e); process.exit(1); });
}
