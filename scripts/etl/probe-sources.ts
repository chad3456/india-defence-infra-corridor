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
  /**
   * Follow the page's most promising links one hop and report what they return.
   *
   * Set on landing pages that are indexes rather than data. The RBI Handbook,
   * MoSPI's release pages and TRAI's reports list are all navigation: the
   * spreadsheet is a click away, and the first version of this probe reported
   * "ok, no data links" for every one of them because the file is not on the
   * page it looked at. Following is how a real URL gets found instead of
   * guessed, which is the difference this whole probe exists to preserve.
   */
  follow?: boolean;
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

  /* --- Confirmed one hop in by the previous probe run --- */
  //
  // Each of these was found by following an index page, not by guessing a path.
  // They are promoted to first-class candidates so the report says what they
  // return directly, and so a connector can cite a URL this probe has fetched.
  {
    id: "rbi-entity-retail",
    feeds: ["upi-transactions", "upi-value"],
    publisher: "Reserve Bank of India",
    // Named "Entity-wise UPI/IMPS/NETC/NFS/AePS/CTS/BBPS Statistics" on RBI's
    // own statistics index — the only public, non-API route to UPI volumes
    // found so far, NPCI's own statistics pages having answered 403.
    url: "https://www.rbi.org.in/Scripts/EntityWiseRetailStatistics.aspx",
    expect: "html-table",
    follow: true,
  },
  {
    id: "rbi-neft-view",
    feeds: ["upi-transactions", "upi-value"],
    publisher: "Reserve Bank of India",
    url: "https://www.rbi.org.in/Scripts/NEFTView.aspx",
    expect: "html-table",
    follow: true,
  },
  {
    id: "rbi-payments-xlsx",
    feeds: ["upi-transactions", "upi-value"],
    publisher: "Reserve Bank of India",
    url: "https://rbidocs.rbi.org.in/rdocs/content/docs/PSDDP04062020.xlsx",
    expect: "xlsx",
  },
  {
    id: "trai-qpir",
    feeds: ["mobile-data-price-per-gb", "data-per-subscriber"],
    publisher: "TRAI",
    // The quarterly performance indicator report. Followed from TRAI's home
    // page and confirmed at 200, 2.05 MB of PDF. This project can read a PDF
    // table; whether this one is readable is the next question.
    url: "https://www.trai.gov.in/sites/default/files/2026-06/QPIR_22062026.pdf",
    expect: "html",
  },
  {
    id: "rbi-annual-publications",
    feeds: ["food-inflation", "agri-credit-disbursed", "demat-accounts"],
    publisher: "Reserve Bank of India",
    url: "https://www.rbi.org.in/Scripts/AnnualPublications.aspx?head=Statistical%20Tables%20Relating%20to%20Banks%20in%20India",
    expect: "html",
    follow: true,
  },

  /* --- Still-unsourced series: index pages worth following once --- */
  //
  // Every one of these feeds a chart that is declared and empty. None of the
  // URLs is a guessed file path: each is a landing page a person can open, and
  // the probe's job is to find out whether a machine-readable table sits one
  // click behind it. If the answer is no, that is recorded too — a declared
  // series with no reachable source is a finding, not a gap to paper over.
  {
    id: "rbi-payment-indicators",
    feeds: ["upi-transactions", "upi-value"],
    publisher: "Reserve Bank of India",
    url: "https://www.rbi.org.in/Scripts/Statistics.aspx",
    expect: "html",
    follow: true,
  },
  {
    id: "rbi-bulletin-current",
    feeds: ["upi-transactions", "upi-value", "agri-credit-disbursed"],
    publisher: "Reserve Bank of India",
    url: "https://www.rbi.org.in/Scripts/BS_ViewBulletin.aspx",
    expect: "html",
    follow: true,
  },
  {
    id: "npci-statistics-index",
    feeds: ["upi-transactions", "upi-value"],
    publisher: "NPCI",
    url: "https://www.npci.org.in/statistics",
    expect: "html",
    follow: true,
  },
  {
    id: "mospi-cpi-releases",
    feeds: ["food-inflation"],
    publisher: "MoSPI",
    url: "https://www.mospi.gov.in/archive/press-release",
    expect: "html",
    follow: true,
  },
  {
    id: "mospi-cpi-portal",
    feeds: ["food-inflation"],
    publisher: "MoSPI",
    url: "https://cpi.mospi.gov.in/",
    expect: "html",
    follow: true,
  },
  {
    id: "pib-releases-index",
    feeds: ["drone-didi-drones", "pm-kisan-beneficiaries", "bulletproof-jackets-produced"],
    publisher: "Press Information Bureau",
    url: "https://www.pib.gov.in/allRel.aspx",
    expect: "html",
    follow: true,
  },
  {
    id: "sansad-ls-questions",
    feeds: ["iaf-fighter-squadrons", "communal-riots", "ppf-accounts", "protests-recorded"],
    publisher: "Lok Sabha",
    url: "https://sansad.in/ls/questions/questions-and-answers",
    expect: "html",
    follow: true,
  },
  {
    id: "sipri-transfers-index",
    feeds: ["arms-imports-by-supplier"],
    publisher: "SIPRI",
    url: "https://www.sipri.org/databases/armstransfers",
    expect: "html",
    follow: true,
  },
  {
    id: "dgca-monthly-index",
    feeds: ["domestic-air-passengers", "udan-passengers"],
    publisher: "DGCA",
    url: "https://www.dgca.gov.in/digigov-portal/?page=jsp/dgca/InventoryList/dataReports/aviationDataStatistics/airTransport/domestic/domesticTraffic.jsp",
    expect: "html",
    follow: true,
  },
  {
    id: "cdsl-nsdl-stats",
    feeds: ["demat-accounts"],
    publisher: "CDSL",
    url: "https://www.cdslindia.com/Publications/MonthlyProgressReport.aspx",
    expect: "html",
    follow: true,
  },

  /* --- RBI: Handbook of Statistics publishes per-table files --- */
  {
    id: "rbi-handbook",
    feeds: ["food-inflation", "demat-accounts", "many"],
    publisher: "Reserve Bank of India",
    url: "https://www.rbi.org.in/Scripts/AnnualPublications.aspx?head=Handbook%20of%20Statistics%20on%20Indian%20Economy",
    expect: "html",
    follow: true,
  },
  {
    id: "rbi-dbie",
    feeds: ["food-inflation", "many"],
    publisher: "Reserve Bank of India",
    url: "https://data.rbi.org.in/DBIE/#/dbie/home",
    expect: "html",
    follow: true,
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

  {
    id: "npci-upi-alt",
    feeds: ["upi-transactions", "upi-value"],
    publisher: "NPCI",
    url: "https://www.npci.org.in/what-we-do/upi/upi-ecosystem-statistics",
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
    follow: true,
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
    follow: true,
  },
  {
    id: "mospi-home",
    feeds: ["food-inflation", "many"],
    publisher: "Ministry of Statistics and Programme Implementation",
    url: "https://www.mospi.gov.in/",
    expect: "html",
    follow: true,
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
  {
    id: "dataful-sitemap",
    feeds: ["many"],
    publisher: "Dataful",
    url: "https://dataful.in/sitemap.xml",
    expect: "json",
  },
  {
    id: "dataful-robots",
    feeds: ["many"],
    publisher: "Dataful",
    url: "https://dataful.in/robots.txt",
    expect: "csv",
  },
  {
    id: "dataful-api-datasets",
    feeds: ["many"],
    publisher: "Dataful",
    url: "https://dataful.in/api/datasets/",
    expect: "json",
  },
  {
    id: "dataful-api-v1",
    feeds: ["many"],
    publisher: "Dataful",
    url: "https://api.dataful.in/",
    expect: "json",
  },

  /* --- Open data portal: CSV downloads, no key on the catalogue pages --- */
  {
    id: "datagov-catalog",
    feeds: ["many"],
    publisher: "data.gov.in",
    url: "https://www.data.gov.in/catalogs",
    expect: "html",
    follow: true,
  },

  /* --- Schemes --- */
  {
    id: "pmkisan-dashboard",
    feeds: ["pm-kisan-beneficiaries", "pm-kisan-disbursed"],
    publisher: "Ministry of Agriculture",
    url: "https://pmkisan.gov.in/Dashboard.aspx",
    expect: "html",
    follow: true,
  },

  /* --- Markets --- */
  {
    id: "sebi-stats",
    feeds: ["demat-accounts"],
    publisher: "SEBI",
    url: "https://www.sebi.gov.in/statistics.html",
    expect: "html",
    follow: true,
  },
  {
    id: "amfi-stats",
    feeds: ["mutual-fund-sip-accounts"],
    publisher: "AMFI",
    url: "https://www.amfiindia.com/research-information/amfi-monthly",
    expect: "html-table",
    follow: true,
  },

  /* --- Telecom --- */
  {
    id: "trai-reports",
    feeds: ["mobile-data-price-per-gb", "data-per-subscriber"],
    publisher: "TRAI",
    url: "https://www.trai.gov.in/release-publication/reports",
    expect: "html",
    follow: true,
  },
  {
    id: "trai-root",
    feeds: ["mobile-data-price-per-gb", "data-per-subscriber"],
    publisher: "TRAI",
    url: "https://www.trai.gov.in/",
    expect: "html",
    follow: true,
  },

  /* --- Aviation --- */
  {
    id: "dgca-traffic",
    feeds: ["domestic-air-passengers"],
    publisher: "DGCA",
    url: "https://www.dgca.gov.in/digigov-portal/?page=jsp/dgca/InventoryList/dataReports/aviationDataStatistics/monthlyDomestic/monthlyDomestic.jsp",
    expect: "html",
    follow: true,
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
  /**
   * Links that name data without advertising a file extension.
   *
   * Government sites route downloads through `PublicationsView.aspx?id=` and
   * similar, so the extension test alone misses them. The anchor text is kept
   * because it is what makes such a link identifiable at all.
   */
  candidateLinks?: Array<{ href: string; text: string }>;
  /** What the followed links actually returned. */
  followed?: Array<{
    url: string;
    text: string;
    status: number | "error";
    contentType?: string;
    bytes?: number;
    looksLike?: Finding["looksLike"];
    /** Files found on the followed page, when it turned out to be another index. */
    dataLinks?: string[];
  }>;
  /**
   * Server-embedded JSON found in the page.
   *
   * A React or Next.js catalogue renders nothing useful to a plain fetch, but
   * usually ships its data in a __NEXT_DATA__ or self.__next_f payload. That is
   * the difference between "needs a headless browser" and "needs a JSON.parse",
   * so it is worth detecting before concluding a source is unreachable.
   */
  embeddedJson?: { kind: string; bytes: number; topKeys: string[] };
  /** How usable this is, highest first. */
  score?: number;
}

function embeddedJsonIn(html: string): Finding["embeddedJson"] {
  const patterns: Array<{ kind: string; re: RegExp }> = [
    { kind: "__NEXT_DATA__", re: /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i },
    { kind: "ld+json", re: /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i },
    { kind: "__NUXT__", re: /window\.__NUXT__\s*=\s*([\s\S]*?)<\/script>/i },
    { kind: "initial-state", re: /window\.__INITIAL_STATE__\s*=\s*([\s\S]*?)<\/script>/i },
  ];
  for (const { kind, re } of patterns) {
    const m = re.exec(html);
    const body = m?.[1]?.trim();
    if (!body) continue;
    try {
      const parsed: unknown = JSON.parse(body.replace(/;\s*$/, ""));
      const topKeys =
        parsed && typeof parsed === "object" ? Object.keys(parsed as object).slice(0, 12) : [];
      return { kind, bytes: body.length, topKeys };
    } catch {
      // Present but not parseable on its own — still worth reporting.
      return { kind: `${kind} (unparsed)`, bytes: body.length, topKeys: [] };
    }
  }
  // Next.js app router streams flight data rather than one JSON blob.
  if (/self\.__next_f\.push/.test(html)) {
    const n = (html.match(/self\.__next_f\.push/g) ?? []).length;
    return { kind: "next-flight", bytes: n, topKeys: [] };
  }
  return undefined;
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

const FILE_HREF = /\.(csv|xlsx?|ods|json)(\?|$)/i;
/** Anchor text that names a statistical table even when the href hides the file. */
const DATA_TEXT =
  /\b(table|tables|statistic|statistics|handbook|indicator|time.?series|data\s*(set|book|table)|excel|xls|spreadsheet|annex|appendix|download)\b/i;

function absolute(href: string, base: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

/** Every anchor on the page, as href plus the words a reader would click. */
function anchorsIn(html: string, base: string): Array<{ href: string; text: string }> {
  const out: Array<{ href: string; text: string }> = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = absolute(m[1] ?? "", base);
    if (!/^https?:/i.test(href) || seen.has(href)) continue;
    seen.add(href);
    const text = (m[2] ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
    out.push({ href, text });
  }
  return out;
}

/** Downloadable data files linked from a page — the prize when one exists. */
function dataLinksIn(html: string, base: string): string[] {
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1] ?? "");
  const abs = hrefs.filter((h) => FILE_HREF.test(h)).map((h) => absolute(h, base));
  return [...new Set(abs)].slice(0, 20);
}

/**
 * Links worth following: they name data but do not advertise a file.
 *
 * Ranked so the follow budget is spent on the most likely ones rather than on
 * whatever the page happened to list first.
 */
function candidateLinksIn(html: string, base: string): Array<{ href: string; text: string }> {
  return anchorsIn(html, base)
    .filter((a) => !FILE_HREF.test(a.href) && (DATA_TEXT.test(a.text) || DATA_TEXT.test(a.href)))
    .sort((a, b) => Number(DATA_TEXT.test(b.text)) - Number(DATA_TEXT.test(a.text)))
    .slice(0, 25);
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
  // A followed link that came back as a file is worth more than a page that
  // merely lists files, because it has actually been seen to answer.
  const hits = (f.followed ?? []).filter(
    (x) => x.status === 200 && (x.looksLike === "binary" || x.looksLike === "csv" || x.looksLike === "json"),
  ).length;
  if (hits > 0) n += 120 + hits;
  n += (f.followed ?? []).reduce((m, x) => m + (x.dataLinks?.length ?? 0), 0);
  if (f.looksLike === "json" || f.looksLike === "csv") n += 60;
  if ((f.yearTables ?? 0) > 0) n += 30 + (f.yearTables ?? 0);
  // Embedded JSON is worth more than an HTML table: it is already structured,
  // and it is the only way into a page that renders client-side.
  if (f.embeddedJson) n += 45;
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
    candidateLinks: looksLike === "html" ? candidateLinksIn(res.data, c.url) : [],
    embeddedJson: looksLike === "html" ? embeddedJsonIn(res.data) : undefined,
  };

  // Follow regardless of whether the page already links a file. The first
  // version skipped following whenever one file was found, and RBI's statistics
  // index is exactly the case that breaks: it links a single 2020 spreadsheet
  // and nineteen named statistics pages, and the pages are the valuable half.
  // One file is not evidence that the rest of the page is uninteresting.
  if (c.follow && looksLike === "html") {
    finding.followed = await followLinks(finding.candidateLinks ?? []);
  }
  return { ...finding, score: scoreOf(finding) };
}

/** How many links one index page is allowed to cost. */
const FOLLOW_BUDGET = 8;
/** Spacing between followed requests — these are somebody's public servers. */
const FOLLOW_PAUSE_MS = 1_200;

/**
 * Fetch a handful of an index page's links and report what each returned.
 *
 * Deliberately shallow: one hop, a small budget, and nothing published. The
 * aim is to turn "there is probably a spreadsheet behind this page" into a URL
 * that has been seen to answer, which is the only kind of URL a connector in
 * this project is allowed to be written against.
 */
async function followLinks(
  links: Array<{ href: string; text: string }>,
): Promise<NonNullable<Finding["followed"]>> {
  const out: NonNullable<Finding["followed"]> = [];
  for (const link of links.slice(0, FOLLOW_BUDGET)) {
    try {
      const res = await fetch(link.href, {
        headers: { "user-agent": "BharatTracker/0.1 data-pipeline", accept: "*/*" },
        signal: AbortSignal.timeout(25_000),
      });
      const type = res.headers.get("content-type") ?? "";
      // Read a spreadsheet's first bytes only — the probe is establishing that
      // a file is there and what it is, not downloading a dataset.
      const head = await res
        .arrayBuffer()
        .then((b) => new Uint8Array(b).slice(0, 4_096))
        .catch(() => new Uint8Array());
      const text = new TextDecoder("utf8", { fatal: false }).decode(head);
      const entry: NonNullable<Finding["followed"]>[number] = {
        url: link.href,
        text: link.text,
        status: res.status,
        contentType: type.slice(0, 60),
        bytes: Number(res.headers.get("content-length") ?? 0) || undefined,
        looksLike: sniff(text),
      };
      // An index that leads to another index still counts as progress, so long
      // as the report says which it was.
      if (entry.looksLike === "html") entry.dataLinks = dataLinksIn(text, link.href).slice(0, 6);
      out.push(entry);
    } catch (err) {
      out.push({
        url: link.href,
        text: link.text,
        status: "error",
        contentType: err instanceof Error ? err.message.slice(0, 60) : undefined,
      });
    }
    await new Promise((r) => setTimeout(r, FOLLOW_PAUSE_MS));
  }
  return out;
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
    for (const x of f.followed ?? []) {
      log(`         followed ${String(x.status).padEnd(5)} ${String(x.looksLike ?? "").padEnd(7)} ${x.text.slice(0, 44)}`);
      log(`            ${x.url.slice(0, 120)}`);
      for (const l of (x.dataLinks ?? []).slice(0, 3)) log(`              -> ${l}`);
    }
    if (f.embeddedJson) {
      log(
        `         embedded ${f.embeddedJson.kind} (${f.embeddedJson.bytes}b)` +
          (f.embeddedJson.topKeys.length ? ` keys: ${f.embeddedJson.topKeys.join(", ")}` : ""),
      );
    }
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
