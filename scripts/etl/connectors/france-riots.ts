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
 *   - asks GDELT for the latest matching articles and the coverage pulse —
 *     GDELT allows one request every five seconds, so a page view cannot;
 *   - counts the French cities the collected headlines name, for the map;
 *   - reads new articles and keeps sentences in which an official, the police
 *     or the organisers give a figure, quoted word for word;
 *   - reads the UK's travel advice (the Interior Ministry's press page refuses
 *     automated readers, so its announcements arrive through the search
 *     restricted to government sites);
 *   - collects the posts on X that newsrooms embedded in those articles —
 *     the free, legitimate route to posts about the riots: X sells search by
 *     the post and forbids scraping. Ids and handles only, never text;
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
  parseGoogleNews, parseYouTube, channelIdFromPage, parseGdeltArticles, parseBingNews, parseGdeltTimeline, parseGovUkAdvice,
  articleText, extractStatements, extractClaims, extractBusinessReports, parseStooq, tweetsInHtml, tweetTime, attribution, statementKind, countsIn, hasEntity, isAboutRiots, isOfficialRelevant, inWindow, mergeBy, headlineKey, placesFromHeadlines,
  type FranceRegister, type Headline, type SourceStatus, type Statement, type Video, type XPost, type EmbeddedPost, type Claim, type BusinessReport, type MarketPoint,
} from "../../../lib/france-riots-shared";

const OUT = join(process.cwd(), "data", "france-riots", "register.json");
const GAP = 2_000;
/** GDELT asks for no more than one request every five seconds. */
const GDELT_GAP = 6_000;
const ARTICLES_PER_RUN = 45;
/** Version 3: articles are also read for claims about causes and for named businesses. */
const SCAN_VERSION = 3;
const X_USD_PER_POST = 0.005;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();

const GN = (q: string, lang: "fr" | "en") => lang === "fr"
  ? `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=fr&gl=FR&ceid=FR:fr`
  : `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-GB&gl=GB&ceid=GB:en`;
const GDELT = (mode: string, extra: string) => `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(FRANCE_RIOTS.gdeltQuery)}&mode=${mode}&format=json${extra}`;

