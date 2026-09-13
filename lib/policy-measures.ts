/**
 * What India actually did, as distinct from what it achieved.
 *
 * The made-in-India dashboard measures outcomes: a commodity line moved or it
 * did not. This file is the other half of the sentence — the named acts of
 * policy that are supposed to have moved it. A production subsidy, a
 * procurement embargo, a duty staircase, a corridor. Together they are the
 * answer people give when asked why the trade balance in electronics and
 * defence changed, and almost nobody who gives that answer can say what any of
 * the schemes is worth, when it was notified, or what it covers.
 *
 * ── This file attributes nothing ─────────────────────────────────────────
 *
 * `lib/localisation.ts` declines to attribute a movement in a trade line to an
 * instrument, and that refusal stands. Nothing here credits a measure with an
 * outcome. A measure is a thing that was done, carrying the claim made for it
 * and the reading that claim deserves; whether the line moved is a separate
 * question answered by separate data, and the honest join between them is a
 * date, not an arrow.
 *
 * ── Why every number on a measure is empty ───────────────────────────────
 *
 * Policy facts are the most dangerous category of number available to a
 * project like this, precisely because they feel safe. A scheme outlay, an
 * item count on an indigenisation list, an offset threshold, a corridor
 * investment — these are exactly the figures that sit in memory in a
 * plausible-looking form and are wrong by a factor of ten, or right for the
 * wrong year, or a commitment being quoted as a disbursement. There is no
 * arithmetic downstream that would catch it.
 *
 * So this file ships the *slots* and not the figures. Every quantity a measure
 * needs is a `Slot`: a question, a unit, a plausibility band, the words a
 * source sentence must contain, and `filled: null` until a connector goes to a
 * named document, finds a sentence, and stores that sentence verbatim beside
 * the number it read out of it. A slot with no sentence behind it does not
 * display. This is the discipline the toponymy layer in
 * `scripts/etl/connectors/sacred.ts` follows for place-name etymologies: the
 * pairing is a hypothesis, the article either supplies a sentence supporting
 * it or it does not, and an unsupported pairing is dropped rather than
 * published.
 *
 * ── What was rejected in building this ───────────────────────────────────
 *
 *   A parallel instrument vocabulary. `INSTRUMENTS` in
 *   `lib/localisation-sectors.ts` already names five instrument types with
 *   their mechanisms, fingerprints and failure modes. Re-describing tariffs
 *   here would have produced two lists that drift. The five are imported and
 *   reused; `EXTRA_INSTRUMENTS` adds only the kinds the defence measures need
 *   that genuinely are not any of the five, and each says why.
 *
 *   A hand-assigned status. An earlier shape had `status: "verified"` as a
 *   field an author sets. That is a grade wearing a measurement's clothes, and
 *   it can disagree with the evidence sitting next to it. Verification is
 *   computed from whether the slots are filled, every time it is asked for.
 *
 *   Cross-sector measures. The umbrella PLI announced across fourteen sectors,
 *   and the public-procurement (Make in India) preference order, are real and
 *   important and belong to no single sector in `SECTORS`. Filing either under
 *   "electronics" would put a national figure behind a sector heading. They
 *   are named in `data/live/policy-gaps.md` under deliberate exclusions
 *   instead, with what it would take to carry them properly.
 *
 *   Writing the outlays from memory and marking them "to be checked". Every
 *   version of that plan ends with the figures shipping.
 */
import { INSTRUMENTS, SECTORS, type Instrument } from "./localisation-sectors";
import { parseIndianNumber } from "./claims";
import type { Rung } from "./epistemic";

/* ────────────────────────────────────────────────────────────────────────
 * Vocabulary, borrowed rather than invented
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Sectors, as the localisation dashboard already defines them.
 *
 * The union is written out so a typo in a measure is a compile error rather
 * than a row that silently belongs to no sector. `assertVocabulary` checks the
 * union against `SECTORS` at run time, so adding a sector there and forgetting
 * it here fails loudly instead of quietly.
 */
export type SectorId =
  | "pharmaceuticals"
  | "electronics"
  | "semiconductors"
  | "solar"
  | "defence"
  | "toys"
  | "hardware"
  | "energy-dependence";

/**
 * The instruments the five-type vocabulary does not cover.
 *
 * Each of these was checked against `INSTRUMENTS` first and is here because it
 * works by a mechanism none of the five describes — not because it has a
 * different name. A defence offset is not procurement preference: the buyer is
 * still buying the import, and the obligation lands on the foreign seller. An
 * innovation grant is not a production subsidy: it pays for an attempt, and
 * most attempts fail, which is the point of it.
 */
