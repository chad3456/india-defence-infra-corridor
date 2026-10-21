/**
 * Luxury beliefs and India: the NFHS class breakdowns.
 *
 * `npm run nfhs:class`. Writes data/luxury-beliefs/nfhs.json. CI only.
 *
 * Reads the DHS Program's public API, which publishes India's National Family
 * Health Survey (NFHS-4 and NFHS-5) tables broken down by wealth quintile,
 * schooling and residence. Each indicator is found in the DHS catalogue by its
 * label (lib/luxury-beliefs.ts), so a renamed indicator is reported as not
 * found rather than silently replaced by another. Values are written as the
 * API gives them; nothing is computed here but the order of the rows.
 *
 * Connectors never throw: if the API fails, the previous file stays and the
 * run says why.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getJson } from "../lib/http";
import { isEntryPoint } from "../lib/entry";
import { INDICATORS, SURVEYS, parseData, parseIndicators, pickIndicators, rank, type NfhsIndicator, type NfhsRegister } from "../../../lib/luxury-beliefs";

const OUT = join(process.cwd(), "data", "luxury-beliefs", "nfhs.json");
const API = "https://api.dhsprogram.com/rest/dhs";

export async function run(): Promise<void> {
  const previous: NfhsRegister | null = existsSync(OUT) ? (JSON.parse(await readFile(OUT, "utf8")) as NfhsRegister) : null;
  const cat = await getJson<unknown>(`${API}/indicators?surveyIds=${SURVEYS[0].id}&returnFields=IndicatorId,Label,Definition&f=json&perpage=5000`, { timeoutMs: 90_000, retries: 2, cacheMs: 0 });
  if (!cat.ok) { console.error(`DHS catalogue: ${cat.error}; the previous file is kept`); if (!previous) process.exit(1); return; }
  const catalogue = parseIndicators(cat.data);
  const picked = pickIndicators(catalogue);
  console.log(`catalogue: ${catalogue.length} indicators; matched ${picked.size} of ${INDICATORS.length}`);
  for (const w of INDICATORS) console.log(`  ${picked.has(w.key) ? "ok  " : "MISS"} ${w.key}: ${picked.get(w.key)?.IndicatorId ?? "—"} ${picked.get(w.key)?.Label ?? ""}`);

  const ids = [...new Set([...picked.values()].map((p) => p.IndicatorId))];
  const rows: ReturnType<typeof parseData> = [];
  for (let page = 1; page <= 20 && ids.length; page++) {
    const r = await getJson<{ TotalPages?: number }>(`${API}/data?surveyIds=${SURVEYS.map((s) => s.id).join(",")}&indicatorIds=${ids.join(",")}&breakdown=background&returnFields=IndicatorId,SurveyId,CharacteristicCategory,CharacteristicLabel,Value,ByVariableLabel,IsPreferred&f=json&perpage=5000&page=${page}`, { timeoutMs: 90_000, retries: 2, cacheMs: 0 });
    if (!r.ok) { console.error(`DHS data page ${page}: ${r.error}; the previous file is kept`); if (!previous) process.exit(1); return; }
    rows.push(...parseData(r.data));
    if ((r.data?.TotalPages ?? 1) <= page) break;
  }

  const status: NfhsRegister["status"] = [];
  const indicators: NfhsIndicator[] = INDICATORS.flatMap((w) => {
    const p = picked.get(w.key);
    if (!p) { status.push({ key: w.key, ok: false, note: "no indicator in the DHS catalogue matches this label" }); return []; }
    const surveys: NfhsIndicator["surveys"] = {};
    for (const s of SURVEYS) {
      const mine = rows.filter((r) => r.id === p.IndicatorId && r.survey === s.id);
      if (!mine.length) continue;
      // One row per category and label: the first the API returns (its preferred one).
      const seen = new Set<string>();
      const uniq = mine.filter((r) => { const k = `${r.category}|${r.label}`; if (seen.has(k)) return false; seen.add(k); return true; });
      surveys[s.id] = { total: uniq.find((r) => r.category === "Total")?.value ?? null, rows: uniq.filter((r) => r.category !== "Total").map((r) => ({ category: r.category, label: r.label, value: r.value })).sort((a, b) => a.category.localeCompare(b.category) || rank(a.label) - rank(b.label)) };
    }
    status.push({ key: w.key, ok: !!surveys[SURVEYS[0].id], note: surveys[SURVEYS[0].id] ? `${p.IndicatorId}` : "matched, but no NFHS-5 rows" });
    return [{ key: w.key, id: p.IndicatorId, dhsLabel: p.Label, title: w.title, area: w.area, higherIs: w.higherIs, surveys }];
  });

  const reg: NfhsRegister = { updatedAt: new Date().toISOString(), source: "https://api.dhsprogram.com/", status, indicators };
  if (previous && JSON.stringify({ ...previous, updatedAt: "" }) === JSON.stringify({ ...reg, updatedAt: "" })) { console.log("no change; nothing written"); return; }
  await mkdir(join(process.cwd(), "data", "luxury-beliefs"), { recursive: true });
  await writeFile(OUT, JSON.stringify(reg, null, 1) + "\n", "utf8");
  console.log(`wrote ${OUT}: ${indicators.length} indicators`);
  if (!indicators.some((i) => i.surveys[SURVEYS[0].id])) { console.error("no NFHS-5 rows at all"); process.exit(1); }
}

if (isEntryPoint(import.meta.url)) {
  run().catch((e) => { console.error(e); process.exit(1); });
}
