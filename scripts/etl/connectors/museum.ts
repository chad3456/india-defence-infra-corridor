/**
 * The virtual museum of Indian painting: what hangs, and on what authority.
 *
 * `npm run museum:ingest`. Writes data/art/museum.json. Runs in GitHub
 * Actions: the editing sandbox cannot reach Wikidata or Wikimedia Commons.
 *
 * For each room in lib/museum-shared.ts:
 *   1. The artists' and schools' Wikidata items are resolved from their
 *      English Wikipedia titles.
 *   2. Wikidata is asked for paintings by those artists (P170) or of those
 *      schools (P135) that carry an image (P18), with title, date, medium and
 *      collection, ordered by how many Wikipedias have an article on them.
 *   3. Commons is asked about every image: its real URL, a ~1000 px
 *      rendition, its size and — the point of the step — its licence as
 *      Commons records it. A work whose licence is not public domain or a
 *      Creative Commons licence that allows reuse is refused and counted,
 *      never hung. Copyright is decided per file, not assumed per artist.
 *
 * Nothing is downloaded. The page shows the Commons rendition with its
 * licence and credit beside it and a link to the file page.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "../lib/http";
import { isEntryPoint } from "../lib/entry";
import { ROOMS, NOT_YET, FREE_LICENSE, freeYear, type Museum, type NotYet, type RoomData, type Work } from "../../../lib/museum-shared";

const ROOT = process.cwd();
const OUT = join(ROOT, "data", "art", "museum.json");
const WDQS = "https://query.wikidata.org/sparql";
const WP = "https://en.wikipedia.org/w/api.php";
const COMMONS = "https://commons.wikimedia.org/w/api.php";
const PER_ROOM = 24;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const errors: string[] = [];

async function json<T>(url: string, label: string, accept = "application/json"): Promise<T | null> {
  await sleep(250);
  const res = await getText(url, { timeoutMs: 90_000, retries: 3, cacheMs: 6 * 3600_000, accept });
  if (!res.ok || !res.data) { errors.push(`${label}: ${res.error ?? "failed"}`); return null; }
  try { return JSON.parse(res.data) as T; } catch { errors.push(`${label}: not JSON`); return null; }
}

/** English Wikipedia titles to Wikidata ids, following redirects. */
async function qids(titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const q = new URLSearchParams({ action: "query", prop: "pageprops", ppprop: "wikibase_item", redirects: "1", titles: batch.join("|"), format: "json", formatversion: "2" });
    const j = await json<{ query?: { normalized?: Array<{ from: string; to: string }>; redirects?: Array<{ from: string; to: string }>; pages?: Array<{ title: string; pageprops?: { wikibase_item?: string } }> } }>(`${WP}?${q}`, "titles");
    const hop = new Map<string, string>();
    for (const n of j?.query?.normalized ?? []) hop.set(n.from, n.to);
    for (const r of j?.query?.redirects ?? []) hop.set(r.from, r.to);
    const by = new Map((j?.query?.pages ?? []).map((p) => [p.title, p.pageprops?.wikibase_item]));
    for (const t of batch) {
      let cur = t;
      for (let k = 0; k < 3 && hop.has(cur); k++) cur = hop.get(cur)!;
      const id = by.get(cur);
      if (id) out.set(t, id); else errors.push(`no Wikidata item for "${t}"`);
    }
  }
  return out;
}

interface Binding { [k: string]: { value: string } | undefined }
async function sparql(query: string, label: string): Promise<Binding[]> {
  const j = await json<{ results?: { bindings?: Binding[] } }>(`${WDQS}?format=json&query=${encodeURIComponent(query)}`, label, "application/sparql-results+json");
  return j?.results?.bindings ?? [];
}

