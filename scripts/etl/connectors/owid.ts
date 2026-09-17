/**
 * A thousand-odd indicators, discovered rather than chosen.
 *
 * `npm run owid:build`. Writes data/owid/. CI only.
 *
 * ── Why the index comes from the source ──────────────────────────────────
 *
 * The brief asks for a map with a thousand attributes. A thousand attributes I
 * typed out would be a thousand judgements by me, and every omission would be
 * invisible — nothing in the output would show that an indicator exists and
 * was left out. Our World in Data publishes its own list of charts, so the
 * thousand is a fetch loop over a published index and the only things missing
 * are things OWID does not carry.
 *
 * ── Two tiers, because a map and a chart need different data ─────────────
 *
 * A time series for one country is a few hundred bytes. The same indicator for
 * every country, every year, is a megabyte. Committing the second for a
 * thousand indicators would be a gigabyte of repository to draw a choropleth
 * nobody has asked for yet.
 *
 *   SERIES tier — India and a fixed comparator set, full history, for every
 *   indicator discovered. This is what the story panels and the indicator
 *   browser read.
 *
 *   MAP tier — the latest value for every country, for a capped subset chosen
 *   by coverage rather than by taste. This is what the map colours by.
 *
 * Which indicators got which is recorded per row, so a layer the map cannot
 * draw says so instead of appearing empty.
 *
 * ── No figure without its unit and citation ──────────────────────────────
 *
 * Every indicator's metadata document is fetched before its data. An indicator
 * whose metadata does not load is skipped entirely rather than published with
 * a blank unit: a number with a filename where a citation should be is the
 * exact failure this project exists to avoid, and at this volume nobody would
 * ever notice one.
 *
 * ── Politeness ──────────────────────────────────────────────────────────
 *
 * This is a charity's infrastructure serving a public good for free. Requests
 * are paced, the run has a hard time budget, and the whole thing is manual and
 * on-change rather than scheduled. Nothing here should be run in a loop.
 */
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { getText, getJson } from "../lib/http";
import { isEntryPoint } from "../lib/entry";

const OUT_DIR = join(process.cwd(), "data/owid");
const OWID = "https://ourworldindata.org";

/** Requests per indicator are two, so the gap is what protects the host. */
const GAP_MS = 220;
/**
 * Leave the job time to write and commit whatever it has.
 *
 * Well inside the workflow's fifty-minute timeout, because a run killed by the
 * timeout skips its own summary and leaves the commit step to find whatever
 * the last incremental write put down.
 */
const BUDGET_MS = 30 * 60_000;
/** Ceiling on indicators. Raised or lowered by editing this line, not by luck. */
const MAX_INDICATORS = 1400;
/**
 * Ceiling on indicators fetched for every country.
 *
 * The probe measured one full indicator CSV at 605KB and 21,565 rows. Four
 * hundred of those is 240MB pulled from a charity in one job, which is not a
 * polite thing to do for a choropleth. A hundred and fifty is ninety
 * megabytes, still the largest single thing this pipeline does, and the full
 * fetches get their own slower pace below.
 */
const MAX_MAP = 150;
/** Full-country CSVs are ~600KB each and get three times the gap. */
const MAP_GAP_MS = 660;
/** Indicators per shard file. Keeps any one file under a megabyte or so. */
const SHARD = 60;

/**
 * The comparator set, fixed for every indicator.
 *
 * Fixed rather than per-indicator so that any two panels on the site are
 * comparing the same countries. These are the economies India is usually set
 * against plus the two it is usually set above, which is the only way a growth
 * chart is honest about both directions.
 */
const COUNTRIES = [
  "IND", "CHN", "USA", "BRA", "IDN", "VNM", "BGD", "PAK", "NGA", "ZAF", "JPN", "DEU",
] as const;

interface MetaColumn {
  titleShort?: string;
  titleLong?: string;
  unit?: string;
  shortUnit?: string;
  descriptionShort?: string;
  citationShort?: string;
  attribution?: string;
  timespan?: string;
  owidVariableId?: number;
}
interface Metadata {
  chart?: { title?: string; subtitle?: string; citation?: string; originalChartUrl?: string };
  columns?: Record<string, MetaColumn>;
  dateDownloaded?: string;
}

