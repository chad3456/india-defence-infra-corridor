/**
 * Judgments under the SC/ST (Prevention of Atrocities) Act, from the record.
 *
 * `npm run scst:judgments`. Writes data/rights/scst-judgments.json. CI only.
 *
 * ── Why judgments and not headlines ──────────────────────────────────────
 *
 * The question asked of this Act is always "use and misuse", and news
 * coverage is a poor instrument for it. A newspaper reporting that a
 * politician alleged misuse is evidence that a politician said something. A
 * court finding a specific complaint fabricated is evidence about the Act.
 *
 * Indian Kanoon publishes the judgment corpus, answers without a key, honours
 * its query parameter and pages through results — all four settled by probe
 * before this was written. Ten results per request means five hundred
 * judgments cost fifty requests rather than five hundred, which matters
 * because Indian Kanoon is a small free service and this is an imposition on
 * it either way.
 *
 * ── The claim this connector is allowed to make ──────────────────────────
 *
 * It collects judgments, dates them, names their court, and records which
 * outcome words appear in the snippet the search returns. That last part is a
 * MENTION and not a finding: a snippet reading "the accused was acquitted"
 * may be the court's holding or may be it reciting the trial court's order
 * before overturning it, and ten words of context cannot tell them apart.
 *
 * So nothing here is aggregated into an acquittal rate, a conviction rate or
 * anything resembling a misuse measure. The snippet is published beside every
 * flag so a reader checks rather than trusts, and the count of judgments
 * whose outcome could not be read is published too.
 *
 * ── The distinction that must survive to the page ────────────────────────
 *
 * An acquittal is not a finding that a complaint was false. It can follow
 * from one; it can equally follow from a hostile witness, from intimidation
 * of the complainant, from an investigation that never gathered the
 * caste-certificate evidence the statute requires, or from a compromise
 * reached outside court. India's own official record discusses all of these
 * and no public dataset separates them. Only a court explicitly finding a
 * complaint false is evidence of misuse, and those are flagged separately and
 * are rare.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "../lib/http";
import { isEntryPoint } from "../lib/entry";

const OUT_DIR = join(process.cwd(), "data", "rights");
const OUT = join(OUT_DIR, "scst-judgments.json");
/** Where a run that could not read the page leaves its description of it. */
const SHAPE_OUT = join(OUT_DIR, "kanoon-shape.json");
const KANOON = "https://indiankanoon.org/search/";

/**
 * Three seconds between requests, and a hard cap on how many.
 *
 * Indian Kanoon is a free public service run on a shoestring. Fifty pages at
 * ten results each is five hundred judgments for fifty requests, spread over
 * two and a half minutes. That is a visit, not a crawl.
 */
/*
 * Eight seconds, and twelve pages a run.
 *
 * The first working walk asked for fifty-five pages three seconds apart. It
 * got ten, and then Indian Kanoon stopped answering — three of the four
 * queries never returned a single page. That is not a failure to handle; it is
 * a small free service saying it has had enough, and the correct response is
 * to ask for less and come back later rather than to retry harder.
 *
 * So the corpus is built ACROSS runs, the way the event map is. Each run walks
 * a little deeper than the last, merges what it finds into what is stored, and
 * a run that is refused early keeps everything the earlier runs collected.
 */
const GAP_MS = 8000;
const PAGES_PER_RUN = 12;

let last = 0;
async function pace(): Promise<void> {
  const w = GAP_MS - (Date.now() - last);
  if (w > 0) await new Promise((r) => setTimeout(r, w));
  last = Date.now();
}

/**
 * The queries, each asked separately so the mix is visible.
 *
 * A single broad query would return whatever the search ranks highest, and
 * the result set would be a fact about the ranking. Asking separately for the
 * statute, for acquittals under it, and for complaints found false means the
 * rarest category is actually reached — a general search would bury it — and
 * it means the page can say how many of each the corpus returned rather than
 * inferring proportions from one ranked list.
 *
 * It also means the counts are NOT proportions of anything. Fifty judgments
 * returned for "false complaint" and fifty for "acquitted" says nothing about
 * their relative frequency; it says both queries were asked for the same
 * number of pages.
 */
