/**
 * What is India watching, and who will tell us?
 *
 * The question has an obvious answer and a hard one. The obvious answer is the
 * ticketing platforms — BookMyShow and District between them sell most of the
 * cinema tickets in the country, and both publish what is running. The hard
 * part is whether either will hand that to anything but a browser.
 *
 * So this measures rather than assumes, and it measures the right thing. A
 * listing page that returns 200 and a JavaScript shell is a failure here even
 * though it is a success to curl: the films are fetched by the page after it
 * loads, so the bytes contain no titles. That is the mistake ixigo already
 * cost this project a round on, and the test is the same one — does the body
 * contain film titles, not does the request succeed.
 *
 * Open alternatives are probed alongside, because "the ticketing sites are
 * closed" is only half an answer. Wikipedia keeps per-language release lists
 * with box office columns, and this project already parses its tables.
 *
 * ── What cannot be probed into existence ─────────────────────────────────
 *
 * Nobody publishes a *trend*. What is rising and what is dying is not a field
 * on any page; it is the difference between two observations, and the only way
 * to have it is to have watched. Whatever this ends up reading, the trend has
 * to be accumulated from repeated snapshots rather than fetched, and the first
 * day of it is a single point however the page is dressed.
 *
 * Publishes no series.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "./lib/http";
import { parseTables, columnIndex } from "./lib/wikitext";
import { isEntryPoint } from "./lib/entry";

const ROOT = process.cwd();
const OUT = join(ROOT, "data/live/cinema-probe.json");

/**
 * Films currently in Indian cinemas, used as a needle to test whether a body
 * actually carries listings. Deliberately a mix of languages and a mix of ages
 * so that no single release date decides the result — a page carrying none of
 * these is either empty or not a listing page.
 */
const NEEDLES = [
  "Pushpa", "Jawan", "Pathaan", "Animal", "Salaar", "Leo", "Jailer", "Kalki",
  "Stree", "Devara", "Singham", "Bhool Bhulaiyaa", "Sitaare", "Chhaava",
  "Coolie", "Kantara", "Lokah", "War 2", "Saiyaara", "Baaghi",
];

interface Probe {
  group: string;
  what: string;
  url: string;
  ok: boolean;
  status: string;
  bytes?: number;
  /** The test that matters: does the body name films? */
  needlesFound?: string[];
  /** Anything that looks like a film title in a JSON-LD or meta block. */
  structuredData?: number;
  looksLikeShell?: boolean;
  /** For wikitext: tables pairing a title with a box office or release column. */
  filmTables?: number;
  headersSeen?: string[][];
  note?: string;
}
const probes: Probe[] = [];

async function flush(): Promise<void> {
  await mkdir(join(ROOT, "data/live"), { recursive: true });
  await writeFile(OUT, JSON.stringify({ probedAt: new Date().toISOString(), probes }, null, 2) + "\n", "utf8");
}

/** A body that is mostly script and almost no prose is a shell, not a listing. */
function isShell(html: string): boolean {
  const scripts = (html.match(/<script/gi) ?? []).length;
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ");
  return scripts > 3 && text.replace(/\s+/g, " ").trim().length < 2000;
}

async function probeHtml(group: string, what: string, url: string): Promise<void> {
  const res = await getText(url, { timeoutMs: 45_000, retries: 1, cacheMs: 0 });
  if (!res.ok || res.data === null) {
    probes.push({ group, what, url, ok: false, status: res.error ?? "no body" });
    await flush();
    return;
  }
  const body = res.data;
  const found = NEEDLES.filter((n) => new RegExp(n, "i").test(body));
  // Next.js and friends embed the page's data as JSON in the markup. If the
  // titles are in there, the page is readable without running its scripts.
  const jsonBlobs = (body.match(/<script[^>]*type="application\/(ld\+json|json)"[^>]*>/gi) ?? []).length
    + (body.match(/__NEXT_DATA__|__NUXT__|window\.__INITIAL/g) ?? []).length;
  probes.push({
    group, what, url, ok: true, status: "200", bytes: body.length,
    needlesFound: found, structuredData: jsonBlobs, looksLikeShell: isShell(body),
    note: found.length > 0
      ? "carries film titles in the bytes"
      : isShell(body)
        ? "a shell: opens in a browser, carries no listings in a fetch"
        : "200 with markup but no film titles found",
  });
  await flush();
  await new Promise((r) => setTimeout(r, 1500));
}

