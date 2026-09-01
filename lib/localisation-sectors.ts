/**
 * Curated sectors: the stories worth telling, and the codes that tell them.
 *
 * The commodity-line sweep produces thousands of rows and no narrative. This
 * file supplies the narrative half — the handful of sectors where the
 * import-substitution question is actually contested, each pinned to the
 * Harmonised System codes that carry it.
 *
 * ── Every code here is checked against the source's own description ──────
 *
 * A wrong HS code is the single most dangerous error available on this
 * dashboard. It does not crash. It produces a chart with a confident title
 * over somebody else's product, and nothing downstream can tell. So each code
 * carries `expect`, a regex the official commodity description must match, and
 * the ingest fails the code rather than publishing it when it does not. This is
 * the same rule the spreadsheet reader follows for column headers: resolve
 * against what the source says, never against what I remember.
 *
 * ── Inputs are named so assembly cannot hide ─────────────────────────────
 *
 * Where a sector has an upstream, it is listed. The pharmaceutical entry is the
 * clearest case in Indian trade: formulations are a large and growing export
 * while the active ingredients they are made from are heavily imported, and a
 * dashboard that showed only the formulation line would report a triumph that
 * the input line contradicts. The point of listing inputs is to let the
 * contradiction show.
 */

export interface SectorCode {
  /** HS6 code as a string. Leading zeros matter. */
  code: string;
  /** Human label used in the UI. */
  label: string;
  /**
   * What the official description must contain for this code to be believed.
   * Checked at ingest; a mismatch withdraws the code rather than renaming it.
   */
  expect: RegExp;
  /** Set when the code only exists from a given HS revision onward. */
  from?: number;
}

export interface Sector {
  id: string;
  name: string;
  /** The claim in circulation about this sector. */
  claim: string;
  /** What the trade data can and cannot settle about that claim. */
  reading: string;
  /** The finished or headline goods. */
  outputs: SectorCode[];
  /** Upstream lines. Empty where the sector has no meaningful traded input. */
  inputs: SectorCode[];
  /** Ordering on the page: the most-contested stories first. */
  rank: number;
}

