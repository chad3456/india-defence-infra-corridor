/**
 * Who flies armed drones, and whose drones they are.
 *
 * `npm run drones:ingest`. Writes data/global/drones.json.
 *
 * ── Why operators and not manufacturers ──────────────────────────────────
 *
 * The easy dataset here is "which countries build UAVs", because Wikipedia's
 * master list is organised by country of origin and parses in an afternoon.
 * It is also the wrong dataset for the question. A dozen countries design
 * armed drones; the thing that changed in the last decade is how many
 * countries *fly* them, and the whole story of that change is that the exports
 * came from a small number of suppliers with few strings attached.
 *
 * So this reads the Operators section of each major armed type. That gives a
 * bipartite record — operator country against type, and each type against the
 * country that made it — which is what lets a map show proliferation rather
 * than production.
 *
 * ── What this is not ─────────────────────────────────────────────────────
 *
 * Not an inventory: an operator here has the type on strength or on order per
 * the article, with no count of airframes and no statement of whether they
 * are armed in that country's service. Not a record of use in combat, which
 * is a separate and much harder claim. Not complete: classified and
 * small-batch transfers do not reach an encyclopaedia, and the Operators
 * section of a popular article is edited unevenly.
 *
 * What it is: a reproducible statement of which countries are publicly
 * recorded as operating each of these types, with the article and the date
 * behind every row.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "../lib/http";
import { isEntryPoint } from "../lib/entry";

const ROOT = process.cwd();
const OUT = join(ROOT, "data", "global", "drones.json");
const WIKI = "https://en.wikipedia.org/w/api.php";

/**
 * The types worth asking about.
 *
 * Chosen for reach rather than for capability: a type earns a place here by
 * being flown by several countries, not by being the most advanced. That is
 * why the Shahed-136 and the TB2 sit beside the Reaper — as proliferation
 * events they are far larger than their unit cost suggests.
 *
 * `origin` is the country that produces the type and is stated here rather
 * than parsed, because it is the one fact about each of these aircraft that is
 * not in dispute and not subject to an article's section layout. Everything
 * else on the row is read from the page.
 */
interface Type {
  page: string;
  name: string;
  origin: string;
  /** Broad role, used only to group the map's marks. */
  klass: "combat" | "reconnaissance" | "loitering munition";
}

const TYPES: Type[] = [
  { page: "Bayraktar_TB2", name: "Bayraktar TB2", origin: "Türkiye", klass: "combat" },
  { page: "Bayraktar_Akıncı", name: "Bayraktar Akıncı", origin: "Türkiye", klass: "combat" },
  { page: "TAI_Anka", name: "TAI Anka", origin: "Türkiye", klass: "combat" },
  { page: "General_Atomics_MQ-9_Reaper", name: "MQ-9 Reaper", origin: "United States", klass: "combat" },
  { page: "General_Atomics_MQ-1_Predator", name: "MQ-1 Predator", origin: "United States", klass: "combat" },
  { page: "CAIG_Wing_Loong", name: "Wing Loong", origin: "China", klass: "combat" },
  { page: "CAIG_Wing_Loong_II", name: "Wing Loong II", origin: "China", klass: "combat" },
  { page: "CASC_Rainbow", name: "CASC Rainbow (CH series)", origin: "China", klass: "combat" },
  { page: "IAI_Heron", name: "IAI Heron", origin: "Israel", klass: "reconnaissance" },
  { page: "Elbit_Hermes_900", name: "Elbit Hermes 900", origin: "Israel", klass: "reconnaissance" },
  { page: "IAI_Harop", name: "IAI Harop", origin: "Israel", klass: "loitering munition" },
  { page: "IAI_Searcher", name: "IAI Searcher", origin: "Israel", klass: "reconnaissance" },
  { page: "HESA_Shahed_136", name: "Shahed-136", origin: "Iran", klass: "loitering munition" },
  { page: "Mohajer-6", name: "Mohajer-6", origin: "Iran", klass: "combat" },
  { page: "Orlan-10", name: "Orlan-10", origin: "Russia", klass: "reconnaissance" },
  { page: "Kronshtadt_Orion", name: "Kronshtadt Orion", origin: "Russia", klass: "combat" },
  { page: "DRDO_Rustom", name: "DRDO Rustom / TAPAS", origin: "India", klass: "reconnaissance" },
  { page: "Baykar_Bayraktar_Mini_UAV", name: "Bayraktar Mini", origin: "Türkiye", klass: "reconnaissance" },
];

