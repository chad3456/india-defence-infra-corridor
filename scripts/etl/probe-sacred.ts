/**
 * What the open record holds about India's sacred geography.
 *
 * `npm run sacred:probe`. Five layers, because this subject fails in five
 * different ways and lumping them together is how a cultural map turns into an
 * assertion with coordinates on it.
 *
 * ── Layer one: sites, with coordinates and a dedication ──────────────────
 *
 * Wikidata is the right instrument: it carries the temple, its coordinates,
 * the figure it is dedicated to and its heritage designation as separate
 * statements that can be queried rather than read out of prose.
 *
 * The first round asked for the deity with P140 and got eight distinct values
 * for the whole country. P140 is "religion or worldview", and on a temple it
 * usually resolves to Hinduism — the religion, not the god. The property that
 * actually carries "this temple is Shiva's" is P825, "dedicated to". This
 * round asks both and records what each returns, because a deity axis built on
 * the wrong property would have been eight slices wide and looked deliberate.
 *
 * The temples query also came back at exactly 3,000 rows, which is the LIMIT
 * and therefore not an answer. This round counts first.
 *
 * ── Layer two: the canonical sets ────────────────────────────────────────
 *
 * The twelve Jyotirlingas, the Shakta Pithas, the Char Dham, the 108 Divya
 * Desams. These are traditions, not archaeology, and their lists differ
 * between texts — the Pitha count is 51 in one reckoning, 108 in another, and
 * the sites assigned differ too. That disagreement is the interesting thing
 * and the tracker should carry it rather than pick a number.
 *
 * ── Layer three: the evidence ────────────────────────────────────────────
 *
 * The ASI's Monuments of National Importance is the closest thing to an
 * evidentiary floor: a site on it has been surveyed, dated and protected by a
 * state body. A site attested only in a Purana is a different kind of claim,
 * and a page that draws both as the same dot is making an argument it has not
 * declared.
 *
 * ── Layer four: names, and what they record ──────────────────────────────
 *
 * This is where the user's own example lives — Varahamula becoming Baramulla.
 * Toponymy is checkable philology: Stein's translation of Kalhana's
 * Rajatarangini carries a geographical index matching Sanskrit place-names to
 * their nineteenth-century forms, and that mapping is evidence of continuity
 * where no census survives. So this round does not merely ask whether the
 * pages load — it asks whether the specific etymologies are actually written
 * in them, by looking for the words. A 200 status on the Baramulla article is
 * not evidence that the article says Varahamula.
 *
 * ── What this probe will not go looking for ──────────────────────────────
 *
 * Population ratios for Kashmir before the colonial censuses. They do not
 * exist. The Rajatarangini is a dynastic chronicle, not an enumeration; the
 * first count worth the name is the 1873 Kashmir census and the first
 * comparable one is 1891. Any series drawn back to the 1200s would be a
 * reconstruction presented as a measurement, on the most contested demographic
 * question in the country. The probe tests what the censuses actually publish
 * and the tracker will start where counting starts.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "./lib/http";
import { isEntryPoint } from "./lib/entry";

const ROOT = process.cwd();
const OUT = join(ROOT, "data", "live", "sacred-probe.json");
const WIKI = "https://en.wikipedia.org/w/api.php";
const WDQS = "https://query.wikidata.org/sparql";

interface Target {
  id: string;
  layer: "sites" | "canon" | "evidence" | "names" | "census";
  what: string;
  url: string;
  expect: RegExp;
  /**
   * Words that must appear in the body for this target to be worth anything.
   *
   * The point of the layer-four targets is a specific etymology, not a page.
   * Recording which of these were found is the difference between "the article
   * loaded" and "the article carries the claim I intend to cite".
   */
  look?: string[];
  note?: string;
}

/**
 * How many Hindu temples in India Wikidata holds, and how many are mapped.
 *
 * Two plain counts rather than one clever one. The first attempt asked for
 * both in a single query with `OPTIONAL { ... BIND(?item AS ?withCoord) }`,
 * which makes the endpoint materialise the optional join before aggregating.
 *
 * An earlier version of this comment said that query hung and destroyed the
 * report. It did neither. It answered — 16,042 temples, 3,492 of them mapped —
 * in a little over two minutes, and the run ended because a push of mine
 * cancelled it under the workflow's cancel-in-progress. I had misread the
 * elapsed time and diagnosed a hang that never happened. The split survives
 * that correction on its own merits: two scans that each finish are still
 * better than one that might not, and the split lets a count fail without
 * taking its sibling with it. But it was not a fix for a hang.
 */
