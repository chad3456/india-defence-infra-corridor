/**
 * Promote probed World Bank indicators into the catalogue.
 *
 * `npm run wdi:promote`. Reads `data/live/wdi-probe.json` — which holds only
 * indicators the API confirmed carry at least eight Indian observations since
 * 2001 — and emits catalogue entries for the ones this site should carry.
 *
 * ── What is decided here, and what is not ────────────────────────────────
 *
 * Code, official name, unit and definition come from the API and are copied,
 * never composed. Two things the API cannot decide are decided here, by rule:
 *
 * Category, from the World Bank's own code prefix. `SE` is education, `SH`
 * health, `EG` energy, `IT` communications, and so on — a documented taxonomy,
 * and far more reliable than the topic label, which is assigned by whichever
 * topic listing happened to mention an indicator first. Forty-three education
 * indicators arrived tagged Gender or Aid Effectiveness for exactly that
 * reason.
 *
 * Direction of good, from a keyword table, defaulting to null. Null is not a
 * gap here: this site already treats an undirected series as a real state,
 * because whether more of something is better is often the argument rather than
 * the data. Military spending, imports, urbanisation and every sector share are
 * left undirected on purpose. A wrong direction is worse than none — it would
 * silently flip a series' position on the development matrix.
 *
 * Families excluded wholesale are listed in `SKIP_PREFIX` with the reason. Aid
 * and donor flows measure what a country receives, not how it is doing.
 *
 * ── One measure, one entry ───────────────────────────────────────────────
 *
 * The World Bank publishes most national-accounts measures in six or more unit
 * variants: current US dollars, current local currency, constant dollars,
 * constant local currency, annual growth, and share of GDP. "Final consumption
 * expenditure" alone arrives eight times. Those are not eight metrics; they are
 * one metric in eight currencies, and shipping them all would inflate a count
 * while telling a reader nothing new — the exact hollowness that makes a
 * headline number like "five hundred metrics" worth distrusting.
 *
 * So variants are collapsed to one entry per measure. Local-currency forms are
 * dropped outright: this site's whole premise is comparison against five other
 * countries, and a rupee series cannot be compared to anything. Growth variants
 * are dropped too, because the chart registry already derives year-on-year,
 * indexed and compound-growth views from every series it holds — importing the
 * World Bank's own growth column would duplicate a transform this site computes
 * and label the copy as a separate measure.
 *
 * A share-of-GDP form is kept alongside the level where both exist. That one is
 * a different question rather than a different currency.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Category } from "../../lib/types";
import { WDI_INDICATORS } from "../../lib/wdi-catalogue";

const ROOT = process.cwd();

interface Candidate {
  code: string;
  name: string;
  unit: string;
  topic: string;
  sourceNote: string;
  points: number;
  firstYear: number | null;
  latestYear: number | null;
  known: boolean;
}

/** Whole families this site does not carry, and why. */
const SKIP_PREFIX: Array<[string, string]> = [
  // DT. and GFDD.OI were both excluded on the first pass, and that was wrong.
  // They were judged balance-sheet detail below the resolution this site
  // reports at — but external debt stocks, debt service against exports,
  // short-term debt against reserves and bank non-performing loans are exactly
  // what "financial development" means, and they are the series a reader asks
  // for by name. Only the genuinely creditor-by-creditor lines are skipped now.
  ["DT.DOD.MWBG", "IBRD and IDA loan balances specifically; a creditor line rather than a debt measure"],
  ["DT.DOD.DIMF", "use of IMF credit; a creditor line"],
  ["DT.NFL.", "net financial flows by individual creditor"],
  ["DT.INT.", "interest paid by individual creditor"],
  ["DT.AMT.", "principal repaid by individual creditor"],
  ["DT.DIS.", "disbursements by individual creditor"],
  ["DC.", "donor disbursement flows; measures what is received, not how the country is doing"],
  ["BM.", "granular balance-of-payments debits, mostly the mirror of an export line already carried"],
  ["IQ.CPA", "CPIA scores are assessed for IDA-eligible borrowers; India's entries are stale or absent in substance"],
  ["PA.", "PPP conversion factors, an input to other series rather than a series"],
];

