/**
 * India's National Family Health Survey, every round in the DHS Program's API,
 * compared metric by metric (/health). Shared by the connector, the page and
 * the tests. No node imports.
 *
 * ── Why DHS ──────────────────────────────────────────────────────────────
 *
 * NFHS rounds are run by IIPS for the Health Ministry; the DHS Program
 * publishes each round's tables with definitions harmonised across rounds and
 * countries, by an API. Its indicators are what make "the same metric in 1998
 * and in 2020" a defensible comparison. Where a round did not measure a metric
 * the value is absent and drawn as a gap, never filled.
 */

export type Theme = "Fertility & family planning" | "Child survival" | "Nutrition" | "Maternal care" | "Immunisation" | "Women's lives" | "Households";

/**
 * The metrics compared across rounds. `ids` are DHS indicator ids, tried in
 * order; `label` finds the indicator by its catalogue label if the ids are not
 * there, so a renamed id is reported rather than silently replaced.
 * `higherIs` sets the colour of a change, not a judgement of the people.
 */
export const METRICS: Array<{ key: string; theme: Theme; title: string; unit: "%" | "per 1,000" | "children"; higherIs: "better" | "worse" | "neither"; ids: string[]; label: RegExp; sex?: "women" | "men" }> = [
  { key: "tfr", theme: "Fertility & family planning", title: "Total fertility rate", unit: "children", higherIs: "neither", ids: ["FE_FRTR_W_TFR"], label: /^total fertility rate/i },
  { key: "modern_fp", theme: "Fertility & family planning", title: "Married women using a modern contraceptive method", unit: "%", higherIs: "better", ids: ["FP_CUSM_W_MOD"], label: /married women.*(current(ly)? us|using).*modern/i },
  { key: "unmet", theme: "Fertility & family planning", title: "Married women with an unmet need for family planning", unit: "%", higherIs: "worse", ids: ["FP_NADM_W_UNT"], label: /unmet need for family planning.*total|^unmet need.*total/i },
  { key: "teen_births", theme: "Fertility & family planning", title: "Women aged 15–19 who have begun childbearing", unit: "%", higherIs: "worse", ids: ["FE_TBCB_W_BEG"], label: /(15-19|teen).*begun childbearing|begun childbearing/i },
  { key: "imr", theme: "Child survival", title: "Infant mortality", unit: "per 1,000", higherIs: "worse", ids: ["CM_ECMR_C_IMR"], label: /^infant mortality rate/i },
  { key: "u5mr", theme: "Child survival", title: "Under-five mortality", unit: "per 1,000", higherIs: "worse", ids: ["CM_ECMR_C_U5M"], label: /^under-five mortality rate/i },
  { key: "nmr", theme: "Child survival", title: "Neonatal mortality", unit: "per 1,000", higherIs: "worse", ids: ["CM_ECMR_C_NNR"], label: /^neonatal mortality rate/i },
  { key: "stunting", theme: "Nutrition", title: "Children under five who are stunted", unit: "%", higherIs: "worse", ids: ["CN_NUTS_C_HA2"], label: /^children stunted$/i },
  { key: "wasting", theme: "Nutrition", title: "Children under five who are wasted", unit: "%", higherIs: "worse", ids: ["CN_NUTS_C_WH2"], label: /^children wasted$/i },
  { key: "underweight", theme: "Nutrition", title: "Children under five who are underweight", unit: "%", higherIs: "worse", ids: ["CN_NUTS_C_WA2"], label: /^children underweight$/i },
  { key: "anaemia_child", theme: "Nutrition", title: "Children (6–59 months) with any anaemia", unit: "%", higherIs: "worse", ids: ["CN_ANMC_C_ANY"], label: /^children with any anemia/i },
  { key: "anaemia_women", theme: "Nutrition", title: "Women with any anaemia", unit: "%", higherIs: "worse", ids: ["AN_ANEM_W_ANY"], label: /^women with any anemia/i },
  { key: "overweight_women", theme: "Nutrition", title: "Women who are overweight or obese", unit: "%", higherIs: "worse", ids: ["AN_NUTS_W_OWO"], label: /women.*overweight or obese|overweight or obese.*women/i },
  { key: "facility_births", theme: "Maternal care", title: "Births in a health facility", unit: "%", higherIs: "better", ids: ["RH_DELP_C_DHF"], label: /^(live births|births) delivered in a health facility|^place of delivery: health facility/i },
  { key: "skilled_births", theme: "Maternal care", title: "Births assisted by a skilled provider", unit: "%", higherIs: "better", ids: ["RH_DELA_C_SKP"], label: /assistance during delivery from a skilled provider|skilled (birth attendant|provider)/i },
  { key: "anc4", theme: "Maternal care", title: "Mothers with four or more antenatal visits", unit: "%", higherIs: "better", ids: ["RH_ANCN_W_N4P"], label: /4\+? (or more )?antenatal care visits|antenatal visits.*4\+/i },
  { key: "vaccinated", theme: "Immunisation", title: "Children 12–23 months with all basic vaccinations", unit: "%", higherIs: "better", ids: ["CH_VACC_C_BAS"], label: /(received )?all basic vaccinations/i },
  { key: "measles", theme: "Immunisation", title: "Children 12–23 months vaccinated against measles", unit: "%", higherIs: "better", ids: ["CH_VACC_C_MSL"], label: /measles vaccination received|received measles/i },
  { key: "literate_women", theme: "Women's lives", title: "Women who are literate", unit: "%", higherIs: "better", ids: ["ED_LITR_W_LIT"], label: /^women who are literate|^literate women|literacy.*women/i },
  { key: "married18", theme: "Women's lives", title: "Women aged 20–24 first married by 18", unit: "%", higherIs: "worse", ids: ["MA_MBAG_W_B18"], label: /women first married by (exact )?age 18/i },
  { key: "wifebeat", theme: "Women's lives", title: "Women who agree wife-beating is justified for some reason", unit: "%", higherIs: "worse", ids: ["WE_AWBT_W_AGR"], label: /wife beating justified for at least one/i, sex: "women" },
  { key: "electricity", theme: "Households", title: "Households with electricity", unit: "%", higherIs: "better", ids: ["HC_ELEC_H_ELC"], label: /households with electricity|^electricity$/i },
  { key: "water", theme: "Households", title: "Households with an improved source of drinking water", unit: "%", higherIs: "better", ids: ["WS_SRCE_H_IMP"], label: /improved (source of )?drinking water/i },
  { key: "sanitation", theme: "Households", title: "Households with improved sanitation", unit: "%", higherIs: "better", ids: ["WS_TLET_H_IMP"], label: /improved sanitation|improved (toilet|sanitation) facility/i },
];
export const THEMES: Theme[] = ["Child survival", "Nutrition", "Maternal care", "Immunisation", "Fertility & family planning", "Women's lives", "Households"];

