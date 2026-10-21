/**
 * Luxury beliefs and India, live: the latest headlines for each area the page
 * tests, from Google News's keyless search in English and Hindi. Cached for 60
 * seconds; the page asks every minute. Headlines are pointers to reporting —
 * none of them becomes a figure on the page.
 */
import { NextResponse } from "next/server";
import { AREAS, belongsTo, type AreaId } from "@/lib/luxury-beliefs";
import { parseGoogleNews, mergeBy, headlineKey, type Headline } from "@/lib/france-riots-shared";

export const revalidate = 60;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const GN = (q: string, lang: "en" | "hi") => lang === "en"
  ? `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:7d`)}&hl=en-IN&gl=IN&ceid=IN:en`
  : `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:7d`)}&hl=hi&gl=IN&ceid=IN:hi`;

export interface LiveArea { id: AreaId; ok: boolean; headlines: Headline[] }
export interface LivePayload { fetchedAt: string; areas: LiveArea[] }

async function search(q: string, lang: "en" | "hi"): Promise<Headline[] | null> {
  try {
    const r = await fetch(GN(q, lang), { headers: { "user-agent": UA }, signal: AbortSignal.timeout(6_000), next: { revalidate: 60 } });
    return r.ok ? parseGoogleNews(await r.text(), lang, "press", q) : null;
  } catch { return null; }
}

export async function GET(): Promise<NextResponse> {
  const areas = await Promise.all(AREAS.map(async (a): Promise<LiveArea> => {
    const res = await Promise.all([...a.q.en.map((q) => search(q, "en")), ...a.q.hi.map((q) => search(q, "hi"))]);
    const all = res.flatMap((r) => r ?? []).filter((h) => belongsTo(a.id, h.title));
    return { id: a.id, ok: res.some((r) => r !== null), headlines: mergeBy(all, [], headlineKey, 12) };
  }));
  const body: LivePayload = { fetchedAt: new Date().toISOString(), areas };
  return NextResponse.json(body, { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=60" } });
}
