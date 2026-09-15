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
