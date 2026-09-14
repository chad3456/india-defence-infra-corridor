/**
 * Vehicle registrations, air traffic and public transport, by state.
 *
 *   npm run transport:probe
 *
 * Three asks that turn out to be one probe, because they all come down to the
 * same question: which transport authority publishes a state breakdown that a
 * script can read?
 *
 * ── Four-wheeler sales, which are not sales ──────────────────────────────
 *
 * Nobody publishes car sales by state. What exists is VAHAN, the national
 * vehicle registration database, and a registration is not a sale: it is a
 * vehicle being put on a state's rolls, which happens where the buyer
 * registers it rather than where they bought it. Fleet and lease vehicles are
 * registered in whichever state charges least road tax, so the small states
 * that do this are systematically overstated. A tracker calling this "sales by
 * state" would be wrong in a direction it could not see.
 *
 * SIAM publishes actual dispatch figures, but to dealers and nationally, with
 * no state dimension at all. The two cannot be combined.
 *
 * ── Air traffic, where the grain is the airport ──────────────────────────
 *
 * AAI publishes passenger and movement figures per airport per month, which is
 * the right grain and better than the ask: an airport has a coordinate, so a
 * state total is a sum this project can compute and show its working for,
 * rather than a number it has to be given. The repository already holds 148
 * airports with coordinates and a point-in-polygon join to states.
 *
 * ── Public transport, where "accessibility" is the trap ──────────────────
 *
 * The word means at least three things: whether a service exists near someone,
 * whether they can afford it, and whether a disabled person can board it. The
 * first is measurable from network data this project already has. The second
 * and third are not, from anything probed here.
 *
 * So this asks for the measurable one and for its denominators — population
 * and area per state — because a metro-kilometre count without them ranks
 * states by size. Census 2011 is the last full count and its populations are
 * fifteen years stale, which is itself a finding the eventual page must state.
 */
import { join } from "node:path";
import { runProbe, type Target } from "./lib/probe-run";
import { isEntryPoint } from "./lib/entry";

const OUT = join(process.cwd(), "data", "live", "transport-probe.json");
const WIKI = "https://en.wikipedia.org/w/api.php";

