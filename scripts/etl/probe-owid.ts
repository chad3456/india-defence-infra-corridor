/**
 * Can a thousand indicators be fetched, and is Indian filmmaking measurable?
 *
 *   npm run owid:probe
 *
 * Two unrelated questions in one probe because both are "does a bulk public
 * source answer a script", and both have to be settled before anything is
 * built on them.
 *
 * ── The thousand-attribute question ──────────────────────────────────────
 *
 * A map tracker with a thousand layers is only honest if the thousand come
 * from somewhere that publishes its own metadata. Our World in Data does:
 * every chart has a slug, a CSV endpoint and a metadata document naming the
 * indicator's source, unit and citation. If the sitemap lists the slugs and
 * the CSV takes a country filter, then "a thousand attributes" is a fetch
 * loop over a published index rather than a thousand judgements by me.
 *
 * What the probe has to settle: whether the slug index exists, whether the
 * CSV endpoint honours its country parameter (the PIB lesson — a page can
 * return a plausible payload and ignore its query string entirely), and
 * whether metadata comes with it. An indicator without its unit and source is
 * a number with a filename where a citation should be, and would be worse than
 * not having it.
 *
 * Re-run note: the first attempt failed before reaching a single host, because
 * the npm script did not exist. That is the workflow doing its job — a probe
 * that cannot run must not report that every source refused.
 *
 * ── The filmmaking question, asked without its answer assumed ────────────
 *
 * The brief calls it a downgrade. That may be right and it is not something
 * this probe should presume: "Indian cinema is declining" and "Indian cinema
 * is the largest film industry on earth by title count" are both widely
 * asserted and they are not incompatible, because they measure different
 * things. So the probe asks which of the measurable ones are reachable —
 * titles certified per year, films released by language, box office, screens
 * per head, admissions — and whatever comes back is what the page will be
 * built from, whichever direction it points.
 */
import { join } from "node:path";
import { runProbe, type Target } from "./lib/probe-run";
import { isEntryPoint } from "./lib/entry";

const OUT = join(process.cwd(), "data", "live", "owid-probe.json");
const WIKI = "https://en.wikipedia.org/w/api.php";
const OWID = "https://ourworldindata.org";

