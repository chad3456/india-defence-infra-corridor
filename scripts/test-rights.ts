/**
 * The one distinction that decides whether a page on the SC/ST Act is honest.
 *
 * The Act is argued about through the acquittal rate, offered as proof that it
 * is abused. It is not proof of that. An acquittal can follow from a false
 * complaint; it can equally follow from a hostile witness, from intimidation
 * of the complainant, from an investigation that never gathered the
 * caste-certificate evidence the statute requires, or from a compromise
 * reached outside court. India's own official record discusses all of these
 * and no public dataset separates them.
 *
 * So four things must stay apart: the law operating, a court acquitting,
 * somebody alleging misuse, and a court finding a specific complaint false.
 * Only the last is evidence of misuse. Merging the second into the fourth is
 * the specific error that makes most writing on this subject wrong, and it is
 * easy to make because the merged number is larger and reads as more decisive.
 *
 * These tests exist so that error cannot be reintroduced quietly.
 */
import { subjectOf, facetOf } from "../scripts/etl/connectors/rights-news";
import { yearOf, parseResults, textOf } from "../scripts/etl/connectors/scst-judgments";

let failures = 0;
function check(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`  ${ok ? "pass" : "FAIL"}  ${name}${ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
}

console.log("A headline is about the Act, the scheme, or neither");
{
  check("the Act by name", subjectOf("SC/ST Act case filed against MLA"), "scst");
  check("an atrocity report", subjectOf("Dalit man assaulted in Bihar village"), "scst");
  check("the scheme by name", subjectOf("PM SHRI schools get Rs 200 crore"), "pmshri");
  check("a hyphenated spelling", subjectOf("PM-SHRI rollout begins in Assam"), "pmshri");
  check("an unrelated headline is neither", subjectOf("Monsoon session to begin Monday"), null);
  check("a caste-adjacent but off-subject headline is still neither",
    subjectOf("Cricket board announces new selection panel"), null);
}

console.log("\nThe four tiers stay apart");
{
  // USE — the Act operating.
  check("a conviction is use", facetOf("Court convicts three under SC/ST Act", "scst"), "use");
  check("an atrocity is use", facetOf("Dalit family assaulted, FIR registered", "scst"), "use");

  // ACQUITTAL — a court acquitting, which is NOT a misuse finding.
  check("an acquittal is an acquittal", facetOf("Court acquits five in SC/ST Act case", "scst"), "acquittal");
  check("a discharge is an acquittal", facetOf("Accused discharged in atrocities case", "scst"), "acquittal");

  // ALLEGATION — somebody saying it.
  check("somebody alleging misuse is an allegation",
    facetOf("MLA says SC/ST Act is being misused for blackmail", "scst"), "allegation");
  /*
   * The ordering test that matters most. An argument built on an acquittal is
   * still an argument, and filing it under `acquittal` would let an opinion
   * enter the record as a court event.
   */
  check("an argument built on an acquittal is the argument, not the acquittal",
    facetOf("Acquittals show SC/ST Act is misused, says association", "scst"), "allegation");

  // FALSE-FINDING — the only tier that is evidence of misuse.
  check("a court finding a complaint false is a false-finding",
    facetOf("High Court quashes FIR, calls complaint false", "scst"), "false-finding");
  check("action ordered against a complainant is a false-finding",
    facetOf("Court orders action against complainant in atrocities case", "scst"), "false-finding");
  check("a fabricated case is a false-finding",
    facetOf("SC/ST case against doctor was fabricated, court holds", "scst"), "false-finding");

  /*
   * The refusal that protects the tiers. An acquittal must never be promoted
   * into evidence of misuse just because both words appear in the corpus.
   */
  const acquittals = [
    "Court acquits all accused in SC/ST Act case",
    "Three acquitted in Dalit assault case after witnesses turn hostile",
    "Accused given benefit of doubt in atrocities trial",
  ];
  for (const h of acquittals) {
    check(`"${h.slice(0, 44)}…" is not a false-finding`,
      facetOf(h, "scst") === "false-finding", false);
  }
}

console.log("\nPM SHRI's facets are about money and consent");
{
  check("a state refusing the memorandum is a dispute",
    facetOf("Tamil Nadu refuses to sign PM SHRI MoU", "pmshri"), "dispute");
  check("withheld funds is a dispute",
    facetOf("Centre withheld Samagra Shiksha funds over PM SHRI, says minister", "pmshri"), "dispute");
  check("a sanction is use",
    facetOf("200 PM SHRI schools sanctioned in Madhya Pradesh", "pmshri"), "use");
}

console.log("\nA judgment's year comes off the end of its title");
{
  check("a plain title", yearOf("Rajesh vs State Of Madhya Pradesh on 12 March, 2019"), 2019);
  /*
   * The trap. A party name or a case number routinely carries a year, and
   * taking the first would file a 2019 judgment under 2011.
   */
  check("a case number in the party name does not win",
    yearOf("Criminal Appeal 204 Of 2011 vs State Of Bihar on 3 May, 2019"), 2019);
  check("a year before the Act existed is refused", yearOf("Some Case vs State on 4 June, 1971"), null);
  check("a title with no year yields none", yearOf("Ramesh vs State Of Kerala"), null);
}

console.log("\nSearch results parse, or report that they did not");
{
  const html = `
<div class="result">
<div class="result_title"><a href="/doc/1217049/">Rajesh vs State Of M.P. on 12 March, 2019</a></div>
<div class="docsource">Madhya Pradesh High Court</div>
<p>the appellant was acquitted by the trial court of the offence under the
Scheduled Castes and Scheduled Tribes (Prevention of Atrocities) Act</p>
</div>
<div class="result">
<div class="result_title"><a href="/doc/998877/">Suresh vs State Of Bihar on 1 July, 2021</a></div>
<div class="docsource">Patna High Court</div>
<p>the complaint was found to be false and the FIR is quashed</p>
</div>`;
  const rows = parseResults(html);
  check("both results are found", rows.length, 2);
  check("the doc id is read", rows[0]?.docId, "1217049");
  check("the court is read", rows[1]?.court, "Patna High Court");
  check("the snippet carries the text", /acquitted/.test(rows[0]?.snippet ?? ""), true);
  /*
   * A layout change must produce zero results rather than wrong ones, so the
   * run reports a page that yielded nothing and stops rather than carrying on
   * against a page it no longer understands.
   */
  check("markup it does not recognise yields nothing",
    parseResults("<div class='something-else'>text</div>").length, 0);
  check("tags are stripped from text", textOf("<b>Patna</b> High&nbsp;Court"), "Patna High Court");
}

console.log(failures === 0 ? "\nAll rights tests passed." : `\n${failures} rights test(s) failed.`);
if (failures > 0) process.exit(1);