/** World Bank code prefix to this site's category. Longest prefix wins. */
const CATEGORY_BY_PREFIX: Array<[string, Category]> = [
  ["SE.", "education"],
  ["SH.", "quality-of-life"],
  ["SL.", "social"],
  ["SP.", "social"],
  ["SG.", "social"],
  ["SI.", "social"],
  ["SM.", "social"],
  ["SN.", "quality-of-life"],
  ["AG.", "social"],
  ["EG.", "energy"],
  ["EN.", "energy"],
  ["ER.", "energy"],
  ["IT.", "infrastructure"],
  ["IS.", "infrastructure"],
  ["IE.", "infrastructure"],
  ["IC.BUS", "ai-science"],
  ["IC.", "manufacturing"],
  ["IP.", "ai-science"],
  ["GB.", "ai-science"],
  ["ST.", "quality-of-life"],
  ["TM.", "trade"],
  ["TX.", "trade"],
  ["TG.", "trade"],
  ["TT.", "trade"],
  ["BG.", "trade"],
  ["BX.", "trade"],
  ["BN.", "economy"],
  ["VC.", "security"],
  ["MS.", "defence"],
  ["CM.", "economy"],
  ["NV.AGR", "social"],
  ["NV.IND.MANF", "manufacturing"],
  ["NV.IND", "manufacturing"],
  ["NV.SRV", "economy"],
  ["NV.", "economy"],
  ["NY.", "economy"],
  ["NE.", "economy"],
  ["GC.", "economy"],
  ["GF.", "economy"],
  // Banking, debt and financial depth get their own category. They were all
  // "economy" before, which put a hundred and seventy series behind one chip
  // and made the ones a reader actually looks for — public debt, bad loans,
  // credit to the private sector — impossible to find.
  ["FM.", "finance"],
  ["FB.", "finance"],
  ["FD.", "finance"],
  ["FI.", "finance"],
  ["FR.", "finance"],
  ["FS.", "finance"],
  ["FP.", "economy"],
  ["GFDD.", "finance"],
  ["DT.", "finance"],
  ["GC.DOD", "finance"],
];

/**
 * Direction of good, by keyword on the official name. First match wins.
 *
 * Deliberately short. Every pattern here is one where the direction is not
 * seriously contested; anything else falls through to null.
 */
const BETTER_UP: RegExp[] = [
  /\b(enrolment|enrollment|literacy|completion rate|attainment)\b/i,
  /\baccess to\b/i,
  /\b(immuni[sz]ation|vaccinat)/i,
  /\blife expectancy\b/i,
  /\b(researchers|scientific and technical|patent|trademark|industrial design|R&D|research and development)\b/i,
  /\bnew business(es)? (registered|density)\b/i,
  /\blabor force participation\b/i,
  /\brenewable (energy|electricity) (consumption|output)\b/i,
  /\b(internet|mobile cellular|broadband|telephone) (users|subscriptions)\b/i,
  /\bindividuals using the internet\b/i,
  /\bper capita\b.*\b(GDP|GNI|income)\b/i,
  /\b(exports of goods|high-technology exports|manufactures exports)\b/i,
  /\bgross (capital formation|savings|fixed capital)\b/i,
  /\bdomestic credit to private sector\b/i,
  /\b(safely managed|improved) (water|sanitation|drinking)\b/i,
  /\belectricity\b.*\baccess\b/i,
  /\bsecure internet servers\b/i,
];

