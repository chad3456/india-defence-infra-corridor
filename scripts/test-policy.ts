/**
 * Tests for the policy-measures layer.
 *
 * This layer's whole value is a promise: no figure about Indian industrial
 * policy appears on this site without a sentence from a named document behind
 * it. The promise is cheap to make and easy to break by accident — a connector
 * that fills a value and forgets the quote, a band widened to let one figure
 * through, a measure filed under a sector that no longer exists. These checks
 * are what make the promise mean something.
 *
 * The most important of them is the one that would fail loudest if the layer
 * were used carelessly: a numeric outlay with no `sourceUrl` and no `quote`.
 * The type system already forbids it, so the check builds one anyway — casting
 * a deliberately broken object through `unknown` — because data arriving from a
 * JSON file has never been near the compiler, and that is exactly the route a
 * bad figure would take.
 *
 * It also prints how much of the layer is unverified. That number is expected
 * to be nearly all of it until the probe targets are read by a connector, and
 * an unverified layer is the correct state rather than a failing one. The test
 * fails on unsupported figures, never on absent ones.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MEASURES, ALL_INSTRUMENTS, EXTRA_INSTRUMENTS, assertVocabulary, coverageOf,
  displayableSlots, readSlot, readYear, slot, verificationOf,
  type Filled, type Measure, type Slot,
} from "../lib/policy-measures";
import { INSTRUMENTS, SECTORS } from "../lib/localisation-sectors";
import { TARGETS } from "../scripts/etl/probe-policy";

let failures = 0;
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const META = {
  sourceUrl: "https://example.gov.in/notification",
  publisher: "Test Department",
  readAt: "2026-09-13",
  rung: "record" as const,
};

/* ── Vocabulary: borrowed, not invented ──────────────────────────────── */

console.log("vocabulary");

let vocabError: string | null = null;
try {
  assertVocabulary();
} catch (err) {
  vocabError = err instanceof Error ? err.message : String(err);
}
check("the sector and instrument vocabularies agree with lib/localisation-sectors.ts",
  vocabError === null, vocabError ?? undefined);

const sectorIds = new Set(SECTORS.map((s) => s.id));
check("every measure declares a sector from the existing vocabulary",
  MEASURES.every((m) => sectorIds.has(m.sector)),
  MEASURES.filter((m) => !sectorIds.has(m.sector)).map((m) => `${m.id}:${m.sector}`).join(", "));

const instrumentIds = new Set(ALL_INSTRUMENTS.map((i) => i.id));
check("every measure declares a known instrument",
  MEASURES.every((m) => instrumentIds.has(m.instrument)),
  MEASURES.filter((m) => !instrumentIds.has(m.instrument)).map((m) => `${m.id}:${m.instrument}`).join(", "));

const borrowed = new Set(INSTRUMENTS.map((i) => i.id));
check("the extra instruments extend the five rather than shadowing them",
  EXTRA_INSTRUMENTS.every((i) => !borrowed.has(i.id)),
  EXTRA_INSTRUMENTS.filter((i) => borrowed.has(i.id)).map((i) => i.id).join(", "));

check("all five original instruments survive into ALL_INSTRUMENTS",
  INSTRUMENTS.every((i) => instrumentIds.has(i.id)));

check("every extra instrument states a mechanism, a fingerprint and a failure mode",
  EXTRA_INSTRUMENTS.every((i) => i.mechanism.length > 40 && i.fingerprint.length > 40 && i.failureMode.length > 40));

/* ── Structural integrity of the measures ────────────────────────────── */

console.log("\nmeasures");

const ids = MEASURES.map((m) => m.id);
check("measure ids are unique", new Set(ids).size === ids.length,
  ids.filter((id, i) => ids.indexOf(id) !== i).join(", "));

check("every measure carries at least one slot",
  MEASURES.every((m) => m.slots.length > 0),
  MEASURES.filter((m) => m.slots.length === 0).map((m) => m.id).join(", "));

const slotKeyProblems: string[] = [];
for (const m of MEASURES) {
  const sids = m.slots.map((s) => s.id);
  if (new Set(sids).size !== sids.length) slotKeyProblems.push(m.id);
}
check("slot ids are unique within a measure", slotKeyProblems.length === 0, slotKeyProblems.join(", "));

const bandProblems = MEASURES.flatMap((m) =>
  m.slots.filter((s) => !(s.expect[0] < s.expect[1])).map((s) => `${m.id}.${s.id}`));
check("every slot's plausibility band is ordered and non-empty",
  bandProblems.length === 0, bandProblems.join(", "));

const lookProblems = MEASURES.flatMap((m) =>
  m.slots.filter((s) => s.look.length === 0).map((s) => `${m.id}.${s.id}`));
check("every slot names the words its source sentence must contain",
  lookProblems.length === 0, lookProblems.join(", "));

