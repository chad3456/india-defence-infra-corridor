/**
 * Internal security series, and where each one comes from.
 *
 * Declared here so the gallery shows the full intended surface from the first
 * deploy, each chart marked pending until the connector fills it — the same
 * arrangement the World Bank catalogue uses. A chart that says "awaiting data"
 * is honest; an empty axis pretending to be a finding is not.
 *
 * Two theatres are tracked separately and never summed. Left-wing extremism and
 * jihadist terrorism are different conflicts with different adversaries,
 * different geography and different reporting regimes, and a combined "India
 * violence" line would hide the fact that one has collapsed while the other has
 * not.
 */
import type { Category, Confidence, Frequency, Provenance } from "./types";

export interface SecuritySeriesSpec {
  id: string;
  title: string;
  definition: string;
  category: Category;
  unit: string;
  unitShort: string;
  higherIsBetter: boolean | null;
  frequency: Frequency;
  provenance: Provenance;
  confidence: Confidence;
  /** Source ids in `data/sources.json` this series must cite. */
  sourceIds: string[];
  note?: string;
  /** Which connector fills it, so a permanently empty chart can be traced. */
  filledBy: "satp" | "curated";
}

/** First year on the site. Everything security-side runs 2004 onward. */
export const SECURITY_START_YEAR = 2004;

/**
 * The SATP fatality datasheets are the spine. They are a compilation rather
 * than a register — SATP reads the same press and parliamentary answers
 * everyone else does — so nothing here is graded above medium confidence, and
 * the datasheet is cross-read against MHA answers where those exist.
 */
