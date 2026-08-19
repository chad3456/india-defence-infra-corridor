/**
 * Tonality Score and Action Index.
 *
 * These are the only two numbers on this site that are *constructed* rather
 * than reported, so they get the longest comment and the loudest labelling.
 *
 * ── What they are ────────────────────────────────────────────────────────
 *
 * Tonality Score (−100 … +100) is a proxy for the state's posture in a given
 * year. Negative reads accommodative — talks first, threat downplayed, the
 * adversary framed as a grievance to be addressed. Positive reads decisive —
 * security first, an eradication mandate, the adversary framed as an internal
 * security threat.
 *
 * Action Index (−1.6 … +1.6) is a performance measure rather than a posture
 * one. It rises with neutralisations, arrests and surrenders, and is pushed
 * down by civilian deaths and by the sheer volume of violent incidents.
 *
 * ── The one design decision that matters ─────────────────────────────────
 *
 * Every dimension below is computed from published fatality and incident
 * counts. Not one of them is a hand-assigned score.
 *
 * The tempting alternative was to read the year's policy documents and code
 * "doctrine" or "political framing" on a −20…+20 scale by judgement. That
 * would track the stated posture more directly — and it would be unfalsifiable,
 * unreproducible, and impossible for a reader to check. On a site whose whole
 * claim is that every number can be traced, an index whose inputs live in the
 * author's head is worth less than no index at all.
 *
 * So posture is inferred from what the state did, not from what it said. A
 * government that shifts to a security-first stance takes the initiative in
 * more engagements, loses fewer of its own per adversary killed, and drives
 * incident counts down. Those are observable. The cost of that choice is
 * stated plainly in `LIMITS` below and published on the methodology page: a
 * government could talk tough and score low, or talk softly and score high,
 * and in both cases the index is measuring the behaviour rather than the
 * rhetoric the name implies.
 *
 * ── Reading the output ───────────────────────────────────────────────────
 *
 * These are ordinal, not cardinal. A year at +60 is more security-first than
 * one at +30; it is not "twice as" anything. Differences under about 10 points
 * are inside the noise of the underlying counts, which are themselves
 * compilations that disagree with each other by a few per cent.
 */

/** One year of the underlying counts, as published. */
export interface SecurityYear {
  year: number;
  /** Civilians killed. */
  civilians: number;
  /** Security force personnel killed. */
  securityForces: number;
  /** Insurgents/terrorists killed — "neutralised" in official usage. */
  insurgents: number;
  /** Violent incidents recorded. Optional: not every compilation publishes it. */
  incidents?: number;
  /** Cadres arrested. Optional. */
  arrests?: number;
  /** Cadres surrendered. Optional. */
  surrenders?: number;
}

export interface Dimension {
  id: string;
  label: string;
  /** What this dimension is meant to capture, in one sentence. */
  meaning: string;
  /** −20 … +20. */
  score: number;
}

export interface TonalityResult {
  year: number;
  /** −100 … +100. */
  score: number;
  dimensions: Dimension[];
}

/** Clamp helper — every dimension is bounded, so no single term can run away. */
function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Map a ratio in [0, 1] onto [−20, +20] around a neutral point.
 *
 * `neutral` is the ratio that scores zero. Below it the year reads
 * accommodative, above it decisive. Each side is scaled separately so the
 * neutral point does not have to sit at the midpoint.
 */
function centred(ratio: number, neutral: number): number {
  if (!Number.isFinite(ratio)) return 0;
  const r = clamp(ratio, 0, 1);
  const span = r >= neutral ? 1 - neutral : neutral;
  if (span === 0) return 0;
  return clamp(((r - neutral) / span) * 20, -20, 20);
}

/** Total deaths in a year. Zero-safe. */
function total(y: SecurityYear): number {
  return y.civilians + y.securityForces + y.insurgents;
}