export const EXTRA_INSTRUMENTS: Instrument[] = [
  {
    id: "innovation-grant",
    name: "Innovation grants and challenge funding",
    mechanism:
      "Fund a startup or laboratory to attempt a specific capability, usually against a problem statement written by the eventual buyer, with a path to a procurement order if it works.",
    fingerprint:
      "None, for years. Grants buy prototypes, and a prototype does not appear in trade data. The earliest visible trace would be a procurement contract, not an import line.",
    failureMode:
      "The prototype is delivered and never ordered. Counting grants disbursed, or startups engaged, measures the programme's activity rather than its output, and those are the numbers programmes publish.",
  },
  {
    id: "offset-obligation",
    name: "Offset obligations",
    mechanism:
      "Require a foreign supplier winning a contract above a threshold to place a proportion of its value back into the domestic industry, as purchases, technology transfer or investment.",
    fingerprint:
      "Perverse. The import still happens — the obligation is attached to it — so a period of heavy offset generation is by construction a period of heavy imports.",
    failureMode:
      "Discharge is what gets counted, and discharge can be satisfied by purchases the supplier would have made anyway, by banked credits, or by components that arrive as an import in some other line.",
  },
  {
    id: "industrial-corridor",
    name: "Industrial corridors",
    mechanism:
      "Assemble land, power and common testing facilities in designated nodes, and use state incentives to concentrate suppliers where an anchor buyer already is.",
    fingerprint:
      "Slow and indirect. Corridors change where production happens before they change whether it happens, and a supplier relocating inside India moves nothing at the border.",
    failureMode:
      "Memoranda of understanding are signed, reported as investment, and never grounded. The gap between committed and grounded capital is the measurement that matters and it is not the one announced.",
  },
  {
    id: "capital-subsidy",
    name: "Capital expenditure support",
    mechanism:
      "Reimburse a share of the cost of building the plant itself, rather than paying per unit it produces. Used where the entry cost, not the operating margin, is what stops a domestic industry existing — fabrication and display plants above all.",
    fingerprint:
      "A lag measured in years, then a step change or nothing. Between the sanction and the first wafer there is no trade signature at all, which is precisely the window in which the policy gets declared a success.",
    failureMode:
      "The support is committed to a project that does not reach production, or reaches it at a node the market has already moved past. The money is spent either way.",
  },
  {
    id: "ownership-rule",
    name: "Foreign ownership limits",
    mechanism:
      "Set the share of a domestic defence or electronics manufacturer a foreign entity may hold, and by which approval route, trading control for capital and technology.",
    fingerprint:
      "None directly. Ownership rules change who builds capacity, not what crosses the border, and their effect arrives through investment decisions years later.",
    failureMode:
      "The cap is raised and the investment does not come, because the binding constraint was the order book rather than the shareholding.",
  },
];

/** The five borrowed types plus the five this layer needs. */
export const ALL_INSTRUMENTS: Instrument[] = [...INSTRUMENTS, ...EXTRA_INSTRUMENTS];

export type InstrumentId =
  | "tariff"
  | "phased-manufacturing"
  | "production-subsidy"
  | "quality-orders"
  | "procurement"
  | "innovation-grant"
  | "offset-obligation"
  | "industrial-corridor"
  | "capital-subsidy"
  | "ownership-rule";

/* ────────────────────────────────────────────────────────────────────────
 * The evidence shape
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * A number that arrived with its sentence.
 *
 * `sourceUrl` and `quote` are required fields rather than optional ones, so a
 * figure without provenance is not a thing this type can express. The test
 * suite checks for it anyway, because data that arrives from JSON has not been
 * through the compiler.
 *
 * `asWritten` is kept beside `value` for the same reason `ParsedNumber` keeps
 * it: "₹76,000 crore" and 760_000_000_000 are the same claim only if the
 * multiplication was done right, and a reader who can see both can check it.
 */
export interface Filled {
  /** Plain units: rupees, a count, a percentage, or a calendar year. */
  value: number;
  /** The figure as the source wrote it, before any multiplication. */
  asWritten: string;
  /** The document the sentence came from. */
  sourceUrl: string;
  /** The sentence, verbatim. Not a paraphrase and not a paragraph. */
  quote: string;
  /** The publisher, as it names itself. */
  publisher: string;
  /** ISO date the connector read the document. */
  readAt: string;
  /**
   * What kind of figure this is, in the site's existing ladder.
   *
   * Almost every figure on this page is a `record` of a decision — a
   * notification says an outlay was approved — and that is not the same as a
   * measurement of money spent. Where a probe finds a disbursement rather than
   * an authorisation, the distinction is carried here and stated on the page.
   */
  rung: Rung;
}

export type SlotUnit = "rupees" | "count" | "percent" | "year";

/**
 * A question with a shape, waiting for an answer.
 *
 * `expect` is the plausibility band and it is doing real work. The failure this
 * whole layer is built against is a misread multiplier: a scheme outlay of
 * ₹760 crore and one of ₹76,000 crore are both entirely ordinary-looking
 * numbers, and nothing downstream can tell them apart. A figure outside the
 * band is refused rather than published, the same rule `MetricSpec.expect` in
 * `lib/claims.ts` applies to figures lifted out of headlines.
 *
 * The bands here are deliberately wide. A band is a check against an order of
 * magnitude error, not a prediction of the answer — a narrow band would be a
 * remembered figure smuggled in through the back door.
 */
export interface Slot {
  id: string;
  /** The question, in words a reader can see. */
  what: string;
  unit: SlotUnit;
  /** [min, max] in plain units. A value outside this is refused. */
  expect: [number, number];
  /** Words the source sentence must contain to be about this slot. */
  look: string[];
  /** Null until a document supplies a sentence. */
  filled: Filled | null;
}

/** Construct an empty slot. Every slot starts here; connectors fill them. */
export function slot(
  id: string,
  what: string,
  unit: SlotUnit,
  expect: [number, number],
  look: string[],
): Slot {
  return { id, what, unit, expect, look, filled: null };
}

const CRORE_RUPEES = 10_000_000;

