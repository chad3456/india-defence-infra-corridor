import { loadMela, INTRO_NARRATION } from "@/lib/mela";
import type { Metric } from "@/lib/mela-shared";
import { Eyebrow, Headline, Standfirst, Mark, Sources, WhatThisCannotSay } from "@/components/stories/Kit";
import Mela from "@/components/mela/Mela";

/**
 * The Vikas Mela: three terms of government, as a fair you can walk round.
 *
 * ── What the page promises, and the one thing it refuses ─────────────────
 *
 * Every number is read from a series already committed to this site, with its
 * source, its tier and the date it was checked. Every programme is verified
 * against the article it is sourced to before it appears. And every stall
 * shows the numbers that did not go the government's way beside the ones that
 * did — manufacturing's shrinking share on the factory, falling R&D spending on
 * the rocket, the defence corridors' fifteen per cent on the fort — because a
 * tour of a record that showed only its best rooms would be an advertisement.
 *
 * What it refuses is causation. A number that rose after a scheme launched
 * did not necessarily rise because of it, and most of these were rising
 * before 2014. The decade-before comparison is there so a reader can see
 * whether the pace changed; it cannot say who changed it.
 */

export const metadata = {
  title: "The Vikas Mela: three terms, eleven stalls · Bharat Tracker",
  description:
    "An interactive anime fairground of India's government programmes since 2014 — defence, finance, "
    + "manufacturing, innovation, education, rural India and women — with every number sourced and the "
    + "decade before 2014 set beside the years since.",
};

export default function MelaPage() {
  const data = loadMela();
  const c = data.counts;

  /* The figures quoted in the prose are read from the same metrics the stalls
     draw, so the caveats cannot drift from the charts above them. */
  const metric = (id: string): Metric | undefined =>
    data.stalls.flatMap((s) => s.metrics).find((m) => m.id === id);
  const ends = (m: Metric | undefined) => {
    const r = (m?.rungs ?? []).filter((x) => x.obs !== null);
    return { first: r[0]?.obs ?? null, last: r[r.length - 1]?.obs ?? null };
  };
  const mfg = ends(metric("wdi-manufacturing-gdp"));
  const corridor = ends(metric("corridor-grounded-share")).last;

  return (
    <article className="manga pt-8">
      <Eyebrow tone="hot">2014 – 2026 · three terms · an interactive fair</Eyebrow>
      <Headline className="manga-title">The Vikas Mela</Headline>
      <Standfirst>
        Thirteen calendar years and three terms of government, laid out as a fair. Every stall is a sector; every
        ride is a programme; every number on the board comes from a named source with the date it was checked.{" "}
        <Mark>The stalls show what fell as well as what rose</Mark> — and for the World Bank series that reach back far
        enough, they set the years since 2014 beside the decade before, so you can see whether the pace changed and not
        just whether the number went up.
      </Standfirst>

      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[12px]" style={{ color: "var(--story-ink-2)" }}>
        <span><b className="manga-title text-[18px]" style={{ color: "var(--ink)" }}>{data.stalls.length}</b> stalls</span>
        <span><b className="manga-title text-[18px]" style={{ color: "var(--ink)" }}>{c.programmesVerified}</b> programmes verified, of {c.programmesCurated} curated</span>
        <span><b className="manga-title text-[18px]" style={{ color: "var(--ink)" }}>{c.metrics}</b> measures</span>
        <span><b className="manga-title text-[18px]" style={{ color: "var(--ink)" }}>{c.sources}</b> distinct sources</span>
      </div>

      <div className="mt-8">
        <Mela data={data} intro={INTRO_NARRATION} />
      </div>

      {data.unverified.length > 0 && (
        <details className="mt-12 text-[12.5px]">
          <summary className="cursor-pointer font-bold">
            {data.unverified.length} programmes are not shown, because they could not be verified against their source
          </summary>
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {data.unverified.map((u) => (
              <li key={u.name}><span className="font-semibold">{u.name}</span> <span style={{ color: "var(--story-ink-3)" }}>— {u.reason}</span></li>
            ))}
          </ul>
          <p className="mt-3" style={{ color: "var(--story-ink-3)" }}>
            Absence here is a gap in the check, not a judgement on the programme. Most are a wrong article title or
            an article whose opening does not state the launch year; they appear once corrected and re-verified.
          </p>
        </details>
      )}

      <WhatThisCannotSay
        items={[
          {
            q: "Did these programmes cause these changes?",
            a: <>This page cannot say. Most of these indicators were already improving before 2014 and would have
              kept improving. The decade-before comparison shows whether the pace changed — sanitation, electricity,
              clean cooking and internet use all closed their remaining gap faster after 2014 — but a faster pace is
              evidence of a change, not proof of who made it.</>,
          },
          {
            q: "Why do some stalls show numbers going down?",
            a: <>Because they did.{mfg.first && mfg.last ? <> Manufacturing&rsquo;s share of GDP went from{" "}
              {mfg.first.value.toFixed(1)}% in {mfg.first.period} to {mfg.last.value.toFixed(1)}% in {mfg.last.period},
              against the government&rsquo;s own 25% goal;</> : null} R&amp;D spending as a share of GDP fell
              {corridor ? <>; and {corridor.value.toFixed(0)}% of committed defence-corridor investment is on the
              ground</> : null}. A record shown only at its best is not a record.</>,
          },
          {
            q: "Why is the first rung sometimes 2011, or FY2013-14?",
            a: <>Because the start is the nearest reading at or before 2014, printed with its real date, and never
              a reading from after the change of government. Fiscal years are placed at the year they close, so
              FY2013-14 — which ended two months before the change — is the baseline.</>,
          },
          {
            q: "Are dollar figures comparable across the years?",
            a: <>Only loosely. GDP in current US dollars moves with the exchange rate as well as with the economy,
              and the rupee weakened over the period. The growth multiple is what the series says; read it with
              that in mind.</>,
          },
          {
            q: "What does 'verified' mean for a programme?",
            a: <>That its launch year appears in the opening section of the Wikipedia article it links to. It catches
              typing errors and dead titles. It is not proof of the exact launch date, and 2019 and 2024 launches are
              shown under both adjacent terms because a year cannot say which side of a swearing-in they fell.</>,
          },
          {
            q: "Is the guide meant to be the Prime Minister?",
            a: <>He is a caricature, drawn as a friendly tour guide. His lines are written by this site, are
              directions around the fair, and are not quotations. The fair carries no party symbol.</>,
          },
        ]}
      />

      <Sources>
        Measures: World Bank World Development Indicators; PIB and ministry releases for highways, airports, metro,
        ports and defence; SIPRI for arms imports; the PMJDY portal for Jan Dhan accounts — each linked on its card
        with its tier and the date it was checked. Programmes: English Wikipedia, one article each, verified by
        script{c.verifiedOn ? ` on ${c.verifiedOn}` : ""}. Grades: this site&rsquo;s own assessment, unchanged.
        Derived figures — the decade-before comparison and the corridors&rsquo; grounded share — are computed on this
        page and labelled so. No figure is interpolated and none is estimated.
      </Sources>
    </article>
  );
}
