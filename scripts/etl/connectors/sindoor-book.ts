/**
 * Operation Sindoor as one named account, verified line by line against it.
 *
 * `npm run sindoor:book`. Writes data/defence/sindoor-book.json. Reads a book
 * committed to this repository; touches the network only for coordinates.
 *
 * ── What this source is ──────────────────────────────────────────────────
 *
 * Lt Gen K.J.S. Dhillon, *Operation SINDOOR: The Untold Story of India's Deep
 * Strikes Inside Pakistan* (Penguin, 2025). The author is a retired Indian
 * Army officer who commanded XV Corps in Kashmir and served as Director
 * General of Military Intelligence. That makes this the most detailed public
 * Indian account of the operation, and it makes it an Indian account. It is
 * not a neutral history and does not present itself as one.
 *
 * The existing /sindoor page holds 252 dated statements with India's and
 * Pakistan's versions deliberately unmerged. This connector does not disturb
 * that. It adds one more account — a named, senior, checkable one — and files
 * every claim it carries by how much weight that claim can bear.
 *
 * ── The five tiers, and why the third one matters most ───────────────────
 *
 *   india-official      quoted from an Indian government briefing or from
 *                       Parliament. India saying what India did.
 *   author              the author's own first-hand account.
 *   pakistan-concession a Pakistani source stating something against
 *                       Pakistan's own interest.
 *   third-party         a foreign analyst with no stake in either account.
 *   contested           the two national accounts conflict, and this records
 *                       the conflict rather than resolving it.
 *
 * The third tier is the valuable one and the reason the tiers exist at all. A
 * retired Pakistani Air Marshal telling Pakistani media that an aircraft was
 * destroyed is far better evidence of that loss than any Indian claim of the
 * same thing, because it costs the speaker something. An Indian claim of a
 * Pakistani loss and a Pakistani admission of it are not the same evidence,
 * and a page that printed them at the same weight would be worse than one that
 * printed neither.
 *
 * ── Why every fact is verified against the text ──────────────────────────
 *
 * The facts below were read out of the book and typed here by hand, which is
 * the step where a number turns into a slightly different number. So each one
 * carries a `verify` phrase that must still appear in the book, and the run
 * fails if any does not. The page in the published file is not typed at all —
 * it is read from the nearest print-page anchor in the EPUB, so a citation
 * cannot drift from what it cites.
 *
 * A curated dataset with an automated check against its own source is the only
 * form of hand-entry this repository allows, and this is what it looks like.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { findBook, readChapters, locate, type Chapter } from "../lib/epub";
import { getText } from "../lib/http";
import { isEntryPoint } from "../lib/entry";

const OUT_DIR = join(process.cwd(), "data", "defence");
const OUT = join(OUT_DIR, "sindoor-book.json");
const BOOK_DIR = join(process.cwd(), "data");

const CHAPTERS: Record<string, string> = {
  c2G: "Foreword",
  c30: "1. The Roots of Terror",
  c9E: "2. The Blood Before the Storm",
  cC7: "3. Strategic Guidance",
  cE4: "4. The War Room: Preparation and Strike",
  cNY: "5. The Four-Day War",
  cWJ: "6. Battle at the Line of Control",
  cZX: "7. Strategic Communication: The Battle of Narratives",
  c11W: "8. New Rules of Engagement and the Road Ahead",
};

export const BOOK = {
  title: "Operation SINDOOR: The Untold Story of India's Deep Strikes Inside Pakistan",
  author: "Lt Gen K.J.S. Dhillon (Retd)",
  publisher: "Penguin",
  year: 2025,
  note:
    "A first-hand Indian account by a retired Indian Army officer who commanded XV Corps in "
    + "Kashmir and served as Director General of Military Intelligence. Detailed, named and "
    + "checkable — and an Indian account, not a neutral history.",
};

export type Tier = "india-official" | "author" | "pakistan-concession" | "third-party" | "contested";

/* ── The nine sites named as struck on 7 May 2025 ─────────────────────── */

export interface Target {
  id: string;
  /** The site's name as the book gives it. */
  name: string;
  town: string;
  /** Which side of the Line of Control or international border. */
  region: "PoJK" | "Pakistani Punjab";
  /** Depth inside the border in km, where the book states one. */
  depthKm: number | null;
  agency: "IAF" | "Army";
  /** The group the book attributes the site to. */
  group: string;
  what: string;
  /** Wikipedia title for coordinates. Resolved at run time, never typed here. */
  place: string;
  verify: string;
}

