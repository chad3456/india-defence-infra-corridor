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
  /*
   * This fixture is the markup Indian Kanoon actually served, recorded by a
   * run that could not read it. Two earlier versions of this parser guessed —
   * first at a CSS class name, then at the permalink — and both produced a
   * corpus-shaped result that was not a corpus.
   *
   * Note the two links to one judgment. The permalink-shaped one, /doc/ID/,
   * is labelled "Full Document"; the title is on the /docfragment/ link.
   * Anchoring on the permalink gave a hundred and fifty-seven documents all
   * titled "Full Document" — correctly identified and completely unusable.
   */
  const html = `
<article class="result" role="listitem">
<h4 class="result_title"> <a href="/docfragment/1841482/?formInput=scheduled%20castes">C.Sathiyanathan vs Veeramuthu on 14 November, 2008</a> </h4>
<div class="docsource">Madras High Court</div>
<div class="headline"> offence punishable under the provisions of the <b>Scheduled</b> <b>Castes</b> and <b>Scheduled</b> <b>Tribes</b> Act, 1989 and the accused was acquitted by the trial court </div>
<a href="/doc/1841482/">Full Document</a>
</article>
<article class="result" role="listitem">
<h4 class="result_title"> <a href="/docfragment/998877/?formInput=x">Suresh vs State Of Bihar on 1 July, 2021</a> </h4>
<div class="docsource">Patna High Court</div>
<div class="headline"> the complaint was found to be false and the FIR is quashed </div>
<a href="/doc/998877/">Full Document</a>
</article>`;
  const rows = parseResults(html);
  check("both results are found", rows.length, 2);
  check("the doc id is read", rows[0]?.docId, "1841482");
  check("the court is read", rows[1]?.court, "Patna High Court");
  check("the court is read on the first result too", rows[0]?.court, "Madras High Court");
  check("the snippet carries the text", /acquitted/.test(rows[0]?.snippet ?? ""), true);

  /*
   * The bug that hid behind a working parse. Anchoring on the permalink took
   * "Full Document" as the title for every result on every page.
   */
  check("the title is the case, not the link label", rows[0]?.title,
    "C.Sathiyanathan vs Veeramuthu on 14 November, 2008");
  check("no result is titled Full Document",
    rows.some((r) => /^full document$/i.test(r.title)), false);
  check("a result is recognised as a judgment", rows[0]?.kind, "judgment");
  check("its year comes off the title", yearOf(rows[0]?.title ?? ""), 2008);

  /* One judgment, two links, one row. */
  check("two links to one judgment are one result",
    parseResults(html.split("</article>")[0] + "</article>").length, 1);

  /* A snippet must be prose, not the punctuation between two links. */
  check("a snippet is prose, not punctuation", (rows[0]?.snippet ?? "").length > 20, true);

  /* One block must not swallow the next result's text. */
  check("a snippet does not swallow the next result",
    /Bihar/.test(rows[0]?.snippet ?? ""), false);

  check("markup it does not recognise yields nothing",
    parseResults("<div class='something-else'>text</div>").length, 0);
  check("tags are stripped from text", textOf("<b>Patna</b> High&nbsp;Court"), "Patna High Court");

  /*
   * A run that reads nothing must leave behind what it met. This is the
   * mechanism that produced the fixture above.
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

console.log("\nA bibliography's title does not make a citation on-subject");
{
  /*
   * The tautology this guards. The subject test used to fall back to the
   * article a citation was cited in, for every article. The article titled
   * "Dalit" then contributed 208 of the first 358 citations — every one
   * qualifying because the word was in the article's own title rather than in
   * the piece being cited. The fallback now applies only to articles about a
   * specific case, where a headline like "Two held in Bihar killing" really is
   * on-subject and would otherwise be lost.
   *
   * This checks the rule directly: an off-subject headline is on-subject only
   * when read together with a case bibliography, never on its own.
   */
  check("an off-subject headline alone is not on subject",
    subjectOf("Two held in Bihar killing"), null);
  /*
   * And keyword-matching the article title would not have rescued the case
   * bibliographies anyway: "Khairlanji massacre" contains no subject word, so
   * the old fallback only ever fired on the articles that made it circular.
   * A case bibliography's subject is asserted by name in the article list
   * instead, and recorded on every citation it admits.
   */
  check("a case bibliography's own title carries no subject keyword",
    subjectOf("Two held in Bihar killing Khairlanji massacre"), null);
  check("a headline that says it itself needs no bibliography",
    subjectOf("Dalit man assaulted in Bihar village"), "scst");
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
