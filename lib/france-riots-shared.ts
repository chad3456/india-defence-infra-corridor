/**
 * The live France riots tracker (/france-riots): types, the rules that decide
 * what belongs on it, and the parsers for each source. No node imports — the
 * route, the scheduled connector, the page and the tests all read this.
 *
 * ── What the tracker is ──────────────────────────────────────────────────
 *
 * A place where the reporting, the videos newsrooms publish, government
 * announcements and foreign governments' advice about the October 2026 riots
 * arrive as they are published. Everything on it is a report: headlines and
 * videos are pointers to coverage, and the figures officials give are shown as
 * sentences quoted from the article that carried them, with who said them.
 * None of it becomes a number the site vouches for, and none of it is summed.
 *
 * ── What it will not do ──────────────────────────────────────────────────
 *
 * It does not name private individuals: social posts are searched only from
 * institutions, public officials and newsrooms. It stores no X post text, only
 * post ids, which X's own embed renders when a reader asks for it.
 */

/**
 * `lang` is an ISO 639-1 code. `en`, where present, is a machine translation
 * into English made by the scheduled job (scripts/etl/france/translate.py);
 * the original is always kept and shown beside it.
 */
export interface Headline { title: string; outlet: string; url: string; published: string | null; lang: string; kind: "press" | "official"; query: string; en?: string }
export interface Video { id: string; title: string; channel: string; handle: string; published: string | null; lang?: string; en?: string }
export interface Article { url: string; title: string; domain: string; language: string; country: string; seen: string | null; image: string | null; en?: string }
export interface PulsePoint { t: string; v: number }
export interface Place { name: string; lat: number; lon: number; count: number }
export type StatementKind = "arrests" | "injured" | "deaths" | "protesters" | "damage" | "cost" | "economy" | "assaults" | "deployment" | "profile" | "other";
export interface Statement { quote: string; numbers: string[]; kind: StatementKind; who: string | null; outlet: string; url: string; seen: string | null; lang: string; en?: string }
export interface Advisory { id: string; name: string; page: string; updatedAt: string | null; change: string | null; excerpt: string | null }
export interface XPost { id: string; handle: string; createdAt: string; video: boolean }
/** A post on X that a newsroom embedded in its own article: found there, never searched for. */
export interface EmbeddedPost { id: string; handle: string; createdAt: string; outlet: string; articleUrl: string; articleTitle: string }
/** Metropolitan France as one SVG path, with the projection that drew it (lib/france-outline.ts). */
export interface Outline { d: string; scale: number; translate: [number, number]; width: number; height: number; grid?: LandGrid }
/** The same map as square cells: `land` holds one character per cell, row by row: "1" France, "2" a neighbouring country, "0" sea. */
export interface LandGrid { cell: number; cols: number; rows: number; land: string }
export interface SourceStatus { id: string; label: string; ok: boolean; count: number; error?: string }
/** A claim about what or who is behind the violence, in the speaker's words as an article reported them. */
export interface Claim { quote: string; themes: ClaimTheme[]; speaker: string; outlet: string; url: string; seen: string | null; lang: string; en?: string }
export type ClaimTheme = "immigration" | "far-left" | "far-right" | "cost-of-living" | "policing" | "foreign" | "government" | "crime";
/** A named business reported as attacked, looted or burned, with the sentence that says so. */
export interface BusinessReport { brand: string; city: string | null; quote: string; outlet: string; url: string; seen: string | null; lang?: string; en?: string }
export type DamageCategory = "public-building" | "police" | "mall" | "shop" | "bank" | "restaurant" | "vehicle" | "transport" | "street" | "monument" | "home";
/**
 * A sentence reporting property attacked, looted or burned: what kind of
 * property, any brand or named building it names, and the city. A report, not
 * an object count: one burned town hall reported by six outlets is six rows.
 */
export interface DamageItem { quote: string; categories: DamageCategory[]; brands: string[]; places: string[]; numbers: string[]; city: string | null; outlet: string; url: string; seen: string | null; lang: string; en?: string }
/**
 * A picture or video about the riots, shown where it was published: the lead
 * image an article declares for previews, a figure in it, a video it embeds, a
 * freely licensed file on Wikimedia Commons, or a newsroom's YouTube video.
 * Linked, credited and never copied: `src` is the publisher's own address.
 */
export interface MediaItem { kind: "image" | "video"; src: string; page: string; title: string; credit: string; license?: string; via: "article" | "gdelt" | "commons" | "youtube"; seen: string | null; lang: string; en?: string; videoId?: string }
export interface MarketPoint { d: string; close: number }

export interface FranceRegister {
  updatedAt: string;
  youtubeChannels: Record<string, { id: string | null; name: string; resolvedAt?: string; error?: string }>;
  headlines: Headline[];
  videos: Video[];
  articles: Article[];
  pulse: PulsePoint[];
  places: Place[];
  statements: Statement[];
  advisories: Advisory[];
  /** Articles already read for figures and embedded posts. */
  scanned: string[];
  embedded: EmbeddedPost[];
  claims: Claim[];
  businesses: BusinessReport[];
  markets: { cac40: MarketPoint[]; eurusd: MarketPoint[] };
  damage: DamageItem[];
  media: MediaItem[];
  /** Set by the translation step: what made the English text, and when. */
  translation?: { engine: string; at: string; translated: number; pending: number; byLang: Record<string, number>; failed?: string[] };
  /** Raised when articles must be read again for something new; the job re-reads them once. */
  scanVersion?: number;
  x: { active: boolean; reason?: string; day: string; readsToday: number; budgetPerDay: number; costUsdToday: number; lastAt?: string; posts: XPost[] };
  status: SourceStatus[];
}

/**
 * Everything the gallery shows, newest first: the pictures and videos found in
 * articles and on Commons, and the newsrooms' own YouTube videos.
 */
