/**
 * The France riots tracker, live. Cached for 60 seconds; the page asks every minute.
 *
 * Read at request time:
 *   - Google News's keyless RSS search, in French and in English, plus the same
 *     search restricted to French government sites;
 *   - the latest videos on newsrooms' YouTube channels, kept when the title
 *     names unrest in France;
 *   - the UK Foreign Office's travel advice for France.
 *
 * Read from the scheduled job's register (data/france-riots/register.json),
 * fetched from the repository itself so it is never older than the job's last
 * run, not the last deployment's: GDELT's article index, coverage pulse and
 * places; officials' figures quoted from articles; the Interior Ministry's
 * places the headlines name; and X post ids.
 *
 * A source that does not answer is reported as unavailable. Nothing here is
 * stored, nothing is verified, and nothing becomes a number on the site.
 */
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { FRANCE_RIOTS } from "@/lib/sources";
import {
  parseGoogleNews, parseYouTube, parseGovUkAdvice, channelIdFromPage, isAboutRiots, isOfficialRelevant, inWindow, mergeBy, headlineKey, slimRegister,
  type FranceLivePayload, type FranceRegister, type Headline, type SourceStatus, type Video, type Advisory,
} from "@/lib/france-riots-shared";

export const revalidate = 60;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const RAW = "https://raw.githubusercontent.com/chad3456/india-defence-infra-corridor/claude/india-defence-infra-tracker-qfpsfu/data/france-riots/register.json";
const GN = (q: string, lang: "fr" | "en") => lang === "fr"
  ? `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=fr&gl=FR&ceid=FR:fr`
  : `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-GB&gl=GB&ceid=GB:en`;

async function get(url: string, ttl: number, ms = 6_000): Promise<Response | null> {
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, "accept-language": "fr,en;q=0.8" }, signal: AbortSignal.timeout(ms), next: { revalidate: ttl } });
    return r.ok ? r : null;
  } catch { return null; }
}

async function register(): Promise<{ reg: FranceRegister | null; from: FranceLivePayload["registerFrom"] }> {
  const r = await get(RAW, 60);
  if (r) { try { return { reg: (await r.json()) as FranceRegister, from: "github" }; } catch { /* fall through */ } }
  try { return { reg: JSON.parse(await readFile(join(process.cwd(), "data", "france-riots", "register.json"), "utf8")) as FranceRegister, from: "deployment" }; }
  catch { return { reg: null, from: "none" }; }
}

async function news(q: string, lang: "fr" | "en", kind: Headline["kind"]): Promise<{ items: Headline[]; ok: boolean }> {
  const r = await get(GN(q, lang), 60);
  if (!r) return { items: [], ok: false };
  const items = parseGoogleNews(await r.text(), lang, kind, q);
  return { items: items.filter((h) => (kind === "official" ? isOfficialRelevant(h.title) : isAboutRiots(h.title))), ok: true };
}

async function channel(handles: readonly string[], name: string, known: string | null | undefined): Promise<{ videos: Video[]; ok: boolean; error?: string }> {
  let id = known ?? null;
  const handle = handles[0]!;
  if (!id) {
    // Not yet resolved by the scheduled job: read the first handle's channel page, once a day.
    const page = await get(`https://www.youtube.com/@${handle}`, 86_400, 8_000);
    id = page ? channelIdFromPage(await page.text()) : null;
    if (!id) return { videos: [], ok: false, error: "channel id not resolved" };
  }
  const r = await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`, 60);
  if (!r) return { videos: [], ok: false, error: "feed did not answer" };
  return { videos: parseYouTube(await r.text(), handle, name).filter((v) => isAboutRiots(v.title)), ok: true };
}

async function advisory(a: (typeof FRANCE_RIOTS.advisories)[number]): Promise<Advisory | null> {
  const r = await get(a.url, 300);
  if (!r) return null;
  try { return parseGovUkAdvice(await r.json(), { id: a.id, name: a.name, page: a.page }); } catch { return null; }
}

export async function GET(): Promise<NextResponse> {
  const { reg, from } = await register();
  const since = FRANCE_RIOTS.since;
  const qs: Array<[string, "fr" | "en", Headline["kind"]]> = [
    ...FRANCE_RIOTS.newsQueries.fr.map((q) => [`${q} when:2d`, "fr", "press"] as [string, "fr", "press"]),
    ...FRANCE_RIOTS.newsQueries.en.map((q) => [`${q} when:2d`, "en", "press"] as [string, "en", "press"]),
    [`(${FRANCE_RIOTS.officialSites.map((d) => `site:${d}`).join(" OR ")}) when:7d`, "fr", "official"],
  ];
  const [newsRes, ytRes, advRes] = await Promise.all([
    Promise.all(qs.map(([q, l, k]) => news(q, l, k))),
    Promise.all(FRANCE_RIOTS.youtube.map((c) => channel(c.handles, c.name, reg?.youtubeChannels?.[c.handles[0]]?.id))),
    Promise.all(FRANCE_RIOTS.advisories.map(advisory)),
  ]);

  const headlines = mergeBy(newsRes.flatMap((r) => r.items).filter((h) => inWindow(h.published, since)), [], headlineKey, 300);
  const videos = mergeBy(ytRes.flatMap((r) => r.videos).filter((v) => inWindow(v.published, since)), [], (v) => v.id, 120);
  const advisories = advRes.filter((a): a is Advisory => !!a);

  const status: SourceStatus[] = [
    { id: "gnews", label: "Google News (French and English)", ok: newsRes.slice(0, -1).some((r) => r.ok), count: newsRes.slice(0, -1).reduce((a, r) => a + r.items.length, 0) },
    { id: "gnews-official", label: "Government sites, via Google News", ok: newsRes.at(-1)!.ok, count: newsRes.at(-1)!.items.length },
    { id: "youtube", label: `Newsroom YouTube channels (${ytRes.filter((r) => r.ok).length} of ${ytRes.length} answering)`, ok: ytRes.some((r) => r.ok), count: videos.length },
    ...FRANCE_RIOTS.advisories.map((a, i) => ({ id: a.id, label: a.name, ok: !!advRes[i], count: advRes[i] ? 1 : 0 })),
    { id: "register", label: `Scheduled job's register (${from === "github" ? "latest run" : from === "deployment" ? "as deployed" : "unavailable"})`, ok: !!reg, count: reg ? 1 : 0 },
  ];

  // The page pages through the media itself (/api/france-riots/media) and has no use for the job's bookkeeping.
  const body: FranceLivePayload = { fetchedAt: new Date().toISOString(), headlines, videos, advisories, register: reg ? slimRegister(reg) : null, registerFrom: from, status };
  return NextResponse.json(body, { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=60" } });
}
