/**
 * Checks every programme on the mela against the article it is sourced to.
 *
 * `npm run mela:verify`. Writes data/mela/verified.json. CI only: the sandbox
 * blocks Wikipedia.
 *
 * For each curated programme it fetches the article's opening section as
 * plain text, follows redirects, and asks two things: does the article exist,
 * and does the year this repository attributes to the programme appear in it.
 * A programme that continues an older one has its predecessor checked the
 * same way.
 *
 * ── What "verified" means, exactly ───────────────────────────────────────
 *
 * That the year appears in the opening section of the named article. It is a
 * weaker claim than "the launch year is correct" and it is the claim this
 * makes. A year can appear in an article's lead for another reason — a
 * programme launched in 2015 whose lead mentions a 2016 expansion would pass
 * a check for 2016 — and the page says what the check is rather than calling
 * it proof. What it reliably catches is the typing error: a 2015 entered as a
 * 2016 for an article whose lead never mentions 2016 fails, and a title that
 * points at nothing fails.
 *
 * The opening section rather than the whole article, because a long article
 * contains most years in its range somewhere, and a check that passes on
 * almost anything is not a check.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "../lib/http";
import { isEntryPoint } from "../lib/entry";
import { PROGRAMMES } from "../../../lib/mela-programmes";

const OUT_DIR = join(process.cwd(), "data", "mela");
const OUT = join(OUT_DIR, "verified.json");
const API = "https://en.wikipedia.org/w/api.php";
const GAP_MS = 1100;
/** TextExtracts caps an intro batch at 20 titles. */
const BATCH = 20;

let last = 0;
async function pace(): Promise<void> {
  const w = GAP_MS - (Date.now() - last);
  if (w > 0) await new Promise((r) => setTimeout(r, w));
  last = Date.now();
}

interface Page { requested: string; title: string | null; intro: string; url: string | null }

/**
 * Opening sections for a batch of titles, keyed by the title as requested.
 *
 * The API reports redirects and normalisations separately from the pages, so
 * the map from requested title to final page is rebuilt from both — otherwise
 * "Make in India" and the page it redirects to would look like two different
 * answers and the check would read the redirect as a missing article.
 */
export function mapBatch(body: unknown, requested: string[]): Map<string, Page> {
  const q = (body as { query?: {
    normalized?: Array<{ from: string; to: string }>;
    redirects?: Array<{ from: string; to: string }>;
    pages?: Array<{ title?: string; missing?: boolean; extract?: string; fullurl?: string }>;
  } } | null)?.query;
  const norm = new Map((q?.normalized ?? []).map((n) => [n.from, n.to]));
  const redir = new Map((q?.redirects ?? []).map((r) => [r.from, r.to]));
  const byTitle = new Map((q?.pages ?? []).map((p) => [p.title ?? "", p]));
  const out = new Map<string, Page>();
  for (const r of requested) {
    let t = norm.get(r) ?? r;
    t = redir.get(t) ?? t;
    const p = byTitle.get(t);
    out.set(r, p && !p.missing
      ? { requested: r, title: p.title ?? t, intro: p.extract ?? "", url: p.fullurl ?? null }
      : { requested: r, title: null, intro: "", url: null });
  }
  return out;
}

/** Whether a year appears as a year in a passage — not inside a larger number. */
export function mentionsYear(text: string, year: number): boolean {
  return new RegExp(`(?<![0-9])${year}(?![0-9])`).test(text);
}

async function fetchIntros(titles: string[]): Promise<Map<string, Page>> {
  const all = new Map<string, Page>();
  for (let i = 0; i < titles.length; i += BATCH) {
    const slice = titles.slice(i, i + BATCH);
    await pace();
    const qs = new URLSearchParams({
      action: "query", format: "json", formatversion: "2", redirects: "1",
      prop: "extracts|info", exintro: "1", explaintext: "1", exlimit: String(BATCH),
      inprop: "url", titles: slice.join("|"),
    });
    const res = await getText(`${API}?${qs.toString()}`, { timeoutMs: 45_000, retries: 2, cacheMs: 0 });
    let body: unknown = null;
    if (res.ok && res.data) { try { body = JSON.parse(res.data); } catch { body = null; } }
    for (const [k, v] of mapBatch(body, slice)) all.set(k, v);
  }
  return all;
}

async function main(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const titles = [...new Set(PROGRAMMES.flatMap((p) => [p.article, ...(p.continues ? [p.continues.article] : [])]))];
  const pages = await fetchIntros(titles);

  const results = PROGRAMMES.map((p) => {
    const page = pages.get(p.article);
    let status: "verified" | "missing-article" | "year-not-found" = "verified";
    if (!page || page.title === null) status = "missing-article";
    else if (!mentionsYear(page.intro, p.year)) status = "year-not-found";

    let continues: null | { name: string; year: number; url: string; status: string } = null;
    if (p.continues) {
      const cp = pages.get(p.continues.article);
      const cs = !cp || cp.title === null ? "missing-article"
        : mentionsYear(cp.intro, p.continues.year) ? "verified" : "year-not-found";
      continues = { name: p.continues.name, year: p.continues.year, url: cp?.url ?? "", status: cs };
    }
    console.log(`  ${status === "verified" ? "ok  " : "FAIL"} ${p.year} ${p.name}${status === "verified" ? "" : `  (${status})`}`);
    return {
      id: p.id, status, title: page?.title ?? null, url: page?.url ?? null,
      checkedOn: today, continues,
    };
  });

  const ok = results.filter((r) => r.status === "verified").length;
  if (ok === 0) throw new Error("nothing verified — refusing to publish an empty verification over a good one");

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT, JSON.stringify({
    builtAt: new Date().toISOString(),
    method:
      "For each programme, the opening section of the named English Wikipedia article is fetched "
      + "as plain text with redirects followed, and the stated year must appear in it as a year. "
      + "A predecessor programme is checked the same way.",
    means:
      "Verified means the year appears in the opening section of the named article. It catches "
      + "typing errors and dead titles; it is not proof that the year is the launch year, and the "
      + "page says so.",
    counts: {
      curated: results.length, verified: ok,
      missingArticle: results.filter((r) => r.status === "missing-article").length,
      yearNotFound: results.filter((r) => r.status === "year-not-found").length,
    },
    results,
  }, null, 2) + "\n", "utf8");
  console.log(`\nWrote ${OUT}: ${ok} of ${results.length} verified.`);
}

if (isEntryPoint(import.meta.url)) {
  void main();
}
