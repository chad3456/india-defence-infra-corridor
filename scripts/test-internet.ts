/**
 * The internet essay's parsers, and the committed data they produced.
 *
 * The parsers are pinned with small inputs whose answers are known. The data
 * checks are ranges, not values: they catch a sheet whose columns moved (a GNI
 * share read as a dollar price), a unit slip (kbps published as Mbps), or a
 * source that quietly returned nothing — the ways this page could be
 * confidently wrong without anything crashing.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { countryOfLanding, csvFields, readPlans, readSatcat } from "./etl/connectors/internet";
import { simplify } from "./geo/build-world";
import type { CuratedInternet, InternetData, Speeds } from "../lib/internet-shared";

let bad = 0;
function ok(name: string, cond: boolean, detail = ""): void {
  if (!cond) bad++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  " + detail}`);
}
const read = <T>(p: string): T | null => (existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : null);

console.log("\nparsers");
{
  ok("CSV honours quotes", JSON.stringify(csvFields('a,"b, c",d')) === JSON.stringify(["a", "b, c", "d"]));
  const csv = [
    "OBJECT_NAME,OBJECT_ID,NORAD_CAT_ID,OBJECT_TYPE,OPS_STATUS_CODE,OWNER,LAUNCH_DATE,LAUNCH_SITE,DECAY_DATE",
    "STARLINK-1007,2019-074A,44713,PAY,+,US,2019-11-11,AFETR,\r",
    "STARLINK-1008,2019-074B,44714,PAY,D,US,2019-11-11,AFETR,2023-02-01\r",
    "STARLINK-30000,2024-001A,58000,PAY,-,US,2024-01-03,AFETR,\r",
    "FALCON 9 R/B,2019-074E,44717,R/B,D,US,2019-11-11,AFETR,2019-11-20\r",
    '"GSAT-7, RUKMINI",2013-044A,39234,PAY,+,IND,2013-08-29,FRGUI,\r',
    "ONEWEB-0012,2019-010A,44057,PAY,+,UK,2019-02-27,FRGUI,\r",
  ].join("\n");
  const s = readSatcat(csv);
  const st = s.constellations.Starlink!;
  ok("SATCAT: three Starlinks launched", st.launched === 3, String(st.launched));
  ok("SATCAT: one decayed, two in orbit", st.decayed === 1 && st.inOrbit === 2);
  ok("SATCAT: a non-operational satellite is not active", st.active === 1, String(st.active));
  ok("SATCAT: rocket bodies are not payloads", s.activePayloads === 3, String(s.activePayloads));
  ok("SATCAT: a quoted name keeps its owner column", s.activeByOwner.IND === 1, JSON.stringify(s.activeByOwner));
  ok("SATCAT: launches by year", st.launchedByYear["2019"] === 2 && st.launchedByYear["2024"] === 1);
  ok("landing country is the last comma part", countryOfLanding("Chennai, Tamil Nadu, India") === "India");
  ok("a country name with its own comma survives", countryOfLanding("Muanda, Congo, Dem. Rep.") === "Congo, Dem. Rep.");
  const sheet = {
    sheet: "MobileBB", header: [], yearRows: [], blocks: [],
    rows: [
      ["", "Data-only mobile-broadband basket (5GB), 2025"],
      ["Economy", "as % of GNI p.c.", "USD", "PPP$", "Operator", "Monthly data allowance (in GB) **", "Tax rate", "Technology"],
      ["India", "1.10", "2.10", "7.50", "Jio", "56.0", "18.0", "4G"],
      ["Freedonia", "3.00", "9.00", "", "Acme", "Unlimited", "0", "5G"],
    ],
  };
  const { title, plans } = readPlans(sheet, (e) => (e === "India" ? "IND" : null));
  ok("plans: title read from above the header", title.startsWith("Data-only"));
  ok("plans: USD and allowance in the right columns", plans[0]?.usd === 2.1 && plans[0]?.gb === 56 && plans[0]?.gniPct === 1.1);
  ok("plans: unlimited is not a number", plans[1]?.unlimited === true && plans[1]?.gb === null);
  ok("plans: unmatched names stay null", plans[1]?.iso3 === null);
  const ring = [[0, 0], [1, 0.001], [2, 0], [2, 2], [0, 2], [0, 0]];
  ok("simplify drops a near-collinear point", simplify(ring, 0.01).length === 5);
}

console.log("\ncurated figures");
const cur = read<CuratedInternet>(join(process.cwd(), "data", "internet", "curated.json"));
ok("curated file present", !!cur);
if (cur) {
  const cites = [
    ...cur.shutdowns.years.flatMap((y) => y.cite), ...cur.shutdowns.latest.cite,
    ...cur.starlinkSubscribers.flatMap((s) => s.cite), ...cur.cases.flatMap((c) => c.cite),
    ...cur.indiaConditions.granted.flatMap((g) => g.cite), ...cur.indiaConditions.conditions.flatMap((c) => c.cite),
  ];
  ok("every citation is an https URL with an access date", cites.every((c) => /^https:\/\//.test(c.url) && /^\d{4}-\d{2}-\d{2}$/.test(c.accessed) && c.publisher && c.title),
    JSON.stringify(cites.find((c) => !/^https:\/\//.test(c.url) || !/^\d{4}-\d{2}-\d{2}$/.test(c.accessed))));
  ok("every shutdown year, subscriber point and case is cited", [...cur.shutdowns.years, ...cur.starlinkSubscribers, ...cur.cases].every((x) => x.cite.length > 0));
  const ys = cur.shutdowns.years.map((y) => y.year);
  ok("shutdown years ascend without repeats", ys.every((y, i) => i === 0 || y > ys[i - 1]!));
  ok("India never exceeds the world", cur.shutdowns.years.every((y) => y.india === null || y.global === null || y.india <= y.global));
  const latest = cur.shutdowns.years.find((y) => y.year === cur.shutdowns.latest.year);
  ok("latest-year country counts sum below the global total", !!latest && cur.shutdowns.latest.byCountry.reduce((s, c) => s + c.count, 0) <= (latest.global ?? 0));
  const subs = cur.starlinkSubscribers;
  ok("subscriber claims ascend in date and never fall", subs.every((s, i) => i === 0 || (s.date > subs[i - 1]!.date && s.subscribers >= subs[i - 1]!.subscribers)));
  ok("case ids are unique", new Set(cur.cases.map((c) => c.id)).size === cur.cases.length);
  ok("every case names whose word it is", cur.cases.every((c) => c.claimant.trim().length > 0));
}

console.log("\nworld map");
const world = read<{ features: Array<{ properties: { iso3: string } }> }>(join(process.cwd(), "data", "geo", "world-ind.json"));
ok("world map present with 200+ countries", !!world && world.features.length >= 200, String(world?.features.length));
ok("India is on it", !!world?.features.some((f) => f.properties.iso3 === "IND"));

console.log("\nspeeds (Ookla)");
const sp = read<Speeds>(join(process.cwd(), "data", "internet", "speeds.json"));
if (!sp) console.log("  (not yet generated)");
else {
  for (const k of ["fixed", "mobile"] as const) {
    const c = Object.values(sp[k].countries);
    ok(`${k}: 100+ countries`, c.length >= 100, String(c.length));
    ok(`${k}: speeds are Mbps, not kbps`, c.every((v) => v.downMbps > 0 && v.downMbps < 3000 && v.upMbps >= 0 && v.upMbps < 3000), JSON.stringify(c.find((v) => !(v.downMbps > 0 && v.downMbps < 3000))));
    ok(`${k}: latencies are plausible`, c.every((v) => v.latencyMs > 0 && v.latencyMs < 1500));
    ok(`${k}: every country met the test floor`, c.every((v) => v.tests >= (sp.minTests[k] ?? 0)));
    ok(`${k}: India present`, !!sp[k].countries.IND);
  }
}

console.log("\nconnector output");
const d = read<InternetData>(join(process.cwd(), "data", "internet", "internet.json"));
if (!d) console.log("  (not yet generated)");
else {
  const users = d.worldBank?.indicators["IT.NET.USER.ZS"];
  ok("World Bank: internet users for 150+ economies", !!users && Object.keys(users.values).length >= 150, String(users && Object.keys(users.values).length));
  ok("World Bank: shares between 0 and 100", !!users && Object.values(users.values).every((s) => s.every(([, v]) => v >= 0 && v <= 100)));
  ok("World Bank: India has a recent value", !!users?.values.IND?.some(([y]) => y >= 2022));
  ok("World Bank: world aggregate present", !!users?.values.WLD?.length);
  const mob = d.itu?.mobile ?? [];
  ok("ITU: 150+ mobile plans", mob.length >= 150, String(mob.length));
  ok("ITU: most plan names matched to a code", mob.filter((p) => p.iso3).length >= mob.length * 0.9, `${mob.filter((p) => !p.iso3).map((p) => p.economy).join(", ")}`);
  ok("ITU: India's plan present", mob.some((p) => p.iso3 === "IND"));
  ok("ITU: % of GNI looks like a share, USD like a price", mob.every((p) => (p.gniPct === null || (p.gniPct >= 0 && p.gniPct < 200)) && (p.usd === null || (p.usd >= 0 && p.usd < 1000))));
  ok("ITU: basket history read", (d.itu?.baskets.length ?? 0) > 200, String(d.itu?.baskets.length));
  ok("PeeringDB: 500+ exchanges, India among them", (d.peeringdb?.total ?? 0) >= 500 && (d.peeringdb?.byCountry.IND ?? 0) > 0);
  ok("cables: 300+ cables, India lands some", (d.cables?.total ?? 0) >= 300 && (d.cables?.byCountry.IND?.landings ?? 0) > 0);
  const st = d.satcat?.constellations.Starlink;
  ok("SATCAT: Starlink active ≤ in orbit ≤ launched", !!st && st.active <= st.inOrbit && st.inOrbit <= st.launched && st.active > 1000, JSON.stringify(st && { a: st.active, o: st.inOrbit, l: st.launched }));
  ok("SATCAT: Starlink is fewer than all active payloads", !!st && !!d.satcat && st.active < d.satcat.activePayloads);
}

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
