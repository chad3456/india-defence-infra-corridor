/**
 * Who publishes India's defence contracts, and in what shape?
 *
 * `npm run deals:probe`. The ask is every defence deal, collaboration and
 * project sale signed by the Government of India since 2014. That is a real
 * and finite set — contracts above a threshold are announced — but it is
 * scattered across four publishers who each hold a different piece, and none
 * of them holds it as a table.
 *
 * ── Why this needs a probe at all ────────────────────────────────────────
 *
 * Because the numbers are recallable and wrong. Anyone who reads Indian
 * defence coverage can produce a plausible sentence about the Rafale contract,
 * the S-400 deal, the P-8I follow-ons, the emergency procurement tranches. The
 * plausible version is the danger: contract values get quoted variously as
 * signed value, as sanctioned cost, as AoN clearance, and in rupees or dollars
 * at whichever exchange rate flattered the headline. A deal ledger assembled
 * from memory would be wrong in exactly the way that is hardest to detect.
 *
 * So nothing is written until a source is read. This probe establishes which
 * publishers answer a script and what shape their pages are in.
 *
 * ── The four kinds of source, and what each can settle ───────────────────
 *
 *   The Cabinet Committee on Security clears the large acquisitions, and PIB
 *   announces the clearance. That gives a date and a value with government
 *   authority behind it, and it is the strongest single source.
 *
 *   The Defence Acquisition Council grants Acceptance of Necessity. An AoN is
 *   NOT a contract — it is permission to begin procuring — and conflating the
 *   two inflates any ledger badly, because many AoNs never become contracts.
 *
 *   MoD annual reports list contracts concluded in the year, in an appendix,
 *   in a PDF.
 *
 *   SIPRI's transfer database records deliveries rather than signatures, on a
 *   trend-indicator value that is deliberately not a price.
 *
 * Those four measure different things. The eventual ledger has to keep them
 * apart or it will silently add a clearance to a contract to a delivery.
 *
 * ── Round two, and what round one settled ───────────────────────────────
 *
 * The first run answered three things and raised four.
 *
 * Settled: mod.gov.in does not answer a script at all — two URLs, both "fetch
 * failed", which is a refusal at the connection rather than a 404. The MoD
 * annual reports are therefore not a source this pipeline can reach, and the
 * contracts-concluded appendix with them. PIB's archive and the Department of
 * Defence Production both return server-rendered HTML, so they are readable in
 * principle. SIPRI returned the same sixty kilobytes for both the database and
 * the trade-register URL and neither contained the word "register", so both
 * are landing pages and the register itself is behind something else.
 *
 * Raised, and what this round asks:
 *
 *   Four of eight Wikipedia titles returned 401 bytes — an error object, not
 *   an article. Guessing titles was the mistake; this round resolves them
 *   through the search API and records what comes back, so the connector can
 *   be written against titles that exist.
 *
 *   The MoD RSS feed answered but did not contain the word "defence", which
 *   means the ModId was wrong. This round tries the plausible ones and counts
 *   how many items in each look like a contract announcement — a count, so the
 *   probe still publishes no headline.
 *
 *   PIB's back catalogue is the prize: a decade of dated, primary,
 *   government-issued contract announcements. Whether it can be addressed by
 *   GET at all decides whether the eventual ledger is built from the
 *   government's own releases or from an encyclopaedia's citations to them.
 *
 * ── Round three: sizing the crawl ───────────────────────────────────────
 *
 * Round two answered the question that mattered. PIB's day archive does take
 * a GET — AllRelease.aspx with day, month and year — and returned 844 KB for
 * a single day in June 2024. That is the ledger's source: dated, primary,
 * issued by the government, one page per day, addressable back through the
 * whole period.
 *
 * 844 KB a day is also the problem. Eleven years is four thousand requests and
 * something over three gigabytes, which is not one job. So this round measures
 * rather than guesses: how many release links a day page holds, how many of
 * their titles read like a defence contract, and whether the same page can be
 * asked for a whole month, or filtered to one ministry, at a fraction of the
 * size. The answer sets the shape of the crawl — a matrix of eleven yearly
 * jobs, or one job that reads a page a month.
 *
 * It also confirmed what the encyclopaedia is called. Four guessed titles were
 * wrong and the search API named the real ones: "Rafale deal controversy",
 * "Defence industry of India", "List of equipment of the Indian Army". And it
 * closed the MoD out properly — mod.gov.in refused with and without the www,
 * which is the host, not a typo.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "./lib/http";
import { isEntryPoint } from "./lib/entry";

const ROOT = process.cwd();
const OUT = join(ROOT, "data", "live", "deals-probe.json");
const WIKI = "https://en.wikipedia.org/w/api.php";

type Kind = "pib" | "mod" | "sipri" | "wiki" | "vendor";

interface Target {
  id: string;
  kind: Kind;
  what: string;
  url: string;
  /** Words the page must contain to be carrying what it claims to. */
  look?: string[];
  /** Which part of the ledger this source could settle. */
  settles: string;
}

