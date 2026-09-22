/**
 * Published reporting on caste atrocities and on school policy, gathered from
 * the reference lists that cite it.
 *
 * `npm run rights:citations`. Writes data/rights/citations.json. CI only.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 *
 * The obvious way to collect news evidence is to read news feeds. The first
 * sweep of the five newsrooms that answer a script saw 199 items and matched
 * exactly one. That is not a bug — an RSS feed carries roughly a day of a
 * general national desk, and neither the SC/ST Act nor PM SHRI is a daily
 * story. At that rate a register of five hundred items takes about four
 * months, so the feeds are a live tripwire and not a way to reach volume.
 *
 * Volume has to come from an archive of coverage that already exists. English
 * Wikipedia's articles on this subject carry large reference lists — the Act's
 * own article cites 112 references, the caste-violence article 101 — and every
 * `{{cite news}}` in them is a dated, attributed, linked piece of published
 * reporting. Harvesting those citations is a way of reading a bibliography
 * that editors have already assembled, over two decades, with sources.
 *
 * ── What a citation is and is not ────────────────────────────────────────
 *
 * A harvested citation is evidence that an outlet published a headline on a
 * date. It is not evidence that the headline was true, it is not a verified
 * fact, and it is not a sample of coverage.
 *
 * That last point is the one that could mislead. These citations are what
 * Wikipedia editors reached for, which skews hard towards the cases that
 * became famous — Khairlanji, Una, Hathras — and away from the ordinary
 * registrations that make up almost all of the Act's use. Counting citations
 * by year measures when editors were writing, not when atrocities happened.
 * So nothing here is turned into a time series, a trend or a rate, and the
 * page that displays it says all of this in its own words.
 *
 * Wikipedia's own prose is not used for anything. Only the citation metadata
 * — outlet, headline, date, URL — is read, and the article a citation came
 * from is recorded so a reader can see the bibliography they are looking at.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "../lib/http";
import { isEntryPoint } from "../lib/entry";
import { subjectOf, facetOf, type Subject, type Facet } from "./rights-news";

const OUT_DIR = join(process.cwd(), "data", "rights");
const OUT = join(OUT_DIR, "citations.json");
const API = "https://en.wikipedia.org/w/api.php";

/** One second between requests. Wikipedia asks for it and this is a small job. */
const GAP_MS = 1000;
let last = 0;
async function pace(): Promise<void> {
  const w = GAP_MS - (Date.now() - last);
  if (w > 0) await new Promise((r) => setTimeout(r, w));
  last = Date.now();
}

/**
 * The bibliographies to read.
 *
 * Chosen as the articles whose reference lists are about this subject: the
 * statute, the pattern of violence it addresses, the individual cases that
 * were reported at length, and — for the scheme — the policy it implements
 * and the programme its money is routed through.
 *
 * An article that does not exist answers 200 with an empty parse, so the run
 * reports which titles yielded nothing rather than assuming they were empty.
 */