const SPARQL_COUNT_ALL = `
SELECT (COUNT(DISTINCT ?item) AS ?n) WHERE {
  ?item wdt:P31/wdt:P279* wd:Q842402 ; wdt:P17 wd:Q668 .
}`;

const SPARQL_COUNT_MAPPED = `
SELECT (COUNT(DISTINCT ?item) AS ?n) WHERE {
  ?item wdt:P31/wdt:P279* wd:Q842402 ; wdt:P17 wd:Q668 ; wdt:P625 ?c .
}`;

/** P825 "dedicated to" — the property that actually names the god. */
const SPARQL_DEDICATED = `
SELECT ?d ?dLabel (COUNT(DISTINCT ?item) AS ?n) WHERE {
  ?item wdt:P31/wdt:P279* wd:Q842402 .
  ?item wdt:P17 wd:Q668 .
  ?item wdt:P825 ?d .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?d ?dLabel
ORDER BY DESC(?n)
LIMIT 80`;

/** P140 for comparison, to show on the record why it was the wrong axis. */
const SPARQL_RELIGION = `
SELECT ?d ?dLabel (COUNT(DISTINCT ?item) AS ?n) WHERE {
  ?item wdt:P31/wdt:P279* wd:Q842402 .
  ?item wdt:P17 wd:Q668 .
  ?item wdt:P140 ?d .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?d ?dLabel
ORDER BY DESC(?n)
LIMIT 80`;

/**
 * Every class of place of worship in India that carries coordinates.
 *
 * "Cultural landscape" is broader than Hindu temples, and asking the endpoint
 * which classes it actually populates is how the scope gets set by the data
 * rather than by what I happened to remember — mosques, gurdwaras, churches,
 * Jain and Buddhist sites included or excluded on evidence.
 */
const SPARQL_CLASSES = `
SELECT ?cls ?clsLabel (COUNT(DISTINCT ?item) AS ?n) WHERE {
  ?item wdt:P17 wd:Q668 ; wdt:P625 ?c ; wdt:P31 ?cls .
  ?cls wdt:P279* wd:Q1370598 .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?cls ?clsLabel
ORDER BY DESC(?n)
LIMIT 80`;

/** A page of the real payload, to confirm OFFSET paging works before relying on it. */
const SPARQL_PAGE = `
SELECT ?item ?itemLabel ?coord ?dedLabel ?inception ?heritageLabel WHERE {
  ?item wdt:P31/wdt:P279* wd:Q842402 .
  ?item wdt:P17 wd:Q668 .
  ?item wdt:P625 ?coord .
  OPTIONAL { ?item wdt:P825 ?ded . }
  OPTIONAL { ?item wdt:P571 ?inception . }
  OPTIONAL { ?item wdt:P1435 ?heritage . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?item
LIMIT 500
OFFSET 3000`;

/**
 * Decisive first, expensive last.
 *
 * The probe writes its report after every target, so the order of this list is
 * the order in which answers become durable. The two questions that decide the
 * design — does P825 carry a real deity distribution, and does OFFSET reach
 * past 3,000 — go first, so a run killed by the job timeout still leaves them
 * on disk. The full-scan counts, which are nice to know and slow to get, go
 * last where losing them costs nothing.
 */
const SPARQL: Array<{ id: string; what: string; q: string; note?: string }> = [
  {
    id: "wdqs-dedicated",
    what: "P825 'dedicated to' — the deity distribution",
    q: SPARQL_DEDICATED,
    note: "The axis the page needs. P140 gave eight values for the whole country.",
  },
  {
    id: "wdqs-page",
    what: "OFFSET paging past the 3,000 the first round could see",
    q: SPARQL_PAGE,
    note: "If this returns rows, the whole set is reachable in pages.",
  },
  {
    id: "wdqs-religion",
    what: "P140 'religion or worldview' — for comparison",
    q: SPARQL_RELIGION,
    note: "Kept on the record to show why this was the wrong property, not to use.",
  },
  {
    id: "wdqs-classes",
    what: "Every class of place of worship in India carrying coordinates",
    q: SPARQL_CLASSES,
    note: "Lets the evidence set the scope instead of my memory of it.",
  },
  {
    id: "wdqs-count-all",
    what: "How many Hindu temples in India Wikidata holds",
    q: SPARQL_COUNT_ALL,
    note: "The first round returned exactly 3,000 rows, which is the LIMIT and therefore not a count.",
  },
  {
    id: "wdqs-count-mapped",
    what: "How many of them carry coordinates",
    q: SPARQL_COUNT_MAPPED,
  },
];