const wikiPage = (page: string, look: string[], settles: string): Target => ({
  id: `wiki-${page.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
  kind: "wiki",
  what: `Wikipedia: ${page.replace(/_/g, " ")}`,
  url: `${WIKI}?action=parse&page=${encodeURIComponent(page)}&redirects=1&prop=wikitext&formatversion=2&format=json`,
  look,
  settles,
});

/** A MediaWiki search, which answers "what is this article actually called?" */
const wikiSearch = (term: string, settles: string): Target => ({
  id: `search-${term.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 36)}`,
  kind: "wiki",
  what: `Wikipedia search: ${term}`,
  url: `${WIKI}?action=query&list=search&srsearch=${encodeURIComponent(term)}` +
    "&srlimit=3&format=json&formatversion=2",
  settles,
});

const TARGETS: Target[] = [
  // ── The government's own announcements ────────────────────────────────
  {
    id: "pib-rss-mod", kind: "pib",
    what: "PIB RSS, Ministry of Defence",
    url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3",
    look: ["defence", "item"],
    settles: "Contract signatures and CCS clearances, dated, but only the current window.",
  },
  {
    id: "pib-archive", kind: "pib",
    what: "PIB release archive",
    url: "https://www.pib.gov.in/allRel.aspx",
    look: ["release"],
    settles: "The back catalogue, if it can be addressed by date rather than by PRID.",
  },
  {
    id: "ddp-home", kind: "mod",
    what: "Department of Defence Production",
    url: "https://ddpmod.gov.in/",
    look: ["production", "defence"],
    settles: "Production value, indigenisation and the DPSU side of contracts.",
  },
  {
    id: "ddp-exports", kind: "mod",
    what: "DDP, defence exports",
    url: "https://ddpmod.gov.in/defence-exports",
    look: ["export"],
    settles: "Export authorisations and the destination spread the HS data cannot give.",
  },
  // mod.gov.in refused at the connection on two URLs last round. Retried once
  // here, without the www, because "fetch failed" can be a hostname rather
  // than a policy — and a source ruled out has to be ruled out correctly.
  {
    id: "mod-bare", kind: "mod",
    what: "Ministry of Defence, without the www",
    url: "https://mod.gov.in/",
    look: ["defence"],
    settles: "Whether last round's two failures were the host or the hostname.",
  },

  // ── Sizing the PIB crawl ──────────────────────────────────────────────
  //
  // One day is 844 KB and eleven years is four thousand of them. Before
  // writing a crawler, find out whether the same archive answers a coarser
  // question — a month at a time, or one ministry at a time — because the
  // difference is between one job and a matrix of eleven.
  {
    id: "pib-month", kind: "pib",
    what: "PIB archive, a month rather than a day",
    url: "https://www.pib.gov.in/AllRelease.aspx?MenuId=3&day=0&month=6&year=2024",
    look: ["release"],
    settles: "Whether day=0 means the whole month, which would cut the crawl by thirty.",
  },
  {
    id: "pib-ministry-filtered", kind: "pib",
    what: "PIB archive, filtered to one ministry",
    url: "https://www.pib.gov.in/PressReleasePage.aspx?PRID=0&MinistryId=6&day=1&month=6&year=2024",
    look: ["release"],
    settles: "Whether the archive can be narrowed to Defence before it is downloaded.",
  },
  {
    id: "pib-release-by-prid", kind: "pib",
    what: "PIB, one release addressed by its id",
    url: "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2024184",
    look: ["press"],
    settles: "Whether a row in the ledger can carry a URL that resolves to its own release.",
  },
  {
    id: "pib-day-2016", kind: "pib",
    what: "PIB archive, a day in 2016",
    url: "https://www.pib.gov.in/AllRelease.aspx?MenuId=3&day=23&month=9&year=2016",
    look: ["release"],
    settles: "Whether the archive reaches back to the start of the period at all.",
  },

  // ── PIB's back catalogue, which is the whole question ─────────────────
  //
  // A decade of dated, primary, government-issued contract announcements. If
  // any of these answers a GET, the ledger is built from the government's own
  // releases. If none does, it is built from an encyclopaedia's citations to
  // them, which is a weaker provenance the page would have to state.
  {
    id: "pib-day", kind: "pib",
    what: "PIB releases for one day, by query string",
    url: "https://www.pib.gov.in/AllRelease.aspx?MenuId=3&day=1&month=6&year=2024",
    look: ["release"],
    settles: "Whether the archive is addressable by date rather than by postback.",
  },
  {
    id: "pib-ministry-feed", kind: "pib",
    what: "PIB RSS, ministry feed 3",
    url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3",
    look: ["item"],
    settles: "Which ModId is actually the Ministry of Defence.",
  },
  {
    id: "pib-feed-alt", kind: "pib",
    what: "PIB RSS, alternate ministry id",
    url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=32",
    look: ["item"],
    settles: "The same question, against the other plausible id.",
  },
  {
    id: "pib-english-all", kind: "pib",
    what: "PIB, all English releases",
    url: "https://www.pib.gov.in/Allrel.aspx?reg=3&lang=1",
    look: ["release"],
    settles: "Whether the unfiltered list is reachable and paginated by GET.",
  },

  // ── SIPRI, which records deliveries rather than signatures ────────────
  {
    id: "sipri-transfers", kind: "sipri",
    what: "SIPRI arms transfers database",
    url: "https://www.sipri.org/databases/armstransfers",
    look: ["transfer", "arms"],
    settles: "Deliveries by supplier and year — not contract values, and not signatures.",
  },
  {
    id: "sipri-register", kind: "sipri",
    what: "SIPRI trade register",
    url: "https://armstrade.sipri.org/armstrade/page/trade_register.php",
    look: ["register"],
    settles: "Ordered and delivered quantities per deal, the closest thing to a ledger.",
  },

  // ── Wikipedia, as an index of where a contract is citable ─────────────
  wikiPage("List_of_military_equipment_of_the_Indian_Army", ["procure", "order"],
    "Which types are on order, as an index of what to look up."),
  wikiPage("Defence_Acquisition_Council", ["Acceptance of Necessity", "council"],
    "What an AoN is, and why it is not a contract."),
  wikiPage("Make_in_India", ["defence", "manufacturing"],
    "The policy frame the collaborations sit inside."),
  wikiPage("Dassault_Rafale_procurement_by_India", ["contract", "2016"],
    "One well-documented contract, as a shape test for the others."),
  wikiPage("S-400_missile_system", ["India", "contract"],
    "A government-to-government deal with a disputed published value."),
  wikiPage("BrahMos", ["Philippines", "export", "contract"],
    "The clearest Indian defence export contract of the period."),
  wikiPage("Indian_Navy", ["indigenous", "commissioned"],
    "Domestic warship programmes, which are projects rather than purchases."),
  wikiPage("Hindustan_Aeronautics_Limited", ["contract", "order"],
    "The largest DPSU's order book."),

  // ── Titles, resolved rather than guessed ─────────────────────────────
  //
  // Four of eight guessed titles came back as a 401-byte error object last
  // round. Guessing was the mistake: the search API says what an article is
  // actually called, and a title is a pointer rather than a figure, so
  // recording what it returns smuggles nothing into this file.
  wikiSearch("Rafale India procurement contract 2016",
    "The best-documented single contract of the period, under whatever title it has."),
  wikiSearch("Defence Acquisition Council Acceptance of Necessity",
    "Where the AoN-versus-contract distinction is set out."),
  wikiSearch("India defence procurement 2014 2024",
    "Whether any article aggregates the period at all, or only individual deals."),
  wikiSearch("Indian Army equipment list",
    "An index of types on order, as a list of things to look up."),
  wikiSearch("India arms exports BrahMos Philippines contract",
    "The clearest Indian defence export contract of the period."),

  // ── A vendor, to see whether industry sources are readable at all ─────
  {
    id: "hal-home", kind: "vendor",
    what: "Hindustan Aeronautics Limited",
    url: "https://hal-india.co.in/",
    look: ["aeronautics"],
    settles: "Order book announcements, if the site is not a rendered application.",
  },
];

interface Finding {
  id: string; kind: Kind; what: string; url: string; settles: string;
  ok: boolean; status: string; bytes: number | null;
  /** Article titles a search returned. A pointer, never a fact. */
  titles?: string[];
  /** Items in a feed, and how many read like a contract announcement. */
  feedItems?: number;
  contractish?: number;
  /** Release links on an archive page, and the defence-contract yield in them. */
  releaseLinks?: number;
  defenceLinks?: number;
  shape?: "html" | "js-app" | "pdf" | "xml-feed" | "json" | "empty";
  found?: string[]; missing?: string[];
  /** Whether a money-shaped figure appears at all — never which figure. */
  moneyMentions?: number;
  note?: string;
}

/**
 * How many money-shaped mentions a page carries, and not one of their values.
 *
 * Deliberately a count. A probe log that quotes "₹59,000 crore" beside a URL
 * is a figure with a filename where a citation should be, and the next person
 * to read it — including me — will treat it as sourced. The count says a
 * figure exists to go and read; it cannot be mistaken for the reading.
 */
function moneyMentions(body: string): number {
  const re = /(?:₹|Rs\.?|INR|US\$|\$)\s?[\d,]+(?:\.\d+)?\s*(?:crore|lakh|billion|million|bn|mn)?/gi;
  return [...body.matchAll(re)].length;
}

/**
 * Titles a MediaWiki search returned, which is the only content this file
 * copies out of a response — and deliberately so. A title is an address: it
 * tells the connector where to look and asserts nothing about what is there.
 */
function searchTitles(body: string): string[] {
  try {
    const j = JSON.parse(body) as { query?: { search?: Array<{ title?: string }> } };
    return (j.query?.search ?? []).map((r) => r.title ?? "").filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * How many items in a feed read like a contract announcement.
 *
 * A count, for the same reason moneyMentions is a count: the headline of a
 * release naming a contractor and a figure is a fact with no citation attached
 * once it is sitting in a JSON file, and the next reader will treat it as one.
 * The count says the feed is the right feed. It cannot be mistaken for the
 * reading.
 */
function feedShape(body: string): { items: number; contractish: number } {
  const items = [...body.matchAll(/<item\b/gi)].length;
  const titles = [...body.matchAll(/<title>([\s\S]*?)<\/title>/gi)].map((m) => m[1] ?? "");
  const re = /\b(contract|agreement|MoU|procure|acquisition|signs?|signed|inducted|delivery)\b/i;
  return { items, contractish: titles.filter((t) => re.test(t)).length };
}

/**
 * How many release links an archive page carries, and how many look like a
 * defence contract announcement.
 *
 * Two counts and no titles. The yield is what sets the shape of the crawl: a
 * day page holding four hundred links of which three are defence contracts is
 * a different engineering problem from one holding twenty. Recording the
 * titles themselves would put a hundred government headlines into a probe log
 * with no citation attached to any of them, which is the thing this file
 * exists not to do.
 */
function archiveYield(body: string): { links: number; defence: number } {
  const anchors = [...body.matchAll(/<a\b[^>]*PRID=\d+[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => (m[1] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  const re =
    /\b(defence|defense|army|navy|air force|DRDO|HAL|BEL|contract|procure|acquisition)\b/i;
  return { links: anchors.length, defence: anchors.filter((t) => re.test(t)).length };
}

function shapeOf(body: string, contentType: string): Finding["shape"] {
  if (body.length < 200) return "empty";
  if (/^%PDF/.test(body) || /application\/pdf/i.test(contentType)) return "pdf";
  if (/^\s*[[{]/.test(body)) return "json";
  if (/<rss|<feed/i.test(body.slice(0, 600))) return "xml-feed";
  // A shell that ships no server-rendered prose is an application, not a page.
  const text = body.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ").trim();
  if (text.length < body.length / 40) return "js-app";
  return "html";
}

export async function run(): Promise<void> {
  const findings: Finding[] = [];

  for (const t of TARGETS) {
    const res = await getText(t.url, { cacheMs: 0, retries: 1, timeoutMs: 45_000 });
    const body = res.data ?? "";
    const look = res.ok && t.look
      ? {
          found: t.look.filter((w) => body.toLowerCase().includes(w.toLowerCase())),
          missing: t.look.filter((w) => !body.toLowerCase().includes(w.toLowerCase())),
        }
      : null;

    const f: Finding = {
      id: t.id, kind: t.kind, what: t.what, url: t.url.slice(0, 110), settles: t.settles,
      ok: res.ok,
      status: res.ok ? "200" : (res.error ?? "failed"),
      bytes: res.ok ? body.length : null,
      ...(res.ok ? { shape: shapeOf(body, ""), moneyMentions: moneyMentions(body) } : {}),
      ...(look ? { found: look.found, missing: look.missing } : {}),
      ...(res.ok && t.id.startsWith("search-") ? { titles: searchTitles(body) } : {}),
      ...(res.ok && /<item\b/i.test(body)
        ? { feedItems: feedShape(body).items, contractish: feedShape(body).contractish }
        : {}),
      ...(res.ok && /PRID=\d/i.test(body)
        ? { releaseLinks: archiveYield(body).links, defenceLinks: archiveYield(body).defence }
        : {}),
    };
    findings.push(f);
    console.log(
      `  ${(f.ok ? "ok" : "dead").padEnd(5)} ${t.kind.padEnd(7)} ${f.id.padEnd(42)} ` +
      `${String(f.bytes ?? 0).padStart(8)}  ${f.shape ?? ""}` +
      `${f.moneyMentions ? `  ${f.moneyMentions} money mentions` : ""}` +
      `${f.feedItems ? `  ${f.feedItems} items, ${f.contractish} contract-ish` : ""}` +
      `${f.releaseLinks ? `  ${f.releaseLinks} releases, ${f.defenceLinks} defence-ish` : ""}` +
      `${f.titles?.length ? `  → ${f.titles.join(" | ")}` : ""}`,
    );

    await mkdir(join(ROOT, "data", "live"), { recursive: true });
    await writeFile(OUT, JSON.stringify({
      probedAt: new Date().toISOString(),
      note: "Reachability and shape only. No contract, value or date is published from this file.",
      question:
        "Which publishers hold India's defence contracts since 2014, and can a script read them?",
      settled: {
        mod:
          "mod.gov.in refused at the connection on two URLs, which is a refusal rather than a " +
          "404. Its annual reports, and the contracts-concluded appendix in them, are not " +
          "reachable from this pipeline.",
        sipri:
          "The database and trade-register URLs returned the same landing page and neither " +
          "contained the word 'register'. SIPRI's data is behind a form, not a URL.",
        titles:
          "Four of eight guessed article titles returned an error object. The search API named " +
          "the real ones: Rafale deal controversy, Defence industry of India, List of equipment " +
          "of the Indian Army, BrahMos.",
        pib:
          "CORRECTED. Round two reported that AllRelease.aspx answers a GET with a day, a month " +
          "and a year. It does not. Round three asked it for three different dates, one of them " +
          "in 2016, and got 844,412, 844,413 and 844,416 bytes with 525 links each: the page " +
          "ignores its query string and serves the same default view every time. A reachability " +
          "probe cannot catch that, because each individual answer is a genuine 200 with a " +
          "plausible payload. Only asking twice and comparing does.",
        pibWhatWorks:
          "PressReleasePage.aspx?PRID=<id> returns one release, 78 KB, the real thing. " +
          "Individual releases are addressable; the index over them is not. So the ledger is " +
          "built id by id, with Wikipedia's citations supplying the ids.",
      },
      refusal:
        "No figure is recorded here, only whether a figure exists on the page. A probe log that " +
        "quotes a contract value beside a URL is a number with a filename where a citation " +
        "should be, and it will be treated as sourced by the next person who reads it.",
      fourMeasures:
        "A CCS clearance, a DAC Acceptance of Necessity, a signed contract and a SIPRI delivery " +
        "are four different events. An AoN is permission to begin procuring and many never " +
        "become contracts, so a ledger that adds them together overstates itself badly. The " +
        "eventual dataset must keep them in separate columns.",
      findings,
    }, null, 2) + "\n", "utf8");
  }

  for (const kind of ["pib", "mod", "sipri", "wiki", "vendor"] as Kind[]) {
    const l = findings.filter((f) => f.kind === kind);
    if (l.length === 0) continue;
    const live = l.filter((f) => f.ok).length;
    const readable = l.filter((f) => f.ok && f.shape !== "js-app" && f.shape !== "empty").length;
    console.log(`\n${kind}: ${live} of ${l.length} answered, ${readable} in a readable shape`);
  }

  const allDead = findings.every((f) => !f.ok);
  if (allDead) {
    console.log(
      "\nEvery target refused. That is this sandbox's egress, not thirteen dead publishers — " +
      "nothing about any individual source can be concluded from this run.",
    );
  }
}

if (isEntryPoint(import.meta.url)) {
  run().catch((err) => { console.error(err); process.exit(1); });
}
