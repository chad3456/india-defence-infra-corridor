/**
 * The election parse publishes a row only if the row agrees with itself.
 *
 * Wikipedia's table states a turnout percentage next to the electors and
 * voters it came from, so the parse has a free check available: voters divided
 * by electors must reproduce the stated figure. These cases fix that rule and
 * the state resolver, because the two failure modes they guard are both silent
 * — a swapped column still yields a plausible-looking number, and an
 * unresolved state name simply vanishes from the map rather than erroring.
 */
import { readFile } from "node:fs/promises";
import { STATE_FACTS } from "../lib/census-shared";
import type { ElectionYear } from "./etl/connectors/elections";

let failed = 0;
function ok(name: string, cond: boolean, detail = ""): void {
  if (!cond) failed++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  " + detail}`);
}

const LOK_SABHA_SEATS = 543;

async function main(): Promise<void> {
  let data: { years?: ElectionYear[] } | null = null;
  try {
    data = JSON.parse(await readFile("data/elections/statewise.json", "utf8"));
  } catch {
    console.log("\nElections\n  skip  no data/elections/statewise.json yet — the ingest has not run");
    return;
  }
  const years = data?.years ?? [];
  console.log("\nElections");
  ok("at least one election was parsed", years.length > 0);

  for (const y of years) {
    console.log(`\n  ${y.year} — ${y.rows.length} states, ${y.seatsTotal}/${LOK_SABHA_SEATS} seats`);

    ok(`${y.year}: every state resolves to a polygon on the map`,
      y.rows.every((r) => STATE_FACTS[r.state] !== undefined),
      y.rows.filter((r) => !STATE_FACTS[r.state]).map((r) => r.state).join(", "));

    ok(`${y.year}: no state appears twice`,
      new Set(y.rows.map((r) => r.state)).size === y.rows.length);

    // The check the connector applies, re-applied here against what it wrote.
    const offBy = y.rows
      .map((r) => ({ s: r.state, d: Math.abs((r.voters / r.electors) * 100 - r.turnoutPct) }))
      .filter((x) => x.d > 0.2);
    ok(`${y.year}: every published turnout matches its own voters and electors`,
      offBy.length === 0,
      offBy.map((x) => `${x.s} off by ${x.d.toFixed(2)}pp`).join(", "));

    ok(`${y.year}: turnout is a percentage, not a count`,
      y.rows.every((r) => r.turnoutPct > 20 && r.turnoutPct <= 100),
      y.rows.filter((r) => r.turnoutPct <= 20 || r.turnoutPct > 100).map((r) => `${r.state}=${r.turnoutPct}`).join(", "));

    ok(`${y.year}: voters never exceed electors`,
      y.rows.every((r) => r.voters <= r.electors));

    // Coverage, stated rather than assumed. A short sum means rows were
    // refused; the number says how much of the house is missing.
    ok(`${y.year}: seats account for at least 95% of the Lok Sabha`,
      y.seatsTotal >= LOK_SABHA_SEATS * 0.95,
      `${y.seatsTotal}/${LOK_SABHA_SEATS}`);

    ok(`${y.year}: seats never exceed the house`,
      y.seatsTotal <= LOK_SABHA_SEATS, `${y.seatsTotal}`);

    // National turnout in every general election since 2014 has sat in the
    // sixties. A parse that lands outside that has read the wrong column.
    const nat = (y.rows.reduce((s, r) => s + r.voters, 0) /
                 y.rows.reduce((s, r) => s + r.electors, 0)) * 100;
    ok(`${y.year}: implied national turnout is plausible (${nat.toFixed(1)}%)`,
      nat > 55 && nat < 75);
  }

  if (failed > 0) {
    console.error(`\n${failed} election test(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll election tests passed.");
}

main();
