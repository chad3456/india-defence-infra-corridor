import Link from "next/link";
import { Eyebrow } from "@/components/stories/Kit";
import NewBadge from "@/components/ui/NewBadge";
import { loadSearch, loadCitations, loadJudgments } from "@/lib/rights";

/**
 * The index of visual stories.
 *
 * Each built on data already in this repository rather than
 * assembled for the occasion — which is the only reason these pages are
 * allowed to be this loud. The register puts a number at 58px; the number has
 * to be one the rest of the site would stand behind at 13px.
 */
export const metadata = {
  title: "Visual stories · Bharat Tracker",
  description:
    "Short, data-led stories on semiconductors, defence manufacturing, farming, drones, " +
    "military AI and sacred geography — each built from sourced, checkable series.",
};

const STORIES = [
  {
    href: "/sindoor",
    tone: "hot" as const,
    kicker: "operation sindoor · osint",
    title: "Two Accounts That Do Not Meet.",
    blurb:
      "252 dated statements about one week, each carrying whoever made it and the outlet that " +
      "reported it — with the Indian and Pakistani versions kept apart rather than resolved.",
    stat: "77%",
    statLabel: "of the record names no source inside the sentence",
  },
  {
    href: "/military-ai",
    tone: "mid" as const,
    kicker: "military ai · story engine",
    title: "A Record of What Was Written Down.",
    blurb:
      "An engine reads fourteen defence publishers every four hours and keeps what is both " +
      "military and about AI, autonomy or drones. It maps the press, not the capability.",
    stat: "14/14",
    statLabel: "publishers answering the last sweep",
  },
  {
    href: "/airpower",
    tone: "hot" as const,
    kicker: "airpower · osint",
    title: "Almost None of Military Aviation Is Visible.",
    blurb:
      "Two ADS-B networks together see a few hundred military aircraft worldwide, against " +
      "thousands catalogued — and every type they see is a transport, a tanker or a trainer.",
    stat: "4.5%",
    statLabel: "of catalogued airframes visible, at the best moment on record",
  },
  {
    href: "/stories/semiconductors",
    tone: "hot" as const,
    kicker: "electronics · trade",
    title: "India Buys the World's Chips. It Sells Almost None.",
    blurb:
      "Of the world's twenty-five largest chip importers, India has the lowest export cover " +
      "there is. Five countries are three quarters of the trade.",
    stat: "1.1%",
    statLabel: "cents of chips sold per dollar bought",
  },
  {
    href: "/stories/defence",
    tone: "mid" as const,
    kicker: "defence · manufacturing",
    title: "The Fastest-Growing Number in Indian Industry, and What It Counts.",
    blurb:
      "Defence exports are up more than fiftyfold in a decade. The figure is real, it is an " +
      "authorisation rather than a shipment, and both of those things matter.",
    stat: "₹38,424 cr",
    statLabel: "defence exports, FY2025-26",
  },
  {
    href: "/stories/farmers",
    tone: "cool" as const,
    kicker: "agriculture · productivity",
    title: "India Feeds Itself Twice Over. The Farmer Is Still Waiting.",
    blurb:
      "Cereal output has nearly doubled since 2000 and yields are up by half. Forty-two per cent " +
      "of the workforce still produces sixteen per cent of the output.",
    stat: "391 Mt",
    statLabel: "cereals produced, 2024",
  },
  {
    href: "/stories/cinema",
    tone: "hot" as const,
    kicker: "cinema · language · share",
    title: "Indian Cinema Did Not Shrink. It Moved South.",
    blurb:
      "Hindi's share of Indian film titles fell from about a fifth to about an eighth since " +
      "2000. Nothing else tracked fell — the decline is a redistribution.",
    stat: "12.9%",
    statLabel: "Hindi share of titles, 2017-26",
  },
  {
    href: "/stories/drone-war",
    tone: "hot" as const,
    kicker: "drones · military AI · evidence",
    title: "Thirty-Six Thousand Receipts, and Almost No Drones.",
    blurb:
      "The best archive of the Ukraine war photographs every vehicle lost. Its drone sections " +
      "hold a few dozen. What is verifiable about drones and military AI — and what is not.",
    stat: "0.15%",
    statLabel: "of a photo-verified war archive is drones",
  },
  {
    href: "/stories/drones-and-the-strait",
    tone: "hot" as const,
    kicker: "drones · energy · exposure",
    title: "India Flies Bought Drones and Burns Gulf Gas.",
    blurb:
      "What is measurably at stake for India in a West Asian war. Cooking gas is the exposure " +
      "with no alternative; crude already found one, and not for safety.",
    stat: "99%",
    statLabel: "of India's cooking gas is Gulf-sourced",
  },
  {
    href: "/stories/temples",
    tone: "mid" as const,
    kicker: "sacred geography · coverage",
    title: "Three Thousand Temples, and a Map of Who Has Been Typing.",
    blurb:
      "Half the atlas is in two states and fifteen per cent of it names a deity. The canon " +
      "sets are the one place its coverage can be measured rather than guessed.",
    stat: "3,465",
    statLabel: "sites with coordinates",
  },
];

