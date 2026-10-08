/**
 * What the internet essay's sources actually return, before anything is
 * parsed. `npm run internet:probe`. Writes data/live/internet-probe.json after
 * every target. Publishes no series.
 *
 * Several of these are not a single URL but a page that links to a file — the
 * ITU price workbook, Access Now's shutdown data — so the probe follows the
 * links it finds and records what the file holds: sheet names and the first
 * rows of each, or a CSV's header and row count.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "./lib/http";
import { readWorkbook } from "./lib/sheet-table";

const OUT = join(process.cwd(), "data", "live", "internet-probe.json");
const report: { probedAt: string; results: Array<Record<string, unknown>> } = { probedAt: new Date().toISOString(), results: [] };

async function save(): Promise<void> {
  await mkdir(join(process.cwd(), "data", "live"), { recursive: true });
  await writeFile(OUT, JSON.stringify(report, null, 1) + "\n", "utf8");
}

async function text(id: string, url: string, extra: (body: string) => Record<string, unknown> = () => ({})): Promise<string | null> {
  const res = await getText(url, { timeoutMs: 90_000, retries: 2, cacheMs: 0 });
  const body = res.data ?? "";
  report.results.push({ id, url, ok: res.ok, error: res.error ?? null, bytes: body.length, head: body.slice(0, 600), ...(res.ok ? extra(body) : {}) });
  await save();
  console.log(`  ${res.ok ? "ok  " : "FAIL"} ${id} ${body.length} bytes ${res.error ?? ""}`);
  return res.ok ? body : null;
}

async function binary(id: string, url: string): Promise<Uint8Array | null> {
  try {
    const r = await fetch(url, { headers: { "user-agent": "BharatTracker/0.1 (+https://github.com/chad3456/india-defence-infra-corridor) probe" } });
    if (!r.ok) { report.results.push({ id, url, ok: false, status: r.status }); await save(); return null; }
    return new Uint8Array(await r.arrayBuffer());
  } catch (e) {
    report.results.push({ id, url, ok: false, error: String(e) }); await save(); return null;
  }
}

async function head(id: string, url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD" });
    report.results.push({ id, url, ok: r.ok, status: r.status, length: r.headers.get("content-length") });
    await save();
    console.log(`  ${r.ok ? "ok  " : "FAIL"} ${id} ${r.status}`);
    return r.ok;
  } catch (e) { report.results.push({ id, url, ok: false, error: String(e) }); await save(); return false; }
}

function links(html: string, base: string, re: RegExp): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    const href = m[1]!;
    if (!re.test(href)) continue;
    try { out.add(new URL(href, base).toString()); } catch { /* ignore */ }
  }
  return [...out];
}

async function workbook(id: string, url: string): Promise<void> {
  const bin = await binary(id, url);
  if (!bin) return;
  try {
    const tables = await readWorkbook(bin);
    report.results.push({
      id, url, ok: true, bytes: bin.length,
      sheets: tables.map((t) => ({ name: t.sheet, rows: t.rows.length, first: t.rows.slice(0, 8).map((r) => r.slice(0, 14)) })),
    });
  } catch (e) {
    report.results.push({ id, url, ok: false, error: `not a readable workbook: ${String(e)}`, bytes: bin.length });
  }
  await save();
  console.log(`  ok   ${id} workbook ${bin.length} bytes`);
}

async function main(): Promise<void> {
  // ── ITU price baskets: the page, then every workbook it links ──────────
  const ituBase = "https://www.itu.int/en/ITU-D/Statistics/Pages/ICTprices/default.aspx";
  const itu = await text("itu-prices-page", ituBase);
  if (itu) {
    const files = links(itu, ituBase, /\.(xlsx?|csv)(\?|$)/i);
    report.results.push({ id: "itu-prices-links", links: files });
    await save();
    for (const f of files.slice(0, 6)) await workbook(`itu-file ${f.split("/").pop()}`, f);
  }
  await text("itu-datahub-about", "https://datahub.itu.int/about/");

  // ── World Bank: one indicator, all countries ───────────────────────────
  await text("worldbank-users", "https://api.worldbank.org/v2/country/all/indicator/IT.NET.USER.ZS?format=json&per_page=3&date=2023");

  // ── IPv6 adoption: APNIC Labs ──────────────────────────────────────────
  const apnic = await text("apnic-ipv6-page", "https://stats.labs.apnic.net/ipv6/");
  if (apnic) {
    const l = links(apnic, "https://stats.labs.apnic.net/ipv6/", /csv|json|cgi-bin|v6pop/i);
    report.results.push({ id: "apnic-ipv6-links", links: l.slice(0, 40) });
    await save();
  }
  await text("apnic-ipv6-csv-guess", "https://stats.labs.apnic.net/cgi-bin/v6pop-all?d=1&e=csv");

  // ── Internet exchange points: PeeringDB ────────────────────────────────
  await text("peeringdb-ix", "https://www.peeringdb.com/api/ix?limit=3");

  // ── Submarine cables: TeleGeography's open map data ────────────────────
  await text("telegeography-landings", "https://www.submarinecablemap.com/api/v3/landing-point/landing-point-geo.json");
  await text("telegeography-cables", "https://www.submarinecablemap.com/api/v3/cable/all.json");

  // ── Satellites: CelesTrak's catalogue ──────────────────────────────────
  await text("celestrak-satcat", "https://celestrak.org/pub/satcat.csv", (b) => {
    const lines = b.split("\n");
    const starlink = lines.filter((l) => l.startsWith("STARLINK")).length;
    return { header: lines[0], rows: lines.length, starlinkRows: starlink, sample: lines.slice(1, 4) };
  });

  // ── Shutdowns: Access Now ──────────────────────────────────────────────
  for (const [id, url] of [
    ["accessnow-2025-release", "https://www.accessnow.org/press-release/one-region-half-the-worlds-shutdowns-internet-shutdowns-in-the-asia-pacific-in-2025/"],
    ["accessnow-keepiton-data", "https://www.accessnow.org/keepiton-data/"],
    ["accessnow-keepiton", "https://www.accessnow.org/campaign/keepiton/"],
  ] as const) {
    const page = await text(id, url, (b) => ({ numbers: [...b.matchAll(/\b(\d{2,4})\s+(internet\s+)?shutdowns?\b[^.<]{0,80}/gi)].slice(0, 20).map((m) => m[0]) }));
    if (page) {
      const files = links(page, url, /\.(xlsx?|csv|pdf)(\?|$)|docs\.google|airtable/i);
      report.results.push({ id: `${id}-links`, links: files.slice(0, 30) });
      await save();
      for (const f of files.filter((x) => /\.(xlsx?|csv)(\?|$)/i.test(x)).slice(0, 3)) await workbook(`accessnow-file ${f.split("/").pop()}`, f);
    }
  }

  // ── Speeds: Ookla's open tiles, the latest quarter that exists ─────────
  const now = new Date();
  for (let back = 0; back < 6; back++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back * 3, 1));
    const q = Math.floor(d.getUTCMonth() / 3) + 1;
    const y = d.getUTCFullYear();
    const m = String((q - 1) * 3 + 1).padStart(2, "0");
    const url = `https://ookla-open-data.s3.amazonaws.com/parquet/performance/type=fixed/year=${y}/quarter=${q}/${y}-${m}-01_performance_fixed_tiles.parquet`;
    if (await head(`ookla fixed ${y} Q${q}`, url)) break;
  }

  // ── Borders: Natural Earth, India's point of view ──────────────────────
  await head("naturalearth-ind-50m", "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries_ind.geojson");
  console.log(`wrote ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
