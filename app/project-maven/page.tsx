import { loadMaven } from "@/lib/maven-book";
import { byId, cite, stated, when, CLAIM_LABEL, type Figure, type MavenBook } from "@/lib/maven-shared";
import { Eyebrow, Headline, Standfirst, Stat, WhatThisCannotSay, Sources } from "@/components/stories/Kit";
import { ChartTitle, Caption } from "@/components/stories/Charts";
import { MavenStory, type Step, type Theatre } from "@/components/maven/MavenStory";
import { SpotTheFarmer } from "@/components/maven/SpotTheFarmer";
import { Bars, Funnel, PerHour } from "@/components/maven/Charts";
import type { StageData } from "@/components/maven/stage";

/**
 * Project Maven: how the Pentagon taught machines to find targets.
 *
 * A visual reading of Katrina Manson's book, organised by its four parts —
 * Find, Fix, Finish, Feedback — which are the four verbs of the kill chain.
 *
 * ── The rule this page is built on ───────────────────────────────────────
 *
 * Every number, date and quotation on it comes from `data/defence/maven-
 * book.json`, which is written only if each one still appears in the book,
 * and `npm run test:maven-book` fails if a number in any record's prose is not
 * in that record's verified phrases. The connecting prose on this page adds
 * no numbers of its own: where a sentence needs one, it reads it from a
 * figure, so the page cannot say "ten" where the book says "thirty".
 *
 * ── What the book is ─────────────────────────────────────────────────────
 *
 * A reported history, much of it built on what participants told the author.
 * Every figure carries whose it is. The scenes that the book reports two ways
 * are printed two ways.
 */

export const metadata = {
  title: "Project Maven: how the Pentagon taught machines to find targets · Bharat Tracker",
  description:
    "A visual reading of Katrina Manson's Project Maven — from a white dot on a screen to five "
    + "thousand targets a day — with every figure checked against the book and cited to its page.",
};

const PALETTE = { deployed: "#b08a00", support: "#2a9ad0", watched: "#e25a70" };

function need(m: MavenBook, id: string): Figure {
  const f = byId(m.figures, id);
  if (!f) throw new Error(`Project Maven page needs figure "${id}", which the record does not carry`);
  return f;
}

function P({ c }: { c: { chapter: string; page: number | null } }) {
  return <span className="mv-cite">{cite(c)}</span>;
}

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

function Q({ children }: { children: string }) {
  return <q className="mv-q">{children}</q>;
}

