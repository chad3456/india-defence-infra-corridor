/**
 * India in the world economy: a hundred indicators, ten clusters, ten forms.
 *
 * ── Why the form changes between clusters ────────────────────────────────
 *
 * A hundred indicators drawn the same way is a hundred of the same chart, and
 * the reader learns nothing from the ninety-ninth that the second did not
 * already teach. The forms here are not variety for its own sake: each cluster
 * asks a different question, and the question picks the form.
 *
 * How big is India next to the others is a question about position across
 * countries, so it is a bar across countries. How did it get here is change
 * over time, so it is a line. What is India selling is parts of a whole, so it
 * is a stacked area. Money in and money out has a sign, so it is columns about
 * a zero line. Ten price and money series at once is what a sparkline grid is
 * for. Where the factory output moved between two dates is a slope. Whether
 * deep banking goes with liquid markets is a relationship, so it is a scatter.
 *
 * The rule the whole file follows: if two clusters would be honestly served by
 * the same form, they are the same cluster.
 *
 * ── The constraint this catalogue has, stated once ───────────────────────
 *
 * The ingest holds a full 2001-present series for India on every one of these,
 * and for the five comparators it holds only the latest reading. So a chart
 * here is either India over time, or all six at one moment — never five
 * countries over time. Anywhere the cluster is a peer comparison, the years
 * are not all the same year either, because countries report when they report.
 * Both facts are surfaced on the page rather than smoothed over.
 */

/** The chart form a cluster is drawn in. Ten clusters, ten forms, no repeats. */
export type Form =
  | "peer-bar"
  | "line"
  | "stacked-area"
  | "column-zero"
  | "sparkgrid"
  | "stacked-bar"
  | "slope"
  | "scatter"
  | "lollipop"
  | "dumbbell";

export interface Cluster {
  id: string;
  title: string;
  /** The question the cluster answers, in words a reader would use. */
  question: string;
  /** Why this form and not another. Shown on the page. */
  why: string;
  form: Form;
  /** Ingested WDI series ids, in the order they should be drawn. */
  ids: string[];
}

