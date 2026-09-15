/**
 * Where AI meets a military, in the two places it leaves a public record.
 *
 * `npm run military-ai`. Writes data/global/military-ai.json. CI only.
 *
 * ── The problem with every number written about this ─────────────────────
 *
 * "AI in military operations" is a subject with enormous published numbers and
 * almost no evidence. Market sizings are a consultancy's own definition times
 * a growth assumption. Capability claims come from the vendor or the ministry
 * that bought the thing. Reporting on autonomous targeting is largely
 * single-sourced and contested by the party it describes. None of it can be
 * checked by a reader, and a chart drawn over it inherits every problem while
 * looking authoritative.
 *
 * Two records survive that test, and this connector reads both.
 *
 * ── One: money a government has actually obligated ───────────────────────
 *
 * A federal contract is a public record with an award id, a date, a recipient,
 * an obligated amount and an awarding agency. USAspending serves it without a
 * key. That turns "how much AI does a military buy" from an estimate into a
 * sum of records, each of which a reader can look up by id.
 *
 * The catch is the definition, and it is not small: there is no procurement
 * code for "artificial intelligence". Awards are found by searching their
 * description text, which means the figure measures *awards whose description
 * says AI* and not *AI*. A contract for an autonomous targeting system that
 * describes itself as "sensor integration services" is invisible; a contract
 * for a conference about AI is counted. Both directions of that error are
 * stated in the file and the keyword list is published so the filter can be
 * disagreed with.
 *
 * ── Two: incidents somebody catalogued with citations ────────────────────
 *
 * AIAAIC maintains a public register of AI incidents and controversies — a few
 * thousand rows, each with a sector, a country, a date and source links. It is
 * a volunteer register, it is uneven, and it is the only public attempt at
 * case-level detail on military AI that cites anything. Its military subset is
 * small: that is a finding about how little is documented, not a gap to fill
 * with press reports.
 *
 * ── What this file will not do ───────────────────────────────────────────
 *
 * No casualty figure, no capability claim, no assertion that a named system
 * was used in a named operation. Where a case is carried it is carried as
 * "this register records this, citing that", with the register's own words and
 * its own links, because the difference between a documented case and a
 * reported one is the entire value of doing it this way.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getText, getJson } from "../lib/http";
import { isEntryPoint } from "../lib/entry";

const OUT = join(process.cwd(), "data/global/military-ai.json");

/* ── AIAAIC ─────────────────────────────────────────────────────────── */

const AIAAIC_CSV =
  "https://docs.google.com/spreadsheets/d/1Bn55B4xz21-_Rgdr8BBb2lt0n_4rzLGxFADMlVW0PYI/export?format=csv&gid=888071280";

/**
 * What counts as military, and why it is matched on several columns.
 *
 * A row's Sector column is the obvious place to look and it is not enough:
 * the register files a facial-recognition system used at a border under
 * "govt - policing" and an autonomous weapon under "defence", and both are the
 * subject. The match runs over sector, the description and the technology
 * columns together, and the matched text is recorded on every row so a reader
 * can see which word pulled it in.
 */
const MILITARY = /\b(militar|defen[cs]e|army|navy|air force|weapon|warfare|combat|drone|uav|missile|soldier|troop|battlefield|targeting|munition|pentagon|nato|idf|armed forces)\b/i;

/**
 * Whether an ARMED FORCE deployed it, which is a different question.
 *
 * The keyword filter above is deliberately wide and catches rows it should
 * not: a supermarket's facial recognition (the word "weapon" appears in the
 * harm column), a school gun detector, a killing in which a chatbot was
 * mentioned. Those are AI incidents and they are not military operations.
 *
 * So the deployer column is tested separately. A row whose deployer is a named
 * army, navy, air force, defence ministry or intelligence service is a case
 * about a military using a system; everything else the wide filter caught is
 * military-adjacent technology — surveillance, datasets, counter-drone — and
 * is kept, flagged, and presented apart. Conflating the two is how a register
 * of AI controversies gets quoted as a count of battlefield incidents.
 */
