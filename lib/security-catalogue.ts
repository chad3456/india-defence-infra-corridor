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
  /**
   * Why this series is still empty, and what has already been ruled out.
   *
   * "Awaiting a sourced figure" was the annotation on every pending chart, and
   * it says nothing a reader can act on or check. These fields name the
   * document that would fill the series and the routes the source probe has
   * already tried and found closed, so an empty chart is a specific request
   * rather than a shrug. Where the honest answer is that nobody publishes the
   * number, that is stated too — a question with no answer is worth showing.
   */
  blockedBy?: {
    /** The document or dataset that would fill it. */
    needs: string;
    /** Routes already attempted, with what came back. */
    ruledOut?: string[];
  };
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

  /* ---------------- Punjab / Khalistan ---------------- */

  {
    id: "punjab-civilians-killed",
    title: "Civilians killed — Punjab",
    definition:
      "Civilians killed in Khalistan-attributed incidents in Punjab, by calendar year.",
    category: "security",
    unit: "deaths",
    unitShort: "deaths",
    higherIsBetter: false,
    frequency: "annual",
    provenance: "think-tank",
    confidence: "medium",
    sourceIds: ["satp-punjab-fatalities"],
    filledBy: "satp",
    note: "SATP's Punjab table begins in 2000, roughly a decade after the insurgency it belongs to had ended. The peak — the early and mid-1980s through 1993, with fatalities in the thousands each year — is on SATP's page only as a single 1981-2000 aggregate with no annual rows, so it is outside this series entirely. Read a flat line near zero as the aftermath of a conflict that was over, not as evidence there was never one.",
  },
  {
    id: "punjab-security-forces-killed",
    title: "Security force personnel killed — Punjab",
    definition:
      "Police and central armed police personnel killed in Khalistan-attributed incidents in Punjab, by calendar year.",
    category: "security",
    unit: "deaths",
    unitShort: "deaths",
    higherIsBetter: false,
    frequency: "annual",
    provenance: "think-tank",
    confidence: "medium",
    sourceIds: ["satp-punjab-fatalities"],
    filledBy: "satp",
    note: "SATP's Punjab table begins in 2000, roughly a decade after the insurgency it belongs to had ended. The peak — the early and mid-1980s through 1993, with fatalities in the thousands each year — is on SATP's page only as a single 1981-2000 aggregate with no annual rows, so it is outside this series entirely. Read a flat line near zero as the aftermath of a conflict that was over, not as evidence there was never one.",
  },
  {
    id: "punjab-militants-killed",
    title: "Militants killed — Punjab",
    definition:
      "People recorded by SATP as Khalistani militants killed in Punjab, by calendar year.",
    category: "security",
    unit: "deaths",
    unitShort: "deaths",
    higherIsBetter: null,
    frequency: "annual",
    provenance: "think-tank",
    confidence: "medium",
    sourceIds: ["satp-punjab-fatalities"],
    filledBy: "satp",
    note: "SATP's Punjab table begins in 2000, roughly a decade after the insurgency it belongs to had ended. The peak — the early and mid-1980s through 1993, with fatalities in the thousands each year — is on SATP's page only as a single 1981-2000 aggregate with no annual rows, so it is outside this series entirely. Read a flat line near zero as the aftermath of a conflict that was over, not as evidence there was never one. Identification is made at the scene and is the most contested figure in any SATP sheet; read it as 'recorded as', not 'were'. The direction of good is left unset here for the same reason it is unset on every other side-of-conflict count on this site.",
  },
  {
    id: "punjab-total-fatalities",
    title: "Total fatalities — Punjab",
    definition:
      "All deaths SATP records in Khalistan-attributed violence in Punjab, including those it does not attribute to a side.",
    category: "security",
    unit: "deaths",
    unitShort: "deaths",
    higherIsBetter: false,
    frequency: "annual",
    provenance: "think-tank",
    confidence: "medium",
    sourceIds: ["satp-punjab-fatalities"],
    filledBy: "satp",
    note: "SATP's Punjab table begins in 2000, roughly a decade after the insurgency it belongs to had ended. The peak — the early and mid-1980s through 1993, with fatalities in the thousands each year — is on SATP's page only as a single 1981-2000 aggregate with no annual rows, so it is outside this series entirely. Read a flat line near zero as the aftermath of a conflict that was over, not as evidence there was never one.",
  },
  {
    id: "punjab-attacks",
    title: "Incidents of killing — Punjab",
    definition:
      "Incidents in Punjab in which somebody was killed, as SATP records them.",
    category: "security",
    unit: "incidents",
    unitShort: "incidents",
    higherIsBetter: false,
    frequency: "annual",
    provenance: "think-tank",
    confidence: "medium",
    sourceIds: ["satp-punjab-fatalities"],
    filledBy: "satp",
    note: "SATP's Punjab table begins in 2000, roughly a decade after the insurgency it belongs to had ended. The peak — the early and mid-1980s through 1993, with fatalities in the thousands each year — is on SATP's page only as a single 1981-2000 aggregate with no annual rows, so it is outside this series entirely. Read a flat line near zero as the aftermath of a conflict that was over, not as evidence there was never one. Incidents, not attacks: an attack in which nobody died does not appear, so this tracks lethality rather than the volume of violence.",
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
    blockedBy: {
      needs: "The Standing Committee on Defence reports a squadron count most years, and the Ministry answers it in the Lok Sabha. Both are prose in a PDF, not a table.",
      ruledOut: [
        "sansad.in question search returns only a manifest file, not the answers themselves",
        "no ministry release publishes the series as a table",
      ],
    },
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
    blockedBy: {
      needs: "The sanctioned strength of 42 squadrons is quoted constantly and dated rarely. Filling this needs the parliamentary answers that state when it was set and whether it has been revised.",
      ruledOut: [
        "repeating the figure of 42 across every year would be an assumption, not a series",
      ],
    },
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
    blockedBy: {
      needs: "Induction dates for each platform, from Ministry of Defence releases. Every induction is announced; nobody publishes the list as one table.",
      ruledOut: [
        "PIB's release index returns no linked data files",
      ],
    },
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
    provenance: "think-tank",
    confidence: "medium",
    sourceIds: ["satp-jk-fatalities"],
    filledBy: "satp",
    note: "SATP counts incidents of killing: incidents in which someone died, not all attacks. An attack with no fatality is not counted, so this understates activity and is not comparable with MHA incident totals.",
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
    provenance: "think-tank",
    confidence: "medium",
    sourceIds: ["satp-lwe-fatalities"],
    filledBy: "satp",
    note: "SATP counts incidents of killing: incidents in which someone died, not all attacks. It is what the Action Index incident-volume component reads, and it understates activity against MHA broader incident counts.",
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
    blockedBy: {
      needs: "The district count is announced in Home Ministry releases and revised periodically, but is not published as a series.",
      ruledOut: [
        "PIB release index has no downloadable table",
        "SATP's datasheets carry fatalities and incidents, not district classifications",
      ],
    },
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
    blockedBy: {
      needs: "The 'most affected' subset is a separate Home Ministry classification with its own revisions, quoted in releases rather than tabulated.",
      ruledOut: [
        "same as the affected-district count: announced, never tabulated",
      ],
    },
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
    blockedBy: {
      needs: "The Jammu & Kashmir tourism department publishes annual arrivals, and the union territory's own economic survey carries the series.",
      ruledOut: [
        "the national Economic Survey workbooks carry domestic tourist visits by state only for recent years, and not the J&K pilgrim split",
      ],
    },
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
    blockedBy: {
      needs: "Home Ministry answers in Parliament are the only public source, and they are given for selected years in response to specific questions.",
      ruledOut: [
        "no ministry publication carries a continuous series",
        "SATP does not track this category",
      ],
    },
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
    blockedBy: {
      needs: "Two bodies publish and they count different objects: the Home Ministry counts incidents states report, the National Crime Records Bureau counts registered cases. Filling this means picking one and labelling it as that one.",
      ruledOut: [
        "NCRB publishes annual volumes as PDFs with no machine-readable table",
        "the two series are not reconcilable — see the evidence page",
      ],
    },
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
    blockedBy: {
      needs: "No national count of protests and agitations is published on a consistent basis. The nearest figures come from Home Ministry answers about specific years or specific movements.",
      ruledOut: [
        "there is no continuous public series to fetch; this may stay empty",
      ],
    },
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
    blockedBy: {
      needs: "Ministry of Defence and PIB releases give production and procurement figures for particular years, usually in the context of an order.",
      ruledOut: [
        "no ordnance-factory or DPSU publication carries an annual series",
      ],
    },
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
    blockedBy: {
      needs: "SIPRI's arms transfers database holds this and exports it, but only through a query interface rather than a fixed file.",
      ruledOut: [
        "sipri.org/databases/armstransfers links no downloadable dataset",
        "the shares already on this site come from SIPRI's published fact sheets, which give totals rather than a supplier breakdown by year",
      ],
    },
  },
  /* ---------------- Crime, from NCRB ---------------- */
  //
  // Declared and empty, with four documented attempts behind each. NCRB's own
  // host returned HTTP 503 to www.ncrb.gov.in, the bare host, the Crime in
  // India landing page and the tables page, on two separate probe runs. A 503
  // repeated across four paths is a host refusing, not a hiccup.
  //
  // These stay declared because the questions are worth asking and because a
  // reader deserves to know the number exists and is not reachable, rather than
  // finding a gallery that looks complete.
  {
    id: "pocso-cases",
    title: "POCSO cases registered",
    definition:
      "Cases registered under the Protection of Children from Sexual Offences Act, by state and year.",
    category: "security",
    unit: "cases",
    unitShort: "cases",
    higherIsBetter: null,
    frequency: "annual",
    provenance: "official",
    confidence: "medium",
    sourceIds: [],
    filledBy: "curated",
    note: "Registered cases, not incidents. A rise can mean more offending, better reporting, or both, and the two are not separable from this series alone — which is why the direction of good is left unset rather than assumed to be downward.",
    blockedBy: {
      needs: "NCRB's Crime in India volume for each year, which carries POCSO registrations by state in its own table.",
      ruledOut: [
        "www.ncrb.gov.in returned HTTP 503 on two separate probe runs",
        "the bare host ncrb.gov.in, the Crime in India landing page and the tables page all returned 503 as well",
        "no mirror publishes the state tables in a machine-readable form",
      ],
    },
  },
  {
    id: "murder-victims-by-sex",
    title: "Murder victims by sex",
    definition: "Victims of murder recorded by NCRB, split by sex, by state and year.",
    category: "security",
    unit: "victims",
    unitShort: "victims",
    higherIsBetter: false,
    frequency: "annual",
    provenance: "official",
    confidence: "medium",
    sourceIds: [],
    filledBy: "curated",
    note: "Victims, not cases: one case can have several victims, and the two counts are published separately and quoted interchangeably.",
    blockedBy: {
      needs: "NCRB's Crime in India victim tables, which carry murder victims by sex and state.",
      ruledOut: [
        "every NCRB path probed returned HTTP 503",
        "the World Bank carries an intentional-homicide rate for India but no sex split and no state detail",
      ],
    },
  },

  /* ---------------- Mental health ---------------- */
  {
    id: "mental-health-prevalence",
    title: "Mental illness prevalence by age group",
    definition:
      "Share of the population living with a diagnosable mental illness, by age band.",
    category: "quality-of-life",
    unit: "% of age group",
    unitShort: "%",
    higherIsBetter: false,
    frequency: "point-in-time",
    provenance: "official",
    confidence: "low",
    sourceIds: [],
    filledBy: "curated",
    note: "If this fills, it will be a single year rather than a series, and it should be drawn as an age profile rather than a trend. The National Mental Health Survey of 2015-16 is the only national study with an age breakdown, and a decade-old point estimate repeated across years would be an invented trend.",
    blockedBy: {
      needs: "The National Mental Health Survey age-band prevalence tables, or a successor survey.",
      ruledOut: [
        "nimhans.ac.in failed at DNS on two probe runs",
        "the NFHS factsheet host answered 404 and the IIPS page 404 as well",
        "WHO's observatory carries suicide mortality, which is a different claim from prevalence of illness and is declared separately rather than relabelled",
      ],
    },
  },
];

export const ALL_SECURITY_SPECS: SecuritySeriesSpec[] = [...SECURITY_SERIES, ...DEFENCE_PENDING];

export const SECURITY_BY_ID = new Map(ALL_SECURITY_SPECS.map((s) => [s.id, s]));
