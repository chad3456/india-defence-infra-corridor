import type { Category } from "./types";

/**
 * The honest assessment.
 *
 * Grades are assigned against *global* reference points, not against India's
 * own past. That distinction is the whole point: almost every series on this
 * site rises steeply from a 2001 base, and grading against that base would
 * produce straight A's and tell the reader nothing.
 *
 * Each verdict names the benchmark it is measured against, states the strongest
 * counter-argument, and cites the series that carries the evidence. Where the
 * evidence is thin, the grade says so rather than splitting the difference.
 */

export type Grade = "A" | "B" | "C" | "D";

export interface Verdict {
  id: string;
  area: string;
  category: Category;
  grade: Grade;
  /** The global yardstick this is graded against. */
  benchmark: string;
  /** What is genuinely working. */
  strength: string;
  /** What is genuinely not. */
  weakness: string;
  /** The strongest good-faith objection to this grade. */
  counterpoint: string;
  seriesIds: string[];
}

export const GRADE_MEANING: Record<Grade, string> = {
  A: "At or near the global frontier — would be counted a strength in any large economy.",
  B: "Clearly above its income-group peers, below the frontier. Real progress, real headroom.",
  C: "Roughly where a country at this income level would be expected to sit. Neither achievement nor failure.",
  D: "Below what this income level and this level of ambition should produce. A binding constraint.",
};

