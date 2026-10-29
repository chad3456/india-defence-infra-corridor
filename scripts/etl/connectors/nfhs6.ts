/**
 * NFHS-6 (2023–24) from IIPS's own fact sheets.
 *
 * States and India: the "Fact Sheets of India, States and Union Territories"
 * PDF that IIPS links publicly from its home page. It is downloaded in GitHub
 * Actions (this sandbox cannot reach IIPS), every "Key Indicators" page is
 * read by position (lib/nfhs6.ts), and only the extracted figures are
 * committed — never the 12 MB PDF.
 *
 * Districts: IIPS publishes the district compendiums behind its download
 * form, so this does not fetch them. A person downloads them from IIPS and
 * attaches them to the GitHub Release named in NFHS6_DISTRICT_DIR's workflow
 * step; the workflow fetches the release's PDFs into that directory and this
 * reads them the same way. Without them, no district file is written.
 *
 * ── Gates before anything is written ──────────────────────────────────────
 *
 * India present; at least 30 states/UTs; every geography at least 90
 * indicators; every percentage between 0 and 100; and each indicator number
 * carrying the same label everywhere (spacing aside). A failed gate leaves the
 * committed file as it was and says why. Connectors never throw.
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { extractPages } from "../lib/pdf-table";
import { isPercent, marksOf, parsePage, type Nfhs6Indicator, type Nfhs6Row, type Nfhs6States, type ParsedRow } from "../../../lib/nfhs6";

const FACT_SHEETS = "https://www.nfhsiips.in/nfhsuser/assets/National%20Family%20Health%20Survey%20(NFHS-6)%202023-2024%20Fact%20Sheets.pdf";
const UA = "BharatTracker/0.1 (+https://github.com/chad3456/india-defence-infra-corridor)";
const DIR = join(process.cwd(), "data", "nfhs6");

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
/** Two labels for one indicator: the same once spacing is ignored, allowing a letter or two clipped in extraction. */
export function sameLabel(a: string, b: string): boolean {
  const x = squash(a).slice(0, 60), y = squash(b).slice(0, 60);
  if (x === y) return true;
  const k = Math.min(x.length, y.length);
  return k >= 20 && x.slice(0, k - 2) === y.slice(0, k - 2);
}

/** Pages a run could not read cleanly, with their positioned fragments, so the layout can be looked at. */
async function writeDebug(pageNumbers: number[]) {
  const want = new Set(pageNumbers);
  const pages = lastPages.filter((p) => want.has(p.page)).map((p) => ({ page: p.page, f: p.fragments.map((x) => [x.text.slice(0, 120), Math.round(x.x * 10) / 10, Math.round(x.y * 10) / 10]) }));
  await mkdir(DIR, { recursive: true });
  await writeFile(join(DIR, "debug.json"), JSON.stringify({ writtenAt: new Date().toISOString(), pages }) + "\n");
}

/** Read every key-indicator page of one PDF into geography → rows. */
type PageFrags = Awaited<ReturnType<typeof extractPages>>;
let lastPages: PageFrags = [];
const rowPage = new WeakMap<ParsedRow, number>();

async function readPdf(bytes: Uint8Array): Promise<{ pages: number; geos: Map<string, ParsedRow[]>; problems: string[] }> {
  const pages = await extractPages(bytes);
  lastPages = pages;
  const geos = new Map<string, ParsedRow[]>();
  const problems: string[] = [];
  let lastSection = "";
  for (const pg of pages) {
    if (!pg.fragments.some((f) => /Key Indicators/i.test(f.text))) continue;
    const out = parsePage(pg.fragments);
    if (!out.geo) { problems.push(`page ${pg.page}: no geography heading`); continue; }
    for (const p of out.problems) problems.push(`page ${pg.page} (${out.geo}): ${p}`);
    const rows = geos.get(out.geo) ?? [];
    for (const r of out.rows) { if (r.section) lastSection = r.section; else r.section = lastSection; rowPage.set(r, pg.page); rows.push(r); }
    geos.set(out.geo, rows);
  }
  return { pages: pages.length, geos, problems };
}

