/**
 * The white pill: what is measurably getting better in India, by theme, and
 * whether the pace changed after 2014. No node imports — the page passes in
 * the series and survey rounds it has loaded.
 *
 * ── The rules this page keeps ─────────────────────────────────────────────
 *
 * 1. Only published series. Every chart is a series already in the site's
 *    record (data/series, data/nfhs), with its sources; every figure from a
 *    report is in data/white-pill/studies.json with a link and a date.
 * 2. The catch goes beside the good news. Each card carries the caveat that a
 *    careful reader would raise — a changed survey, a nominal rupee, a
 *    consumption-based Gini — and the inequality section shows the measure
 *    that points the other way.
 * 3. The 2014 comparison is pre-registered. The indicators below were chosen
 *    for being measured (not modelled) in both periods, before their results
 *    were computed; each is compared by the same rule, and whatever comes out
 *    slower or unchanged is listed as such, not dropped.
 * 4. News is never data. Live headlines sit in their own panel and never
 *    become a number.
 */

/* ── Themes and their cards ────────────────────────────────────────────── */

export type ThemeId = "poverty" | "social" | "financial" | "space" | "tech" | "ai" | "infra" | "defence";

export interface Theme { id: ThemeId; name: string; line: string }

export const THEMES: Theme[] = [
  { id: "poverty", name: "Poverty", line: "How many Indians live below the line, on the World Bank's measure and on deprivations a household survey can see." },
  { id: "social", name: "Social inequality", line: "The gap between India's poorest and richest households, and between women and men, on things a survey measures directly." },
  { id: "financial", name: "Financial inequality", line: "Who holds a bank account, how consumption is shared — and the income measure that says the opposite." },
  { id: "space", name: "Space", line: "How often India launches, and on what." },
  { id: "tech", name: "Technology and innovation", line: "Patents, papers, high-technology exports, the internet and the price of data." },
  { id: "ai", name: "Artificial intelligence", line: "Models Indian labs have published, and where independent rankings place India." },
  { id: "infra", name: "Infrastructure", line: "Highways, airports, metros, ports and power." },
  { id: "defence", name: "Defence exports", line: "What India sells abroad, and what it makes at home." },
];

/** A chart card: a series from the record, with the catch printed beside it. */
export interface Card {
  theme: ThemeId;
  /** A data/series id, or "nfhs:<metric key>" for a survey metric. */
  series: string;
  /** Overrides the series title where it would mislead. */
  title?: string;
  caveat: string;
}

