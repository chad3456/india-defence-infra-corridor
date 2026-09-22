import { loadSindoorBook, loadFrames, byAgency, inOrder, concessions } from "@/lib/sindoor-book";
import { Eyebrow, Headline, Standfirst, Mark, Sources, WhatThisCannotSay } from "@/components/stories/Kit";
import { ChartTitle, Caption } from "@/components/stories/Charts";
import InkFilter from "@/components/sindoor/InkFilter";
import Walkthrough from "@/components/sindoor/Walkthrough";

/**
 * Operation Sindoor, walked through, from one named account.
 *
 * ── What is new here, and what is deliberately not ───────────────────────
 *
 * The /sindoor page holds 252 dated statements with the Indian and Pakistani
 * versions kept apart and unresolved. This page does not resolve them either.
 * It takes one account — Lt Gen K.J.S. Dhillon's, the most detailed public
 * Indian one — and walks its sequence, with every claim carrying the weight it
 * can actually bear.
 *
 * The five tiers do that work. The one to read closely is the third: a
 * Pakistani source saying something against Pakistan's own interest. A retired
 * Pakistani Air Marshal telling Pakistani media that an aircraft was destroyed
 * is better evidence of that loss than any Indian claim of it, because it
 * costs the speaker something. Printing an Indian claim and a Pakistani
 * admission at the same weight would be worse than printing neither.
 *
 * ── Why the drawing looks drawn ──────────────────────────────────────────
 *
 * The frames are rendered in Blender as ink on paper, and that is an argument
 * rather than a decoration. A photoreal render of this border would read as
 * evidence about the world. An ink drawing reads as what it is: a diagram
 * somebody made, from sources, with choices in it. On a subject where both
 * governments published incompatible versions and neither can be checked, the
 * honest visual register is the one that does not pretend to be a window.
 *
 * Nothing in the sequence depicts an impact, a blast, a flight path or a loss.
 * Motion is the most persuasive way there is to assert something without
 * citing it, so the only thing that moves is the viewpoint.
 */

export const metadata = {
  title: "Operation Sindoor, walked through · Bharat Tracker",
  description:
    "One named account of Operation Sindoor — nine sites, four days, and eleven airbases — "
    + "drawn as ink on paper, with every claim filed by how much weight it can bear.",
};

