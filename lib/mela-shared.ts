/**
 * The Vikas Mela: types and the pure arithmetic behind it.
 *
 * No filesystem here, so the client world can import the shapes and the
 * formatting without dragging `node:fs` into the browser bundle — which
 * `npm run test:client` would catch, but only after it had already happened.
 *
 * ── The three questions every stall answers ──────────────────────────────
 *
 *   1. Where did the number start, and where did it get to, term by term?
 *      Four rungs: the start (2014, or the nearest earlier reading), the end
 *      of Term I (2019), the end of Term II (2024), and the latest. Every rung
 *      is a real observation carrying its own period label. A rung with no
 *      reading near its year is a gap, drawn as a gap, and is never filled.
 *
 *   2. Did the pace change?
 *      For the World Bank series that reach back to 2004, the decade before
 *      2014 is set beside the years since. This is the fairest question a
 *      page like this can ask, because most of these indicators were already
 *      rising before 2014 and would have kept rising. "It went up" credits a
 *      government with a trend; "it went up faster than it had been" is at
 *      least evidence of a change. Neither is proof of cause.
 *
 *   3. What does the site's editorial assessment say?
 *      Taken from lib/assessment.ts unchanged, grade and counterpoint both.
 *
 * ── Why gap-closure, not percentage points ───────────────────────────────
 *
 * Electricity access went from 64% to 85% in the decade before 2014 and from
 * 85% to 99.9% after. In percentage points per year that is a slowdown, and a
 * page reporting it would be wrong: the last fifteen points of a coverage
 * programme are the remote hamlets, and they are harder than the first
 * twenty. Measured as the share of the remaining gap closed, the decade before
 * closed 58% of it and the years since closed 99%. For bounded coverage
 * indicators that is the honest comparison, and it is the one used.
 */

export type Term = "before" | "I" | "I/II" | "II" | "II/III" | "III";

/**
 * Which term a launch year falls in.
 *
 * The government took office on 26 May 2014, the second term began on 30 May
 * 2019 and the third on 9 June 2024. A launch YEAR cannot say which side of
 * those dates a scheme fell, so 2019 and 2024 are returned as boundary years
 * rather than guessed. 2014 is Term I because the curated list only carries
 * programmes launched by this government, and each is verified against its
 * source; a year before 2014 is "before", which is how a scheme that continues
 * an older one is marked.
 */
export function termOf(year: number): Term {
  if (year < 2014) return "before";
  if (year <= 2018) return "I";
  if (year === 2019) return "I/II";
  if (year <= 2023) return "II";
  if (year === 2024) return "II/III";
  return "III";
}

export const TERM_LABEL: Record<Term, string> = {
  before: "Before 2014",
  I: "Term I · 2014–19",
  "I/II": "2019 · Term I or II",
  II: "Term II · 2019–24",
  "II/III": "2024 · Term II or III",
  III: "Term III · 2024–",
};

/** Whether a programme's term matches a selected term, boundary years included on both sides. */
export function inTerm(t: Term, selected: "all" | "I" | "II" | "III"): boolean {
  if (selected === "all") return true;
  if (selected === "I") return t === "I" || t === "I/II";
  if (selected === "II") return t === "II" || t === "I/II" || t === "II/III";
  return t === "III" || t === "II/III";
}

/* ── Series points and rungs ──────────────────────────────────────────── */

export interface Obs { period: string; year: number; value: number }

export type RungKey = "start" | "termI" | "termII" | "latest";

export interface Rung { key: RungKey; label: string; obs: Obs | null }

/**
 * The nearest real observation to a target year, within a window.
 *
 * Earlier readings are preferred on a tie, because a rung labelled "end of
 * Term I" should not quietly report a number from after it. Nothing is
 * interpolated: if no reading falls in the window the rung is null and the
 * page draws the gap.
 */
export function nearest(obs: Obs[], target: number, before: number, after: number): Obs | null {
  let best: Obs | null = null;
  for (const o of obs) {
    const d = o.year - target;
    if (d < -before || d > after) continue;
    if (best === null) { best = o; continue; }
    const bd = Math.abs(best.year - target);
    const od = Math.abs(d);
    if (od < bd || (od === bd && o.year < best.year)) best = o;
  }
  return best;
}

