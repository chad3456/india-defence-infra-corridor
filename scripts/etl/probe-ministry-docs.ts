/**
 * Where the Commerce and Home ministries keep their monthly documents, and in
 * what shape — read before any connector is written against them.
 *
 * commerce.gov.in renders its document lists in the browser (#/documents/...),
 * so the list a reader sees comes from some API; this finds it by trying the
 * WordPress REST routes the site's older URLs suggest, the server-rendered
 * listing pages, and the front end's own JavaScript. mha.gov.in serves its
 * "Monthly Major Achievements" list as ordinary HTML with PDF links.
 *
 * Writes data/ministry/docs-probe.json. Downloads no PDF and publishes nothing.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getText } from "./lib/http";

const OUT = join(process.cwd(), "data", "ministry", "docs-probe.json");
const C = "https://www.commerce.gov.in";

/** Wayback listings kept whole (the commerce archive across its three sites). */
const CDX: Array<{ id: string; url: string; keep: RegExp }> = [
  { id: "nic-all", url: "https://web.archive.org/cdx/search/cdx?url=commerce.nic.in/pressrelease/*&output=json&fl=original,timestamp,mimetype&collapse=urlkey&limit=20000", keep: /^(?!.*detail)(?!.*\.(gif|jpg|png|css|js)).*/i },
  { id: "nic-all-caps", url: "https://web.archive.org/cdx/search/cdx?url=commerce.nic.in/PressRelease/*&output=json&fl=original,timestamp,mimetype&collapse=urlkey&limit=20000", keep: /^(?!.*detail)(?!.*\.(gif|jpg|png|css|js)).*/i },
  { id: "nic-root-trade", url: "https://web.archive.org/cdx/search/cdx?url=commerce.nic.in/*&output=json&fl=original,timestamp,mimetype&collapse=urlkey&limit=50000&filter=original:.*(?i)(trade|press).*", keep: /./ },
  { id: "nic-detail", url: "https://web.archive.org/cdx/search/cdx?url=commerce.nic.in/pressrelease/pressrelease_detail.asp*&output=json&fl=original,timestamp,mimetype&collapse=urlkey&limit=20000", keep: /id=\d+/i },
  { id: "nic-detail2", url: "https://web.archive.org/cdx/search/cdx?url=commerce.nic.in/PressRelease/pressrelease_detail.asp*&output=json&fl=original,timestamp,mimetype&collapse=urlkey&limit=20000", keep: /id=\d+/i },
  { id: "gov-writereaddata-pr", url: "https://web.archive.org/cdx/search/cdx?url=commerce.gov.in/writereaddata/*&output=json&fl=original,timestamp,mimetype&collapse=urlkey&limit=20000", keep: /press|trade|release|PR/i },
  { id: "gov-wp-uploads", url: "https://web.archive.org/cdx/search/cdx?url=commerce.gov.in/wp-content/uploads/*&output=json&fl=original,timestamp,mimetype&collapse=urlkey&limit=20000", keep: /\.pdf/i },
  { id: "gov-press-releases", url: "https://web.archive.org/cdx/search/cdx?url=commerce.gov.in/press-releases/*&output=json&fl=original,timestamp,mimetype&collapse=urlkey&limit=20000", keep: /trade/i },
];

const TARGETS: string[] = [
  `${C}/`,
  `${C}/wp-json/`,
  `${C}/wp-json/wp/v2/types`,
  `${C}/wp-json/wp/v2/posts?per_page=20&search=foreign%20trade`,
  `${C}/wp-json/wp/v2/media?per_page=50&search=foreign%20trade`,
  `${C}/wp-json/wp/v2/media?per_page=50&search=press%20release`,
  `${C}/press-releases/`,
  `${C}/press-releases/page/2`,
  `${C}/press-releases/page/40`,
  `${C}/?p=485`,
  `${C}/?p=481`,
  "https://www.mha.gov.in/en/commoncontent/monthly-major-achievements-mha",
  "https://www.mha.gov.in/en/commoncontent/monthly-major-achievements-mha?page=1",
  "https://www.mha.gov.in/en/commoncontent/monthly-major-achievements-mha?page=5",
  "https://web.archive.org/cdx/search/cdx?url=commerce.nic.in/pressrelease/*&output=json&fl=original,timestamp&collapse=urlkey&limit=3000",
  "https://web.archive.org/cdx/search/cdx?url=commerce.gov.in/writereaddata/*&output=json&fl=original,timestamp&collapse=urlkey&limit=3000&filter=mimetype:application/pdf",
  "https://web.archive.org/cdx/search/cdx?url=www.mha.gov.in/sites/default/files/*Monthly*&output=json&fl=original,timestamp&collapse=urlkey&limit=3000",
];

