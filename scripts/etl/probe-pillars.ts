/**
 * Four dashboards, and whether anything will feed them.
 *
 * Tech infrastructure since 2014, education, the space programme including
 * its private half, and defence startups. All four are well documented and
 * none of the documentation is reachable from here, so this asks from CI.
 *
 * Wikipedia is the spine because it is the one source that has answered every
 * time this project has asked, and because parseTables already reads it. But
 * "Wikipedia has a page about it" is not the same as "the page has a table
 * with numbers in it", and the difference has cost two rounds elsewhere. So
 * this reports, for every candidate page, each table's chosen header row and a
 * sample of its rows — enough to write a connector against without guessing.
 *
 * Publishes no series.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "./lib/http";
import { parseTables, plain } from "./lib/wikitext";
import { isEntryPoint } from "./lib/entry";

const ROOT = process.cwd();
const OUT = join(ROOT, "data/live/pillars-probe.json");
const WIKI = "https://en.wikipedia.org/w/index.php?action=raw&title=";

/** A table is useful here when it has a year, a count, or a named entity. */
const USEFUL = /^(year|rank|name|mission|satellite|launch|state|company|scheme|indicator|no\.?|s\.?\s*no)/i;

interface TableShape {
  index: number;
  headers: string[];
  rows: number;
  sampleRows: string[][];
  looksUseful: boolean;
}
interface Probe {
  pillar: string;
  page: string;
  ok: boolean;
  status: string;
  bytes?: number;
  tables?: TableShape[];
}
const probes: Probe[] = [];

async function flush(): Promise<void> {
  await mkdir(join(ROOT, "data/live"), { recursive: true });
  await writeFile(OUT, JSON.stringify({ probedAt: new Date().toISOString(), probes }, null, 2) + "\n", "utf8");
}

async function probe(pillar: string, page: string): Promise<void> {
  const res = await getText(WIKI + encodeURIComponent(page), { timeoutMs: 45_000, retries: 1, cacheMs: 0 });
  if (!res.ok || res.data === null) {
    probes.push({ pillar, page, ok: false, status: res.error ?? "no body" });
    await flush();
    return;
  }
  const tables = parseTables(res.data)
    .map((t, index) => ({
      index,
      headers: t.headers.map((h) => h.slice(0, 30)),
      rows: t.rows.length,
      sampleRows: t.rows.slice(0, 2).map((r) => r.map((c) => plain(c).slice(0, 34))),
      looksUseful: t.rows.length >= 5 && t.headers.some((h) => USEFUL.test(h.trim())),
    }))
    .filter((t) => t.rows >= 3);
  probes.push({ pillar, page, ok: true, status: "200", bytes: res.data.length, tables });
  await flush();
  await new Promise((r) => setTimeout(r, 800));
}

export async function run(opts: { onProgress?: (s: string) => void } = {}): Promise<{ errors: string[] }> {
  const log = opts.onProgress ?? (() => {});

  // Tech infrastructure. The story since 2014 is fibre, mobile data and
  // payments; TRAI already supplies the telephony half.
  for (const p of ["BharatNet", "Internet in India", "Telecommunications in India",
                   "Unified Payments Interface", "List of Indian states and union territories by internet users"]) {
    await probe("tech-infra", p);
  }

  // Education. Enrolment, institutions and literacy, by state where possible.
  for (const p of ["Education in India", "Literacy in India",
                   "List of Indian states and union territories by literacy rate",
                   "Higher education in India", "National Education Policy 2020"]) {
    await probe("education", p);
  }

  // Space, public and private. Launch history is the spine; the private
  // sector is the part that did not exist a decade ago.
  for (const p of ["List of Indian satellites", "Indian Space Research Organisation",
                   "List of ISRO missions", "Timeline of ISRO", "Indian Space Association",
                   "Skyroot Aerospace", "Agnikul Cosmos", "Pixxel"]) {
    await probe("space", p);
  }

  // Defence industry and the startups inside it.
  for (const p of ["Defence industry of India", "Innovations for Defence Excellence",
                   "Defence Research and Development Organisation",
                   "List of defence companies of India"]) {
    await probe("defence-startups", p);
  }

  for (const p of probes) {
    if (!p.ok) { log(`  unreachable  ${p.pillar}/${p.page}: ${p.status}`); continue; }
    const useful = (p.tables ?? []).filter((t) => t.looksUseful);
    log(`\n${p.pillar}/${p.page}  ${p.bytes}b  ${p.tables?.length ?? 0} table(s), ${useful.length} useful`);
    for (const t of useful.slice(0, 3)) {
      log(`   [${t.index}] rows=${t.rows}  ${t.headers.join(" | ").slice(0, 120)}`);
      for (const r of t.sampleRows) log(`        ${r.join(" | ").slice(0, 130)}`);
    }
  }
  return { errors: [] };
}

if (isEntryPoint(import.meta.url)) {
  run({ onProgress: (s) => console.log(s) }).then(() => console.log(`\nwrote ${OUT}`));
}