async function probeWikitext(what: string, title: string): Promise<void> {
  const url = "https://en.wikipedia.org/w/index.php?action=raw&title=" + encodeURIComponent(title);
  const res = await getText(url, { timeoutMs: 45_000, retries: 1, cacheMs: 0 });
  if (!res.ok || res.data === null) {
    probes.push({ group: "wikipedia", what, url, ok: false, status: res.error ?? "no body" });
    await flush();
    return;
  }
  const tables = parseTables(res.data).filter(
    (t) => columnIndex(t.headers, /^(title|film|movie)/i) >= 0,
  );
  probes.push({
    group: "wikipedia", what, url, ok: true, status: "200", bytes: res.data.length,
    filmTables: tables.length,
    headersSeen: tables.slice(0, 4).map((t) => t.headers.slice(0, 10)),
    needlesFound: NEEDLES.filter((n) => new RegExp(n, "i").test(res.data!)),
  });
  await flush();
  await new Promise((r) => setTimeout(r, 800));
}

export async function run(opts: { onProgress?: (s: string) => void } = {}): Promise<{ errors: string[] }> {
  const log = opts.onProgress ?? (() => {});
  const year = new Date().getUTCFullYear();

  // 1. The ticketing platforms, asked plainly. No browser headers, no
  //    cookie-jar games: if they will answer a stated data pipeline, that is
  //    worth knowing, and if they will not, that is the answer.
  await probeHtml("bookmyshow", "national movies page", "https://in.bookmyshow.com/explore/movies");
  await probeHtml("bookmyshow", "Mumbai now showing", "https://in.bookmyshow.com/explore/movies-mumbai");
  await probeHtml("bookmyshow", "Delhi now showing", "https://in.bookmyshow.com/explore/movies-national-capital-region-ncr");
  await probeHtml("district", "movies landing", "https://www.district.in/movies");
  await probeHtml("district", "Mumbai movies", "https://www.district.in/movies-in-mumbai");

  // 2. A third platform, in case the first two are shut and it is not.
  await probeHtml("paytm", "Paytm movies", "https://paytm.com/movies");

  // 3. TMDB, which documents an API but requires a key. Probed unauthenticated
  //    to record exactly what it says, so the ask for a key is specific.
  await probeHtml("tmdb", "now playing, region IN (no key)",
    "https://api.themoviedb.org/3/movie/now_playing?region=IN");

  // 4. Wikipedia's release lists — reachable, parseable, and carrying box
  //    office columns this project can already read.
  for (const lang of ["Hindi", "Tamil", "Telugu", "Malayalam", "Kannada"]) {
    await probeWikitext(`${lang} films of ${year}`, `List of ${lang} films of ${year}`);
  }
  await probeWikitext("highest-grossing Indian films", "List of highest-grossing Indian films");
  await probeWikitext(`Indian films of ${year}`, `List of Indian films of ${year}`);

  const carrying = probes.filter((p) => p.ok && ((p.needlesFound?.length ?? 0) > 0 || (p.filmTables ?? 0) > 0));
  log(`reachable: ${probes.filter((p) => p.ok).length}/${probes.length}`);
  log(`carrying film data in the bytes: ${carrying.length}`);
  for (const p of probes) {
    if (!p.ok) { log(`  unreachable  ${p.group}/${p.what}: ${p.status}`); continue; }
    log(`  ${p.ok ? "200" : "   "} ${(p.group + "/" + p.what).padEnd(42)} ${String(p.bytes).padStart(8)}b  ` +
        `titles=${(p.needlesFound ?? []).length}` +
        (p.filmTables != null ? ` tables=${p.filmTables}` : "") +
        (p.looksLikeShell ? "  SHELL" : "") +
        (p.structuredData ? `  embedded-json=${p.structuredData}` : ""));
  }
  return { errors: [] };
}

if (isEntryPoint(import.meta.url)) {
  run({ onProgress: (s) => console.log(s) }).then(() => console.log(`\nwrote ${OUT}`));
}