export default function ProjectMavenPage() {
  const m = loadMaven();

  if (!m.present) {
    return (
      <div className="pt-12">
        <Eyebrow>not built</Eyebrow>
        <Headline>The Project Maven record is not in this deployment.</Headline>
        <Standfirst>Run <span className="mono">npm run maven:book</span>.</Standfirst>
      </div>
    );
  }

  const F = (id: string) => need(m, id);
  const beat = (id: string) => byId(m.beats, id)!;
  const scene = (id: string) => byId(m.scenes, id)!;
  const voice = (id: string) => byId(m.voices, id)!;

  const t0 = F("tempo-no-ai"); const t1 = F("tempo-cv"); const t2 = F("tempo-llm");
  const video = F("video-2016"); const s01 = F("sorties-2001"); const s10 = F("sorties-2010");
  const pxLo = F("px-human-lo"); const pxHi = F("px-human-hi"); const pxW = F("px-weapon"); const pxO = F("px-object");
  const harb = F("harbinger-models"); const gk = F("goalkeeper"); const wl = F("whiplash"); const spend = F("autonomy-spend");
  const ban = F("ban-countries");
  const farmer = scene("farmer"); const van = scene("van");

  const data: StageData = {
    counts: {
      videoYears: video.value, sorties2001: s01.value, sorties2010: s10.value,
      tempo: [t0.value, t1.value, t2.value],
      pxPersonLo: pxLo.value, pxPersonHi: pxHi.value, pxWeapon: pxW.value, pxObject: pxO.value,
    },
    text: {
      schoolBus: `“a school bus in the sky” · ${cite(beat("somalia"))}`,
      deluge: `${stated(video)} ${video.unit}, recorded in one year`,
      delugeKey: `Each tile: one year of footage · ${cite(video)}`,
      sorties2001: `2001: ${stated(s01)}`,
      sorties2010: `2010: ${stated(s10)}`,
      sortiesKey: `Each point: one battlefield drone sortie · ${cite(s01)}`,
      layerInput: "A frame goes in",
      pxPerson: `A person: ${pxLo.value}–${pxHi.value} pixels`,
      pxWeapon: `A weapon on a shoulder: ${pxW.value}`,
      pxObject: `A sought-after object: ${pxO.value}`,
      pxKey: `Each square: one pixel · ${cite(pxW)}`,
      chainBefore: "A person at every step",
      chainAfter: `People taken out of four of the six places · ${cite(m.cycle.removed)}`,
      tempoKey: `Each cube: one target a day · ${cite(t0)}`,
      tempo0: `${stated(t0)} a day, without AI`,
      tempo1: `${stated(t1)} with computer vision`,
      tempo2: `${stated(t2)} with language models added`,
      vanCompound: "The compound",
      vanVillage: "Barisha village",
      vanJunction: "T-junction",
      vanKey: `A schematic of the book's description (${cite(van)}) — not a map, not to scale`,
      vanDetect: "AI detection",
      seaSpec: "Sound as a picture: a spectrogram (illustrative)",
      seaArray: "Towed hydrophones",
      seaKey: `${stated(harb)} models tested · ${cite(harb)}`,
      swarmKey: `Goalkeeper: ${stated(gk)} planned · Whiplash: ${stated(wl)} jet skis · ${stated(spend)}`,
      kind_deployed: "Maven ran here",
      kind_support: "part of the Ukraine effort",
      kind_watched: "data collected over it",
    },
    layers: m.layers.map((l) => ({ label: l.label, quote: l.quote })),
    phases: m.cycle.phases.map((p) => p.label),
    where: m.where.filter((w) => w.position).map((w) => ({ name: w.name, kind: w.kind, position: w.position!, cite: cite(w) })),
    palette: PALETTE,
  };

  const theatres: Theatre[] = [
    { f: F("acc-afghanistan"), ground: "desert" as const, label: "Afghanistan" },
    { f: F("acc-philippines"), ground: "jungle" as const, label: "Philippines" },
    { f: F("acc-europe-before"), ground: "snow" as const, label: "Europe, before" },
    { f: F("acc-ukraine-after"), ground: "snow" as const, label: "Ukraine, after" },
  ].map(({ f, ground, label }) => ({
    id: f.id, label, rate: f.value / 100, ground,
    note: `${f.what} ${stated(f)} ${f.unit.replace("percent ", "")} — ${f.who}, ${cite(f)}. Boxes are drawn on that share of the objects; the picture illustrates the rate, it is not the footage.`,
  }));

  const steps: Step[] = [
    {
      id: "feed", part: "Part one · Find",
      content: (<>
        <p className="mv-kicker">The problem</p>
        <h2 className="mv-h">America&apos;s drones could see far more than anyone could watch.</h2>
        <p>This is the view from above that a generation of analysts stared at, shift after shift, calling out what moved. The picture here is generated; the problem is not.</p>
      </>),
    },
    {
      id: "deluge", part: "Part one · Find",
      content: (<>
        <p className="mv-kicker">The deluge</p>
        <h2 className="mv-h">{stated(video)} {video.unit}, recorded in a single year.</h2>
        <p>{video.what} <P c={video} /></p>
      </>),
    },
    {
      id: "sorties", part: "Part one · Find",
      content: (<>
        <p className="mv-kicker">Why it grew</p>
        <h2 className="mv-h">From {stated(s01)} drone sorties to {stated(s10)}.</h2>
        <p>The US flew {stated(s01)} battlefield drone sorties in 2001 and {stated(s10)} in 2010 <P c={s10} />. Every flight came home with video.</p>
      </>),
    },
    {
      id: "dots", part: "Part one · Find",
      content: (<>
        <p className="mv-kicker">The idea</p>
        <h2 className="mv-h">A white dot on the screen, over everything that matters.</h2>
        <p>{beat("thesis").what} <P c={beat("thesis")} /></p>
        <p className="mt-2">{beat("demo").what} <P c={beat("demo")} /></p>
        <p className="mt-2">{beat("memo").what} It started with {stated(F("budget-2017"))} <P c={beat("memo")} />.</p>
      </>),
    },
    {
      id: "layers", part: "Part one · Find",
      content: (<>
        <p className="mv-kicker">How a machine learns to see</p>
        <h2 className="mv-h">Lines, then shapes, then parts, then things.</h2>
        <p>Matt Zeiler, whose start-up Clarifai was one of Maven&apos;s first four AI vendors, explained it to the author as layers, each building on the one before. Show a network enough labelled examples, correct it every time it is wrong, and the layers learn to pick out what the labels named.</p>
        <p className="mt-2">Training one algorithm could take {stated(F("data-per-model"))} labelled images <P c={F("data-per-model")} />.</p>
      </>),
    },
    {
      id: "pixels", part: "Part one · Find",
      content: (<>
        <p className="mv-kicker">What it has to go on</p>
        <h2 className="mv-h">A weapon is {pxW.value} pixels.</h2>
        <p>{pxO.what} {pxHi.what} {pxW.what} <P c={pxW} /></p>
      </>),
    },
    {
      id: "boxes", part: "Part one · Find",
      content: (<>
        <p className="mv-kicker">{when(beat("somalia").date)} · Somalia</p>
        <h2 className="mv-h">The first time, it saw a school bus in the sky.</h2>
        <p>{beat("somalia").what} <P c={beat("somalia")} /></p>
        <p className="mt-2 text-[13px] text-[color:var(--mv-ink-2)]">The yellow boxes are the book&apos;s colour: it describes a “clunky, bright yellow line”.</p>
      </>),
    },
    {
      id: "accuracy", part: "Part two · Fix", control: "accuracy",
      content: (<>
        <p className="mv-kicker">Accuracy moves</p>
        <h2 className="mv-h">A model that works in one place can fail in the next.</h2>
        <p>Trained on desert, the same models met jungle, then snow. Pick a place.</p>
      </>),
    },
    {
      id: "chain", part: "Part two · Fix", control: "chain",
      content: (<>
        <p className="mv-kicker">The kill chain</p>
        <h2 className="mv-h">Six steps to a strike. Where are the people?</h2>
        <p>The US military&apos;s joint targeting cycle has six phases <P c={m.cycle.phases[0]!} />. {m.cycle.removed.what} <P c={m.cycle.removed} /></p>
        <p className="mt-2">{m.cycle.remaining.what} <P c={m.cycle.remaining} /> The book does not say which four; the figures that leave here are not assigned to phases.</p>
        <p className="mt-2 text-[13px] text-[color:var(--mv-ink-2)]">{m.cycle.policy.what} <P c={m.cycle.policy} /></p>
      </>),
    },
    {
      id: "tempo", part: "Part three · Finish", control: "tempo",
      content: (<>
        <p className="mv-kicker">Speed</p>
        <h2 className="mv-h">From {stated(t0)} targets a day to {stated(t2)}.</h2>
        <p>According to an official at the National Geospatial-Intelligence Agency, the US could hit {stated(t0)} targets a day before computer vision, {stated(t1)} with it, and {stated(t2)} once large language models were added to the Maven platform <P c={t2} />.</p>
        <p className="mt-2 text-[13px] text-[color:var(--mv-ink-2)]">One official&apos;s figures, told to the author. How many of those targets were struck, and what was in them, is not in the book.</p>
      </>),
    },
    {
      id: "globe", part: "Part three · Finish", control: "globe",
      content: (<>
        <p className="mv-kicker">Where it went</p>
        <h2 className="mv-h">From one airfield in Somalia to {stated(F("scale-sites"))} sites.</h2>
        <p>{F("scale-sites").what} <P c={F("scale-sites")} /> The globe shows only countries the book names. Drag it; hover a dot for the page.</p>
      </>),
    },
    {
      id: "van", part: "Part three · Finish",
      content: (<>
        <p className="mv-kicker">{when(van.date)} · {van.place}</p>
        <h2 className="mv-h">&ldquo;Oh look at that dot.&rdquo;</h2>
        <p>{van.what} <P c={van} /></p>
        {van.accounts.map((a) => (
          <p key={a.says} className="mt-2 text-[14px]"><Q>{a.says}</Q> — {a.who} <P c={a} /></p>
        ))}
      </>),
    },
    {
      id: "sea", part: "Part four · Feedback",
      content: (<>
        <p className="mv-kicker">Beyond the screen</p>
        <h2 className="mv-h">Under the sea, the same idea hunts submarines.</h2>
        <p>{harb.what} <P c={harb} /></p>
      </>),
    },
    {
      id: "swarm", part: "Part four · Feedback",
      content: (<>
        <p className="mv-kicker">Machines that choose</p>
        <h2 className="mv-h">The dot is moving from the screen into the weapon.</h2>
        <p>{gk.what} <P c={gk} /> {wl.what} <P c={wl} /> {spend.what} — to {stated(spend)} <P c={spend} /></p>
        <p className="mt-2">By {ban.when}, {stated(ban)} countries had said they wanted a ban on lethal autonomous weapons systems. The US opposed one <P c={ban} />.</p>
      </>),
    },
    {
      id: "end", part: "Part four · Feedback",
      content: (<>
        <p className="mv-kicker">The last word in the book</p>
        <h2 className="mv-h"><Q>{voice("cukor-custodians").quote}</Q></h2>
        <p>— Drew Cukor, Maven&apos;s founding chief <P c={voice("cukor-custodians")} /></p>
      </>),
    },
  ];

  const acc = ["acc-afghanistan", "acc-philippines", "acc-europe-before", "acc-ukraine-after", "acc-ukraine-floor"].map(F);
  const budgetRows = ["budget-2017", "budget-2018-ch12", "budget-2019-ch12", "budget-2019-ch18", "budget-2020", "budget-2022", "budget-annual"].map(F);
  const b16 = F("budget-2018-ch12"); const b93 = F("budget-2019-ch12");
  const ratio = (b93.value / b16.value).toFixed(1);
  const ua = ["ua-first", "ua-notch", "ua-peak", "ua-2024"].map(F);
  const scale = ["scale-users", "scale-companies", "scale-detections", "scale-feeds"].map(F);
  const partOrder = ["origins", "find", "fix", "finish", "feedback"];
  const partName: Record<string, string> = { origins: "Before", find: "Find", fix: "Fix", finish: "Finish", feedback: "Feedback" };
  const AI_WORD: Record<string, string> = { found: "The AI found it", missed: "The AI missed it", off: "No AI", failed: "The AI failed", helped: "The AI helped" };

  return (
    <div className="mv-root">
      <header className="pt-10 sm:pt-14">
        <Eyebrow>A book, read and checked · Katrina Manson, {m.book.publisher}, {m.book.year}</Eyebrow>
        <Headline>
          <span className="mv-display">The white dot</span>
        </Headline>
        <Standfirst>
          How the Pentagon taught machines to find targets — from a Marine colonel&apos;s idea of a{" "}
          <span className="mv-hl">white dot on a screen</span> to a system that, by one official&apos;s count, lets the
          US go from {stated(t0)} targets a day to {stated(t2)}. Every number below is checked against the
          book and cited to its page.
        </Standfirst>
        <p className="mt-4 max-w-[70ch] text-[13px] leading-[1.6] text-[color:var(--mv-ink-2)]">
          {m.book.note} Each figure here says whose it is. Scroll to begin; the pictures are generated
          illustrations, never footage.
        </p>
      </header>

      <MavenStory
        steps={steps}
        data={data}
        theatres={theatres}
        tempoLabels={["Without AI", "Computer vision", "+ language models"]}
        globeKey={[
          { kind: "deployed", label: "Maven ran here", colour: PALETTE.deployed },
          { kind: "support", label: "Part of the Ukraine effort", colour: PALETTE.support },
          { kind: "watched", label: "Data collected over it", colour: PALETTE.watched },
        ]}
      />

      <section className="mt-16">
        <p className="mv-kicker">Try it</p>
        <h2 className="mv-section">Forty seconds, or one</h2>
        <p className="mv-lede">{farmer.what} <P c={farmer} /></p>
        <div className="mt-5 max-w-[780px]"><SpotTheFarmer analyst="forty seconds" machine="within a second" cite={cite(farmer)} /></div>
      </section>

      <section className="mt-16">
        <p className="mv-kicker">Accuracy</p>
        <h2 className="mv-section">A model does not have an accuracy. It has one somewhere.</h2>
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <div className="mv-card">
            <ChartTitle note="Detection rates and accuracy scores the book reports, by place. They are not one metric measured twice, so read each row on its own.">
              The same kind of model, four places
            </ChartTitle>
            <Bars rows={acc.map((f) => ({ f, note: cap(f.who) }))} max={100} />
          </div>
          <div className="mv-card">
            <ChartTitle note={F("acc-18th-ai").what}>
              Against people, at the 18th Airborne Corps
            </ChartTitle>
            <Bars rows={[
              { f: F("acc-18th-ai"), label: "The AI", tone: "ai" },
              { f: F("acc-18th-human"), label: "Its analysts", tone: "human" },
            ]} max={100} />
            <Caption>Percent of objects correctly identified. Source: {F("acc-18th-ai").who}.</Caption>
          </div>
        </div>
      </section>

      <section className="mt-16">
        <p className="mv-kicker">Data</p>
        <h2 className="mv-section">The hard part was never the algorithm.</h2>
        <p className="mv-lede">
          {F("data-classes").what} <P c={F("data-classes")} /> {F("data-frames").what} <P c={F("data-frames")} />{" "}
          {F("data-discarded").what} <P c={F("data-discarded")} />
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Stat size="md" value={stated(F("data-classes"))} label="object classes at launch" note={cite(F("data-classes"))} />
          <Stat size="md" value={stated(F("data-labelers"))} label="professional labellers, later" note={`${F("data-labelers").what} ${cite(F("data-labelers"))}`} />
          <Stat size="md" value={stated(F("data-store"))} label="labelled images, eventually" note={cite(F("data-store"))} />
        </div>
        <div className="mv-card mt-6">
          <ChartTitle note={`${F("data-used").what} ${F("data-sprint").what}`}>
            {cap(stated(F("data-tested")))} algorithms tested; {stated(F("data-used"))} used for Ukraine
          </ChartTitle>
          <Funnel total={F("data-tested")} picked={F("data-used")} labelTotal="Tested, 2021 and 2022" labelPicked="Used in support of Ukraine" />
          <Caption>One dot per algorithm. Which ones were kept is not published, so the lit dots are placed arbitrarily.</Caption>
        </div>
      </section>

      <section className="mt-16">
        <p className="mv-kicker">Ukraine</p>
        <h2 className="mv-section">Tens of thousands of targets, passed on as &ldquo;points of interest&rdquo;</h2>
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <div className="mv-card">
            <ChartTitle note="What the US team passed to Ukraine, by the book's account. The single-day high is a peak, not a rate.">
              Targets and points of interest a day
            </ChartTitle>
            <Bars rows={ua.map((f) => ({ f, note: f.what }))} max={300} />
          </div>
          <div className="mv-card">
            <ChartTitle note={F("temple-with").what}>One officer, one hour</ChartTitle>
            <PerHour without={F("temple-without")} withM={F("temple-with")} />
            <p className="mt-4 text-[14px]"><Q>{voice("temple").quote}</Q> — {voice("temple").who} <P c={voice("temple")} /></p>
          </div>
        </div>
      </section>

      <section className="mt-16">
        <p className="mv-kicker">Scale</p>
        <h2 className="mv-section">What it had become by 2025</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {scale.map((f) => (
            <Stat key={f.id} size="sm" value={stated(f)} label={f.label} note={<>{cap(f.who)}. {cite(f)}</>} />
          ))}
        </div>
      </section>

      <section className="mt-16">
        <p className="mv-kicker">Money</p>
        <h2 className="mv-section">The budget, as the book gives it — including where it disagrees with itself</h2>
        <div className="mv-card mt-6">
          <ChartTitle note={`Chapters 12 and 18 give different 2019 figures; both are shown. Chapter 12 also says the budget “jumped more than ten times” from ${stated(b16)} to ${stated(b93)} — its own two figures are about ${ratio} times apart (derived). Since 2023 the budget has been classified.`}>
            Project Maven&apos;s budget, millions of dollars
          </ChartTitle>
          <Bars rows={budgetRows.map((f) => ({ f, tone: f.id.endsWith("ch12") ? "muted" : "ai" }))} max={300} />
          <Caption>
            Over Colonel Cukor&apos;s tenure the total came to {stated(F("budget-tenure"))} ({cite(F("budget-tenure"))}).
            Separately, the ceiling on Palantir&apos;s Maven Smart System contract reached {stated(F("mss-ceiling"))} ({cite(F("mss-ceiling"))}).
            Grey rows are chapter 12&apos;s figures.
          </Caption>
        </div>
      </section>

      <section className="mt-16">
        <p className="mv-kicker">Six scenes</p>
        <h2 className="mv-section">What the AI did, when it mattered</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {m.scenes.map((s) => (
            <article key={s.id} className="mv-card">
              <p className="mv-kicker">{[when(s.date), s.place].filter(Boolean).join(" · ")}</p>
              <h3 className="text-[18px] font-bold leading-snug">{s.title}</h3>
              <p className="mt-1"><span className={`mv-tag mv-tag-${s.ai}`}>{AI_WORD[s.ai]}</span></p>
              <p className="mt-3 text-[14px] leading-[1.6]">{s.what} <P c={s} /></p>
              {s.accounts.length > 0 && (
                <ul className="mt-3 space-y-2 border-l-2 border-[color:var(--mv-rule)] pl-3">
                  {s.accounts.map((a) => (
                    <li key={a.says} className="text-[13.5px] leading-snug"><Q>{a.says}</Q> <span className="text-[color:var(--mv-ink-2)]">— {a.who}</span> <P c={a} /></li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <p className="mv-kicker">The record</p>
        <h2 className="mv-section">Maven, in order</h2>
        <ol className="mt-6 space-y-6">
          {partOrder.map((p) => {
            const bs = m.beats.filter((b) => b.part === p);
            if (bs.length === 0) return null;
            return (
              <li key={p}>
                <p className="mv-part-label">{partName[p]}</p>
                <ul className="mt-2 space-y-3">
                  {bs.map((b) => (
                    <li key={b.id} className="grid gap-x-4 sm:grid-cols-[140px_1fr]">
                      <span className="mono text-[12.5px] text-[color:var(--mv-ink-2)]">{when(b.date)}</span>
                      <span className="text-[14px] leading-[1.55]">
                        <strong>{b.label}.</strong> {b.what} <P c={b} />{" "}
                        <span className="text-[11.5px] text-[color:var(--mv-ink-3)]">{CLAIM_LABEL[b.claim]}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-16">
        <p className="mv-kicker">Voices</p>
        <h2 className="mv-section">The argument, in their words</h2>
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {([["for", "Speeding it up"], ["doubt", "Doubts, including from inside"], ["against", "Against"]] as const).map(([k, title]) => (
            <div key={k}>
              <p className="mv-part-label">{title}</p>
              <ul className="mt-3 space-y-4">
                {m.voices.filter((v) => v.stance === k).map((v) => (
                  <li key={v.id} className="mv-card">
                    <p className="text-[15px] leading-snug"><Q>{v.quote}</Q></p>
                    <p className="mt-2 text-[12.5px] text-[color:var(--mv-ink-2)]">{v.who}, {v.role} <P c={v} /></p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <Caption>Grouped by what each quotation argues, not by who the speaker is: several people appear in more than one column.</Caption>
      </section>

      <WhatThisCannotSay
        items={m.cannotSay.map((s) => {
          const at = s.indexOf(". ");
          return { q: at > 0 ? s.slice(0, at + 1) : s, a: at > 0 ? s.slice(at + 2) : "" };
        })}
      />

      <Sources>
        {m.book.author}, <em>{m.book.title}</em> ({m.book.publisher}, {m.book.year}; ISBN {m.book.isbn}). {m.method}{" "}
        Kinds of claim: {Object.entries(m.claims).map(([k, v]) => `${CLAIM_LABEL[k as keyof typeof CLAIM_LABEL]} — ${v}`).join(" ")}{" "}
        Record built {m.builtAt.slice(0, 10)}. Country outlines: Natural Earth via world-atlas.
      </Sources>
    </div>
  );
}