const WIKI_PAGES: Array<{ page: string; layer: Target["layer"]; look?: string[]; note?: string }> = [
  { page: "Jyotirlinga", layer: "canon", look: ["Somnath", "Kedarnath", "Mahakaleshwar"] },
  {
    page: "Shakta_pithas", layer: "canon",
    look: ["51", "108", "Daksha"],
    note: "Redirected from Shakti Pitha on the first round. 51 or 108 depending on the text.",
  },
  { page: "Char_Dham", layer: "canon", look: ["Badrinath", "Dwarka", "Puri", "Rameswaram"] },
  { page: "Chota_Char_Dham", layer: "canon", look: ["Yamunotri", "Gangotri"] },
  { page: "Divya_Desam", layer: "canon", look: ["108", "Alvar"] },
  { page: "Pancharama_Kshetras", layer: "canon", look: ["Amararama", "Draksharama"] },
  {
    page: "Monuments_of_National_Importance", layer: "evidence",
    look: ["3,6", "Archaeological Survey"],
    note: "Redirect target of the list page. The evidentiary floor.",
  },
  { page: "Archaeological_Survey_of_India", layer: "evidence", look: ["1861", "Cunningham"] },
  // Layer four. The pages must carry the etymologies, not merely exist.
  {
    page: "Rajatarangini", layer: "names",
    look: ["Kalhana", "Stein", "1148", "1149"],
    note: "Stein's index is the scholarly spine for Kashmiri toponymy.",
  },
  { page: "List_of_renamed_places_in_India", layer: "names", look: ["Renamed", "Bombay", "Mumbai"] },
  {
    page: "Baramulla", layer: "names",
    look: ["Varahamula", "Varaha", "boar"],
    note: "The user's own example. A 200 here is not evidence the article says Varahamula.",
  },
  { page: "Kashmir_Valley", layer: "names", look: ["Kashyapa", "Satisar"] },
  { page: "Anantnag", layer: "names", look: ["Islamabad", "Anantnaag", "spring"] },
  { page: "Srinagar", layer: "names", look: ["Pravarasena", "Sri", "Ashoka"] },
  { page: "Martand_Sun_Temple", layer: "names", look: ["Lalitaditya", "8th century"] },
  { page: "Kashmiri_Hindus", layer: "census", look: ["1941", "census", "1990"] },
  {
    page: "Census_in_British_India", layer: "census",
    look: ["1871", "1881", "1891", "1901", "1941"],
    note: "Redirect target of 1941 Census of India. Where counting starts.",
  },
  {
    page: "Jammu_and_Kashmir_(union_territory)", layer: "census",
    look: ["Demographics", "Census", "2011"],
    note: "Redirect target of Demographics of Jammu and Kashmir.",
  },
];

const TARGETS: Target[] = [
  ...SPARQL.map((s): Target => ({
    id: s.id,
    layer: "sites",
    what: `Wikidata SPARQL: ${s.what}`,
    url: `${WDQS}?format=json&query=${encodeURIComponent(s.q)}`,
    expect: /"bindings"/,
    ...(s.note ? { note: s.note } : {}),
  })),
  ...WIKI_PAGES.map((w): Target => ({
    id: `wiki-${w.page.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 44)}`,
    layer: w.layer,
    what: `Wikipedia wikitext: ${w.page.replace(/_/g, " ")}`,
    // redirects=1 because four of the first round's targets were redirects and
    // the API returned the redirect line instead of the article.
    url: `${WIKI}?action=parse&page=${w.page}&redirects=1&prop=wikitext&formatversion=2&format=json`,
    expect: /"wikitext"/,
    ...(w.look ? { look: w.look } : {}),
    ...(w.note ? { note: w.note } : {}),
  })),
  {
    id: "asi-monuments",
    layer: "evidence",
    what: "Archaeological Survey of India, alphabetical monument list",
    url: "https://asi.nic.in/monuments/",
    expect: /monument/i,
    look: ["Temple", "Circle", "Andhra"],
    note: "8.4 MB of HTML on the first round. Reachable; the question is whether it is a table.",
  },
  {
    id: "census-india",
    layer: "census",
    what: "Census of India portal",
    url: "https://censusindia.gov.in/census.website/",
    expect: /census/i,
    note: "Failed outright on the first round.",
  },
];

