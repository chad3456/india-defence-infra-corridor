/**
 * What Hindi films put on screen, 1995 to 2025, and how they end it.
 *
 * `npm run bollywood:ingest`. Writes data/cinema/bollywood-plots.json. CI only.
 *
 * ── The confound this connector is built around ──────────────────────────
 *
 * The obvious way to measure this is to count words in plot summaries by year
 * and draw the line. That measurement is worthless, and it is worthless in a
 * way that produces a convincing rising curve.
 *
 * Wikipedia plot summaries have got longer. A 1996 film often has eighty
 * words; a 2023 film often has six hundred. Any marker counted per film
 * therefore rises across the period whatever cinema did, because there is more
 * text to find it in. A chart of "films mentioning revenge, by year" would
 * show a steep climb, would be entirely real as a count, and would be a fact
 * about Wikipedia's editing conventions rather than about Hindi cinema.
 *
 * So every rate here is per thousand words of plot summary, the raw counts are
 * published beside the corrected ones, and the median summary length by year
 * is published as its own series so a reader can see the confound directly
 * rather than take this note on trust.
 *
 * ── The three tiers, which are not the same claim ────────────────────────
 *
 *   presence   a theme appears in the summary. Revenge is in the plot.
 *   outcome    how the film ends for whoever did the harm — punished,
 *              unpunished, or redeemed. Closer to endorsement than presence,
 *              because a story that lets its criminal win has taken a
 *              position that a story about crime has not.
 *   framing    the summary's own words valorise the character: he is the
 *              hero, he is admired, he is feared and respected.
 *
 * Presence is the weakest and easiest to over-read. A film can be about
 * revenge and be against it. The tiers are never summed.
 *
 * ── What this cannot do ──────────────────────────────────────────────────
 *
 * It cannot show that films caused anything. No dataset of films can: there is
 * no control group, no counterfactual India, and every candidate cause moves
 * together over thirty years. What is measured here is what was depicted and
 * how it resolved. Whether depiction changes behaviour is a question for
 * research designs this is not, and the page says so in its own words rather
 * than in a footnote.
 *
 * It is also reading a summary, not a film. A summary is written by an editor
 * who chose what to include; tone, irony, sympathy and camera are all invisible
 * to it. A film that depicts a gangster in order to condemn him reads here
 * exactly like one that depicts him in order to thrill.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "../lib/http";
import { isEntryPoint } from "../lib/entry";

const OUT_DIR = join(process.cwd(), "data", "cinema");
const OUT = join(OUT_DIR, "bollywood-plots.json");
const API = "https://en.wikipedia.org/w/api.php";

const FIRST_YEAR = 1995;
const LAST_YEAR = 2025;
/** Wikipedia asks for serial requests from scripts; this is one every 1.2s. */
const GAP_MS = 1200;
/** Titles per batched content request. The API caps anonymous callers at 50. */
const BATCH = 40;

let last = 0;
async function pace(): Promise<void> {
  const w = GAP_MS - (Date.now() - last);
  if (w > 0) await new Promise((r) => setTimeout(r, w));
  last = Date.now();
}

async function api(params: Record<string, string>): Promise<unknown | null> {
  await pace();
  const qs = new URLSearchParams({ format: "json", formatversion: "2", ...params });
  const res = await getText(`${API}?${qs.toString()}`, { timeoutMs: 45_000, retries: 1, cacheMs: 0 });
  if (!res.ok || !res.data) return null;
  try { return JSON.parse(res.data); } catch { return null; }
}

/**
 * The year list, under whichever title that year uses.
 *
 * The naming is not consistent across thirty years — some years are "List of
 * Hindi films of 1996", some "List of Bollywood films of 1996". A missing
 * article answers 200 with an empty parse rather than 404, so each candidate
 * is tried and which one answered is published.
 */
const LIST_TITLES = (y: number): string[] => [
  `List of Hindi films of ${y}`,
  `List of Bollywood films of ${y}`,
  `${y} in Indian cinema`,
];

