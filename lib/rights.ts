/**
 * Readers for the SC/ST Act and PM SHRI record.
 *
 * Four files, four separate failure modes, loaded independently so a missing
 * one leaves the other pages standing. Every one of them is a register of
 * evidence rather than a dataset, and the distinction is enforced here as much
 * as in the connectors that wrote them.
 *
 * ── The function that is deliberately absent ─────────────────────────────
 *
 * There is no `misuseRate()`, and there is no `acquittalRate()` standing in
 * for one. The acquittal rate is the number this subject is argued through,
 * and it does not measure what it is offered as measuring. An acquittal can
 * follow from a false complaint; it can equally follow from a hostile witness,
 * from intimidation of the complainant, from an investigation that never
 * gathered the caste-certificate evidence the statute requires, or from a
 * compromise reached outside court. No public dataset separates them.
 *
 * What can be counted is narrower and is counted: how many judgments in the
 * corpus carry a court explicitly finding a specific complaint false. Those
 * are rare, and being rare is the finding.
 *
 * ── The other thing these numbers are not ────────────────────────────────
 *
 * None of these registers is a sample. The judgment corpus is a search result
 * walked to a set depth. The citation register is what encyclopaedia editors
 * reached for. The press register is whatever five RSS feeds happened to carry
 * on the days a script ran. Counting any of them by year measures the
 * collection, not the country — so nothing here returns a time series, and the
 * pages say why in their own words.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Subject = "scst" | "pmshri";
export type Facet = "use" | "acquittal" | "allegation" | "false-finding" | "dispute" | "unclassified";
export type DocKind = "judgment" | "statute" | "unknown";

/*
 * Literal path segments, not a variable joined to cwd. The bundler cannot
 * statically scope the latter, so it traces the entire project into the server
 * output. Four constants cost nothing.
 */
const JUDGMENTS_PATH = join(process.cwd(), "data", "rights", "scst-judgments.json");
const CITATIONS_PATH = join(process.cwd(), "data", "rights", "citations.json");
const NEWS_PATH = join(process.cwd(), "data", "rights", "news.json");
const DOCS_PATH = join(process.cwd(), "data", "live", "docs-probe.json");
const SEARCH_PATH = join(process.cwd(), "data", "rights", "search.json");
const PMSHRI_PROBE_PATH = join(process.cwd(), "data", "live", "pmshri-probe.json");

function read<T extends object>(path: string, empty: T): T {
  try {
    return { ...JSON.parse(readFileSync(path, "utf8")), present: true } as T;
  } catch {
    return empty;
  }
}

/* ── Judgments ───────────────────────────────────────────────────────── */

export interface Judgment {
  docId: string;
  title: string;
  court: string | null;
  year: number | null;
  queries: string[];
  kind: DocKind;
  firstSeen: string;
  /** Outcome words in the search snippet. A MENTION, never a finding. */
  mentions: string[];
  snippet: string;
  url: string;
}

export interface Judgments {
  present: boolean;
  builtAt: string;
  source: string;
  method: string;
  refusal: string;
  cannotSay: string[];
  counts: {
    documents: number; judgments: number; statutes: number; unknown: number;
    carriedFromEarlierRuns: number; addedThisRun: number; pagesThisRun: number;
    withYear: number; withCourt: number; withNoMention: number;
  };
  depth: Record<string, number>;
  perQuery: Array<{ id: string; label: string; from: number; pagesOk: number; results: number; refusedAt: number | null }>;
  byYear: Array<{ year: number; n: number }>;
  byCourt: Array<{ court: string; n: number }>;
  byMention: Array<{ mention: string; n: number }>;
  judgments: Judgment[];
}

const EMPTY_JUDGMENTS: Judgments = {
  present: false, builtAt: "", source: "", method: "", refusal: "", cannotSay: [],
  counts: {
    documents: 0, judgments: 0, statutes: 0, unknown: 0,
    carriedFromEarlierRuns: 0, addedThisRun: 0, pagesThisRun: 0,
    withYear: 0, withCourt: 0, withNoMention: 0,
  },
  depth: {}, perQuery: [], byYear: [], byCourt: [], byMention: [], judgments: [],
};

export function loadJudgments(): Judgments { return read(JUDGMENTS_PATH, EMPTY_JUDGMENTS); }

