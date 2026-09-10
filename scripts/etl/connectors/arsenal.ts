/**
 * A standing agent for missiles and military procurement, across nations.
 *
 * `npm run arsenal:ingest`. Runs unattended on a schedule and does four things
 * in a loop: discovers items from sources that answer, extracts structured
 * records from prose, links records that describe the same event across
 * publishers, and grades each one by how well corroborated it is. Nothing is
 * published as settled on one outlet's say-so.
 *
 * ── What "agent" means here, precisely ───────────────────────────────────
 *
 * It means the discover-extract-link-grade loop above, running without a human
 * writing a parser per source. It does not mean a language model: this
 * pipeline has no model key and inventing a dependency on one would mean
 * shipping a step that silently does nothing in CI. The extraction is done
 * with a gazetteer the agent builds for itself, which is the part worth
 * explaining.
 *
 * ── Why the layers run in this order ─────────────────────────────────────
 *
 * Layer three runs first even though it reads the least urgent data, because
 * it produces the vocabulary the other layers need. A headline reading "Navy
 * clears deal for 26 more Rafale-M" is unreadable to a rule-based extractor
 * unless something already knows that Rafale-M is a system and which country
 * fields it. Wikipedia's per-country missile lists, parsed header-first with
 * this repo's existing wikitext machinery, are that something: a few hundred
 * system names with their operator and type. The gazetteer is the agent's
 * memory, and it is rebuilt from source on every run rather than hand-typed,
 * so a new system enters the vocabulary the week the list does.
 *
 * Layer two — the news agent — then reads seven independent publishers and
 * matches against that vocabulary. Layer one is the annual spine underneath
 * both, from SIPRI via Our World in Data.
 *
 * ── What this tracker is, and is not ─────────────────────────────────────
 *
 * It is a record of publicly announced procurement and publicly catalogued
 * inventories: the same material SIPRI, IISS and CSIS publish for general
 * readers. It carries what a country is reported to field, with the range and
 * status those catalogues already print, and what it has publicly agreed to
 * buy. It carries nothing about how any system works, and it is not an order
 * of battle: nobody publishes how many of each system a country holds, and
 * where a count is absent this file leaves it absent rather than estimating.
 *
 * ── The gap this run cannot fill, named ──────────────────────────────────
 *
 * SIPRI's arms-transfer values — the TIV series that would put a number on
 * each supplier-recipient pair — are not reachable. Fourteen candidate slugs
 * were probed across two rounds and every one 404'd, and SIPRI's own database
 * is behind a query form rather than a file. So the spine here is military
 * spending, personnel and nuclear stockpiles, and the deal values come from
 * the news layer with a corroboration grade attached rather than from SIPRI.
 * That is weaker for history and stronger for this month, and the page says so.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText, getJson } from "../lib/http";
import { getTextUnblocked, brightDataConfigured } from "../lib/brightdata";
import { isEntryPoint } from "../lib/entry";
import { parseTables, plain, columnIndex } from "../lib/wikitext";

const ROOT = process.cwd();
const OUT = join(ROOT, "data", "global", "arsenal.json");
const OWID = "https://ourworldindata.org/grapher";
const WIKI = "https://en.wikipedia.org/w/api.php";

/* ────────────────────────────────────────────────────────────────────────
   Layer one: the annual spine
   ──────────────────────────────────────────────────────────────────────── */

interface SpineSpec {
  id: string;
  slug: string;
  column: string;
  label: string;
  unit: string;
  source: string;
}

const SPINE: SpineSpec[] = [
  { id: "milex", slug: "military-spending-sipri", column: "Military expenditure",
    label: "Military spending", unit: "constant US$", source: "sipri" },
  { id: "milex-gdp", slug: "military-expenditure-share-gdp", column: "Military expenditure (% of GDP)",
    label: "Military spending, share of GDP", unit: "% of GDP", source: "sipri" },
  { id: "personnel", slug: "military-personnel", column: "Military personnel",
    label: "Armed forces personnel", unit: "people", source: "iiss-correlates" },
  { id: "warheads", slug: "nuclear-warhead-stockpiles", column: "Number of nuclear warheads",
    label: "Nuclear warhead stockpile", unit: "warheads", source: "fas" },
];

const ISO3 = /^[A-Z]{3}$/;

/** RFC 4180 enough for OWID: quoted fields with doubled quotes inside. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

interface CountryYear { iso3: string; name: string; year: number; value: number }

async function loadSpine(spec: SpineSpec): Promise<CountryYear[] | null> {
  const res = await getText(`${OWID}/${spec.slug}.csv`, { cacheMs: 12 * 3600_000, timeoutMs: 90_000 });
  if (!res.ok || !res.data) { console.log(`  FAILED spine ${spec.id}: ${res.error}`); return null; }
  const lines = res.data.split("\n");
  const header = parseCsvLine(lines[0] ?? "");
  // By name, never by position: OWID reorders columns between refreshes and a
  // positional read would publish a region string as a spending figure.
  const cV = header.indexOf(spec.column);
  const cCode = header.indexOf("Code"), cYear = header.indexOf("Year"), cName = header.indexOf("Entity");
  if (cV < 0 || cCode < 0 || cYear < 0) {
    console.log(`  FAILED spine ${spec.id}: no column "${spec.column}" in [${header.join(" | ")}]`);
    return null;
  }
  const rows: CountryYear[] = [];
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i]; if (!raw) continue;
    const f = parseCsvLine(raw);
    const code = (f[cCode] ?? "").trim();
    if (!ISO3.test(code)) continue;          // drops World, continents, income bands
    const v = Number(f[cV]), y = Number(f[cYear]);
    if (!Number.isFinite(v) || !Number.isFinite(y)) continue;
    rows.push({ iso3: code, name: (f[cName] ?? "").trim(), year: y, value: v });
  }
  return rows;
}

/* ────────────────────────────────────────────────────────────────────────
   Layer three: the gazetteer the agent reads with
   ──────────────────────────────────────────────────────────────────────── */

