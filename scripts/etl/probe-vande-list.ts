/**
 * Which Wikipedia page actually carries the Vande Bharat route table?
 *
 * Guessing titles has cost two rounds: "List of Vande Bharat Express routes"
 * is a 404 and the main article has no train numbers in it. So this stops
 * guessing and measures instead — search, fetch each candidate's raw wikitext,
 * and count how many distinct Vande Bharat train numbers each one contains.
 * The page with about a hundred and sixty is the list; everything else is prose
 * that mentions the trains.
 *
 * Train numbers are the test rather than word counts because the number is the
 * identity of a service. A page that discusses Vande Bharat at length without
 * numbering the trains cannot be turned into rows, however relevant it reads.
 *
 * Publishes nothing.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText, getJson } from "./lib/http";
import { parseTables, columnIndex } from "./lib/wikitext";

const ROOT = process.cwd();
const OUT = join(ROOT, "data/live/vande-list-probe.json");
const WIKI = "https://en.wikipedia.org/w/index.php?action=raw&title=";

/** Vande Bharat services are numbered in these ranges. */
const TRAIN_RE = /\b(20\d{3}|22\d{3}|26\d{3})\b/g;

interface Candidate {
  title: string;
  via: string;
  ok: boolean;
  bytes?: number;
  distinctTrainNumbers?: number;
  tables?: Array<{ i: number; rows: number; headers: string[]; hasTrainCol: boolean; sampleRow: string[] }>;
  error?: string;
}
const candidates: Candidate[] = [];

async function examine(title: string, via: string): Promise<void> {
  const res = await getText(WIKI + encodeURIComponent(title), {
    timeoutMs: 45_000, retries: 1, cacheMs: 0,
  });
  if (!res.ok || res.data === null) {
    candidates.push({ title, via, ok: false, error: res.error });
    await flush();
    return;
  }
  const wt = res.data;
  const nums = new Set(wt.match(TRAIN_RE) ?? []);
  const tables = parseTables(wt).map((t, i) => ({
    i,
    rows: t.rows.length,
    headers: t.headers.slice(0, 14),
    // A route table is one whose header names the train number column.
    hasTrainCol: columnIndex(t.headers, /train\s*(no|number|#)/i) >= 0,
    sampleRow: (t.rows[0] ?? []).slice(0, 10),
  })).filter((t) => t.rows > 3);

  candidates.push({
    title, via, ok: true, bytes: wt.length,
    distinctTrainNumbers: nums.size, tables,
  });
  await flush();
  await new Promise((r) => setTimeout(r, 600));
}

async function flush(): Promise<void> {
  await mkdir(join(ROOT, "data/live"), { recursive: true });
  await writeFile(OUT, JSON.stringify({ probedAt: new Date().toISOString(), candidates }, null, 2) + "\n", "utf8");
}

async function main(): Promise<void> {
  // Titles worth trying directly: cheap, and one of them is probably it.
  const guesses = [
    "List of Vande Bharat Express trains",
    "List of Vande Bharat Express routes",
    "Vande Bharat Express",
    "Vande Bharat sleeper",
    "List of Vande Bharat Express services",
  ];
  for (const g of guesses) await examine(g, "guess");

  // And whatever search thinks is relevant, so the answer does not depend on
  // my guessing the title.
  const s = await getJson<{ query?: { search?: Array<{ title: string }> } }>(
    "https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=25&srsearch=" +
    encodeURIComponent("Vande Bharat Express"),
    { timeoutMs: 45_000, retries: 2, cacheMs: 0 },
  );
  const seen = new Set(candidates.map((c) => c.title));
  for (const r of s.data?.query?.search ?? []) {
    if (seen.has(r.title)) continue;
    seen.add(r.title);
    await examine(r.title, "search");
  }

  candidates.sort((a, b) => (b.distinctTrainNumbers ?? 0) - (a.distinctTrainNumbers ?? 0));
  console.log("\npages by distinct Vande Bharat train numbers found:\n");
  for (const c of candidates.slice(0, 14)) {
    console.log(
      `  ${String(c.distinctTrainNumbers ?? 0).padStart(4)}  ${c.ok ? "ok  " : "FAIL"} ` +
      `${c.title.slice(0, 54).padEnd(56)} ${c.error ?? ""}`,
    );
    for (const t of (c.tables ?? []).filter((t) => t.hasTrainCol || t.rows > 20)) {
      console.log(`         table[${t.i}] rows=${t.rows} trainCol=${t.hasTrainCol}`);
      console.log(`           headers: ${t.headers.join(" | ").slice(0, 130)}`);
      console.log(`           row0   : ${t.sampleRow.join(" | ").slice(0, 130)}`);
    }
  }
}

main().catch(async (e) => { console.error(e); await flush(); process.exit(1); });
