/**
 * Can ixigo supply a route, station by station?
 *
 * The URL shape is `/trains/<number>`, which makes the train number the key --
 * and the train number is the one identifier the whole Vande Bharat fleet is
 * indexed by. If those pages carry the intermediate stations, then every
 * service can be drawn along the stations it actually calls at instead of as a
 * straight line between its endpoints, which is the difference between a route
 * map and a schematic.
 *
 * What this establishes, in order:
 *   1. does the page render server-side, or is it a shell like every other
 *      train-tracking site probed so far
 *   2. does it contain intermediate stations, not just origin and destination
 *   3. is there embedded JSON (Next.js and friends inline their props), which
 *      parses far more reliably than scraped HTML
 *   4. is there a JSON endpoint behind it, which would be better than either
 *   5. does an invalid number fail loudly, so a bad id cannot silently produce
 *      a plausible-looking empty route
 *
 * Publishes nothing.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "./lib/http";

const ROOT = process.cwd();
const OUT = join(ROOT, "data/live/ixigo-probe.json");

const BROWSER = {
  "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-IN,en;q=0.9",
};

interface Check {
  id: string; url: string; status: "ok" | "failed";
  httpError?: string; bytes?: number;
  /** Signals that the route is really in the payload. */
  signals?: Record<string, number>;
  /** Embedded JSON blobs found, by the script id that carried them. */
  jsonBlobs?: Array<{ where: string; bytes: number; keys: string[] }>;
  /** Station-looking names, deduped — the thing we actually need. */
  stationGuess?: string[];
  sample?: string;
}
const checks: Check[] = [];

/** Words that only appear when a schedule is really present. */
function signalsOf(b: string): Record<string, number> {
  const terms = [
    "arrival", "departure", "halt", "platform", "distance", "runs on",
    "intermediate", "stoppage", "schedule", "vande bharat", "__NEXT_DATA__",
    "application/ld+json", "stationCode", "stationName", "dayCount",
  ];
  const out: Record<string, number> = {};
  const low = b.toLowerCase();
  for (const t of terms) {
    const n = low.split(t.toLowerCase()).length - 1;
    if (n > 0) out[t] = n;
  }
  return out;
}

/** Pull inline JSON out of script tags and report its top-level shape. */
function jsonBlobs(b: string): Array<{ where: string; bytes: number; keys: string[] }> {
  const out: Array<{ where: string; bytes: number; keys: string[] }> = [];
  const re = /<script[^>]*?(?:id="([^"]+)"|type="([^"]+)")[^>]*>([\s\S]{40,}?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(b)) !== null) {
    const where = m[1] ?? m[2] ?? "script";
    const body = (m[3] ?? "").trim();
    if (!body.startsWith("{") && !body.startsWith("[")) continue;
    try {
      const parsed = JSON.parse(body) as unknown;
      const keys = parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? Object.keys(parsed as Record<string, unknown>).slice(0, 14)
        : ["<array>"];
      out.push({ where, bytes: body.length, keys });
    } catch {
      out.push({ where: `${where} (unparsed)`, bytes: body.length, keys: [] });
    }
    if (out.length >= 6) break;
  }
  return out;
}

/** Station names look like "Xxx Yyy (ABC)" or carry a code in a JSON field. */
function stationGuess(b: string): string[] {
  const found = new Set<string>();
  for (const m of b.matchAll(/"stationName"\s*:\s*"([^"]{3,60})"/g)) found.add(m[1]!);
  for (const m of b.matchAll(/"stnName"\s*:\s*"([^"]{3,60})"/g)) found.add(m[1]!);
  for (const m of b.matchAll(/\b([A-Z][A-Za-z.'\- ]{3,38})\s\(([A-Z]{2,5})\)/g)) {
    found.add(`${m[1]!.trim()} (${m[2]})`);
  }
  return [...found].slice(0, 40);
}

async function probe(id: string, url: string): Promise<void> {
  const res = await getText(url, { timeoutMs: 45_000, retries: 1, cacheMs: 0, headers: BROWSER });
  if (!res.ok || res.data === null) {
    checks.push({ id, url, status: "failed", httpError: res.error });
  } else {
    const b = res.data;
    checks.push({
      id, url, status: "ok", bytes: b.length,
      signals: signalsOf(b), jsonBlobs: jsonBlobs(b), stationGuess: stationGuess(b),
      sample: b.replace(/\s+/g, " ").slice(0, 200),
    });
  }
  await flush();
  await new Promise((r) => setTimeout(r, 1500));  // a courtesy gap, not a crawl
}

async function flush(): Promise<void> {
  await mkdir(join(ROOT, "data/live"), { recursive: true });
  await writeFile(OUT, JSON.stringify({ probedAt: new Date().toISOString(), checks }, null, 2) + "\n", "utf8");
}

async function main(): Promise<void> {
  // Three real Vande Bharat numbers and one deliberate nonsense id. The last
  // one matters most: if a bad number returns a 200 with an empty route, then
  // every fetch has to be validated rather than trusted.
  await probe("ixigo-22227", "https://www.ixigo.com/trains/22227");
  await probe("ixigo-22435", "https://www.ixigo.com/trains/22435");
  await probe("ixigo-20901", "https://www.ixigo.com/trains/20901");
  await probe("ixigo-bogus", "https://www.ixigo.com/trains/99999");

  // Is there a JSON route behind the page? Cheaper and steadier than HTML.
  await probe("ixigo-api-1", "https://www.ixigo.com/api/trains/22227");
  await probe("ixigo-search", "https://www.ixigo.com/trains/vande-bharat-express");

  console.log("");
  for (const c of checks) {
    console.log(`  ${c.status === "ok" ? "ok  " : "FAIL"} ${c.id.padEnd(14)} ${String(c.bytes ?? "").padStart(8)}b  ${c.httpError ?? ""}`);
    if (c.signals && Object.keys(c.signals).length) {
      console.log(`      signals: ${JSON.stringify(c.signals).slice(0, 200)}`);
    }
    for (const j of c.jsonBlobs ?? []) {
      console.log(`      json[${j.where}] ${j.bytes}b keys=${j.keys.join(",").slice(0, 110)}`);
    }
    if (c.stationGuess?.length) {
      console.log(`      stations(${c.stationGuess.length}): ${c.stationGuess.slice(0, 8).join(" | ").slice(0, 150)}`);
    }
  }
}

main().catch(async (e) => { console.error(e); await flush(); process.exit(1); });