export const CARDS: Card[] = [
  { theme: "poverty", series: "wdi-extreme-poverty", title: "Extreme poverty, $3.00 a day (2021 prices)", caveat: "The World Bank moved its extreme line from $2.15 (2017 prices) to $3.00 (2021 prices) in June 2025 and restated history; this series follows the new line. The 2022–23 consumption survey changed its method, which lowers measured poverty — the Bank still finds a steep fall on comparable assumptions, but the size is debated." },
  { theme: "poverty", series: "nfhs:electricity", caveat: "Households with electricity, measured by the National Family Health Survey in each round — a connection, not hours of supply." },
  { theme: "poverty", series: "nfhs:sanitation", caveat: "An improved toilet not shared with other households, as the survey records it. Having a toilet is not the same as every member using it." },
  { theme: "poverty", series: "wdi-clean-cooking", caveat: "A modelled WHO estimate, smooth by construction. LPG connections rose fast after 2016; whether refills keep pace is a separate question this does not answer." },
  { theme: "social", series: "nfhs:facility_births", caveat: "The line is all births; the gap between the poorest and richest fifth of households is shown beside it — the clearest fall in inequality anywhere in the survey." },
  { theme: "social", series: "nfhs:married18", caveat: "Women aged 20–24 who married before 18. Still one in five in 2019–21." },
  { theme: "social", series: "wdi-account-ownership-female", caveat: "From the Global Findex survey. The gap between women and men has closed; how often the accounts are used is a different measure, and lower." },
  { theme: "social", series: "wdi-female-labour-participation", caveat: "An ILO modelled estimate. India's own labour survey shows a sharper rise since 2017–18, much of it unpaid work on family farms and in family businesses." },
  { theme: "financial", series: "wdi-account-ownership", caveat: "Adults with an account at a financial institution or mobile money, Global Findex. Jan Dhan accounts are most of the rise; a share of them sit dormant." },
  { theme: "financial", series: "wdi-gini", title: "Gini index of consumption", caveat: "Measured on consumption, not income, and household surveys miss the richest. The income-based estimate in the studies below shows the top 1% taking a larger share than at any time since 1922." },
  { theme: "financial", series: "wdi-income-share-bottom20", title: "Share of consumption, poorest fifth", caveat: "Consumption, as with the Gini. A rising bottom share and a rising top-1% income share can both be true." },
  { theme: "space", series: "isro-launch-cadence", caveat: "Average launches a year in each era — a count, not a measure of capability. Launch failures are counted as launches." },
  { theme: "space", series: "isro-launches-by-vehicle", caveat: "Missions by rocket family, to the latest count in the record." },
  { theme: "tech", series: "wdi-patents-resident", caveat: "Applications, not grants, by residents of India. Fees for educational institutions were cut in 2021 and academic filings rose; quality is not measured here." },
  { theme: "tech", series: "wdi-scientific-articles", caveat: "Articles in indexed journals. Counts say nothing about citation or quality." },
  { theme: "tech", series: "wdi-hightech-exports-usd", caveat: "Current US dollars. Much of the recent rise is smartphones assembled under the PLI scheme; value added in India is a smaller share." },
  { theme: "tech", series: "wdi-internet-users", caveat: "An ITU estimate from surveys and subscriptions. A third of Indians were still offline in the latest year." },
  { theme: "tech", series: "mobile-data-price-per-gb", caveat: "Nominal rupees, two points from the Economic Survey. Most of the fall came with a new operator's entry in 2016 and the price war that followed." },
  { theme: "ai", series: "ai:models", title: "Open AI models published by Indian labs, by year", caveat: "Model weights on Hugging Face from the Indian labs this site tracks. A count of releases, not of capability; most applied AI work publishes nothing." },
  { theme: "infra", series: "nh-network-length", caveat: "Length of the national highway network. Some of the rise is state roads renotified as national highways, not new road." },
  { theme: "infra", series: "airports-operational", caveat: "Airports with scheduled operations. Several UDAN airports have since lost their flights." },
  { theme: "infra", series: "metro-network-length", caveat: "Operational metro route-kilometres. Ridership per kilometre on several new lines is below projections." },
  { theme: "infra", series: "nfhs:electricity", caveat: "Household connections in the survey; the supply hours behind them are not measured." },
  { theme: "defence", series: "defence-exports", caveat: "Nominal rupees. Some of the growth is inflation and rupee depreciation, and one large contract can swing a year." },
  { theme: "defence", series: "defence-production", caveat: "Value of production, nominal rupees, including the public-sector undertakings." },
  { theme: "defence", series: "wdi-ms-mil-xprt-kd", title: "Arms exports, SIPRI trend-indicator value", caveat: "SIPRI counts major weapons only, by a volume measure, not money. India remains among the world's largest arms importers." },
];

/* ── The 2014 comparison ───────────────────────────────────────────────── */

/**
 * How an indicator's progress is expressed as one rate, positive = better:
 *  gap     — share of the remaining gap to 100% closed per year (coverage measures)
 *  decline — % fall per year (things that should go down)
 *  cagr    — % growth per year (counts)
 *  points  — change in percentage points per year (a share where higher is better)
 *  mean    — the period's average level (rates such as GDP growth)
 * Rates of gap-closing and decline compare fairly across different starting
 * levels; points per year do not, which is why they are kept for shares that
 * are nowhere near a ceiling.
 */
export type Method = "gap" | "decline" | "cagr" | "points" | "mean";

export interface PaceSpec {
  key: string;
  label: string;
  /** data/series id, or nfhs:<metric>. */
  series: string;
  method: Method;
  /** Measured each period (survey, count, national accounts). Modelled series are left out of the verdicts. */
  note?: string;
}