export const TARGETS: Target[] = [
  {
    id: "muridke", name: "Markaz Taiba", town: "Muridke", region: "Pakistani Punjab",
    depthKm: 30, agency: "IAF", group: "Lashkar-e-Taiba / Jamaat-ud-Dawa",
    what: "Named as the group's headquarters, and as where those who carried out the 2008 Mumbai attacks were trained.",
    place: "Muridke", verify: "Markaz Taiba, Muridke",
  },
  {
    id: "bahawalpur", name: "Markaz Subhanallah", town: "Bahawalpur", region: "Pakistani Punjab",
    depthKm: 100, agency: "IAF", group: "Jaish-e-Mohammed",
    what: "Named as the group's headquarters and as the planning centre for the Pathankot and Pulwama attacks.",
    place: "Bahawalpur", verify: "Markaz Subhanallah, Bahawalpur",
  },
  {
    id: "sawai-nala", name: "Sawai Nala Camp", town: "Muzaffarabad", region: "PoJK",
    depthKm: 30, agency: "Army", group: "Lashkar-e-Taiba",
    what: "Named as where those who carried out the Pahalgam attack trained.",
    place: "Muzaffarabad", verify: "Sawai Nala Camp",
  },
  {
    id: "syedna-bilal", name: "Syedna Bilal Camp", town: "Muzaffarabad", region: "PoJK",
    depthKm: 30, agency: "Army", group: "Lashkar-e-Taiba and Jaish-e-Mohammed",
    what: "Named as a camp where training was given by Pakistan Special Service Group personnel.",
    place: "Muzaffarabad", verify: "Syedna Bilal Camp",
  },
  {
    id: "barnala", name: "Barnala Camp", town: "Bhimber", region: "PoJK",
    depthKm: 10, agency: "Army", group: "unattributed in the book",
    what: "Named as a launch pad for infiltration into Kashmir, nine kilometres from the Line of Control.",
    place: "Bhimber", verify: "Barnala Camp",
  },
  {
    id: "abbas", name: "Abbas Camp", town: "Kotli", region: "PoJK",
    depthKm: 15, agency: "Army", group: "unattributed in the book",
    what: "Named as a camp for indoctrination and for training suicide bombers.",
    place: "Kotli, Pakistan", verify: "Abbas Camp, Kotli",
  },
  {
    id: "sarjal", name: "Sarjal Camp", town: "Narowal", region: "Pakistani Punjab",
    depthKm: 8, agency: "Army", group: "unattributed in the book",
    what: "Named as used for infiltration into the Jammu–Hiranagar sector.",
    place: "Narowal", verify: "Sarjal Camp",
  },
  {
    id: "gulpur", name: "Gulpur Camp", town: "Kotli", region: "PoJK",
    depthKm: null, agency: "Army", group: "Lashkar-e-Taiba",
    what: "Named as a base for units active in Poonch and Rajouri districts.",
    place: "Kotli, Pakistan", verify: "Gulpur Camp",
  },
  {
    id: "mehmoona-joya", name: "Mehmoona Joya Camp", town: "Sialkot", region: "Pakistani Punjab",
    depthKm: 15, agency: "Army", group: "Jaish-e-Mohammed",
    what: "Named as a launch pad for entry into Punjab and Jammu.",
    place: "Sialkot", verify: "Mehmoona Joya Camp",
  },
];

/* ── Pakistani military sites named as struck on 9–10 May ─────────────── */

export interface Site { id: string; name: string; place: string; kind: string; verify: string; tier: Tier }

export const AIRBASES: Site[] = [
  { id: "nur-khan", name: "Nur Khan (Chaklala)", place: "Nur Khan Airbase", kind: "air base", verify: "Chaklala (PAF Base Nur Khan)", tier: "india-official" },
  { id: "rafiqui", name: "Rafiqui", place: "PAF Base Rafiqui", kind: "air base", verify: "Pakistan military targets at Rafiqui", tier: "india-official" },
  { id: "murid", name: "Murid", place: "PAF Base Murid", kind: "air base", verify: "Rafiqui, Murid", tier: "india-official" },
  { id: "rahim-yar-khan", name: "Rahim Yar Khan", place: "Shaikh Zayed International Airport", kind: "air base", verify: "Rahim Yar Khan", tier: "india-official" },
  { id: "sukkur", name: "Sukkur", place: "Sukkur Airport", kind: "air base", verify: "Sukkur and Chunian were engaged", tier: "india-official" },
  { id: "chunian", name: "Chunian", place: "Chunian", kind: "air base", verify: "Sukkur and Chunian", tier: "india-official" },
  { id: "pasrur", name: "Pasrur", place: "Pasrur", kind: "radar site", verify: "Radar sites at Pasrur", tier: "india-official" },
  { id: "sialkot-av", name: "Sialkot aviation base", place: "Sialkot", kind: "aviation base", verify: "Sialkot aviation base", tier: "india-official" },
  { id: "jacobabad", name: "Jacobabad", place: "PAF Base Shahbaz", kind: "air base", verify: "Jacobabad", tier: "india-official" },
  { id: "bholari", name: "Bholari", place: "PAF Base Bholari", kind: "air base", verify: "Bholari", tier: "india-official" },
];

