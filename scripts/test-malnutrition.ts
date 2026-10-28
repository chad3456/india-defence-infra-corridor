/**
 * /malnutrition: the bands are WHO's where WHO sets them, the ramp reads
 * worst-brightest, estimates never become colours, the district map joins to
 * its values and its states, and the NFHS-6 register cites what it says.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MEASURE, MEASURES, RAMP, bandOf, quintiles, rampFor, ranked, shareAtOrAbove, stateKey } from "../lib/malnutrition";
import { malnutritionMap } from "../lib/malnutrition-map";

let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => { console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${!cond && detail ? `  ${detail}` : ""}`); if (!cond) failed++; };

console.log("Bands and colours");
ok("stunting bands are WHO–UNICEF's: 2.5, 10, 20, 30", MEASURE.stunting.bands.map((b) => b.from).join() === "0,2.5,10,20,30");
ok("wasting bands are WHO–UNICEF's: 2.5, 5, 10, 15", MEASURE.wasting.bands.map((b) => b.from).join() === "0,2.5,5,10,15");
ok("anaemia bands are WHO's: 5, 20, 40", MEASURE.anaemia.bands.map((b) => b.from).join() === "0,5,20,40");
ok("underweight is marked as plain bands, not WHO's", MEASURE.underweight.bandSource === "plain");
ok("a value on a boundary takes the higher band", bandOf(30, [0, 2.5, 10, 20, 30]) === 4 && bandOf(29.9, [0, 2.5, 10, 20, 30]) === 3);
ok("the worst band is always the brightest step", rampFor(4, 5) === RAMP[4] && rampFor(3, 4) === RAMP[4] && rampFor(0, 4) === RAMP[1]);
ok("quintiles split twenty values into five fours", quintiles(Array.from({ length: 20 }, (_, i) => i)).join() === "0,4,8,12,16");
ok("state names from both sources meet", stateKey("New Delhi") === stateKey("Delhi") && stateKey("Dadra and Nagar Haveli, Daman and Diu") === stateKey("Dadra & Nagar Haveli & Daman & Diu") && stateKey("Jammu & Kashmir") === stateKey("Jammu and Kashmir"));

console.log("\nThe district map");
const m = malnutritionMap();
ok("the map builds from the committed files", !!m);
if (m) {
  ok("at least 700 district outlines", m.districts.length >= 700, String(m.districts.length));
  for (const k of MEASURES) {
    const xs = m.districts.map((d) => d.v[k]).filter((x): x is number => x !== null);
    ok(`${MEASURE[k].name}: at least 650 measured districts, all 0–100`, xs.length >= 650 && xs.every((x) => x >= 0 && x <= 100), String(xs.length));
  }
  const raw = JSON.parse(readFileSync(join(process.cwd(), "data", "spatial-india", "values.json"), "utf8")) as { values: Record<string, Record<string, [number | null, boolean]>> };
  const leaked = m.districts.filter((d) => MEASURES.some((k) => { const x = raw.values[d.id]?.[MEASURE[k].spatialId]; return !!x && x[1] && d.v[k] !== null; }));
  ok("no estimated value is carried as a measurement", leaked.length === 0, leaked.map((d) => d.name).slice(0, 5).join(", "));
  const states = new Set(m.districts.filter((d) => MEASURES.some((k) => d.v[k] !== null)).map((d) => d.state));
  const unmatched = [...states].filter((s) => !m.states[stateKey(s)]);
  ok("every surveyed state joins to its DHS figures", unmatched.length === 0, unmatched.join(", "));
  ok("national NFHS-5 figures are DHS's: stunting 35.5, underweight 32.1", m.national.stunting.nfhs5 === 35.5 && m.national.underweight.nfhs5 === 32.1);
  const r = ranked(m.districts, "stunting");
  ok("ranking is worst first", r.length > 1 && r[0]!.v.stunting! >= r[1]!.v.stunting!);
  const s = shareAtOrAbove(m.districts, "stunting", 30);
  ok("very-high stunting count is a share of the measured districts", s.n > 0 && s.n <= s.of && s.of === r.length);
  ok("outline and state borders are drawn", m.outline.length > 1000 && m.borders.length > 1000);
}

console.log("\nNFHS-6 register");
const pub = JSON.parse(readFileSync(join(process.cwd(), "data", "malnutrition", "published.json"), "utf8")) as { accessed: string; sources: Array<{ id: string; url: string; published: string | null }>; nfhs6: { released: { national: string; districts: string; sources: string[] }; national: Array<{ measure: string; value: number | null; disputed?: string; sources: string[] }>; severeWasting: { sources: string[] } } };
const ids = new Set(pub.sources.map((x) => x.id));
const cited = [...pub.nfhs6.released.sources, ...pub.nfhs6.national.flatMap((x) => x.sources), ...pub.nfhs6.severeWasting.sources, "spatial-nfhs5", "dhs-api", "deonis-2019", "who-anaemia-cdc"];
ok("every citation resolves", cited.every((c) => ids.has(c)), cited.filter((c) => !ids.has(c)).join(", "));
ok("every source is https and dated no later than access", pub.sources.every((x) => /^https:\/\//.test(x.url) && (x.published === null || x.published <= pub.accessed)));
ok("a missing NFHS-6 figure says why", pub.nfhs6.national.every((x) => x.value !== null || (x.disputed ?? "").length > 10));
ok("each NFHS-6 figure has two sources, or is not given", pub.nfhs6.national.every((x) => x.value === null || x.sources.length >= 2));
ok("district fact sheets followed the national ones", pub.nfhs6.released.districts > pub.nfhs6.released.national);

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
