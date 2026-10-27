/**
 * Free Palestine, Inc.?: every figure and verdict cites a source that exists,
 * one side's claims are labelled as such, verdicts that assert something carry
 * evidence, and the shares the essay shows are computed correctly.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VERDICTS, derive, type FpPublished } from "../lib/free-palestine";

let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => { console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${!cond && detail ? `  ${detail}` : ""}`); if (!cond) failed++; };
const d = JSON.parse(readFileSync(join(process.cwd(), "data", "free-palestine", "published.json"), "utf8")) as FpPublished;
const ids = new Set(d.sources.map((s) => s.id));
const kind = (id: string) => d.sources.find((s) => s.id === id)!.kind;

console.log("Sources");
ok("source ids are unique", ids.size === d.sources.length);
ok("every source has an https address, an access date and a tier", d.sources.every((s) => /^https:\/\//.test(s.url) && /^\d{4}-\d{2}-\d{2}$/.test(s.accessed) && [1, 2, 3].includes(s.tier)));
const cited = [...d.ledger.map((x) => x.source), d.attention.platformsSource, d.attention.usTiktok.source, ...d.attention.rafah.sources, d.attention.search.source,
  d.merch.keffiyeh.source, d.merch.hirbawi.source, d.merch.hirbawi.quoteSource, d.merch.india.source, ...d.money.map((x) => x.source), ...d.protest.us.map((x) => x.source),
  d.protest.offCampus.source, ...d.protest.abroad.flatMap((x) => x.sources), ...d.aid.map((x) => x.source), d.election.source, ...d.claims.flatMap((x) => x.sources)];
ok("every citation resolves", cited.every((c) => ids.has(c)), cited.filter((c) => !ids.has(c)).join(", "));
ok("every source is cited", d.sources.every((s) => cited.includes(s.id)));

console.log("\nClaims");
ok("21 claims, each with a known verdict", d.claims.length === 21 && d.claims.every((c) => c.verdict in VERDICTS));
ok("a verdict that asserts something cites a source", d.claims.filter((c) => !["unverified", "removed"].includes(c.verdict)).every((c) => c.sources.length > 0));
ok("a claim resting only on a party to the conflict is 'one side's claim', never 'supported'", d.claims.filter((c) => c.sources.length && c.sources.every((s) => kind(s) === "government-claim")).every((c) => c.verdict === "claimed"));
ok("no claim marked removed carries a source", d.claims.filter((c) => c.verdict === "removed").every((c) => c.sources.length === 0));
ok("money figures from a party to the conflict say so", d.money.filter((m) => kind(m.source) === "government-claim").every((m) => m.basis === "government claim"));

console.log("\nDerived");
const x = derive(d);
ok("peaceful share = 1 − damage share", Math.abs(x.peacefulShare + x.damageShare - 1) < 1e-9);
ok("damage share is 167 of 12,400", Math.abs(x.damageShare - 167 / 12400) < 1e-9);
ok("UNRWA USA's expected 2024 is 0.07% of $71.5bn", Math.abs(x.unrwaShareOfRebuild - 51e6 / 71.5e9) < 1e-12 && x.unrwaShareOfRebuild < 0.001);
ok("hashtag ratios are pro ÷ con", x.proConRatio.every((r, i) => Math.abs(r.ratio - d.attention.platforms[i]!.pro / d.attention.platforms[i]!.con) < 1e-9));

console.log("\nWhat the page must not do");
const raw = readFileSync(join(process.cwd(), "data", "free-palestine", "published.json"), "utf8");
ok("no slur or profanity from the source essay", !/\bbitch/i.test(raw));
ok("the antisemitic trope appears only as the removed claim", (raw.match(/Jewish-controlled/g) ?? []).length === 1);

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
