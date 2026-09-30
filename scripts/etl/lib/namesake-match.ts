/**
 * Does this sentence say the place is named after this figure?
 *
 * Pure functions for `connectors/namesakes.ts`, kept apart so the rules can be
 * tested offline against the sentences that break naive matching.
 *
 * ── The false positives this exists to refuse ────────────────────────────
 *
 * A search for "named after Krishna" finds Krishnanagar, which is named after
 * Maharaja Krishnachandra Roy, and Krishna district, named after the river. A
 * search for "named after Ram" finds every road named after Ram Manohar Lohia.
 * "Named after Maruti" is a car. A name that contains a god's name is
 * philology, not a dedication, and this project does not publish philology as
 * a finding.
 *
 * So a sentence counts only when all of these hold:
 *   1. it says something was named, called or given its name — a naming verb;
 *   2. the figure's word follows that verb within a short window;
 *   3. the word stands alone: not the start of a longer word (Krishnachandra),
 *      not followed by a capitalised word (Ram Manohar, Krishna River), not
 *      preceded by "river";
 *   4. for a god, the sentence carries devotional or mythological context —
 *      Lord, god, deity, temple, Ramayana and so on — because "named after
 *      Radha, the zamindar's daughter" passes every other test.
 *
 *   5. the sentence is about the place itself — it names the place, or
 *      opens on "It", "The town", "The name" and the like. The first live
 *      run pinned Kullu to Rama because its article says Dussehra is held
 *      "in honour of Lord Raghunath", and a village to Kali because it has
 *      "two famous temples named after Lord Shiva and Goddess Kali";
 *   6. nobody stands between the verb and the god: "consort of Murugan",
 *      "the bull of Shiva", "slain by Balarama" name someone else;
 *   7. it is not a denial: "is not named after goddess Durga".
 *
 * A sentence that fails only rule 4 is kept as `needsContext`, not discarded:
 * it goes to the hand review rather than onto the map.
 */

export interface FigureWords {
  id: string;
  kind: "god" | "leader";
  /** Words that name the figure. Longest first is not required; all are tried. */
  words: string[];
  /** Leaders only: words that, if present, mean a different person. */
  notWith?: string[];
}

export interface SentenceMatch {
  figure: string;
  sentence: string;
  /** A god matched without devotional context. Review, do not map. */
  needsContext: boolean;
}

/** A naming verb, and the stretch after it where the namesake is stated. */
const NAMING =
  /\b(named|renamed|name[sd]?|called|christened|dedicated|honou?rs?|honou?ring|memory|derives?|derived|derivation|gets?|got|takes?|took|draws?|drew|comes?|came|originates?|originated|etymology)\b/i;

/**
 * Stronger than NAMING: the sentence must contain at least one of these, or the
 * verb could be doing something else ("came after Rama's exile").
 */
const NAMING_PHRASE = new RegExp(
  [
    String.raw`\bnamed\s+(after|for|in\s+(honou?r|memory)\s+of)\b`,
    String.raw`\brenamed\s+(after|for|as|in\s+(honou?r|memory)\s+of)\b`,
    String.raw`\b(derives?|derived|gets?|got|takes?|took|draws?|drew|obtains?|obtained)\s+(its|their|the|his|her)\s+name\b`,
    String.raw`\bname\s+(is\s+|was\s+)?(derived|comes?|came|originates?|originated|stems?)\s+from\b`,
    String.raw`\bname\s+(means|refers\s+to|is\s+after)\b`,
    String.raw`\bin\s+(honou?r|memory)\s+of\b`,
    String.raw`\bdedicated\s+to\s+the\s+memory\s+of\b`,
    String.raw`\bcalled\s+\S+(\s+\S+){0,3}\s+after\b`,
    String.raw`\bnamesake\b`,
    String.raw`\betymology\b`,
  ].join("|"),
  "i",
);

/** Context a god's mention needs before it can be read as the god. */
const DEVOTIONAL =
  /\b(lord|god|goddess|deity|deities|bhagwan|bhagavan|avatar|avatara|incarnation|divine|temple|temples|mandir|shrine|worship(ped|s)?|ramayana|ramayan|mahabharata|purana|puranas|puranic|mythology|mythological|legend|legends|legendary|epic|hindu|hinduism|devotee|devotees|pilgrim|pilgrimage|sacred|holy|exile|vanvas|vanavas|lanka|ravana|ayodhya|vrindavan|mathura|dwarka|kailash|avatars|vishnu|shiva|sita|hanuman|krishna|rama)\b/i;

