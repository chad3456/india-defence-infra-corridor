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
    re: /\b(drdo|brahmos|tejas|agni-[iv]|akash missile|missile|test-fire[d]?|indian army|indian navy|indian air force|armed forces|warship|submarine|frigate|destroyer|corvette|ordnance|hindustan aeronautics|bharat dynamics|bharat electronics|mazagon dock|cochin shipyard|garden reach|rafale|sukhoi|artillery|howitzer|border roads|shipbuilding|defen[cs]e (ministry|sector|production|export|exports|deal|order|orders|corridor|budget|forces|procurement|acquisition|contract))\b/i,
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
    re: /\b(port|harbour|container terminal|transshipment|shipyard|jnpa|jnpt|cargo terminal|berth|dredging|sagarmala|waterway|maritime|\bexim\b)\b/i,
  },
  {
    category: "roads-airports",
    re: /\b(highway|expressway|airport|terminal building|runway|\bnhai\b|road project|roads? project|flyover|\budan\b|greenfield airport|ring road|bharatmala|\bnh-?\d+|bypass|elevated corridor|toll road)\b/i,
  },
  {
    category: "energy",
    re: /\b(solar|wind (power|energy|farm)|renewable|nuclear (plant|reactor|power)|power (plant|project|capacity)|transmission line|green hydrogen|electricity|grid|battery storage|thermal (plant|power)|\d+\s?(mw|gw)\b|hydro(electric| power)?|coal (block|mine)|electrification|power purchase)\b/i,
  },
  {
    category: "startups",
    re: /\b(startup|start-up|unicorn|series [a-e] (funding|round)|seed (round|funding)|venture capital|rais(es|ed) (\$|rs|₹)|funding round|pre-ipo|incubator|accelerator)\b/i,
  },
  {
    category: "psu-msme",
    re: /\b(\bpsu\b|public sector undertaking|\bmsme\b|small enterprise|disinvestment|navratna|maharatna|\bsidbi\b)\b/i,
  },
  {
    category: "manufacturing",
    re: /\b(factory|manufactur\w*|semiconductor|chip (fab|plant)|assembly line|production (line|unit|facility|capacity)|\bpli\b|make in india|plant|foundry|industrial (park|estate|corridor)|gigafactory|greenfield (unit|facility|project)|brownfield|fabrication)\b/i,
  },
  {
    category: "infrastructure",
    re: /\b(metro (rail|line|project)|railway|rail (line|project|corridor)|bullet train|smart city|water (project|supply|treatment)|\bdam\b|bridge|urban development|infrastructure|\brrts\b|vande bharat|tunnel|irrigation|canal|township|sewage|logistics park|freight corridor)\b/i,
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

/**
 * Incidents are news, but they are not development.
 *
 * "Fire breaks out in old ATC building of Kolkata Airport" cleared the sector
 * rule (airport) and the action gate (the noun "building"), and became an
 * infrastructure pin. A map of what India built should not mark the places
 * where something went wrong.
 */
/**
 * Court and tribunal proceedings are news about a sector, not development in
 * it. "SC dismisses Karnataka discoms' plea over Adani Power" cleared the
 * energy rule and the action gate and became an energy pin; a High Court
 * judgment did the same under defence. A ruling is not a thing built.
 */
const LEGAL_RE =
  /\b(supreme court|high court|\bsc\b (dismiss|uphold|quash|stay|rule)\w*|tribunal|\bnclt\b|\bnclat\b|bench|plea|petition|verdict|judgment|judgement|ruling|dismiss(es|ed)|uphold(s|ing)?|upheld|quash(es|ed)?|litigation|lawsuit|appeal(s|ed)?)\b/i;

const INCIDENT_RE =
  /\b(fire|blaze|crash(ed|es)?|accident|collision|derail\w*|collapse[ds]?|blast|explosion|killed|dead|death[s]?|injur\w*|arrest\w*|protest\w*|stampede|scam|fraud|probe|raid(ed|s)?|seiz\w*|strike|stir|outage|breach|leak(ed|age)?)\b/i;

/** True when the text reports a development, not a topic or an incident. */
export function reportsAction(text: string): boolean {
  if (INCIDENT_RE.test(text)) return false;
  if (LEGAL_RE.test(text)) return false;
  return ACTION_RE.test(text);
}

/** How much of the body counts as the lede, for both category and location. */
const LEDE_CHARS = 600;

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

  // A body-derived category must clear two bars: mentioned at least twice
  // overall, AND present in the lede. An article genuinely about a sector says
  // so in its first paragraphs; one that mentions it only further down is
  // referring to it, not reporting on it. A visa-services story became a
  // defence pin on two late mentions alone.
  const lede = body.slice(0, LEDE_CHARS);
  for (const rule of EVENT_RULES) {
    if (countMatches(rule.re, body) >= 2 && rule.re.test(lede)) return rule.category;
  }
  return null;
}

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
