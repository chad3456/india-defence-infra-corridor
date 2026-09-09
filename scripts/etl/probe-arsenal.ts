/**
 * What the world publishes about missiles and arms deals.
 *
 * `npm run arsenal:probe`. Three layers get tested, because the tracker needs
 * three different kinds of thing and they fail differently.
 *
 * ── Layer one: the structured spine ──────────────────────────────────────
 *
 * SIPRI's arms-transfer and military-expenditure databases are the only
 * numbers in this subject that a serious reader will accept, and Our World in
 * Data republishes them on the country-year shape this repo already reads. If
 * this layer works the tracker has a defensible base and everything else is
 * decoration on top of it.
 *
 * ── Layer two: deals as events ───────────────────────────────────────────
 *
 * SIPRI is annual and lags by a year or more. A deal signed last month is in
 * nobody's database yet — it is in a ministry press release and in four news
 * stories that disagree about the value. That is what the agent layer is for,
 * and it is why the feeds are probed separately: a feed that 403s is a feed
 * the tracker must not pretend to read.
 *
 * The DSCA is the single best-shaped source here. Every US foreign military
 * sale above a threshold gets a dated press release naming the buyer, the
 * system and a dollar ceiling. That is a structured record wearing prose.
 *
 * ── Layer three: what exists, by nation ──────────────────────────────────
 *
 * Missile inventories are not a database anybody publishes openly with values.
 * What exists is reference lists — CSIS Missile Threat, NTI, and Wikipedia's
 * per-country lists, which this repo can already parse with its wikitext
 * machinery. This layer is a catalogue of *what a country is reported to
 * field*, with ranges and status, and it is explicitly not a count of how many
 * of each anybody holds. Nobody publishes that and the tracker will say so.
 *
 * ── What this deliberately does not go looking for ───────────────────────
 *
 * Nothing about how any of these systems work. The tracker is a record of
 * publicly announced procurement and publicly catalogued inventories — the
 * same material SIPRI, IISS and CSIS publish for the public — and technical
 * performance beyond the range and status those catalogues already print is
 * out of scope by design, not by omission.
 *
 * Publishes no series. Records what each host answered and commits it.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "./lib/http";
import { isEntryPoint } from "./lib/entry";

const ROOT = process.cwd();
const OUT = join(ROOT, "data", "live", "arsenal-probe.json");

interface Target {
  id: string;
  layer: "spine" | "deals" | "inventory";
  what: string;
  url: string;
  expect: RegExp;
  note?: string;
}

/** OWID slugs for the SIPRI series. Guessed, then checked — as ever. */
const OWID_SLUGS = [
  // Confirmed in round one.
  "military-spending-sipri",
  "military-expenditure-share-gdp",
  "military-personnel",
  "nuclear-warhead-stockpiles",
  // Round two. Arms transfers are the series this whole tracker turns on and
  // every guessed slug 404'd in round one, so the candidate set is widened
  // rather than narrowed — a tracker of arms deals with no transfer values is
  // a tracker of press releases.
  "arms-exports", "arms-imports",
  "arms-exports-constant-usd", "arms-imports-constant-usd",
  "arms-exports-sipri-tiv", "arms-imports-sipri-tiv",
  "transfers-of-major-conventional-weapons",
  "value-of-arms-exports", "value-of-arms-imports",
  "arms-trade-exports", "arms-trade-imports",
  "military-expenditure-per-capita-sipri",
  "share-of-military-expenditure-in-government-expenditure",
  "nuclear-weapons-tests-by-country",
];

/**
 * Wikipedia list pages, read through the API as wikitext.
 *
 * The repo already parses wikitext tables header-first, so these are the one
 * inventory source it can read without a bespoke scraper. Every one of them is
 * a maintained, cited list rather than an article body.
 */
const WIKI_PAGES = [
  "List_of_missiles_by_country",
  "List_of_intercontinental_ballistic_missiles",
  "List_of_cruise_missiles",
  "List_of_surface-to-air_missiles",
  "List_of_anti-ship_missiles",
  "List_of_states_with_nuclear_weapons",
  // Round one returned a 402-byte "missingtitle" error for these two, which is
  // the API answering honestly that the page is at another name.
  "List_of_submarine-launched_ballistic_missiles_by_country",
  "Submarine-launched_ballistic_missile",
  "Hypersonic_weapon",
  "List_of_ballistic_missiles",
  "List_of_anti-ballistic_missiles",
];