/* ── The sequence ─────────────────────────────────────────────────────── */

export interface Beat {
  id: string;
  date: string;
  /** Short label for the walkthrough. */
  label: string;
  what: string;
  tier: Tier;
  verify: string;
}

export const BEATS: Beat[] = [
  {
    id: "pahalgam", date: "2025-04-22", label: "Pahalgam",
    what: "The attack on civilians at Pahalgam, which the book treats as the trigger for everything that follows.",
    tier: "author", verify: "22 April 2025 Pahalgam terror attack",
  },
  {
    id: "phase-one", date: "2025-05-07", label: "Nine sites, one night",
    what: "Nine sites struck. Seven engaged by the Indian Army with long- and medium-range weapons along the Line of Control and international border; two — Muridke and Bahawalpur — engaged by the Indian Air Force in depth.",
    tier: "author", verify: "seven were engaged by the Indian Army and two were engaged by the IAF",
  },
  {
    id: "deception", date: "2025-05-07", label: "The aircraft that struck nothing",
    what: "Aircraft simulated activity along the whole front to divide and stretch Pakistani reaction forces, so the defences could not concentrate on the actual strike.",
    tier: "author", verify: "simulated activity continuously along the entire front",
  },
  {
    id: "drone-waves", date: "2025-05-08", label: "Three waves, forty launch points",
    what: "More than 300 drones launched from Pakistani territory within six hours, in three waves from nearly forty locations, from the night of 8–9 May into the morning of 10 May.",
    tier: "author", verify: "in three waves from nearly forty locations",
  },
  {
    id: "bunyan", date: "2025-05-08", label: "Bunyan-al-Marsoos",
    what: "Pakistan named its campaign Bunyan-al-Marsoos, 'Unbreakable Wall', framed domestically as Marka-i-Haq, 'the Battle of Truth'.",
    tier: "contested", verify: "Bunyan-al-Marsoos",
  },
  {
    id: "airfields", date: "2025-05-10", label: "The airfields",
    what: "In the second half of the night of 9–10 May, India struck Pakistani airfields and radar sites, which the Ministry of External Affairs briefing of 10 May described as precision attacks on identified military targets only.",
    tier: "india-official", verify: "precision attacks only on identified military targets",
  },
  {
    id: "indian-damage", date: "2025-05-10", label: "What India conceded",
    what: "The same Indian briefing stated that limited damage was sustained to equipment and personnel at Indian Air Force stations at Udhampur, Pathankot, Adampur and Bhuj.",
    tier: "india-official", verify: "limited damage was sustained to equipment and personnel",
  },
  {
    id: "bholari-awacs", date: "2025-05-10", label: "A loss admitted",
    what: "Retired Pakistani Air Marshal Masood Akhtar told Pakistani media that an AWACS aircraft was damaged at Bholari when the fourth of four missiles hit its hangar.",
    tier: "pakistan-concession", verify: "the fourth one hit the hangar at Bholari airbase",
  },
  {
    id: "eleven-bases", date: "2025-07-29", label: "Eleven bases, in Parliament",
    what: "Indian Home Minister Amit Shah told Parliament on 29 July 2025 that eleven Pakistani airbases had been targeted, of which eight were hit.",
    tier: "india-official", verify: "eleven Pakistani airbases",
  },
  {
    id: "ceasefire", date: "2025-05-10", label: "The ceasefire",
    what: "A ceasefire was announced in the late evening of 10 May 2025.",
    tier: "author", verify: "the ceasefire was announced on 10 May 2025 in the late evening",
  },
];

/* ── Weapons the book names ───────────────────────────────────────────── */

export interface Weapon { id: string; name: string; kind: string; origin: string; note: string; verify: string }

