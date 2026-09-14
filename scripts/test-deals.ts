/**
 * The deal reader, checked against text before it is let near a network.
 *
 * Every function under test turns prose into a claim, which is the step where
 * a parser most easily produces something plausible and wrong. A release that
 * mentions last year's export total and this year's contract value contains
 * two figures, and a reader that takes the first one is indistinguishable from
 * a correct one until someone checks a number by hand.
 *
 * So the cases here are written from what PIB releases actually look like, and
 * each one names the mistake it exists to catch.
 */
import { existsSync, readFileSync } from "node:fs";
import {
  classify, dateOf, moneyIn, pridsIn, isDefenceAcquisition, distinctValues,
} from "./etl/connectors/defence-deals";

let bad = 0;
function ok(name: string, cond: boolean, detail = ""): void {
  if (!cond) bad++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  " + detail}`);
}

console.log("\nFinding the citations");
{
  const wt = `
   <ref>{{cite web|url=https://pib.gov.in/PressReleasePage.aspx?PRID=1234567|title=x}}</ref>
   <ref>{{cite web|url=http://pib.nic.in/newsite/PrintRelease.aspx?relid=99|title=old}}</ref>
   <ref>{{cite web|url=https://www.pib.gov.in/PressReleseDetail.aspx?PRID=7654321}}</ref>
   <ref>{{cite web|url=https://example.com/x?PRID=111}}</ref>
  `;
  const ids = pridsIn(wt);
  ok("reads a PRID from either PIB host", ids.includes("1234567") && ids.includes("7654321"),
    ids.join(","));
  ok("ignores a PRID on a host that is not PIB", !ids.includes("111"), ids.join(","));
}

console.log("\nTelling the four measures apart");
{
  const cases: Array<[string, string]> = [
    ["acceptance-of-necessity",
      "The Defence Acquisition Council accorded Acceptance of Necessity for procurement of 97 aircraft."],
    ["clearance",
      "The Cabinet Committee on Security has approved the procurement of 26 Rafale Marine aircraft."],
    ["contract",
      "Ministry of Defence signs contract with Hindustan Aeronautics Limited for 156 helicopters."],
    ["delivery",
      "The first batch was handed over to the Indian Air Force at a ceremony in Nashik."],
    ["unclassified",
      "The Raksha Mantri addressed the gathering and complimented the workforce."],
  ];
  for (const [want, text] of cases) {
    const got = classify(text);
    ok(`"${text.slice(0, 44)}…" is ${want}`, got.measure === want, `got ${got.measure}`);
  }
  // Real PIB headlines, verbatim, including every one that the body-based
  // classifier got wrong. These are the cases; everything else is theory.
  const real: Array<[string, string]> = [
    ["contract", "MoD inks two contracts worth Rs 62,700 crore with HAL for supply of 156 LCH, Prachand"],
    ["contract", "Further boost to \u2018Make in India\u2019; MoD signs contracts worth Rs 2580 Cr with Indian Companies"],
    ["contract", "MoD places supply order for 118 Main Battle Tanks Arjun Mk-1A for Indian Army"],
    ["acceptance-of-necessity", "DAC clears proposals worth Rs 2.38 lakh crore to augment defence capabilities"],
    ["clearance", "Union Cabinet approves procurement of 70 HTT-40 Basic Trainer Aircraft from HAL"],
    ["delivery", "DELIVERY OF INDIGENOUS AIRCRAFT CARRIER (IAC) 'VIKRANT'"],
    ["unclassified", "VICE ADMIRAL AJAY KOCHHAR, PVSM, AVSM, NM, ASSUMES CHARGE AS THE 48TH VICE CHIEF OF THE NAVAL STAFF"],
    ["unclassified", "28th EDITION OF SINGAPORE-INDIA MARITIME BILATERAL EXERCISE \u2018SIMBEX\u2019"],
    ["unclassified", "Defence gets Rs 5.94 lakh crore in Budget 2023-24, a jump of 13% over previous year"],
    ["unclassified", "MINISTRY OF DEFENCE - YEAR END REVIEW 2023"],
    ["unclassified", "Information Relating to Inter-Governmental Agreement on Rafale"],
    ["unclassified", "COMMENCEMENT OF SEA TRIALS OF INDIGENOUS AIRCRAFT CARRIER (IAC(P71)) \u2018VIKRANT\u2019"],
  ];
  for (const [want, headline] of real) {
    const got = classify(headline);
    ok(`headline: "${headline.slice(0, 46)}…" is ${want}`, got.measure === want, `got ${got.measure}`);
  }

  // An AoN that also uses the word "contract" must stay an AoN. This is the
  // conflation the whole four-measure split exists to prevent, and it is one
  // ordering mistake away at all times.
  const mixed = classify(
    "The DAC granted Acceptance of Necessity; a contract is expected to be signed next year.");
  ok("an AoN that mentions a future contract is still an AoN",
    mixed.measure === "acceptance-of-necessity", mixed.measure);
  ok("the cue that decided it is recorded", mixed.cue.length > 0);
}

