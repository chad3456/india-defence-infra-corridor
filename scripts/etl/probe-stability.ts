/**
 * What the world publishes about protest, repression and state breakdown.
 *
 * `npm run stability:probe`. Tries every open dataset that could support a
 * serious answer to "when does mass mobilisation precede state breakdown, and
 * when does it precede reform", records exactly what each host answered, and
 * commits the report. Publishes no series.
 *
 * ── Why a probe first, again ─────────────────────────────────────────────
 *
 * The sandbox this repository is edited in cannot reach api.worldbank.org at
 * all — the egress proxy answers 403 to CONNECT — so anything written here
 * about reachability from a laptop is a guess. Actions can reach it. Every
 * other connector in this repo was built this way and the discipline has paid
 * for itself repeatedly: the ixigo and BookMyShow probes are the reason no
 * scraper was written against two sites that turned out to refuse automated
 * access, and the Comtrade probe is the reason the trade connector exists at
 * all.
 *
 * The subject makes it matter more than usual. A claim that protest causes
 * state collapse is a claim about hundreds of countries over decades, and the
 * only honest way to hold it up is against datasets somebody else built,
 * documented and versioned. A number I cannot fetch is a number I would end up
 * recalling, and recalled statistics on a contested political question are
 * exactly how a fabricated index gets born.
 *
 * ── What is being looked for, and why each one ───────────────────────────
 *
 * Worldwide Governance Indicators — six measured dimensions of state capacity
 * for ~200 countries a year since 1996. Political Stability and Absence of
 * Violence is the closest thing that exists to a measured "is this state
 * holding together" score, and Voice and Accountability measures the space a
 * country gives to protest. Having both, per country per year, is what makes
 * it possible to ask whether the second predicts the first rather than
 * asserting it.
 *
 * UCDP/PRIO Armed Conflict Dataset — the standard record of state-based armed
 * conflict, with onset years. "Collapse" needs a definition somebody else
 * defends; this is the one the field uses.
 *
 * Mass Mobilization Project — ~17,000 protest events in 162 countries,
 * 1990-2020, each coded with what protesters demanded and how the state
 * responded, including whether it shot. The response coding is the half that
 * matters here: the question is not only what protest does to states but what
 * states do to protest.
 *
 * NAVCO — 600-odd maximalist campaigns since 1900 with outcomes, the dataset
 * behind the Chenoweth and Stephan finding that this whole subject argues
 * with. If the thesis is to be tested rather than asserted, it should be
 * tested against the data the counter-finding came from.
 *
 * V-Dem, Fragile States Index, Freedom House, Polity — four independent
 * attempts to score regimes and fragility. Four is better than one; where they
 * disagree about a country, that disagreement is itself the finding.
 *
 * Nothing here is fetched for a score I invent on top of it. The probe records
 * availability, shape and licence, and the report is the deliverable.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "./lib/http";
import { isEntryPoint } from "./lib/entry";

const ROOT = process.cwd();
const OUT = join(ROOT, "data", "live", "stability-probe.json");

interface Target {
  id: string;
  /** What it is, in one line, for the report. */
  what: string;
  url: string;
  /** What a good answer looks like, so a 200 serving a login page is caught. */
  expect: RegExp;
  /** Roughly how many observations, if the source states one. Recorded, not trusted. */
  claimedScale?: string;
  licence?: string;
}

/**
 * Worldwide Governance Indicators, second attempt.
 *
 * Round one asked for PV.EST and friends off the default database and the API
 * answered "The indicator was not found. It may have been deleted or
 * archived." for all six. WGI is not in the WDI database — it is source 3 —
 * so the same codes are retried scoped to it. Recording the failed form as
 * well as the fixed one, because the next person to reach for WGI will make
 * the same assumption.
 */
const WGI = [
  ["PV.EST", "Political Stability and Absence of Violence/Terrorism"],
  ["RL.EST", "Rule of Law"],
  ["VA.EST", "Voice and Accountability"],
  ["GE.EST", "Government Effectiveness"],
  ["CC.EST", "Control of Corruption"],
  ["RQ.EST", "Regulatory Quality"],
] as const;

/**
 * Our World in Data grapher slugs, guessed and then checked.
 *
 * Round one proved the shape is exactly what this needs — Entity, Code, Year,
 * value, region, one row per country-year, ISO3 already resolved, CC BY. What
 * it did not prove is which slugs exist. A slug that 404s is survivable; a
 * slug that quietly serves a *different* measure than its name suggests is
 * not, so the report keeps each response's header row for reading.
 *
 * The list is chosen to cover both halves of the question. Regime quality and
 * the space a country gives to dissent (democracy, civil liberties, freedom of
 * association and assembly, civil society) on one side; breakdown and state
 * capacity (conflict deaths, conflict counts, terrorism, rule of law,
 * corruption, state fragility) on the other.
 */
