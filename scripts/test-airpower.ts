/**
 * The three judgements the airpower tracker makes, each pinned.
 *
 * All three are places where a wrong answer is a plausible number in the right
 * units — the failure mode this whole repository is built against. A quantity
 * parser that reads "F-16" as sixteen, a region function that silently drops
 * half the planet, and a bounding-box check that never fires all produce
 * output that looks exactly like correct output.
 */
import { countIn } from "../scripts/etl/connectors/air-inventory";
import { regionOf } from "../scripts/etl/connectors/mil-traffic";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let failures = 0;
function check(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`  ${ok ? "pass" : "FAIL"}  ${name}${ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
}

/**
 * The quantity column of a Wikipedia inventory table is free text.
 *
 * Every one of these forms appears in the articles this reads, and each has a
 * right answer that is not obvious from the cell alone.
 */
console.log("A fleet count comes out of a free-text cell, or does not come out");
{
  check("a bare number is a count", countIn("270"), 270);
  check("a thousands separator is not two numbers", countIn("1,430"), 1430);
  check("an approximation is still a count", countIn("~36"), 36);
  check("so is one with a footnote marker", countIn("36[a]"), 36);
  check("an order behind a delivery is not added to it", countIn("12 (24 on order)"), 12);
  check("'36 of 36 delivered' is thirty-six", countIn("36 of 36 delivered"), 36);

  // The failures, which matter more than the successes.
  check("an empty cell is not zero", countIn(""), null);
  check("a dash is not zero", countIn("—"), null);
  check("an en dash is not zero either", countIn("–"), null);
  check("prose with no digits yields nothing", countIn("On order"), null);
  /*
   * The one that would be invisible. If a table's columns shift — a rowspan
   * above, a merged header — a designation can land in the quantity column,
   * and "F-16" read as sixteen is a plausible fleet size for a small air
   * force. It has to refuse rather than guess.
   */
  check("a designation is not a quantity", countIn("F-16"), null);
  check("nor is a Russian one", countIn("Su-30"), null);
  check("nor one with a slash", countIn("MiG-29/35"), null);

  /**
   * The citation cases, which are the ones that actually shipped.
   *
   * A multi-line citation template used to be split into extra table cells,
   * shifting every column after it and dropping URL and title fragments into
   * the quantity column. The parser is fixed; these hold the second line of
   * defence, because a wrong fleet size is invisible downstream.
   */
  check("a URL is not a fleet", countIn("url=https://www.flightglobal.com/download"), null);
  check("nor is a citation title", countIn("title=World Air Forces 2026 |url=https:/"), null);
  check("nor a short-form citation", countIn("Flight Global|2023|p=33-34}}"), null);
  check("nor a template fragment", countIn("{{cite web |date=2025-12-01"), null);
  check("a bare year alone in the cell is a year, not a count", countIn("2023"), null);
  check("but a four-digit fleet with a separator is a count", countIn("1,430"), 1430);
  check("and a real count beside a note still reads", countIn("108 (incl. 2 prototypes)"), 108);
}

/**
 * Regions must partition the planet, because an unhandled coordinate would
 * silently vanish from the composition chart rather than appear as an error.
 */
console.log("\nEvery point on earth lands in some region");
{
  const missed: string[] = [];
  const seen = new Set<string>();
  for (let lat = -85; lat <= 85; lat += 5) {
    for (let lon = -175; lon <= 175; lon += 5) {
      const r = regionOf(lat, lon);
      if (!r) missed.push(`${lat},${lon}`);
      seen.add(r);
    }
  }
  check("no coordinate falls through", missed.length, 0);
  check("and the regions are more than a single bucket", seen.size > 5, true);

  // A few anchors, so a future edit that shifts a boundary shows up here.
  check("Delhi is South Asia", regionOf(28.6, 77.2), "South Asia");
  check("Beijing is East Asia", regionOf(39.9, 116.4), "East Asia");
  check("Ramstein is Europe", regionOf(49.4, 7.6), "Europe");
  check("Nevada is North America", regionOf(36.2, -115.0), "North America");
  check("the Gulf is its own region", regionOf(25.3, 51.5), "West Asia and the Gulf");
}

/**
 * The airbase connector refuses rather than publishes when Overpass ignores a
 * bounding box. The probe could not settle that — its paired request was
 * throttled — so the check lives in the connector and this asserts it is there
 * and is fatal.
 *
 * A source check, not a behaviour test: running the connector needs the
 * network, and the property worth holding is that the refusal exists at all.
 * The failure it guards against is a world map of per-country counts built on
 * a filter that did nothing, which would look completely normal.
 */
console.log("\nThe airbase connector refuses a filter that did nothing");
{
  const src = readFileSync(join(process.cwd(), "scripts/etl/connectors/airbases.ts"), "utf8");
  check("it checks returned elements against the box it asked for", /outsideBox\+\+/.test(src), true);
  check("and throws rather than warning", /throw new Error\([\s\S]{0,200}outsideBox/.test(src), true);
  check("it refuses to publish an empty catalogue", /refusing to publish an empty catalogue/.test(src), true);
}

/**
 * The live feed's own limits have to reach the reader, not just the commit
 * message. A connector whose caveats live only in its source comments will
 * eventually feed a page that states none of them.
 */
console.log("\nThe live-traffic connector publishes its own limits");
{
  const src = readFileSync(join(process.cwd(), "scripts/etl/connectors/mil-traffic.ts"), "utf8");
  check("it says absence from the feed is not absence from the sky",
    /Absence from these feeds is not absence from the sky/.test(src), true);
  check("it reads two independent feeds", /adsb\.lol/.test(src) && /adsb\.fi/.test(src), true);
  check("it records how far they agree", /agreement/.test(src), true);
  check("it rounds positions rather than publishing them exactly",
    /toFixed\(1\)/.test(src), true);
  check("it refuses to append a snapshot when no feed answered",
    /refusing to append an empty snapshot/.test(src), true);
}

/**
 * Three faults the self-describing ingest found, each held in place.
 *
 * All three were published numbers that looked entirely normal, and all three
 * were visible only because the connector reports the headers it met and the
 * columns it chose rather than just its results.
 */
console.log("\nThe inventory connector's column rules");
{
  const src = readFileSync(join(process.cwd(), "scripts/etl/connectors/air-inventory.ts"), "utf8");
  const svcRe = /const serviceAt = columnIndex\(headers, ([^)]+)\)/.exec(src)?.[1] ?? "";

  /*
   * A Name+Type table is equipment, not aircraft. Dropping "Name" from the
   * patterns was not enough on its own — the table matched on its "Type"
   * column instead and the same rows came back with "man-portable air-defense
   * system" where the aircraft name should be. The rule has to be about the
   * table's shape.
   */
  check("the aircraft column is decided by the table's shape",
    /aircraftAt >= 0 \? aircraftAt : \(nameAt >= 0 \? -1 : typeColAt\)/.test(src), true);
  check("an explicit Aircraft or Model column wins", /\^\(aircraft\|model\)/.test(src), true);
  check("and a Name column with no Aircraft column disqualifies the table",
    /nameAt >= 0 \? -1/.test(src), true);

  // Three United States tables headed "Inventory" were skipped for want of a
  // preposition — 109 rows, most of the American fleet.
  check("\"Inventory\" alone is a quantity column", /inventory/.test(svcRe), true);
  check("and so is \"In service\"", /in service/.test(svcRe), true);

  // The Russian list divides its table with rows holding only a section name.
  check("a row with only one filled cell is a section divider, not an aircraft",
    /is a section divider/.test(src), true);
}

console.log(failures === 0 ? "\nAll airpower tests passed." : `\n${failures} airpower test(s) failed.`);
if (failures > 0) process.exit(1);