/** Outlay bands, wide on purpose. A scheme is somewhere between these. */
const OUTLAY_BAND: [number, number] = [10 * CRORE_RUPEES, 500_000 * CRORE_RUPEES];
/** Notification years. The lower bound is liberalisation, not a guess at the answer. */
const YEAR_BAND: [number, number] = [1991, 2030];

/* ────────────────────────────────────────────────────────────────────────
 * Reading a slot out of a sentence
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Years need their own reader, because the number parser refuses them.
 *
 * `parseIndianNumber` deliberately declines a bare four-digit run — "recognised
 * in 2026" would otherwise file 2026 as a count, and on that module's inputs
 * that refusal is correct. Here a four-digit run is exactly what is wanted, so
 * the rule is inverted and tightened instead: the sentence must carry exactly
 * one distinct year inside the band, because "the 2020 policy replaced the 2016
 * one" names two and picking either would be a guess.
 */
export function readYear(sentence: string, band: [number, number]): { value: number; asWritten: string } | null {
  const found = new Set<number>();
  let asWritten = "";
  for (const m of sentence.matchAll(/\b(19|20)\d{2}\b/g)) {
    const v = Number(m[0]);
    if (v < band[0] || v > band[1]) continue;
    if (!found.has(v)) asWritten = m[0];
    found.add(v);
  }
  if (found.size !== 1) return null;
  const only = [...found][0];
  if (only === undefined) return null;
  return { value: only, asWritten };
}

export interface ReadMeta {
  sourceUrl: string;
  publisher: string;
  readAt: string;
  rung: Rung;
}

/**
 * Fill a slot from a sentence, or refuse.
 *
 * Three things must agree before a number is believed, and any one of them
 * failing means no answer rather than a guess:
 *
 *   the sentence has to be about this slot — every word in `look` is present;
 *   it has to carry exactly one readable figure in the right unit;
 *   the figure has to fall inside the plausibility band.
 *
 * Returns null on every failure. A connector calling this should record which
 * slots came back null, not retry with looser rules.
 */
export function readSlot(target: Slot, sentence: string, meta: ReadMeta): Filled | null {
  const text = sentence.replace(/\s+/g, " ").trim();
  if (text.length < 20 || text.length > 600) return null;

  const hay = text.toLowerCase();
  if (!target.look.every((w) => hay.includes(w.toLowerCase()))) return null;

  let value: number;
  let asWritten: string;
  if (target.unit === "year") {
    const y = readYear(text, target.expect);
    if (y === null) return null;
    value = y.value;
    asWritten = y.asWritten;
  } else {
    const n = parseIndianNumber(text);
    if (n === null) return null;
    if (n.unit !== target.unit) return null;
    value = n.value;
    asWritten = n.asWritten;
  }

  if (value < target.expect[0] || value > target.expect[1]) return null;
  return { value, asWritten, quote: text, ...meta };
}

/* ────────────────────────────────────────────────────────────────────────
 * The measures
 * ──────────────────────────────────────────────────────────────────────── */

export interface Measure {
  id: string;
  /** A plain-English name. The official one is a slot, because spellings matter. */
  name: string;
  /**
   * The name the notifying document uses, once a document has been read.
   * Null until then — schemes are routinely referred to by three names and
   * only one of them is in the gazette.
   */
  officialName: string | null;
  sector: SectorId;
  instrument: InstrumentId;
  /** The ministry or department that notified it, as a hypothesis to check. */
  authority: string;
  /** The claim made for this measure, in circulation. Not a finding. */
  claim: string;
  /** What that claim would need to be true, and what the data here can see. */
  reading: string;
  /** Every quantity this measure needs, each empty until a source fills it. */
  slots: Slot[];
  /** Target ids in `scripts/etl/probe-policy.ts` that should settle these slots. */
  probeTargets: string[];
  /** Series already on this site carrying numbers about this measure. */
  seriesIds: string[];
  /** Anything a later reader needs in order not to repeat a decision made here. */
  note?: string;
}

/**
 * Ordered roughly by how often the measure is cited as the reason the trade
 * balance changed, which is also the order in which a wrong figure here would
 * do the most damage.
 */