/* ── Cited reporting ─────────────────────────────────────────────────── */

export interface Citation {
  id: string;
  headline: string;
  outlet: string | null;
  published: string | null;
  url: string | null;
  subject: Subject;
  facet: Facet;
  articles: string[];
  template: string;
  matchedOn: "headline" | "bibliography";
}

export interface Citations {
  present: boolean;
  builtAt: string;
  source: string;
  method: string;
  refusal: string;
  cannotSay: string[];
  counts: {
    citations: number; withUrl: number; withOutlet: number; withDate: number;
    articlesRead: number; articlesMissing: number;
    byMatch: { headline: number; bibliography: number };
    bySubject: { scst: number; pmshri: number };
  };
  byFacet: Array<{ key: Facet; n: number }>;
  byOutlet: Array<{ key: string; n: number }>;
  byTemplate: Array<{ key: string; n: number }>;
  perArticle: Array<{ title: string; note: string; ok: boolean; citations: number; kept: number }>;
  citations: Citation[];
}

const EMPTY_CITATIONS: Citations = {
  present: false, builtAt: "", source: "", method: "", refusal: "", cannotSay: [],
  counts: {
    citations: 0, withUrl: 0, withOutlet: 0, withDate: 0, articlesRead: 0, articlesMissing: 0,
    byMatch: { headline: 0, bibliography: 0 }, bySubject: { scst: 0, pmshri: 0 },
  },
  byFacet: [], byOutlet: [], byTemplate: [], perArticle: [], citations: [],
};

export function loadCitations(): Citations { return read(CITATIONS_PATH, EMPTY_CITATIONS); }

/* ── The live press register ─────────────────────────────────────────── */

export interface NewsItem {
  id: string;
  headline: string;
  subject: Subject;
  facet: Facet;
  firstSeen: string;
  lastSeen: string;
  sources: Array<{ outlet: string; url: string; published: string }>;
}

export interface RightsNews {
  present: boolean;
  builtAt: string;
  source: string;
  method: string;
  refusal: string;
  cannotSay: string[];
  counts: {
    items: number; createdThisRun: number; corroboratedThisRun: number;
    feedsAnswered: number; feedsTried: number; itemsSeen: number;
    bySubject: { scst: number; pmshri: number };
  };
  facets: Array<{ key: Facet; n: number }>;
  feeds: Array<{ outlet: string; ok: boolean; items: number; kept: number; error?: string }>;
  items: NewsItem[];
}

const EMPTY_NEWS: RightsNews = {
  present: false, builtAt: "", source: "", method: "", refusal: "", cannotSay: [],
  counts: {
    items: 0, createdThisRun: 0, corroboratedThisRun: 0,
    feedsAnswered: 0, feedsTried: 0, itemsSeen: 0, bySubject: { scst: 0, pmshri: 0 },
  },
  facets: [], feeds: [], items: [],
};

export function loadRightsNews(): RightsNews { return read(NEWS_PATH, EMPTY_NEWS); }

/* ── Searched coverage ───────────────────────────────────────────────── */

export interface SearchItem {
  id: string;
  headline: string;
  subject: Subject;
  facet: Facet;
  outlet: string | null;
  published: string;
  url: string;
  /** Which queries returned it. Counts are per query, never proportions. */
  queries: string[];
  indexes: string[];
  firstSeen: string;
}

export interface SearchRegister {
  present: boolean;
  builtAt: string;
  source: string;
  method: string;
  refusal: string;
  cannotSay: string[];
  counts: {
    items: number; addedThisRun: number; carriedFromEarlierRuns: number;
    withOutlet: number; queriesAsked: number; offSubjectDropped: number;
    bySubject: { scst: number; pmshri: number };
  };
  byFacet: Array<{ key: Facet; n: number }>;
  byOutlet: Array<{ key: string; n: number }>;
  perQuery: Array<{
    id: string; label: string; subject: Subject; expect: Facet;
    google: number; bing: number; kept: number; offSubject: number;
  }>;
  items: SearchItem[];
}

