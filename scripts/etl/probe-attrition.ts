/**
 * Is there an instance-level record of drones and military AI, and who keeps it?
 *
 *   npm run attrition:probe
 *
 * The ask is a story about commercial drones in Ukraine and about AI in
 * military operations, built on thousands of individual occurrences with
 * verified case studies. That is a much harder sourcing problem than it
 * sounds, and this probe exists because the honest answer might be no.
 *
 * ── Why most of what is written about this cannot be used ────────────────
 *
 * Both subjects are saturated with numbers that have no provenance. Ministries
 * on both sides of the war publish daily loss tallies for the other side and
 * neither can be checked. Consultancies publish "AI defence market" figures
 * built from their own definitions. Think-tank reports cite press reports
 * citing the ministries. A page built from any of that would be repeating
 * claims with a chart drawn over them, which is the failure mode this project
 * exists to avoid.
 *
 * ── The three shapes of evidence that would survive ──────────────────────
 *
 * 1. Photographically verified losses. Oryx publishes one list entry per piece
 *    of equipment, each linking to the image or video that confirms it. The
 *    count is an undercount by construction — a loss nobody photographed is not
 *    in it — and that is exactly what makes it citable: every row has a receipt,
 *    and the method's bias is one-directional and stated.
 *
 * 2. Money that a government has obligated. A defence contract is a public
 *    record with a date, a recipient, an amount and an awarding agency.
 *    USAspending serves it as an API with no key. "How much AI does a military
 *    buy" is then a sum of records rather than an estimate, and every row is
 *    checkable against a federal award id.
 *
 * 3. Catalogued incidents. The AI Incident Database and AIAAIC record
 *    individual events where an AI system caused or nearly caused harm, each
 *    with citations. Small numbers, high evidentiary quality, and the only
 *    public sources that attempt case-level detail on military AI at all.
 *
 * ── What this probe publishes ────────────────────────────────────────────
 *
 * Whether each source answers, in what shape, and how many rows it appears to
 * carry. No tally, no loss figure, no dollar amount. A probe log that quotes
 * "3,847 vehicles destroyed" beside a URL is a casualty claim with a filename
 * where a citation should be, and this file is deliberately incapable of
 * making one.
 */
import { join } from "node:path";
import { runProbe, type Target } from "./lib/probe-run";
import { isEntryPoint } from "./lib/entry";

const OUT = join(process.cwd(), "data", "live", "attrition-probe.json");
const WIKI = "https://en.wikipedia.org/w/api.php";

