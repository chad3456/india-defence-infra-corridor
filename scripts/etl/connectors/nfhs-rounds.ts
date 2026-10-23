/**
 * Every NFHS round in the DHS Program's API, metric by metric: `npm run nfhs:rounds`.
 * Writes data/nfhs/rounds.json. CI only — the editing sandbox cannot reach the API.
 *
 * Asks DHS which India surveys it holds (it does not assume NFHS-6 is or is
 * not there), finds each metric by its DHS id or, failing that, its label,
 * and reads the national figure, urban and rural, the poorest and richest
 * fifths, and every state, for every round. Logs the nearest catalogue
 * labels for any metric it cannot find. Values are as DHS publishes them.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getJson } from "../lib/http";
import { isEntryPoint } from "../lib/entry";
import { METRICS, WITHHELD, parseSurveys, type MetricSeries, type NfhsRounds, type Point } from "../../../lib/nfhs";

const API = "https://api.dhsprogram.com/rest/dhs";
const OUT = join(process.cwd(), "data", "nfhs", "rounds.json");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function run(): Promise<void> {
  const prev = existsSync(OUT) ? (JSON.parse(await readFile(OUT, "utf8")) as NfhsRounds) : null;
  const sv = await getJson<unknown>(`${API}/surveys?countryIds=IA&f=json&perpage=100`, { timeoutMs: 90_000, retries: 2, cacheMs: 0 });
  if (!sv.ok) { console.error(`surveys: ${sv.error}`); if (!prev) process.exit(1); return; }
  const surveys = parseSurveys(sv.data).filter((s) => s.year >= 1998);
  console.log(`surveys: ${surveys.map((s) => `${s.id} (${s.label}, released ${s.released ?? "?"})`).join("; ")}`);

  // The catalogue across every round, so a metric found in any of them is found.
  const cat = await getJson<{ Data?: Array<{ IndicatorId?: string; Label?: string; Definition?: string }> }>(`${API}/indicators?surveyIds=${surveys.map((s) => s.id).join(",")}&returnFields=IndicatorId,Label,Definition&f=json&perpage=5000`, { timeoutMs: 120_000, retries: 2, cacheMs: 0 });
  if (!cat.ok) { console.error(`catalogue: ${cat.error}`); if (!prev) process.exit(1); return; }
  const catalogue = (cat.data?.Data ?? []).filter((c): c is { IndicatorId: string; Label: string; Definition?: string } => typeof c.IndicatorId === "string" && typeof c.Label === "string");
  console.log(`catalogue: ${catalogue.length} indicators`);
  const picked = new Map<string, (typeof catalogue)[number]>();
  const missing: NfhsRounds["missing"] = [];
  for (const m of METRICS) {
    const byId = m.ids.map((id) => catalogue.find((c) => c.IndicatorId === id)).find(Boolean);
    const byLabel = catalogue.filter((c) => m.label.test(c.Label) && (!m.sex || new RegExp(m.sex === "women" ? "\\bwom[ae]n\\b" : "(?<!wo)\\bmen\\b", "i").test(`${c.Label} ${c.Definition ?? ""}`))).sort((a, b) => a.Label.length - b.Label.length)[0];
    const hit = byId ?? byLabel;
    if (hit) { picked.set(m.key, hit); console.log(`  ok   ${m.key}: ${hit.IndicatorId} "${hit.Label}"${byId ? "" : " (by label)"}`); }
    else {
      missing.push({ key: m.key, note: "not in the DHS catalogue for India" });
      const words = m.title.toLowerCase().split(/\W+/).filter((w) => w.length > 5).slice(0, 2);
      console.log(`  MISS ${m.key}; near: ${catalogue.filter((c) => words.some((w) => c.Label.toLowerCase().includes(w))).slice(0, 6).map((c) => `${c.IndicatorId} "${c.Label}"`).join(" | ")}`);
    }
  }

  // Data: national, background (urban/rural, wealth) and subnational (states), all rounds.
  const ids = [...new Set([...picked.values()].map((p) => p.IndicatorId))];
  type Row = { IndicatorId?: string; SurveyId?: string; CharacteristicCategory?: string; CharacteristicLabel?: string; Value?: number; ByVariableLabel?: string; IsPreferred?: number };
  const rows: Row[] = [];
  for (const breakdown of ["national", "background", "subnational"]) {
    for (let i = 0; i < ids.length; i += 8) {
      for (let page = 1; page <= 30; page++) {
        const r = await getJson<{ Data?: Row[]; TotalPages?: number }>(`${API}/data?surveyIds=${surveys.map((s) => s.id).join(",")}&indicatorIds=${ids.slice(i, i + 8).join(",")}&breakdown=${breakdown}&returnFields=IndicatorId,SurveyId,CharacteristicCategory,CharacteristicLabel,Value,ByVariableLabel,IsPreferred&f=json&perpage=5000&page=${page}`, { timeoutMs: 120_000, retries: 2, cacheMs: 0 });
        await sleep(1_000);
        if (!r.ok) { console.log(`  data ${breakdown} ${i} p${page}: ${r.error}`); break; }
        rows.push(...(r.data?.Data ?? []));
        if ((r.data?.TotalPages ?? 1) <= page) break;
      }
    }
  }
  console.log(`data rows: ${rows.length}`);
  const cats = new Map<string, Set<string>>();
  for (const r of rows) { const k = String(r.CharacteristicCategory); cats.set(k, (cats.get(k) ?? new Set()).add(String(r.CharacteristicLabel))); }
  for (const [k, v] of cats) console.log(`  category "${k}": ${[...v].slice(0, 8).join(", ")}${v.size > 8 ? ` … (${v.size})` : ""}`);

  // An indicator's own figure: no by-variable split, or the one DHS marks preferred.
  const own = (r: Row) => !r.ByVariableLabel || r.IsPreferred === 1;
  const metrics: MetricSeries[] = [];
  const withheld: NfhsRounds["withheld"] = [];
  for (const m of METRICS) {
    const p = picked.get(m.key);
    if (!p) continue;
    const mine = rows.filter((r) => r.IndicatorId === p.IndicatorId && typeof r.Value === "number");
    const val = (s: string, cat: RegExp, lab: RegExp) => mine.find((r) => r.SurveyId === s && own(r) && cat.test(String(r.CharacteristicCategory)) && lab.test(String(r.CharacteristicLabel)))?.Value ?? null;
    // Child marriage is published by age: the 20–24 row is the headline.
    // Some indicators are filed under the age range they cover ("Total 15-49").
    const total = (s: string) => (m.key === "married18" ? val(s, /^age/i, /^20-24$/) : val(s, /^total$/i, /.*/) ?? val(s, /^total 15-49$/i, /.*/));
    // Where a round has more than one candidate national row, log them all: which is the headline is read, not guessed.
    for (const s of surveys) {
      const c = mine.filter((r) => r.SurveyId === s.id && /^total/i.test(String(r.CharacteristicCategory)));
      if (c.length !== 1) console.log(`  ? ${m.key} ${s.id}: ${c.map((r) => `[${r.CharacteristicCategory} | by="${r.ByVariableLabel ?? ""}" pref=${r.IsPreferred}] ${r.Value}`).join("  ") || "no Total row"}`);
    }
    if (m.key === "married18") for (const r of mine.filter((x) => x.SurveyId === surveys.at(-1)?.id).slice(0, 12)) console.log(`  ? married18 row: [${r.CharacteristicCategory}: ${r.CharacteristicLabel} | by="${r.ByVariableLabel ?? ""}" pref=${r.IsPreferred}] ${r.Value}`);
    const points: Point[] = surveys.map((s) => {
      const states: Record<string, number> = {};
      for (const r of mine.filter((x) => x.SurveyId === s.id && own(x) && /^(region|state)/i.test(String(x.CharacteristicCategory)))) states[String(r.CharacteristicLabel).replace(/^\.+/, "").trim()] = r.Value!;
      return { survey: s.id, total: total(s.id), urban: val(s.id, /^residence$/i, /^urban$/i), rural: val(s.id, /^residence$/i, /^rural$/i), poorest: val(s.id, /^wealth quintile$/i, /^lowest$/i), richest: val(s.id, /^wealth quintile$/i, /^highest$/i), states };
    });
    for (const w of WITHHELD.filter((x) => x.key === m.key)) {
      const i = points.findIndex((pt) => pt.survey === w.survey);
      if (i < 0) continue;
      withheld.push({ key: m.key, survey: w.survey, returned: points[i]!.total, why: w.why });
      points[i] = { survey: w.survey, total: null, urban: null, rural: null, poorest: null, richest: null, states: {} };
      console.log(`  withheld ${m.key} ${w.survey} (DHS returned ${withheld.at(-1)!.returned})`);
    }
    if (!points.some((pt) => pt.total !== null)) { missing.push({ key: m.key, note: `${p.IndicatorId} matched, but no national figure in any round` }); continue; }
    metrics.push({ key: m.key, id: p.IndicatorId, dhsLabel: p.Label, definition: p.Definition ?? "", points });
    console.log(`  ${m.key}: ${points.map((pt) => `${pt.survey.slice(2, 6)}=${pt.total ?? "—"} (${Object.keys(pt.states).length} states)`).join("  ")}`);
  }

  const doc: NfhsRounds = { fetchedAt: new Date().toISOString(), source: "https://api.dhsprogram.com/", surveys, metrics, missing, withheld };
  if (prev && JSON.stringify({ ...prev, fetchedAt: "" }) === JSON.stringify({ ...doc, fetchedAt: "" })) { console.log("no change"); return; }
  await mkdir(join(process.cwd(), "data", "nfhs"), { recursive: true });
  await writeFile(OUT, JSON.stringify(doc, null, 1) + "\n");
  console.log(`wrote ${metrics.length} metrics across ${surveys.length} rounds; missing ${missing.map((x) => x.key).join(", ") || "none"}`);
  if (!metrics.length) process.exit(1);
}

if (isEntryPoint(import.meta.url)) {
  run().catch((e) => { console.error(e); process.exit(1); });
}
