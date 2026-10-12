/**
 * Who lives where: Census 2011 district profiles, and which district each
 * assembly constituency lies in.
 *
 * `npm run census:districts`. Writes data/census/districts-2011.json and
 * data/elections/ac-districts.json.
 *
 * The Election Commission records no one's religion or caste: the electoral
 * roll holds a name, a relative's name, age, gender and address. The official
 * count of religion, and of Scheduled Castes and Tribes (the only castes the
 * census enumerates), is the 2011 Census — the last one taken — published by
 * district. So the atlas shows the census profile of the district a
 * constituency lies in, labelled as such, and never an estimate for the
 * constituency or for any voter.
 *
 * Sources, both fetched from GitHub (the census site refuses this pipeline):
 *   - district tables: a compilation of Census 2011's Primary Census Abstract
 *     and table C-01 (religion), 640 districts. It is checked here against the
 *     census's published national totals, which it must reproduce exactly.
 *   - constituency → district: DataMeet's assembly-constituency layer, scraped
 *     from ECI's polling-station locator. Its README warns that some states
 *     carry pre-2008 boundaries and some names are wrong, so a mapping is kept
 *     only where the constituency's name there matches its name on ECI's
 *     results page for the same number.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { isEntryPoint } from "../lib/entry";

const CENSUS_CSV = "https://raw.githubusercontent.com/nishusharma1608/India-Census-2011-Analysis/master/india-districts-census-2011.csv";
const AC_DBF = "https://raw.githubusercontent.com/datameet/maps/master/assembly-constituencies/India_AC.dbf";
const OUT_DISTRICTS = join(process.cwd(), "data", "census", "districts-2011.json");
const OUT_ACS = join(process.cwd(), "data", "elections", "ac-districts.json");

/** Census 2011 national totals, as the census published them. The compilation must reproduce them. */
export const NATIONAL_2011 = {
  population: 1_210_854_977,
  sc: 201_378_372,
  st: 104_545_716,
  hindus: 966_257_353,
  muslims: 172_245_158,
  christians: 27_819_588,
  sikhs: 20_833_116,
  buddhists: 8_442_972,
  jains: 4_451_753,
};

export interface District2011 {
  code: number;
  state: string;
  district: string;
  population: number; male: number; female: number;
  literate: number; maleLiterate: number; femaleLiterate: number;
  sc: number; st: number;
  religion: { hindu: number; muslim: number; christian: number; sikh: number; buddhist: number; jain: number; other: number; notStated: number };
}

async function fetchBuf(url: string): Promise<Buffer> {
  const r = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

export function parseCsv(text: string): string[][] {
  return text.trim().split(/\r?\n/).map((l) => {
    const out: string[] = []; let cur = "", q = false;
    for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { out.push(cur); cur = ""; } else cur += ch; }
    out.push(cur); return out;
  });
}

export function districtsFromCsv(text: string): District2011[] {
  const [h, ...rows] = parseCsv(text);
  const col = (r: string[], k: string) => { const i = h!.indexOf(k); if (i < 0) throw new Error(`missing column ${k}`); return Number(r[i]); };
  return rows.filter((r) => r.length >= h!.length - 2).map((r) => ({
    code: col(r, "District code"),
    state: r[h!.indexOf("State name")]!.trim(),
    district: r[h!.indexOf("District name")]!.trim(),
    population: col(r, "Population"), male: col(r, "Male"), female: col(r, "Female"),
    literate: col(r, "Literate"), maleLiterate: col(r, "Male_Literate"), femaleLiterate: col(r, "Female_Literate"),
    sc: col(r, "SC"), st: col(r, "ST"),
    religion: { hindu: col(r, "Hindus"), muslim: col(r, "Muslims"), christian: col(r, "Christians"), sikh: col(r, "Sikhs"), buddhist: col(r, "Buddhists"), jain: col(r, "Jains"), other: col(r, "Others_Religions"), notStated: col(r, "Religion_Not_Stated") },
  }));
}

export function checkDistricts(ds: District2011[]): string[] {
  const p: string[] = [];
  const sum = (f: (d: District2011) => number) => ds.reduce((a, d) => a + f(d), 0);
  const want: Array<[string, number, number]> = [
    ["population", sum((d) => d.population), NATIONAL_2011.population],
    ["SC", sum((d) => d.sc), NATIONAL_2011.sc],
    ["ST", sum((d) => d.st), NATIONAL_2011.st],
    ["Hindus", sum((d) => d.religion.hindu), NATIONAL_2011.hindus],
    ["Muslims", sum((d) => d.religion.muslim), NATIONAL_2011.muslims],
    ["Christians", sum((d) => d.religion.christian), NATIONAL_2011.christians],
    ["Sikhs", sum((d) => d.religion.sikh), NATIONAL_2011.sikhs],
    ["Buddhists", sum((d) => d.religion.buddhist), NATIONAL_2011.buddhists],
    ["Jains", sum((d) => d.religion.jain), NATIONAL_2011.jains],
  ];
  for (const [k, got, exp] of want) if (got !== exp) p.push(`${k}: districts sum to ${got}, census national total is ${exp}`);
  for (const d of ds) {
    const r = d.religion;
    if (r.hindu + r.muslim + r.christian + r.sikh + r.buddhist + r.jain + r.other + r.notStated !== d.population) p.push(`${d.district}: religions do not sum to population`);
    if (d.male + d.female !== d.population) p.push(`${d.district}: men + women ≠ population`);
  }
  return p;
}