export default function SindoorWalkthroughPage() {
  const b = loadSindoorBook();
  const f = loadFrames();

  if (!b.present) {
    return (
      <div className="pt-12">
        <Eyebrow>not built</Eyebrow>
        <Headline>The book record is not in this deployment.</Headline>
        <Standfirst>
          Run <span className="mono">npm run sindoor:book</span> in CI. Every fact on this page is
          verified against the book it is sourced to before it can be published.
        </Standfirst>
      </div>
    );
  }

  const beats = inOrder(b);
  const { IAF, Army } = byAgency(b);
  const conceded = concessions(b);
  const placedTargets = b.targets.filter((t) => t.position !== null).length;

  return (
    <article className="ink -mx-4 mt-6 px-4 pb-16 pt-10 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
      <InkFilter />

      <Eyebrow tone="hot">operation sindoor · one account, walked</Eyebrow>
      <Headline>Nine sites, four days, and one account of them</Headline>
      <Standfirst>
        This is Lt Gen K.J.S. Dhillon&rsquo;s account — the most detailed public Indian record of
        the operation, and <Mark>an Indian record</Mark>. It is not a neutral history and does not
        claim to be. Every fact below was read out of his book and is checked against it on every
        build: {b.counts.targets + b.counts.airbases + b.counts.beats + b.counts.weapons + b.counts.disputes}{" "}
        of them, each carrying a phrase that must still appear in the text, each citing a page read
        from the book&rsquo;s own pagination rather than typed.
      </Standfirst>

      <div className="ink-note mt-6 max-w-[70ch] p-5" data-tilt="l">
        <p className="ink-hand text-[21px] leading-[1.25]">
          The tier to read closely is the third one.
        </p>
        <div className="ink-rule mt-2 w-28" aria-hidden />
        <p className="mt-2.5 text-[13.5px] leading-[1.62]" style={{ color: "var(--story-ink-2)" }}>
          A Pakistani source saying something against Pakistan&rsquo;s own interest is far better
          evidence than any Indian claim of the same thing, because it costs the speaker something.
          There {conceded.length === 1 ? "is" : "are"} <Mark>{conceded.length}</Mark> such
          {conceded.length === 1 ? " admission" : " admissions"} in this record. Printing them at
          the same weight as a claim would be worse than printing neither.
        </p>
      </div>

      {/* ── The walkthrough ────────────────────────────────────────── */}
      {f.present && f.frames.length > 0 ? (
        <Walkthrough
          frames={f.frames}
          beats={beats.map((x) => ({
            id: x.id, date: x.date, label: x.label, what: x.what,
            tier: x.tier, chapter: x.chapter, page: x.page,
          }))}
        />
      ) : (
        <div className="ink-note mt-8 p-5">
          <p className="text-[13.5px]" style={{ color: "var(--story-ink-2)" }}>
            The rendered frames are not in this deployment. Run{" "}
            <span className="mono">npm run sindoor:geo &amp;&amp; npm run sindoor:render</span>.
            The sequence below is the record; the drawing is how it is shown.
          </p>
          <ol className="mt-4 space-y-3">
            {beats.map((x) => (
              <li key={x.id}>
                <span className="mono text-[11px]" style={{ color: "var(--story-ink-3)" }}>{x.date}</span>
                <span className="ml-2 text-[13.5px] font-semibold">{x.label}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ── The nine ───────────────────────────────────────────────── */}
      <section className="mt-16">
        <ChartTitle note="As the book names them: the site, the town, how far inside the border, and which service the book says engaged it.">
          The nine sites named for 7 May
        </ChartTitle>
        <p className="mt-2 max-w-[68ch] text-[13.5px] leading-[1.62]" style={{ color: "var(--story-ink-2)" }}>
          Seven engaged by the Indian Army along the Line of Control and the international border;
          two — Muridke and Bahawalpur — by the Air Force in depth. The descriptions of who used
          each site are <Mark>the author&rsquo;s attributions</Mark>, published as his and not as
          findings of this site.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[...IAF, ...Army].map((t) => (
            <div key={t.id} className="ink-note p-4" data-tilt={t.agency === "IAF" ? "r" : "l"}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="mono text-[10px] font-bold uppercase tracking-[0.1em]"
                  style={{ color: t.agency === "IAF" ? "var(--s-hot)" : "var(--s-mid)" }}>
                  {t.agency === "IAF" ? "air force" : "army"}
                </span>
                <span className="mono text-[10px]" style={{ color: "var(--story-ink-3)" }}>
                  {t.depthKm !== null ? `${t.depthKm} km inside` : "depth not stated"}
                </span>
              </div>
              <h3 className="ink-hand mt-1 text-[23px] leading-[1.12]">{t.name}</h3>
              <p className="text-[12px] font-semibold" style={{ color: "var(--story-ink-2)" }}>
                {t.town} · {t.region}
              </p>
              <div className="ink-rule mt-2 w-16" aria-hidden />
              <p className="mt-2 text-[12.5px] leading-[1.58]" style={{ color: "var(--story-ink-2)" }}>
                {t.what}
              </p>
              <p className="mono mt-2 text-[10px]" style={{ color: "var(--story-ink-3)" }}>
                attributed to {t.group} · {t.chapter}{t.page !== null ? `, p${t.page}` : ""}
              </p>
            </div>
          ))}
        </div>
        <Caption>
          {placedTargets} of {b.counts.targets} resolved to coordinates and appear on the drawing.
          A site whose place could not be resolved is listed here and left off the map rather than
          placed approximately — the same rule the event map follows.
        </Caption>
      </section>

      {/* ── 9–10 May ───────────────────────────────────────────────── */}
      <section className="mt-16">
        <ChartTitle note="Named in the Ministry of External Affairs briefing of 10 May, quoted in the book.">
          The {b.counts.airbases} Pakistani sites named for 9–10 May
        </ChartTitle>
        <div className="mt-4 flex flex-wrap gap-2">
          {b.airbases.map((a) => (
            <span key={a.id} className="ink-note px-3 py-1.5 text-[12.5px]">
              <span className="font-semibold">{a.name}</span>
              <span className="mono ml-2 text-[10px]" style={{ color: "var(--story-ink-3)" }}>
                {a.kind}{a.page !== null ? ` · p${a.page}` : ""}
              </span>
            </span>
          ))}
        </div>
        <Caption>
          India naming what India struck. The same briefing also stated that limited damage was
          sustained at Indian Air Force stations at Udhampur, Pathankot, Adampur and Bhuj — which
          is on this page for the same reason the rest of it is: a claimant conceding a cost is
          worth more than a claimant listing a success.
        </Caption>
      </section>

      {/* ── What the accounts do not settle ────────────────────────── */}
      <section className="mt-16">
        <ChartTitle note="Four questions this record raises and does not answer.">
          What is still not settled
        </ChartTitle>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {b.disputes.map((d) => (
            <div key={d.id} className="ink-note p-5" data-tilt="l">
              <h3 className="ink-hand text-[22px] leading-[1.15]">{d.question}</h3>
              <div className="ink-rule mt-2 w-20" aria-hidden />
              <p className="mt-2.5 text-[12.5px] leading-[1.58]">
                <span className="font-semibold">The book says: </span>
                <span style={{ color: "var(--story-ink-2)" }}>{d.indiaSays}</span>
              </p>
              <p className="mt-2 text-[12.5px] leading-[1.58]" style={{ color: "var(--story-ink-2)" }}>
                {d.note}
              </p>
              <p className="mono mt-2 text-[10px]" style={{ color: "var(--story-ink-3)" }}>
                {d.chapter}{d.page !== null ? `, p${d.page}` : ""}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Weapons ────────────────────────────────────────────────── */}
      <section className="mt-16">
        <ChartTitle note="Named in the book, with where each comes from.">
          What the book says was used
        </ChartTitle>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {b.weapons.map((w) => (
            <div key={w.id} className="ink-note p-4" data-tilt="r">
              <h3 className="text-[14px] font-bold leading-tight">{w.name}</h3>
              <p className="mono mt-1 text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--story-ink-3)" }}>
                {w.kind} · {w.origin}
              </p>
              <p className="mt-2 text-[12px] leading-[1.55]" style={{ color: "var(--story-ink-2)" }}>
                {w.note}
              </p>
              <p className="mono mt-2 text-[10px]" style={{ color: "var(--story-ink-3)" }}>
                {w.chapter}{w.page !== null ? `, p${w.page}` : ""}
              </p>
            </div>
          ))}
        </div>
      </section>

      <WhatThisCannotSay
        items={[
          {
            q: "Is this what happened?",
            a: <>This is what one well-placed Indian participant says happened. The verification on
              every fact here checks it against his book, not against the events — a guarantee
              about the citation, not about the claim.</>,
          },
          {
            q: "What did each side lose?",
            a: <>Not published here, for either country. No casualty figure and no aircraft-loss
              total appears anywhere on this page, and a test fails the build if one does. Both
              governments have the strongest possible reason to shade those numbers and no
              independent count exists.</>,
          },
          {
            q: "Were the sites what the book says they were?",
            a: <>The description of who used each camp is the author&rsquo;s attribution. It is
              printed as his, with his page number, and this site does not adopt it.</>,
          },
          {
            q: "Why does the drawing show no explosions?",
            a: <>Because what was hit and what was destroyed are exactly the questions the two
              accounts answer differently. A rendered fireball over a named town would settle one
              of them in the reader&rsquo;s mind with a picture rather than with evidence, and a
              drawing is the most persuasive way there is to assert something without sourcing it.</>,
          },
          {
            q: "Where is Pakistan's account?",
            a: <>Not in this book, and so not on this page. The <a href="/sindoor"
              style={{ color: "var(--s-hot)", textDecoration: "underline", textUnderlineOffset: 2 }}>
              Sindoor record</a> holds 252 dated statements with both countries&rsquo; versions
              kept apart rather than merged into one sequence.</>,
          },
          {
            q: "Is the map accurate enough to measure from?",
            a: <>No. The projection is a stage for a camera, not a survey. Country shapes are
              Natural Earth; the Line of Control is drawn as one line among several possible and is
              disputed on the ground.</>,
          },
        ]}
      />

      <Sources>
        {b.book.author}, <em>{b.book.title}</em> ({b.book.publisher}, {b.book.year}), read from a
        copy committed to this repository. {b.method} Frames rendered with Blender on CPU Cycles
        using Freestyle line art; country shapes are Natural Earth via world-atlas at 10m. Built{" "}
        {b.builtAt.slice(0, 10)}. Quotations are the author&rsquo;s or those he quotes, attributed
        in place; no figure on this page is an estimate and none is interpolated.
      </Sources>
    </article>
  );
}
