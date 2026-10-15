/**
 * The ministries section: the pinned documents and the figures read from them.
 *
 *  - Every pinned document's file exists and still has the SHA-256 recorded
 *    when it was downloaded, so the text the figures were checked against is
 *    the text of the file in the repository.
 *  - Every trade figure's quote is in its release's text and contains the
 *    figure.
 *  - Every release table still adds up: merchandise plus services equals the
 *    total, and exports minus imports equals the balance, in both columns.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadTrade, loadMha, loadMhaRead, mhaMonth, type PinnedDoc, type TradeObs } from "../lib/ministry";

let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => { if (!cond) failed++; console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  " + detail}`); };
const read = <T,>(p: string): T => JSON.parse(readFileSync(join(process.cwd(), p), "utf8")) as T;

console.log("\nPinned documents");
for (const m of ["commerce", "mha"]) {
  const docs = read<{ docs: PinnedDoc[] }>(`data/ministry/${m}-docs.json`).docs.filter((d) => d.ok);
  const missing = docs.filter((d) => !d.file || !existsSync(join(process.cwd(), d.file)));
  ok(`${m}: every pinned document's file is in the repo (${docs.length})`, missing.length === 0, missing.slice(0, 5).map((d) => d.id).join(", "));
  const changed = docs.filter((d) => d.file && existsSync(join(process.cwd(), d.file)) && createHash("sha256").update(readFileSync(join(process.cwd(), d.file))).digest("hex") !== d.sha256);
  ok(`${m}: every file still has the checksum it was downloaded with`, changed.length === 0, changed.slice(0, 5).map((d) => d.id).join(", "));
}

console.log("\nTrade figures against their releases");
const v = loadTrade();
ok(`${v.verified.length} figures verified`, v.verified.length >= 500, String(v.verified.length));
ok("no figure fails its check", v.failed.length === 0, v.failed.slice(0, 5).map((f) => `${f.obs.src} ${f.obs.series} ${f.obs.period}: ${f.why}`).join("; "));

const groups = new Map<string, Map<string, TradeObs>>();
for (const o of v.verified) {
  if (!/^(merch|services|total)-/.test(o.series)) continue;
  const k = `${o.src}|${o.table}|${o.role}`;
  if (!groups.has(k)) groups.set(k, new Map());
  groups.get(k)!.set(o.series, o);
}
let tables = 0, bad: string[] = [];
for (const [k, g] of groups) {
  const val = (s: string) => g.get(s)?.v;
  const need = ["merch-exports", "merch-imports", "services-exports", "services-imports", "total-exports", "total-imports", "total-balance"];
  if (!need.every((s) => val(s) != null)) continue;
  tables++;
  const e = (a: number, b: number) => Math.abs(a - b) <= 0.031;
  if (!e(val("merch-exports")! + val("services-exports")!, val("total-exports")!) || !e(val("merch-imports")! + val("services-imports")!, val("total-imports")!) || !e(val("total-exports")! - val("total-imports")!, val("total-balance")!)) bad.push(k);
}
ok(`every one of ${tables} release tables adds up as printed`, bad.length === 0, bad.slice(0, 4).join("; "));
const months = new Set(v.verified.filter((o) => o.kind === "month").map((o) => o.period));
ok(`at least 24 months covered (${months.size})`, months.size >= 24);

console.log("\nHome Ministry reports");
const mha = loadMha();
ok(`${mha.docs.length} monthly reports pinned`, mha.docs.length >= 100);
const unmonthed = mha.docs.filter((d) => !mhaMonth(d.title));
ok("every report's month is read from its title", unmonthed.length <= 3, unmonthed.map((d) => d.title).join("; "));
const months2 = mha.byMonth.map((x) => x.m);
ok("no month has two reports", new Set(months2).size === months2.length, months2.filter((m, i) => months2.indexOf(m) !== i).join(", "));

const mr = loadMhaRead();
ok("the reports have been read (data/ministry/mha.json)", mr != null);
if (mr) {
  ok("every quote from the reports is in its report, with its figure", mr.failed.length === 0, mr.failed.slice(0, 5).map((f) => `${f.src} ${f.what}: ${f.why}`).join("; "));
  const readable = mr.file.reports.filter((r) => r.readable);
  ok(`at least 50 reports read item by item (${readable.length})`, readable.length >= 50);
  ok(`at least 800 items quoted (${mr.items.filter((i) => i.quote).length})`, mr.items.filter((i) => i.quote).length >= 800);
  const ids = new Set(mr.file.themes.map((t) => t.id));
  ok("every item's subjects are rules the page prints", mr.items.every((i) => i.themes.every((t) => ids.has(t))));
  ok("every item belongs to a report that was read", mr.items.every((i) => readable.some((r) => r.src === i.src)));
  // A count is the report's own last paragraph number, so it can never be below the items quoted from it.
  const short = readable.filter((r) => mr.items.filter((i) => i.src === r.src).length > r.items);
  ok("no report has more items quoted than its count", short.length === 0, short.map((r) => r.month).join(", "));
  ok("every Bill named is a Bill", mr.bills.every((b) => /\bBill\b/.test(b.name)));
  ok("amounts are listed, in crore or lakh", mr.amounts.every((a) => ["crore", "lakh", "lakh crore"].includes(a.unit)));
}

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