const QUERIES: Array<{ id: string; label: string; q: string }> = [
  { id: "act", label: "The Act generally", q: "scheduled castes scheduled tribes prevention of atrocities act" },
  { id: "acquittal", label: "Acquittal language", q: "prevention of atrocities act acquitted appeal" },
  { id: "false", label: "Complaint found false", q: "prevention of atrocities act false complaint quashed" },
  { id: "conviction", label: "Conviction language", q: "prevention of atrocities act conviction sentence upheld" },
];

/**
 * Ask for judgments, and check that judgments are what came back.
 *
 * The first walk collected a hundred documents and not one of them was a case.
 * Indian Kanoon indexes statutes alongside judgments, and a search for the
 * Act's name ranks the Act's own text first — so the corpus was Section 3,
 * Section 14, Section 18 and the Entire Act, a hundred times over, each dated
 * 1989 and carrying no outcome at all. It looked like a corpus. Counting it as
 * one would have inflated the case record by the number of sections in the
 * statute.
 *
 * The search takes a document-type filter, so it is asked for. But asking is
 * not the same as receiving — that is the whole PIB lesson — so every result
 * is classified by the shape of its own title and statutes are counted
 * separately rather than quietly dropped. If the filter stops working, the
 * statute count rises and the file says so.
 */
const DOCTYPES = "judgments";

export type DocKind = "judgment" | "statute" | "unknown";

/**
 * What a result is, from its title.
 *
 * A judgment is titled for its parties and dated: "Rajesh vs State Of Madhya
 * Pradesh on 12 March, 2019". A statute is titled for its place in an Act:
 * "Section 3 in The Scheduled Castes...", "Entire Act". The distinction is
 * load-bearing, so it is made explicitly and the residue is called unknown
 * rather than being assumed to be one or the other.
 */
export function kindOf(title: string): DocKind {
  if (/^\s*(?:section|article|rule|order|schedule)\s+[\dA-Z]/i.test(title)) return "statute";
  if (/^\s*(?:entire act|the\s+.*\bact\b\s*,?\s*\d{4}\s*$)/i.test(title)) return "statute";
  if (/\bv(?:s\.?|ersus)\b/i.test(title) && /\bon\s+\d{1,2}\s+\w+,?\s+\d{4}\s*$/i.test(title)) return "judgment";
  if (/\bv(?:s\.?|ersus)\b/i.test(title)) return "judgment";
  return "unknown";
}

export interface Judgment {
  /** Indian Kanoon document id, which is the stable handle. */
  docId: string;
  title: string;
  /** The court, as the search result labels it. */
  court: string | null;
  /** Year from the title, which ends "on 12 March, 2019". */
  year: number | null;
  /** Which query returned it. A judgment may be returned by several. */
  queries: string[];
  /** Judgment, statute or unknown. Statutes are kept apart, never counted as cases. */
  kind: DocKind;
  /** When this document first entered the corpus, across runs. */
  firstSeen: string;
  /**
   * Outcome words present in the snippet. A MENTION, never a finding — the
   * snippet may be the court reciting an order it goes on to overturn.
   */
  mentions: string[];
  /** The snippet verbatim, so every flag can be checked against it. */
  snippet: string;
  url: string;
}

/** Outcome vocabularies. Order does not matter: all matches are recorded. */
const MENTION_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: "acquitted", re: /\bacquitt?(?:ed|al)\b/i },
  { id: "convicted", re: /\bconvict(?:ed|ion)\b/i },
  { id: "quashed", re: /\bquash(?:ed|ing)\b/i },
  { id: "false-complaint", re: /\bfalse\s+(?:complaint|case|implication)|\bfalsely implicat/i },
  { id: "bail", re: /\banticipatory bail\b|\bbail\b/i },
  { id: "compensation", re: /\bcompensation\b/i },
  { id: "compromise", re: /\bcompromise[ds]?\b|\bsettlement\b/i },
  { id: "hostile-witness", re: /\bhostile\b/i },
];

