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
];

export const ALL_SECURITY_SPECS: SecuritySeriesSpec[] = [...SECURITY_SERIES, ...DEFENCE_PENDING];

export const SECURITY_BY_ID = new Map(ALL_SECURITY_SPECS.map((s) => [s.id, s]));
