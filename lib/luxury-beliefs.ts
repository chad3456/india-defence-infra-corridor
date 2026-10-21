/**
 * Luxury beliefs and India (/luxury-beliefs): the areas the page tests, the
 * live headline searches for each, and the parsers for the DHS Program's API,
 * which publishes India's National Family Health Survey tables broken down by
 * wealth and schooling. No node imports.
 *
 * ── The idea being tested ────────────────────────────────────────────────
 *
 * Rob Henderson's "luxury beliefs": ideas that confer status on the
 * well-off at little cost to them, while the costs fall on the poor. It is a
 * hypothesis, contested by its critics, and the page treats it as one. For
 * each area it asks two questions the data can answer — do the better-off
 * and the poor believe or choose differently, and who bears the cost of the
 * policy the better-off favour — and states the strongest case against
 * calling the belief a luxury at all. No area is scored.
 */

/** The areas the page tests, with the searches that feed each one's live headlines. */
export const AREAS = [
  { id: "language", label: "Language of schooling", q: { en: ["English medium school mother tongue instruction", "NEP mother tongue medium of instruction"], hi: ["अंग्रेजी माध्यम स्कूल मातृभाषा"] } },
  { id: "farming", label: "Organic farming and GM crops", q: { en: ["natural farming India yields", "GM mustard Bt cotton farmers"], hi: ["प्राकृतिक खेती उपज", "जीएम सरसों"] } },
  { id: "climate", label: "Climate and growth", q: { en: ["India coal phase out jobs poor", "India carbon emissions rich poor"], hi: ["कोयला खदान रोजगार"] } },
  { id: "prohibition", label: "Prohibition", q: { en: ["Bihar liquor ban hooch deaths", "Gujarat prohibition arrests"], hi: ["बिहार शराबबंदी जहरीली शराब"] } },
  { id: "family", label: "Marriage and family", q: { en: ["inter-caste marriage India", "India divorce rate marriage survey"], hi: ["अंतरजातीय विवाह"] } },
  { id: "gender", label: "Gender norms", q: { en: ["NFHS survey women attitudes India", "domestic violence India survey"], hi: ["घरेलू हिंसा सर्वे"] } },
  { id: "policing", label: "Policing and order", q: { en: ["Status of Policing in India report", "India police trust survey"], hi: ["पुलिस पर भरोसा सर्वे"] } },
] as const;
export type AreaId = (typeof AREAS)[number]["id"];

/** A headline belongs to an area if it names India and one of the area's subjects. */
const AREA_TERMS: Record<AreaId, RegExp> = {
  language: /english[- ]medium|mother tongue|medium of instruction|three[- ]language|मातृभाषा|अंग्रेजी माध्यम|हिंदी थोपने|language policy/i,
  farming: /natural farming|organic|zero budget|\bGM\b|genetically modified|bt cotton|gm mustard|fertili[sz]er|प्राकृतिक खेती|जैविक खेती|जीएम/i,
  climate: /coal|climate|emission|carbon|net[- ]zero|renewable|कोयला|जलवायु|उत्सर्जन/i,
  prohibition: /prohibition|liquor ban|dry state|hooch|spurious liquor|शराबबंदी|जहरीली शराब/i,
  family: /inter-?caste|inter-?faith|marriage|divorce|honou?r killing|live-?in|विवाह|शादी|तलाक/i,
  gender: /nfhs|domestic violence|wife[- ]beating|dowry|women'?s (?:safety|rights|work)|घरेलू हिंसा|दहेज/i,
  policing: /police|encounter|custodial|law and order|bulldozer|पुलिस|एनकाउंटर/i,
};
const INDIA = /india|indian|bihar|gujarat|delhi|mumbai|maharashtra|uttar pradesh|tamil|kerala|karnataka|punjab|bengal|rajasthan|madhya pradesh|andhra|telangana|odisha|assam|haryana|nep\b|nfhs|cbse|भारत|बिहार|गुजरात|दिल्ली|यूपी|उत्तर प्रदेश/i;
export const belongsTo = (area: AreaId, title: string) => AREA_TERMS[area].test(title) && INDIA.test(title);

/* ── NFHS through the DHS Program's API ───────────────────────────────── */

/**
 * The NFHS indicators the page shows, found in the DHS catalogue by label
 * rather than by a remembered id, so a renamed indicator is reported as not
 * found instead of silently becoming another. `sex` picks the women's or men's
 * version where DHS publishes both.
 */
export const INDICATORS: Array<{ key: string; area: AreaId; label: RegExp; loose: RegExp; sex?: "women" | "men"; title: string; higherIs: "worse" | "better" | "neither" }> = [
  { key: "wifebeat_w", area: "gender", label: /(wife beating|beating (?:his )?wife).*(at least one|any)/i, loose: /wife beating/i, sex: "women", title: "Women who say a husband is justified in beating his wife for at least one reason", higherIs: "worse" },
  { key: "wifebeat_m", area: "gender", label: /(wife beating|beating (?:his )?wife).*(at least one|any)/i, loose: /wife beating/i, sex: "men", title: "Men who say a husband is justified in beating his wife for at least one reason", higherIs: "worse" },
  { key: "tfr", area: "family", label: /^total fertility rate/i, loose: /fertility/i, title: "Total fertility rate (children per woman)", higherIs: "neither" },
  { key: "stunting", area: "family", label: /stunt|height-for-age.*below -?2/i, loose: /stunt|height/i, title: "Children under five who are stunted", higherIs: "worse" },
];
/** NFHS-5 (2019–21) and NFHS-4 (2015–16), as the DHS Program names them. */
export const SURVEYS = [{ id: "IA2020DHS", label: "NFHS-5, 2019–21" }, { id: "IA2015DHS", label: "NFHS-4, 2015–16" }] as const;

