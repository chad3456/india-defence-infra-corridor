/**
 * Protest and public order since 2004: the types, and the rule that checks
 * every number against the words of its source. No node imports — the page,
 * the loader and the test all read this.
 *
 * Every figure carries `src`, the id of a document the probe read
 * (data/protests/public-order-probe.json), and `quote`, a run of that
 * document's text copied verbatim. A figure is verified only when the quote
 * is found in the document and the quote contains the figure. A figure that
 * fails is not drawn; the page lists it as unverified instead.
 *
 * The check proves the number is what the source says. It does not prove the
 * source is right, and the page says whose number each one is.
 */

export type SourceKind = "official" | "parliament" | "court" | "commission" | "press" | "rights" | "analysis";

export interface PoSource {
  publisher: string;
  title: string;
  url: string;
  kind: SourceKind;
  /** 1 = the record itself, 2 = a report of the record, 3 = a press account. */
  tier: 1 | 2 | 3;
}

/** One number, where it came from, and the source's own words for it. */
export interface Cited {
  v: number;
  src: string;
  quote: string;
  /** Whose number it is, when the source attributes it (police, ministry, a court). */
  who?: string;
  /** Where in the source: a table and page, so a reader can open it at the right place. */
  loc?: string;
}

export interface SeriesPoint extends Cited { x: number }

export interface PoSeries {
  id: string;
  title: string;
  unit: string;
  definition: string;
  /** What the series cannot be read as. */
  caveat: string;
  points: SeriesPoint[];
}

export interface PoBreakdown {
  id: string;
  title: string;
  /** The year or period the rows describe. */
  period: string;
  unit: string;
  definition: string;
  caveat: string;
  rows: Array<Cited & { label: string }>;
}

export interface Episode {
  id: string;
  name: string;
  state: string;
  /** ISO date the violence began. */
  start: string;
  kind: "agitation" | "communal" | "unrest" | "caste" | "ethnic" | "religious-sect";
  summary: string;
  deaths?: Cited;
  injured?: Cited;
  policeInjured?: Cited;
  arrests?: Cited;
  firs?: Cited;
  displaced?: Cited;
  /** Rupees crore, and what the figure counts. */
  loss?: Cited & { what: string };
  /** Other accounts of the same figure, kept beside the one charted. */
  disputes?: string[];
}

export interface PublicOrderFile {
  accessed: string;
  sources: Record<string, PoSource>;
  series: PoSeries[];
  breakdowns: PoBreakdown[];
  episodes: Episode[];
}

export interface ProbeDoc { id: string; ok: boolean; url: string; readAt?: string; kept?: Array<{ page: number; text: string }> }

/* ── Verification ─────────────────────────────────────────────────────── */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", middot: "·", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', ndash: "-", mdash: "-", hellip: "..." };

/** Text as compared: entities decoded, quotes and dashes unified, whitespace collapsed. */
export function normalise(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, e: string) => ENTITIES[e.toLowerCase()] ?? m)
    .replace(/[‘’′]/g, "'").replace(/[“”]/g, '"').replace(/[–—−]/g, "-")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The ways a source might print a number: 72126, 72,126, 72,126.00, 7.2 lakh is not matched. */
export function spellings(v: number): string[] {
  const out = new Set<string>();
  out.add(String(v));
  if (Number.isInteger(v) && Math.abs(v) >= 1000) {
    out.add(v.toLocaleString("en-US"));
    out.add(v.toLocaleString("en-IN"));
  }
  // A rate printed to one decimal place: 3 is "3.0" in the table.
  if (Number.isInteger(v) && Math.abs(v) < 1000) out.add(`${v}.0`);
  if (!Number.isInteger(v)) {
    for (const dp of [1, 2]) out.add(v.toFixed(dp));
  }
  return [...out];
}

/**
 * Small counts as reporters write them. Only one to twenty: a headline says
 * "Nine killed", and a number word is exact; anything larger is printed in
 * digits in every source this section reads.
 */
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];

/** The quote contains the figure as a whole number, not as part of a longer one. */
export function quoteHasValue(quote: string, v: number): boolean {
  const q = normalise(quote);
  if (Number.isInteger(v) && v > 0 && v < WORDS.length && new RegExp(`\\b${WORDS[v]}\\b`, "i").test(q)) return true;
  return spellings(v).some((s) => new RegExp(`(?<![\\d.,])${s.replace(/[.,]/g, (c) => `\\${c}`)}(?![\\d]|[.,]\\d)`).test(q));
}

export type Verdict = { ok: true } | { ok: false; why: string };

export function verify(c: Cited, docs: Map<string, ProbeDoc>, sources: Record<string, PoSource>): Verdict {
  if (!sources[c.src]) return { ok: false, why: `source ${c.src} is not in the register` };
  const d = docs.get(c.src);
  if (!d || !d.ok) return { ok: false, why: `the probe has not read ${c.src}` };
  if (!c.quote || c.quote.length < 6) return { ok: false, why: "no quote" };
  if (!quoteHasValue(c.quote, c.v)) return { ok: false, why: `the quote does not contain ${c.v}` };
  const q = normalise(c.quote);
  const hit = (d.kept ?? []).some((p) => normalise(p.text).includes(q));
  return hit ? { ok: true } : { ok: false, why: `quote not found in ${c.src}` };
}

/** Every cited figure in the file, with a label saying where it sits. */
export function allCited(f: PublicOrderFile): Array<{ where: string; c: Cited }> {
  const out: Array<{ where: string; c: Cited }> = [];
  for (const s of f.series) for (const p of s.points) out.push({ where: `${s.id} ${p.x}`, c: p });
  for (const b of f.breakdowns) for (const r of b.rows) out.push({ where: `${b.id} ${r.label}`, c: r });
  for (const e of f.episodes) {
    for (const k of ["deaths", "injured", "policeInjured", "arrests", "firs", "displaced", "loss"] as const) {
      const c = e[k];
      if (c) out.push({ where: `${e.id} ${k}`, c });
    }
  }
  return out;
}

export const EPISODE_KINDS: Record<Episode["kind"], string> = {
  agitation: "Agitation over a demand",
  communal: "Communal violence",
  unrest: "Unrest in Jammu & Kashmir or Ladakh",
  caste: "Caste violence",
  ethnic: "Ethnic violence",
  "religious-sect": "A sect's followers",
};
