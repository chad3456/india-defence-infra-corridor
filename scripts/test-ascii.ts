/**
 * The generated map, checked against its generator.
 *
 * Both files under test are derived — the character grid and the per-state
 * layers — and a generated file that cannot be regenerated and compared is a
 * hand-edited file with extra steps. So this reruns both builders into a
 * temporary directory and diffs, the same arrangement db:seed-check uses.
 *
 * It also checks the two things a diff cannot: that the picture is still
 * India, and that the join still lands. A grid of the right size full of the
 * wrong cells passes every structural check there is.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

let bad = 0;
function ok(name: string, cond: boolean, detail = ""): void {
  if (!cond) bad++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  " + detail}`);
}

const GRID = "data/geo/ascii-india.json";
const LAYERS = "data/geo/state-layers.json";
if (!existsSync(GRID) || !existsSync(LAYERS)) {
  console.log(`\n  skip  the generated map is not built — run npm run geo:ascii && npm run geo:layers.`);
  process.exit(0);
}

interface Grid {
  cols: number; rows: number; cellAspect: number; landCells: number;
  unsampled: string[]; symbols: Record<string, string>;
  anchors: Array<{ state: string; cells: number; col: number; row: number }>;
  grid: string[];
}
interface Layer {
  id: string; label: string; total: number; placed: number;
  unplacedCount: number; deduped: number;
  unplaced: string[]; byState: Record<string, Array<{ name: string; why: string; basis: string }>>;
}
const grid = JSON.parse(readFileSync(GRID, "utf8")) as Grid;
const file = JSON.parse(readFileSync(LAYERS, "utf8")) as {
  refused: Array<{ layer: string; why: string }>; layers: Layer[];
};

console.log("\nThe grid is internally consistent");
ok("every row is the declared width",
  grid.grid.every((l) => l.length === grid.cols), `rows: ${grid.rows}, cols: ${grid.cols}`);
ok("the row count matches", grid.grid.length === grid.rows);
{
  const land = grid.grid.join("").split("").filter((c) => c !== ".").length;
  // landCells counts the untrimmed grid, so trimming can only lose sea.
  ok("no land was lost in the trim", land === grid.landCells, `${land} vs ${grid.landCells}`);
}
{
  const used = new Set(grid.grid.join("").split("").filter((c) => c !== "." && c !== "?"));
  const declared = new Set(Object.keys(grid.symbols));
  const undeclared = [...used].filter((c) => !declared.has(c));
  ok("every symbol drawn is declared", undeclared.length === 0, undeclared.join(""));
}
ok("every anchor lands inside its own state",
  grid.anchors.every((a) => {
    const ch = grid.grid[a.row]?.[a.col];
    return ch !== undefined && grid.symbols[ch] === a.state;
  }),
  grid.anchors.filter((a) => grid.symbols[grid.grid[a.row]?.[a.col] ?? "."] !== a.state)
    .map((a) => a.state).join(", "));

console.log("\nThe picture is still India");
{
  // Structure alone cannot catch a projection that has flipped, rotated or
  // collapsed. These are facts about the shape of the country that any
  // correct sampling reproduces and a broken one does not.
  const rowOf = (s: string) => grid.anchors.find((a) => a.state === s)?.row;
  const colOf = (s: string) => grid.anchors.find((a) => a.state === s)?.col;
  const kashmir = rowOf("Jammu & Kashmir");
  const kerala = rowOf("Kerala");
  ok("Kashmir is north of Kerala",
    kashmir !== undefined && kerala !== undefined && kashmir < kerala,
    `${kashmir} vs ${kerala}`);
  const gujarat = colOf("Gujarat");
  const assam = colOf("Assam");
  ok("Gujarat is west of Assam",
    gujarat !== undefined && assam !== undefined && gujarat < assam,
    `${gujarat} vs ${assam}`);
  ok("the grid is taller than it is wide in ground terms",
    grid.rows * grid.cellAspect > grid.cols);
  ok("land is a minority of the frame, as a country with two seas in view is",
    grid.landCells < grid.cols * grid.rows * 0.6);
}
{
  // The three that fall between sample points are a finding, and one the page
  // prints. If the list grows, the resolution has changed under it.
  ok("exactly the three smallest union territories go unsampled",
    grid.unsampled.length === 3, grid.unsampled.join(", "));
}

console.log("\nThe join lands");
for (const l of file.layers) {
  // The ledger has to balance. It did not, twice, and neither failure was
  // visible from the file: the sacred layer counted a forty-row diagnostic
  // sample as if it were the whole unplaced set, and the metro layer dropped
  // a de-duplicated line out of both columns. Both read as plausible coverage.
  ok(`${l.id}: placed plus unplaced plus deduplicated accounts for every row`,
    l.placed + l.unplacedCount + l.deduped === l.total,
    `${l.placed} + ${l.unplacedCount} + ${l.deduped} vs ${l.total}`);
  ok(`${l.id}: the unplaced sample never exceeds the unplaced count`,
    l.unplaced.length <= l.unplacedCount);
  ok(`${l.id}: every state it names is a state the map can draw`,
    Object.keys(l.byState).every((s) => Object.values(grid.symbols).includes(s)),
    Object.keys(l.byState).filter((s) => !Object.values(grid.symbols).includes(s)).join(", "));
  ok(`${l.id}: every item carries a reason and a basis`,
    Object.values(l.byState).every((xs) => xs.every((i) => i.why.length > 0 && i.basis.length > 0)));
}
{
  const sacred = file.layers.find((l) => l.id === "sacred");
  // The sacred layer is the one with a claim strong enough to be wrong. If the
  // canon join breaks, every temple silently becomes an unattributed dot.
  const canon = Object.values(sacred?.byState ?? {})
    .flat().filter((i) => i.basis.startsWith("the tradition"));
  ok("the sacred layer still attributes canon membership from the tradition's own list",
    canon.length > 0, String(canon.length));
  ok("best-attested rows sort first",
    Object.values(sacred?.byState ?? {}).every((xs) => {
      const rank = xs.map((i) => (i.basis.startsWith("the tradition") ? 0
        : i.basis.startsWith("a dedication") ? 1
        : i.basis.startsWith("a figure") ? 2 : 3));
      return rank.every((r, i) => i === 0 || rank[i - 1]! <= r);
    }));
}
ok("the contested list is still refused, with its reason",
  file.refused.some((r) => /1990|Telangana/.test(r.why)));

console.log("\nRegenerating from the topology reproduces both files");
{
  // `builtAt` is the one field that differs by construction.
  const strip = (s: string): string =>
    s.replace(/"builtAt": "[^"]*"/, '"builtAt": ""');
  const before = { grid: strip(readFileSync(GRID, "utf8")), layers: strip(readFileSync(LAYERS, "utf8")) };
  try {
    execFileSync("npx", ["tsx", "scripts/geo/build-ascii-india.ts"], { stdio: "pipe" });
    execFileSync("npx", ["tsx", "scripts/geo/build-state-layers.ts"], { stdio: "pipe" });
  } catch (err) {
    ok("the builders run", false, String(err).slice(0, 160));
  }
  ok("the grid is byte-identical after a rebuild", strip(readFileSync(GRID, "utf8")) === before.grid);
  ok("the layers are byte-identical after a rebuild",
    strip(readFileSync(LAYERS, "utf8")) === before.layers);
}

console.log(bad === 0 ? "\nAll map checks passed.\n" : `\n${bad} check(s) failed.\n`);
process.exit(bad === 0 ? 0 : 1);