interface Finding {
  id: string; layer: string; what: string; url: string;
  ok: boolean; status: string; looksRight: boolean | null;
  bytes: number | null; head: string | null;
  /** For SPARQL: how many rows, and the first of them flattened to label/value pairs. */
  rows?: number;
  sample?: Array<Record<string, string>>;
  /** For targets carrying `look`: which words were actually in the body. */
  found?: string[];
  missing?: string[];
  note?: string;
}

/** SPARQL bindings, flattened to plain strings so the report is readable. */
function flatten(body: string, take: number): { rows: number; sample: Array<Record<string, string>> } | null {
  try {
    const j = JSON.parse(body) as {
      results?: { bindings?: Array<Record<string, { value?: string }>> };
    };
    const b = j.results?.bindings ?? [];
    const sample = b.slice(0, take).map((row) => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) {
        const s = v?.value ?? "";
        // Entity URIs say nothing a label does not; keep the Q-id only.
        out[k] = s.replace(/^https?:\/\/www\.wikidata\.org\/entity\//, "");
      }
      return out;
    });
    return { rows: b.length, sample };
  } catch {
    return null;
  }
}

export async function run(): Promise<void> {
  const findings: Finding[] = [];
  for (const t of TARGETS) {
    // WDQS enforces its own 60-second query limit, so a client timeout above
    // that only buys time to be told no more slowly, and two retries on a
    // query the endpoint will never finish is four and a half wasted minutes
    // out of a twenty-minute job. One retry, and give up just past where the
    // endpoint itself gives up.
    const res = await getText(t.url, {
      cacheMs: 0,
      retries: t.layer === "sites" ? 1 : 2,
      timeoutMs: t.layer === "sites" ? 70_000 : 45_000,
      ...(t.layer === "sites" ? { accept: "application/sparql-results+json" } : {}),
    });
    const body = res.data ?? "";

    const flat = res.ok && t.layer === "sites" ? flatten(body, 40) : null;
    const look = res.ok && t.look
      ? {
          found: t.look.filter((w) => body.toLowerCase().includes(w.toLowerCase())),
          missing: t.look.filter((w) => !body.toLowerCase().includes(w.toLowerCase())),
        }
      : null;

    const f: Finding = {
      id: t.id, layer: t.layer, what: t.what, url: t.url.slice(0, 120),
      ok: res.ok,
      status: res.ok ? "200" : (res.error ?? "failed"),
      looksRight: res.ok ? t.expect.test(body) : null,
      bytes: res.ok ? body.length : null,
      head: res.ok && !flat ? body.slice(0, 200).replace(/\s+/g, " ").trim() : null,
      ...(flat ? { rows: flat.rows, sample: flat.sample } : {}),
      ...(look ? { found: look.found, missing: look.missing } : {}),
      ...(t.note ? { note: t.note } : {}),
    };
    findings.push(f);
    console.log(
      `  ${(!f.ok ? "dead" : f.looksRight ? "ok" : "200/shape").padEnd(11)} ` +
      `${t.layer.padEnd(9)} ${f.id.padEnd(42)} ${f.bytes ?? 0}` +
      `${flat ? `  ${flat.rows} rows` : ""}` +
      `${look ? `  found ${look.found.length}/${t.look!.length}` : ""}`,
    );

    await mkdir(join(ROOT, "data", "live"), { recursive: true });
    await writeFile(OUT, JSON.stringify({
      probedAt: new Date().toISOString(),
      note: "Reachability and shape only. No series are published from this file.",
      scope:
        "Sacred geography as an evidenced record: sites with coordinates, the canonical " +
        "lists and their disagreements, what has been archaeologically surveyed, and the " +
        "toponymy that records continuity where no count survives.",
      refusal:
        "No population series for Kashmir before the colonial censuses is sought or will be " +
        "published. The Rajatarangini is a dynastic chronicle, not an enumeration; the first " +
        "count worth the name is 1873 and the first comparable one 1891.",
      findings,
    }, null, 2) + "\n", "utf8");
  }

  for (const layer of ["sites", "canon", "evidence", "names", "census"]) {
    const l = findings.filter((f) => f.layer === layer);
    if (l.length === 0) continue;
    console.log(`\n${layer}: ${l.filter((f) => f.ok && f.looksRight).length} of ${l.length} usable`);
  }
  const short = findings.filter((f) => (f.missing?.length ?? 0) > 0);
  if (short.length > 0) {
    console.log("\nPages that loaded but did not carry what they were asked for:");
    for (const f of short) console.log(`  ${f.id.padEnd(42)} missing ${f.missing!.join(", ")}`);
  }
}

if (isEntryPoint(import.meta.url)) {
  run().catch((err) => { console.error(err); process.exit(1); });
}
