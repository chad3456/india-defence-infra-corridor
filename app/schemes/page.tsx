import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import {
  loadWelfare, centralSchemes, stateSchemes, byMinistry, byDecade, byState,
} from "@/lib/welfare";

/**
 * A hundred welfare schemes, and a coverage column that is almost empty.
 *
 * ── The shape of this page is the finding ────────────────────────────────
 *
 * The roster was easy: ninety-six central schemes with the ministry that runs
 * each and, for most, the year it launched. The coverage was not. Fourteen
 * scheme dashboards were asked what they would give a script and nearly all
 * gave nothing — PMAY-Gramin, Mission Antyodaya, Saubhagya and the MGNREGA
 * report server refused at the connection, Swachh Bharat returned 404,
 * PM-KISAN served a stub, and the government's own myScheme directory, which
 * exists precisely to publish this, answered 401.
 *
 * So the page leads with that rather than burying it. A welfare tracker with a
 * full coverage column would be telling you something Indian scheme
 * dashboards do not publish, and the only way to fill it would be from
 * somewhere it should not come from.
 *
 * ── Why "penetration in villages" is the hardest part of the ask ─────────
 *
 * Because it means four different things depending on the scheme, and the
 * four do not share a column. A household count has a denominator. A village
 * percentage is of villages, not of people, and villages differ in size by
 * orders of magnitude. A beneficiary count has no denominator at all, and
 * supplying one is exactly the step where a tracker invents a number. A state
 * aggregate is not a village-level claim however it is phrased.
 *
 * Mission Antyodaya is the survey that would answer this properly — it
 * measures villages directly — and it is one of the sources that refused.
 */

export const metadata = {
  title: "Welfare schemes · Bharat Tracker",
  description:
    "Ninety-six central government schemes by ministry and launch year, and the reason almost " +
    "none of them publishes coverage a script can read.",
};