const wikiPage = (page: string, settles: string, look: string[] = []): Target => ({
  id: `wiki:${page}`,
  kind: "encyclopaedia",
  what: page.replace(/_/g, " "),
  url: `${WIKI}?action=parse&format=json&prop=wikitext&page=${encodeURIComponent(page)}&redirects=1`,
  decode: "parse.wikitext.*",
  look,
  count: {
    tableRows: /^\|-/gm,
    tables: /\{\|\s*class=/g,
    refs: /<ref[\s>]/g,
    sections: /^==[^=]/gm,
  },
  settles,
});

const TARGETS: Target[] = [
  /* ── 1. Photographically verified losses ───────────────────────────── */
  {
    id: "oryx:russia",
    kind: "verified-loss",
    what: "Oryx, Russian equipment losses, one entry per photographed item",
    url: "https://www.oryxspioenkop.com/2022/02/attack-on-europe-documenting-equipment.html",
    look: ["destroyed", "damaged", "captured", "abandoned", "postimg", "Unmanned"],
    count: {
      // Each confirmed item is a list item carrying a status in parentheses
      // and a link to the image that confirms it. Counting both separately
      // says whether the page is a list of receipts or a page of prose.
      listItems: /<li>/g,
      destroyedTags: /\(\s*\d+\s*,\s*destroyed\s*\)/gi,
      damagedTags: /\(\s*\d+\s*,\s*damaged\s*\)/gi,
      capturedTags: /\(\s*\d+\s*,\s*captured\s*\)/gi,
      evidenceLinks: /postimg\.cc|i\.imgur|twitter\.com\/[^"]*status/g,
      uavHeadings: /Unmanned\s+(Combat\s+)?Aerial\s+Vehicle/gi,
    },
    settles: "Whether a per-item, photo-linked loss record can be read by a script at all",
  },
  {
    id: "oryx:ukraine",
    kind: "verified-loss",
    what: "Oryx, Ukrainian equipment losses, the mirror list",
    url: "https://www.oryxspioenkop.com/2022/02/attack-on-europe-documenting-ukrainian.html",
    look: ["destroyed", "captured", "Unmanned"],
    count: {
      listItems: /<li>/g,
      destroyedTags: /\(\s*\d+\s*,\s*destroyed\s*\)/gi,
      evidenceLinks: /postimg\.cc|i\.imgur|twitter\.com\/[^"]*status/g,
      uavHeadings: /Unmanned\s+(Combat\s+)?Aerial\s+Vehicle/gi,
    },
    settles: "Whether both sides can be read the same way, so neither is the only side shown",
  },

  /* ── 2. Money a government has obligated ───────────────────────────── */
  {
    id: "usaspending:agency",
    kind: "procurement",
    what: "USAspending, a keyless federal award API",
    url: "https://api.usaspending.gov/api/v2/references/toptier_agencies/",
    look: ["Department of Defense", "toptier_code", "agency_name"],
    count: { agencies: /"agency_id"/g },
    settles: "Whether the award API answers without a key, and what it calls the defence agencies",
  },
  {
    id: "usaspending:psc",
    kind: "procurement",
    what: "USAspending, the product and service code tree",
    url: "https://api.usaspending.gov/api/v2/references/filter_tree/psc/",
    look: ["children", "count"],
    count: { nodes: /"value"/g },
    settles: "Whether contracts can be filtered by what was bought rather than by a keyword search",
  },
  {
    id: "usaspending:naics",
    kind: "procurement",
    what: "USAspending, an award-by-id record, to see a single row's shape",
    url: "https://api.usaspending.gov/api/v2/awards/CONT_AWD_N0001919C0001_9700_-NONE-_-NONE-/",
    look: ["description", "total_obligation", "recipient"],
    settles: "What one award record carries, so a connector knows which fields exist",
  },

  /* ── 3. Catalogued AI incidents ────────────────────────────────────── */
  {
    id: "aiid:index",
    kind: "ai-incident",
    what: "AI Incident Database, the public snapshot index",
    url: "https://incidentdatabase.ai/research/snapshots/",
    look: ["snapshot", "download", "mongodump"],
    settles: "Whether the incident corpus is downloadable in bulk rather than scraped",
  },
  {
    id: "aiid:api",
    kind: "ai-incident",
    what: "AI Incident Database, GraphQL",
    url: "https://incidentdatabase.ai/api/graphql?query=%7Bincidents(limit:1)%7Bincident_id%20title%7D%7D",
    look: ["incident_id", "data", "errors"],
    settles: "Whether incidents can be queried directly",
  },
  {
    id: "aiaaic:sheet",
    kind: "ai-incident",
    what: "AIAAIC repository, the public spreadsheet as CSV",
    url: "https://docs.google.com/spreadsheets/d/1Bn55B4xz21-_Rgdr8BBb2lt0n_4rzLGxFADMlVW0PYI/export?format=csv&gid=888071280",
    look: ["Type", "Sector", "Technology", "Country"],
    count: { rows: /\n/g, military: /military|defen[cs]e|army|drone/gi },
    settles: "Whether a thousand-row incident register with a military sector exists as machine-readable text",
  },

  /* ── 4. Academic conflict event data ───────────────────────────────── */
  {
    id: "ucdp:ged",
    kind: "event-data",
    what: "UCDP georeferenced events, Ukraine, one year",
    url: "https://ucdpapi.pcr.uu.se/api/gedevents/25.1?pagesize=10&Country=Ukraine",
    look: ["date_start", "deaths_civilians", "source_article", "latitude"],
    count: { records: /"id"\s*:/g },
    settles: "Whether a per-event, geolocated, source-cited conflict dataset is keyless",
  },
  {
    id: "acled:api",
    kind: "event-data",
    what: "ACLED, which classifies drone strikes as their own event subtype",
    url: "https://api.acleddata.com/acled/read?limit=1",
    look: ["event_type", "sub_event_type", "data"],
    settles: "Whether ACLED answers without a key — it is the only source that types a drone strike as such",
  },

  /* ── 5. The encyclopaedia, as an index rather than a source ────────── */
  wikiPage(
    "List_of_equipment_of_the_Ukrainian_Ground_Forces",
    "Whether an equipment list gives a per-type table a script can read",
    ["unmanned", "UAV", "drone"],
  ),
  wikiPage(
    "Unmanned_aerial_vehicles_in_the_Russo-Ukrainian_War",
    "Whether there is a single article indexing the UAV types in this war",
    ["Bayraktar", "Shahed", "Lancet", "FPV", "commercial"],
  ),
  wikiPage(
    "Artificial_intelligence_arms_race",
    "Whether a survey article indexes named military AI programmes",
    ["Project Maven", "autonomous", "Lavender", "targeting"],
  ),
  wikiPage(
    "Project_Maven",
    "A named, documented military AI programme with dates and contracts",
    ["Google", "Pentagon", "algorithmic warfare"],
  ),
  wikiPage(
    "DJI_Mavic",
    "Whether the single most-used commercial airframe in this war has a readable article",
    ["Mavic", "Ukraine", "military"],
  ),
];

async function main(): Promise<void> {
  await runProbe(TARGETS, OUT, {
    question:
      "Is there an instance-level, verifiable record of commercial drone use in Ukraine and of " +
      "AI in military operations — thousands of individual occurrences, each with a citation — " +
      "or only aggregate claims from parties to the conflict?",
    refusal:
      "This file publishes no tally, no loss figure, no casualty number and no dollar amount. " +
      "It records only whether a source answered, in what shape, and roughly how many rows it " +
      "appears to carry. A probe log that quoted a loss count beside a URL would be a casualty " +
      "claim with a filename where a citation should be.",
    note:
      "Loss records like Oryx are undercounts by construction: a vehicle nobody photographed is " +
      "not in the list. That is a feature for citability and a trap for comparison — the two " +
      "sides are photographed at different rates by different numbers of people with different " +
      "phones and different reasons to post. Any page built on this must say so in the same " +
      "breath as the number.",
  });
}

if (isEntryPoint(import.meta.url)) {
  void main();
}
