/**
 * What India's chip bill actually looks like, from trade data already on disk.
 *
 * `npm run semi:trade`. Reads data/trade/hs6-YYYY.json and writes
 * data/semi/trade.json. No network: every figure here is a sum of numbers this
 * repository already fetched from UN Comtrade and committed, so this connector
 * can be re-run and re-checked by anyone, offline, forever.
 *
 * ── Why trade data is the honest way into the semiconductor story ────────
 *
 * The India Semiconductor Mission story is told in announcements: approved
 * fabs, sanctioned crore, jobs promised, wafers-per-month at some future date.
 * None of that is output. The one thing that is measured monthly, by two
 * governments independently, and published, is what crosses the border. Until
 * a fab ships, the import bill is the only number that can be checked, and it
 * is the number the whole mission exists to move.
 *
 * So the page leads with the bill and treats every announced fab as an
 * announcement. This file computes the bill.
 *
 * ── Four series, and what each one is not ────────────────────────────────
 *
 *   HS 8542, electronic integrated circuits. The closest thing to "chips".
 *     This is the series that matters and the only one that should be called
 *     semiconductors without qualification.
 *
 *   HS 8541, diodes, transistors and photosensitive semiconductor devices.
 *     Reads like a chip line and is not one. From 2017 onward this heading is
 *     dominated by 854140/854142/854143 — photovoltaic cells and modules, i.e.
 *     solar panels. In 2017 photosensitive devices are $4.54bn of a $5.12bn
 *     heading. Charting 8541 as "semiconductors" would show India's solar
 *     import surge and call it a chip dependency. It is carried here because
 *     the heading is genuinely semiconductor devices in the physics sense, and
 *     flagged everywhere so nobody sums it into 8542 by accident.
 *
 *   Chapter 85 entire, electrical machinery and electronics. The denominator.
 *     A share of chapter 85 says what part of the electronics bill is chips;
 *     a share of all merchandise says what part of the country's imports is
 *     electronics. Both denominators are emitted so neither has to be guessed.
 *
 *   HS 8517, telephones and telecom apparatus. India's largest single
 *     electronics line, and the one place where the localisation story shows
 *     up in the trade data: smartphone exports (851713) go from nothing to
 *     $20.1bn in 2024. Kept separate from the chip series because assembling
 *     phones and fabricating wafers are different claims.
 *
 * ── The three discontinuities this file refuses to smooth ────────────────
 *
 * 1. The years are sampled, not continuous. The upstream ingest fetched 2002,
 *    2003, 2004, 2008, 2012, 2013, 2017, 2018, 2022, 2023, 2024 — eleven of
 *    twenty-three. 2005-2007, 2009-2011, 2014-2016 and 2019-2021 were never
 *    requested. A line chart drawn straight through those gaps would assert a
 *    trajectory across COVID that this dataset never measured. Every row
 *    therefore carries `gapBefore`: how many unsampled years precede it.
 *
 * 2. The subheadings change under the operator. Within 8542 this dataset
 *    reports HS1996 codes in 2002 (854212/13/14/19, 854230/40/50/90), HS2002
 *    codes in 2003-2008 (854210, 854221, 854229, 854260, 854270) and HS2007
 *    codes from 2012 (854231/32/33/39). Heading-level sums survive that —
 *    within any one year the reported subheadings partition the heading, and
 *    no year mixes vintages — but a subheading series does not, which is why
 *    this file publishes headings and records the subheadings that carried the
 *    value as evidence rather than charting them.
 *
 * 3. 8517 before 2012 is not the phone line. Under HS1996/HS2002, mobile
 *    handsets sat in 852520, "transmission apparatus incorporating reception
 *    apparatus", and moved into 851712 only with HS2007. The check is in the
 *    data: 852520 imports are $4.05bn in 2008 and the entire 8517 heading is
 *    $1.22bn; by 2012, 852520 is gone and 851712 alone is $4.59bn. So the
 *    8517 series is comparable from 2012 and misleading before it, and 852520
 *    is emitted as a diagnostic row — never as part of the 8517 series —
 *    so the page can show why the early years are excluded instead of
 *    quietly starting the axis at 2012.
 *
 * ── The one number in here that is probably wrong, and is kept anyway ────
 *
 * 2008 integrated circuits comes out at $224m of imports — below 2004's
 * $445m, in a year when India's total merchandise imports were more than
 * three times 2004's and chapter 85 had doubled. Within the heading, 854221
 * falls from $42m in 2004 to $79k in 2008 and 854260/854270 collapse to
 * near-nothing, while the 2008 file carries no HS2007 IC codes at all. That
 * is the fingerprint of a classification change the reported data did not
 * follow cleanly, not of India buying fewer chips.
 *
 * It is not corrected. There is no defensible correction available offline —
 * any patch would be a number this project made up — so the row ships with a
 * `suspect` note stating what is odd and what the evidence is, and the page
 * must render it as suspect. Deleting it would hide a data problem; adjusting
 * it would invent a figure. Saying so is the only honest third option.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { isEntryPoint } from "../lib/entry";

const ROOT = process.cwd();
const TRADE_DIR = join(ROOT, "data", "trade");
const OUT_DIR = join(ROOT, "data", "semi");
const OUT = join(OUT_DIR, "trade.json");

/** One HS6 line for one year, exactly as the trade ingest wrote it. */
interface YearRow { code: string; m: number; x: number }
interface Universe { builtAt: string; source: string; codes: string[]; names: Record<string, string> }

