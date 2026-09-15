/**
 * Every Indian unmanned aircraft programme an encyclopaedia records, and how
 * far along each one is.
 *
 * `npm run uav:india`. Writes data/global/india-uav.json. CI only.
 *
 * ── Why the category and not a list I typed ──────────────────────────────
 *
 * The obvious way to build this is to write down the programmes I can think of
 * — TAPAS, Ghatak, Archer, Nagastra, the CATS Warrior — and fetch a page for
 * each. That produces a file whose contents are a fact about my recall, and
 * every omission is invisible: nothing in the output would show that a
 * programme exists and is missing.
 *
 * So the category is the index. `Category:Unmanned aerial vehicles of India`
 * is maintained by people who follow the subject, and asking it which articles
 * exist turns the guess into a reading. Whatever it returns is what gets read,
 * and the file records the category it asked and the count it got back, so the
 * next person can see the shape of the index rather than trusting the list.
 *
 * ── Status is the whole point, and it is a quoted string ─────────────────
 *
 * "India is building the next generation of drones" is a claim about a
 * pipeline, so the useful axis is not how many types exist but how many have
 * left development. The aircraft infobox carries a `status` field, and it is
 * free text: "In service", "Prototype", "Under development", "Cancelled",
 * "Operational". This file classifies it into four buckets AND carries the
 * string verbatim beside the bucket, so a reader can see the sentence the
 * classification was made from and disagree with it.
 *
 * A programme whose status field is absent is recorded as unstated. It is not
 * assumed to be in development, which is the assumption that would flatter the
 * pipeline.
 *
 * ── What this cannot say ─────────────────────────────────────────────────
 *
 * Nothing about airframe counts, capability, payload, or whether a programme
 * that says "in service" is in service in any number that matters. An
 * encyclopaedia's status field is a summary of press reporting, and press
 * reporting on defence programmes is optimistic by construction.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getJson, getText } from "../lib/http";
import { parseInfobox, plain } from "../lib/wikitext";

const OUT = join(process.cwd(), "data/global/india-uav.json");
const API = "https://en.wikipedia.org/w/api.php";

/** Every infobox template name met, so the next run reads rather than guesses. */
const templatesSeen: string[] = [];
/** Pages with no usable infobox, and what templates they did carry. */
const noBoxTemplates = new Map<string, string>();

/**
 * Seed categories, plus whatever a category-namespace search turns up.
 *
 * The first run asked three categories and got six articles out of the one
 * that mattered — because Wikipedia files these under several names and
 * subcategories, and a typed list of three cannot know that. So the category
 * namespace is searched as well, one level of subcategory is walked, and the
 * file publishes every category it ended up reading and how many articles each
 * returned. The index is then inspectable rather than trusted.
 */
const SEED_CATEGORIES = [
  "Category:Unmanned aerial vehicles of India",
  "Category:Loitering munitions of India",
  "Category:Defence Research and Development Organisation",
];

/** Category-namespace searches. What they return is recorded, not assumed. */
const CATEGORY_SEARCHES = [
  "unmanned aerial vehicles of India",
  "loitering munitions India",
  "military drones India",
];

/**
 * List articles read for names the categories miss.
 *
 * Not a list of programmes anyone typed — a list of *indexes* to read. If an
 * article does not exist the run records that and loses nothing, and any
 * programme these surface is still read from its own page like every other.
 */
const LIST_ARTICLES = [
  "List of unmanned aerial vehicles of India",
  "List of equipment of the Indian Army",
  "List of active Indian military aircraft",
];

/** Pages that are lists, disambiguations or organisations, not aircraft. */
function isAircraftPage(title: string): boolean {
  return !/^(List of|Category:|Template:|Portal:|Draft:)/i.test(title)
    && !/\b(disambiguation)\b/i.test(title);
}

interface CatMember { title?: string; ns?: number }
interface CatResponse { query?: { categorymembers?: CatMember[] }; continue?: { cmcontinue?: string } }
interface SearchResponse { query?: { search?: Array<{ title?: string }> } }

