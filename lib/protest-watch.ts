/**
 * Protest Watch (/protest-watch): every protest the news reports, worldwide,
 * sorted by cause with one set of rules for every cause. No node imports.
 *
 * ── How it stays even-handed ──────────────────────────────────────────────
 *
 * The collector searches only for protest words, in a dozen languages and
 * two dozen national news editions — never for a cause — so no cause is
 * sampled more than the news itself samples it. Each headline is then
 * classified by the same keyword rules, placed by a city or country it names
 * (or left unplaced), and checked for losses: deaths, injuries and arrests
 * count only when the headline ties them to the protest itself, so "rally
 * after 30 killed in airstrike" records no protest deaths. Every figure is
 * what a headline reported, linked, unverified; an event's figure is the
 * largest any of its headlines reported, never a sum of headlines.
 *
 * What it does not do is judge motive. "Performative" is not something a
 * headline can show, so the page reports what can be counted for every cause
 * alike — how many events, where, how covered, how many turned violent — and
 * leaves the judgement to the reader.
 */

export type Cause = "palestine" | "israel" | "war" | "justice" | "labour" | "government" | "cost" | "farmers" | "education" | "rights" | "religion" | "climate" | "other";
export const CAUSES: Array<{ id: Cause; label: string; colour: string; re: RegExp }> = [
  // Order matters: the first rule that matches wins. Pro-Israel terms come before Palestine terms because both name Israel.
  { id: "israel", label: "Pro-Israel, hostages, antisemitism", colour: "var(--series-1)", re: /pro-?israel|stand ?with ?israel|hostages?|bring them home|against antisemitism|antisemitism march|march against antisemitism/i },
  { id: "palestine", label: "Palestine, Gaza", colour: "var(--s-hot)", re: /gaza|palestin|filist[ií]n|فلسطين|غزة|गाज़ा|गाजा|फ़िलिस्तीन|फिलिस्तीन|intifada|keffiyeh|flotilla|anti-?israel|against israel|contre israël|contra israel|gegen israel/i },
  { id: "war", label: "Other wars, peace", colour: "var(--series-4)", re: /ukrain|russia|iran|anti-?war|nato|sudan|congo|kashmir|syria|lebanon|yemen/i },
  { id: "justice", label: "Justice for victims, crime", colour: "#9b4d6b", re: /justice for|murder|killing of|death of|lynch|custodial death|cinayet|asesinato|feminicidio|meurtre|omicidio|assassinato|pembunuhan|مقتل|हत्या|हत्याकांड|मौत के बाद|হত্যা|বিচার দাবি/i },
  { id: "labour", label: "Workers, strikes, pay", colour: "var(--series-2)", re: /\bstrik(e|ers|ing)\b|trade union|\bunions?\b|workers|wage|salar|pension|layoff|grève|huelga|streik|sciopero|greve|sindicat|syndicat|sindacat|gewerkschaft|trabajador|travailleur|lavorator|trabalhador|işçi|grev|buruh|upah|عمال|हड़ताल|कर्मचारी|मजदूर|শ্রমিক|বেতন|doctors|nurses|health workers|asha workers|आशा|anganwadi|आंगनबाड़ी|taxi|drivers|transport|truckers|médecins|médicos|medici|infirmi|enfermer|sağlıkçı|dokter|ডাক্তার/i },
  { id: "farmers", label: "Farmers", colour: "#7a9a3a", re: /farmer|kisan|किसान|agricultur|tractor|agriculteur|campesin|landwirt|agricoltor|agricultor|çiftçi|petani|مزارع|কৃষক/i },
  { id: "cost", label: "Prices, taxes, housing", colour: "var(--series-3)", re: /price|inflation|fuel|petrol|diesel|\btax(es)?\b|cost of living|rent\b|housing|électricité|electricity tariff|subsid|precio|prix|prezz|preço|vivienda|logement|alquiler|loyer|impuesto|impôt|zam|harga|أسعار|ضريب|महंगाई|দাম/i },
  { id: "education", label: "Students, exams, teachers", colour: "#3f7fbf", re: /\bexam|neet|paper leak|tuition|university fees|teachers?\b|school|docentes|maestros|enseignants|professeurs|insegnanti|professores|öğretmen|guru honorer|معلم|शिक्षक|परीक्षा|छात्र|শিক্ষক/i },
  { id: "climate", label: "Climate, environment", colour: "#2e9e83", re: /climate|extinction rebellion|just stop oil|fossil|environment|deforest|mining project|pollution|पर्यावरण/i },
  { id: "rights", label: "Rights, policing, gender, migration", colour: "#8b6fd6", re: /police (brutality|violence|killing)|custodial|racis|\bcaste\b|dalit|women'?s|rape|gender|lgbt|pride|abortion|immigra|migrant|refugee|asylum|deport|free speech|journalist|mujeres|femmes|femminicid|feminicid|violencia de género|kadın|perempuan|نساء|महिला|नारी|দলিত|নারী|ধর্ষণ/i },
  { id: "religion", label: "Religion", colour: "#b07a3a", re: /temple|mosque|church|religio|blasphem|quran|koran|waqf|मंदिर|मस्जिद/i },
  { id: "government", label: "Government, elections, corruption", colour: "var(--story-ink-2)", re: /election|government|president|prime minister|corruption|parliament|regime|opposition|coup|resign|anti-?government|constitution|सरकार|चुनाव|gobierno|gouvernement|regierung|governo|hükümet|pemerintah|presidente|président|corrupción|corruption|elecci|élection|wahl|eleiç|seçim|pemilu|حكومة|رئيس|انتخاب|সরকার|নির্বাচন|DPR|Milei|Lula|Erdoğan|Erdogan/i },
];
export const OTHER = { id: "other" as const, label: "Other or unclear", colour: "var(--story-rule)" };
export const causeOf = (title: string): Cause => CAUSES.find((c) => c.re.test(title))?.id ?? "other";
export const causeMeta = (id: Cause) => CAUSES.find((c) => c.id === id) ?? OTHER;

/**
 * Is a headline about a protest? Protest words in a dozen languages. "Strike" counts unless it is a military
 * strike, and "rally" unless it is a market or motor rally — but a headline with another protest word counts
 * whatever else it mentions ("rally after an airstrike" is still a rally).
 */
const PROTEST = /\bprotest|demonstrat|marchers|\bmarch(ed|es)? (on|to|through|against|in|for)\b|\briots?\b|rioters|sit-in|blockade|encampment|\bvigil\b|manifestation|manifestant|protesta|manifestaci[oó]n|kundgebung|protesto|unjuk rasa|aksi demo|احتجاج|مظاهر|प्रदर्शन|आंदोलन|धरना|বিক্ষোভ/i;
const RALLY = /\brall(y|ies)\b/i, NOT_RALLY = /stocks?|market|shares|sensex|nifty|bitcoin|rupee|dollar|gold|rally (car|driver|championship|finish|stage)|dakar|comeback|crowned|championship|efficiency champion|rally cymru|campaign rally|election rally|poll rally|roadshow|rallied to (win|beat)/i;
const STRIKE = /\bstrike\b|strikers|hunger strike/i, NOT_STRIKE = /(air|drone|missile|military|pre-?emptive|retaliatory|nuclear) ?strikes?|strikes? (on|at|against) (gaza|iran|lebanon|yemen|syria|ukraine|kyiv|targets?)|strike rate|lucky strike|strike force|first strike/i;
/** Turkish "eylem" is both a protest and an "action plan"; only the first counts. */
const EYLEM = /eylem/i, NOT_EYLEM = /eylem plan/i;
export const isProtestHeadline = (t: string) => PROTEST.test(t) || (RALLY.test(t) && !NOT_RALLY.test(t)) || (STRIKE.test(t) && !NOT_STRIKE.test(t)) || (EYLEM.test(t) && !NOT_EYLEM.test(t));

/** Losses a headline ties to the protest itself. Numbers only — "dozens" is not counted. */
export interface Losses { deaths: number | null; injured: number | null; arrested: number | null; damage: boolean; clashes: boolean }
const NUM = String.raw`(\d{1,3}(?:,\d{3})+|\d+)`;
const toN = (s: string) => Number(s.replace(/,/g, ""));
const ACTOR = String.raw`(?:people|protesters|protestors|demonstrators|activists|students|rioters|officers|police(?:men)?|persons)`;
const first = (t: string, res: RegExp[]) => { for (const re of res) { const m = re.exec(t); if (m) return toN(m[1]!); } return null; };
export function lossesOf(t: string): Losses {
  // Deaths count only with a protest actor or a protest setting; a war toll named as the protest's reason is not a protest death.
  const deathCtx = new RegExp(String.raw`clash|riot|police fire|firing|during (the )?(protest|demonstration|rally)|at (a |the )?(protest|rally)|${ACTOR}`, "i").test(t);
  const reason = /(over|after|against|mourn|for|protest(s|ing)?|rally|rallies|march(es)?) [^,.;:]{0,25}\d[\d,]* (people )?(killed|dead|deaths)/i.test(t) && !/(protesters|demonstrators) (killed|dead)/i.test(t);
  const deaths = deathCtx && !reason ? first(t, [
    new RegExp(String.raw`${NUM} ${ACTOR} (?:were |are )?(?:killed|dead|die|died|shot dead)`, "i"),
    new RegExp(String.raw`(?:kills?|killing|killed) ${NUM} ${ACTOR}`, "i"),
    new RegExp(String.raw`${NUM} (?:killed|dead) (?:in|as|during|after) (?:clashes|protests?|riots?|police firing)`, "i"),
    new RegExp(String.raw`death toll (?:rises|climbs|reaches|hits) (?:to )?${NUM}`, "i"),
    new RegExp(String.raw`${NUM} (?:morts|muertos|morti|tote|मौतें|की मौत)`, "i"),
  ]) : null;
  const injured = first(t, [
    new RegExp(String.raw`${NUM} (?:${ACTOR} )?(?:were |are )?(?:injured|wounded|hurt)`, "i"),
    new RegExp(String.raw`(?:injur(?:es|ing)|wound(?:s|ing)) ${NUM}`, "i"),
    new RegExp(String.raw`${NUM} (?:bless[ée]s|heridos|feriti|verletzte?|घायल)`, "i"),
  ]);
  const arrested = first(t, [
    new RegExp(String.raw`${NUM} (?:${ACTOR} )?(?:were |are |have been )?(?:arrested|detained|held|taken into custody|booked)`, "i"),
    new RegExp(String.raw`(?:arrests?|detains?|detained|arrested|holds|booked) ${NUM}`, "i"),
    new RegExp(String.raw`${NUM} arrests`, "i"),
    new RegExp(String.raw`${NUM} (?:interpellations?|interpell[ée]s|arrestations|gardes? à vue|detenidos|arrestados|arrestati|fermati|festnahmen|festgenommen|gözaltı|गिरफ्तार|हिरासत)`, "i"),
  ]);
  return {
    deaths, injured, arrested,
    damage: /torch|set (?:on )?fire|set alight|arson|vandal|loot|smash|ransack|burn(?:ed|t|s)? (?:cars?|vehicles?|buses|shops?|buildings?|tyres)|damage to (?:property|shops)/i.test(t),
    clashes: /clash|tear ?gas|lathi|baton charge|water cannon|rubber bullets|violent|violence|scuffle|stone[- ]pelting|police fir/i.test(t),
  };
}
export type Outcome = "deaths" | "injuries" | "damage" | "arrests" | "clashes" | "none";
export const OUTCOMES: Array<{ id: Outcome; label: string; colour: string }> = [
  { id: "deaths", label: "Deaths reported", colour: "var(--story-ink)" },
  { id: "injuries", label: "Injuries reported", colour: "var(--s-hot)" },
  { id: "damage", label: "Property damage reported", colour: "#d4762c" },
  { id: "arrests", label: "Arrests reported", colour: "var(--series-2)" },
  { id: "clashes", label: "Clashes, no figures", colour: "#c9a227" },
  { id: "none", label: "Nothing reported", colour: "var(--s-cool)" },
];
export const outcomeOf = (l: Losses): Outcome => (l.deaths ? "deaths" : l.injured ? "injuries" : l.damage ? "damage" : l.arrested ? "arrests" : l.clashes ? "clashes" : "none");

/** One headline as stored: title, outlet, link, time, language, and the news edition it came from. */
export interface PwHeadline { t: string; o: string; u: string; p: string | null; l: string; e: string }
export interface PwStatus { id: string; label: string; ok: boolean; count: number; error?: string }
export interface PwRegister { updatedAt: string; status: PwStatus[]; headlines: PwHeadline[]; pulse?: Array<{ t: string; v: number }> }

/** A place a headline can name: a country (by its names) or a city (to its country). Built by the server from the world map. */
export interface PwCountry { iso2: string; name: string; names: string[]; x: number; y: number }
const CITIES: Record<string, string> = {
  london: "GB", manchester: "GB", glasgow: "GB", paris: "FR", marseille: "FR", lyon: "FR", berlin: "DE", hamburg: "DE", munich: "DE", madrid: "ES", barcelona: "ES", rome: "IT", milan: "IT", naples: "IT",
  amsterdam: "NL", brussels: "BE", vienna: "AT", stockholm: "SE", copenhagen: "DK", oslo: "NO", helsinki: "FI", dublin: "IE", lisbon: "PT", athens: "GR", warsaw: "PL", prague: "CZ", budapest: "HU", belgrade: "RS",
  bucharest: "RO", tbilisi: "GE", kyiv: "UA", moscow: "RU", istanbul: "TR", ankara: "TR", "new york": "US", washington: "US", "los angeles": "US", chicago: "US", "san francisco": "US", boston: "US", seattle: "US",
  toronto: "CA", montreal: "CA", vancouver: "CA", "mexico city": "MX", "são paulo": "BR", "sao paulo": "BR", "rio de janeiro": "BR", "buenos aires": "AR", santiago: "CL", bogotá: "CO", bogota: "CO", lima: "PE", caracas: "VE",
  mumbai: "IN", delhi: "IN", "new delhi": "IN", kolkata: "IN", chennai: "IN", bengaluru: "IN", hyderabad: "IN", lucknow: "IN", patna: "IN", jaipur: "IN", srinagar: "IN", karachi: "PK", lahore: "PK", islamabad: "PK",
  dhaka: "BD", kathmandu: "NP", colombo: "LK", kabul: "AF", tehran: "IR", baghdad: "IQ", beirut: "LB", damascus: "SY", amman: "JO", cairo: "EG", riyadh: "SA", dubai: "AE", "tel aviv": "IL", jerusalem: "IL",
  ramallah: "PS", "west bank": "PS", nairobi: "KE", lagos: "NG", abuja: "NG", accra: "GH", johannesburg: "ZA", "cape town": "ZA", addis: "ET", kampala: "UG", khartoum: "SD", tunis: "TN", algiers: "DZ", rabat: "MA",
  jakarta: "ID", "kuala lumpur": "MY", manila: "PH", bangkok: "TH", hanoi: "VN", seoul: "KR", tokyo: "JP", "hong kong": "HK", taipei: "TW", sydney: "AU", melbourne: "AU", auckland: "NZ",
};
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A whole-word match that works in any script: JavaScript's \b only knows Latin letters, so "दिल्ली में" would never match. */
const word = (alts: string[]) => new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])(?:${alts.map(esc).join("|")})(?![\\p{L}\\p{M}\\p{N}])`, "iu");
const CITY_RES = Object.entries(CITIES).map(([city, iso]) => ({ iso, re: word([city]) }));
const compiled = new WeakMap<PwCountry[], Array<{ iso2: string; re: RegExp }>>();
const countryRes = (countries: PwCountry[]) => {
  let c = compiled.get(countries);
  if (!c) { c = countries.map((x) => ({ iso2: x.iso2, re: word(x.names.filter((n) => n.length > 3 || /[^\x00-\x7F]/.test(n) && n.length > 1)) })); compiled.set(countries, c); }
  return c;
};
/** The country a headline is set in, or null. A city wins over a country; Israel and Palestine named only as a cause do not place a protest there. */
export function placeOf(t: string, countries: PwCountry[], cause: Cause): string | null {
  for (const c of CITY_RES) if (c.re.test(t)) return c.iso;
  for (const c of countryRes(countries)) {
    if ((cause === "palestine" || cause === "israel") && (c.iso2 === "IL" || c.iso2 === "PS")) continue;
    if (c.re.test(t)) return c.iso2;
  }
  return null;
}

/** An event: one cause, in one country, on one day, with every headline about it. Losses are the largest any headline reported. */
export interface PwEvent { id: string; cause: Cause; country: string | null; day: string; headlines: PwHeadline[]; losses: Losses; outcome: Outcome; latest: string | null }

export function eventsOf(headlines: PwHeadline[], countries: PwCountry[], sinceIso: string): { events: PwEvent[]; unplaced: Array<PwHeadline & { cause: Cause; losses: Losses; outcome: Outcome }> } {
  const map = new Map<string, PwEvent>();
  const unplaced: Array<PwHeadline & { cause: Cause; losses: Losses; outcome: Outcome }> = [];
  for (const h of headlines) {
    if (!h.p || h.p < sinceIso || !isProtestHeadline(h.t)) continue;
    const cause = causeOf(h.t), country = placeOf(h.t, countries, cause), day = h.p.slice(0, 10);
    const l = lossesOf(h.t);
    // A report that names no place cannot be joined to an event without guessing, so it is kept apart.
    if (!country) { unplaced.push({ ...h, cause, losses: l, outcome: outcomeOf(l) }); continue; }
    const id = `${cause}|${country}|${day}`;
    const e = map.get(id) ?? { id, cause, country, day, headlines: [], losses: { deaths: null, injured: null, arrested: null, damage: false, clashes: false }, outcome: "none" as Outcome, latest: null };
    e.headlines.push(h);
    const mx = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.max(a, b));
    e.losses = { deaths: mx(e.losses.deaths, l.deaths), injured: mx(e.losses.injured, l.injured), arrested: mx(e.losses.arrested, l.arrested), damage: e.losses.damage || l.damage, clashes: e.losses.clashes || l.clashes };
    e.outcome = outcomeOf(e.losses);
    if (!e.latest || h.p > e.latest) e.latest = h.p;
    map.set(id, e);
  }
  return { events: [...map.values()].sort((a, b) => (b.latest ?? "").localeCompare(a.latest ?? "")), unplaced };
}

/**
 * The same measures for every cause. Reports are every headline (placed or not); events, countries and losses
 * come from placed events only; the outcome mix is over reports, so causes that are hard to place are not
 * made to look more peaceful than the rest.
 */
export function byCause(events: PwEvent[], unplaced: Array<{ cause: Cause; outcome: Outcome }>) {
  return [...CAUSES, OTHER].map((c) => {
    const es = events.filter((e) => e.cause === c.id);
    const ups = unplaced.filter((u) => u.cause === c.id);
    const reportOutcomes: Outcome[] = [...es.flatMap((e) => e.headlines.map((h) => outcomeOf(lossesOf(h.t)))), ...ups.map((u) => u.outcome)];
    const outcomes = Object.fromEntries(OUTCOMES.map((o) => [o.id, reportOutcomes.filter((x) => x === o.id).length])) as Record<Outcome, number>;
    const reports = reportOutcomes.length;
    const sum = (k: "deaths" | "injured" | "arrested") => es.reduce((a, e) => a + (e.losses[k] ?? 0), 0);
    return {
      id: c.id as Cause, label: c.label, colour: c.colour,
      reports, events: es.length, unplaced: ups.length,
      headlines: es.reduce((a, e) => a + e.headlines.length, 0),
      countries: new Set(es.map((e) => e.country)).size,
      outcomes,
      violentShare: reports ? reportOutcomes.filter((o) => ["deaths", "injuries", "damage", "clashes"].includes(o)).length / reports : 0,
      deaths: sum("deaths"), injured: sum("injured"), arrested: sum("arrested"),
    };
  }).filter((c) => c.reports > 0).sort((a, b) => b.reports - a.reports);
}

/** What the live page needs: events and aggregates for the window, and the latest headlines. */
export interface PwPayload {
  fetchedAt: string; registerAt: string | null; windowHours: number; status: PwStatus[];
  events: Array<Omit<PwEvent, "headlines"> & { n: number; headlines: PwHeadline[] }>;
  causes: ReturnType<typeof byCause>;
  countries: Array<{ iso2: string; events: number; top: Cause }>;
  latest: PwHeadline[];
  totals: { headlines: number; events: number; countries: number; unplaced: number };
  unplaced: Array<PwHeadline & { cause: Cause; outcome: Outcome }>;
}

export function summarise(headlines: PwHeadline[], countries: PwCountry[], windowHours: number, now = Date.now()): Omit<PwPayload, "fetchedAt" | "registerAt" | "status"> {
  const since = new Date(now - windowHours * 3_600_000).toISOString();
  const { events, unplaced } = eventsOf(headlines, countries, since);
  const perCountry = new Map<string, { events: number; causes: Map<Cause, number> }>();
  for (const e of events) {
    if (!e.country) continue;
    const c = perCountry.get(e.country) ?? { events: 0, causes: new Map() };
    c.events++; c.causes.set(e.cause, (c.causes.get(e.cause) ?? 0) + 1);
    perCountry.set(e.country, c);
  }
  const inWindow = headlines.filter((h) => h.p && h.p >= since && isProtestHeadline(h.t));
  return {
    windowHours,
    events: events.slice(0, 400).map((e) => ({ ...e, n: e.headlines.length, headlines: e.headlines.slice(0, 4) })),
    causes: byCause(events, unplaced),
    countries: [...perCountry].map(([iso2, v]) => ({ iso2, events: v.events, top: [...v.causes].sort((a, b) => b[1] - a[1])[0]![0] })).sort((a, b) => b.events - a.events),
    latest: inWindow.sort((a, b) => (b.p ?? "").localeCompare(a.p ?? "")).slice(0, 60),
    totals: { headlines: inWindow.length, events: events.length, countries: perCountry.size, unplaced: unplaced.length },
    unplaced: unplaced.sort((a, b) => (b.p ?? "").localeCompare(a.p ?? "")).slice(0, 80).map(({ losses: _l, ...u }) => u),
  };
}

/** The searches the collector runs: protest words only, per language and news edition. Never a cause. */
export const EDITIONS: Array<{ id: string; hl: string; gl: string; ceid: string; q: string }> = [
  ...["US", "GB", "IN", "AU", "CA", "ZA", "NG", "KE", "PK", "PH", "SG", "IE", "NZ"].map((gl) => ({ id: `en-${gl}`, hl: `en-${gl}`, gl, ceid: `${gl}:en`, q: "protest OR protesters OR demonstrators OR rally" })),
  { id: "fr-FR", hl: "fr", gl: "FR", ceid: "FR:fr", q: "manifestation OR manifestants" },
  { id: "es-ES", hl: "es", gl: "ES", ceid: "ES:es", q: "protesta OR manifestantes" },
  { id: "es-MX", hl: "es-419", gl: "MX", ceid: "MX:es-419", q: "protesta OR manifestantes" },
  { id: "es-AR", hl: "es-419", gl: "AR", ceid: "AR:es-419", q: "protesta OR manifestantes" },
  { id: "de-DE", hl: "de", gl: "DE", ceid: "DE:de", q: "Protest OR Demonstration OR Kundgebung" },
  { id: "pt-BR", hl: "pt-BR", gl: "BR", ceid: "BR:pt-419", q: "protesto OR manifestantes" },
  { id: "it-IT", hl: "it", gl: "IT", ceid: "IT:it", q: "protesta OR manifestanti OR corteo" },
  { id: "tr-TR", hl: "tr", gl: "TR", ceid: "TR:tr", q: "protesto OR protestocular" },
  { id: "id-ID", hl: "id", gl: "ID", ceid: "ID:id", q: "demo OR \"unjuk rasa\"" },
  { id: "ar-EG", hl: "ar", gl: "EG", ceid: "EG:ar", q: "احتجاج OR مظاهرة" },
  { id: "hi-IN", hl: "hi", gl: "IN", ceid: "IN:hi", q: "प्रदर्शन OR धरना OR आंदोलन" },
  { id: "bn-BD", hl: "bn", gl: "BD", ceid: "BD:bn", q: "বিক্ষোভ" },
];
export const editionUrl = (e: (typeof EDITIONS)[number], when = "1d") => `https://news.google.com/rss/search?q=${encodeURIComponent(`${e.q} when:${when}`)}&hl=${e.hl}&gl=${e.gl}&ceid=${e.ceid}`;
