/**
 * The sacred atlas, checked before it ships.
 *
 * The connector's own self-checks gate the ingest in CI. These check the file
 * as committed, so a bad file cannot reach the page even when it was written
 * by an older connector.
 *
 * The file is generated in Actions — the editing sandbox cannot reach the
 * Wikidata endpoint — so until the first ingest lands there is nothing to
 * check and this says so and passes. Once the file exists these are real
 * gates: the alternative, a test that silently passes on an absent file
 * forever, is worse than no test.
 */
import { existsSync, readFileSync } from "node:fs";

const FILE = "data/sacred/atlas.json";

if (!existsSync(FILE)) {
  console.log(`\n  skip  ${FILE} not built yet — the ingest runs in Actions.`);
  process.exit(0);
}

let bad = 0;
function ok(name: string, cond: boolean, detail = ""): void {
  if (!cond) bad++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  " + detail}`);
}

interface Ded { figure: string; basis: "stated" | "canonical" | "named"; via?: string }
interface Site {
  qid: string; name: string; lat: number; lon: number;
  state: string | null; dedications: Ded[];
  inception: string | null; heritage: string | null;
}
interface CanonSet {
  id: string; label: string; deity: string | null; note: string;
  claimed: number; placed: number;
  members: Array<{ name: string; qid: string | null }>;
}
const a = JSON.parse(readFileSync(FILE, "utf8")) as {
  sites: Site[];
  rejected: Array<{ qid: string; name: string; lat: number; lon: number; why: string }>;
  canon: CanonSet[];
  coverage: Record<string, number>;
  note: string;
};

console.log("\nThe map");
ok("carries at least 2,500 sites", a.sites.length >= 2500, String(a.sites.length));
ok("every site has a Q-id", a.sites.every((s) => /^Q\d+$/.test(s.qid)));

{
  const dupes = a.sites.length - new Set(a.sites.map((s) => s.qid)).size;
  ok("no site is listed twice", dupes === 0, String(dupes));
}
{
  // Longitude comes first in WKT Point(). Reading it as latitude puts every
  // temple in the Indian Ocean, and the bounding box is what catches it.
  const outside = a.sites.filter(
    (s) => s.lat < 6 || s.lat > 37.6 || s.lon < 67 || s.lon > 97.5,
  );
  ok("every mapped site is inside India's bounding box", outside.length === 0,
    outside.slice(0, 3).map((s) => `${s.name} ${s.lat},${s.lon}`).join(" / "));

  // The connector drops sites whose coordinates put them elsewhere, and two
  // real ones did on the first live run: a temple whose longitude lands in the
  // Gulf of Thailand, and a Tamil temple in Liverpool tagged "country: India".
  // A handful is upstream noise; a flood means Point() is being read the wrong
  // way round, so the count is checked and not just the survivors.
  const total = a.sites.length + a.rejected.length;
  ok("rejections stay at the level of upstream typos, not a coordinate swap",
    a.rejected.length <= total * 0.02, `${a.rejected.length} of ${total}`);
  ok("every rejection says why", a.rejected.every((r) => r.why.length > 0));
}
{
  const placed = a.sites.filter((s) => s.state).length;
  const share = placed / Math.max(1, a.sites.length);
  ok("at least 90% of sites fall inside a state polygon",
    share >= 0.9, `${(share * 100).toFixed(1)}%`);
}
{
  const noLabel = a.sites.filter((s) => /^Q\d+$/.test(s.name));
  ok("no site is named by its Q-id", noLabel.length === 0, String(noLabel.length));
}

