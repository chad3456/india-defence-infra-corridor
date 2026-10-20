/**
 * Indian politics on Instagram: the scheduled half.
 *
 * `npm run instagram`. Writes data/instagram/register.json. CI only.
 *
 * Reads Meta's Graph API "business discovery" endpoint, the one legitimate
 * way to read another account's public counts: its followers, its number of
 * posts, and the likes and comments on each recent post. It needs an
 * Instagram Business or Creator account linked to a Meta app:
 *
 *   IG_GRAPH_TOKEN  a long-lived access token with instagram_basic and
 *                   pages_read_engagement (repository secret, never logged)
 *   IG_USER_ID      that business account's Instagram user id
 *
 * Without them the job records why it is inactive and the page runs on
 * published figures alone. Instagram itself is never scraped.
 *
 * Each run stores one follower snapshot per account per day — the history
 * the follower-change dashboards are built from accumulates from the first
 * run; nothing earlier is reconstructed — and every post since SINCE, with its
 * latest like and comment counts. Connectors never throw: an account that
 * fails keeps what was stored before and says why.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isEntryPoint } from "../lib/entry";
import { ACCOUNTS, SINCE, parseDiscovery, type InstagramRegister, type Media } from "../../../lib/instagram";

const OUT = join(process.cwd(), "data", "instagram", "register.json");
const API = "https://graph.facebook.com/v21.0";
const PAGES = 10; // 50 posts a page: up to 500 posts an account, enough for six months of the busiest
const now = () => new Date().toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The token travels in a header, never in a URL, so neither a log line nor a cache key can hold it. */
async function graph(path: string, token: string): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  try {
    const r = await fetch(`${API}/${path}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(45_000) });
    const body = (await r.json().catch(() => null)) as { error?: { message?: string; code?: number } } | null;
    if (!r.ok || body?.error) return { ok: false, error: `HTTP ${r.status}${body?.error ? `: ${String(body.error.message ?? "").replace(token, "[token]").slice(0, 200)} (code ${body.error.code})` : ""}` };
    return { ok: true, data: body };
  } catch (e) {
    return { ok: false, error: (e instanceof Error ? e.message : String(e)).replace(token, "[token]") };
  }
}

const FIELDS = "username,name,followers_count,media_count";
const MEDIA = "id,timestamp,media_type,media_product_type,like_count,comments_count,permalink,caption";

export async function run(): Promise<void> {
  const previous: InstagramRegister | null = existsSync(OUT) ? (JSON.parse(await readFile(OUT, "utf8")) as InstagramRegister) : null;
  const reg: InstagramRegister = previous ?? { updatedAt: now(), active: false, accounts: {} };
  const token = process.env.IG_GRAPH_TOKEN, user = process.env.IG_USER_ID;
  if (!token || !user) {
    const reason = "No IG_GRAPH_TOKEN and IG_USER_ID: Meta's Graph API needs an Instagram Business account and a token. The page shows published figures only.";
    if (previous && previous.reason === reason && !previous.active) { console.log("inactive, unchanged; nothing written"); return; }
    reg.active = false; reg.reason = reason; reg.updatedAt = now();
    await mkdir(join(process.cwd(), "data", "instagram"), { recursive: true });
    await writeFile(OUT, JSON.stringify(reg) + "\n", "utf8");
    console.log(reason);
    return;
  }

  let okCount = 0;
  const today = now().slice(0, 10);
  for (const a of ACCOUNTS) {
    const rec = reg.accounts[a.handle] ?? { handle: a.handle, ok: false, snapshots: [], media: [] };
    const fresh: Media[] = [];
    let after: string | null = null, first = true, error: string | undefined, followers = 0, posts = 0, name = "";
    for (let page = 0; page < PAGES && (first || after); page++) {
      const media = `media.limit(50)${after ? `.after(${after})` : ""}{${MEDIA}}`;
      const res = await graph(`${user}?fields=${encodeURIComponent(`business_discovery.username(${a.handle}){${FIELDS},${media}}`)}`, token);
      await sleep(1_500);
      if (!res.ok) { error = res.error; break; }
      const parsed = parseDiscovery(res.data);
      if (!parsed) { error = "not a public business or creator account, or not found"; break; }
      if (first) { followers = parsed.followers; posts = parsed.posts; name = parsed.name; first = false; }
      fresh.push(...parsed.media);
      after = parsed.after;
      if (parsed.media.some((m) => m.t < SINCE)) break;
    }
    if (error && first) {
      reg.accounts[a.handle] = { ...rec, ok: false, error, readAt: now() };
      console.log(`  FAIL @${a.handle}: ${error}`);
      continue;
    }
    okCount++;
    // One snapshot a day: a later run the same day replaces the earlier one.
    rec.snapshots = [...rec.snapshots.filter((s) => s.d !== today), { d: today, followers, posts }].sort((x, y) => x.d.localeCompare(y.d));
    // Latest counts win; posts no longer returned (deleted, or past the pages read) keep their last counts.
    const byId = new Map(rec.media.map((m) => [m.id, m]));
    for (const m of fresh) if (m.t >= SINCE) byId.set(m.id, m);
    rec.media = [...byId.values()].filter((m) => m.t >= SINCE).sort((x, y) => y.t.localeCompare(x.t));
    reg.accounts[a.handle] = { ...rec, ok: true, error, name, readAt: now() };
    console.log(`  ok   @${a.handle}: ${followers} followers, ${rec.media.length} posts since ${SINCE}${error ? ` (stopped early: ${error})` : ""}`);
  }
  reg.active = true; reg.reason = undefined; reg.updatedAt = now();
  await mkdir(join(process.cwd(), "data", "instagram"), { recursive: true });
  await writeFile(OUT, JSON.stringify(reg) + "\n", "utf8");
  if (okCount === 0) { console.error("every account failed"); process.exit(1); }
}

if (isEntryPoint(import.meta.url)) {
  run().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
}