/** Strip tags and decode the few entities the pages use. */
export function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The year a judgment title ends on.
 *
 * Titles read "Rajesh vs State Of Madhya Pradesh on 12 March, 2019". Taking
 * the LAST four-digit year in the title rather than the first, because a
 * party name can carry one — "Criminal Appeal 204 Of 2011 vs State on 3 May,
 * 2019" would otherwise be filed under 2011.
 */
export function yearOf(title: string): number | null {
  const all = [...title.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => Number.parseInt(m[0], 10));
  const last = all[all.length - 1];
  return last !== undefined && last >= 1989 && last <= new Date().getUTCFullYear() ? last : null;
}

/**
 * Results out of one search page.
 *
 * The first version of this split the page on `<div class="result_title">`,
 * which the probe had seen in the markup. It parsed zero results on every
 * page of every query, because a class name is a fact about a stylesheet and
 * stylesheets get rewritten. The guard below caught it and refused to publish
 * an empty corpus, which is the only reason it was a wasted run rather than a
 * silently emptied dataset.
 *
 * So this anchors on the one thing a judgment search cannot change without
 * changing its own permalinks: a link to `/doc/<id>/`. Everything else —
 * where the court name sits, what the surrounding element is called — is
 * read if present and left null if not.
 *
 * The page carries roughly two `/doc/` links per result, a title and a
 * secondary link, so results are collapsed by document id and the longest
 * anchor text wins as the title.
 */
export function parseResults(html: string): Array<{ docId: string; title: string; court: string | null; snippet: string; kind: DocKind; window: string }> {
  /*
   * Each result is an <article class="result">. This is a reading, not a
   * guess: the first two attempts guessed — at a CSS class, then at the
   * permalink — and the run that recorded what it actually met is what
   * produced this. The window it captured reads:
   *
   *   <article class="result" role="listitem">
   *     <h4 class="result_title">
   *       <a href="/docfragment/1841482/?formInput=...">
   *         C.Sathiyanathan vs Veeramuthu on 14 November, 2008</a></h4>
   *     <div class="headline"> offence punishable under the provisions of
   *       the <b>Scheduled</b> <b>Castes</b> ... </div>
   *     ... <a href="/doc/1841482/">Full Document</a> ...
   *
   * Two links point at one judgment, and the permalink-shaped one — /doc/ID/ —
   * is the one whose anchor text reads "Full Document". Anchoring on it gave a
   * hundred and fifty-seven documents all titled "Full Document", correctly
   * identified and completely unusable. The title lives on the /docfragment/
   * link.
   */
  const blocks = html.split(/<article\b[^>]*class="[^"]*\bresult\b[^"]*"[^>]*>/i).slice(1);
  const source = blocks.length > 0 ? blocks : [html];
  const out: Array<{ docId: string; title: string; court: string | null; snippet: string; kind: DocKind; window: string }> = [];
  const seen = new Set<string>();

  /** Anchor text that labels a link rather than naming a document. */
  const BOILERPLATE = /^(?:full document|cites?|cited by|view|read more|pdf|print|\d+)$/i;

  for (const raw of source) {
    // Stop at the end of this result so a block never swallows the next one.
    const block = raw.split(/<\/article>/i)[0] ?? raw;

    const idm = /href="\/(?:docfragment|doc)\/(\d+)/i.exec(block);
    if (!idm) continue;
    const docId = idm[1] ?? "";
    if (docId === "" || seen.has(docId)) continue;

    // The title: the result_title anchor where the markup offers one,
    // otherwise the longest anchor text that is not a link label.
    let title = "";
    const th = /class="[^"]*\bresult_title\b[^"]*"[\s\S]{0,200}?<a\s[^>]*>([\s\S]*?)<\/a>/i.exec(block);
    if (th) title = textOf(th[1] ?? "");
    if (title === "" || BOILERPLATE.test(title)) {
      for (const a of block.matchAll(/<a\s[^>]*href="\/(?:docfragment|doc)\/\d+[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)) {
        const t = textOf(a[1] ?? "");
        if (!BOILERPLATE.test(t) && t.length > title.length) title = t;
      }
    }
    if (title === "" || BOILERPLATE.test(title) || title.length < 8) continue;

    const hl = /<div[^>]*class="[^"]*\bheadline\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(block);
    const snippet = textOf(hl ? (hl[1] ?? "") : block).slice(0, 400);

    /*
     * The court, from whichever element carries it.
     *
     * A run that read a hundred and seventeen judgments correctly labelled
     * none of them, because this looked for a <div class="docsource"> and the
     * label is not a div inside the result. Matching any tag whose class says
     * docsource costs nothing and stops the tag name being a second guess;
     * the widened window below is what will settle it if this still finds
     * nothing.
     */
    const src = /<[a-z]+[^>]*class="[^"]*docsource[^"]*"[^>]*>([\s\S]*?)<\/[a-z]+>/i.exec(block)
      ?? /<[a-z]+[^>]*class="[^"]*docsource[^"]*"[^>]*>([^<]*)/i.exec(block);
    const court = src ? textOf(src[1] ?? "").slice(0, 120) || null : null;

    seen.add(docId);
    out.push({ docId, title, court, snippet, kind: kindOf(title), window: block.slice(0, 1800).replace(/\s+/g, " ") });
  }
  return out;
}

