/**
 * Protest Watch: the same rules for every cause. Protest detection keeps
 * protests and drops markets, motor rallies and military strikes; causes
 * classify in priority order; losses count only when a headline ties them to
 * the protest; places come from a city or country named, never from a cause;
 * events take the largest figure reported, not a sum; and the collector's
 * searches never name a cause.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CAUSES, EDITIONS, causeOf, eventsOf, isProtestHeadline, lossesOf, placeOf, summarise, type PwCountry, type PwHeadline, type PwRegister } from "../lib/protest-watch";

let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => { console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${!cond && detail ? `  ${detail}` : ""}`); if (!cond) failed++; };

console.log("Neutral collection");
const causeWords = /gaza|palestin|israel|hostage|climate|farmer|strike(?!s)|union|election|government/i;
ok("no search names a cause", EDITIONS.every((e) => !causeWords.test(e.q)), EDITIONS.filter((e) => causeWords.test(e.q)).map((e) => e.id).join(", "));
ok("two dozen editions in at least ten languages", EDITIONS.length >= 24 && new Set(EDITIONS.map((e) => e.hl.slice(0, 2))).size >= 10);

console.log("\nWhat counts as a protest");
const yes = ["Pro-Palestinian rally in London after 30 killed in Gaza airstrike", "Bus drivers strike in Kerala", "Thousands march against antisemitism in Paris", "Farmers protest in Delhi", "Manifestation contre Israël à Lyon", "Hunger strike enters day 10", "किसानों का धरना जारी"];
const no = ["Israeli airstrike kills 12 in Gaza", "Sensex rallies 500 points", "Rupee rallies against dollar", "Drone strike hits convoy", "Dakar Rally stage 5 results"];
ok("protests kept", yes.every(isProtestHeadline), yes.filter((t) => !isProtestHeadline(t)).join(" | "));
ok("non-protests dropped", no.every((t) => !isProtestHeadline(t)), no.filter(isProtestHeadline).join(" | "));

console.log("\nCauses, by the same rules");
ok("pro-Israel and hostage rallies are not filed as Palestine", causeOf("Rally in Tel Aviv demands hostages' release") === "israel" && causeOf("March against antisemitism in London") === "israel");
ok("Gaza and Palestine protests", causeOf("Pro-Palestinian protesters block road in Sydney") === "palestine" && causeOf("Manifestation contre Israël à Lyon") === "palestine");
ok("others", causeOf("Farmers protest MSP in Delhi") === "farmers" && causeOf("Workers strike over pension cuts in Paris") === "labour" && causeOf("Climate activists block motorway") === "climate");
ok("every cause has a distinct id", new Set(CAUSES.map((c) => c.id)).size === CAUSES.length);

console.log("\nLosses tied to the protest only");
ok("a war toll named as the reason is not a protest death", lossesOf("Pro-Palestinian rally in London after 30 killed in Gaza airstrike").deaths === null && lossesOf("Protests over 12 killed in police raid").deaths === null);
ok("protest deaths, injuries and arrests are read", lossesOf("3 protesters killed as police open fire in Dhaka").deaths === 3 && lossesOf("15 injured in clashes with police").injured === 15 && lossesOf("Police arrest 120 protesters at encampment").arrested === 120);
ok("French arrests are read", lossesOf("Lyon : 12 interpellations après la manifestation").arrested === 12);
ok("words are not numbers", lossesOf("Dozens arrested at rally").arrested === null);
ok("damage and clashes flagged", lossesOf("Protesters torch buses in Nairobi").damage && lossesOf("Police fire tear gas at marchers").clashes);

console.log("\nPlaces");
const C: PwCountry[] = [{ iso2: "FR", name: "France", names: ["France"], x: 0, y: 0 }, { iso2: "IL", name: "Israel", names: ["Israel"], x: 0, y: 0 }, { iso2: "IN", name: "India", names: ["India", "Kerala"], x: 0, y: 0 }];
ok("a city places a protest", placeOf("Rally in Lyon", C, "other") === "FR");
ok("Israel named as a cause does not place a protest in Israel", placeOf("Protest against Israel draws thousands", C, "palestine") === null);
ok("an Indian state places in India", placeOf("Bus drivers strike in Kerala", C, "labour") === "IN");
ok("unplaceable stays unplaced", placeOf("Protesters rally outside the courthouse", C, "other") === null);

console.log("\nEvents");
const now = "2026-10-27T12:00:00Z";
const hs: PwHeadline[] = [
  { t: "Police arrest 40 protesters in Paris", o: "A", u: "u1", p: now, l: "en", e: "en-GB" },
  { t: "Paris protest: 55 arrested, officials say", o: "B", u: "u2", p: now, l: "en", e: "en-US" },
  { t: "Protest in Paris turns violent", o: "C", u: "u3", p: now, l: "en", e: "en-IN" },
];
const ev = eventsOf(hs, C, "2026-10-26T00:00:00Z");
ok("headlines about one cause, place and day form one event", ev.length === 1 && ev[0]!.headlines.length === 3);
ok("an event's arrests are the largest reported, not the sum", ev[0]!.losses.arrested === 55);
const s = summarise(hs, C, 48, Date.parse(now));
ok("summary counts the event and its country", s.totals.events === 1 && s.totals.countries === 1);

const f = join(process.cwd(), "data", "protest-watch", "register.json");
if (existsSync(f)) {
  console.log("\nThe register");
  const r = JSON.parse(readFileSync(f, "utf8")) as PwRegister;
  ok("every stored headline passes the protest test", r.headlines.every((h) => isProtestHeadline(h.t)));
  ok("at most 5,000 headlines, none older than eight days", r.headlines.length <= 5000 && r.headlines.every((h) => !h.p || h.p >= new Date(Date.parse(r.updatedAt) - 8 * 86_400_000).toISOString()));
}

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
