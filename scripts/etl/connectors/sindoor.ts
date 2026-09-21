/**
 * A dated, cited sequence for Operation Sindoor — and both sides' claims kept apart.
 *
 * `npm run sindoor:build`. Writes data/defence/sindoor.json. CI only.
 *
 * ── The only honest way to do this ───────────────────────────────────────
 *
 * Operation Sindoor is a recent military exchange between two nuclear-armed
 * states. India and Pakistan published incompatible accounts of it: of what
 * was struck, of what was lost, of who stopped first. Aircraft losses and
 * casualty figures in particular are claims by belligerents, not
 * measurements, and both governments are interested parties.
 *
 * So this connector does not decide what happened. It reads a heavily cited
 * account — 476 references, 320 of them news citations, 655 dated lines
 * across 13 sections, which the probe measured before a line of this was
 * written — and extracts the dated statements WITH the citation attached to
 * each one and WITH the claimant named where the text names one.
 *
 * The output is therefore not a timeline of the operation. It is a timeline
 * of what has been reported about the operation, which is a different and
 * weaker object, and the only one the sources support. A reader can follow
 * any entry back to the outlet that carried it.
 *
 * ── Why claimant detection is the centre of this file ────────────────────
 *
 * "India struck nine sites" and "India said it struck nine sites" are
 * different sentences, and a timeline that flattens the second into the first
 * has taken a side. Every extracted entry is tagged with who is speaking —
 * India, Pakistan, a third party, or nobody identifiable — and the page built
 * on this shows the two national accounts in separate columns rather than
 * interleaving them into one authoritative sequence.
 *
 * Entries with no identifiable claimant are the dangerous ones, because they
 * read as settled fact. They are counted and published as their own tier
 * rather than quietly promoted.
 *
 * ── What is deliberately not extracted ───────────────────────────────────
 *
 * No casualty total, no aircraft-loss total, no "who won". Those numbers
 * exist in the source and are exactly the ones where the two accounts
 * diverge most and where a single figure would be a fabrication. Where a
 * sentence carries such a figure it is kept as the sentence, attributed,
 * never lifted into a number this project publishes as its own.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getJson } from "../lib/http";
import { isEntryPoint } from "../lib/entry";
import { plain } from "../lib/wikitext";

const OUT_DIR = join(process.cwd(), "data", "defence");
const OUT = join(OUT_DIR, "sindoor.json");
const WIKI = "https://en.wikipedia.org/w/api.php";

/**
 * The articles read, in order.
 *
 * "2025 India–Pakistan conflict" is NOT here. The probe asked for it and got
 * counts identical to "Operation Sindoor" down to the last reference, so the
 * two titles are one article and reading both would double every event.
 * "Timeline of the 2025 India–Pakistan conflict" is not here either: it
 * returned nothing, so no dedicated timeline article exists and the sequence
 * has to come out of the main article's prose.
 */
