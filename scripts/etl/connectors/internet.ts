/**
 * The state of the internet, country by country.
 *
 * `npm run internet:ingest`. Writes data/internet/internet.json. Runs in
 * GitHub Actions: the editing sandbox cannot reach the ITU, PeeringDB,
 * TeleGeography or CelesTrak.
 *
 * Five sources, each read in full and stored as published:
 *
 *   World Bank  Internet users, fixed broadband and mobile subscriptions,
 *               secure servers and population, every country, 2000 onwards.
 *               The first three are the ITU's figures, which the World Bank
 *               republishes; its API is the one that answers reliably.
 *   ITU         The ICT Price Baskets workbook (prices as % of GNI per
 *               capita and in US dollars, 2008 onwards) and the 2025
 *               allowance workbook: the plan ITU priced in each country, with
 *               its data allowance. Price per GB is derived on the page from
 *               the plan's price and allowance, and says so.
 *   PeeringDB   Every internet exchange point, with its country.
 *   TeleGeography  The open submarine cable map: every cable and the
 *               countries it lands in.
 *   CelesTrak   The satellite catalogue (SATCAT): every object, its owner,
 *               launch and decay dates and status. Starlink and its rivals are
 *               counted by name prefix.
 *
 * The probe that preceded this (scripts/etl/probe-internet.ts, results in
 * data/live/internet-probe.json) fixed the sheet layouts read here.
 *
 * A section that fails keeps the previous run's section rather than blanking
 * a chart; the run only fails outright when every section does.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getJson, getText } from "../lib/http";
import { isEntryPoint } from "../lib/entry";
import { parseCellNumber, readWorkbook, type SheetTable } from "../lib/sheet-table";
import type { CableCountry, Constellation, InternetData, ItuBasketRow, ItuMedianRow, ItuPlan, WbCountry, WbIndicator, YearSeries } from "../../../lib/internet-shared";

const ROOT = process.cwd();
const OUT = join(ROOT, "data", "internet", "internet.json");
const WORLD = join(ROOT, "data", "geo", "world-ind.json");

export const WB_INDICATORS = ["IT.NET.USER.ZS", "IT.NET.BBND.P2", "IT.CEL.SETS.P2", "IT.NET.SECR.P6", "SP.POP.TOTL"] as const;
const WB_AGGREGATES = ["WLD", "LIC", "LMC", "UMC", "HIC"];
const WB_FIRST = 2000;

const ITU_BASKETS = "https://www.itu.int/en/ITU-D/Statistics/Documents/ICT_Prices/ITU_ICTPriceBaskets_2008-2025.xlsx";
const ITU_ALLOWANCE = "https://www.itu.int/en/ITU-D/Statistics/Documents/ICT_Prices/ITU_ICTPriceBaskets_Allowance_2025.xlsx";
const PEERINGDB = "https://www.peeringdb.com/api/ix";
const CABLE_ALL = "https://www.submarinecablemap.com/api/v3/cable/all.json";
const CABLE_ONE = (id: string) => `https://www.submarinecablemap.com/api/v3/cable/${id}.json`;
const LANDINGS = "https://www.submarinecablemap.com/api/v3/landing-point/landing-point-geo.json";
const SATCAT = "https://celestrak.org/pub/satcat.csv";

/** Constellations counted in SATCAT, by the object-name prefix CelesTrak uses. */
export const CONSTELLATIONS: Record<string, RegExp> = {
  Starlink: /^STARLINK/,
  OneWeb: /^ONEWEB/,
  Kuiper: /^KUIPER/,
  Qianfan: /^(QIANFAN|G60)/,
  Guowang: /^(GUOWANG|HULIANWANG|SATNET)/,
  Iridium: /^IRIDIUM/,
  Globalstar: /^GLOBALSTAR/,
  O3b: /^O3B/,
};
/** CelesTrak status codes for a satellite that is working: operational, partial, backup, spare, extended. */
const ACTIVE = new Set(["+", "P", "B", "S", "X"]);

const errors: string[] = [];
const say = (s: string) => console.log(s);

/* ── World Bank ─────────────────────────────────────────────────────────── */

interface WbRow { countryiso3code?: string; country?: { id?: string }; date?: string; value?: number | null; indicator?: { value?: string } }
interface WbMeta { id: string; iso2Code?: string; name: string; region?: { id?: string; value?: string }; incomeLevel?: { value?: string } }

