/**
 * Data-source probe.
 *
 * `npm run sources:probe`. Fetches candidate Indian statistical endpoints and
 * records what came back: status, content type, size, and — the part that
 * matters — whether the body is something a connector can read without
 * guessing. Publishes no data.
 *
 * This is the generalised version of the SATP probe. That one was written
 * after a connector built against an assumed table layout published incident
 * counts as civilian deaths. The lesson generalises: this sandbox's network
 * policy denies every Indian government host, so anything I write here about a
 * page I have not seen is a guess, and a guess that typechecks looks exactly
 * like knowledge.
 *
 * The ranking it produces is the point. A CSV or XLSX endpoint is worth ten
 * HTML dashboards, and the Economic Survey's statistical appendix is published
 * as spreadsheets rather than only as the PDF everyone cites — if that holds,
 * it is a far better mechanism than parsing the Survey document itself.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "./lib/http";

const ROOT = process.cwd();

interface Candidate {
  id: string;
  /** Which series this would feed, so a dead endpoint names its casualty. */
  feeds: string[];
  publisher: string;
  url: string;
  /** What the endpoint is expected to return, for comparison against reality. */
  expect: "csv" | "xlsx" | "json" | "html-table" | "html";
}

/**
 * Candidates, ordered by how machine-readable they are expected to be.
 *
 * Nothing here is confirmed. The whole purpose is to find out which of them
 * answer, and in what shape, before a line of connector code is written.
 */
