import Link from "next/link";
import ChartCard from "@/components/charts/ChartCard";
import ConfidenceBadge from "@/components/ui/ConfidenceBadge";
import { getRegistry } from "@/lib/registry";
import { getSeries, definedPoints } from "@/lib/data";
import { ALL_SECURITY_SPECS, SECURITY_SERIES } from "@/lib/security-catalogue";
import SecurityMap from "@/components/map/SecurityMap";
import { TRACKED_STATES, FIRST_YEAR, LAST_YEAR, ROWS } from "@/lib/lwe-states";
import { LIMITS } from "@/lib/security-index";

/**
 * The Defence Tracker.
 *
 * Kept apart from the development map and the main gallery on purpose. That
 * map tracks things being built and filters incidents out; this one tracks
 * violence, which is the opposite question. Blending them would produce a page
 * where a port opening and a bombing are the same kind of pin.
 *
 * The page is organised by question rather than by data source, and it states
 * what it does not yet have. Most of these series are declared and unfilled —
 * saying so on the page is the alternative to a gallery that looks complete
 * because the empty parts are hidden.
 */

export const metadata = {
  title: "Defence tracker",
  description:
    "Terrorism, left-wing extremism and the counter-insurgency record — fatalities, incidents and the constructed posture indices, with every gap stated.",
};

/** Sections in reading order: the question first, the series second. */
const SECTIONS: Array<{
  id: string;
  title: string;
  blurb: string;
  seriesIds: string[];
}> = [
  {
    id: "fatalities",
    title: "Casualties",
    blurb:
      "Deaths by year in both theatres, split by who was killed. Civilians, security forces and adversaries are never summed into a single 'violence' line — the split is the story.",
    seriesIds: [
      "terror-civilians-killed",
      "terror-security-forces-killed",
      "terror-militants-killed",
      "terror-total-fatalities",
      "lwe-civilians-killed",
      "lwe-security-forces-killed",
      "lwe-insurgents-killed",
      "lwe-total-fatalities",
    ],
  },
  {
    id: "incidents",
    title: "Attacks and incidents",
    blurb:
      "Incident counts rather than deaths. A year can have fewer deaths and more attacks, or the reverse, and only reading both tells you which.",
    seriesIds: ["terror-attacks", "lwe-attacks", "jk-stone-pelting-incidents", "protests-recorded"],
  },
  {
    id: "red-corridor",
    title: "The red corridor",
    blurb:
      "Districts classified as affected by left-wing extremism, and the most-affected subset within them. This is the series behind the claim that the corridor has all but closed.",
    seriesIds: ["lwe-affected-districts", "lwe-most-affected-districts"],
  },
  {
    id: "kashmir",
    title: "Kashmir beyond the fatality count",
    blurb:
      "Tourist arrivals against the violence series. Arrivals are the number most often cited as evidence of normalisation, and the one that most needs its caveats read.",
    seriesIds: ["jk-tourist-arrivals"],
  },
  {
    id: "posture",
    title: "Constructed indices",
    blurb:
      "The Tonality Score and Action Index. These are computed here, not reported by anyone, and are the only numbers on this site of which that is true.",
    seriesIds: ["terror-tonality", "terror-action-index", "lwe-tonality", "lwe-action-index"],
  },
  {
    id: "communal",
    title: "Communal violence",
    blurb:
      "MHA and NCRB publish different figures because they count different things — incidents reported by states against cases registered under rioting sections. They belong on separate lines, not blended.",
    seriesIds: ["communal-riots"],
  },
  {
    id: "capability",
    title: "Equipment and supply",
    blurb:
      "What the forces are equipped with and where it comes from — domestic protective equipment, and the supplier mix behind major arms imports.",
    seriesIds: ["bulletproof-jackets-produced", "arms-imports-by-supplier", "iaf-fighter-squadrons", "iaf-squadrons-sanctioned", "advanced-platform-inductions"],
  },
];