const WIKI_LISTS: Array<{ page: string; kind: string; countryFrom: "section" | "column" }> = [
  // On this page the country IS the section heading, which is why the loader
  // has to read sections at all.
  { page: "List_of_missiles_by_country", kind: "mixed", countryFrom: "section" },
  { page: "List_of_intercontinental_ballistic_missiles", kind: "ICBM", countryFrom: "column" },
  { page: "List_of_cruise_missiles", kind: "cruise", countryFrom: "section" },
  { page: "List_of_surface-to-air_missiles", kind: "surface-to-air", countryFrom: "section" },
  { page: "List_of_anti-ship_missiles", kind: "anti-ship", countryFrom: "section" },
  { page: "Submarine-launched_ballistic_missile", kind: "SLBM", countryFrom: "section" },
  { page: "Hypersonic_weapon", kind: "hypersonic", countryFrom: "section" },
];

export interface SystemEntry {
  name: string;
  /** Lowercased, punctuation-flattened, for matching against prose. */
  key: string;
  kind: string;
  /** Operator or country of origin, where the page states one. */
  country: string | null;
  source: string;
}

/**
 * Names too generic to match on.
 *
 * The gazetteer is used to find system names inside news headlines, so an
 * entry like "Trident" or "Arrow" would fire on stories about neither. Each of
 * these is a real row in one of the lists; each is dropped from *matching*
 * rather than from the catalogue, so the system is still listed and simply
 * never claims a headline on its own.
 */
const TOO_GENERIC = new Set([
  "arrow", "trident", "harpoon", "spike", "python", "javelin", "hawk", "eagle",
  "falcon", "lance", "sabre", "saber", "scout", "sea", "sky", "star", "storm",
  "condor", "crotale", "exocet", "hydra", "mica", "sword", "shield", "tiger",
  "atlas", "titan", "jupiter", "polaris", "typhoon", "vanguard", "meteor",
  "list", "name", "type", "origin", "range", "status", "notes", "see also",
  "overview", "history", "references", "external links", "gallery",
]);

function systemKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Split wikitext into sections, keeping each heading's depth.
 *
 * Depth is the point. On "List of missiles by country" the level-two headings
 * are countries and everything deeper is a grouping inside one — "United
 * States Navy designation systems", "By NATO reporting name". Reading every
 * heading as a country split the United States across four rows of the
 * catalogue and invented a nation called "World War II".
 */
function sections(wikitext: string): Array<{ heading: string; depth: number; body: string }> {
  const out: Array<{ heading: string; depth: number; body: string }> = [];
  const re = /^(={2,})\s*(.+?)\s*\1\s*$/gm;
  let last = 0, heading = "", depth = 0;
  for (const m of wikitext.matchAll(re)) {
    const at = m.index ?? 0;
    out.push({ heading, depth, body: wikitext.slice(last, at) });
    depth = m[1]!.length;
    heading = m[2]!.replace(/\[\[|\]\]/g, "").split("|").pop()!.trim();
    last = at + m[0].length;
  }
  out.push({ heading, depth, body: wikitext.slice(last) });
  return out;
}

/**
 * The display name out of a wiki link, or the leading plain text of a bullet.
 *
 * `[[R-36 (missile)|R-36]]` is R-36; `[[Iskander]]` is Iskander; a bullet with
 * no link at all still often starts with the system's name before a dash or a
 * bracket, and that prefix is taken.
 */
function bulletName(line: string): string | null {
  // A [[File:...|thumb|caption]] line is a picture, not a system. The first
  // run catalogued "thumb|PDV Mk-2 Anti-satellite/ballistic missile" as a
  // missile name because the piped-link branch happily took the caption.
  if (/\[\[\s*(file|image|category)\s*:/i.test(line)) return null;
  const piped = line.match(/\[\[([^\]|]+)\|([^\]]+)\]\]/);
  if (piped) return piped[2]!.trim();
  const plainLink = line.match(/\[\[([^\]|]+)\]\]/);
  if (plainLink) return plainLink[1]!.replace(/\s*\(.*?\)\s*$/, "").trim();
  if (/^\s*\*+\s*(thumb|left|right|\d+px)\b/i.test(line)) return null;
  const bare = line
    .replace(/^\*+\s*/, "")
    .replace(/''+/g, "")
    .split(/[—–\-:(,]/)[0]!
    .trim();
  return bare.length >= 3 && bare.length <= 40 ? bare : null;
}

/**
 * A heading that names a country this pipeline can recognise.
 *
 * Checked against the country list rather than against a blacklist of
 * boilerplate. The blacklist version let through "United States Navy
 * designation systems", "By NATO reporting name", "World War II", "Other" and
 * a heading that was a bare slash — five fake nations in the catalogue, and
 * the real United States fragmented across four of them.
 *
 * Multinational programmes are kept deliberately: a jointly built missile has
 * no single country of origin and saying so is more honest than picking one.
 */
const MULTINATIONAL = /^(european|nato|joint|multinational|international)\b/i;