/**
 * What the page looked like, when it did not look like anything expected.
 *
 * A run that parses nothing must leave behind enough to fix it without
 * guessing again. This publishes the markup around the first `/doc/` link, or
 * the head of the body when there is not even one — sanitised of scripts and
 * collapsed, so it is a shape and not a copy of the page.
 */
export function shapeNote(html: string): string {
  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const hit = /<a\s[^>]*href="\/doc\/\d+/i.exec(stripped);
  const at = hit ? Math.max(0, (hit.index ?? 0) - 300) : 0;
  return stripped.slice(at, at + 1200).replace(/\s+/g, " ").trim();
}

interface Stored {
  /** Legacy rows predate `kind` and `firstSeen`, so both are optional on read. */
  judgments?: Array<Omit<Judgment, "kind" | "firstSeen"> & { kind?: DocKind; firstSeen?: string }>;
  /** How deep each query has been walked, so the next run goes further. */
  depth?: Record<string, number>;
}

async function main(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  /*
   * Everything earlier runs collected. Indian Kanoon answers about ten
   * requests and then stops, so one run is never the corpus — it is one more
   * instalment of it. A run that is refused on its first page must leave the
   * stored record exactly as it found it.
   */
  const stored: Stored = await readFile(OUT, "utf8")
    .then((t) => JSON.parse(t) as Stored)
    .catch(() => ({}));
  /*
   * Rows stored before this connector knew the difference between a statute
   * and a case carry no `kind`. Classifying them on read rather than dropping
   * them means the hundred statute sections the first walk collected are
   * correctly counted as statutes instead of silently vanishing.
   */
  const found = new Map<string, Judgment>(
    (stored.judgments ?? [])
      /*
       * Drop anything an earlier parser stored that is not a document. One
       * version anchored on the permalink and took the anchor text with it,
       * giving a hundred and fifty-seven rows all titled "Full Document" —
       * correct ids, no titles, no use. Filtering on read means a bad run
       * cannot leave that in the corpus permanently, and costs nothing when
       * there is none.
       */
      .filter((j) => !/^(?:full document|cites?|cited by|view|read more|pdf|print)$/i.test(j.title.trim()))
      .map((j) => [j.docId, { ...j, kind: j.kind ?? kindOf(j.title), firstSeen: j.firstSeen ?? today }]),
  );
  const carried = found.size;
  const depth: Record<string, number> = { ...(stored.depth ?? {}) };

  const perQuery: Array<{ id: string; label: string; from: number; pagesOk: number; results: number; refusedAt: number | null }> = [];
  const pageYields: number[] = [];
  /** What a page that yielded nothing actually looked like. See shapeNote. */
  const unparsed: Array<{ query: string; page: number; bytes: number; shape: string }> = [];
  /** The raw markup around the first results of the run, so extraction is fixed by reading. */
  const sampleWindows: Array<{ query: string; title: string; court: string | null; window: string }> = [];

  /*
   * The page budget is shared across the four queries, and each query starts
   * where it left off. So four runs cover what one run cannot, and no run
   * re-fetches what the last one already has.
   */
  const perQueryBudget = Math.max(1, Math.floor(PAGES_PER_RUN / QUERIES.length));
  let spent = 0;

  for (const q of QUERIES) {
    const from = depth[q.id] ?? 0;
    let pagesOk = 0;
    let results = 0;
    let refusedAt: number | null = null;

    for (let page = from; page < from + perQueryBudget && spent < PAGES_PER_RUN; page++) {
      await pace();
      spent++;
      const url = `${KANOON}?formInput=${encodeURIComponent(`${q.q} doctypes:${DOCTYPES}`)}&pagenum=${page}`;
      const res = await getText(url, { timeoutMs: 45_000, retries: 1, cacheMs: 0 });
      if (!res.ok || !res.data) {
        console.log(`  ${q.id} page ${page}: ${res.error ?? "no body"} — stopping this query`);
        refusedAt = page;
        break;
      }
      const rows = parseResults(res.data);
      pageYields.push(rows.length);
      if (rows.length === 0) {
        unparsed.push({ query: q.id, page, bytes: res.data.length, shape: shapeNote(res.data) });
        console.log(`  ${q.id} page ${page}: parsed 0 results from ${res.data.length} bytes — shape recorded`);
        break;
      }
      if (sampleWindows.length < 3 && rows[0]) {
        sampleWindows.push({ query: q.id, title: rows[0].title, court: rows[0].court, window: rows[0].window });
      }
      pagesOk++;
      results += rows.length;
      depth[q.id] = page + 1;

      for (const r of rows) {
        const prev = found.get(r.docId);
        if (prev) {
          if (!prev.queries.includes(q.id)) prev.queries.push(q.id);
          continue;
        }
        const mentions = MENTION_PATTERNS.filter((m) => m.re.test(r.snippet) || m.re.test(r.title)).map((m) => m.id);
        found.set(r.docId, {
          docId: r.docId,
          title: r.title,
          court: r.court,
          year: yearOf(r.title),
          queries: [q.id],
          kind: r.kind,
          firstSeen: today,
          mentions,
          snippet: r.snippet,
          url: `https://indiankanoon.org/doc/${r.docId}/`,
        });
      }
    }
    perQuery.push({ id: q.id, label: q.label, from, pagesOk, results, refusedAt });
    console.log(`  ${q.label}: from page ${from}, ${pagesOk} pages, ${results} results${refusedAt === null ? "" : ` (refused at ${refusedAt})`}`);
  }

  const all = [...found.values()];
  /*
   * Statutes are not cases. The first walk collected a hundred documents and
   * every one of them was a section of the Act — Section 3, Section 14, the
   * Entire Act — each dated 1989 and carrying no outcome. They are kept,
   * because the statute's own text is worth having, and they are counted
   * separately, because calling them judgments would inflate the case record
   * by the number of sections in the statute.
   */
  const judgments = all.filter((j) => j.kind === "judgment");
  const statutes = all.filter((j) => j.kind === "statute");
  const unknown = all.filter((j) => j.kind === "unknown");

  if (all.length === 0) {
    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(SHAPE_OUT, JSON.stringify({
      builtAt: new Date().toISOString(),
      what: "Indian Kanoon returned pages this connector could not read. What they looked like.",
      why: "So the fix is a reading rather than a second guess.",
      unparsed,
    }, null, 2) + "\n", "utf8");
    console.log(`Wrote ${SHAPE_OUT}: ${unparsed.length} unreadable page(s).`);
    throw new Error("no documents parsed and none stored — refusing to publish an empty corpus");
  }

  const byYear = new Map<number, number>();
  for (const j of judgments) if (j.year !== null) byYear.set(j.year, (byYear.get(j.year) ?? 0) + 1);

  const byCourt = new Map<string, number>();
  for (const j of judgments) if (j.court) byCourt.set(j.court, (byCourt.get(j.court) ?? 0) + 1);

  const byMention = new Map<string, number>();
  for (const j of judgments) for (const m of j.mentions) byMention.set(m, (byMention.get(m) ?? 0) + 1);

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT, JSON.stringify({
    builtAt: new Date().toISOString(),
    source:
      "Indian Kanoon (indiankanoon.org), the free Indian judgment search. Four queries, each "
      + "asked with a judgments-only document filter, ten results per request, eight seconds apart.",
    method:
      "Indian Kanoon answers roughly ten requests and then stops, so the corpus is built across "
      + "runs rather than in one: each run walks twelve pages, resumes each query where the last "
      + "run left it, and merges into what is stored. Queries are asked separately rather than as "
      + "one broad search, so the rarest category is reached instead of being buried by ranking.",
    refusal:
      "No acquittal rate, conviction rate or misuse measure is computed. The outcome words are "
      + "MENTIONS in a search snippet, not findings: a snippet reading 'the accused was "
      + "acquitted' may be the court's holding or it reciting a trial court order it goes on to "
      + "overturn, and ten words of context cannot tell them apart. Every snippet is published "
      + "beside its flags so a reader checks rather than trusts.",
    cannotSay: [
      "How often the Act is misused. Only a court explicitly finding a complaint false is evidence of that, and those are flagged separately and are rare. An acquittal is not evidence of it: it can follow from a false complaint and can equally follow from a hostile witness, from intimidation of the complainant, from an investigation that never gathered the caste-certificate evidence the statute requires, or from a compromise outside court — and no public dataset separates them.",
      "What share of cases end any particular way. These counts are per query, and each query is walked a set number of pages per run. Fifty judgments returned for one query and fifty for another says both were asked equally, not that the outcomes are equally common.",
      "Anything about cases that never reached a written judgment, which is most of them. Judgments are the end of a filtered process — registration, investigation, chargesheet, trial — and every stage before drops cases for reasons this corpus cannot see.",
      "Whether a flagged outcome is the court's own. The flag says a word appeared in a snippet. The snippet is published; the judgment is one link away.",
    ],
    counts: {
      documents: all.length,
      judgments: judgments.length,
      statutes: statutes.length,
      unknown: unknown.length,
      carriedFromEarlierRuns: carried,
      addedThisRun: all.length - carried,
      pagesThisRun: pageYields.length,
      withYear: judgments.filter((j) => j.year !== null).length,
      withCourt: judgments.filter((j) => j.court !== null).length,
      withNoMention: judgments.filter((j) => j.mentions.length === 0).length,
    },
    depth,
    perQuery,
    unparsed,
    sampleWindows,
    byYear: [...byYear].map(([year, n]) => ({ year, n })).sort((a, b) => a.year - b.year),
    byCourt: [...byCourt].map(([court, n]) => ({ court, n })).sort((a, b) => b.n - a.n).slice(0, 40),
    byMention: [...byMention].map(([mention, n]) => ({ mention, n })).sort((a, b) => b.n - a.n),
    judgments: all,
  }, null, 2) + "\n", "utf8");

  console.log(
    `\nWrote ${OUT}: ${all.length} documents (${judgments.length} judgments, ${statutes.length} statutes, `
    + `${unknown.length} unclassified), ${all.length - carried} new this run.`,
  );
}
if (isEntryPoint(import.meta.url)) {
  void main();
}
