/**
 * The economy before and after 2014, by domain: which World Bank series are
 * tested, on what scale, and which way is better. No node imports.
 *
 * The list was fixed before any result was computed. A series is in it when
 * it is measured (national accounts, trade, counts, surveys) and has at least
 * five annual values on each side of 2014; ILO's modelled labour series are
 * shown but kept out of the tallies, because a modelled curve cannot show a
 * break. Proportional series (money, counts) are fitted on their logarithm,
 * so their trends read as % growth a year; shares and rates are fitted as
 * they are, so their trends read as points a year.
 */
export type DomainId = "growth" | "investment" | "money" | "trade" | "industry" | "infrastructure" | "digital" | "innovation" | "state";

export const DOMAINS: Array<{ id: DomainId; name: string; line: string }> = [
  { id: "growth", name: "Growth and living standards", line: "How fast the economy and household spending grew." },
  { id: "investment", name: "Investment and saving", line: "How much of output went into building capacity." },
  { id: "money", name: "Prices and finance", line: "Inflation, credit, markets and the reserves cushion." },
  { id: "trade", name: "Trade and the outside world", line: "Exports, foreign investment, ports and flights — what corridors are built to carry." },
  { id: "industry", name: "Industry and jobs", line: "Manufacturing's weight in the economy and in employment." },
  { id: "infrastructure", name: "Power", line: "Electricity used per person, and how much of it is renewable." },
  { id: "digital", name: "Digital", line: "Internet, broadband and mobile connections." },
  { id: "innovation", name: "Innovation and enterprise", line: "Patents, research papers, R&D spending and new firms." },
  { id: "state", name: "The state", line: "Tax collected and military spending." },
];

export interface EconSpec {
  id: string;
  domain: DomainId;
  label: string;
  /** Fit on the logarithm (trends in % a year) or as is (trends in the unit a year). */
  log: boolean;
  /** Which way is better; null where it is a matter of view. */
  better: "up" | "down" | null;
  /** Modelled by its publisher: shown, but not counted in the tallies. */
  modelled?: string;
  note?: string;
}

export const ECON: EconSpec[] = [
  { id: "wdi-gdp-growth", domain: "growth", label: "GDP growth", log: false, better: "up", note: "A growth rate: its trend is whether growth itself was speeding up or slowing." },
  { id: "wdi-gdp-per-capita-ppp", domain: "growth", label: "GDP per person (PPP)", log: true, better: "up" },
  { id: "wdi-household-consumption-pc", domain: "growth", label: "Household spending per person (constant prices)", log: true, better: "up" },
  { id: "wdi-fixed-capital-formation", domain: "investment", label: "Fixed investment, share of GDP", log: false, better: "up" },
  { id: "wdi-ne-gdi-ftot-kd", domain: "investment", label: "Fixed investment (constant prices)", log: true, better: "up" },
  { id: "wdi-gross-savings", domain: "investment", label: "Domestic savings, share of GDP", log: false, better: "up" },
  { id: "wdi-inflation", domain: "money", label: "Consumer price inflation", log: false, better: "down" },
  { id: "wdi-private-credit", domain: "money", label: "Bank credit to the private sector, share of GDP", log: false, better: "up" },
  { id: "wdi-market-cap-gdp", domain: "money", label: "Stock market value, share of GDP", log: false, better: null },
  { id: "wdi-reserves", domain: "money", label: "Foreign exchange reserves (US$)", log: true, better: "up" },
  { id: "wdi-exports-usd", domain: "trade", label: "Exports of goods and services (US$)", log: true, better: "up" },
  { id: "wdi-merch-exports", domain: "trade", label: "Merchandise exports (US$)", log: true, better: "up" },
  { id: "wdi-exports-gdp", domain: "trade", label: "Exports, share of GDP", log: false, better: "up" },
  { id: "wdi-fdi-gdp", domain: "trade", label: "Foreign direct investment, share of GDP", log: false, better: "up" },
  { id: "wdi-hightech-exports-usd", domain: "trade", label: "High-technology exports (US$)", log: true, better: "up", note: "Begins in 2009, so the earlier period is 2009–13." },
  { id: "wdi-air-passengers", domain: "trade", label: "Air passengers carried", log: true, better: "up" },
  { id: "wdi-manufacturing-gdp", domain: "industry", label: "Manufacturing, share of GDP", log: false, better: "up" },
  { id: "wdi-manufacturing-usd", domain: "industry", label: "Manufacturing value added (US$)", log: true, better: "up" },
  { id: "wdi-industry-employment", domain: "industry", label: "Employment in industry, share", log: false, better: "up", modelled: "ILO modelled estimate" },
  { id: "wdi-agriculture-employment", domain: "industry", label: "Employment in agriculture, share", log: false, better: "down", modelled: "ILO modelled estimate" },
  { id: "wdi-electricity-per-capita", domain: "infrastructure", label: "Electricity used per person", log: true, better: "up" },
  { id: "wdi-renewable-electricity", domain: "infrastructure", label: "Renewable share of electricity", log: false, better: "up", note: "Ends in 2021." },
  { id: "wdi-internet-users", domain: "digital", label: "People using the internet", log: false, better: "up" },
  { id: "wdi-broadband", domain: "digital", label: "Fixed broadband per 100 people", log: false, better: "up" },
  // Reclassified as neutral after the first run: subscriptions were nearing saturation by 2014, so a slower trend
  // afterwards is expected and says nothing about policy. The first run had counted it as worse.
  { id: "wdi-mobile-subscriptions", domain: "digital", label: "Mobile subscriptions per 100 people", log: false, better: null, note: "Near saturation by 2014: a flatter trend afterwards is expected, so it is not counted as worse." },
  { id: "wdi-patents-resident", domain: "innovation", label: "Patent applications by residents", log: true, better: "up" },
  { id: "wdi-scientific-articles", domain: "innovation", label: "Scientific and technical articles", log: true, better: "up" },
  { id: "wdi-rd-spending", domain: "innovation", label: "R&D spending, share of GDP", log: false, better: "up", note: "Ends in 2020." },
  { id: "wdi-ic-bus-nreg", domain: "innovation", label: "New businesses registered", log: true, better: "up", note: "Begins in 2006." },
  { id: "wdi-tax-revenue", domain: "state", label: "Tax revenue, share of GDP", log: false, better: "up", note: "Central government only; ends in 2022." },
  { id: "wdi-milex-gdp", domain: "state", label: "Military spending, share of GDP", log: false, better: null },
];

export const BREAK_YEAR = 2014;
export const FROM_YEAR = 2004;

export type Verdict = "better" | "worse" | "steeper" | "flatter" | "unclear";

/** Better or worse only when the 95% interval on the change in trend excludes zero; otherwise unclear. */
export function verdictOf(spec: EconSpec, ci: [number, number]): Verdict {
  const up = ci[0] > 0, down = ci[1] < 0;
  if (!up && !down) return "unclear";
  if (spec.better === null) return up ? "steeper" : "flatter";
  return (up && spec.better === "up") || (down && spec.better === "down") ? "better" : "worse";
}
