/**
 * What has been added lately, and when.
 *
 * One list, read by two things that must never disagree: the "New" marker
 * beside a link, and the toast that tells a returning reader the thing exists.
 * Keeping them in one place is the whole point — a badge that says New beside
 * a page nobody was told about, or a toast for a page with no badge, are both
 * worse than neither.
 *
 * ── Why a date rather than a boolean ─────────────────────────────────────
 *
 * A `isNew: true` flag has to be turned off by hand, and nobody ever does. Six
 * months later the site is covered in New. A date expires on its own, and the
 * expiry is computed against the reader's clock rather than the build's, so a
 * page that has been prerendered since March cannot go on claiming to be new.
 *
 * ── Adding one ───────────────────────────────────────────────────────────
 *
 * Add the entry the day the feature ships, with that day's date. `id` is
 * permanent — it is the key a reader's browser stores against "I have seen
 * this", so changing it shows the toast again to everyone who already
 * dismissed it.
 */

export interface NewFeature {
  /** Stable forever. Changing it re-announces the feature to everyone. */
  id: string;
  title: string;
  /** One sentence: what it is, not that it is new. */
  blurb: string;
  href: string;
  /** The day it shipped, ISO. */
  since: string;
}

/** How long something stays marked New. Long enough for a fortnightly reader. */
export const NEW_FOR_DAYS = 30;

/**
 * Newest first. Dates are the day the page actually landed on the branch,
 * taken from its first commit rather than estimated.
 */