const BETTER_DOWN: RegExp[] = [
  /\bnon-?performing loans\b/i,
  /\bdebt service\b/i,
  /\bshort-?term debt\b/i,
  /\b(mortality|death rate|deaths)\b/i,
  /\b(poverty|poverty headcount)\b/i,
  /\b(undernourish|stunting|wasting|underweight|anemia|anaemia)\b/i,
  /\bunemployment\b/i,
  /\b(inflation|consumer prices)\b/i,
  /\bout-of-pocket\b/i,
  /\b(emissions|greenhouse)\b/i,
  /\bprevalence of\b.*\b(HIV|tuberculosis|undernourish)\b/i,
  /\bchild (labor|labour|marriage)\b/i,
  /\billiterate\b/i,
  /\bnon-?performing loans\b/i,
];

function categoryOf(code: string): Category | null {
  let best: [string, Category] | null = null;
  for (const [prefix, cat] of CATEGORY_BY_PREFIX) {
    if (!code.startsWith(prefix)) continue;
    if (!best || prefix.length > best[0].length) best = [prefix, cat];
  }
  return best?.[1] ?? null;
}

function directionOf(name: string): boolean | null {
  for (const re of BETTER_DOWN) if (re.test(name)) return false;
  for (const re of BETTER_UP) if (re.test(name)) return true;
  return null;
}

/**
 * Unit suffixes that mark the same measure expressed differently.
 *
 * `ZS` (share), `PC` (per capita) and `PP` (purchasing power) are deliberately
 * absent: each asks a different question rather than restating the same answer
 * in another currency.
 */
const CURRENCY_SUFFIX = new Set(["CD", "CN", "KD", "KN", "ZG", "AD"]);

/** Local-currency and growth forms this site does not carry at all. */
function isRedundantVariant(code: string): "local currency" | "growth" | null {
  const parts = code.split(".");
  const tail = parts.slice(-2).join(".");
  if (/\bZG$/.test(code)) return "growth";
  if (parts.at(-1) === "CN" || parts.at(-1) === "KN") return "local currency";
  if (tail === "CN.AD" || tail === "KN.AD") return "local currency";
  return null;
}

/** The measure a code names, with its currency variant stripped. */
function stemOf(code: string): string {
  const parts = code.split(".");
  while (parts.length > 2 && CURRENCY_SUFFIX.has(parts[parts.length - 1] ?? "")) parts.pop();
  return parts.join(".");
}

/**
 * Which variant to keep when several share a stem.
 *
 * Constant dollars first: inflation-adjusted and comparable to the peer set,
 * which is what every cross-country chart on this site needs.
 */
function variantRank(code: string): number {
  const last = code.split(".").at(-1) ?? "";
  if (last === "KD") return 0;
  if (last === "CD") return 1;
  if (last === "ZS") return 2;
  return 3;
}

/** A stable, readable series id from the code. */
function idOf(code: string): string {
  return `wdi-${code.toLowerCase().replace(/\./g, "-")}`;
}

