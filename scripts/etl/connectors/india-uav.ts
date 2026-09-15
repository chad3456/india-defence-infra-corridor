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

/**
 * The indexes asked. More than one because the categories partition by kind:
 * a loitering munition is not filed as an unmanned aerial vehicle, and the
 * Nagastra and SkyStriker class of weapon is exactly the part of the pipeline
 * that has moved fastest.
 */
const CATEGORIES = [
  "Category:Unmanned aerial vehicles of India",
  "Category:Loitering munitions of India",
  "Category:Defence Research and Development Organisation",
];

/** Pages that are lists, disambiguations or organisations, not aircraft. */
function isAircraftPage(title: string): boolean {
  return !/^(List of|Category:|Template:|Portal:|Draft:)/i.test(title)
    && !/\b(disambiguation)\b/i.test(title);
}

interface CatMember { title?: string; ns?: number }
interface CatResponse { query?: { categorymembers?: CatMember[] }; continue?: { cmcontinue?: string } }

async function members(category: string): Promise<{ titles: string[]; note: string }> {
  const titles: string[] = [];
  let cont: string | undefined;
  for (let page = 0; page < 6; page++) {
    const qs = new URLSearchParams({
      action: "query", format: "json", list: "categorymembers",
      cmtitle: category, cmlimit: "500", cmnamespace: "0",
      ...(cont ? { cmcontinue: cont } : {}),
    });
    const res = await getJson<CatResponse>(`${API}?${qs.toString()}`, {
      timeoutMs: 45_000, retries: 2, cacheMs: 0,
    });
    if (!res.ok || !res.data) return { titles, note: `${category}: ${res.error ?? "no body"}` };
    for (const m of res.data.query?.categorymembers ?? []) {
      if (typeof m.title === "string" && m.ns === 0) titles.push(m.title);
    }
    cont = res.data.continue?.cmcontinue;
    if (!cont) break;
  }
  return { titles, note: `${category}: ${titles.length} article(s)` };
}

/**
 * Four buckets, and the rule that puts a programme in one.
 *
 * Order matters: "cancelled" is checked before everything, because a cancelled
 * programme's status line often names what it was cancelled *from* ("prototype,
 * cancelled 2016") and a looser order would file it as a prototype.
 */
export type Stage = "in service" | "flying" | "in development" | "cancelled" | "unstated";

export function stageOf(status: string | undefined): Stage {
  if (!status) return "unstated";
  const s = status.toLowerCase();
  if (/\b(cancell?ed|abandoned|terminated|shelved|discontinued)\b/.test(s)) return "cancelled";
  if (/\b(in service|operational|active|inducted|in use|deployed)\b/.test(s)) return "in service";
  if (/\b(prototype|trials?|testing|flight test|first flight|demonstrat)\b/.test(s)) return "flying";
  if (/\b(development|design|proposed|planned|project|ongoing)\b/.test(s)) return "in development";
  return "unstated";
}

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

  // Aircraft infoboxes: {{Infobox aircraft type}} preceded by
  // {{Infobox aircraft begin}}, or the single {{Infobox weapon}} that the
  // loitering munitions use. Both are asked for; whichever answers wins.
  const box = parseInfobox(text, /Infobox aircraft type/i)
    ?? parseInfobox(text, /Infobox aircraft begin/i)
    ?? parseInfobox(text, /Infobox weapon/i)
    ?? parseInfobox(text, /Infobox rocket/i);
  if (!box) return null;

  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = box[k];
      if (typeof v === "string" && v.trim() !== "") return plain(v).trim();
    }
    return null;
  };

  const status = pick("status");
  return {
    title,
    status,
    stage: stageOf(status ?? undefined),
    role: pick("type", "role"),
    manufacturer: pick("manufacturer", "developer", "design_group", "designer"),
    origin: pick("national_origin", "origin"),
    firstFlight: yearOf(pick("first_flight", "first flight") ?? undefined),
    introduced: pick("introduction", "introduced", "service")
      ? yearOf(pick("introduction", "introduced", "service") ?? undefined) : null,
    numberBuilt: pick("number_built", "number built", "produced"),
    primaryUser: pick("primary_user", "primary_users", "used_by"),
    via: [],
  };
}

async function main(): Promise<void> {
  const seen = new Map<string, string[]>();
  const indexNotes: string[] = [];
  for (const cat of CATEGORIES) {
    const { titles, note } = await members(cat);
    indexNotes.push(note);
    console.log(note);
    for (const t of titles) {
      if (!isAircraftPage(t)) continue;
      seen.set(t, [...(seen.get(t) ?? []), cat]);
    }
  }

  const programmes: Programme[] = [];
  const noInfobox: string[] = [];
  const unread: string[] = [];
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
  const kept: Programme[] = [];
  const filtered: Array<{ title: string; role: string | null }> = [];
  for (const p of programmes) {
    const fromDroneCategory = p.via.some((c) => /unmanned|loitering/i.test(c));
    if (fromDroneCategory || droneish.test(`${p.role ?? ""} ${p.title}`)) kept.push(p);
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
      `${CATEGORIES.map((c) => `"${c}"`).join(", ")} contain; every field is read from the ` +
      "article's own infobox and the status string is carried verbatim beside the bucket it " +
      "was sorted into.",
    method:
      "The category is the index rather than a list of programmes anyone typed, so an omission " +
      "is an omission from the category and not from someone's recall. Pages with no aircraft, " +
      "weapon or rocket infobox are recorded as such and not counted as programmes — most of " +
      "them are organisations or umbrella projects rather than aircraft.",
    cannotSay: [
      "How many airframes exist. `numberBuilt` is present on a handful of articles and absent on most, and is never estimated here.",
      "Whether a programme recorded as in service is in service in any number that matters. An encyclopaedia's status field summarises press reporting, and press reporting on defence programmes is optimistic by construction.",
      "Anything about capability, payload, endurance or sensor fit. None of it is read and none of it belongs in a status count.",
      "Whether a programme absent from these categories exists. The index is the claim; a drone nobody has written an article about is invisible here and the count is a floor.",
    ],
    categories: CATEGORIES,
    indexNotes,
    counts: {
      articlesIndexed: seen.size,
      withInfobox: programmes.length,
      keptAsUnmanned: kept.length,
      filteredNotUnmanned: filtered.length,
      noInfobox: noInfobox.length,
      unread: unread.length,
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
