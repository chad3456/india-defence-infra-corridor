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

export interface Headline { title: string; outlet: string; url: string; published: string | null; lang: "fr" | "en"; kind: "press" | "official"; query: string }
export interface Video { id: string; title: string; channel: string; handle: string; published: string | null }
export interface Article { url: string; title: string; domain: string; language: string; country: string; seen: string | null; image: string | null }
export interface PulsePoint { t: string; v: number }
export interface Place { name: string; lat: number; lon: number; count: number }
export type StatementKind = "arrests" | "injured" | "deaths" | "protesters" | "damage" | "other";
export interface Statement { quote: string; numbers: string[]; kind: StatementKind; who: string | null; outlet: string; url: string; seen: string | null; lang: string }
export interface Advisory { id: string; name: string; page: string; updatedAt: string | null; change: string | null; excerpt: string | null }
export interface XPost { id: string; handle: string; createdAt: string; video: boolean }
/** A post on X that a newsroom embedded in its own article: found there, never searched for. */
export interface EmbeddedPost { id: string; handle: string; createdAt: string; outlet: string; articleUrl: string; articleTitle: string }
/** Metropolitan France as one SVG path, with the projection that drew it (lib/france-outline.ts). */
export interface Outline { d: string; scale: number; translate: [number, number]; width: number; height: number }
export interface SourceStatus { id: string; label: string; ok: boolean; count: number; error?: string }

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
  x: { active: boolean; reason?: string; day: string; readsToday: number; budgetPerDay: number; costUsdToday: number; lastAt?: string; posts: XPost[] };
  status: SourceStatus[];
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

/* ── What belongs on the tracker ──────────────────────────────────────── */

const TOPIC = /émeut|riot|casseur|pillag|loot|violen|affront|clash|incendi|arson|interpell|arrest|gardes? à vue|manifest|protest|mobilis|grève|strike|blocage|lacrymo|tear ?gas|black ?bloc|couvre-feu|curfew|bloquons|dégradation|vandal/i;
const PLACE = /france|français|française|french|paris|lyon|marseille|bordeaux|lille|nantes|toulouse|rennes|strasbourg|montpellier|nice\b|grenoble|rouen|toulon|saint-étienne|dijon|macron|nuñez|nunez|préfe|prefect|gendarm|\bCRS\b|élysée|elysee|matignon/i;

/** A headline, title or video belongs if it names unrest and places it in France. */
export function isAboutRiots(text: string): boolean {
  return TOPIC.test(text) && PLACE.test(text);
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

const NOT_A_USER = new Set(["i", "intent", "share", "home", "search", "hashtag", "explore", "settings", "login", "signup", "web"]);
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
    if (!out.has(id)) out.set(id, { id, handle });
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
export const hasEntity = (t: string) => /&(?:[a-zA-Z][a-zA-Z0-9]*|#x?[0-9a-fA-F]+);/.test(t);

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
export function parseGoogleNews(xml: string, lang: "fr" | "en", kind: Headline["kind"], query: string): Headline[] {
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

const NUMBER = /\b\d{1,3}(?:[  ,.]\d{3})+\b|\b\d{2,}\b|\b(?:dozens|hundreds|thousands|dizaines|centaines|milliers)\b/gi;

const MONTH = "janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|january|february|march|april|may|june|july|august|september|october|november|december";

/** The numbers in a sentence that could be counts: not years, not days of a month, not times of day. */
export function countsIn(s: string): string[] {
  return [...s.matchAll(NUMBER)].flatMap((m) => {
    const n = m[0], at = m.index ?? 0;
    const before = s.slice(Math.max(0, at - 12), at), after = s.slice(at + n.length, at + n.length + 12);
    if (/^(19|20)\d{2}$/.test(n)) return [];
    if (new RegExp(`^\\s*(?:${MONTH})`, "i").test(after) || new RegExp(`(?:${MONTH})\\s*$`, "i").test(before)) return [];
    if (/^\s*(?:h\b|h\d|heures?|:\d|am\b|pm\b)/i.test(after)) return [];
    return [n];
  });
}

/** What a sentence counts, by the first keyword family it carries. */
export function statementKind(s: string): StatementKind {
  if (/interpell|arrest|gardes? à vue|en garde|détenu|detain/i.test(s)) return "arrests";
  if (/\bmorts?\b|dead|killed|tués?|décès|died/i.test(s)) return "deaths";
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
  arrests: "Arrests and custody", injured: "Injured", deaths: "Deaths", protesters: "Turnout", damage: "Damage and arson", other: "Other figures",
};

/** Live searches on X that a reader can open themselves: no cost to the site, nothing stored. */
export const X_LIVE_SEARCHES: Array<{ label: string; q: string }> = [
  { label: "Videos: émeutes France", q: "émeutes France filter:videos" },
  { label: "Videos: France riots", q: "France riots filter:videos" },
  { label: "Paris, latest", q: "Paris manifestation OR émeutes OR casseurs" },
  { label: "Interior Ministry & Paris police", q: "from:Interieur_Gouv OR from:prefpolice" },
];
export const xSearchUrl = (q: string) => `https://x.com/search?q=${encodeURIComponent(q)}&f=live`;
