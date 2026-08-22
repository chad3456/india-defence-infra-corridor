/**
 * The evidence ladder: how well we know each number, as distinct from what the
 * number says.
 *
 * Every other page on this site asks what happened. This one asks a prior
 * question — what kind of thing is this figure, and what would it take for a
 * reader to check it. That question has an answer for every series here,
 * because provenance, confidence and source tier were recorded from the start.
 *
 * ── Two channels, deliberately not merged ────────────────────────────────
 *
 * A rung says what kind of claim the number is: a record somebody keeps, a
 * compilation somebody assembled, an estimate somebody judged, a construction
 * computed here, or nothing at all. Confidence says how sure we are of this
 * particular instance.
 *
 * They are not the same axis and collapsing them loses the interesting cases.
 * VAHAN electric-vehicle registrations are a *record* — the register is the
 * fact — carried at medium confidence because two states do not report into
 * it. SIPRI's transfer values are a careful, well-documented *estimate* that no
 * amount of care converts into a record. A single "quality score" would rank
 * those two against each other and say nothing true.
 *
 * ── Nothing is graded by hand ────────────────────────────────────────────
 *
 * `RULES` below is an ordered list, first match wins, and it is published
 * verbatim on the page. A reader with the series metadata can re-run the
 * classification and get the same answer. That is the same discipline the
 * Tonality Score and the development matrix follow: a grade assigned by the
 * author is an opinion wearing a measurement's clothes.
 *
 * The one substantive judgement is encoded in rule 5, and it is stated rather
 * than hidden: a multilateral body is never the record holder for a national
 * statistic. The World Bank does not count India's electricity connections;
 * India does, and the Bank republishes it. However authoritative the Bank is,
 * the figure is a compilation, and the consequence — that most of the data on
 * this site is compilation rather than record — is the headline finding of
 * this page rather than an embarrassment to be smoothed over.
 */
import type { Series, Source, Category, Confidence } from "./types";
import { definedPoints, periodYear } from "./data";

export type Rung = "record" | "compilation" | "estimate" | "construction" | "unmeasured";

/** Strongest evidence first. Index is the ordinal position on the ramp. */
export const RUNGS: Array<{
  id: Rung;
  label: string;
  short: string;
  /** What kind of claim this is. */
  meaning: string;
  /** What a member of the public can actually do to check a number on this rung. */
  citizenCheck: string;
}> = [
  {
    id: "record",
    label: "Record",
    short: "record",
    meaning:
      "The publisher is the body that creates the fact by recording it. NPCI processes the UPI transactions it counts; VAHAN is the register a vehicle is entered into. There is no gap between the event and the number.",
    citizenCheck:
      "Open the publisher's own release and read the figure. If it is wrong, the body that got it wrong is the body that holds the record, and an RTI request goes to a named office.",
  },
  {
    id: "compilation",
    label: "Compilation",
    short: "compiled",
    meaning:
      "Assembled from records the compiler does not hold. Multilateral datasets, ministry summaries of state returns, and press-report tallies all sit here. The compiler's judgement enters at the point where sources disagree or are missing.",
    citizenCheck:
      "Two checks are needed, not one: the compiler's published figure, and the underlying record it claims to summarise. Where they differ, the compiler's method note says which it preferred — and often it does not say.",
  },
  {
    id: "estimate",
    label: "Estimate",
    short: "estimated",
    meaning:
      "Nobody can count it directly, so an expert body judges it from indirect evidence. SIPRI's transfer values and warhead counts are the clearest cases. A good estimate is careful, documented and revisable; it is not a record and no amount of authority makes it one.",
    citizenCheck:
      "Read the method, not the number. The honest ones publish their assumptions and revise openly — a series that never revises is a warning, not a reassurance.",
  },
  {
    id: "construction",
    label: "Construction",
    short: "constructed",
    meaning:
      "Computed here from other series. Every index and derived rate on this site. A construction inherits the weakness of its worst input and adds the author's choices on top of it, so it sits below the material it is built from.",
    citizenCheck:
      "The formula is published in full on the methodology page, and the inputs are all on this site. A construction whose formula is not published is not checkable at all.",
  },
  {
    id: "unmeasured",
    label: "Unmeasured",
    short: "unmeasured",
    meaning:
      "Declared because the question is worth asking, and empty because no source publishes it in a form that can be read. These are not omissions — they are shown so the shape of the gap is visible.",
    citizenCheck:
      "Nothing, directly. The route is a parliamentary question or an RTI to the ministry that would hold it, and the answer is often that the figure is not maintained centrally.",
  },
];

