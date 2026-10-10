/**
 * The protest record keeps its claims attributed and its voices apart, and the
 * coverage wire holds only headlines that name the protest.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isAboutProtest, mergeWire } from "./etl/connectors/delhi-protest-news";
import type { ProtestRecord, ProtestWire, Voice, WireItem } from "../lib/protest-shared";

let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) failures++;
  console.log(`  ${ok ? "pass" : "FAIL"}  ${name}${ok || !detail ? "" : `\n        ${detail}`}`);
}

const ROOT = process.cwd();
const rec = JSON.parse(readFileSync(join(ROOT, "data", "protests", "delhi-2026-10-10.json"), "utf8")) as ProtestRecord;

console.log("Every claim is attributed to a source that exists");
const ids = new Set(Object.keys(rec.sources));
const refs = [
  ...rec.places.flatMap((p) => p.sources.map((s) => [`place ${p.id}`, s])),
  ...rec.counts.flatMap((c) => c.sources.map((s) => [`count ${c.label}`, s])),
  ...rec.restrictions.flatMap((r) => r.sources.map((s) => [`restriction ${r.id}`, s])),
  ...rec.accounts.flatMap((a) => a.sources.map((s) => [`account by ${a.who}`, s])),
  ...rec.timeline.flatMap((t) => t.sources.map((s) => [`timeline ${t.date}`, s])),
];
const dangling = refs.filter(([, s]) => !ids.has(s!)).map(([w, s]) => `${w}: ${s}`);
check("every source id cited is in the source list", dangling.length === 0, dangling.join("\n        "));
const unused = [...ids].filter((id) => !refs.some(([, s]) => s === id));
check("every listed source is cited somewhere", unused.length === 0, unused.join(", "));
check("every source has a publisher, a title and an https URL",
  Object.values(rec.sources).every((s) => s.publisher.trim() && s.title.trim() && /^https:\/\/\S+$/.test(s.url)));
check("nothing in the record lacks a source", [...rec.places, ...rec.counts, ...rec.restrictions, ...rec.accounts, ...rec.timeline].every((x) => x.sources.length > 0));
check("the accessed date is ISO", /^\d{4}-\d{2}-\d{2}$/.test(rec.accessed));

console.log("\nThe voices are kept apart, and all of them are heard");
const VOICES: Voice[] = ["police", "government", "organisers", "opposition", "rights"];
check("every account has a known voice", rec.accounts.every((a) => VOICES.includes(a.voice)));
for (const v of VOICES) check(`at least one account from: ${v}`, rec.accounts.some((a) => a.voice === v));
check("the police's own stated reasons are recorded (at least three)", rec.accounts.filter((a) => a.voice === "police").length >= 3);
check("every account names who made it", rec.accounts.every((a) => a.who.trim().length > 2));

console.log("\nNumbers are reported as somebody's number");
check("every count says whose it is", rec.counts.every((c) => c.who.trim().length > 0));
const official = rec.counts.some((c) => /delhi police|police said/i.test(c.who));
check("absent an official count, the record says so", official || rec.noOfficialCount.trim().length > 0);
check("the organisers' count is marked as a claim", rec.counts.filter((c) => /janta party/i.test(c.who)).every((c) => /claim/i.test(c.who)));
check("an unverified accusation is marked as one", rec.accounts.filter((a) => /arson|violence/i.test(a.text)).every((a) => /claim, not a finding/i.test(a.text)));

console.log("\nPlaces are where Delhi is");
check("every place is inside the National Capital Territory's bounding box",
  rec.places.every((p) => p.lon > 76.8 && p.lon < 77.4 && p.lat > 28.4 && p.lat < 28.9),
  rec.places.filter((p) => !(p.lon > 76.8 && p.lon < 77.4 && p.lat > 28.4 && p.lat < 28.9)).map((p) => p.id).join(", "));
check("place ids are unique", new Set(rec.places.map((p) => p.id)).size === rec.places.length);
check("the shutdown radius is the 4 km reported", rec.places.find((p) => p.kind === "restriction")?.radiusKm === 4);

console.log("\nThe wire holds headlines about the protest, once each");
check("a headline naming the party is kept", isAboutProtest("Delhi Police detain Cockroach Janta Party founder at airport"));
check("a headline naming Jantar Mantar is kept", isAboutProtest("Internet suspended around Jantar Mantar"));
check("an unrelated Delhi police headline is not", !isAboutProtest("Delhi Police bust drug racket in Rohini"));
check("'CJP' inside another word does not match", !isAboutProtest("ACJPL quarterly results"));
const a: WireItem = { title: "Police detain CJP leaders", publisher: "The Hindu", url: "https://x/1", publishedAt: "2026-10-10T08:00:00.000Z", queries: ["q1"] };
const b: WireItem = { ...a, url: "https://x/2", publishedAt: "2026-10-10T07:00:00.000Z", queries: ["q2"] };
const c: WireItem = { ...a, title: "Internet shut near Jantar Mantar", publishedAt: "2026-10-10T09:00:00.000Z" };
const m = mergeWire([a], [b, c]);
check("the same headline from the same outlet is kept once", m.length === 2, JSON.stringify(m.map((x) => x.title)));
check("its queries are combined", m.find((x) => x.title === a.title)?.queries.length === 2);
check("it keeps the earliest time seen", m.find((x) => x.title === a.title)?.publishedAt === b.publishedAt);
check("newest first", m[0]?.title === c.title);

const wireFile = join(ROOT, "data", "protests", "delhi-2026-10-10-news.json");
if (existsSync(wireFile)) {
  const w = JSON.parse(readFileSync(wireFile, "utf8")) as ProtestWire;
  check("every item on the wire names the protest", w.items.every((i) => isAboutProtest(i.title)), w.items.filter((i) => !isAboutProtest(i.title)).slice(0, 3).map((i) => i.title).join(" | "));
  check("every item names its own publisher", w.items.every((i) => i.publisher.trim().length > 0 && !/google news/i.test(i.publisher)));
  check("items carry headlines only, never article text", w.items.every((i) => Object.keys(i).every((k) => ["title", "publisher", "url", "publishedAt", "queries"].includes(k))));
  check("newest first", w.items.every((i, n) => n === 0 || w.items[n - 1]!.publishedAt >= i.publishedAt));
  check("the queries asked are published with their yields", w.queries.length > 0);
} else {
  console.log("  (no wire yet: the first scheduled run writes it)");
}

console.log("\nThe page shows only what the record holds");
const page = readFileSync(join(ROOT, "app", "protests", "delhi-2026-10-10", "page.tsx"), "utf8");
check("the page does not write its own verdict on the police operation", !/saved democracy|brave(ly)?|heroic|crackdown on democracy/i.test(page.replace(/\/\*[\s\S]*?\*\//g, "")));

console.log(`\n${failures === 0 ? "All passed." : `${failures} failed.`}`);
process.exit(failures === 0 ? 0 : 1);