const TARGETS: Target[] = [
  // ── Vehicle registration ──────────────────────────────────────────────
  {
    id: "vahan-dashboard", kind: "vehicles",
    what: "VAHAN dashboard",
    url: "https://vahan.parivahan.gov.in/vahan4dashboard/vahan/view/reportview.xhtml",
    look: ["vahan", "state"],
    count: { tableRows: /<tr/gi, selects: /<select/gi },
    settles:
      "Registrations by state, maker and fuel. The national register, and the only state-grain " +
      "vehicle series that exists.",
  },
  {
    id: "vahan-analytics", kind: "vehicles",
    what: "Parivahan analytics",
    url: "https://analytics.parivahan.gov.in/analytics/",
    look: ["analytics"],
    settles: "The newer front end, if the old dashboard is a postback application.",
  },
  {
    id: "vahan-publicreport", kind: "vehicles",
    what: "VAHAN public report, with parameters",
    url: "https://vahan.parivahan.gov.in/vahan4dashboard/vahan/dashboardview.xhtml?stateCode=29",
    paired: "https://vahan.parivahan.gov.in/vahan4dashboard/vahan/dashboardview.xhtml?stateCode=27",
    count: { tableRows: /<tr/gi },
    settles:
      "Whether a state can be selected in the URL. If two different state codes return the same " +
      "page, the dashboard is a JSF application and its numbers are behind a postback.",
  },
  {
    id: "siam-stats", kind: "vehicles",
    what: "SIAM, industry statistics",
    url: "https://www.siam.in/statistics.aspx?mpgid=8&pgidtrail=14",
    look: ["production", "sales"],
    settles:
      "Actual dispatches, nationally and by segment. No state dimension — which is the finding, " +
      "not a gap to be filled by mixing it with registrations.",
  },
  {
    id: "morth-yearbook", kind: "vehicles",
    what: "MoRTH, road transport yearbook",
    url: "https://morth.nic.in/road-transport-year-books",
    look: ["year book", "transport"],
    settles: "Registered vehicles on road by state, annually, in a PDF.",
  },

  // ── Air traffic ───────────────────────────────────────────────────────
  {
    id: "aai-traffic", kind: "air",
    what: "AAI traffic statistics",
    url: "https://www.aai.aero/en/business-opportunities/aai-traffic-news",
    look: ["traffic", "passenger"],
    settles:
      "Passengers, aircraft movements and freight per airport per month. Per-airport is a finer " +
      "grain than the ask, and this project can sum it to states itself.",
  },
  {
    id: "aai-annex", kind: "air",
    what: "AAI traffic, annexure listing",
    url: "https://www.aai.aero/sites/default/files/traffic-news/",
    settles: "Where the monthly workbooks actually sit, if they are directory-listed.",
  },
  {
    id: "dgca-traffic", kind: "air",
    what: "DGCA monthly traffic reports",
    url: "https://www.dgca.gov.in/digigov-portal/?page=jsp/dgca/InventoryList/dataReports/aviationDataStatistics/airTransport/domesticTraffic/",
    look: ["traffic"],
    settles: "Domestic passenger volume by carrier and route — a different cut of the same thing.",
  },
  {
    id: "wiki-busiest", kind: "air",
    what: "Wikipedia: busiest airports in India",
    url: `${WIKI}?action=parse&page=${encodeURIComponent("List_of_busiest_airports_in_India")}&redirects=1&prop=wikitext&formatversion=2&format=json`,
    decode: "parse.wikitext",
    count: { tableRows: /^\s*\|-/gm, refs: /<ref/gi },
    settles:
      "A dated, sourced table with AAI as its citation. Weaker provenance than AAI directly and " +
      "far easier to read; worth knowing whether it exists before choosing.",
  },

  // ── Public transport, and the denominators any rate needs ─────────────
  {
    id: "overpass-status", kind: "transport",
    what: "Overpass API status",
    url: "https://overpass-api.de/api/status",
    look: ["available"],
    settles:
      "Whether the OpenStreetMap query service answers. Bus routes, metro and rail are already " +
      "ingested from it; extending to coverage needs the same door open.",
  },
  {
    id: "wiki-metro", kind: "transport",
    what: "Wikipedia: urban rail transit in India",
    url: `${WIKI}?action=parse&page=${encodeURIComponent("Urban_rail_transit_in_India")}&redirects=1&prop=wikitext&formatversion=2&format=json`,
    decode: "parse.wikitext",
    count: { tableRows: /^\s*\|-/gm },
    settles: "Systems, lengths and opening dates — a cross-check on what OSM has tagged.",
  },
  {
    id: "wiki-state-pop", kind: "transport",
    what: "Wikipedia: Indian states by population",
    url: `${WIKI}?action=parse&page=${encodeURIComponent("List_of_states_and_union_territories_of_India_by_population")}&redirects=1&prop=wikitext&formatversion=2&format=json`,
    decode: "parse.wikitext",
    count: { tableRows: /^\s*\|-/gm },
    settles:
      "The denominator. Metro kilometres without population ranks states by size, not by " +
      "service — and the last full count is Census 2011, which is a finding in itself.",
  },
  {
    id: "wiki-state-area", kind: "transport",
    what: "Wikipedia: Indian states by area",
    url: `${WIKI}?action=parse&page=${encodeURIComponent("List_of_states_and_union_territories_of_India_by_area")}&redirects=1&prop=wikitext&formatversion=2&format=json`,
    decode: "parse.wikitext",
    count: { tableRows: /^\s*\|-/gm },
    settles: "The other denominator: service per square kilometre is a different claim from per person.",
  },
  {
    id: "censusindia", kind: "transport",
    what: "Census of India",
    url: "https://censusindia.gov.in/census.website/",
    look: ["census"],
    settles: "The primary population figures, if the site answers a script at all.",
  },
];

export async function run(): Promise<void> {
  await runProbe(TARGETS, OUT, {
    question:
      "Which transport authority publishes a state breakdown a script can read — for vehicle " +
      "registrations, air traffic, and public transport networks?",
    refusal:
      "No registration count, passenger figure or network length is recorded here. Only whether " +
      "a source answers, in what shape, and how many rows it carries.",
    registrationsAreNotSales:
      "VAHAN counts registrations, not sales. A vehicle is registered where its buyer registers " +
      "it, and fleet and lease vehicles are registered wherever road tax is lowest — so the " +
      "small states that compete on that are systematically overstated. SIAM publishes real " +
      "dispatches with no state dimension at all. The two must not be combined, and the eventual " +
      "page must not call either one 'sales by state'.",
    accessibilityIsThreeThings:
      "Whether a service exists near someone, whether they can afford it, and whether a disabled " +
      "person can board it. Only the first is measurable from anything probed here, and the page " +
      "has to say which one it means rather than using the word unqualified.",
    denominators:
      "Any per-capita transport rate needs a population, and India's last full count is Census " +
      "2011. Fifteen-year-old denominators under current network figures are a real distortion " +
      "and the page must state it rather than quietly dividing.",
  });
}

if (isEntryPoint(import.meta.url)) {
  run().catch((err) => { console.error(err); process.exit(1); });
}