function anchors(html: string, base: string) {
  const out: Array<{ href: string; text: string }> = [];
  for (const m of html.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const raw = m[1] ?? "";
    if (!raw || raw.startsWith("#") || raw.startsWith("javascript:")) continue;
    let href = raw; try { href = new URL(raw, base).toString(); } catch { /* keep */ }
    out.push({ href, text: (m[2] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() });
  }
  return out;
}

async function main() {
  const results: unknown[] = [];
  for (const url of TARGETS) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await getText(url, { timeoutMs: 45_000, retries: 1, cacheMs: 0 });
    if (!res.ok || !res.data) { results.push({ url, ok: false, status: res.error }); console.log(`  ${url}: ${res.error}`); continue; }
    const body = res.data;
    const docs = anchors(body, url).filter((a) => /\.pdf|press|release|trade|monthly|achiev/i.test(a.href + a.text));
    const scripts = [...body.matchAll(/<script[^>]+src="([^"]+)"/gi)].map((m) => { try { return new URL(m[1]!, url).toString(); } catch { return m[1]; } });
    results.push({ url, ok: true, bytes: body.length, finalUrl: res.finalUrl, head: body.slice(0, 2500), links: docs.slice(0, 300), scripts });
    console.log(`  ${url}: ${body.length} bytes, ${docs.length} links, ${scripts.length} scripts`);
    // The commerce front end: read its bundles for the API it calls.
    if (url === `${C}/`) {
      for (const s of scripts.filter((s): s is string => !!s && /main|app|chunk|runtime|index-|assets\//i.test(s)).slice(0, 6)) {
        const js = await getText(s, { timeoutMs: 45_000, retries: 1, cacheMs: 0 });
        if (!js.ok || !js.data) { results.push({ url: s, ok: false, status: js.error }); continue; }
        const apis = [...new Set([...js.data.matchAll(/["'`](https?:\/\/[^"'`\s]{6,200}|\/(?:api|wp-json|backend|webapi|admin)[^"'`\s]{0,160})["'`]/g)].map((m) => m[1]))].slice(0, 300);
        const near = [...js.data.matchAll(/.{0,200}(?:press-releases|data-related|documents\/|baseURL|baseUrl|axios|fetch\().{0,240}/g)].map((m) => m[0]).slice(0, 80);
        results.push({ url: s, ok: true, bytes: js.data.length, apis, near });
        console.log(`  bundle ${s}: ${apis.length} api strings`);
      }
    }
  }
  const cdx: Record<string, unknown> = {};
  for (const c of CDX) {
    await new Promise((r) => setTimeout(r, 4000));
    const res = await getText(c.url, { timeoutMs: 90_000, retries: 2, cacheMs: 0 });
    if (!res.ok || !res.data) { cdx[c.id] = { ok: false, status: res.error }; continue; }
    try {
      const rows = (JSON.parse(res.data) as string[][]).slice(1).filter((r) => c.keep.test(r[0] ?? ""));
      cdx[c.id] = { ok: true, rows };
      console.log(`  cdx ${c.id}: ${rows.length}`);
    } catch (e) { cdx[c.id] = { ok: false, status: (e as Error).message }; }
  }
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({ probedAt: new Date().toISOString(), results, cdx }, null, 1));
}
main().catch((e) => { console.error(e); });
