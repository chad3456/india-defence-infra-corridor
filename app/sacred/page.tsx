import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import SacredMap from "@/components/map/SacredMap";
import { loadAtlas, byState, byHeritage, byFigure, byCentury, censusByYear } from "@/lib/sacred";
import type { CanonSet, Toponym, CensusLayer } from "@/lib/sacred";

/**
 * India's sacred landscape, and an argument about what a map of it can say.
 *
 * The request behind this page was to see the cultural landscape of each state
 * — temples aggregated across India and visualised by deity, Shiva and Durga
 * and the rest. The data does not support that page as stated, and the
 * interesting thing is exactly why.
 *
 * Wikidata holds 16,042 Hindu temples in India. It holds coordinates for 3,492
 * of them and a stated dedication for about 600, and within that 600 Shiva
 * holds four in five. Take those proportions at face value and you publish two
 * false claims with real numbers attached: that India's temples are where the
 * dots are, and that they are overwhelmingly Shiva's. The first is a fact
 * about who edits Wikidata — Tamil Nadu 969 sites, Uttar Pradesh 84. The
 * second is the fingerprint of a single bulk import.
 *
 * So this page leads with the coverage and only then draws the map, and every
 * share on it prints the denominator it came from. That ordering is the
 * argument.
 */

export const metadata = {
  title: "The sacred landscape",
  description:
    "Three and a half thousand Indian temple sites mapped from Wikidata, with heritage listings, founding dates and stated dedications — and an honest account of how uneven that record is.",
};

function n(x: number): string {
  return x.toLocaleString("en-IN");
}

function pct(a: number, b: number): string {
  if (b === 0) return "—";
  const v = (a / b) * 100;
  return `${v >= 10 ? v.toFixed(0) : v.toFixed(1)}%`;
}

/**
 * A ranked bar row. Width is share of the largest row, never of a total.
 *
 * The label column is sized per chart rather than once for all of them. State
 * and deity names are short; heritage designations are not — "Monument of
 * National Importance" and "West Bengal Heritage Commission listed building"
 * both truncated to an ellipsis at the shared width, which turned the one
 * column a reader needs to read into a guess. `wide` gives those charts the
 * room, and every label keeps a title attribute regardless.
 *
 * Both widths shrink below the small breakpoint, where a fixed 9.5rem label
 * plus a 6.5rem figure left the bar itself about a centimetre long.
 */
