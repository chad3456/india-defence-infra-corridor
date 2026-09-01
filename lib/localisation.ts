/**
 * Import substitution, measured.
 *
 * The claim this dashboard exists to test is the one everybody makes and
 * nobody checks: "we used to import that, now we make it here." It is asserted
 * daily about everything from safety pins to semiconductors, almost always
 * from a press release, and almost never with a number that could come out the
 * other way.
 *
 * ── Why commodity codes and not news ─────────────────────────────────────
 *
 * A news item saying a plant opened is evidence that a plant opened. It is not
 * evidence that the country stopped importing the thing the plant makes, which
 * is the actual claim. Those two come apart constantly: a plant can open and
 * imports can rise, because demand grew faster than the plant.
 *
 * So the unit here is the Harmonised System commodity line, and the evidence
 * is India's own imports and exports of that line over time, which is a number
 * that can refuse to cooperate. Every product on this dashboard is a line that
 * either did or did not move, and the ones that did not are shown too.
 *
 * ── What the measurement can and cannot see ──────────────────────────────
 *
 * The honest ratio for this question is import dependence:
 *
 *     dependence = imports / (domestic production + imports - exports)
 *
 * and it is not computable here, because domestic production is not published
 * at commodity-code level by anybody, for any country. What is computable from
 * trade data alone is the coverage ratio, exports over imports, and the net
 * position. Those are proxies. A rising coverage ratio is consistent with
 * import substitution and also with three other things, which is why
 * `CONFOUNDERS` below is published on the page rather than buried here.
 *
 * The most important of those is assembly. A country that imports components
 * and exports finished goods shows exactly the trade signature of successful
 * localisation, while having localised very little. That is not a hypothetical:
 * it is the honest reading of several of India's headline wins, and the
 * `assemblySignature` check below is what distinguishes them, by asking whether
 * the upstream input lines moved the same way as the finished-good line or the
 * opposite way.
 *
 * A line is never graded by hand. `classifyLine` is deterministic, the
 * thresholds are named constants with reasons attached, and the same inputs
 * give the same stage every time.
 */

/** Where a commodity line sits on the road from bought-in to made-here. */
export type Stage =
  | "reversed"
  | "narrowing"
  | "holding"
  | "import-reliant"
  | "deepening"
  | "thin";

export const STAGES: Array<{
  id: Stage;
  label: string;
  /** What the trade data shows. */
  meaning: string;
  /** What would have to be true for this reading to be wrong. */
  disproof: string;
}> = [
  {
    id: "reversed",
    label: "Reversed",
    meaning:
      "Was a net importer in the opening window and is a sustained net exporter in the closing one. India now sells more of this to the world than it buys.",
    disproof:
      "The exports are assembled from imported inputs, or re-exported without transformation. Check the paired input lines before believing it.",
  },
  {
    id: "narrowing",
    label: "Narrowing",
    meaning:
      "Still a net importer, but exports have grown materially faster than imports. The gap is closing.",
    disproof:
      "Imports stopped growing because domestic demand stopped growing, not because domestic supply arrived.",
  },
  {
    id: "holding",
    label: "Holding",
    meaning:
      "Coverage ratio roughly flat. Domestic capacity is keeping pace with demand but not gaining on it.",
    disproof: "Nothing much — this is the least interesting and most common reading.",
  },
  {
    id: "import-reliant",
    label: "Import-reliant",
    meaning:
      "Persistent net importer with no improvement in coverage. Bought in, still bought in.",
    disproof:
      "A new plant commissioned inside the closing window has not yet shown up in a full year of trade data.",
  },
  {
    id: "deepening",
    label: "Deepening",
    meaning:
      "Imports growing faster than exports. Dependence on this line is increasing, not falling.",
    disproof:
      "The line is an input to something India now exports more of — rising component imports can be the cost of a genuine downstream win.",
  },
  {
    id: "thin",
    label: "Too thin to judge",
    meaning:
      "Trade in this line is too small or too intermittent for a trend to mean anything.",
    disproof: "n/a — this is a refusal to grade, not a grade.",
  },
];

export const STAGE_LABEL: Record<Stage, string> = Object.fromEntries(
  STAGES.map((s) => [s.id, s.label]),
) as Record<Stage, string>;

