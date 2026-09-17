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
import { mkdir, writeFile, rm, readdir } from "node:fs/promises";
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
 * Well inside the workflow's timeout, because a run killed by the timeout
 * skips its own summary and leaves the commit step to find whatever the last
 * incremental write put down.
 *
 * Sized from a measurement rather than a guess. At forty-six minutes the run
 * reached 1,197 of its 2,162 slugs and produced 757 indicators — 2.3 seconds a
 * slug, most of it the pacing this connector imposes on itself. Finishing the
 * stride needs about eighty-three minutes, so this is that with headroom.
 *
 * Two hours of a crawl at roughly one request every one and a half seconds is
 * a modest thing to ask of a public data site, and this job is manual and
 * on-change rather than scheduled. The byte budget below is the harder limit
 * and the one more likely to bind.
 */
const BUDGET_MS = 110 * 60_000;
/**
 * Target number of slugs to attempt, spread across the whole index by stride.
 *
 * Roughly a quarter are skipped for carrying no unit or citation, or for
 * having no data for any comparator, so this is set well above the number of
 * indicators wanted.
 */
const MAX_INDICATORS = 2000;
/**
 * A ceiling on total bytes, because the run now pulls a full CSV per indicator.
 *
 * There is no parameter that returns one country's series from these charts,
 * so every indicator arrives whole — every country, every year. The probe
 * measured two of them: a map-default chart at 36KB and `life-expectancy` at
 * 605KB. The spread is wide enough that a count of indicators is not a
 * prediction of bandwidth, so the limit is on the bytes themselves.
 *
 * Six hundred megabytes is the most this job should ever pull from a charity's
 * infrastructure in one go. Whichever of time or bytes runs out first stops
 * the run, and the summary says which — so the next change is made against the
 * constraint that actually bound rather than the one assumed.
 */
const MAX_BYTES = 600 * 1024 * 1024;
/**
 * The gap between the full CSVs, which are the large request.
 *
 * Three times the metadata gap. Two requests per indicator at 220 and 660
 * gives roughly a request a second, sustained, which is a rate a human
 * clicking through the site could plausibly produce.
 */
const FULL_GAP_MS = 660;
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

/** The same set as a lookup, because the filtering is now done here. */
const COMPARATOR_SET = new Set<string>(COUNTRIES);

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
  /**
   * How many data columns the chart has.
   *
   * Above one, the chart's title names a comparison rather than the column
   * taken, and is not a label for the figure. See the pick site for what that
   * shipped as.
   */
  columnCount: number;
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

/**
 * How many 403s the run has seen. Each one widens the gap a little.
 *
 * A 403 from a CDN under load is a request to slow down, and a connector that
 * keeps the same cadence through them is both rude and losing data. This backs
 * off permanently for the rest of the run rather than per request, because the
 * condition is about the host and not about the slug.
 */
let rateLimited = 0;

