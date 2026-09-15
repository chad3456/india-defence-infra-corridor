import Link from "next/link";
import {
  loadOryx, statedTotal, sectionsOf, unmannedTotal, instancesFor,
  loadMilitaryAi, series, seriesTotal, byTier, usd,
  type Section, type Incident,
} from "@/lib/attrition";
import {
  Eyebrow, Headline, Standfirst, Mark, Stat, Columns, WhatThisCannotSay, Sources,
} from "@/components/stories/Kit";
import {
  ChartTitle, Caption, RankedRows, DivergingRanks, Waffle, DotStrip,
} from "@/components/stories/Charts";

/**
 * Thirty-six thousand receipts, and what is not among them.
 *
 * ── The finding this page is built on ────────────────────────────────────
 *
 * The best open-source archive of this war lists every vehicle either side has
 * been photographed losing — tens of thousands of entries, each linking to the
 * image that confirms it. It is the most rigorous public loss record of any
 * modern conflict.
 *
 * Its unmanned aircraft sections hold a couple of dozen entries per side.
 *
 * That is not a gap in the archive. It is what happens when a method that
 * requires one identifiable photograph per item meets a weapon that is
 * consumed in the thousands, is frequently destroyed by flying into something,
 * and leaves a wreck the size of a dinner plate that nobody photographs and
 * nobody could identify by model if they did. The war's defining weapon is
 * structurally invisible to the war's best archive, and every "drone losses"
 * figure in circulation comes instead from one of the two ministries.
 *
 * So this page does not estimate the number. It shows precisely what is
 * verifiable, shows the shape of the hole, and says who the number would have
 * to come from if it were quoted.
 *
 * ── The second half, and why it is a different kind of evidence ──────────
 *
 * "AI in military operations" has the same problem one layer worse. Capability
 * claims come from vendors and ministries; market sizes come from consultancy
 * definitions. Two records survive: money a government has obligated against a
 * public award id, and incidents a register catalogued with citations. Both
 * are here, both are small relative to the noise, and both are labelled with
 * what they actually measure — awards whose description says AI, and reports
 * somebody wrote down.
 *
 * ── The rule about sides ─────────────────────────────────────────────────
 *
 * Photo-verification is an undercount on both sides and not equally. The two
 * forces are photographed by different numbers of people under different rules
 * about posting, so the ratio between their totals measures the photography as
 * much as the fighting. Both sides are shown; no chart on this page presents
 * the ratio as an exchange rate, and the caption says why.
 */

export const metadata = {
  title: "Thirty-six thousand receipts · Bharat Tracker",
  description:
    "The best archive of the Ukraine war photographs every vehicle lost. Its drone sections hold " +
    "a few dozen entries. What is verifiable about drones and military AI, and what is not.",
};

/** The register's tiers, in the order the page reads them. */
const TIERS = [
  { id: "force" as const, label: "An armed force deployed it", tone: "hot" as const },
  { id: "state" as const, label: "A government deployed it", tone: "mid" as const },
  { id: "adjacent" as const, label: "Military-adjacent technology", tone: "cool" as const },
];

function IncidentCard({ i }: { i: Incident }) {
  return (
    <li className="story-card p-4 sm:p-5" data-tone={i.tier === "force" ? "hot" : i.tier === "state" ? "mid" : "cool"}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="mono text-[11px]" style={{ color: "var(--story-ink-3)" }}>
          {i.occurred || "date not stated"}
        </span>
        {i.deployer && (
          <span className="text-[11.5px] font-bold" style={{ color: "var(--s-hot)" }}>{i.deployer}</span>
        )}
        {i.system && (
          <span className="mono text-[11px]" style={{ color: "var(--story-ink-2)" }}>{i.system}</span>
        )}
      </div>
      <p className="mt-2 text-[13px] font-semibold leading-[1.45]">{i.headline}</p>
      <dl className="mt-2.5 grid gap-x-4 gap-y-0.5 text-[11px] sm:grid-cols-2">
        {[
          ["technology", i.technology],
          ["purpose", i.purpose],
          ["issue the register records", i.ethicalIssue],
          ["harm status", i.harmStatus],
        ].filter(([, v]) => v).map(([k, v]) => (
          <div key={k as string} className="flex gap-1.5">
            <dt className="shrink-0" style={{ color: "var(--story-ink-3)" }}>{k}:</dt>
            <dd className="min-w-0 truncate" style={{ color: "var(--story-ink-2)" }}>{v}</dd>
          </div>
        ))}
      </dl>
      {i.links.length > 0 && (
        <p className="mt-2.5 flex flex-wrap gap-x-2.5 gap-y-1 text-[10.5px]">
          {i.links.slice(0, 3).map((l, n) => (
            <a key={l} href={l} target="_blank" rel="noopener noreferrer nofollow"
              className="underline" style={{ color: "var(--story-ink-3)" }}>
              source {n + 1}
            </a>
          ))}
        </p>
      )}
    </li>
  );
}

