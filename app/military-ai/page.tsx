import {
  loadStories, loadMilitaryAi, countryOfDeployer,
} from "@/lib/warroom";
import { numericOf } from "@/lib/iso";
import {
  Eyebrow, Headline, Standfirst, Mark, Stat, Sources, WhatThisCannotSay, Columns,
} from "@/components/stories/Kit";
import { ChartTitle, Caption, RankedRows, Choropleth, TimeSeries } from "@/components/stories/Charts";

/**
 * Who is using AI for war, as far as anyone outside a defence ministry can tell.
 *
 * ── Three sources, three different kinds of weakness ─────────────────────
 *
 * A STORY REGISTER built by an engine that reads fourteen defence publishers
 * every four hours. Live and growing, and skewed hard toward English-language
 * coverage of the United States and NATO.
 *
 * AN INCIDENT REGISTER — AIAAIC's volunteer spreadsheet — which is dated and
 * per-row sourced, and carries no country column at all, so a country can only
 * be read off the deployer's name where the name contains one.
 *
 * CONTRACT SPENDING from USAspending, which is obligated money against public
 * award ids and is the only hard series here. It covers one country.
 *
 * None of the three is a measurement of how much military AI exists. Together
 * they are a record of how much has been written down in public, which is a
 * different thing, and the page says which is which per section rather than
 * once at the top.
 *
 * ── The bias that cannot be corrected, only stated ───────────────────────
 *
 * Everything here is English-language open reporting. A country with a free
 * press and a large defence trade press will look like a heavy user of
 * military AI; a country with neither will look like it has none. That is the
 * single largest distortion on the page and no weighting fixes it, so it is
 * printed beside every country chart rather than in a footnote.
 */

export const metadata = {
  title: "Military AI: who is using it, as far as anyone can tell · Bharat Tracker",
  description:
    "A live register of military-AI and drone-warfare reporting from fourteen defence "
    + "publishers, the AIAAIC incident register, and US contract spending — with the "
    + "English-language reporting bias stated rather than corrected.",
};

