/**
 * India's welfare schemes, and the small number that publish their own reach.
 *
 *   npm run welfare:build
 *
 * ── The two halves, and how unequal they are ─────────────────────────────
 *
 * The roster is easy. Wikipedia's list of central government schemes carries
 * well over a hundred, grouped by the ministry that runs them, each linking to
 * its own article. That is a real index and it is what "a hundred welfare
 * schemes" means in practice.
 *
 * The coverage is not. The probe asked fourteen scheme dashboards what they
 * would give a script, and most gave nothing: PMAY-Gramin, Mission Antyodaya,
 * Saubhagya and the MGNREGA report server all refused at the connection;
 * Swachh Bharat's dashboard returned a 404; PM-KISAN served a 1.4 KB stub. The
 * myScheme API, which is the government's own scheme directory, answered 401.
 *
 * What survived was Jal Jeevan Mission, which publishes household-grain tap
 * coverage by state, and the Local Government Directory, which holds the count
 * of villages any village-grain percentage would need as its denominator.
 *
 * So this file is a roster of many schemes with coverage for very few, and the
 * page has to lead with that rather than bury it. A welfare tracker whose
 * coverage column is mostly empty is telling the truth about what Indian
 * scheme dashboards publish; one whose column is full has filled it from
 * somewhere it should not have.
 *
 * ── Four grains, which must never share a column ─────────────────────────
 *
 * Household. Taps per rural household, houses completed. The only grain where
 * "penetration" has an unambiguous denominator.
 *
 * Village. A percentage of villages, not of people — and villages differ in
 * size by orders of magnitude, so the two diverge sharply.
 *
 * Beneficiary count. How many people received something, with no denominator
 * at all. A count is not a rate and becomes one only if someone supplies the
 * eligible population, which is exactly where a tracker invents a number.
 *
 * District or state aggregate. Useful, and not a village-level claim however
 * it is worded.
 *
 * Every coverage row carries its grain, and nothing sums across them.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "../lib/http";
import { isEntryPoint } from "../lib/entry";

const ROOT = process.cwd();
const OUT = join(ROOT, "data", "schemes", "welfare.json");
const WIKI = "https://en.wikipedia.org/w/api.php";
/**
 * Candidate roster articles, tried in order until one carries enough schemes.
 *
 * The first run used only the first of these and read twenty-nine schemes
 * filed under sectors called "Telangana" and "Madhya Pradesh" — so that page
 * is a list of *state* schemes, not the ministry-grouped list of central ones
 * this needed. Rather than guess again at a cost of one CI round trip per
 * guess, every plausible title is tried and the one that yields most wins,
 * with the headings of each recorded so the choice is checkable.
 */
const LIST_PAGES = [
  "List_of_schemes_of_the_government_of_India",
  "List_of_Government_schemes_in_India",
  "Welfare_schemes_of_the_Government_of_India",
  "Category:Government_schemes_in_India",
];

export type Grain = "household" | "village" | "beneficiary-count" | "state-aggregate";

export interface Scheme {
  name: string;
  /** The ministry or theme heading the list filed it under. */
  sector: string | null;
  /** Launch year where the list states one. Never inferred from anything. */
  launched: number | null;
  /** The article, so a reader can go and check. */
  article: string | null;
}

export interface CoverageRow {
  scheme: string;
  grain: Grain;
  state: string;
  /** The measure's own words, e.g. "rural households with a tap connection". */
  measure: string;
  value: number;
  /** The denominator where the source states one; null where it does not. */
  of: number | null;
  asOf: string | null;
  source: string;
}

async function wikitext(page: string): Promise<string | null> {
  const url = `${WIKI}?action=parse&page=${encodeURIComponent(page)}` +
    "&redirects=1&prop=wikitext&formatversion=2&format=json";
  const res = await getText(url, { cacheMs: 12 * 3600_000, retries: 2, timeoutMs: 60_000 });
  if (!res.ok || !res.data) return null;
  try {
    return (JSON.parse(res.data) as { parse?: { wikitext?: string } }).parse?.wikitext ?? null;
  } catch {
    return null;
  }
}