check("every measure states the claim made for it and the reading it deserves",
  MEASURES.every((m) => m.claim.length > 20 && m.reading.length > 80),
  MEASURES.filter((m) => m.claim.length <= 20 || m.reading.length <= 80).map((m) => m.id).join(", "));

/* ── The promise: no figure without its sentence ─────────────────────── */

console.log("\nno figure without a sentence");

const unsupported: string[] = [];
for (const m of MEASURES) {
  for (const s of m.slots) {
    const f = s.filled;
    if (f === null) continue;
    if (!f.sourceUrl?.trim() || !f.quote?.trim()) unsupported.push(`${m.id}.${s.id}`);
  }
}
check("no measure carries a numeric value without a sourceUrl and a quote",
  unsupported.length === 0, unsupported.join(", "));

const outOfBand: string[] = [];
for (const m of MEASURES) {
  for (const s of m.slots) {
    const f = s.filled;
    if (f === null) continue;
    if (f.value < s.expect[0] || f.value > s.expect[1]) outOfBand.push(`${m.id}.${s.id}=${f.value}`);
  }
}
check("no filled slot sits outside its own plausibility band",
  outOfBand.length === 0, outOfBand.join(", "));

// The route a bad figure would actually take: JSON, which never met the
// compiler. displayableSlots is the guard a page calls, so it must refuse.
const smuggled = {
  value: 76_000,
  asWritten: "76,000 crore",
  sourceUrl: "",
  quote: "",
  publisher: "",
  readAt: "2026-09-13",
  rung: "record",
} as unknown as Filled;
const tainted: Measure = {
  id: "test-measure", name: "test", officialName: null,
  sector: "electronics", instrument: "production-subsidy",
  authority: "test", claim: "test", reading: "test",
  slots: [{ ...slot("outlay", "test", "rupees", [1, 1e15], ["crore"]), filled: smuggled }],
  probeTargets: [], seriesIds: [],
};
let guardThrew = false;
let guardMessage = "";
try {
  displayableSlots(tainted);
} catch (err) {
  guardThrew = true;
  guardMessage = err instanceof Error ? err.message : String(err);
}
check("a value that arrived without provenance is refused at display time", guardThrew);
check("the refusal names the measure, the slot and what is missing",
  guardMessage.includes("test-measure.outlay") && guardMessage.includes("sourceUrl"),
  guardMessage);

const wrongOrder: Measure = {
  ...tainted,
  id: "band-test",
  slots: [{
    ...slot("outlay", "test", "rupees", [1_000, 2_000], ["crore"]),
    filled: { ...smuggled, sourceUrl: META.sourceUrl, quote: "The outlay is ₹76,000 crore." },
  }],
};
let bandThrew = false;
try {
  displayableSlots(wrongOrder);
} catch {
  bandThrew = true;
}
check("a figure outside its band is refused even with a quote attached", bandThrew);

const clean: Measure = {
  ...tainted,
  id: "clean-test",
  slots: [{
    ...slot("outlay", "test", "rupees", [1, 1e15], ["crore"]),
    filled: { ...smuggled, sourceUrl: META.sourceUrl, quote: "The outlay is ₹76,000 crore." },
  }],
};
check("a properly sourced figure passes the guard", displayableSlots(clean).length === 1);

/* ── Reading a slot out of a sentence ────────────────────────────────── */

console.log("\nreadSlot");

const outlay: Slot = slot("outlay", "outlay", "rupees", [10_000_000, 5e12], ["crore"]);

const good = readSlot(
  outlay,
  "The Cabinet approved the scheme with an outlay of ₹76,000 crore for the period in question.",
  META,
);
check("a sentence with one figure in the right unit fills the slot", good !== null);
check("the multiplication is carried out", good?.value === 760_000_000_000, String(good?.value));
check("the figure as written is kept beside the value", good?.asWritten.includes("76,000") === true, good?.asWritten);
check("the sentence is stored verbatim as the evidence",
  good?.quote.startsWith("The Cabinet approved") === true, good?.quote);

check("a sentence that does not name the slot is refused",
  readSlot(outlay, "The department published a long and detailed statement about the programme today.", META) === null);
check("a sentence with no figure is refused",
  readSlot(outlay, "The scheme was approved with an outlay in crore that was not disclosed today.", META) === null);
check("a sentence with two figures is refused rather than guessing which",
  readSlot(outlay, "An outlay of ₹76,000 crore was approved, up from ₹41,000 crore earlier.", META) === null);
check("a figure outside the band is refused",
  readSlot(
    slot("outlay", "outlay", "rupees", [10_000_000, 1_000_000_000], ["crore"]),
    "The scheme carries an outlay of ₹76,000 crore in total.",
    META,
  ) === null);
check("a percentage does not fill a rupee slot",
  readSlot(outlay, "Incentives of 6 per cent are payable on incremental sales in crore terms.", META) === null);