/**
 * A series is defined by an HS prefix, because that is the only definition
 * that survives an HS revision. Anything finer — a hand-picked list of
 * subheadings — would silently drop the lines a later revision invented, and
 * this dataset spans three revisions.
 */
interface GroupSpec {
  id: string;
  prefix: string;
  label: string;
  /**
   * headline: safe to chart as its own series.
   * denominator: a total that other series are shares of.
   * diagnostic: exists to explain a discontinuity, never to be charted beside
   *   the headline series or summed with them.
   */
  role: "headline" | "denominator" | "diagnostic";
  /** First sampled year from which the series means the same thing. */
  comparableFrom: number;
  what: string;
}

const GROUPS: GroupSpec[] = [
  {
    id: "ic",
    prefix: "8542",
    label: "Electronic integrated circuits (HS 8542)",
    role: "headline",
    comparableFrom: 2002,
    what:
      "Chips. Processors and controllers, memories, amplifiers and other ICs. The series " +
      "the semiconductor mission is about.",
  },
  {
    id: "discrete",
    prefix: "8541",
    label: "Diodes, transistors and photosensitive devices (HS 8541)",
    role: "headline",
    comparableFrom: 2002,
    what:
      "Semiconductor devices that are not integrated circuits — and, from 2017, mostly " +
      "solar. Photovoltaic cells and modules are inside this heading and dominate it. " +
      "Not a chip series; never add it to HS 8542 and call the result semiconductors.",
  },
  {
    id: "chapter85",
    prefix: "85",
    label: "Electrical machinery and electronics (HS chapter 85)",
    role: "denominator",
    comparableFrom: 2002,
    what:
      "The whole electronics chapter, including both series above and the telecom heading. " +
      "Used as the denominator for 'how much of the electronics bill is chips'.",
  },
  {
    id: "telecom",
    prefix: "8517",
    label: "Telephones and telecom apparatus (HS 8517)",
    role: "headline",
    comparableFrom: 2012,
    what:
      "India's largest single electronics line. Comparable from 2012 only: before HS2007, " +
      "mobile handsets were reported in 852520, not here.",
  },
  {
    id: "handsets-pre-hs2007",
    prefix: "852520",
    label: "Transmission apparatus incl. handsets, pre-HS2007 (HS 852520)",
    role: "diagnostic",
    comparableFrom: 2002,
    what:
      "Where mobile phones were classified before HS2007. Emitted so the page can show why " +
      "the 8517 series starts in 2012 instead of silently truncating the axis.",
  },
];

export interface SemiRow {
  year: number;
  /** US$, nominal, as reported by India. Rounded to whole dollars. */
  imports: number;
  exports: number;
  /** imports - exports. Positive means India is a net buyer. */
  balance: number;
  /** HS6 subheadings inside this group that carried any value in this year. */
  codes: string[];
  /** Unsampled years immediately before this one. 0 for consecutive years. */
  gapBefore: number;
  /** Set only where the row itself looks wrong. Never a correction. */
  suspect?: string;
}

