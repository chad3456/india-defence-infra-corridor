/**
 * The live coverage wire for /protests/delhi-2026-10-10.
 *
 * `npm run protest:news`. Writes data/protests/delhi-2026-10-10-news.json.
 * CI only: the editing sandbox cannot reach the news index.
 *
 * Asks Google News's keyless RSS search a handful of questions about the
 * protest, keeps the headlines that name it, and adds them to the running
 * register — so the wire accumulates across runs instead of showing only the
 * day or so a search feed carries.
 *
 * ── What an item is, and is not ──────────────────────────────────────────
 *
 * It is evidence that an outlet published a headline at a time. It is not a
 * verified fact, it never becomes a number on the page, and the count of items
 * is a count of what the index returned for these queries, not a measure of
 * how much was written. Each item keeps its own publisher, read from the feed's
 * <source> element, so nothing is attributed to the aggregator.
 *
 * Queries are asked separately and their yields are published, so a reader can
 * see that the wire leans towards whatever the index ranks for each phrasing.
 *
 * Connectors never throw: a failed query is recorded and the previous register
 * is kept. Only a run in which every query fails exits non-zero.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "../lib/http";
import { parseFeed, stripOutletSuffix } from "../lib/feed";
import { isEntryPoint } from "../lib/entry";
import type { ProtestWire, WireItem } from "../../../lib/protest-shared";

const OUT = join(process.cwd(), "data", "protests", "delhi-2026-10-10-news.json");
const GAP_MS = 3000;
/** The campaign began with the demand of 25 September; older items are another story. */
const SINCE = Date.parse("2026-09-25T00:00:00Z");
const KEEP = 400;

export const QUERIES = [
  "Cockroach Janta Party Delhi protest",
  "Delhi Police Jantar Mantar detained",
  "Cockroach Janta Party Gyanesh Kumar",
  "Delhi internet shutdown Jantar Mantar",
  "CJP protest Delhi police",
  "Abhijeet Dipke detained",
];

/** A headline belongs on the wire only if it names the protest, its place or its target. */
export function isAboutProtest(title: string): boolean {
  return /cockroach|\bCJP\b|jantar mantar|gyanesh kumar|abhijeet dipke/i.test(title);
}

const GOOGLE = (q: string) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`;

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** Add fresh items to the register, one item per headline, newest first. */
export function mergeWire(previous: WireItem[], fresh: WireItem[]): WireItem[] {
  const byKey = new Map<string, WireItem>();
  for (const it of [...previous, ...fresh]) {
    const k = `${norm(it.publisher)}|${norm(it.title)}`;
    const had = byKey.get(k);
    if (!had) { byKey.set(k, { ...it, queries: [...it.queries] }); continue; }
    had.queries = [...new Set([...had.queries, ...it.queries])];
    if (it.publishedAt < had.publishedAt) had.publishedAt = it.publishedAt;
  }
  return [...byKey.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, KEEP);
}

export async function run(): Promise<void> {
  const previous: ProtestWire | null = existsSync(OUT) ? JSON.parse(await readFile(OUT, "utf8")) as ProtestWire : null;
  const fresh: WireItem[] = [];
  const queries: ProtestWire["queries"] = [];
  let answered = 0;

  for (const q of QUERIES) {
    const res = await getText(GOOGLE(q), { timeoutMs: 30_000, retries: 2, cacheMs: 0 });
    await new Promise((r) => setTimeout(r, GAP_MS));
    if (!res.ok || !res.data) { queries.push({ q, returned: 0, kept: 0, error: res.error ?? "no data" }); continue; }
    answered++;
    const rows = parseFeed(res.data);
    let kept = 0;
    for (const r of rows) {
      const publisher = (r.publisher ?? "").trim();
      const when = Date.parse(r.publishedAt);
      if (!publisher || !Number.isFinite(when) || when < SINCE) continue;
      const title = stripOutletSuffix(r.title, publisher);
      if (!isAboutProtest(title)) continue;
      fresh.push({ title, publisher, url: r.url, publishedAt: new Date(when).toISOString(), queries: [q] });
      kept++;
    }
    queries.push({ q, returned: rows.length, kept });
    console.log(`  ${q}: ${rows.length} returned, ${kept} kept`);
  }

  if (answered === 0) {
    console.error("no query answered; keeping the previous register");
    process.exit(previous ? 0 : 1);
  }

  const items = mergeWire(previous?.items ?? [], fresh);
  const out: ProtestWire = {
    updatedAt: new Date().toISOString(),
    source: "Google News RSS search (keyless), https://news.google.com",
    queries,
    items,
  };
  // Write only when the register changed, so a quiet half hour costs no commit.
  if (previous && JSON.stringify(previous.items) === JSON.stringify(items)) {
    console.log(`no new headlines (${items.length} on the wire)`);
    return;
  }
  await mkdir(join(process.cwd(), "data", "protests"), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 1) + "\n", "utf8");
  console.log(`wrote ${OUT}: ${items.length} headlines, ${fresh.length} seen this run`);
}

if (isEntryPoint(import.meta.url)) {
  run().catch((e) => { console.error(e); process.exit(1); });
}