function toRows(rows: ParsedRow[]): Nfhs6Row[] {
  return rows.map((r) => {
    const out: Nfhs6Row = [r.n, r.cells.urban?.v ?? null, r.cells.rural?.v ?? null, r.cells.total?.v ?? null, r.cells.prev?.v ?? null];
    const m = marksOf(r.cells);
    if (m) out.push(m);
    return out;
  });
}

/**
 * Labels the fact sheet itself misprints on some state pages. The row's
 * position and its values' scale show which indicator it is; India's label
 * is used and the misprint is noted rather than hidden.
 */
export const KNOWN_MISPRINTS: Array<{ n: number; printed: RegExp; why: string }> = [
  { n: 86, printed: /^Mildly elevated blood pressure/i, why: "printed with #84's wording on some state pages; its values sit at #86's place and scale (elevated or on medicine)" },
];
export const misprinted = (n: number, label: string) => KNOWN_MISPRINTS.some((m) => m.n === n && m.printed.test(label));

/** The gates. Returns the reasons a file must not be written. */
export function gate(indicators: Nfhs6Indicator[], geos: Map<string, ParsedRow[]>, minGeos: number, minIndicators: number): string[] {
  const fails: string[] = [];
  if (geos.size < minGeos) fails.push(`only ${geos.size} geographies read, need ${minGeos}`);
  const byN = new Map(indicators.map((i) => [i.n, i]));
  for (const [geo, rows] of geos) {
    const ns = new Set(rows.map((r) => r.n));
    if (ns.size < minIndicators) fails.push(`${geo}: only ${ns.size} indicators`);
    if (ns.size !== rows.length) fails.push(`${geo}: an indicator number appears twice`);
    for (const r of rows) {
      const ref = byN.get(r.n);
      if (ref && !sameLabel(ref.label, r.label) && !misprinted(r.n, r.label)) fails.push(`${geo} #${r.n}: label differs from India's ("${r.label.slice(0, 60)}")`);
      if (isPercent(r.unit)) for (const c of Object.values(r.cells)) if (c?.v != null && (c.v < 0 || c.v > 100)) fails.push(`${geo} #${r.n}: ${c.v}% out of range`);
    }
  }
  return fails;
}

async function states(): Promise<{ written: boolean; errors: string[] }> {
  let bytes: Uint8Array;
  try {
    const res = await fetch(FACT_SHEETS, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(180_000) });
    if (!res.ok) return { written: false, errors: [`fact sheets answered ${res.status}`] };
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    const cause = (e as { cause?: { code?: string } }).cause;
    return { written: false, errors: [`fact sheets unreachable: ${String(e).slice(0, 120)} ${cause?.code ?? ""}`] };
  }
  const { pages, geos, problems } = await readPdf(bytes);
  const india = geos.get("India");
  if (!india) return { written: false, errors: ["no India pages found", ...problems.slice(0, 20)] };
  const indicators: Nfhs6Indicator[] = india.map((r) => ({ n: r.n, label: r.label, unit: r.unit, section: r.section }));
  for (const [g, rows] of geos) for (const r of rows) if (r.n !== 0 && misprinted(r.n, r.label) && !sameLabel(indicators.find((i) => i.n === r.n)?.label ?? "", r.label)) problems.push(`${g} #${r.n}: ${KNOWN_MISPRINTS.find((m) => m.n === r.n)!.why}`);
  const fails = gate(indicators, geos, 31, indicators.length - 3);
  // Every page with a problem or a failed row goes to the debug file, written either way.
  const badPages = new Set<number>(problems.map((p) => Number(/^page (\d+)/.exec(p)?.[1])).filter((x) => x > 0));
  for (const f of fails) { const m = /^(.+) #(\d+):/.exec(f); const row = m ? geos.get(m[1]!)?.find((r) => r.n === Number(m[2])) : undefined; const pg = row ? rowPage.get(row) : undefined; if (pg) badPages.add(pg); }
  if (badPages.size) await writeDebug([...badPages].slice(0, 12));
  if (fails.length) return { written: false, errors: [`gate failed: ${fails.length} problems`, ...fails.slice(0, 40), ...problems.slice(0, 20)] };
  const out: Nfhs6States = {
    source: { url: FACT_SHEETS, title: "National Family Health Survey (NFHS-6), 2023-24: India and State/UT Fact Sheets", released: "2026-05-29", publisher: "IIPS and Ministry of Health and Family Welfare" },
    fetchedAt: new Date().toISOString(),
    pages,
    indicators,
    geos: Object.fromEntries([...geos].map(([g, rows]) => [g, toRows(rows)])),
    problems,
  };
  await mkdir(DIR, { recursive: true });
  await writeFile(join(DIR, "states.json"), JSON.stringify(out) + "\n");
  console.log(`states: ${geos.size} geographies, ${indicators.length} indicators, ${problems.length} page problems`);
  return { written: true, errors: [] };
}