/**
 * The four rungs of a series.
 *
 * The start looks back up to two years and never forward, because the start
 * of a record of what a government did must not be a reading from after it
 * took office. The two term ends look two years either side — survey series
 * like the World Bank's account-ownership data are only collected every three
 * years — and each is printed with its real period, so a "Term I" rung that
 * is actually a 2017 survey says 2017.
 */
export function rungsOf(obs: Obs[]): Rung[] {
  const sorted = [...obs].sort((a, b) => a.year - b.year);
  const start = nearest(sorted, 2014, 2, 0);
  const termI = nearest(sorted, 2019, 2, 1);
  const termII = nearest(sorted, 2024, 1, 0);
  const last = sorted[sorted.length - 1] ?? null;
  const used = new Set<string>();
  const take = (o: Obs | null): Obs | null => {
    if (o === null || used.has(o.period)) return null;
    used.add(o.period);
    return o;
  };
  const s = take(start);
  const a = take(termI);
  const b = take(termII);
  const l = last && (b === null || last.year > b.year) ? take(last) : null;
  return [
    { key: "start", label: "Start", obs: s },
    { key: "termI", label: "End of Term I", obs: a },
    { key: "termII", label: "End of Term II", obs: b },
    { key: "latest", label: "Latest", obs: l },
  ];
}

/* ── The pace comparison ──────────────────────────────────────────────── */

export type PaceKind = "gap-up" | "gap-down" | "multiple" | "pp";
export type Better = "up" | "down" | "neither";

export interface Span { from: number; to: number; value: number }

export interface Pace {
  kind: PaceKind;
  before: Span;
  after: Span;
  /** Plain words, computed, never typed. */
  verdict: string;
}

/**
 * Per-year rate for a span, in the direction that counts as better, so two
 * spans of different lengths can be compared. Used only to choose the verdict
 * word; the page prints the spans themselves, with their years.
 */
function rate(kind: PaceKind, v0: number, v1: number, years: number, better: Better): number {
  if (years <= 0) return 0;
  if (kind === "gap-up") {
    const gap = 100 - v0;
    if (gap <= 0) return 0;
    const closed = Math.min(0.9999, Math.max(-5, (v1 - v0) / gap));
    return closed >= 0 ? 1 - Math.pow(1 - closed, 1 / years) : -(1 - Math.pow(1 + closed, 1 / years));
  }
  if (kind === "gap-down" || kind === "multiple") {
    if (v0 <= 0 || v1 <= 0) return 0;
    const g = Math.pow(v1 / v0, 1 / years) - 1;
    return kind === "gap-down" ? -g : g;
  }
  const r = (v1 - v0) / years;
  return better === "down" ? -r : r;
}

/**
 * The before-and-after comparison, or null when the series cannot carry it.
 *
 * It needs a reading within a year of 2004 and at 2014 (a year either side),
 * and a latest reading at least five years after 2014 — fewer than five years
 * is too short to call a pace.
 */