export const MEASURES: Measure[] = [
  /* ── Electronics: the subsidy and the staircase ───────────────────── */
  {
    id: "pli-large-scale-electronics",
    name: "Production-linked incentive for large-scale electronics manufacturing",
    officialName: null,
    sector: "electronics",
    instrument: "production-subsidy",
    authority: "Ministry of Electronics and Information Technology",
    claim:
      "The handset scheme is the reason India went from importing phones to exporting them.",
    reading:
      "The handset trade line did reverse, further and faster than anything else in this dataset, and the scheme is the obvious candidate. What the trade data cannot settle is how much of the resulting value is added here, because the component lines beneath the handset line did not move with it. The measure and the outcome are shown side by side and the arrow between them is left for the reader to draw.",
    slots: [
      slot("notified", "Year the scheme was notified", "year", YEAR_BAND, ["scheme"]),
      slot("outlay", "Total outlay approved for the scheme", "rupees", OUTLAY_BAND, ["crore"]),
      slot("tenure", "Number of years the incentive runs for", "count", [1, 15], ["year"]),
    ],
    probeTargets: ["meity-pli-lsem", "meity-schemes", "pib-allrel", "wiki-production-linked-incentive"],
    seriesIds: [],
  },
  {
    id: "pli-it-hardware",
    name: "Production-linked incentive for IT hardware",
    officialName: null,
    sector: "electronics",
    instrument: "production-subsidy",
    authority: "Ministry of Electronics and Information Technology",
    claim: "Laptops and servers are following the same path handsets took.",
    reading:
      "The relevant commodity line on the localisation dashboard is 8471.30, portable computers, and it has not done what the handset line did. A second version of the scheme was announced after the first was judged to have underperformed; both the original and the revision need their own dates and outlays, and conflating them would flatter both.",
    slots: [
      slot("notified", "Year the scheme was first notified", "year", YEAR_BAND, ["hardware"]),
      slot("outlay", "Outlay approved", "rupees", OUTLAY_BAND, ["crore"]),
      slot("revised", "Year of the revised version of the scheme, if there is one", "year", YEAR_BAND, ["hardware"]),
    ],
    probeTargets: ["meity-pli-ithw", "meity-schemes", "pib-allrel"],
    seriesIds: [],
  },
  {
    id: "pmp-mobile-handsets",
    name: "Phased manufacturing programme for mobile handsets and components",
    officialName: null,
    sector: "electronics",
    instrument: "phased-manufacturing",
    authority: "Ministry of Electronics and Information Technology",
    claim:
      "A published duty staircase pulled assembly, then sub-assembly, then components into India on a timetable.",
    reading:
      "This is the instrument whose fingerprint the trade data is best placed to see: the finished-good import line should fall first, component import lines should rise and then fall in turn. Testing it needs the schedule — which parts, at which duty, from which year — and the schedule is a table in a notification, not a headline.",
    slots: [
      slot("notified", "Year the programme was notified", "year", YEAR_BAND, ["phased"]),
      slot("stages", "Number of stages in the published schedule", "count", [1, 40], ["phase"]),
    ],
    probeTargets: ["meity-pmp", "cbic-tariff", "indiabudget"],
    seriesIds: [],
    note:
      "The duty schedule itself is a table, not a figure, and does not fit the slot shape. It needs its own small ingest and is listed as such in the gap register.",
  },
  {
    id: "ict-customs-duty",
    name: "Customs duty on information-technology goods",
    officialName: null,
    sector: "electronics",
    instrument: "tariff",
    authority: "Central Board of Indirect Taxes and Customs",
    claim: "Duty on imported electronics made domestic assembly viable.",
    reading:
      "The tariff wall is the least-examined half of the electronics story and the one with a named cost: duty on components is paid by the assembler, and where that assembler exports, the wall protecting one line taxes another. India's commitments under the Information Technology Agreement are the live dispute here, and the honest version of this entry names the dispute rather than settling it.",
    slots: [
      slot("phone-bcd", "Basic customs duty on imported mobile handsets, latest rate", "percent", [0, 100], ["cent"]),
    ],
    probeTargets: ["cbic-tariff", "indiabudget", "wiki-information-technology-agreement"],
    seriesIds: [],
    note:
      "Rates change at every budget. Any rate carried here must state the year it applies to or it is worse than nothing.",
  },
  {
    id: "electronics-qco",
    name: "Quality control orders on electronic goods",
    officialName: null,
    sector: "electronics",
    instrument: "quality-orders",
    authority: "Bureau of Indian Standards / Ministry of Electronics and Information Technology",
    claim:
      "Compulsory registration under Indian standards kept substandard imports out.",
    reading:
      "The toys sector on the localisation dashboard is the clean test of this instrument, because the product is simple and the order has a date. For electronics the orders are numerous, staggered and product-specific, so the useful figure is how many product categories are covered and from when — not a single date.",
    slots: [
      slot("notified", "Year compulsory registration for electronics began", "year", YEAR_BAND, ["registration"]),
      slot("categories", "Number of product categories under compulsory registration", "count", [1, 1000], ["product"]),
    ],
    probeTargets: ["bis-crs", "meity-schemes"],
    seriesIds: [],
  },

  /* ── Semiconductors: capital, not units ───────────────────────────── */
  {
    id: "semicon-india",
    name: "Semicon India programme",
    officialName: null,
    sector: "semiconductors",
    instrument: "capital-subsidy",
    authority: "Ministry of Electronics and Information Technology / India Semiconductor Mission",
    claim: "India is building its own chips.",
    reading:
      "This is the widest gap between announcement and trade data anywhere on this site, and the dashboard should keep saying so. Fabrication plants approved in the 2020s cannot appear in trade data before they produce. The figures worth having are the programme outlay, the number of projects approved, and — the one that actually settles anything — how many have commissioned. The last of those is usually missing from the same release that gives the first two.",
    slots: [
      slot("notified", "Year the programme was approved", "year", YEAR_BAND, ["semiconductor"]),
      slot("outlay", "Programme outlay", "rupees", OUTLAY_BAND, ["crore"]),
      slot("approved", "Number of projects approved under it", "count", [1, 200], ["project"]),
      slot("commissioned", "Number of plants in commercial production", "count", [0, 200], ["production"]),
    ],
    probeTargets: ["ism-home", "meity-schemes", "pib-allrel", "wiki-semiconductor-industry-in-india"],
    seriesIds: [],
    note:
      "The commissioned slot is the one that matters and the one no press release volunteers. If it stays empty, the page should say the programme has approvals and report the approvals as approvals.",
  },
  {
    id: "specs",
    name: "Scheme for promotion of manufacturing of electronic components and semiconductors",
    officialName: null,
    sector: "semiconductors",
    instrument: "capital-subsidy",
    authority: "Ministry of Electronics and Information Technology",
    claim:
      "Capital support for component plants attacks the part of the electronics chain that imports actually sit in.",
    reading:
      "If the assembly critique of the handset story is right, this is the scheme that answers it, which makes it more important than its profile suggests. The components in question are the same lines the localisation dashboard carries as inputs — integrated circuits, displays, batteries — so an effect here would be visible in data this project already has.",
    slots: [
      slot("notified", "Year the scheme was notified", "year", YEAR_BAND, ["component"]),
      slot("outlay", "Outlay approved", "rupees", OUTLAY_BAND, ["crore"]),
      slot("support-rate", "Share of capital expenditure reimbursed", "percent", [0, 100], ["cent"]),
    ],
    probeTargets: ["meity-specs", "meity-schemes", "pib-allrel"],
    seriesIds: [],
  },

  /* ── Defence: embargo, offsets, procurement rules ─────────────────── */
  {
    id: "pil-services-1",
    name: "First positive indigenisation list",
    officialName: null,
    sector: "defence",
    instrument: "procurement",
    authority: "Department of Military Affairs / Ministry of Defence",
    claim:
      "A list of items the armed forces may no longer import is the sharpest instrument India has used against the defence trade deficit.",
    reading:
      "Sharper than a subsidy, because it removes the alternative rather than making the domestic option cheaper — and for the same reason, it is an instrument whose cost lands on capability if the domestic item is not ready. Each list needs three things: when it was notified, how many items it carries, and the embargo dates, which are staggered across years inside a single list. The third is a table and the reason the item count alone is a weak fact.",
    slots: [
      slot("notified", "Date the list was notified", "year", YEAR_BAND, ["list"]),
      slot("items", "Number of items on the list", "count", [1, 5000], ["item"]),
    ],
    probeTargets: ["ddp-indigenisation", "mod-annual-report", "pib-rss-mod", "wiki-defence-industry-of-india"],
    seriesIds: [],
    note:
      "Five lists are said to exist for the services. They are carried as five measures rather than one with a count, because each has its own date, its own length and its own embargo schedule, and summing them produces a total nobody published.",
  },
  {
    id: "pil-services-2",
    name: "Second positive indigenisation list",
    officialName: null,
    sector: "defence",
    instrument: "procurement",
    authority: "Department of Military Affairs / Ministry of Defence",
    claim: "The embargo was extended to a second tranche of items.",
    reading:
      "Same instrument, later tranche. The interesting comparison across the five lists is whether later lists reach further up the complexity scale or merely add more of the same, and that is a question about what is on them, not how many.",
    slots: [
      slot("notified", "Date the list was notified", "year", YEAR_BAND, ["list"]),
      slot("items", "Number of items on the list", "count", [1, 5000], ["item"]),
    ],
    probeTargets: ["ddp-indigenisation", "mod-annual-report", "pib-rss-mod"],
    seriesIds: [],
  },
  {
    id: "pil-services-3",
    name: "Third positive indigenisation list",
    officialName: null,
    sector: "defence",
    instrument: "procurement",
    authority: "Department of Military Affairs / Ministry of Defence",
    claim: "The embargo was extended to a third tranche of items.",
    reading:
      "Same instrument, later tranche. Each list is carried separately because each has its own notification date, its own length and its own staggered embargo schedule, and the total across the five is a number nobody published. See the first list for what every entry here needs.",
    slots: [
      slot("notified", "Date the list was notified", "year", YEAR_BAND, ["list"]),
      slot("items", "Number of items on the list", "count", [1, 5000], ["item"]),
    ],
    probeTargets: ["ddp-indigenisation", "mod-annual-report", "pib-rss-mod"],
    seriesIds: [],
  },
  {
    id: "pil-services-4",
    name: "Fourth positive indigenisation list",
    officialName: null,
    sector: "defence",
    instrument: "procurement",
    authority: "Department of Military Affairs / Ministry of Defence",
    claim: "The embargo was extended to a fourth tranche of items.",
    reading:
      "Same instrument, later tranche. Each list is carried separately because each has its own notification date, its own length and its own staggered embargo schedule, and the total across the five is a number nobody published. See the first list for what every entry here needs.",
    slots: [
      slot("notified", "Date the list was notified", "year", YEAR_BAND, ["list"]),
      slot("items", "Number of items on the list", "count", [1, 5000], ["item"]),
    ],
    probeTargets: ["ddp-indigenisation", "mod-annual-report", "pib-rss-mod"],
    seriesIds: [],
  },
  {
    id: "pil-services-5",
    name: "Fifth positive indigenisation list",
    officialName: null,
    sector: "defence",
    instrument: "procurement",
    authority: "Department of Military Affairs / Ministry of Defence",
    claim: "The embargo was extended to a fifth tranche of items.",
    reading:
      "Same instrument, later tranche. Each list is carried separately because each has its own notification date, its own length and its own staggered embargo schedule, and the total across the five is a number nobody published. See the first list for what every entry here needs.",
    slots: [
      slot("notified", "Date the list was notified", "year", YEAR_BAND, ["list"]),
      slot("items", "Number of items on the list", "count", [1, 5000], ["item"]),
    ],
    probeTargets: ["ddp-indigenisation", "mod-annual-report", "pib-rss-mod"],
    seriesIds: [],
  },
  {
    id: "pil-dpsu",
    name: "Indigenisation lists for defence public sector undertakings",
    officialName: null,
    sector: "defence",
    instrument: "procurement",
    authority: "Department of Defence Production",
    claim:
      "A parallel set of lists covers the line-replaceable units, sub-systems and components the state-owned manufacturers themselves import.",
    reading:
      "If these exist as a separate series from the services lists, they are the more interesting half: the services lists embargo platforms, while a component list embargoes the imports hiding inside a platform that is already called indigenous. Whether they are genuinely distinct from the five services lists, and how many there are, is a question for the probe and not for memory — this entry deliberately carries no count.",
    slots: [
      slot("lists", "How many such lists have been notified", "count", [1, 50], ["list"]),
      slot("items", "Total items across them, if a source states a total", "count", [1, 50_000], ["item"]),
    ],
    probeTargets: ["ddp-indigenisation", "srijan-portal", "mod-annual-report", "pib-rss-mod"],
    seriesIds: [],
  },
  {
    id: "idex",
    name: "Innovations for Defence Excellence",
    officialName: null,
    sector: "defence",
    instrument: "innovation-grant",
    authority: "Department of Defence Production / Defence Innovation Organisation",
    claim:
      "Small firms and startups are now building defence capability that used to be imported.",
    reading:
      "The published numbers for this programme are activity measures — challenges launched, startups engaged, grants sanctioned — and activity is not output. The figure that would make it a finding is how many funded prototypes converted into procurement contracts, and its absence from the programme's own reporting is itself worth stating on the page.",
    slots: [
      slot("launched", "Year the programme was launched", "year", YEAR_BAND, ["defence"]),
      slot("grant-ceiling", "Maximum grant to a single winner", "rupees", [100_000, 1000 * CRORE_RUPEES], ["crore"]),
      slot("contracts", "Number of resulting procurement contracts", "count", [0, 10_000], ["contract"]),
    ],
    probeTargets: ["idex-home", "ddp-home", "mod-annual-report", "pib-rss-mod"],
    seriesIds: [],
  },
  {
    id: "defence-offsets",
    name: "Defence offset policy",
    officialName: null,
    sector: "defence",
    instrument: "offset-obligation",
    authority: "Ministry of Defence",
    claim:
      "Foreign suppliers are required to put a share of every large contract back into Indian industry.",
    reading:
      "The instrument with the worst ratio of citation to evidence in Indian defence policy. Obligations contracted and obligations discharged are different numbers and the first is the one quoted; discharge can be satisfied in forms that localise nothing. The policy has also been revised repeatedly, including the removal of the requirement from some categories of purchase, so an entry without a year attached is meaningless.",
    slots: [
      slot("threshold", "Contract value above which offsets apply", "rupees", OUTLAY_BAND, ["crore"]),
      slot("rate", "Share of contract value to be offset", "percent", [0, 100], ["cent"]),
      slot("policy-year", "Year of the version being described", "year", YEAR_BAND, ["offset"]),
    ],
    probeTargets: ["mod-dap", "ddp-home", "cag-reports", "wiki-defence-acquisition-procedure-2020"],
    seriesIds: [],
    note:
      "The CAG has audited offset discharge. That audit, not the policy document, is where a figure for what was actually delivered would come from.",
  },
  {
    id: "dap-2020",
    name: "Defence Acquisition Procedure and its domestic-content categories",
    officialName: null,
    sector: "defence",
    instrument: "procurement",
    authority: "Ministry of Defence",
    claim:
      "Procurement rules now rank an indigenously designed and manufactured bid above an imported one.",
    reading:
      "This is the rule that decides which of the other instruments has anything to bite on, because it defines what counts as indigenous. The number that carries the whole policy is the indigenous-content threshold per category, and it is self-certified — which `INSTRUMENTS` already names as this instrument's characteristic failure mode.",
    slots: [
      slot("year", "Year of the procedure currently in force", "year", YEAR_BAND, ["procedure"]),
      slot("iddm-content", "Minimum indigenous content for the highest-priority category", "percent", [0, 100], ["cent"]),
    ],
    probeTargets: ["mod-dap", "mod-annual-report", "wiki-defence-acquisition-procedure-2020"],
    seriesIds: [],
  },
  {
    id: "defence-capital-earmark",
    name: "Domestic earmark in the defence capital procurement budget",
    officialName: null,
    sector: "defence",
    instrument: "procurement",
    authority: "Ministry of Defence / Ministry of Finance",
    claim:
      "A fixed share of the capital acquisition budget can only be spent with domestic industry.",
    reading:
      "The most quantitatively legible defence measure here, because it is a line in a budget rather than a scheme with a brochure. Two figures are needed and they are usually reported as one: the share earmarked, and the share actually spent domestically. A gap between them is the finding.",
    slots: [
      slot("share", "Share of capital acquisition budget earmarked for domestic procurement", "percent", [0, 100], ["cent"]),
      slot("year", "Financial year the share applies to", "year", YEAR_BAND, ["budget"]),
      slot("amount", "Amount earmarked", "rupees", OUTLAY_BAND, ["crore"]),
    ],
    probeTargets: ["indiabudget", "pib-rss-mod", "mod-annual-report"],
    seriesIds: [],
  },
  {
    id: "defence-fdi-cap",
    name: "Foreign investment limits in defence manufacturing",
    officialName: null,
    sector: "defence",
    instrument: "ownership-rule",
    authority: "Department for Promotion of Industry and Internal Trade",
    claim:
      "Raising the permitted foreign shareholding brought manufacturing and technology into India instead of finished platforms.",
    reading:
      "The cap has been raised more than once and by different routes — automatic up to one level, government approval above it — so the entry needs both numbers and the year. Whether it worked is a question about investment inflows into the sector, which is a separate series this measure should be read against rather than a figure it can carry.",
    slots: [
      slot("automatic", "Foreign shareholding permitted by the automatic route", "percent", [0, 100], ["cent"]),
      slot("year", "Year of the revision being described", "year", YEAR_BAND, ["defence"]),
    ],
    probeTargets: ["dpiit-fdi-policy", "pib-indexd"],
    seriesIds: [],
  },
  {
    id: "corridor-up",
    name: "Uttar Pradesh defence industrial corridor",
    officialName: null,
    sector: "defence",
    instrument: "industrial-corridor",
    authority: "Ministry of Defence / Government of Uttar Pradesh",
    claim:
      "Designated nodes with allotted land and common facilities are building a defence supplier base outside the state-owned firms.",
    reading:
      "This site already carries the numbers that matter for the corridors, and carries them in the form that makes them honest: committed investment against grounded investment, with roughly a seventh of the commitment grounded. This measure does not restate those figures. It records the policy act — the corridor was designated, in a year, with nodes — and points at the series that already hold the money.",
    slots: [
      slot("announced", "Year the corridor was announced", "year", YEAR_BAND, ["corridor"]),
      slot("nodes", "Number of designated nodes", "count", [1, 50], ["node"]),
    ],
    probeTargets: ["upeida-corridor", "ddp-corridors", "pib-indexd"],
    seriesIds: [
      "defence-corridor-committed",
      "defence-corridor-grounded",
      "defence-corridor-nodes",
      "defence-corridor-jobs",
      "defence-corridor-mous",
    ],
    note:
      "Investment figures deliberately absent here. They exist in data/series/defence.json with sources attached, and two copies of a figure is one copy too many.",
  },
  {
    id: "corridor-tn",
    name: "Tamil Nadu defence industrial corridor",
    officialName: null,
    sector: "defence",
    instrument: "industrial-corridor",
    authority: "Ministry of Defence / Government of Tamil Nadu",
    claim:
      "The second corridor anchors a supplier base around the state's existing engineering industry.",
    reading:
      "Read with the same caution as the first: the corridor series on this site are reported as committed against grounded precisely because commitments are what get announced. The corridor-level split between the two states, where a source gives one, is the useful addition this measure can make.",
    slots: [
      slot("announced", "Year the corridor was announced", "year", YEAR_BAND, ["corridor"]),
      slot("nodes", "Number of designated nodes", "count", [1, 50], ["node"]),
    ],
    probeTargets: ["tidco-corridor", "ddp-corridors", "pib-indexd"],
    seriesIds: [
      "defence-corridor-committed",
      "defence-corridor-grounded",
      "defence-corridor-nodes",
    ],
  },
  {
    id: "srijan",
    name: "SRIJAN indigenisation portal",
    officialName: null,
    sector: "defence",
    instrument: "procurement",
    authority: "Department of Defence Production",
    claim:
      "A public portal lists the items the defence manufacturers import so Indian industry can offer to make them.",
    reading:
      "A matchmaking mechanism rather than a mandate, and worth carrying for exactly that reason: it publishes a list of imported items, which is a rare public admission of what is still bought abroad. The useful figures are how many items are listed and how many have actually been indigenised against them — the second being the only one that is an outcome.",
    slots: [
      slot("items", "Number of items displayed for indigenisation", "count", [1, 100_000], ["item"]),
      slot("indigenised", "Number of items reported indigenised through it", "count", [0, 100_000], ["item"]),
    ],
    probeTargets: ["srijan-portal", "ddp-home", "mod-annual-report"],
    seriesIds: [],
  },

  /* ── Solar: the same instrument, a different result ────────────────── */
  {
    id: "pli-solar-modules",
    name: "Production-linked incentive for high-efficiency solar modules",
    officialName: null,
    sector: "solar",
    instrument: "production-subsidy",
    authority: "Ministry of New and Renewable Energy",
    claim: "India stopped importing solar panels and now makes its own.",
    reading:
      "Carried here because it is the control case. The same instrument was applied to solar as to handsets, the localisation dashboard grades the relevant commodity bundle, and the direction is not the one the story predicts. A policy layer that only carried the schemes credited with successes would be an advertisement.",
    slots: [
      slot("notified", "Year the scheme was notified", "year", YEAR_BAND, ["solar"]),
      slot("outlay", "Outlay approved, across tranches", "rupees", OUTLAY_BAND, ["crore"]),
    ],
    probeTargets: ["mnre-schemes", "pib-allrel"],
    seriesIds: [],
  },
  {
    id: "pli-acc-battery",
    name: "Production-linked incentive for advanced chemistry cell batteries",
    officialName: null,
    sector: "electronics",
    instrument: "production-subsidy",
    authority: "Ministry of Heavy Industries",
    claim: "Cell manufacturing will stop the battery import bill growing.",
    reading:
      "Lithium-ion accumulators appear twice on the localisation dashboard — as an input to electronics and in the list of lines where dependence deepened — which is the whole argument for this scheme and the reason to watch whether it changes anything. Filed under electronics because that is where the component sits in the existing sector model.",
    slots: [
      slot("notified", "Year the scheme was notified", "year", YEAR_BAND, ["cell"]),
      slot("outlay", "Outlay approved", "rupees", OUTLAY_BAND, ["crore"]),
      slot("capacity", "Cell capacity in gigawatt hours the scheme contracts for", "count", [1, 1000], ["gigawatt"]),
    ],
    probeTargets: ["heavyindustries-schemes", "pib-allrel"],
    seriesIds: [],
  },
];