console.log("\nReading a figure only where it is a cost");
{
  const release =
    "Defence exports reached Rs 21,083 crore in the last financial year. " +
    "Ministry of Defence signed a contract with Bharat Electronics Limited at a cost of " +
    "Rs 3,172 crore. The equipment will be delivered over five years.";
  const m = moneyIn(release);
  ok("takes the figure from the cost sentence, not the first on the page",
    m.length === 1 && m[0]!.amount === "3,172", JSON.stringify(m));
  ok("keeps the sentence it was read from", (m[0]?.sentence ?? "").includes("Bharat Electronics"));
  ok("records the unit as written, unconverted", m[0]?.unit === "crore");
  ok("records the currency", m[0]?.currency === "INR");
}
{
  // "Rs 1.45 lakh crore" is one and a half trillion rupees. A unit pattern
  // that matches "lakh" before "lakh crore" reads it as a hundred thousand —
  // wrong by a factor of ten million, and ordinary-looking in a table.
  const dac = "DAC cleared proposals worth Rs 2.38 lakh crore to augment capabilities.";
  const m = moneyIn(dac);
  ok("reads 'lakh crore' as one unit", m[0]?.unit === "lakh crore", JSON.stringify(m));
  ok("and keeps the amount as written", m[0]?.amount === "2.38", JSON.stringify(m));
  const cr = moneyIn("MoD signed contracts worth Rs 2580 Cr with Indian companies.");
  ok("reads PIB's abbreviated 'Cr' as crore", cr[0]?.unit === "crore", JSON.stringify(cr));
}
{
  // PIB serves the body more than once per page, so the same figure arrived
  // six and twelve times per release and the row read as a dozen claims.
  const repeated =
    "The contract is worth Rs 7,523 crore. The contract is worth Rs 7,523 crore. " +
    "The contract is worth Rs 7,523 crore.";
  ok("a figure repeated on the page is recorded once", moneyIn(repeated).length === 1,
    String(moneyIn(repeated).length));
}
{
  const usd = "The deal is valued at US$ 3.1 billion for 31 aircraft.";
  const m = moneyIn(usd);
  ok("reads a dollar figure as USD", m[0]?.currency === "USD" && m[0]?.unit === "billion",
    JSON.stringify(m));
}
{
  const two =
    "The contract is worth Rs 5,000 crore. The total cost including taxes is Rs 5,400 crore.";
  ok("two different figures are both kept", moneyIn(two).length === 2);
  ok("and the row is ambiguous", distinctValues(moneyIn(two)) > 1);
  const same = "The cost is Rs 5,000 crore. The value of Rs 5,000 crore was approved.";
  ok("the same figure stated twice is not ambiguous", distinctValues(moneyIn(same)) === 1);
}

