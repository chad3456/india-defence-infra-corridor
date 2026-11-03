/**
 * Everything /white-pill renders, resolved from the site's record: series from
 * data/series, survey rounds from data/nfhs, Indian AI releases from data/ai,
 * reports from data/white-pill/studies.json. Node only. Nothing here writes a
 * number of its own: a card whose series is missing says so.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { definedPoints, getSeries, isTemporal, periodYear, sourcesForSeries } from "./data";
import { CARDS, GAP_METRICS, NFHS_MIDPOINT, PACE, pace, type Card, type Pace, type Point, type Study } from "./white-pill";
import type { CardPoint } from "@/components/white-pill/Charts";

const read = <T,>(...p: string[]): T | null => { const f = join(process.cwd(), ...p); return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as T) : null; };

interface NfhsRounds {
  fetchedAt: string;
  surveys: Array<{ id: string; label: string; name: string }>;
  metrics: Array<{ key: string; definition: string; points: Array<{ survey: string; total: number | null; poorest: number | null; richest: number | null }> }>;
}

export interface ResolvedCard {
  card: Card;
  title: string;
  definition: string;
  unit: string;
  better: boolean | null;
  points: CardPoint[];
  sources: Array<{ name: string; url: string }>;
  /** Poorest and richest fifth by round, for survey metrics that carry them. */
  gap?: Array<{ round: string; poorest: number; richest: number }>;
  missing?: boolean;
}

const NFHS_TITLES: Record<string, { title: string; unit: string; better: boolean }> = {
  electricity: { title: "Households with electricity", unit: "%", better: true },
  sanitation: { title: "Households with improved sanitation", unit: "%", better: true },
  water: { title: "Households with improved drinking water", unit: "%", better: true },
  facility_births: { title: "Births in a health facility", unit: "%", better: true },
  skilled_births: { title: "Births assisted by a skilled provider", unit: "%", better: true },
  married18: { title: "Women aged 20–24 married before 18", unit: "%", better: false },
  measles: { title: "Children vaccinated against measles", unit: "%", better: true },
  literate_women: { title: "Women who are literate", unit: "%", better: true },
};

export function loadWhitePill() {
  const nfhs = read<NfhsRounds>("data", "nfhs", "rounds.json");
  const ai = read<{ builtAt: string; byYear: Array<{ year: number; models: number }>; sources: string[] }>("data", "ai", "models.json");
  const studies = read<{ accessed: string; note: string; studies: Study[] }>("data", "white-pill", "studies.json");
  const dhs = { name: "The DHS Program — National Family Health Survey rounds", url: "https://api.dhsprogram.com/" };

  const nfhsMetric = (key: string) => nfhs?.metrics.find((m) => m.key === key);
  const roundLabel = (id: string) => nfhs?.surveys.find((s) => s.id === id)?.label ?? id;

  function resolve(card: Card): ResolvedCard {
    if (card.series.startsWith("nfhs:")) {
      const key = card.series.slice(5), m = nfhsMetric(key), meta = NFHS_TITLES[key];
      const pts = (m?.points ?? []).filter((p) => p.total !== null).map((p) => ({ label: roundLabel(p.survey), t: NFHS_MIDPOINT[roundLabel(p.survey)] ?? null, v: p.total! }));
      const gap = (m?.points ?? []).filter((p) => p.poorest !== null && p.richest !== null).map((p) => ({ round: roundLabel(p.survey), poorest: p.poorest!, richest: p.richest! }));
      return { card, title: card.title ?? meta?.title ?? key, definition: m?.definition ?? "", unit: meta?.unit ?? "%", better: meta?.better ?? null, points: pts, sources: [dhs], gap: gap.length >= 2 ? gap : undefined, missing: !pts.length };
    }
    if (card.series === "ai:models") {
      const pts = (ai?.byYear ?? []).map((y) => ({ label: String(y.year), t: y.year, v: y.models }));
      return { card, title: card.title ?? "AI models", definition: "Open-weight models published on Hugging Face by the Indian labs tracked on /ai.", unit: "models", better: null, points: pts, sources: [{ name: "Hugging Face model metadata, via /ai", url: "/ai" }], missing: !pts.length };
    }
    const s = getSeries(card.series);
    if (!s) return { card, title: card.title ?? card.series, definition: "", unit: "", better: null, points: [], sources: [], missing: true };
    const temporal = isTemporal(s);
    const pts = definedPoints(s).map((p) => ({ label: p.period, t: temporal ? periodYear(p.period) : null, v: p.value as number }));
    return {
      card, title: card.title ?? s.title, definition: s.definition, unit: s.unitShort, better: s.higherIsBetter ?? null, points: pts,
      sources: sourcesForSeries(s).map((x) => ({ name: x.name, url: x.url })), missing: !pts.length,
    };
  }

  const cards = CARDS.map(resolve);

  function pointsOf(series: string): Point[] {
    if (series.startsWith("nfhs:")) {
      const m = nfhsMetric(series.slice(5));
      return (m?.points ?? []).filter((p) => p.total !== null).map((p) => ({ t: NFHS_MIDPOINT[roundLabel(p.survey)] ?? NaN, v: p.total! })).filter((p) => Number.isFinite(p.t));
    }
    const s = getSeries(series);
    return s ? definedPoints(s).map((p) => ({ t: periodYear(p.period) ?? NaN, v: p.value as number })).filter((p) => Number.isFinite(p.t)) : [];
  }
  const paces: Pace[] = PACE.map((spec) => pace(spec, pointsOf(spec.series)));

  const gaps = GAP_METRICS.map((g) => {
    const m = nfhsMetric(g.key);
    const rows = (m?.points ?? []).filter((p) => p.poorest !== null && p.richest !== null).map((p) => ({ round: roundLabel(p.survey), poorest: p.poorest!, richest: p.richest! }));
    return { ...g, rows };
  }).filter((g) => g.rows.length >= 2);

  return { cards, paces, gaps, studies, nfhsFetched: nfhs?.fetchedAt ?? null, dhs };
}
