/**
 * The France riots gallery, a page at a time: /api/france-riots/media?offset=0&limit=24&kind=all|image|video.
 *
 * Read from the scheduled job's register, fetched from the repository itself
 * like the live route's, so new pictures appear within a minute of the job's
 * commit. Pictures and videos are addresses on their publishers' own sites;
 * nothing is copied or stored here.
 */
import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { mediaFeed, type FranceRegister, type MediaPage } from "@/lib/france-riots-shared";

export const revalidate = 60;
const RAW = "https://raw.githubusercontent.com/chad3456/india-defence-infra-corridor/claude/india-defence-infra-tracker-qfpsfu/data/france-riots/register.json";

async function register(): Promise<FranceRegister | null> {
  try {
    const r = await fetch(RAW, { signal: AbortSignal.timeout(6_000), next: { revalidate: 60 } });
    if (r.ok) return (await r.json()) as FranceRegister;
  } catch { /* fall through to the deployed copy */ }
  try { return JSON.parse(await readFile(join(process.cwd(), "data", "france-riots", "register.json"), "utf8")) as FranceRegister; } catch { return null; }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const p = req.nextUrl.searchParams;
  const offset = Math.max(0, Number(p.get("offset")) || 0);
  const limit = Math.min(60, Math.max(1, Number(p.get("limit")) || 24));
  const kind = p.get("kind") === "image" ? "image" : p.get("kind") === "video" ? "video" : "all";
  const feed = mediaFeed(await register(), kind);
  const body: MediaPage = { items: feed.slice(offset, offset + limit), total: feed.length, offset };
  return NextResponse.json(body, { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=60" } });
}