const OWID_SLUGS = [
  // Regime quality, V-Dem
  "electoral-democracy-index", "liberal-democracy-index",
  "participatory-democracy-index", "deliberative-democracy-index",
  "egalitarian-democracy-index", "political-regime",
  // The space for protest itself
  "civil-liberties-index", "freedom-of-association-index",
  "freedom-of-expression-index", "civil-society-participation-index",
  "human-rights-index", "freedom-of-assembly-and-association-index",
  // State capacity and its absence
  "rule-of-law-index", "political-corruption-index",
  "rigorous-and-impartial-public-administration",
  "state-capacity-index", "political-stability-index",
  "government-effectiveness-index", "control-of-corruption-index",
  "regulatory-quality-index", "voice-and-accountability-index",
  // Breakdown, by somebody else's definition
  "deaths-in-armed-conflicts-by-conflict-type", "number-of-armed-conflicts",
  "deaths-in-armed-conflicts", "terrorism-deaths",
  "conflict-deaths-per-100000-people", "battle-related-deaths-per-100000",
  "civil-war-deaths", "number-of-state-based-conflicts",
  // Context a fair comparison needs
  "gdp-per-capita-worldbank", "population", "share-of-population-in-extreme-poverty",
  "life-expectancy", "urban-population-share",
  // Protest and mobilisation, if OWID carries any
  "protest-participation", "mass-mobilization-protests",
  "share-of-people-who-attended-a-demonstration",
];

const TARGETS: Target[] = [
  // ── The spine: measured state capacity, every country, every year ──────
  ...WGI.map(([code, name]) => ({
    id: `wgi3-${code.toLowerCase().replace(".", "-")}`,
    what: `WGI (source=3): ${name}`,
    url: `https://api.worldbank.org/v2/country/all/indicator/${code}?format=json&per_page=100&source=3&date=2020:2023`,
    expect: /"indicator"/,
    claimedScale: "~200 countries x 1996-2023",
    licence: "CC BY 4.0",
  })),

  ...OWID_SLUGS.map((slug) => ({
    id: `owid-${slug}`,
    what: `Our World in Data: ${slug}`,
    url: `https://ourworldindata.org/grapher/${slug}.csv`,
    // The header row must name the country-year shape, or it is not this
    // dataset however healthy the 200 looked.
    expect: /^Entity,Code,Year/,
    licence: "CC BY 4.0",
  })),

  // The World Bank's own country list, so ISO3 codes, regions and income
  // groups come from the same place as the values rather than from me.
  {
    id: "wb-countries",
    what: "World Bank country list with region and income group",
    url: "https://api.worldbank.org/v2/country?format=json&per_page=400",
    expect: /"iso2Code"/,
    licence: "CC BY 4.0",
  },

  // ── Conflict onset: somebody else's definition of breakdown ────────────
  {
    id: "ucdp-ged",
    what: "UCDP Georeferenced Event Dataset, API reachability",
    url: "https://ucdpapi.pcr.uu.se/api/gedevents/24.1?pagesize=5&StartDate=2023-01-01",
    expect: /"Result"|"country"/i,
    claimedScale: "~300k events since 1989",
    licence: "CC BY 4.0",
  },
  {
    id: "ucdp-battledeaths",
    what: "UCDP Battle-Related Deaths, API reachability",
    url: "https://ucdpapi.pcr.uu.se/api/battledeaths/24.1?pagesize=5",
    expect: /"Result"|"conflict_id"/i,
    licence: "CC BY 4.0",
  },

  // ── Protest events and campaign outcomes ───────────────────────────────
  {
    id: "mass-mobilization",
    what: "Mass Mobilization Project landing page (Clark & Regan, Harvard Dataverse)",
    url: "https://dataverse.harvard.edu/api/datasets/:persistentId/?persistentId=doi:10.7910/DVN/HTTWYL",
    expect: /"status"\s*:\s*"OK"|latestVersion/,
    claimedScale: "~17k protest events, 162 countries, 1990-2020",
    licence: "CC0 (Dataverse)",
  },
  {
    id: "navco",
    what: "NAVCO campaign data search on Harvard Dataverse",
    url: "https://dataverse.harvard.edu/api/search?q=NAVCO&type=dataset&per_page=10",
    expect: /"status"\s*:\s*"OK"/,
    claimedScale: "600+ campaigns, 1900-2019",
    licence: "varies by version",
  },

  // ── Regime and fragility scoring, four independent attempts ────────────
  {
    id: "vdem-github",
    what: "V-Dem data package on GitHub (vdeminstitute/vdemdata)",
    url: "https://raw.githubusercontent.com/vdeminstitute/vdemdata/master/DESCRIPTION",
    expect: /Package:/,
    claimedScale: "~4,000 indicators, 202 countries, 1789-present",
    licence: "see V-Dem terms",
  },
  {
    id: "fragile-states",
    what: "Fund for Peace Fragile States Index, downloads page",
    url: "https://fragilestatesindex.org/excel/",
    expect: /xlsx|excel|download/i,
    claimedScale: "179 countries, 12 indicators, 2006-present",
    licence: "non-commercial, attribution",
  },
  {
    id: "freedom-house",
    what: "Freedom House Freedom in the World, data page",
    url: "https://freedomhouse.org/report/freedom-world",
    expect: /freedom in the world/i,
    licence: "attribution",
  },
  {
    id: "systemic-peace",
    what: "Polity5 / Center for Systemic Peace data page",
    url: "https://www.systemicpeace.org/inscrdata.html",
    expect: /polity/i,
    licence: "academic use",
  },

  // ── The measurable core of the "useful idiot" idea ─────────────────────
  // Foreign influence operations are real, documented and counted. That is the
  // part of the thesis that has evidence behind it, so the probe checks
  // whether the counts can be read rather than remembered.
  {
    id: "oii-propaganda",
    what: "Oxford Internet Institute, Industrialized Disinformation country report",
    url: "https://demtech.oii.ox.ac.uk/research/posts/industrialized-disinformation/",
    expect: /disinformation|cyber troop/i,
    claimedScale: "81 countries with organised manipulation, 2020 report",
    licence: "attribution",
  },
  {
    id: "sio-takedowns",
    what: "Stanford Internet Observatory influence-operation archive",
    url: "https://io.stanford.edu/",
    expect: /influence|takedown|observatory/i,
    licence: "attribution",
  },
  {
    id: "eu-disinfolab",
    what: "EU DisinfoLab investigations index",
    url: "https://www.disinfo.eu/publications/",
    expect: /disinfo/i,
    licence: "attribution",
  },
];

