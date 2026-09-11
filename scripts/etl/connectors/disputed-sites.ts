/**
 * What one book claims, catalogued as a claim.
 *
 * `npm run disputed:ingest`. Reads Volume 1, Chapter 10 of Sita Ram Goel's
 * "Hindu Temples: What Happened to Them" out of the EPUB in data/pdf and
 * writes data/sacred/disputed.json.
 *
 * ── What this is, and what it is not ─────────────────────────────────────
 *
 * The chapter is a state-by-district list of Muslim monuments — masjids,
 * dargahs, idgahs, forts — which Goel asserts were built on the sites of
 * demolished Hindu temples or from their materials. It is not a gazetteer of
 * temples. Every entry names a mosque or a tomb, not a shrine you can visit.
 * It carries no coordinates, no visitor figures, and no description of any
 * temple's significance.
 *
 * That matters because the obvious thing to do with a list of Indian places
 * is to put it on the temple map, and that would be wrong twice over: it would
 * file mosques as temples, and it would draw a contested political claim in
 * the same ink as a survey. This file therefore stays a separate dataset with
 * its own provenance, and nothing here is merged into the atlas.
 *
 * ── How the claims are recorded ──────────────────────────────────────────
 *
 * Goel's own verdicts are preserved verbatim — "Temple site", "Temple
 * materials used", "Converted temple" — rather than paraphrased into a single
 * category. They are different assertions resting on different evidence, and
 * flattening them would make the list say something its author did not.
 *
 * No total is computed. A count of rows is a count of what one author listed
 * in 1990; presenting it as a number of destroyed temples would turn a
 * bibliography into a finding, which is precisely the move this project exists
 * to refuse.
 *
 * The work is in copyright. Facts — that this book lists this place in this
 * district under this verdict — are recorded; its prose is not reproduced
 * beyond the short monument descriptions that are the data itself.
 */
import { execFileSync } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isEntryPoint } from "../lib/entry";

const ROOT = process.cwd();
const OUT = join(ROOT, "data", "sacred", "disputed.json");
const BOOK_DIR = join(ROOT, "data", "pdf");
/** The chapter holding the list. The rest of the book is argument, not data. */
const CHAPTER = "index_split_011.html";

/** States and territories as the 1990 edition heads them. */
const STATES = new Set([
  "ANDHRA PRADESH", "ASSAM", "BIHAR", "DELHI", "GUJARAT", "HARYANA", "KARNATAKA",
  "KERALA", "MADHYA PRADESH", "MAHARASHTRA", "ORISSA", "PUNJAB", "RAJASTHAN",
  "TAMIL NADU", "UTTAR PRADESH", "WEST BENGAL", "JAMMU AND KASHMIR",
  "HIMACHAL PRADESH", "GOA", "TRIPURA", "MANIPUR", "PONDICHERRY", "CHANDIGARH",
  "DAMAN AND DIU", "BANGLADESH", "PAKISTAN", "AFGHANISTAN", "NEPAL",
]);

/**
 * Goel's verdicts, as he writes them.
 *
 * Kept apart rather than merged. "Temple materials used" is an archaeological
 * observation about spolia; "Temple site" is a claim about what stood there
 * before; "Converted temple" asserts the building itself was one. They rest on
 * different evidence and a single label would misrepresent all three.
 */