export function paceOf(obs: Obs[], kind: PaceKind, better: Better): Pace | null {
  const sorted = [...obs].sort((a, b) => a.year - b.year);
  const p04 = nearest(sorted, 2004, 1, 1);
  const p14 = nearest(sorted, 2014, 1, 1);
  const last = sorted[sorted.length - 1];
  if (!p04 || !p14 || !last || last.year - p14.year < 5 || p14.year - p04.year < 5) return null;

  const span = (a: Obs, b: Obs): Span => {
    let value: number;
    if (kind === "gap-up") value = (b.value - a.value) / Math.max(1e-9, 100 - a.value) * 100;
    else if (kind === "gap-down") value = (b.value - a.value) / Math.max(1e-9, a.value) * 100;
    else if (kind === "multiple") value = b.value / Math.max(1e-9, a.value);
    else value = b.value - a.value;
    return { from: a.year, to: b.year, value };
  };

  const rb = rate(kind, p04.value, p14.value, p14.year - p04.year, better);
  const ra = rate(kind, p14.value, last.value, last.year - p14.year, better);

  let verdict: string;
  if (better === "neither") {
    verdict = "moved, in a direction this page does not score";
  } else if (rb > 0 && ra > 0) {
    verdict = ra > rb * 1.2 ? "improved faster than the decade before"
      : ra < rb * 0.8 ? "improved more slowly than the decade before"
      : "improved at about the pace of the decade before";
  } else if (rb <= 0 && ra > 0) {
    verdict = "turned around after worsening in the decade before";
  } else if (rb > 0 && ra <= 0) {
    verdict = "reversed: improved in the decade before, worsened since";
  } else {
    verdict = Math.abs(ra) > Math.abs(rb) * 1.2 ? "worsened, and faster than the decade before"
      : Math.abs(ra) < Math.abs(rb) * 0.8 ? "worsened, though more slowly than the decade before"
      : "worsened at about the pace of the decade before";
  }

  return { kind, before: span(p04, p14), after: span(p14, last), verdict };
}

/** A span's value in words, for the bar label. */
export function spanWords(kind: PaceKind, s: Span): string {
  if (kind === "gap-up") return `closed ${s.value.toFixed(0)}% of the gap`;
  if (kind === "gap-down") return `${s.value <= 0 ? "fell" : "rose"} ${Math.abs(s.value).toFixed(0)}%`;
  if (kind === "multiple") return `×${s.value.toFixed(1)}`;
  return `${s.value >= 0 ? "+" : "−"}${Math.abs(s.value).toFixed(1)} pp`;
}

/* ── Formatting ───────────────────────────────────────────────────────── */

export type Fmt = "int" | "pct1" | "dec1" | "usd-tn" | "usd-bn" | "inr-cr" | "crore";

export function fmt(v: number, f: Fmt): string {
  switch (f) {
    case "int": return Math.round(v).toLocaleString("en-IN");
    case "pct1": return `${v.toFixed(1)}%`;
    case "dec1": return v.toFixed(1);
    case "usd-tn": return `$${(v / 1e12).toFixed(2)}tn`;
    case "usd-bn": return `$${(v / 1e9).toFixed(0)}bn`;
    case "inr-cr": return `₹${Math.round(v).toLocaleString("en-IN")} cr`;
    case "crore": return `${(v / 1e7).toFixed(1)} crore`;
  }
}

/* ── The payload the client world receives ────────────────────────────── */

export interface SourceRef { name: string; url: string; accessed: string; tier: number | null }

export interface Metric {
  id: string;
  title: string;
  unit: string;
  fmt: Fmt;
  better: Better;
  rungs: Rung[];
  pace: Pace | null;
  source: SourceRef | null;
  /** One neutral line on what the series is, or what it cannot say. */
  note?: string;
}

export interface Programme {
  id: string;
  name: string;
  year: number;
  term: Term;
  kind: "scheme" | "mission" | "reform" | "law" | "institution" | "event";
  url: string;
  /** When the verifier last confirmed the article exists and names this year. */
  verifiedOn: string;
  continues?: { name: string; year: number; url: string } | null;
  note?: string;
}

export interface VerdictRef {
  id: string; area: string; grade: "A" | "B" | "C" | "D";
  benchmark: string; strength: string; weakness: string; counterpoint: string;
}

export interface Stall {
  id: string;
  name: string;
  /** The katakana sticker on the sign. Decoration, and says so in its alt text. */
  sfx: string;
  sfxReading: string;
  tagline: string;
  /** The guide's line. The site's narration, never a quotation. */
  narration: string;
  core: boolean;
  metrics: Metric[];
  programmes: Programme[];
  verdicts: VerdictRef[];
}

export interface MelaPayload {
  stalls: Stall[];
  counts: {
    programmesVerified: number; programmesCurated: number;
    metrics: number; sources: number; verifiedOn: string | null;
  };
  unverified: Array<{ name: string; reason: string }>;
}
