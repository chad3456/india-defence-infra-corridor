/**
 * India on Breakneck's metrics: every India figure names its source, every
 * book figure it is set against is a verified figure, and every World Bank
 * series it reads exists.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadIndiaBreakneck, wdi } from "../lib/india-breakneck";
import type { BreakneckBook } from "../lib/breakneck-shared";

let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) failures++;
  console.log(`  ${ok ? "pass" : "FAIL"}  ${name}${ok || !detail ? "" : `\n        ${detail}`}`);
}

const data = loadIndiaBreakneck();
const book = JSON.parse(readFileSync(join(process.cwd(), "data", "global", "breakneck-book.json"), "utf8")) as BreakneckBook;
const known = new Set(book.figures.map((f) => f.id));

console.log("Every India figure is cited");
check("accessed is an ISO date", /^\d{4}-\d{2}-\d{2}$/.test(data.accessed));
const all = [...data.metrics, ...data.electronics];
check("ids are unique", new Set(all.map((m) => m.id)).size === all.length);
const noSrc = all.filter((m) => m.sources.length === 0).map((m) => m.id);
check("every metric has a source", noSrc.length === 0, noSrc.join(", "));
const badUrl = all.flatMap((m) => m.sources).filter((s) => !/^https:\/\/[^\s]+$/.test(s.url) || !s.publisher.trim() || !s.title.trim());
check("every source has a publisher, a title and an https URL", badUrl.length === 0, badUrl.map((s) => s.url).join(", "));
const badSrc = all.flatMap((m) => m.india.filter((v) => !m.sources[v.src]).map((v) => `${m.id}: ${v.label}`));
check("every value points at one of its metric's sources", badSrc.length === 0, badSrc.join("\n        "));
const unused = all.flatMap((m) => m.sources.filter((_, i) => !m.india.some((v) => v.src === i)).map((s) => `${m.id}: ${s.url}`));
check("every source is used by a value", unused.length === 0, unused.join("\n        "));
const badVal = all.flatMap((m) => m.india.filter((v) => !Number.isFinite(v.value) || !v.unit.trim() || !v.label.trim()).map((v) => `${m.id}: ${v.label}`));
check("every value is a number with a unit and a label", badVal.length === 0, badVal.join(", "));
check("every metric explains itself", all.every((m) => m.note.trim().length > 20));

console.log("\nEvery comparison is against something real");
check("comparability is direct, approximate or context", data.metrics.every((m) => ["direct", "approximate", "context"].includes(m.comparable)));
const badBook = [...data.metrics, ...data.wdi].flatMap((m) => m.book.filter((id) => !known.has(id)).map((id) => `${"id" in m ? m.id : m.series}: ${id}`));
check("every book id is a verified Breakneck figure", badBook.length === 0, badBook.join(", "));
check("every metric sets India against at least one book figure", data.metrics.every((m) => m.book.length > 0));
const badWdi: string[] = [];
for (const w of data.wdi) {
  try {
    const v = wdi(w.series);
    if (!v.india) badWdi.push(`${w.series}: no India reading`);
    if (!v.peers.some((p) => p.iso3 === "CHN")) badWdi.push(`${w.series}: no China reading`);
  } catch (e) { badWdi.push(String(e)); }
}
check("every World Bank series exists with India and China readings", badWdi.length === 0, badWdi.join("\n        "));
for (const m of data.metrics.filter((x) => x.perCapita)) {
  try { wdi(m.perCapita!.series); check(`${m.id}: per-head population series exists`, true); }
  catch { check(`${m.id}: per-head population series exists`, false, m.perCapita!.series); }
}

console.log("\nThe honest gaps are kept");
const hsr = data.metrics.find((m) => m.id === "hsr");
check("high-speed rail in operation is recorded as zero", hsr?.india.some((v) => v.value === 0 && v.unit === "km") ?? false);
check("at least one comparison is marked as a different measure", data.metrics.some((m) => m.comparable === "context"));

console.log("\nThe page asks only for metrics that exist");
const page = readFileSync(join(process.cwd(), "app", "breakneck", "india", "page.tsx"), "utf8");
const asked = [...new Set([...page.matchAll(/M\("([a-z0-9-]+)"\)/g)].map((x) => x[1]!))];
const ids = new Set(all.map((m) => m.id));
check(`all ${asked.length} metric ids the page uses exist`, asked.length > 0 && asked.every((id) => ids.has(id)), asked.filter((id) => !ids.has(id)).join(", "));

console.log(`\n${failures === 0 ? "All passed." : `${failures} failed.`}`);
process.exit(failures === 0 ? 0 : 1);