/** Articles (ns 0) and subcategories (ns 14) of one category. */
async function members(category: string): Promise<{ titles: string[]; subcats: string[]; note: string }> {
  const titles: string[] = [];
  const subcats: string[] = [];
  let cont: string | undefined;
  for (let page = 0; page < 6; page++) {
    const qs = new URLSearchParams({
      action: "query", format: "json", list: "categorymembers",
      cmtitle: category, cmlimit: "500", cmnamespace: "0|14",
      ...(cont ? { cmcontinue: cont } : {}),
    });
    const res = await getJson<CatResponse>(`${API}?${qs.toString()}`, {
      timeoutMs: 45_000, retries: 2, cacheMs: 0,
    });
    if (!res.ok || !res.data) {
      return { titles, subcats, note: `${category}: ${res.error ?? "no body"}` };
    }
    for (const m of res.data.query?.categorymembers ?? []) {
      if (typeof m.title !== "string") continue;
      if (m.ns === 0) titles.push(m.title);
      else if (m.ns === 14) subcats.push(m.title);
    }
    cont = res.data.continue?.cmcontinue;
    if (!cont) break;
  }
  return { titles, subcats, note: `${category}: ${titles.length} article(s), ${subcats.length} subcategor(ies)` };
}

/** Categories the encyclopaedia itself thinks match a phrase. */
async function searchCategories(phrase: string): Promise<string[]> {
  const qs = new URLSearchParams({
    action: "query", format: "json", list: "search",
    srsearch: phrase, srnamespace: "14", srlimit: "20",
  });
  const res = await getJson<SearchResponse>(`${API}?${qs.toString()}`, {
    timeoutMs: 45_000, retries: 2, cacheMs: 0,
  });
  if (!res.ok || !res.data) return [];
  return (res.data.query?.search ?? [])
    .map((r) => r.title)
    .filter((t): t is string => typeof t === "string");
}

/**
 * Wikilinks out of a list article whose text mentions an unmanned aircraft.
 *
 * A list article is a table of links; this takes the links whose surrounding
 * row says something unmanned and hands them to the same per-page reader every
 * other candidate goes through. Nothing the list article *asserts* is used —
 * only which pages it points at.
 */