const ARMED_FORCE = /\b(defen[cs]e forces?|armed forces?|army|navy|air force|marine corps|department of (war|defen[cs]e)|min(istry|istr[a-z]*) of defen[\u0441cs]e|pentagon|idf|nato|liberation army|national guard|military|intelligence agency|mossad|gru|fsb|cia|nsa|dod)\b/i;

/*
 * Two traps in one line. "Israel Defense Forces" does not match
 * \bdefense force\b, because the word boundary after "force" fails against the
 * following "s" — eight of the most relevant rows in the register were sorted
 * as adjacent for want of an optional plural. And one deployer is written
 * "Ministry of Defenсe of Ukraine" with a CYRILLIC es in place of the c, which
 * no Latin-only pattern can see; the character class admits it explicitly
 * rather than leaving a row to fall through a lookalike.
 */

/** Governments, which deploy systems in operations without being a service. */
const STATE_ACTOR = /\b(government of|ministry of|state of|republic of|federal)\b/i;

/**
 * The register's columns, as it actually has them.
 *
 * The first version asked for Sector and Country and got neither: this sheet
 * has no such columns. What it does have is better for this subject —
 * `Deployer` names the force or agency that used the system, `System name`
 * names the thing, `Purpose` says what it was for, and `Harm status` says
 * whether the harm is alleged, occurred or was averted. Those four are the
 * difference between "an AI incident" and a case study.
 *
 * Reading the real header rather than a hoped-for one is why the connector
 * publishes it.
 */
export interface Incident {
  /** The register's own row identifier. */
  ref: string;
  headline: string;
  occurred: string;
  /** Who used it — a force, an agency, a ministry. */
  deployer: string;
  /** Who built it. */
  developer: string;
  /** What it is called, where the register names it. */
  system: string;
  technology: string;
  purpose: string;
  /** The register's own harm taxonomy, and whether the harm is alleged. */
  ethicalIssue: string;
  externalHarm: string;
  harmStatus: string;
  impactedArea: string;
  /** Which words matched, so the filter is inspectable per row. */
  matched: string[];
  /**
   * Whether the register names an armed force or a government as the deployer.
   *
   * "force" is the tier this story is actually about. "adjacent" is a real AI
   * incident with a military-sounding word somewhere in its row, and is kept
   * apart rather than dropped or counted alongside.
   */
  tier: "force" | "state" | "adjacent";
  /** The register's own links. Never followed, never summarised. */
  links: string[];
}

/** RFC4180 CSV, because a description field contains commas and newlines. */
export function parseCsv(text: string): { header: string[]; rows: string[][]; dropped: number } {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let dropped = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else quoted = false;
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
  const header = rows.shift() ?? [];
  const width = header.length;
  const kept = rows.filter((r) => {
    // A row narrower than the header lost a column somewhere; one wider gained
    // a delimiter. Either way its fields no longer line up with their names,
    // and a row read under the wrong column headings is worse than a dropped one.
    if (r.length === width) return true;
    dropped++;
    return false;
  });
  return { header, rows: kept, dropped };
}

/**
 * The header row, and the rows below it.
 *
 * Scans the first few rows for one that names at least two of the columns this
 * connector needs. Records nothing if none does — better to publish an empty
 * incident list with a note than to read two thousand rows under the wrong
 * column names.
 */
export function findHeader(
  first: string[],
  rows: string[][],
): { header: string[]; rows: string[][]; atRow: number; note: string } {
  const names = (r: string[]): number =>
    [/sector/i, /technolog/i, /countr/i, /^\s*type\s*$/i, /headline|title/i]
      .filter((re) => r.some((c) => re.test(c.trim()))).length;
  const candidates = [first, ...rows.slice(0, 8)];
  let best = -1;
  let bestScore = 0;
  for (const [i, r] of candidates.entries()) {
    const score = names(r);
    if (score > bestScore) { bestScore = score; best = i; }
  }
  if (best < 0 || bestScore < 2) {
    return { header: first, rows, atRow: 0, note: `no row in the first ${candidates.length} named the expected columns; read as-is and probably wrong` };
  }
  if (best === 0) return { header: first, rows, atRow: 0, note: "the first row is the header" };
  return {
    header: candidates[best] ?? first,
    rows: rows.slice(best),
    atRow: best,
    note: `the header is row ${best + 1}, not row 1 — the rows above it are a title block`,
  };
}