export const WHATS_NEW: NewFeature[] = [
  {
    id: "protest-watch-2026-10",
    title: "Protest Watch: protests worldwide, live",
    blurb:
      "Every protest the news reports, in 12 languages and 25 editions, refreshed every minute: where, what cause, how covered, and the arrests, " +
      "injuries, deaths and damage reported — every cause, Palestine included, measured by the same rules, with any one comparable to all the rest.",
    href: "/protest-watch",
    since: "2026-10-27",
  },
  {
    id: "free-palestine-inc-2026-10",
    title: "Free Palestine, Inc.? Cause, career, or both",
    blurb:
      "A scrolling visual essay testing the claim that pro-Palestine activism has become a career and a product line: Gaza's toll and economy, " +
      "#FreePalestine's reach, the keffiyeh boom, the fundraising, the protests — and 21 claims in circulation, each checked against the record.",
    href: "/free-palestine-inc",
    since: "2026-10-27",
  },
  {
    id: "demolitions-2026-10",
    title: "Religious structures demolished as encroachments",
    blurb:
      "Temples, mazars, mosques, madrasas, gurdwaras and churches demolished as encroachments since 2014: every official and court figure state by state, " +
      "a documented floor that adds only what does not overlap, cases across faiths, the law behind the drives, both sides' positions and live reporting.",
    href: "/demolitions",
    since: "2026-10-26",
  },
  {
    id: "political-axes-2026-10",
    title: "The 12-axis political test",
    blurb:
      "Twelve separate axes, eight statements each, half pointing each way. Take it yourself, or rate any leader or government on their record with a source per " +
      "answer; compare raters, and lay V-Dem's expert-coded positions for 1,900 parties in 170 countries beside the result.",
    href: "/political-axes",
    since: "2026-10-31",
  },
  {
    id: "youth-nfhs6-themes-2026-10",
    title: "NFHS-6 by theme, and Youth in India 2022",
    blurb:
      "NFHS-6's 101 indicators grouped by subject — health, education, early schooling, marriage, relationships and violence, women and men — with a women-minus-men map " +
      "and computed insights; and MoSPI's Youth in India 2022 read state by state: early marriage, enrolment, gender parity, youth jobs and unemployment.",
    href: "/malnutrition",
    since: "2026-10-29",
  },
  {
    id: "nfhs6-2026-10",
    title: "NFHS-6, every indicator, by state",
    blurb:
      "All 101 indicators of the 2023–24 National Family Health Survey, read from IIPS's own fact sheets, on the dark map: stunting, vaccination, " +
      "schooling, internet use, blood sugar, spousal violence — total, urban and rural, and the change since NFHS-5, with every state's full profile.",
    href: "/malnutrition",
    since: "2026-10-29",
  },
  {
    id: "space-programme-2026-10",
    title: "India's space programme, from Thumba to the Moon",
    blurb:
      "A holographic 3D explainer: every Indian rocket drawn to scale and taken apart stage by stage in a rocket explorer, Chandrayaan-3's route to the Moon, " +
      "the Mars Orbiter's transfer, Aditya-L1's halo round L1, ISRO's centres on the map, and the record — the cryogenic-engine denial, the PSLV's two failures, the money.",
    href: "/space-programme",
    since: "2026-10-28",
  },
  {
    id: "malnutrition-2026-10",
    title: "Where India's children are not growing",
    blurb:
      "A dark, zoomable district map of child stunting, wasting, underweight and anaemia from NFHS-5, coloured by WHO severity thresholds: " +
      "search any district, zoom to a state, compare with the state and India, and see NFHS-6's newer national figures beside it.",
    href: "/malnutrition",
    since: "2026-10-28",
  },
  {
    id: "space-2026-10",
    title: "How a satellite works, and India in space",
    blurb:
      "A holographic 3D explainer: NISAR, the NASA–ISRO radar launched from Sriharikota, taken apart — power, pointing, radar, data, heat — " +
      "with an X-ray explorer, NISAR's live position, ISRO's ground stations, India's fleet in orbit now, and the record: launches, failures, money and imported chips.",
    href: "/space",
    since: "2026-10-27",
  },
  {
    id: "income-tax-2026-10",
    title: "What India's income tax buys",
    blurb:
      "A visual essay on ₹12.41 lakh crore of personal income tax: counted in iPhones, BrahMos, Rafales, carriers, moon missions and AIIMS; " +
      "who pays it, where it goes, your slab in seconds of government, India against the US — and \"I pay taxes, so…\" against the numbers.",
    href: "/income-tax",
    since: "2026-10-26",
  },
  {
    id: "tbm-2026-10",
    title: "The machines that dig India's tunnels",
    blurb:
      "A 3D particle story of India's tunnel boring machines: how one works, every machine reported in India drawn to scale, where they dig, " +
      "which parts are made here, China's export controls from 18 November, and the claim that India now builds 8 m and 15 m TBMs, checked.",
    href: "/tbm",
    since: "2026-10-24",
  },
  {
    id: "nfhs-rounds-2026-10",
    title: "Two decades of the National Family Health Survey",
    blurb:
      "Every NFHS round since 1998–99 compared on the same 23 measures — child deaths, stunting, anaemia, hospital births, vaccination, " +
      "fertility, child marriage, electricity, sanitation — for India, the richest and poorest fifths, towns and villages, and every state.",
    href: "/nfhs",
    since: "2026-10-23",
  },
  {
    id: "district-map-2026-10",
    title: "India by district",
    blurb:
      "Every district indicator Spatial India harmonises from government sources — Census, NFHS-5, NCRB, courts, RBI and more — " +
      "on one district map under the India map, measured values only: estimates are left blank.",
    href: "/map#districts",
    since: "2026-10-23",
  },
  {
    id: "luxury-beliefs-2026-10",
    title: "Luxury beliefs, tested",
    blurb:
      "Rob Henderson's \"luxury beliefs\" tested against Indian data in seven areas — schooling language, farming, climate, prohibition, " +
      "marriage, gender norms, policing — with live headlines and the NFHS broken down by wealth and schooling.",
    href: "/luxury-beliefs",
    since: "2026-10-21",
  },
  {
    id: "instagram-politics-2026-10",
    title: "Politics on Instagram",
    blurb:
      "Dashboards on the BJP, Congress, AAP and the Cockroach Janta Party on Instagram — followers, engagement per post, " +
      "the CJP from launch to the CEC protest, published comment sentiment checked against its own charts, and the bot claims.",
    href: "/instagram-politics",
    since: "2026-10-20",
  },
  {
    id: "france-riots-2026-10",
    title: "France riots, live",
    blurb:
      "The October 2026 riots in France as they are reported: French and English headlines, newsroom videos, " +
      "officials' figures quoted from the reporting, coverage by hour and place, and government notices — refreshed every minute.",
    href: "/france-riots",
    since: "2026-10-18",
  },
  {
    id: "ministries-2026-10",
    title: "Ministries' own records",
    blurb:
      "India's monthly trade read from the Commerce Ministry's releases, and ten years of the Home Ministry's " +
      "monthly reports read item by item — each document pinned in the repository and every figure checked against its text.",
    href: "/ministries",
    since: "2026-10-15",
  },
  {
    id: "public-order-2026-10",
    title: "Protest and public order",
    blurb:
      "Thirty-four charts on riots since 2004, what police recorded them as being about, cases for destroying " +
      "public property, police and civilians killed and injured, and twenty-one major episodes — every figure checked against its source's text.",
    href: "/protests",
    since: "2026-10-13",
  },
  {
    id: "live-tracker-2026-10",
    title: "Live",
    blurb:
      "India's market indices and the rupee, military aircraft broadcasting over South Asia, and the last day's " +
      "economy and defence headlines — refreshed while the page is open, and labelled as live readings, not the record.",
    href: "/live",
    since: "2026-10-13",
  },
  {
    id: "elections-section-2026-10",
    title: "Elections",
    blurb:
      "Elections now has its own section: an overview, Lok Sabha 2024 as a chamber of 543 seats, every " +
      "state assembly against its majority line, and the SIR's roll deletions by reason.",
    href: "/elections",
    since: "2026-10-11",
  },
  {
    id: "election-atlas-2026-10",
    title: "Election atlas",
    blurb:
      "India shaded by who governs each state. Every state opens its Assembly and Lok Sabha results " +
      "seat by seat from ECI's own archived pages, and the SIR's roll deletions by the reason given.",
    href: "/elections/atlas",
    since: "2026-10-11",
  },
  {
    id: "delhi-protest-2026-10-10",
    title: "Delhi, 10 October",
    blurb:
      "The Cockroach Janta Party protest and the police operation that stopped it: where, under which " +
      "orders, detention counts by source, and each side's account in its own words, with a live wire.",
    href: "/protests/delhi-2026-10-10",
    since: "2026-10-10",
  },
  {
    id: "satellites-live-2026-10",
    title: "Satellites, live",
    blurb:
      "Where a thousand satellites are this second, India's fleet among them, predicted in your " +
      "browser from published orbits — what is over India now and what is above your city.",
    href: "/satellites",
    since: "2026-10-10",
  },
  {
    id: "world-tracker-2026-09",
    title: "World tracker",
    blurb:
      "Every chart Our World in Data publishes, discovered from its own index and mapped one at " +
      "a time — each with the unit and citation its producer gives it.",
    href: "/world",
    since: "2026-09-17",
  },
  {
    id: "growth-100-2026-09",
    title: "A hundred indicators",
    blurb:
      "India across a hundred series, selected by data coverage rather than by direction — so " +
      "the mix of rising and falling is a result, not an edit.",
    href: "/growth-100",
    since: "2026-09-17",
  },
  {
    id: "cinema-2026-09",
    title: "Indian cinema",
    blurb:
      "Hindi's share of Indian film titles roughly halved since 2000, and nothing else tracked " +
      "fell. The decline people describe is a redistribution.",
    href: "/stories/cinema",
    since: "2026-09-17",
  },
  {
    id: "drone-war-2026-09",
    title: "Drones and military AI",
    blurb:
      "A photo-verified archive of 36,000 vehicle losses holds a few dozen drones — and what " +
      "that absence says about every drone figure in circulation.",
    href: "/stories/drone-war",
    since: "2026-09-15",
  },
  {
    id: "drones-strait-2026-09",
    title: "Drones and the Strait",
    blurb:
      "What is measurably at stake for India in a West Asian war — the drones it buys, and the " +
      "cooking gas that has no route out of the Gulf but one.",
    href: "/stories/drones-and-the-strait",
    since: "2026-09-15",
  },
  {
    id: "temples-2026-09",
    title: "Temples of India",
    blurb:
      "Three thousand mapped shrines, and the finding that half of them are in two states — " +
      "which is a fact about who has been entering them before it is one about India.",
    href: "/stories/temples",
    since: "2026-09-15",
  },
  {
    // The id is deliberately unchanged from the three-story launch. Bumping it
    // would re-announce the section to everyone who has already dismissed it,
    // and the section is not new — it has a fourth story and denser charts.
    id: "stories-2026-09",
    title: "Visual stories",
    blurb:
      "Six short, data-led arguments — where India sits in the world chip trade, what the " +
      "defence export figure counts, the gap between farm output and farm income, what India " +
      "has at stake in West Asia, and what a temple atlas can and cannot say.",
    href: "/stories",
    since: "2026-09-15",
  },
  {
    id: "schemes-2026-09",
    title: "Welfare schemes",
    blurb:
      "Ninety-six central schemes by ministry and launch year — and the reason almost none of " +
      "them publishes coverage a script can read.",
    href: "/schemes",
    since: "2026-09-14",
  },
  {
    id: "statewise-2026-09",
    title: "Transport by state",
    blurb:
      "Airports, metro lines and railway stations per state — with the three measures that " +
      "could not be sourced named rather than estimated.",
    href: "/statewise",
    since: "2026-09-14",
  },
  {
    id: "ai-2026-09",
    title: "AI in India",
    blurb:
      "What Indian labs have actually published, read from the model registries — set against " +
      "the frontier record, with no funding figures because none could be sourced.",
    href: "/ai",
    since: "2026-09-14",
  },
  {
    id: "drones-2026-09",
    title: "How the world uses military drones",
    blurb:
      "Eighteen types and the countries recorded as operating each, mapped by supplier — with " +
      "the reach of each producer set beside what an operator list cannot tell you.",
    href: "/drones",
    since: "2026-09-14",
  },
  {
    id: "deals-2026-09",
    title: "Defence deals, read from the releases",
    blurb:
      "Indian defence acquisition announcements taken from the government's own press releases, " +
      "with contracts, cabinet clearances, acceptances of necessity and deliveries counted apart.",
    href: "/deals",
    since: "2026-09-14",
  },
  {
    id: "state-explorer-2026-09",
    title: "Click any state on the front page",
    blurb:
      "The front page map answers a click: pick temples, airports or metro lines and a state, " +
      "and it names what is there and what the record says about each one.",
    href: "/",
    since: "2026-09-14",
  },
  {
    id: "disputed-2026-09",
    title: "A disputed list",
    blurb:
      "One contested 1990 catalogue of religious sites, mapped and read as a claim rather than " +
      "as a finding.",
    href: "/disputed",
    since: "2026-09-11",
  },
  {
    id: "sacred-2026-09",
    title: "The sacred landscape",
    blurb:
      "Three thousand temples and shrines by deity, age and heritage status, with the " +
      "place-name changes that trace how the map itself was rewritten.",
    href: "/sacred",
    since: "2026-09-10",
  },
  {
    id: "global-economy-2026-09",
    title: "Global economy tracker",
    blurb: "A hundred indicators putting India beside the economies it is usually compared with.",
    href: "/global",
    since: "2026-09-09",
  },
  {
    id: "arsenal-2026-09",
    title: "Arsenal",
    blurb: "Missile programmes by nation, and the transfers moving between them.",
    href: "/arsenal",
    since: "2026-09-09",
  },
];