interface Finding {
  id: string;
  what: string;
  url: string;
  ok: boolean;
  status: string;
  /** Did the body look like the thing, not just answer 200? */
  looksRight: boolean | null;
  bytes: number | null;
  /** First line of the body, so a login wall is visible in the report. */
  head: string | null;
  claimedScale?: string;
  licence?: string;
}

async function probe(t: Target): Promise<Finding> {
  // No cache: the point is what the host says right now, from Actions.
  const res = await getText(t.url, { cacheMs: 0, retries: 2, timeoutMs: 45_000 });
  const body = res.data ?? "";
  return {
    id: t.id,
    what: t.what,
    url: t.url,
    ok: res.ok,
    status: res.ok ? "200" : (res.error ?? "failed"),
    looksRight: res.ok ? t.expect.test(body) : null,
    bytes: res.ok ? body.length : null,
    head: res.ok ? body.slice(0, 220).replace(/\s+/g, " ").trim() : null,
    ...(t.claimedScale ? { claimedScale: t.claimedScale } : {}),
    ...(t.licence ? { licence: t.licence } : {}),
  };
}

export async function run(): Promise<void> {
  const findings: Finding[] = [];
  for (const t of TARGETS) {
    const f = await probe(t);
    findings.push(f);
    const mark = !f.ok ? "dead" : f.looksRight ? "ok" : "200 but wrong shape";
    console.log(`  ${mark.padEnd(20)} ${f.id}  ${f.bytes ?? 0} bytes`);

    // Written after every target, not at the end. A run killed by the job
    // timeout still leaves behind everything it learned — the all-or-nothing
    // write is this project's most repeated failure and it is not repeating
    // here.
    await mkdir(join(ROOT, "data", "live"), { recursive: true });
    await writeFile(OUT, JSON.stringify({
      probedAt: new Date().toISOString(),
      note: "Reachability only. No series are published from this file.",
      findings,
    }, null, 2) + "\n", "utf8");
  }

  const live = findings.filter((f) => f.ok && f.looksRight).length;
  console.log(`\n${live} of ${findings.length} targets returned something usable.`);
}

if (isEntryPoint(import.meta.url)) {
  run().catch((err) => { console.error(err); process.exit(1); });
}
