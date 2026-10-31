/**
 * V-Party (V-Dem Institute): expert-coded positions of political parties in
 * 178 countries since 1970, read from the CSV that scripts/etl/r/vparty-extract.R
 * writes out of the V-Dem Institute's own R package data. Runs in Actions.
 *
 * Writes each party's most recent coded observation with its raw variables.
 * Nothing here maps a variable onto an axis — that is lib/axes-anchors.ts,
 * whose scale directions are tested against undisputed cases on every build.
 * Connectors never throw; a failed gate leaves the committed files as they were.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { csvObjects } from "../lib/csv";

const DIR = process.env.VPARTY_DIR ?? "";
const OUT = join(process.cwd(), "data", "axes");
const ID_COLS = new Set(["country_name", "country_text_id", "year", "v2paid", "v2paenname", "v2paorname", "v2pashname", "v2pavote", "v2paseatshare", "v2pagovsup"]);

function main() {
  const csv = join(DIR, "vparty-slim.csv");
  if (!DIR || !existsSync(csv)) { console.error("vparty: no extract to read"); return; }
  const rows = csvObjects(readFileSync(csv, "utf8"));
  // The ordinal-scale versions (what an expert answered on: 0–4, 0–6 for left-right) and the two indices, with their intervals.
  const vars = Object.keys(rows[0] ?? {}).filter((k) => !ID_COLS.has(k) && (/_osp$/.test(k) || /^v2xpa_/.test(k)));
  const num = (s: string | undefined) => (s === undefined || s === "" || s === "NA" ? null : Number.isFinite(Number(s)) ? Math.round(Number(s) * 1000) / 1000 : null);
  // Each party's latest year that experts actually coded; a party never coded is left out.
  const coded = (r: Record<string, string>) => vars.some((k) => num(r[k]) !== null);
  const latest = new Map<string, Record<string, string>>();
  for (const r of rows) {
    const id = r.v2paid;
    if (!id || !coded(r)) continue;
    const prev = latest.get(id);
    if (!prev || Number(r.year) > Number(prev.year)) latest.set(id, r);
  }
  const parties = [...latest.values()].map((r) => ({
    id: Number(r.v2paid), country: r.country_name, iso3: r.country_text_id, year: Number(r.year),
    name: r.v2paenname || r.v2paorname, orig: r.v2paorname || undefined, abbr: r.v2pashname || undefined,
    vote: num(r.v2pavote), seats: num(r.v2paseatshare), gov: num(r.v2pagovsup),
    v: Object.fromEntries(vars.map((k) => [k, num(r[k])]).filter(([, x]) => x !== null)),
  })).sort((a, b) => a.country!.localeCompare(b.country!) || (b.vote ?? 0) - (a.vote ?? 0));
  const countries = new Set(parties.map((p) => p.country));
  const fails: string[] = [];
  if (parties.length < 1200) fails.push(`only ${parties.length} parties`);
  if (countries.size < 150) fails.push(`only ${countries.size} countries`);
  for (const k of ["v2pariglef_osp", "v2pawelf_osp", "v2paimmig_osp", "v2palgbt_osp", "v2parelig_osp", "v2paculsup_osp", "v2pawomlab_osp", "v2xpa_popul", "v2xpa_antiplural"]) if (!vars.includes(k)) fails.push(`no ${k} column`);
  if (fails.length) { console.error(`vparty: gate failed: ${fails.join("; ")}`); return; }
  mkdirSync(OUT, { recursive: true });
  const commit = existsSync(join(DIR, "commit.txt")) ? readFileSync(join(DIR, "commit.txt"), "utf8").trim() : null;
  writeFileSync(join(OUT, "vparty.json"), JSON.stringify({
    source: { title: "Varieties of Party Identity and Organization (V-Party) dataset", publisher: "V-Dem Institute, University of Gothenburg", url: "https://www.v-dem.net/data/v-party-dataset/", via: "https://github.com/vdeminstitute/vdemdata", commit, licence: "CC BY-SA 4.0" },
    fetchedAt: new Date().toISOString(), rows: rows.length, variables: vars, parties,
  }) + "\n");
  console.log(`vparty: ${rows.length} rows, ${parties.length} parties, ${countries.size} countries, ${vars.length} variables`);
}

try { main(); } catch (e) { console.error(`vparty: ${String(e).slice(0, 300)}`); }