const EMPTY_SEARCH: SearchRegister = {
  present: false, builtAt: "", source: "", method: "", refusal: "", cannotSay: [],
  counts: {
    items: 0, addedThisRun: 0, carriedFromEarlierRuns: 0, withOutlet: 0,
    queriesAsked: 0, offSubjectDropped: 0, bySubject: { scst: 0, pmshri: 0 },
  },
  byFacet: [], byOutlet: [], perQuery: [], items: [],
};

export function loadSearch(): SearchRegister { return read(SEARCH_PATH, EMPTY_SEARCH); }

/* ── What the official record would and would not answer ─────────────── */

export interface DocsProbe {
  present: boolean;
  probedAt: string;
  question: string;
  refusal: string;
  findings: Array<{
    id: string; what: string; url: string; ok: boolean; status?: string;
    bytes?: number; anchorsTotal?: number; kept?: number;
    links?: Array<{ href: string; text: string }>;
  }>;
}

const EMPTY_DOCS: DocsProbe = { present: false, probedAt: "", question: "", refusal: "", findings: [] };

export function loadDocsProbe(): DocsProbe { return read(DOCS_PATH, EMPTY_DOCS); }

/** The probe of PM SHRI's own sources, whose findings are the scheme's page. */
export interface SourceProbe {
  present: boolean;
  probedAt: string;
  question: string;
  refusal: string;
  note?: string;
  findings: Array<{
    id: string; kind: string; what: string; url: string; settles: string;
    ok: boolean; status: string; bytes: number | null; shape?: string;
    found?: string[]; missing?: string[]; counts?: Record<string, number>;
    parameterWorks?: boolean; parameterNote?: string; note?: string;
  }>;
}

const EMPTY_PROBE: SourceProbe = { present: false, probedAt: "", question: "", refusal: "", findings: [] };

export function loadPmShriProbe(): SourceProbe { return read(PMSHRI_PROBE_PATH, EMPTY_PROBE); }

/* ── Counting, with the refusals built in ────────────────────────────── */

export const FACET_LABEL: Record<Facet, string> = {
  use: "The law operating",
  acquittal: "A court acquitting",
  allegation: "Somebody alleging misuse",
  "false-finding": "A court finding a complaint false",
  dispute: "A dispute over money or consent",
  unclassified: "Reported, unclassified",
};

/**
 * Why each tier is its own tier, in one sentence each.
 *
 * These sit next to the counts on the page rather than in a footnote, because
 * the whole point of separating them is lost if a reader has to go looking for
 * the reason.
 */
export const FACET_WHY: Record<Facet, string> = {
  use: "Registrations, chargesheets, convictions, and the atrocities reported. What the statute does when it works.",
  acquittal: "A court acquitting is not a finding that the complaint was false. It can follow from one, and equally from a hostile witness, from intimidation, from an investigation that never gathered the caste-certificate evidence the statute requires, or from a compromise outside court.",
  allegation: "Somebody saying the Act is abused. Evidence that it was said, by whom, and when — not evidence about the Act.",
  "false-finding": "A court holding a specific complaint false, fabricated, or ordering action against a complainant. The only tier that is evidence of misuse, and the rarest.",
  dispute: "A state refusing a memorandum, or money withheld against one. The form the PM SHRI argument takes.",
  unclassified: "Reported without any of the above in the headline. Most coverage of an atrocity is an account of the atrocity.",
};

/** Citations for one subject, newest datable first, undated last. */
export function citationsFor(c: Citations, subject: Subject): Citation[] {
  return c.citations
    .filter((x) => x.subject === subject)
    .sort((a, b) => (b.published ?? "").localeCompare(a.published ?? ""));
}

/** How many of each tier, in the fixed order the page draws them. */
export function facetCounts(items: Array<{ facet: Facet }>): Array<{ facet: Facet; n: number }> {
  const ORDER: Facet[] = ["use", "unclassified", "acquittal", "allegation", "false-finding", "dispute"];
  const m = new Map<Facet, number>();
  for (const i of items) m.set(i.facet, (m.get(i.facet) ?? 0) + 1);
  return ORDER.map((facet) => ({ facet, n: m.get(facet) ?? 0 })).filter((r) => r.n > 0);
}

/**
 * Judgments whose snippet carries a court finding a complaint false.
 *
 * Still a mention and not a holding — the snippet may be the court reciting an
 * order it goes on to overturn — so callers show the snippet beside the count.
 * This is the narrowest thing the corpus supports, and it is deliberately not
 * divided by anything.
 */