/**
 * Armed groups that field missiles and are not states.
 *
 * They belong in a catalogue of who fields what — the Houthis and Hezbollah
 * demonstrably operate these systems — and they do not belong in a column
 * headed "country". They get their own bucket rather than being dropped,
 * because dropping them would make the catalogue quietly wrong about who is
 * shooting.
 */
const NON_STATE = /^(houthi|hezbollah|hamas|isis|islamic state|taliban|pij|palestinian islamic jihad)/i;

function resolveCountry(h: string): string | null {
  if (!h || h.length > 44) return null;
  const t = h.trim();
  if (MULTINATIONAL.test(t)) return "Multinational";
  if (NON_STATE.test(t)) return "Non-state actor";
  const low = t.toLowerCase();
  const hit = COUNTRIES.find((c) =>
    c.name.toLowerCase() === low || c.words.some((w) => w === low));
  if (hit) return hit.name;
  // "USSR/Russian Federation" and "Soviet Union" name a state that fielded
  // these systems and is not in the modern country list. Kept as written.
  if (/soviet|ussr/i.test(t)) return "Soviet Union";
  return null;
}

async function loadGazetteer(): Promise<SystemEntry[]> {
  const out = new Map<string, SystemEntry>();

  const add = (name: string, kind: string, country: string | null, source: string) => {
    const clean = name.replace(/\[.*?\]/g, "").replace(/''+/g, "").trim();
    if (!clean || clean.length < 3 || clean.length > 48) return;
    if (/^(name|total|notes?|see also|unknown|n\/a|tbd)$/i.test(clean)) return;
    // A name that is only digits or only punctuation is a table artefact.
    if (!/[a-z]/i.test(clean)) return;
    const key = systemKey(clean);
    if (!key || key.length < 3) return;
    const prev = out.get(key);
    if (!prev) out.set(key, { name: clean, key, kind, country, source });
    else if (country && !prev.country) prev.country = country;
  };

  for (const { page, kind, countryFrom } of WIKI_LISTS) {
    const url = `${WIKI}?action=parse&page=${page}&prop=wikitext&formatversion=2&format=json`;
    const res = await getJson<{ parse?: { wikitext?: string } }>(url, { cacheMs: 24 * 3600_000 });
    const text = res.data?.parse?.wikitext;
    if (!res.ok || !text) { console.log(`  FAILED gazetteer ${page}: ${res.error}`); continue; }

    const before = out.size;
    /*
     * The nearest *ancestor heading that names a country*, not simply the
     * nearest level-two one.
     *
     * Taking depth two flatly fixed the United States, which was fragmented
     * across four of its own subsection headings, and broke India, which fell
     * from 26 systems to 7: some pages nest countries one level down under a
     * region ("== Asia ==" then "=== India ==="), so the country sat at depth
     * three and the region resolved to nothing.
     *
     * Walking up the heading stack handles both shapes. "United States Navy
     * designation systems" does not resolve, so its parent "United States"
     * wins; "India" under "Asia" resolves at its own level before the region
     * is ever consulted.
     */
    const stack: string[] = [];
    for (const sec of sections(text)) {
      if (sec.depth >= 2) {
        stack.length = sec.depth;
        stack[sec.depth] = sec.heading;
      }
      let sectionCountry: string | null = null;
      if (countryFrom === "section") {
        for (let d = stack.length - 1; d >= 2; d--) {
          const c = stack[d] ? resolveCountry(stack[d]!) : null;
          if (c) { sectionCountry = c; break; }
        }
      }

      // Tables, where the page uses them.
      for (const table of parseTables(sec.body)) {
        const cName = columnIndex(table.headers, /^(name|missile|designation|system)/i);
        const cCountry = columnIndex(table.headers, /(country|origin|operator|nation|state|user)/i);
        if (cName < 0) continue;
        for (const row of table.rows) {
          // Through the same resolver as headings. Raw column values put a
          // nation called "/" in the catalogue, alongside Houthi movement and
          // Hezbollah/Syria filed as countries.
          const column = cCountry >= 0 ? resolveCountry(plain(row[cCountry] ?? "")) : null;
          add(plain(row[cName] ?? ""), kind, column ?? sectionCountry, page);
        }
      }

      /*
       * Bulleted lists, which is what most of these pages actually are.
       *
       * The first version read tables only and found 71 systems where the
       * self-check wanted 200 — because "List of missiles by country" is a
       * country heading followed by bullets, not a table, and Iskander and
       * Minuteman III both live in bullets. Reading only the shape I expected
       * would have shipped a gazetteer missing most of the world's missiles.
       */
      for (const line of sec.body.split("\n")) {
        if (!/^\*+\s/.test(line)) continue;
        const name = bulletName(line);
        if (name) add(name, kind, sectionCountry, page);
      }
    }
    console.log(`  ok gazetteer ${page.padEnd(46)} +${out.size - before}  total ${out.size}`);
  }
  return [...out.values()];
}

/* ────────────────────────────────────────────────────────────────────────
   Layer two: the news agent
   ──────────────────────────────────────────────────────────────────────── */

interface Feed {
  id: string;
  outlet: string;
  url: string;
  primary: boolean;
  /**
   * The country a feed is inherently about, where it has one.
   *
   * A national ministry's defence releases are about that nation whether or
   * not the headline names it, and PIB's twenty items placed nothing in the
   * first run for exactly that reason — "Raksha Mantri reviews..." is an India
   * story that never says India. This is stated per feed rather than inferred.
   */
  defaultCountry?: string;
}