export const SECURITY_SERIES: SecuritySeriesSpec[] = [
  /* ---------------- Left-wing extremism ---------------- */
  {
    id: "lwe-civilians-killed",
    title: "Civilians killed — left-wing extremism",
    definition:
      "Civilians killed in incidents attributed to Maoist/Naxalite groups, by calendar year.",
    category: "security",
    unit: "deaths",
    unitShort: "deaths",
    higherIsBetter: false,
    frequency: "annual",
    provenance: "think-tank",
    confidence: "medium",
    sourceIds: ["satp-lwe-fatalities"],
    filledBy: "satp",
    note: "Civilian deaths are the figure the state has least incentive to overstate and the one most sensitive to who is counted as a civilian.",
  },
  {
    id: "lwe-security-forces-killed",
    title: "Security force personnel killed — left-wing extremism",
    definition:
      "Central and state security force personnel killed in Maoist-attributed incidents, by calendar year.",
    category: "security",
    unit: "deaths",
    unitShort: "deaths",
    higherIsBetter: false,
    frequency: "annual",
    provenance: "think-tank",
    confidence: "medium",
    sourceIds: ["satp-lwe-fatalities"],
    filledBy: "satp",
  },
  {
    id: "lwe-insurgents-killed",
    title: "Maoist cadre killed",
    definition:
      "Maoist cadre killed in security operations, by calendar year. Official usage calls these neutralisations.",
    category: "security",
    unit: "deaths",
    unitShort: "deaths",
    higherIsBetter: null,
    frequency: "annual",
    provenance: "think-tank",
    confidence: "medium",
    sourceIds: ["satp-lwe-fatalities"],
    filledBy: "satp",
    note: "Where an encounter is disputed, this count inherits the dispute. Read it as the state's tally, not as an agreed number.",
  },
  {
    id: "lwe-total-fatalities",
    title: "Total fatalities — left-wing extremism",
    definition: "All deaths in Maoist-attributed violence: civilians, security forces and cadre.",
    category: "security",
    unit: "deaths",
    unitShort: "deaths",
    higherIsBetter: false,
    frequency: "annual",
    provenance: "think-tank",
    confidence: "medium",
    sourceIds: ["satp-lwe-fatalities"],
    filledBy: "satp",
  },
  {
    id: "lwe-tonality",
    title: "Tonality Score — left-wing extremism",
    definition:
      "Constructed index of state posture, −100 (accommodative) to +100 (security-first), computed from published fatality counts across five dimensions.",
    category: "security",
    unit: "index (−100 to +100)",
    unitShort: "score",
    higherIsBetter: null,
    frequency: "annual",
    provenance: "derived",
    confidence: "low",
    sourceIds: ["satp-lwe-fatalities", "derived"],
    filledBy: "satp",
    note: "Author-constructed. Every input is published, but the choice of dimensions and neutral points is a judgement — see the methodology page before using this for anything.",
  },
  {
    id: "lwe-action-index",
    title: "Action Index — left-wing extremism",
    definition:
      "Constructed performance index, −1.6 to +1.6. Rises with neutralisations, arrests and surrenders; falls with civilian deaths and incident volume.",
    category: "security",
    unit: "index (−1.6 to +1.6)",
    unitShort: "index",
    higherIsBetter: true,
    frequency: "annual",
    provenance: "derived",
    confidence: "low",
    sourceIds: ["satp-lwe-fatalities", "derived"],
    filledBy: "satp",
    note: "Author-constructed, and measured against the series' own average rather than an absolute bar — a year scores well by beating this conflict's recent record, not a fixed standard. Arrests and surrenders are unevenly reported, so that component is often zero.",
  },

  /* ---------------- Terrorism ---------------- */
  {
    id: "terror-civilians-killed",
    title: "Civilians killed — terrorism",
    definition:
      "Civilians killed in terrorism-attributed incidents in Jammu & Kashmir and the rest of India, by calendar year.",
    category: "security",
    unit: "deaths",
    unitShort: "deaths",
    higherIsBetter: false,
    frequency: "annual",
    provenance: "think-tank",
    confidence: "medium",
    sourceIds: ["satp-jk-fatalities"],
    filledBy: "satp",
  },
  {
    id: "terror-security-forces-killed",
    title: "Security force personnel killed — terrorism",
    definition: "Security force personnel killed in terrorism-attributed incidents, by calendar year.",
    category: "security",
    unit: "deaths",
    unitShort: "deaths",
    higherIsBetter: false,
    frequency: "annual",
    provenance: "think-tank",
    confidence: "medium",
    sourceIds: ["satp-jk-fatalities"],
    filledBy: "satp",
  },
  {
    id: "terror-militants-killed",
    title: "Militants killed — terrorism",
    definition: "Militants killed in counter-terrorism operations, by calendar year.",
    category: "security",
    unit: "deaths",
    unitShort: "deaths",
    higherIsBetter: null,
    frequency: "annual",
    provenance: "think-tank",
    confidence: "medium",
    sourceIds: ["satp-jk-fatalities"],
    filledBy: "satp",
  },
  {
    id: "terror-total-fatalities",
    title: "Total fatalities — terrorism",
    definition: "All deaths in terrorism-attributed violence: civilians, security forces and militants.",
    category: "security",
    unit: "deaths",
    unitShort: "deaths",
    higherIsBetter: false,
    frequency: "annual",
    provenance: "think-tank",
    confidence: "medium",
    sourceIds: ["satp-jk-fatalities"],
    filledBy: "satp",
  },
  {
    id: "terror-tonality",
    title: "Tonality Score — terrorism",
    definition:
      "Constructed index of state posture against terrorism, −100 to +100, on the same five dimensions as the left-wing extremism score.",
    category: "security",
    unit: "index (−100 to +100)",
    unitShort: "score",
    higherIsBetter: null,
    frequency: "annual",
    provenance: "derived",
    confidence: "low",
    sourceIds: ["satp-jk-fatalities", "derived"],
    filledBy: "satp",
    note: "Author-constructed on the same basis as the LWE score, and carrying the same caveats.",
  },
  {
    id: "terror-action-index",
    title: "Action Index — terrorism",
    definition: "Constructed performance index against terrorism, −1.6 to +1.6.",
    category: "security",
    unit: "index (−1.6 to +1.6)",
    unitShort: "index",
    higherIsBetter: true,
    frequency: "annual",
    provenance: "derived",
    confidence: "low",
    sourceIds: ["satp-jk-fatalities", "derived"],
    filledBy: "satp",
    note: "Author-constructed on the same basis as the left-wing extremism index, and carrying the same caveats.",
  },
];