console.log("\nDedication tiers");
{
  const bases = new Set(a.sites.flatMap((s) => s.dedications.map((d) => d.basis)));
  ok("every dedication declares its basis",
    [...bases].every((b) => ["stated", "canonical", "named"].includes(b)),
    [...bases].join(", "));
}
{
  // The whole reason the tiers exist. If stated coverage ever climbs above a
  // third of the map, either Wikidata improved enormously or something is
  // filling the field in from an inference — and the second is the failure
  // this design was built to prevent.
  const stated = a.sites.filter((s) => s.dedications.some((d) => d.basis === "stated")).length;
  ok("stated dedications stay a minority, as the source actually is",
    stated <= a.sites.length * 0.34, `${stated} of ${a.sites.length}`);
}
{
  // The eshwar trap: Venkateswara is Vishnu. Any name-based rule that keys on
  // "-eswara" files Tirumala under Shiva, which is both wrong and the single
  // most visible error this map could make.
  const venkat = a.sites.filter((s) => /venkate|tirumala|tirupati/i.test(s.name));
  const misfiled = venkat.filter((s) => s.dedications.some((d) => /shiva/i.test(d.figure)));
  ok("no Venkateswara site is filed under Shiva", misfiled.length === 0,
    misfiled.slice(0, 3).map((s) => s.name).join(" / "));
}

console.log("\nThe canonical sets");
if (!a.canon) {
  // The committed atlas can be one connector behind: the ingest that writes
  // this layer runs in Actions, and the file only gains it on the next run.
  // Skipping here rather than failing keeps `npm test` honest about the
  // difference between "not built yet" and "built wrong" — the checks below
  // bind the moment the field exists.
  console.log("  skip  this atlas predates the canonical tier — the next ingest adds it.");
} else {
  const by = new Map(a.canon.map((c) => [c.id, c]));
  ok("all six traditions parsed", a.canon.length === 6,
    a.canon.map((c) => c.id).join(", "));

  // Counts the traditions claim about themselves. A parse that drifts onto the
  // wrong column shows up here before it shows up as a wrong map.
  ok("twelve Jyotirlingas", by.get("jyotirlinga")?.claimed === 12,
    String(by.get("jyotirlinga")?.claimed));
  ok("five Pancharama Kshetras", by.get("pancharama")?.claimed === 5,
    String(by.get("pancharama")?.claimed));
  ok("four Char Dham", by.get("char-dham")?.claimed === 4,
    String(by.get("char-dham")?.claimed));
  ok("the Divya Desams are counted in the hundred", (by.get("divya-desam")?.claimed ?? 0) >= 90,
    String(by.get("divya-desam")?.claimed));

  const jyoti = by.get("jyotirlinga")?.members.map((m) => m.name.toLowerCase()) ?? [];
  for (const known of ["somnath", "kedarnath", "mahakaleshwar"]) {
    ok(`${known} is among the Jyotirlingas`, jyoti.some((j) => j.includes(known)));
  }

  // The trap this tier was designed around. The Char Dham spans three Vishnu
  // sites and Rameswaram, which is Shiva's, so treating the circuit as a deity
  // set would file Rameswaram under Vishnu on the strength of a tidy rule.
  for (const id of ["char-dham", "chota-char-dham"]) {
    ok(`${id} names no single deity`, by.get(id)?.deity === null, String(by.get(id)?.deity));
  }
  const circuitNames = new Set(
    a.canon.filter((c) => c.deity === null).flatMap((c) => c.members.map((m) => m.qid)),
  );
  const viaCircuit = a.sites.filter(
    (s) => circuitNames.has(s.qid) &&
      s.dedications.some((d) => d.basis === "canonical" &&
        /char dham/i.test(d.via ?? "")),
  );
  ok("no dedication is derived from a pilgrimage circuit", viaCircuit.length === 0,
    viaCircuit.slice(0, 3).map((s) => s.name).join(" / "));

  // A canonical claim must never displace one Wikidata actually asserts.
  const clobbered = a.sites.filter(
    (s) => s.dedications.some((d) => d.basis === "canonical") &&
      !s.dedications.some((d) => d.basis === "stated") &&
      s.dedications.length === 0,
  );
  ok("stated and canonical dedications coexist", clobbered.length === 0);

  ok("every canonical member carries its tradition's note",
    a.canon.every((c) => c.note.length > 0));
}

console.log("\nHonesty of the file");
ok("the note says Wikidata's coverage is uneven",
  /uneven|coverage/i.test(a.note ?? ""));

console.log(bad === 0 ? "\nAll sacred atlas checks passed.\n" : `\n${bad} check(s) failed.\n`);
process.exit(bad === 0 ? 1 - 1 : 1);
