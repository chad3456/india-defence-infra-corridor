/**
 * The one judgement the Sindoor connector makes, and it is the whole thing.
 *
 * "India struck nine sites" and "India said it struck nine sites" are
 * different sentences. A timeline that flattens the second into the first has
 * taken a side in a dispute between two nuclear-armed states, and it would
 * read as more authoritative for having done so.
 *
 * So the claimant classifier is tested against the constructions the article
 * actually uses, including the ones it must REFUSE to attribute.
 */
import { claimantOf, citationsIn, sentencesOf } from "../scripts/etl/connectors/sindoor";
import { isMilitaryStory, themesOf, countriesOf } from "../scripts/etl/connectors/warstories";

let failures = 0;
function check(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`  ${ok ? "pass" : "FAIL"}  ${name}${ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
}

console.log("A claim is attributed to whoever made it, or to nobody");
{
  check("an Indian military statement is India's claim",
    claimantOf("The Indian Army said it had struck nine sites on 7 May.").claimant, "India");
  check("an ISPR statement is Pakistan's claim",
    claimantOf("ISPR announced that five aircraft had been downed on 7 May.").claimant, "Pakistan");
  check("a wire agency is a third party",
    claimantOf("Reuters reported on 8 May that debris had been recovered.").claimant, "third-party");

  /*
   * The two that matter most.
   *
   * A bare assertion reads as settled fact and is not — the article did not
   * name a source in that sentence, and crediting it to the country it
   * mentions would manufacture an attribution.
   */
  check("a bare assertion is not credited to the country it names",
    claimantOf("India struck Muridke and Bahawalpur in the early hours of 7 May.").claimant,
    "unattributed");
  check("and it is not marked as reported speech",
    claimantOf("India struck Muridke and Bahawalpur in the early hours of 7 May.").reported, false);

  /*
   * A sentence naming both sides belongs to neither. Assigning it to whichever
   * keyword happened to come first in a list would be arbitrary, and these are
   * exactly the contested claims.
   */
  check("a sentence carrying both accounts is attributed to neither",
    claimantOf("The Indian Air Force denied the loss; Pakistan's military repeated the claim.").claimant,
    "third-party");

  check("reported speech is flagged",
    claimantOf("Pakistan said on 10 May that it had begun retaliatory strikes.").reported, true);
}

console.log("\nA citation survives being read out of its own sentence");
{
  const raw = 'Strikes began on 7 May.<ref>{{cite news |title=India strikes |work=Reuters '
    + '|url=https://example.org/a |date=2025-05-07}}</ref>';
  const cites = citationsIn(raw);
  check("the reference is found", cites.length, 1);
  check("its publisher is read", cites[0]?.publisher, "Reuters");
  check("its url is kept", cites[0]?.url, "https://example.org/a");
  check("a sentence with no reference yields none", citationsIn("Strikes began on 7 May.").length, 0);
}

console.log("\nSplitting into sentences does not cut a citation in half");
{
  /*
   * A naive split on ". " lands inside every `|date=2025-05-07` and inside
   * "U.S.", so a reference would be torn between two sentences and its URL
   * attached to the wrong one.
   */
  const para = 'Strikes began on 7 May.<ref>{{cite news |title=A |work=Reuters '
    + '|url=https://example.org/a |date=2025-05-07}}</ref> The U.S. called for calm on 8 May.'
    + '<ref>{{cite news |title=B |work=AP |url=https://example.org/b}}</ref>';
  const out = sentencesOf(para);
  check("two sentences, not more", out.length, 2);
  check("the first keeps its own citation", citationsIn(out[0] ?? "").map((c) => c.publisher), ["Reuters"]);
  check("the second keeps its own", citationsIn(out[1] ?? "").map((c) => c.publisher), ["AP"]);
}

/**
 * The story engine's two filters, which both have to fire.
 *
 * "AI" and "drone" appear constantly in civil reporting. A register that let
 * a theme match alone through would be a register of technology news wearing a
 * military name, and its country chart would be a chart of which countries
 * make consumer drones.
 */
console.log("\nA story is kept only when it is military AND on theme");
{
  check("a military AI story is kept",
    isMilitaryStory("Army fields AI-enabled targeting system for artillery"), true);
  check("a drone strike story is kept",
    isMilitaryStory("Air force says loitering munition destroyed armoured column"), true);

  // The refusals.
  check("a consumer drone story is not military",
    isMilitaryStory("DJI launches new quadcopter for wedding photographers"), false);
  check("a civil AI story is not military",
    isMilitaryStory("Hospital deploys machine learning to read scans faster"), false);
  check("a military story with no theme is not kept",
    isMilitaryStory("Army orders 400 new trucks from domestic supplier"), false);
}

console.log("\nThemes and countries come out of the headline, or do not");
{
  check("a headline can carry several themes",
    themesOf("Autonomous drone swarm tested for ISR and targeting").sort(),
    ["autonomy", "drone", "targeting"]);
  check("a headline naming nothing carries no theme", themesOf("Budget passes committee"), []);

  check("India is recognised by more than its name",
    countriesOf("DRDO tests new loitering munition").map((c) => c.iso), ["IND"]);
  check("two countries are both kept",
    countriesOf("Ukraine says Russian drones struck Kyiv").map((c) => c.iso).sort(),
    ["RUS", "UKR"]);
  /*
   * The list is fixed on purpose. A general place-name extractor over
   * headlines produces confident nonsense — Georgia and Jordan are people,
   * Turkey is a bird — and none of those errors would be visible in a country
   * chart.
   */
  check("an unlisted place yields no country", countriesOf("Chad signs border accord"), []);
}

console.log(failures === 0 ? "\nAll Sindoor tests passed." : `\n${failures} Sindoor test(s) failed.`);
if (failures > 0) process.exit(1);