export const CLUSTERS: Cluster[] = [
  {
    id: "scale",
    title: "How big India actually is",
    question: "Where does India sit next to the economies it is usually compared with?",
    why:
      "A question about position across countries, at one moment. Bars across a shared axis " +
      "are the only form where six lengths can be compared without the reader doing arithmetic.",
    form: "peer-bar",
    ids: [
      "wdi-gdp-current-usd",
      "wdi-exports-usd",
      "wdi-imports-usd",
      "wdi-merch-exports",
      "wdi-reserves",
      "wdi-cm-mkt-lcap-cd",
      "wdi-manufacturing-usd",
      "wdi-remittances",
    ],
  },
  {
    id: "climb",
    title: "The climb",
    question: "How did India get from 2001 to here?",
    why:
      "Change over time on a continuous measure. A line is the form that shows the shape of a " +
      "path — where it accelerated, where it stalled — which no snapshot can.",
    form: "line",
    ids: [
      "wdi-gdp-growth",
      "wdi-gdp-per-capita",
      "wdi-gdp-per-capita-ppp",
      "wdi-gni-per-capita",
      "wdi-exports-gdp",
      "wdi-trade-openness",
      "wdi-gross-capital-formation",
      "wdi-gross-savings",
      "wdi-manufacturing-gdp",
      "wdi-services-gdp",
    ],
  },
  {
    id: "sells",
    title: "What India sells the world",
    question: "What is actually in the export basket, and how has the mix changed?",
    why:
      "Parts of a whole, moving over time. Stacked areas show both the total and the share each " +
      "part takes of it, which is the whole question when a country's exports shift from goods to services.",
    form: "stacked-area",
    ids: [
      "wdi-bx-gsr-cmcp-zs",
      "wdi-bx-gsr-trvl-zs",
      "wdi-bx-gsr-tran-zs",
      "wdi-bx-gsr-insf-zs",
      "wdi-hightech-exports-share",
      "wdi-manufactured-exports-share",
      "wdi-tx-val-agri-zs-un",
      "wdi-tx-val-serv-cd-wt",
      "wdi-bx-gsr-mrch-cd",
      "wdi-bx-gsr-nfsv-cd",
    ],
  },
  {
    id: "external",
    title: "Money in, money out",
    question: "Is India taking in more than it sends out, and through which channel?",
    why:
      "These have a sign. Columns around a zero line put surplus above and deficit below, so the " +
      "years India was in the red are visible as position rather than as a number to be read.",
    form: "column-zero",
    ids: [
      "wdi-current-account",
      "wdi-bn-cab-xoka-cd",
      "wdi-bn-gsr-gnfs-cd",
      "wdi-bn-gsr-mrch-cd",
      "wdi-bn-klt-dinv-cd",
      "wdi-bn-klt-ptxl-cd",
      "wdi-ne-rsb-gnfs-zs",
      "wdi-fdi-gdp",
      "wdi-bx-trf-pwkr-dt-gd-zs",
      "wdi-gfdd-oi-13",
    ],
  },
  {
    id: "prices",
    title: "Prices, rates and credit",
    question: "What has money cost in India, and how much of it has there been?",
    why:
      "Ten related series that are read together rather than one at a time. Small multiples put " +
      "them on one screen at a common shape, so a reader compares turning points instead of scrolling.",
    form: "sparkgrid",
    ids: [
      "wdi-inflation",
      "wdi-fp-cpi-totl",
      "wdi-ny-gdp-defl-kd-zg-ad",
      "wdi-fr-inr-lend",
      "wdi-fr-inr-rinr",
      "wdi-fm-lbl-bmny-gd-zs",
      "wdi-private-credit",
      "wdi-fd-ast-prvt-gd-zs",
      "wdi-gfdd-di-01",
      "wdi-gfdd-si-02",
    ],
  },
  {
    id: "spend",
    title: "Where the output goes",
    question: "Of everything India produces, how much is consumed, invested or bought abroad?",
    why:
      "A composition that must add up. Stacked bars per year hold the total constant so the " +
      "reader sees one component gaining at another's expense, which separate lines hide.",
    form: "stacked-bar",
    ids: [
      "wdi-household-consumption-share",
      "wdi-ne-con-govt-zs",
      "wdi-fixed-capital-formation",
      "wdi-ne-imp-gnfs-zs",
      "wdi-ne-con-totl-zs",
      "wdi-ne-dab-totl-zs",
      "wdi-tax-revenue",
      "wdi-ne-rsb-gnfs-cd",
    ],
  },
  {
    id: "factories",
    title: "What the factories make",
    question: "Has Indian manufacturing moved up the value chain, or just got bigger?",
    why:
      "Two dates and the move between them. A slope chart makes the crossing lines the subject — " +
      "which sectors overtook which — which a pair of bar charts leaves the reader to work out.",
    form: "slope",
    ids: [
      "wdi-nv-mnf-chem-zs-un",
      "wdi-nv-mnf-fbto-zs-un",
      "wdi-nv-mnf-mtrn-zs-un",
      "wdi-nv-mnf-othr-zs-un",
      "wdi-nv-mnf-txtl-zs-un",
      "wdi-nv-mnf-tech-zs-un",
      "wdi-industry-gdp",
      "wdi-agriculture-gdp",
    ],
  },
  {
    id: "banks",
    title: "Banks and markets",
    question: "Does India have the financial depth its economy size implies?",
    why:
      "A relationship between two measures, not a ranking on either. A scatter is the only form " +
      "that shows whether deep credit and liquid markets actually travel together across countries.",
    form: "scatter",
    ids: [
      "wdi-gfdd-di-14",
      "wdi-gfdd-dm-01",
      "wdi-gfdd-em-01",
      "wdi-gfdd-ei-05",
      "wdi-gfdd-ei-06",
      "wdi-gfdd-si-01",
      "wdi-gfdd-si-03",
      "wdi-gfdd-si-05",
      "wdi-gfdd-oi-01",
      "wdi-gfdd-oi-06",
      "wdi-market-cap-gdp",
      "wdi-listed-companies",
    ],
  },
  {
    id: "state",
    title: "What the state collects",
    question: "Where does Indian government revenue come from?",
    why:
      "A ranked set of shares with long labels. Lollipops carry the label at full length and put " +
      "the value at the end of a thin stem, so the ranking reads down the page without heavy bars.",
    form: "lollipop",
    ids: [
      "wdi-gc-rev-xgrt-gd-zs",
      "wdi-gc-tax-gsrv-rv-zs",
      "wdi-gc-tax-ypkg-rv-zs",
      "wdi-gc-tax-impt-zs",
      "wdi-gc-tax-intt-rv-zs",
      "wdi-gc-tax-othr-rv-zs",
      "wdi-gc-rev-socl-zs",
      "wdi-gc-rev-gotr-zs",
      "wdi-gc-xpn-intp-rv-zs",
      "wdi-gc-tax-ypkg-zs",
    ],
  },
  {
    id: "exposure",
    title: "Exposure to the outside",
    question: "What could the rest of the world do to India, and has that got better or worse?",
    why:
      "Two readings per measure and the distance between them. Dumbbells put first and latest on " +
      "one row, so the length of the connector is the change and needs no second chart.",
    form: "dumbbell",
    ids: [
      "wdi-dt-dod-dect-gn-zs",
      "wdi-dt-dod-dstc-ir-zs",
      "wdi-dt-tds-dect-ex-zs",
      "wdi-fi-res-totl-mo",
      "wdi-fi-res-xgld-cd",
      "wdi-energy-imports",
      "wdi-ny-gdp-petr-rt-zs",
      "wdi-ny-gdp-totl-rt-zs",
      "wdi-ny-gdp-coal-rt-zs",
      "wdi-ny-gdp-ngas-rt-zs",
      "wdi-ny-gdp-minr-rt-zs",
      "wdi-dt-oda-odat-gn-zs",
      "wdi-gfdd-oi-14",
      "wdi-gfdd-oi-12",
    ],
  },
];

/** Every curated id, in cluster order. */
export const ALL_IDS: string[] = CLUSTERS.flatMap((c) => c.ids);

/** The cluster a series belongs to, or null if it is not curated here. */
export function clusterOf(id: string): Cluster | null {
  return CLUSTERS.find((c) => c.ids.includes(id)) ?? null;
}
