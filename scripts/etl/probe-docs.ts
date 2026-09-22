/**
 * Which document, exactly.
 *
 * The last probe counted: NCRB's 2022 page carries thirty-five PDFs, the
 * Ministry of Social Justice's report page carries sixty-three. A count is
 * enough to know a source is worth opening and useless for opening it. The
 * SC/ST Act's national figures — registrations, chargesheets, convictions,
 * pendency — live in exactly one of those thirty-five files, and guessing
 * which would be a guess with a plausible-looking answer at the end of it.
 *
 * So this lists them: for every document link on a small set of official
 * pages, the href and the text of the link that points at it. Then the choice
 * of which file to read is a reading rather than a guess.
 *
 * ── What this publishes ──────────────────────────────────────────────────
 *
 * Link text and link targets. It downloads no PDF, extracts no table and
 * publishes no figure about the Act or the scheme. A link whose text says
 * "Crimes against SCs" is evidence about a link.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getText } from "./lib/http";

const OUT = join(process.cwd(), "data", "live", "docs-probe.json");

const PAGES: Array<{ id: string; what: string; url: string; keep: RegExp }> = [
  {
    id: "ncrb:2022", what: "NCRB Crime in India 2022 — the year's downloads",
    url: "https://www.ncrb.gov.in/crime-in-india-year-wise.html?year=2022",
    keep: /\.(?:pdf|xlsx?|csv)(?:$|\?)/i,
  },
  {
    id: "ncrb:2021", what: "NCRB Crime in India 2021 — the year's downloads",
    url: "https://www.ncrb.gov.in/crime-in-india-year-wise.html?year=2021",
    keep: /\.(?:pdf|xlsx?|csv)(?:$|\?)/i,
  },
  {
    id: "ncrb:index", what: "NCRB Crime in India — the index",
    url: "https://www.ncrb.gov.in/crime-in-india.html",
    keep: /./,
  },
  {
    id: "msje:reports", what: "Ministry of Social Justice — annual reports",
    url: "https://socialjustice.gov.in/common/76750",
    keep: /\.(?:pdf|xlsx?|csv)(?:$|\?)/i,
  },
  {
    id: "msje:home", what: "Ministry of Social Justice — home",
    url: "https://socialjustice.gov.in/",
    keep: /\.(?:pdf|xlsx?|csv)(?:$|\?)|report|statistic/i,
  },
];

/** Anchors as (href, text) pairs, with the text stripped of markup. */
function anchors(html: string, base: string): Array<{ href: string; text: string }> {
  const out: Array<{ href: string; text: string }> = [];
  for (const m of html.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const raw = m[1] ?? "";
    const text = (m[2] ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    if (raw === "" || raw.startsWith("#") || raw.startsWith("javascript:")) continue;
    let href = raw;
    try { href = new URL(raw, base).toString(); } catch { /* keep as written */ }
    out.push({ href, text });
  }
  return out;
}

async function main(): Promise<void> {
  const findings: unknown[] = [];

  for (const p of PAGES) {
    await new Promise((r) => setTimeout(r, 2500));
    const res = await getText(p.url, { timeoutMs: 45_000, retries: 1, cacheMs: 0 });
    if (!res.ok || !res.data) {
      findings.push({ id: p.id, what: p.what, url: p.url, ok: false, status: res.error ?? "no body" });
      console.log(`  ${p.id}: ${res.error ?? "no body"}`);
      continue;
    }
    const all = anchors(res.data, p.url);
    const kept = all.filter((a) => p.keep.test(a.href) || p.keep.test(a.text));
    // Dedupe by href, keeping the most descriptive link text.
    const byHref = new Map<string, string>();
    for (const a of kept) {
      const prev = byHref.get(a.href);
      if (prev === undefined || a.text.length > prev.length) byHref.set(a.href, a.text);
    }
    const links = [...byHref].map(([href, text]) => ({ href, text })).slice(0, 200);
    findings.push({
      id: p.id, what: p.what, url: p.url, ok: true,
      bytes: res.data.length, anchorsTotal: all.length, kept: links.length, links,
    });
    console.log(`  ${p.id}: ${all.length} links, ${links.length} documents`);
  }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({
    probedAt: new Date().toISOString(),
    question:
      "Which specific official document carries the SC/ST Act's national figures — "
      + "registrations, chargesheets, convictions, pendency — and at what URL?",
    refusal:
      "This file publishes link text and link targets. It downloads no PDF, extracts no table "
      + "and publishes no figure about the Act or the scheme. A link whose text reads 'Crimes "
      + "against SCs' is evidence about a link.",
    findings,
  }, null, 2) + "\n", "utf8");
  console.log(`\nWrote ${OUT}.`);
}

void main();