const ARTICLES: Array<{ title: string; note: string }> = [
  // The statute and its frame.
  { title: "Scheduled Castes and Scheduled Tribes (Prevention of Atrocities) Act, 1989", note: "The Act itself" },
  { title: "Caste-related violence in India", note: "The pattern the Act addresses" },
  { title: "Dalit", note: "The communities the Act protects" },
  { title: "Untouchability", note: "The practice the Act criminalises" },
  { title: "Casteism", note: "The wider frame" },
  { title: "Reservation in India", note: "The adjacent policy argued about in the same terms" },
  { title: "Manual scavenging", note: "A caste practice with its own statute and its own enforcement record" },
  { title: "Khap panchayat", note: "Extra-legal caste authority" },
  { title: "Honor killing in India", note: "Caste violence reported under another name" },
  { title: "Atrocities against Dalits in India", note: "If it exists under this title" },

  // Individual cases, which is where the reporting is.
  { title: "Khairlanji massacre", note: "2006" },
  { title: "2016 Una flogging incident", note: "2016" },
  { title: "Hathras gang rape and murder", note: "2020" },
  { title: "Bhima Koregaon violence", note: "2018" },
  { title: "Kambalapalli massacre", note: "2000" },
  { title: "Tsunduru massacre", note: "1991" },
  { title: "Karamchedu massacre", note: "1985" },
  { title: "Bathani Tola massacre", note: "1996" },
  { title: "Laxmanpur Bathe massacre", note: "1997" },
  { title: "Melavalavu massacre", note: "1997" },
  { title: "Bant Singh", note: "2006" },
  { title: "Rohith Vemula", note: "2016" },
  { title: "2018 Indian Dalit protests", note: "The protests after the Subhash Kashinath Mahajan ruling" },
  { title: "Delta Meghwal rape case", note: "2016" },
  { title: "Mirchpur violence", note: "2010" },
  { title: "Gohana riots", note: "2005" },
  { title: "Bhagana rape case", note: "2014" },
  { title: "Vachathi case", note: "1992, and its judgment thirty-one years later" },
  { title: "Kilvenmani massacre", note: "1968, before the Act" },
  { title: "Chunduru massacre", note: "Alternate title for Tsunduru" },

  // The scheme and its policy frame.
  { title: "National Education Policy 2020", note: "The policy PM SHRI demonstrates" },
  { title: "Samagra Shiksha Abhiyan", note: "The programme PM SHRI money is routed through" },
  { title: "Right of Children to Free and Compulsory Education Act, 2009", note: "The statutory floor under school policy" },
  { title: "Education in India", note: "The wider frame" },
  { title: "Kendriya Vidyalaya", note: "The central school system PM SHRI schools are compared to" },
  { title: "Navodaya Vidyalaya", note: "The other central school system" },
  { title: "Ministry of Education (India)", note: "The ministry that runs the scheme" },
  { title: "PM SHRI", note: "The scheme, if an article has since been written" },
];

export interface Citation {
  /** Stable handle: the URL where there is one, else outlet plus headline. */
  id: string;
  headline: string;
  outlet: string | null;
  /** As printed in the citation, normalised to YYYY-MM-DD when it parses. */
  published: string | null;
  url: string | null;
  subject: Subject;
  facet: Facet;
  /** Which bibliography it was found in. A citation can appear in several. */
  articles: string[];
  /** cite news, cite web, cite report — recorded, because they differ in weight. */
  template: string;
}

/**
 * Citation templates out of wikitext.
 *
 * Templates nest — a `{{cite news}}` can hold a `{{cite web}}` in a quote
 * field, and more commonly holds `{{ill}}` or `{{lang}}` in a title. So this
 * walks the braces rather than matching a lazy `{{cite[^}]*}}`, which stops at
 * the first inner close and truncates the title exactly where it gets
 * interesting.
 */
export function parseCitations(wikitext: string): Array<{ template: string; fields: Record<string, string> }> {
  const out: Array<{ template: string; fields: Record<string, string> }> = [];
  const re = /\{\{\s*(cite\s+(?:news|web|report|magazine|journal|press release))\s*\|/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(wikitext)) !== null) {
    const template = (m[1] ?? "").toLowerCase().replace(/\s+/g, " ");
    // Walk from the opening brace to its match.
    let depth = 1;
    let i = (m.index ?? 0) + m[0].length;
    const start = i;
    for (; i < wikitext.length && depth > 0; i++) {
      if (wikitext.startsWith("{{", i)) { depth++; i++; }
      else if (wikitext.startsWith("}}", i)) { depth--; i++; }
    }
    if (depth !== 0) continue; // Unbalanced: skip rather than guess where it ended.
    const body = wikitext.slice(start, i - 2);

    // Split on pipes at depth zero, so a nested template's pipes stay inside.
    const fields: Record<string, string> = {};
    let d = 0;
    let cur = "";
    const parts: string[] = [];
    for (let k = 0; k < body.length; k++) {
      if (body.startsWith("{{", k) || body.startsWith("[[", k)) { d++; cur += body[k]; continue; }
      if (body.startsWith("}}", k) || body.startsWith("]]", k)) { d--; cur += body[k]; continue; }
      if (body[k] === "|" && d <= 0) { parts.push(cur); cur = ""; continue; }
      cur += body[k];
    }
    parts.push(cur);
    for (const p of parts) {
      const eq = p.indexOf("=");
      if (eq < 0) continue;
      const key = p.slice(0, eq).trim().toLowerCase();
      const val = p.slice(eq + 1).trim();
      if (key !== "" && val !== "") fields[key] = val;
    }
    out.push({ template, fields });
  }
  return out;
}

