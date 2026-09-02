/**
 * Every Vande Bharat service, from its own article.
 *
 * There is no single table. The probe measured that: the obvious list title is
 * a 404, the main article carries 174 mentions and zero train numbers, and the
 * page with the most numbers turned out to be a different train class
 * entirely. What exists instead is one article per route -- "Mumbai
 * CSMT-Solapur Vande Bharat Express" and about a hundred and sixty siblings --
 * each carrying an {{Infobox rail service}} with the facts a row needs.
 *
 * So the unit of work is an article, and the enumeration has to be exhaustive
 * rather than a top-N search: a service missing from this list is a line
 * missing from the map, and the map would not look incomplete.
 *
 * ── What this deliberately does not do ───────────────────────────────────
 *
 * It does not claim live running status. Five train-tracking sites were probed
 * and all five are JavaScript shells over private APIs; ixigo returns 403 to a
 * datacenter IP on every train page. `status` here is what the article says,
 * with the date it was read, and the page says so rather than implying a feed.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getJson, getText } from "../lib/http";
import { parseInfobox, firstNumber } from "../lib/wikitext";

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, "data/mobility");
const API = "https://en.wikipedia.org/w/api.php";
const RAW = "https://en.wikipedia.org/w/index.php?action=raw&title=";

export interface VandeService {
  /** Article title — the citable identity. */
  title: string;
  name: string;
  /** Train numbers as printed, e.g. ["22225","22226"]. */
  trainNumbers: string[];
  from: string | null;
  to: string | null;
  /** Station codes, where the article prints them. The most reliable join key. */
  fromCode: string | null;
  toCode: string | null;
  /** Route km as stated in the infobox. */
  distanceKm: number | null;
  stops: number | null;
  frequency: string | null;
  /** Operating / Suspended / etc, verbatim from the article. */
  status: string | null;
  operator: string | null;
  firstService: string | null;
  avgSpeedKmh: number | null;
  journeyTime: string | null;
}