const wikiPage = (page: string, settles: string, look: string[] = []): Target => ({
  id: `wiki:${page}`,
  kind: "cinema",
  what: page.replace(/_/g, " "),
  url: `${WIKI}?action=parse&format=json&prop=wikitext&page=${encodeURIComponent(page)}&redirects=1`,
  decode: "parse.wikitext.*",
  look,
  count: { tableRows: /^\|-/gm, tables: /\{\|\s*class=/g, refs: /<ref[\s>]/g, years: /\b(19|20)\d{2}\b/g },
  settles,
});

const TARGETS: Target[] = [
  /* ── The slug index ────────────────────────────────────────────────── */
  {
    id: "owid:sitemap",
    kind: "owid-index",
    what: "OWID sitemap — the published list of every chart slug",
    url: `${OWID}/sitemap.xml`,
    look: ["<loc>", "grapher"],
    count: { urls: /<loc>/g, graphers: /\/grapher\//g, sitemapIndex: /<sitemap>/g },
    settles: "Whether the thousand attributes can be discovered rather than typed",
  },
  {
    id: "owid:sitemap-charts",
    kind: "owid-index",
    what: "OWID chart sitemap, if the index points at one",
    url: `${OWID}/sitemap-charts.xml`,
    look: ["<loc>", "grapher"],
    count: { graphers: /\/grapher\//g },
    settles: "Whether charts have their own sitemap file",
  },
  {
    id: "owid:search",
    kind: "owid-index",
    what: "OWID chart search API",
    url: `${OWID}/api/charts.json`,
    look: ["slug", "title"],
    count: { slugs: /"slug"/g },
    settles: "Whether there is a JSON index of charts, which would beat parsing XML",
  },

  /* ── The data endpoint, and whether it honours its parameters ──────── */
  {
    id: "owid:csv-filtered",
    kind: "owid-data",
    what: "One indicator as CSV, filtered to India",
    url: `${OWID}/grapher/life-expectancy.csv?csvType=filtered&country=IND&useColumnShortNames=true`,
    // The paired request asks for a different country. Identical answers mean
    // the filter is decorative, which is the trap PIB's archive set and which
    // a 200 alone would never reveal.
    paired: `${OWID}/grapher/life-expectancy.csv?csvType=filtered&country=BRA&useColumnShortNames=true`,
    look: ["Entity", "Year", "India"],
    count: { rows: /\n/g, india: /India/g },
    settles: "Whether the country filter works, or is ignored while returning a plausible file",
  },
  {
    id: "owid:csv-full",
    kind: "owid-data",
    what: "The same indicator unfiltered, to size a bulk pull",
    url: `${OWID}/grapher/life-expectancy.csv`,
    look: ["Entity", "Year"],
    count: { rows: /\n/g },
    settles: "Whether a whole indicator is small enough to fetch and filter locally",
  },
  {
    id: "owid:metadata",
    kind: "owid-data",
    what: "Indicator metadata — unit, source, citation",
    url: `${OWID}/grapher/life-expectancy.metadata.json`,
    look: ["unit", "citation", "attribution", "descriptionShort", "columns"],
    count: { columns: /"titleShort"/g },
    settles: "Whether every attribute arrives with the unit and citation it needs to be publishable",
  },
  /* ── What the first probe did not ask ──────────────────────────────── */
  /**
   * The first pass asked whether the country filter works and got "yes".
   *
   * It did work — on `life-expectancy`, a line chart, where "filtered" means
   * the lines the chart draws: India, every year. Eighty-five rows, all of
   * them India, and the paired request for Brazil came back different. A clean
   * answer to the question that was put.
   *
   * The question that was not put is what "filtered" means on a chart whose
   * default view is a map. The 684-indicator registry answered it by accident:
   * 465 of those indicators came back with one year per country, and 416 came
   * back with more than twenty countries despite asking for thirteen. So on a
   * map-default chart, "filtered" appears to mean what the map tab shows —
   * every country, one year — and the country parameter is silently not the
   * dimension being filtered.
   *
   * Nothing about that is visible in a response. Each file was a valid CSV
   * with the right header, plausible values and a 200. Two thirds of a
   * "series" tier had no series in it and the run reported ok.
   *
   * These targets settle which parameters actually move which dimension, on a
   * slug known to be map-default, before the connector is rewritten around a
   * second guess.
   */
  {
    id: "owid:csv-map-default",
    kind: "owid-params",
    what: "A map-default chart, asking for one country the way the connector does",
    url: `${OWID}/grapher/above-ground-biomass-in-forest-per-hectare.csv?csvType=filtered&country=IND&useColumnShortNames=true`,
    paired: `${OWID}/grapher/above-ground-biomass-in-forest-per-hectare.csv?csvType=filtered&country=BRA&useColumnShortNames=true`,
    look: ["Entity", "Year", "Code"],
    count: { rows: /\n/g, india: /\bIndia\b/g, years1990: /,1990,/g },
    settles: "Whether country is honoured on a map-default chart, or quietly ignored",
  },
  {
    id: "owid:csv-time-param",
    kind: "owid-params",
    what: "The same chart with an explicit time range",
    url: `${OWID}/grapher/above-ground-biomass-in-forest-per-hectare.csv?csvType=filtered&country=IND&time=earliest..latest&useColumnShortNames=true`,
    paired: `${OWID}/grapher/above-ground-biomass-in-forest-per-hectare.csv?csvType=filtered&country=IND&time=2000..2005&useColumnShortNames=true`,
    look: ["Entity", "Year"],
    count: { rows: /\n/g, india: /\bIndia\b/g },
    settles: "Whether time= restores the depth that a map-default chart drops",
  },
  {
    id: "owid:csv-full-filtered",
    kind: "owid-params",
    what: "csvType=full with a country list — every year, only the countries asked for",
    url: `${OWID}/grapher/above-ground-biomass-in-forest-per-hectare.csv?csvType=full&country=IND~CHN~USA&useColumnShortNames=true`,
    paired: `${OWID}/grapher/above-ground-biomass-in-forest-per-hectare.csv?csvType=full&country=BRA~NGA~JPN&useColumnShortNames=true`,
    look: ["Entity", "Year"],
    count: { rows: /\n/g, india: /\bIndia\b/g, china: /\bChina\b/g, brazil: /\bBrazil\b/g },
    settles: "Whether the full export honours country, which would give depth and width in one call",
  },
  {
    id: "owid:csv-full-line",
    kind: "owid-params",
    what: "The same combination on the line chart, to see whether the rule is per-chart or general",
    url: `${OWID}/grapher/life-expectancy.csv?csvType=full&country=IND~CHN~USA&useColumnShortNames=true`,
    paired: `${OWID}/grapher/life-expectancy.csv?csvType=full&country=BRA~NGA~JPN&useColumnShortNames=true`,
    look: ["Entity", "Year"],
    count: { rows: /\n/g, india: /\bIndia\b/g },
    settles: "Whether one request shape can serve every chart type, or the connector must branch",
  },
  {
    id: "owid:csv-map-unfiltered-size",
    kind: "owid-params",
    what: "The map-default chart with no parameters at all, to size the worst case",
    url: `${OWID}/grapher/above-ground-biomass-in-forest-per-hectare.csv`,
    look: ["Entity", "Year"],
    count: { rows: /\n/g },
    settles: "What a local-filtering fallback would cost per indicator if no parameter is honoured",
  },
  /**
   * A daily series, because one indicator in the registry carried 2,431 points
   * for a single country. That is a Day column, not a Year column, and the
   * connector reads the first four characters of the cell as the year — so a
   * decade of daily observations becomes ten years each repeated 365 times.
   * The registry's own timespan field said "1990-2025" while its series held
   * one year; this is the same class of mismatch from the other direction.
   */
  {
    id: "owid:csv-daily",
    kind: "owid-params",
    what: "A daily-resolution indicator, which the year parser cannot represent",
    url: `${OWID}/grapher/daily-covid-cases.csv?csvType=filtered&country=IND&useColumnShortNames=true`,
    look: ["Entity", "Day"],
    count: { rows: /\n/g, dayHeader: /(^|,)Day(,|$)/gm },
    settles: "Whether a Day column is distinguishable from a Year column in the header alone",
  },

  {
    id: "owid:csv-trade",
    kind: "owid-data",
    what: "A trade indicator, to confirm the pattern holds beyond one slug",
    url: `${OWID}/grapher/merchandise-exports.csv?csvType=filtered&country=IND~CHN~USA&useColumnShortNames=true`,
    look: ["Entity", "Year"],
    count: { rows: /\n/g },
    settles: "Whether several countries can be requested in one call",
  },

  /* ── Indian cinema, measured several ways ──────────────────────────── */
  wikiPage(
    "Cinema_of_India",
    "Whether a survey article carries production, box-office or screen figures in tables",
    ["films produced", "box office", "screens", "admissions", "certified"],
  ),
  wikiPage(
    "List_of_Indian_films_of_2024",
    "Whether films released in a year are listed one per row, which would make a production count countable",
    ["Cast and crew", "Director", "Opening"],
  ),
  wikiPage(
    "List_of_Indian_films_of_2014",
    "Whether the same list exists a decade earlier, so a trend is possible",
    ["Director"],
  ),
  wikiPage(
    "List_of_highest-grossing_Indian_films",
    "Whether box-office figures are tabulated with years",
    ["Worldwide gross", "Year", "crore"],
  ),
  wikiPage(
    "Bollywood",
    "Whether the largest single industry article carries its own output figures",
    ["films", "box office", "revenue"],
  ),
  wikiPage(
    "Central_Board_of_Film_Certification",
    "Whether the certifier's own output — titles certified per year — is recorded anywhere readable",
    ["certified", "films", "annual"],
  ),
  {
    id: "owid:cinema",
    kind: "cinema",
    what: "OWID, in case cinema attendance is among its indicators",
    url: `${OWID}/grapher/cinema-attendance-per-capita.csv?csvType=filtered&country=IND`,
    look: ["Entity", "Year"],
    count: { rows: /\n/g },
    settles: "Whether admissions per head are available from a source that cites itself",
  },
  {
    id: "cbfc:site",
    kind: "cinema",
    what: "The Central Board of Film Certification's own site",
    url: "https://www.cbfcindia.gov.in/cbfcAdmin/html/statistics.html",
    look: ["statistics", "certified", "year"],
    settles: "Whether the primary source for titles certified answers a script at all",
  },
];

async function main(): Promise<void> {
  await runProbe(TARGETS, OUT, {
    question:
      "Can a thousand indicators be discovered and fetched from a source that publishes its own " +
      "units and citations, and which measures of Indian filmmaking are reachable at all?",
    refusal:
      "No figure of any kind is published here — not a life expectancy, not a box-office total, " +
      "not a film count. Only whether a source answered, in what shape, how many rows it appears " +
      "to carry, and whether its query parameters do anything.",
    note:
      "The brief describes Indian filmmaking as declining. That is not assumed here. 'The " +
      "largest film industry on earth by title count' and 'an industry in decline' are both " +
      "widely asserted and are not incompatible, because they measure different things — titles, " +
      "admissions, revenue, screens and share of a domestic market can and do move in opposite " +
      "directions at once. The probe asks which of them are reachable; whichever way they point " +
      "is what gets built.",
  });
}

if (isEntryPoint(import.meta.url)) {
  void main();
}