const CANDIDATES: Candidate[] = [
  /* --- Economic Survey: the statistical appendix, not the prose --- */
  {
    id: "econ-survey-appendix",
    feeds: ["many"],
    publisher: "Ministry of Finance",
    url: "https://www.indiabudget.gov.in/economicsurvey/",
    expect: "html",
  },
  {
    id: "econ-survey-stat-appendix",
    feeds: ["many"],
    publisher: "Ministry of Finance",
    url: "https://www.indiabudget.gov.in/economicsurvey/doc/stat/tableofcontents.pdf",
    expect: "html",
  },

  /* --- RBI: Handbook of Statistics publishes per-table files --- */
  {
    id: "rbi-handbook",
    feeds: ["food-inflation", "demat-accounts", "many"],
    publisher: "Reserve Bank of India",
    url: "https://www.rbi.org.in/Scripts/AnnualPublications.aspx?head=Handbook%20of%20Statistics%20on%20Indian%20Economy",
    expect: "html",
  },
  {
    id: "rbi-dbie",
    feeds: ["food-inflation", "many"],
    publisher: "Reserve Bank of India",
    url: "https://data.rbi.org.in/DBIE/#/dbie/home",
    expect: "html",
  },

  /* --- UPI: NPCI publishes monthly product statistics --- */
  {
    id: "npci-upi-stats",
    feeds: ["upi-transactions", "upi-value"],
    publisher: "NPCI",
    url: "https://www.npci.org.in/what-we-do/upi/product-statistics",
    expect: "html-table",
  },
  {
    id: "npci-upi-ecosystem",
    feeds: ["upi-transactions", "upi-value"],
    publisher: "NPCI",
    url: "https://www.npci.org.in/statistics",
    expect: "html-table",
  },

  /* --- EV: VAHAN is the register; the dashboard is a form post --- */
  {
    id: "vahan-dashboard",
    feeds: ["ev-registrations", "ev-share-registrations"],
    publisher: "Ministry of Road Transport & Highways",
    url: "https://vahan.parivahan.gov.in/vahan4dashboard/",
    expect: "html",
  },
  {
    id: "vahan-analytics",
    feeds: ["ev-registrations"],
    publisher: "Ministry of Road Transport & Highways",
    url: "https://analytics.parivahan.gov.in/analytics/",
    expect: "html",
  },
  {
    id: "pib-ev",
    feeds: ["ev-registrations"],
    publisher: "Press Information Bureau",
    url: "https://www.pib.gov.in/PressReleseDetail.aspx?PRID=2000000",
    expect: "html",
  },

  /* --- Prices: MoSPI publishes CPI series --- */
  {
    id: "mospi-cpi",
    feeds: ["food-inflation"],
    publisher: "Ministry of Statistics and Programme Implementation",
    url: "https://www.mospi.gov.in/web/mospi/cpi",
    expect: "html",
  },
  {
    id: "mospi-home",
    feeds: ["food-inflation", "many"],
    publisher: "Ministry of Statistics and Programme Implementation",
    url: "https://www.mospi.gov.in/",
    expect: "html",
  },

  /* --- Dataful: an aggregator that cleans and republishes Indian official
         series, which is exactly the shape this project keeps wanting. Worth
         probing before every other candidate here, because one well-formed
         catalogue beats a dozen dashboards. Licensing and whether downloads
         sit behind an account are the open questions the probe answers. --- */
  {
    id: "dataful-catalog",
    feeds: ["many"],
    publisher: "Dataful",
    url: "https://dataful.in/datasets/",
    expect: "html",
  },
  {
    id: "dataful-search-ev",
    feeds: ["ev-registrations", "ev-share-registrations"],
    publisher: "Dataful",
    url: "https://dataful.in/datasets/?q=electric+vehicle",
    expect: "html",
  },
  {
    id: "dataful-search-upi",
    feeds: ["upi-transactions", "upi-value"],
    publisher: "Dataful",
    url: "https://dataful.in/datasets/?q=UPI",
    expect: "html",
  },
  {
    id: "dataful-search-cpi",
    feeds: ["food-inflation"],
    publisher: "Dataful",
    url: "https://dataful.in/datasets/?q=consumer+price+index",
    expect: "html",
  },
  {
    id: "dataful-api-root",
    feeds: ["many"],
    publisher: "Dataful",
    url: "https://dataful.in/api/",
    expect: "json",
  },

  /* --- Open data portal: CSV downloads, no key on the catalogue pages --- */
  {
    id: "datagov-catalog",
    feeds: ["many"],
    publisher: "data.gov.in",
    url: "https://www.data.gov.in/catalogs",
    expect: "html",
  },

  /* --- Schemes --- */
  {
    id: "pmkisan-dashboard",
    feeds: ["pm-kisan-beneficiaries", "pm-kisan-disbursed"],
    publisher: "Ministry of Agriculture",
    url: "https://pmkisan.gov.in/Dashboard.aspx",
    expect: "html",
  },

  /* --- Markets --- */
  {
    id: "sebi-stats",
    feeds: ["demat-accounts"],
    publisher: "SEBI",
    url: "https://www.sebi.gov.in/statistics.html",
    expect: "html",
  },
  {
    id: "amfi-stats",
    feeds: ["mutual-fund-sip-accounts"],
    publisher: "AMFI",
    url: "https://www.amfiindia.com/research-information/amfi-monthly",
    expect: "html-table",
  },

  /* --- Telecom --- */
  {
    id: "trai-reports",
    feeds: ["mobile-data-price-per-gb", "data-per-subscriber"],
    publisher: "TRAI",
    url: "https://www.trai.gov.in/release-publication/reports",
    expect: "html",
  },

  /* --- Aviation --- */
  {
    id: "dgca-traffic",
    feeds: ["domestic-air-passengers"],
    publisher: "DGCA",
    url: "https://www.dgca.gov.in/digigov-portal/?page=jsp/dgca/InventoryList/dataReports/aviationDataStatistics/monthlyDomestic/monthlyDomestic.jsp",
    expect: "html",
  },
];

interface Finding {
  id: string;
  publisher: string;
  url: string;
  feeds: string[];
  expect: Candidate["expect"];
  status: "ok" | "failed";
  detail?: string;
  bytes?: number;
  /** What the body actually looks like, judged from its first bytes. */
  looksLike?: "html" | "json" | "csv" | "xml" | "binary" | "unknown";
  title?: string;
  /** Tables carrying year-like rows — the shape a connector can use. */
  yearTables?: number;
  /** Links to files a connector could fetch directly. */
  dataLinks?: string[];
  /** How usable this is, highest first. */
  score?: number;
}

