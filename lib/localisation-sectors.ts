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
      { code: "851712", label: "Telephones for cellular networks", expect: /telephone|cellular/i },
      { code: "851713", label: "Smartphones", expect: /smart.?phone|telephone/i, from: 2022 },
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
      { code: "854143", label: "Photovoltaic cells in modules or panels", expect: /photovoltaic/i, from: 2022 },
      { code: "854140", label: "Photosensitive semiconductor devices", expect: /photosensitiv|photovoltaic|light.emitting/i },
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
      { code: "841112", label: "Turbojets over 25kN thrust", expect: /turbojet/i },
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
