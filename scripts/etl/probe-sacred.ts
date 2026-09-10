/**
 * What the open record holds about India's sacred geography.
 *
 * `npm run sacred:probe`. Four layers, because this subject fails in four
 * different ways and lumping them together is how a cultural map turns into an
 * assertion with coordinates on it.
 *
 * ── Layer one: sites, with coordinates and a deity ───────────────────────
 *
 * Wikidata is the right instrument. It carries the temple, its coordinates,
 * the deity it is dedicated to, its heritage designation and often an
 * inception date, as separate statements that can be queried rather than read
 * out of prose. A SPARQL endpoint answering is the difference between mapping
 * a few dozen famous sites and mapping a few thousand.
 *
 * ── Layer two: the canonical sets ────────────────────────────────────────
 *
 * The twelve Jyotirlingas, the Shakti Pithas, the Char Dham. These are
 * traditions, not archaeology, and their lists differ between texts — the
 * Shakti Pitha count is 51 in one reckoning, 108 in another, and the sites
 * assigned differ too. That disagreement is itself the interesting thing and
 * the tracker should carry it rather than pick a number.
 *
 * ── Layer three: the evidence ────────────────────────────────────────────
 *
 * The Archaeological Survey of India's list of Monuments of National
 * Importance is the closest thing to an evidentiary floor: a site on it has
 * been surveyed, dated and protected by a state body. A site attested only in
 * a Purana is a different kind of claim, and a page that draws both as the
 * same dot is making an argument it has not declared.
 *
 * ── Layer four: names, and what they record ──────────────────────────────
 *
 * This is where the user's own example lives — Varahamula becoming Baramulla.
 * Toponymy is real, checkable philology: Stein's translation of Kalhana's
 * Rajatarangini carries a geographical index matching Sanskrit place-names to
 * their nineteenth-century forms, and that mapping is evidence of continuity
 * and change that survives where no census does.
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
  note?: string;
}

/**
 * Hindu temples in India with coordinates, and a deity where one is stated.
 *
 * Deliberately broad: P31/P279* wd:Q842402 (Hindu temple) rather than a
 * hand-listed set, so the query returns what Wikidata actually holds instead
 * of what I remembered to ask for. Capped, because an uncapped query against a
 * public endpoint is how a public endpoint stops answering.
 */
const SPARQL_TEMPLES = `
SELECT ?item ?itemLabel ?coord ?deityLabel ?stateLabel ?inception ?heritageLabel WHERE {
  ?item wdt:P31/wdt:P279* wd:Q842402 .
  ?item wdt:P17 wd:Q668 .
  ?item wdt:P625 ?coord .
  OPTIONAL { ?item wdt:P140 ?deity . }
  OPTIONAL { ?item wdt:P131 ?state . }
  OPTIONAL { ?item wdt:P571 ?inception . }
  OPTIONAL { ?item wdt:P1435 ?heritage . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 3000`;

/** Sites carrying a named principal deity, which is the axis the page needs. */
const SPARQL_DEITIES = `
SELECT ?deity ?deityLabel (COUNT(DISTINCT ?item) AS ?n) WHERE {
  ?item wdt:P31/wdt:P279* wd:Q842402 .
  ?item wdt:P17 wd:Q668 .
  ?item wdt:P140 ?deity .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?deity ?deityLabel
ORDER BY DESC(?n)
LIMIT 200`;

const WIKI_PAGES: Array<{ page: string; layer: Target["layer"]; note?: string }> = [
  { page: "Jyotirlinga", layer: "canon", note: "The twelve, and the variant lists." },
  { page: "Shakti_Pitha", layer: "canon", note: "51 or 108 depending on the text — the disagreement is the point." },
  { page: "Char_Dham", layer: "canon" },
  { page: "Chota_Char_Dham", layer: "canon" },
  { page: "Divya_Desam", layer: "canon", note: "108 Vishnu sites of the Alvars." },
  { page: "Pancharama_Kshetras", layer: "canon" },
  { page: "List_of_Monuments_of_National_Importance_in_India", layer: "evidence" },
  { page: "Archaeological_Survey_of_India", layer: "evidence" },
  // Layer four. Stein's index is the scholarly spine for Kashmiri toponymy.
  { page: "Rajatarangini", layer: "names" },
  { page: "List_of_renamed_places_in_India", layer: "names" },
  { page: "Baramulla", layer: "names", note: "Varahamula. The user's own example, and a checkable one." },
  { page: "Kashmir_Valley", layer: "names" },
  { page: "Anantnag", layer: "names" },
  { page: "Srinagar", layer: "names" },
  // Census. Where counting actually starts.
  { page: "Demographics_of_Jammu_and_Kashmir", layer: "census" },
  { page: "1941_Census_of_India", layer: "census" },
  { page: "Census_of_India", layer: "census" },
];

