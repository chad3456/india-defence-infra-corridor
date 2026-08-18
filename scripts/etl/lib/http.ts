/**
 * Fetch helpers for the ETL.
 *
 * Every upstream call is retried with exponential backoff and jitter, given a
 * hard timeout, and cached on disk so a re-run during development does not
 * hammer public APIs. Failures are returned, never thrown — one dead connector
 * must not take down the whole pipeline run.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const CACHE_DIR = join(process.cwd(), ".etl-cache");
const USER_AGENT =
  "BharatTracker/0.1 (+https://github.com/chad3456/india-defence-infra-corridor) data-pipeline";

/**
 * Several publishers — PIB, PMO, MEA, Business Standard — answer 403 to any
 * user-agent that identifies as a bot, including for their own public RSS
 * feeds. All sixteen PIB ministry feeds were rejected this way on the first
 * live run. A 403 therefore triggers one retry presenting as a browser, which
 * is the only way to read a feed that is published for the public to read.
 */
const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export interface FetchResult<T> {
  ok: boolean;
  data: T | null;
  error?: string;
  fromCache?: boolean;
}

function cacheKey(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 32);
}

async function readCache<T>(url: string, maxAgeMs: number): Promise<T | null> {
  try {
    const p = join(CACHE_DIR, `${cacheKey(url)}.json`);
    const raw = await readFile(p, "utf8");
    const parsed = JSON.parse(raw) as { at: number; body: T };
    if (Date.now() - parsed.at > maxAgeMs) return null;
    return parsed.body;
  } catch {
    return null;
  }
}

async function writeCache(url: string, body: unknown): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(
      join(CACHE_DIR, `${cacheKey(url)}.json`),
      JSON.stringify({ at: Date.now(), body }),
      "utf8",
    );
  } catch {
    // Cache failures are never fatal.
  }
}

export interface GetOptions {
  timeoutMs?: number;
  retries?: number;
  /** Cache lifetime. 0 disables the cache read (writes still happen). */
  cacheMs?: number;
  accept?: string;
  /** Extra request headers, e.g. an Authorization bearer token. */
  headers?: Record<string, string>;
}

export async function getText(url: string, opts: GetOptions = {}): Promise<FetchResult<string>> {
  const { timeoutMs = 30_000, retries = 3, cacheMs = 6 * 60 * 60 * 1000, accept, headers } = opts;

  if (cacheMs > 0) {
    const cached = await readCache<string>(url, cacheMs);
    if (cached !== null) return { ok: true, data: cached, fromCache: true };
  }

  let lastError = "unknown error";
  let triedBrowserUa = false;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const backoff = Math.min(16_000, 1000 * 2 ** (attempt - 1));
      const jitter = Math.random() * 400;
      await new Promise((r) => setTimeout(r, backoff + jitter));
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "user-agent": triedBrowserUa ? BROWSER_UA : USER_AGENT,
          "accept-language": "en-IN,en;q=0.9",
          ...(accept ? { accept } : {}),
          ...(headers ?? {}),
        },
      });
      clearTimeout(timer);
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        if (res.status === 403 && !triedBrowserUa) {
          triedBrowserUa = true;
          attempt--; // the browser retry is not one of the error retries
          continue;
        }
        // 4xx other than 429 will not fix themselves — stop early.
        if (res.status >= 400 && res.status < 500 && res.status !== 429) break;
        continue;
      }
      const body = await res.text();
      await writeCache(url, body);
      return { ok: true, data: body };
    } catch (err) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { ok: false, data: null, error: lastError };
}

export async function getJson<T>(url: string, opts: GetOptions = {}): Promise<FetchResult<T>> {
  const res = await getText(url, { ...opts, accept: "application/json" });
  if (!res.ok || res.data === null) return { ok: false, data: null, error: res.error };
  try {
    return { ok: true, data: JSON.parse(res.data) as T, fromCache: res.fromCache };
  } catch (err) {
    return {
      ok: false,
      data: null,
      error: `invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
