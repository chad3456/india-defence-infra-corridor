/**
 * The SC/ST Act and PM SHRI, searched rather than waited for.
 *
 * `npm run rights:search`. Writes data/rights/search.json. CI only.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 *
 * Three collectors came before it and each hit the same wall from a different
 * side. The five newsrooms that answer a script saw 199 items in a sweep and
 * matched one, because an RSS feed carries about a day of a general national
 * desk. The bibliography harvest reached 510 pieces on the Act and three on PM
 * SHRI, because the scheme has no encyclopaedia article. Every government
 * route for the scheme — its own portal, the ministry's pages, Parliament's
 * API — answered 200 and carried no number, or 404.
 *
 * What was never tried was searching an archive. Google News publishes keyless
 * RSS over a news query, and it honours the query: asked for the scheme it
 * returned a hundred items carrying a hundred and eighty-seven mentions of its
 * name, against a nonsense query that returned something two hundred kilobytes
 * different. Bing answers the same way with a smaller index. So coverage of
 * both subjects is collectable after all.
 *
 * ── What a search result is, and is not ──────────────────────────────────
 *
 * It is evidence that an outlet published a headline on a date. It is not a
 * verified fact and it is emphatically not a sample of coverage: a search
 * index returns what it ranks, from the outlets it carries, for the words it
 * was given. Counting these by year measures the index.
 *
 * So the queries are asked SEPARATELY and their counts are published per
 * query, exactly as the judgment corpus does. Each query is aimed at one of
 * the four tiers, so the rarest — a court finding a complaint false — is
 * actually reached instead of being buried under the commonest. Which means
 * the tier counts here are NOT proportions of anything. Fifty items returned
 * for "false complaint" and fifty for "acquitted" says both queries were asked
 * and answered, not that the two outcomes are equally common.
 *
 * ── The distinction that must survive ────────────────────────────────────
 *
 * The same four tiers as everywhere else in this subject, never merged: the
 * law operating, a court acquitting, somebody alleging misuse, and a court
 * finding a specific complaint false. Only the last is evidence of misuse. An
 * acquittal is not: it can follow from a false complaint and equally from a
 * hostile witness, from intimidation of the complainant, from an investigation
 * that never gathered the caste-certificate evidence the statute requires, or
 * from a compromise outside court.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "../lib/http";
import { parseFeed } from "../lib/feed";
import { isEntryPoint } from "../lib/entry";
import { subjectOf, facetOf, type Subject, type Facet } from "./rights-news";

const OUT_DIR = join(process.cwd(), "data", "rights");
const OUT = join(OUT_DIR, "search.json");

/** Three seconds between queries. This is a free endpoint and the job is small. */
const GAP_MS = 3000;
let last = 0;
async function pace(): Promise<void> {
  const w = GAP_MS - (Date.now() - last);
  if (w > 0) await new Promise((r) => setTimeout(r, w));
  last = Date.now();
}

