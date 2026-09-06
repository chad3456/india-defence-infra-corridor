/**
 * Where do satellite positions come from, and how much do they weigh?
 *
 * The ask is "which satellites are over India right now". Nothing publishes
 * that as a feed, and nothing could: a position is not data anyone stores, it
 * is computed. What is published is the orbit — a two-line element set, which
 * SGP4 turns into a position for any instant. So the live part belongs in the
 * browser, and the only thing to fetch is the elements.
 *
 * CelesTrak is the origin for those. satellitemap.space, which prompted this,
 * is a renderer of the same underlying data; it is probed here too so the
 * choice between them is measured rather than asserted.
 *
 * The number that decides the design is size. Elements go stale in days, so
 * whatever is committed is re-committed several times a week, and the full
 * active catalogue is around eleven thousand objects. This measures each
 * candidate set so the choice of what to carry is made against bytes rather
 * than against a guess.
 *
 * Publishes no series.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "./lib/http";
import { isEntryPoint } from "./lib/entry";

const ROOT = process.cwd();
const OUT = join(ROOT, "data/live/satellites-probe.json");
const GP = "https://celestrak.org/NORAD/elements/gp.php";

interface Probe {
  what: string;
  url: string;
  ok: boolean;
  status: string;
  bytes?: number;
  /** Objects, counted the way the format allows. */
  objects?: number;
  /** How old the freshest element set is, in days. */
  freshestEpochDays?: number | null;
  sample?: string;
  note?: string;
}
const probes: Probe[] = [];

async function flush(): Promise<void> {
  await mkdir(join(ROOT, "data/live"), { recursive: true });
  await writeFile(OUT, JSON.stringify({ probedAt: new Date().toISOString(), probes }, null, 2) + "\n", "utf8");
}

/**
 * A TLE epoch is encoded as YYDDD.DDDDDDDD in columns 19-32 of line 1 — the
 * last two digits of the year, then the fractional day. Reading it is how we
 * find out whether a feed is live or a stale mirror, which a byte count cannot
 * tell us.
 */
function epochAgeDays(line1: string): number | null {
  const raw = line1.slice(18, 32).trim();
  const m = /^(\d{2})(\d{3}\.\d+)$/.exec(raw);
  if (!m) return null;
  const yy = Number(m[1]);
  const year = yy < 57 ? 2000 + yy : 1900 + yy;   // the usual TLE pivot
  const dayOfYear = Number(m[2]);
  const epoch = Date.UTC(year, 0, 1) + (dayOfYear - 1) * 86_400_000;
  return (Date.now() - epoch) / 86_400_000;
}

async function probe(what: string, url: string, kind: "tle" | "json" | "csv" | "html"): Promise<void> {
  const res = await getText(url, { timeoutMs: 60_000, retries: 1, cacheMs: 0 });
  if (!res.ok || res.data === null) {
    probes.push({ what, url, ok: false, status: res.error ?? "no body" });
    await flush();
    return;
  }
  const body = res.data;
  const p: Probe = { what, url, ok: true, status: "200", bytes: body.length };

  if (kind === "tle") {
    const lines = body.split("\n").map((l) => l.trimEnd()).filter((l) => l.length > 0);
    // Three-line format: name, then line 1, then line 2.
    const firsts = lines.filter((l) => l.startsWith("1 "));
    p.objects = firsts.length;
    const ages = firsts.map(epochAgeDays).filter((a): a is number => a !== null);
    p.freshestEpochDays = ages.length ? Math.min(...ages) : null;
    p.sample = lines.slice(0, 3).join(" / ").slice(0, 140);
  } else if (kind === "json") {
    try {
      const arr = JSON.parse(body) as unknown[];
      p.objects = Array.isArray(arr) ? arr.length : 0;
      p.sample = JSON.stringify(Array.isArray(arr) ? arr[0] : arr).slice(0, 220);
    } catch { p.note = "200 but not JSON"; p.sample = body.slice(0, 140); }
  } else if (kind === "csv") {
    const lines = body.split("\n").filter((l) => l.trim().length > 0);
    p.objects = Math.max(0, lines.length - 1);
    p.sample = lines.slice(0, 2).join(" / ").slice(0, 220);
  } else {
    const scripts = (body.match(/<script/gi) ?? []).length;
    p.note = scripts > 3 && body.replace(/<[^>]+>/g, " ").trim().length < 2000
      ? "a shell: renders in a browser, carries no data in the bytes"
      : "carries markup";
    p.sample = body.slice(0, 140).replace(/\s+/g, " ");
  }

  probes.push(p);
  await flush();
  await new Promise((r) => setTimeout(r, 1200));   // CelesTrak asks for restraint
}

export async function run(opts: { onProgress?: (s: string) => void } = {}): Promise<{ errors: string[] }> {
  const log = opts.onProgress ?? (() => {});

  // The whole catalogue, to find out what carrying everything would cost.
  await probe("all active objects (TLE)", `${GP}?GROUP=active&FORMAT=tle`, "tle");

  // Groups that would make a curated set, if everything is too heavy.
  for (const g of ["stations", "science", "resource", "geo", "gnss", "weather", "starlink", "last-30-days"]) {
    await probe(`group: ${g}`, `${GP}?GROUP=${g}&FORMAT=tle`, "tle");
  }

  // The Indian fleet. Whether CelesTrak will filter by owner decides whether
  // this project has to carry its own list of NORAD ids.
  await probe("SATCAT, country=IND", "https://celestrak.org/satcat/records.php?COUNTRY=IND&FORMAT=csv", "csv");
  await probe("SATCAT, full CSV", "https://celestrak.org/pub/satcat.csv", "csv");

  // A couple of named Indian satellites, to confirm single-object lookup works
  // and to see what the name field actually says.
  await probe("GP by name: CARTOSAT", `${GP}?NAME=CARTOSAT&FORMAT=tle`, "tle");
  await probe("GP by name: RISAT", `${GP}?NAME=RISAT&FORMAT=tle`, "tle");

  // The site that prompted this, measured rather than assumed.
  await probe("satellitemap.space", "https://satellitemap.space/", "html");

  const ok = probes.filter((p) => p.ok);
  log(`reachable: ${ok.length}/${probes.length}`);
  for (const p of ok) {
    log(`  ${p.what.padEnd(28)} ${String(p.bytes).padStart(9)} bytes  ${String(p.objects ?? "-").padStart(6)} objects` +
        (p.freshestEpochDays != null ? `  freshest epoch ${p.freshestEpochDays.toFixed(1)}d old` : "") +
        (p.note ? `  — ${p.note}` : ""));
  }
  for (const p of probes.filter((x) => !x.ok)) log(`  unreachable: ${p.what}: ${p.status}`);
  return { errors: [] };
}

if (isEntryPoint(import.meta.url)) {
  run({ onProgress: (s) => console.log(s) }).then(() => console.log(`\nwrote ${OUT}`));
}