const pct = slot("rate", "rate", "percent", [0, 100], ["offset"]);
check("a percentage fills a percentage slot",
  readSlot(pct, "The offset obligation is set at 30 per cent of the contract value.", META)?.value === 30);

const items = slot("items", "items", "count", [1, 5000], ["item"]);
check("a plain count fills a count slot",
  readSlot(items, "The list carries 1,238 items that may no longer be imported after the stated dates.", META)?.value === 1238);

check("a fragment too short to be a sentence is refused",
  readSlot(outlay, "₹76,000 crore.", META) === null);

/* ── Years, which the number parser deliberately refuses ─────────────── */

console.log("\nreadYear");

const year = slot("notified", "notified", "year", [1991, 2030], ["scheme"]);
check("a sentence with one year fills a year slot",
  readSlot(year, "The scheme was notified by the ministry in 2020 after Cabinet approval.", META)?.value === 2020);
check("a sentence naming two years is refused",
  readSlot(year, "The 2020 scheme replaced the earlier scheme of 2016 entirely.", META) === null);
check("the same year twice is one year, not two",
  readYear("Notified in 2020, the 2020 scheme took effect immediately.", [1991, 2030])?.value === 2020);
check("a year outside the band is not read",
  readYear("The predecessor dates from 1956 and nothing since.", [1991, 2030]) === null);
check("a year slot ignores a rupee figure in the same sentence",
  readSlot(year, "The scheme, notified in 2020, carries an outlay of ₹76,000 crore.", META)?.value === 2020);

/* ── The probe and the measures must agree ───────────────────────────── */

console.log("\nprobe alignment");

const targetIds = new Set(TARGETS.map((t) => t.id));
const danglingTargets = MEASURES.flatMap((m) =>
  m.probeTargets.filter((t) => !targetIds.has(t)).map((t) => `${m.id} → ${t}`));
check("every probe target a measure points at exists in scripts/etl/probe-policy.ts",
  danglingTargets.length === 0, danglingTargets.join(", "));

const measureIds = new Set(MEASURES.map((m) => m.id));
const danglingAnswers = TARGETS.flatMap((t) =>
  (t.answers ?? []).filter((m) => !measureIds.has(m)).map((m) => `${t.id} → ${m}`));
check("every measure a probe target claims to answer exists",
  danglingAnswers.length === 0, danglingAnswers.join(", "));

const unprobed = MEASURES.filter((m) => m.probeTargets.length === 0).map((m) => m.id);
check("every measure names at least one source that could settle it",
  unprobed.length === 0, unprobed.join(", "));

const targetUrls = TARGETS.map((t) => t.url);
check("probe target ids are unique", new Set(TARGETS.map((t) => t.id)).size === TARGETS.length);
check("every probe target has an absolute https URL",
  targetUrls.every((u) => u.startsWith("https://")),
  targetUrls.filter((u) => !u.startsWith("https://")).join(", "));

/* ── Series referenced must exist ────────────────────────────────────── */

console.log("\nseries cross-reference");

const seriesFile = join(process.cwd(), "data/series/defence.json");
let known = new Set<string>();
try {
  const parsed = JSON.parse(readFileSync(seriesFile, "utf8")) as Array<{ id?: string }>;
  known = new Set(parsed.map((s) => s.id).filter((id): id is string => typeof id === "string"));
} catch (err) {
  failures++;
  console.log(`  FAIL could not read ${seriesFile} — ${err instanceof Error ? err.message : String(err)}`);
}
const danglingSeries = MEASURES.flatMap((m) =>
  m.seriesIds.filter((s) => !known.has(s)).map((s) => `${m.id} → ${s}`));
check("every series a measure points at exists in data/series/defence.json",
  danglingSeries.length === 0, danglingSeries.join(", "));

/* ── How much of this is unverified ──────────────────────────────────── */

const cov = coverageOf();
console.log("\ncoverage");
console.log(
  `  ${cov.measures} measures: ${cov.verified} verified, ${cov.partlyVerified} partly verified, ` +
  `${cov.unverified} unverified.`,
);
console.log(`  ${cov.slotsFilled} of ${cov.slots} figures have a source sentence behind them.`);
if (cov.slotsFilled === 0) {
  console.log(
    "  Nothing in this layer is verified yet. That is the intended state until a connector\n" +
    "  reads the probe targets — an empty field beside a named source beats a plausible figure.",
  );
}

// Sanity on the accounting itself, so the number printed above can be trusted.
check("coverage counts every measure exactly once",
  cov.verified + cov.partlyVerified + cov.unverified === cov.measures);
check("the slot total matches the measures",
  cov.slots === MEASURES.reduce((a, m) => a + m.slots.length, 0));
check("no measure reports as verified while any slot is empty",
  MEASURES.every((m) => verificationOf(m).state !== "verified" || m.slots.every((s) => s.filled !== null)));

console.log(failures === 0 ? "\nAll policy tests passed." : `\n${failures} failing.`);
process.exit(failures === 0 ? 0 : 1);