export const VERDICTS: Verdict[] = [
  {
    id: "defence-exports",
    area: "Defence exports",
    category: "defence",
    grade: "C",
    benchmark:
      "Global arms exporters. India's ~$2.8 bn is roughly 1-2% of world arms exports; the US, France and Russia each move an order of magnitude more.",
    strength:
      "Growth is real and steep — a 34-fold rise in a decade, off an almost non-existent base, with private firms now the majority contributor and roughly 80 destination countries.",
    weakness:
      "The absolute number is small, much of it is components and sub-assemblies feeding foreign primes rather than complete Indian platforms, and exports are still only about 15% of what India produces. India remains the world's second-largest arms *importer* while celebrating export records.",
    counterpoint:
      "Base effects cut both ways: a country that exported ₹686 crore in 2013-14 was starting from nothing, and component exports are how every arms industry begins. Judged as a trajectory rather than a level, this is closer to a B.",
    seriesIds: ["defence-exports", "defence-export-private-share", "arms-imports-global-share"],
  },
  {
    id: "defence-industrial-base",
    area: "Defence industrial base",
    category: "defence",
    grade: "C",
    benchmark:
      "Self-reliance as practised by France, South Korea or Israel — countries that design, integrate and export complete platforms.",
    strength:
      "Production has more than tripled since FY2014-15, the private share is rising, and Russian dependence in new procurement fell from 72% to 36% in a decade. Supplier diversification is a genuine structural achievement.",
    weakness:
      "Production value counts output, not indigenous content — a platform assembled from imported kits counts in full. R&D spending at roughly 0.65% of GDP against China's ~2.4% is the binding constraint, and no amount of assembly capacity substitutes for it.",
    counterpoint:
      "Tejas, BrahMos, the SSBN programme and the Agni series are real design-and-integration capabilities that most middle powers lack. The critique of 'assembly not design' understates what has actually been engineered.",
    seriesIds: ["defence-production", "defence-production-private-share", "arms-imports-russia-share"],
  },
  {
    id: "defence-budget-quality",
    area: "Defence budget composition",
    category: "defence",
    grade: "D",
    benchmark:
      "Modernising militaries typically run capital expenditure at 30-40% of the defence budget. India sits near 26-27% and has not moved it in a decade.",
    strength:
      "Capital outlay was fully utilised in FY2025-26 — historically, unspent modernisation money was a chronic embarrassment, and that has been fixed.",
    weakness:
      "Pay and pensions crowd out equipment. Pensions alone are roughly a fifth of the budget and buy no capability. Headline budget growth of 175% since FY2014-15 substantially overstates capability growth once inflation and the revenue share are stripped out.",
    counterpoint:
      "A large standing army on two contested land borders is a strategic choice, not an accounting failure. Personnel-heavy spending is what that posture costs, and comparisons with maritime powers are not like-for-like.",
    seriesIds: ["defence-budget", "defence-capital-outlay"],
  },
  {
    id: "highways",
    area: "Highways and expressways",
    category: "infrastructure",
    grade: "B",
    benchmark:
      "China built its ~180,000 km expressway network from a similar base two decades earlier. India's ~5,110 km of access-controlled corridors is roughly 3% of that.",
    strength:
      "Access-controlled corridor length grew 55-fold from 93 km in 2014. Four-lane-plus highway length more than doubled. On freight-relevant capacity rather than raw kilometres, this is the strongest infrastructure story in the dataset.",
    weakness:
      "Annual construction peaked at 13,327 km in FY2020-21 and has since plateaued near 10,000-12,000 km. Headline network length keeps rising partly because existing state highways are re-designated as national highways — growth on paper, not on the ground.",
    counterpoint:
      "Land acquisition in a democracy with strong property litigation is genuinely slower than in China. Comparing build rates without comparing legal constraints flatters the comparator.",
    seriesIds: ["expressway-length", "nh-constructed-annual", "nh-four-lane-plus"],
  },
  {
    id: "aviation",
    area: "Airports and regional connectivity",
    category: "infrastructure",
    grade: "B",
    benchmark:
      "Airport count per capita and, more importantly, whether new capacity carries sustained traffic — the test UDAN was designed around.",
    strength:
      "Operational airports more than doubled from 74 to over 160, with 93 aerodromes brought into service under UDAN and 663 routes started. Genuine geographic broadening of air access.",
    weakness:
      "A material share of UDAN routes lapsed once the three-year viability-gap subsidy expired. Cumulative routes inaugurated is not the same as routes flying, and the headline is usually quoted as though it were. Several regional airports see minimal scheduled traffic.",
    counterpoint:
      "Route churn is normal in regional aviation everywhere, and even discontinued routes leave behind a usable airstrip and terminal. The infrastructure outlives the subsidy.",
    seriesIds: ["airports-operational", "udan-routes", "udan-aerodromes"],
  },
  {
    id: "ports",
    area: "Ports and maritime logistics",
    category: "infrastructure",
    grade: "B",
    benchmark:
      "Vessel turnaround time against global port averages, and throughput against Chinese and Singaporean volumes.",
    strength:
      "Turnaround time roughly halved to 48.84 hours, which now beats several developed-economy averages outright. Throughput hit a record 915 MT at major ports. This is a real operational win, not an announcement.",
    weakness:
      "Turnaround improvement has stalled since FY2021-22 — four years to shave four hours, against a halving in the decade before. Capacity utilisation near 59% means further capacity spending has weak near-term returns. India's largest port still handles a fraction of Shanghai's volume.",
    counterpoint:
      "Utilisation headroom is deliberate: ports built to just-in-time demand become bottlenecks the moment trade grows. Spare capacity is a feature when you expect to need it.",
    seriesIds: ["port-turnaround-time", "major-ports-cargo", "port-capacity"],
  },
  {
    id: "urban-transit",
    area: "Urban mass transit",
    category: "infrastructure",
    grade: "B",
    benchmark:
      "China added roughly 10,000 km of metro in the same period India added 765 km. India is now third globally by network length.",
    strength:
      "From 248 km in 5 cities to over 1,000 km in 23 cities. Crossing 1,000 km in October 2025 made India the third-largest metro network in the world.",
    weakness:
      "Ridership grew 4x while network grew 4.1x — passengers per kilometre have been flat. Several systems run far below the projections used to justify their capital cost. Building track is not the same as moving people, and the financing of most systems assumes ridership that has not materialised.",
    counterpoint:
      "Metro ridership typically matures over 10-15 years as feeder networks and land use catch up. Judging lines opened in the last five years on current ridership is premature.",
    seriesIds: ["metro-network-length", "metro-ridership", "metro-cities"],
  },
  {
    id: "defence-corridors",
    area: "Defence industrial corridors",
    category: "defence",
    grade: "D",
    benchmark:
      "Industrial cluster policy as executed in Shenzhen, or even Indian precedents like the software parks — measured on grounded investment and output, not MoUs.",
    strength:
      "Two corridors are operating with land allotted and units producing. Eleven nodes across UP and Tamil Nadu give the policy real geographic anchoring.",
    weakness:
      "Roughly ₹10,855 crore grounded against ~₹70,000 crore committed — about 15%. 170 MoUs converted into 57 land allotments. 13,000 jobs against a stated potential of 50,000. Every headline number quoted for these corridors is a commitment, and commitments are being reported as if they were construction.",
    counterpoint:
      "Industrial corridors run on 15-20 year horizons and these are seven years old. Early-stage conversion rates of one-in-three on MoUs are not obviously bad by international standards.",
    seriesIds: ["defence-corridor-committed", "defence-corridor-grounded", "defence-corridor-jobs"],
  },
  {
    id: "manufacturing",
    area: "Manufacturing",
    category: "manufacturing",
    grade: "D",
    benchmark:
      "The government's own 25%-of-GDP target, and the 25-30% manufacturing shares that China, Korea and Vietnam used to industrialise.",
    strength:
      "Absolute manufacturing output has grown substantially, and specific sectors — pharmaceuticals, automotive components, and more recently electronics assembly — are globally competitive.",
    weakness:
      "Manufacturing's share of GDP has been essentially flat since 2001 and has never approached the 25% target, through two governments and a decade of Make in India. Merchandise exports grew 0.93% in FY2025-26. Over 40% of the workforce is still in agriculture. India industrialised out of order — services grew before factories did — and the factories have not caught up.",
    counterpoint:
      "Services-led growth is not automatically inferior; it delivered India's fastest sustained growth and its largest export surplus. The premise that every economy must pass through a manufacturing phase is itself contestable.",
    seriesIds: ["merchandise-exports", "wdi-manufacturing-gdp", "wdi-agriculture-employment"],
  },
  {
    id: "trade",
    area: "Trade and external sector",
    category: "trade",
    grade: "B",
    benchmark:
      "Export growth and composition against Vietnam, which went from a fraction of India's exports to a competitive manufactured-goods exporter in the same period.",
    strength:
      "Record $863 bn total exports. Services exports at $421 bn are a genuine global strength, with India a dominant supplier of IT and business services. Remittances are the world's largest.",
    weakness:
      "Growth is almost entirely services-led — 8.71% for services against 0.93% for goods. Roughly half of services exports sit in one sector now directly exposed to AI automation of exactly that work. Concentration risk in the strongest part of the external account is the most under-discussed vulnerability here.",
    counterpoint:
      "Services concentration is a strength being described as a weakness. India's IT sector has repeatedly absorbed technology shocks — offshoring, cloud, automation — and grown through each.",
    seriesIds: ["services-exports", "merchandise-exports", "total-exports"],
  },
  {
    id: "space",
    area: "Space programme",
    category: "space",
    grade: "B",
    benchmark:
      "Launch cadence and cost per kilogram against China (60+ orbital launches a year), the US, and commercial providers.",
    strength:
      "Launch tempo roughly quadrupled. Cost-efficiency is genuinely world-leading — Chandrayaan-3 and Mangalyaan delivered results at a fraction of comparable mission budgets. A hundred missions and a working interplanetary capability.",
    weakness:
      "Absolute cadence is an order of magnitude below China. Heavy dependence on PSLV is a single-point risk, underlined by third-stage failures on PSLV-C61 and PSLV-C62. Human spaceflight has slipped repeatedly.",
    counterpoint:
      "Cost-per-outcome, not launch count, is the right metric for a programme with India's budget. On that measure ISRO outperforms nearly everyone.",
    seriesIds: ["isro-launch-cadence", "isro-missions-cumulative", "isro-launches-by-vehicle"],
  },
  {
    id: "energy-access",
    area: "Electrification and basic services",
    category: "quality-of-life",
    grade: "A",
    benchmark:
      "Universal access, the standard every development agency measures against.",
    strength:
      "Electricity access moved from roughly 60% to effectively universal, and basic sanitation access rose faster than almost any comparable country has managed. On any honest reckoning these are the largest achievements in this dataset — they touched more lives than every defence and infrastructure line combined.",
    weakness:
      "Access is not reliability: connection counts say nothing about hours of supply or voltage stability. Per-capita electricity consumption remains roughly a third of China's, which is the number that actually tracks industrialisation.",
    counterpoint:
      "None worth making. This is the strongest part of the record and is routinely under-claimed relative to the infrastructure projects that photograph better.",
    seriesIds: ["wdi-electricity-access", "wdi-sanitation-access", "wdi-electricity-per-capita"],
  },
  {
    id: "human-capital",
    area: "Human capital and health",
    category: "quality-of-life",
    grade: "C",
    benchmark:
      "Health spending, out-of-pocket burden and female labour participation against income-group peers.",
    strength:
      "Infant and maternal mortality fell steeply. Life expectancy rose. Extreme poverty fell by hundreds of millions of people — the single most consequential number on this site.",
    weakness:
      "Out-of-pocket health spending is among the highest in the world and medical costs remain a leading cause of household impoverishment. Female labour force participation is weak against every peer and is a direct drag on growth. Public health and education spending as a share of GDP remain low for the income level.",
    counterpoint:
      "Poverty reduction at this scale is historically rare and arguably outweighs the composition critiques. A billion people got meaningfully richer.",
    seriesIds: ["wdi-oop-health", "wdi-female-labour-participation", "wdi-extreme-poverty"],
  },
  {
    id: "nuclear",
    area: "Strategic forces",
    category: "defence",
    grade: "C",
    benchmark:
      "A credible minimum deterrent with assured second strike, against China's ~600 warheads and expanding arsenal.",
    strength:
      "A functioning triad — land, air and sea-based delivery — which few states possess. Canisterised systems and MIRV development indicate a maturing second-strike capability.",
    weakness:
      "Estimated at ~180 warheads against China's ~600 and growing. Every figure here is an external estimate with a wide error bar — India publishes nothing — so confidence in this entire assessment is low by construction.",
    counterpoint:
      "Minimum credible deterrence is a deliberate doctrine, not a shortfall. Warhead parity was never the goal, and grading against China's count imports a yardstick India explicitly rejected.",
    seriesIds: ["nuclear-warheads"],
  },
];

export function gradeCounts() {
  return VERDICTS.reduce<Record<Grade, number>>(
    (acc, v) => {
      acc[v.grade] += 1;
      return acc;
    },
    { A: 0, B: 0, C: 0, D: 0 },
  );
}