function Bar({
  label, value, max, of, colour = "var(--series-1)", wide = false,
}: {
  label: string; value: number; max: number; of?: number;
  colour?: string; wide?: boolean;
}) {
  const bar = (
    <>
      <span className="h-[9px] min-w-0 flex-1 rounded-sm bg-[var(--surface-2)]">
        <span
          className="block h-[9px] rounded-sm"
          style={{ width: `${Math.max(1.2, (value / max) * 100)}%`, background: colour }}
        />
      </span>
      <span className="mono w-[5rem] shrink-0 text-right text-[11.5px] tabular-nums text-[color:var(--text-secondary)] sm:w-[6.5rem] sm:text-[12px]">
        {n(value)}
        {of !== undefined && (
          <span className="text-[color:var(--text-muted)]"> · {pct(value, of)}</span>
        )}
      </span>
    </>
  );

  // Long labels get their own line on a phone. Squeezing "Monument of National
  // Importance" into a 120px column truncated eight of the twelve heritage
  // rows to an ellipsis, which turned the one column a reader has to read into
  // a guess; a second line costs 14px and says the whole thing.
  if (wide) {
    return (
      <div className="sm:flex sm:items-center sm:gap-3">
        <span
          className="block text-[12px] leading-snug sm:w-[14rem] sm:shrink-0 sm:truncate sm:text-[12.5px] lg:w-[17rem]"
          title={label}
        >
          {label}
        </span>
        <div className="mt-1 flex items-center gap-2.5 sm:mt-0 sm:min-w-0 sm:flex-1 sm:gap-3">{bar}</div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 sm:gap-3">
      <span
        className="w-[6.5rem] shrink-0 truncate text-[12px] sm:w-[9.5rem] sm:text-[12.5px]"
        title={label}
      >
        {label}
      </span>
      {bar}
    </div>
  );
}

function Section({
  eyebrow, title, children,
}: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-14">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="display mt-2 text-[24px] leading-tight sm:text-[28px]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function SacredPage() {
  const atlas = loadAtlas();
  const { sites, coverage } = atlas;

  const states = byState(sites);
  const heritage = byHeritage(sites);
  const stated = byFigure(sites, "stated");
  const centuries = byCentury(sites);
  // Both arrive with the ingest that builds them; an older atlas simply has
  // neither, and the sections are absent rather than empty.
  const canon: CanonSet[] | undefined = atlas.canon;
  const toponyms: Toponym[] | undefined = atlas.toponyms;
  const census: CensusLayer | null | undefined = atlas.census;
  const censusRows = census && census.shares.length > 0 ? censusByYear(census.shares) : [];

  const topTwo = states.slice(0, 2);
  const topTwoShare = topTwo.reduce((a, s) => a + s.n, 0);
  const up = states.find((s) => s.key === "Uttar Pradesh");
  const statedTotal = stated.reduce((a, s) => a + s.n, 0);
  const shiva = stated.find((s) => /^shiva$/i.test(s.key));
  const maxCentury = Math.max(1, ...centuries.map((c) => c.n));

  return (
    <main className="mx-auto max-w-[1180px] px-4 pb-24 sm:px-6">
      <PageHeader
        eyebrow="Cultural landscape"
        title="The sacred landscape, and what a map of it can honestly say"
        lede={
          <>
            Three and a half thousand temple sites, placed from Wikidata, with their heritage
            listings, founding dates and stated dedications. The map is real. The shape of it
            is mostly a fact about the database, and this page says which is which before it
            draws anything.
          </>
        }
        stats={[
          { k: "Sites mapped", v: n(coverage.mapped) },
          { k: "Heritage-listed", v: n(coverage.withHeritage) },
          { k: "Dedication stated", v: n(coverage.withStatedDedication) },
          { k: "Founding dated", v: n(coverage.withInception) },
        ]}
      />

      <Section eyebrow="Read this first" title="The map is of Wikidata, not of India">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="space-y-4 text-[14px] leading-[1.75] text-[color:var(--text-secondary)]">
            <p>
              Wikidata holds <strong className="text-[color:var(--text-primary)]">16,042</strong>{" "}
              Hindu temples in India and coordinates for{" "}
              <strong className="text-[color:var(--text-primary)]">3,492</strong> of them. This map
              draws {n(coverage.mapped)} — the rest are duplicates, unlabelled items, or two sites
              whose coordinates put them outside the country entirely.
            </p>
            <p>
              {topTwo[0] && topTwo[1] && (
                <>
                  {topTwo[0].key} carries {n(topTwo[0].n)} of them and {topTwo[1].key}{" "}
                  {n(topTwo[1].n)} — between them{" "}
                  <strong className="text-[color:var(--text-primary)]">
                    {pct(topTwoShare, coverage.mapped)}
                  </strong>{" "}
                  of the whole map.
                </>
              )}{" "}
              {up && <>Uttar Pradesh carries {n(up.n)}.</>} Nobody believes Uttar Pradesh has
              fewer temples than Kerala. What this measures is who has been entering them.
            </p>
            <p>
              That is not a reason to refuse the map. It is a reason to read it as a map of a
              record rather than of a country, and to distrust any share drawn from it that is
              not printed next to its denominator. Every figure on this page is.
            </p>
          </div>

          <div>
            <h3 className="eyebrow mb-3">Mapped sites by state</h3>
            <div className="space-y-2">
              {states.slice(0, 14).map((s) => (
                <Bar key={s.key} label={s.key} value={s.n} max={states[0]?.n ?? 1} of={coverage.mapped} />
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-[color:var(--text-muted)]">
              Bar length is share of the largest state, not of the total. {n(coverage.mapped - coverage.withState)}{" "}
              sites fall outside every state polygon — mostly coastal and island placements — and
              are drawn on the map but absent from this ranking.
            </p>
          </div>
        </div>
      </Section>

      <Section eyebrow="The map" title="Every site the record places">
        <SacredMap sites={sites} />
      </Section>

      <Section eyebrow="Dedication" title="Who the temples are for, and how well we know">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <div className="space-y-4 text-[14px] leading-[1.75] text-[color:var(--text-secondary)]">
            <p>
              The obvious chart here is a breakdown of temples by deity. The record cannot
              support one. Of {n(coverage.mapped)} mapped sites, {n(coverage.withStatedDedication)}{" "}
              — {pct(coverage.withStatedDedication, coverage.mapped)} — carry a stated dedication
              at all.
            </p>
            {shiva && (
              <p>
                Within that minority, Shiva holds {n(shiva.n)} of {n(statedTotal)} dedications,{" "}
                {pct(shiva.n, statedTotal)}. Read as a finding, that says four in five Indian
                temples are Shiva&rsquo;s. Read correctly, it is the fingerprint of one bulk
                import into a database — somebody loaded a large list of Shiva temples and
                nobody has loaded the equivalent for anyone else.
              </p>
            )}
            <p>
              So the figures below are what is <em>stated</em>, and nothing else has been mixed
              into them. Two further tiers are being built and will be labelled separately when
              they arrive: sites named in a tradition&rsquo;s own canonical list, and sites whose
              dedication is inferred from their name. Those are different kinds of claim and
              adding them together would produce a number that means nothing.
            </p>
          </div>
          <div>
            <h3 className="eyebrow mb-3">Stated dedications, by figure</h3>
            <div className="space-y-2">
              {stated.slice(0, 12).map((f) => (
                <Bar
                  key={f.key} label={f.key} value={f.n}
                  max={stated[0]?.n ?? 1} of={statedTotal}
                  colour="var(--series-2)"
                />
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-[color:var(--text-muted)]">
              Shares are of the {n(statedTotal)} stated dedications, not of the{" "}
              {n(coverage.mapped)} sites on the map. {stated.length} distinct figures appear.
            </p>
          </div>
        </div>
      </Section>

      <Section eyebrow="Evidence" title="What has actually been surveyed">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-4 text-[14px] leading-[1.75] text-[color:var(--text-secondary)]">
            <p>
              A site protected by a state body and a site attested only in a Purana are
              different kinds of claim, and a map that draws both as the same dot is making an
              argument it has not declared. {n(coverage.withHeritage)} of these sites carry a
              heritage designation — they have been surveyed, dated and listed by someone whose
              job it was.
            </p>
            <p>
              The Archaeological Survey of India publishes the authoritative list. Its site
              returned 8.4&nbsp;MB of HTML containing no state name at all, which is what a
              rendered application looks like rather than a table, so these designations come
              from Wikidata&rsquo;s own heritage-status field instead. That is a weaker source
              than the ASI directly and it is named as one.
            </p>
          </div>
          <div>
            <h3 className="eyebrow mb-3">Heritage designation</h3>
            <div className="space-y-2">
              {heritage.map((h) => (
                <Bar
                  key={h.key} label={h.key} value={h.n} wide
                  max={heritage[0]?.n ?? 1} colour="var(--series-3)"
                />
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-[color:var(--text-muted)]">
              {pct(coverage.withHeritage, coverage.mapped)} of mapped sites carry any listing.
              The absence of one is not evidence a site is unprotected — only that no one has
              recorded it here.
            </p>
          </div>
        </div>
      </Section>

      <Section eyebrow="Age" title="The few with a founding date">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-4 text-[14px] leading-[1.75] text-[color:var(--text-secondary)]">
            <p>
              {n(coverage.withInception)} sites — {pct(coverage.withInception, coverage.mapped)} —
              carry a stated founding date. That is far too few to describe when India built its
              temples, and the distribution below should be read as a sample of what has been
              dated rather than as a history of construction.
            </p>
            <p>
              Wikidata stores an inception as a full calendar date even when the source knew
              only a century, so a 7th-century temple arrives as &ldquo;0600-01-01&rdquo;. These
              are binned by century for that reason. Printing them as days would manufacture a
              precision nobody claimed.
            </p>
          </div>
          <div>
            <h3 className="eyebrow mb-3">Dated foundations by century</h3>
            <div className="space-y-1.5">
              {centuries.map((c) => (
                <Bar key={c.century} label={`${c.label} century`} value={c.n} max={maxCentury} colour="var(--series-4)" />
              ))}
            </div>
          </div>
        </div>
      </Section>

      {canon && canon.length > 0 && (
        <Section eyebrow="Canon" title="What the traditions say about themselves">
          <p className="mb-6 max-w-[68ch] text-[14px] leading-[1.75] text-[color:var(--text-secondary)]">
            A tradition naming its own sites is a different kind of evidence from a
            database field, and a better one for a question about tradition. These lists
            come from each tradition&rsquo;s own article. Two of them are not deity sets
            at all — the Char Dham spans three of Vishnu&rsquo;s sites and one of
            Shiva&rsquo;s, so it names no single god and contributes no dedication here.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {canon.map((c) => (
              <div key={c.id} className="rounded-lg border bg-[var(--surface-1)] p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-[13px] font-semibold">{c.label}</h3>
                  <span className="eyebrow shrink-0">
                    {c.deity ?? "a circuit"}
                  </span>
                </div>
                <p className="mono mt-2.5 text-[19px] leading-none tabular-nums">
                  {c.problems && c.problems.length > 0 ? (
                    <span className="text-[15px] text-[color:var(--text-muted)]">not read</span>
                  ) : (
                    <>
                      {n(c.placed)}
                      <span className="text-[13px] text-[color:var(--text-muted)]">
                        {" "}of {n(c.claimed)} placed
                      </span>
                    </>
                  )}
                </p>
                <p className="mt-2.5 text-[11.5px] leading-relaxed text-[color:var(--text-secondary)]">
                  {c.note}
                </p>
                {c.problems && c.problems.length > 0 ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-[color:var(--status-serious)]">
                    This tradition&rsquo;s list could not be read from its article, so
                    nothing here is drawn from it: {c.problems.join("; ")}.
                  </p>
                ) : c.placed < c.claimed ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-[color:var(--text-muted)]">
                    {n(c.claimed - c.placed)} of its sites are not in Wikidata with
                    coordinates, or are named there in a way this could not match without
                    guessing between candidates.
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      )}

      {toponyms && toponyms.length > 0 && (
        <Section eyebrow="Names" title="Varahamula, and what a place-name records">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div className="space-y-4 text-[14px] leading-[1.75] text-[color:var(--text-secondary)]">
              <p>
                Where no count survives, a name sometimes does. Kalhana&rsquo;s{" "}
                <em>Rajatarangini</em> and Stein&rsquo;s geographical index to it match
                Sanskrit place-names in Kashmir to their nineteenth-century forms, and
                that record is checkable in a way that a reconstructed population is not.
              </p>
              <p>
                Two different things sit in this table and they are marked apart. A
                phonetic change is centuries of ordinary drift with no author and no
                date. An official renaming is an administrative act with a year attached.
                Calling both &ldquo;renaming&rdquo; would suggest the first was a policy
                and the second an evolution.
              </p>
              <p>
                No etymology here is asserted by this site. Each row is a claim found in
                the cited article, quoted as it stands; a pairing that no article
                supports is not published.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[30rem] border-collapse text-left">
                <thead>
                  <tr className="border-b">
                    <th className="eyebrow pb-2 pr-3">Now</th>
                    <th className="eyebrow pb-2 pr-3">Earlier</th>
                    <th className="eyebrow pb-2">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {toponyms.filter((t) => t.verified).map((t) => (
                    <tr key={`${t.modern}-${t.older}`} className="border-b align-top">
                      <td className="py-2.5 pr-3 text-[13px] font-medium">{t.modern}</td>
                      <td className="py-2.5 pr-3 text-[13px]">{t.older}</td>
                      <td className="py-2.5 text-[12px] text-[color:var(--text-secondary)]">
                        {t.kind === "official"
                          ? `Renamed${t.year ? ` in ${t.year}` : ""}`
                          : "Phonetic drift"}
                        <span className="text-[color:var(--text-muted)]"> · {t.region}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8 space-y-3">
            {toponyms.filter((t) => t.verified && t.region === "Kashmir").map((t) => (
              <figure key={t.modern} className="rounded-lg border bg-[var(--surface-1)] p-4">
                <figcaption className="eyebrow mb-2">
                  {t.modern} ← {t.older}
                </figcaption>
                <blockquote className="text-[13px] leading-[1.7] text-[color:var(--text-secondary)]">
                  &ldquo;{t.evidence}&rdquo;
                </blockquote>
                <p className="mt-2 text-[11px] text-[color:var(--text-muted)]">
                  Wikipedia, &ldquo;{t.page.replace(/_/g, " ")}&rdquo;
                </p>
              </figure>
            ))}
          </div>

          {toponyms.some((t) => !t.verified) && (
            <p className="mt-5 text-[12px] leading-relaxed text-[color:var(--text-muted)]">
              {n(toponyms.filter((t) => !t.verified).length)} pairing
              {toponyms.filter((t) => !t.verified).length === 1 ? " is" : "s are"} held back:
              the article cited for{" "}
              {toponyms.filter((t) => !t.verified).map((t) => t.modern).join(", ")} carries
              no sentence supporting the older form, so nothing is claimed for it here.
            </p>
          )}
        </Section>
      )}

      {censusRows.length > 0 && census && (
        <Section eyebrow="Counting" title="Kashmir&rsquo;s demography, from where counting starts">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="space-y-4 text-[14px] leading-[1.75] text-[color:var(--text-secondary)]">
              <p>
                {censusRows.length === 1 ? (
                  <>
                    One census, {census.startsAt}. The record here does not yet give a
                    comparable series, and a single reading is shown as a single reading
                    rather than dressed as a trend.
                  </>
                ) : (
                  <>The series begins at {census.startsAt}.</>
                )}{" "}
                Not because earlier centuries are uninteresting, but because earlier
                centuries were not counted. The first enumeration of Kashmir worth the name
                is 1873 and the first comparable one 1891; before that there are chronicles,
                and a chronicle is not a census.
              </p>
              <p>
                These figures are read out of the cited article&rsquo;s own table, not
                written from memory. On this subject a misremembered percentage point is
                not a rounding error. Every column was checked to sum to about a hundred
                before any of it was published, and the layer is dropped whole rather than
                shown in part if it fails that.
              </p>
              <p className="text-[13px] text-[color:var(--text-muted)]">
                Territory covered by the census changes across this period — princely
                state, state, and since 2019 a union territory with Ladakh separated out —
                so the rows are not strictly like for like, and the boundary matters as
                much as the ratio.
              </p>
            </div>

            <div className="space-y-3">
              {censusRows.map((row) => (
                <div key={row.year}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="mono text-[12.5px] tabular-nums">{row.year}</span>
                    <span className="text-[11px] text-[color:var(--text-muted)]">
                      {row.parts.slice(0, 2).map((p) => `${p.group} ${p.percent.toFixed(1)}%`).join(" · ")}
                    </span>
                  </div>
                  <div className="flex h-[16px] w-full overflow-hidden rounded-sm">
                    {row.parts.map((p, i) => (
                      <span
                        key={p.group}
                        title={`${p.group}: ${p.percent.toFixed(2)}%`}
                        style={{
                          width: `${p.percent}%`,
                          background: [
                            "var(--series-1)", "var(--series-2)", "var(--series-3)",
                            "var(--series-4)", "var(--text-muted)",
                          ][i % 5],
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <p className="pt-1 text-[11px] leading-relaxed text-[color:var(--text-muted)]">
                Source: {census.source}, &ldquo;{census.page}&rdquo;.
                {censusRows.length > 1
                  ? " Bands are ordered by size at the most recent census and keep that order across every year, so a change in the bar is a change in the figures rather than a reshuffle."
                  : " Bands are ordered by size."}
              </p>
            </div>
          </div>
        </Section>
      )}

      <Section eyebrow="Refusals" title="What this page will not show you">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg border bg-[var(--surface-1)] p-5">
            <h3 className="text-[13px] font-semibold">Kashmir&rsquo;s demography before the censuses</h3>
            <p className="mt-2 text-[13px] leading-[1.7] text-[color:var(--text-secondary)]">
              There is no population count for Kashmir from the 1200s, or from any century
              before the colonial enumerations. Kalhana&rsquo;s <em>Rajatarangini</em> is a
              dynastic chronicle, not a census; it names kings and campaigns, not households.
              The first count worth the name is 1873 and the first comparable one 1891. A ratio
              drawn back to the age of Kashyapa would be a reconstruction presented as a
              measurement, on the most contested demographic question in the country. Where
              counting starts, this will start.
            </p>
          </div>
          <div className="rounded-lg border bg-[var(--surface-1)] p-5">
            <h3 className="text-[13px] font-semibold">A national deity breakdown</h3>
            <p className="mt-2 text-[13px] leading-[1.7] text-[color:var(--text-secondary)]">
              Not from this data. {pct(coverage.withStatedDedication, coverage.mapped)} coverage,
              skewed by a bulk import and by two states holding half the map, cannot produce a
              statement about India. The canonical lists — the twelve Jyotirlingas, the 108 Divya
              Desams, the Shakta Pithas — are a sounder basis, because there a tradition is
              making a checkable claim about itself, and that tier is being built next.
            </p>
          </div>
        </div>
        {atlas.rejected.length > 0 && (
          <p className="mt-6 text-[12px] leading-relaxed text-[color:var(--text-muted)]">
            Two sites were dropped for coordinates that place them outside India:{" "}
            {atlas.rejected.map((r) => r.name).join(" and ")} — one landing in the Gulf of
            Thailand, the other in Liverpool. Both are real temples with an upstream error
            attached, and they are listed in the data file rather than quietly discarded.
          </p>
        )}
      </Section>

      <Section eyebrow="Provenance" title="Where this comes from">
        <p className="max-w-[62ch] text-[14px] leading-[1.75] text-[color:var(--text-secondary)]">
          {atlas.source} Built {new Date(atlas.builtAt).toISOString().slice(0, 10)} and refreshed
          weekly. {atlas.note}
        </p>
        <p className="mt-4 text-[13px]">
          <Link href="/methodology" className="underline underline-offset-4">
            How sources are judged
          </Link>
          <span className="mx-2 text-[color:var(--text-muted)]">·</span>
          <Link href="/sources" className="underline underline-offset-4">
            The source register
          </Link>
        </p>
      </Section>
    </main>
  );
}