/* ────────────────────────────────────────────────────────────────────────
 * Reading the state of it
 * ──────────────────────────────────────────────────────────────────────── */

export interface Verification {
  measureId: string;
  slots: number;
  filled: number;
  /** Computed, never assigned. */
  state: "unverified" | "partly-verified" | "verified";
}

/** Where one measure stands. Derived from the evidence, every time it is asked. */
export function verificationOf(m: Measure): Verification {
  const filled = m.slots.filter((s) => s.filled !== null).length;
  const state =
    filled === 0 ? "unverified" : filled === m.slots.length ? "verified" : "partly-verified";
  return { measureId: m.id, slots: m.slots.length, filled, state };
}

export interface Coverage {
  measures: number;
  unverified: number;
  partlyVerified: number;
  verified: number;
  slots: number;
  slotsFilled: number;
}

/** The state of the whole layer, for the page to print about itself. */
export function coverageOf(ms: Measure[] = MEASURES): Coverage {
  const vs = ms.map(verificationOf);
  return {
    measures: ms.length,
    unverified: vs.filter((v) => v.state === "unverified").length,
    partlyVerified: vs.filter((v) => v.state === "partly-verified").length,
    verified: vs.filter((v) => v.state === "verified").length,
    slots: vs.reduce((a, v) => a + v.slots, 0),
    slotsFilled: vs.reduce((a, v) => a + v.filled, 0),
  };
}