/** Words that, directly before a match, mean it is not the figure. */
const BAD_BEFORE = /\b(river|rivers|the\s+river|mount|mt\.?|hill|lake|raja|maharaja|king|sri\s+sri)\s*$/i;

/**
 * Words that may follow a god's name without making it a longer proper name:
 * "Lord Rama Temple" is still Rama, "Rama Rao" is not.
 */
const OK_AFTER = /^(temple|mandir|mandiram|kovil|koil|devasthanam|ji|jee|bhagwan|and|or|the|who|which|whose|in|of|at|as|is|was|to|from|with|by|on|a|an|for|his|her|its)\b/i;

/** A section heading, as `articleText` marks it: "§§Etymology§§." */
export const HEADING_MARK = /^§§(.*?)§§\.?$/;
/** The sections whose whole subject is the name. */
const NAME_SECTION = /^(etymology|name|names|naming|toponymy|nomenclature|origin of (the )?name|etymology and history|history and etymology|name and etymology|etymology and names?)$/i;

/** A relation between the naming verb and the god means the namesake is someone else. */
const INTERMEDIARY = /\b(consort|wife|husband|son|daughter|brother|sister|friend|devotee|attendant|servant|serpent|bull|mount|vehicle|father|mother|slain|killed|disciple|king|queen|asura|demon|sage|saint)\b/i;

/** A denial: "not named after", "never derived from". */
const DENIAL = /\b(not|never|no longer|wrongly|falsely|false)\b[^.]{0,30}\b(named|derived|called|etymology)\b|\bfalse etymology\b|\bmisleading name\b/i;