export function mediaFeed(reg: FranceRegister | null, kind: "all" | "image" | "video" = "all"): MediaItem[] {
  if (!reg) return [];
  const yt: MediaItem[] = (reg.videos ?? []).map((v) => ({ kind: "video", src: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`, page: `https://www.youtube.com/watch?v=${v.id}`, title: v.title, credit: v.channel, via: "youtube", seen: v.published, lang: v.lang ?? "en", videoId: v.id, ...(v.en ? { en: v.en } : {}) }));
  const ids = new Set(yt.map((v) => v.videoId));
  const all = [...(reg.media ?? []).filter((m) => !m.videoId || !ids.has(m.videoId)), ...yt];
  return all.filter((m) => kind === "all" || m.kind === kind).sort((a, b) => (b.seen ?? "").localeCompare(a.seen ?? ""));
}

/** How many media items the register holds, for the gallery to know when it has reached the end. */
export interface MediaPage { items: MediaItem[]; total: number; offset: number }

/**
 * The register as a page receives it: without the job's bookkeeping (articles
 * already read) and without the media, which the gallery pages through itself.
 */
export function slimRegister(reg: FranceRegister): FranceRegister {
  return { ...reg, scanned: [], media: [] };
}

export interface FranceLivePayload {
  fetchedAt: string;
  headlines: Headline[];
  videos: Video[];
  advisories: Advisory[];
  register: FranceRegister | null;
  registerFrom: "github" | "deployment" | "none";
  status: SourceStatus[];
}

/* ── Languages ────────────────────────────────────────────────────────── */

/** The languages read, by ISO 639-1 code, with the name GDELT gives each. */
export const LANGUAGES: Record<string, string> = {
  en: "English", fr: "French", de: "German", es: "Spanish", it: "Italian", nl: "Dutch", pt: "Portuguese", pl: "Polish",
  sv: "Swedish", da: "Danish", nb: "Norwegian", fi: "Finnish", sq: "Albanian", ro: "Romanian", cs: "Czech", el: "Greek",
  tr: "Turkish", ar: "Arabic", ru: "Russian", uk: "Ukrainian", hu: "Hungarian",
};
/** A GDELT language name ("French") as a code ("fr"); unknown names pass through lower-cased. */
export function langCode(name: string): string {
  const hit = Object.entries(LANGUAGES).find(([, n]) => n.toLowerCase() === name.trim().toLowerCase());
  return hit ? hit[0] : name.trim().toLowerCase() || "und";
}
export const langName = (code: string) => LANGUAGES[code] ?? code;

/* ── What belongs on the tracker ──────────────────────────────────────── */

// French and English, then German, Spanish, Italian, Dutch, Portuguese, Polish and the Nordic languages:
// "protest" and "manifest" already cover most of their words for a demonstration.
const TOPIC = /émeut|riot|casseur|pillag|loot|violen|affront|clash|incendi|arson|interpell|arrest|gardes? à vue|manifest|protest|mobilis|grève|strike|blocage|lacrymo|tear ?gas|black ?bloc|couvre-feu|curfew|bloquons|dégradation|vandal|krawall|unruhen|ausschreitung|plünder|zusammenstö|disturbios|saqueo|enfrentamiento|scontri|rivolt|saccheg|guerriglia|rellen|onrust|plunder|upplopp|kravall|plundring|oroligheter|uroligheder|optøjer|plyndr|opptøy|urolighet|mellak|mielenosoit|zamieszk|starcia|grabie|tumult|saque|confronto|distúrbio|demonstra(?:nt|ti(?!ng)|sjon)/i;
const PLACE = /france|français|française|french|paris|lyon|marseille|bordeaux|lille|nantes|toulouse|rennes|strasbourg|montpellier|nice\b|grenoble|rouen|toulon|saint-étienne|dijon|macron|nuñez|nunez|lecornu|préfe|prefect|gendarm|\bCRS\b|élysée|elysee|matignon|1[678] octobre|october 1[678]|1[678] october|oct\.? 1[678]\b|frankreich|franzö|francia|franc[eé]s|parigi|parís|frankrijk|parijs|frankrike|frankrig|fransk|ranska|pariisi|francj|paryż|paryz|frança|marsella|marsiglia|lione/i;

/** Newsrooms named after France: "Riots in Tirana • FRANCE 24" is not about France. */
const FRENCH_OUTLETS = /france ?24|france ?info|france inter|france télévisions|france ?tv|france [235]\b|france bleu|\brfi\b/gi;
/** A headline, title or video belongs if it names unrest and places it in France. */
export function isAboutRiots(text: string): boolean {
  const t = text.replace(FRENCH_OUTLETS, " ");
  return TOPIC.test(t) && PLACE.test(t);
}

/**
 * A government-site item belongs if it concerns demonstrations or public order:
 * the search restricted to government sites also returns job offers, search
 * pages and everything else those sites publish.
 */
const OFFICIAL = /manifest|rassemblement|émeut|emeut|violences urbaines|ordre public|couvre-feu|casseur|black ?bloc|dégradations? (?:urbaines|de biens publics)|protest|riot|gilets jaunes|\bGJ\b|blocages?\b|bloquons/i;
export function isOfficialRelevant(title: string): boolean {
  return OFFICIAL.test(title) && !/manifestations? d.int[ée]r[êe]t/i.test(title) && !/^(résultats de recherche|untitled|offres d.emploi)/i.test(title.trim());
}

/** Paris and the Île-de-France: the capital, its suburbs and the places in it reporting names. */
const PARIS = /paris|parisien|île-de-france|ile-de-france|seine-saint-denis|hauts-de-seine|val-de-marne|val-d.oise|essonne|yvelines|nanterre|saint-denis|bobigny|créteil|creteil|argenteuil|champs-élysées|champs-elysees|bastille|république|place de la nation|châtelet|chatelet|les halles|préfecture de police|prefecture de police|prefpolice/i;
export const isParis = (text: string) => PARIS.test(text);

/** Inside a window [from, to). Undated items are outside a focus window: a focus is a claim about time. */
export const inFocus = (iso: string | null | undefined, w: { from: string; to: string }) => !!iso && iso >= w.from && iso < w.to;

/**
 * When a post on X was made, from its id: X ids are "snowflakes" whose high
 * bits are milliseconds since 4 November 2010. The time is read from the id
 * itself, not from anything the post says.
 */
export function tweetTime(id: string): string | null {
  if (!/^\d{15,20}$/.test(id)) return null;
  const ms = Number(BigInt(id) >> 22n) + 1288834974657;
  return ms > 1.3e12 && ms < 4.1e12 ? new Date(ms).toISOString() : null;
}

const NOT_A_USER = new Set(["intent", "share", "home", "search", "hashtag", "explore", "settings", "login", "signup"]);
/** Links that name a post but not its author ("x.com/i/status/…"): the post is real, the handle is unknown. */
const GENERIC = new Set(["i", "user", "web", "x", "twitter"]);
/**
 * Posts on X an article embeds: status links in the page, typically inside
 * <blockquote class="twitter-tweet">. Ids and handles only; the post's text in
 * the page is not kept.
 */
export function tweetsInHtml(html: string): Array<{ id: string; handle: string }> {
  const out = new Map<string, { id: string; handle: string }>();
  for (const m of html.matchAll(/(?:twitter|x)\.com\/(?:#!\/)?([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{15,20})/g)) {
    const handle = m[1]!, id = m[2]!;
    if (NOT_A_USER.has(handle.toLowerCase()) || !tweetTime(id)) continue;
    if (!out.has(id)) out.set(id, { id, handle: GENERIC.has(handle.toLowerCase()) ? "" : handle });
  }
  return [...out.values()];
}

/** Within the story's window. Undated items are kept: absence of a date is not evidence of age. */
export function inWindow(iso: string | null, since: string): boolean {
  return iso === null || iso >= since;
}

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** One entry per key, the earliest date kept, newest first, capped. */
export function mergeBy<T extends { published?: string | null; seen?: string | null }>(previous: T[], fresh: T[], key: (x: T) => string, cap: number): T[] {
  const by = new Map<string, T>();
  for (const it of [...previous, ...fresh]) {
    const k = key(it);
    if (!by.has(k)) by.set(k, it);
  }
  const when = (x: T) => x.published ?? x.seen ?? "";
  return [...by.values()].sort((a, b) => when(b).localeCompare(when(a))).slice(0, cap);
}
export const headlineKey = (h: Headline) => `${norm(h.outlet)}|${norm(h.title)}`;

/* ── Parsers ──────────────────────────────────────────────────────────── */

const NAMED: Record<string, string> = {
  nbsp: " ", nnbsp: " ", ensp: " ", emsp: " ", thinsp: " ", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", sbquo: "‚", bdquo: "„", laquo: "«", raquo: "»",
  hellip: "…", ndash: "–", mdash: "—", euro: "€", pound: "£", deg: "°", copy: "©", reg: "®", trade: "™", middot: "·", bull: "•", times: "×", divide: "÷",
  szlig: "ß", aelig: "æ", AElig: "Æ", oelig: "œ", OElig: "Œ", oslash: "ø", Oslash: "Ø", eth: "ð", thorn: "þ", iexcl: "¡", iquest: "¿", sect: "§", para: "¶", shy: "",
  ordm: "º", ordf: "ª", sup2: "²", sup3: "³", frac12: "½", frac14: "¼", frac34: "¾", percnt: "%", num: "#", dollar: "$", comma: ",", period: ".", colon: ":", semi: ";", apos: "'",
};
/** Accented letters by their entity names: "eacute" is e + acute, rebuilt with Unicode normalisation. */
const MARKS: Record<string, string> = { acute: "\u0301", grave: "\u0300", circ: "\u0302", tilde: "\u0303", uml: "\u0308", cedil: "\u0327", ring: "\u030a" };
function entity(name: string): string | null {
  if (name in NAMED) return NAMED[name]!;
  const lower = name.toLowerCase();
  if (lower in NAMED && name === lower) return NAMED[lower]!;
  const m = /^([a-zA-Z])(acute|grave|circ|tilde|uml|cedil|ring)$/.exec(name);
  return m ? (m[1]! + MARKS[m[2]!]!).normalize("NFC") : null;
}
/** Is any entity still undecoded in this text? */
export const hasEntity = (t: string) => /&(?:[a-zA-Z][a-zA-Z0-9]*|#x?[0-9a-fA-F]+);|\\u[0-9a-fA-F]{4}/.test(t);

/** Entities decoded, CDATA unwrapped, whitespace collapsed: text as a reader sees it. */
export function unescape(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, e: string) => (e === "amp" ? m : entity(e) ?? m))
    .replace(/&amp;/g, "&").replace(/[\s\u00a0\u202f]+/g, " ").trim();
}
const tag = (xml: string, name: string) => { const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(xml); return m ? unescape(m[1]!.replace(/<[^>]+>/g, "")) : null; };
const iso = (raw: string | null) => { if (!raw) return null; const t = Date.parse(raw); return Number.isFinite(t) ? new Date(t).toISOString() : null; };

/**
 * Text that was UTF-8 read as Latin-1 somewhere upstream ("ArrÃªtÃ©"), put
 * back. Left alone unless every character fits in a byte and the bytes decode.
 */
export function fixMojibake(t: string): string {
  if (!/Ã[\u0080-\u00bf]/.test(t) || [...t].some((c) => c.charCodeAt(0) > 255)) return t;
  try { return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from([...t].map((c) => c.charCodeAt(0)))); } catch { return t; }
}

/** Google News RSS. Titles end " - Outlet"; the <source> element names the outlet too. */
export function parseGoogleNews(xml: string, lang: string, kind: Headline["kind"], query: string): Headline[] {
  return [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].flatMap((m) => {
    const b = m[0];
    const t0 = tag(b, "title"), url = tag(b, "link");
    if (!t0 || !url) return [];
    const raw = fixMojibake(t0);
    const source = tag(b, "source");
    const i = raw.lastIndexOf(" - ");
    const title = i > 10 ? raw.slice(0, i).trim() : raw;
    const outlet = source ?? (i > 10 ? raw.slice(i + 3).trim() : "");
    return [{ title, outlet, url, published: iso(tag(b, "pubDate")), lang, kind, query }];
  });
}

/** A YouTube channel's Atom feed: its fifteen most recent videos. */
export function parseYouTube(xml: string, handle: string, fallbackName: string): Video[] {
  const channel = tag(xml.split(/<entry[\s>]/i)[0] ?? "", "name") ?? fallbackName;
  return [...xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi)].flatMap((m) => {
    const b = m[0];
    const id = tag(b, "yt:videoId"), title = tag(b, "title");
    if (!id || !title || !/^[\w-]{11}$/.test(id)) return [];
    return [{ id, title, channel, handle, published: iso(tag(b, "published")) }];
  });
}

/** The channel id on a YouTube channel page, which the Atom feed needs. */
export function channelIdFromPage(html: string): string | null {
  const m = /"externalId":"(UC[\w-]{22})"/.exec(html) ?? /<meta itemprop="(?:channelId|identifier)" content="(UC[\w-]{22})"/.exec(html) ?? /channel_id=(UC[\w-]{22})/.exec(html);
  return m ? m[1]! : null;
}

const gdeltDate = (s: unknown) => {
  const m = typeof s === "string" ? /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s) : null;
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : null;
};

/** GDELT DOC 2.0, ArtList mode. */
export function parseGdeltArticles(body: unknown): Article[] {
  const list = (body as { articles?: Array<Record<string, unknown>> })?.articles ?? [];
  return list.flatMap((a) => {
    const url = typeof a.url === "string" ? a.url : null, title = typeof a.title === "string" ? a.title.trim() : null;
    if (!url || !title) return [];
    return [{ url, title, domain: String(a.domain ?? ""), language: String(a.language ?? ""), country: String(a.sourcecountry ?? ""), seen: gdeltDate(a.seendate), image: typeof a.socialimage === "string" && a.socialimage ? a.socialimage : null }];
  });
}

/**
 * Bing News RSS: headlines whose links carry the article's own address in a
 * `url=` parameter, so the article can be read — Google News's links cannot.
 */
export function parseBingNews(xml: string, lang: "fr" | "en"): Article[] {
  return [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].flatMap((m) => {
    const b = m[0];
    const title = tag(b, "title"), link = tag(b, "link");
    if (!title || !link) return [];
    let url = link;
    try { const u = new URL(link); const inner = u.searchParams.get("url"); if (inner && /^https?:\/\//.test(inner)) url = inner; } catch { return []; }
    if (/(^|\.)bing\.com\//.test(url.replace(/^https?:\/\//, ""))) return [];
    let domain = "";
    try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch { return []; }
    return [{ url, title: fixMojibake(title), domain, language: lang === "fr" ? "French" : "English", country: "", seen: iso(tag(b, "pubDate")), image: null }];
  });
}

/** GDELT DOC 2.0, TimelineVolRaw mode: articles matching the query, per interval, summed to the hour. */
export function parseGdeltTimeline(body: unknown): PulsePoint[] {
  const series = (body as { timeline?: Array<{ data?: Array<{ date?: string; value?: number }> }> })?.timeline?.[0]?.data ?? [];
  const byHour = new Map<string, number>();
  for (const d of series) {
    const t = gdeltDate(d.date);
    if (!t || typeof d.value !== "number") continue;
    const h = `${t.slice(0, 13)}:00:00Z`;
    byHour.set(h, (byHour.get(h) ?? 0) + d.value);
  }
  return [...byHour].map(([t, v]) => ({ t, v })).sort((a, b) => a.t.localeCompare(b.t));
}

/**
 * French cities, with their coordinates, for counting which places the
 * headlines name. Matched case-sensitively as whole words, so "Nice" the city
 * is not "nice" the adjective and "Tours" is not "tours".
 */
export const CITIES: Array<{ name: string; lat: number; lon: number; alt?: string[] }> = [
  { name: "Paris", lat: 48.8566, lon: 2.3522 }, { name: "Marseille", lat: 43.2965, lon: 5.3698 }, { name: "Lyon", lat: 45.764, lon: 4.8357 },
  { name: "Toulouse", lat: 43.6047, lon: 1.4442 }, { name: "Nice", lat: 43.7102, lon: 7.262 }, { name: "Nantes", lat: 47.2184, lon: -1.5536 },
  { name: "Montpellier", lat: 43.6108, lon: 3.8767 }, { name: "Strasbourg", lat: 48.5734, lon: 7.7521 }, { name: "Bordeaux", lat: 44.8378, lon: -0.5792 },
  { name: "Lille", lat: 50.6292, lon: 3.0573 }, { name: "Rennes", lat: 48.1173, lon: -1.6778 }, { name: "Reims", lat: 49.2583, lon: 4.0317 },
  { name: "Toulon", lat: 43.1242, lon: 5.928 }, { name: "Saint-Étienne", lat: 45.4397, lon: 4.3872, alt: ["Saint-Etienne"] }, { name: "Le Havre", lat: 49.4944, lon: 0.1079 },
  { name: "Grenoble", lat: 45.1885, lon: 5.7245 }, { name: "Dijon", lat: 47.322, lon: 5.0415 }, { name: "Angers", lat: 47.4784, lon: -0.5632 },
  { name: "Nîmes", lat: 43.8367, lon: 4.3601, alt: ["Nimes"] }, { name: "Clermont-Ferrand", lat: 45.7772, lon: 3.087 }, { name: "Limoges", lat: 45.8336, lon: 1.2611 },
  { name: "Tours", lat: 47.3941, lon: 0.6848 }, { name: "Amiens", lat: 49.8941, lon: 2.2958 }, { name: "Metz", lat: 49.1193, lon: 6.1757 },
  { name: "Besançon", lat: 47.2378, lon: 6.0241, alt: ["Besancon"] }, { name: "Perpignan", lat: 42.6887, lon: 2.8948 }, { name: "Orléans", lat: 47.903, lon: 1.9093, alt: ["Orleans"] },
  { name: "Rouen", lat: 49.4432, lon: 1.0999 }, { name: "Mulhouse", lat: 47.7508, lon: 7.3359 }, { name: "Caen", lat: 49.1829, lon: -0.3707 },
  { name: "Nancy", lat: 48.6921, lon: 6.1844 }, { name: "Avignon", lat: 43.9493, lon: 4.8055 }, { name: "Poitiers", lat: 46.5802, lon: 0.3404 },
  { name: "Brest", lat: 48.3904, lon: -4.4861 }, { name: "Ajaccio", lat: 41.9192, lon: 8.7386 }, { name: "Bastia", lat: 42.697, lon: 9.45 },
  { name: "Pau", lat: 43.2951, lon: -0.3708 }, { name: "La Rochelle", lat: 46.1603, lon: -1.1511 }, { name: "Nanterre", lat: 48.8924, lon: 2.2071 },
  { name: "Saint-Denis", lat: 48.9362, lon: 2.3574 }, { name: "Créteil", lat: 48.7904, lon: 2.4556, alt: ["Creteil"] }, { name: "Bobigny", lat: 48.9077, lon: 2.4396 },
  { name: "Argenteuil", lat: 48.9472, lon: 2.2467 }, { name: "Villeurbanne", lat: 45.7667, lon: 4.88 }, { name: "Roubaix", lat: 50.6942, lon: 3.1746 },
  { name: "Tourcoing", lat: 50.7239, lon: 3.1612 }, { name: "Valence", lat: 44.9334, lon: 4.8924 }, { name: "Chambéry", lat: 45.5646, lon: 5.9178, alt: ["Chambery"] },
  { name: "Annecy", lat: 45.8992, lon: 6.1294 }, { name: "Lorient", lat: 47.7483, lon: -3.37 }, { name: "Quimper", lat: 47.996, lon: -4.102 },
  { name: "Bayonne", lat: 43.4929, lon: -1.4748 }, { name: "Calais", lat: 50.9513, lon: 1.8587 }, { name: "Dunkerque", lat: 51.0343, lon: 2.3768, alt: ["Dunkirk"] },
];

/** How many headlines name each city: where the reporting is about, not where the most happened. */
export function placesFromHeadlines(titles: string[]): Place[] {
  const res = CITIES.map((c) => ({ c, re: new RegExp(`(?<![\\p{L}-])(?:${[c.name, ...(c.alt ?? [])].join("|")})(?![\\p{L}-])`, "u") }));
  return res.map(({ c, re }) => ({ name: c.name, lat: c.lat, lon: c.lon, count: titles.filter((t) => re.test(t)).length }))
    .filter((p) => p.count > 0).sort((a, b) => b.count - a.count);
}

/** Metropolitan France, with a margin: GDELT places outside it are not drawn on this map. */
export const FRANCE_BOX = { west: -5.6, east: 9.8, south: 41.2, north: 51.3 };

/** gov.uk's content API for a travel-advice page: the latest change and when it was made. */
export function parseGovUkAdvice(body: unknown, meta: { id: string; name: string; page: string }): Advisory {
  const b = body as { public_updated_at?: string; details?: { change_description?: string; parts?: Array<{ slug?: string; body?: string }> } };
  const safety = b?.details?.parts?.find((p) => p.slug === "safety-and-security")?.body ?? "";
  const paras = [...safety.matchAll(/<p>([\s\S]*?)<\/p>/gi)].map((m) => unescape(m[1]!.replace(/<[^>]+>/g, "")));
  const excerpt = paras.find((p) => /protest|demonstrat|riot|strike|unrest/i.test(p)) ?? null;
  return { ...meta, updatedAt: iso(b?.public_updated_at ?? null), change: b?.details?.change_description?.trim() || null, excerpt: excerpt && excerpt.length > 500 ? `${excerpt.slice(0, 497)}…` : excerpt };
}

/* ── Official figures, as sentences ───────────────────────────────────── */

/** Readable text of an article page: its paragraphs. */
export function articleText(html: string): string {
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const paras = [...body.matchAll(/<p[\s>][\s\S]*?<\/p>/gi)].map((m) => unescape(m[0].replace(/<[^>]+>/g, " ")));
  return paras.filter((p) => p.length > 40).join("\n");
}

const COUNT = /interpell|arrest|gardes? à vue|en garde|détenu|detain|blessé|injur|hurt|hospital|policiers?|gendarmes?|officers?|forces de l.ordre|véhicules?|voitures?|cars?\b|vehicles?|incendi|burn|torched|manifestants|protesters|demonstrators|people|personnes|bâtiments?|buildings?|commerces?|shops?|magasins?|mort|morts|dead|killed|tués?|décès|died/i;
const WHO: Array<[RegExp, string]> = [
  [/nu[ñn]ez/i, "Interior Minister (Laurent Nuñez)"],
  [/ministère de l.intérieur|ministre de l.intérieur|interior minist|ministry of the interior|minister of the interior/i, "the Interior Ministry"],
  [/préfecture de police|prefecture de police|paris police (?:prefecture|headquarters)|préfet de police/i, "Paris Police Prefecture"],
  [/préfe|prefect/i, "a prefecture"],
  [/macron|élysée|elysee/i, "the President"],
  [/premier ministre|prime minister|matignon/i, "the Prime Minister"],
  [/parquet|procureur|prosecutor/i, "prosecutors"],
  [/gendarmerie/i, "the Gendarmerie"],
  [/police nationale|national police|police said|selon la police|according to (?:the )?police|police sources?/i, "police"],
  [/organisateurs|organisers|organizers|syndicat|union|CGT|CFDT|FO\b|intersyndicale/i, "organisers or unions"],
  [/according to (?:the )?authorities|authorities said|selon les autorités|les autorités ont/i, "the authorities"],
  [/france assureurs|assureurs|insurers|insurance (?:federation|industry)/i, "insurers"],
  [/fédération du commerce|alliance du commerce|\bCCI\b|chambre de commerce|confédération des petites|CPME|MEDEF|U2P|retailers.? (?:group|federation)/i, "business groups"],
  [/ministre de l.économie|economy minister|finance minister|ministre des finances|bercy/i, "the Economy Ministry"],
  [/selon les (?:sapeurs-)?pompiers|les pompiers ont (?:indiqué|annoncé|précisé)|firefighters said|according to (?:the )?(?:firefighters|fire service)|fire service said/i, "firefighters"],
  [/selon (?:le|la) maire|selon la mairie|(?:le|la) maire\b.{0,40}\ba (?:déclaré|annoncé|indiqué|dénoncé)|mayor (?:said|told|announced|denounced)|according to the mayor/i, "a mayor"],
];
/**
 * Every source a sentence names, in the order it names them: "550,000 according
 * to the ministry; the CGT puts it at 800,000" is two sources, not one.
 */
export function attribution(s: string): string | null {
  const found: Array<[number, string]> = [];
  for (const [re, label] of WHO) {
    const m = new RegExp(re.source, "i").exec(s);
    if (m && !found.some(([, l]) => l === label)) found.push([m.index, label]);
  }
  // A specific source makes the general one it implies redundant.
  const labels = found.sort((a, b) => a[0] - b[0]).map(([, l]) => l);
  const covers: Record<string, string> = { "Interior Minister (Laurent Nuñez)": "the Interior Ministry", "Paris Police Prefecture": "a prefecture" };
  const out = labels.filter((l) => !Object.entries(covers).some(([specific, general]) => l === general && labels.includes(specific)));
  return out.length ? out.join("; ") : null;
}

const NUMBER = /\b\d+(?:[.,]\d+)?\s*(?:millions?|milliards?|billions?|M€|Md€)\b|\b\d{1,3}(?:[  ,.]\d{3})+\b|\b\d{2,}\b|\b(?:dozens|hundreds|thousands|dizaines|centaines|milliers)\b/gi;

const MONTH = "janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|january|february|march|april|may|june|july|august|september|october|november|december";

/** The numbers in a sentence that could be counts: not years, not days of a month, not times of day. */
export function countsIn(s: string): string[] {
  return [...s.matchAll(NUMBER)].flatMap((m) => {
    const n = m[0], at = m.index ?? 0;
    const before = s.slice(Math.max(0, at - 12), at), after = s.slice(at + n.length, at + n.length + 12);
    if (/^(19|20)\d{2}$/.test(n)) return [];
    if (new RegExp(`^\\s*(?:${MONTH})`, "i").test(after) || new RegExp(`(?:${MONTH})\\s*$`, "i").test(before)) return [];
    if (/^\s*(?:h\b|h\d|heures?|:\d|am\b|pm\b)/i.test(after)) return [];
    // Ages are not counts: "a 22-year-old officer died" is one death, not 22; "un homme de 34 ans".
    if (/^\s*-?\s*(?:years?[- ]old|year\b|ans\b|an\b|-an)/i.test(after) || /(?:^|[^\p{L}])(?:âgée?s? de|aged)\s*$/iu.test(before)) return [];
    // Nor are distances: "250 miles southwest of Paris".
    if (/^\s*(?:miles?\b|km\b|kilom[eè]tres?|kilometers?|mètres|metres|meters)/i.test(after)) return [];
    return [n];
  });
}

/** What a sentence counts, by the first keyword family it carries. */
export function statementKind(s: string): StatementKind {
  if (/mineurs|âge moyen|average age|aged between|nationalit|étrangers? en situation|foreign nationals|sans papiers|casier judiciaire|criminal record|déjà connus des services|known to (?:the )?police|fichés? s\b/i.test(s)) return "profile";
  if (/€|\beuros?\b|M€|Md€/i.test(s) && /dégât|damage|coût|cost|préjudice|sinistre|destroy|détruit|repair|réparation|assur|insur/i.test(s)) return "cost";
  if (/tourism (?:sector|industry)|secteur (?:du )?touris|fréquentation touristique|tourist (?:numbers|bookings|arrivals)|hôteliers?|hoteliers?|réservations?|bookings?|cancellations?|annulations?|chiffre d.affaires|turnover|retail sales|pertes? d.exploitation|CAC ?40|bourse de paris|stock market|investors|spread|\bOAT\b|bond yields?|croissance|economic growth|\bPIB\b|\bGDP\b/i.test(s)) return "economy";
  if (/agression sexuelle|agressions sexuelles|sexual(?:ly)? assault|sexual violence|\bviols?\b|\bviolée?s?\b|\brape[sd]?\b|harcèlement|harass|molest|attouchement/i.test(s)) return "assaults";
  if (/(?:policiers|gendarmes|forces de l.ordre|officers|police)\b.{0,40}\b(?:mobilisés|déployés|deployed|mobilised|mobilized)|blindés|armou?red vehicles|\barmée\b|\barmy\b|soldiers|militaires|sentinelle|raid\b|GIGN|BRI\b|CRS\b.{0,20}(?:déployé|mobilis)/i.test(s)) return "deployment";
  if (/interpell|arrest|gardes? à vue|en garde|détenu|detain/i.test(s)) return "arrests";
  // Whole words: "constitués" is not "tués", "deadline" is not "dead".
  if (/(?<!\p{L})(?:morts?|tu[ée]e?s?|décès|décédée?s?|dead|killed|died)(?!\p{L})/iu.test(s)) return "deaths";
  if (/blessé|injur|hurt|hospital/i.test(s)) return "injured";
  if (/manifestants|protesters|demonstrators|défilé|marched|took to the streets|dans la rue|particip|took part|attended|ont manifesté|mobilisés/i.test(s)) return "protesters";
  if (/véhicules?|voitures?|cars?\b|vehicles?|incendi|burn|torched|bâtiments?|buildings?|commerces?|shops?|magasins?|pillag|loot|dégradation/i.test(s)) return "damage";
  return "other";
}

/**
 * Sentences in an article that state a count and say whose count it is.
 *
 * A sentence is kept only if it carries a number of two or more digits (or
 * "dozens", "hundreds"…), a word saying what is counted, and a source the
 * sentence itself names. The sentence is kept word for word. It is a report of
 * what someone said, shown as such; it is never turned into a figure.
 */
export function extractStatements(text: string, meta: { outlet: string; url: string; seen: string | null; lang: string }): Statement[] {
  const sentences = text.split(/\n+/).flatMap((p) => p.split(/(?<=[.!?»”])\s+(?=[A-ZÀ-ÖØ-Þ«“"])/));
  const out: Statement[] = [];
  const seen = new Set<string>();
  for (const raw of sentences) {
    const s = raw.trim();
    if (s.length < 40 || s.length > 420 || seen.has(s)) continue;
    if (!COUNT.test(s)) continue;
    const numbers = countsIn(s);
    if (!numbers.length) continue;
    const who = attribution(s);
    if (!who) continue;
    // A quote is shown as printed; one that cannot be decoded cleanly is not shown at all.
    if (hasEntity(s)) continue;
    seen.add(s);
    out.push({ quote: s, numbers, kind: statementKind(s), who, ...meta });
  }
  return out;
}

export const KIND_LABEL: Record<StatementKind, string> = {
  arrests: "Arrests and custody", injured: "Injured", deaths: "Deaths", protesters: "Turnout", damage: "Damage and arson",
  cost: "Cost of damage", economy: "Economy and trade", assaults: "Assaults, incl. sexual", deployment: "Forces deployed",
  profile: "Who was arrested", other: "Other figures",
};

/** Live searches on X that a reader can open themselves: no cost to the site, nothing stored. */
export const X_LIVE_SEARCHES: Array<{ label: string; q: string }> = [
  { label: "Videos: émeutes France", q: "émeutes France filter:videos" },
  { label: "Videos: France riots", q: "France riots filter:videos" },
  { label: "Paris, latest", q: "Paris manifestation OR émeutes OR casseurs" },
  { label: "Interior Ministry & Paris police", q: "from:Interieur_Gouv OR from:prefpolice" },
];
export const xSearchUrl = (q: string) => `https://x.com/search?q=${encodeURIComponent(q)}&f=live`;


/* ── Claims about the causes, credited to whoever makes them ─────────── */

/** People and bodies whose claims about the riots are reported. Their words are quoted, never adopted. */
export const SPEAKERS: Array<[RegExp, string]> = [
  [/\bmacron\b|président de la république|french president|chef de l.[ée]tat|head of state|l.[ée]lys[ée]e a/i, "Emmanuel Macron (President)"], [/lecornu|premier ministre|prime minister/i, "Sébastien Lecornu (Prime Minister)"],
  [/nu[ñn]ez|ministre de l.intérieur|interior minister|minister of the interior/i, "Laurent Nuñez (Interior Minister)"],
  [/[ée]douard philippe/i, "Édouard Philippe (Horizons)"], [/gabriel attal/i, "Gabriel Attal (Renaissance)"], [/wauquiez/i, "Laurent Wauquiez (LR)"],
  [/tondelier/i, "Marine Tondelier (Les Écologistes)"], [/manuel bompard/i, "Manuel Bompard (LFI)"], [/sophie binet/i, "Sophie Binet (CGT)"],
  [/retailleau/i, "Bruno Retailleau (LR)"], [/bardella/i, "Jordan Bardella (RN)"], [/le pen/i, "Marine Le Pen (RN)"], [/m[ée]lenchon/i, "Jean-Luc Mélenchon (LFI)"],
  [/zemmour/i, "Éric Zemmour (Reconquête)"], [/ciotti/i, "Éric Ciotti (UDR)"], [/glucksmann/i, "Raphaël Glucksmann (Place publique)"], [/olivier faure/i, "Olivier Faure (PS)"],
  [/ruffin/i, "François Ruffin"], [/braun-? ?pivet/i, "Yaël Braun-Pivet (Assembly President)"], [/\btrump\b|dirigeant américain|(?<!vice-)président américain|(?<!vice-)président des [ée]tats-unis|(?<!vice )US president|(?<!vice )American president|(?<!vice )president of the United States/i, "Donald Trump"], [/\bvance\b/i, "JD Vance"], [/\bkhanna\b/i, "Ro Khanna (US Representative)"],
  [/\bmusk\b/i, "Elon Musk"], [/gad saad/i, "Gad Saad"], [/magyar/i, "Péter Magyar (Hungarian PM)"], [/orb[aá]n/i, "Viktor Orbán"], [/meloni/i, "Giorgia Meloni"],
  [/\bCGT\b|intersyndicale|syndicats?\b|unions?\b/i, "unions"], [/UNEF|union étudiante|student union|organisations? étudiantes?|lycéens?/i, "student organisations"],
  [/préfe|prefect/i, "a prefect"], [/parquet|procureur|prosecutor/i, "prosecutors"],
];
const THEMES: Array<[ClaimTheme, RegExp]> = [
  ["immigration", /immigr|migrant|étrangers?\b|foreigners?|islam|muslim|musulman|banlieues?|quartiers populaires|cités\b|sharia|frontières|borders/i],
  ["far-left", /ultra-?gauche|extrême gauche|far[- ]left|antifa|black ?bloc|\bLFI\b|insoumis|anarchis/i],
  ["far-right", /ultra-?droite|extrême droite|far[- ]right|identitaires?|néo-?nazi/i],
  ["cost-of-living", /vie chère|cost[- ]of[- ]living|pouvoir d.achat|prix|prices|salaires|wages|austérité|austerity|budget|étudiants?|students?|jeunesse|youth|précarité/i],
  ["policing", /violences policières|police (?:violence|brutality)|maintien de l.ordre|\bLBD\b|flash-?ball|grenades?|tear ?gas|lacrymo/i],
  ["foreign", /ingérence|interference|russi|kremlin|bots?\b|désinformation|disinformation|algéri/i],
  ["government", /démission|resign|gouvernement (?:est )?responsable|government (?:is )?(?:to blame|responsible)|macron (?:is )?responsible|échec du gouvernement|failure of (?:the )?government/i],
  ["crime", /délinquan|criminal gangs?|bandes|gangs?\b|trafic|dealers?|pillards|looters? (?:were|are) criminals|opportunis/i],
];
const CLAIM_VERB = /accus|blam|dénonc|pointe du doigt|responsab|fault|attribu|lie\b|lient|links?\b|linked|said|says|a déclaré|a affirmé|a fait valoir|a assuré|a estimé|acknowledged|a reconnu|estime|selon|instigation|claims?|claimed|insist|warn|aver|wrote|a écrit|tweet|posted|a posté/i;
export const THEME_LABEL: Record<ClaimTheme, string> = {
  immigration: "Immigration, Islam or the suburbs", "far-left": "The far left or black bloc", "far-right": "The far right",
  "cost-of-living": "Cost of living, students, austerity", policing: "Policing", foreign: "Foreign interference", government: "The government", crime: "Crime and gangs",
};

/**
 * Sentences in which a named person or body says what or who is behind the
 * violence. Kept when the sentence names a speaker, a claim verb and at least
 * one theme. The claim is the speaker's; the site reports that it was made.
 */
export function extractClaims(text: string, meta: { outlet: string; url: string; seen: string | null; lang: string }): Claim[] {
  const out: Claim[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\n+/).flatMap((p) => p.split(/(?<=[.!?»”])\s+(?=[A-ZÀ-ÖØ-Þ«“"])/))) {
    const s = raw.trim();
    if (s.length < 50 || s.length > 450 || seen.has(s) || hasEntity(s) || !CLAIM_VERB.test(s) || !/émeut|riot|violen|casseur|pill|loot|unrest|chaos|troubles|manifest|protest|incendi|burn/i.test(s)) continue;
    // The speaker is the one named nearest a reporting verb: in "Édouard Philippe, former
    // prime minister to Emmanuel Macron, said…", it is Philippe, not Macron.
    // A name directly followed by its verb ("Khanna went on to claim…") is the speaker before
    // any name that merely sits near one ("…replying to JD Vance, who had said…").
    const verbs = [...s.matchAll(new RegExp(CLAIM_VERB.source, "gi"))].map((m) => m.index ?? 0);
    let speaker: string | undefined, best = Infinity, subject: string | undefined, subjectAt = Infinity;
    for (const [re, name] of SPEAKERS) {
      for (const m of s.matchAll(new RegExp(re.source, "gi"))) {
        const at = m.index ?? 0, end = at + m[0].length;
        const d = Math.min(...verbs.map((v) => Math.abs(v - at)));
        if (d < best) { best = d; speaker = name; }
        if (verbs.some((v) => v >= end && v - end <= 25 && !/[,;.:]/.test(s.slice(end, v))) && at < subjectAt) { subjectAt = at; subject = name; }
      }
    }
    speaker = subject ?? speaker;
    if (!speaker) continue;
    const themes = THEMES.filter(([, re]) => re.test(s)).map(([t]) => t);
    if (!themes.length) continue;
    seen.add(s);
    out.push({ quote: s, themes, speaker, ...meta });
  }
  return out;
}

/* ── Named businesses reported attacked ───────────────────────────────── */

/** Chains, brands and banks, as reporting names them. Matched as whole words, case-sensitively for short names. */
export const BRANDS: Array<[string, RegExp]> = [
  ["McDonald's", /McDonald|McDo\b/], ["Burger King", /Burger King/], ["KFC", /\bKFC\b/], ["Starbucks", /Starbucks/], ["Apple Store", /Apple(?: Store)?\b/],
  ["Nike", /\bNike\b/], ["Adidas", /\bAdidas\b/], ["Foot Locker", /Foot ?Locker/], ["Zara", /\bZara\b/], ["H&M", /\bH&M\b|\bH & M\b/], ["Lacoste", /Lacoste/],
  ["Louis Vuitton", /Louis Vuitton|\bLVMH\b/], ["Dior", /\bDior\b/], ["Chanel", /\bChanel\b/], ["Hermès", /Herm[èe]s/], ["Cartier", /Cartier/], ["Sephora", /Sephora/],
  ["Fnac", /\bFnac\b/], ["Darty", /\bDarty\b/], ["Decathlon", /Decathlon|Décathlon/], ["Monoprix", /Monoprix/], ["Franprix", /Franprix/], ["Carrefour", /Carrefour/],
  ["Lidl", /\bLidl\b/], ["Auchan", /Auchan/], ["Intermarché", /Intermarch[ée]/], ["Leclerc", /Leclerc/], ["Galeries Lafayette", /Galeries Lafayette/], ["Printemps", /\bPrintemps\b/],
  ["Orange", /\bOrange\b(?! mécanique)/], ["SFR", /\bSFR\b/], ["Bouygues Telecom", /Bouygues/], ["Free", /\bboutique Free\b|\bFree Center\b/], ["Tesla", /\bTesla\b/],
  ["BNP Paribas", /BNP/], ["Société Générale", /Soci[ée]t[ée] G[ée]n[ée]rale/], ["Crédit Agricole", /Cr[ée]dit Agricole/], ["LCL", /\bLCL\b/], ["Caisse d'Épargne", /Caisse d.[ÉE]pargne/],
  ["La Banque Postale", /Banque Postale/], ["Crédit Mutuel", /Cr[ée]dit Mutuel/], ["Rolex", /\bRolex\b/], ["Uniqlo", /Uniqlo/], ["Primark", /Primark/], ["JD Sports", /JD Sports/],
  ["Courir", /\bCourir\b/], ["Snipes", /\bSnipes\b/], ["Intersport", /Intersport/], ["Go Sport", /Go Sport/], ["Boulanger", /\bBoulanger\b/], ["Celio", /\bCelio\b/],
  ["Kiabi", /\bKiabi\b/], ["Mango", /\bMango\b/], ["Bershka", /Bershka/], ["Pull&Bear", /Pull ?& ?Bear/], ["Swarovski", /Swarovski/], ["Pandora", /\bPandora\b/],
  ["Longchamp", /\bLongchamp\b/], ["Saint Laurent", /Yves Saint[- ]Laurent|\bYSL\b|maison Saint Laurent/], ["Gucci", /\bGucci\b/], ["Prada", /\bPrada\b/],
  ["Balenciaga", /Balenciaga/], ["Bulgari", /Bulgari|Bvlgari/], ["Tiffany & Co.", /\bTiffany\b/], ["Omega", /\bOmega\b(?! 3)/], ["Nespresso", /Nespresso/], ["Ladurée", /Ladur[ée]e/],
  ["Casino", /Géant Casino|Petit Casino|supermarché Casino|magasin Casino|Casino supermarket/], ["Système U", /Super U\b|Hyper U\b|Système U\b|Systeme U\b|\bU Express\b/],
  ["Picard", /\bPicard\b(?! \p{Lu})/u], ["Leroy Merlin", /Leroy Merlin/], ["Castorama", /Castorama/], ["Ikea", /\bIkea\b|\bIKEA\b/], ["Action", /magasin Action\b|enseigne Action\b|Action store|(?<=, )Action(?=,| and | et )/], ["Hugo Boss", /Hugo Boss/], ["The Kooples", /The Kooples/], ["Zadig & Voltaire", /Zadig ?(?:&|et) ?Voltaire/],
  ["Samsung", /\bSamsung\b/], ["Boulangerie Paul", /boulangerie Paul\b|Paul bakery/], ["TotalEnergies", /TotalEnergies|station Total\b/], ["Renault", /\bRenault\b/],
  ["Peugeot", /\bPeugeot\b/], ["Citroën", /Citro[ëe]n/], ["BMW", /\bBMW\b/], ["Mercedes", /\bMercedes\b/], ["Lime", /trottinettes? Lime|Lime scooters?/], ["Vélib'", /V[ée]lib/],
  ["JCDecaux", /JC ?Decaux/], ["RATP", /\bRATP\b/], ["SNCF", /\bSNCF\b/], ["La Poste", /bureaux? de [Pp]oste|\bLa Poste\b/], ["France Travail", /France Travail|P[ôo]le emploi/],
];
/** What each brand sells, for grouping the damage register; a brand not listed here is "other". */
export const BRAND_SECTOR: Record<string, string> = Object.fromEntries(([
  ["Fast food and cafés", ["McDonald's", "Burger King", "KFC", "Starbucks", "Boulangerie Paul", "Ladurée", "Nespresso"]],
  ["Sportswear and trainers", ["Nike", "Adidas", "Foot Locker", "Courir", "Snipes", "JD Sports", "Decathlon", "Intersport", "Go Sport", "Lacoste"]],
  ["Fashion", ["Hugo Boss", "The Kooples", "Zadig & Voltaire", "Zara", "H&M", "Uniqlo", "Primark", "Celio", "Kiabi", "Mango", "Bershka", "Pull&Bear"]],
  ["Luxury and jewellery", ["Louis Vuitton", "Dior", "Chanel", "Hermès", "Cartier", "Rolex", "Saint Laurent", "Gucci", "Prada", "Balenciaga", "Bulgari", "Tiffany & Co.", "Omega", "Swarovski", "Pandora", "Longchamp"]],
  ["Department stores and beauty", ["Galeries Lafayette", "Printemps", "Sephora"]],
  ["Electronics and phones", ["Apple Store", "Fnac", "Darty", "Boulanger", "Samsung", "Orange", "SFR", "Bouygues Telecom", "Free"]],
  ["Supermarkets", ["Carrefour", "Lidl", "Auchan", "Intermarché", "Leclerc", "Monoprix", "Franprix", "Casino", "Système U", "Picard", "Action"]],
  ["DIY and furniture", ["Leroy Merlin", "Castorama", "Ikea"]],
  ["Banks", ["BNP Paribas", "Société Générale", "Crédit Agricole", "LCL", "Caisse d'Épargne", "La Banque Postale", "Crédit Mutuel"]],
  ["Cars and fuel", ["Tesla", "Renault", "Peugeot", "Citroën", "BMW", "Mercedes", "TotalEnergies"]],
  ["Transport and street", ["RATP", "SNCF", "Vélib'", "Lime", "JCDecaux"]],
  ["Public services", ["La Poste", "France Travail"]],
] as Array<[string, string[]]>).flatMap(([sector, names]) => names.map((n) => [n, sector])));
// Whole-word starts: "estampillées" (stamped) is not "pillées" (looted).
const ATTACKED = /(?<![a-zà-ÿ])pill[ée]|(?<![a-zà-ÿ])pillage|loot|saccag|ransack|vandalis|dégrad|incendi|brûl|burn|torch|smash|brisé|cassé|défonc|attaqu|attack|ravag|dévalis|cambriol|break-?in|broken into/i;

/** Sentences naming a business as looted, vandalised or burned, with the city if the sentence names one. */
export function extractBusinessReports(text: string, meta: { outlet: string; url: string; seen: string | null }): BusinessReport[] {
  const out: BusinessReport[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\n+/).flatMap((p) => p.split(/(?<=[.!?»”])\s+(?=[A-ZÀ-ÖØ-Þ«“"])/))) {
    const s = raw.trim();
    if (s.length < 30 || s.length > 420 || hasEntity(s) || !ATTACKED.test(s)) continue;
    const city = CITIES.find((c) => new RegExp(`(?<![\\p{L}-])(?:${[c.name, ...(c.alt ?? [])].join("|")})(?![\\p{L}-])`, "u").test(s))?.name ?? null;
    for (const [brand, re] of BRANDS) {
      if (!re.test(s) || seen.has(`${brand}|${s}`)) continue;
      seen.add(`${brand}|${s}`);
      out.push({ brand, city, quote: s, ...meta });
    }
  }
  return out;
}

/* ── Property damage, as reported ─────────────────────────────────────── */

const CITY_RES = CITIES.map((c) => ({ name: c.name, re: new RegExp(`(?<![\\p{L}-])(?:${[c.name, ...(c.alt ?? [])].join("|")})(?![\\p{L}-])`, "u") }));
/** The city a sentence names first, or none. */
export function firstCity(s: string): string | null {
  let best: string | null = null, at = Infinity;
  for (const c of CITY_RES) { const m = c.re.exec(s); if (m && m.index < at) { at = m.index; best = c.name; } }
  return best;
}

export const DAMAGE_LABEL: Record<DamageCategory, string> = {
  "public-building": "Town halls, schools and public buildings", police: "Police stations and vehicles", mall: "Shopping centres", shop: "Shops and stores",
  bank: "Banks and cash machines", restaurant: "Restaurants, cafés and bars", vehicle: "Cars and other vehicles", transport: "Buses, trams, stations and trains",
  street: "Street furniture, bins and barricades", monument: "Monuments and places of worship", home: "Homes and residential buildings",
};
/** What kind of property a sentence names. Order matters only for display. */
const DAMAGE: Array<[DamageCategory, RegExp]> = [
  ["police", /commissariats?|police stations?|postes? de police|casernes? de gendarmerie|brigades? de gendarmerie|voitures? de police|véhicules? de (?:police|gendarmerie)|fourgons?|police (?:cars?|vans?|vehicles?)|cars? de (?:police|CRS)/i],
  ["public-building", /mairies?|hôtels? de ville|town halls?|city halls?|sous-préfectures?|hôtels? de préfecture|prefecture buildings?|tribunal|palais de justice|courthouses?|écoles?|collèges?|lycées?|schools?|médiathèques?|bibliothèques?|librar(?:y|ies)|gymnases?|centres? sociaux|centre social|community cent(?:re|er)s?|bureaux? de poste|post offices?|bâtiments? publics?|public buildings?|offices? de tourisme|tourist offices?|France Travail|Pôle emploi|universités?|universit(?:y|ies)|Sorbonne/i],
  ["mall", /centres? commerci|galeries? marchandes?|shopping (?:cent(?:re|er)s?|malls?|arcades?)|\bmalls?\b|Forum des Halles|Westfield|Part-Dieu|Terrasses du Port|Euralille|O.Parinor|Rosny 2|Créteil Soleil|Qwartz|Polygone Riviera|Mériadeck|Beaugrenelle|Italie Deux|Quatre Temps|4 Temps|Centre Bourse/i],
  ["shop", /commerces?|magasins?|boutiques?|vitrines?|devantures?|\bshops?\b|\bstores?\b|storefronts?|shopfronts?|shop windows?|supermarchés?|supermarkets?|supérettes?|pharmacies?|pharmac(?:y|ies)|bureaux? de tabac|bijouteries?|jewel(?:l)?er(?:y|s)?|opticiens?|concessions? automobiles?|car dealerships?|showrooms?|entrepôts?|warehouses?|retail outlets?|enseignes?/i],
  ["bank", /banques?|agences? bancaires?|\bbanks?\b|distributeurs? (?:automatiques?|de billets)|\bDAB\b|\bATMs?\b|cash machines?/i],
  ["restaurant", /restaurants?|\bcafés?\b|brasseries?|\bbars?\b|fast-?foods?|kebabs?|bistrots?|terrasses?/i],
  ["vehicle", /voitures?|véhicules?|\bcars?\b|vehicles?|scooters?|motos?\b|motorbikes?|camions?|trucks?|utilitaires?|\bvans?\b/i],
  ["transport", /\bbus\b|\bbuses\b|autobus|tram(?:way)?s?\b|métros?\b|metro stations?|stations? de métro|\bgares?\b|train stations?|railway|\brames?\b|\btrains?\b|abribus|bus (?:stops?|shelters?)|Vélib|trottinettes?|\bRATP\b|\bSNCF\b|péages?|toll booths?/i],
  ["street", /mobilier urbain|street furniture|poubelles?|conteneurs?|\bbins?\b|dustbins?|feux (?:de signalisation|tricolores)|traffic lights?|lampadaires?|street ?lights?|kiosques?|horodateurs?|parking meters?|barricades?|chantiers?|construction sites?|panneaux publicitaires|billboards?/i],
  ["monument", /monuments?|statues?|Arc de Triomphe|églises?|church(?:es)?|cathédrales?|cathedrals?|mosquées?|mosques?|synagogues?|cimetières?|cemeter(?:y|ies)|mémorial|memorials?|plaques? commémoratives?/i],
  ["home", /immeubles?|logements?|appartements?|apartments?|habitations?|\bhomes\b|\bhouses\b|residential buildings?|résidences?|halls? d.immeubles?|blocks? of flats/i],
];
export function damageCategories(s: string): DamageCategory[] {
  return DAMAGE.filter(([, re]) => re.test(s)).map(([c]) => c);
}
const cap = (w: string) => `[${w[0]!.toLowerCase()}${w[0]!.toUpperCase()}]${w.slice(1)}`;
/** "la mairie de Bobigny", "le commissariat de Nanterre", "Bobigny town hall": buildings a sentence names. */
const NAMED_FR = new RegExp(`(?<![\\p{L}])(${["mairie", "hôtel de ville", "commissariat", "sous-préfecture", "lycée", "collège", "école", "médiathèque", "bibliothèque", "gare", "centre commercial", "gymnase", "église", "centre social", "tribunal", "caserne", "agence"].map(cap).join("|")})\\s+(de la |de l'|de l’|de |du |des |d'|d’)?(\\p{Lu}[\\p{L}'’-]+(?:[ -](?:de |du |des |la |le |d'|d’|sur-|sous-)?\\p{Lu}[\\p{L}'’-]+){0,3})`, "gu");
const NAMED_EN = /(?<![\p{L}]|(?:des|de|du|la|le) )((?:\p{Lu}[\p{L}'’-]+[ -]){1,3})(town hall|city hall|police station|shopping cent(?:re|er)|shopping mall|train station|station|library|high school|school|courthouse)\b/gu;
const NAMED_MALL = /Forum des Halles|Centre Bourse|Westfield(?: (?:des |de |du |la |le )?\p{Lu}[\p{L}'’-]+){1,4}|Part-Dieu|Terrasses du Port|Euralille|O.Parinor|Rosny 2|Créteil Soleil|Qwartz|Polygone Riviera|Mériadeck|Beaugrenelle|Italie Deux|Quatre Temps|Les 4 Temps/gu;
const NOT_A_PLACE = /^(?:Le|La|Les|The|Un|Une|A|An|This|Ce|Cette|Police|Paris|France)$/;
export function namedPlaces(s: string): string[] {
  const out = new Set<string>();
  for (const m of s.matchAll(NAMED_FR)) {
    const name = m[3]!.trim().replace(/[’']$/, "");
    if (!NOT_A_PLACE.test(name)) out.add(`${m[1]!.toLowerCase()} ${m[2] ?? ""}${name}`);
  }
  for (const m of s.matchAll(NAMED_EN)) {
    const name = m[1]!.trim();
    if (!name.split(/[ -]/).every((w) => NOT_A_PLACE.test(w))) out.add(`${name.replace(/^(?:The|A|An) /, "")} ${m[2]!.toLowerCase()}`);
  }
  for (const m of s.matchAll(NAMED_MALL)) out.add(m[0].trim());
  // "Forum des Halles" inside "Westfield Forum des Halles" is the same place.
  return [...out].filter((p, _, all) => !all.some((q) => q !== p && q.includes(p)));
}

/**
 * Sentences reporting property attacked, looted or burned. Kept when a
 * sentence carries an attack verb and names a kind of property; brands,
 * named buildings, the city and any counts are picked out, and the sentence
 * itself is kept word for word.
 */
export function extractDamage(text: string, meta: { outlet: string; url: string; seen: string | null; lang: string }): DamageItem[] {
  const out: DamageItem[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\n+/).flatMap((p) => p.split(/(?<=[.!?»”])\s+(?=[A-ZÀ-ÖØ-Þ«“"])/))) {
    const s = raw.trim();
    if (s.length < 30 || s.length > 450 || seen.has(s) || hasEntity(s) || !ATTACKED.test(s)) continue;
    const categories = damageCategories(s);
    const brands = BRANDS.filter(([, re]) => re.test(s)).map(([b]) => b);
    if (!categories.length && !brands.length) continue;
    seen.add(s);
    out.push({ quote: s, categories: categories.length ? categories : ["shop"], brands, places: namedPlaces(s), numbers: countsIn(s), city: firstCity(s), ...meta });
  }
  return out;
}

/* ── Pictures and videos ──────────────────────────────────────────────── */

/** Addresses that are page furniture, not reporting: logos, icons, avatars, tracking pixels. */
const FURNITURE = /logo|icon|avatar|sprite|placeholder|blank|pixel|spacer|favicon|badge|author|profile|default[-_.]|share[-_]?image|og[-_]default|fallback|banner[-_]ad|\.svg(?:$|\?)|\.gif(?:$|\?)|1x1|gravatar|emoji/i;
const attr = (tagText: string, name: string) => new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tagText)?.[1] ?? null;
const absolute = (src: string, page: string) => { try { const u = new URL(unescape(src), page); return /^https?:$/.test(u.protocol) ? u.toString() : null; } catch { return null; } };

/**
 * Pictures and videos an article publishes: the image it declares for link
 * previews (og:image), the images in its <figure>s with their captions, and
 * the YouTube videos it embeds. At most six images per article.
 */
export function mediaInHtml(html: string, page: string): Array<{ kind: "image" | "video"; src: string; caption: string | null; videoId?: string }> {
  const out: Array<{ kind: "image" | "video"; src: string; caption: string | null; videoId?: string }> = [];
  const have = new Set<string>();
  const add = (src: string | null, caption: string | null) => {
    const abs = src ? absolute(src, page) : null;
    if (!abs || FURNITURE.test(abs) || have.has(abs) || out.filter((o) => o.kind === "image").length >= 6) return;
    have.add(abs);
    out.push({ kind: "image", src: abs, caption: caption && caption.length > 3 ? caption.slice(0, 300) : null });
  };
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const prop = attr(m[0], "property") ?? attr(m[0], "name");
    if (prop && /^(?:og:image(?::url|:secure_url)?|twitter:image(?::src)?)$/i.test(prop)) add(attr(m[0], "content"), null);
  }
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, " ");
  for (const f of body.matchAll(/<figure[\s>][\s\S]*?<\/figure>/gi)) {
    const img = /<img\b[^>]*>/i.exec(f[0])?.[0];
    if (!img) continue;
    const w = Number(attr(img, "width") ?? 0);
    if (w && w < 300) continue;
    const srcset = attr(img, "data-srcset") ?? attr(img, "srcset");
    const best = srcset?.split(",").map((x) => x.trim().split(/\s+/)[0]).filter(Boolean).at(-1) ?? null;
    const cap0 = /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i.exec(f[0])?.[1];
    add(attr(img, "data-src") ?? best ?? attr(img, "src"), cap0 ? unescape(cap0.replace(/<[^>]+>/g, " ")) : attr(img, "alt"));
  }
  for (const m of body.matchAll(/youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/g)) {
    const id = m[1]!;
    if (have.has(id)) continue;
    have.add(id);
    out.push({ kind: "video", src: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, caption: null, videoId: id });
  }
  return out;
}

/**
 * Wikimedia Commons search results (generator=search, prop=imageinfo with
 * extmetadata): freely licensed files uploaded since the story began, with
 * their author and licence.
 */
export function parseCommons(body: unknown, since: string): MediaItem[] {
  const pages = Object.values((body as { query?: { pages?: Record<string, unknown> } })?.query?.pages ?? {}) as Array<{ title?: string; imageinfo?: Array<{ url?: string; thumburl?: string; descriptionurl?: string; timestamp?: string; mime?: string; extmetadata?: Record<string, { value?: string }> }> }>;
  const plain = (v: string | undefined) => (v ? unescape(v.replace(/<[^>]+>/g, " ")) : "");
  return pages.flatMap((p) => {
    const ii = p.imageinfo?.[0];
    if (!ii?.url || !ii.descriptionurl || !/^image\/(?:jpeg|png|webp)$/.test(ii.mime ?? "")) return [];
    const md = ii.extmetadata ?? {};
    const taken = /^\d{4}-\d{2}-\d{2}/.exec(plain(md.DateTimeOriginal?.value))?.[0];
    const when = taken ? `${taken}T00:00:00Z` : ii.timestamp ?? null;
    if (!when || when < since) return [];
    const title = plain(md.ImageDescription?.value) || (p.title ?? "").replace(/^File:/, "").replace(/\.\w+$/, "");
    const license = plain(md.LicenseShortName?.value);
    // Only files whose licence lets them be shown with credit.
    if (!/^(?:CC|Public domain|PD|GFDL)/i.test(license)) return [];
    return [{ kind: "image" as const, src: ii.thumburl ?? ii.url, page: ii.descriptionurl, title: title.slice(0, 300), credit: plain(md.Artist?.value).slice(0, 120) || "Wikimedia Commons contributor", license, via: "commons" as const, seen: when, lang: "und" }];
  });
}

/* ── What the headlines report, by city ───────────────────────────────── */

export type IncidentType = "arson" | "looting" | "public-buildings" | "clashes" | "casualties";
export const INCIDENT_LABEL: Record<IncidentType, string> = {
  arson: "Fires and arson", looting: "Looting and vandalism", "public-buildings": "Attacks on public buildings", clashes: "Clashes with police", casualties: "Injuries or deaths",
};
const INCIDENTS: Array<[IncidentType, RegExp]> = [
  ["arson", /incendi|brûl|burn|torch|fire|flamm|blaze|ablaze/i],
  ["looting", /pill|loot|saccag|ransack|vandal|dégrad|smash|vitrines?|storefront|casseurs/i],
  ["public-buildings", /mairie|town hall|city hall|préfecture|prefecture|commissariat|police station|école|school|lycée|tribunal|courthouse|office de tourisme|tourist office|siège|headquarters|bâtiment public|public building/i],
  ["clashes", /heurts|affrontements?|clash|lacrymo|tear ?gas|canon à eau|water cannon|charges?\b|barricad/i],
  ["casualties", /bless|injur|hurt|mort\b|morts\b|dead|killed|died|décès/i],
];
export function incidentTypes(title: string): IncidentType[] {
  return INCIDENTS.filter(([, re]) => re.test(title)).map(([t]) => t);
}
/** For each city the headlines name: how many headlines report each kind of incident there. */
export function incidentsByCity(titles: string[]): Array<Place & { types: Partial<Record<IncidentType, number>> }> {
  const res = CITIES.map((c) => ({ c, re: new RegExp(`(?<![\\p{L}-])(?:${[c.name, ...(c.alt ?? [])].join("|")})(?![\\p{L}-])`, "u") }));
  return res.map(({ c, re }) => {
    const mine = titles.filter((t) => re.test(t));
    const types: Partial<Record<IncidentType, number>> = {};
    for (const t of mine) for (const k of incidentTypes(t)) types[k] = (types[k] ?? 0) + 1;
    return { name: c.name, lat: c.lat, lon: c.lon, count: mine.length, types };
  }).filter((p) => p.count > 0).sort((a, b) => b.count - a.count);
}

/* ── Markets ──────────────────────────────────────────────────────────── */

/** Stooq's daily CSV (Date,Open,High,Low,Close,Volume): closes, oldest first. */
export function parseStooq(csv: string): MarketPoint[] {
  return csv.trim().split(/\r?\n/).slice(1).flatMap((l) => {
    const [d, , , , c] = l.split(",");
    const close = Number(c);
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(close) && close > 0 ? [{ d, close }] : [];
  });
}