export const RUNG_INDEX: Record<Rung, number> = {
  record: 0,
  compilation: 1,
  estimate: 2,
  construction: 3,
  unmeasured: 4,
};

export const RUNG_BY_ID = new Map(RUNGS.map((r) => [r.id, r]));

/**
 * The classifier, as an ordered list. First match wins.
 *
 * Published on the page in this order and in these words, so the grading is
 * reproducible by a reader rather than taken on trust.
 */
export const RULES: Array<{ n: number; test: string; rung: Rung }> = [
  { n: 1, test: "The series carries no value at all.", rung: "unmeasured" },
  { n: 2, test: "Provenance is derived — the number was computed on this site.", rung: "construction" },
  { n: 3, test: "Provenance is think-tank — an expert body's judgement.", rung: "estimate" },
  { n: 4, test: "Provenance is press — reported, with no primary document located.", rung: "estimate" },
  {
    n: 5,
    test: "Provenance is multilateral — a cross-country body republishing national statistics it does not collect.",
    rung: "compilation",
  },
  {
    n: 6,
    test: "Provenance is official and every source behind it is tier 1, the record holder for that quantity.",
    rung: "record",
  },
  { n: 7, test: "Anything else official — a summary, a return, a secondary release.", rung: "compilation" },
];

/**
 * The highest (worst) tier among the sources actually used, series-level and
 * point-level alike.
 *
 * Worst rather than best on purpose. A series is only a record if every figure
 * in it came from a record holder; one press-sourced point in twenty makes the
 * whole series something a reader has to check in two places.
 */
export function worstTier(series: Series, sources: Map<string, Source>): 1 | 2 | 3 | null {
  const ids = new Set<string>(series.sourceIds);
  for (const p of series.points) if (p.sourceId) ids.add(p.sourceId);
  const tiers = [...ids].map((id) => sources.get(id)?.tier).filter((t): t is 1 | 2 | 3 => Boolean(t));
  if (tiers.length === 0) return null;
  return Math.max(...tiers) as 1 | 2 | 3;
}

export function classify(series: Series, sources: Map<string, Source>): { rung: Rung; ruleN: number } {
  if (definedPoints(series).length === 0) return { rung: "unmeasured", ruleN: 1 };
  if (series.provenance === "derived") return { rung: "construction", ruleN: 2 };
  if (series.provenance === "think-tank") return { rung: "estimate", ruleN: 3 };
  if (series.provenance === "press") return { rung: "estimate", ruleN: 4 };
  if (series.provenance === "multilateral") return { rung: "compilation", ruleN: 5 };
  if (worstTier(series, sources) === 1) return { rung: "record", ruleN: 6 };
  return { rung: "compilation", ruleN: 7 };
}

/* ------------------------------------------------------------------ */
/* Gaps inside a series                                               */
/* ------------------------------------------------------------------ */

export interface Graded {
  seriesId: string;
  title: string;
  category: Category;
  rung: Rung;
  ruleN: number;
  confidence: Confidence;
  worstTier: 1 | 2 | 3 | null;
  sourceCount: number;
  /** Years covered, first to latest, where the series is temporal. */
  span: [number, number] | null;
  /** Years inside the span with no value. A hole, not an edge. */
  holes: number;
  /** Years between the latest value and today. */
  staleYears: number | null;
  /** True when a caveat is published with the series. */
  hasNotes: boolean;
}

const THIS_YEAR = new Date().getUTCFullYear();

export function grade(series: Series, sources: Map<string, Source>): Graded {
  const { rung, ruleN } = classify(series, sources);
  const years = series.points
    .map((p) => ({ y: periodYear(p.period), v: p.value }))
    .filter((p): p is { y: number; v: number | null } => p.y !== null);
  const withValue = years.filter((p) => p.v !== null).map((p) => p.y);

  let span: [number, number] | null = null;
  let holes = 0;
  let staleYears: number | null = null;
  if (withValue.length >= 2) {
    const lo = Math.min(...withValue);
    const hi = Math.max(...withValue);
    span = [lo, hi];
    // Holes count missing years strictly inside the covered span. A series that
    // simply has not started yet is not a series with a hole in it.
    const present = new Set(withValue);
    for (let y = lo; y <= hi; y++) if (!present.has(y)) holes++;
    staleYears = THIS_YEAR - hi;
  }

  const ids = new Set<string>(series.sourceIds);
  for (const p of series.points) if (p.sourceId) ids.add(p.sourceId);

  return {
    seriesId: series.id,
    title: series.title,
    category: series.category,
    rung,
    ruleN,
    confidence: series.confidence,
    worstTier: worstTier(series, sources),
    sourceCount: ids.size,
    span,
    holes,
    staleYears,
    hasNotes: Boolean(series.notes?.length),
  };
}