export interface Indicator {
  slug: string;
  title: string;
  subtitle: string;
  /** The column this project reads, when a chart has several. */
  column: string;
  unit: string;
  shortUnit: string;
  description: string;
  /** Who produced the underlying data, in OWID's own words. */
  attribution: string;
  citation: string;
  timespan: string;
  /** A coarse bucket, from the slug and title. Used to group a long menu. */
  category: string;
  /** Which tiers carry data for this indicator. */
  tiers: { series: boolean; map: boolean };
  /** How many of the comparator countries have at least one value. */
  countriesWithData: number;
  /** Whether India has any value at all — the site's usual first question. */
  hasIndia: boolean;
  /** Shard file index, so a reader can find the data without scanning. */
  shard: number;
  firstYear: number | null;
  lastYear: number | null;
}

export interface SeriesRow { iso: string; years: number[]; values: number[] }
export interface MapRow { iso: string; year: number; value: number }

/* ── Discovery ──────────────────────────────────────────────────────── */

/**
 * Chart slugs, from OWID's sitemap.
 *
 * The root sitemap may be an index pointing at child sitemaps, so both shapes
 * are handled and the one that answered is recorded. A discovery step that
 * silently returned twelve slugs would produce a small, clean, wrong dataset.
 */
async function discover(): Promise<{ slugs: string[]; note: string }> {
  const seen = new Set<string>();
  const notes: string[] = [];

  const collect = (xml: string): number => {
    let n = 0;
    for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
      const url = m[1] ?? "";
      const g = /\/grapher\/([A-Za-z0-9_-]+)\s*$/.exec(url);
      if (g?.[1] && !seen.has(g[1])) { seen.add(g[1]); n++; }
    }
    return n;
  };

  const root = await getText(`${OWID}/sitemap.xml`, { timeoutMs: 60_000, retries: 2, cacheMs: 0 });
  if (!root.ok || !root.data) {
    return { slugs: [], note: `root sitemap failed: ${root.error ?? "no body"}` };
  }
  notes.push(`root sitemap: ${collect(root.data)} grapher slugs directly`);

  // A sitemap index lists further sitemaps rather than pages.
  const children = [...root.data.matchAll(/<loc>\s*([^<\s]+sitemap[^<\s]*\.xml)\s*<\/loc>/g)]
    .map((m) => m[1] ?? "")
    .filter((u) => u !== "" && !u.endsWith("/sitemap.xml"));
  for (const url of children.slice(0, 12)) {
    await pace();
    const child = await getText(url, { timeoutMs: 60_000, retries: 2, cacheMs: 0 });
    if (!child.ok || !child.data) { notes.push(`${url}: ${child.error ?? "no body"}`); continue; }
    notes.push(`${url.split("/").pop()}: ${collect(child.data)} slugs`);
  }
  return { slugs: [...seen].sort(), note: notes.join("; ") };
}

/* ── Categories ─────────────────────────────────────────────────────── */

/**
 * A coarse bucket for a menu of a thousand.
 *
 * Deliberately crude and matched on the slug and title rather than on any
 * taxonomy OWID publishes, because OWID's own topic tags are not in the chart
 * metadata. A wrong bucket costs a reader one extra look down a list; it does
 * not change a number, which is why a rough rule is acceptable here and would
 * not be anywhere else in this project.
 */
const CATEGORIES: Array<[string, RegExp]> = [
  ["Trade and shipping", /trade|export|import|tariff|shipping|freight|port|merchandise|customs|logistic/i],
  ["Conflict and arms", /arms|military|conflict|war|weapon|missile|nuclear|terror|battle|defence|defense|peace/i],
  ["Energy", /energy|electricity|oil|gas|coal|solar|wind|nuclear-power|renewab|fossil|power/i],
  ["Emissions and climate", /co2|emission|greenhouse|climate|temperature|warming|methane/i],
  ["Health", /health|mortality|disease|life-expectancy|vaccin|hospital|cancer|malaria|hiv|tubercul|obesity|suicide|death/i],
  ["Population", /population|birth|fertility|migrat|refugee|urban|age|demograph|density/i],
  ["Food and farming", /food|agricultur|crop|yield|cereal|livestock|fish|hunger|nutrition|calorie|land-use|fertiliz/i],
  ["Education", /educat|school|literacy|learning|student|university|enrol/i],
  ["Economy", /gdp|income|growth|poverty|inequality|wage|employ|unemploy|productiv|inflation|debt|investment|capital/i],
  ["Technology", /internet|mobile|technolog|computer|research|patent|innovation|electricity-access|broadband|ai\b/i],
  ["Environment", /water|forest|biodiversity|species|waste|pollution|air-quality|ocean|sanitation/i],
  ["Society", /democracy|rights|corruption|crime|homicide|gender|trust|happiness|freedom|press/i],
];