let lastCall = 0;
async function pace(gap: number = GAP_MS): Promise<void> {
  const wait = gap + Math.min(rateLimited * 8, 400) - (Date.now() - lastCall);
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

  /**
   * Sample across the whole list, never a prefix.
   *
   * The slugs come back sorted, and the first version took the first N of
   * them. When the time budget stopped that run at slug 1,029 of 4,324, the
   * registry it produced was everything from "above-ground-biomass" to roughly
   * the letter M — which showed up as 166 health indicators against 27
   * economic ones and looked like a fact about what OWID covers. It was a fact
   * about the alphabet.
   *
   * Striding gives an unbiased spread across the whole index, is deterministic
   * so two runs agree, and degrades correctly: a run cut short has thinner
   * coverage everywhere rather than complete coverage of the first half.
   */
  const stride = Math.max(1, Math.floor(slugs.length / MAX_INDICATORS));
  const chosen = stride === 1 ? slugs : slugs.filter((_, i) => i % stride === 0);
  console.log(
    `Attempting ${chosen.length} of ${slugs.length} slugs, every ${stride}${stride === 1 ? "" : stride === 2 ? "nd" : "th"} ` +
    "— a stride across the whole index rather than a prefix of it.",
  );
  const indicators: Indicator[] = [];
  /** Set by the writer each time, so the summary reflects the last write. */
  let lastWrite = 0;
  const seriesShards = new Map<number, Record<string, SeriesRow[]>>();
  const mapShards = new Map<number, Record<string, MapRow[]>>();
  const failures: Failure[] = [];
  let mapFetched = 0;
  /** Total CSV bytes pulled from the host, which is now the binding cost. */
  let bytesPulled = 0;
  let stoppedEarly = "";

  /**
   * The registry's own description of itself, as of right now.
   *
   * A function rather than a value because it is written on every incremental
   * pass, so its counts and `stoppedEarly` describe the state on disk at that
   * moment. A partial registry that reported finished counts would be worse
   * than one with no index at all.
   */
  const buildIndex = () => {
    const byCategory = new Map<string, number>();
    for (const ind of indicators) byCategory.set(ind.category, (byCategory.get(ind.category) ?? 0) + 1);
    return {
      builtAt: new Date().toISOString(),
      source:
        "Our World in Data (ourworldindata.org). Chart slugs discovered from OWID's own sitemap; " +
        "every indicator's unit, attribution and citation read from its published metadata " +
        "document before any of its data was fetched.",
      method:
        "One request per indicator, for the whole export — every country, every year — because a " +
        "probe against a map-default chart found that the country parameter is accepted and " +
        "ignored, and that time=earliest..latest returns those two years rather than the span " +
        "between them. There is no parameter combination that returns one country's series, so " +
        "every filter here is applied after the file arrives. Two tiers come out of that one " +
        "response: SERIES carries India and a fixed comparator set with full history, and MAP " +
        "carries the latest value for every country. Which tiers an indicator has is recorded on " +
        "its row. The run stops on whichever of its time or byte budget runs out first, and says " +
        "which.",
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
      stride,
      rateLimited,
      bytesPulled,
      failures: failures.slice(0, 120),
      indicators,
    };
  };

  /**
   * Everything the run has so far, on disk, index included. Safe at any point.
   *
   * ── Why the index is written on every pass, not only at the end ──────
   *
   * It used to be written last. The shards went down every fifty indicators so
   * a killed run would keep what it had fetched, and the index — the file that
   * names the indicators, records the units and citations, and makes the
   * shards readable at all — was written once, after the loop.
   *
   * Then a run was cancelled ninety seconds in. It had cleared the output
   * directory, written one incremental pass of about fifty indicators, and
   * produced no index. The commit step saw a non-empty directory, reasoned
   * that shards from a cut-short run were better than losing the run, and
   * committed: 684 indicators replaced by 50, and index.json deleted. Shards
   * without an index are inert — the site read no registry at all.
   *
   * Writing the index every time makes every incremental state a complete,
   * self-describing registry rather than a pile of shards waiting for one. The
   * counts and `stoppedEarly` in it are true as of that write, so a partial
   * registry says how partial it is instead of looking finished.
   */
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
    await writeFile(join(OUT_DIR, "index.json"), JSON.stringify(buildIndex(), null, 2) + "\n", "utf8");
  };

  /**
   * Stale shards are removed after the run, not before it.
   *
   * Clearing the directory up front is what let a cancelled run publish a
   * deletion: by the time it was killed the old registry was already gone from
   * the working tree, and everything downstream only saw a directory with
   * fewer files in it. A shard file this run did not write is stale only once
   * the run has finished deciding how many shards there are, so that is when
   * it goes.
   */
  const dropStaleShards = async (): Promise<void> => {
    for (const kind of ["series", "map"] as const) {
      const dir = join(OUT_DIR, kind);
      let names: string[] = [];
      try { names = await readdir(dir); } catch { continue; }
      const live = kind === "series" ? seriesShards : mapShards;
      for (const name of names) {
        const n = Number.parseInt(name.replace(/\.json$/, ""), 10);
        if (!Number.isFinite(n) || live.has(n)) continue;
        await rm(join(dir, name), { force: true });
      }
    }
  };

  for (const [i, slug] of chosen.entries()) {
    if (Date.now() - started > BUDGET_MS) {
      stoppedEarly = `time budget reached after ${i} of ${chosen.length} slugs`;
      break;
    }
    if (bytesPulled > MAX_BYTES) {
      stoppedEarly =
        `byte budget reached after ${i} of ${chosen.length} slugs `
        + `(${(bytesPulled / 1024 / 1024).toFixed(0)}MB pulled)`;
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
    // Fifty-four series requests came back 403 on the last run. Unlike a 404,
    // that is the host asking for less traffic and it does fix itself — so the
    // pace widens for the rest of the run rather than losing those slugs.
    if (!meta.ok && (meta.error ?? "").includes("403")) rateLimited++;
    if (!meta.ok || !meta.data) {
      failures.push({ slug, stage: "metadata", why: meta.error ?? "no body" });
      continue;
    }
    const columns = meta.data.columns ?? {};
    // The first column that is not the entity/year scaffolding is the one this
    // project reads. A multi-column chart is reduced to its first measure
    // rather than guessed at, and the column name is recorded so the choice is
    // visible.
    /**
     * How many measures this chart carries, recorded rather than collapsed.
     *
     * The registry takes a chart's first data column. On a single-measure
     * chart that is the chart, and the chart's title names it. On a chart with
     * several, the title names the comparison and not the column taken — so
     * "Age dependency breakdown" shipped carrying the old-age dependency ratio
     * under a heading for the whole breakdown, and "Access to electricity in
     * urban vs. rural areas" shipped carrying the urban figure with no way for
     * a reader to know which of the two they were looking at.
     *
     * The count is published so a page can decline to use the title as a label
     * when it is not one. Dropping these here instead would throw away data
     * that a chart naming its own column can still show honestly.
     */
    const dataColumns = Object.keys(columns).filter((k) => !/^(Entity|Code|Year|Day)$/i.test(k));
    const columnName = dataColumns[0];
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

    /* ── One fetch, both tiers ──────────────────────────────────────── */
    /**
     * `csvType=full`, and every filter applied here rather than asked for.
     *
     * The first version asked the way OWID's own download modal does:
     * `csvType=filtered&country=IND~CHN~…`. The probe had confirmed that works
     * — on `life-expectancy`, where it returned 85 rows, all India, and a
     * paired request for Brazil came back different. A clean answer to the
     * question that was put.
     *
     * What it did not ask is what "filtered" means on a chart whose default
     * view is a map, which is most of them. A re-probe against a known
     * map-default slug settled it:
     *
     *   country=IND           → 189 rows, every country, one year.
     *                           The request for Brazil returned an identical
     *                           file. The parameter does nothing at all.
     *   time=earliest..latest → 373 rows. Time IS honoured, but "earliest to
     *                           latest" means those two points, not the span
     *                           between them. Two years, not a series.
     *   csvType=full          → 1,342 rows, every country, every year, and it
     *                           ignores `country` too.
     *
     * So there is no parameter combination that returns a country's series for
     * these charts. The full export is the only shape that carries one, and
     * every filter has to be applied after it arrives.
     *
     * The registry that shipped on the old assumption had 465 of its 684
     * indicators holding a single year per country, and 416 holding more than
     * twenty countries after asking for thirteen. Each file was a valid CSV
     * with the right header and plausible values, every request returned 200,
     * and the run reported ok. Two thirds of a series tier with no series in
     * it, and the only reason anyone looked was that the sparklines drawn from
     * it were the wrong shape.
     *
     * The compensation for the larger payload is that the map tier now comes
     * out of the same response. It used to be a second request, capped at a
     * hundred and fifty indicators because it was the expensive one. Now it is
     * free, uncapped, and the requests per indicator drop from three to two.
     */
    await pace(FULL_GAP_MS);
    const fetchFull = () => getText(`${OWID}/grapher/${slug}.csv?csvType=full&useColumnShortNames=true`, {
      timeoutMs: 45_000, retries: 0, cacheMs: 0,
    });
    let csv = await fetchFull();
    /**
     * The one failure worth asking twice about.
     *
     * A 404 is a retired slug and will never answer, so nothing here retries
     * by default. A 403 is the opposite: the slug is fine and the CDN is
     * shedding load, which is why fifty-four of them landed in a single run
     * and every one threw away an indicator whose metadata had already been
     * fetched and paid for. A 403 widens the pace for the rest of the run and
     * asks once more after a pause.
     */
    if (!csv.ok && (csv.error ?? "").includes("403")) {
      rateLimited++;
      await pace(FULL_GAP_MS * 4);
      csv = await fetchFull();
    }
    if (!csv.ok || !csv.data) {
      failures.push({ slug, stage: "data", why: csv.error ?? "no body" });
      continue;
    }
    bytesPulled += csv.data.length;

    const parsed = parseCsv(csv.data);
    const codeAt = parsed.header.findIndex((h) => /^Code$/i.test(h.trim()));
    const yearAt = parsed.header.findIndex((h) => /^(Year|Day)$/i.test(h.trim()));
    const valueAt = parsed.header.findIndex((h) => !/^(Entity|Code|Year|Day)$/i.test(h.trim()));
    if (codeAt < 0 || yearAt < 0 || valueAt < 0) {
      failures.push({ slug, stage: "data", why: `unexpected columns: ${parsed.header.join("|")}` });
      continue;
    }

    /**
     * A Day column is not a Year column, and the difference is four characters.
     *
     * The year is read as the first four characters of the time cell, which on
     * a daily series turns 3,650 observations into ten years each repeated
     * three hundred and sixty-five times. One indicator in the last registry
     * carried 2,431 points for a single country on exactly this. The header
     * says which it is, so the check costs nothing and the indicator is
     * skipped rather than silently flattened.
     */
    if (/^Day$/i.test((parsed.header[yearAt] ?? "").trim())) {
      failures.push({ slug, stage: "data", why: "daily resolution; the year parser cannot represent it" });
      continue;
    }

    const byIso = new Map<string, SeriesRow>();
    const latest = new Map<string, MapRow>();
    let firstYear: number | null = null;
    let lastYear: number | null = null;
    for (const r of parsed.rows) {
      const iso = (r[codeAt] ?? "").trim();
      // Aggregates carry no ISO3 code in OWID's files — "World", "Africa",
      // income groups — so requiring three letters drops them without a list
      // of names to maintain.
      if (!/^[A-Z]{3}$/.test(iso)) continue;
      const year = Number.parseInt((r[yearAt] ?? "").slice(0, 4), 10);
      const value = Number.parseFloat(r[valueAt] ?? "");
      if (!Number.isFinite(year) || !Number.isFinite(value)) continue;

      // Map tier: every country, its most recent value.
      const prev = latest.get(iso);
      if (!prev || year > prev.year) latest.set(iso, { iso, year, value });

      // Series tier: the comparator set only, so the committed file stays the
      // size the old one was even though the fetch is now the whole world.
      if (!COMPARATOR_SET.has(iso)) continue;
      const row = byIso.get(iso) ?? { iso, years: [], values: [] };
      row.years.push(year);
      row.values.push(value);
      byIso.set(iso, row);
      if (firstYear === null || year < firstYear) firstYear = year;
      if (lastYear === null || year > lastYear) lastYear = year;
    }
    if (byIso.size === 0) {
      failures.push({ slug, stage: "data", why: "no rows for any comparator country" });
      continue;
    }
    // Years arrive in file order, which is entity-major and usually ascending
    // but is not promised to be. Everything downstream reads index 0 as the
    // earliest point, so the order is made true here rather than assumed.
    for (const row of byIso.values()) {
      const order = row.years.map((y, i) => i).sort((a, b) => row.years[a]! - row.years[b]!);
      row.years = order.map((i) => row.years[i]!);
      row.values = order.map((i) => row.values[i]!);
    }

    const mapRows: MapRow[] = [...latest.values()].sort((a, b) => a.iso.localeCompare(b.iso));
    if (mapRows.length > 0) mapFetched++;

    const shard = Math.floor(indicators.length / SHARD);
    const title = meta.data.chart?.title ?? col.titleShort ?? slug.replace(/-/g, " ");
    indicators.push({
      slug,
      title,
      subtitle: meta.data.chart?.subtitle ?? "",
      column: columnName,
      columnCount: dataColumns.length,
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

  await dropStaleShards();

  console.log(
    `\nWrote ${OUT_DIR}: ${indicators.length} indicators ` +
    `(${indicators.filter((i) => i.tiers.map).length} map-capable, ` +
    `${indicators.filter((i) => i.hasIndia).length} with India), ` +
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
