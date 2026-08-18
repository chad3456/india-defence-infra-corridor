/**
 * Classification: what sector is this, and where did it happen.
 *
 * Rules are ordered and the first match wins, so a story about an airport
 * expressway lands in roads-airports rather than generic infrastructure.
 *
 * Deliberately narrow. An item matching no rule stays a headline in the tracker
 * and never becomes a map pin — a mis-categorised pin is worse than an absent
 * one, and precision matters more than volume when every pin claims something
 * specific happened somewhere specific.
 */
import type { EventCategory } from "../../../lib/types";
import { detectPlace, type Place } from "../../../lib/gazetteer";

export const EVENT_RULES: Array<{ category: EventCategory; re: RegExp }> = [
  {
    category: "space",
    re: /\b(isro|pslv|gslv|lvm3|sslv|gaganyaan|chandrayaan|aditya-l1|spadex|satellite launch|launch vehicle|space station|in-space|skyroot|agnikul|nsil)\b/i,
  },
  {
    category: "defence",
    re: /\b(drdo|brahmos|tejas|agni-[iv]|akash missile|missile test|test-fire[d]?|indian army|indian navy|indian air force|warship|submarine|frigate|destroyer|corvette|defence ministry|ministry of defence|defence acquisition|defence corridor|ordnance|hindustan aeronautics|bharat dynamics|bharat electronics|mazagon dock|cochin shipyard|garden reach|rafale|sukhoi|artillery|howitzer)\b/i,
  },
  {
    category: "trade-deals",
    re: /\b(free trade agreement|\bfta\b|trade pact|trade deal|bilateral trade|cepa|ceca|trade agreement|mou (signed|with)|memorandum of understanding)\b/i,
  },
  {
    category: "exports",
    re: /\b(export (record|order|deal|growth|surge|target)|exports (rose|rise|rises|jump|jumped|surge|surged|hit|grew|up)|first consignment|shipment to|outbound shipment)\b/i,
  },
  {
    category: "pipelines",
    re: /\b(gas pipeline|oil pipeline|lng terminal|pipeline project|city gas distribution|\bgail\b|cross-country pipeline)\b/i,
  },
  {
    category: "ports",
    re: /\b(port|harbour|container terminal|transshipment|shipyard|jnpa|jnpt|cargo terminal|berth|dredging|sagarmala)\b/i,
  },
  {
    category: "roads-airports",
    re: /\b(highway|expressway|airport|terminal building|runway|\bnhai\b|road project|flyover|\budan\b|greenfield airport|ring road|corridor road|bharatmala)\b/i,
  },
  {
    category: "energy",
    re: /\b(solar|wind power|renewable|nuclear (plant|reactor|power)|power plant|transmission line|green hydrogen|electricity grid|battery storage|thermal plant|\bmw\b solar|\bgw\b|hydro(electric| power)?)\b/i,
  },
  {
    category: "startups",
    re: /\b(startup|start-up|unicorn|series [a-e] (funding|round)|seed round|venture capital|raises \$|raised \$|funding round|pre-ipo)\b/i,
  },
  {
    category: "psu-msme",
    re: /\b(\bpsu\b|public sector undertaking|\bmsme\b|small enterprise|disinvestment|navratna|maharatna|\bsidbi\b)\b/i,
  },
  {
    category: "manufacturing",
    re: /\b(factory|manufacturing (plant|unit|facility)|semiconductor|chip (fab|plant)|assembly line|production line|\bpli\b|make in india|new plant|foundry|industrial park|gigafactory)\b/i,
  },
  {
    category: "infrastructure",
    re: /\b(metro (rail|line|project)|railway|bullet train|smart city|water (project|supply)|\bdam\b|bridge |urban development|infrastructure project|\brrts\b|vande bharat)\b/i,
  },
];

export function categorise(text: string): EventCategory | null {
  for (const rule of EVENT_RULES) if (rule.re.test(text)) return rule.category;
  return null;
}

/**
 * Locate an item, preferring the headline over the body.
 *
 * Body text mentions many places incidentally — an analyst quoted from Mumbai,
 * a comparison with Chennai. The headline names the place the story is about,
 * so it is tried first and the body is only a fallback.
 */
export function locate(title: string, body: string): Place | null {
  return detectPlace(title) ?? detectPlace(body);
}

/** Stable id from a URL, so re-ingesting the same article updates rather than duplicates. */
export function idFor(prefix: string, url: string): string {
  return `${prefix}:${Buffer.from(url).toString("base64url").slice(0, 28)}`;
}