export function falseFindings(j: Judgments): Judgment[] {
  return j.judgments.filter((x) => x.kind === "judgment" && x.mentions.includes("false-complaint"));
}

/**
 * Outlets across every register, for one subject.
 *
 * Deliberately pooled rather than kept per collector. A reader asking who did
 * the reporting is not asking which script found it, and an outlet that
 * appears in both the bibliography and the search index is one newsroom, not
 * two.
 */
export function outletsOf(
  subject: Subject,
  ...registers: Array<Array<{ subject: Subject; outlet: string | null }>>
): Array<{ outlet: string; n: number }> {
  const m = new Map<string, number>();
  for (const reg of registers) {
    for (const x of reg) {
      if (x.subject !== subject || x.outlet === null) continue;
      const name = x.outlet.replace(/\s+/g, " ").trim();
      if (name === "") continue;
      m.set(name, (m.get(name) ?? 0) + 1);
    }
  }
  return [...m].map(([outlet, n]) => ({ outlet, n })).sort((a, b) => b.n - a.n);
}

/**
 * Citations grouped by decade of publication.
 *
 * Decades, not years, and labelled as a property of the register rather than
 * of the country. A citation register cannot carry a trend: it records when
 * editors wrote, which is why the pages that draw this say so on the chart
 * itself rather than underneath it.
 */
export function byDecade(items: Array<{ published: string | null }>): Array<{ decade: string; n: number }> {
  const m = new Map<string, number>();
  for (const x of items) {
    const y = Number.parseInt((x.published ?? "").slice(0, 4), 10);
    if (!Number.isFinite(y)) continue;
    m.set(`${Math.floor(y / 10) * 10}s`, (m.get(`${Math.floor(y / 10) * 10}s`) ?? 0) + 1);
  }
  return [...m].map(([decade, n]) => ({ decade, n })).sort((a, b) => a.decade.localeCompare(b.decade));
}

/**
 * How often each state is named in a set of headlines.
 *
 * This counts HEADLINES, not positions. A state appearing forty times has been
 * written about forty times; it has not refused anything forty times, and a
 * state absent from the list has not agreed to anything. The distinction
 * matters here more than usual, because the PM SHRI argument is precisely
 * about which states signed, and a chart of headline mentions would be read as
 * a chart of consent by anyone who did not read the caption.
 *
 * Only states with a distinctive name are counted. "Punjab", "Goa" and
 * "Manipur" are safe; a bare "India" is not a state and is not here.
 */
const STATES: string[] = [
  "Tamil Nadu", "Kerala", "West Bengal", "Karnataka", "Andhra Pradesh", "Telangana",
  "Maharashtra", "Gujarat", "Rajasthan", "Madhya Pradesh", "Uttar Pradesh", "Bihar",
  "Jharkhand", "Odisha", "Chhattisgarh", "Punjab", "Haryana", "Himachal Pradesh",
  "Uttarakhand", "Assam", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Tripura",
  "Arunachal Pradesh", "Sikkim", "Goa", "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry",
];

export function statesNamed(headlines: string[]): Array<{ state: string; n: number }> {
  const m = new Map<string, number>();
  for (const h of headlines) {
    for (const st of STATES) {
      if (h.includes(st)) m.set(st, (m.get(st) ?? 0) + 1);
    }
  }
  return [...m].map(([state, n]) => ({ state, n })).sort((a, b) => b.n - a.n);
}

/**
 * Items per calendar year.
 *
 * Returned so a page can DRAW the shape and say what it is: a property of the
 * collection. A search index ranks recent material higher and carries more of
 * it, so every register built this way rises towards the present whatever its
 * subject was doing.
 */
export function byYear(items: Array<{ published: string | null }>): Array<{ year: string; n: number }> {
  const m = new Map<string, number>();
  for (const x of items) {
    const y = (x.published ?? "").slice(0, 4);
    if (!/^(19|20)\d\d$/.test(y)) continue;
    m.set(y, (m.get(y) ?? 0) + 1);
  }
  return [...m].map(([year, n]) => ({ year, n })).sort((a, b) => a.year.localeCompare(b.year));
}