/**
 * Publishers that answered the probe, and whether each is a primary source.
 *
 * Primary means the party to the thing being reported — a defence ministry
 * announcing its own contract. That distinction decides a verdict later: a
 * ministry release repeated by four outlets is one figure, not five.
 *
 * The DSCA, which publishes the best-shaped record of US foreign military
 * sales anywhere, answers 403 to both its releases page and its feed. That is
 * a site declining automated access and no scraper is written against it.
 */
const FEEDS: Feed[] = [
  // The organisation endpoint carries the page, not its documents, and
  // returned zero items on the first run. The search API returns the releases.
  { id: "ukmod", outlet: "UK Ministry of Defence", primary: true, defaultCountry: "United Kingdom",
    url: "https://www.gov.uk/api/search.json?filter_organisations=ministry-of-defence&count=50&order=-public_timestamp&fields=title,link,public_timestamp" },
  { id: "pib", outlet: "Press Information Bureau (India)", primary: true, defaultCountry: "India",
    url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3" },
  { id: "defensenews", outlet: "Defense News", primary: false,
    url: "https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml" },
  { id: "breakingdefense", outlet: "Breaking Defense", primary: false,
    url: "https://breakingdefense.com/feed/" },
  { id: "defenseone", outlet: "Defense One", primary: false,
    url: "https://www.defenseone.com/rss/all/" },
  { id: "navalnews", outlet: "Naval News", primary: false,
    url: "https://www.navalnews.com/feed/" },
  { id: "defenceblog", outlet: "Defence Blog", primary: false,
    url: "https://defence-blog.com/feed/" },
];

/**
 * Countries the agent can name, with the adjectives news actually uses.
 *
 * Written out rather than derived, because the mapping from "Emirati" to the
 * UAE is not something any list in this pipeline carries, and a headline says
 * "Emirati" far more often than "United Arab Emirates".
 */
const COUNTRIES: Array<{ iso3: string; name: string; words: string[] }> = [
  { iso3: "IND", name: "India", words: ["india", "indian"] },
  { iso3: "USA", name: "United States", words: ["united states", "u.s.", "us", "usa", "american", "pentagon", "washington"] },
  { iso3: "CHN", name: "China", words: ["china", "chinese", "beijing", "pla"] },
  { iso3: "RUS", name: "Russia", words: ["russia", "russian", "moscow", "kremlin"] },
  { iso3: "GBR", name: "United Kingdom", words: ["united kingdom", "britain", "british", "uk", "royal navy", "raf"] },
  { iso3: "FRA", name: "France", words: ["france", "french"] },
  { iso3: "DEU", name: "Germany", words: ["germany", "german"] },
  { iso3: "JPN", name: "Japan", words: ["japan", "japanese"] },
  { iso3: "KOR", name: "South Korea", words: ["south korea", "south korean", "seoul"] },
  { iso3: "PRK", name: "North Korea", words: ["north korea", "north korean", "pyongyang"] },
  { iso3: "PAK", name: "Pakistan", words: ["pakistan", "pakistani", "islamabad"] },
  { iso3: "ISR", name: "Israel", words: ["israel", "israeli"] },
  { iso3: "IRN", name: "Iran", words: ["iran", "iranian", "tehran"] },
  { iso3: "TUR", name: "Turkey", words: ["turkey", "turkish", "ankara", "turkiye"] },
  { iso3: "SAU", name: "Saudi Arabia", words: ["saudi"] },
  { iso3: "ARE", name: "United Arab Emirates", words: ["emirati", "united arab emirates", "uae"] },
  { iso3: "AUS", name: "Australia", words: ["australia", "australian", "canberra"] },
  { iso3: "UKR", name: "Ukraine", words: ["ukraine", "ukrainian", "kyiv"] },
  { iso3: "POL", name: "Poland", words: ["poland", "polish", "warsaw"] },
  { iso3: "ITA", name: "Italy", words: ["italy", "italian"] },
  { iso3: "ESP", name: "Spain", words: ["spain", "spanish"] },
  { iso3: "SWE", name: "Sweden", words: ["sweden", "swedish"] },
  { iso3: "NOR", name: "Norway", words: ["norway", "norwegian"] },
  { iso3: "NLD", name: "Netherlands", words: ["netherlands", "dutch"] },
  { iso3: "CAN", name: "Canada", words: ["canada", "canadian", "ottawa"] },
  { iso3: "BRA", name: "Brazil", words: ["brazil", "brazilian"] },
  { iso3: "EGY", name: "Egypt", words: ["egypt", "egyptian"] },
  { iso3: "IDN", name: "Indonesia", words: ["indonesia", "indonesian"] },
  { iso3: "VNM", name: "Vietnam", words: ["vietnam", "vietnamese"] },
  { iso3: "TWN", name: "Taiwan", words: ["taiwan", "taiwanese", "taipei"] },
  // Added after the first live run matched the seller and missed the buyer in
  // two headlines out of seven — "Croatia buys ... from the US" placed the US
  // and not Croatia, which is the wrong half of a procurement story.
  { iso3: "HRV", name: "Croatia", words: ["croatia", "croatian"] },
  { iso3: "GRC", name: "Greece", words: ["greece", "greek", "hellenic"] },
  { iso3: "FIN", name: "Finland", words: ["finland", "finnish"] },
  { iso3: "DNK", name: "Denmark", words: ["denmark", "danish"] },
  { iso3: "CZE", name: "Czechia", words: ["czech", "czechia"] },
  { iso3: "ROU", name: "Romania", words: ["romania", "romanian"] },
  { iso3: "HUN", name: "Hungary", words: ["hungary", "hungarian"] },
  { iso3: "SVK", name: "Slovakia", words: ["slovakia", "slovak"] },
  { iso3: "BGR", name: "Bulgaria", words: ["bulgaria", "bulgarian"] },
  { iso3: "PRT", name: "Portugal", words: ["portugal", "portuguese"] },
  { iso3: "BEL", name: "Belgium", words: ["belgium", "belgian"] },
  { iso3: "AUT", name: "Austria", words: ["austria", "austrian"] },
  { iso3: "CHE", name: "Switzerland", words: ["switzerland", "swiss"] },
  { iso3: "SRB", name: "Serbia", words: ["serbia", "serbian"] },
  { iso3: "EST", name: "Estonia", words: ["estonia", "estonian"] },
  { iso3: "LVA", name: "Latvia", words: ["latvia", "latvian"] },
  { iso3: "LTU", name: "Lithuania", words: ["lithuania", "lithuanian"] },
  { iso3: "QAT", name: "Qatar", words: ["qatar", "qatari"] },
  { iso3: "KWT", name: "Kuwait", words: ["kuwait", "kuwaiti"] },
  { iso3: "JOR", name: "Jordan", words: ["jordan", "jordanian"] },
  { iso3: "MAR", name: "Morocco", words: ["morocco", "moroccan"] },
  { iso3: "DZA", name: "Algeria", words: ["algeria", "algerian"] },
  { iso3: "NGA", name: "Nigeria", words: ["nigeria", "nigerian"] },
  { iso3: "ZAF", name: "South Africa", words: ["south africa", "south african"] },
  { iso3: "BGD", name: "Bangladesh", words: ["bangladesh", "bangladeshi"] },
  { iso3: "PHL", name: "Philippines", words: ["philippines", "philippine", "filipino", "manila"] },
  { iso3: "THA", name: "Thailand", words: ["thailand", "thai"] },
  { iso3: "MYS", name: "Malaysia", words: ["malaysia", "malaysian"] },
  { iso3: "SGP", name: "Singapore", words: ["singapore", "singaporean"] },
  { iso3: "NZL", name: "New Zealand", words: ["new zealand"] },
  { iso3: "ARG", name: "Argentina", words: ["argentina", "argentine"] },
  { iso3: "CHL", name: "Chile", words: ["chile", "chilean"] },
  { iso3: "COL", name: "Colombia", words: ["colombia", "colombian"] },
  { iso3: "MEX", name: "Mexico", words: ["mexico", "mexican"] },
  { iso3: "KAZ", name: "Kazakhstan", words: ["kazakhstan", "kazakh"] },
  { iso3: "BLR", name: "Belarus", words: ["belarus", "belarusian"] },
];

/**
 * Arms-control diplomacy is not procurement.
 *
 * The first run caught "Opposition by US and Russia raises doubts over
 * autonomous weapons talks outcome" and filed it as an event. It is a treaty
 * story: real news, wrong tracker. A headline matching any of these is
 * dropped however well it matches everything else.
 */
const NOT_PROCUREMENT =
  /\b(treaty|arms control|non-proliferation|nonproliferation|disarmament|ceasefire|sanction|resolution|united nations|general assembly|communiqu|doubts over|diplomats say|calls for|urges|condemn)/i;

/** What kind of event a headline describes. First match wins, most specific first. */
const KINDS: Array<{ kind: DealEvent["kind"]; pattern: RegExp }> = [
  { kind: "test", pattern: /\b(test[- ]?fir|flight[- ]?test|successful(ly)? test|trial launch|test launch|conducted a test)\b/i },
  { kind: "order", pattern: /\b(contract|deal|order|procure|purchase|sign(ed|s)?|approv(ed|es|al)|clear(ed|s)|tender|awarded)\b/i },
  { kind: "delivery", pattern: /\b(deliver(ed|s|y)|handed over|hand-over|first batch|inducted|commission(ed|ing))\b/i },
];

export interface DealEvent {
  id: string;
  kind: "order" | "delivery" | "test";
  systems: string[];
  countries: string[];
  value: { amount: number; currency: string; asWritten: string } | null;
  date: string;
  outlet: string;
  url: string;
  headline: string;
  primary: boolean;
}

/**
 * A money figure from prose, in the currencies this beat is written in.
 *
 * Deliberately narrow. A headline carrying two figures — "a $2bn deal for 12
 * of the 36 aircraft" — is ambiguous about which is the value, so anything
 * with more than one currency-marked amount returns null rather than guessing.
 */
function extractValue(text: string): DealEvent["value"] {
  const patterns: Array<{ re: RegExp; currency: string; mult: number }> = [
    { re: /(?:₹|rs\.?|inr)\s?([\d,.]+)\s*(crore|lakh|billion|million)/gi, currency: "INR", mult: 1 },
    { re: /(?:\$|usd)\s?([\d,.]+)\s*(billion|million|bn|mn|b\b|m\b)/gi, currency: "USD", mult: 1 },
    { re: /(?:€|eur)\s?([\d,.]+)\s*(billion|million|bn|mn)/gi, currency: "EUR", mult: 1 },
    { re: /(?:£|gbp)\s?([\d,.]+)\s*(billion|million|bn|mn)/gi, currency: "GBP", mult: 1 },
  ];
  const hits: DealEvent["value"][] = [];
  for (const { re, currency } of patterns) {
    for (const m of text.matchAll(re)) {
      const n = Number((m[1] ?? "").replace(/,/g, ""));
      if (!Number.isFinite(n) || n <= 0) continue;
      const scaleWord = (m[2] ?? "").toLowerCase();
      const scale =
        /crore/.test(scaleWord) ? 1e7 :
          /lakh/.test(scaleWord) ? 1e5 :
            /^(billion|bn|b)$/.test(scaleWord) ? 1e9 :
              /^(million|mn|m)$/.test(scaleWord) ? 1e6 : 1;
      hits.push({ amount: n * scale, currency, asWritten: m[0].trim() });
    }
  }
  // Two different figures in one headline: which one is the deal is a guess,
  // and a guess here becomes a wrong number on a page about arms contracts.
  const distinct = new Set(hits.map((h) => `${h!.currency}:${h!.amount}`));
  return distinct.size === 1 ? hits[0]! : null;
}

/** A stable id, so a re-run does not duplicate an event it already has. */
function eventId(outlet: string, url: string, headline: string): string {
  let h = 0;
  for (const ch of `${outlet}|${url}|${headline}`) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return `ev-${(h >>> 0).toString(36)}`;
}

/** Titles, links and dates out of RSS/Atom, or out of the GOV.UK JSON shape. */
function feedItems(body: string): Array<{ title: string; link: string; date: string }> {
  const out: Array<{ title: string; link: string; date: string }> = [];
  const strip = (s: string) => s
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .trim();

  for (const m of body.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)) {
    const block = m[0];
    const title = strip(block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const link =
      block.match(/<link[^>]*href="([^"]+)"/i)?.[1] ??
      strip(block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? "");
    const dateRaw = strip(
      block.match(/<(pubDate|published|updated|dc:date)[^>]*>([\s\S]*?)<\/\1>/i)?.[2] ?? "");
    const d = new Date(dateRaw);
    if (!title) continue;
    out.push({
      title, link,
      date: Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    });
  }
  if (out.length === 0 && body.trimStart().startsWith("{")) {
    // GOV.UK content API: documents hang off links.documents.
    try {
      const j = JSON.parse(body) as {
        results?: Array<{ title?: string; link?: string; public_timestamp?: string }>;
        links?: { documents?: Array<{ title?: string; web_url?: string; public_updated_at?: string }> };
      };
      for (const r of j.results ?? []) {
        if (!r.title) continue;
        out.push({
          title: r.title,
          link: r.link?.startsWith("http") ? r.link : `https://www.gov.uk${r.link ?? ""}`,
          date: (r.public_timestamp ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10),
        });
      }
      for (const d of j.links?.documents ?? []) {
        if (!d.title) continue;
        out.push({
          title: d.title,
          link: d.web_url ?? "",
          date: (d.public_updated_at ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10),
        });
      }
    } catch { /* not JSON after all */ }
  }
  return out;
}