export interface SemiGroup extends GroupSpec {
  rows: SemiRow[];
}

export interface SemiTrade {
  builtAt: string;
  source: string;
  unit: string;
  reporter: string;
  sampledYears: number[];
  unsampledYears: number[];
  sparse: string;
  note: string;
  refusal: string;
  groups: SemiGroup[];
  /** All 97 chapters, so any share of total imports carries its denominator. */
  allMerchandise: SemiRow[];
}

/** Whole dollars. The source carries three decimals of US$, which is false
 *  precision on an eighty-billion-dollar aggregate, and keeping it would make
 *  `balance === imports - exports` a floating-point coin toss in the tests. */
const dollars = (n: number): number => Math.round(n);

function sampledYears(): number[] {
  const years: number[] = [];
  for (const f of readdirSync(TRADE_DIR)) {
    const m = /^hs6-(\d{4})\.json$/.exec(f);
    if (m?.[1]) years.push(Number(m[1]));
  }
  return years.sort((a, b) => a - b);
}

export async function run(): Promise<void> {
  const years = sampledYears();
  if (years.length === 0) {
    throw new Error(
      "no data/trade/hs6-YYYY.json files found; run `npm run trade:ingest` first, " +
      "or check you are running from the repository root",
    );
  }

  const universeRaw = await readFile(join(TRADE_DIR, "hs6-universe.json"), "utf8").catch(() => null);
  const universe = universeRaw ? (JSON.parse(universeRaw) as Universe) : null;

  const first = years[0] ?? 0;
  const last = years[years.length - 1] ?? 0;
  const unsampled: number[] = [];
  for (let y = first; y <= last; y++) if (!years.includes(y)) unsampled.push(y);

  const groups: SemiGroup[] = GROUPS.map((g) => ({ ...g, rows: [] }));
  const allMerchandise: SemiRow[] = [];

  for (const [i, year] of years.entries()) {
    const prev = i > 0 ? years[i - 1] : undefined;
    const gapBefore = prev === undefined ? 0 : year - prev - 1;

    const rows = JSON.parse(
      await readFile(join(TRADE_DIR, `hs6-${year}.json`), "utf8"),
    ) as YearRow[];

    for (const g of groups) {
      let m = 0, x = 0;
      const codes: string[] = [];
      for (const r of rows) {
        if (!r || typeof r.code !== "string" || !r.code.startsWith(g.prefix)) continue;
        const mi = Number(r.m) || 0;
        const xi = Number(r.x) || 0;
        m += mi;
        x += xi;
        if (mi !== 0 || xi !== 0) codes.push(r.code);
      }
      // A group with nothing reported is absent, not zero. HS 852520 does not
      // exist after HS2007; writing a 0 for 2024 would draw a line down to the
      // axis and read as "handset imports stopped".
      if (codes.length === 0) continue;
      const imports = dollars(m);
      const exports = dollars(x);
      codes.sort();
      g.rows.push({ year, imports, exports, balance: imports - exports, codes, gapBefore });
    }

    {
      // Chapter 99 is Comtrade's residual bucket and is excluded from the
      // denominator for the same reason lib/trade-data.ts excludes it from the
      // product table: it is not a commodity, and it is large enough to move a
      // share by a point while meaning nothing in particular.
      let m = 0, x = 0;
      for (const r of rows) {
        if (!r || typeof r.code !== "string" || r.code.startsWith("99")) continue;
        m += Number(r.m) || 0;
        x += Number(r.x) || 0;
      }
      const imports = dollars(m);
      const exports = dollars(x);
      allMerchandise.push({
        year, imports, exports, balance: imports - exports,
        codes: [], gapBefore,
      });
    }
  }

  // ── The 2008 IC row, flagged where it is computed ─────────────────────
  //
  // Marked here rather than in the page copy so the warning travels with the
  // number into any consumer, including one nobody has written yet.
  const ic = groups.find((g) => g.id === "ic");
  const ic2008 = ic?.rows.find((r) => r.year === 2008);
  const ic2004 = ic?.rows.find((r) => r.year === 2004);
  if (ic2008 && ic2004 && ic2008.imports < ic2004.imports) {
    ic2008.suspect =
      `IC imports fall from $${(ic2004.imports / 1e6).toFixed(0)}m in 2004 to ` +
      `$${(ic2008.imports / 1e6).toFixed(0)}m in 2008, in a year when total merchandise ` +
      "imports were more than three times 2004's. Inside the heading, 854221 falls from " +
      "$42m to $79k and 854260/854270 collapse, while the 2008 file carries no HS2007 IC " +
      "codes at all. This is a classification break in the reported data, not a fall in " +
      "chip imports. It is flagged, not corrected: no correction is available that would " +
      "not be a number this project invented.";
  }

  // ── Self-checks that must hold before anything is written ─────────────
  const ch85 = groups.find((g) => g.id === "chapter85");
  if (!ic || !ch85) throw new Error("a headline group vanished; check GROUPS ids against the reader in lib/semiconductor.ts");
  const disc = groups.find((g) => g.id === "discrete");
  for (const y of years) {
    const c = ch85.rows.find((r) => r.year === y);
    const a = ic.rows.find((r) => r.year === y);
    const b = disc?.rows.find((r) => r.year === y);
    if (!c) throw new Error(`chapter 85 is empty in ${y}; the year file is truncated or the prefix match broke`);
    const sub = (a?.imports ?? 0) + (b?.imports ?? 0);
    if (c.imports < sub) {
      throw new Error(
        `chapter 85 imports in ${y} ($${c.imports}) are below its own 8541+8542 subtotal ` +
        `($${sub}); the prefix aggregation is double-counting or dropping lines`,
      );
    }
  }

  await mkdir(OUT_DIR, { recursive: true });
  const out: SemiTrade = {
    builtAt: new Date().toISOString(),
    source:
      "UN Comtrade, India as reporter, via the HS6 files committed in data/trade/ " +
      `(${universe?.source ?? "classification reference unavailable"}). Computed offline by ` +
      "scripts/etl/connectors/semiconductor.ts; no figure here is fetched, estimated or adjusted.",
    unit: "US$, nominal, not deflated. Rounded to whole dollars.",
    reporter: "India",
    sampledYears: years,
    unsampledYears: unsampled,
    sparse:
      `Year coverage is sparse. ${years.length} of ${last - first + 1} years between ${first} ` +
      `and ${last} were sampled by the upstream ingest; ${unsampled.length} were never ` +
      `requested (${unsampled.join(", ")}). Every row carries gapBefore, the count of ` +
      "unsampled years immediately preceding it. Do not draw a continuous line across a gap: " +
      "the shape between two sampled years is unmeasured, and the largest gap spans COVID.",
    note:
      "Headings, not subheadings. This dataset spans three HS revisions and the subheadings " +
      "inside 8541, 8542 and 8517 change between them; heading-level sums survive that because " +
      "within any one year the reported subheadings partition the heading, and no year here " +
      "mixes vintages. Each row lists the subheadings that actually carried value, as evidence.",
    refusal:
      "HS 8541 is not a chip series. From 2017 it is dominated by photovoltaic cells and " +
      "modules, and adding it to HS 8542 would present India's solar import surge as a " +
      "semiconductor dependency. HS 8517 is not comparable before 2012, because handsets were " +
      "reported in 852520 until HS2007. Neither series is smoothed, gap-filled or rebased.",
    groups,
    allMerchandise,
  };
  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");

  const bn = (n: number): string => `${(n / 1e9).toFixed(2)}bn`;
  for (const g of groups) {
    console.log(`\n${g.label}  [${g.role}]`);
    for (const r of g.rows) {
      console.log(
        `  ${r.year}${r.gapBefore > 0 ? ` (+${r.gapBefore} unsampled)` : "            "}` +
        `  in $${bn(r.imports).padStart(8)}  out $${bn(r.exports).padStart(8)}` +
        `  bal $${bn(r.balance).padStart(8)}  ${r.codes.length} codes${r.suspect ? "  SUSPECT" : ""}`,
      );
    }
  }
  console.log(`\nwrote ${OUT}`);
}

if (isEntryPoint(import.meta.url)) {
  run().catch((err) => { console.error(err); process.exit(1); });
}
