import Link from "next/link";
import { Eyebrow } from "@/components/stories/Kit";
import NewBadge from "@/components/ui/NewBadge";

/**
 * The index of visual stories.
 *
 * Five so far, each built on data already in this repository rather than
 * assembled for the occasion — which is the only reason these pages are
 * allowed to be this loud. The register puts a number at 58px; the number has
 * to be one the rest of the site would stand behind at 13px.
 */
export const metadata = {
  title: "Visual stories · Bharat Tracker",
  description:
    "Short, data-led stories on Indian semiconductors, defence manufacturing, farming, drones " +
    "and sacred geography — each built from the sourced series behind the rest of this site.",
};

const STORIES = [
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
  return (
    <div>
      <header className="pt-10">
        <Eyebrow>visual stories</Eyebrow>
        <h1 className="story-display mt-4 max-w-[16ch] text-[40px] sm:text-[56px] lg:text-[64px]">
          Five arguments, told in numbers.
        </h1>
        <p className="mt-5 max-w-[60ch] text-[15px] leading-[1.62]" style={{ color: "var(--story-ink-2)" }}>
          Each of these is built from series already published elsewhere on this site, with the
          same rules about what a figure may claim. The register is louder; the standard for a
          number is not.
        </p>
      </header>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {STORIES.map((s) => (
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