export default function DefenceTrackerPage() {
  const registry = getRegistry();
  const chartsFor = (ids: string[]) =>
    ids.flatMap((id) => registry.filter((c) => c.seriesIds.includes(id) && c.transform === "level"));

  const specById = new Map(ALL_SECURITY_SPECS.map((s) => [s.id, s]));
  const filled = ALL_SECURITY_SPECS.filter((s) => getSeries(s.id));
  const awaiting = ALL_SECURITY_SPECS.filter((s) => !getSeries(s.id));
  const points = filled.reduce((n, s) => n + definedPoints(getSeries(s.id)!).length, 0);

  return (
    <div className="max-w-[1180px]">
      <section className="border-b pb-5">
        <p className="eyebrow">defence tracker</p>
        <h1 className="mt-2 text-[24px] font-semibold tracking-tight">
          Terrorism, insurgency and the counter-insurgency record
        </h1>
        <p className="mt-2 max-w-[720px] text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
          Separate from the development map by design. That map tracks what is being built and
          filters incidents out; this tracks violence, which is the opposite question. A port
          opening and a bombing are not the same kind of pin.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-[11px] sm:grid-cols-4">
          <div>
            <dt className="eyebrow">series live</dt>
            <dd className="tnum mt-0.5 text-[15px]">{filled.length}</dd>
          </div>
          <div>
            <dt className="eyebrow">data points</dt>
            <dd className="tnum mt-0.5 text-[15px]">{points}</dd>
          </div>
          <div>
            <dt className="eyebrow">awaiting data</dt>
            <dd className="tnum mt-0.5 text-[15px]">{awaiting.length}</dd>
          </div>
          <div>
            <dt className="eyebrow">theatres</dt>
            <dd className="tnum mt-0.5 text-[15px]">2</dd>
          </div>
        </dl>
      </section>

      {awaiting.length > 0 && (
        <section className="mt-6 rounded-lg border p-4">
          <p className="text-[12px] font-medium">
            {awaiting.length} of {ALL_SECURITY_SPECS.length} series on this page have no data yet
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
            They are listed rather than hidden. Each names the source it is waiting for, and the
            charts render an explicit awaiting-data state instead of an empty axis. A gallery that
            looks complete because its gaps are hidden is the failure this project exists to avoid.
          </p>
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {awaiting.map((s) => (
              <li key={s.id} className="text-[11px] text-[color:var(--text-muted)]">
                <span className="text-[color:var(--text-secondary)]">{s.title}</span>
                {s.filledBy === "satp" ? " — next pipeline run" : " — needs a document read by a person"}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------------- The map ---------------- */}
      <section id="map" className="mt-10">
        <div className="border-b pb-2">
          <h2 className="text-[15px] font-semibold tracking-tight">Where it happened</h2>
        </div>
        <p className="mt-3 max-w-[760px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          The same {ROWS.length} state-year rows behind every left-wing-extremism chart on this
          page, put back on the geography the national series throws away. SATP publishes a
          datasheet for {TRACKED_STATES.length} states, {FIRST_YEAR} to {LAST_YEAR}; the rest are
          drawn as not tracked rather than as zero, because nobody counted there and a pale shade
          would say otherwise.
        </p>
        <div className="mt-5">
          <SecurityMap />
        </div>
        <p className="mt-4 max-w-[760px] text-[11px] leading-relaxed text-[color:var(--text-muted)]">
          One state dominates. Chhattisgarh accounts for roughly a third of all recorded fatalities
          across the period, which is why the shading uses quantiles rather than equal steps — on an
          equal-width scale the map is one dark state and seventeen pale ones in every year, which is
          accurate and tells a reader nothing. Every state&rsquo;s number is listed beside the map so
          nothing rests on telling two shades apart.
        </p>
      </section>

      {SECTIONS.map((section) => {
        const charts = chartsFor(section.seriesIds);
        if (charts.length === 0) return null;
        const live = charts.filter((c) => !c.pending).length;
        return (
          <section key={section.id} id={section.id} className="mt-10">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2">
              <h2 className="text-[15px] font-semibold tracking-tight">{section.title}</h2>
              <p className="tnum text-[11px] text-[color:var(--text-muted)]">
                {live} of {charts.length} live
              </p>
            </div>
            <p className="mt-2 max-w-[720px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
              {section.blurb}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {charts.map((c) => (
                <ChartCard key={c.id} spec={c} />
              ))}
            </div>
            {section.id === "posture" && (
              <div className="mt-4 rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[12px] font-medium">Read this before using either index</p>
                  <ConfidenceBadge level="low" />
                </div>
                <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
                  {LIMITS.slice(0, 3).map((l) => (
                    <li key={l} className="flex gap-2">
                      <span aria-hidden className="text-[color:var(--text-muted)]">
                        —
                      </span>
                      <span>{l}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-[color:var(--text-muted)]">
                  All six limits and the full construction are on{" "}
                  <Link href="/methodology" className="link-underline">
                    methodology
                  </Link>
                  .
                </p>
              </div>
            )}
          </section>
        );
      })}

      <section className="mt-10 border-t pt-5">
        <h2 className="text-[15px] font-semibold tracking-tight">Where these numbers come from</h2>
        <p className="mt-2 max-w-[720px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          Fatality counts come from the SATP datasheets, which are a compilation rather than a
          register — nothing sourced from them is graded above medium confidence. Incident counts,
          district classifications, tourism and communal figures come from MHA annual reports,
          parliamentary answers and NCRB, none of which publish a machine-readable table, so each
          is entered against a citation rather than scraped.
        </p>
        <p className="mt-2 max-w-[720px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          One caution that applies across the whole page: the falls shown here are real, but MHA
          has revised both the LWE district criteria and the basis of several counts during the
          period. A decline is partly control and partly redefinition, and the two cannot be
          separated from the published figures alone.
        </p>
        <p className="mt-3 text-[11px] text-[color:var(--text-muted)]">
          Full catalogue on{" "}
          <Link href="/data-sources" className="link-underline">
            data sources
          </Link>
          , per-figure register on{" "}
          <Link href="/sources" className="link-underline">
            sources
          </Link>
          .{" "}
          {SECURITY_SERIES.length} series are pipeline-filled;{" "}
          {ALL_SECURITY_SPECS.length - SECURITY_SERIES.length} need a document read by a person.
          {specById.size !== ALL_SECURITY_SPECS.length ? " Catalogue ids are not unique." : ""}
        </p>
      </section>
    </div>
  );
}