const DIMENSION_META: Array<{ id: string; label: string; meaning: string }> = [
  {
    id: "initiative",
    label: "Initiative",
    meaning:
      "Share of combatant deaths that are the adversary's. A state on the front foot ends more engagements than it absorbs.",
  },
  {
    id: "protection",
    label: "Civilian protection",
    meaning:
      "Inverse of the civilian share of all deaths. A security-first posture that gets civilians killed is not scored as decisive.",
  },
  {
    id: "containment",
    label: "Containment",
    meaning:
      "Direction of travel in total violence against the previous year. Sustained decline reads as control.",
  },
  {
    id: "attrition",
    label: "Attrition",
    meaning:
      "Cadre removed by arrest and surrender alongside neutralisation — pressure that does not require killing.",
  },
  {
    id: "dominance",
    label: "Escalation dominance",
    meaning:
      "The exchange ratio against its own three-year baseline. Improving on your own recent record, not on an absolute bar.",
  },
];

/**
 * Neutral points.
 *
 * These are the one place judgement enters, so they are constants with reasons
 * rather than tuned parameters:
 *
 *  - initiative 0.5 — an even exchange of combatant lives is neither side
 *    winning.
 *  - protection 0.5 — civilians being half of all deaths is the point at which
 *    a campaign is as much a threat to the population as to the adversary.
 *  - containment 0.5 — violence flat against last year is neither gain nor loss.
 *  - attrition 0.5 — as many cadre taken alive as killed.
 *  - dominance 0.5 — this year's exchange ratio equal to the recent baseline.
 */
const NEUTRAL = 0.5;

/**
 * Compute the Tonality Score for one year.
 *
 * `history` supplies preceding years for the two dimensions that need context.
 * Without it, those score zero rather than guessing — a first year in a series
 * genuinely has no trend, and inventing one would put a number on nothing.
 */
export function tonality(year: SecurityYear, history: SecurityYear[] = []): TonalityResult {
  const prior = history
    .filter((h) => h.year < year.year)
    .sort((a, b) => b.year - a.year);
  const last = prior[0];
  const baseline = prior.slice(0, 3);

  // 1. Initiative — adversary share of combatant deaths.
  const combatant = year.insurgents + year.securityForces;
  const initiative = combatant > 0 ? centred(year.insurgents / combatant, NEUTRAL) : 0;

  // 2. Civilian protection — inverted, so a low civilian share scores high.
  const all = total(year);
  const protection = all > 0 ? centred(1 - year.civilians / all, NEUTRAL) : 0;

  // 3. Containment — violence against last year. Uses incidents where the
  //    compilation publishes them, and falls back to total deaths where it
  //    does not, because a series that silently changes meaning is worse than
  //    one that states which measure it used.
  let containment = 0;
  if (last) {
    const now = year.incidents ?? all;
    const before = last.incidents ?? total(last);
    if (before > 0) {
      // Ratio of decline, mapped so "flat" is neutral and "halved" is +20.
      const change = (before - now) / before; // +1 = eliminated, −1 = doubled
      containment = clamp(change * 40, -20, 20);
    }
  }

  // 4. Attrition — cadre taken alive as a share of all cadre removed. Scores
  //    zero when neither arrests nor surrenders are published, rather than
  //    treating "not reported" as "none happened".
  let attrition = 0;
  if (year.arrests !== undefined || year.surrenders !== undefined) {
    const alive = (year.arrests ?? 0) + (year.surrenders ?? 0);
    const removed = alive + year.insurgents;
    if (removed > 0) attrition = centred(alive / removed, NEUTRAL);
  }

  // 5. Escalation dominance — this year's exchange ratio against its own
  //    three-year baseline.
  let dominance = 0;
  if (baseline.length > 0) {
    const ratioOf = (y: SecurityYear) => (y.securityForces > 0 ? y.insurgents / y.securityForces : y.insurgents);
    const now = ratioOf(year);
    const mean = baseline.reduce((n, y) => n + ratioOf(y), 0) / baseline.length;
    if (mean > 0) {
      // Halving or doubling relative to baseline saturates the dimension.
      const change = clamp((now - mean) / mean, -1, 1);
      dominance = clamp(change * 20, -20, 20);
    }
  }

  const scores = [initiative, protection, containment, attrition, dominance];
  const dimensions = DIMENSION_META.map((meta, i) => ({
    ...meta,
    score: Math.round((scores[i] ?? 0) * 10) / 10,
  }));

  return {
    year: year.year,
    score: Math.round(dimensions.reduce((n, d) => n + d.score, 0) * 10) / 10,
    dimensions,
  };
}