async function worldBank(): Promise<InternetData["worldBank"]> {
  const meta = await getJson<[unknown, WbMeta[]]>("https://api.worldbank.org/v2/country?format=json&per_page=400", { timeoutMs: 60_000, retries: 3, cacheMs: 0 });
  if (!meta.ok || !meta.data?.[1]) { errors.push(`worldbank countries: ${meta.error}`); return null; }
  const countries: Record<string, WbCountry> = {};
  const aggregates: Record<string, string> = {};
  for (const c of meta.data[1]) {
    if (c.region?.id === "NA") { if (WB_AGGREGATES.includes(c.id)) aggregates[c.id] = c.name; continue; }
    countries[c.id] = { name: c.name, region: c.region?.value?.trim() ?? "", income: c.incomeLevel?.value ?? "" };
  }
  const keep = new Set([...Object.keys(countries), ...Object.keys(aggregates)]);
  // Income-group rows come back with an empty ISO3 code and their two-letter
  // id ("XD" for high income); map those back to the three-letter code.
  const byIso2 = new Map(meta.data[1].filter((c) => c.iso2Code).map((c) => [c.iso2Code!, c.id]));
  const indicators: Record<string, WbIndicator> = {};
  const year = new Date().getUTCFullYear();
  for (const code of WB_INDICATORS) {
    const url = `https://api.worldbank.org/v2/country/all/indicator/${code}?format=json&per_page=20000&date=${WB_FIRST}:${year}`;
    const res = await getJson<[{ lastupdated?: string }, WbRow[]]>(url, { timeoutMs: 120_000, retries: 3, cacheMs: 0 });
    const rows = res.data?.[1];
    if (!res.ok || !rows) { errors.push(`worldbank ${code}: ${res.error}`); continue; }
    const values: Record<string, YearSeries> = {};
    for (const r of rows) {
      const iso = r.countryiso3code || byIso2.get(r.country?.id ?? "") || "";
      if (!keep.has(iso) || typeof r.value !== "number") continue;
      (values[iso] ??= []).push([Number(r.date), r.value]);
    }
    for (const s of Object.values(values)) s.sort((a, b) => a[0] - b[0]);
    const src = await getJson<[unknown, Array<{ sourceNote?: string; name?: string }>]>(`https://api.worldbank.org/v2/indicator/${code}?format=json`, { timeoutMs: 60_000, retries: 2, cacheMs: 0 });
    const m = src.data?.[1]?.[0];
    indicators[code] = { name: m?.name ?? rows[0]?.indicator?.value ?? code, note: (m?.sourceNote ?? "").split(/(?<=\.)\s/)[0] ?? "", values };
    say(`  worldbank ${code}: ${Object.keys(values).length} economies`);
  }
  if (Object.keys(indicators).length === 0) return null;
  return { url: "https://data.worldbank.org/indicator/IT.NET.USER.ZS", countries, aggregates, indicators };
}

/* ── ITU price baskets ──────────────────────────────────────────────────── */

async function workbook(url: string): Promise<SheetTable[] | null> {
  try {
    const r = await fetch(url, { headers: { "user-agent": "BharatTracker/0.1 (+https://github.com/chad3456/india-defence-infra-corridor)" } });
    if (!r.ok) { errors.push(`${url}: HTTP ${r.status}`); return null; }
    return await readWorkbook(new Uint8Array(await r.arrayBuffer()));
  } catch (e) {
    errors.push(`${url}: ${String(e)}`);
    return null;
  }
}