export const SECTORS: Sector[] = [
  {
    id: "pharmaceuticals",
    name: "Medicines and their ingredients",
    rank: 1,
    claim:
      "India is the pharmacy of the world — a third of the world's generic pills by volume come from here.",
    reading:
      "The formulation lines support the claim outright: India is a large and growing net exporter of finished medicines. The bulk-drug lines do not. Active ingredients and their key starting materials remain heavily imported, overwhelmingly from one country, which is why this sector is first on the page. Both readings are true at once, and a dashboard showing only the first would be a press release.",
    outputs: [
      { code: "300490", label: "Medicaments, packaged doses", expect: /medicament/i },
      { code: "300420", label: "Medicaments containing antibiotics", expect: /medicament|antibiotic/i },
      { code: "300210", label: "Antisera, vaccines and blood fractions", expect: /antisera|immunolog|blood/i },
    ],
    inputs: [
      { code: "294190", label: "Antibiotics, other", expect: /antibiotic/i },
      { code: "294110", label: "Penicillins and derivatives", expect: /penicillin/i },
      { code: "293629", label: "Vitamins and derivatives", expect: /vitamin/i },
      { code: "292242", label: "Glutamic acid and its salts", expect: /glutamic/i },
    ],
  },
  {
    id: "electronics",
    name: "Phones and what is inside them",
    rank: 2,
    claim:
      "Phones sold in India are made in India, and India now exports them in quantity.",
    reading:
      "The handset line moved further and faster than almost anything else in this dataset. The component lines beneath it — integrated circuits, display modules, batteries — did not move with it, and in several cases moved the other way. That pattern is the assembly signature: it is a real industrial achievement and it is not the same claim as making the phone.",
    outputs: [
      { code: "851712-13-14", label: "Mobile phones (all HS vintages)", expect: /phone/i },
      { code: "847130", label: "Portable computers under 10kg", expect: /portable|automatic data processing/i },
    ],
    inputs: [
      { code: "854231", label: "Processors and controllers", expect: /processor|controller|electronic integrated/i },
      { code: "854232", label: "Memories", expect: /memor|electronic integrated/i },
      { code: "854239", label: "Integrated circuits, other", expect: /electronic integrated|circuit/i },
      { code: "850760", label: "Lithium-ion accumulators", expect: /lithium/i },
      { code: "851770", label: "Parts of telephone sets", expect: /part/i },
    ],
  },
  {
    id: "semiconductors",
    name: "Semiconductors",
    rank: 3,
    claim:
      "India is building its own chips.",
    reading:
      "This is the sector where the gap between announcement and trade data is widest, and the dashboard should not pretend otherwise. Fabrication plants announced in 2023-24 cannot show up in trade data before they produce, and packaging and testing — which is where India's operating capacity actually is — adds value without changing what the finished-chip line does. Watch this sector for the years the lines do not move; that is the honest state of it.",
    outputs: [
      { code: "854231", label: "Processors and controllers", expect: /processor|controller|electronic integrated/i },
      { code: "854233", label: "Amplifiers", expect: /amplifier|electronic integrated/i },
      { code: "854190", label: "Parts of semiconductor devices", expect: /part|semiconductor/i },
    ],
    inputs: [
      { code: "381800", label: "Doped chemical elements for electronics", expect: /doped|electronic/i },
      { code: "280461", label: "Silicon, over 99.99% pure", expect: /silicon/i },
      { code: "848620", label: "Machines for manufacturing semiconductor devices", expect: /semiconductor|machine/i },
    ],
  },
  {
    id: "solar",
    name: "Solar modules",
    rank: 4,
    claim:
      "India stopped importing Chinese solar panels and now makes its own.",
    reading:
      "Module assembly capacity did grow, and a duty wall arrived to protect it. Whether that is substitution depends entirely on the cell and wafer lines underneath: a module assembled from imported cells is a different achievement from a module made from domestic polysilicon. The wafer line is the one to read.",
    outputs: [
      { code: "854140-41-42-43", label: "Photovoltaic cells and modules (all HS vintages)", expect: /photovoltaic|cells/i },
    ],
    inputs: [
      { code: "280461", label: "Silicon, over 99.99% pure", expect: /silicon/i },
      { code: "381800", label: "Doped chemical elements", expect: /doped/i },
    ],
  },
  {
    id: "defence",
    name: "Weapons and platforms",
    rank: 5,
    claim:
      "India was the world's largest arms importer and is now an arms exporter.",
    reading:
      "Both halves are partly true and the trade codes see this sector poorly. Major platform transfers move under government-to-government arrangements that customs data captures inconsistently, and a great deal of defence trade is classified. Treat these lines as a floor on activity, not a measure of it, and read them against SIPRI's transfer estimates elsewhere on this site rather than instead of them.",
    outputs: [
      { code: "930690", label: "Munitions and projectiles", expect: /ammunition|projectil|munition|bomb/i },
      { code: "880240", label: "Aeroplanes over 15,000kg", expect: /aeroplane|aircraft/i },
      { code: "890610", label: "Warships", expect: /warship|vessel/i },
      { code: "871000", label: "Tanks and armoured vehicles", expect: /tank|armoured|armored/i },
    ],
    inputs: [
      { code: "841112", label: "Turbojets over 25kN thrust", expect: /turbo-?jet/i },
      { code: "852610", label: "Radar apparatus", expect: /radar/i },
    ],
  },
  {
    id: "toys",
    name: "Toys",
    rank: 6,
    claim:
      "Quality control orders and import duties turned India from a toy importer into a toy exporter.",
    reading:
      "One of the cleanest test cases on this page, because the policy date is known and the product is simple enough that assembly and manufacture are nearly the same thing. If import substitution works anywhere, it should be legible here.",
    outputs: [
      { code: "950300", label: "Tricycles, dolls and other toys", expect: /toy|doll|tricycle/i, from: 2012 },
      { code: "950450", label: "Video game consoles", expect: /video game|console/i },
    ],
    inputs: [],
  },
  {
    id: "hardware",
    name: "The humble end",
    rank: 7,
    claim:
      "We were importing safety pins. The small stuff is where dependence was most embarrassing.",
    reading:
      "The low-technology lines are worth watching precisely because nobody announces them. There is no ribbon-cutting for a pin factory, so whatever these lines do, they did without a press cycle — which makes them a useful control on the sectors that got one.",
    outputs: [
      { code: "731940", label: "Safety pins and other pins", expect: /pin/i, from: 2012 },
      { code: "961610", label: "Scent sprays and mounts", expect: /scent|spray/i },
      { code: "820551", label: "Household hand tools", expect: /household|hand tool/i },
      { code: "392690", label: "Articles of plastics, other", expect: /plastic/i },
      { code: "691110", label: "Porcelain tableware", expect: /porcelain|china|tableware/i },
    ],
    inputs: [],
  },
  {
    id: "energy-dependence",
    name: "Where dependence deepened",
    rank: 8,
    claim: "Not everything moved the right way.",
    reading:
      "A dashboard that only shows wins is an advertisement. These are the lines where India's dependence grew over the same period, and two of them — crude oil and edible oil — are large enough to shape the trade balance on their own. They are on this page for the same reason the wins are.",
    outputs: [],
    inputs: [
      { code: "270900", label: "Crude petroleum", expect: /petroleum|crude/i },
      { code: "151190", label: "Palm oil and fractions", expect: /palm/i },
      { code: "710812", label: "Gold, unwrought", expect: /gold/i },
      { code: "850760", label: "Lithium-ion accumulators", expect: /lithium/i },
      { code: "310210", label: "Urea", expect: /urea/i },
    ],
  },
];

