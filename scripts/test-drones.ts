/**
 * The drone operator record, checked before it ships.
 *
 * The failure this guards against is a country counted twice. The whole
 * output is a count of countries, and Operators sections name the same state
 * several ways — "UAE" and "United Arab Emirates", "Turkey" and "Türkiye" —
 * so a missed alias does not produce an error, it produces a bigger number.
 */
import { existsSync, readFileSync } from "node:fs";

const FILE = "data/global/drones.json";
if (!existsSync(FILE)) {
  console.log(`\n  skip  ${FILE} not built yet — the ingest runs in Actions.`);
  process.exit(0);
}

let bad = 0;
function ok(name: string, cond: boolean, detail = ""): void {
  if (!cond) bad++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  " + detail}`);
}

interface Op { country: string; asWritten: string }
interface Type {
  page: string; name: string; origin: string; klass: string;
  operators: Op[]; nonState: string[]; read: boolean; note?: string;
}
const d = JSON.parse(readFileSync(FILE, "utf8")) as {
  types: Type[];
  countries: Array<{ country: string; types: string[]; origins: string[] }>;
  suppliers: Array<{ origin: string; operators: number; countries: string[] }>;
  readCount: number; typeCount: number; countryCount: number; faults: string[];
  note: string; gap: string; originNote: string;
};

console.log("\nThe record");
ok("read an Operators section for at least half the types",
  d.readCount >= d.typeCount / 2, `${d.readCount} of ${d.typeCount}`);
ok("every type declares an origin and a class",
  d.types.every((t) => t.origin.length > 0 && t.klass.length > 0));
ok("a type that was not read carries no operators and says why",
  d.types.filter((t) => !t.read).every((t) => t.operators.length === 0 && Boolean(t.note)));
ok("every operator row keeps the line it was read from",
  d.types.every((t) => t.operators.every((o) => o.asWritten.length > 0)));

console.log("\nCountries counted once");
{
  const dupes = d.countries.length - new Set(d.countries.map((c) => c.country)).size;
  ok("no country appears twice in the roll-up", dupes === 0, String(dupes));
}
{
  // The aliases that actually collide in these articles. If any pair both
  // appear, a country is being counted twice and every total is inflated.
  const names = new Set(d.countries.map((c) => c.country));
  const collisions = [
    ["Turkey", "Türkiye"], ["UAE", "United Arab Emirates"],
    ["USA", "United States"], ["UK", "United Kingdom"],
  ].filter(([a, b]) => names.has(a!) && names.has(b!));
  ok("no country is present under two spellings", collisions.length === 0,
    collisions.map((p) => p.join(" + ")).join(", "));
}
{
  // A service is not an operator. Counting "Turkish Air Force" beside
  // "Türkiye" would inflate the map without looking wrong.
  const services = d.countries.filter((c) =>
    /\b(air force|army|navy|forces|ministry|command|guard)\b/i.test(c.country));
  ok("no armed service is counted as a country", services.length === 0,
    services.slice(0, 3).map((c) => c.country).join(" / "));
}
{
  const nonState = d.countries.filter((c) =>
    /\b(houthi|hezbollah|hamas|wagner|isis|taliban)\b/i.test(c.country));
  ok("no non-state group is counted as a country", nonState.length === 0,
    nonState.map((c) => c.country).join(" / "));
}

console.log("\nFacts a correct parse must contain");
{
  // The connector records these rather than throwing, so the file ships and
  // can be diagnosed. The test is where they become a gate — but it names
  // them from the file's own fault list, so a shipped fault is visible here
  // rather than silently tolerated.
  ok("the connector recorded no fault", d.faults.length === 0, d.faults.join(" · "));

  const tb2 = d.types.find((t) => t.name === "Bayraktar TB2");
  ok("the TB2 lists Türkiye, which builds and flies it",
    !tb2?.read || tb2.operators.some((o) => o.country === "Türkiye"));
  const reaper = d.types.find((t) => t.name === "MQ-9 Reaper");
  ok("the MQ-9 lists the United States",
    !reaper?.read || reaper.operators.some((o) => o.country === "United States"));
}
ok("reaches at least twenty operator countries", d.countryCount >= 20, String(d.countryCount));
{
  const sum = new Set(d.suppliers.flatMap((s) => s.countries)).size;
  ok("the supplier roll-up covers the same countries as the country list",
    sum === d.countryCount, `${sum} vs ${d.countryCount}`);
}

console.log("\nHonesty of the file");
ok("says it is not an inventory", /not an inventory/i.test(d.note));
ok("says it is not a record of combat use", /combat use/i.test(d.note));
ok("says an absent country means nobody wrote it down",
  /nobody wrote it down/i.test(d.gap));
ok("says the origin field is stated rather than parsed",
  /stated in this file rather than parsed/i.test(d.originNote));

console.log(bad === 0 ? "\nAll drone checks passed.\n" : `\n${bad} check(s) failed.\n`);
process.exit(bad === 0 ? 0 : 1);