/**
 * The four ways a trade reversal can be true and mean nothing.
 *
 * Published on the page verbatim. A reader who knows these can look at any row
 * on this dashboard and ask the right question about it, which is the whole
 * point of showing them.
 */
export const CONFOUNDERS: Array<{
  id: string;
  name: string;
  what: string;
  /** Whether this dashboard can detect it, and how. Honesty about our own blind spots. */
  detectable: "yes" | "partly" | "no";
  how: string;
}> = [
  {
    id: "assembly",
    name: "Assembly mistaken for manufacture",
    what:
      "Components are imported, screwed together, and exported as a finished good. The finished-good line reverses beautifully while the value added at home stays small.",
    detectable: "partly",
    how:
      "Where a finished good has known upstream input lines, this dashboard shows them side by side. Inputs deteriorating while the finished good improves is the assembly signature. It cannot measure domestic value added, which is what would settle it.",
  },
  {
    id: "reexport",
    name: "Re-export",
    what:
      "Goods enter and leave without being transformed. Both imports and exports rise together and the coverage ratio improves on arithmetic alone.",
    detectable: "partly",
    how:
      "Lines where imports and exports both grow fast and track each other closely are flagged. Distinguishing genuine two-way trade from entrepot traffic needs customs-level data this project does not have.",
  },
  {
    id: "demand",
    name: "Demand collapse",
    what:
      "Imports fell because the country stopped buying the thing, not because it started making it. Coverage improves while domestic production is flat or falling.",
    detectable: "partly",
    how:
      "Lines where imports fell in absolute terms and exports did not rise are flagged rather than credited. A falling numerator and a falling denominator are not an achievement.",
  },
  {
    id: "reclassification",
    name: "Code reclassification",
    what:
      "The Harmonised System is revised every five years and codes are split, merged and retired. A line whose meaning changed produces a break that looks exactly like a structural shift.",
    detectable: "yes",
    how:
      "Revision years are known and marked. A stage change that lands on a revision boundary is downgraded rather than reported, because the code and its history may not be the same product.",
  },
];

/**
 * HS revision years. Codes are redrawn in these years, so a discontinuity here
 * is a suspect rather than a finding.
 *
 * Comtrade reports each year under the classification in force, so a series
 * spanning a revision is not guaranteed to be a series about one product.
 */
export const HS_REVISIONS = [2002, 2007, 2012, 2017, 2022] as const;

export function nearRevision(year: number, slack = 1): boolean {
  return HS_REVISIONS.some((r) => Math.abs(r - year) <= slack);
}

/** One year of trade for one commodity line. USD, as reported. */
export interface TradeYear {
  year: number;
  /** Imports, USD. */
  m: number;
  /** Exports, USD. */
  x: number;
}

export interface LocalisationLine {
  /** HS6 code, as a string — leading zeros are meaningful. */
  code: string;
  description: string;
  /** HS2 chapter, for grouping. */
  chapter: string;
  years: TradeYear[];
}

/**
 * Thresholds, each with the reason it is where it is.
 *
 * These are the only judgement calls in the classification, so they are
 * constants with names rather than magic numbers inline, and the page states
 * them. Moving one moves every row, which is the point of having them here.
 */
export const RULES = {
  /**
   * Below this, a line's trade is too small for a ratio to be stable. A line
   * going from $40k to $900k of exports is a 22x improvement and means nothing.
   */
  minTradeUsd: 5_000_000,
  /** Years needed at each end to call a level "sustained" rather than a spike. */
  windowYears: 3,
  /**
   * Coverage ratio change needed to call it narrowing. 1.5x is large enough
   * that ordinary price and exchange-rate noise does not produce it.
   */
  narrowingFactor: 1.5,
  /** Below this the line is deepening rather than merely flat. */
  deepeningFactor: 0.67,
  /** Coverage at or above this is net-exporting. */
  netExportCoverage: 1.0,
} as const;

function mean(ns: number[]): number {
  if (ns.length === 0) return 0;
  return ns.reduce((a, b) => a + b, 0) / ns.length;
}

/** Exports over imports. Infinity is a real answer: exports with no imports. */
export function coverage(m: number, x: number): number {
  if (m <= 0) return x > 0 ? Number.POSITIVE_INFINITY : 0;
  return x / m;
}