const id = (v?: { value: string }) => v?.value.replace(/^https?:\/\/www\.wikidata\.org\/entity\//, "") ?? "";

/** Candidate works for one room, best-linked first, one row per work. */
type Candidate = Omit<Work, "image"> & { file: string };

async function candidates(predicate: "P170" | "P135", target: string, label: string): Promise<Candidate[]> {
  const rows = await sparql(`
SELECT ?p ?pLabel ?img ?inception ?collLabel ?creatorLabel ?materialLabel ?links WHERE {
  ?p wdt:${predicate} wd:${target} ; wdt:P18 ?img ; wikibase:sitelinks ?links .
  OPTIONAL { ?p wdt:P571 ?inception . }
  OPTIONAL { ?p wdt:P195 ?coll . }
  OPTIONAL { ?p wdt:P170 ?creator . }
  OPTIONAL { ?p wdt:P186 ?material . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?links)
LIMIT 300`, label);
  const out = new Map<string, Candidate>();
  for (const r of rows) {
    const q = id(r["p"]);
    if (!q || out.has(q)) continue; // OPTIONALs multiply rows; the first is kept
    const title = r["pLabel"]?.value ?? "";
    if (!title || /^Q\d+$/.test(title)) continue; // no English title: cannot be labelled
    const file = decodeURIComponent((r["img"]?.value ?? "").split("/Special:FilePath/")[1] ?? "").replace(/_/g, " ");
    if (!file) continue;
    const inc = r["inception"]?.value ?? null;
    const creator = r["creatorLabel"]?.value ?? null;
    out.set(q, {
      qid: q, source: "wikidata", title,
      artist: creator && !/^Q\d+$/.test(creator) && !/^(anonymous|unknown)/i.test(creator) ? creator : null,
      // Wikidata stores a year as 1st January of it; only the year is claimed.
      year: inc && /^-?\d{4}/.test(inc) ? inc.slice(0, 4).replace(/^0+/, "") : null,
      medium: r["materialLabel"]?.value && !/^Q\d+$/.test(r["materialLabel"]!.value) ? r["materialLabel"]!.value : null,
      collection: r["collLabel"]?.value && !/^Q\d+$/.test(r["collLabel"]!.value) ? r["collLabel"]!.value : null,
      sitelinks: Number(r["links"]?.value ?? 0),
      file,
    });
  }
  return [...out.values()];
}

/** Commons' description of a file, for works known only from Commons. */
interface FileMeta { title: string | null; artist: string | null; date: string | null; credit: string | null }

interface ImageInfo {
  title: string;
  imageinfo?: Array<{
    url: string; thumburl?: string; thumbwidth?: number; thumbheight?: number; descriptionurl: string;
    width: number; height: number;
    extmetadata?: Record<string, { value?: string } | undefined>;
  }>;
}

const strip = (html?: string) => (html ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** Commons' own record of each file: URL, rendition, size and licence. */
const meta = new Map<string, FileMeta>();

async function images(files: string[]): Promise<Map<string, Work["image"] | "refused">> {
  const out = new Map<string, Work["image"] | "refused">();
  for (let i = 0; i < files.length; i += 40) {
    const batch = files.slice(i, i + 40);
    const q = new URLSearchParams({
      action: "query", prop: "imageinfo", iiprop: "url|size|extmetadata", iiurlwidth: "1000", uselang: "en",
      titles: batch.map((f) => `File:${f}`).join("|"), format: "json", formatversion: "2",
    });
    const j = await json<{ query?: { normalized?: Array<{ from: string; to: string }>; pages?: ImageInfo[] } }>(`${COMMONS}?${q}`, "commons");
    const norm = new Map((j?.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const p of j?.query?.pages ?? []) {
      const info = p.imageinfo?.[0];
      const asked = (norm.get(p.title) ?? p.title).replace(/^File:/, "");
      if (!info) continue;
      const m = info.extmetadata ?? {};
      const license = strip(m["LicenseShortName"]?.value);
      if (!FREE_LICENSE.test(license)) { out.set(asked, "refused"); continue; }
      const thumb = info.thumburl ?? info.url;
      // Only Wikimedia's own image server: a page must never hotlink elsewhere.
      if (!/^https:\/\/upload\.wikimedia\.org\//.test(thumb)) { errors.push(`${asked}: image not on upload.wikimedia.org (${thumb.slice(0, 60)})`); continue; }
      const short = (v: string) => (v && v.length <= 140 ? v : null);
      meta.set(asked, {
        title: short(strip(m["ObjectName"]?.value)),
        artist: short(strip(m["Artist"]?.value)),
        date: short(strip(m["DateTimeOriginal"]?.value).replace(/^date\s*/i, "")),
        credit: short(strip(m["Credit"]?.value)),
      });
      out.set(asked, {
        file: asked,
        thumb,
        width: info.thumbwidth ?? info.width,
        height: info.thumbheight ?? info.height,
        license,
        credit: strip(m["Artist"]?.value) || null,
        page: info.descriptionurl,
      });
    }
  }
  return out;
}

/** Image files in these Commons categories and two levels of subcategory. */
async function categoryFiles(cats: string[], cap: number): Promise<string[]> {
  const files = new Set<string>();
  const seen = new Set<string>();
  let frontier = cats.map((c) => `Category:${c}`);
  for (let depth = 0; depth < 3 && frontier.length && files.size < cap; depth++) {
    const next: string[] = [];
    for (const cat of frontier) {
      if (seen.has(cat) || files.size >= cap) continue;
      seen.add(cat);
      let cont: string | undefined;
      for (let page = 0; page < 4 && files.size < cap; page++) {
        const q = new URLSearchParams({ action: "query", list: "categorymembers", cmtitle: cat, cmtype: "file|subcat", cmlimit: "500", format: "json", formatversion: "2", ...(cont ? { cmcontinue: cont } : {}) });
        const j = await json<{ query?: { categorymembers?: Array<{ ns: number; title: string }> }; continue?: { cmcontinue?: string } }>(`${COMMONS}?${q}`, `category ${cat}`);
        for (const m of j?.query?.categorymembers ?? []) {
          if (m.ns === 14) next.push(m.title);
          else if (m.ns === 6 && /\.(jpe?g|png|tiff?|webp)$/i.test(m.title)) files.add(m.title.replace(/^File:/, ""));
        }
        cont = j?.continue?.cmcontinue;
        if (!cont) break;
      }
    }
    frontier = next;
  }
  return [...files].slice(0, cap);
}

/**
 * How many Wikimedia pages, across every language and project, use each file.
 * The Commons rooms are ordered by it: a picture the encyclopaedias reach for
 * most is the nearest thing the record has to a consensus that it matters.
 */
async function usage(files: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>(files.map((f) => [f, 0]));
  for (let i = 0; i < files.length; i += 50) {
    const batch = files.slice(i, i + 50);
    let cont: Record<string, string> = {};
    for (let page = 0; page < 8; page++) {
      const q = new URLSearchParams({ action: "query", prop: "globalusage", gulimit: "500", gufilterlocal: "1", titles: batch.map((f) => `File:${f}`).join("|"), format: "json", formatversion: "2", ...cont });
      const j = await json<{ query?: { normalized?: Array<{ from: string; to: string }>; pages?: Array<{ title: string; globalusage?: unknown[] }> }; continue?: Record<string, string> }>(`${COMMONS}?${q}`, "usage");
      const norm = new Map((j?.query?.normalized ?? []).map((n) => [n.to, n.from]));
      for (const p of j?.query?.pages ?? []) {
        const f = (norm.get(p.title) ?? p.title).replace(/^File:/, "");
        out.set(f, (out.get(f) ?? 0) + (p.globalusage?.length ?? 0));
      }
      if (!j?.continue) break;
      cont = j.continue;
    }
  }
  return out;
}

/** A readable title for a Commons-only work, when the file has no ObjectName. */
function titleFromFile(file: string): string {
  return file.replace(/\.[a-z]+$/i, "").replace(/[_]+/g, " ").replace(/\s*-\s*Google Art Project.*$/i, "").replace(/\s+\(\d+\)$/, "").trim();
}

async function notYet(): Promise<NotYet[]> {
  const ids = await qids(NOT_YET);
  const list = [...ids.values()];
  if (!list.length) return [];
  const rows = await sparql(`
SELECT ?a ?born ?died WHERE {
  VALUES ?a { ${list.map((q) => `wd:${q}`).join(" ")} }
  OPTIONAL { ?a wdt:P569 ?born . }
  OPTIONAL { ?a wdt:P570 ?died . }
}`, "not-yet dates");
  const by = new Map<string, { born: number | null; died: number | null }>();
  for (const r of rows) {
    const q = id(r["a"]);
    const yr = (v?: { value: string }) => (v && /^-?\d{4}/.test(v.value) ? Number(v.value.slice(0, 4)) : null);
    if (!by.has(q)) by.set(q, { born: yr(r["born"]), died: yr(r["died"]) });
  }
  return NOT_YET.map((name) => {
    const q = ids.get(name) ?? null;
    const d = q ? by.get(q) : undefined;
    const died = d?.died ?? null;
    return {
      name: name.replace(/\s*\(.*\)$/, ""), qid: q, born: d?.born ?? null, died,
      freeIn: freeYear(died),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, "_"))}`,
    };
  });
}

export async function run(): Promise<void> {
  const titles = [...new Set(ROOMS.flatMap((r) => [...(r.artists ?? []), ...(r.movements ?? [])]))];
  const ids = await qids(titles);
  const rooms: RoomData[] = [];
  for (const room of ROOMS) {
    const pool = new Map<string, Omit<Work, "image"> & { file: string }>();
    for (const a of room.artists ?? []) { const q = ids.get(a); if (q) for (const w of await candidates("P170", q, `${room.id} ${a}`)) pool.set(w.qid, w); }
    for (const m of room.movements ?? []) { const q = ids.get(m); if (q) for (const w of await candidates("P135", q, `${room.id} ${m}`)) if (!pool.has(w.qid)) pool.set(w.qid, w); }
    const ranked = [...pool.values()].sort((a, b) => b.sitelinks - a.sitelinks || a.title.localeCompare(b.title));
    // Schools: Commons categories add what Wikidata does not tag, ranked by use.
    if (room.categories?.length) {
      const have = new Set(ranked.map((w) => w.file));
      const files = (await categoryFiles(room.categories, 400)).filter((f) => !have.has(f));
      const used = await usage(files);
      const top = files.sort((a, b) => (used.get(b) ?? 0) - (used.get(a) ?? 0)).slice(0, PER_ROOM * 3);
      for (const f of top) ranked.push({ qid: `file:${f}`, source: "commons", usage: used.get(f) ?? 0, title: titleFromFile(f), artist: null, year: null, medium: null, collection: null, sitelinks: 0, file: f });
      console.log(`  ${room.id}: ${files.length} files in its Commons categories`);
    }
    // Ask Commons about more than will hang: some will be refused.
    const asked = ranked.slice(0, PER_ROOM * 4);
    const info = await images(asked.map((w) => w.file));
    const works: Work[] = [];
    let refused = 0;
    for (const w of asked) {
      const im = info.get(w.file);
      if (im === "refused") { refused++; continue; }
      if (!im) continue;
      const { file, ...rest } = w;
      if (w.source === "commons") {
        // A Commons-only work is described by its file page, cleaned.
        const m = meta.get(file);
        if (m?.title) rest.title = m.title;
        if (m?.artist && !/^(unknown|anonymous)/i.test(m.artist)) rest.artist = m.artist;
        if (m?.date) rest.year = m.date;
        if (m?.credit) rest.collection = m.credit;
      }
      works.push({ ...rest, image: im });
      if (works.length >= PER_ROOM) break;
    }
    rooms.push({ id: room.id, works, found: pool.size, refused });
    console.log(`  ${room.id}: ${pool.size} found, ${works.length} hung, ${refused} refused for licence`);
  }
  const out: Museum = { generatedAt: new Date().toISOString(), rooms, notYet: await notYet(), errors: errors.slice(0, 200) };
  const hung = rooms.reduce((s, r) => s + r.works.length, 0);
  if (hung < 20) throw new Error(`only ${hung} works could be hung; keeping the previous file`);
  await mkdir(join(ROOT, "data", "art"), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 1) + "\n", "utf8");
  console.log(`\nwrote ${OUT}: ${hung} works in ${rooms.length} rooms, ${errors.length} errors`);
  for (const e of errors.slice(0, 30)) console.log(`  ${e}`);
}

if (isEntryPoint(import.meta.url)) {
  run().catch((e) => { console.error(e); process.exit(1); });
}