export function emptyRegister(): FranceRegister {
  return {
    updatedAt: now(), youtubeChannels: {}, headlines: [], videos: [], articles: [], pulse: [], places: [], statements: [], advisories: [], scanned: [], embedded: [], claims: [], businesses: [], markets: { cac40: [], eurusd: [] }, scanVersion: SCAN_VERSION,
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
    fresh.push(...items.filter((h) => (kind === "official" ? isOfficialRelevant(h.title) : isAboutRiots(h.title)) && inWindow(h.published, since)));
  }
  // Government-site items kept before the relevance rule existed are re-checked against it.
  reg.headlines = mergeBy(reg.headlines.filter((h) => h.kind !== "official" || isOfficialRelevant(h.title)), fresh, headlineKey, 600);
  reg.places = placesFromHeadlines(reg.headlines.filter((h) => h.kind === "press").map((h) => h.title));
  status.push({ id: "gnews", label: "Google News", ok: gnOk > 0, count: fresh.length, ...(gnOk < queries.length ? { error: `${queries.length - gnOk} of ${queries.length} queries failed` } : {}) });

  // ── YouTube: resolve handles, then read feeds ──
  const vids: Video[] = [];
  let ytOk = 0;
  for (const c of FRANCE_RIOTS.youtube) {
    const key = c.handles[0]!;
    const known = reg.youtubeChannels[key];
    const retry = !known?.id && (!known?.resolvedAt || Date.now() - Date.parse(known.resolvedAt) > 6 * 3600_000);
    if (retry) {
      let id: string | null = null, error = "";
      // The first handle that leads to a channel page with an id wins.
      for (const h of c.handles) {
        const page = await getText(`https://www.youtube.com/@${h}`, { timeoutMs: 30_000, retries: 1, cacheMs: 0, headers: { cookie: "CONSENT=YES+1" } });
        await sleep(GAP);
        id = page.ok && page.data ? channelIdFromPage(page.data) : null;
        if (id) break;
        error = `@${h}: ${page.ok ? "no channel id on the page" : page.error}`;
      }
      reg.youtubeChannels[key] = { id, name: c.name, resolvedAt: now(), ...(id ? {} : { error }) };
    }
    const id = reg.youtubeChannels[key]?.id;
    if (!id) continue;
    const feed = await getText(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`, { timeoutMs: 30_000, retries: 1, cacheMs: 0 });
    await sleep(500);
    if (!feed.ok || !feed.data) continue;
    ytOk++;
    vids.push(...parseYouTube(feed.data, key, c.name).filter((v) => isAboutRiots(v.title) && inWindow(v.published, since)));
  }
  reg.videos = mergeBy(reg.videos, vids, (v) => v.id, 300);
  // Channels listed under a handle that is no longer the first one tried are dropped.
  const keys = new Set<string>(FRANCE_RIOTS.youtube.map((c) => c.handles[0]!));
  for (const k of Object.keys(reg.youtubeChannels)) if (!keys.has(k)) delete reg.youtubeChannels[k];
  status.push({ id: "youtube", label: `YouTube (${ytOk} of ${FRANCE_RIOTS.youtube.length} channels)`, ok: ytOk > 0, count: vids.length });

  // ── GDELT: pulse, then articles — one request every six seconds ──
  const tl = await getJson<unknown>(GDELT("TimelineVolRaw", "&timespan=7d"), { timeoutMs: 60_000, retries: 2, cacheMs: 0 });
  if (tl.ok) { const p = parseGdeltTimeline(tl.data); if (p.length) reg.pulse = p; }
  status.push({ id: "gdelt-pulse", label: "GDELT coverage pulse", ok: tl.ok, count: reg.pulse.length, ...(tl.ok ? {} : { error: `${tl.error}; the last pulse read is kept` }) });
  let arts: Awaited<ReturnType<typeof getJson<unknown>>> = { ok: false, data: null, error: "not asked" };
  for (let attempt = 0; attempt < 3 && !arts.ok; attempt++) {
    await sleep(GDELT_GAP * (attempt + 1));
    arts = await getJson<unknown>(GDELT("ArtList", "&maxrecords=75&sort=DateDesc&timespan=24h"), { timeoutMs: 60_000, retries: 0, cacheMs: 0 });
  }
  if (arts.ok) reg.articles = mergeBy(reg.articles, parseGdeltArticles(arts.data).filter((a) => isAboutRiots(a.title) && inWindow(a.seen, since)), (a) => a.url, 250);
  status.push({ id: "gdelt-articles", label: "GDELT article index", ok: arts.ok, count: reg.articles.length, ...(arts.ok ? {} : { error: arts.error }) });

  // ── Bing News: article addresses that can be read, whatever GDELT does ──
  let bingOk = 0, bingN = 0;
  const bing = [...FRANCE_RIOTS.bingQueries.fr.map((q) => [q, "fr"] as const), ...FRANCE_RIOTS.bingQueries.en.map((q) => [q, "en"] as const)];
  for (const [q, lang] of bing) {
    const r = await getText(`https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss&setlang=${lang}&cc=${lang === "fr" ? "FR" : "GB"}`, { timeoutMs: 30_000, retries: 1, cacheMs: 0 });
    await sleep(GAP);
    if (!r.ok || !r.data) continue;
    bingOk++;
    const found = parseBingNews(r.data, lang).filter((a) => isAboutRiots(a.title) && inWindow(a.seen, since));
    bingN += found.length;
    reg.articles = mergeBy(reg.articles, found, (a) => a.url, 250);
  }
  status.push({ id: "bing", label: "Bing News (article addresses)", ok: bingOk > 0, count: bingN });

  // Every article, from whichever index, must name unrest in France in its title; rows kept before
  // the rule applied to every index are re-checked, and posts found in failing articles go with them.
  reg.articles = reg.articles.filter((a) => isAboutRiots(a.title));
  reg.embedded = (reg.embedded ?? []).filter((p) => isAboutRiots(p.articleTitle)).map((p) => (/^(i|user|web|x|twitter)$/i.test(p.handle) ? { ...p, handle: "" } : p));

  // ── Articles: officials' figures, and the posts on X newsrooms embedded ──
  // Articles read before embedded posts were collected are read once more.
  if ((reg.scanVersion ?? 0) < SCAN_VERSION) { reg.scanned = []; reg.scanVersion = SCAN_VERSION; }
  const read = new Set(reg.scanned ?? []);
  const claims: Claim[] = [];
  const biz: BusinessReport[] = [];
  const todo = reg.articles.filter((a) => !read.has(a.url) && /^(French|English)$/i.test(a.language)).slice(0, ARTICLES_PER_RUN);
  const found: Statement[] = [];
  const posts: EmbeddedPost[] = [];
  let readOk = 0;
  for (const a of todo) {
    read.add(a.url);
    const page = await getText(a.url, { timeoutMs: 20_000, retries: 0, cacheMs: 0 });
    await sleep(800);
    if (!page.ok || !page.data) continue;
    readOk++;
    const text = articleText(page.data);
    if (!isAboutRiots(text.slice(0, 4000))) continue;
    const meta = { outlet: a.domain, url: a.url, seen: a.seen, lang: /french/i.test(a.language) ? "fr" : "en" };
    found.push(...extractStatements(text, meta));
    claims.push(...extractClaims(text, meta));
    biz.push(...extractBusinessReports(text, { outlet: a.domain, url: a.url, seen: a.seen }));
    if (!isAboutRiots(a.title)) continue;
    for (const t of tweetsInHtml(page.data)) {
      const at = tweetTime(t.id);
      // Only posts made during the story: an article's sidebar can embed anything.
      if (at && inWindow(at, since)) posts.push({ id: t.id, handle: t.handle, createdAt: at, outlet: a.domain, articleUrl: a.url, articleTitle: a.title });
    }
  }
  reg.scanned = [...read].slice(-3000);
  const rereadClaims = (reg.claims ?? []).flatMap((c) => extractClaims(c.quote, { outlet: c.outlet, url: c.url, seen: c.seen, lang: c.lang }));
  reg.claims = mergeBy(rereadClaims, claims, (c) => c.quote, 400);
  reg.businesses = (reg.businesses ?? []).filter((b) => !hasEntity(b.quote));
  reg.businesses = mergeBy(reg.businesses ?? [], biz, (b) => `${b.brand}|${b.quote}`, 400);
  status.push({ id: "claims", label: "Claims about causes, credited to their speakers", ok: true, count: reg.claims.length });
  status.push({ id: "businesses", label: "Named businesses reported attacked", ok: true, count: reg.businesses.length });
  delete (reg as { readUrls?: unknown }).readUrls;
  const byPost = new Map<string, EmbeddedPost>();
  for (const p of [...(reg.embedded ?? []), ...posts]) if (!byPost.has(p.id)) byPost.set(p.id, p);
  reg.embedded = [...byPost.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 500);
  status.push({ id: "embedded", label: "Posts on X embedded in the articles read", ok: true, count: reg.embedded.length });
  // Stored quotes are re-read with today's rules, so a tightened rule corrects old rows too.
  const reread = reg.statements.flatMap((s) => { const who = attribution(s.quote); return who && !hasEntity(s.quote) ? [{ ...s, who, kind: statementKind(s.quote), numbers: countsIn(s.quote) }] : []; }).filter((s) => s.numbers.length);
  reg.statements = mergeBy(reread, found, (s) => s.quote, 400);
  status.push({ id: "statements", label: `Officials' figures in articles (${readOk} of ${todo.length} articles read)`, ok: todo.length === 0 || readOk > 0, count: found.length });

  // ── Government pages and foreign advice ──
  for (const a of FRANCE_RIOTS.advisories) {
    const r = await getJson<unknown>(a.url, { timeoutMs: 30_000, retries: 1, cacheMs: 0 });
    if (r.ok) reg.advisories = [parseGovUkAdvice(r.data, { id: a.id, name: a.name, page: a.page }), ...reg.advisories.filter((x) => x.id !== a.id)];
    status.push({ id: a.id, label: a.name, ok: r.ok, count: r.ok ? 1 : 0, ...(r.ok ? {} : { error: r.error }) });
  }

  // ── Markets: CAC 40 closes from Yahoo's chart API (Stooq as a fallback), the euro from the ECB via Frankfurter ──
  reg.markets = reg.markets ?? { cac40: [], eurusd: [] };
  {
    let pts: MarketPoint[] = [];
    let err = "";
    const y = await getJson<{ chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: Array<number | null> }> } }> } }>(
      "https://query1.finance.yahoo.com/v8/finance/chart/%5EFCHI?range=3mo&interval=1d", { timeoutMs: 30_000, retries: 1, cacheMs: 0 });
    const res = y.data?.chart?.result?.[0];
    if (res?.timestamp && res.indicators?.quote?.[0]?.close) {
      const closes = res.indicators.quote[0].close;
      pts = res.timestamp.flatMap((t, i) => { const c = closes[i]; return typeof c === "number" && c > 0 ? [{ d: new Date(t * 1000).toISOString().slice(0, 10), close: Math.round(c * 100) / 100 }] : []; });
    } else err = `Yahoo: ${y.error ?? "no rows"}`;
    if (!pts.length) {
      const st = await getText("https://stooq.com/q/d/l/?s=%5Ecac&i=d", { timeoutMs: 30_000, retries: 1, cacheMs: 0 });
      pts = st.ok && st.data ? parseStooq(st.data) : [];
      if (!pts.length) err += `; Stooq: ${st.ok ? "no rows" : st.error}`;
    }
    pts = pts.filter((p) => p.d >= "2026-08-01");
    if (pts.length) reg.markets.cac40 = pts;
    status.push({ id: "cac40", label: "CAC 40 daily closes", ok: pts.length > 0, count: reg.markets.cac40.length, ...(pts.length ? {} : { error: err }) });
  }
  {
    const f = await getJson<{ rates?: Record<string, { USD?: number }> }>("https://api.frankfurter.app/2026-08-01..?from=EUR&to=USD", { timeoutMs: 30_000, retries: 1, cacheMs: 0 });
    const pts = Object.entries(f.data?.rates ?? {}).flatMap(([d, r]) => (typeof r.USD === "number" ? [{ d, close: r.USD }] : [])).sort((a, b) => a.d.localeCompare(b.d));
    if (pts.length) reg.markets.eurusd = pts;
    status.push({ id: "eurusd", label: "Euro in dollars (ECB reference rate)", ok: pts.length > 0, count: reg.markets.eurusd.length, ...(pts.length ? {} : { error: f.error ?? "no rows" }) });
  }

  // ── X ──
  await searchX(reg, status);

  // ── The site's own live route: is what readers see answering? ──
  const site = process.env.SITE_URL ?? "https://india-defence-infra-corridor.vercel.app";
  const live = await getJson<{ headlines?: unknown[]; videos?: unknown[]; status?: Array<{ ok: boolean }> }>(`${site}/api/france-riots`, { timeoutMs: 45_000, retries: 1, cacheMs: 0 });
  const answering = live.ok ? (live.data?.status ?? []).filter((x) => x.ok).length : 0;
  status.push({ id: "site-route", label: `This site's live feed (${answering} of ${live.data?.status?.length ?? 0} sources answering, ${live.data?.videos?.length ?? 0} videos)`, ok: live.ok && (live.data?.headlines?.length ?? 0) > 0, count: live.data?.headlines?.length ?? 0, ...(live.ok ? {} : { error: live.error }) });

  reg.status = status;
  // A change in the sources' health is worth a commit too: the page shows it.
  const health = (st: SourceStatus[] | undefined) => JSON.stringify((st ?? []).map((x) => [x.id, x.ok]));
  const changed = JSON.stringify({ ...previous, updatedAt: "", status: [] }) !== JSON.stringify({ ...reg, updatedAt: "", status: [] }) || health(previous?.status) !== health(status);
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