const PAGES = [
  { page: "Operation_Sindoor", role: "operation" as const },
  { page: "Pahalgam_attack", role: "trigger" as const },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export type Claimant = "India" | "Pakistan" | "third-party" | "unattributed";

export interface Entry {
  /** ISO date, or a day-month with the year inferred — `yearInferred` says which. */
  date: string;
  yearInferred: boolean;
  /** The sentence as published, markup removed. Never paraphrased. */
  text: string;
  /** The article section it came from. */
  section: string;
  /** Which article. */
  page: string;
  role: "operation" | "trigger";
  claimant: Claimant;
  /** What made the claimant call, so the call can be checked. */
  claimantCue: string | null;
  /** Whether the sentence reports a claim rather than asserting a fact. */
  reported: boolean;
  /** Outlets cited inside this sentence, from its own <ref> tags. */
  citations: Array<{ publisher: string | null; title: string | null; url: string | null }>;
}

/**
 * Who is speaking, from the words the sentence itself uses.
 *
 * Deliberately shallow: it looks for a named source of the claim, not for the
 * subject of the sentence. "Pakistan's military said it shot down five jets"
 * is a Pakistani claim; "India struck Muridke" with no attributing verb is
 * unattributed, however confidently it reads, and is tagged as such rather
 * than credited to India.
 */
export function claimantOf(sentence: string): { claimant: Claimant; cue: string | null; reported: boolean } {
  const s = sentence.toLowerCase();

  /*
   * A reporting verb near a named source is what makes a claim a claim.
   * Without one, the sentence is asserting, and this refuses to guess who is
   * behind the assertion.
   */
  const reported = /\b(said|claimed|stated|announced|asserted|denied|according to|reported that|told reporters|briefing)\b/.test(s);

  const INDIAN = [
    "indian army", "indian air force", "indian navy", "india's military",
    "indian military", "ministry of external affairs", "press information bureau",
    "indian officials", "indian government", "new delhi said", "india said",
    "india claimed", "indian defence ministry", "dgmo",
  ];
  const PAKISTANI = [
    "ispr", "inter-services public relations", "pakistan army", "pakistan air force",
    "pakistani military", "pakistan's military", "pakistani officials", "pakistan said",
    "pakistan claimed", "islamabad said", "pakistani government", "pakistan's foreign office",
  ];

  const hitIn = INDIAN.find((k) => s.includes(k));
  const hitPk = PAKISTANI.find((k) => s.includes(k));

  /*
   * A sentence naming both is not attributed to either. These are the
   * "India said X, Pakistan denied it" constructions, and assigning them to
   * whichever keyword came first in a list would be arbitrary.
   */
  if (hitIn && hitPk) return { claimant: "third-party", cue: `${hitIn} + ${hitPk}`, reported };
  if (hitIn) return { claimant: "India", cue: hitIn, reported };
  if (hitPk) return { claimant: "Pakistan", cue: hitPk, reported };

  const THIRD = [
    "reuters", "associated press", "the new york times", "cnn", "bbc", "al jazeera",
    "united nations", "washington", "white house", "donald trump", "rubio",
    "analysts", "satellite imagery", "researchers",
  ];
  const hit3 = THIRD.find((k) => s.includes(k));
  if (hit3) return { claimant: "third-party", cue: hit3, reported };

  return { claimant: "unattributed", cue: null, reported };
}

/**
 * The citations inside one raw sentence, read before markup is stripped.
 *
 * `plain` removes <ref> tags entirely, which is right for reading text and
 * wrong here: the reference IS the point. So refs are pulled out first and
 * their cite templates read for a publisher, a title and a URL.
 */
export function citationsIn(raw: string): Entry["citations"] {
  const out: Entry["citations"] = [];
  for (const m of raw.matchAll(/<ref[^>]*>([\s\S]*?)<\/ref>/gi)) {
    const body = m[1] ?? "";
    const field = (name: string): string | null => {
      const f = new RegExp(`\\|\\s*${name}\\s*=\\s*([^|}]+)`, "i").exec(body);
      return f?.[1]?.trim().replace(/\s+/g, " ") || null;
    };
    const publisher = field("work") ?? field("publisher") ?? field("newspaper") ?? field("website");
    out.push({
      publisher: publisher ? plain(publisher) : null,
      title: field("title") ? plain(field("title") ?? "") : null,
      url: field("url"),
    });
  }
  return out;
}

/**
 * Split a paragraph into sentences without cutting a citation in half.
 *
 * A naive split on ". " lands inside "U.S." and inside every `|date=2025-05-07`
 * in a reference, so refs are masked to a placeholder, the text is split, and
 * the refs are restored to whichever sentence held them.
 */
export function sentencesOf(paragraph: string): string[] {
  const refs: string[] = [];
  const masked = paragraph.replace(/<ref[^>]*>[\s\S]*?<\/ref>|<ref[^>]*\/>/gi, (m) => {
    refs.push(m);
    return `\u0000${refs.length - 1}\u0000`;
  });
  /*
   * The boundary is a full stop, THEN any masked references, then the space.
   *
   * Almost every sentence in this article ends `…7 May.<ref>…</ref>` — so
   * once the refs are masked, the character after the full stop is the
   * placeholder rather than a space, and a lookbehind of plain `[.!?]` never
   * fires. The first version returned the whole paragraph as one sentence and
   * hung every citation in it on that one entry.
   */
  const parts = masked.split(/(?<=[.!?](?:\u0000\d+\u0000)*)\s+(?=[A-Z"“'])/);
  return parts
    .map((p) => p.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => refs[Number(i)] ?? ""))
    .filter((p) => p.trim() !== "");
}

interface WikiRes { parse?: { wikitext?: { "*"?: string } } }

async function wikitextOf(page: string): Promise<string | null> {
  const res = await getJson<WikiRes>(
    `${WIKI}?action=parse&format=json&prop=wikitext&page=${encodeURIComponent(page)}&redirects=1`,
    { timeoutMs: 45_000, retries: 1, cacheMs: 0 },
  );
  return res.ok ? (res.data?.parse?.wikitext?.["*"] ?? null) : null;
}

async function main(): Promise<void> {
  const entries: Entry[] = [];
  const perPage: Array<{
    page: string; ok: boolean; sections: number; sentences: number;
    dated: number; withCitation: number;
  }> = [];

  for (const { page, role } of PAGES) {
    const text = await wikitextOf(page);
    if (text === null) {
      perPage.push({ page, ok: false, sections: 0, sentences: 0, dated: 0, withCitation: 0 });
      continue;
    }

    let section = "(lead)";
    let sentences = 0;
    let dated = 0;
    let withCitation = 0;
    /**
     * The year carried forward.
     *
     * Most dated sentences say "7 May" and not "7 May 2025", because the
     * article's context supplies the year. Taking the year from the nearest
     * preceding date that stated one is mechanical and auditable — and every
     * entry records whether its year was stated or inferred, so a reader can
     * discount the inferred ones rather than having to trust them.
     */
    let lastYear: number | null = null;

    for (const rawLine of text.split(/\n\n+/)) {
      const heading = /^\s*(==+)\s*(.+?)\s*\1\s*$/m.exec(rawLine);
      if (heading) { section = plain(heading[2] ?? "").trim() || section; continue; }
      // Tables, templates and file lines are not prose.
      if (/^\s*[{|!*#:]/.test(rawLine)) continue;

      for (const raw of sentencesOf(rawLine)) {
        sentences++;
        const dm = /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b(?:\s+(\d{4}))?/i.exec(raw);
        if (!dm) continue;

        const day = Number.parseInt(dm[1] ?? "", 10);
        const monthName = (dm[2] ?? "").replace(/^./, (c) => c.toUpperCase());
        const month = MONTHS.indexOf(monthName) + 1;
        const statedYear = dm[3] ? Number.parseInt(dm[3], 10) : null;
        if (statedYear) lastYear = statedYear;
        const year = statedYear ?? lastYear;
        if (!year || month < 1 || day < 1 || day > 31) continue;

        const clean = plain(raw).trim();
        // A fragment is not an event. Short strings here are captions and
        // list scraps that survived the prose filter.
        if (clean.length < 40) continue;

        const { claimant, cue, reported } = claimantOf(clean);
        const citations = citationsIn(raw);
        if (citations.length > 0) withCitation++;
        dated++;

        entries.push({
          date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
          yearInferred: statedYear === null,
          text: clean,
          section,
          page,
          role,
          claimant,
          claimantCue: cue,
          reported,
          citations,
        });
      }
    }

    perPage.push({
      page, ok: true,
      sections: new Set(entries.filter((e) => e.page === page).map((e) => e.section)).size,
      sentences, dated, withCitation,
    });
    console.log(`  ${page}: ${sentences} sentences, ${dated} dated, ${withCitation} carrying a citation`);
  }

  if (entries.length === 0) {
    throw new Error("no dated entries extracted — refusing to publish an empty timeline over a good one");
  }

  /*
   * Deduplicate on date plus the first eighty characters. The same sentence
   * appears in both a section and the lead often enough to matter, and a
   * timeline that shows an event twice reads as two events.
   */
  const seen = new Set<string>();
  const unique = entries.filter((e) => {
    const k = `${e.date}\u0000${e.text.slice(0, 80).toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  unique.sort((a, b) => (a.date === b.date ? a.text.localeCompare(b.text) : a.date.localeCompare(b.date)));

  const byClaimant: Record<Claimant, number> = { India: 0, Pakistan: 0, "third-party": 0, unattributed: 0 };
  for (const e of unique) byClaimant[e.claimant]++;

  const byDate = new Map<string, number>();
  for (const e of unique) byDate.set(e.date, (byDate.get(e.date) ?? 0) + 1);

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT, JSON.stringify({
    builtAt: new Date().toISOString(),
    source:
      "English Wikipedia's 'Operation Sindoor' and 'Pahalgam attack' articles, read as prose and "
      + "split into sentences. The probe measured 476 references and 320 news citations on the "
      + "first of those before this connector was written.",
    method:
      "Every sentence carrying a day and a month is kept, with the citations from its own <ref> "
      + "tags attached and with the claimant named where the sentence names one. Years are taken "
      + "from the sentence where stated and otherwise carried forward from the nearest preceding "
      + "date that stated one; each entry records which. Sentences shorter than forty characters "
      + "after markup removal are dropped as captions and list fragments.",
    refusal:
      "This is not a timeline of Operation Sindoor. It is a timeline of what has been reported "
      + "about it, which is a weaker object and the only one the sources support. No casualty "
      + "total, no aircraft-loss figure and no judgement about who prevailed is computed here — "
      + "those are precisely where the two national accounts diverge, and a single number would "
      + "be this project inventing one.",
    cannotSay: [
      "What happened. India and Pakistan published incompatible accounts and both are interested parties. Every entry here is a statement someone made, carried with the name of whoever made it.",
      "Whether any claim is true. Aircraft losses and casualty figures in particular are belligerent claims rather than measurements, and nothing here adjudicates between them.",
      "Anything about entries with no identifiable claimant. Those read as settled fact and are not: they are sentences whose source the article did not name in the same sentence, and they are counted separately for that reason.",
      "Anything the article does not carry. This is a reconstruction from one encyclopedia entry and the outlets it cites, not from primary military records, which are not public.",
    ],
    counts: {
      entries: unique.length,
      duplicatesDropped: entries.length - unique.length,
      withCitation: unique.filter((e) => e.citations.length > 0).length,
      yearInferred: unique.filter((e) => e.yearInferred).length,
      reported: unique.filter((e) => e.reported).length,
      days: byDate.size,
      byClaimant,
    },
    perPage,
    days: [...byDate].map(([date, n]) => ({ date, n })).sort((a, b) => a.date.localeCompare(b.date)),
    entries: unique,
  }, null, 2) + "\n", "utf8");

  console.log(
    `\nWrote ${OUT}: ${unique.length} dated entries across ${byDate.size} days `
    + `(India ${byClaimant.India}, Pakistan ${byClaimant.Pakistan}, `
    + `third-party ${byClaimant["third-party"]}, unattributed ${byClaimant.unattributed}).`,
  );
}

if (isEntryPoint(import.meta.url)) {
  void main();
}
