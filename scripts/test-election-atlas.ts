/**
 * The election atlas publishes three files that must agree with themselves:
 * who governs each state, SIR deletions by reason, and (when the connector has
 * run) results seat by seat. These checks fail the build if a state falls off
 * the map, a SIR figure loses its citation, or the reasons given for a set of
 * deletions stop adding up to the total they are said to explain.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ATLAS_STATES, atlasState, reasonGap, type GovernsFile, type SirFile } from "../lib/elections-atlas-shared";
import { parseGoverns, validateGoverns, WITH_LEGISLATURE } from "./etl/connectors/governs";
import { parseCardPage, parseHead, parsePartyPage, parseTablePage } from "./etl/connectors/eci-results";
import { readdirSync } from "node:fs";
import type { StateResult } from "../lib/elections-atlas-shared";

let failed = 0;
function ok(name: string, cond: boolean, detail = ""): void {
  if (!cond) failed++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  " + detail}`);
}
const read = <T,>(p: string): T => JSON.parse(readFileSync(join(process.cwd(), p), "utf8")) as T;

console.log("\nWho governs");
const gov = read<GovernsFile>("data/elections/governs.json");
ok(`${WITH_LEGISLATURE} governments`, gov.states.length === WITH_LEGISLATURE, `got ${gov.states.length}`);
ok("the file passes its own connector's validation", validateGoverns(gov.states).length === 0, validateGoverns(gov.states).join("; "));
ok("source is a https URL", gov.source.url.startsWith("https://"));
const unknown = gov.states.filter((s) => !atlasState(s.state)).map((s) => s.state);
ok("every governed state resolves to a polygon", unknown.length === 0, unknown.join(", "));
ok("every state with a legislature has a government", ATLAS_STATES.filter((s) => s.legislature).every((s) => gov.states.some((g) => atlasState(g.state)?.slug === s.slug)),
  ATLAS_STATES.filter((s) => s.legislature && !gov.states.some((g) => atlasState(g.state)?.slug === s.slug)).map((s) => s.name).join(", "));
ok("no UT without a legislature is given a chief minister", !gov.states.some((g) => atlasState(g.state)?.legislature === false));
ok("alliances are one of NDA / INDIA / Other / None", gov.states.every((s) => ["NDA", "INDIA", "Other", "None"].includes(s.alliance)));

// The party cell on the source page is a template whose tail spills into the
// next cell; that once shifted every alliance one column right.
const sample = join(process.cwd(), "data/live/election-atlas-samples/wiki-Chief-minister-India-.txt");
if (existsSync(sample)) {
  const parsed = parseGoverns(readFileSync(sample, "utf8"));
  const ap = parsed.find((s) => s.state === "Andhra Pradesh");
  ok("the committed sample parses to 31 governments", parsed.length === WITH_LEGISLATURE, `got ${parsed.length}`);
  ok("a template-spilled party cell keeps its alliance (Andhra Pradesh: TDP, NDA)", ap?.party === "TDP" && ap.alliance === "NDA", JSON.stringify(ap));
  ok("Keralam is spelled as the map spells it", parsed.some((s) => s.state === "Kerala"));
}

console.log("\nSIR");
const sir = read<SirFile>("data/elections/sir.json");
const cited = new Set<string>();
for (const st of sir.states) {
  ok(`${st.state} resolves to a polygon`, !!atlasState(st.state));
  ok(`${st.state} is in a declared phase`, sir.phases.some((p) => p.id === st.phase));
  for (const [label, stage] of Object.entries({ before: st.before, draft: st.draft, final: st.final })) {
    if (!stage) continue;
    ok(`${st.state} ${label} cites a source`, stage.sources.length > 0);
    for (const s of stage.sources) { cited.add(s); ok(`${st.state} ${label}: source "${s}" exists`, !!sir.sources[s]); }
    for (const [r, v] of Object.entries(stage.reasons ?? {})) {
      ok(`${st.state} ${label}: reason "${r}" is declared`, sir.reasons.some((x) => x.id === r));
      ok(`${st.state} ${label}: ${r} is a positive count`, typeof v === "number" && v > 0);
    }
    // Reasons may fall short of the total (the remainder is shown as "not
    // attributed"), but they may not exceed it by more than rounding.
    const gap = reasonGap(stage);
    if (gap) {
      const tol = Math.max(1_100, stage.leftOut! * 0.001);
      ok(`${st.state} ${label}: reasons do not exceed the left-out total`, gap.unattributed >= -tol, `over by ${-gap.unattributed}`);
      ok(`${st.state} ${label}: reasons explain at least 95% of the left-out total`, gap.attributed >= stage.leftOut! * 0.95, `${gap.attributed} of ${stage.leftOut}`);
    }
    if (stage.leftOut != null && st.before?.electors) ok(`${st.state} ${label}: left out is under 30% of the roll`, stage.leftOut < st.before.electors * 0.3);
  }
}
for (const p of sir.phases) for (const s of p.sources) { cited.add(s); ok(`phase ${p.id}: source "${s}" exists`, !!sir.sources[s]); }
for (const [k, s] of Object.entries(sir.sources)) ok(`source ${k} is https`, s.url.startsWith("https://"));
const orphans = Object.keys(sir.sources).filter((k) => !cited.has(k));
ok("every declared SIR source is cited somewhere", orphans.length === 0, orphans.join(", "));
ok("SIR accessed date is ISO", /^\d{4}-\d{2}-\d{2}$/.test(sir.accessed));

console.log("\nECI result pages (archived samples)");
const S = join(process.cwd(), "data/live/election-atlas-samples");
const sample2 = (f: string) => readFileSync(join(S, f), "utf8");
if (existsSync(join(S, "wayback-ResultAcGenMay2026-ConstituencywiseS2210.htm"))) {
  const h = sample2("wayback-ResultAcGenMay2026-ConstituencywiseS2210.htm");
  const head = parseHead(h), t = parseTablePage(h);
  ok("constituency number and name read from the heading", head?.no === 10 && head.name === "THIRUVOTTIYUR" && head.stateName === "Tamil Nadu", JSON.stringify(head));
  ok("EVM rounds read (26 of 26)", head?.rounds?.[0] === 26 && head.rounds[1] === 26);
  ok("all 16 rows read, NOTA included", t?.candidates.length === 16 && t.candidates.some((c) => c.party === "None of the Above"));
  ok("the table reconciles with ECI's printed total", t?.total === 207088 && !t.problem, t?.problem);
  // Tamper with one row: the arithmetic check must catch it.
  const bad = parseTablePage(h.replace("<td align='right'>110067</td>", "<td align='right'>110068</td>"));
  ok("a single-vote discrepancy is caught", !!bad?.problem);
  const cards = parseCardPage(sample2("wayback-ResultAcGenMay2026-candidateswise-S2210.htm"));
  ok("the card page names the same winner as the table", cards?.declared === true && [...cards.candidates].sort((a, b) => b.votes - a.votes)[0]?.name === [...t!.candidates].sort((a, b) => b.votes - a.votes)[0]?.name);
  const pc = parseHead(sample2("wayback-PcResultGenJune2024-ConstituencywiseS041.htm"));
  ok("Lok Sabha pages carry an update stamp instead of rounds", pc?.updated === "2024-06-05" && !pc.rounds, JSON.stringify(pc));
  const party = parsePartyPage(sample2("wayback-ResultAcGenMay2026-partywiseresult-S22.htm"));
  ok("party page: house size and full tally", party?.seats === 234 && party.tally.reduce((a, b) => a + b.won, 0) === 234);
  const older = parsePartyPage(sample2("wayback-AcResultGen2ndJune2024-partywiseresult-S21.htm"));
  ok("older party page: house size from the footer", older?.seats === 32);
  // The 2022–23 template: the same columns inside layout tables, the seat
  // named "State-Name -N", the total as a body row rather than a footer.
  if (existsSync(join(S, "wayback-ResultAcGenMay2023-ConstituencywiseS101.htm"))) {
    const k = sample2("wayback-ResultAcGenMay2023-ConstituencywiseS101.htm");
    const kh = parseHead(k, 1), kt = parseTablePage(k);
    ok("2023 template: seat, state and month read", kh?.no === 1 && kh.name === "Nippani" && kh.stateName === "Karnataka" && /MAY-2023/i.test(kh.title), JSON.stringify(kh));
    ok("2023 template: table reconciles with its Total row", kt?.total === 187412 && !kt.problem && kt.candidates.length === 11, kt?.problem);
    const kp = parsePartyPage(sample2("wayback-ResultAcGenMay2023-partywiseresult-S10.htm?st=S10%0A%0A%0AKarnataka"));
    ok("2023 party page: 224 seats, tally sums to the house", kp?.seats === 224 && kp.tally.reduce((a, b) => a + b.won, 0) === 224);
  }
  if (existsSync(join(S, "wayback-ResultAcGenMar2022-ConstituencywiseS051.htm?ac=1"))) {
    const g = parseHead(sample2("wayback-ResultAcGenMar2022-ConstituencywiseS051.htm?ac=1"), 1);
    ok("2022 template ('GEN ELECTION', no seat number in the caption): seat number from the URL", g?.no === 1 && g.name === "Mandrem" && g.stateName === "Goa", JSON.stringify(g));
  }
}

console.log("\nResults on disk");
const RES = join(process.cwd(), "data/elections/results");
if (existsSync(RES)) {
  for (const folder of readdirSync(RES, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const f of readdirSync(join(RES, folder.name)).filter((f) => f.endsWith(".json"))) {
      const r = JSON.parse(readFileSync(join(RES, folder.name, f), "utf8")) as StateResult;
      const tag = `${folder.name}/${f}`;
      ok(`${tag}: state code resolves`, ATLAS_STATES.some((s) => s.eci === r.state));
      ok(`${tag}: never more seats than the house`, !r.expectedSeats || r.seats.length <= r.expectedSeats, `${r.seats.length} > ${r.expectedSeats}`);
      ok(`${tag}: seat numbers unique`, new Set(r.seats.map((s) => s.no)).size === r.seats.length);
      ok(`${tag}: no seat names a winner from a page of zeros`, r.seats.every((s) => s.status === "uncontested" || s.candidates.some((c) => c.votes > 0)), r.seats.filter((s) => s.status !== "uncontested" && !s.candidates.some((c) => c.votes > 0)).map((s) => `${s.no} ${s.name}`).join(", "));
      ok(`${tag}: every seat links its archived ECI page`, r.seats.every((s) => s.url.startsWith("https://web.archive.org/web/") && s.url.includes("results.eci.gov.in")));
      ok(`${tag}: every seat has candidates with whole-number votes`, r.seats.every((s) => s.candidates.length >= 1 && s.candidates.every((c) => Number.isInteger(c.votes) && c.votes >= 0)));
    }
  }
}

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
