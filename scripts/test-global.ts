/**
 * The hundred global-economy indicators, and whether the page can draw them.
 *
 * A curated list of ids is a list of strings until something checks them. On
 * this page a typo does not throw — it silently drops one series out of a
 * cluster, and a cluster of nine where the heading says ten is the kind of
 * quiet wrong this repo has shipped before.
 *
 * The form check is the other half and it is a content rule enforced as a
 * test on purpose: the page's whole argument is that the question picks the
 * chart, so two clusters sharing a form would mean two clusters that should
 * have been one.
 */
import { readFileSync } from "node:fs";
import { CLUSTERS, ALL_IDS, clusterOf } from "../lib/global-economy";

let bad = 0;
function ok(name: string, cond: boolean, detail = ""): void {
  if (!cond) bad++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  " + detail}`);
}

interface S { id: string; title: string; unitShort: string; points?: { value: number | null }[]; peers?: unknown[] }
const wdi = JSON.parse(readFileSync("data/series/wdi.json", "utf8")) as S[];
const have = new Map(wdi.map((s) => [s.id, s]));
const defined = (s?: S) => (s?.points ?? []).filter((p) => p.value !== null).length;

console.log("\nThe list");
ok("a hundred indicators", ALL_IDS.length === 100, String(ALL_IDS.length));
ok("no indicator is listed twice", new Set(ALL_IDS).size === ALL_IDS.length);
ok("ten clusters", CLUSTERS.length === 10, String(CLUSTERS.length));

console.log("\nEvery cluster earns its own form");
{
  const forms = CLUSTERS.map((c) => c.form);
  ok("no two clusters share a chart form", new Set(forms).size === forms.length,
    forms.filter((f, i) => forms.indexOf(f) !== i).join(", "));
  ok("every cluster asks a question", CLUSTERS.every((c) => c.question.includes("?")),
    CLUSTERS.filter((c) => !c.question.includes("?")).map((c) => c.id).join(", "));
  // The page prints this under every heading. A cluster that cannot say why
  // it is drawn this way is a cluster drawn this way for variety.
  ok("every cluster says why its form was chosen",
    CLUSTERS.every((c) => c.why.length >= 60),
    CLUSTERS.filter((c) => c.why.length < 60).map((c) => c.id).join(", "));
}

console.log("\nEvery id resolves to data the form can draw");
{
  const missing = ALL_IDS.filter((id) => !have.has(id));
  ok("no id is missing from the ingested series", missing.length === 0, missing.join(", "));

  // Every form on this page needs either a run over time or a peer set, and
  // most need both, so both floors are checked for all of them.
  const thin = ALL_IDS.filter((id) => defined(have.get(id)) < 12);
  ok("every indicator has at least twelve readings", thin.length === 0, thin.join(", "));

  const noPeers = ALL_IDS.filter((id) => ((have.get(id)?.peers ?? []).length) < 5);
  ok("every indicator carries at least five comparators", noPeers.length === 0, noPeers.join(", "));

  ok("clusterOf finds every id", ALL_IDS.every((id) => clusterOf(id) !== null));
  ok("clusterOf rejects an id that is not curated", clusterOf("wdi-not-a-real-id") === null);
}

console.log("\nThe forms that need two distinct dates have them");
{
  // The slope and dumbbell clusters draw a first reading against a latest one.
  // A series whose first and last reading share a period silently vanishes
  // from those charts rather than failing.
  for (const id of ["slope", "dumbbell"]) {
    const c = CLUSTERS.find((x) => x.form === id)!;
    const flat = c.ids.filter((sid) => {
      const pts = (have.get(sid)?.points ?? []).filter((p) => p.value !== null);
      return pts.length < 2;
    });
    ok(`${c.id}: every series has two readings to connect`, flat.length === 0, flat.join(", "));
  }
}

console.log("\nThe page is reachable and says what it cannot do");
{
  const page = readFileSync("app/global/page.tsx", "utf8");
  const nav = readFileSync("components/ui/Nav.tsx", "utf8");
  ok("the page is in the nav", nav.includes('"/global"'));
  // The catalogue has no peer history. If that ever stops being said, a reader
  // will assume five-country trends were considered and dropped.
  ok("the page states that comparators have no history",
    /only the latest reading/i.test(page));
}

if (bad > 0) { console.error(`\n${bad} global test(s) failed.`); process.exit(1); }
console.log(`\nAll global tests passed (${ALL_IDS.length} indicators, ${CLUSTERS.length} clusters).`);
