/**
 * Numbers as reported, with the reporting attached.
 *
 * The events tracker already reads the news and pins headlines to places. This
 * does the other half: it reads the *figures* out of them — startups
 * recognised, beneficiaries enrolled, crores committed — and keeps who said
 * what, when.
 *
 * ── Why a figure from the news can be credible ───────────────────────────
 *
 * A single press report of a number is weak evidence, and this project has
 * said so on every page that carries one. But two things make a reported
 * figure strong, and both are visible without leaving the news:
 *
 *   1. Corroboration. The same figure for the same period from independent
 *      outlets is much harder to be wrong than one outlet's typo.
 *   2. Provenance. A figure a ministry announced and four outlets repeated is
 *      one figure, not five — so the primary source is tracked separately
 *      rather than counted as another vote.
 *
 * And the third thing, which most trackers hide: when outlets disagree about a
 * number, that disagreement is information. A claim reported as 1.6 lakh by
 * three outlets and 1.9 lakh by one is not a claim of 1.6 lakh; it is a claim
 * with a dispute in it, and the dispute is shown rather than resolved by
 * picking a side.
 *
 * ── What this deliberately does not do ───────────────────────────────────
 *
 * It does not read a subject out of a sentence. Working out what a number in
 * a headline refers to is a language problem, and getting it wrong produces a
 * confident figure filed under the wrong metric — the worst possible failure
 * for a tracker whose whole claim is credibility. So metrics are declared with
 * explicit patterns, and a number that no pattern claims is left alone.
 */

/** Indian numbering, as the press writes it. */
export const LAKH = 100_000;
export const CRORE = 10_000_000;

export interface ParsedNumber {
  /** The value in plain units — lakh and crore already multiplied out. */
  value: number;
  /** What the text said, so a reader can check the multiplication. */
  asWritten: string;
  /** "count" | "rupees" | "percent" */
  unit: "count" | "rupees" | "percent";
}

/**
 * Read one Indian-format number out of a fragment of text.
 *
 * Handles "1.5 lakh", "12 crore", "₹464.5 crore", "7.8 per cent" and plain
 * digits with separators. Returns null rather than guessing: a fragment with
 * two numbers in it is ambiguous, and picking the first would silently prefer
 * whichever the sentence happened to open with.
 */
export function parseIndianNumber(text: string): ParsedNumber | null {
  const t = text.replace(/&nbsp;/g, " ").trim();

  // A percentage is its own thing and must not be scaled by a nearby "crore".
  const pct = /(\d+(?:\.\d+)?)\s*(?:%|per\s*cent|percent)/i.exec(t);
  if (pct) {
    return { value: Number(pct[1]), asWritten: pct[0], unit: "percent" };
  }

  const rupees = /(?:₹|Rs\.?|INR)\s*/i.test(t);
  const scaled = [...t.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(lakh|crore|billion|million|thousand)\b/gi)];
  if (scaled.length > 1) return null;   // ambiguous; see the docblock
  if (scaled.length === 1) {
    const m = scaled[0]!;
    const n = Number(m[1]!.replace(/,/g, ""));
    if (!Number.isFinite(n)) return null;
    const mult: Record<string, number> = {
      lakh: LAKH, crore: CRORE, billion: 1e9, million: 1e6, thousand: 1e3,
    };
    return {
      value: n * mult[m[2]!.toLowerCase()]!,
      asWritten: m[0],
      unit: rupees ? "rupees" : "count",
    };
  }

  // Plain digits. A bare four-digit run is a year far more often than a
  // figure — "recognised in 2026" would otherwise file 2026 as the count —
  // so a plain number must either carry a separator or run to five digits.
  // Indian press writes real figures either way: "1,60,000" or "160000".
  const plain = [...t.matchAll(/\b(\d[\d,]*(?:,\d{2,3})+|\d{5,})\b/g)];
  if (plain.length !== 1) return null;
  const n = Number(plain[0]![1]!.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return { value: n, asWritten: plain[0]![0], unit: rupees ? "rupees" : "count" };
}

/**
 * A metric worth tracking, and the words that mean it.
 *
 * `pattern` must match the surrounding text for a number to be filed here.
 * `expect` is a plausibility band: a figure outside it is refused rather than
 * published, because a misread multiplier turns 1.6 lakh into 1.6 crore and
 * both look like numbers.
 */
export interface MetricSpec {
  id: string;
  label: string;
  group: "Startups" | "Welfare" | "Economy";
  unit: "count" | "rupees" | "percent";
  pattern: RegExp;
  /** [min, max] the figure must fall inside to be believed. */
  expect: [number, number];
  /** What the number counts, in words, so the page never has to guess. */
  note: string;
}