/** Titles that name a route article rather than an overview or a list. */
const ROUTE_TITLE = /vande\s*bharat/i;
const NOT_A_ROUTE = /^(list of|vande bharat express$|vande bharat sleeper|vande bharat metro|vande bharat \(|category:)/i;

async function enumerateTitles(log: (s: string) => void): Promise<string[]> {
  const titles = new Set<string>();

  // `intitle:` is the exhaustive route: it matches on the title rather than on
  // relevance, so paging it reaches the tail instead of the top hits.
  let offset = 0;
  for (let page = 0; page < 12; page++) {
    const url =
      `${API}?action=query&list=search&format=json&srlimit=50&sroffset=${offset}` +
      `&srsearch=${encodeURIComponent('intitle:"Vande Bharat"')}`;
    const res = await getJson<{
      query?: { search?: Array<{ title: string }> };
      continue?: { sroffset?: number };
    }>(url, { timeoutMs: 45_000, retries: 2, cacheMs: 0 });
    if (!res.ok || !res.data) break;
    const hits = res.data.query?.search ?? [];
    for (const h of hits) titles.add(h.title);
    const next = res.data.continue?.sroffset;
    if (typeof next !== "number" || hits.length === 0) break;
    offset = next;
    await new Promise((r) => setTimeout(r, 400));
  }
  log(`  search found ${titles.size} title(s) matching intitle:"Vande Bharat"`);

  // Category membership as a second net, because a page can be categorised
  // without the phrase sitting in its title.
  for (const cat of [
    "Category:Vande Bharat Express",
    "Category:Vande Bharat Express trains",
    "Category:Named passenger trains of India",
  ]) {
    const url = `${API}?action=query&format=json&list=categorymembers&cmlimit=500&cmtitle=${encodeURIComponent(cat)}`;
    const res = await getJson<{ query?: { categorymembers?: Array<{ title: string }> } }>(
      url, { timeoutMs: 45_000, retries: 1, cacheMs: 0 },
    );
    const members = res.data?.query?.categorymembers ?? [];
    let added = 0;
    for (const m of members) {
      if (ROUTE_TITLE.test(m.title) && !titles.has(m.title)) { titles.add(m.title); added++; }
    }
    if (members.length) log(`  ${cat}: ${members.length} member(s), ${added} new`);
    await new Promise((r) => setTimeout(r, 400));
  }

  return [...titles]
    .filter((t) => ROUTE_TITLE.test(t) && !NOT_A_ROUTE.test(t))
    .sort();
}

function trainNumbersOf(raw: string): string[] {
  const m = raw.match(/\b(?:1\d{4}|2\d{4})\b/g) ?? [];
  return [...new Set(m)];
}

export async function run(opts: { onProgress?: (s: string) => void } = {}): Promise<{ errors: string[] }> {
  const log = opts.onProgress ?? (() => {});
  const errors: string[] = [];
  await mkdir(OUT_DIR, { recursive: true });

  const titles = await enumerateTitles(log);
  log(`route articles to read: ${titles.length}`);
  if (titles.length === 0) {
    errors.push("vande: enumeration returned no route articles");
    return { errors };
  }

  const services: VandeService[] = [];
  let noInfobox = 0;
  for (const title of titles) {
    const res = await getText(RAW + encodeURIComponent(title), {
      timeoutMs: 45_000, retries: 1, cacheMs: 24 * 3600_000,
    });
    await new Promise((r) => setTimeout(r, 350));   // courteous to a free API
    if (!res.ok || res.data === null) {
      errors.push(`vande: ${title}: ${res.error ?? "no body"}`);
      continue;
    }
    const wt = res.data;
    const ib = parseInfobox(wt, /Infobox[ _]rail[ _]service/i);
    if (!ib) {
      // No infobox means no structured facts. Counted, not guessed at from
      // prose -- a route invented out of a sentence is exactly the failure this
      // project keeps guarding against.
      noInfobox++;
      continue;
    }
    const nums = trainNumbersOf(ib["trainnumber"] ?? ib["trainno"] ?? ib["number"] ?? "");
    // Articles print "Agra Cantonment (AGC)". The code is the surer join key
    // than the name, so it is kept apart rather than left inside the string.
    const splitStation = (v: string | undefined): { name: string | null; code: string | null } => {
      if (!v) return { name: null, code: null };
      const m = /\(([A-Z]{2,6})\)?\s*$/.exec(v.trim());
      const code = m?.[1] ?? null;
      const name = v.replace(/\(([A-Z]{2,6})\)?\s*$/, "").trim() || null;
      return { name, code };
    };
    const a = splitStation(ib["start"]);
    const b = splitStation(ib["end"]);
    services.push({
      title,
      name: ib["name"] || title,
      trainNumbers: nums,
      from: a.name,
      to: b.name,
      fromCode: a.code,
      toCode: b.code,
      distanceKm: firstNumber(ib["distance"] ?? ""),
      stops: firstNumber(ib["stops"] ?? ""),
      frequency: ib["frequency"] || null,
      status: ib["status"] || null,
      operator: ib["operator"] || null,
      firstService: ib["first"] || null,
      avgSpeedKmh: firstNumber(ib["speed"] ?? ""),
      journeyTime: ib["journeytime"] || null,
    });
  }

  services.sort((a, b) => a.name.localeCompare(b.name));
  await writeFile(
    join(OUT_DIR, "vande-services.json"),
    JSON.stringify({ builtAt: new Date().toISOString(), source: "en.wikipedia.org route articles", services }),
    "utf8",
  );

  const withNums = services.filter((s) => s.trainNumbers.length > 0).length;
  const withDist = services.filter((s) => s.distanceKm !== null).length;
  log(`services written: ${services.length} (${withNums} with train numbers, ${withDist} with distance)`);
  log(`articles with no rail-service infobox: ${noInfobox}`);
  if (services.length < 40) {
    errors.push(`vande: only ${services.length} services parsed — the fleet is around 160, so this is a partial read`);
  }
  return { errors };
}