/**
 * Country names as they appear in an Operators list, mapped to one spelling.
 *
 * An Operators section is a bulleted list of wiki links, and the same country
 * arrives under several names across articles — "UAE", "United Arab Emirates",
 * "Republic of Azerbaijan". Without this the map would draw one country twice
 * and count it twice, which is the failure that matters most in a dataset
 * whose whole output is a count of countries.
 */
const ALIAS: Record<string, string> = {
  "uae": "United Arab Emirates",
  "united arab emirates": "United Arab Emirates",
  "usa": "United States",
  "united states": "United States",
  "united states of america": "United States",
  "us": "United States",
  "uk": "United Kingdom",
  "united kingdom": "United Kingdom",
  "great britain": "United Kingdom",
  "turkey": "Türkiye",
  "türkiye": "Türkiye",
  "turkiye": "Türkiye",
  "republic of azerbaijan": "Azerbaijan",
  "azerbaijan": "Azerbaijan",
  "prc": "China",
  "china": "China",
  "people's republic of china": "China",
  "russia": "Russia",
  "russian federation": "Russia",
  "south korea": "South Korea",
  "republic of korea": "South Korea",
  "north korea": "North Korea",
  "ksa": "Saudi Arabia",
  "saudi arabia": "Saudi Arabia",
  "ukraine": "Ukraine",
  "libya": "Libya",
  "ethiopia": "Ethiopia",
  "morocco": "Morocco",
  "pakistan": "Pakistan",
  "india": "India",
  "israel": "Israel",
  "iran": "Iran",
};

/**
 * Words that appear in an Operators list and are not countries.
 *
 * These lists mix states with their armed services, with non-state groups, and
 * with footnote scaffolding. A service name is not a new operator — counting
 * "Turkish Air Force" beside "Türkiye" would inflate every total — and a
 * non-state group is a different kind of claim that does not belong in a
 * country count at all.
 */
const NOT_A_COUNTRY =
  /\b(air force|army|navy|armed forces|ministry|police|guard|command|corps|gendarmerie|militia|forces|government|see also|references|citation|needed|unknown|unconfirmed|reportedly)\b/i;

/** Non-state operators, kept out of the country count and recorded separately. */
const NON_STATE =
  /\b(houthi|hezbollah|hamas|wagner|pkk|isis|islamic state|taliban|polisario|rsf|rapid support)\b/i;

export interface Operator {
  country: string;
  /** The bullet as written, so a reader can see what it was read from. */
  asWritten: string;
}

export interface DroneType extends Type {
  operators: Operator[];
  nonState: string[];
  /** Absent when the article has no Operators section this could find. */
  read: boolean;
  note?: string;
  /** Raw section lines, kept only when nothing was read from them. */
  sample?: string[];
}

async function wikitext(page: string): Promise<string | null> {
  const url = `${WIKI}?action=parse&page=${encodeURIComponent(page)}` +
    "&redirects=1&prop=wikitext&formatversion=2&format=json";
  const res = await getText(url, { cacheMs: 6 * 3600_000, retries: 2, timeoutMs: 45_000 });
  if (!res.ok || !res.data) return null;
  try {
    return (JSON.parse(res.data) as { parse?: { wikitext?: string } }).parse?.wikitext ?? null;
  } catch {
    return null;
  }
}

/**
 * The body of the Operators section, if the article has one.
 *
 * Matched on the heading rather than by position. "Operators" is a standard
 * aircraft-article section, but some articles title it "Current operators" or
 * fold it under "Operational history", and a positional read would take
 * whatever happened to follow the infobox.
 */