/** Every distinct HS6 code the curated sectors reference. */
export function curatedCodes(): SectorCode[] {
  const seen = new Map<string, SectorCode>();
  for (const s of SECTORS) {
    for (const c of [...s.outputs, ...s.inputs]) {
      if (!seen.has(c.code)) seen.set(c.code, c);
    }
  }
  return [...seen.values()];
}

/**
 * The instruments.
 *
 * "How did India fix the supply chain" has a real answer, and it is not one
 * thing. Five distinct policy instruments were used, they work by different
 * mechanisms, they fail in different ways, and they leave different fingerprints
 * in trade data. Naming them separately is what makes the sector panels
 * readable: a tariff wall and a production subsidy both raise domestic output,
 * but only one of them also raises domestic prices.
 *
 * ── The status of this list ──────────────────────────────────────────────
 *
 * These are descriptions of instrument *types*, not claims about particular
 * schemes, outlays or outcomes. This pipeline has no machine-readable access to
 * Indian scheme documentation — MoSPI serves a JavaScript shell, and the
 * ministry portals that carry scheme detail were not readable in the source
 * probe — so nothing here carries a scheme name, a rupee figure or a date that
 * would need a primary citation to be trustworthy.
 *
 * The measured half of this page does not depend on any of it. The commodity
 * lines moved or they did not, regardless of which instrument gets the credit,
 * and attributing a movement to an instrument is exactly the step this page
 * declines to take.
 */
export interface Instrument {
  id: string;
  name: string;
  /** How it is supposed to work. */
  mechanism: string;
  /** What it looks like in trade data when it works. */
  fingerprint: string;
  /** The characteristic way it goes wrong. */
  failureMode: string;
}

export const INSTRUMENTS: Instrument[] = [
  {
    id: "tariff",
    name: "Tariff walls",
    mechanism:
      "Raise the landed cost of the imported good until domestic production is competitive at the domestic price.",
    fingerprint:
      "Imports fall sharply within a year or two of the duty change, faster than any plant could have been built. Exports do not move.",
    failureMode:
      "Domestic prices rise to just under the tariff-inclusive import price, and the cost is paid by whoever buys the product downstream. If that downstream is an export industry, the wall protects one line by taxing another.",
  },
  {
    id: "phased-manufacturing",
    name: "Phased manufacturing programmes",
    mechanism:
      "A published schedule of rising duties on successively deeper parts of the assembly — finished goods first, then sub-assemblies, then components — so localisation moves up the chain on a timetable firms can plan against.",
    fingerprint:
      "The finished-good import line falls first; component import lines rise, then fall in turn a few years later. The staircase is the signature.",
    failureMode:
      "The schedule outruns the capability. Duties land on components nobody domestically makes yet, and the assembler pays them without any localisation occurring.",
  },
  {
    id: "production-subsidy",
    name: "Production-linked incentives",
    mechanism:
      "Pay a percentage of incremental output, conditional on hitting investment and turnover thresholds. Unlike a tariff it does not raise the domestic price, so downstream users are not taxed.",
    fingerprint:
      "Exports rise without imports of the finished good falling much, because subsidised capacity is built for world demand rather than to displace imports.",
    failureMode:
      "It buys assembly. Output subsidies reward units shipped, and units can be shipped from imported kits — which is precisely what the input lines on this page are here to check.",
  },
  {
    id: "quality-orders",
    name: "Quality control orders",
    mechanism:
      "Mandate a domestic standard and require certification to sell in India. Not framed as protection, but certification cost and delay fall hardest on small foreign suppliers.",
    fingerprint:
      "Imports drop steeply at a single date with no tariff change to explain it, and the drop is concentrated in low-value shipments.",
    failureMode:
      "It removes the cheap end of the market without replacing it, so the consumer substitutes toward a more expensive domestic good or does without.",
  },
  {
    id: "procurement",
    name: "Public procurement preference",
    mechanism:
      "Require government buyers to prefer suppliers meeting a domestic value-addition threshold. The state is a large enough customer in defence, railways and power to create a market by itself.",
    fingerprint:
      "Weak in customs data, because the substitution happens inside a procurement decision rather than at a border. Defence is the clearest case and the least visible one.",
    failureMode:
      "Value-addition thresholds are self-certified and hard to audit, so the number that matters is the one nobody checks.",
  },
];