export default function DroneWarStory() {
  const o = loadOryx();
  const ai = loadMilitaryAi();

  if (!o.present && !ai.present) {
    return (
      <div className="pt-12">
        <Eyebrow>not built</Eyebrow>
        <Headline>Neither source file is in this deployment.</Headline>
        <Standfirst>
          Run <span className="mono">npm run oryx:ingest</span> and{" "}
          <span className="mono">npm run military-ai</span> in CI. Nothing here is typed in.
        </Standfirst>
      </div>
    );
  }

  /* ── Oryx ─────────────────────────────────────────────────────────── */
  const ruStated = statedTotal(o, "Russia");
  const uaStated = statedTotal(o, "Ukraine");
  const bothStated = (ruStated?.total ?? 0) + (uaStated?.total ?? 0);
  const ruUnmanned = unmannedTotal(o, "Russia");
  const uaUnmanned = unmannedTotal(o, "Ukraine");
  const bothUnmanned = ruUnmanned + uaUnmanned;
  const unmannedShare = bothStated > 0 ? (bothUnmanned / bothStated) * 100 : 0;

  const ruSections = sectionsOf(o, "Russia");
  const uaSections = sectionsOf(o, "Ukraine");
  /** Categories present on both pages, so the comparison is like for like. */
  const shared = ruSections
    .filter((r) => uaSections.some((u) => u.category === r.category))
    .map((r) => ({
      category: r.category,
      ru: r.stated.total ?? 0,
      ua: uaSections.find((u) => u.category === r.category)?.stated.total ?? 0,
      unmanned: r.unmanned,
    }))
    .filter((r) => r.ru + r.ua > 0)
    .sort((a, b) => b.ru + b.ua - (a.ru + a.ua));

  const verified = o.unmannedInstances;
  const byModel = new Map<string, number>();
  for (const i of verified) byModel.set(`${i.side} · ${i.model}`, (byModel.get(`${i.side} · ${i.model}`) ?? 0) + 1);
  const modelRows = [...byModel].map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n);

  const statusOf = (rows: typeof verified) => {
    const m: Record<string, number> = { destroyed: 0, damaged: 0, abandoned: 0, captured: 0 };
    for (const r of rows) m[r.status] = (m[r.status] ?? 0) + 1;
    return m;
  };
  const statuses = statusOf(verified);

  /** How closely a script reproduces a hand-maintained list of thirty-six thousand. */
  const agreed = o.counts.sectionsAgreed;
  const attempted = o.counts.sections;

  /* ── Military AI ──────────────────────────────────────────────────── */
  const forceRows = byTier(ai, "force");
  const stateRows = byTier(ai, "state");
  const adjacentRows = byTier(ai, "adjacent");
  const aiTerm = series(ai, "artificial intelligence");
  const mlTerm = series(ai, "machine learning");
  const termRows = ai.spending
    .filter((s) => s.ok && s.years.length > 0)
    .map((s) => ({ term: s.term, total: seriesTotal(s), last: s.years[s.years.length - 1] }))
    .sort((a, b) => b.total - a.total);

  return (
    <div>
      {/* ── Opening ───────────────────────────────────────────────────── */}
      <header className="pt-10">
        <Eyebrow tone="hot">drones · military AI · what is actually verifiable</Eyebrow>
        <h1 className="story-display mt-4 max-w-[17ch] text-[38px] sm:text-[54px] lg:text-[62px]">
          Thirty-Six Thousand Receipts, and Almost No Drones.
        </h1>
        <Standfirst>
          The most rigorous open archive of this war lists every vehicle either side has been
          photographed losing — <Mark>{bothStated.toLocaleString("en-US")}</Mark> entries, each
          linking to the image that proves it. Its unmanned aircraft sections hold{" "}
          <Mark>{bothUnmanned}</Mark>. That is not a gap in the archive; it is what happens when a
          method requiring one identifiable photograph per item meets a weapon consumed in the
          thousands and destroyed by flying into things.
        </Standfirst>
        <p className="mt-5 max-w-[64ch] rounded-lg border p-4 text-[13px] leading-[1.6]"
          style={{ borderColor: "var(--story-rule)", color: "var(--story-ink-2)" }}>
          <strong style={{ color: "var(--story-ink)" }}>What this page does not have.</strong>{" "}
          A drone loss count. Every figure in circulation comes from one of the two defence
          ministries, and neither can be checked by anyone. Nothing here estimates the number,
          interpolates it, or reprints it — the page shows what is verifiable and the shape of
          what is not.
        </p>
      </header>

      {/* ── Four numbers ──────────────────────────────────────────────── */}
      {o.present && (
        <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat size="md" tone="cool" label="vehicles with a photograph"
            value={bothStated.toLocaleString("en-US")}
            note={<>Both sides, as the archive states its own totals. Every entry links to the image or video behind it.</>} />
          <Stat size="md" tone="hot" label="of them are unmanned aircraft"
            value={String(bothUnmanned)}
            note={<>{unmannedShare.toFixed(2)}% of the archive, in a war whose defining weapon is the drone.</>} />
          <Stat size="md" tone="mid" label="sections a script could reproduce"
            value={`${agreed}/${attempted}`}
            note={<>Each section's parse is checked against the total its own heading states. A section that disagrees by more than 1% is suppressed rather than shown with a warning.</>} />
          <Stat size="md" tone="mid" label="drone entries read with their receipt"
            value={String(verified.length)}
            note={<>Individually parsed, each carrying the link the archive gives as proof. These are the only per-drone rows on this page.</>} />
        </section>
      )}

      {/* ── The hole, drawn ───────────────────────────────────────────── */}
      {o.present && bothStated > 0 && (
        <section className="mt-16">
          <Eyebrow tone="hot">the shape of what is missing</Eyebrow>
          <Headline>Every Square Is Four Hundred Vehicles. The Drones Are Not a Square.</Headline>
          <Standfirst>
            The archive&rsquo;s own totals, by category, for both sides together. Armour, artillery
            and trucks fill it. The unmanned aircraft — the weapon that has defined the fighting,
            reorganised both armies and consumed more industrial output than any other system —
            do not reach a single cell.
          </Standfirst>
          <div className="story-card mt-7 p-5 sm:p-7">
            <div className="grid gap-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="min-w-0">
                <ChartTitle note={`One square is 1% of the ${bothStated.toLocaleString("en-US")} entries, about ${Math.round(bothStated / 100)} vehicles.`}>
                  The archive by category
                </ChartTitle>
                <Waffle
                  cell={14}
                  gap={2.5}
                  parts={[
                    { label: "armour and fighting vehicles",
                      share: shared.filter((r) => /tank|armoured|infantry (fighting|mobility)|personnel carrier|mrap/i.test(r.category)).reduce((a, r) => a + r.ru + r.ua, 0),
                      tone: "cool" },
                    { label: "artillery, air defence and radar",
                      share: shared.filter((r) => /artillery|anti-aircraft|surface-to-air|radar|jammer/i.test(r.category)).reduce((a, r) => a + r.ru + r.ua, 0),
                      tone: "mid" },
                    { label: "trucks, engineering and command",
                      share: shared.filter((r) => /truck|engineering|command|support/i.test(r.category)).reduce((a, r) => a + r.ru + r.ua, 0),
                      tone: "cool" },
                    { label: "manned aircraft, helicopters and ships",
                      share: shared.filter((r) => /aircraft|helicopter|naval|ship/i.test(r.category) && !r.unmanned).reduce((a, r) => a + r.ru + r.ua, 0),
                      tone: "mid" },
                    { label: `unmanned aircraft — ${bothUnmanned} entries, ${unmannedShare.toFixed(2)}%`,
                      share: bothUnmanned, tone: "hot" },
                  ]}
                />
                <Caption>
                  The unmanned share rounds to zero cells and is drawn at its floor of one, which
                  overstates it by a factor of about {Math.round(1 / Math.max(unmannedShare, 0.01))}.
                  That is the most honest a hundred-cell grid can be about a fiftieth of a per cent.
                </Caption>
              </div>
              <div className="min-w-0">
                <ChartTitle note="Each side's own stated totals, by category, on one shared scale.">
                  Both sides, category by category
                </ChartTitle>
                <DivergingRanks
                  leftLabel="Russia"
                  rightLabel="Ukraine"
                  leftTone="hot"
                  rightTone="cool"
                  rows={shared.slice(0, 14).map((r) => ({
                    name: r.category
                      .replace("Mine-Resistant Ambush Protected (MRAP) Vehicles", "MRAPs")
                      .replace("Command Posts And Communications Stations", "Command posts")
                      .replace("Artillery and Missile Support Vehicles And Equipment", "Artillery support")
                      .replace("Unmanned Combat Aerial Vehicles", "Combat drones")
                      .replace(" And ", " & ").replace(" and ", " & "),
                    left: r.ru,
                    right: r.ua,
                    leftDisplay: r.ru.toLocaleString("en-US"),
                    rightDisplay: r.ua.toLocaleString("en-US"),
                    mark: r.unmanned !== null,
                  }))}
                />
                <Caption>
                  <strong>This is not an exchange rate.</strong> Photo-verification undercounts both
                  sides and not equally: the two forces are photographed by different numbers of
                  people, under different rules about posting, with different incentives to
                  publicise a loss. The ratio between these bars measures the photography as much
                  as the fighting, and no conclusion about relative attrition should be drawn from
                  it.
                </Caption>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── The verified drone rows ───────────────────────────────────── */}
      {verified.length > 0 && (
        <section className="mt-16">
          <Eyebrow tone="mid">every drone entry the archive holds, with its receipt</Eyebrow>
          <Headline>These {verified.length} Are the Whole of It.</Headline>
          <Standfirst>
            Not a sample. Every individual unmanned aircraft in the archive&rsquo;s combat-drone
            sections that this parse could read and check against the source&rsquo;s own total.
            These are large, expensive, purpose-built airframes — the kind that get photographed
            because the wreck is identifiable and worth photographing.
          </Standfirst>
          <div className="story-card mt-7 p-5 sm:p-7">
            <div className="grid gap-9 lg:grid-cols-2">
              <div className="min-w-0">
                <ChartTitle note="Entries per type, both sides. One row is one model of aircraft.">
                  By type
                </ChartTitle>
                <RankedRows
                  tone="mid"
                  rows={modelRows.map((r) => ({
                    name: r.k,
                    value: r.n,
                    display: String(r.n),
                  }))}
                />
              </div>
              <div className="min-w-0">
                <ChartTitle note="What the archive records happened to each. One dot is one aircraft.">
                  By outcome
                </ChartTitle>
                <DotStrip
                  dotSize={9}
                  gap={3}
                  maxPerColumn={7}
                  bins={[
                    { label: "destroyed", count: statuses.destroyed ?? 0, tone: "hot" },
                    { label: "damaged", count: statuses.damaged ?? 0, tone: "mid" },
                    { label: "abandoned", count: statuses.abandoned ?? 0, tone: "mid" },
                    { label: "captured", count: statuses.captured ?? 0, tone: "cool" },
                  ]}
                />
                <Caption>
                  A captured drone is the one outcome with a second life: an intact airframe is
                  examined, and its guidance, datalink and component sourcing become intelligence.
                  The archive records the capture; nothing public records what was learnt.
                </Caption>
              </div>
            </div>
            <div className="mt-8 border-t pt-6" style={{ borderColor: "var(--story-rule)" }}>
              <ChartTitle note="Each row is one aircraft and links to the photograph the archive cites for it.">
                The rows themselves
              </ChartTitle>
              <ul className="m-0 grid list-none gap-x-7 gap-y-0 p-0 sm:grid-cols-2">
                {verified.slice(0, 30).map((i, n) => (
                  <li key={`${i.model}-${n}`}
                    className="flex items-baseline justify-between gap-3 border-b py-2"
                    style={{ borderColor: "var(--story-rule)" }}>
                    <span className="min-w-0 truncate text-[12.5px]">
                      <span className="mono mr-2 text-[10px]" style={{ color: "var(--story-ink-3)" }}>
                        {String(n + 1).padStart(2, "0")}
                      </span>
                      {i.model}
                      <span className="ml-2 text-[11px]" style={{ color: "var(--story-ink-3)" }}>
                        {i.side}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-baseline gap-2">
                      <span className="mono text-[10.5px]" style={{ color: "var(--s-hot)" }}>
                        {i.statusAsWritten}
                      </span>
                      {i.evidence && (
                        <a href={i.evidence} target="_blank" rel="noopener noreferrer nofollow"
                          className="text-[10.5px] underline" style={{ color: "var(--story-ink-3)" }}>
                          photo
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {verified.length > 30 && (
                <Caption>Thirty of {verified.length} shown.</Caption>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── The commercial drone question ─────────────────────────────── */}
      <section className="mt-16">
        <Eyebrow tone="hot">the question this data cannot answer</Eyebrow>
        <Headline>Nobody Counts the Quadcopters.</Headline>
        <Standfirst>
          The drone that characterises this war is not the Orion or the Bayraktar. It is a
          first-person-view racing quadcopter, often built from commercial parts, flown once. No
          public archive catalogues those individually — not because nobody has tried, but because
          the method cannot work: there is no identifiable wreck, no model to name, and the
          quantity defeats anyone photographing one at a time.
        </Standfirst>
        <div className="mt-7 grid gap-4 lg:grid-cols-3">
          <div className="story-card p-5" data-tone="hot">
            <Eyebrow tone="hot">what verification requires</Eyebrow>
            <p className="mt-3 text-[13px] leading-[1.6]">
              One photograph, of one object, identifiable to a model, posted publicly. A large
              airframe satisfies all four. A destroyed FPV drone satisfies none of them: what is
              left does not identify itself, and the operator&rsquo;s own video ends at impact.
            </p>
          </div>
          <div className="story-card p-5" data-tone="mid">
            <Eyebrow tone="mid">so where do the numbers come from</Eyebrow>
            <p className="mt-3 text-[13px] leading-[1.6]">
              Each side&rsquo;s defence ministry, which publishes daily figures for the
              other&rsquo;s losses and not its own. Those are the only sources large enough to
              quote, they cannot be checked, and they are the reason this page has no drone total.
            </p>
          </div>
          <div className="story-card p-5" data-tone="cool">
            <Eyebrow tone="cool">what the archive did publish</Eyebrow>
            <p className="mt-3 text-[13px] leading-[1.6]">
              {o.postIndex.unmannedPosts.length > 0 ? (
                <>
                  {o.postIndex.unmannedPosts.length} of its {o.postIndex.total} posts are titled for
                  an unmanned system — country programme surveys and a loitering-munition kill list,
                  not a running loss register. Its own index was read to check.
                </>
              ) : (
                <>Its post index was read for any dedicated drone list. There is none.</>
              )}
            </p>
          </div>
        </div>
        {o.postIndex.unmannedPosts.length > 0 && (
          <div className="story-card mt-4 p-5 sm:p-6">
            <ul className="m-0 list-none p-0">
              {o.postIndex.unmannedPosts.slice(0, 6).map((p) => (
                <li key={p.url} className="flex flex-wrap items-baseline gap-x-3 border-b py-2 last:border-0"
                  style={{ borderColor: "var(--story-rule)" }}>
                  <span className="mono text-[11px]" style={{ color: "var(--story-ink-3)" }}>{p.published}</span>
                  <a href={p.url} target="_blank" rel="noopener noreferrer nofollow"
                    className="min-w-0 flex-1 text-[12.5px] underline">{p.title}</a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ══ PART TWO ═════════════════════════════════════════════════════ */}
      {ai.present && (
        <>
          <section className="mt-20 border-t pt-10" style={{ borderColor: "var(--story-rule)" }}>
            <Eyebrow tone="mid">part two · the other unverifiable subject</Eyebrow>
            <Headline>AI in Military Operations, Measured Two Ways.</Headline>
            <Standfirst>
              The same problem one layer worse: capability claims come from vendors and ministries,
              market sizes from consultancy definitions. Two things survive. Money a government has
              obligated against a public award id, and incidents somebody catalogued with
              citations. Both are small against the noise, and both are labelled with what they
              actually measure.
            </Standfirst>
          </section>

          {/* ── Obligated money ───────────────────────────────────────── */}
          {termRows.length > 0 && (
            <section className="mt-7">
              <div className="story-card p-5 sm:p-7">
                <ChartTitle note={`US Department of Defense contract awards whose description contains each phrase, FY2016 to date. ${ai.doubleCounting}`}>
                  What the description says, and what it cost
                </ChartTitle>
                <RankedRows
                  tone="mid"
                  markTone="hot"
                  rows={termRows.map((r) => ({
                    name: `“${r.term}”`,
                    value: r.total,
                    display: usd(r.total),
                    mark: r.term === "artificial intelligence",
                    meta: r.last ? `FY${r.last.year}: ${usd(r.last.amount)}` : undefined,
                  }))}
                />
                <Caption>
                  <strong>These must not be added.</strong> An award whose description contains both
                  &ldquo;artificial intelligence&rdquo; and &ldquo;machine learning&rdquo; is in both
                  series. {ai.definition}
                </Caption>
                {aiTerm && aiTerm.years.length > 0 && (
                  <div className="mt-8 border-t pt-6" style={{ borderColor: "var(--story-rule)" }}>
                    <ChartTitle note="Obligations per fiscal year on awards whose description contains the phrase. US$ million.">
                      &ldquo;Artificial intelligence&rdquo;, by year
                    </ChartTitle>
                    <Columns
                      tone="hot"
                      height={170}
                      points={aiTerm.years.map((y) => ({
                        label: String(y.year).slice(2),
                        value: Math.max(0, y.amount / 1e6),
                      }))}
                      format={(v: number) => String(Math.round(v))}
                    />
                    <Caption>
                      One agency, one country. Only the United States publishes contract-level award
                      data, so the comparison a reader wants — what everyone else spends — is
                      unavailable at any level of effort, and its absence is not evidence that
                      others spend less.
                    </Caption>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── The register ──────────────────────────────────────────── */}
          <section className="mt-16">
            <Eyebrow tone="hot">catalogued, with citations</Eyebrow>
            <Headline>
              {ai.incidents.matched} Rows of {ai.incidents.totalRows.toLocaleString("en-US")}.
            </Headline>
            <Standfirst>
              A volunteer register of AI incidents and controversies, filtered to anything naming a
              force, a weapon or a military purpose. <Mark>{forceRows.length}</Mark> of them name an
              armed force, defence ministry or intelligence service as the deployer. That is the
              entire documented, cited case record — which is a finding about how little is written
              down, not a count of what has happened.
            </Standfirst>
            <div className="story-card mt-7 p-5 sm:p-7">
              <div className="grid gap-9 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
                <div className="min-w-0">
                  <ChartTitle note="Who the register names as having deployed the system. One dot is one row.">
                    Who deployed it
                  </ChartTitle>
                  <DotStrip
                    dotSize={9}
                    gap={3}
                    maxPerColumn={8}
                    bins={TIERS.map((t) => ({
                      label: t.label,
                      count: ai.incidents.byTier?.[t.id] ?? 0,
                      tone: t.tone,
                    }))}
                  />
                  <Caption>{ai.tiers}</Caption>
                </div>
                <div className="min-w-0">
                  <ChartTitle note="The technologies the register names, across all matched rows. A row may name several.">
                    What the systems are
                  </ChartTitle>
                  <RankedRows
                    tone="mid"
                    rows={ai.incidents.byTechnology.slice(0, 10).map((t) => ({
                      name: t.key,
                      value: t.n,
                      display: String(t.n),
                    }))}
                  />
                </div>
              </div>
              {ai.incidents.byYear.length > 0 && (
                <div className="mt-8 border-t pt-6" style={{ borderColor: "var(--story-rule)" }}>
                  <ChartTitle note="Rows by the year the register records the incident as having occurred.">
                    When
                  </ChartTitle>
                  <Columns
                    tone="hot"
                    height={130}
                    points={ai.incidents.byYear.map((y) => ({ label: y.key.slice(2), value: y.n }))}
                    format={(v: number) => String(Math.round(v))}
                  />
                  <Caption>
                    A register grows by what volunteers enter, so a rising line here is at least
                    partly a rising number of people entering rows. It is not an incidence rate.
                  </Caption>
                </div>
              )}
            </div>
          </section>

          {/* ── The cases ─────────────────────────────────────────────── */}
          {forceRows.length > 0 && (
            <section className="mt-14">
              <Eyebrow tone="hot">the cases</Eyebrow>
              <Headline>Where an Armed Force Is Named.</Headline>
              <Standfirst>
                Every row where the register names a military, a defence ministry or an
                intelligence service as the deployer, in the register&rsquo;s own words, with its
                own links. Each is a <Mark>catalogued report</Mark> and not an adjudicated fact —
                several are contested by the party they describe, and the register records that in
                its harm-status column rather than resolving it.
              </Standfirst>
              <ul className="mt-7 grid list-none gap-4 p-0 lg:grid-cols-2">
                {forceRows.slice(0, 12).map((i) => <IncidentCard key={`${i.ref}-${i.headline}`} i={i} />)}
              </ul>
              {stateRows.length > 0 && (
                <>
                  <h3 className="story-display mt-10 text-[20px]">And where a government is.</h3>
                  <ul className="mt-4 grid list-none gap-4 p-0 lg:grid-cols-2">
                    {stateRows.slice(0, 6).map((i) => <IncidentCard key={`${i.ref}-${i.headline}`} i={i} />)}
                  </ul>
                </>
              )}
              <Caption>
                {adjacentRows.length} further rows matched the keyword filter without naming a force
                or a government — surveillance systems, datasets, a school gun detector. They are
                real AI incidents and they are not military operations; they are kept in the data
                and out of this section.
              </Caption>
            </section>
          )}
        </>
      )}

      <WhatThisCannotSay
        items={[
          {
            q: "How many drones have been lost",
            a: <>Nothing here can say, and nothing here estimates it. The archive holds {bothUnmanned} unmanned aircraft against {bothStated.toLocaleString("en-US")} vehicles, because photo-verification cannot see a weapon that leaves no identifiable wreck. Every large figure in circulation comes from one of the two defence ministries and none can be checked.</>,
          },
          {
            q: "Which side is losing more",
            a: <>{o.undercount || "Photo-verification undercounts both sides and not equally."} The ratio between the two totals measures how much is photographed and posted as much as what is destroyed, and no chart here presents it as an exchange rate.</>,
          },
          {
            q: "When or where anything was lost",
            a: <>Not recorded. The archive dates entries by when the evidence surfaced rather than when the vehicle was hit, and publishes no coordinates, so this page carries no date and no location for any loss rather than implying one.</>,
          },
          {
            q: "Whether a drone was commercial or military",
            a: <>No published loss list separates a hobby quadcopter from a purpose-built airframe, and this page does not invent the distinction. What it can say is which categories are unmanned, and that the entries in them are the large expensive types.</>,
          },
          {
            q: "How much AI a military actually has",
            a: <>{ai.definition || "Awards are matched on description text, so the figure measures awards whose description says AI, not AI."} An obligation is a payment, not a capability, and classified programmes — where the subject mostly lives — appear in neither source.</>,
          },
          {
            q: "How many military AI incidents there have been",
            a: <>The register is volunteer-maintained; {ai.incidents.matched} of its {ai.incidents.totalRows.toLocaleString("en-US")} rows matched, {forceRows.length} naming a force. That is a measure of what has been written down and cited, and treating it as an incidence count would be the same error as treating the loss archive as a casualty figure.</>,
          },
          {
            q: "Whether any case here is true",
            a: <>Each is a catalogued report with its citations attached, several contested by the party described. The register records harm status rather than adjudicating, and so does this page — the links are there so a reader can go and look.</>,
          },
          {
            q: "Anything about people",
            a: <>Neither source counts a person and neither does this page. The loss archive records equipment; the register records systems and harms. No casualty figure of any kind appears here.</>,
          },
        ]}
      />

      <Sources>
        {o.present && <>Losses: {o.source} Built {o.builtAt.slice(0, 10)}; {agreed} of {attempted} sections reproduced their own stated totals and the rest are suppressed. </>}
        {ai.present && <>Military AI: {ai.sources.incidents} {ai.sources.spending} Built {ai.builtAt.slice(0, 10)}. </>}
        Every figure is arithmetic on those files; none is typed in.{" "}
        <Link href="/drones" className="underline">The drone proliferation map</Link>
        {" · "}
        <Link href="/stories/drones-and-the-strait" className="underline">India&rsquo;s own drone position</Link>
        .
      </Sources>
    </div>
  );
}