export interface DhsIndicator { IndicatorId: string; Label: string; Definition?: string }
export interface Breakdown { category: string; label: string; value: number }
export interface NfhsIndicator { key: string; id: string; dhsLabel: string; title: string; area: AreaId; higherIs: "worse" | "better" | "neither"; surveys: Record<string, { total: number | null; rows: Breakdown[] }> }
export interface NfhsRegister { updatedAt: string; source: string; status: Array<{ key: string; ok: boolean; note: string }>; indicators: NfhsIndicator[] }

/** Picks each wanted indicator from the DHS catalogue by its label (and sex, where both are published). */
export function pickIndicators(catalogue: DhsIndicator[]): Map<string, DhsIndicator> {
  const out = new Map<string, DhsIndicator>();
  for (const want of INDICATORS) {
    const cands = catalogue.filter((c) => want.label.test(c.Label) && (!want.sex || new RegExp(want.sex === "women" ? "\\bwom[ae]n\\b" : "(?<!wo)\\bmen\\b", "i").test(`${c.Label} ${c.Definition ?? ""}`)));
    // The shortest label is the headline indicator; longer ones are its variants ("…among the employed").
    const best = cands.sort((a, b) => a.Label.length - b.Label.length)[0];
    if (best) out.set(want.key, best);
  }
  return out;
}

/** For an indicator not found: the catalogue labels nearest it, so the next fix is a matter of reading the log. */
export function nearest(catalogue: DhsIndicator[], key: string): string[] {
  const w = INDICATORS.find((x) => x.key === key);
  return w ? catalogue.filter((c) => w.loose.test(c.Label)).map((c) => `${c.IndicatorId}: ${c.Label}`).slice(0, 8) : [];
}

/** The catalogue as the DHS API returns it. */
export function parseIndicators(body: unknown): DhsIndicator[] {
  const data = (body as { Data?: Array<Record<string, unknown>> })?.Data ?? [];
  return data.flatMap((d) => (typeof d.IndicatorId === "string" && typeof d.Label === "string" ? [{ IndicatorId: d.IndicatorId, Label: d.Label, Definition: typeof d.Definition === "string" ? d.Definition : undefined }] : []));
}

/** Data rows: the national figure, and the breakdowns by wealth quintile, schooling and residence. */
const CATEGORIES = /^(wealth quintile|education|residence)$/i;
export function parseData(body: unknown): Array<{ id: string; survey: string; category: string; label: string; value: number }> {
  const data = (body as { Data?: Array<Record<string, unknown>> })?.Data ?? [];
  return data.flatMap((d) => {
    const cat = String(d.CharacteristicCategory ?? ""), by = String(d.ByVariableLabel ?? "");
    if (typeof d.Value !== "number" || typeof d.IndicatorId !== "string" || typeof d.SurveyId !== "string") return [];
    // A by-variable splits the indicator further (an age group, a period); only the indicator's own figure is kept.
    if (by && !/^\s*$/.test(by) && d.IsPreferred !== 1) return [];
    if (cat.toLowerCase() !== "total" && !CATEGORIES.test(cat)) return [];
    return [{ id: d.IndicatorId, survey: d.SurveyId, category: cat.toLowerCase() === "total" ? "Total" : cat, label: String(d.CharacteristicLabel ?? ""), value: d.Value }];
  });
}

/** Wealth quintiles and schooling levels in their natural order, lowest first, whatever order the API returns. */
const ORDER = ["lowest", "second", "middle", "fourth", "highest", "no education", "primary", "secondary", "higher", "urban", "rural"];
export const rank = (label: string) => { const i = ORDER.findIndex((o) => new RegExp(`^${o}\\b`, "i").test(label.trim())); return i < 0 ? 99 : i; };

/** The gap between the top and the bottom of a breakdown, in the indicator's own units. Null if either end is missing. */
export function gap(rows: Breakdown[], category: string): { low: Breakdown; high: Breakdown; diff: number } | null {
  const r = rows.filter((x) => x.category.toLowerCase() === category.toLowerCase()).sort((a, b) => rank(a.label) - rank(b.label));
  const low = r[0], high = r.at(-1);
  return low && high && low !== high ? { low, high, diff: Math.round((high.value - low.value) * 10) / 10 } : null;
}

/* ── Published figures ────────────────────────────────────────────────── */

export interface LbSource { id: string; publisher: string; title: string; url: string; published: string | null; accessed: string; tier: 1 | 2 | 3; provenance: string }
export interface LbFigure { label: string; value: number | null; display: string; source: string; quote: string; who?: "better-off" | "poor" | "all"; notes?: string }
export interface LbArea { id: AreaId; belief: string; whoHolds: string; whoPays: string; figures: LbFigure[]; against: string; verdict: string }
export interface LbPublished {
  about: string;
  concept: { definition: string; source: string; quote: string; critiques: Array<{ who: string; point: string; source: string }> };
  sources: LbSource[];
  areas: LbArea[];
}