export default function StoriesIndex() {
  /*
   * Two cards state a live count instead of a frozen one.
   *
   * The other seven quote a figure fixed when they were written, which is
   * right for a story built on a finished series. These two sit on registers
   * that grow every few hours, and a card reading "510 pieces" beside a page
   * reading "948" would be the site contradicting itself on the way in.
   */
  const search = loadSearch();
  const citations = loadCitations();
  const judgments = loadJudgments();
  const actPieces =
    search.items.filter((i) => i.subject === "scst").length + citations.counts.bySubject.scst;
  const shriPieces =
    search.items.filter((i) => i.subject === "pmshri").length + citations.counts.bySubject.pmshri;

  const RIGHTS = [
    {
      href: "/atrocities-act",
      tone: "hot" as const,
      kicker: "the atrocities act · evidence",
      title: "Four Things That Are Not the Same Thing.",
      blurb:
        `${actPieces} pieces of published reporting and ${judgments.counts.judgments} judgments, filed by what they are `
        + "evidence of — because an acquittal is not a finding that a complaint was false, and the "
        + "rate this law is argued through cannot tell the two apart.",
      stat: actPieces.toLocaleString("en-IN"),
      statLabel: "cited pieces, kept in four tiers that never merge",
    },
    {
      href: "/pm-shri",
      tone: "mid" as const,
      kicker: "pm shri · transparency",
      title: "A Scheme That Renders Its Numbers in a Browser.",
      blurb:
        `${shriPieces} pieces on the schools scheme, and no school count anywhere on the page: the portal `
        + "returns the same 1,238 bytes for its front page and for two data paths that do not "
        + "exist, and Parliament's question API answers 404.",
      stat: "1,238",
      statLabel: "bytes the scheme's portal returns, whatever you ask it",
    },
  ];

  const all = [...RIGHTS, ...STORIES];
  /*
   * The count counts.
   *
   * This heading read "Seven arguments" while ten cards sat under it, because
   * a word written once does not notice the array growing beside it. It is the
   * cheapest possible version of the mistake this whole site is about — a
   * confident number nobody rechecked — and it was on the index page.
   */
  const WORDS = [
    "No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen",
    "Nineteen", "Twenty",
  ];
  const count = WORDS[all.length] ?? String(all.length);

  return (
    <div>
      <header className="pt-10">
        <Eyebrow>visual stories</Eyebrow>
        <h1 className="story-display mt-4 max-w-[16ch] text-[40px] sm:text-[56px] lg:text-[64px]">
          {count} arguments, told in numbers.
        </h1>
        <p className="mt-5 max-w-[60ch] text-[15px] leading-[1.62]" style={{ color: "var(--story-ink-2)" }}>
          Each of these is built from series already published elsewhere on this site, with the
          same rules about what a figure may claim. The register is louder; the standard for a
          number is not.
        </p>
      </header>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {all.map((s) => (
          <Link key={s.href} href={s.href} className="story-card block p-6 transition-transform hover:-translate-y-1"
            data-tone={s.tone}>
            <span className="flex flex-wrap items-center gap-2">
              <Eyebrow tone={s.tone}>{s.kicker}</Eyebrow>
              {/* Reads its own expiry off the reader's clock, so a card built
                  in September stops claiming to be new without a redeploy. */}
              <NewBadge href={s.href} />
            </span>
            <p className="story-display mt-4 text-[34px] sm:text-[38px]"
              style={{ color: `var(--s-${s.tone === "hot" ? "hot" : s.tone === "mid" ? "mid" : "cool"})` }}>
              {s.stat}
            </p>
            <p className="mono mt-1.5 text-[10.5px] uppercase tracking-[0.1em]"
              style={{ color: "var(--story-ink-3)" }}>
              {s.statLabel}
            </p>
            <h2 className="story-display mt-5 text-[19px] leading-[1.18]">{s.title}</h2>
            <p className="mt-3 text-[13px] leading-[1.6]" style={{ color: "var(--story-ink-2)" }}>
              {s.blurb}
            </p>
            <p className="mt-4 text-[12.5px] font-semibold"
              style={{ color: `var(--s-${s.tone === "hot" ? "hot" : s.tone === "mid" ? "mid" : "cool"})` }}>
              Read the story →
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