const num = (s: string | undefined) => parseCellNumber(s ?? "");
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Read one plan table (MobileBB, FixedBB): the header row is found by its "Economy" cell. */
export function readPlans(t: SheetTable, isoOf: (economy: string) => string | null): { title: string; plans: ItuPlan[] } {
  const at = t.rows.findIndex((r) => (r[0] ?? "").trim() === "Economy");
  if (at < 0) throw new Error(`${t.sheet}: no Economy header`);
  const header = t.rows[at]!.map((h) => h.toLowerCase());
  const col = (re: RegExp) => header.findIndex((h) => re.test(h));
  const cGni = col(/gni/), cUsd = col(/^usd/), cPpp = col(/ppp/), cProv = col(/operator|service provider|isp/);
  const cGb = col(/allowance|cap per month/), cSpeed = col(/speed/), cTech = col(/technology/);
  if ([cGni, cUsd, cProv, cGb].some((c) => c < 0)) throw new Error(`${t.sheet}: header changed: ${t.rows[at]!.join(" | ")}`);
  const title = t.rows.slice(0, at).flat().find((c) => c.trim()) ?? t.sheet;
  const plans: ItuPlan[] = [];
  for (const r of t.rows.slice(at + 1)) {
    const economy = (r[0] ?? "").trim();
    if (!economy || /^(note|source|\*)/i.test(economy)) continue;
    const gbCell = (r[cGb] ?? "").trim();
    const unlimited = /unlimited/i.test(gbCell);
    plans.push({
      economy,
      iso3: isoOf(economy),
      gniPct: num(r[cGni]),
      usd: num(r[cUsd]),
      ppp: cPpp >= 0 ? num(r[cPpp]) : null,
      provider: (r[cProv] ?? "").trim(),
      gb: unlimited ? null : num(gbCell),
      unlimited,
      speedMbps: cSpeed >= 0 ? num(r[cSpeed]) : null,
      technology: cTech >= 0 ? (r[cTech] ?? "").trim() : "",
    });
  }
  return { title: title.trim(), plans: plans.filter((p) => p.usd !== null || p.gniPct !== null) };
}

const BASKET_KEEP = /data-only|mobile-broadband|fixed-broadband/i;

async function itu(fallbackIso: (n: string) => string | null): Promise<InternetData["itu"]> {
  const book = await workbook(ITU_BASKETS);
  if (!book) return null;
  const eco = book.find((t) => /^economies/i.test(t.sheet));
  const med = book.find((t) => /^medians/i.test(t.sheet));
  if (!eco) { errors.push("itu: no economies sheet"); return null; }
  const h = eco.rows[0]!;
  const ix = (name: string) => h.findIndex((c) => c.trim() === name);
  const [cIso, cEco, cCode, cBasket, cUnit] = [ix("IsoCode"), ix("Economy"), ix("Code"), ix("Basket name"), ix("Unit")];
  const years = h.map((c, i) => [c.trim(), i] as const).filter(([c]) => /^(19|20)\d{2}$/.test(c));
  if ([cIso, cEco, cCode, cBasket, cUnit].some((c) => c < 0) || years.length === 0) { errors.push(`itu: economies header changed: ${h.join(" | ")}`); return null; }
  const isoByName = new Map<string, string>();
  const baskets: ItuBasketRow[] = [];
  for (const r of eco.rows.slice(1)) {
    const iso3 = (r[cIso] ?? "").trim();
    const economy = (r[cEco] ?? "").trim();
    if (iso3 && economy) isoByName.set(norm(economy), iso3);
    const unit = (r[cUnit] ?? "").trim();
    if (!BASKET_KEEP.test(r[cBasket] ?? "") || (unit !== "GNIpc" && unit !== "USD")) continue;
    const values: Record<string, number> = {};
    for (const [y, i] of years) { const v = num(r[i]); if (v !== null) values[y] = v; }
    if (Object.keys(values).length) baskets.push({ iso3, economy, code: (r[cCode] ?? "").trim(), basket: (r[cBasket] ?? "").trim(), unit, values });
  }
  const medians: ItuMedianRow[] = [];
  if (med) {
    const at = med.rows.findIndex((r) => (r[0] ?? "").trim() === "Code");
    const mh = med.rows[at] ?? [];
    const myears = mh.map((c, i) => [c.trim(), i] as const).filter(([c]) => /^(19|20)\d{2}$/.test(c));
    const codes = new Set(baskets.map((b) => b.code));
    for (const r of med.rows.slice(at + 1)) {
      const code = (r[0] ?? "").trim();
      if (!codes.has(code)) continue;
      const values: Record<string, number> = {};
      for (const [y, i] of myears) { const v = num(r[i]); if (v !== null) values[y] = v; }
      if (Object.keys(values).length) medians.push({ code, unit: (r[1] ?? "").trim(), grouping: (r[2] ?? "").trim(), group: (r[3] ?? "").trim(), values });
    }
  }
  say(`  itu baskets: ${baskets.length} rows, ${medians.length} median rows, ${isoByName.size} economies named`);

  const allowance = await workbook(ITU_ALLOWANCE);
  // The allowance sheets name economies, sometimes differently from the
  // economies sheet ("Turkey", "Palestine*"); fall back to the map's names.
  const isoOf = (e: string) => isoByName.get(norm(e)) ?? fallbackIso(e.replace(/\*+$/, "")) ?? null;
  let mobile: ItuPlan[] = [], fixed: ItuPlan[] = [], mobileTitle = "", fixedTitle = "";
  if (allowance) {
    for (const [sheet, set] of [["MobileBB", (t: string, p: ItuPlan[]) => { mobile = p; mobileTitle = t; }], ["FixedBB", (t: string, p: ItuPlan[]) => { fixed = p; fixedTitle = t; }]] as const) {
      const t = allowance.find((x) => x.sheet === sheet);
      if (!t) { errors.push(`itu allowance: no ${sheet} sheet`); continue; }
      try { const r = readPlans(t, isoOf); set(r.title, r.plans); } catch (e) { errors.push(`itu allowance: ${String(e)}`); }
    }
    say(`  itu plans: ${mobile.length} mobile, ${fixed.length} fixed; ${[...mobile, ...fixed].filter((p) => !p.iso3).length} unmatched names`);
  }
  return { url: ITU_BASKETS, allowanceUrl: ITU_ALLOWANCE, baskets, medians, mobile, fixed, mobileTitle, fixedTitle };
}

