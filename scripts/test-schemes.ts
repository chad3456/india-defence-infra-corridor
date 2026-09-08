/**
 * Resolving the Jan Dhan columns, and the substring that broke it.
 *
 * The portal heads its two account columns "Beneficiaries at rural/semi-urban
 * centre bank branches" and "Beneficiaries at urban/metro centre bank
 * branches". A plain search for "urban" matches the first of those, so both
 * halves resolved to the rural column and every state came out at exactly
 * twice its rural figure — a number, from the right table, under the right
 * state, and wrong.
 *
 * Nothing about it looked wrong. The arithmetic check caught it, because the
 * table prints its own total and doubled rural does not add up to it.
 */
import { readFileSync } from "node:fs";

let bad = 0;
function ok(name: string, cond: boolean, detail = ""): void {
  if (!cond) bad++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  " + detail}`);
}

/** The resolution rule, mirrored from the connector. */
function resolve(headers: string[]) {
  const idx = (want: RegExp) => headers.findIndex((h) => want.test(h));
  const cRural = idx(/rural/i);
  return {
    cState: idx(/state|ut/i),
    cRural,
    cUrban: headers.findIndex((h, i) => i !== cRural && /urban/i.test(h)),
    cTotal: idx(/total/i),
    cDeposit: idx(/deposit|balance/i),
  };
}

console.log("\nColumn resolution");
{
  // The portal's real headings, as the probe recorded them.
  const real = [
    "S.No", "State Name",
    "Beneficiaries at rural/semi-urban centre bank branches",
    "Beneficiaries at urban/metro centre bank branches",
    "Total Beneficiaries", "Balance in beneficiary accounts", "Deposit",
  ];
  const c = resolve(real);
  ok("the state column resolves", c.cState === 1, String(c.cState));
  ok("the rural column resolves", c.cRural === 2, String(c.cRural));
  // The one that broke: "urban" is inside "rural/semi-urban".
  ok("the urban column is not the rural one", c.cUrban === 3, String(c.cUrban));
  ok("rural and urban are different columns", c.cRural !== c.cUrban);
  ok("the total column resolves", c.cTotal === 4, String(c.cTotal));
}

console.log("\nThe arithmetic check that caught it");
{
  // Row one of the real table: 47,526 + 18,406 = 65,932. It adds up.
  const rural = 47_526, urban = 18_406, stated = 65_932;
  ok("the portal's own row adds up", rural + urban === stated);
  // What the bug produced: rural counted twice.
  const doubled = rural + rural;
  ok("doubled rural does not add up to the stated total", doubled !== stated, `${doubled}`);
  ok("and the gap is large enough to trip a 0.1% tolerance",
    Math.abs(doubled - stated) > Math.max(2, stated * 0.001));
}

console.log("\nThe shipped data");
{
  let data: { rows?: unknown[]; rejected?: unknown[]; asOf?: string | null } | null = null;
  try {
    data = JSON.parse(readFileSync("data/schemes/jan-dhan.json", "utf8"));
  } catch { /* not ingested yet */ }
  if (data === null) {
    console.log("  skip  no data/schemes/jan-dhan.json yet — the ingest has not run");
  } else {
    const rows = (data.rows ?? []) as Array<{ state: string; ruralAccounts: number; urbanAccounts: number; totalAccounts: number }>;
    ok("states were kept", rows.length > 0, `${rows.length} rows, ${(data.rejected ?? []).length} refused`);
    if (rows.length > 0) {
      // India has 36 states and union territories.
      ok("no more rows than India has states and union territories", rows.length <= 45, String(rows.length));
      ok("every row adds up",
        rows.every((r) => Math.abs(r.ruralAccounts + r.urbanAccounts - r.totalAccounts) <= Math.max(2, r.totalAccounts * 0.001)));
      const total = rows.reduce((s, r) => s + r.totalAccounts, 0);
      // Jan Dhan runs to tens of crore. Anything far under is the wrong table.
      ok(`the national total is in the right order (${(total / 1e7).toFixed(1)} crore)`,
        total > 300_000_000 && total < 1_000_000_000, String(total));
      ok("no district slipped in as a state",
        !rows.some((r) => /^(chittoor|bijnor|gorakhpur|jaunpur|guntur)$/i.test(r.state)));
      ok("the figures are dated", typeof data.asOf === "string" && data.asOf.length > 0, String(data.asOf));
    }
  }
}

if (bad > 0) { console.error(`\n${bad} scheme test(s) failed.`); process.exit(1); }
console.log("\nAll scheme tests passed.");
