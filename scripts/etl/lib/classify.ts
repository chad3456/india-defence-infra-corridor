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

/**
 * A development is something that was *done*, not something that was said or
 * analysed. This gate is what separates the two.
 *
 * Sector keywords alone are not enough: a High Court judgment whose body
 * mentioned the army twice became a defence pin, an opinion column about river
 * linking became an infrastructure pin, and a speech about innovation became a
 * startup pin. None of them reported anything happening anywhere. Requiring a
 * completed or committed action in the headline or the lede removes that whole
 * class of false pin.
 */
export const ACTION_RE =
  /\b(inaugurat\w*|foundation stone|commission(ed|ing|s)?|approv(e|ed|es|al)|clear(ed|s|ance)|sanction(ed|s)?|launch(ed|es|ing)?|open(ed|s|ing)?|complet(ed|es|ion)|award(ed|s)?|order(ed|s)?|contract|sign(ed|s)?|test-fir\w*|test(ed|s)?|induct(ed|s|ion)?|deliver(ed|s|y)?|invest(ed|ment|ments|s|ing)?|expand(ed|s|ing|sion)?|set up|begin(s|ning)?|began|start(ed|s)?|roll(ed)? out|unveil(ed|s)?|acquir(e|ed|es)|build(s|ing)?|built|construct(ed|ion)?|handed over|flag(ged|s)? off)\b/i;

/** True when the text reports an action, not just a topic. */
export function reportsAction(text: string): boolean {
  return ACTION_RE.test(text);
}

/** Occurrences of a rule's pattern in a block of text. */
function countMatches(re: RegExp, text: string): number {
  const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  return (text.match(global) ?? []).length;
}

/**
 * Categorise, treating the headline as authoritative and the body as evidence
 * that needs corroborating.
 *
 * A single body mention is not enough. A story about the PM CARES fund was
 * filed under defence because its body mentioned DRDO once in passing — the
 * body of a long article touches many sectors, and one keyword says nothing
 * about what the article is *about*. Requiring two occurrences discriminates
 * between a subject and an aside.
 */
export function categorise(headline: string, body = ""): EventCategory | null {
  for (const rule of EVENT_RULES) if (rule.re.test(headline)) return rule.category;
  if (!body) return null;
  for (const rule of EVENT_RULES) {
    if (countMatches(rule.re, body) >= 2) return rule.category;
  }
  return null;
}

/** How much of the body counts as the lede for location purposes. */
const LEDE_CHARS = 600;

/**
 * Locate an item, preferring the headline, then the lede.
 *
 * Later paragraphs name places incidentally — an analyst quoted from Mumbai, a
 * comparison with Chennai, a company's registered office. News writing puts the
 * where in the first paragraph or two, so only the lede is trusted as a
 * fallback. Reading the whole body pinned a national story about the PM CARES
 * fund to Tamil Nadu.
 */
export function locate(title: string, body = ""): Place | null {
  const fromTitle = detectPlace(title);
  if (fromTitle) return fromTitle;
  if (!body) return null;
  return detectPlace(body.slice(0, LEDE_CHARS));
}

/** Stable id from a URL, so re-ingesting the same article updates rather than duplicates. */
export function idFor(prefix: string, url: string): string {
  return `${prefix}:${Buffer.from(url).toString("base64url").slice(0, 28)}`;
}