export interface LineVerdict {
  stage: Stage;
  /** Mean imports/exports across the opening and closing windows, USD. */
  openM: number;
  openX: number;
  closeM: number;
  closeX: number;
  openCoverage: number;
  closeCoverage: number;
  /** Multiple by which coverage improved. */
  coverageShift: number;
  /** Confounder ids that fire on this line. */
  flags: string[];
  /** Years actually used, so a reader can see what window produced the verdict. */
  openYears: number[];
  closeYears: number[];
}

/**
 * Grade one commodity line.
 *
 * Compares a window at the start of the record against a window at the end,
 * rather than fitting a trend, because the claim being tested is a
 * before-and-after claim and a regression slope would let a single good year
 * at the end carry a line that never actually changed.
 */
export function classifyLine(line: LocalisationLine): LineVerdict {
  const ys = [...line.years].sort((a, b) => a.year - b.year);
  const w = RULES.windowYears;
  const empty: LineVerdict = {
    stage: "thin", openM: 0, openX: 0, closeM: 0, closeX: 0,
    openCoverage: 0, closeCoverage: 0, coverageShift: 1, flags: [],
    openYears: [], closeYears: [],
  };
  if (ys.length < w * 2) return empty;

  const open = ys.slice(0, w);
  const close = ys.slice(-w);
  const openM = mean(open.map((y) => y.m));
  const openX = mean(open.map((y) => y.x));
  const closeM = mean(close.map((y) => y.m));
  const closeX = mean(close.map((y) => y.x));

  const base = {
    openM, openX, closeM, closeX,
    openCoverage: coverage(openM, openX),
    closeCoverage: coverage(closeM, closeX),
    openYears: open.map((y) => y.year),
    closeYears: close.map((y) => y.year),
  };

  // Too small at both ends to say anything. Checked on the larger of the two
  // sides so a line that grew from nothing into real trade still qualifies.
  if (Math.max(openM + openX, closeM + closeX) < RULES.minTradeUsd) {
    return { ...empty, ...base, stage: "thin" };
  }

  const oc = base.openCoverage;
  const cc = base.closeCoverage;
  // Infinities do not divide usefully; fall back to a large finite shift.
  const shift = oc === 0 ? (cc > 0 ? Number.POSITIVE_INFINITY : 1) : cc / oc;

  const flags: string[] = [];
  // Demand collapse: imports fell hard and exports did not pick up the slack.
  if (closeM < openM * 0.7 && closeX <= openX * 1.1) flags.push("demand");
  // Re-export signature: both sides grew fast and stayed proportional.
  if (closeM > openM * 1.5 && closeX > openX * 1.5 && Math.abs(shift - 1) < 0.25) {
    flags.push("reexport");
  }

  let stage: Stage;
  if (oc < RULES.netExportCoverage && cc >= RULES.netExportCoverage) stage = "reversed";
  else if (shift >= RULES.narrowingFactor) stage = "narrowing";
  else if (shift <= RULES.deepeningFactor) stage = "deepening";
  else if (cc < RULES.netExportCoverage) stage = "import-reliant";
  else stage = "holding";

  // A reversal that rests on collapsing imports is not a reversal.
  if (stage === "reversed" && flags.includes("demand")) stage = "holding";

  return { ...base, stage, coverageShift: shift, flags };
}

/**
 * The assembly test.
 *
 * Given a finished-good line and the input lines that feed it, ask whether the
 * inputs moved with the finished good or against it. Inputs deepening while
 * the finished good reverses is the signature of an assembly industry, and
 * saying so is the difference between this dashboard and a press release.
 *
 * Returns null when there are no input lines to check, which is most of them —
 * an unknown is reported as unknown.
 */
export function assemblySignature(
  finished: LineVerdict,
  inputs: LineVerdict[],
): { verdict: "assembly-signature" | "integrated" | "mixed"; inputsDeepening: number; inputsTotal: number } | null {
  const usable = inputs.filter((i) => i.stage !== "thin");
  if (usable.length === 0) return null;
  const deepening = usable.filter((i) => i.stage === "deepening" || i.stage === "import-reliant").length;
  const improved = finished.stage === "reversed" || finished.stage === "narrowing";
  const share = deepening / usable.length;
  let verdict: "assembly-signature" | "integrated" | "mixed";
  if (improved && share >= 0.6) verdict = "assembly-signature";
  else if (improved && share <= 0.25) verdict = "integrated";
  else verdict = "mixed";
  return { verdict, inputsDeepening: deepening, inputsTotal: usable.length };
}
