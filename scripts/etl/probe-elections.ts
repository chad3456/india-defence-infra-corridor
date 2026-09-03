/**
 * Where can statewise Indian voting patterns actually be read from?
 *
 * The question has three plausible answers and no way to choose between them
 * from a sandbox that cannot reach any of them, so this measures rather than
 * assumes:
 *
 *   1. The Election Commission's own results and statistical reports. The
 *      authoritative source, and the one whose numbers everything else copies.
 *   2. Lok Dhaba, the Trivedi Centre for Political Data's compilation at
 *      Ashoka University — constituency-level results back to 1962, already
 *      cleaned, which is exactly the work this project would otherwise repeat.
 *   3. Wikipedia's per-election result tables, which mirror the ECI numbers
 *      and are reachable by an API this project already parses.
 *
 * A source is only useful here if it yields a *state* and a *number* together.
 * So the test is not "did the page load" — it is whether the bytes contain a
 * table whose header names a state column alongside turnout, electors or vote
 * share. A 200 that returns a JavaScript shell is a failure for this purpose
 * and is recorded as one, because that is the mistake that cost a round on
 * ixigo: a page that opens in a browser is not a page that answers a fetch.
 *
 * Publishes nothing. The point is to learn which door is open before building
 * a connector behind it.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "./lib/http";
import { parseTables, columnIndex } from "./lib/wikitext";
import { isEntryPoint } from "./lib/entry";

const ROOT = process.cwd();
const OUT = join(ROOT, "data/live/elections-probe.json");

/** A header that names a state, next to one that names something countable. */
const STATE_RE = /^(state|state\/ut|state\s*\/\s*union|states? and union)/i;
const COUNT_RE = /(turnout|elector|voter|polled|votes|seats|% ?votes|vote ?share|contested)/i;

interface Probe {
  group: string;
  what: string;
  url: string;
  ok: boolean;
  status: string;
  bytes?: number;
  /** The test that matters: a table pairing a state with a countable column. */
  statewiseTables?: number;
  headersSeen?: string[][];
  /** A body that is mostly script is a shell, not data. */
  looksLikeShell?: boolean;
  note?: string;
}
const probes: Probe[] = [];

async function flush(): Promise<void> {
  await mkdir(join(ROOT, "data/live"), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify({ probedAt: new Date().toISOString(), probes }, null, 2) + "\n",
    "utf8",
  );
}

/** Rough shell detector: lots of <script>, very little prose. */
function shellScore(html: string): boolean {
  const scripts = (html.match(/<script/gi) ?? []).length;
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ");
  return scripts > 3 && text.replace(/\s+/g, " ").trim().length < 1500;
}

/** HTML tables whose header pairs a state with something countable. */
function statewiseHtmlTables(html: string): { count: number; headers: string[][] } {
  const headers: string[][] = [];
  let count = 0;
  for (const m of html.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const hs = [...m[0].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)]
      .map((h) => h[1]!.replace(/<[^>]+>/g, " ").replace(/&\w+;/g, " ").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (hs.length === 0) continue;
    if (hs.some((h) => STATE_RE.test(h)) && hs.some((h) => COUNT_RE.test(h))) {
      count++;
      if (headers.length < 4) headers.push(hs.slice(0, 12));
    }
  }
  return { count, headers };
}

async function probe(group: string, what: string, url: string, kind: "html" | "wikitext" | "any"): Promise<void> {
  const res = await getText(url, { timeoutMs: 45_000, retries: 1, cacheMs: 0 });
  if (!res.ok || res.data === null) {
    probes.push({ group, what, url, ok: false, status: res.error ?? "no body" });
    await flush();
    return;
  }
  const body = res.data;
  const p: Probe = { group, what, url, ok: true, status: "200", bytes: body.length };

  if (kind === "wikitext") {
    const tables = parseTables(body).filter(
      (t) => columnIndex(t.headers, STATE_RE) >= 0 && columnIndex(t.headers, COUNT_RE) >= 0,
    );
    p.statewiseTables = tables.length;
    p.headersSeen = tables.slice(0, 4).map((t) => t.headers.slice(0, 12));
  } else {
    const { count, headers } = statewiseHtmlTables(body);
    p.statewiseTables = count;
    p.headersSeen = headers;
    p.looksLikeShell = shellScore(body);
    if (p.looksLikeShell) p.note = "body is mostly script — opens in a browser, does not answer a fetch";
  }
  probes.push(p);
  await flush();
  await new Promise((r) => setTimeout(r, 800));
}

export async function run(opts: { onProgress?: (s: string) => void } = {}): Promise<{ errors: string[] }> {
  const log = opts.onProgress ?? (() => {});

  // 1. Wikipedia — proven reachable by the Vande connector, and its election
  //    tables copy the ECI numbers. Raw wikitext, which parseTables reads.
  const WIKI = "https://en.wikipedia.org/w/index.php?action=raw&title=";
  for (const t of [
    "2024 Indian general election",
    "2019 Indian general election",
    "2014 Indian general election",
    "Results of the 2024 Indian general election",
    "List of Indian general elections",
    "Voter turnout in India",
  ]) {
    await probe("wikipedia", t, WIKI + encodeURIComponent(t), "wikitext");
  }

  // 2. Lok Dhaba / TCPD — cleaned constituency results, the compilation this
  //    project would otherwise rebuild by hand.
  await probe("lokdhaba", "app shell", "https://lokdhaba.ashoka.edu.in/", "html");
  await probe("lokdhaba", "TCPD data page", "https://tcpd.ashoka.edu.in/lok-dhaba/", "html");

  // 3. The Election Commission itself.
  await probe("eci", "results portal", "https://results.eci.gov.in/", "html");
  await probe("eci", "statistical reports index", "https://www.eci.gov.in/statistical-reports", "html");
  await probe("eci", "main site", "https://www.eci.gov.in/", "html");

  const usable = probes.filter((p) => p.ok && (p.statewiseTables ?? 0) > 0);
  log(`reachable: ${probes.filter((p) => p.ok).length}/${probes.length}`);
  log(`carrying a statewise table: ${usable.length}`);
  for (const p of usable) log(`  ${p.group}/${p.what}: ${p.statewiseTables} table(s)`);
  for (const p of probes.filter((x) => x.ok && !(x.statewiseTables ?? 0) && x.looksLikeShell)) {
    log(`  shell (no data in the bytes): ${p.group}/${p.what}`);
  }
  for (const p of probes.filter((x) => !x.ok)) log(`  unreachable: ${p.group}/${p.what}: ${p.status}`);

  return { errors: [] };
}

if (isEntryPoint(import.meta.url)) {
  run({ onProgress: (s) => console.log(s) }).then(() => console.log(`\nwrote ${OUT}`));
}