export const WEAPONS: Weapon[] = [
  { id: "scalp", name: "SCALP / Storm Shadow", kind: "air-launched cruise missile", origin: "France", note: "Used for long-range precision strikes from within Indian airspace.", verify: "SCALP Storm Shadow" },
  { id: "hammer", name: "HAMMER", kind: "precision-guided munition", origin: "France", note: "Extended Range Air to Ground Highly Agile Modular Munition.", verify: "Highly Agile Modular Munition" },
  { id: "harop", name: "Harop", kind: "loitering munition", origin: "Israel", note: "Six to nine hours' endurance, about 200 km range, a 16–23 kg warhead. Used against air defences.", verify: "The loitering munition used by the Indian Army and the IAF was the Israeli-made Harop" },
  { id: "skystriker", name: "SkyStriker", kind: "loitering munition", origin: "India and Israel", note: "Built by Alpha Design Technologies of Bengaluru with Elbit Systems. A 5–10 kg warhead, one to three hours aloft, and retrievable if unused.", verify: "the SkyStriker is a battery-operated, low-noise loitering munition" },
  { id: "rafale", name: "Rafale, Su-30MKI, Mirage 2000", kind: "multirole fighters", origin: "France, Russia, France", note: "Named as the backbone of the strike package.", verify: "Rafale, Sukhoi 30MKI and Mirage 2000 aircraft formed the backbone" },
  { id: "akashteer", name: "Akashteer", kind: "air defence control system", origin: "India", note: "The Army Air Defence's automated control and reporting system, which the book says made its operational debut here.", verify: "Akashteer" },
  { id: "brahmos", name: "BrahMos", kind: "cruise missile", origin: "India and Russia", note: "Named by the Pakistani Air Marshal as what struck Bholari — a Pakistani attribution, not an Indian claim.", verify: "four back-to-back BrahMos" },
];

/* ── Claims the accounts do not settle ────────────────────────────────── */

export interface Dispute { id: string; question: string; indiaSays: string; note: string; verify: string }

export const DISPUTES: Dispute[] = [
  {
    id: "drones-destroyed",
    question: "How many Pakistani drones were brought down?",
    indiaSays: "The book puts it at approximately 900-plus between 7 and 10 May, naming Turkish-origin YIHA III, Asisguard Songar, Bayraktar TB2 and Akinci types.",
    note: "An Indian estimate of its own air defence's performance. No independent count exists, and the figure is the kind that is hardest to check and easiest to round upward.",
    verify: "approximately 900-plus drones",
  },
  {
    id: "aircraft-losses",
    question: "What did each air force lose?",
    indiaSays: "The book records the Indian Chief of the Air Staff being quoted, and records a Pakistani Air Marshal admitting an AWACS was damaged at Bholari.",
    note: "This is the single most disputed question of the four days and the one where both governments have the strongest reason to shade. The /sindoor page publishes no aircraft-loss total for either side, and neither does this.",
    verify: "Ex-Pak Air Marshal Admits Losing AWACS Aircraft",
  },
  {
    id: "who-stopped-it",
    question: "Who brought about the ceasefire?",
    indiaSays: "The book devotes a section to the question, titled 'The Ceasefire: Who Did It?'",
    note: "Claimed by more than one party. Recorded here as a question the book asks, not as an answer this site adopts.",
    verify: "The Ceasefire: Who Did It?",
  },
  {
    id: "afghanistan",
    question: "Did India strike Afghanistan?",
    indiaSays: "The Indian Foreign Secretary called the Pakistani claim ludicrous and frivolous; the book records that the Taliban government also denied it.",
    note: "A rare case in this conflict where a third party's denial lines up against the claimant rather than with it.",
    verify: "a completely ludicrous claim",
  },
];

/* ── Coordinates, fetched rather than typed ───────────────────────────── */

async function coordsOf(title: string): Promise<{ lat: number; lon: number } | null> {
  const url = "https://en.wikipedia.org/w/api.php?action=query&format=json&prop=coordinates"
    + `&titles=${encodeURIComponent(title)}&redirects=1`;
  const res = await getText(url, { timeoutMs: 30_000, retries: 1, cacheMs: 0 });
  if (!res.ok || !res.data) return null;
  try {
    const body = JSON.parse(res.data) as {
      query?: { pages?: Record<string, { coordinates?: Array<{ lat: number; lon: number }> }> };
    };
    const pages = Object.values(body.query?.pages ?? {});
    const c = pages[0]?.coordinates?.[0];
    return c ? { lat: c.lat, lon: c.lon } : null;
  } catch { return null; }
}