/**
 * Slots that are safe to render, and the guard that makes that true.
 *
 * A page asks for this rather than reading `slot.filled` itself, because data
 * reaching this layer from a JSON file has not been through the compiler and
 * could carry a value with no sentence behind it. That is the one failure this
 * whole file exists to prevent, so it throws rather than filtering quietly: a
 * figure that lost its provenance somewhere in the pipeline is a bug in the
 * pipeline, and silently dropping it would hide the bug.
 */
export function displayableSlots(m: Measure): Array<Slot & { filled: Filled }> {
  const out: Array<Slot & { filled: Filled }> = [];
  for (const s of m.slots) {
    const f = s.filled;
    if (f === null) continue;
    if (!f.sourceUrl?.trim() || !f.quote?.trim()) {
      throw new Error(
        `policy-measures: ${m.id}.${s.id} carries the value ${f.value} with no ` +
        `${!f.sourceUrl?.trim() ? "sourceUrl" : "quote"}. Every figure on this layer must ` +
        "arrive with the sentence that supports it — fix the connector that filled this slot, " +
        "or drop the slot.",
      );
    }
    if (f.value < s.expect[0] || f.value > s.expect[1]) {
      throw new Error(
        `policy-measures: ${m.id}.${s.id} is ${f.value}, outside its plausibility band ` +
        `[${s.expect[0]}, ${s.expect[1]}]. This is what a misread multiplier looks like. ` +
        `The sentence read was: "${f.quote.slice(0, 120)}"`,
      );
    }
    out.push({ ...s, filled: f });
  }
  return out;
}

