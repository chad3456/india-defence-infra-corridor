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
export interface OfficialItem { source: string; title: string; url: string; date: string | null; relevant: boolean }
export interface Advisory { id: string; name: string; page: string; updatedAt: string | null; change: string | null; excerpt: string | null }
export interface XPost { id: string; handle: string; createdAt: string; video: boolean }
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
  official: OfficialItem[];
  advisories: Advisory[];
  readUrls: string[];
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

function unescape(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n))).replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
const tag = (xml: string, name: string) => { const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(xml); return m ? unescape(m[1]!.replace(/<[^>]+>/g, "")) : null; };
const iso = (raw: string | null) => { if (!raw) return null; const t = Date.parse(raw); return Number.isFinite(t) ? new Date(t).toISOString() : null; };

/** Google News RSS. Titles end " - Outlet"; the <source> element names the outlet too. */
export function parseGoogleNews(xml: string, lang: "fr" | "en", kind: Headline["kind"], query: string): Headline[] {
  return [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].flatMap((m) => {
    const b = m[0];
    const raw = tag(b, "title"), url = tag(b, "link");
    if (!raw || !url) return [];
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

/** Metropolitan France, with a margin: GDELT places outside it are not drawn on this map. */
export const FRANCE_BOX = { west: -5.6, east: 9.8, south: 41.2, north: 51.3 };

/** GDELT GEO 2.0 GeoJSON: places named in the matching coverage, with how often. */
export function parseGdeltGeo(body: unknown): Place[] {
  const feats = (body as { features?: Array<{ properties?: Record<string, unknown>; geometry?: { coordinates?: number[] } }> })?.features ?? [];
  const out: Place[] = [];
  for (const f of feats) {
    const [lon, lat] = f.geometry?.coordinates ?? [];
    const name = String(f.properties?.name ?? "").trim();
    const count = Number(f.properties?.count ?? 0);
    if (typeof lon !== "number" || typeof lat !== "number" || !name || !(count > 0)) continue;
    if (lon < FRANCE_BOX.west || lon > FRANCE_BOX.east || lat < FRANCE_BOX.south || lat > FRANCE_BOX.north) continue;
    out.push({ name: name.replace(/,\s*France$/i, ""), lat, lon, count });
  }
  return out.sort((a, b) => b.count - a.count);
}

/** gov.uk's content API for a travel-advice page: the latest change and when it was made. */
export function parseGovUkAdvice(body: unknown, meta: { id: string; name: string; page: string }): Advisory {
  const b = body as { public_updated_at?: string; details?: { change_description?: string; parts?: Array<{ slug?: string; body?: string }> } };
  const safety = b?.details?.parts?.find((p) => p.slug === "safety-and-security")?.body ?? "";
  const paras = [...safety.matchAll(/<p>([\s\S]*?)<\/p>/gi)].map((m) => unescape(m[1]!.replace(/<[^>]+>/g, "")));
  const excerpt = paras.find((p) => /protest|demonstrat|riot|strike|unrest/i.test(p)) ?? null;
  return { ...meta, updatedAt: iso(b?.public_updated_at ?? null), change: b?.details?.change_description?.trim() || null, excerpt: excerpt && excerpt.length > 500 ? `${excerpt.slice(0, 497)}…` : excerpt };
}

/** Links on a government press page: title and address, newest as the page orders them. */
export function parseOfficialLinks(html: string, base: string, source: string): OfficialItem[] {
  const out: OfficialItem[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<a[^>]+href="([^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const title = unescape(m[2]!.replace(/<[^>]+>/g, " "));
    if (title.length < 25 || title.length > 300) continue;
    let url: string;
    try { url = new URL(m[1]!, base).toString(); } catch { continue; }
    if (!/\/actualites\/|\/communique|\/presse\//i.test(url) || seen.has(url) || url === base) continue;
    seen.add(url);
    const date = /(\d{1,2})[/.](\d{1,2})[/.](20\d{2})/.exec(title);
    out.push({ source, title, url, date: date ? `${date[3]}-${date[2]!.padStart(2, "0")}-${date[1]!.padStart(2, "0")}` : null, relevant: TOPIC.test(title) });
  }
  return out.slice(0, 25);
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
  [/ministère de l.intérieur|ministre de l.intérieur|interior minist/i, "Interior Ministry"],
  [/préfecture de police|prefecture de police|paris police (?:prefecture|headquarters)|préfet de police/i, "Paris Police Prefecture"],
  [/préfe|prefect/i, "a prefecture"],
  [/macron|élysée|elysee/i, "the President"],
  [/premier ministre|prime minister|matignon/i, "the Prime Minister"],
  [/parquet|procureur|prosecutor/i, "prosecutors"],
  [/gendarmerie/i, "the Gendarmerie"],
  [/police nationale|national police|police said|selon la police|according to (?:the )?police|police sources?/i, "police"],
  [/organisateurs|organisers|organizers|syndicat|union|CGT|CFDT|FO\b|intersyndicale/i, "organisers or unions"],
  [/pompiers|firefighters|fire service/i, "firefighters"],
  [/mairie|maire|mayor/i, "a mayor"],
];
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
  if (/manifestants|protesters|demonstrators|défilé|marched|took to the streets|dans la rue/i.test(s)) return "protesters";
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
    const who = WHO.find(([re]) => re.test(s))?.[1] ?? null;
    if (!who) continue;
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