function extractEvent(
  item: { title: string; link: string; date: string },
  feed: Feed,
  gaz: SystemEntry[],
): DealEvent | null {
  const text = item.title;
  const low = ` ${text.toLowerCase()} `;

  if (NOT_PROCUREMENT.test(text)) return null;

  const kind = KINDS.find((k) => k.pattern.test(text))?.kind;
  if (!kind) return null;

  // Word-boundary match so "Akash" does not fire inside another word, and the
  // generic list keeps "Arrow" from claiming every headline with an arrow in it.
  const systems = gaz
    .filter((s) => !TOO_GENERIC.has(s.key) && s.key.length >= 4)
    .filter((s) => new RegExp(`\\b${s.key.replace(/ /g, "[ -]?")}\\b`, "i").test(text))
    .map((s) => s.name);

  /*
   * Word boundaries, not substrings.
   *
   * "us" as a bare substring matches bonus, versus, campus and Belarus, and
   * the first run's country column could not be trusted because of it. Every
   * word is matched with a boundary on both sides.
   */
  const countries = COUNTRIES
    .filter((c) => c.words.some((w) =>
      new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z])`, "i").test(low)))
    .map((c) => c.name);
  if (feed.defaultCountry && !countries.includes(feed.defaultCountry)) {
    countries.push(feed.defaultCountry);
  }

  // An item that names neither a system nor a country is defence news the
  // agent cannot place, and placing it anyway is how a tracker fills up with
  // noise that looks like signal.
  if (systems.length === 0 && countries.length === 0) return null;

  return {
    id: eventId(feed.outlet, item.link, text),
    kind,
    systems: [...new Set(systems)].slice(0, 6),
    countries: [...new Set(countries)].slice(0, 6),
    value: extractValue(text),
    date: item.date,
    outlet: feed.outlet,
    url: item.link,
    headline: text,
    primary: feed.primary,
  };
}

export interface EventGroup {
  key: string;
  systems: string[];
  countries: string[];
  kind: DealEvent["kind"];
  events: DealEvent[];
  outlets: string[];
  value: DealEvent["value"];
  verdict:
    | "a single report, uncorroborated"
    | "corroborated by independent outlets"
    | "from a primary source"
    | "outlets disagree on the value";
}

/**
 * Link the reports that describe the same event, then grade the group.
 *
 * Two reports are the same event when they name the same systems and countries
 * and the same kind of act, within a fortnight. That is deliberately strict:
 * an over-eager linker merges two different contracts into one and reports a
 * corroboration that never happened, which is worse than leaving both as
 * single reports.
 */
function linkAndGrade(events: DealEvent[]): EventGroup[] {
  const byKey = new Map<string, DealEvent[]>();
  for (const e of events) {
    const key = [
      e.kind,
      [...e.systems].sort().join("+").toLowerCase(),
      [...e.countries].sort().join("+").toLowerCase(),
    ].join("|");
    (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(e);
  }

  const out: EventGroup[] = [];
  for (const [key, group] of byKey) {
    const outlets = [...new Set(group.map((e) => e.outlet))];
    const primary = group.some((e) => e.primary);
    const valued = group.filter((e) => e.value !== null);
    // Distinct values within 2%, same as the news ledger elsewhere in this
    // repo: "₹19,000 crore" and "₹19,500 crore" are a dispute, "₹19,000" and
    // "₹19,020" are the same figure rounded differently.
    const buckets: Array<{ v: NonNullable<DealEvent["value"]>; n: number }> = [];
    for (const e of valued) {
      const v = e.value!;
      const hit = buckets.find((b) => b.v.currency === v.currency && Math.abs(b.v.amount - v.amount) <= b.v.amount * 0.02);
      if (hit) hit.n++; else buckets.push({ v, n: 1 });
    }
    buckets.sort((a, b) => b.n - a.n);

    const verdict: EventGroup["verdict"] =
      buckets.length > 1 ? "outlets disagree on the value"
        : primary ? "from a primary source"
          : outlets.length > 1 ? "corroborated by independent outlets"
            : "a single report, uncorroborated";

    out.push({
      key,
      systems: group[0]!.systems,
      countries: group[0]!.countries,
      kind: group[0]!.kind,
      events: group.sort((a, b) => b.date.localeCompare(a.date)),
      outlets,
      value: buckets.length === 1 ? buckets[0]!.v : null,
      verdict,
    });
  }
  return out.sort((a, b) => (b.events[0]?.date ?? "").localeCompare(a.events[0]?.date ?? ""));
}

/* ────────────────────────────────────────────────────────────────────────
   The run
   ──────────────────────────────────────────────────────────────────────── */

export async function run(): Promise<void> {
  console.log("Layer 3 — building the gazetteer the agent reads with");
  const gazetteer = await loadGazetteer();

  console.log("\nLayer 2 — reading the feeds");
  const events: DealEvent[] = [];
  const feedStatus: Array<{ outlet: string; ok: boolean; items: number; kept: number; via: string }> = [];
  for (const feed of FEEDS) {
    // Direct first, then the unblocker if one is configured and the
    // publisher's robots.txt permits the path. With no key this is a plain
    // fetch and behaves exactly as it did before.
    const res = await getTextUnblocked(feed.url, { cacheMs: 30 * 60_000, timeoutMs: 45_000 });
    if (!res.ok || !res.data) {
      console.log(`  FAILED ${feed.outlet}: ${res.error} (${res.via})`);
      feedStatus.push({ outlet: feed.outlet, ok: false, items: 0, kept: 0, via: res.via });
      continue;
    }
    const items = feedItems(res.data);
    let kept = 0;
    for (const it of items) {
      const e = extractEvent(it, feed, gazetteer);
      if (e) { events.push(e); kept++; }
    }
    feedStatus.push({ outlet: feed.outlet, ok: true, items: items.length, kept, via: res.via });
    console.log(`  ok ${feed.outlet.padEnd(34)} ${String(items.length).padStart(4)} items  ${kept} placed  via ${res.via}`);
  }
  /*
   * Carry forward what earlier runs found.
   *
   * Each feed holds ten to fifty recent items, so a run that only published
   * what it saw would be a rolling window a few days deep and the tracker
   * would forget every deal older than that. Events are merged with the
   * committed file by their stable id, which also means corroboration can
   * accumulate: an outlet that reports a contract three days after another
   * one joins the same group rather than starting a new one.
   *
   * Two years is the horizon. Older events fall out because a tracker of
   * current procurement is not an archive and the file has to stay a size the
   * page can carry.
   */
  const horizon = new Date(Date.now() - 730 * 86400_000).toISOString().slice(0, 10);
  let carried = 0;
  try {
    const prev = JSON.parse(await readFile(OUT, "utf8")) as { events?: DealEvent[] };
    const seen = new Set(events.map((e) => e.id));
    for (const e of prev.events ?? []) {
      if (seen.has(e.id) || e.date < horizon) continue;
      /*
       * The current rules, applied to old records.
       *
       * Without this an event stored under a looser rule outlives every fix:
       * the arms-control story that prompted the NOT_PROCUREMENT refusal
       * survived the run that added it, because it was carried forward rather
       * than re-extracted. Carried events are re-checked against today's
       * refusals, so tightening a rule cleans the file it was written for.
       */
      if (NOT_PROCUREMENT.test(e.headline)) continue;
      if (!KINDS.some((k) => k.pattern.test(e.headline))) continue;
      if (e.systems.length === 0 && e.countries.length === 0) continue;
      events.push(e);
      carried++;
    }
  } catch {
    // No previous file: this is the first run.
  }
  events.sort((a, b) => b.date.localeCompare(a.date));
  console.log(`  ${carried} events carried forward from earlier runs`);

  const groups = linkAndGrade(events);

  console.log("\nLayer 1 — the annual spine");
  const spine: Record<string, CountryYear[]> = {};
  for (const spec of SPINE) {
    const rows = await loadSpine(spec);
    if (!rows) continue;
    spine[spec.id] = rows;
    const latest = Math.max(...rows.map((r) => r.year));
    console.log(`  ok ${spec.id.padEnd(11)} ${String(rows.length).padStart(6)} rows  ${new Set(rows.map((r) => r.iso3)).size} countries  to ${latest}`);
  }

  /*
   * Self-checks. Every one of these is against something a reader could look
   * up, because a silently mis-parsed column on this subject produces a full,
   * plausible, wrong table of who is arming whom.
   */
  const problems: string[] = [];

  if (gazetteer.length < 200) problems.push(`gazetteer has ${gazetteer.length} systems, expected 200+`);
  // The first run catalogued "thumb|PDV Mk-2 ..." — a wiki image caption read
  // as a system name. Any survivor of that class is a parse leak.
  const artefacts = gazetteer.filter((g) => /\b(thumb|file:|image:|px)\b/i.test(g.name));
  if (artefacts.length > 0) {
    problems.push(`${artefacts.length} gazetteer entries look like wiki markup: ${artefacts.slice(0, 3).map((a) => a.name).join(" / ")}`);
  }
  // Country attribution is the half that makes the catalogue answerable by
  // nation, and the largest source page supplies it from section headings.
  const attributed = gazetteer.filter((g) => g.country).length;
  if (attributed < gazetteer.length * 0.4) {
    problems.push(`only ${attributed} of ${gazetteer.length} systems have a country`);
  }
  /*
   * Every country string must be a country this pipeline recognises.
   *
   * The catalogue's first build carried "United States Navy designation
   * systems", "By NATO reporting name", "World War II", "Other" and a bare
   * slash as nations, and split the real United States across four of them.
   * A fake nation in a catalogue of who fields what is the worst failure this
   * file has available, so it fails the run.
   */
  const known = new Set([...COUNTRIES.map((c) => c.name), "Multinational", "Soviet Union", "Non-state actor"]);
  const fakeNations = [...new Set(gazetteer.map((g) => g.country).filter((c): c is string => Boolean(c)))]
    .filter((c) => !known.has(c));
  if (fakeNations.length > 0) {
    problems.push(`${fakeNations.length} country strings are not countries: ${fakeNations.slice(0, 5).join(" / ")}`);
  }
  const keys = new Set(gazetteer.map((g) => g.key));
  // Four systems from four different countries and four different lists. If
  // the wikitext column resolution drifts, at least one of these disappears.
  for (const want of ["brahmos", "tomahawk", "iskander", "minuteman iii"]) {
    if (![...keys].some((k) => k.includes(want.split(" ")[0]!))) {
      problems.push(`gazetteer is missing ${want}`);
    }
  }

  const milex = spine["milex"] ?? [];
  if (milex.length > 0) {
    const latestYear = Math.max(...milex.map((r) => r.year));
    const top = milex.filter((r) => r.year === latestYear).sort((a, b) => b.value - a.value)[0];
    // The United States has been the largest military spender every year this
    // dataset covers. If it is not first, the column is not spending.
    if (top?.iso3 !== "USA") problems.push(`largest spender reads ${top?.iso3 ?? "none"}, expected USA`);
    if (new Set(milex.map((r) => r.iso3)).size < 100) problems.push("military spending covers under 100 countries");
  } else problems.push("no military spending data");

  const wh = spine["warheads"] ?? [];
  if (wh.length > 0) {
    const y = Math.max(...wh.map((r) => r.year));
    const top2 = wh.filter((r) => r.year === y).sort((a, b) => b.value - a.value).slice(0, 2).map((r) => r.iso3);
    if (!top2.includes("RUS") || !top2.includes("USA")) {
      problems.push(`top two warhead holders read ${top2.join(",")}, expected RUS and USA`);
    }
  } else problems.push("no warhead data");

  // An event with neither a system nor a country is unplaceable noise, and the
  // extractor is supposed to have refused it already.
  const unplaced = events.filter((e) => e.systems.length === 0 && e.countries.length === 0);
  if (unplaced.length > 0) problems.push(`${unplaced.length} events have neither system nor country`);

  const miscorroborated = groups.filter(
    (g) => g.verdict === "corroborated by independent outlets" && g.outlets.length < 2);
  if (miscorroborated.length > 0) problems.push(`${miscorroborated.length} groups claim corroboration from one outlet`);

  if (problems.length > 0) {
    console.error("\nSelf-checks failed:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  const byVerdict: Record<string, number> = {};
  for (const g of groups) byVerdict[g.verdict] = (byVerdict[g.verdict] ?? 0) + 1;
  console.log(`\nSelf-checks passed. ${gazetteer.length} systems, ${events.length} events in ${groups.length} groups.`);
  console.log(`Verdicts: ${Object.entries(byVerdict).map(([k, v]) => `${v} ${k}`).join(" · ")}`);

  await mkdir(join(ROOT, "data", "global"), { recursive: true });
  await writeFile(OUT, JSON.stringify({
    builtAt: new Date().toISOString(),
    egress: brightDataConfigured()
      ? "Direct fetch, with Bright Data as a fallback for hosts that refuse one and whose robots.txt permits the path."
      : "Direct fetch only. No unblocker is configured, so hosts that refuse a direct fetch are simply absent.",
    note:
      "Publicly announced procurement and publicly catalogued inventories. Not an order of " +
      "battle: nobody publishes how many of each system a country holds, and no count is estimated here.",
    gap:
      "SIPRI arms-transfer values (TIV) are not reachable — fourteen candidate slugs were probed " +
      "across two rounds and all returned 404, and SIPRI's own database sits behind a query form. " +
      "Deal values come from the news layer with a corroboration grade rather than from SIPRI.",
    spineSpecs: SPINE.map((s) => ({ id: s.id, label: s.label, unit: s.unit, source: s.source, slug: s.slug })),
    spine,
    gazetteer,
    feeds: feedStatus,
    events,
    groups,
  }, null, 1) + "\n", "utf8");
  console.log(`\nWrote ${OUT}`);
}

if (isEntryPoint(import.meta.url)) {
  run().catch((err) => { console.error(err); process.exit(1); });
}
