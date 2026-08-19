/**
 * Source verification.
 *
 * Fetches every declared feed, records what actually came back, and fails if a
 * sector on the map is not carried by at least three independent working
 * portals. Three is the floor because two is a coin flip: when one desk goes
 * dark — and they do, PIB started answering 403 to bots and ThePrint started
 * serving an interstitial — a sector with two sources becomes a sector with
 * one, and nobody notices until the map has a hole in it.
 *
 * "Independent" means distinct publishers. Six Economic Times desks are one
 * newsroom's editorial judgement six times over, so they count once.
 *
 * Writes `data/live/source-health.json`. Run it in CI, not here: this sandbox's
 * network policy denies every news host, so a local run reports the sandbox,
 * not the feeds.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DECLARED_SOURCES, type FeedSource } from "../../lib/sources";
import type { EventCategory } from "../../lib/types";
import { getText } from "./lib/http";
import { parseFeed } from "./lib/feed";
import { publisherOf, namesAPublisher } from "./lib/publisher";

const ROOT = process.cwd();
const MIN_PUBLISHERS_PER_DOMAIN = 3;
const CONCURRENCY = 6;

type Status = "ok" | "empty" | "not-a-feed" | "unreachable" | "disabled";

interface Health {
  id: string;
  name: string;
  feed: string;
  kind: FeedSource["kind"];
  domains: EventCategory[];
  discovery: boolean;
  status: Status;
  items: number;
  newestItem: string | null;
  detail?: string;
}

function log(msg: string) {
  process.stdout.write(`${msg}\n`);
}

async function probe(source: FeedSource): Promise<Health> {
  const base: Omit<Health, "status" | "items" | "newestItem" | "detail"> = {
    id: source.id,
    name: source.name,
    feed: source.feed,
    kind: source.kind,
    domains: source.domains,
    discovery: source.discovery === true,
  };

  if (source.disabled) {
    return { ...base, status: "disabled", items: 0, newestItem: null, detail: source.note };
  }

  // No cache: the whole point is to see what the feed answers right now.
  const res = await getText(source.feed, {
    cacheMs: 0,
    timeoutMs: 20_000,
    retries: 1,
    accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
  });

  if (!res.ok || !res.data) {
    return { ...base, status: "unreachable", items: 0, newestItem: null, detail: res.error };
  }
  if (!/<(rss|feed|rdf:RDF)\b/i.test(res.data.slice(0, 2000))) {
    return {
      ...base,
      status: "not-a-feed",
      items: 0,
      newestItem: null,
      detail: "200 but the body is not a feed — blocked, or an interstitial",
    };
  }

  const items = parseFeed(res.data);
  if (items.length === 0) {
    return { ...base, status: "empty", items: 0, newestItem: null, detail: "parsed, no items" };
  }
  const newest = items
    .map((i) => i.publishedAt)
    .sort()
    .at(-1);
  return { ...base, status: "ok", items: items.length, newestItem: newest ?? null };
}

async function mapWithLimit<T, R>(xs: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array<R>(xs.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, xs.length) }, async () => {
      for (;;) {
        const i = next++;
        const item = xs[i];
        if (item === undefined) return;
        out[i] = await fn(item);
      }
    }),
  );
  return out;
}

async function main() {
  log(`Verifying ${DECLARED_SOURCES.length} declared feeds\n`);

  const health = await mapWithLimit(DECLARED_SOURCES, CONCURRENCY, probe);
  for (const h of health) {
    const mark = h.status === "ok" ? "ok  " : h.status === "disabled" ? "off " : "FAIL";
    log(
      `  ${mark} ${h.name.slice(0, 44).padEnd(46)} ${String(h.items).padStart(3)} items` +
        (h.detail ? `  — ${h.detail}` : ""),
    );
  }

  const working = health.filter((h) => h.status === "ok");
  const byId = new Map(DECLARED_SOURCES.map((s) => [s.id, s]));

  log("");
  log("Coverage by sector — distinct working publishers");

  const domains = [...new Set(DECLARED_SOURCES.flatMap((s) => s.domains))].sort();
  const shortfall: string[] = [];
  const coverage: Record<string, { publishers: string[]; feeds: number }> = {};

  for (const domain of domains) {
    const feeds = working.filter((h) => h.domains.includes(domain));
    const publishers = [
      ...new Set(
        feeds
          .map((h) => byId.get(h.id))
          .filter((s): s is FeedSource => s !== undefined && namesAPublisher(s))
          .map(publisherOf),
      ),
    ].sort();
    coverage[domain] = { publishers, feeds: feeds.length };
    const ok = publishers.length >= MIN_PUBLISHERS_PER_DOMAIN;
    log(
      `  ${ok ? "ok  " : "THIN"} ${domain.padEnd(16)} ${String(publishers.length).padStart(2)} publishers, ` +
        `${String(feeds.length).padStart(2)} feeds  ${publishers.slice(0, 6).join(", ")}`,
    );
    if (!ok) shortfall.push(`${domain} (${publishers.length} of ${MIN_PUBLISHERS_PER_DOMAIN})`);
  }

  const report = {
    checkedAt: new Date().toISOString(),
    declared: DECLARED_SOURCES.length,
    working: working.length,
    minPublishersPerDomain: MIN_PUBLISHERS_PER_DOMAIN,
    coverage,
    feeds: health,
  };
  await mkdir(join(ROOT, "data/live"), { recursive: true });
  await writeFile(
    join(ROOT, "data/live/source-health.json"),
    JSON.stringify(report, null, 2) + "\n",
    "utf8",
  );

  log("");
  log(
    `${working.length}/${DECLARED_SOURCES.length} feeds answered with items · ` +
      `wrote data/live/source-health.json`,
  );

  if (shortfall.length > 0) {
    log("");
    log(`UNDER-COVERED SECTORS: ${shortfall.join(", ")}`);
    log("Add working feeds for these in lib/sources.ts, or add sector phrases to SECTOR_KEYWORDS.");
    process.exit(1);
  }
  log("Every sector has at least three independent working publishers.");
}

main().catch((err: unknown) => {
  process.stderr.write(`verify-sources crashed: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