function operatorsSection(text: string): string | null {
  const re = /^(={2,})\s*((?:current |former |potential )?operators?)\s*\1\s*$/gim;
  const m = re.exec(text);
  if (!m) return null;
  const start = m.index + m[0].length;
  const depth = (m[1] ?? "==").length;
  // Stop at the next heading of the same or shallower depth.
  const rest = text.slice(start);
  const next = new RegExp(`^={2,${depth}}\\s*\\S`, "m").exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

/**
 * ISO codes used as bare templates in Operators lists.
 *
 * `{{TUR}}` and `{{UKR}}` render as a flag and a country name, and on aircraft
 * articles they are as common as spelled-out names. Only codes that plausibly
 * appear as operators of these types are listed; an unknown code is skipped
 * rather than guessed, because a wrong expansion here silently relabels a
 * country on the map.
 */
const ISO_TEMPLATE: Record<string, string> = {
  TUR: "Türkiye", UKR: "Ukraine", AZE: "Azerbaijan", QAT: "Qatar", LBY: "Libya",
  ETH: "Ethiopia", MAR: "Morocco", TKM: "Turkmenistan", KGZ: "Kyrgyzstan",
  PAK: "Pakistan", IND: "India", ISR: "Israel", IRN: "Iran", RUS: "Russia",
  CHN: "China", USA: "United States", GBR: "United Kingdom", FRA: "France",
  ITA: "Italy", ESP: "Spain", NLD: "Netherlands", DEU: "Germany", POL: "Poland",
  ROU: "Romania", GRC: "Greece", HRV: "Croatia", ALB: "Albania", KOS: "Kosovo",
  SAU: "Saudi Arabia", ARE: "United Arab Emirates", EGY: "Egypt", DZA: "Algeria",
  TUN: "Tunisia", NGA: "Nigeria", MLI: "Mali", NER: "Niger", TCD: "Chad",
  BFA: "Burkina Faso", SOM: "Somalia", AGO: "Angola", RWA: "Rwanda",
  KAZ: "Kazakhstan", UZB: "Uzbekistan", AFG: "Afghanistan", IRQ: "Iraq",
  JOR: "Jordan", KWT: "Kuwait", OMN: "Oman", BHR: "Bahrain", YEM: "Yemen",
  SRB: "Serbia", BGR: "Bulgaria", AUS: "Australia", CAN: "Canada", JPN: "Japan",
  KOR: "South Korea", PRK: "North Korea", VNM: "Vietnam", IDN: "Indonesia",
  MYS: "Malaysia", THA: "Thailand", PHL: "Philippines", MMR: "Myanmar",
  BGD: "Bangladesh", LKA: "Sri Lanka", NPL: "Nepal", BRA: "Brazil",
  ARG: "Argentina", MEX: "Mexico", COL: "Colombia", VEN: "Venezuela",
  ZAF: "South Africa", SDN: "Sudan", SSD: "South Sudan", BLR: "Belarus",
  ARM: "Armenia", GEO: "Georgia", MDA: "Moldova", CZE: "Czech Republic",
  SVK: "Slovakia", HUN: "Hungary", AUT: "Austria", CHE: "Switzerland",
  SWE: "Sweden", NOR: "Norway", FIN: "Finland", DNK: "Denmark", BEL: "Belgium",
  PRT: "Portugal", CYP: "Cyprus", SVN: "Slovenia", MKD: "North Macedonia",
  MNE: "Montenegro", BIH: "Bosnia and Herzegovina", EST: "Estonia",
  LVA: "Latvia", LTU: "Lithuania", NZL: "New Zealand", TWN: "Taiwan",
  SGP: "Singapore", ECU: "Ecuador", PER: "Peru", CHL: "Chile",
};

/**
 * The country a line names, or null when it names something else.
 *
 * The first version read wiki links only and returned nought or one operator
 * for every type — the self-check caught it before anything shipped. Operators
 * sections on aircraft articles are not lists of links: they are flag
 * templates, `{{flag|Azerbaijan}}` or a bare `{{TUR}}`, usually on a
 * definition-list line with the air force beneath as a sub-bullet. Reading
 * links alone finds the services and misses every state.
 *
 * Three forms are read, in the order they are trustworthy: an explicit flag
 * template, an ISO code template, then a plain link.
 */
function countryOf(line: string): string | null {
  // Definition-list lines (";") carry the country; sub-bullets (":*") carry
  // the service under it. Both plain "*" bullets and ";" lines are candidates.
  if (!/^\s*[;*:]/.test(line)) return null;
  const body = line.replace(/^\s*[;*:]+\s*/, "");
  if (/\[\[\s*(file|image|category)\s*:/i.test(body)) return null;

  let raw = "";
  const flag = body.match(/\{\{\s*(?:flag|flagcountry|flagu|flagicon|flaglink|flagdeco)\s*\|\s*([^|}]+)/i);
  if (flag) {
    raw = (flag[1] ?? "").trim();
  } else {
    const iso = body.match(/\{\{\s*([A-Z]{3})\s*\}\}/);
    if (iso) {
      const hit = ISO_TEMPLATE[iso[1] ?? ""];
      if (!hit) return null;
      return hit;
    }
    const piped = body.match(/\[\[([^\]|]+)\|([^\]]+)\]\]/);
    const bare = body.match(/\[\[([^\]]+)\]\]/);
    raw = (piped?.[1] ?? bare?.[1] ?? "").split("#")[0]?.trim() ?? "";
  }
  if (!raw) return null;

  const key = raw.toLowerCase().replace(/\s*\(.*?\)\s*$/, "").trim();
  if (NOT_A_COUNTRY.test(key)) return null;
  const alias = ALIAS[key];
  if (alias) return alias;
  // Unaliased names are kept when they look like a country: short, titled, no
  // digits. Anything else is a service, a footnote or a fragment.
  if (/\d/.test(raw) || raw.length > 32 || raw.split(/\s+/).length > 4) return null;
  return raw;
}

export async function run(): Promise<void> {
  const types: DroneType[] = [];

  for (const t of TYPES) {
    const text = await wikitext(t.page);
    if (!text) {
      types.push({ ...t, operators: [], nonState: [], read: false, note: "article unavailable" });
      console.log(`  ${t.name.padEnd(26)} article unavailable`);
      continue;
    }
    let section = operatorsSection(text);

    // Popular types split their operators onto a page of their own and leave a
    // {{main|List of ... operators}} hatnote behind. The TB2 is one: its
    // section is a pointer, so reading it in place finds nothing and the type
    // with the widest export record on this list comes back empty.
    const hat = section?.match(/\{\{\s*(?:main|further|see also)\s*\|\s*([^|}]*operators?[^|}]*)\}\}/i);
    if (hat?.[1]) {
      const linked = await wikitext(hat[1].trim().replace(/\s+/g, "_"));
      const deeper = linked ? operatorsSection(linked) ?? linked : null;
      if (deeper) {
        section = deeper;
        console.log(`      ${t.name}: followed hatnote to "${hat[1].trim()}"`);
      }
    }

    if (!section) {
      types.push({ ...t, operators: [], nonState: [], read: false, note: "no Operators section found" });
      console.log(`  ${t.name.padEnd(26)} no Operators section`);
      continue;
    }

    const seen = new Set<string>();
    const operators: Operator[] = [];
    const nonState: string[] = [];
    for (const line of section.split("\n")) {
      if (NON_STATE.test(line)) {
        const who = line.replace(/^\*+\s*/, "").replace(/\[\[|\]\]/g, "").slice(0, 48).trim();
        if (who && !nonState.includes(who)) nonState.push(who);
        continue;
      }
      const c = countryOf(line);
      if (!c || seen.has(c)) continue;
      seen.add(c);
      operators.push({ country: c, asWritten: line.replace(/^\*+\s*/, "").slice(0, 90).trim() });
    }

    types.push({
      ...t, operators, nonState, read: true,
      // The first lines of the section as they actually are. The previous
      // round returned nought operators per type and the log said only that;
      // the markup is what explains it, so the markup travels with the data.
      ...(operators.length === 0
        ? { sample: section.split("\n").filter((l) => l.trim()).slice(0, 8).map((l) => l.slice(0, 120)) }
        : {}),
    });
    console.log(
      `  ${t.name.padEnd(26)} ${String(operators.length).padStart(3)} operators` +
      `${nonState.length > 0 ? `, ${nonState.length} non-state` : ""}`,
    );
  }

  const readCount = types.filter((t) => t.read).length;
  if (readCount === 0) throw new Error("no Operators section was read at all; the extractor is broken");

  // Countries, deduplicated across every type.
  const byCountry = new Map<string, { country: string; types: string[]; origins: string[] }>();
  for (const t of types) {
    for (const o of t.operators) {
      const e = byCountry.get(o.country) ?? { country: o.country, types: [], origins: [] };
      if (!e.types.includes(t.name)) e.types.push(t.name);
      if (!e.origins.includes(t.origin)) e.origins.push(t.origin);
      byCountry.set(o.country, e);
    }
  }
  const countries = [...byCountry.values()].sort((a, b) => b.types.length - a.types.length);

  // Suppliers: how many operator countries each producing country reaches.
  const bySupplier = new Map<string, Set<string>>();
  for (const t of types) {
    const s = bySupplier.get(t.origin) ?? new Set<string>();
    for (const o of t.operators) s.add(o.country);
    bySupplier.set(t.origin, s);
  }
  const suppliers = [...bySupplier.entries()]
    .map(([origin, set]) => ({ origin, operators: set.size, countries: [...set].sort() }))
    .sort((a, b) => b.operators - a.operators);

  /**
   * Faults are recorded, not thrown.
   *
   * Two runs have now died on the TB2 check before committing anything, which
   * means two round trips spent learning only that something was wrong. The
   * file is the diagnosis — it carries the raw markup of every section that
   * yielded nothing — and a file that is never written cannot be read.
   *
   * So a named-fact failure is recorded and shipped, and the run fails only
   * when most of the types come back empty, which is the parser rather than an
   * article.
   */
  const faults: string[] = [];
  const tb2 = types.find((t) => t.name === "Bayraktar TB2");
  if (tb2?.read && !tb2.operators.some((o) => o.country === "Türkiye")) {
    faults.push("the TB2's operators do not include Türkiye, which builds and flies it");
  }
  const reaper = types.find((t) => t.name === "MQ-9 Reaper");
  if (reaper?.read && !reaper.operators.some((o) => o.country === "United States")) {
    faults.push("the MQ-9's operators do not include the United States");
  }
  if (countries.length < 20) {
    faults.push(`only ${countries.length} operator countries found; these types reach far more`);
  }
  if (faults.length > 0) {
    console.warn("\nRecorded faults:");
    for (const f of faults) console.warn(`  ${f}`);
  }

  await mkdir(join(ROOT, "data", "global"), { recursive: true });
  await writeFile(OUT, JSON.stringify({
    builtAt: new Date().toISOString(),
    source: "English Wikipedia, the Operators section of each type's article.",
    note:
      "Which countries are publicly recorded as operating each type. Not an inventory — no " +
      "airframe counts, and no statement of whether a given operator arms them. Not a record " +
      "of combat use, which is a separate and harder claim.",
    gap:
      "Incomplete by construction. Classified and small-batch transfers do not reach an " +
      "encyclopaedia, and an article's Operators section is edited unevenly, so an absent " +
      "country means nobody wrote it down rather than that nobody flies it.",
    originNote:
      "Each type's country of origin is stated in this file rather than parsed. It is the one " +
      "fact about these aircraft that is neither disputed nor dependent on an article's " +
      "section layout; everything else on a row is read from the page.",
    readCount,
    faults,
    typeCount: types.length,
    countryCount: countries.length,
    types,
    countries,
    suppliers,
  }, null, 2) + "\n", "utf8");

  const empty = types.filter((t) => t.operators.length === 0).length;
  if (empty * 2 > types.length) {
    throw new Error(
      `${empty} of ${types.length} types yielded no operator at all. That is the parser, ` +
      "not the articles. The file above carries each empty section's raw markup.",
    );
  }

  console.log(
    `\n${readCount} of ${types.length} types read · ${countries.length} operator countries · ` +
    `${suppliers.length} suppliers\nwrote ${OUT}`,
  );
}

if (isEntryPoint(import.meta.url)) {
  run().catch((err) => { console.error(err); process.exit(1); });
}