/** Pre-registered: measured in both periods. Chosen before results were computed. */
export const PACE: PaceSpec[] = [
  { key: "sanitation", label: "Households with improved sanitation", series: "nfhs:sanitation", method: "gap" },
  { key: "electricity", label: "Households with electricity", series: "nfhs:electricity", method: "gap" },
  { key: "water", label: "Households with improved drinking water", series: "nfhs:water", method: "gap" },
  { key: "facility", label: "Births in a health facility", series: "nfhs:facility_births", method: "gap" },
  { key: "skilled", label: "Births assisted by a skilled provider", series: "nfhs:skilled_births", method: "gap" },
  { key: "anc4", label: "Mothers with four or more antenatal visits", series: "nfhs:anc4", method: "gap" },
  { key: "measles", label: "Children vaccinated against measles", series: "nfhs:measles", method: "gap" },
  { key: "literate", label: "Women who are literate", series: "nfhs:literate_women", method: "gap" },
  { key: "married18", label: "Women married before 18", series: "nfhs:married18", method: "decline" },
  { key: "u5mr", label: "Under-five mortality", series: "nfhs:u5mr", method: "decline" },
  { key: "imr", label: "Infant mortality", series: "nfhs:imr", method: "decline" },
  { key: "stunting", label: "Children stunted", series: "nfhs:stunting", method: "decline" },
  { key: "underweight", label: "Children underweight", series: "nfhs:underweight", method: "decline" },
  { key: "anaemia", label: "Women with anaemia", series: "nfhs:anaemia_women", method: "decline" },
  { key: "poverty", label: "Extreme poverty ($3.00/day)", series: "wdi-extreme-poverty", method: "decline", note: "The World Bank's survey years are 2004, 2009, 2011 and 2022 onward, so the split falls at 2011, three years before 2014; the 2022–23 survey's method differs." },
  { key: "accounts", label: "Adults with a bank account", series: "wdi-account-ownership", method: "gap", note: "Findex surveys: 2011–14 against 2014–24." },
  { key: "internet", label: "People using the internet", series: "wdi-internet-users", method: "gap" },
  { key: "patents", label: "Patent applications by residents", series: "wdi-patents-resident", method: "cagr" },
  { key: "papers", label: "Scientific articles", series: "wdi-scientific-articles", method: "cagr" },
  { key: "hightech", label: "High-technology exports", series: "wdi-hightech-exports-usd", method: "cagr", note: "Series starts in 2009, so the earlier period is 2009–14." },
  { key: "gdp", label: "GDP growth", series: "wdi-gdp-growth", method: "mean", note: "The later period includes the 2020 contraction." },
  { key: "investment", label: "Fixed investment, share of GDP", series: "wdi-fixed-capital-formation", method: "mean" },
  { key: "manufacturing", label: "Manufacturing, share of GDP", series: "wdi-manufacturing-gdp", method: "points" },
];

export const BREAK = 2014;
export const FROM = 2004;

/**
 * NFHS rounds are placed at the middle of their fieldwork. NFHS-4 was in the
 * field from January 2015 to December 2016, so the "before" period
 * (NFHS-3 to NFHS-4) includes the first two years of the 2014 government.
 */
export const NFHS_MIDPOINT: Record<string, number> = { "1998-99": 1998.9, "2005-06": 2006.1, "2015-16": 2016.0, "2019-21": 2020.4 };

export interface Point { t: number; v: number }

export function rate(method: Method, a: Point, b: Point): number | null {
  const years = b.t - a.t;
  if (years <= 0) return null;
  switch (method) {
    case "gap": { const d0 = 100 - a.v, d1 = 100 - b.v; return d0 <= 0 || d1 < 0 ? null : (1 - Math.pow(Math.max(d1, 0.01) / d0, 1 / years)) * 100; }
    case "decline": return a.v <= 0 || b.v < 0 ? null : (1 - Math.pow(Math.max(b.v, 0.01) / a.v, 1 / years)) * 100;
    case "cagr": return a.v <= 0 ? null : (Math.pow(b.v / a.v, 1 / years) - 1) * 100;
    case "points": return (b.v - a.v) / years;
    case "mean": return null;
  }
}

export interface Pace {
  spec: PaceSpec;
  before: { from: number; to: number; rate: number } | null;
  after: { from: number; to: number; rate: number } | null;
  verdict: "faster" | "slower" | "similar" | "unknown";
}

/**
 * Split a series' points at BREAK: the "before" period runs from the point
 * nearest FROM to the point nearest BREAK;
 * the "after" period from that point to the latest. Means average the years
 * FROM…BREAK−1 against BREAK…latest.
 */
