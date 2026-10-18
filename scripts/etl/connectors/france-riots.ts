/**
 * The scheduled half of the France riots tracker.
 *
 * `npm run france:riots`. Writes data/france-riots/register.json. CI only: the
 * editing sandbox cannot reach the news, video or government hosts.
 *
 * The live route (app/api/france-riots) asks the fast sources on every
 * request. This job does what a request cannot afford or must not repeat:
 *
 *   - resolves each newsroom's YouTube handle to the channel id its feed needs;
 *   - asks GDELT for the latest matching articles, the coverage pulse and the
 *     places named — GDELT allows one request every five seconds, so a page
 *     view cannot ask it three things at once;
 *   - reads new articles and keeps sentences in which an official, the police
 *     or the organisers give a figure, quoted word for word;
 *   - reads the Interior Ministry's press page and the UK's travel advice;
 *   - searches X — only institutions, public officials and newsrooms, only
 *     within a daily budget, and stores post ids, never text;
 *   - accumulates headlines and videos, because a search feed only carries the
 *     last day or so and the story is longer than that.
 *
 * Connectors never throw: a source that fails is recorded in `status` and the
 * previous register's entries for it are kept.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText, getJson } from "../lib/http";
import { isEntryPoint } from "../lib/entry";
import { FRANCE_RIOTS } from "../../../lib/sources";
import {
  parseGoogleNews, parseYouTube, channelIdFromPage, parseGdeltArticles, parseGdeltTimeline, parseGdeltGeo, parseGovUkAdvice,
  parseOfficialLinks, articleText, extractStatements, isAboutRiots, inWindow, mergeBy, headlineKey,
  type FranceRegister, type Headline, type SourceStatus, type Statement, type Video, type XPost,
} from "../../../lib/france-riots-shared";

const OUT = join(process.cwd(), "data", "france-riots", "register.json");
const GAP = 2_000;
/** GDELT asks for no more than one request every five seconds. */
const GDELT_GAP = 6_000;
const ARTICLES_PER_RUN = 25;
const X_USD_PER_POST = 0.005;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();

const GN = (q: string, lang: "fr" | "en") => lang === "fr"
  ? `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=fr&gl=FR&ceid=FR:fr`
  : `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-GB&gl=GB&ceid=GB:en`;
const GDELT = (mode: string, extra: string) => `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(FRANCE_RIOTS.gdeltQuery)}&mode=${mode}&format=json${extra}`;
const GDELT_GEO = `https://api.gdeltproject.org/api/v2/geo/geo?query=${encodeURIComponent(FRANCE_RIOTS.gdeltQuery)}&format=GeoJSON&timespan=48h`;

export function emptyRegister(): FranceRegister {
  return {
    updatedAt: now(), youtubeChannels: {}, headlines: [], videos: [], articles: [], pulse: [], places: [], statements: [], official: [], advisories: [], readUrls: [],
    x: { active: false, reason: "not yet run", day: now().slice(0, 10), readsToday: 0, budgetPerDay: 0, costUsdToday: 0, posts: [] },
    status: [],
  };
}