/** Short unit for an axis, from the official unit or the name's parenthetical. */
function unitsOf(c: Candidate): { unit: string; unitShort: string } {
  const paren = /\(([^)]+)\)\s*$/.exec(c.name)?.[1] ?? "";
  const unit = (c.unit || paren || "index").trim();
  const short = unit
    .replace(/current US\$/i, "US$")
    .replace(/constant .*US\$/i, "US$")
    .replace(/% of GDP/i, "% GDP")
    .replace(/per 1,000 live births/i, "per 1k")
    .replace(/per 100,000 people/i, "per 100k")
    .replace(/^%.*/, "%")
    .slice(0, 12);
  return { unit: unit.slice(0, 60), unitShort: short || "value" };
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function main() {
  const probe = JSON.parse(
    readFileSync(join(ROOT, "data/live/wdi-probe.json"), "utf8"),
  ) as { candidates: Candidate[] };

  const existing = new Set(WDI_INDICATORS.map((i) => i.code));
  const existingIds = new Set(WDI_INDICATORS.map((i) => i.id));

  const skipped: Record<string, number> = {};
  const chosen: Array<Candidate & { category: Category; higherIsBetter: boolean | null }> = [];

  for (const c of probe.candidates) {
    if (c.known || existing.has(c.code)) continue;
    const skip = SKIP_PREFIX.find(([p]) => c.code.startsWith(p));
    if (skip) {
      skipped[skip[0]] = (skipped[skip[0]] ?? 0) + 1;
      continue;
    }
    const category = categoryOf(c.code);
    if (!category) {
      skipped["(no category rule)"] = (skipped["(no category rule)"] ?? 0) + 1;
      continue;
    }
    if (existingIds.has(idOf(c.code))) continue;
    const redundant = isRedundantVariant(c.code);
    if (redundant) {
      skipped[`(${redundant} variant)`] = (skipped[`(${redundant} variant)`] ?? 0) + 1;
      continue;
    }
    chosen.push({ ...c, category, higherIsBetter: directionOf(c.name) });
  }

  // One entry per measure. Where several variants survive, keep the most
  // comparable and report how many were folded away.
  const byStem = new Map<string, typeof chosen>();
  for (const c of chosen) {
    const stem = stemOf(c.code);
    const group = byStem.get(stem) ?? [];
    group.push(c);
    byStem.set(stem, group);
  }
  let folded = 0;
  const collapsed: typeof chosen = [];
  for (const group of byStem.values()) {
    group.sort(
      (a, b) => variantRank(a.code) - variantRank(b.code) || b.points - a.points,
    );
    const keep = group[0];
    if (keep) collapsed.push(keep);
    folded += group.length - 1;
  }
  if (folded > 0) skipped["(same measure, another currency)"] = folded;

  chosen.length = 0;
  chosen.push(...collapsed);
  chosen.sort((a, b) => a.category.localeCompare(b.category) || b.points - a.points);

  const lines: string[] = [];
  let lastCat = "";
  for (const c of chosen) {
    if (c.category !== lastCat) {
      lines.push(`\n  /* ---------------- ${c.category} ---------------- */`);
      lastCat = c.category;
    }
    const { unit, unitShort } = unitsOf(c);
    // Trim on a word boundary. The World Bank's source notes run to paragraphs
    // and a hard slice leaves a definition ending mid-word, which reads as a
    // rendering bug rather than as an abridgement.
    const definition = c.sourceNote
      ? c.sourceNote.length > 200
        ? `${c.sourceNote.slice(0, 200).replace(/\s+\S*$/, "")}…`
        : c.sourceNote
      : `World Bank series ${c.code}.`;
    lines.push(
      `  { code: "${c.code}", id: "${idOf(c.code)}", title: "${esc(c.name)}", ` +
        `definition: "${esc(definition)}", category: "${c.category}", ` +
        `unit: "${esc(unit)}", unitShort: "${esc(unitShort)}", higherIsBetter: ${c.higherIsBetter} },`,
    );
  }

  writeFileSync(join(ROOT, "data/live/wdi-promoted.ts.txt"), lines.join("\n") + "\n", "utf8");

  const byCat: Record<string, number> = {};
  const undirected = chosen.filter((c) => c.higherIsBetter === null).length;
  for (const c of chosen) byCat[c.category] = (byCat[c.category] ?? 0) + 1;

  process.stdout.write(`${chosen.length} indicator(s) promoted\n`);
  for (const [k, v] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
    process.stdout.write(`  ${String(v).padStart(4)}  ${k}\n`);
  }
  process.stdout.write(`\n${undirected} left undirected (higherIsBetter: null)\n`);
  process.stdout.write(`skipped:\n`);
  for (const [k, v] of Object.entries(skipped).sort((a, b) => b[1] - a[1])) {
    process.stdout.write(`  ${String(v).padStart(4)}  ${k}\n`);
  }
  process.stdout.write(`\nWrote data/live/wdi-promoted.ts.txt — review before pasting.\n`);
}

main();