/** Find a column by what its header says, not by position. */
export function columnMatching(header: string[], want: RegExp): number {
  return header.findIndex((h) => want.test(h.trim()));
}

async function readAiaaic(): Promise<{
  header: string[];
  total: number;
  dropped: number;
  incidents: Incident[];
  note: string;
}> {
  const res = await getText(AIAAIC_CSV, { timeoutMs: 90_000, retries: 3, cacheMs: 0 });
  if (!res.ok || !res.data) {
    return { header: [], total: 0, dropped: 0, incidents: [], note: `fetch failed: ${res.error ?? "no body"}` };
  }
  const parsed = parseCsv(res.data);
  /**
   * Find the header row rather than assuming it is the first.
   *
   * The sheet opens with a title row — a single cell reading "Incidents"
   * followed by thirteen empty ones. Taking it as the header gave every column
   * lookup an index of -1, so every field came back empty, nothing matched the
   * military filter, and the connector reported 2,261 rows read and 0 matched
   * without erroring. The header is the first row that names the columns this
   * connector actually needs.
   */
  const head = findHeader(parsed.header, parsed.rows);
  const header = head.header;
  const rows = head.rows;
  const dropped = parsed.dropped;
  const col = {
    ref: columnMatching(header, /^\s*(aiaaic\s*)?id/i),
    headline: columnMatching(header, /headline/i),
    occurred: columnMatching(header, /occurr/i),
    deployer: columnMatching(header, /deployer/i),
    developer: columnMatching(header, /developer/i),
    system: columnMatching(header, /system name/i),
    tech: columnMatching(header, /technolog/i),
    purpose: columnMatching(header, /purpose/i),
    ethical: columnMatching(header, /ethical issue/i),
    harm: columnMatching(header, /external harm/i),
    harmStatus: columnMatching(header, /harm status/i),
    area: columnMatching(header, /impacted area/i),
  };
  const at = (r: string[], i: number): string => (i >= 0 ? (r[i] ?? "").trim() : "");

  const incidents: Incident[] = [];
  for (const r of rows) {
    const headline = at(r, col.headline);
    const deployer = at(r, col.deployer);
    const system = at(r, col.system);
    const tech = at(r, col.tech);
    const purpose = at(r, col.purpose);
    const area = at(r, col.area);
    // The filter runs over every column that could name a force, a weapon or a
    // military purpose. Matching the headline alone would miss a row whose
    // deployer is an army and whose headline is about a procurement dispute.
    const subject = `${headline} ${deployer} ${system} ${tech} ${purpose} ${area}`;
    const matched = [...subject.matchAll(new RegExp(MILITARY.source, "gi"))]
      .map((m) => m[0].toLowerCase());
    if (matched.length === 0) continue;
    // Links live in whatever trailing columns the register happens to use, so
    // they are harvested from the whole row rather than from a named column.
    const links = r.flatMap((cell) => [...cell.matchAll(/https?:\/\/[^\s,;"]+/g)].map((m) => m[0]))
      .slice(0, 6);
    const tier: Incident["tier"] = ARMED_FORCE.test(deployer)
      ? "force"
      : STATE_ACTOR.test(deployer) ? "state" : "adjacent";
    incidents.push({
      ref: at(r, col.ref),
      headline,
      tier,
      occurred: at(r, col.occurred),
      deployer,
      developer: at(r, col.developer),
      system,
      technology: tech,
      purpose,
      ethicalIssue: at(r, col.ethical),
      externalHarm: at(r, col.harm),
      harmStatus: at(r, col.harmStatus),
      impactedArea: area,
      matched: [...new Set(matched)],
      links,
    });
  }
  return {
    header,
    total: rows.length,
    dropped,
    incidents,
    note: `${head.note}. ${rows.length} rows read, ${dropped} dropped for a column count that did not match the header, ${incidents.length} matched the military filter`,
  };
}

/* ── USAspending ────────────────────────────────────────────────────── */

const USA = "https://api.usaspending.gov/api/v2";

/**
 * The keywords, published because the figure is a function of them.
 *
 * There is no procurement code for artificial intelligence, so awards are
 * found by description text. Each term is searched separately and the result
 * is recorded per term, so a reader can see how much of the total rests on any
 * one word and drop the ones they disagree with.
 */
const TERMS = [
  "artificial intelligence",
  "machine learning",
  "autonomous systems",
  "computer vision",
  "large language model",
  "algorithmic warfare",
] as const;

/** Defence agencies, by the toptier code USAspending uses. */
const DEFENCE = { code: "097", name: "Department of Defense" };

/**
 * The year lives inside time_period, not beside it.
 *
 * `spending_over_time` returns
 *   { "time_period": { "fiscal_year": "2020" }, "aggregated_amount": 1234 }
 * and the first version read `fiscal_year` off the row. That is undefined, so
 * the fallback stringified the object to "[object Object]", parsed NaN, and
 * the filter dropped every bucket — six series, all reporting ok, all empty.
 * The raw shape of the first bucket is published now so the next change here
 * is a reading.
 */
interface AwardBucket {
  fiscal_year?: number | string;
  aggregated_amount?: number;
  time_period?: { fiscal_year?: number | string; quarter?: string } | string;
}
interface SpendingResponse { results?: AwardBucket[]; messages?: string[] }

function yearOfBucket(r: AwardBucket): number {
  const raw = typeof r.time_period === "object" && r.time_period !== null
    ? r.time_period.fiscal_year
    : (r.fiscal_year ?? r.time_period);
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(n) ? n : Number.NaN;
}

/**
 * Obligations per fiscal year for one search term.
 *
 * `spending_over_time` rather than a list of awards: the question is how the
 * money moved, a list of a hundred thousand awards is not something a page can
 * carry, and the endpoint aggregates server-side so no total here is a sum
 * this connector computed and could get wrong.
 */
async function spendingFor(term: string): Promise<{
  term: string; ok: boolean;
  years: Array<{ year: number; amount: number }>;
  error?: string;
  /** The first bucket verbatim, so the response shape is inspectable. */
  sampleBucket?: unknown;
  messages?: string[];
}> {
  const body = {
    group: "fiscal_year",
    filters: {
      keywords: [term],
      award_type_codes: ["A", "B", "C", "D"],
      agencies: [{ type: "awarding", tier: "toptier", name: DEFENCE.name }],
      time_period: [{ start_date: "2015-10-01", end_date: "2026-09-30" }],
    },
    subawards: false,
  };
  const res = await getJson<SpendingResponse>(`${USA}/search/spending_over_time/`, {
    timeoutMs: 120_000, retries: 2, cacheMs: 0,
    method: "POST", body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  if (!res.ok || !res.data) return { term, ok: false, years: [], error: res.error ?? "no body" };
  const buckets = res.data.results ?? [];
  const years = buckets
    .map((r) => ({ year: yearOfBucket(r), amount: typeof r.aggregated_amount === "number" ? r.aggregated_amount : 0 }))
    .filter((r) => Number.isFinite(r.year) && r.year > 2000)
    .sort((a, b) => a.year - b.year);
  return {
    term, ok: true, years,
    sampleBucket: buckets[0],
    ...(res.data.messages && res.data.messages.length > 0 ? { messages: res.data.messages } : {}),
  };
}

async function main(): Promise<void> {
  const aiaaic = await readAiaaic();
  console.log(`AIAAIC: ${aiaaic.note}`);
  console.log(`  columns: ${aiaaic.header.slice(0, 12).join(" | ")}`);

  const spending: Awaited<ReturnType<typeof spendingFor>>[] = [];
  for (const t of TERMS) {
    const r = await spendingFor(t);
    spending.push(r);
    console.log(
      `USAspending "${t}": ${r.ok ? `${r.years.length} fiscal years, ` +
        `$${(r.years.reduce((a, b) => a + b.amount, 0) / 1e9).toFixed(2)}bn total` : `failed — ${r.error}`}`,
    );
    await new Promise((res) => setTimeout(res, 1_200));
  }

  const byDeployer = new Map<string, number>();
  const byTechnology = new Map<string, number>();
  const byHarmStatus = new Map<string, number>();
  const byYear = new Map<string, number>();
  for (const i of aiaaic.incidents) {
    for (const s of i.deployer.split(/[;,/]/).map((x) => x.trim()).filter(Boolean)) {
      byDeployer.set(s, (byDeployer.get(s) ?? 0) + 1);
    }
    for (const t of i.technology.split(/[;,/]/).map((x) => x.trim()).filter(Boolean)) {
      byTechnology.set(t, (byTechnology.get(t) ?? 0) + 1);
    }
    const h = i.harmStatus.trim();
    if (h) byHarmStatus.set(h, (byHarmStatus.get(h) ?? 0) + 1);
    const y = /\b(19|20)\d{2}\b/.exec(i.occurred)?.[0];
    if (y) byYear.set(y, (byYear.get(y) ?? 0) + 1);
  }
  const tally = (m: Map<string, number>) =>
    [...m].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));

  const out = {
    builtAt: new Date().toISOString(),
    sources: {
      incidents:
        "AIAAIC Repository (aiaaic.org), the public incidents and controversies spreadsheet, " +
        "exported as CSV. A volunteer register; every row carries its own source links.",
      spending:
        "USAspending.gov API, Department of Defense contract awards (types A-D), aggregated by " +
        "fiscal year server-side. Each figure is obligated money against a public award id.",
    },
    definition:
      "There is no procurement code for artificial intelligence. Awards are matched on their " +
      "description text, so these figures measure AWARDS WHOSE DESCRIPTION SAYS AI and not AI. " +
      "A contract for an autonomous targeting system described as 'sensor integration services' " +
      "is invisible here; a contract to run a conference about AI is counted. The keyword list " +
      "is published and each term's total is kept separate so any of them can be discarded.",
    doubleCounting:
      "The per-term totals overlap and MUST NOT be summed. An award whose description contains " +
      "both 'artificial intelligence' and 'machine learning' is in both series. No combined " +
      "total appears in this file for that reason.",
    militaryFilter: MILITARY.source,
    deployerFilter: ARMED_FORCE.source,
    tiers:
      "A row is tier 'force' when the register names an armed force, defence ministry or " +
      "intelligence service as the deployer, 'state' when it names a government, and " +
      "'adjacent' otherwise. The wide keyword filter catches supermarket facial recognition " +
      "and school gun detectors — those are AI incidents and not military operations, and " +
      "counting them together is how a register of AI controversies gets quoted as a tally of " +
      "battlefield events.",
    refusal:
      "No casualty figure, no capability claim, and no assertion that a named system was used " +
      "in a named operation. Where a case is carried it is carried as 'this register records " +
      "this, citing that', in the register's own words and with its own links. The difference " +
      "between a documented case and a reported one is the entire value of doing it this way.",
    cannotSay: [
      "Whether any of this money bought a capability that works. An obligation is a payment, not an outcome.",
      "What any other country spends. Only the United States publishes contract-level award data; the comparison a reader wants is unavailable at any level of effort, and its absence is not evidence that others spend less.",
      "How many military AI incidents there have been. The register is volunteer-maintained and its military subset is small — that is a finding about how little is documented, not a count of what has happened.",
      "Anything about classified programmes, which is where the subject mostly lives.",
    ],
    incidents: {
      header: aiaaic.header,
      totalRows: aiaaic.total,
      droppedRows: aiaaic.dropped,
      note: aiaaic.note,
      matched: aiaaic.incidents.length,
      byDeployer: tally(byDeployer).slice(0, 25),
      byTechnology: tally(byTechnology).slice(0, 25),
      byHarmStatus: tally(byHarmStatus),
      byTier: {
        force: aiaaic.incidents.filter((i) => i.tier === "force").length,
        state: aiaaic.incidents.filter((i) => i.tier === "state").length,
        adjacent: aiaaic.incidents.filter((i) => i.tier === "adjacent").length,
      },
      byYear: tally(byYear).sort((a, b) => a.key.localeCompare(b.key)),
      rows: aiaaic.incidents,
    },
    spending,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(
    `\nWrote ${OUT}: ${aiaaic.incidents.length} military-matched incidents of ${aiaaic.total} rows, ` +
    `${spending.filter((s) => s.ok).length} of ${TERMS.length} spending series.`,
  );
}

if (isEntryPoint(import.meta.url)) {
  void main();
}