/**
 * Series that need a document read by a person, not a page fetched by a script.
 *
 * Squadron strength comes from parliamentary answers and IISS Military Balance;
 * platform inductions from MoD contract announcements. Both are declared here
 * so the charts exist and say what they are waiting for, rather than being
 * quietly absent. They stay pending until each year's figure is entered against
 * a citation — which is the same bar every other number on this site clears.
 */
export const DEFENCE_PENDING: SecuritySeriesSpec[] = [
  {
    id: "iaf-fighter-squadrons",
    title: "IAF fighter squadron strength",
    definition:
      "Combat squadrons held against the sanctioned strength of 42, by year.",
    category: "defence",
    unit: "squadrons",
    unitShort: "sqn",
    higherIsBetter: true,
    frequency: "point-in-time",
    provenance: "official",
    confidence: "medium",
    sourceIds: [],
    filledBy: "curated",
    note: "Awaiting entry from Lok Sabha and Rajya Sabha answers, cross-read against IISS Military Balance. The gap against 42 is the fact this chart exists to show.",
  },
  {
    id: "iaf-squadrons-sanctioned",
    title: "IAF sanctioned squadron strength",
    definition: "Government-sanctioned combat squadron establishment.",
    category: "defence",
    unit: "squadrons",
    unitShort: "sqn",
    higherIsBetter: null,
    frequency: "point-in-time",
    provenance: "official",
    confidence: "high",
    sourceIds: [],
    filledBy: "curated",
    note: "Awaiting the citation for the sanctioned figure. It is a flat line for most of the period, and it is what the held strength is short against.",
  },
  {
    id: "advanced-platform-inductions",
    title: "Advanced platform inductions",
    definition:
      "Combat aircraft and major systems inducted per year under signed contracts — Rafale, Su-30MKI, Tejas, S-400 and successors.",
    category: "defence",
    unit: "units",
    unitShort: "units",
    higherIsBetter: true,
    frequency: "annual",
    provenance: "official",
    confidence: "medium",
    sourceIds: [],
    filledBy: "curated",
    note: "Awaiting entry from MoD contract announcements and PIB releases, one citation per year.",
  },
  {
    id: "terror-attacks",
    title: "Terrorist attacks",
    definition: "Terrorism-attributed incidents recorded in a calendar year, all theatres.",
    category: "security",
    unit: "incidents",
    unitShort: "incidents",
    higherIsBetter: false,
    frequency: "annual",
    provenance: "official",
    confidence: "medium",
    sourceIds: [],
    filledBy: "curated",
    note: "Awaiting MHA annual report and parliamentary answer figures. SATP publishes deaths, not an incident count, so this cannot come from the datasheet the fatality series use.",
  },
  {
    id: "lwe-attacks",
    title: "Left-wing extremist attacks",
    definition: "Maoist-attributed violent incidents recorded in a calendar year.",
    category: "security",
    unit: "incidents",
    unitShort: "incidents",
    higherIsBetter: false,
    frequency: "annual",
    provenance: "official",
    confidence: "medium",
    sourceIds: [],
    filledBy: "curated",
    note: "Awaiting MHA annual report figures. This is the series the Action Index's incident-volume component needs; without it that component scores zero.",
  },
  {
    id: "lwe-affected-districts",
    title: "LWE-affected districts",
    definition:
      "Districts the Ministry of Home Affairs classifies as affected by left-wing extremism, by year.",
    category: "security",
    unit: "districts",
    unitShort: "districts",
    higherIsBetter: false,
    frequency: "point-in-time",
    provenance: "official",
    confidence: "medium",
    sourceIds: [],
    filledBy: "curated",
    note: "The red-corridor series, and the spine of the map. MHA revises both the count and the classification criteria, so a fall partly reflects redefinition as well as control — the criteria change has to be annotated per revision or the chart overstates the win.",
  },
  {
    id: "lwe-most-affected-districts",
    title: "Most-affected LWE districts",
    definition: "The subset MHA classifies as most affected, drawing focused central funding.",
    category: "security",
    unit: "districts",
    unitShort: "districts",
    higherIsBetter: false,
    frequency: "point-in-time",
    provenance: "official",
    confidence: "medium",
    sourceIds: [],
    filledBy: "curated",
    note: "Awaiting MHA figures. Tracked separately from the headline count because the two move differently and the headline is the one usually quoted.",
  },
  {
    id: "jk-tourist-arrivals",
    title: "Tourist arrivals in Jammu & Kashmir",
    definition: "Tourists visiting Jammu & Kashmir in a calendar year, official count.",
    category: "security",
    unit: "visitors",
    unitShort: "visitors",
    higherIsBetter: true,
    frequency: "annual",
    provenance: "official",
    confidence: "medium",
    sourceIds: [],
    filledBy: "curated",
    note: "Awaiting J&K Tourism Department and PIB figures. Read alongside the fatality series rather than as a proxy for it: arrivals include the Amarnath and Vaishno Devi pilgrimages, which move on their own logic, and the official count has changed basis at least once.",
  },
  {
    id: "jk-stone-pelting-incidents",
    title: "Stone-pelting incidents in Jammu & Kashmir",
    definition: "Stone-pelting incidents recorded by security forces in a calendar year.",
    category: "security",
    unit: "incidents",
    unitShort: "incidents",
    higherIsBetter: false,
    frequency: "annual",
    provenance: "official",
    confidence: "medium",
    sourceIds: [],
    filledBy: "curated",
    note: "Awaiting MHA parliamentary answers, which are the only regular published source. What counts as an incident is a police classification and has never been defined publicly, so year-to-year comparability is weaker than the series looks.",
  },
  {
    id: "communal-riots",
    title: "Communal incidents",
    definition: "Communal or religious rioting incidents recorded in a calendar year.",
    category: "security",
    unit: "incidents",
    unitShort: "incidents",
    higherIsBetter: false,
    frequency: "annual",
    provenance: "official",
    confidence: "medium",
    sourceIds: [],
    filledBy: "curated",
    note: "Awaiting MHA and NCRB figures, which disagree with each other because they count different things — MHA counts communal incidents reported by states, NCRB counts registered cases under rioting sections. Both series need publishing separately rather than blended.",
  },
  {
    id: "protests-recorded",
    title: "Protests and agitations",
    definition: "Protests, demonstrations and agitations recorded in a calendar year.",
    category: "security",
    unit: "incidents",
    unitShort: "incidents",
    higherIsBetter: null,
    frequency: "annual",
    provenance: "official",
    confidence: "low",
    sourceIds: [],
    filledBy: "curated",
    note: "Awaiting a source that publishes this consistently, and there may not be one. Protest counts are a measure of what police recorded, not of what happened, and the direction of good is contested — a fall can mean contentment or suppression. Graded low confidence and marked with no better direction for that reason.",
  },
  {
    id: "bulletproof-jackets-produced",
    title: "Bulletproof jackets produced",
    definition: "Domestically manufactured bulletproof jackets delivered to the armed forces and central police, by year.",
    category: "defence",
    unit: "units",
    unitShort: "units",
    higherIsBetter: true,
    frequency: "annual",
    provenance: "official",
    confidence: "medium",
    sourceIds: [],
    filledBy: "curated",
    note: "Awaiting MoD and PIB figures. India moved from importing jackets to exporting them within a decade, which is the clearest single case of the import-substitution story working.",
  },
  {
    id: "arms-imports-by-supplier",
    title: "Arms imports by supplier country",
    definition:
      "Share of India's major conventional arms imports by supplying country, in SIPRI trend-indicator values.",
    category: "defence",
    unit: "% of imports",
    unitShort: "%",
    higherIsBetter: null,
    frequency: "annual",
    provenance: "think-tank",
    confidence: "medium",
    sourceIds: ["sipri-at-2024"],
    filledBy: "curated",
    note: "SIPRI trend-indicator values measure military capability transferred, not money paid. They are the standard for comparing suppliers over time and they are not import bills — treating them as spending is the most common misreading of this dataset.",
  },
];

export const ALL_SECURITY_SPECS: SecuritySeriesSpec[] = [...SECURITY_SERIES, ...DEFENCE_PENDING];

export const SECURITY_BY_ID = new Map(ALL_SECURITY_SPECS.map((s) => [s.id, s]));