const TARGETS: Target[] = [
  {
    id: "wdqs-temples",
    layer: "sites",
    what: "Wikidata SPARQL: Hindu temples in India with coordinates",
    url: `${WDQS}?format=json&query=${encodeURIComponent(SPARQL_TEMPLES)}`,
    expect: /"bindings"/,
    note: "The instrument that decides whether this is a map of thousands or of a famous few.",
  },
  {
    id: "wdqs-deities",
    layer: "sites",
    what: "Wikidata SPARQL: which deities carry the most sites",
    url: `${WDQS}?format=json&query=${encodeURIComponent(SPARQL_DEITIES)}`,
    expect: /"bindings"/,
  },
  ...WIKI_PAGES.map((w): Target => ({
    id: `wiki-${w.page.toLowerCase().replace(/_/g, "-").slice(0, 44)}`,
    layer: w.layer,
    what: `Wikipedia wikitext: ${w.page.replace(/_/g, " ")}`,
    url: `${WIKI}?action=parse&page=${w.page}&prop=wikitext&formatversion=2&format=json`,
    expect: /"wikitext"/,
    ...(w.note ? { note: w.note } : {}),
  })),
  {
    id: "asi-monuments",
    layer: "evidence",
    what: "Archaeological Survey of India, alphabetical monument list",
    url: "https://asi.nic.in/monuments/",
    expect: /monument/i,
  },
  {
    id: "census-india",
    layer: "census",
    what: "Census of India portal",
    url: "https://censusindia.gov.in/census.website/",
    expect: /census/i,
  },
];

interface Finding {
  id: string; layer: string; what: string; url: string;
  ok: boolean; status: string; looksRight: boolean | null;
  bytes: number | null; head: string | null;
  /** For the SPARQL targets: how many rows came back. */
  rows?: number;
  note?: string;
}

export async function run(): Promise<void> {
  const findings: Finding[] = [];
  for (const t of TARGETS) {
    // WDQS wants a user agent and is slow on a 3,000-row query.
    const res = await getText(t.url, {
      cacheMs: 0, retries: 2, timeoutMs: 90_000,
      ...(t.layer === "sites" ? { accept: "application/sparql-results+json" } : {}),
    });
    const body = res.data ?? "";
    let rows: number | undefined;
    if (res.ok && t.layer === "sites") {
      try {
        const j = JSON.parse(body) as { results?: { bindings?: unknown[] } };
        rows = j.results?.bindings?.length ?? 0;
      } catch { rows = undefined; }
    }
    const f: Finding = {
      id: t.id, layer: t.layer, what: t.what, url: t.url.slice(0, 120),
      ok: res.ok,
      status: res.ok ? "200" : (res.error ?? "failed"),
      looksRight: res.ok ? t.expect.test(body) : null,
      bytes: res.ok ? body.length : null,
      head: res.ok ? body.slice(0, 200).replace(/\s+/g, " ").trim() : null,
      ...(rows !== undefined ? { rows } : {}),
      ...(t.note ? { note: t.note } : {}),
    };
    findings.push(f);
    console.log(
      `  ${(!f.ok ? "dead" : f.looksRight ? "ok" : "200/shape").padEnd(11)} ` +
      `${t.layer.padEnd(9)} ${f.id.padEnd(46)} ${f.bytes ?? 0}` +
      `${rows !== undefined ? `  ${rows} rows` : ""}`,
    );

    await mkdir(join(ROOT, "data", "live"), { recursive: true });
    await writeFile(OUT, JSON.stringify({
      probedAt: new Date().toISOString(),
      note: "Reachability only. No series are published from this file.",
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
}

if (isEntryPoint(import.meta.url)) {
  run().catch((err) => { console.error(err); process.exit(1); });
}