const VERDICT = /(Temple site|Temple materials used|Converted [A-Za-zÃÎÑãîñ' ]*?[Tt]emple|Temple demolished)\.?\s*$/;

export interface DisputedSite {
  state: string;
  district: string | null;
  place: string | null;
  /** The monument as the book names it, including any date it gives. */
  monument: string;
  /** Goel's own verdict, verbatim. Null where the line carries none. */
  claim: string | null;
}

/**
 * A few characters in the scan are unmappable and arrive as U+FFFD.
 *
 * They stand almost entirely for the apostrophe in Arabic transliteration —
 * "Jãmi' Masjid" — so that is what they become. The rest of the diacritics
 * survive intact once the file is read as UTF-8.
 */
function clean(s: string): string {
  return s
    .replace(/�/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function chapterText(): Promise<string> {
  const files = await readdir(BOOK_DIR);
  const epub = files.find((f) => f.toLowerCase().endsWith(".epub"));
  if (!epub) throw new Error(`No EPUB in ${BOOK_DIR}. This connector reads a local book, not a feed.`);
  // `unzip -p` streams one member to stdout. The repo has no zip library and
  // this input is a single static file, so a subprocess is the whole dependency.
  return execFileSync("unzip", ["-p", join(BOOK_DIR, epub), CHAPTER], {
    // The EPUB is UTF-8. Reading it as latin1 turned every transliterated
    // vowel into mojibake — "Kalãn" arrived as "KalÃ£n" — across a list whose
    // whole value is the spelling of place-names.
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

export function parseChapter(html: string): DisputedSite[] {
  const text = html
    .replace(/<[^>]+>/g, "\n")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&#\d+;/g, " ");

  const lines = text.split("\n").map(clean).filter(Boolean);

  const rows: DisputedSite[] = [];
  let state: string | null = null;
  let district: string | null = null;
  let place: string | null = null;

  for (const line of lines) {
    const heading = line.toUpperCase().replace(/[.\s]+$/, "");
    if (STATES.has(heading)) { state = heading; district = null; place = null; continue; }
    if (!state) continue;

    const dist = line.match(/^[IVXL]+\.\s*(.+?)\s*District\.?$/i);
    if (dist) { district = clean(dist[1] ?? ""); place = null; continue; }

    // A bare "3." is the numbering of the next place, on its own line.
    if (/^\d+\.$/.test(line)) continue;

    const verdict = VERDICT.exec(line);
    // A monument line either opens with a roman sub-numeral or ends in a
    // verdict; anything else at this depth is the place name.
    if (/^\(?[ivxl]+\)/i.test(line) || verdict) {
      rows.push({
        state,
        district,
        place,
        monument: clean(line.replace(/^[,\s]+/, "")),
        claim: verdict ? clean(verdict[1] ?? "").replace(/\.$/, "") : null,
      });
      continue;
    }

    if (line.length < 60 && !line.endsWith(".")) place = clean(line.replace(/^[,\s]+|[,\s]+$/g, ""));
  }
  return rows;
}

export async function run(): Promise<void> {
  const rows = parseChapter(await chapterText());

  const states = [...new Set(rows.map((r) => r.state))];
  const districts = new Set(rows.map((r) => `${r.state}/${r.district}`)).size;
  const claims = new Map<string, number>();
  for (const r of rows) claims.set(r.claim ?? "(none stated)", (claims.get(r.claim ?? "(none stated)") ?? 0) + 1);

  // Self-checks. This parser walks a document by indentation conventions, and
  // the failure mode is silent: a heading misread as a place slides every row
  // after it into the wrong district.
  if (rows.length < 1200) throw new Error(`only ${rows.length} entries parsed; the list is far longer`);
  if (states.length < 12) throw new Error(`only ${states.length} states; the list covers more`);
  const stray = rows.filter((r) => r.place && r.place.length > 48);
  if (stray.length > 0) {
    throw new Error(`${stray.length} place names are too long to be place names, e.g. "${stray[0]!.place}"`);
  }

  console.log(`${rows.length} entries · ${states.length} states · ${districts} districts`);
  for (const [k, v] of [...claims.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(5)}  ${k}`);
  }

  await mkdir(join(ROOT, "data", "sacred"), { recursive: true });
  await writeFile(OUT, JSON.stringify({
    builtAt: new Date().toISOString(),
    source: {
      title: "Hindu Temples: What Happened to Them, Volume 1",
      author: "Sita Ram Goel",
      publisher: "Voice of India, New Delhi",
      chapter: "Chapter Ten, 'Let the Mute Witnesses Speak'",
    },
    framing:
      "This is a catalogue of claims made in one book, not a record of temples. Every " +
      "entry names a mosque, dargah, idgah or fort that the author asserts stands on the " +
      "site of a demolished Hindu temple or was built from one's materials. The work is a " +
      "polemic written into the Ayodhya dispute, its method and conclusions are contested " +
      "by other historians, and nothing here has been independently verified. It is " +
      "recorded so that what the book says can be examined, and it is kept separate from " +
      "the temple atlas so that an assertion is never drawn as a survey.",
    absent:
      "The book gives no coordinates, no visitor numbers, and no account of any temple's " +
      "significance. None of those can be taken from it, and none has been invented here.",
    noTotal:
      "No total is published. A row count is a count of what one author listed in 1990; " +
      "presenting it as a number of destroyed temples would turn a bibliography into a finding.",
    states,
    districts,
    claimTypes: Object.fromEntries(claims),
    unclassified:
      "Entries counted as '(none stated)' do carry a verdict in the book — 'Temple " +
      "material uses', 'Jain Temple sites' and other variants the scan or the original " +
      "wording produced. They are left unclassified rather than folded into the nearest " +
      "category, because deciding that a plural or a typo means the same thing is an " +
      "interpretation, and the monument line beside each one preserves the wording exactly.",
    entries: rows,
  }, null, 2) + "\n", "utf8");

  console.log(`\nwrote ${OUT}`);
}

if (isEntryPoint(import.meta.url)) {
  run().catch((err) => { console.error(err); process.exit(1); });
}