/* ── PeeringDB ──────────────────────────────────────────────────────────── */

async function peeringdb(iso2to3: Map<string, string>): Promise<InternetData["peeringdb"]> {
  const res = await getJson<{ data?: Array<{ country?: string; status?: string }> }>(PEERINGDB, { timeoutMs: 120_000, retries: 3, cacheMs: 0 });
  if (!res.ok || !res.data?.data) { errors.push(`peeringdb: ${res.error}`); return null; }
  const byCountry: Record<string, number> = {};
  let total = 0;
  for (const ix of res.data.data) {
    if (ix.status && ix.status !== "ok") continue;
    total++;
    const iso3 = iso2to3.get((ix.country ?? "").toUpperCase());
    if (iso3) byCountry[iso3] = (byCountry[iso3] ?? 0) + 1;
  }
  say(`  peeringdb: ${total} exchanges in ${Object.keys(byCountry).length} countries`);
  return { url: "https://www.peeringdb.com/api/ix", total, byCountry };
}

/* ── Submarine cables ───────────────────────────────────────────────────── */

/** "Mumbai, India" → "India". TeleGeography writes the country last. */
export function countryOfLanding(name: string): string {
  const parts = name.split(",").map((p) => p.trim());
  const last = parts[parts.length - 1] ?? "";
  // World Bank-style names carry their own comma: "Congo, Dem. Rep.".
  if (/^(Dem\. )?Rep\.$|^The$/i.test(last) && parts.length >= 2) return `${parts[parts.length - 2]}, ${last}`;
  return last;
}

async function cables(isoByName: (n: string) => string | null): Promise<InternetData["cables"]> {
  const all = await getJson<Array<{ id: string; name: string }>>(CABLE_ALL, { timeoutMs: 60_000, retries: 3, cacheMs: 0 });
  const lp = await getJson<{ features?: Array<{ properties?: { id?: string; name?: string } }> }>(LANDINGS, { timeoutMs: 60_000, retries: 3, cacheMs: 0 });
  if (!all.ok || !all.data || !lp.ok || !lp.data?.features) { errors.push(`cables: ${all.error ?? lp.error}`); return null; }
  const unmatched = new Set<string>();
  const byCountry: Record<string, CableCountry> = {};
  const isoOfName = (n: string) => { const iso = isoByName(n); if (!iso && n) unmatched.add(n); return iso; };
  for (const f of lp.data.features) {
    const iso = isoOfName(countryOfLanding(f.properties?.name ?? ""));
    if (iso) (byCountry[iso] ??= { cables: 0, landings: 0 }).landings++;
  }
  // Per-cable files carry the landing list; read them a few at a time within a budget.
  const started = Date.now();
  const ids = all.data.map((c) => c.id);
  const cablesIn = new Map<string, Set<string>>();
  let read = 0;
  for (let i = 0; i < ids.length && Date.now() - started < 12 * 60_000; i += 6) {
    await Promise.all(ids.slice(i, i + 6).map(async (id) => {
      const r = await getJson<{ landing_points?: Array<{ name?: string; country?: string }> }>(CABLE_ONE(id), { timeoutMs: 30_000, retries: 2, cacheMs: 0 });
      if (!r.ok || !r.data) return;
      read++;
      for (const p of r.data.landing_points ?? []) {
        const iso = isoOfName(p.country ?? countryOfLanding(p.name ?? ""));
        if (iso) (cablesIn.get(iso) ?? cablesIn.set(iso, new Set()).get(iso)!).add(id);
      }
    }));
  }
  const perCable = read >= ids.length * 0.95;
  if (perCable) for (const [iso, set] of cablesIn) (byCountry[iso] ??= { cables: 0, landings: 0 }).cables = set.size;
  else errors.push(`cables: read ${read} of ${ids.length} cable files; cable counts withheld, landings kept`);
  say(`  cables: ${ids.length} cables, ${lp.data.features.length} landings, ${Object.keys(byCountry).length} countries, ${unmatched.size} names unmatched`);
  return { url: "https://www.submarinecablemap.com/", total: ids.length, byCountry, unmatched: [...unmatched].sort(), perCable };
}