/** Openings that make a sentence about the article's own subject. */
const SUBJECT_OPENING =
  /^["“']?(it|its|this|these|the\s+(name|names|town|city|village|place|district|locality|area|region|neighbourhood|neighborhood|suburb|settlement|hamlet|state|taluk|tehsil|block|lake|river|hill|bridge|road|street|station|airport|university|college|institute|hospital|stadium|school|park|sanctuary|reserve|market|square|chowk|colony|nagar|township|municipality|valley|island|fort|gate|memorial|museum|hall|library|academy|complex|campus)|originally|formerly|earlier|according|legend|traditionally|locally)\b/i;

/** Is the sentence about the place called `subject`? */
export function aboutSubject(sentence: string, subject: string): boolean {
  if (SUBJECT_OPENING.test(sentence.trim())) return true;
  // The place's own name, or the first word of it ("Bishnupur" from "Bishnupur, Bankura").
  const head = subject.replace(/\s*\(.*\)\s*$/, "").split(",")[0]!.trim();
  const first = head.split(/\s+/)[0] ?? head;
  const inSentence = (w: string) => w.length >= 4 && new RegExp(`(?<![\\p{L}])${escapeRe(w)}(?![\\p{L}])`, "iu").test(sentence);
  return inSentence(head) || inSentence(first);
}

/** Split running text into sentences without cutting "M. K. Gandhi" or "Dr." in half. */
export function sentences(text: string): string[] {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return [];
  const raw = flat.split(/(?<=[.!?])\s+(?=["“'(§]?[A-Z0-9§])/);
  const out: string[] = [];
  for (const piece of raw) {
    const prev = out[out.length - 1];
    // Join back a split made after an initial ("M.", "K.") or a title.
    if (prev !== undefined && !HEADING_MARK.test(prev) && !piece.startsWith("§§") && /(\b[A-Z]|\b(Dr|Mr|Mrs|Ms|Smt|Shri|Sri|St|Lt|Col|Gen|Capt|Maj|Prof|Jr|Sr|No|Nos|Rs|Govt|Dept|Mt|Ft|Vol|approx|ca|c|vs|i\.e|e\.g))\.$/.test(prev)) {
      out[out.length - 1] = `${prev} ${piece}`;
    } else {
      out.push(piece);
    }
  }
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Where, after a naming verb, the figure is mentioned as a whole word — or -1.
 * The window is short on purpose: the namesake follows the verb closely in
 * every true example, and a long window is how "named after the fort. Rama
 * later..." turns into a match.
 */
function mentionAfterVerb(s: string, word: string): { index: number; after: string; before: string } | null {
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(word)}(?![\\p{L}\\p{N}])`, "giu");
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const before = s.slice(0, m.index);
    const verb = [...before.matchAll(new RegExp(NAMING.source, "gi"))].pop();
    if (!verb || verb.index === undefined) continue;
    const gap = before.slice(verb.index + verb[0].length);
    // At most ten words between the verb and the name.
    if (gap.trim().split(/\s+/).filter(Boolean).length > 10) continue;
    return { index: m.index, after: s.slice(m.index + m[0].length), before };
  }
  return null;
}

/** The words between the last naming verb and the mention at `index`. */
function gapBeforeMention(s: string, index: number): string {
  const before = s.slice(0, index);
  const verb = [...before.matchAll(new RegExp(NAMING.source, "gi"))].pop();
  return verb?.index === undefined ? before : before.slice(verb.index + verb[0].length);
}

/** Is this mention part of a longer proper name — Ram Manohar, Krishna River? */
function extendsIntoLongerName(after: string, before: string): boolean {
  if (BAD_BEFORE.test(before)) return true;
  // "Rama's", "Krishna," "Hanuman." all end the name.
  const next = after.match(/^\s+([A-Z][\p{L}]+)/u);
  if (!next) return false;
  return !OK_AFTER.test(next[1] ?? "");
}

/**
 * The first sentence in `text` that names `fig` as a namesake, or null.
 * Sentences are tried in order; the earliest true one is kept, which in a
 * Wikipedia article is almost always the lead or the Etymology section.
 */
export function findNamingSentence(text: string, fig: FigureWords, subject?: string): SentenceMatch | null {
  let weak: SentenceMatch | null = null;
  let section = "";
  for (const s of sentences(text)) {
    const h = s.match(HEADING_MARK);
    if (h) { section = h[1] ?? ""; continue; }
    if (s.length > 700) continue; // a table flattened into prose, not a sentence
    if (DENIAL.test(s)) continue;
    /*
     * Inside an Etymology or Name section the whole section is about the name,
     * so a sentence there need not repeat "named after": "The name is a
     * compound of Rama and tek, a hill" says it. Every other rule still holds.
     */
    if (NAME_SECTION.test(section.trim())) {
      const m = inNameSection(s, fig);
      if (m) { if (!m.needsContext) return m; weak ??= m; }
      continue;
    }
    if (!NAMING_PHRASE.test(s)) continue;
    if (subject !== undefined && !aboutSubject(s, subject)) continue;
    if (fig.notWith && fig.notWith.some((w) => new RegExp(`\\b${escapeRe(w)}\\b`).test(s))) continue;
    for (const w of fig.words) {
      const hit = mentionAfterVerb(s, w);
      if (!hit) continue;
      if (INTERMEDIARY.test(gapBeforeMention(s, hit.index))) continue;
      // A leader's word is already a full name, so what follows it is the
      // institution ("Rajiv Gandhi International Airport"), not a surname.
      if (fig.kind === "leader") {
        if (BAD_BEFORE.test(hit.before)) continue;
        return { figure: fig.id, sentence: s, needsContext: false };
      }
      if (extendsIntoLongerName(hit.after, hit.before)) continue;
      if (DEVOTIONAL.test(s.replace(new RegExp(`\\b${escapeRe(w)}\\b`, "g"), ""))) {
        return { figure: fig.id, sentence: s, needsContext: false };
      }
      weak ??= { figure: fig.id, sentence: s, needsContext: true };
    }
  }
  return weak;
}

/** A sentence from a name section: the figure, whole, unrelated to anyone in between. */
function inNameSection(s: string, fig: FigureWords): SentenceMatch | null {
  for (const w of fig.words) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(w)}(?![\\p{L}\\p{N}])`, "giu");
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      const before = s.slice(0, m.index), after = s.slice(m.index + m[0].length);
      const near = before.split(/\s+/).slice(-5).join(" ");
      if (INTERMEDIARY.test(near)) continue;
      if (fig.kind === "leader") {
        if (fig.notWith && fig.notWith.some((x) => new RegExp(`\\b${escapeRe(x)}\\b`).test(s))) continue;
        if (BAD_BEFORE.test(before)) continue;
        return { figure: fig.id, sentence: s, needsContext: false };
      }
      if (extendsIntoLongerName(after, before)) continue;
      const ctx = DEVOTIONAL.test(s.replace(new RegExp(`\\b${escapeRe(w)}\\b`, "g"), ""));
      return { figure: fig.id, sentence: s, needsContext: !ctx };
    }
  }
  return null;
}

/** Any sentence that states a namesake at all — for the lookalikes, whoever it names. */
export function firstNamingSentence(text: string, subject?: string): string | null {
  const all = sentences(text);
  // The opening of the Etymology section, when there is one: that is where
  // an article says where its name comes from, in its own words.
  for (let k = 0; k < all.length; k++) {
    const h = all[k]!.match(HEADING_MARK);
    if (!h || !NAME_SECTION.test((h[1] ?? "").trim())) continue;
    const body: string[] = [];
    for (let j = k + 1; j < all.length && body.length < 2; j++) {
      const s = all[j]!;
      if (HEADING_MARK.test(s)) break;
      if (s.length >= 25 && s.length <= 500) body.push(s);
    }
    if (body.length) return body.join(" ");
  }
  for (const s of all) {
    if (HEADING_MARK.test(s) || s.length < 25 || s.length > 500) continue;
    if (NAMING_PHRASE.test(s) && !DENIAL.test(s) && (subject === undefined || aboutSubject(s, subject))) return s;
  }
  return null;
}

/* ─────────────────────────── Roads ─────────────────────────── */

export type RoadFigure = "mahatma" | "indira" | "rajiv" | "gandhi";

/**
 * Which Gandhi a road name honours, from the name alone.
 *
 * "M.G. Road" is Mahatma Gandhi by universal Indian usage, and the only reading
 * the abbreviation has. A bare "Gandhi Road" could be any of them and is kept
 * apart as "gandhi" — never folded into the Mahatma's count.
 */
export function roadFigure(name: string): RoadFigure | null {
  const n = name.toLowerCase().replace(/\s+/g, " ").trim();
  const TYPE = String.raw`(road|rd\.?|marg|salai|path|street|st\.?|avenue|ave\.?|lane|highway|bypass|link road|main road)`;
  if (new RegExp(String.raw`^(mahatma gandhi|m\.? ?g\.?|gandhiji|bapu) ${TYPE}\b`).test(n)) return "mahatma";
  if (new RegExp(String.raw`^(smt\.? )?indira gandhi ${TYPE}\b`).test(n)) return "indira";
  if (new RegExp(String.raw`^rajiv gandhi ${TYPE}\b`).test(n)) return "rajiv";
  if (new RegExp(String.raw`^gandhi ${TYPE}\b`).test(n)) return "gandhi";
  return null;
}

/** The road's name with case, dots and trailing qualifiers removed, for grouping. */
export function roadKey(name: string): string {
  return name.toLowerCase()
    .replace(/[.()]/g, " ")
    .replace(/\b(rd)\b/g, "road")
    .replace(/\b(st)\b/g, "street")
    .replace(/\b(m g|mg)\b/g, "mahatma gandhi")
    .replace(/\s+/g, " ")
    .trim();
}

/** Great-circle distance in kilometres. */
export function km(a: [number, number], b: [number, number]): number {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * OpenStreetMap splits one road into many ways. Ways with the same name whose
 * centres chain together within `joinKm` are counted as one road. This is an
 * estimate and is published as one: a road broken by a long unnamed stretch
 * counts twice, and two same-named roads a few hundred metres apart count once.
 */
export function clusterRoads(points: Array<{ key: string; lat: number; lon: number }>, joinKm = 1.5): Array<{ key: string; lat: number; lon: number; ways: number }> {
  const byKey = new Map<string, Array<{ lat: number; lon: number }>>();
  for (const p of points) byKey.set(p.key, [...(byKey.get(p.key) ?? []), p]);
  const out: Array<{ key: string; lat: number; lon: number; ways: number }> = [];
  for (const [key, ps] of byKey) {
    const parent = ps.map((_, i) => i);
    const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]!]!; i = parent[i]!; } return i; };
    // Grid bucketing keeps this near-linear: only neighbouring cells are compared.
    const cell = (p: { lat: number; lon: number }) => `${Math.floor(p.lat / 0.02)}:${Math.floor(p.lon / 0.02)}`;
    const grid = new Map<string, number[]>();
    ps.forEach((p, i) => { const c = cell(p); grid.set(c, [...(grid.get(c) ?? []), i]); });
    ps.forEach((p, i) => {
      const cy = Math.floor(p.lat / 0.02), cx = Math.floor(p.lon / 0.02);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        for (const j of grid.get(`${cy + dy}:${cx + dx}`) ?? []) {
          if (j <= i) continue;
          const q = ps[j]!;
          if (km([p.lat, p.lon], [q.lat, q.lon]) <= joinKm) { const a = find(i), b = find(j); if (a !== b) parent[a] = b; }
        }
      }
    });
    const groups = new Map<number, Array<{ lat: number; lon: number }>>();
    ps.forEach((p, i) => { const r = find(i); groups.set(r, [...(groups.get(r) ?? []), p]); });
    for (const g of groups.values()) {
      const lat = g.reduce((s, p) => s + p.lat, 0) / g.length;
      const lon = g.reduce((s, p) => s + p.lon, 0) / g.length;
      out.push({ key, lat: Math.round(lat * 1e4) / 1e4, lon: Math.round(lon * 1e4) / 1e4, ways: g.length });
    }
  }
  return out;
}
