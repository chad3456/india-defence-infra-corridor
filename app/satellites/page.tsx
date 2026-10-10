import { Eyebrow, Standfirst, Mark, Sources, WhatThisCannotSay } from "@/components/stories/Kit";
import { SatelliteTracker } from "@/components/satellites/SatelliteTracker";
import { GROUPS, INDIAN_FLEET } from "@/lib/tle-source";
import { INDIAN_PREFIXES } from "@/lib/satellites-shared";

/**
 * Live satellite tracker.
 *
 * The page is a shell: the map, the lists and every number in them are
 * computed in the browser by components/satellites/SatelliteTracker.tsx,
 * which propagates CelesTrak's element sets with SGP4 against the clock. What
 * this server component adds is the explanation, and the limits — stated here
 * once, in full, rather than discovered by a reader who trusts a dot.
 */

export const metadata = {
  title: "Satellites, live · Bharat Tracker",
  description:
    "Where a thousand satellites are this second — India's fleet among them — predicted in your browser from CelesTrak's published orbits: "
    + "what is over India now, what is above the horizon from your city, and each satellite's track and the ground it can see.",
};

export default function SatellitesPage() {
  return (
    <div>
      <header className="pt-10">
        <Eyebrow tone="hot">satellites · live · computed in your browser</Eyebrow>
        <h1 className="story-display mt-4 max-w-[19ch] text-[36px] sm:text-[50px] lg:text-[58px]">
          What Is Overhead, This Second.
        </h1>
        <Standfirst>
          Nobody publishes where satellites are. What is published is each one&rsquo;s <Mark>orbit</Mark>, measured
          from the ground and released as a two-line element set; the position at any instant has to be worked out from
          it. This page does that arithmetic in your browser, once a second, for the space stations, Earth-observation,
          science, weather, navigation and geostationary satellites — and for <b>India&rsquo;s own fleet</b>, drawn
          in orange and ringed. Select any dot for its track, its height and the circle of ground it can see.
        </Standfirst>
      </header>

      <div className="mt-8">
        <SatelliteTracker />
      </div>

      <WhatThisCannotSay
        items={[
          {
            q: "What a satellite is photographing",
            a: <>Not answerable, and not attempted. Where a sensor points and when it is switched on is tasking data that nobody publishes. The aqua circle is everything a selected satellite <em>could</em> see from its height — the horizon — not what it is looking at.</>,
          },
          {
            q: "Exactly where it is",
            a: <>Each dot is a prediction from an orbit measured hours or days earlier. Fresh element sets put a low satellite within a kilometre or two; the error grows by kilometres a day, faster in low orbit where the air drags. Every satellite&rsquo;s element-set age is shown when you select it.</>,
          },
          {
            q: "Everything in orbit",
            a: <>About sixteen thousand active objects are catalogued; this carries about a thousand: {GROUPS.map((g) => g.label.toLowerCase()).join(", ")}, and India&rsquo;s fleet. Starlink, two-thirds of everything up there, is left out on purpose — ten thousand dots make one point, which <a href="/internet">the internet page</a> makes with a number. Debris and spent rocket stages are not shown.</>,
          },
          {
            q: "Every Indian satellite",
            a: <>CelesTrak has no &ldquo;operated by India&rdquo; list, so the fleet is found by catalogue name — names starting {INDIAN_PREFIXES.map((p) => p.replace(/-$/, "")).join(", ")}. A satellite named otherwise is missing from the orange set rather than counted as someone else&rsquo;s; Europe&rsquo;s Galileo satellites, catalogued as GSAT0101 and on, are deliberately not matched. Military satellites with withheld orbits are not in the public catalogue at all.</>,
          },
          {
            q: "Whether you can see it",
            a: <>&ldquo;Above the horizon&rdquo; is geometry. Seeing a satellite with your eyes also needs it to be in sunlight while your sky is dark, which is a few hours either side of dusk and dawn.</>,
          },
          {
            q: "What happens when the source is down",
            a: <>The orbits are fetched from CelesTrak at most every six hours. If it does not answer, the page falls back to a weekly copy committed to this site&rsquo;s repository and says so above the map — older orbits labelled as older, never an empty sky.</>,
          },
        ]}
      />

      <Sources>
        Orbits: <a href="https://celestrak.org/NORAD/elements/">CelesTrak</a> general perturbations element sets, groups{" "}
        {GROUPS.map((g) => g.id).join(", ")} and an {INDIAN_FLEET.toLowerCase()} sweep by name; cached six hours. Propagation:
        SGP4 via <a href="https://github.com/shashwatak/satellite-js">satellite.js</a>, run in your browser. Map: Natural Earth via
        world-atlas, and this site&rsquo;s state boundaries for &ldquo;over India&rdquo;. Night side: the Astronomical Almanac&rsquo;s
        low-precision solar position. Times are India Standard Time.
      </Sources>
    </div>
  );
}