/** Wiki markup out of a citation field: links, formatting, stray templates. */
export function cleanField(s: string): string {
  let t = s;
  for (let guard = 0; guard < 6; guard++) {
    const before = t;
    t = t.replace(/\[\[([^[\]|]+)\|([^[\]]+)\]\]/g, "$2").replace(/\[\[([^[\]]+)\]\]/g, "$1");
    t = t.replace(/\{\{[^{}]*\}\}/g, " ");
    if (t === before) break;
  }
  return t
    .replace(/<ref[^>]*\/>/gi, " ").replace(/<\/?[a-z][^>]*>/gi, " ")
    .replace(/'''?/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim();
}

/**
 * A citation date, normalised where it parses and dropped where it does not.
 *
 * Citations carry "12 March 2019", "2019-03-12", "March 12, 2019" and bare
 * "2019". A bare year is kept as a year, because for a 1991 massacre that is
 * often all there is, and losing it would push the case out of the record
 * entirely. Nothing downstream treats these as a series.
 */
export function citationDate(raw: string): string | null {
  const s = cleanField(raw);
  if (s === "") return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  const dmy = /^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})/.exec(s);
  if (dmy) {
    const mi = MONTHS.indexOf((dmy[2] ?? "").toLowerCase());
    if (mi >= 0) return `${dmy[3]}-${String(mi + 1).padStart(2, "0")}-${String(Number(dmy[1])).padStart(2, "0")}`;
  }
  const mdy = /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/.exec(s);
  if (mdy) {
    const mi = MONTHS.indexOf((mdy[1] ?? "").toLowerCase());
    if (mi >= 0) return `${mdy[3]}-${String(mi + 1).padStart(2, "0")}-${String(Number(mdy[2])).padStart(2, "0")}`;
  }
  const year = /\b(19|20)\d{2}\b/.exec(s);
  return year ? year[0] : null;
}

/** The outlet, from whichever field the citation used for it. */
export function outletOf(fields: Record<string, string>): string | null {
  for (const k of ["work", "newspaper", "website", "publisher", "magazine", "journal", "agency"]) {
    const v = fields[k];
    if (v !== undefined) {
      const c = cleanField(v);
      if (c !== "") return c;
    }
  }
  return null;
}

async function wikitextOf(title: string): Promise<string | null> {
  await pace();
  const url = `${API}?action=parse&format=json&prop=wikitext&redirects=1&page=${encodeURIComponent(title)}`;
  const res = await getText(url, { timeoutMs: 45_000, retries: 1, cacheMs: 0 });
  if (!res.ok || !res.data) return null;
  try {
    const body = JSON.parse(res.data) as { parse?: { wikitext?: { "*"?: string } } };
    return body.parse?.wikitext?.["*"] ?? null;
  } catch { return null; }
}

async function main(): Promise<void> {
  const found = new Map<string, Citation>();
  const perArticle: Array<{ title: string; note: string; ok: boolean; citations: number; kept: number }> = [];

  for (const a of ARTICLES) {
    const wt = await wikitextOf(a.title);
    if (wt === null) {
      perArticle.push({ title: a.title, note: a.note, ok: false, citations: 0, kept: 0 });
      console.log(`  ${a.title}: no article`);
      continue;
    }
    const cites = parseCitations(wt);
    let kept = 0;
    for (const c of cites) {
      const headline = cleanField(c.fields["title"] ?? "");
      if (headline.length < 12) continue;
      /*
       * The subject test runs over the headline AND the article it was cited
       * in. A headline reading "Two held in Bihar killing" is on-subject in
       * the Khairlanji bibliography and meaningless on its own, and dropping
       * it would throw away most of the case reporting.
       */
      const subject = subjectOf(headline) ?? subjectOf(`${headline} ${a.title}`);
      if (subject === null) continue;
      const url = cleanField(c.fields["url"] ?? "") || null;
      const id = url ?? `${outletOf(c.fields) ?? "?"}::${headline.toLowerCase()}`;
      const prev = found.get(id);
      if (prev) {
        if (!prev.articles.includes(a.title)) prev.articles.push(a.title);
        continue;
      }
      found.set(id, {
        id,
        headline,
        outlet: outletOf(c.fields),
        published: citationDate(c.fields["date"] ?? c.fields["publication-date"] ?? c.fields["year"] ?? ""),
        url,
        subject,
        facet: facetOf(`${headline} ${a.title}`, subject),
        articles: [a.title],
        template: c.template,
      });
      kept++;
    }
    perArticle.push({ title: a.title, note: a.note, ok: true, citations: cites.length, kept });
    console.log(`  ${a.title}: ${cites.length} citations, ${kept} on subject`);
  }

  const citations = [...found.values()];
  if (citations.length === 0) {
    throw new Error("no citations parsed — refusing to publish an empty register over a good one");
  }

  const tally = <T extends string>(pick: (c: Citation) => T | null): Array<{ key: T; n: number }> => {
    const m = new Map<T, number>();
    for (const c of citations) { const k = pick(c); if (k !== null) m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m].map(([key, n]) => ({ key, n })).sort((x, y) => y.n - x.n);
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT, JSON.stringify({
    builtAt: new Date().toISOString(),
    source:
      "Citation templates in the reference lists of English Wikipedia articles on caste "
      + "atrocities, the SC/ST (Prevention of Atrocities) Act, and central school policy. Only "
      + "citation metadata is read — outlet, headline, date, URL. No Wikipedia prose is used.",
    method:
      "Each article's wikitext is fetched once and its cite-news, cite-web, cite-report, "
      + "cite-magazine, cite-journal and cite-press-release templates are walked brace by brace, "
      + "so a nested template inside a title does not truncate it. A citation is kept when its "
      + "headline, or its headline read together with the article citing it, is on subject.",
    refusal:
      "A citation here is evidence that an outlet published a headline on a date. It is not "
      + "evidence that the headline was true, it is not a verified fact, and it is not a sample "
      + "of coverage.",
    cannotSay: [
      "How much coverage a subject received, in any year. These are the pieces Wikipedia editors reached for, which skews hard towards the cases that became famous and away from the ordinary registrations that are almost all of the Act's use. Counting these by year measures when editors were writing.",
      "That a cited report is accurate. The register records that it was published and cited; the link is there so a reader goes and reads it.",
      "Anything about the frequency of atrocities, acquittals or misuse. A bibliography is not a dataset.",
      "That a case absent from this register did not happen. Most cases were never written up in an encyclopaedia, and the famous ones are famous partly because they were exceptional.",
    ],
    counts: {
      citations: citations.length,
      withUrl: citations.filter((c) => c.url !== null).length,
      withOutlet: citations.filter((c) => c.outlet !== null).length,
      withDate: citations.filter((c) => c.published !== null).length,
      articlesRead: perArticle.filter((a) => a.ok).length,
      articlesMissing: perArticle.filter((a) => !a.ok).length,
      bySubject: {
        scst: citations.filter((c) => c.subject === "scst").length,
        pmshri: citations.filter((c) => c.subject === "pmshri").length,
      },
    },
    byFacet: tally((c) => c.facet),
    byOutlet: tally((c) => c.outlet).slice(0, 60),
    byTemplate: tally((c) => c.template),
    perArticle,
    citations,
  }, null, 2) + "\n", "utf8");

  console.log(
    `\nWrote ${OUT}: ${citations.length} citations from ${perArticle.filter((a) => a.ok).length} articles `
    + `(${citations.filter((c) => c.url !== null).length} linked, `
    + `${citations.filter((c) => c.published !== null).length} dated).`,
  );
}

if (isEntryPoint(import.meta.url)) {
  void main();
}