/**
 * The vocabulary check.
 *
 * Not run at import: a module-level throw in a file the site imports would take
 * the whole build down for a data problem. It is run by `scripts/test-policy.ts`
 * and by any connector before it writes, which is early enough.
 */
export function assertVocabulary(): void {
  const sectorIds = new Set(SECTORS.map((s) => s.id));
  const declared: SectorId[] = [
    "pharmaceuticals", "electronics", "semiconductors", "solar",
    "defence", "toys", "hardware", "energy-dependence",
  ];
  for (const d of declared) {
    if (!sectorIds.has(d)) {
      throw new Error(
        `policy-measures: SectorId declares "${d}" but lib/localisation-sectors.ts has no such ` +
        "sector. The two lists have drifted — remove it here or add it there.",
      );
    }
  }
  for (const s of SECTORS) {
    if (!(declared as string[]).includes(s.id)) {
      throw new Error(
        `policy-measures: lib/localisation-sectors.ts has sector "${s.id}" which SectorId does ` +
        "not declare. Add it to the union so measures can use it.",
      );
    }
  }

  const seen = new Set<string>();
  for (const i of ALL_INSTRUMENTS) {
    if (seen.has(i.id)) {
      throw new Error(
        `policy-measures: instrument id "${i.id}" is declared twice. EXTRA_INSTRUMENTS is meant ` +
        "to extend the five in lib/localisation-sectors.ts, not shadow them.",
      );
    }
    seen.add(i.id);
  }

  for (const m of MEASURES) {
    if (!sectorIds.has(m.sector)) {
      throw new Error(`policy-measures: measure "${m.id}" names sector "${m.sector}", which does not exist.`);
    }
    if (!seen.has(m.instrument)) {
      throw new Error(`policy-measures: measure "${m.id}" names instrument "${m.instrument}", which does not exist.`);
    }
  }
}
