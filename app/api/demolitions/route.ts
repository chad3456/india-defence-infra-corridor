/**
 * Religious-structure demolitions, live: the past fortnight's headlines from
 * Google News's keyless search, in English and Hindi, kept only if they name a
 * religious structure and a demolition. Cached two minutes. Headlines point
 * to reporting — none becomes a figure on /demolitions until checked.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { isDemolitionHeadline, type DemLive, type DemPublished } from "@/lib/demolitions";
import { parseGoogleNews, mergeBy, headlineKey, type Headline } from "@/lib/france-riots-shared";

export const revalidate = 120;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const GN = (q: string, hindi: boolean) => `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:14d`)}&${hindi ? "hl=hi&gl=IN&ceid=IN:hi" : "hl=en-IN&gl=IN&ceid=IN:en"}`;

async function search(q: string): Promise<Headline[] | null> {
  const hindi = /[ऀ-ॿ]/.test(q);
  try {
    const r = await fetch(GN(q, hindi), { headers: { "user-agent": UA }, signal: AbortSignal.timeout(6_000), next: { revalidate: 120 } });
    return r.ok ? parseGoogleNews(await r.text(), hindi ? "hi" : "en", "press", q) : null;
  } catch { return null; }
}

export async function GET(): Promise<NextResponse> {
  let searches: string[] = [];
  try { searches = (JSON.parse(readFileSync(join(process.cwd(), "data", "demolitions", "published.json"), "utf8")) as DemPublished).searches; } catch { searches = ["religious structure demolished encroachment"]; }
  const res = await Promise.all(searches.map(search));
  const all = res.flatMap((r) => r ?? []).filter((h) => isDemolitionHeadline(h.title));
  const body: DemLive = { fetchedAt: new Date().toISOString(), ok: res.some((r) => r !== null), headlines: mergeBy(all, [], headlineKey, 20) };
  return NextResponse.json(body, { headers: { "cache-control": "public, s-maxage=120, stale-while-revalidate=120" } });
}