/** District compendiums a person attached to the release, if any. */
async function districts(indicators: Nfhs6Indicator[] | null): Promise<{ written: boolean; errors: string[] }> {
  const dir = process.env.NFHS6_DISTRICT_DIR;
  if (!dir || !existsSync(dir)) return { written: false, errors: ["no district compendiums supplied (NFHS6_DISTRICT_DIR unset or empty)"] };
  const files = (await readdir(dir)).filter((f) => /\.pdf$/i.test(f)).sort();
  if (!files.length) return { written: false, errors: ["no PDFs in the district directory"] };
  const all = new Map<string, ParsedRow[]>();
  const report: Array<{ file: string; pages: number; districts: number; problems: string[] }> = [];
  for (const f of files) {
    try {
      const { pages, geos, problems } = await readPdf(new Uint8Array(await readFile(join(dir, f))));
      for (const [g, rows] of geos) all.set(g, rows);
      report.push({ file: f, pages, districts: geos.size, problems: problems.slice(0, 30) });
    } catch (e) { report.push({ file: f, pages: 0, districts: 0, problems: [String(e).slice(0, 200)] }); }
  }
  // The layout report is committed either way, so a district layout this has not seen can be read and fixed.
  await mkdir(DIR, { recursive: true });
  await writeFile(join(DIR, "district-report.json"), JSON.stringify({ readAt: new Date().toISOString(), files: report, sampleNames: [...all.keys()].slice(0, 40) }, null, 1) + "\n");
  if (!indicators) return { written: false, errors: ["district labels need the state file's indicator list"] };
  const fails = gate(indicators, all, 300, 60);
  if (fails.length) return { written: false, errors: [`district gate failed: ${fails.length} problems`, ...fails.slice(0, 30)] };
  // District sheets print "District, State - Key Indicators": split on the last comma.
  const geos: Record<string, { district: string; state: string; rows: Nfhs6Row[] }> = {};
  for (const [g, rows] of all) {
    const i = g.lastIndexOf(",");
    geos[g] = { district: (i > 0 ? g.slice(0, i) : g).trim(), state: (i > 0 ? g.slice(i + 1) : "").trim(), rows: toRows(rows) };
  }
  await writeFile(join(DIR, "districts.json"), JSON.stringify({ fetchedAt: new Date().toISOString(), source: "IIPS NFHS-6 district fact sheet compendiums, supplied as release assets", files, geos }) + "\n");
  console.log(`districts: ${all.size} read from ${files.length} files`);
  return { written: true, errors: [] };
}

async function main() {
  const s = await states();
  for (const e of s.errors) console.error(`states: ${e}`);
  let indicators: Nfhs6Indicator[] | null = null;
  try { indicators = (JSON.parse(await readFile(join(DIR, "states.json"), "utf8")) as Nfhs6States).indicators; } catch { /* no state file yet */ }
  const d = await districts(indicators);
  for (const e of d.errors) console.error(`districts: ${e}`);
  console.log(`nfhs6: states ${s.written ? "written" : "unchanged"}, districts ${d.written ? "written" : "unchanged"}`);
}

main().catch((e) => { console.error(e); process.exitCode = 0; });