/** The X search: institutions, officials and newsrooms only; ids only; within budget. */
async function searchX(reg: FranceRegister, status: SourceStatus[]): Promise<void> {
  const token = process.env.X_BEARER_TOKEN;
  const budget = Number(process.env.X_FRANCE_POSTS_PER_DAY ?? 100);
  const today = now().slice(0, 10);
  if (reg.x.day !== today) { reg.x.day = today; reg.x.readsToday = 0; reg.x.costUsdToday = 0; }
  reg.x.budgetPerDay = budget;
  if (!token) { reg.x.active = false; reg.x.reason = "No X_BEARER_TOKEN: X has no free read tier."; status.push({ id: "x", label: "X search", ok: false, count: reg.x.posts.length, error: "inactive: no token" }); return; }
  if (budget <= 0) { reg.x.active = false; reg.x.reason = "Daily budget set to zero."; status.push({ id: "x", label: "X search", ok: false, count: reg.x.posts.length, error: "inactive: budget 0" }); return; }
  if (reg.x.readsToday + 10 > budget) { reg.x.active = true; reg.x.reason = `Today's budget of ${budget} posts is spent; searching resumes tomorrow (UTC).`; status.push({ id: "x", label: "X search", ok: true, count: reg.x.posts.length, error: "budget spent for today" }); return; }
  if (reg.x.lastAt && Date.now() - Date.parse(reg.x.lastAt) < 30 * 60_000) { status.push({ id: "x", label: "X search", ok: true, count: reg.x.posts.length }); return; }

  const from = FRANCE_RIOTS.xAccounts.map((h) => `from:${h}`).join(" OR ");
  const query = `(émeutes OR émeute OR violences OR casseurs OR interpellations OR manifestation OR manifestations OR riots OR protests OR protesters) (${from}) -is:retweet`;
  const sinceId = reg.x.posts.map((p) => p.id).sort((a, b) => (BigInt(b) > BigInt(a) ? 1 : -1))[0];
  const params = new URLSearchParams({
    query, max_results: "10", "tweet.fields": "created_at,attachments,author_id", expansions: "author_id,attachments.media_keys", "media.fields": "type", "user.fields": "username",
    ...(sinceId ? { since_id: sinceId } : {}),
  });
  const res = await getJson<{ data?: Array<{ id: string; created_at: string; author_id: string; attachments?: { media_keys?: string[] } }>; includes?: { users?: Array<{ id: string; username: string }>; media?: Array<{ media_key: string; type: string }> }; meta?: { result_count?: number } }>(
    `https://api.x.com/2/tweets/search/recent?${params}`, { headers: { authorization: `Bearer ${token}` }, cacheMs: 0, retries: 1, timeoutMs: 30_000 });
  reg.x.lastAt = now();
  if (!res.ok || !res.data) { reg.x.active = true; reg.x.reason = `Search failed: ${res.error}`; status.push({ id: "x", label: "X search", ok: false, count: reg.x.posts.length, error: res.error }); return; }
  const read = res.data.data?.length ?? 0;
  reg.x.readsToday += read;
  reg.x.costUsdToday = Math.round(reg.x.readsToday * X_USD_PER_POST * 1000) / 1000;
  const users = new Map((res.data.includes?.users ?? []).map((u) => [u.id, u.username]));
  const videos = new Set((res.data.includes?.media ?? []).filter((m) => m.type === "video" || m.type === "animated_gif").map((m) => m.media_key));
  const fresh: XPost[] = (res.data.data ?? []).map((t) => ({ id: t.id, handle: users.get(t.author_id) ?? "", createdAt: t.created_at, video: (t.attachments?.media_keys ?? []).some((k) => videos.has(k)) }));
  const byId = new Map([...fresh, ...reg.x.posts].map((p) => [p.id, p]));
  reg.x.posts = [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200);
  reg.x.active = true; reg.x.reason = undefined;
  console.log(`  x: ${read} posts read this run, ${reg.x.readsToday} today ≈ $${reg.x.costUsdToday}`);
  status.push({ id: "x", label: "X search", ok: true, count: reg.x.posts.length });
}

