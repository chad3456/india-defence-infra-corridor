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
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "../lib/http";
import { isEntryPoint } from "../lib/entry";

const OUT_DIR = join(process.cwd(), "data", "rights");
const OUT = join(OUT_DIR, "scst-judgments.json");
const KANOON = "https://indiankanoon.org/search/";

/**
 * Three seconds between requests, and a hard cap on how many.
 *
 * Indian Kanoon is a free public service run on a shoestring. Fifty pages at
 * ten results each is five hundred judgments for fifty requests, spread over
 * two and a half minutes. That is a visit, not a crawl.
 */
const GAP_MS = 3000;
const MAX_PAGES = 55;

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
const QUERIES: Array<{ id: string; label: string; q: string; pages: number }> = [
  { id: "act", label: "The Act generally", q: "scheduled castes scheduled tribes prevention of atrocities act", pages: 25 },
  { id: "acquittal", label: "Acquittal language", q: "prevention of atrocities act acquitted appeal", pages: 10 },
  { id: "false", label: "Complaint found false", q: "prevention of atrocities act false complaint quashed", pages: 10 },
  { id: "conviction", label: "Conviction language", q: "prevention of atrocities act conviction sentence upheld", pages: 10 },
];

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
 * Written against the structure the probe measured — ten `result_title`
 * blocks and twenty `/doc/` links per page — and defensive about all of it,
 * because a layout change should show up as zero results parsed rather than
 * as wrong ones. The run publishes how many each page yielded for exactly
 * that reason.
 */
export function parseResults(html: string): Array<{ docId: string; title: string; court: string | null; snippet: string }> {
  const out: Array<{ docId: string; title: string; court: string | null; snippet: string }> = [];
  // Each result is a block starting at a result_title and running to the next.
  const blocks = html.split(/<div class="result_title">/).slice(1);
  for (const block of blocks) {
    const link = /<a\s+href="\/doc\/(\d+)\/?[^"]*"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
    if (!link) continue;
    const docId = link[1] ?? "";
    const title = textOf(link[2] ?? "");
    if (docId === "" || title === "") continue;
    const src = /<div class="docsource[^"]*">([\s\S]*?)<\/div>/i.exec(block);
    // The snippet is whatever prose follows, before the next result begins.
    const snippet = textOf(block.replace(/<a\s+href="\/doc\/[\s\S]*?<\/a>/i, "")).slice(0, 400);
    out.push({ docId, title, court: src ? textOf(src[1] ?? "") || null : null, snippet });
  }
  return out;
}

async function main(): Promise<void> {
  const found = new Map<string, Judgment>();
  const perQuery: Array<{ id: string; label: string; pagesAsked: number; pagesOk: number; results: number }> = [];
  const pageYields: number[] = [];

  for (const q of QUERIES) {
    let pagesOk = 0;
    let results = 0;
    for (let page = 0; page < Math.min(q.pages, MAX_PAGES); page++) {
      await pace();
      const url = `${KANOON}?formInput=${encodeURIComponent(q.q)}&pagenum=${page}`;
      const res = await getText(url, { timeoutMs: 45_000, retries: 1, cacheMs: 0 });
      if (!res.ok || !res.data) {
        console.log(`  ${q.id} page ${page}: ${res.error ?? "no body"}`);
        // A refusal mid-way is the service asking to stop. Move on rather than
        // hammering the remaining pages of this query.
        break;
      }
      const rows = parseResults(res.data);
      pageYields.push(rows.length);
      if (rows.length === 0) {
        console.log(`  ${q.id} page ${page}: parsed 0 results — layout may have changed`);
        break;
      }
      pagesOk++;
      results += rows.length;
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
          mentions,
          snippet: r.snippet,
          url: `https://indiankanoon.org/doc/${r.docId}/`,
        });
      }
    }
    perQuery.push({ id: q.id, label: q.label, pagesAsked: q.pages, pagesOk, results });
    console.log(`  ${q.label}: ${pagesOk} pages, ${results} results`);
  }

  const judgments = [...found.values()];
  if (judgments.length === 0) {
    throw new Error("no judgments parsed — refusing to publish an empty corpus over a good one");
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
      + "paged separately, ten results per request, three seconds apart.",
    method:
      "Queries are asked separately rather than as one broad search, so the rarest category is "
      + "actually reached instead of being buried by ranking. Each result yields a document id, "
      + "a title, the court the search labels it with, the year from the end of the title, and "
      + "which outcome words appear in the returned snippet.",
    refusal:
      "No acquittal rate, conviction rate or misuse measure is computed. The outcome words are "
      + "MENTIONS in a search snippet, not findings: a snippet reading 'the accused was "
      + "acquitted' may be the court's holding or it reciting a trial court order it goes on to "
      + "overturn, and ten words of context cannot tell them apart. Every snippet is published "
      + "beside its flags so a reader checks rather than trusts.",
    cannotSay: [
      "How often the Act is misused. Only a court explicitly finding a complaint false is evidence of that, and those are flagged separately and are rare. An acquittal is not evidence of it: it can follow from a false complaint and can equally follow from a hostile witness, from intimidation of the complainant, from an investigation that never gathered the caste-certificate evidence the statute requires, or from a compromise outside court — and no public dataset separates them.",
      "What share of cases end any particular way. These counts are per query, and each query was asked for a set number of pages. Fifty judgments returned for one query and fifty for another says both were asked equally, not that the outcomes are equally common.",
      "Anything about cases that never reached a written judgment, which is most of them. Judgments are the end of a filtered process — registration, investigation, chargesheet, trial — and every stage before drops cases for reasons this corpus cannot see.",
      "Whether a flagged outcome is the court's own. The flag says a word appeared in a snippet. The snippet is published; the judgment is one link away.",
    ],
    counts: {
      judgments: judgments.length,
      withYear: judgments.filter((j) => j.year !== null).length,
      withCourt: judgments.filter((j) => j.court !== null).length,
      withNoMention: judgments.filter((j) => j.mentions.length === 0).length,
      pagesFetched: pageYields.length,
      medianPageYield: [...pageYields].sort((a, b) => a - b)[Math.floor(pageYields.length / 2)] ?? 0,
    },
    perQuery,
    byYear: [...byYear].map(([year, n]) => ({ year, n })).sort((a, b) => a.year - b.year),
    byCourt: [...byCourt].map(([court, n]) => ({ court, n })).sort((a, b) => b.n - a.n).slice(0, 40),
    byMention: [...byMention].map(([mention, n]) => ({ mention, n })).sort((a, b) => b.n - a.n),
    judgments,
  }, null, 2) + "\n", "utf8");

  console.log(
    `\nWrote ${OUT}: ${judgments.length} judgments from ${pageYields.length} pages `
    + `(${judgments.filter((j) => j.year !== null).length} dated, `
    + `${judgments.filter((j) => j.mentions.length === 0).length} with no outcome word).`,
  );
}

if (isEntryPoint(import.meta.url)) {
  void main();
}
