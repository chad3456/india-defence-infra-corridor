/**
 * Bright Data's Web Unlocker, as an optional egress for the ETL.
 *
 * `getText` tries a direct fetch first and falls back to this when the direct
 * one is refused, if and only if a key is configured. Nothing in the pipeline
 * requires it: every connector works without it and simply reaches fewer
 * hosts, which is the state the repo has been in until now.
 *
 * ── Why this is not a Claude connector ───────────────────────────────────
 *
 * Bright Data is not in this org's MCP connector directory and no Bright Data
 * tools are loaded in this session, so there is nothing on the Claude side to
 * call. What exists is their REST API, which takes a token. That is what this
 * wraps, and it runs where the rest of the ETL runs — in Actions — rather than
 * in a chat session, which is also where it is useful, since the pipeline is
 * what does the fetching.
 *
 * ── The line this draws, and why it is drawn there ───────────────────────
 *
 * An unblocker can defeat two very different things and they should not be
 * treated alike.
 *
 * The first is infrastructure. Most of what this pipeline cannot reach is
 * blocked by the *sandbox's* egress proxy, or by a blanket rule against
 * datacenter IP ranges that has nothing to do with the publisher's wishes.
 * Reading a public page from a different address is not circumvention of
 * anything the publisher decided.
 *
 * The second is a publisher's stated policy. If robots.txt disallows a path,
 * that is the site telling automated clients not to fetch it, and routing
 * around it through a residential proxy is exactly the circumvention the file
 * exists to prevent. This module refuses those, and `allowedByRobots` is
 * consulted before any unblocked fetch rather than after.
 *
 * The distinction matters most for the one source this tracker actually wants:
 * the DSCA publishes every US foreign military sale as a press release and
 * answers 403 from Actions. Whether that 403 is a WAF rule or a policy is not
 * something to assume in either direction — the probe reads their robots.txt
 * and records the answer, and this module obeys it.
 */
import { getText, type FetchResult } from "./http";

const API = "https://api.brightdata.com/request";

/** Configured only when a token is present. Absent is a normal state. */
export function brightDataConfigured(): boolean {
  return Boolean(process.env["BRIGHTDATA_API_KEY"]);
}

/** The Web Unlocker zone to bill against; Bright Data's own default name. */
function zone(): string {
  return process.env["BRIGHTDATA_ZONE"] ?? "web_unlocker1";
}

const robotsCache = new Map<string, string | null>();

/**
 * Whether a publisher's robots.txt permits this path for a generic client.
 *
 * A deliberately simple reader: it takes the rules under `User-agent: *`,
 * collects the Disallow prefixes, and refuses on a prefix match. It does not
 * implement Allow-overrides or wildcards, and errs toward refusing — a
 * misparse that blocks a fetch costs a source, and a misparse that permits one
 * costs the thing this whole module is trying not to do.
 *
 * A robots.txt that cannot be fetched is treated as permitting, which is the
 * convention: absence of a policy is not a prohibition.
 */
export async function allowedByRobots(url: string): Promise<boolean> {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  const key = u.origin;

  if (!robotsCache.has(key)) {
    const res = await getText(`${u.origin}/robots.txt`, {
      cacheMs: 24 * 3600_000, retries: 1, timeoutMs: 20_000,
    });
    robotsCache.set(key, res.ok ? (res.data ?? "") : null);
  }
  const txt = robotsCache.get(key);
  if (txt === null || txt === undefined || txt.trim() === "") return true;

  const lines = txt.split("\n").map((l) => l.replace(/#.*$/, "").trim());
  let inStar = false;
  const disallows: string[] = [];
  for (const line of lines) {
    const ua = line.match(/^user-agent:\s*(.+)$/i);
    if (ua) { inStar = ua[1]!.trim() === "*"; continue; }
    if (!inStar) continue;
    const dis = line.match(/^disallow:\s*(.*)$/i);
    if (dis) {
      const path = dis[1]!.trim();
      if (path) disallows.push(path);
    }
  }
  const path = u.pathname + u.search;
  return !disallows.some((d) => path.startsWith(d.replace(/\*.*$/, "")));
}

/**
 * Fetch through Bright Data, having first checked the publisher's own rules.
 *
 * Returns a failed result rather than throwing when the key is absent, the
 * path is disallowed, or the API refuses — every caller in this pipeline
 * already treats a failed fetch as a source it does not have.
 */
export async function getViaBrightData(
  url: string,
  opts: { timeoutMs?: number } = {},
): Promise<FetchResult<string> & { via: "brightdata" | "refused" | "unconfigured" }> {
  if (!brightDataConfigured()) {
    return { ok: false, data: null, error: "BRIGHTDATA_API_KEY not set", via: "unconfigured" };
  }
  if (!(await allowedByRobots(url))) {
    return {
      ok: false, data: null,
      error: "robots.txt disallows this path for generic clients",
      via: "refused",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000);
  try {
    const res = await fetch(API, {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${process.env["BRIGHTDATA_API_KEY"]}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ zone: zone(), url, format: "raw" }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { ok: false, data: null, error: `Bright Data HTTP ${res.status}`, via: "brightdata" };
    }
    const body = await res.text();
    return { ok: true, data: body, finalUrl: url, via: "brightdata" };
  } catch (err) {
    clearTimeout(timer);
    return {
      ok: false, data: null,
      error: err instanceof Error ? err.message : String(err),
      via: "brightdata",
    };
  }
}

/**
 * Direct first, unblocked second.
 *
 * The order is the point. Bright Data costs money per request and adds a hop,
 * so it is a fallback for the hosts that refuse a plain fetch rather than a
 * replacement for fetching. A run with no key configured behaves exactly as
 * the pipeline did before this module existed.
 */
export async function getTextUnblocked(
  url: string,
  opts: { timeoutMs?: number; cacheMs?: number; retries?: number } = {},
): Promise<FetchResult<string> & { via: "direct" | "brightdata" | "refused" | "unconfigured" }> {
  const direct = await getText(url, opts);
  if (direct.ok) return { ...direct, via: "direct" };

  const fallback = await getViaBrightData(url, { timeoutMs: opts.timeoutMs });
  if (fallback.ok) return fallback;

  // Report the direct failure, since that is the one that describes the host.
  return { ...direct, via: fallback.via };
}