export interface Survey { id: string; year: number; label: string; name: string; released: string | null }
export interface Point { survey: string; total: number | null; urban: number | null; rural: number | null; poorest: number | null; richest: number | null; states: Record<string, number> }
export interface MetricSeries { key: string; id: string; dhsLabel: string; definition: string; points: Point[] }
export interface NfhsRounds { fetchedAt: string; source: string; surveys: Survey[]; metrics: MetricSeries[]; missing: Array<{ key: string; note: string }> }

/** The India surveys DHS holds, oldest first; standard DHS surveys only (not special or AIS rounds). */
export function parseSurveys(body: unknown): Survey[] {
  const data = (body as { Data?: Array<Record<string, unknown>> })?.Data ?? [];
  return data.flatMap((d) => {
    const id = String(d.SurveyId ?? ""), year = Number(d.SurveyYear);
    if (!/^IA\d{4}DHS$/.test(id) || !Number.isFinite(year)) return [];
    return [{ id, year, label: String(d.SurveyYearLabel ?? year), name: String(d.SurveyNum ? `NFHS (${d.SurveyYearLabel ?? year})` : d.SurveyYearLabel ?? year), released: typeof d.ReleaseDate === "string" ? d.ReleaseDate : null }];
  }).sort((a, b) => a.year - b.year);
}
/** NFHS-2 1998–99, NFHS-3 2005–06 … by the order DHS lists them (NFHS-1 is 1992–93). */
export const roundName = (s: Survey, all: Survey[]) => `NFHS-${all.findIndex((x) => x.id === s.id) + 1 + (all[0] && all[0].year > 1995 ? 1 : 0)}`;

/** Change per year between two rounds, in the metric's own units: derived, and labelled so wherever shown. */
export function perYear(a: { year: number; v: number | null }, b: { year: number; v: number | null }): number | null {
  return a.v !== null && b.v !== null && b.year > a.year ? (b.v - a.v) / (b.year - a.year) : null;
}