function sniff(body: string): Finding["looksLike"] {
  const head = body.slice(0, 400).trim();
  if (/^[{[]/.test(head)) return "json";
  if (/^<\?xml|^<(rss|feed)\b/i.test(head)) return "xml";
  if (/^</.test(head)) return "html";
  if (/^PK/.test(head)) return "binary"; // xlsx/zip
  if (/^%PDF/.test(head)) return "binary";
  if (head.split("\n")[0]?.includes(",")) return "csv";
  return "unknown";
}

/** Downloadable data files linked from a page — the prize when one exists. */
function dataLinksIn(html: string, base: string): string[] {
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1] ?? "");
  const data = hrefs.filter((h) => /\.(csv|xlsx?|json)(\?|$)/i.test(h));
  const abs = data.map((h) => {
    if (/^https?:\/\//i.test(h)) return h;
    try {
      return new URL(h, base).toString();
    } catch {
      return h;
    }
  });
  return [...new Set(abs)].slice(0, 12);
}

function yearTableCount(html: string): number {
  const tables = html.match(/<table\b[\s\S]*?<\/table>/gi) ?? [];
  return tables.filter((t) => {
    const rows = t.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
    const yearish = rows.filter((r) => /(^|>)\s*(19|20)\d{2}\s*(<|$)/.test(r)).length;
    return yearish >= 3;
  }).length;
}

/**
 * How useful this endpoint is, highest first.
 *
 * A linked CSV or spreadsheet outranks everything: it is a file with a fixed
 * shape rather than a page whose layout moves. A year-indexed HTML table comes
 * next. A page that merely answers is worth recording but is not a source.
 */
function scoreOf(f: Finding): number {
  if (f.status !== "ok") return 0;
  let n = 1;
  if ((f.dataLinks?.length ?? 0) > 0) n += 100 + (f.dataLinks?.length ?? 0);
  if (f.looksLike === "json" || f.looksLike === "csv") n += 60;
  if ((f.yearTables ?? 0) > 0) n += 30 + (f.yearTables ?? 0);
  return n;
}

async function probe(c: Candidate): Promise<Finding> {
  const base: Finding = {
    id: c.id,
    publisher: c.publisher,
    url: c.url,
    feeds: c.feeds,
    expect: c.expect,
    status: "failed",
  };
  const res = await getText(c.url, { cacheMs: 0, timeoutMs: 30_000, retries: 1 });
  if (!res.ok || !res.data) return { ...base, detail: res.error ?? "no body" };

  const looksLike = sniff(res.data);
  const finding: Finding = {
    ...base,
    status: "ok",
    bytes: res.data.length,
    looksLike,
    title: (res.data.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100),
    yearTables: looksLike === "html" ? yearTableCount(res.data) : 0,
    dataLinks: looksLike === "html" ? dataLinksIn(res.data, c.url) : [],
  };
  return { ...finding, score: scoreOf(finding) };
}

async function main() {
  const log = (m: string) => process.stdout.write(`${m}\n`);
  log(`Probing ${CANDIDATES.length} candidate data sources — publishes nothing\n`);

  const findings: Finding[] = [];
  for (const c of CANDIDATES) {
    const f = await probe(c);
    findings.push(f);
    if (f.status === "failed") {
      log(`  FAIL ${f.id.padEnd(26)} ${f.detail}`);
      continue;
    }
    log(
      `  ok   ${f.id.padEnd(26)} ${String(f.looksLike).padEnd(7)} ` +
        `${String(f.bytes).padStart(8)}b  tables:${f.yearTables}  files:${f.dataLinks?.length ?? 0}`,
    );
    for (const l of (f.dataLinks ?? []).slice(0, 4)) log(`         -> ${l}`);
  }

  const ranked = [...findings].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  await mkdir(join(ROOT, "data/live"), { recursive: true });
  await writeFile(
    join(ROOT, "data/live/source-probe.json"),
    JSON.stringify({ probedAt: new Date().toISOString(), findings: ranked }, null, 2) + "\n",
    "utf8",
  );

  const usable = ranked.filter((f) => (f.score ?? 0) > 30);
  log("");
  log(`${findings.filter((f) => f.status === "ok").length}/${findings.length} answered`);
  log(`${usable.length} look connectable:`);
  for (const f of usable) log(`  ${f.id} — ${f.publisher} (score ${f.score})`);
  log("");
  log("Wrote data/live/source-probe.json — read it before writing any connector.");
}

main().catch((err: unknown) => {
  process.stderr.write(`source probe crashed: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
