/**
 * /corridors: the segmented regression recovers known answers, every
 * corridor is dated, sourced and drawable, the economic tests all run, and
 * the claims the page makes in prose still hold.
 */
import { its } from "../lib/its";
import { ECON, verdictOf } from "../lib/corridors-economy";
import { loadCorridors } from "../lib/corridors-load";

let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => { console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${!cond && detail ? `  ${detail}` : ""}`); if (!cond) failed++; };

console.log("The regression");
const lin = Array.from({ length: 22 }, (_, i) => { const yr = 2004 + i, t = yr - 2014, d = yr >= 2014 ? 1 : 0; return { year: yr, v: 10 + t + 5 * d + 2 * d * t }; });
const f = its(lin, 2014)!;
ok("an exact line: trend 1 before, 3 after, jump 5", Math.abs(f.before - 1) < 1e-9 && Math.abs(f.after - 3) < 1e-9 && Math.abs(f.jump - 5) < 1e-9);
const exp = Array.from({ length: 22 }, (_, i) => ({ year: 2004 + i, v: 100 * Math.pow(1.05, Math.min(i, 10)) * Math.pow(1.1, Math.max(0, i - 10)) }));
const g = its(exp, 2014, { log: true })!;
ok("on the log scale: 5% a year before, 10% after", Math.abs(g.before - 5) < 1e-6 && Math.abs(g.after - 10) < 1e-6);
// No real break, autocorrelated noise: the 95% range must contain zero about 95% of the time.
// (Newey–West errors failed exactly this check — 84% with no autocorrelation — and were replaced.)
for (const rho of [0, 0.6]) {
  let x = 20261120, covered = 0;
  const u = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648 + 1e-9);
  const g = () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
  for (let s = 0; s < 400; s++) {
    let e = g();
    const fit = its(Array.from({ length: 22 }, (_, i) => ({ year: 2004 + i, v: 50 + 0.8 * i + (e = rho * e + Math.sqrt(1 - rho * rho) * g()) })), 2014);
    if (fit && fit.ci[0] <= 0 && fit.ci[1] >= 0) covered++;
  }
  ok(`with no real break and ρ = ${rho}, the 95% range contains zero in ${covered}/400 trials (needs ≥ 90%)`, covered >= 360);
}
ok("the same data gives the same interval on every run", JSON.stringify(its(exp, 2014, { log: true })!.ci) === JSON.stringify(its(exp, 2014, { log: true })!.ci));
ok("too few years on one side gives no fit", its(lin.slice(0, 12), 2014) === null);
ok("a log fit refuses non-positive values", its([...exp.slice(0, 21), { year: 2025, v: 0 }], 2014, { log: true }) === null);
ok("verdicts follow the better direction", verdictOf({ id: "", domain: "money", label: "", log: false, better: "down" }, [-2, -1]) === "better" && verdictOf({ id: "", domain: "money", label: "", log: false, better: "up" }, [-2, -1]) === "worse" && verdictOf({ id: "", domain: "money", label: "", log: false, better: "up" }, [-1, 1]) === "unclear");

console.log("\nThe corridor register");
const { file, worldView, indiaView, economy } = loadCorridors();
const STATUS = ["operational", "partly-operational", "under-construction", "stalled", "framework"];
for (const c of file.corridors) {
  ok(`${c.id}: dated, with a known status`, c.started >= 1990 && c.started <= 2026 && STATUS.includes(c.status));
  ok(`${c.id}: two sources, or this site's own record`, c.sources.length >= 2 || c.sources.every((u) => u.startsWith("/")));
  const coords = [...(c.path ?? []).map((p) => [p[0], p[1]]), ...(c.lines ?? []).flat()];
  ok(`${c.id}: drawable`, coords.length >= 2 || !!c.nodesFrom, String(coords.length));
  ok(`${c.id}: coordinates are longitude, latitude`, coords.every(([lon, lat]) => lon! >= -20 && lon! <= 180 && lat! >= -15 && lat! <= 70));
  if (c.progress !== undefined) ok(`${c.id}: a progress figure is a percentage`, c.progress >= 0 && c.progress <= 100);
}
ok("every international corridor is on the world map", file.corridors.filter((c) => c.scope === "international").every((c) => worldView.routes.some((r) => r.id === c.id)));
ok("every national corridor is on the India map", file.corridors.filter((c) => c.scope !== "international" && !c.nodesFrom).every((c) => indiaView.routes.some((r) => r.id === c.id)));
ok("the defence corridor nodes are placed", indiaView.nodes.length === 11 && indiaView.nodes.every((n) => n.x > 0 && n.y > 0));
// The page says these were begun before 2014 and those after.
const by = (id: string) => file.corridors.find((c) => c.id === id)!;
ok("prose: freight, industrial, North–South and Myanmar corridors begun before 2014", ["edfc", "wdfc", "nicdp", "instc", "kaladan", "trilateral"].every((id) => by(id).started < 2014));
ok("prose: high-speed rail, the expressway, the maritime route and IMEC begun after", ["mahsr", "dme", "emc", "imec"].every((id) => by(id).started >= 2014));
ok("logistics ranks are as checked: 54, 35, 44, 38", JSON.stringify(file.logistics.points) === JSON.stringify([[2014, 54], [2016, 35], [2018, 44], [2023, 38]]));

console.log("\nThe economy");
ok("every indicator resolves to a series and fits", economy.every((e) => e.points.length > 0 && e.fit !== null), economy.filter((e) => !e.fit).map((e) => e.spec.id).join());
ok("every indicator has at least five years each side of 2014", economy.every((e) => e.points.filter((p) => p.year < 2014).length >= 4 && e.points.filter((p) => p.year >= 2014).length >= 5));
ok("modelled series are not counted", ECON.filter((s) => s.modelled).every((s) => /ILO/.test(s.modelled!)));
ok("a change is called exactly when its 95% range excludes zero", economy.every((e) => !e.fit || (e.verdict === "unclear") === (e.fit.ci[0] <= 0 && e.fit.ci[1] >= 0)));
ok("a called change agrees in sign with its range", economy.every((e) => !e.fit || e.verdict === "unclear" || Math.sign(e.fit.ci[0]) === Math.sign(e.fit.change)));
ok("every interval is wider than the textbook one, never narrower", economy.every((e) => !e.fit || e.fit.crit >= 2.0));

console.log(failed ? `\n${failed} failed` : "\nall passed");
if (failed) process.exitCode = 1;