export function pace(spec: PaceSpec, points: Point[]): Pace {
  const pts = [...points].filter((p) => Number.isFinite(p.v)).sort((x, y) => x.t - y.t);
  const none: Pace = { spec, before: null, after: null, verdict: "unknown" };
  if (pts.length < 3) return none;
  if (spec.method === "mean") {
    const pre = pts.filter((p) => p.t >= FROM && p.t < BREAK), post = pts.filter((p) => p.t >= BREAK);
    if (pre.length < 3 || post.length < 3) return none;
    const m = (xs: Point[]) => xs.reduce((s, p) => s + p.v, 0) / xs.length;
    const before = { from: pre[0]!.t, to: pre.at(-1)!.t, rate: m(pre) }, after = { from: post[0]!.t, to: post.at(-1)!.t, rate: m(post) };
    // Two averages differ only if the gap is more than half the series' own year-to-year spread.
    const both = [...pre, ...post], mu = m(both);
    const sd = Math.sqrt(both.reduce((s, p) => s + (p.v - mu) ** 2, 0) / both.length);
    return { spec, before, after, verdict: verdictOf(spec.method, before.rate, after.rate, sd / 2) };
  }
  // The pivot: the point closest to BREAK, the earlier one when two are equally close.
  const pivot = pts.reduce((best, p) => (Math.abs(p.t - BREAK) < Math.abs(best.t - BREAK) - 1e-9 ? p : best));
  // The start: the point before the pivot closest to FROM, so a survey round in 2005–06 starts the
  // earlier period rather than one from the 1990s.
  const earlier = pts.filter((p) => p.t < pivot.t);
  if (!earlier.length) return none;
  const start = earlier.reduce((best, p) => (Math.abs(p.t - FROM) < Math.abs(best.t - FROM) - 1e-9 ? p : best));
  const end = pts.at(-1)!;
  if (!(start.t < pivot.t && pivot.t < end.t)) return none;
  const r0 = rate(spec.method, start, pivot), r1 = rate(spec.method, pivot, end);
  if (r0 === null || r1 === null) return none;
  return { spec, before: { from: start.t, to: pivot.t, rate: r0 }, after: { from: pivot.t, to: end.t, rate: r1 }, verdict: verdictOf(spec.method, r0, r1) };
}

/**
 * Faster or slower by more than 15% of the earlier rate, with a floor so that
 * tiny rates do not flip verdicts. Averages pass their own tolerance: half the
 * standard deviation of the yearly values.
 */
export function verdictOf(method: Method, before: number, after: number, meanTol?: number): Pace["verdict"] {
  const floor = method === "points" ? 0.05 : 0.5;
  const tol = method === "mean" && meanTol !== undefined ? meanTol : Math.max(Math.abs(before) * 0.15, floor);
  return after - before > tol ? "faster" : before - after > tol ? "slower" : "similar";
}

export const UNIT: Record<Method, string> = { gap: "% of the gap closed a year", decline: "% fall a year", cagr: "% growth a year", points: "points a year", mean: "average" };

/* ── Inequality between the poorest and richest fifth ─────────────────── */

export interface Gap { label: string; poorest: number; richest: number; gap: number }

/** The NFHS metrics whose poorest–richest gap is shown, and which way is better. */
export const GAP_METRICS: Array<{ key: string; label: string }> = [
  { key: "facility_births", label: "Births in a health facility" },
  { key: "sanitation", label: "Improved sanitation" },
  { key: "electricity", label: "Electricity" },
  { key: "measles", label: "Measles vaccination" },
  { key: "skilled_births", label: "Skilled birth attendance" },
  { key: "literate_women", label: "Women's literacy" },
];

/* ── Reports ───────────────────────────────────────────────────────────── */

export interface Study {
  id: string;
  theme: ThemeId | "since2014";
  publisher: string;
  title: string;
  url: string;
  published: string;
  /** The headline finding, in the report's own terms, with its numbers. */
  finding: string;
  /** "supports" the white pill, or "complicates" it. Both are shown. */
  stance: "supports" | "complicates";
  /** The caveat a careful reader should hold the finding to. */
  caveat?: string;
  /** Where the figure was checked, if not the report itself. */
  checkedVia?: string[];
}

/* ── Live reporting ────────────────────────────────────────────────────── */

/** Neutral searches, one per theme: what is being reported, good or bad. Never data. */
export const LIVE_TOPICS: Array<[string, string]> = [
  ["Poverty", 'India poverty OR "multidimensional poverty" OR "poverty line" when:3d'],
  ["Inequality", 'India inequality OR "Gini" OR "wealth gap" OR "income gap" when:3d'],
  ["Inclusion", 'India "financial inclusion" OR "Jan Dhan" OR "direct benefit transfer" OR "social security coverage" when:3d'],
  ["Space", 'ISRO OR Gaganyaan OR "IN-SPACe" OR "Indian space" when:3d'],
  ["Technology", 'India semiconductor OR UPI OR "Digital India" OR patents OR "deep tech" when:3d'],
  ["AI", 'India "artificial intelligence" OR "IndiaAI" OR "AI mission" OR "AI model" India when:3d'],
  ["Infrastructure", 'India highway OR metro OR airport OR "Vande Bharat" OR port inaugurated when:3d'],
  ["Defence exports", 'India "defence exports" OR "defence production" OR BrahMos export when:3d'],
  ["Since 2014", '"Modi government" (scheme OR report OR data OR record) when:3d'],
];
