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

interface Op { country: string; asWritten: string; via?: string }
interface Type {
  page: string; name: string; origin: string; originCountry?: string; klass: string;
  operators: Op[]; nonState: string[]; read: boolean; note?: string;
  method?: "list" | "templates" | "headings"; statedReach?: string; unresolved?: string[];
}
const d = JSON.parse(readFileSync(FILE, "utf8")) as {
  types: Type[];
  countries: Array<{ country: string; types: string[]; origins: string[] }>;
  suppliers: Array<{ origin: string; originCountry?: string; operators: number; countries: string[] }>;
  readCount: number; typeCount: number; countryCount: number; faults: string[];
  provisionalRows?: number; viaNote?: string;
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
{
  // Every operator must be a country the world map can actually draw. This
  // replaced a blocklist that had let through a person (Ilham Aliyev), a naval
  // research centre, an Indian port and the phrase "exclusive economic zone" —
  // eight non-countries in forty-nine, every one of which would have rendered
  // as a plausible row.
  const atlasModule = require("world-atlas/countries-110m.json") as {
    objects: { countries: { geometries: Array<{ properties: { name: string } }> } };
  };
  const names = new Set(atlasModule.objects.countries.geometries.map((g) => g.properties.name));
  const undrawable = d.countries.filter((c) => !names.has(c.country));
  ok("every operator resolves to a country on the world map", undrawable.length === 0,
    undrawable.slice(0, 4).map((c) => c.country).join(" / "));
}

console.log("\nFacts a correct parse must contain");
if (d.types.every((t) => t.originCountry)) {
  // The connector records these rather than throwing, so the file ships and
  // can be diagnosed. The test is where they become a gate — but it names
  // them from the file's own fault list, so a shipped fault is visible here
  // rather than silently tolerated.
  ok("the connector recorded no fault", d.faults.length === 0, d.faults.join(" · "));

  // Named against each type's own originCountry rather than a literal. The
  // first version of this check asked whether the TB2 listed "Türkiye" and the
  // MQ-9 "United States" — the two names the resolver rewrites to "Turkey" and
  // "United States of America" on the way into the file. It could not pass,
  // and it would have gone on failing after the parse was fixed.
  for (const name of ["Bayraktar TB2", "MQ-9 Reaper"]) {
    const t = d.types.find((x) => x.name === name);
    if (!t?.read) continue;
    ok(`the ${name} lists ${t.originCountry}, which builds and flies it`,
      t.operators.some((o) => o.country === t.originCountry));
  }
} else {
  // A file written before originCountry existed was written by a parser whose
  // faults are facts about that parser. Gating the current branch on them
  // would block the fix that resolves them.
  console.log("  skip  this file predates originCountry — the next ingest rebuilds it.");
}
ok("reaches at least twenty operator countries", d.countryCount >= 20, String(d.countryCount));
{
  // A row found by scanning every flag template in a section is weaker
  // evidence than one read from a list entry, and the difference has to stay
  // visible rather than being averaged away.
  const withOps = d.types.filter((t) => t.operators.length > 0);
  // An atlas written by an older connector has no method field at all. That
  // is a version skew, not a fault, and it resolves on the next ingest.
  if (withOps.some((t) => t.method)) {
    ok("every type says how its operators were found", withOps.every((t) => Boolean(t.method)));
    const loose = withOps.filter((t) => t.method === "templates");
    console.log(`        ${loose.length} of ${withOps.length} types read by template scan rather than list`);
    const heads = withOps.filter((t) => t.method === "headings");
    if (heads.length > 0) {
      console.log(`        ${heads.length} read from country sub-headings: ${heads.map((t) => t.name).join(", ")}`);
    }
  } else {
    console.log("  skip  this file predates the method field — the next ingest adds it.");
  }
}
{
  const sum = new Set(d.suppliers.flatMap((s) => s.countries)).size;
  ok("the supplier roll-up covers the same countries as the country list",
    sum === d.countryCount, `${sum} vs ${d.countryCount}`);
}
if (d.suppliers.every((s) => s.originCountry)) {
  // A supplier the map cannot shade is a silent hole: the row renders, the
  // country does not light up, and nothing anywhere reports a problem.
  const atlasModule = require("world-atlas/countries-110m.json") as {
    objects: { countries: { geometries: Array<{ properties: { name: string } }> } };
  };
  const names = new Set(atlasModule.objects.countries.geometries.map((g) => g.properties.name));
  const undrawable = d.suppliers.filter((s) => !names.has(s.originCountry!));
  ok("every supplier resolves to a country on the world map", undrawable.length === 0,
    undrawable.map((s) => s.origin).join(" / "));
}

console.log("\nHonesty of the file");
ok("says it is not an inventory", /not an inventory/i.test(d.note));
ok("says it is not a record of combat use", /combat use/i.test(d.note));
ok("says an absent country means nobody wrote it down",
  /nobody wrote it down/i.test(d.gap));
ok("says the origin field is stated rather than parsed",
  /stated in this file rather than parsed/i.test(d.originNote));
if (d.viaNote !== undefined) {
  // Reading whole sections brought in Former and Potential subsections. A
  // file that carries those rows has to say so, and every such row has to be
  // identifiable — otherwise "operates" quietly comes to mean "has discussed".
  ok("says what a Former or Potential row means",
    /not a claim that the state operates/i.test(d.viaNote));
  const flagged = d.types.flatMap((t) => t.operators)
    .filter((o) => o.via && /\b(former|potential|prospective)\b/i.test(o.via)).length;
  ok("the provisional count matches the rows that carry a provisional group",
    (d.provisionalRows ?? 0) === flagged, `${d.provisionalRows} vs ${flagged}`);
}

console.log(bad === 0 ? "\nAll drone checks passed.\n" : `\n${bad} check(s) failed.\n`);
process.exit(bad === 0 ? 0 : 1);