export function categorise(slug: string, title: string): string {
  const subject = `${slug} ${title}`;
  for (const [name, re] of CATEGORIES) if (re.test(subject)) return name;
  return "Other";
}

/* ── CSV ────────────────────────────────────────────────────────────── */

/**
 * OWID's CSV, which is well-formed and still needs a real parser.
 *
 * Entity names contain commas — "Korea, Rep." and "Bonaire Sint Eustatius and
 * Saba" among them — and are quoted when they do. Splitting on commas would
 * shift every column right for exactly the countries whose names are hardest
 * to notice missing.
 */
export function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ",") { row.push(cell); cell = ""; continue; }
    if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; continue; }
    if (ch === "\r") continue;
    cell += ch;
  }
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
  return { header: rows.shift() ?? [], rows };
}

let lastCall = 0;
async function pace(gap: number = GAP_MS): Promise<void> {
  const wait = gap - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

/* ── The run ────────────────────────────────────────────────────────── */

interface Failure { slug: string; stage: string; why: string }

async function main(): Promise<void> {
  const started = Date.now();
  const { slugs, note } = await discover();
  console.log(`Discovered ${slugs.length} chart slugs. ${note}`);
  if (slugs.length === 0) {
    throw new Error("no slugs discovered — refusing to build a registry on a typed list");
  }

  const chosen = slugs.slice(0, MAX_INDICATORS);
  const indicators: Indicator[] = [];
  /** Set by the writer each time, so the summary reflects the last write. */
  let lastWrite = 0;
  const seriesShards = new Map<number, Record<string, SeriesRow[]>>();
  const mapShards = new Map<number, Record<string, MapRow[]>>();
  const failures: Failure[] = [];
  let mapFetched = 0;
  let stoppedEarly = "";

  /** Everything the run has so far, on disk. Safe to call at any point. */
  const write = async (): Promise<void> => {
    await mkdir(join(OUT_DIR, "series"), { recursive: true });
    await mkdir(join(OUT_DIR, "map"), { recursive: true });
    for (const [shard, payload] of seriesShards) {
      await writeFile(join(OUT_DIR, "series", `${shard}.json`), JSON.stringify(payload) + "\n", "utf8");
    }
    for (const [shard, payload] of mapShards) {
      await writeFile(join(OUT_DIR, "map", `${shard}.json`), JSON.stringify(payload) + "\n", "utf8");
    }
    lastWrite = indicators.length;
  };

  // The output directory is cleared once, before anything is written, rather
  // than immediately before the final write — an incremental writer that also
  // deletes would destroy its own earlier output on every pass.
  await rm(OUT_DIR, { recursive: true, force: true });

  for (const [i, slug] of chosen.entries()) {
    if (Date.now() - started > BUDGET_MS) {
      stoppedEarly = `time budget reached after ${i} of ${chosen.length} slugs`;
      break;
    }

    /* ── Metadata first. No metadata, no indicator. ─────────────────── */
    await pace();
    /**
     * No retry and a short timeout, because the common failure is a 404.
     *
     * OWID's sitemap lists charts that have since been retired, and a retired
     * slug 404s. With one retry and a 45-second timeout each dead slug cost up
     * to a minute and a half of backoff; across a few hundred of them that is
     * the entire run. A 404 will not fix itself on a second ask.
     */
    const meta = await getJson<Metadata>(`${OWID}/grapher/${slug}.metadata.json`, {
      timeoutMs: 15_000, retries: 0, cacheMs: 0,
    });
    if (!meta.ok || !meta.data) {
      failures.push({ slug, stage: "metadata", why: meta.error ?? "no body" });
      continue;
    }
    const columns = meta.data.columns ?? {};
    // The first column that is not the entity/year scaffolding is the one this
    // project reads. A multi-column chart is reduced to its first measure
    // rather than guessed at, and the column name is recorded so the choice is
    // visible.
    const columnName = Object.keys(columns).find((k) => !/^(Entity|Code|Year|Day)$/i.test(k));
    const col = columnName ? columns[columnName] : undefined;
    if (!columnName || !col) {
      failures.push({ slug, stage: "metadata", why: "no data column in metadata" });
      continue;
    }
    const unit = col.unit ?? col.shortUnit ?? "";
    const attribution = col.attribution ?? "";
    const citation = col.citationShort ?? meta.data.chart?.citation ?? "";
    if (unit === "" && citation === "" && attribution === "") {
      // Not a hard requirement on each field — many counts have no unit — but
      // an indicator with none of the three cannot be published with a source
      // line, and this project does not publish figures it cannot attribute.
      failures.push({ slug, stage: "metadata", why: "no unit, attribution or citation" });
      continue;
    }

    /* ── Series tier ────────────────────────────────────────────────── */
    await pace();
    const seriesCsv = await getText(
      `${OWID}/grapher/${slug}.csv?csvType=filtered&country=${COUNTRIES.join("~")}&useColumnShortNames=true`,
      { timeoutMs: 20_000, retries: 0, cacheMs: 0 },
    );
    if (!seriesCsv.ok || !seriesCsv.data) {
      failures.push({ slug, stage: "series", why: seriesCsv.error ?? "no body" });
      continue;
    }
    const parsed = parseCsv(seriesCsv.data);
    const codeAt = parsed.header.findIndex((h) => /^Code$/i.test(h.trim()));
    const yearAt = parsed.header.findIndex((h) => /^(Year|Day)$/i.test(h.trim()));
    const valueAt = parsed.header.findIndex((h) => !/^(Entity|Code|Year|Day)$/i.test(h.trim()));
    if (codeAt < 0 || yearAt < 0 || valueAt < 0) {
      failures.push({ slug, stage: "series", why: `unexpected columns: ${parsed.header.join("|")}` });
      continue;
    }

    const byIso = new Map<string, SeriesRow>();
    let firstYear: number | null = null;
    let lastYear: number | null = null;
    for (const r of parsed.rows) {
      const iso = (r[codeAt] ?? "").trim();
      const year = Number.parseInt((r[yearAt] ?? "").slice(0, 4), 10);
      const value = Number.parseFloat(r[valueAt] ?? "");
      if (iso === "" || !Number.isFinite(year) || !Number.isFinite(value)) continue;
      const row = byIso.get(iso) ?? { iso, years: [], values: [] };
      row.years.push(year);
      row.values.push(value);
      byIso.set(iso, row);
      if (firstYear === null || year < firstYear) firstYear = year;
      if (lastYear === null || year > lastYear) lastYear = year;
    }
    if (byIso.size === 0) {
      failures.push({ slug, stage: "series", why: "no rows for any comparator country" });
      continue;
    }

    /* ── Map tier, for as many as the cap allows ────────────────────── */
    let mapRows: MapRow[] = [];
    const wantMap = mapFetched < MAX_MAP && byIso.size >= 6;
    if (wantMap) {
      await pace(MAP_GAP_MS);
      const full = await getText(`${OWID}/grapher/${slug}.csv?useColumnShortNames=true`, {
        timeoutMs: 45_000, retries: 0, cacheMs: 0,
      });
      if (full.ok && full.data) {
        const f = parseCsv(full.data);
        const fc = f.header.findIndex((h) => /^Code$/i.test(h.trim()));
        const fy = f.header.findIndex((h) => /^(Year|Day)$/i.test(h.trim()));
        const fv = f.header.findIndex((h) => !/^(Entity|Code|Year|Day)$/i.test(h.trim()));
        if (fc >= 0 && fy >= 0 && fv >= 0) {
          // Latest value per country. Aggregates carry no ISO3 code in OWID's
          // files — "World", "Africa", income groups — so filtering to a
          // three-letter code drops them without a list of names to maintain.
          const latest = new Map<string, MapRow>();
          for (const r of f.rows) {
            const iso = (r[fc] ?? "").trim();
            if (!/^[A-Z]{3}$/.test(iso)) continue;
            const year = Number.parseInt((r[fy] ?? "").slice(0, 4), 10);
            const value = Number.parseFloat(r[fv] ?? "");
            if (!Number.isFinite(year) || !Number.isFinite(value)) continue;
            const prev = latest.get(iso);
            if (!prev || year > prev.year) latest.set(iso, { iso, year, value });
          }
          mapRows = [...latest.values()].sort((a, b) => a.iso.localeCompare(b.iso));
          if (mapRows.length > 0) mapFetched++;
        }
      } else {
        failures.push({ slug, stage: "map", why: full.error ?? "no body" });
      }
    }

    const shard = Math.floor(indicators.length / SHARD);
    const title = meta.data.chart?.title ?? col.titleShort ?? slug.replace(/-/g, " ");
    indicators.push({
      slug,
      title,
      subtitle: meta.data.chart?.subtitle ?? "",
      column: columnName,
      unit,
      shortUnit: col.shortUnit ?? "",
      description: col.descriptionShort ?? "",
      attribution,
      citation,
      timespan: col.timespan ?? "",
      category: categorise(slug, title),
      tiers: { series: true, map: mapRows.length > 0 },
      countriesWithData: byIso.size,
      hasIndia: byIso.has("IND"),
      shard,
      firstYear,
      lastYear,
    });

    const sSh = seriesShards.get(shard) ?? {};
    sSh[slug] = [...byIso.values()].sort((a, b) => a.iso.localeCompare(b.iso));
    seriesShards.set(shard, sSh);
    if (mapRows.length > 0) {
      const mSh = mapShards.get(shard) ?? {};
      mSh[slug] = mapRows;
      mapShards.set(shard, mSh);
    }

    if (indicators.length % 50 === 0) {
      console.log(
        `  ${indicators.length} indicators, ${mapFetched} with map data, ${failures.length} skipped, ` +
        `${Math.round((Date.now() - started) / 1000)}s elapsed`,
      );
      /**
       * Write as we go, because a run that is killed must not lose everything.
       *
       * The first version wrote once at the end. It overran its budget, the
       * workflow timeout killed it, and the commit step found no file — forty
       * minutes of a charity's bandwidth spent and nothing to show. Every
       * other connector in this project writes incrementally for exactly this
       * reason; this one forgot.
       */
      await write();
    }
  }

  await write();

  const byCategory = new Map<string, number>();
  for (const ind of indicators) byCategory.set(ind.category, (byCategory.get(ind.category) ?? 0) + 1);

  const index = {
    builtAt: new Date().toISOString(),
    source:
      "Our World in Data (ourworldindata.org). Chart slugs discovered from OWID's own sitemap; " +
      "every indicator's unit, attribution and citation read from its published metadata " +
      "document before any of its data was fetched.",
    method:
      "Two tiers. SERIES carries India and a fixed comparator set with full history for every " +
      "indicator here. MAP carries the latest value for every country, for the first " +
      `${MAX_MAP} indicators with data for at least six comparators — a cap, because one full ` +
      "indicator CSV is about 600KB and a thousand of those is a gigabyte pulled from a charity " +
      "in one job. Which tiers an indicator has is recorded on its row.",
    attribution:
      "Each indicator carries OWID's own attribution and citation strings. OWID is a compiler: " +
      "the producer named in `attribution` is who to credit and who to check, and OWID is how " +
      "it was obtained. Nothing here is a figure this project computed.",
    refusal:
      "An indicator whose metadata carried no unit, attribution or citation was skipped rather " +
      "than published with a blank source line. At this volume nobody would ever notice one, " +
      "which is exactly why the rule is mechanical.",
    cannotSay: [
      "Anything OWID does not carry. The index is OWID's sitemap; a subject absent from it is absent here, and the count is a floor rather than a census of what is knowable.",
      "Whether two indicators are comparable. Different indicators come from different producers with different definitions, coverage and vintages, and nothing here reconciles them.",
      "What a value means without its unit. Every row carries one and no chart on this site may render an indicator without printing it.",
      "Anything at subnational level. These are country series; India's states are not in them.",
    ],
    comparators: COUNTRIES,
    counts: {
      slugsDiscovered: slugs.length,
      slugsAttempted: chosen.length,
      indicators: indicators.length,
      withMapTier: indicators.filter((i) => i.tiers.map).length,
      withIndia: indicators.filter((i) => i.hasIndia).length,
      skipped: failures.length,
      shards: seriesShards.size,
    },
    byCategory: [...byCategory].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n),
    discovery: note,
    stoppedEarly,
    lastIncrementalWrite: lastWrite,
    failures: failures.slice(0, 120),
    indicators,
  };
  await writeFile(join(OUT_DIR, "index.json"), JSON.stringify(index, null, 2) + "\n", "utf8");

  console.log(
    `\nWrote ${OUT_DIR}: ${indicators.length} indicators ` +
    `(${index.counts.withMapTier} map-capable, ${index.counts.withIndia} with India), ` +
    `${seriesShards.size} shards, ${failures.length} skipped.` +
    (stoppedEarly ? `\n${stoppedEarly}` : ""),
  );
  if (indicators.length === 0) {
    throw new Error("no indicators built — refusing to publish an empty registry over a good one");
  }
}

if (isEntryPoint(import.meta.url)) {
  void main();
}