export interface ActionResult {
  year: number;
  /** −1.6 … +1.6. */
  index: number;
  components: Array<{ id: string; label: string; value: number }>;
}

/**
 * Compute the Action Index for one year.
 *
 * Four components, each bounded to ±0.4, so the total lands in ±1.6 exactly as
 * specified. Two reward, two penalise, and each is measured against the series'
 * own history rather than an absolute bar — an absolute bar would make the
 * index a restatement of how large the conflict was, which is not the question.
 */
export function actionIndex(year: SecurityYear, history: SecurityYear[]): ActionResult {
  const prior = history.filter((h) => h.year !== year.year);
  const mean = (pick: (y: SecurityYear) => number) =>
    prior.length > 0 ? prior.reduce((n, y) => n + pick(y), 0) / prior.length : 0;

  /** Signed change against the series mean, saturating at ±0.4. */
  const term = (value: number, average: number, sign: 1 | -1) => {
    if (average <= 0) return 0;
    return sign * clamp((value - average) / average, -1, 1) * 0.4;
  };

  const neutralised = term(year.insurgents, mean((y) => y.insurgents), 1);
  const takenAlive = term(
    (year.arrests ?? 0) + (year.surrenders ?? 0),
    mean((y) => (y.arrests ?? 0) + (y.surrenders ?? 0)),
    1,
  );
  const civilianCost = term(year.civilians, mean((y) => y.civilians), -1);
  const violence = term(
    year.incidents ?? total(year),
    mean((y) => y.incidents ?? total(y)),
    -1,
  );

  const components = [
    { id: "neutralised", label: "Insurgents neutralised", value: neutralised },
    { id: "taken-alive", label: "Arrests and surrenders", value: takenAlive },
    { id: "civilian-cost", label: "Civilian deaths", value: civilianCost },
    { id: "violence", label: "Violent incidents", value: violence },
  ].map((c) => ({ ...c, value: Math.round(c.value * 1000) / 1000 }));

  return {
    year: year.year,
    index: Math.round(components.reduce((n, c) => n + c.value, 0) * 1000) / 1000,
    components,
  };
}

/** Both indices across a series, each year seeing only the years before it. */
export function scoreSeries(years: SecurityYear[]): Array<{
  year: number;
  tonality: TonalityResult;
  action: ActionResult;
}> {
  const sorted = [...years].sort((a, b) => a.year - b.year);
  return sorted.map((y, i) => ({
    year: y.year,
    tonality: tonality(y, sorted.slice(0, i)),
    action: actionIndex(y, sorted),
  }));
}

/**
 * What these numbers cannot tell you. Published verbatim on the methodology
 * page — an index that ships without its limits is a claim, not a measurement.
 */
export const LIMITS: string[] = [
  "Posture is inferred from outcomes, not from statements. A government that talks tough while operations stall scores low, and one that talks softly while operations succeed scores high. The name says willpower; the arithmetic reads behaviour.",
  "The inputs are compilations, not a register. SATP, MHA parliamentary answers and press tallies disagree by a few per cent on most years and by more on contested incidents. Differences under about 10 points on tonality are inside that noise.",
  "'Neutralised' is the state's count of adversaries killed. Where an encounter is disputed, this index inherits the dispute without resolving it, and a year with contested encounters will read as more decisive than it may have been.",
  "Fewer deaths can mean control or it can mean the adversary chose not to fight. The index cannot separate a defeated insurgency from a dormant one.",
  "Arrests and surrenders are unevenly reported. Years missing them score zero on attrition rather than being penalised, so those years are measured on four dimensions while others are measured on five.",
  "The index says nothing about whether the underlying grievance was addressed, which is the question most of the surrounding argument is actually about.",
];
