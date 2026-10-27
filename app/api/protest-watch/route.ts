/**
 * Protest Watch, live. Cached for 60 seconds; the page asks every minute.
 *
 * Reads the collector's register straight from this branch (so it is never
 * older than the last 30-minute run, whatever the deployment), adds the past
 * hour's protest headlines from six news editions searched now, and returns
 * the same summary for every cause. Headlines are reports, not findings:
 * nothing here is verified, and every figure links to the headline it came from.
 */
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseGoogleNews, headlineKey } from "@/lib/france-riots-shared";
import { EDITIONS, editionUrl, isProtestHeadline, summarise, type PwHeadline, type PwPayload, type PwRegister, type PwStatus } from "@/lib/protest-watch";
import { protestGeo } from "@/lib/protest-watch-geo";

export const revalidate = 60;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const RAW = "https://raw.githubusercontent.com/chad3456/india-defence-infra-corridor/claude/india-defence-infra-tracker-qfpsfu/data/protest-watch/register.json";
const LIVE = ["en-US", "en-GB", "en-IN", "fr-FR", "es-ES", "ar-EG"];
const { countries } = protestGeo();

async function register(): Promise<{ reg: PwRegister | null; from: string }> {
  try {
    const r = await fetch(RAW, { signal: AbortSignal.timeout(8_000), next: { revalidate: 60 } });
    if (r.ok) return { reg: (await r.json()) as PwRegister, from: "branch" };
  } catch { /* fall back to the deployed copy */ }
  try { return { reg: JSON.parse(await readFile(join(process.cwd(), "data", "protest-watch", "register.json"), "utf8")) as PwRegister, from: "deployment" }; } catch { return { reg: null, from: "none" }; }
}

async function live(id: string): Promise<{ status: PwStatus; items: PwHeadline[] }> {
  const e = EDITIONS.find((x) => x.id === id)!;
  try {
    const r = await fetch(editionUrl(e, "1h"), { headers: { "user-agent": UA }, signal: AbortSignal.timeout(6_000), next: { revalidate: 60 } });
    if (!r.ok) return { status: { id: `live-${id}`, label: `Live: Google News ${id}`, ok: false, count: 0, error: `HTTP ${r.status}` }, items: [] };
    const items = parseGoogleNews(await r.text(), e.hl.slice(0, 2), "press", e.q).filter((h) => isProtestHeadline(h.title)).map((h) => ({ t: h.title, o: h.outlet, u: h.url, p: h.published, l: h.lang, e: id }));
    return { status: { id: `live-${id}`, label: `Live: Google News ${id}`, ok: true, count: items.length }, items };
  } catch (err) {
    return { status: { id: `live-${id}`, label: `Live: Google News ${id}`, ok: false, count: 0, error: (err as Error).message }, items: [] };
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  const hours = Math.min(168, Math.max(6, Number(new URL(req.url).searchParams.get("hours")) || 24));
  const [{ reg, from }, ...lives] = await Promise.all([register(), ...LIVE.map(live)]);
  const seen = new Set<string>();
  const key = (h: PwHeadline) => headlineKey({ title: h.t, outlet: h.o, url: h.u, published: h.p, lang: h.l, kind: "press", query: "" });
  const all = [...lives.flatMap((l) => l.items), ...(reg?.headlines ?? [])].filter((h) => { const k = key(h); if (seen.has(k)) return false; seen.add(k); return true; });
  const body: PwPayload & { registerFrom: string; pulse: PwRegister["pulse"] } = {
    fetchedAt: new Date().toISOString(), registerAt: reg?.updatedAt ?? null, registerFrom: from,
    status: [...(reg?.status ?? []), ...lives.map((l) => l.status)],
    pulse: reg?.pulse ?? [],
    ...summarise(all, countries, hours),
  };
  return NextResponse.json(body, { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=60" } });
}
