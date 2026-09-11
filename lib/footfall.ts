import raw from "@/data/sacred/footfall.json";
import type { Footfall } from "./sacred";

/**
 * Reported footfall, for the two temples where a period is stated.
 *
 * A separate module from the atlas because it is a separate kind of claim: a
 * figure reported by an encyclopaedia, citing onward, about a handful of sites
 * — not a property of the 3,466 on the map. Keeping it apart is what stops it
 * becoming a column that is empty for 3,444 of them.
 */
export function loadFootfall(): Footfall {
  return raw as unknown as Footfall;
}