function unmannedLinksIn(wikitext: string): string[] {
  const out = new Set<string>();
  for (const line of wikitext.split(/\r?\n/)) {
    if (!/\b(uav|ucav|unmanned|drone|loitering|remotely piloted)\b/i.test(line)) continue;
    for (const m of line.matchAll(/\[\[([^|\]#]+)(?:\|[^\]]*)?\]\]/g)) {
      const t = (m[1] ?? "").trim();
      if (t === "" || /^(File|Image|Category|Template):/i.test(t)) continue;
      out.add(t);
    }
  }
  return [...out];
}

/**
 * Four buckets, and the rule that puts a programme in one.
 *
 * Order matters: "cancelled" is checked before everything, because a cancelled
 * programme's status line often names what it was cancelled *from* ("prototype,
 * cancelled 2016") and a looser order would file it as a prototype.
 */
export type Stage = "in service" | "flying" | "in development" | "cancelled" | "unstated";

/**
 * Wikitext arrives with its HTML entities intact.
 *
 * DRDO Nishant's status is the six characters `&quot;` then "Abandoned
 * project" then `&quot;` again, and the first version of this reader matched
 * against that raw string — so a cancelled programme classified as unstated
 * for want of a decode. Entities are cheap to get wrong silently.
 */
export function decode(s: string): string {
  return s
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

export function stageOf(status: string | undefined): Stage {
  if (!status) return "unstated";
  const s = decode(status).toLowerCase();
  if (/\b(cancell?ed|abandoned|terminated|shelved|discontinued|scrapped)\b/.test(s)) return "cancelled";
  if (/\b(in service|operational|active|inducted|in use|deployed|serving)\b/.test(s)) return "in service";
  // "flight test" with a word boundary after it cannot match "flight tested",
  // which is the exact string on one of these articles. Suffixes are optional
  // on every verb here for the same reason.
  if (/\b(prototypes?|trials?|test(s|ed|ing)?|first flight|flown|demonstrat)/.test(s)) return "flying";
  if (/\b(development|design|proposed|planned|project|ongoing|pre-production)/.test(s)) return "in development";
  return "unstated";
}

/** Where a programme's stage came from, so an inference is never read as a statement. */
export type StageBasis = "status field" | "stated service entry" | "stated first flight" | "none";

/** A year from a free-text date field, or null. Never a guess. */
export function yearOf(v: string | undefined): number | null {
  if (!v) return null;
  const m = /\b(19|20)\d{2}\b/.exec(v);
  if (!m) return null;
  const y = Number.parseInt(m[0], 10);
  return y >= 1950 && y <= 2035 ? y : null;
}

export interface Programme {
  title: string;
  /** The infobox's own words, never paraphrased. */
  status: string | null;
  stage: Stage;
  stageBasis: StageBasis;
  role: string | null;
  manufacturer: string | null;
  origin: string | null;
  firstFlight: number | null;
  introduced: number | null;
  numberBuilt: string | null;
  primaryUser: string | null;
  /** Which category surfaced it. */
  via: string[];
  /** Why a page was kept out of the aircraft set, when it was. */
  skipped?: string;
}

async function readProgramme(title: string): Promise<Programme | null> {
  const qs = new URLSearchParams({
    action: "parse", format: "json", prop: "wikitext",
    page: title, redirects: "1",
  });
  const res = await getJson<{ parse?: { wikitext?: { "*"?: string } } }>(`${API}?${qs.toString()}`, {
    timeoutMs: 45_000, retries: 2, cacheMs: 0,
  });
  const text = res.data?.parse?.wikitext?.["*"];
  if (!res.ok || typeof text !== "string") return null;

  /**
   * Read which infobox templates the page actually has, then parse those.
   *
   * The first version named four templates and asked for each in turn, which
   * meant a page using a fifth reported as "no infobox" — indistinguishable in
   * the output from a page that is an organisation rather than an aircraft.
   * Scanning for the names first makes the run say what it met, so the next
   * guess about this source is a reading.
   */
  const templates = [...text.matchAll(/\{\{\s*([Ii]nfobox[^|}\n]*)/g)]
    .map((m) => (m[1] ?? "").trim())
    .filter((t) => t !== "");
  templatesSeen.push(...templates);

  const relevant = templates.filter((t) => /aircraft|weapon|rocket|uav|drone|missile|vehicle/i.test(t));
  let box: Record<string, string> | null = null;
  // Aircraft articles split their facts across two templates: the "begin" box
  // carries the name and image, the "type" box carries status and role. Both
  // are read and merged, type last so its fields win.
  for (const name of relevant.sort((a, b) => (/begin/i.test(a) ? -1 : 1))) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const got = parseInfobox(text, new RegExp(escaped, "i"));
    if (got) box = { ...(box ?? {}), ...got };
  }
  if (!box) {
    noBoxTemplates.set(title, templates.slice(0, 4).join(", ") || "no infobox template at all");
    return null;
  }

  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = box[k];
      if (typeof v === "string" && v.trim() !== "") return plain(v).trim();
    }
    return null;
  };

  const status = pick("status");
  const introduced = yearOf(pick("introduction", "introduced", "service") ?? undefined);
  const firstFlight = yearOf(pick("first_flight", "first flight") ?? undefined);

  /**
   * Stage from the status field, and only if that is silent from a date.
   *
   * Eleven of seventeen programmes came back "unstated" on the first good run,
   * including several with a stated service entry — because their infobox
   * carries a year and no status line. Falling back to the dates recovers
   * them, and `stageBasis` records which field the answer came from so an
   * inference is never read as a statement. Nothing is inferred from silence:
   * a programme with no status, no service date and no first flight stays
   * unstated.
   */
  let stage = stageOf(status ?? undefined);
  let stageBasis: StageBasis = status ? "status field" : "none";
  if (stage === "unstated") {
    if (introduced !== null) { stage = "in service"; stageBasis = "stated service entry"; }
    else if (firstFlight !== null) { stage = "flying"; stageBasis = "stated first flight"; }
  }

  return {
    title,
    status: status ? decode(status) : null,
    stage,
    stageBasis,
    role: pick("type", "role"),
    manufacturer: pick("manufacturer", "developer", "design_group", "designer"),
    origin: pick("national_origin", "origin"),
    firstFlight,
    introduced,
    numberBuilt: pick("number_built", "number built", "produced"),
    primaryUser: pick("primary_user", "primary_users", "used_by"),
    via: [],
  };
}

async function main(): Promise<void> {
  const seen = new Map<string, string[]>();
  const indexNotes: string[] = [];

  /* ── Work out which categories to read, rather than assuming ───────── */
  const found = new Set(SEED_CATEGORIES);
  for (const phrase of CATEGORY_SEARCHES) {
    const hits = await searchCategories(phrase);
    indexNotes.push(`search "${phrase}": ${hits.length} categor(ies) — ${hits.slice(0, 8).join("; ") || "none"}`);
    for (const h of hits) {
      // The DRDO category is already seeded and is enormous; a search that
      // returns unrelated organisation categories would drag their whole
      // membership in, so only categories naming an unmanned thing are added.
      if (/unmanned|drone|uav|loitering/i.test(h)) found.add(h);
    }
  }

  /* ── Read them, one level of subcategory deep ──────────────────────── */
  const queue = [...found];
  const read = new Set<string>();
  const categoriesRead: string[] = [];
  for (let depth = 0; depth < 2 && queue.length > 0; depth++) {
    const level = queue.splice(0, queue.length);
    for (const cat of level) {
      if (read.has(cat)) continue;
      read.add(cat);
      categoriesRead.push(cat);
      const { titles, subcats, note } = await members(cat);
      indexNotes.push(note);
      console.log(note);
      for (const t of titles) {
        if (!isAircraftPage(t)) continue;
        seen.set(t, [...(seen.get(t) ?? []), cat]);
      }
      // Only unmanned-looking subcategories are descended into, for the same
      // reason the search filters: one wrong subcategory is a whole tree.
      for (const sc of subcats) {
        if (/unmanned|drone|uav|loitering/i.test(sc) && !read.has(sc)) queue.push(sc);
      }
    }
  }

  /* ── List articles, read for the pages they point at ───────────────── */
  for (const listTitle of LIST_ARTICLES) {
    const qs = new URLSearchParams({
      action: "parse", format: "json", prop: "wikitext", page: listTitle, redirects: "1",
    });
    const res = await getJson<{ parse?: { wikitext?: { "*"?: string } } }>(`${API}?${qs.toString()}`, {
      timeoutMs: 45_000, retries: 2, cacheMs: 0,
    });
    const text = res.data?.parse?.wikitext?.["*"];
    if (typeof text !== "string") {
      indexNotes.push(`${listTitle}: not read (${res.error ?? "no wikitext"})`);
      continue;
    }
    const links = unmannedLinksIn(text).filter(isAircraftPage);
    indexNotes.push(`${listTitle}: ${links.length} unmanned-looking link(s)`);
    console.log(`${listTitle}: ${links.length} link(s)`);
    for (const t of links) seen.set(t, [...(seen.get(t) ?? []), listTitle]);
  }
  console.log(`${seen.size} candidate page(s) to read`);

  const programmes: Programme[] = [];
  const noInfobox: string[] = [];
  for (const [title, via] of seen) {
    const p = await readProgramme(title);
    if (p === null) {
      // Distinguishing "the page would not load" from "the page has no
      // aircraft infobox" matters: the first is a fetch to retry, the second
      // is a page that is not an aircraft (an organisation, a programme
      // umbrella, a company) and should not be counted as a missing drone.
      noInfobox.push(title);
      continue;
    }
    p.via = via;
    programmes.push(p);
    console.log(`  ${p.stage.padEnd(15)} ${title.slice(0, 44).padEnd(45)} ${(p.status ?? "—").slice(0, 40)}`);
  }

  /**
   * The Defence Research and Development Organisation category is a broad
   * index of everything DRDO makes, so most of what it returns is a missile,
   * a radar or a tank. Anything from it that did not also come from a drone
   * category and whose role does not name an unmanned aircraft is dropped —
   * and counted, so the filter is visible rather than silent.
   */
  const droneish = /\b(uav|ucav|unmanned|drone|loitering|target aircraft|remotely piloted)\b/i;
  /**
   * A counter-drone system is not a drone.
   *
   * "Integrated Drone Detection & Interdiction System" passed the filter above
   * on the word "Drone" in its own title, and would have been counted as an
   * Indian unmanned aircraft programme. Anything whose title or role is about
   * detecting or shooting one down is excluded and counted.
   */
  const counterDrone = /\b(counter[- ]?(drone|uas)|anti[- ]?drone|detection|interdict|jamm)/i;
  const kept: Programme[] = [];
  const filtered: Array<{ title: string; role: string | null }> = [];
  for (const p of programmes) {
    const subject = `${p.role ?? ""} ${p.title}`;
    if (counterDrone.test(subject)) {
      filtered.push({ title: p.title, role: p.role });
      continue;
    }
    const fromDroneCategory = p.via.some((c) => /unmanned|loitering/i.test(c));
    if (fromDroneCategory || droneish.test(subject)) kept.push(p);
    else filtered.push({ title: p.title, role: p.role });
  }

  const byStage: Record<Stage, number> = {
    "in service": 0, flying: 0, "in development": 0, cancelled: 0, unstated: 0,
  };
  for (const p of kept) byStage[p.stage]++;

  const out = {
    builtAt: new Date().toISOString(),
    source:
      "English Wikipedia, via the MediaWiki API. The article set is whatever the categories " +
      "named below contain, plus the unmanned-looking links in the list articles named beside " +
      "them. Every field is read from the article's own infobox, and the status string is " +
      "carried verbatim beside the bucket it was sorted into.",
    method:
      "The indexes are the claim rather than a list of programmes anyone typed, so an omission " +
      "is an omission from Wikipedia's own categorisation and not from someone's recall. The " +
      "category namespace is searched, one level of unmanned-looking subcategory is walked, and " +
      "every category actually read is published. Pages with no usable infobox are recorded " +
      "with the templates they did carry — most are organisations or umbrella projects.",
    cannotSay: [
      "How many airframes exist. `numberBuilt` is present on a handful of articles and absent on most, and is never estimated here.",
      "Whether a programme recorded as in service is in service in any number that matters. An encyclopaedia's status field summarises press reporting, and press reporting on defence programmes is optimistic by construction.",
      "Anything about capability, payload, endurance or sensor fit. None of it is read and none of it belongs in a status count.",
      "Whether a programme absent from these categories exists. The index is the claim; a drone nobody has written an article about is invisible here and the count is a floor.",
    ],
    categories: categoriesRead,
    listArticles: LIST_ARTICLES,
    indexNotes,
    /**
     * Every infobox template name met, most common first.
     *
     * Published so the next change to this connector is a reading rather than
     * a guess: the first run named four templates, asked for each in turn, and
     * reported every page using a fifth as having no infobox at all.
     */
    templatesSeen: [...templatesSeen.reduce((m, t) => m.set(t, (m.get(t) ?? 0) + 1), new Map<string, number>())]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([name, n]) => ({ name, n })),
    noInfoboxDetail: [...noBoxTemplates].slice(0, 40).map(([title, templates]) => ({ title, templates })),
    counts: {
      articlesIndexed: seen.size,
      withInfobox: programmes.length,
      keptAsUnmanned: kept.length,
      filteredNotUnmanned: filtered.length,
      noInfobox: noInfobox.length,
      categoriesRead: categoriesRead.length,
    },
    byStage,
    filtered: filtered.slice(0, 60),
    noInfobox: noInfobox.slice(0, 60),
    programmes: kept.sort((a, b) => a.title.localeCompare(b.title)),
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(
    `\nWrote ${OUT}: ${kept.length} unmanned programmes of ${seen.size} indexed ` +
    `(${filtered.length} filtered as not unmanned, ${noInfobox.length} with no infobox).\n` +
    Object.entries(byStage).map(([k, v]) => `  ${k}: ${v}`).join("\n"),
  );
}

main().catch((err) => { console.error(err); process.exit(1); });
