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
import { yearOf, parseResults, textOf, shapeNote, kindOf } from "../scripts/etl/connectors/scst-judgments";
import { parseCitations, cleanField, citationDate, outletOf } from "../scripts/etl/connectors/rights-citations";

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
   * The snippet bug that hid behind a working parse: slicing from one link to
   * the next gave snippets one character long — "[" — because a result carries
   * a second link to itself a few characters later. A fixed window is coarser
   * and actually contains the prose.
   */
  check("a snippet is prose, not punctuation", (rows[0]?.snippet ?? "").length > 20, true);
  check("a result knows what kind of document it is", rows[0]?.kind, "judgment");
  /*
   * A layout change must produce zero results rather than wrong ones, so the
   * run reports a page that yielded nothing and stops rather than carrying on
   * against a page it no longer understands.
   */
  check("markup it does not recognise yields nothing",
    parseResults("<div class='something-else'>text</div>").length, 0);
  check("tags are stripped from text", textOf("<b>Patna</b> High&nbsp;Court"), "Patna High Court");

  /*
   * The regression this parser exists for. The first version split the page on
   * `<div class="result_title">` and parsed zero results on every page of every
   * query — a class name is a fact about a stylesheet, and stylesheets get
   * rewritten. Results are now found by the one thing a judgment search cannot
   * change without breaking its own permalinks: a link to /doc/<id>/.
   */
  const renamed = `
<li class="listing"><a href="/doc/551122/">Mohan vs State Of Rajasthan on 9 August, 2020</a>
<span class="court-label docsource_main">Rajasthan High Court</span>
<p>conviction under the Atrocities Act is upheld</p></li>`;
  const r2 = parseResults(renamed);
  check("a result is found when the class names have changed", r2.length, 1);
  check("its id survives the rename", r2[0]?.docId, "551122");
  check("its year survives the rename", yearOf(r2[0]?.title ?? ""), 2020);

  /*
   * Two links to one judgment must be one row, not two, or every count in the
   * corpus doubles.
   */
  const twice = `
<div><a href="/doc/771/">Anil vs State Of Gujarat on 2 May, 2018</a><div class="docsource">Gujarat High Court</div>
<p>the appeal is dismissed</p><a href="/doc/771/">full document</a></div>`;
  check("two links to one judgment are one result", parseResults(twice).length, 1);
  check("the longer anchor text is taken as the title",
    /Anil vs State/.test(parseResults(twice)[0]?.title ?? ""), true);

  /*
   * A run that reads nothing must leave behind what it met.
   */
  check("a shape note describes a page it could not read",
    shapeNote("<html><script>var x=1</script><body><a href=\"/doc/9/\">t</a></body></html>").includes("/doc/9/"), true);
  check("a shape note drops scripts",
    shapeNote("<script>SECRETVAR</script><a href=\"/doc/9/\">t</a>").includes("SECRETVAR"), false);
}

console.log("\nA statute is not a case");
{
  /*
   * The error this exists to prevent. The first working walk collected a
   * hundred documents and not one of them was a judgment: Indian Kanoon
   * indexes statutes alongside cases, and a search for the Act's name ranks
   * the Act's own text first. So the corpus was Section 3, Section 14, Section
   * 18 and the Entire Act, each dated 1989, each carrying no outcome — and it
   * looked exactly like a corpus. Counting those as cases would inflate the
   * record by the number of sections in the statute.
   */
  check("a numbered section is a statute",
    kindOf("Section 3 in The Scheduled Castes and the Scheduled Tribes ( Prevention of Atrocities ) Act, 1989"), "statute");
  check("a lettered section is a statute", kindOf("Section 15A in The Scheduled Castes ... Act, 1989"), "statute");
  check("the whole act is a statute", kindOf("Entire Act"), "statute");
  check("a bare act title is a statute", kindOf("The Scheduled Castes and Scheduled Tribes Act, 1989"), "statute");

  check("a dated party title is a judgment",
    kindOf("Rajesh vs State Of Madhya Pradesh on 12 March, 2019"), "judgment");
  check("versus spelled out is a judgment",
    kindOf("Ram Kumar versus State Of Bihar on 3 May, 2019"), "judgment");
  check("an undated party title is still a judgment", kindOf("Suresh vs Union Of India"), "judgment");
  check("something else is unknown, not assumed", kindOf("Law Commission Report No. 262"), "unknown");
}

console.log("\nCitations come out of a reference list whole");
{
  /*
   * The trap. Citation templates nest — a title routinely carries {{ill}} or
   * {{lang}}, and a lazy `\{\{cite[^}]*\}\}` stops at the first inner close,
   * truncating the headline exactly where it gets interesting. So the parser
   * walks braces, and this pins it.
   */
  const nested = "{{cite news|title=Dalit man killed in {{ill|Khairlanji|mr}} village|work=The Hindu|date=30 September 2006|url=https://example.org/a}}";
  const c1 = parseCitations(nested);
  check("a nested template does not truncate the citation", c1.length, 1);
  check("the whole headline survives the nesting",
    cleanField(c1[0]?.fields["title"] ?? ""), "Dalit man killed in village");
  check("the field after the nesting is still read", c1[0]?.fields["work"], "The Hindu");
  check("the url survives", c1[0]?.fields["url"], "https://example.org/a");

  /* A pipe inside a wikilink belongs to the link, not to the field list. */
  const piped = "{{cite news|title=[[Hathras case|The Hathras case]] reported|work=Indian Express|date=2020-10-01}}";
  const c2 = parseCitations(piped);
  check("a piped wikilink is one field", cleanField(c2[0]?.fields["title"] ?? ""), "The Hathras case reported");
  check("the field after a piped link is read", c2[0]?.fields["work"], "Indian Express");

  check("several citations in one body are all found",
    parseCitations("{{cite news|title=One long enough headline}} text {{cite web|title=Two long enough headline}}").length, 2);
  check("an unbalanced citation is skipped, not guessed at",
    parseCitations("{{cite news|title=Truncated").length, 0);
  check("a template that is not a citation is ignored",
    parseCitations("{{infobox|name=Something}}").length, 0);
}

console.log("\nCitation dates normalise, or are dropped");
{
  check("day month year", citationDate("30 September 2006"), "2006-09-30");
  check("month day, year", citationDate("September 30, 2006"), "2006-09-30");
  check("already iso", citationDate("2020-10-01"), "2020-10-01");
  /*
   * A bare year is kept. For a 1991 massacre it is often all there is, and
   * dropping it would push the case out of the record entirely.
   */
  check("a bare year is kept as a year", citationDate("1991"), "1991");
  check("unparseable is null", citationDate("n.d."), null);
  check("empty is null", citationDate(""), null);
}

console.log("\nThe outlet is read from whichever field carries it");
{
  check("work wins", outletOf({ work: "The Hindu", publisher: "THG" }), "The Hindu");
  check("newspaper is read", outletOf({ newspaper: "Times of India" }), "Times of India");
  check("publisher is a fallback", outletOf({ publisher: "Reuters" }), "Reuters");
  check("a wikilinked outlet is cleaned", outletOf({ work: "[[The Hindu]]" }), "The Hindu");
  check("no outlet field yields null", outletOf({ title: "Something" }), null);
}

console.log(failures === 0 ? "\nAll rights tests passed." : `\n${failures} rights test(s) failed.`);
if (failures > 0) process.exit(1);