/* ── Satellites ─────────────────────────────────────────────────────────── */

/** One CSV line into fields, honouring double quotes. */
export function csvFields(line: string): string[] {
  const out: string[] = [];
  let cur = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

export function readSatcat(csv: string): NonNullable<InternetData["satcat"]> {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  const head = csvFields(lines[0] ?? "");
  const c = (n: string) => { const i = head.indexOf(n); if (i < 0) throw new Error(`SATCAT header lacks ${n}`); return i; };
  const [cName, cType, cStatus, cOwner, cLaunch, cDecay] = [c("OBJECT_NAME"), c("OBJECT_TYPE"), c("OPS_STATUS_CODE"), c("OWNER"), c("LAUNCH_DATE"), c("DECAY_DATE")];
  const constellations: Record<string, Constellation> = {};
  for (const k of Object.keys(CONSTELLATIONS)) constellations[k] = { active: 0, inOrbit: 0, launched: 0, decayed: 0, launchedByYear: {}, decayedByYear: {} };
  const activeByOwner: Record<string, number> = {};
  let activePayloads = 0;
  for (const line of lines.slice(1)) {
    const f = csvFields(line);
    if (f[cType] !== "PAY") continue;
    const decayed = (f[cDecay] ?? "").trim() !== "";
    const active = !decayed && ACTIVE.has((f[cStatus] ?? "").trim());
    if (active) { activePayloads++; const o = (f[cOwner] ?? "").trim(); activeByOwner[o] = (activeByOwner[o] ?? 0) + 1; }
    const name = f[cName] ?? "";
    for (const [k, re] of Object.entries(CONSTELLATIONS)) {
      if (!re.test(name)) continue;
      const s = constellations[k]!;
      s.launched++;
      const ly = (f[cLaunch] ?? "").slice(0, 4);
      if (ly) s.launchedByYear[ly] = (s.launchedByYear[ly] ?? 0) + 1;
      if (decayed) { s.decayed++; const dy = (f[cDecay] ?? "").slice(0, 4); s.decayedByYear[dy] = (s.decayedByYear[dy] ?? 0) + 1; }
      else s.inOrbit++;
      if (active) s.active++;
      break;
    }
  }
  return { url: SATCAT, rows: lines.length - 1, activePayloads, activeByOwner, constellations };
}

async function satcat(): Promise<InternetData["satcat"]> {
  const res = await getText(SATCAT, { timeoutMs: 180_000, retries: 3, cacheMs: 0 });
  if (!res.ok || !res.data) { errors.push(`satcat: ${res.error}`); return null; }
  try {
    const s = readSatcat(res.data);
    say(`  satcat: ${s.rows} objects, ${s.activePayloads} active payloads, Starlink active ${s.constellations.Starlink?.active}`);
    return s;
  } catch (e) { errors.push(`satcat: ${String(e)}`); return null; }
}

/* ── run ────────────────────────────────────────────────────────────────── */

interface WorldFile { features: Array<{ properties: { iso3: string; iso2: string | null; names: string[] } }> }

/** Names TeleGeography and the ITU use that Natural Earth spells differently. */
const ALIASES: Record<string, string> = {
  "congo dem rep": "COD", "democratic republic of the congo": "COD", "congo rep": "COG", "republic of the congo": "COG",
  "cote d ivoire": "CIV", "ivory coast": "CIV", "turkiye": "TUR", "turkey": "TUR", "russia": "RUS", "south korea": "KOR",
  "korea rep": "KOR", "north korea": "PRK", "vietnam": "VNM", "viet nam": "VNM", "laos": "LAO", "syria": "SYR",
  "iran": "IRN", "united states": "USA", "united kingdom": "GBR", "czechia": "CZE", "eswatini": "SWZ",
  "cabo verde": "CPV", "cape verde": "CPV", "micronesia": "FSM", "brunei": "BRN", "taiwan": "TWN", "macau": "MAC", "macao": "MAC",
  "hong kong": "HKG", "hong kong china": "HKG", "macao china": "MAC", "bahamas": "BHS", "gambia": "GMB", "the gambia": "GMB",
  "virgin islands u s": "VIR", "british virgin islands": "VGB", "saint martin": "MAF", "sint maarten": "SXM",
  "curacao": "CUW", "reunion": "REU", "mayotte": "MYT", "french guiana": "GUF", "guadeloupe": "GLP", "martinique": "MTQ",
  "sao tome and principe": "STP", "timor leste": "TLS", "east timor": "TLS", "palestine": "PSE", "state of palestine": "PSE",
  "moldova": "MDA", "tanzania": "TZA", "bolivia": "BOL", "venezuela": "VEN", "kyrgyzstan": "KGZ", "slovakia": "SVK",
  "north macedonia": "MKD", "bosnia and herzegovina": "BIH", "saint kitts and nevis": "KNA", "saint lucia": "LCA",
  "saint vincent and the grenadines": "VCT", "st kitts and nevis": "KNA", "st lucia": "LCA", "st vincent and the grenadines": "VCT",
  "trinidad and tobago": "TTO", "antigua and barbuda": "ATG", "papua new guinea": "PNG", "solomon islands": "SLB",
  "marshall islands": "MHL", "faroe islands": "FRO", "virgin islands u k": "VGB",
  "falkland malvinas is": "FLK", "falkland islands": "FLK", "christmas island": "CXR", "cocos keeling islands": "CCK",
  "bonaire sint eustatius and saba": "BES", "sint eustatius and saba": "BES", "ascension and tristan da cunha": "SHN", "tokelau": "TKL", "canary islands spain": "ESP", "azores portugal": "PRT", "madeira portugal": "PRT",
};

async function main(): Promise<void> {
  const world = JSON.parse(await readFile(WORLD, "utf8")) as WorldFile;
  const nameToIso = new Map<string, string>(Object.entries(ALIASES));
  const iso2to3 = new Map<string, string>();
  for (const f of world.features) {
    for (const n of f.properties.names) if (!nameToIso.has(norm(n))) nameToIso.set(norm(n), f.properties.iso3);
    if (f.properties.iso2) iso2to3.set(f.properties.iso2, f.properties.iso3);
  }
  const isoByName = (n: string) => nameToIso.get(norm(n)) ?? null;

  const previous: InternetData | null = existsSync(OUT) ? (JSON.parse(await readFile(OUT, "utf8")) as InternetData) : null;
  say("World Bank"); const wb = await worldBank();
  say("ITU"); const ituData = await itu(isoByName);
  say("PeeringDB"); const pdb = await peeringdb(iso2to3);
  say("Submarine cables"); const cab = await cables(isoByName);
  say("SATCAT"); const sat = await satcat();

  const fresh = [wb, ituData, pdb, cab, sat].filter(Boolean).length;
  if (fresh === 0) throw new Error(`every source failed; keeping the previous file\n${errors.join("\n")}`);
  const out: InternetData = {
    generatedAt: new Date().toISOString(),
    worldBank: wb ?? previous?.worldBank ?? null,
    itu: ituData ?? previous?.itu ?? null,
    peeringdb: pdb ?? previous?.peeringdb ?? null,
    cables: cab ?? previous?.cables ?? null,
    satcat: sat ?? previous?.satcat ?? null,
    errors: errors.slice(0, 100),
  };
  await mkdir(join(ROOT, "data", "internet"), { recursive: true });
  await writeFile(OUT, JSON.stringify(out) + "\n", "utf8");
  say(`\nwrote ${OUT}: ${fresh} of 5 sources fresh, ${errors.length} errors`);
  for (const e of errors.slice(0, 40)) say(`  ${e}`);
}

if (isEntryPoint(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