export async function run(): Promise<void> {
  const previous: FranceRegister | null = existsSync(OUT) ? JSON.parse(await readFile(OUT, "utf8")) as FranceRegister : null;
  const reg: FranceRegister = previous ? { ...emptyRegister(), ...previous } : emptyRegister();
  const status: SourceStatus[] = [];
  const since = FRANCE_RIOTS.since;

  // ── Headlines ──
  const fresh: Headline[] = [];
  let gnOk = 0;
  const queries: Array<[string, "fr" | "en", Headline["kind"]]> = [
    ...FRANCE_RIOTS.newsQueries.fr.map((q) => [`${q} when:7d`, "fr", "press"] as [string, "fr", "press"]),
    ...FRANCE_RIOTS.newsQueries.en.map((q) => [`${q} when:7d`, "en", "press"] as [string, "en", "press"]),
    ...FRANCE_RIOTS.officialSites.map((d) => [`site:${d} when:14d`, "fr", "official"] as [string, "fr", "official"]),
  ];
  for (const [q, lang, kind] of queries) {
    const r = await getText(GN(q, lang), { timeoutMs: 30_000, retries: 2, cacheMs: 0 });
    await sleep(GAP);
    if (!r.ok || !r.data) continue;
    gnOk++;
    const items = parseGoogleNews(r.data, lang, kind, q);
    fresh.push(...(kind === "official" ? items : items.filter((h) => isAboutRiots(h.title))).filter((h) => inWindow(h.published, since)));
  }
  reg.headlines = mergeBy(reg.headlines, fresh, headlineKey, 600);
  status.push({ id: "gnews", label: "Google News", ok: gnOk > 0, count: fresh.length, ...(gnOk < queries.length ? { error: `${queries.length - gnOk} of ${queries.length} queries failed` } : {}) });

  // ── YouTube: resolve handles, then read feeds ──
  const vids: Video[] = [];
  let ytOk = 0;
  for (const c of FRANCE_RIOTS.youtube) {
    const known = reg.youtubeChannels[c.handle];
    const stale = !known?.id && (!known?.resolvedAt || Date.now() - Date.parse(known.resolvedAt) > 6 * 3600_000);
    if (!known?.id && (stale || !known)) {
      const page = await getText(`https://www.youtube.com/@${c.handle}`, { timeoutMs: 30_000, retries: 1, cacheMs: 0, headers: { cookie: "CONSENT=YES+1" } });
      const id = page.ok && page.data ? channelIdFromPage(page.data) : null;
      reg.youtubeChannels[c.handle] = { id, name: c.name, resolvedAt: now(), ...(id ? {} : { error: page.ok ? "no channel id on the page" : page.error }) };
      await sleep(GAP);
    }
    const id = reg.youtubeChannels[c.handle]?.id;
    if (!id) continue;
    const feed = await getText(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`, { timeoutMs: 30_000, retries: 1, cacheMs: 0 });
    await sleep(500);
    if (!feed.ok || !feed.data) continue;
    ytOk++;
    vids.push(...parseYouTube(feed.data, c.handle, c.name).filter((v) => isAboutRiots(v.title) && inWindow(v.published, since)));
  }
  reg.videos = mergeBy(reg.videos, vids, (v) => v.id, 300);
  status.push({ id: "youtube", label: `YouTube (${ytOk} of ${FRANCE_RIOTS.youtube.length} channels)`, ok: ytOk > 0, count: vids.length });

  // ── GDELT: articles, pulse, places — one request every six seconds ──
  const arts = await getJson<unknown>(GDELT("ArtList", "&maxrecords=75&sort=DateDesc&timespan=24h"), { timeoutMs: 45_000, retries: 1, cacheMs: 0 });
  if (arts.ok) reg.articles = mergeBy(reg.articles, parseGdeltArticles(arts.data).filter((a) => inWindow(a.seen, since)), (a) => a.url, 200);
  status.push({ id: "gdelt-articles", label: "GDELT article index", ok: arts.ok, count: reg.articles.length, ...(arts.ok ? {} : { error: arts.error }) });
  await sleep(GDELT_GAP);
  const tl = await getJson<unknown>(GDELT("TimelineVolRaw", "&timespan=7d"), { timeoutMs: 45_000, retries: 1, cacheMs: 0 });
  if (tl.ok) { const p = parseGdeltTimeline(tl.data); if (p.length) reg.pulse = p; }
  status.push({ id: "gdelt-pulse", label: "GDELT coverage pulse", ok: tl.ok, count: reg.pulse.length, ...(tl.ok ? {} : { error: tl.error }) });
  await sleep(GDELT_GAP);
  const geo = await getJson<unknown>(GDELT_GEO, { timeoutMs: 45_000, retries: 1, cacheMs: 0 });
  if (geo.ok) { const pl = parseGdeltGeo(geo.data); if (pl.length) reg.places = pl.slice(0, 150); }
  status.push({ id: "gdelt-geo", label: "GDELT places", ok: geo.ok, count: reg.places.length, ...(geo.ok ? {} : { error: geo.error }) });

  // ── Officials' figures, quoted from new articles ──
  const read = new Set(reg.readUrls);
  const todo = reg.articles.filter((a) => !read.has(a.url) && /^(French|English)$/i.test(a.language)).slice(0, ARTICLES_PER_RUN);
  const found: Statement[] = [];
  let readOk = 0;
  for (const a of todo) {
    read.add(a.url);
    const page = await getText(a.url, { timeoutMs: 20_000, retries: 0, cacheMs: 0 });
    await sleep(800);
    if (!page.ok || !page.data) continue;
    readOk++;
    const text = articleText(page.data);
    if (!isAboutRiots(text.slice(0, 4000))) continue;
    found.push(...extractStatements(text, { outlet: a.domain, url: a.url, seen: a.seen, lang: /french/i.test(a.language) ? "fr" : "en" }));
  }
  reg.readUrls = [...read].slice(-3000);
  reg.statements = mergeBy(reg.statements, found, (s) => s.quote, 400);
  status.push({ id: "statements", label: `Officials' figures in articles (${readOk} of ${todo.length} articles read)`, ok: todo.length === 0 || readOk > 0, count: found.length });

  // ── Government pages and foreign advice ──
  for (const p of FRANCE_RIOTS.officialPages) {
    const r = await getText(p.url, { timeoutMs: 30_000, retries: 1, cacheMs: 0 });
    const items = r.ok && r.data ? parseOfficialLinks(r.data, p.url, p.name) : [];
    // The page's own order is newest first; earlier items the page has since dropped are kept below.
    if (items.length) reg.official = [...items, ...reg.official.filter((o) => o.source !== p.name || !items.some((i) => i.url === o.url))].slice(0, 60);
    status.push({ id: p.id, label: p.name, ok: items.length > 0, count: items.length, ...(items.length ? {} : { error: r.ok ? "no press links found on the page" : r.error }) });
  }
  for (const a of FRANCE_RIOTS.advisories) {
    const r = await getJson<unknown>(a.url, { timeoutMs: 30_000, retries: 1, cacheMs: 0 });
    if (r.ok) reg.advisories = [parseGovUkAdvice(r.data, { id: a.id, name: a.name, page: a.page }), ...reg.advisories.filter((x) => x.id !== a.id)];
    status.push({ id: a.id, label: a.name, ok: r.ok, count: r.ok ? 1 : 0, ...(r.ok ? {} : { error: r.error }) });
  }

  // ── X ──
  await searchX(reg, status);

  reg.status = status;
  const changed = JSON.stringify({ ...previous, updatedAt: "", status: [] }) !== JSON.stringify({ ...reg, updatedAt: "", status: [] });
  if (previous && !changed) { console.log("no change; nothing written"); return; }
  reg.updatedAt = now();
  await mkdir(join(process.cwd(), "data", "france-riots"), { recursive: true });
  // Compact JSON: written every twenty minutes, so the history stays small.
  await writeFile(OUT, JSON.stringify(reg) + "\n", "utf8");
  console.log(`wrote ${OUT}: ${reg.headlines.length} headlines, ${reg.videos.length} videos, ${reg.articles.length} articles, ${reg.statements.length} statements, ${reg.places.length} places`);
  for (const s of status) console.log(`  ${s.ok ? "ok  " : "FAIL"} ${s.label}: ${s.count}${s.error ? ` (${s.error})` : ""}`);
  const usable = status.filter((s) => s.ok).length;
  if (usable === 0) { console.error("every source failed"); process.exit(1); }
}

if (isEntryPoint(import.meta.url)) {
  run().catch((e) => { console.error(e); process.exit(1); });
}