async function wikitextOf(title: string): Promise<string | null> {
  const body = await api({ action: "parse", prop: "wikitext", redirects: "1", page: title }) as
    { parse?: { wikitext?: string } } | null;
  const wt = body?.parse?.wikitext;
  return typeof wt === "string" && wt.length > 200 ? wt : null;
}

/**
 * Film titles out of a year list.
 *
 * The lists are wikitables whose first linked title in each row is the film.
 * Rows are taken rather than every link on the page, because the page also
 * links months, genres, studios and every actor alive.
 */
export function filmsFromList(wikitext: string): string[] {
  const out: string[] = [];
  for (const row of wikitext.split(/\n\|-/)) {
    const m = /\[\[([^[\]|#]+)(?:\|[^[\]]*)?\]\]/.exec(row);
    if (!m) continue;
    const t = (m[1] ?? "").trim();
    if (t === "") continue;
    // Months, categories, and the list's own navigation.
    if (/^(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/i.test(t)) continue;
    if (/^(?:Category|File|Image|Template|List of|Wikipedia):/i.test(t)) continue;
    if (/^\d{4}$/.test(t)) continue;
    out.push(t);
  }
  return [...new Set(out)];
}

/** The plot section of a film article, as plain-ish text. */
export function plotOf(wikitext: string): string {
  const m = /==\s*(?:Plot|Synopsis|Story|Plot summary)\s*==([\s\S]*?)(?:\n==[^=]|$)/i.exec(wikitext);
  if (!m) return "";
  let s = m[1] ?? "";
  s = s.replace(/<ref[^>]*\/>/gi, " ").replace(/<ref[\s\S]*?<\/ref>/gi, " ");
  s = s.replace(/\{\{[^{}]*\}\}/g, " ");
  for (let i = 0; i < 4; i++) {
    s = s.replace(/\[\[(?:File|Image):[^[\]]*\]\]/gi, " ");
    s = s.replace(/\[\[([^[\]|]+)\|([^[\]]+)\]\]/g, "$2").replace(/\[\[([^[\]]+)\]\]/g, "$1");
  }
  s = s.replace(/'''?/g, "").replace(/<[^>]+>/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Genres from the infobox.
 *
 * The obvious pattern — capture up to the next pipe, since that is where an
 * infobox field ends — is wrong here, because a wikilink contains a pipe. On
 * `| genre = [[Action film|Action]], Drama` it captured "[[Action film" and
 * threw the rest away, which loses the genre on every film whose genre is
 * linked, which is most of them. The failure is silent: a shorter genre list
 * looks like a film with fewer genres.
 *
 * So the line is taken whole, wikilinks are resolved to their display text
 * first, and only then is the field split at a pipe.
 */
export function genresOf(wikitext: string): string[] {
  const m = /\|\s*genre\s*=\s*([^\n]+)/i.exec(wikitext);
  if (!m) return [];
  const resolved = (m[1] ?? "")
    .replace(/\[\[([^[\]|]+)\|([^[\]]+)\]\]/g, "$2")
    .replace(/\[\[|\]\]/g, "");
  // Now a pipe really is the end of the field.
  const field = resolved.split("|")[0] ?? "";
  return field
    .split(/[,/]|\band\b/i)
    .map((g) => g.trim().toLowerCase().replace(/\{\{.*$/, "").trim())
    .filter((g) => g.length > 2 && g.length < 30);
}

/* ── The markers ──────────────────────────────────────────────────────── */

export type Tier = "presence" | "outcome" | "framing";

export interface Marker { id: string; label: string; tier: Tier; note: string; re: RegExp }

/**
 * Every marker is a regular expression over a plot summary and nothing more.
 *
 * Each carries the sentence it matched into the published record, so any count
 * on the page can be opened and checked against the text it came from. A
 * marker with no examples published is a number nobody can audit.
 */
export const MARKERS: Marker[] = [
  /* Presence — the theme is in the story. The weakest tier. */
  { id: "revenge", label: "Revenge drives the plot", tier: "presence",
    note: "A film can be about revenge and be against it. Presence is not endorsement.",
    re: /\b(?:revenge|avenge[sd]?|avenging|vendetta|retribution|badla)\b/i },
  { id: "underworld", label: "Organised crime", tier: "presence",
    note: "Gangs, dons, the underworld, the mafia.",
    re: /\b(?:underworld|mafia|gangster|mobster|don\b|smuggl(?:er|ing)|extortion|racket)\b/i },
  { id: "vigilante", label: "Taking the law into his own hands", tier: "presence",
    note: "The protagonist acts outside the law against wrongdoers.",
    re: /\b(?:vigilante|takes? the law into (?:his|her|their) own hands|outside the law)\b/i },
  { id: "police-corrupt", label: "Police or state shown corrupt", tier: "presence",
    note: "Corrupt officers, bought officials, a compromised system.",
    re: /\b(?:corrupt(?:ion)?\s+(?:police|cop|officer|inspector|politician|minister|system)|(?:police|politician|minister)[^.]{0,30}\bcorrupt)/i },
  { id: "stalking", label: "Pursuit framed as courtship", tier: "presence",
    note: "A documented convention: persistent pursuit of a woman who refuses, presented as romance.",
    re: /\b(?:stalk(?:s|ed|ing)|pursues her (?:relentlessly|despite)|follows her (?:everywhere|around)|woo(?:s|ing) her despite)\b/i },
  { id: "honour", label: "Family honour as motive", tier: "presence",
    note: "Izzat, family name, honour as the reason for violence.",
    re: /\b(?:family(?:'s)? honou?r|izzat|honou?r killing|restore[sd]? (?:his|her|their|the family'?s?) honou?r)\b/i },
  { id: "dowry", label: "Dowry or domestic violence", tier: "presence",
    note: "Dowry demands, harassment, violence inside a marriage.",
    re: /\b(?:dowry|domestic (?:violence|abuse)|beats? his wife|abusive husband)\b/i },
  { id: "caste-communal", label: "Caste or communal conflict", tier: "presence",
    note: "Caste or religious community named as the axis of the conflict.",
    re: /\b(?:caste|dalit|untouchab|communal (?:riot|violence|tension)|Hindu[- ]Muslim)\b/i },

  /*
   * Outcome — what kind of ending the summary describes.
   *
   * These run over the ENDING only, not the whole plot. An outcome is how a
   * story resolves, and "the villain is killed" in the second act is a plot
   * event rather than a resolution; scoring it as one would file a film that
   * kills its antagonist halfway and lets the real one win as a film where
   * crime was punished.
   *
   * They also deliberately do not claim WHO. A summary sentence reading "is
   * shot dead" is frequently about the hero, the hero's father, or a bystander,
   * and no regular expression over English prose is going to resolve the
   * referent reliably. So these record the KIND of ending — a reckoning, an
   * escape, a reconciliation — and the labels say exactly that. The first
   * version of these patterns tried to name the villain and matched almost
   * nothing: across 2,670 films it fired on under one per cent, which is not a
   * finding about cinema but a broken instrument reporting silence.
   */
  { id: "ending-reckoning", label: "Ends in a reckoning", tier: "outcome",
    note: "The closing lines describe a death, an arrest, a sentence or a surrender. It does not say whose — a summary rarely makes the referent resolvable, and this does not guess.",
    re: /\b(?:is (?:killed|shot|arrested|jailed|imprisoned|hanged|sentenced|executed|caught)|kills? (?:him|her|them)|shoots? (?:him|her|them) dead|surrenders?|is brought to justice|taken into custody|dies in|is beaten to death|police arrive|behind bars)\b/i },
  { id: "ending-escape", label: "Ends with the wrongdoer still standing", tier: "outcome",
    note: "The closing lines describe an escape, an evasion, or an ascent — someone who did harm ends the film free, in power, or unaccounted for.",
    re: /\b(?:escapes?|flees?|gets away|walks free|goes free|is never caught|remains at large|takes over|becomes the (?:new )?(?:don|boss|king|leader)|rises to power|vanishes|disappears without)\b/i },
  { id: "ending-reconciliation", label: "Ends in reconciliation", tier: "outcome",
    note: "The closing lines describe reform, forgiveness, reunion or a sacrifice that settles the story — an ending that asks the audience to let go rather than to see someone punished.",
    re: /\b(?:reform(?:s|ed)|repent(?:s|ed|ance)|redeem(?:s|ed|ption)|forgive[sn]?|reconcil(?:e|es|ed|iation)|reunited?|sacrifices? (?:himself|herself|his life|her life)|apologi[sz]es?|makes? peace)\b/i },

  /*
   * Framing — the summary's own words valorise. The narrowest tier, and the
   * closest thing here to the question the brief actually asked.
   *
   * Broadened from a first version that required near-exact phrases and
   * consequently fired on about one film in a hundred. These still require the
   * summary to make an evaluative statement rather than merely narrate.
   */
  { id: "feared-respected", label: "Feared, respected, admired", tier: "framing",
    note: "The summary states that others fear, respect, admire or look up to the character — an evaluation, not an event.",
    re: /\b(?:feared|respected|revered|idoli[sz]ed|admired|worshipped|looks? up to|commands? (?:respect|fear|loyalty)|legendary|notorious)\b/i },
  { id: "robin-hood", label: "Crime framed as justice", tier: "framing",
    note: "Robin-Hood framing: the wrongdoing is for the poor, the oppressed or the wronged.",
    re: /\b(?:robin hood|steals? from the rich|fights? for the (?:poor|oppressed|downtrodden|helpless)|champion of the (?:poor|oppressed)|protector of the (?:poor|village|weak)|messiah|saviou?r of)\b/i },
  { id: "hero-word", label: "Called a hero for it", tier: "framing",
    note: "The summary calls the character a hero, a saviour or a legend, or says he is celebrated.",
    re: /\b(?:hailed as|becomes? a hero|is a hero|declared a hero|celebrated as|honou?red as|a local legend|folk hero)\b/i },
  { id: "rise-to-power", label: "A rise-to-power arc", tier: "framing",
    note: "The summary narrates ascent through crime as ascent — ranks climbed, an empire built.",
    re: /\b(?:rises? (?:through the ranks|to (?:power|the top|prominence))|builds? (?:an|his|her) (?:empire|network)|climbs? the ranks|kingpin|crime lord|underworld (?:boss|king)|makes? a name for)\b/i },
];

/** Title words that announce the subject before the film starts. */
export const TITLE_WORDS = /\b(?:don|gangster|bhai|daaku|dacoit|khiladi|badmaash|mafia|gunda|hafta|encounter|shootout|wanted|criminal|kabzaa|arjun|angaar)\b/i;

export interface Film {
  title: string;
  year: number;
  /** Words in the plot summary. The control variable for everything else. */
  plotWords: number;
  /** Words in the closing passage the outcome markers were scored over. */
  endingWords: number;
  genres: string[];
  markers: string[];
  /** One matched sentence per marker, so every count can be opened. */
  evidence: Array<{ marker: string; quote: string }>;
  titleWord: boolean;
}

/** The sentence a marker matched, trimmed to something quotable. */
function sentenceFor(plot: string, re: RegExp): string {
  for (const s of plot.split(/(?<=[.!?])\s+/)) {
    if (re.test(s)) return s.length > 260 ? `${s.slice(0, 257)}…` : s;
  }
  return "";
}

/**
 * Where a plot summary stops setting up and starts resolving.
 *
 * The last quarter of the sentences, with a floor of two and a ceiling of six.
 * A floor because a three-sentence summary has no measurable ending otherwise;
 * a ceiling because in a forty-sentence summary the last quarter is still most
 * of the third act and would readmit the mid-film events this scoping exists
 * to exclude.
 */
export function endingOf(plot: string): string {
  const sentences = plot.split(/(?<=[.!?])\s+/).filter((x) => x.trim().length > 0);
  if (sentences.length === 0) return "";
  const take = Math.min(6, Math.max(2, Math.ceil(sentences.length * 0.25)));
  return sentences.slice(-take).join(" ");
}

export function measure(title: string, year: number, wikitext: string): Film | null {
  const plot = plotOf(wikitext);
  if (plot.length < 120) return null;
  const words = plot.split(/\s+/).filter(Boolean).length;
  const ending = endingOf(plot);
  const markers: string[] = [];
  const evidence: Array<{ marker: string; quote: string }> = [];
  for (const m of MARKERS) {
    /*
     * Outcome markers see only the ending; the other two tiers see the whole
     * summary. A reckoning in the second act is a plot event, not a
     * resolution, and scoring it as one files a film that kills a henchman
     * halfway and lets the real villain win as a film where crime was
     * punished.
     */
    const scope = m.tier === "outcome" ? ending : plot;
    if (!m.re.test(scope)) continue;
    markers.push(m.id);
    const q = sentenceFor(scope, m.re);
    if (q !== "") evidence.push({ marker: m.id, quote: q });
  }
  return {
    title, year, plotWords: words, endingWords: ending.split(/\s+/).filter(Boolean).length,
    genres: genresOf(wikitext), markers, evidence, titleWord: TITLE_WORDS.test(title),
  };
}

/**
 * A fingerprint of the instrument.
 *
 * The run caches films it has already measured, so a second run only fetches
 * what is new. That is right for the fetching and catastrophic for the
 * measuring: change a pattern and the stored films keep their old scores while
 * new ones get the new ones, and the corpus is then measured by two different
 * instruments with no sign of it in the output. Every rate would be a blend of
 * two definitions and every year-on-year comparison would be partly an
 * artefact of when a film happened to be collected.
 *
 * So the marker definitions are hashed. If the hash has moved, the cache is
 * dropped and everything is measured again by the instrument now in force.
 */
function instrumentHash(): string {
  const h = createHash("sha256");
  for (const m of MARKERS) h.update(`${m.id}|${m.tier}|${m.re.source}\n`);
  h.update(`title:${TITLE_WORDS.source}\n`);
  return h.digest("hex").slice(0, 16);
}

interface Stored { films?: Film[]; instrument?: string }

async function main(): Promise<void> {
  const stored: Stored = await readFile(OUT, "utf8").then((t) => JSON.parse(t) as Stored).catch(() => ({}));
  const instrument = instrumentHash();
  const sameInstrument = stored.instrument === instrument;
  if (!sameInstrument && (stored.films ?? []).length > 0) {
    console.log(
      `Marker definitions have changed (${stored.instrument ?? "none"} -> ${instrument}). `
      + `Re-measuring all ${(stored.films ?? []).length} films, because a corpus scored by two `
      + "different instruments would report the change as a change in cinema.",
    );
  }
  const have = new Map<string, Film>(
    sameInstrument ? (stored.films ?? []).map((f) => [`${f.year}::${f.title}`, f]) : [],
  );
  const carried = have.size;

  const perYear: Array<{ year: number; listTitle: string | null; listed: number; measured: number }> = [];

  for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
    let listWikitext: string | null = null;
    let listTitle: string | null = null;
    for (const t of LIST_TITLES(year)) {
      listWikitext = await wikitextOf(t);
      if (listWikitext !== null) { listTitle = t; break; }
    }
    if (listWikitext === null) {
      perYear.push({ year, listTitle: null, listed: 0, measured: 0 });
      console.log(`  ${year}: no list article answered`);
      continue;
    }

    const titles = filmsFromList(listWikitext);
    const wanted = titles.filter((t) => !have.has(`${year}::${t}`));
    let measured = 0;

    for (let i = 0; i < wanted.length; i += BATCH) {
      const slice = wanted.slice(i, i + BATCH);
      const body = await api({
        action: "query", prop: "revisions", rvprop: "content", rvslots: "main",
        redirects: "1", titles: slice.join("|"),
      }) as { query?: { pages?: Array<{ title?: string; revisions?: Array<{ slots?: { main?: { content?: string } } }> }> } } | null;
      for (const page of body?.query?.pages ?? []) {
        const wt = page.revisions?.[0]?.slots?.main?.content;
        const t = page.title;
        if (typeof wt !== "string" || typeof t !== "string") continue;
        /*
         * A list page links things that are not films — an actor, a studio, a
         * sequel's article. A page with no plot section is dropped rather than
         * counted as a film with no markers, which would dilute every rate on
         * the page with articles that were never films.
         */
        const f = measure(t, year, wt);
        if (f === null) continue;
        have.set(`${year}::${t}`, f);
        measured++;
      }
    }
    perYear.push({ year, listTitle, listed: titles.length, measured });
    console.log(`  ${year}: ${titles.length} listed, ${measured} new with a plot (${listTitle})`);
  }

  const films = [...have.values()].sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));
  if (films.length === 0) throw new Error("no films measured and none stored — refusing to publish an empty set");

  /* Per-year series, raw and corrected. Both, always, side by side. */
  const years = [...new Set(films.map((f) => f.year))].sort((a, b) => a - b);
  const median = (xs: number[]): number => {
    if (xs.length === 0) return 0;
    const s = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
  };

  const series = years.map((y) => {
    const inYear = films.filter((f) => f.year === y);
    const words = inYear.reduce((a, f) => a + f.plotWords, 0);
    const row: Record<string, number> = {
      year: y,
      films: inYear.length,
      medianPlotWords: median(inYear.map((f) => f.plotWords)),
      totalPlotWords: words,
      titleWord: inYear.filter((f) => f.titleWord).length,
    };
    for (const m of MARKERS) {
      const n = inYear.filter((f) => f.markers.includes(m.id)).length;
      row[`${m.id}__films`] = n;
      row[`${m.id}__shareOfFilms`] = inYear.length > 0 ? n / inYear.length : 0;
      /* The corrected measure: occurrences per thousand words of summary. */
      row[`${m.id}__per1kWords`] = words > 0 ? (n / words) * 1000 : 0;
    }
    return row;
  });

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT, JSON.stringify({
    builtAt: new Date().toISOString(),
    /* The instrument in force. If this moves, every film is measured again. */
    instrument,
    source:
      "English Wikipedia: the year list for each year from 1995 to 2025, then the plot section of "
      + "every linked film article that has one. Plot text and infobox genre only.",
    method:
      "Each marker is a regular expression over a plot summary. Every count publishes the sentence "
      + "it matched, so it can be opened and checked. Markers sit in three tiers — presence, "
      + "outcome, framing — which are never summed, because a film can be about revenge and be "
      + "against it.",
    confound:
      "Wikipedia plot summaries have got longer. Any marker counted per film therefore rises "
      + "across the period whatever cinema did, because there is more text to find it in. Every "
      + "rate is published both raw and per thousand words of summary, and the median summary "
      + "length by year is published as its own series so the confound can be seen rather than "
      + "taken on trust.",
    refusal:
      "This measures what was depicted and how it resolved. It does not and cannot show that "
      + "films caused anything: there is no control group, no counterfactual India, and every "
      + "candidate cause moves together over thirty years.",
    cannotSay: [
      "That films caused any change in behaviour, crime or attitudes. No dataset of films can show that. What is measured here is depiction and narrative outcome.",
      "What a film is actually like. This reads a summary written by an editor who chose what to include. Tone, irony, sympathy and camera are all invisible to it, so a film depicting a gangster to condemn him reads exactly like one depicting him to thrill.",
      "That a rising raw count is a rising trend in cinema. Summaries got longer; the corrected series is the one to read, and both are published.",
      "Anything about films with no English Wikipedia article or no plot section, which is most of the low-budget output of every year in this range.",
      "That presence means endorsement. A film can be about revenge and be against it. The outcome and framing tiers are narrower claims and are counted separately.",
    ],
    markers: MARKERS.map((m) => ({ id: m.id, label: m.label, tier: m.tier, note: m.note, pattern: m.re.source })),
    counts: {
      films: films.length,
      addedThisRun: films.length - carried,
      carriedFromEarlierRuns: carried,
      years: years.length,
      totalPlotWords: films.reduce((a, f) => a + f.plotWords, 0),
      medianPlotWords: median(films.map((f) => f.plotWords)),
      withAnyMarker: films.filter((f) => f.markers.length > 0).length,
      yearsWithNoList: perYear.filter((p) => p.listTitle === null).map((p) => p.year),
    },
    perYear,
    series,
    films,
  }, null, 2) + "\n", "utf8");

  console.log(`\nWrote ${OUT}: ${films.length} films across ${years.length} years, ${films.length - carried} new.`);
}

if (isEntryPoint(import.meta.url)) {
  void main();
}