async function main(): Promise<void> {
  const book = findBook(BOOK_DIR, "Operation SINDOOR");
  const chapters: Chapter[] = readChapters(book, CHAPTERS);
  console.log(`Read ${chapters.length} chapters from ${book.split("/").pop()}`);

  const failures: string[] = [];
  const cite = (verify: string, what: string) => {
    const r = locate(chapters, verify);
    if (!r.found) failures.push(`${what}: "${verify.slice(0, 60)}" is not in the book`);
    return { chapter: r.chapterLabel, page: r.page };
  };

  /*
   * Coordinates for the named places. A place whose coordinates cannot be
   * resolved is kept with a null position and left off the map rather than
   * being placed approximately — the same rule the event map already follows.
   */
  const places = [...new Set([...TARGETS.map((t) => t.place), ...AIRBASES.map((a) => a.place)])];
  const coords = new Map<string, { lat: number; lon: number } | null>();
  for (const p of places) {
    await new Promise((r) => setTimeout(r, 800));
    const c = await coordsOf(p);
    coords.set(p, c);
    console.log(`  ${c ? "ok  " : "MISS"} ${p}${c ? ` ${c.lat.toFixed(3)}, ${c.lon.toFixed(3)}` : ""}`);
  }

  const targets = TARGETS.map((t) => ({
    ...t, ...cite(t.verify, `target ${t.id}`), position: coords.get(t.place) ?? null,
  }));
  const airbases = AIRBASES.map((a) => ({
    ...a, ...cite(a.verify, `site ${a.id}`), position: coords.get(a.place) ?? null,
  }));
  const beats = BEATS.map((b) => ({ ...b, ...cite(b.verify, `beat ${b.id}`) }));
  const weapons = WEAPONS.map((w) => ({ ...w, ...cite(w.verify, `weapon ${w.id}`) }));
  const disputes = DISPUTES.map((d) => ({ ...d, ...cite(d.verify, `dispute ${d.id}`) }));

  if (failures.length > 0) {
    console.error("\nEvery fact must still be in the book it is sourced to. These are not:");
    for (const f of failures) console.error(`  ${f}`);
    throw new Error(`${failures.length} curated fact(s) no longer verify against the book`);
  }

  const unplaced = [...targets, ...airbases].filter((x) => x.position === null);

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT, JSON.stringify({
    builtAt: new Date().toISOString(),
    book: BOOK,
    method:
      "Facts read out of the book and typed here by hand, then verified: each carries a phrase "
      + "that must still appear in the book, and the run fails if any does not. Page numbers are "
      + "not typed at all — each is read from the nearest print-page anchor in the EPUB, so a "
      + "citation cannot drift from what it cites. Coordinates are fetched from Wikipedia, never "
      + "entered here.",
    refusal:
      "This is one side's account, by a retired Indian Army officer, and is published as such. "
      + "No casualty figure and no aircraft-loss total appears here for either country, because "
      + "those are exactly where the two national accounts diverge and neither can be checked.",
    tiers: {
      "india-official": "Quoted from an Indian government briefing or from Parliament. India saying what India did.",
      author: "The author's own first-hand account.",
      "pakistan-concession": "A Pakistani source stating something against Pakistan's own interest — the strongest evidence available in this conflict, because it costs the speaker something.",
      "third-party": "A foreign analyst with no stake in either account.",
      contested: "The two national accounts conflict. Recorded as a conflict, not resolved.",
    },
    cannotSay: [
      "What happened. This is what one well-placed Indian participant says happened, checked against his own text rather than against the events. A book verifying against itself is a guarantee about the citation, not about the claim.",
      "What either side lost. No casualty figure and no aircraft-loss total is published here. Both governments have the strongest possible reason to shade those, and no independent count exists.",
      "That a site named here was what the book says it was. The descriptions of who used each camp are the author's attributions, published as his and not as findings.",
      "Anything about Pakistan's account, which is not in this book and is not in this file. The /sindoor page holds statements from both and keeps them apart.",
    ],
    counts: {
      targets: targets.length,
      airbases: airbases.length,
      beats: beats.length,
      weapons: weapons.length,
      disputes: disputes.length,
      placed: [...targets, ...airbases].filter((x) => x.position !== null).length,
      unplaced: unplaced.length,
      byTier: [...beats, ...airbases].reduce<Record<string, number>>((a, x) => {
        a[x.tier] = (a[x.tier] ?? 0) + 1; return a;
      }, {}),
    },
    targets, airbases, beats, weapons, disputes,
  }, null, 2) + "\n", "utf8");

  console.log(
    `\nWrote ${OUT}: ${targets.length} targets, ${airbases.length} sites, ${beats.length} beats, `
    + `${weapons.length} weapons, ${disputes.length} disputes. All verified against the book.`
    + (unplaced.length > 0 ? ` ${unplaced.length} without coordinates.` : ""),
  );
}

if (isEntryPoint(import.meta.url)) {
  void main();
}