const GOOGLE = (q: string): string =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`;
const BING = (q: string): string =>
  `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=RSS`;

/**
 * The queries, each aimed at one tier.
 *
 * A single broad query would return whatever the index ranks highest for the
 * subject, which is the commonest thing in it — and the tier that decides
 * whether this Act is abused is the rarest. Asking for it by name is the only
 * way it appears at all.
 *
 * `expect` records which tier a query was aimed at. It is NOT used to classify
 * the results: every item is classified from its own headline, and a query
 * aimed at acquittals that returns an allegation is filed as an allegation.
 * Publishing both lets a reader see where a query went astray.
 */
const QUERIES: Array<{ id: string; subject: Subject; expect: Facet; q: string; label: string }> = [
  // ── The Act: the law operating ──────────────────────────────────────
  { id: "act-general", subject: "scst", expect: "use", label: "The Act generally",
    q: '"SC/ST Act" OR "atrocities act" India' },
  { id: "act-registered", subject: "scst", expect: "use", label: "Cases registered",
    q: '"SC/ST Act" case registered FIR' },
  { id: "act-convicted", subject: "scst", expect: "use", label: "Convictions",
    q: '"SC/ST Act" convicted sentenced court' },
  { id: "act-atrocity", subject: "scst", expect: "use", label: "Atrocities reported",
    q: 'Dalit atrocity assault India police case' },
  { id: "act-compensation", subject: "scst", expect: "use", label: "Compensation and relief",
    q: '"atrocities act" compensation relief victim' },
  { id: "act-pendency", subject: "scst", expect: "use", label: "Pendency and special courts",
    q: '"SC/ST Act" special court pending cases' },

  // ── The Act: a court acquitting ─────────────────────────────────────
  { id: "act-acquittal", subject: "scst", expect: "acquittal", label: "Acquittals",
    q: '"SC/ST Act" acquitted accused court' },
  { id: "act-hostile", subject: "scst", expect: "acquittal", label: "Hostile witnesses",
    q: '"atrocities act" witnesses turned hostile acquittal' },

  // ── The Act: somebody alleging misuse ───────────────────────────────
  { id: "act-misuse-claim", subject: "scst", expect: "allegation", label: "Misuse alleged",
    q: '"SC/ST Act" misuse alleged demand amendment' },
  { id: "act-dilution", subject: "scst", expect: "allegation", label: "Dilution and amendment",
    q: '"SC/ST Act" amendment Supreme Court dilution protest' },

  // ── The Act: a court finding a complaint false ──────────────────────
  { id: "act-false", subject: "scst", expect: "false-finding", label: "Complaints found false",
    q: '"SC/ST Act" false case quashed High Court' },
  { id: "act-fabricated", subject: "scst", expect: "false-finding", label: "Fabricated complaints",
    q: '"atrocities act" fabricated complaint action against complainant' },

  // ── PM SHRI: the scheme operating ───────────────────────────────────
  { id: "shri-general", subject: "pmshri", expect: "use", label: "The scheme generally",
    q: '"PM SHRI" schools scheme' },
  { id: "shri-sanctioned", subject: "pmshri", expect: "use", label: "Schools sanctioned",
    q: '"PM SHRI" schools sanctioned selected state' },
  { id: "shri-funds", subject: "pmshri", expect: "use", label: "Funds released",
    q: '"PM SHRI" crore funds released education ministry' },
  { id: "shri-upgrade", subject: "pmshri", expect: "use", label: "Upgrades and facilities",
    q: '"PM SHRI" school upgraded facilities students' },

  // ── PM SHRI: the dispute ────────────────────────────────────────────
  { id: "shri-mou", subject: "pmshri", expect: "dispute", label: "States and the memorandum",
    q: '"PM SHRI" MoU state refused sign' },
  { id: "shri-withheld", subject: "pmshri", expect: "dispute", label: "Funds withheld",
    q: '"PM SHRI" Samagra Shiksha funds withheld Tamil Nadu Kerala' },
  { id: "shri-nep", subject: "pmshri", expect: "dispute", label: "The policy behind it",
    q: '"PM SHRI" National Education Policy states opposition' },
  { id: "shri-criticism", subject: "pmshri", expect: "dispute", label: "Criticism of the scheme",
    q: '"PM SHRI" criticism teachers opposition three language' },
];

export interface SearchItem {
  id: string;
  headline: string;
  subject: Subject;
  facet: Facet;
  outlet: string | null;
  published: string;
  url: string;
  /** Which queries returned it. An item may be returned by several. */
  queries: string[];
  /** Which index. Recorded because they carry different outlets. */
  indexes: string[];
  firstSeen: string;
}

/** A headline reduced to its words, for spotting the same story twice. */
function keyOf(headline: string): string {
  return headline.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 90);
}

interface Stored { items?: SearchItem[] }

async function main(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const stored: Stored = await readFile(OUT, "utf8").then((t) => JSON.parse(t) as Stored).catch(() => ({}));

  const found = new Map<string, SearchItem>((stored.items ?? []).map((i) => [keyOf(i.headline), i]));
  const carried = found.size;

  const perQuery: Array<{
    id: string; label: string; subject: Subject; expect: Facet;
    google: number; bing: number; kept: number; offSubject: number;
  }> = [];

  for (const q of QUERIES) {
    let google = 0;
    let bing = 0;
    let kept = 0;
    let offSubject = 0;

    for (const [index, url] of [["google", GOOGLE(q.q)], ["bing", BING(q.q)]] as const) {
      await pace();
      const res = await getText(url, { timeoutMs: 40_000, retries: 1, cacheMs: 0 });
      if (!res.ok || !res.data) {
        console.log(`  ${q.id}/${index}: ${res.error ?? "no body"}`);
        continue;
      }
      const rows = parseFeed(res.data);
      if (index === "google") google = rows.length; else bing = rows.length;

      for (const r of rows) {
        const headline = (r.title ?? "").trim();
        if (headline.length < 12) continue;
        /*
         * The query asked for one subject; the index answers with what it
         * ranks. An item whose own headline is not on subject is dropped and
         * counted, because a search that drifts is worth knowing about and a
         * register that silently keeps the drift is worth nothing.
         */
        const subject = subjectOf(headline);
        if (subject !== q.subject) { offSubject++; continue; }

        const key = keyOf(headline);
        const prev = found.get(key);
        if (prev) {
          if (!prev.queries.includes(q.id)) prev.queries.push(q.id);
          if (!prev.indexes.includes(index)) prev.indexes.push(index);
          continue;
        }
        found.set(key, {
          id: key,
          headline,
          subject,
          facet: facetOf(headline, subject),
          outlet: r.publisher?.trim() || null,
          published: (r.publishedAt ?? "").slice(0, 10) || today,
          url: r.url ?? "",
          queries: [q.id],
          indexes: [index],
          firstSeen: today,
        });
        kept++;
      }
    }

    perQuery.push({ id: q.id, label: q.label, subject: q.subject, expect: q.expect, google, bing, kept, offSubject });
    console.log(`  ${q.label} (${q.subject}): ${google}+${bing} returned, ${kept} new, ${offSubject} off subject`);
  }

  const items = [...found.values()];
  if (items.length === 0) {
    throw new Error("no items collected and none stored — refusing to publish an empty register");
  }

  const tally = <T extends string>(pick: (i: SearchItem) => T | null): Array<{ key: T; n: number }> => {
    const m = new Map<T, number>();
    for (const i of items) { const k = pick(i); if (k !== null) m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n);
  };

  const scst = items.filter((i) => i.subject === "scst");
  const pmshri = items.filter((i) => i.subject === "pmshri");

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT, JSON.stringify({
    builtAt: new Date().toISOString(),
    source:
      "Google News and Bing News keyless RSS, queried separately per tier, three seconds apart, "
      + "merged across runs. Each item carries the outlet the index names as its source.",
    method:
      "Queries are asked separately rather than as one broad search, so the rarest tier — a court "
      + "finding a complaint false — is reached instead of being buried under the commonest. Every "
      + "item is classified from its own headline, not from the query that returned it, and an item "
      + "whose headline is not on subject is dropped and counted.",
    refusal:
      "An item here is evidence that an outlet published a headline on a date. It is not a verified "
      + "fact and it is not a sample of coverage. No rate of any kind is computed from these.",
    cannotSay: [
      "How often the Act is misused. Only a court explicitly finding a specific complaint false is evidence of that. An acquittal is not: it can follow from a false complaint and equally from a hostile witness, from intimidation of the complainant, from an investigation that never gathered the caste-certificate evidence the statute requires, or from a compromise outside court — and no public dataset separates them.",
      "What share of coverage is about anything. These counts are per query, and each tier was asked for by name. Fifty items returned for 'false complaint' and fifty for 'acquitted' says both queries were asked and answered, not that the outcomes are equally common.",
      "How much coverage a subject received. A search index returns what it ranks, from the outlets it carries, for the words it was given. Counting these by year measures the index.",
      "That a headline is accurate. The register records that it was published, by whom, and when. The link is there so a reader goes and reads it.",
    ],
    counts: {
      items: items.length,
      addedThisRun: items.length - carried,
      carriedFromEarlierRuns: carried,
      withOutlet: items.filter((i) => i.outlet !== null).length,
      bySubject: { scst: scst.length, pmshri: pmshri.length },
      queriesAsked: QUERIES.length,
      offSubjectDropped: perQuery.reduce((a, q) => a + q.offSubject, 0),
    },
    byFacet: tally((i) => i.facet),
    byOutlet: tally((i) => i.outlet).slice(0, 60),
    perQuery,
    items,
  }, null, 2) + "\n", "utf8");

  console.log(
    `\nWrote ${OUT}: ${items.length} items (${scst.length} Act, ${pmshri.length} scheme), `
    + `${items.length - carried} new this run.`,
  );
}

if (isEntryPoint(import.meta.url)) {
  void main();
}