export const METRICS: MetricSpec[] = [
  {
    id: "startups-recognised",
    label: "DPIIT-recognised startups",
    group: "Startups", unit: "count",
    pattern: /recognis|recogniz/i,
    expect: [10_000, 5_000_000],
    note: "Cumulative recognitions since 2016, not companies currently trading.",
  },
  {
    id: "unicorns",
    label: "Unicorns",
    group: "Startups", unit: "count",
    pattern: /unicorn/i,
    expect: [50, 500],
    note: "Privately held companies valued above a billion dollars.",
  },
  {
    id: "jan-dhan-accounts",
    label: "Jan Dhan accounts",
    group: "Welfare", unit: "count",
    pattern: /jan\s*dhan|PMJDY/i,
    expect: [100_000_000, 1_000_000_000],
    note: "Accounts opened, which is not the same as accounts in use.",
  },
  {
    id: "pm-kisan-beneficiaries",
    label: "PM-KISAN beneficiaries",
    group: "Welfare", unit: "count",
    pattern: /PM[-\s]?KISAN/i,
    expect: [10_000_000, 200_000_000],
    note: "Farmers paid in a given instalment, which varies between instalments.",
  },
  {
    id: "ayushman-cards",
    label: "Ayushman Bharat cards",
    group: "Welfare", unit: "count",
    pattern: /ayushman|PM-?JAY/i,
    expect: [10_000_000, 1_000_000_000],
    note: "Cards created. A card is an entitlement, not a treatment.",
  },
  {
    id: "ujjwala-connections",
    label: "Ujjwala LPG connections",
    group: "Welfare", unit: "count",
    pattern: /ujjwala|PMUY/i,
    expect: [10_000_000, 200_000_000],
    note: "Connections released. Refill rates are a separate and weaker story.",
  },
  {
    id: "mgnrega-households",
    label: "MGNREGA households employed",
    group: "Welfare", unit: "count",
    pattern: /MGNREGA|NREGA|rural employment guarantee/i,
    expect: [10_000_000, 200_000_000],
    note: "Households given work in a financial year.",
  },
  {
    id: "jal-jeevan-connections",
    label: "Tap connections, Jal Jeevan Mission",
    group: "Welfare", unit: "count",
    pattern: /jal\s*jeevan|har\s*ghar\s*jal/i,
    expect: [10_000_000, 300_000_000],
    note: "Rural households with a functional tap connection.",
  },
  {
    id: "pmay-houses",
    label: "PMAY houses completed",
    group: "Welfare", unit: "count",
    pattern: /PMAY|awas\s*yojana/i,
    expect: [1_000_000, 100_000_000],
    note: "Houses completed, as distinct from sanctioned.",
  },
  {
    id: "eshram-registrations",
    label: "eShram registrations",
    group: "Welfare", unit: "count",
    pattern: /e-?shram/i,
    expect: [10_000_000, 500_000_000],
    note: "Unorganised workers registered on the national database.",
  },
];

export interface Claim {
  metricId: string;
  value: number;
  asWritten: string;
  /** ISO date the figure was reported, not the date it describes. */
  date: string;
  outlet: string;
  url: string;
  headline: string;
  /** True when the outlet is a government primary release rather than press. */
  primary: boolean;
}

export interface ClaimGroup {
  metric: MetricSpec;
  claims: Claim[];
  /** Distinct values reported, most-corroborated first. */
  values: Array<{ value: number; outlets: string[]; primary: boolean }>;
  /** The value this project would quote, or null when the reports disagree. */
  settled: number | null;
  /** Why it is or is not settled, in words the page can print. */
  verdict:
    | "a single report, uncorroborated"
    | "corroborated by independent outlets"
    | "from a primary source"
    | "outlets disagree";
}

/**
 * Read a figure out of a headline, for the metrics that declare a pattern.
 *
 * Both halves must agree: the text has to name the metric, and it has to carry
 * exactly one readable number in the expected band. Either failing means no
 * claim, which is the right answer far more often than a guess would be.
 */
export function extractClaim(
  text: string,
  meta: { date: string; outlet: string; url: string; primary: boolean },
): Claim | null {
  for (const m of METRICS) {
    if (!m.pattern.test(text)) continue;
    const n = parseIndianNumber(text);
    if (n === null) continue;
    if (n.unit !== m.unit) continue;
    if (n.value < m.expect[0] || n.value > m.expect[1]) continue;
    return {
      metricId: m.id, value: n.value, asWritten: n.asWritten,
      headline: text, ...meta,
    };
  }
  return null;
}

/**
 * Group claims by metric and decide what, if anything, they settle.
 *
 * Values are compared with a tolerance, because "1.6 lakh" and "1.61 lakh" are
 * the same claim rounded differently and treating them as a dispute would make
 * every metric look contested.
 */
export function groupClaims(claims: Claim[], tolerance = 0.02): ClaimGroup[] {
  const out: ClaimGroup[] = [];
  for (const metric of METRICS) {
    const mine = claims.filter((c) => c.metricId === metric.id);
    if (mine.length === 0) continue;

    const buckets: Array<{ value: number; outlets: string[]; primary: boolean }> = [];
    for (const c of mine) {
      const hit = buckets.find((b) => Math.abs(b.value - c.value) <= b.value * tolerance);
      if (hit) {
        if (!hit.outlets.includes(c.outlet)) hit.outlets.push(c.outlet);
        hit.primary = hit.primary || c.primary;
      } else {
        buckets.push({ value: c.value, outlets: [c.outlet], primary: c.primary });
      }
    }
    buckets.sort((a, b) => b.outlets.length - a.outlets.length);

    const top = buckets[0]!;
    // A ministry announcement repeated by four outlets is one figure, not
    // five, so provenance is asked before corroboration.
    const verdict: ClaimGroup["verdict"] =
      buckets.length > 1 ? "outlets disagree"
        : top.primary ? "from a primary source"
          : top.outlets.length > 1 ? "corroborated by independent outlets"
            : "a single report, uncorroborated";

    out.push({
      metric, claims: mine, values: buckets,
      settled: verdict === "outlets disagree" ? null : top.value,
      verdict,
    });
  }
  return out;
}
