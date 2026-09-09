/**
 * The arsenal tracker's catalogue and ledger, checked before they ship.
 *
 * The connector's own self-checks gate the ingest in CI. These check the file
 * as committed, so a bad file cannot reach the page even if it was written by
 * an older version of the connector — which is exactly what happened when a
 * carried-forward event outlived the filter added to remove it.
 */
import { readFileSync } from "node:fs";

let bad = 0;
function ok(name: string, cond: boolean, detail = ""): void {
  if (!cond) bad++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  " + detail}`);
}

interface Sys { name: string; key: string; kind: string; country: string | null }
interface Ev { id: string; kind: string; systems: string[]; countries: string[]; headline: string; outlet: string }
interface Grp { verdict: string; outlets: string[]; events: Ev[] }
const a = JSON.parse(readFileSync("data/global/arsenal.json", "utf8")) as {
  gazetteer: Sys[]; events: Ev[]; groups: Grp[];
  spine: Record<string, Array<{ iso3: string; year: number; value: number }>>;
  gap: string; note: string;
};

console.log("\nThe catalogue");
ok("carries at least 200 systems", a.gazetteer.length >= 200, String(a.gazetteer.length));
{
  // Wiki markup that reached the catalogue once already, as a missile called
  // "thumb|PDV Mk-2 Anti-satellite/ballistic missile".
  const markup = a.gazetteer.filter((g) => /\b(thumb|file:|image:|\d+px)\b/i.test(g.name));
  ok("no entry is wiki markup", markup.length === 0, markup.slice(0, 3).map((m) => m.name).join(" / "));

  const dupes = a.gazetteer.length - new Set(a.gazetteer.map((g) => g.key)).size;
  ok("no system is listed twice", dupes === 0, String(dupes));

  // The five fake nations the first build invented, by name, so this test
  // fails loudly if the heading-depth fix is ever undone.
  const fakes = ["designation systems", "World War", "NATO reporting", "Other", "/"];
  const bogus = [...new Set(a.gazetteer.map((g) => g.country).filter(Boolean))]
    .filter((c) => fakes.some((f) => c === f || c!.includes(f)));
  ok("no country string is a section heading", bogus.length === 0, bogus.join(" / "));

  const countries = new Set(a.gazetteer.map((g) => g.country).filter(Boolean));
  ok("covers at least fifteen nations", countries.size >= 15, String(countries.size));
  // Four nations from four different source lists. If heading or column
  // resolution drifts, at least one drops out.
  for (const c of ["India", "United States", "Russia", "China"]) {
    ok(`${c} is in the catalogue`, [...countries].some((x) => x === c));
  }
}

console.log("\nThe ledger");
{
  const unplaced = a.events.filter((e) => e.systems.length === 0 && e.countries.length === 0);
  ok("every event names a country or a system", unplaced.length === 0, String(unplaced.length));

  ok("no event is a negotiation rather than a deal",
    a.events.every((e) => ["order", "delivery", "test"].includes(e.kind)),
    [...new Set(a.events.map((e) => e.kind))].join(", "));

  // Arms-control diplomacy survived one run by being carried forward past the
  // filter written to drop it.
  const policy = a.events.filter((e) =>
    /\b(treaty|arms control|disarmament|non-?proliferation|united nations|diplomats say|doubts over)/i.test(e.headline));
  ok("no arms-control story is filed as procurement", policy.length === 0,
    policy.slice(0, 2).map((p) => p.headline.slice(0, 50)).join(" | "));

  const overclaimed = a.groups.filter((g) => g.verdict === "corroborated by independent outlets" && g.outlets.length < 2);
  ok("nothing claims corroboration from one outlet", overclaimed.length === 0, String(overclaimed.length));
}

console.log("\nThe spine");
{
  const milex = a.spine["milex"] ?? [];
  ok("military spending covers 100+ countries",
    new Set(milex.map((r) => r.iso3)).size >= 100, String(new Set(milex.map((r) => r.iso3)).size));
  const y = Math.max(...milex.map((r) => r.year));
  const top = milex.filter((r) => r.year === y).sort((x, z) => z.value - x.value)[0];
  ok("the United States is the largest spender", top?.iso3 === "USA", top?.iso3 ?? "none");
}

console.log("\nThe page says what it cannot do");
{
  const page = readFileSync("app/arsenal/page.tsx", "utf8");
  const nav = readFileSync("components/ui/Nav.tsx", "utf8");
  ok("the page is in the nav", nav.includes('"/arsenal"'));
  ok("the file states the SIPRI transfer gap", /not reachable/i.test(a.gap));
  ok("the file states this is not an order of battle", /not an order of battle/i.test(a.note));
  // Both must reach the reader, not just the JSON.
  ok("the page prints the gap", page.includes("a.gap"));
  ok("the page prints the order-of-battle caveat", page.includes("a.note"));
  ok("the page prints a verdict on every deal", page.includes("g.verdict"));
}

if (bad > 0) { console.error(`\n${bad} arsenal test(s) failed.`); process.exit(1); }
console.log(`\nAll arsenal tests passed (${a.gazetteer.length} systems, ${a.groups.length} deal groups).`);