/**
 * Scheme names out of the list article.
 *
 * The page is a run of `== Ministry ==` headings with bulleted links under
 * each, so the heading in scope when a bullet is read is that scheme's sector.
 * Reading links alone would give a flat list of a hundred names with no way to
 * group them, and the grouping is most of what makes a roster usable.
 *
 * A scheme's launch year is taken only when the bullet states one in
 * parentheses. It is never inferred from the article title or from anything
 * else, because a wrong year here is indistinguishable from a right one.
 */
export function readSchemes(text: string): { schemes: Scheme[]; headings: string[] } {
  const out: Scheme[] = [];
  const headings: string[] = [];
  const seen = new Set<string>();
  let sector: string | null = null;

  for (const line of text.split("\n")) {
    const head = /^(={2,4})\s*(.+?)\s*\1\s*$/.exec(line);
    if (head) {
      const label = (head[2] ?? "").replace(/\[\[|\]\]/g, "").trim();
      // "See also", "References" and friends are not sectors, and everything
      // filed under them is navigation rather than a scheme.
      if (headings.length < 60) headings.push(`${"=".repeat((head[1] ?? "==").length)} ${label}`);
      sector = /^(see also|references|external links|notes|further reading|bibliography)$/i
        .test(label) ? null : label;
      continue;
    }
    if (sector === null) continue;
    if (!/^\s*[*#]/.test(line)) continue;

    const body = line.replace(/^\s*[*#]+\s*/, "");
    // The first wikilink on a bullet is the scheme; later ones are the
    // ministry, the state, or a word that happens to be linked.
    const link = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/.exec(body);
    if (!link) continue;
    const article = (link[1] ?? "").split("#")[0]?.trim() ?? "";
    const name = (link[2] ?? link[1] ?? "").trim();
    if (!name || /^(file|image|category):/i.test(article)) continue;
    if (name.length < 4 || name.length > 90) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const year = /\((?:launched\s+)?(?:in\s+)?((?:19|20)\d{2})\)/.exec(body)
      ?? /\b((?:19|20)\d{2})\b/.exec(body.replace(/\[\[[^\]]*\]\]/g, ""));
    out.push({
      name,
      sector,
      launched: year ? Number(year[1]) : null,
      article: article || null,
    });
  }
  // ── Tables, which is where the central schemes actually are ──────────
  //
  // The first run read twenty-nine schemes, every one of them from a bulleted
  // list under a state heading, and none from the "== List ==" section at the
  // top of the article. That section is a wikitable, and a parser that reads
  // only bullets walks straight past it — so the central schemes, which are
  // the ones the ask is about, were entirely missing while the output looked
  // like a plausible short roster.
  let tableSector: string | null = null;
  for (const chunk of text.split(/\n(?==)/)) {
    const head = /^(={2,4})\s*(.+?)\s*\1\s*$/m.exec(chunk);
    if (head) tableSector = (head[2] ?? "").replace(/\[\[|\]\]/g, "").trim();
    if (!/\{\|/.test(chunk)) continue;
    for (const block of chunk.split(/\{\|/).slice(1)) {
      const table = block.split(/\n\|\}/)[0] ?? "";
      for (const rawRow of table.split(/\n\|-/).slice(1)) {
        const cells: string[] = [];
        for (const line of rawRow.split("\n")) {
          if (!/^\s*[|!]/.test(line)) continue;
          if (/^\s*\|\+/.test(line) || /^\s*!/.test(line)) continue;
          const body = line.replace(/^\s*\|+\s*/, "");
          for (const cell of body.split(/\s*\|\|\s*/)) cells.push(cell.trim());
        }
        if (cells.length === 0) continue;
        // The scheme is the first cell carrying a wikilink; later cells are
        // the ministry, the launch date and the outlay.
        const cell = cells.find((c) => /\[\[/.test(c));
        if (!cell) continue;
        const link = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/.exec(cell);
        if (!link) continue;
        const article = (link[1] ?? "").split("#")[0]?.trim() ?? "";
        const name = (link[2] ?? link[1] ?? "").trim();
        if (!name || /^(file|image|category):/i.test(article)) continue;
        if (name.length < 4 || name.length > 90) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        // A year anywhere else in the row, taken only from a cell that is not
        // the name — a scheme called "Mission 2047" must not date itself.
        const rest = cells.filter((c) => c !== cell).join(" ");
        const year = /\b((?:19|20)\d{2})\b/.exec(rest.replace(/\[\[[^\]]*\]\]/g, ""));
        out.push({
          name,
          sector: tableSector,
          launched: year ? Number(year[1]) : null,
          article: article || null,
        });
      }
    }
  }

  return { schemes: out, headings };
}

/**
 * The Jal Jeevan Mission dashboard's statewise rows.
 *
 * Its table is the one household-grain coverage series still reachable, and it
 * is an ASP.NET grid: a wall of `<td>` with no classes worth matching on. So
 * the parse works from the state name outward — a row is usable when its first
 * cell is a state the map can draw, and the two numbers after it are the
 * household total and the households with a tap.
 *
 * The shape is recorded in the output either way, because a dashboard that
 * changes its column order produces numbers that are wrong and well-formed,
 * and the next person to look needs the raw row to see it.
 */
export function readJjm(html: string, known: Set<string>): {
  rows: Array<{ state: string; households: number; withTap: number }>;
  sampleRow: string[] | null;
  rowsSeen: number;
  /** Every row's first cell, so a run that finds no states shows what it saw. */
  firstCells: string[];
  /** Whether the page is a frameset or a postback shell rather than a table. */
  shell: string | null;
} {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ");
  const rows: Array<{ state: string; households: number; withTap: number }> = [];
  let sampleRow: string[] | null = null;
  let rowsSeen = 0;
  const firstCells: string[] = [];
  const shell = /<iframe/i.test(html)
    ? "the page carries an iframe — the table is probably loaded into it"
    : /__VIEWSTATE/i.test(html) && rowsOf(html) < 10
      ? "an ASP.NET postback shell: the grid is populated by a POST this connector does not make"
      : null;

  for (const tr of text.split(/<tr[^>]*>/i).slice(1)) {
    const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((m) => (m[1] ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ").trim());
    if (cells.length < 3) continue;
    rowsSeen++;
    if (!sampleRow) sampleRow = cells.slice(0, 8);
    if (firstCells.length < 40 && cells[0]) firstCells.push(cells[0].slice(0, 40));

    const name = normaliseState(cells.find((c) => /[A-Za-z]{4}/.test(c)) ?? "", known);
    if (!name) continue;
    const numbers = cells
      .map((c) => {
        const m = /^([\d][\d,]*)$/.exec(c.replace(/\s/g, ""));
        return m ? Number(m[1]!.replace(/,/g, "")) : null;
      })
      .filter((n): n is number => n !== null && n > 0);
    if (numbers.length < 2) continue;
    // Households first, connections second: a state cannot have more taps than
    // households, so the larger of the first two is the denominator.
    const [a, b] = [numbers[0]!, numbers[1]!];
    rows.push({ state: name, households: Math.max(a, b), withTap: Math.min(a, b) });
  }
  return { rows, sampleRow, rowsSeen, firstCells, shell };
}

/** Cheap count of table rows, for the shell check above. */
function rowsOf(html: string): number {
  return (html.match(/<tr[^>]*>/gi) ?? []).length;
}

/** The map's spelling of a state, or null. The map is the vocabulary. */
export function normaliseState(raw: string, known: Set<string>): string | null {
  const clean = raw.replace(/\s*\(.*?\)\s*/g, " ").replace(/[*†‡]/g, "").replace(/\s+/g, " ").trim();
  if (!clean) return null;
  if (known.has(clean)) return clean;
  const lower = clean.toLowerCase();
  const alias: Record<string, string> = {
    "arunachal pradesh": "Arunanchal Pradesh",
    "delhi": "NCT of Delhi",
    "jammu and kashmir": "Jammu & Kashmir",
    "jammu & kashmir": "Jammu & Kashmir",
    "andaman and nicobar islands": "Andaman & Nicobar Island",
    "a & n islands": "Andaman & Nicobar Island",
    "dadra and nagar haveli and daman and diu": "Dadara & Nagar Havelli",
    "the dadra and nagar haveli and daman and diu": "Dadara & Nagar Havelli",
    "orissa": "Odisha",
    "pondicherry": "Puducherry",
    "uttaranchal": "Uttarakhand",
  };
  if (alias[lower] && known.has(alias[lower]!)) return alias[lower]!;
  const hit = [...known].filter((k) => k.toLowerCase() === lower);
  return hit.length === 1 ? hit[0]! : null;
}

export async function run(): Promise<void> {
  const topo = JSON.parse(
    await (await import("node:fs/promises")).readFile(
      join(ROOT, "data", "geo", "ascii-india.json"), "utf8"),
  ) as { symbols: Record<string, string> };
  const known = new Set(Object.values(topo.symbols));

  // ── The roster ────────────────────────────────────────────────────────
  let listText: string | null = null;
  let listPage = "";
  const attempts: Array<{ page: string; bytes: number; schemes: number; headings: string[] }> = [];
  for (const page of LIST_PAGES) {
    const text = await wikitext(page);
    if (!text) { attempts.push({ page, bytes: 0, schemes: 0, headings: [] }); continue; }
    const got = readSchemes(text);
    attempts.push({
      page, bytes: text.length, schemes: got.schemes.length, headings: got.headings.slice(0, 40),
    });
    console.log(`  ${page.padEnd(48)} ${text.length} bytes, ${got.schemes.length} schemes`);
    if (got.schemes.length > (listText ? readSchemes(listText).schemes.length : 0)) {
      listText = text; listPage = page;
    }
  }
  /**
   * The headings the article actually has, recorded in the output.
   *
   * The first run read 29 schemes and filed them under sectors called
   * "Telangana", "Madhya Pradesh" and "Karnataka" — so this page is not the
   * ministry-grouped list of central schemes I assumed, and guessing again
   * from here costs another CI round trip. The headings say what it is.
   */
  const parsedList = listText ? readSchemes(listText) : { schemes: [], headings: [] };
  const schemes = parsedList.schemes;
  const headings = parsedList.headings;
  for (const h of headings) console.log(`    heading: ${h}`);
  const sectors = [...new Set(schemes.map((s) => s.sector).filter((x): x is string => Boolean(x)))];
  console.log(`  roster: ${schemes.length} schemes across ${sectors.length} sectors`);

  // ── Coverage, from the sources that still answer ──────────────────────
  const coverage: CoverageRow[] = [];
  const refused: Array<{ source: string; why: string }> = [];
  let jjmShape: {
    sampleRow: string[] | null; rowsSeen: number; firstCells: string[]; shell: string | null;
  } = { sampleRow: null, rowsSeen: 0, firstCells: [], shell: null };

  const jjmUrl = "https://ejalshakti.gov.in/jjmreport/JJMIndia.aspx";
  let jjm = await getText(jjmUrl, { cacheMs: 6 * 3600_000, retries: 2, timeoutMs: 60_000 });
  let jjmFrom = jjmUrl;

  /**
   * The dashboard's six rows were six copies of the header.
   *
   * The page carries an iframe and the grid is inside it, which the shell
   * check said outright — so the outer page was never going to yield a state.
   * Following the frame is one more fetch and the difference between a
   * coverage column with thirty-six rows in it and one with none.
   */
  if (jjm.ok && jjm.data && /<iframe/i.test(jjm.data)) {
    const src = /<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i.exec(jjm.data)?.[1];
    if (src) {
      const abs = src.startsWith("http") ? src : new URL(src, jjmUrl).toString();
      const inner = await getText(abs, { cacheMs: 6 * 3600_000, retries: 2, timeoutMs: 60_000 });
      // Only if it actually carries a table. The first attempt swapped in a
      // frame with no rows at all, taking the outer page's six header copies
      // down to nothing — a fetch that succeeded and made the result worse.
      const innerRows = inner.data ? (inner.data.match(/<tr[^>]*>/gi) ?? []).length : 0;
      if (inner.ok && inner.data && innerRows > (jjm.data?.match(/<tr[^>]*>/gi) ?? []).length) {
        jjm = inner; jjmFrom = abs;
      }
      console.log(
        `    followed the iframe to ${abs} — ${inner.ok ? `${innerRows} rows` : inner.error}` +
        `${innerRows === 0 ? " (kept the outer page)" : ""}`,
      );
    }
  }

  if (!jjm.ok || !jjm.data) {
    refused.push({ source: "Jal Jeevan Mission", why: jjm.error ?? "no body" });
  } else {
    const parsed = readJjm(jjm.data, known);
    jjmShape = {
      sampleRow: parsed.sampleRow, rowsSeen: parsed.rowsSeen,
      firstCells: parsed.firstCells, shell: parsed.shell,
    };
    for (const r of parsed.rows) {
      coverage.push({
        scheme: "Jal Jeevan Mission",
        grain: "household",
        state: r.state,
        measure: "rural households with a functional tap connection",
        value: r.withTap,
        of: r.households,
        asOf: null,
        source: jjmFrom,
      });
    }
    console.log(`  Jal Jeevan Mission: ${parsed.rows.length} states from ${parsed.rowsSeen} table rows`);
    if (parsed.shell) console.log(`    ${parsed.shell}`);
    console.log(`    first cells: ${parsed.firstCells.slice(0, 12).join(" / ")}`);
  }

  // The rest, recorded as refusals rather than omitted. A welfare tracker with
  // an empty coverage column and no explanation looks like a tracker that has
  // not been finished; one that names what refused is reporting a finding.
  const KNOWN_REFUSALS: Array<{ source: string; why: string }> = [
    { source: "myScheme (the government's own scheme directory API)",
      why: "answered 401 — it requires a key this project has not been given" },
    { source: "PMAY-Gramin", why: "refused at the connection" },
    { source: "Mission Antyodaya (the village survey)", why: "refused at the connection" },
    { source: "Saubhagya (household electrification)", why: "refused at the connection" },
    { source: "MGNREGA public reports", why: "refused at the connection" },
    { source: "Swachh Bharat Mission dashboard", why: "returned 404" },
    { source: "PM-KISAN dashboard", why: "returned a 1.4 KB stub with no data in it" },
    { source: "data.gov.in resource API", why: "answered 400 without an API key" },
  ];
  refused.push(...KNOWN_REFUSALS);

  const bySector = new Map<string, number>();
  for (const s of schemes) {
    const k = s.sector ?? "unfiled";
    bySector.set(k, (bySector.get(k) ?? 0) + 1);
  }

  await mkdir(join(ROOT, "data", "schemes"), { recursive: true });
  await writeFile(OUT, JSON.stringify({
    builtAt: new Date().toISOString(),
    rosterSource: listPage
      ? `English Wikipedia: ${listPage.replace(/_/g, " ")}`
      : "no candidate roster article answered",
    rosterAttempts: attempts,
    coverageNote:
      "The roster is long and the coverage column is nearly empty, and that is the finding " +
      "rather than unfinished work. Fourteen scheme dashboards were asked what they would give " +
      "a script. Most gave nothing: PMAY-Gramin, Mission Antyodaya, Saubhagya and the MGNREGA " +
      "report server refused at the connection, Swachh Bharat returned 404, PM-KISAN served a " +
      "stub, and the government's own myScheme directory answered 401.",
    fourGrains:
      "Household, village, beneficiary count and state aggregate are four different things and " +
      "share no column here. A beneficiary count has no denominator and is not a penetration " +
      "rate; supplying one is exactly where a tracker invents a number. A village percentage is " +
      "of villages and not of people, and the two diverge sharply because villages differ in " +
      "size by orders of magnitude.",
    launchYearNote:
      "A launch year is recorded only where the list states one in the entry itself. It is never " +
      "inferred from an article title or a date mentioned nearby, because a wrong year here is " +
      "indistinguishable from a right one.",
    schemeCount: schemes.length,
    sectorCount: sectors.length,
    coverageRows: coverage.length,
    schemesWithCoverage: [...new Set(coverage.map((c) => c.scheme))].length,
    bySector: [...bySector.entries()].map(([sector, n]) => ({ sector, schemes: n }))
      .sort((a, b) => b.schemes - a.schemes),
    jjmShape,
    listHeadings: headings,
    refused,
    schemes,
    coverage,
  }, null, 2) + "\n", "utf8");

  console.log(
    `\n${schemes.length} schemes, ${coverage.length} coverage rows across ` +
    `${[...new Set(coverage.map((c) => c.scheme))].length} scheme(s), ${refused.length} sources refused`,
  );

  if (schemes.length < 50) {
    throw new Error(
      `only ${schemes.length} schemes parsed from a list that carries well over a hundred. ` +
      "That is the parser or the article's layout, not a fact about Indian welfare policy.",
    );
  }
}

if (isEntryPoint(import.meta.url)) {
  run().catch((err) => { console.error(err); process.exit(1); });
}
