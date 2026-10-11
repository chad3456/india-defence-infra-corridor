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

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
