/**
 * The public-order section's numbers, checked against the words of their
 * sources.
 *
 * Every figure in data/protests/public-order.json names a document the probe
 * read and quotes it. This fails the build if a quote is not in its document,
 * if a quote does not contain the figure it is cited for, if a figure cites a
 * source missing from the register, or if a part-whole relation the source
 * itself prints stops adding up (rioting by motive against rioting in total).
 *
 * It also holds the page to its promise: at least twenty-five charts, every
 * one drawn from figures that passed.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { allCited, normalise, quoteHasValue, verify, type ProbeDoc, type PublicOrderFile } from "../lib/public-order-shared";
import { CHARTS, chartPoints } from "../lib/public-order-charts";

let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => { if (!cond) failed++; console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  " + detail}`); };
const read = <T,>(p: string): T => JSON.parse(readFileSync(join(process.cwd(), p), "utf8")) as T;

const file = read<PublicOrderFile>("data/protests/public-order.json");
const probe = read<{ documents: ProbeDoc[] }>("data/protests/public-order-probe.json");
const docs = new Map(probe.documents.filter((d) => d.ok).map((d) => [d.id, d]));

console.log("\nThe check itself");
ok("a figure inside its quote passes", quoteHasValue("23 Riots 51606 3.8 41954", 41954));
ok("a figure that is only part of a longer number fails", !quoteHasValue("23 Riots 51606 3.8", 516));
ok("Indian and Western digit grouping both count", quoteHasValue("Rs 1,00,000 and 72,126", 72126) && quoteHasValue("1,00,000", 100000));
ok("a number word counts up to twenty", quoteHasValue("Nine killed, hundreds detained", 9) && !quoteHasValue("ninety", 9));
ok("entities and curly quotes are normalised", normalise("state&#8217;s  high\ncourt") === "state's high court");

console.log("\nEvery figure against its source");
const all = allCited(file);
const bad = all.map(({ where, c }) => ({ where, v: verify(c, docs, file.sources) })).filter((x) => !x.v.ok);
ok(`${all.length} figures cited`, all.length >= 200, `only ${all.length}`);
ok("every figure's quote is in its document and contains the figure", bad.length === 0,
  bad.slice(0, 12).map((b) => `${b.where}: ${(b.v as { why: string }).why}`).join("; "));
const used = new Set(all.map((x) => x.c.src));
ok("every source in the register is used", Object.keys(file.sources).every((s) => used.has(s)),
  Object.keys(file.sources).filter((s) => !used.has(s)).join(", "));
ok("every source has a URL, a publisher and a tier", Object.values(file.sources).every((s) => /^https?:\/\//.test(s.url) && s.publisher && [1, 2, 3].includes(s.tier)));

console.log("\nWhat the sources print must add up");
const series = new Map(file.series.map((s) => [s.id, s]));
const at = (id: string, x: number) => series.get(id)?.points.find((p) => p.x === x)?.v;
const MOTIVES = ["riots-communal", "riots-sectarian", "riots-industrial", "riots-political", "riots-caste", "riots-agrarian", "riots-students", "riots-vigilante", "riots-money", "riots-water", "riots-land", "riots-family", "riots-enmity", "riots-electricity", "riots-aandolan", "riots-attacks-police", "riots-other", "riots-sudden", "riots-ethnic"];
for (const y of [2017, 2018, 2020, 2021, 2022, 2023, 2024]) {
  const total = at("riots-total", y);
  const parts = MOTIVES.map((m) => at(m, y) ?? 0).reduce((a, b) => a + b, 0);
  if (total != null) ok(`rioting by motive adds up to rioting in total, ${y}`, parts === total, `${parts} vs ${total}`);
}
// The Home Ministry's RTI reply gives 14-year totals beside its year-wise figures.
const sum = (id: string) => (series.get(id)?.points ?? []).reduce((a, p) => a + p.v, 0);
ok("Home Ministry incidents 2004–2017 add to the reply's 10,399", sum("mha-communal-incidents") === 10399, String(sum("mha-communal-incidents")));
ok("Home Ministry deaths 2004–2017 add to the reply's 1,605", sum("mha-communal-killed") === 1605, String(sum("mha-communal-killed")));
ok("the 2024 state rows add to the all-India rioting total", (file.breakdowns.find((b) => b.id === "riots-states-2024")?.rows ?? []).reduce((a, r) => a + r.v, 0) === at("riots-total", 2024));
for (const s of file.series) {
  const xs = s.points.map((p) => p.x);
  ok(`${s.id}: one figure per year`, new Set(xs).size === xs.length, xs.join(","));
}

console.log("\nThe page's promise");
ok(`at least 25 charts (${CHARTS.length})`, CHARTS.length >= 25);
const empty = CHARTS.filter((c) => chartPoints(c, file) < 2);
ok("every chart has at least two figures to draw", empty.length === 0, empty.map((c) => c.id).join(", "));
ok("chart ids are unique", new Set(CHARTS.map((c) => c.id)).size === CHARTS.length);

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
