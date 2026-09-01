/**
 * Search the Open Government Data catalogue for what is still missing.
 *
 * `npm run ogd:probe`. The catalogue holds 287,810 resources and the previous
 * probe established the one parameter that actually filters it: `filters[title]`.
 * Four other plausible names -- q, query, title, search -- were accepted and
 * silently ignored, returning the unfiltered list, which is the failure mode
 * worth naming: a search that looks like it worked.
 *
 * What is still unsourced after the mobility work: railway freight and
 * passenger volumes, city bus fleets, metro ridership, election turnout, the
 * SIR roll revision, and cinema admissions. Each gets a set of title queries,
 * and the report records the resource ids so an ingest can address them
 * directly instead of re-searching.
 *
 * Publishes nothing.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getJson } from "./lib/http";

const ROOT = process.cwd();
const OUT = join(ROOT, "data/live/ogd-probe.json");
const BASE = "https://api.data.gov.in/lists?format=json&limit=30";

interface Rec {
  index_name?: string;
  title?: string;
  desc?: string;
  org?: string[] | string;
  sector?: string[] | string;
  source?: string;
  created?: number;
  updated?: number;
}
interface ListRes { total?: number; count?: number; records?: Rec[] }

interface Found {
  topic: string;
  term: string;
  total: number;
  returned: number;
  /** Enough to address the resource later without searching again. */
  hits: Array<{ id: string; title: string; org: string; updated: string | null }>;
  error?: string;
}
const found: Found[] = [];
let resourceTest: Record<string, unknown> | null = null;

/** Terms per topic. Several spellings, because the catalogue is inconsistent. */
const TOPICS: Record<string, string[]> = {
  "rail-freight": ["freight", "railway freight", "originating traffic", "goods earnings"],
  "rail-passenger": ["railway passenger", "passengers originating", "train"],
  "vande-bharat": ["vande bharat"],
  "bus": ["bus", "state transport undertaking", "stage carriage"],
  "metro": ["metro rail", "metro ridership"],
  "aviation": ["airport passenger", "domestic passenger", "aircraft movement"],
  "elections": ["election", "electors", "polling station", "voter turnout"],
  "sir": ["special intensive revision", "electoral roll", "draft roll"],
  "cinema": ["cinema", "film", "entertainment tax", "multiplex"],
};

async function search(topic: string, term: string): Promise<void> {
  const url = `${BASE}&filters[title]=${encodeURIComponent(term)}`;
  const res = await getJson<ListRes>(url, { timeoutMs: 45_000, retries: 2, cacheMs: 0 });
  if (!res.ok || !res.data) {
    found.push({ topic, term, total: 0, returned: 0, hits: [], error: res.error ?? "no data" });
    await flush();
    return;
  }
  const recs = res.data.records ?? [];
  found.push({
    topic, term,
    total: Number(res.data.total ?? 0),
    returned: recs.length,
    hits: recs.slice(0, 12).map((r) => ({
      id: r.index_name ?? "",
      title: (r.title ?? "").slice(0, 110),
      org: Array.isArray(r.org) ? r.org.join(" / ") : String(r.org ?? ""),
      updated: r.updated ? new Date(r.updated * 1000).toISOString().slice(0, 10) : null,
    })),
  });
  await flush();
  await new Promise((r) => setTimeout(r, 700));
}

async function flush(): Promise<void> {
  await mkdir(join(ROOT, "data/live"), { recursive: true });
  await writeFile(OUT, JSON.stringify({ probedAt: new Date().toISOString(), found }, null, 2) + "\n", "utf8");
}

async function main(): Promise<void> {
  // A control: an unfiltered call, so a "search" that quietly returns the whole
  // catalogue is recognisable by matching this total rather than looking plausible.
  const ctl = await getJson<ListRes>(BASE, { timeoutMs: 45_000, retries: 2, cacheMs: 0 });
  const catalogueTotal = Number(ctl.data?.total ?? 0);
  console.log(`catalogue total (unfiltered): ${catalogueTotal}`);

  for (const [topic, terms] of Object.entries(TOPICS)) {
    for (const term of terms) await search(topic, term);
  }

  // Listing a resource and READING it are different permissions. Everything
  // above is worthless if the rows need a key, so take the most on-topic id
  // found and try to pull actual records from it.
  const target = found
    .filter((f) => f.total !== catalogueTotal && f.hits.length > 0)
    .flatMap((f) => f.hits)
    .find((h) => /freight|ridership|passenger|transport undertaking/i.test(h.title));
  if (target?.id) {
    const rurl = `https://api.data.gov.in/resource/${target.id}?format=json&limit=5`;
    const rr = await getJson<{ records?: unknown[]; field?: unknown[]; message?: string; status?: string }>(
      rurl, { timeoutMs: 45_000, retries: 1, cacheMs: 0 },
    );
    resourceTest = {
      id: target.id, title: target.title, url: rurl,
      ok: rr.ok && Array.isArray(rr.data?.records),
      rows: Array.isArray(rr.data?.records) ? rr.data.records.length : 0,
      fields: Array.isArray(rr.data?.field) ? rr.data.field.length : 0,
      message: rr.data?.message ?? rr.error ?? null,
      sample: rr.data?.records ? JSON.stringify(rr.data.records[0] ?? {}).slice(0, 300) : null,
    };
    console.log(`\nresource read: ${resourceTest.ok ? "OK" : "FAILED"} — ${target.title.slice(0, 60)}`);
    console.log(`  rows=${resourceTest.rows} fields=${resourceTest.fields} ${resourceTest.message ?? ""}`);
    if (resourceTest.sample) console.log(`  ${resourceTest.sample}`);
  }

  console.log("");
  for (const f of found) {
    const suspect = f.total === catalogueTotal && f.total > 0 ? "  <- UNFILTERED, ignore" : "";
    console.log(`  ${f.topic.padEnd(14)} ${JSON.stringify(f.term).padEnd(30)} total=${String(f.total).padStart(6)} ${f.error ?? ""}${suspect}`);
    if (!suspect) for (const h of f.hits.slice(0, 3)) console.log(`      · ${h.title.slice(0, 84)}  [${h.org.slice(0, 30)}]`);
  }
  await writeFile(OUT, JSON.stringify({ probedAt: new Date().toISOString(), catalogueTotal, resourceTest, found }, null, 2) + "\n", "utf8");
}

main().catch(async (e) => { console.error(e); await flush(); process.exit(1); });