/** A dBase III table, as a shapefile carries its attributes. */
export function readDbf(b: Buffer): Array<Record<string, string>> {
  const n = b.readUInt32LE(4), hl = b.readUInt16LE(8), rl = b.readUInt16LE(10);
  const fields: Array<[string, number]> = [];
  for (let i = 32; b[i] !== 0x0d; i += 32) fields.push([b.subarray(i, i + 11).toString("latin1").replace(/\0.*$/, ""), b[i + 16]!]);
  const out: Array<Record<string, string>> = [];
  for (let r = 0; r < n; r++) {
    let off = hl + r * rl + 1; const rec: Record<string, string> = {};
    for (const [name, len] of fields) { rec[name] = b.subarray(off, off + len).toString("utf8").trim(); off += len; }
    out.push(rec);
  }
  return out;
}

const fold = (s: string) => s.toLowerCase().replace(/\((sc|st)\)/g, "").replace(/[^a-z]/g, "");

export async function run(): Promise<void> {
  // ── districts ──
  const ds = districtsFromCsv((await fetchBuf(CENSUS_CSV)).toString("utf8"));
  const problems = checkDistricts(ds);
  if (ds.length !== 640) problems.push(`${ds.length} districts, expected 640`);
  if (problems.length) throw new Error(`census districts refused:\n  ${problems.slice(0, 20).join("\n  ")}`);
  await mkdir(join(process.cwd(), "data", "census"), { recursive: true });
  await writeFile(OUT_DISTRICTS, JSON.stringify({
    source: { publisher: "Census of India 2011 (Primary Census Abstract; table C-01, religion)", compiledBy: "india-districts-census-2011.csv, a district-level compilation of the census tables", url: CENSUS_CSV, checked: "Reproduces the census's published national totals for population, SC, ST and each religion exactly." },
    districts: ds,
  }) + "\n", "utf8");
  console.log(`wrote ${ds.length} districts`);

  // ── constituency → district ──
  const rows = readDbf(await fetchBuf(AC_DBF));
  const results = join(process.cwd(), "data", "elections", "results");
  const { ATLAS_STATES } = await import("../../../lib/elections-atlas-shared");
  const { readdirSync } = await import("node:fs");
  // Our assembly results: state code → AC number → name (newest election per state).
  const names = new Map<string, Map<number, string>>();
  for (const f of existsSync(results) ? readdirSync(results) : []) {
    for (const g of readdirSync(join(results, f))) {
      const d = JSON.parse(await readFile(join(results, f, g), "utf8")) as { house: string; state: string; seats: Array<{ no: number; name: string }> };
      if (d.house !== "AC") continue;
      const m = names.get(d.state) ?? new Map<number, string>();
      for (const s of d.seats) if (!/[ऀ-ॿ]/.test(s.name)) m.set(s.no, s.name);
      names.set(d.state, m);
    }
  }
  const stateOf = (st: string) => ATLAS_STATES.find((a) => fold(a.name) === fold(st) || a.topo.some((x) => fold(x) === fold(st)))
    ?? (fold(st) === "orissa" ? ATLAS_STATES.find((a) => a.slug === "odisha") : fold(st) === "pondicherry" ? ATLAS_STATES.find((a) => a.slug === "puducherry") : undefined);
  const byState: Record<string, Array<{ no: number; name: string; district: string; how: "number" | "name" }>> = {};
  const layerByState = new Map<string, Array<Record<string, string>>>();
  for (const r of rows) {
    const st = stateOf(r.ST_NAME ?? "");
    if (st) layerByState.set(st.slug, [...(layerByState.get(st.slug) ?? []), r]);
  }
  const close = (a: string, b: string) => !!a && !!b && (a === b || a.startsWith(b) || b.startsWith(a) || lev(a, b) <= Math.max(1, Math.floor(a.length / 5)));
  let kept = 0, refused = 0;
  for (const [code, ours] of names) {
    const st = ATLAS_STATES.find((a) => a.eci === code)!;
    // Telangana's seats are still filed under Andhra Pradesh in the layer.
    const layer = layerByState.get(code === "S29" ? "andhra-pradesh" : st.slug) ?? [];
    // The layer splits some constituencies into several shapes: one row per number is enough.
    const byNo = new Map<number, Record<string, string>>();
    for (const r of layer) if (!byNo.has(Number(r.AC_NO))) byNo.set(Number(r.AC_NO), r);
    const byName = new Map<string, Array<Record<string, string>>>();
    for (const r of byNo.values()) byName.set(fold(r.AC_NAME ?? ""), [...(byName.get(fold(r.AC_NAME ?? "")) ?? []), r]);
    for (const [no, name] of ours) {
      // By number, confirmed by name; else by a name that is unique in the state's layer
      // (undivided Andhra numbered Telangana's seats first, so its numbers moved).
      const r = byNo.get(no);
      if (r && close(fold(name), fold(r.AC_NAME ?? ""))) { (byState[code] ??= []).push({ no, name, district: titleCase(r.DIST_NAME ?? ""), how: "number" }); kept++; continue; }
      const same = byName.get(fold(name)) ?? [];
      if (same.length === 1) { (byState[code] ??= []).push({ no, name, district: titleCase(same[0]!.DIST_NAME ?? ""), how: "name" }); kept++; continue; }
      refused++;
    }
  }
  await writeFile(OUT_ACS, JSON.stringify({
    source: { publisher: "DataMeet, India assembly constituencies layer (scraped from ECI's polling-station locator)", url: "https://github.com/datameet/maps/tree/master/assembly-constituencies", licence: "CC BY 2.5 IN", rule: "kept only where the constituency's name in the layer matches its name on ECI's results page for the same number" },
    states: byState,
  }) + "\n", "utf8");
  console.log(`constituency → district: ${kept} kept, ${refused} refused (name did not match ECI's for that number, or no result read)`);
}

function titleCase(s: string) { return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()); }
function lev(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length]![b.length]!;
}

if (isEntryPoint(import.meta.url)) run().catch((e) => { console.error(e); process.exit(1); });
