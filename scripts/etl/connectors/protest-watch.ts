/**
 * Protest Watch's collector: `npm run protest:watch`, every 30 minutes in CI.
 *
 * Asks Google News, in two dozen national editions and a dozen languages,
 * for the day's protest headlines — protest words only, never a cause — and
 * GDELT for the week's protest-coverage pulse. Keeps headlines that pass the
 * shared protest test, merges them into data/protest-watch/register.json,
 * drops anything older than seven days, and writes only when something
 * changed. A search that fails is recorded as failed; the run carries on.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getJson, getText } from "../lib/http";
import { isEntryPoint } from "../lib/entry";
import { parseGoogleNews, headlineKey } from "../../../lib/france-riots-shared";
import { EDITIONS, editionUrl, isProtestHeadline, type PwHeadline, type PwRegister, type PwStatus } from "../../../lib/protest-watch";

const OUT = join(process.cwd(), "data", "protest-watch", "register.json");
const KEEP_DAYS = 7, CAP = 5000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const GDELT = "https://api.gdeltproject.org/api/v2/doc/doc?query=" + encodeURIComponent("(protest OR protesters OR demonstrators OR rally)") + "&mode=TimelineVolRaw&format=json&timespan=7d";

export async function run(): Promise<void> {
  const prev: PwRegister | null = existsSync(OUT) ? JSON.parse(await readFile(OUT, "utf8")) : null;
  const status: PwStatus[] = [];
  const fresh: PwHeadline[] = [];
  for (const e of EDITIONS) {
    const r = await getText(editionUrl(e), { timeoutMs: 20_000, retries: 1, cacheMs: 0, headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" } });
    if (!r.ok) { status.push({ id: e.id, label: `Google News ${e.id}`, ok: false, count: 0, error: r.error }); await sleep(1500); continue; }
    const items = parseGoogleNews(r.data ?? "", e.hl.slice(0, 2), "press", e.q).filter((h) => isProtestHeadline(h.title));
    for (const h of items) fresh.push({ t: h.title, o: h.outlet, u: h.url, p: h.published, l: h.lang, e: e.id });
    status.push({ id: e.id, label: `Google News ${e.id}`, ok: true, count: items.length });
    await sleep(1500);
  }
  let pulse = prev?.pulse ?? [];
  const g = await getJson<{ timeline?: Array<{ data?: Array<{ date?: string; value?: number }> }> }>(GDELT, { timeoutMs: 60_000, retries: 1, cacheMs: 0 });
  if (g.ok) {
    const pts = g.data?.timeline?.[0]?.data ?? [];
    pulse = pts.flatMap((p) => { const m = typeof p.date === "string" ? /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/.exec(p.date) : null; return m && typeof p.value === "number" ? [{ t: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00Z`, v: p.value }] : []; });
  }
  status.push({ id: "gdelt", label: "GDELT protest-coverage pulse", ok: g.ok, count: pulse.length, ...(g.ok ? {} : { error: `${g.error}; the last pulse is kept` }) });

  const okCount = status.filter((s) => s.ok && s.id !== "gdelt").length;
  console.log(`editions answered: ${okCount}/${EDITIONS.length}; protest headlines this run: ${fresh.length}`);
  if (!okCount && !prev) { console.error("no edition answered and no previous register"); process.exit(1); }

  // Merge: newest first, one per outlet and title, seven days, capped.
  const since = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString();
  const seen = new Set<string>();
  const key = (h: PwHeadline) => headlineKey({ title: h.t, outlet: h.o, url: h.u, published: h.p, lang: h.l, kind: "press", query: "" });
  const headlines = [...fresh, ...(prev?.headlines ?? [])]
    .filter((h) => h.p && h.p >= since && isProtestHeadline(h.t))
    .sort((a, b) => (b.p ?? "").localeCompare(a.p ?? ""))
    .filter((h) => { const k = key(h); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, CAP);
  const added = headlines.filter((h) => !(prev?.headlines ?? []).some((x) => key(x) === key(h))).length;
  console.log(`register: ${headlines.length} headlines (${added} new)`);
  if (prev && !added && headlines.length === prev.headlines.length) { console.log("no change"); return; }
  const doc: PwRegister = { updatedAt: new Date().toISOString(), status, headlines, pulse };
  await mkdir(join(process.cwd(), "data", "protest-watch"), { recursive: true });
  await writeFile(OUT, JSON.stringify(doc) + "\n");
}

if (isEntryPoint(import.meta.url)) run().catch((e) => { console.error(e); process.exit(1); });