export interface EvidenceMap {
  graded: Graded[];
  byRung: Record<Rung, Graded[]>;
  /** Rung × confidence, for the cross-tabulation. */
  crossTab: Record<Rung, Record<Confidence, number>>;
  byCategory: Array<{ category: Category; counts: Record<Rung, number>; total: number }>;
  totals: {
    series: number;
    /** Series that a reader could check against a single primary document. */
    checkableInOnePlace: number;
    withHoles: number;
    staleOverTwoYears: number;
    lowConfidenceWithoutNote: number;
  };
}

export function buildEvidenceMap(all: Series[], sourceList: Source[]): EvidenceMap {
  const sources = new Map(sourceList.map((s) => [s.id, s]));
  const graded = all.map((s) => grade(s, sources));

  const byRung = {
    record: [] as Graded[],
    compilation: [] as Graded[],
    estimate: [] as Graded[],
    construction: [] as Graded[],
    unmeasured: [] as Graded[],
  };
  const crossTab = Object.fromEntries(
    RUNGS.map((r) => [r.id, { high: 0, medium: 0, low: 0 }]),
  ) as Record<Rung, Record<Confidence, number>>;

  const cats = new Map<Category, Record<Rung, number>>();
  for (const g of graded) {
    byRung[g.rung].push(g);
    const row = crossTab[g.rung];
    row[g.confidence]++;
    let c = cats.get(g.category);
    if (!c) {
      c = { record: 0, compilation: 0, estimate: 0, construction: 0, unmeasured: 0 };
      cats.set(g.category, c);
    }
    c[g.rung]++;
  }

  for (const r of RUNGS) {
    byRung[r.id].sort((a, b) => a.title.localeCompare(b.title));
  }

  const byCategory = [...cats.entries()]
    .map(([category, counts]) => ({
      category,
      counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total);

  return {
    graded,
    byRung,
    crossTab,
    byCategory,
    totals: {
      series: graded.length,
      checkableInOnePlace: graded.filter((g) => g.rung === "record" && g.sourceCount === 1).length,
      withHoles: graded.filter((g) => g.holes > 0).length,
      staleOverTwoYears: graded.filter((g) => (g.staleYears ?? 0) > 2).length,
      lowConfidenceWithoutNote: graded.filter((g) => g.confidence === "low" && !g.hasNotes).length,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Discontinuities inside a single source                             */
/* ------------------------------------------------------------------ */

/**
 * SATP records a "Not Specified" column for deaths it cannot attribute to
 * civilians, security forces or insurgents. Summing the eighteen state sheets
 * this project already holds shows that column running at 1–8 per cent of
 * fatalities through 2010, collapsing to near nothing after it, and reading
 * exactly zero in every year of an unbroken run at the end of the series.
 *
 * The shape is deliberately reported in three parts rather than as a single
 * break year. A first pass here described a clean cutover at 2011 and it was
 * wrong: two small residuals survive, in 2012 and 2014, and the unbroken run of
 * zeros starts later than the collapse does. The dates below are therefore
 * computed from the rows and the prose on the page reads them out, so the claim
 * cannot drift away from the arithmetic again.
 *
 * Two readings fit the shape and this project cannot tell which is right:
 * attribution genuinely became complete, or the category fell out of use and
 * every death is now assigned somewhere. The second reading matters, because it
 * would mean the later civilian and insurgent splits carry a precision the
 * earlier ones never claimed — a change of method in the middle of a chart that
 * looks continuous.
 */
export interface AttributionYear {
  year: number;
  unattributed: number;
  total: number;
  share: number;
}

export function attributionSeries(
  rows: Array<{ year: number; civilians: number; securityForces: number; insurgents: number; notSpecified: number }>,
): AttributionYear[] {
  const by = new Map<number, { ns: number; tot: number }>();
  for (const r of rows) {
    const acc = by.get(r.year) ?? { ns: 0, tot: 0 };
    acc.ns += r.notSpecified ?? 0;
    acc.tot += (r.civilians ?? 0) + (r.securityForces ?? 0) + (r.insurgents ?? 0) + (r.notSpecified ?? 0);
    by.set(r.year, acc);
  }
  return [...by.entries()]
    .map(([year, a]) => ({
      year,
      unattributed: a.ns,
      total: a.tot,
      share: a.tot === 0 ? 0 : a.ns / a.tot,
    }))
    .sort((a, b) => a.year - b.year);
}

export interface AttributionShape {
  /** Last year of the unbroken opening run in which the column was populated every year. */
  lastConsecutiveYear: number | null;
  /** Length of that opening run, in years. */
  consecutiveYears: number;
  /** Years after that run which still carry a value, with their counts. */
  residuals: Array<{ year: number; unattributed: number }>;
  /** First year of the unbroken run of zeros that ends the series. */
  firstZeroRunYear: number | null;
  /** Highest share the column ever reached. */
  peakShare: number;
}

/**
 * Describe the shape of the column's use without a threshold.
 *
 * An earlier version called any year above one per cent "material", which put
 * the collapse at 2014 — four deaths in a year whose total had fallen ninefold
 * — and hid the thing actually worth seeing. Share is the wrong instrument
 * here precisely because the denominator moved so much.
 *
 * So this reports structure instead: the column was populated in every year of
 * an unbroken opening run, in a handful of scattered years after it, and in
 * none at all from some year onward. Those three facts need no cutoff, and a
 * reader can check each of them against the bars.
 */
export function attributionShape(rows: AttributionYear[]): AttributionShape {
  let end = -1;
  while (end + 1 < rows.length && (rows[end + 1]?.unattributed ?? 0) > 0) end++;
  const lastConsecutiveYear = end >= 0 ? (rows[end]?.year ?? null) : null;

  let firstZeroRunYear: number | null = null;
  for (let i = 0; i < rows.length; i++) {
    if (rows.slice(i).every((r) => r.unattributed === 0)) {
      firstZeroRunYear = rows[i]?.year ?? null;
      break;
    }
  }

  return {
    lastConsecutiveYear,
    consecutiveYears: end + 1,
    residuals: rows
      .slice(end + 1)
      .filter((r) => r.unattributed > 0)
      .map((r) => ({ year: r.year, unattributed: r.unattributed })),
    firstZeroRunYear,
    peakShare: Math.max(0, ...rows.map((r) => r.share)),
  };
}

/* ------------------------------------------------------------------ */
/* Where sources disagree                                             */
/* ------------------------------------------------------------------ */

/**
 * These are declared, not computed, and the distinction is stated on the page.
 *
 * A disagreement between two publishers is a claim about the world, and this
 * project holds both sides of exactly one of them. Listing the rest anyway is
 * deliberate: which numbers cannot be reconciled — and why — is more useful to
 * a reader than a page that shows only the figures that happen to agree.
 *
 * Every entry names what would settle it, and none quotes a figure this
 * project has not read. Where only one side is held, it says so.
 */
export type ContestNature = "unit" | "coverage" | "definition" | "method-break";

export const CONTEST_NATURE: Record<ContestNature, string> = {
  unit: "The two bodies count different things and call them the same name. Neither is wrong and the figures cannot be reconciled by arithmetic.",
  coverage: "The same method applied to different extents of the same population.",
  definition: "The same word carries a different threshold or boundary at each publisher.",
  "method-break": "One publisher's own method changed mid-series, so the disagreement is with its earlier self.",
};

export interface Contest {
  id: string;
  claim: string;
  nature: ContestNature;
  sides: string[];
  /** What this repository actually holds — one side, both, or neither. */
  weHold: "both" | "one" | "neither";
  detail: string;
  settledBy: string;
}

export const CONTESTS: Contest[] = [
  {
    id: "lwe-national-vs-states",
    claim: "Total left-wing-extremism fatalities in a year",
    nature: "coverage",
    sides: ["SATP national datasheet", "SATP's own eighteen state datasheets, summed"],
    weHold: "both",
    detail:
      "The same compiler publishes both, and they do not match. Summing the state sheets came within half a per cent of the national page on the years that could be read, and matched exactly on two. The residual is consistent with incidents SATP records nationally without assigning to a state. This site publishes the state sum, because the national page refuses the pipeline, and says so on every chart built from it.",
    settledBy:
      "SATP publishing the count of nationally-recorded incidents it does not attribute to a state. It does not currently do so.",
  },
  {
    id: "lwe-attribution-break",
    claim: "How many LWE deaths cannot be attributed to a side",
    nature: "method-break",
    sides: ["SATP through 2010", "SATP after the collapse"],
    weHold: "both",
    detail:
      "The 'Not Specified' column runs at up to eight per cent of fatalities through 2010, drops to a handful of deaths a year after it, and then reads exactly zero for an unbroken run to the end of the series. Either attribution became complete or the category fell out of use. This site cannot tell which, and the civilian and insurgent splits either side of that collapse are therefore not strictly comparable. The exact dates are computed from the stored rows and shown on the evidence page rather than asserted here.",
    settledBy: "A method note from SATP on when and why the category stopped being populated.",
  },
  {
    id: "fatalities-satp-vs-mha",
    claim: "Deaths in insurgency-related violence",
    nature: "definition",
    sides: ["SATP", "Ministry of Home Affairs annual report and Lok Sabha answers"],
    weHold: "one",
    detail:
      "SATP compiles calendar-year counts from press reporting; MHA reports what states return to it, sometimes by financial year, and classifies an incident by the case registered rather than by the reporting of it. The two therefore diverge in both level and timing, and a chart mixing them would be a chart of two different quantities. This site holds SATP and does not splice MHA figures onto it.",
    settledBy:
      "Nothing available to a member of the public reconciles them. Both series are legitimate; using either requires naming which.",
  },
  {
    id: "communal-mha-vs-ncrb",
    claim: "Communal incidents in a year",
    nature: "unit",
    sides: ["Ministry of Home Affairs", "National Crime Records Bureau"],
    weHold: "neither",
    detail:
      "NCRB's unit is a registered case — an FIR under specific sections — while MHA's is an incident reported by a state government. One communal incident can produce several FIRs, or none. The two series are routinely quoted against each other as though one contradicts the other; they cannot, because they do not count the same object. This site declares the series and leaves it empty rather than picking a side.",
    settledBy:
      "Publication of the mapping between reported incidents and registered cases. Neither body publishes it.",
  },
  {
    id: "arms-tiv-vs-contract",
    claim: "The scale of arms transfers to India",
    nature: "unit",
    sides: ["SIPRI trend-indicator values", "Contract values reported in the press"],
    weHold: "one",
    detail:
      "SIPRI's trend-indicator value measures military capability transferred, on a fixed scale designed for comparison across decades. It is not money and was never intended to be. Contract values are money, include support and offsets, and are reported at signature rather than delivery. Quoting a TIV figure in rupees or dollars is the single most common misreading of this dataset, and it is common in Indian reporting.",
    settledBy:
      "Nothing — they answer different questions. The error is in treating one as the other, not in either number.",
  },
];

/* ------------------------------------------------------------------ */
/* Declared but empty                                                 */
/* ------------------------------------------------------------------ */

/**
 * A catalogue entry with no series behind it.
 *
 * These are counted on the ladder rather than left off it. A page that graded
 * only the numbers it holds would score itself on a sample it chose, and the
 * shape of what is missing is the part a reader cannot reconstruct from the
 * charts. Every one of them is a question this project decided was worth asking
 * and could not answer.
 */
export function gradeDeclared(spec: {
  id: string;
  title: string;
  category: Category;
  confidence: Confidence;
  note?: string;
}): Graded {
  return {
    seriesId: spec.id,
    title: spec.title,
    category: spec.category,
    rung: "unmeasured",
    ruleN: 1,
    confidence: spec.confidence,
    worstTier: null,
    sourceCount: 0,
    span: null,
    holes: 0,
    staleYears: null,
    hasNotes: Boolean(spec.note),
  };
}

/** Fold declared-but-empty specs into a built map, keeping every total right. */
export function withDeclared(map: EvidenceMap, declared: Graded[]): EvidenceMap {
  const graded = [...map.graded, ...declared];
  const byRung = { ...map.byRung, unmeasured: [...map.byRung.unmeasured, ...declared] };
  byRung.unmeasured.sort((a, b) => a.title.localeCompare(b.title));

  const crossTab = Object.fromEntries(
    RUNGS.map((r) => [r.id, { ...map.crossTab[r.id] }]),
  ) as Record<Rung, Record<Confidence, number>>;
  for (const d of declared) crossTab.unmeasured[d.confidence]++;

  const cats = new Map(map.byCategory.map((c) => [c.category, { ...c.counts }]));
  for (const d of declared) {
    const c = cats.get(d.category) ?? {
      record: 0,
      compilation: 0,
      estimate: 0,
      construction: 0,
      unmeasured: 0,
    };
    c.unmeasured++;
    cats.set(d.category, c);
  }
  const byCategory = [...cats.entries()]
    .map(([category, counts]) => ({
      category,
      counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total);

  return {
    graded,
    byRung,
    crossTab,
    byCategory,
    totals: { ...map.totals, series: graded.length },
  };
}
