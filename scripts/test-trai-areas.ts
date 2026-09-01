/**
 * The TRAI service-area matcher.
 *
 * A live run parsed 15 of 22 areas and withdrew the tele-density series, which
 * was the right call and the wrong outcome: the seven missing areas were on the
 * page all along, spelled differently. These cases pin every variant that
 * defeated the old raw-prefix comparison.
 */
import { matchArea } from "./etl/connectors/trai";

let bad = 0;
function eq(label: string, want: string | null): void {
  const got = matchArea(label);
  if (got === want) console.log(`  ok   ${JSON.stringify(label).padEnd(34)} -> ${got}`);
  else { bad++; console.log(`  FAIL ${JSON.stringify(label).padEnd(34)} -> ${got} (wanted ${want})`); }
}

console.log("the seven that failed a live run");
eq("4 Delhi", "Delhi");
eq("Delhi *", "Delhi");
eq("Jammu and Kashmir", "Jammu & Kashmir");
eq("J&K", "Jammu & Kashmir");
eq("10. Kerala", "Kerala");
eq("Kerala #", "Kerala");
eq("Mumbai *", "Mumbai");
eq("Orissa", "Odisha");
eq("Uttar Pradesh ( East )", "Uttar Pradesh (East)");
eq("UP (West)", "Uttar Pradesh (West)");
eq("Uttar Pradesh(East)", "Uttar Pradesh (East)");

console.log("\nthe source merged both halves of Uttar Pradesh");
eq("Uttar Pradesh (incl. UPE & UPW)*", "Uttar Pradesh");
eq("Uttar Pradesh (incl.", "Uttar Pradesh");
// the merged name must not swallow the split names on older reports
eq("Uttar Pradesh (East)", "Uttar Pradesh (East)");
eq("Uttar Pradesh (West)", "Uttar Pradesh (West)");

console.log("\nstill matches what already worked");
eq("Andhra Pradesh", "Andhra Pradesh");
eq("Madhya Pradesh & Chhattisgarh", "Madhya Pradesh");
eq("West Bengal (incl. Sikkim)", "West Bengal");
eq("North East", "North East");
eq("Tamil Nadu (incl. Chennai)", "Tamil Nadu");

console.log("\nrefuses things that are not areas");
eq("Total", null);
eq("Service Area", null);
eq("", null);
eq("1234", null);
eq("Wireless Tele-density", null);

console.log(bad === 0 ? "\nAll service-area matching tests passed." : `\n${bad} failing.`);
process.exit(bad === 0 ? 0 : 1);