console.log("\nDates are read, never inferred");
{
  // PIB's own stamp, verbatim. The first version of this test accepted null
  // for it behind an "or", which is how the uppercase-abbreviation gap
  // survived a green run.
  ok("reads PIB's own date stamp",
    dateOf("Posted On: 01 AUG 2024 5:14PM by PIB Delhi") === "2024-08-01",
    String(dateOf("Posted On: 01 AUG 2024 5:14PM by PIB Delhi")));
  ok("reads a spelled-out month too",
    dateOf("Posted On: 1 August 2024 5:14PM by PIB Delhi") === "2024-08-01",
    String(dateOf("Posted On: 1 August 2024 5:14PM by PIB Delhi")));
  ok("reads a month given as three letters in mixed case",
    dateOf("Dated 23 Sep 2016") === "2016-09-23", String(dateOf("Dated 23 Sep 2016")));
  ok("a word that is not a month is not a date",
    dateOf("Contract 12 Crore 2024 signed") === null,
    String(dateOf("Contract 12 Crore 2024 signed")));
  ok("returns null rather than guessing", dateOf("No date appears in this release at all") === null);
  ok("rejects an impossible day", dateOf("45 August 2024") === null);
}

console.log("\nThe defence filter needs both halves");
{
  ok("a defence contract passes",
    isDefenceAcquisition("Ministry of Defence signs contract with HAL for 156 helicopters"));
  ok("a ceremonial defence release does not",
    !isDefenceAcquisition("The Raksha Mantri of the Ministry of Defence flagged off a rally"));
  ok("another ministry's contract does not",
    !isDefenceAcquisition("Ministry of Railways signs contract for 200 coaches"));
}

console.log("\nThe built file, if it exists");
const FILE = "data/defence/deals.json";
if (!existsSync(FILE)) {
  console.log("  skip  not built yet — the connector runs in Actions.");
} else {
  interface D {
    prid: string; url: string; measure: string; measureCue: string;
    money: Array<{ amount: string; sentence: string }>; ambiguousValue: boolean; date: string | null;
  }
  const d = JSON.parse(readFileSync(FILE, "utf8")) as {
    deals: D[]; coverageWarning: string; fourMeasures: string; valueNote: string; discovery: string;
    eventNote: string; withValue: number; ambiguous: number; withDate: number; notAnEvent: number;
  };
  ok("every row's URL resolves to its own release id",
    d.deals.every((x) => x.url.endsWith(`PRID=${x.prid}`)));
  ok("every figure carries the sentence it was read from",
    d.deals.every((x) => x.money.every((m) => m.sentence.includes(m.amount))));
  ok("the ambiguous flag matches the rows that carry two figures",
    d.deals.filter((x) => x.ambiguousValue).length === d.ambiguous);
  ok("every row records the cue that classified it", d.deals.every((x) => x.measureCue.length > 0));
  // Nothing unclassified may reach the file at all: a release whose headline
  // names no event is counted as one and dropped, not filed under a measure.
  ok("no unclassified row is in the ledger",
    d.deals.every((x) => x.measure !== "unclassified"),
    d.deals.filter((x) => x.measure === "unclassified").length + " present");
  ok("no figure is recorded twice in one row",
    d.deals.every((x) =>
      new Set(x.money.map((m) => `${m.amount}|${m.sentence.slice(0, 20)}`)).size === x.money.length));
  ok("says why the headline decides", /headline states the event/i.test(d.eventNote));
  ok("the counts in the header match the rows",
    d.withValue === d.deals.filter((x) => x.money.length > 0).length &&
    d.withDate === d.deals.filter((x) => x.date).length);
  ok("says the coverage is a sample and must not be summed",
    /never the set of them/i.test(d.coverageWarning));
  ok("says an AoN is not a contract",
    /many never become contracts/i.test(d.fourMeasures));
  ok("says units are never converted", /never converted/i.test(d.valueNote));
  ok("says the encyclopaedia is discovery, not evidence",
    /only the\s+government's own words/i.test(d.discovery));
  console.log(`        ${d.deals.length} releases read`);
}

console.log(bad === 0 ? "\nAll deal checks passed.\n" : `\n${bad} check(s) failed.\n`);
process.exit(bad === 0 ? 0 : 1);