const TARGETS: Target[] = [
  // ── Layer one ───────────────────────────────────────────────────────
  ...OWID_SLUGS.map((slug): Target => ({
    id: `owid-${slug}`,
    layer: "spine",
    what: `Our World in Data (SIPRI): ${slug}`,
    url: `https://ourworldindata.org/grapher/${slug}.csv`,
    expect: /^Entity,Code,Year/,
  })),
  {
    id: "sipri-milex",
    layer: "spine",
    what: "SIPRI military expenditure database, landing page",
    url: "https://www.sipri.org/databases/milex",
    expect: /milex|military expenditure/i,
  },
  {
    id: "sipri-transfers",
    layer: "spine",
    what: "SIPRI arms transfers database, landing page",
    url: "https://www.sipri.org/databases/armstransfers",
    expect: /arms transfers/i,
  },

  // ── Layer two ───────────────────────────────────────────────────────
  {
    id: "dsca-releases",
    layer: "deals",
    what: "US DSCA major arms sales notifications",
    url: "https://www.dsca.mil/press-media/major-arms-sales",
    expect: /arms sale|foreign military sale/i,
    note: "One dated release per sale, naming buyer, system and a dollar ceiling.",
  },
  {
    id: "dsca-rss",
    layer: "deals",
    what: "US DSCA news feed",
    url: "https://www.dsca.mil/rss.xml",
    expect: /<rss|<feed|<item/i,
  },
  {
    id: "nato-news",
    layer: "deals",
    what: "NATO newsroom feed",
    url: "https://www.nato.int/cps/en/natolive/rss_news.xml",
    expect: /<rss|<item/i,
  },
  {
    id: "navalnews",
    layer: "deals",
    what: "Naval News feed",
    url: "https://www.navalnews.com/feed/",
    expect: /<rss|<item/i,
  },
  {
    id: "defenceblog",
    layer: "deals",
    what: "Defence Blog feed",
    url: "https://defence-blog.com/feed/",
    expect: /<rss|<item/i,
  },
  {
    id: "eda-europa",
    layer: "deals",
    what: "European Defence Agency news",
    url: "https://eda.europa.eu/rss/news",
    expect: /<rss|<item/i,
  },
  {
    id: "defenseone",
    layer: "deals",
    what: "Defense One feed",
    url: "https://www.defenseone.com/rss/all/",
    expect: /<rss|<item/i,
  },
  {
    id: "ukmod",
    layer: "deals",
    what: "UK Ministry of Defence announcements (GOV.UK API)",
    url: "https://www.gov.uk/api/content/government/organisations/ministry-of-defence",
    expect: /"title"|"details"/,
  },
  {
    id: "pib-defence",
    layer: "deals",
    what: "India PIB Ministry of Defence releases",
    url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3",
    expect: /<rss|<item/i,
  },
  {
    id: "defensenews",
    layer: "deals",
    what: "Defense News feed",
    url: "https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml",
    expect: /<rss|<item/i,
  },
  {
    id: "breakingdefense",
    layer: "deals",
    what: "Breaking Defense feed",
    url: "https://breakingdefense.com/feed/",
    expect: /<rss|<item/i,
  },
  {
    id: "janes",
    layer: "deals",
    what: "Janes news feed",
    url: "https://www.janes.com/rss/news.xml",
    expect: /<rss|<item/i,
  },
  {
    id: "armyrecognition",
    layer: "deals",
    what: "Army Recognition defence news feed",
    url: "https://armyrecognition.com/feed",
    expect: /<rss|<item/i,
  },

  // ── Layer three ─────────────────────────────────────────────────────
  ...WIKI_PAGES.map((page): Target => ({
    id: `wiki-${page.toLowerCase().replace(/_/g, "-").slice(0, 40)}`,
    layer: "inventory",
    what: `Wikipedia wikitext: ${page.replace(/_/g, " ")}`,
    url: `https://en.wikipedia.org/w/api.php?action=parse&page=${page}&prop=wikitext&formatversion=2&format=json`,
    expect: /"wikitext"/,
  })),
  {
    id: "csis-missilethreat",
    layer: "inventory",
    what: "CSIS Missile Threat, system index",
    url: "https://missilethreat.csis.org/missile/",
    expect: /missile/i,
  },
  {
    id: "nti-countries",
    layer: "inventory",
    what: "Nuclear Threat Initiative country profiles",
    url: "https://www.nti.org/countries/",
    expect: /countries|profile/i,
  },
  {
    id: "fas-nuclear",
    layer: "inventory",
    what: "Federation of American Scientists nuclear notebook index",
    url: "https://fas.org/publication-type/nuclear-notebook/",
    expect: /nuclear/i,
  },
];

interface Finding {
  id: string;
  layer: string;
  what: string;
  url: string;
  ok: boolean;
  status: string;
  looksRight: boolean | null;
  bytes: number | null;
  head: string | null;
  note?: string;
}

export async function run(): Promise<void> {
  const findings: Finding[] = [];
  for (const t of TARGETS) {
    const res = await getText(t.url, { cacheMs: 0, retries: 2, timeoutMs: 45_000 });
    const body = res.data ?? "";
    const f: Finding = {
      id: t.id,
      layer: t.layer,
      what: t.what,
      url: t.url,
      ok: res.ok,
      status: res.ok ? "200" : (res.error ?? "failed"),
      looksRight: res.ok ? t.expect.test(body) : null,
      bytes: res.ok ? body.length : null,
      head: res.ok ? body.slice(0, 240).replace(/\s+/g, " ").trim() : null,
      ...(t.note ? { note: t.note } : {}),
    };
    findings.push(f);
    console.log(
      `  ${(!f.ok ? "dead" : f.looksRight ? "ok" : "200/shape").padEnd(11)} ` +
      `${t.layer.padEnd(9)} ${f.id.padEnd(42)} ${f.bytes ?? 0}`,
    );

    // Written after every target: a run killed by the job timeout still keeps
    // everything it learned.
    await mkdir(join(ROOT, "data", "live"), { recursive: true });
    await writeFile(OUT, JSON.stringify({
      probedAt: new Date().toISOString(),
      note: "Reachability only. No series are published from this file.",
      findings,
    }, null, 2) + "\n", "utf8");
  }

  for (const layer of ["spine", "deals", "inventory"]) {
    const l = findings.filter((f) => f.layer === layer);
    const live = l.filter((f) => f.ok && f.looksRight).length;
    console.log(`\n${layer}: ${live} of ${l.length} usable`);
  }
}

if (isEntryPoint(import.meta.url)) {
  run().catch((err) => { console.error(err); process.exit(1); });
}