export default function SchemesPage() {
  const d = loadWelfare();

  if (!d.present) {
    return (
      <div>
        <PageHeader
          eyebrow="india · what the state promises"
          title="Welfare schemes"
          lede="The roster, and what each scheme publishes about its own reach."
        />
        <p className="mt-8 max-w-[56ch] text-[13.5px] leading-[1.7] text-[color:var(--text-secondary)]">
          The record has not been built in this deployment. It is assembled in CI. Run the{" "}
          <span className="mono">Build the welfare scheme record</span> workflow.
        </p>
      </div>
    );
  }

  const central = centralSchemes(d);
  const state = stateSchemes(d);
  const ministries = byMinistry(d);
  const decades = byDecade(d);
  const states = byState(d);
  const maxMinistry = Math.max(1, ...ministries.map((m) => m.schemes.length));
  const maxDecade = Math.max(1, ...decades.map((x) => x.schemes));
  const dated = central.filter((s) => s.launched !== null).length;

  return (
    <div>
      <PageHeader
        eyebrow="india · what the state promises"
        title="Welfare schemes"
        lede={
          <>
            Central government schemes, by the ministry that runs each and the year it launched.
            What almost none of them will tell a script is how far they have actually reached.
          </>
        }
        stats={[
          { k: "Central schemes", v: String(central.length) },
          { k: "Ministries", v: String(ministries.length) },
          { k: "With a launch year", v: `${dated} of ${central.length}` },
          { k: "Publishing coverage", v: `${d.schemesWithCoverage}` },
        ]}
      />

      {/* ── The gap, stated before anything is drawn ──────────────────── */}
      <section className="mt-8 rounded-lg border border-[color:var(--baseline)] bg-[var(--surface-2)] p-4 sm:p-5">
        <p className="eyebrow">read this first</p>
        <p className="mt-2.5 max-w-[66ch] text-[13.5px] leading-[1.7]">{d.coverageNote}</p>
        {d.refused.length > 0 && (
          <ul className="mt-3.5 m-0 list-none space-y-1 p-0">
            {d.refused.map((r) => (
              <li key={r.source} className="text-[12.5px] leading-[1.55] text-[color:var(--text-secondary)]">
                <span className="font-medium text-[color:var(--text-primary)]">{r.source}</span>
                {" — "}{r.why}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Four grains ───────────────────────────────────────────────── */}
      <section className="mt-12 border-t pt-10">
        <h2 className="display text-[26px] leading-tight sm:text-[32px]">
          Why &ldquo;reach&rdquo; is four different numbers
        </h2>
        <p className="mt-3 max-w-[64ch] text-[13.5px] leading-[1.7] text-[color:var(--text-secondary)]">
          {d.fourGrains}
        </p>
        <p className="mt-3 max-w-[64ch] text-[13px] leading-[1.7] text-[color:var(--text-muted)]">
          Mission Antyodaya is the survey that would answer the village question properly — it
          measures villages directly rather than counting recipients — and it is one of the
          sources that refused.
        </p>
      </section>

      {/* ── Who runs what ─────────────────────────────────────────────── */}
      <section className="mt-12 border-t pt-10">
        <h2 className="display text-[26px] leading-tight sm:text-[32px]">Who runs what</h2>
        <p className="mt-3 max-w-[60ch] text-[13.5px] leading-[1.7] text-[color:var(--text-secondary)]">
          Central schemes by ministry. This counts schemes, not money and not people: a ministry
          with one large programme sits below one with nine small ones.
        </p>
        <div className="mt-6 space-y-2.5">
          {ministries.map((m) => (
            <div key={m.raw} className="flex items-center gap-3">
              <span className="w-[13rem] shrink-0 truncate text-[12.5px]" title={m.raw}>
                {m.ministry}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block h-[10px] rounded-sm" style={{
                  width: `${(m.schemes.length / maxMinistry) * 100}%`,
                  background: "var(--series-1)",
                }} />
              </span>
              <span className="mono w-[2rem] shrink-0 text-right text-[12px]">{m.schemes.length}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── When ──────────────────────────────────────────────────────── */}
      {decades.length > 0 && (
        <section className="mt-12 border-t pt-10">
          <h2 className="display text-[26px] leading-tight sm:text-[32px]">When they were launched</h2>
          <p className="mt-3 max-w-[62ch] text-[13.5px] leading-[1.7] text-[color:var(--text-secondary)]">
            {d.launchYearNote} {central.length - dated} of {central.length} schemes state no year
            in the list and are absent from this chart rather than placed by guess. The recent
            decades are also better recorded than the older ones, so read the shape as a record of
            what is documented, not of what was created.
          </p>
          <div className="mt-6 flex items-end gap-2">
            {decades.map((x) => (
              <div key={x.decade} className="min-w-0 flex-1">
                <div className="flex h-[96px] items-end">
                  <div className="w-full rounded-sm" style={{
                    height: `${(x.schemes / maxDecade) * 100}%`,
                    minHeight: x.schemes > 0 ? 2 : 0,
                    background: "var(--series-1)",
                  }} />
                </div>
                <p className="mono mt-1.5 text-center text-[11px]">{x.schemes}</p>
                <p className="mono text-center text-[10px] text-[color:var(--text-muted)]">
                  {x.decade}s
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── The roster ────────────────────────────────────────────────── */}
      <section className="mt-12 border-t pt-10">
        <h2 className="display text-[26px] leading-tight sm:text-[32px]">The schemes</h2>
        <p className="mt-3 max-w-[60ch] text-[13.5px] leading-[1.7] text-[color:var(--text-secondary)]">
          Newest first where a year is known. Every name links to its own article — this page is
          an index, and the article is where the detail is.
        </p>
        <ul className="mt-6 m-0 list-none space-y-0 p-0">
          {[...central]
            .sort((a, b) => (b.launched ?? 0) - (a.launched ?? 0) || a.name.localeCompare(b.name))
            .map((s) => (
              <li key={s.name} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-[color:var(--hairline)] py-2">
                <span className="mono w-[3rem] shrink-0 text-[11.5px] text-[color:var(--text-muted)]">
                  {s.launched ?? "—"}
                </span>
                <span className="min-w-0 flex-1 text-[13px]">
                  {s.article ? (
                    <a
                      href={`https://en.wikipedia.org/wiki/${encodeURIComponent(s.article.replace(/ /g, "_"))}`}
                      rel="noopener noreferrer nofollow"
                      target="_blank"
                      className="link-underline"
                    >
                      {s.name}
                    </a>
                  ) : s.name}
                </span>
                <span className="mono shrink-0 text-[11px] text-[color:var(--text-muted)]">
                  {s.sector ?? ""}
                </span>
              </li>
            ))}
        </ul>
      </section>

      {/* ── State schemes, kept separate ──────────────────────────────── */}
      {states.length > 0 && (
        <section className="mt-12 border-t pt-10">
          <h2 className="display text-[26px] leading-tight sm:text-[32px]">
            State schemes, counted separately
          </h2>
          <p className="mt-3 max-w-[64ch] text-[13.5px] leading-[1.7] text-[color:var(--text-secondary)]">
            {state.length} schemes run by individual states, kept out of every count above. A
            central scheme runs everywhere and a state scheme runs in one state, and a roster that
            mixes them implies a national programme where there is a regional one. This list is
            also plainly partial — the source article documents some states far better than others,
            so the counts below are a fact about the article rather than about the states.
          </p>
          <div className="mt-6 space-y-5">
            {states.map((g) => (
              <div key={g.state}>
                <p className="text-[13px] font-semibold">
                  {g.state}
                  <span className="mono ml-2 text-[11px] font-normal text-[color:var(--text-muted)]">
                    {g.schemes.length}
                  </span>
                </p>
                <p className="mt-1 text-[12.5px] leading-[1.6] text-[color:var(--text-secondary)]">
                  {g.schemes.map((s) => s.name).join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12 border-t pt-10">
        <p className="text-[12px] leading-[1.6] text-[color:var(--text-muted)]">
          Roster read from {d.rosterSource}.{d.builtAt && ` Built ${d.builtAt.slice(0, 10)}.`} The
          article is an index rather than a register: a scheme absent from it is absent from this
          page, and the ministry abbreviations are the article&rsquo;s own.
        </p>
        <p className="mt-5 text-[12.5px]">
          <Link href="/growth" className="link-underline">
            What the schemes were meant to move: payments, literacy, electrification →
          </Link>
        </p>
      </section>
    </div>
  );
}