export default function MilitaryAiPage() {
  const s = loadStories();
  const ai = loadMilitaryAi();

  if (!s.present && !ai.present) {
    return (
      <div className="pt-12">
        <Eyebrow>not built</Eyebrow>
        <Headline>The military-AI registers are not in this deployment.</Headline>
        <Standfirst>
          Run <span className="mono">npm run warstories:ingest</span> and{" "}
          <span className="mono">npm run ai:build</span> in CI.
        </Standfirst>
      </div>
    );
  }

  /* Country counts from the two registers, kept separate because they measure
     different things and adding them would imply a common unit. */
  const storyCountries = s.byCountry;
  const incidentCountries = new Map<string, { iso: string; name: string; n: number }>();
  let unassigned = 0;
  for (const r of ai.incidents.rows) {
    if (r.tier === "adjacent") continue;
    const c = countryOfDeployer(r.deployer);
    if (!c) { unassigned++; continue; }
    const row = incidentCountries.get(c.iso) ?? { iso: c.iso, name: c.name, n: 0 };
    row.n++;
    incidentCountries.set(c.iso, row);
  }

  const aiSpend = ai.spending.find((x) => x.term === "artificial intelligence" && x.ok);
  const spendSeries = (aiSpend?.years ?? []).map((y) => ({ year: y.year, value: y.amount }));

  const total = s.counts.stories + ai.incidents.matched;
  const corroborated = s.counts.corroboration.two + s.counts.corroboration.threePlus;

  return (
    <div>
      <header className="pt-10">
        <Eyebrow tone="hot">
          military ai · {s.counts.stories} stories · {ai.incidents.matched} logged incidents ·{" "}
          {s.counts.feedsAnswered}/{s.counts.feedsTried} publishers answering
        </Eyebrow>
        <h1 className="story-display mt-4 max-w-[19ch] text-[36px] sm:text-[50px] lg:text-[58px]">
          A Record of What Was Written Down.
        </h1>
        <Standfirst>
          An engine reads fourteen defence publishers every four hours and keeps what is both
          military and about AI, autonomy, drones, targeting or electronic warfare. Beside it sits
          a volunteer incident register and one country&rsquo;s contract spending.{" "}
          <Mark>{total}</Mark> entries between them — and not one of them measures how much
          military AI exists. They measure how much has been written down in public.
        </Standfirst>
        <p className="mt-5 max-w-[68ch] rounded-lg border p-4 text-[13px] leading-[1.6]"
          style={{ borderColor: "var(--s-hot)", color: "var(--story-ink-2)" }}>
          <strong style={{ color: "var(--story-ink)" }}>
            This is a map of the English-language defence press, not of military AI.
          </strong>{" "}
          A country with a free press and a large trade press looks like a heavy user; a country
          with neither looks like it has none. That distortion is the largest thing on this page
          and no weighting fixes it. Read every country chart below as &ldquo;how much was
          reported in English&rdquo; and the comparison between two countries as almost
          meaningless.
        </p>
      </header>

      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat size="md" tone="mid" label="stories in the register" value={String(s.counts.stories)}
          note={<>From {s.counts.itemsSeen} items seen on the last sweep. The register accumulates
            every four hours and drops stories unseen for two years.</>} />
        <Stat size="md" tone="cool" label="carried by two or more newsrooms" value={String(corroborated)}
          note={<>{s.counts.corroboration.threePlus} by three or more. Corroboration is the only
            quality signal available: the engine cannot check a claim.</>} />
        <Stat size="md" tone="hot" label="logged incidents" value={String(ai.incidents.matched)}
          note={<>Of {ai.incidents.totalRows.toLocaleString("en-US")} rows in AIAAIC&rsquo;s
            register. {ai.incidents.byTier.force} name an armed force as the deployer.</>} />
        <Stat size="md" tone="mid" label="publishers answering"
          value={`${s.counts.feedsAnswered}/${s.counts.feedsTried}`}
          note={<>A feed that stops answering lowers corroboration on every story, so the count
            is published rather than assumed.</>} />
      </section>

      {/* ── What the reporting is about ───────────────────────────────── */}
      {s.byTheme.length > 0 && (
        <section className="mt-14">
          <Eyebrow tone="hot">what it is about</Eyebrow>
          <Headline>Drones, Then Autonomy.</Headline>
          <Standfirst>
            Each story is tested against five vocabularies and may match several. A story counts
            once per theme it carries.
          </Standfirst>
          <div className="story-card mt-7 p-5 sm:p-6">
            <ChartTitle note="Stories in the register carrying each theme.">
              The register by theme
            </ChartTitle>
            <RankedRows
              tone="hot"
              rows={s.byTheme.map((t) => ({ name: t.label, value: t.n, display: String(t.n) }))}
            />
            <Caption>
              An item must match a military vocabulary AND a theme to be kept at all. &ldquo;AI&rdquo;
              and &ldquo;drone&rdquo; appear constantly in civil reporting, and without both tests
              this would be a register of technology news wearing a military name.
            </Caption>
          </div>
        </section>
      )}

      {/* ── Countries ─────────────────────────────────────────────────── */}
      <section className="mt-14">
        <Eyebrow tone="mid">who</Eyebrow>
        <Headline>Named in the Reporting.</Headline>
        <Standfirst>
          Countries a headline names, from a fixed list rather than a place-name extractor — which
          over headlines produces confident nonsense, since Georgia and Jordan are people and
          Turkey is a bird.
        </Standfirst>

        {storyCountries.length > 0 && (
          <div className="story-card mt-7 p-5 sm:p-6">
            <ChartTitle note="Stories whose headline names each country.">
              In the live story register
            </ChartTitle>
            <RankedRows
              tone="mid"
              rows={storyCountries.slice(0, 14).map((c) => ({
                name: c.name, value: c.n, display: String(c.n), mark: c.iso === "IND",
              }))}
            />
            <Caption>
              A count of mentions in headlines, which rewards countries the English-language
              defence press covers. It is not a ranking of capability, activity or spending, and
              reading it as one would get every country wrong in the same direction.
            </Caption>
          </div>
        )}

        {incidentCountries.size > 0 && (
          <div className="story-card mt-5 p-5 sm:p-6">
            <ChartTitle note="Incidents whose deployer is an armed force or a government.">
              In the incident register
            </ChartTitle>
            <RankedRows
              tone="hot"
              rows={[...incidentCountries.values()].sort((a, b) => b.n - a.n).map((c) => ({
                name: c.name, value: c.n, display: String(c.n), mark: c.iso === "IND",
              }))}
            />
            <Caption>
              AIAAIC carries no country column, so a country is read off the deployer&rsquo;s name
              only where the name contains one. {unassigned} force- and state-tier incidents name
              an organisation this could not place and are absent from this chart rather than
              guessed at. The register&rsquo;s remaining {ai.incidents.byTier.adjacent} rows name
              neither a force nor a government and are excluded entirely.
            </Caption>
          </div>
        )}

        {incidentCountries.size > 1 && (
          <div className="story-card mt-5 p-5 sm:p-6">
            <ChartTitle note="Force- and state-tier incidents, by the country of the deployer.">
              The same, on a map
            </ChartTitle>
            <Choropleth
              rows={[...incidentCountries.values()]
                .map((c) => ({ id: numericOf(c.iso) ?? "", name: c.name, value: c.n }))
                .filter((r) => r.id !== "")}
              height={380}
              unit="logged incidents"
              marked="356"
            />
            <Caption>
              A dozen countries at most, from a few dozen rows. Every blank country on this map is
              a country nobody logged an incident for, which is not the same as a country with
              none.
            </Caption>
          </div>
        )}
      </section>

      {/* ── Money ─────────────────────────────────────────────────────── */}
      {spendSeries.length > 2 && (
        <section className="mt-14">
          <Eyebrow tone="cool">money</Eyebrow>
          <Headline>The One Hard Series.</Headline>
          <Standfirst>
            US Department of Defense contract obligations on awards matching
            &ldquo;artificial intelligence&rdquo;, by fiscal year. Obligated money against public
            award ids — the only figure on this page that is a measurement rather than a count of
            coverage.
          </Standfirst>
          <div className="story-card mt-7 p-5 sm:p-6">
            <ChartTitle note="Obligations on matching awards, by US fiscal year.">
              US defence AI contract obligations
            </ChartTitle>
            <TimeSeries
              points={spendSeries}
              tone="cool"
              height={300}
              format={(v) => (v >= 1e9 ? `$${(v / 1e9).toFixed(1)}bn` : `$${Math.round(v / 1e6)}m`)}
              unit="obligated"
            />
            <Caption>
              A keyword search over award descriptions, so it catches awards that mention AI and
              misses awards that do the same work without the phrase. It is a floor on one
              country&rsquo;s spending and says nothing about anyone else&rsquo;s — no comparable
              public series exists for most of the countries above.
            </Caption>
          </div>
        </section>
      )}

      {/* ── The stories themselves ────────────────────────────────────── */}
      {s.stories.length > 0 && (
        <section className="mt-14">
          <Eyebrow tone="hot">the register</Eyebrow>
          <Headline>Best-Corroborated First.</Headline>
          <Standfirst>
            Ordered by how many independent newsrooms carried each story, then by recency. Both
            mechanical; neither is a judgement about significance.
          </Standfirst>
          <ul className="mt-7 grid list-none grid-cols-[minmax(0,1fr)] gap-3 p-0 lg:grid-cols-2">
            {s.stories.slice(0, 60).map((story) => (
              <li key={story.id} className="story-card min-w-0 p-4"
                data-tone={story.sources.length >= 3 ? "cool" : story.sources.length === 2 ? "mid" : "hot"}>
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span className="mono text-[10.5px] font-bold"
                    style={{ color: `var(--s-${story.sources.length >= 3 ? "cool" : story.sources.length === 2 ? "mid" : "hot"})` }}>
                    {story.sources.length} newsroom{story.sources.length === 1 ? "" : "s"}
                  </span>
                  <span className="mono text-[10px]" style={{ color: "var(--story-ink-3)" }}>
                    {story.lastSeen}
                  </span>
                  {story.countries.map((c) => (
                    <span key={c.iso} className="mono text-[10px]" style={{ color: "var(--story-ink-3)" }}>
                      {c.iso}
                    </span>
                  ))}
                </div>
                <p className="mt-1.5 text-[13px] font-semibold leading-[1.4]">{story.headline}</p>
                <p className="mt-2 break-words text-[11px] leading-[1.5]"
                  style={{ color: "var(--story-ink-3)", overflowWrap: "anywhere" }}>
                  {story.sources.map((src, i) => (
                    <span key={src.url}>
                      {i > 0 && " · "}
                      <a href={src.url} target="_blank" rel="noopener noreferrer" className="underline">
                        {src.outlet}
                      </a>
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
          <Caption>
            A single-newsroom story is a lead, not a finding. Three newsrooms running the same
            agency copy is still one source wearing three hats, and nothing here can tell the
            difference — which is why the count is shown rather than folded into a grade.
          </Caption>
        </section>
      )}

      <WhatThisCannotSay
        items={[
          {
            q: "How much military AI exists",
            a: <>Nothing here measures that. Two of the three sources count published reporting
              and the third counts one country&rsquo;s contracts. A programme nobody has written
              about is invisible to all three, and the programmes most worth knowing about are
              the ones least likely to be written about.</>,
          },
          {
            q: "Whether one country uses more than another",
            a: <>The comparison is close to meaningless. Both country charts reward being covered
              by the English-language defence press, and no weighting corrects for a closed press
              or a language barrier.</>,
          },
          {
            q: "Whether any story is true",
            a: <>The engine counts newsrooms; it cannot check a claim. Corroboration means several
              outlets carried something, which is a weaker statement than it looks — wire copy
              propagates, and this cannot see that it has.</>,
          },
          {
            q: "Anything before the register started",
            a: <>The story register accumulates forward from its first run and cannot see what was
              published before it. The incident register reaches further back but is a volunteer
              project with no claim to completeness in any year.</>,
          },
        ]}
      />

      <Sources>
        Stories from {s.counts.feedsTried} defence publishers read as RSS, each probed before it
        was added; outlets whose feeds did not answer are absent rather than listed and broken.
        Incidents from the AIAAIC Repository, the public incidents and controversies spreadsheet.
        Spending from the USAspending.gov API, Department of Defense contract awards aggregated by
        fiscal year. GDELT was the intended backbone for story discovery and refused every query
        from CI addresses, which is why the register accumulates over scheduled runs rather than
        answering one large query.
        {s.builtAt && <> Story register built {s.builtAt.slice(0, 16).replace("T", " ")} UTC;</>}
        {ai.builtAt && <> incidents {ai.builtAt.slice(0, 10)}.</>}
      </Sources>
    </div>
  );
}