const DAY = 86_400_000;

/** Whether a feature is still inside its window, against a clock you pass in. */
export function isNew(f: NewFeature, now: number): boolean {
  const t = Date.parse(f.since);
  if (!Number.isFinite(t)) return false;
  // A future date is a typo, and a typo should not light up the whole nav.
  if (t > now + DAY) return false;
  return now - t < NEW_FOR_DAYS * DAY;
}

/** Everything still new, newest first. */
export function currentlyNew(now: number): NewFeature[] {
  return WHATS_NEW.filter((f) => isNew(f, now))
    .sort((a, b) => Date.parse(b.since) - Date.parse(a.since));
}

/** The feature announcing a given path, if one does. */
export function newFeatureFor(href: string, now: number): NewFeature | undefined {
  return currentlyNew(now).find((f) => f.href === href);
}

/** Where the browser remembers what it has already been shown. */
export const SEEN_KEY = "bharat:announced";

/**
 * Ids this browser has already been shown, and a writer for them.
 *
 * Both swallow every error on purpose. Storage throws in a private window,
 * with site data blocked, and inside a screenshot harness — and a front page
 * that fails to render because a toast could not remember itself would be a
 * far worse bug than a toast shown twice.
 */
export function readSeen(): string[] | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : null;
  } catch {
    return null;
  }
}

export function writeSeen(ids: string[]): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set(ids)].slice(-60)));
  } catch {
    /* nothing to do, and nothing worth breaking the page over */
  }
}

/**
 * What to announce to a reader, given what they have already seen.
 *
 * The rule that matters is the first-visit one: a browser with no stored
 * history is a reader who has never been here, and to them nothing is new. So
 * a first visit announces nothing and silently records everything as seen. The
 * alternative — five toasts stacked on a stranger's first page load — is how
 * this pattern usually goes wrong.
 */
export function toAnnounce(seen: string[] | null, now: number, max = 2): NewFeature[] {
  const live = currentlyNew(now);
  if (seen === null) return [];
  return live.filter((f) => !seen.includes(f.id)).slice(0, max);
}
