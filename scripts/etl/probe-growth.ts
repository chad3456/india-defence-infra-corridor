/**
 * Two questions about the growth story, and who will answer them.
 *
 * How many startups India has recognised, and how many people each welfare
 * scheme actually reaches, are both published — but by a dozen separate
 * ministries, each on its own portal, in whatever shape that portal felt like.
 * None of it can be reached from the machine this is written on, so this
 * measures from CI what each one hands over.
 *
 * ── What counts as an answer ─────────────────────────────────────────────
 *
 * A number alone is not useful. "11 lakh startups" with no date and no state
 * breakdown cannot be charted, cannot be checked, and cannot be updated
 * without republishing the whole claim. So the test is whether the bytes carry
 * a *table*: a state beside a count. That is the shape that becomes a map.
 *
 * A 200 that returns a JavaScript shell is a failure here, as it was for the
 * ticketing platforms — most government dashboards render their numbers after
 * the page loads, and a dashboard is not a dataset.
 *
 * ── Why the news route is probed too ─────────────────────────────────────
 *
 * PIB carries the same figures as ministry announcements, dated and
 * attributable, and this project already reads it. A number from a press
 * release is weaker than a number from a portal — it is a snapshot somebody
 * chose to announce rather than a series — but it is dated, and a dated
 * snapshot repeated over months becomes a series. Where a portal is shut, that
 * is the fallback worth knowing about.
 *
 * Publishes no series.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "./lib/http";
import { isEntryPoint } from "./lib/entry";

const ROOT = process.cwd();
const OUT = join(ROOT, "data/live/growth-probe.json");

/** Indian states, used to detect whether a body carries a statewise table. */
const STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Odisha", "Punjab", "Rajasthan", "Tamil Nadu",
  "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

interface Probe {
  topic: string;
  what: string;
  url: string;
  ok: boolean;
  status: string;
  bytes?: number;
  /** How many state names appear. Under about ten means it is not a state table. */
  statesNamed?: number;
  /** Rows in HTML tables that pair a state name with a number. */
  statewiseRows?: number;
  /** Largest number found near a state name — a sanity check on the units. */
  sampleRows?: string[];
  looksLikeShell?: boolean;
  note?: string;
}
const probes: Probe[] = [];

async function flush(): Promise<void> {
  await mkdir(join(ROOT, "data/live"), { recursive: true });
  await writeFile(OUT, JSON.stringify({ probedAt: new Date().toISOString(), probes }, null, 2) + "\n", "utf8");
}

function isShell(html: string): boolean {
  const scripts = (html.match(/<script/gi) ?? []).length;
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ");
  return scripts > 3 && text.replace(/\s+/g, " ").trim().length < 2000;
}

/** Table rows that put a state name next to at least one number. */
function statewiseRows(html: string): { count: number; samples: string[] } {
  const samples: string[] = [];
  let count = 0;
  for (const m of html.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const cells = [...m[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((c) => c[1]!.replace(/<[^>]+>/g, " ").replace(/&\w+;/g, " ").replace(/\s+/g, " ").trim());
    if (cells.length < 2) continue;
    const hasState = cells.some((c) => STATES.some((s) => c.toLowerCase() === s.toLowerCase()));
    const hasNumber = cells.some((c) => /^[\d,.\s]+$/.test(c) && /\d/.test(c));
    if (hasState && hasNumber) {
      count++;
      if (samples.length < 3) samples.push(cells.slice(0, 6).join(" | ").slice(0, 140));
    }
  }
  return { count, samples };
}

async function probe(topic: string, what: string, url: string): Promise<void> {
  const res = await getText(url, { timeoutMs: 45_000, retries: 1, cacheMs: 0 });
  if (!res.ok || res.data === null) {
    probes.push({ topic, what, url, ok: false, status: res.error ?? "no body" });
    await flush();
    return;
  }
  const body = res.data;
  const named = STATES.filter((s) => new RegExp(s, "i").test(body)).length;
  const { count, samples } = statewiseRows(body);
  probes.push({
    topic, what, url, ok: true, status: "200", bytes: body.length,
    statesNamed: named, statewiseRows: count, sampleRows: samples,
    looksLikeShell: isShell(body),
    note: count >= 10
      ? "carries a statewise table in the bytes"
      : named >= 10
        ? "names states but not in a table this can read"
        : isShell(body)
          ? "a shell: renders in a browser, carries no data in a fetch"
          : "200, but no statewise data found",
  });
  await flush();
  await new Promise((r) => setTimeout(r, 1500));
}

export async function run(opts: { onProgress?: (s: string) => void } = {}): Promise<{ errors: string[] }> {
  const log = opts.onProgress ?? (() => {});

  // ── Startups ───────────────────────────────────────────────────────────
  await probe("startups", "Startup India, recognition landing", "https://www.startupindia.gov.in/");
  await probe("startups", "DPIIT, department site", "https://dpiit.gov.in/");
  await probe("startups", "Startup India, states ranking", "https://www.startupindia.gov.in/content/sih/en/state-startup-ranking-framework.html");

  // ── Welfare schemes, each on its own ministry's portal ──────────────────
  await probe("jan-dhan", "PMJDY statewise account statistics", "https://pmjdy.gov.in/statewise-statistics");
  await probe("jan-dhan", "PMJDY account statistics", "https://pmjdy.gov.in/account");
  await probe("pm-kisan", "PM-KISAN beneficiary dashboard", "https://pmkisan.gov.in/Dashboard.aspx");
  await probe("mgnrega", "MGNREGA public reports", "https://nreganarep.nic.in/netnrega/statehome.aspx");
  await probe("ayushman", "PM-JAY public dashboard", "https://dashboard.pmjay.gov.in/");
  await probe("ujjwala", "PMUY connections released", "https://www.pmuy.gov.in/");
  await probe("housing", "PMAY-Gramin physical progress", "https://pmayg.nic.in/netiayHome/home.aspx");
  await probe("water", "Jal Jeevan Mission, statewise coverage", "https://ejalshakti.gov.in/jjmreport/JJMIndia.aspx");
  await probe("labour", "eShram registrations", "https://eshram.gov.in/");

  // ── The news route, where a portal is shut ──────────────────────────────
  // PIB carries the same figures, dated and attributable, and this project
  // already reads it.
  await probe("press", "PIB release archive", "https://pib.gov.in/allRel.aspx");
  await probe("press", "PIB Ministry of Commerce", "https://pib.gov.in/PressReleasePage.aspx?PRID=1");

  const carrying = probes.filter((p) => (p.statewiseRows ?? 0) >= 10);
  log(`reachable: ${probes.filter((p) => p.ok).length}/${probes.length}`);
  log(`carrying a statewise table: ${carrying.length}`);
  for (const p of probes) {
    if (!p.ok) { log(`  unreachable  ${p.topic}/${p.what}: ${p.status}`); continue; }
    log(`  200  ${(p.topic + "/" + p.what).padEnd(44)} ${String(p.bytes).padStart(8)}b  ` +
        `states=${p.statesNamed} rows=${p.statewiseRows}${p.looksLikeShell ? " SHELL" : ""}`);
    for (const s of p.sampleRows ?? []) log(`         ${s}`);
  }
  return { errors: [] };
}

if (isEntryPoint(import.meta.url)) {
  run({ onProgress: (s) => console.log(s) }).then(() => console.log(`\nwrote ${OUT}`));
}
