import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import DisputedMap from "@/components/map/DisputedMap";
import {
  loadDisputed, byState, byDistrict, claimBreakdown, SPLIT_SINCE,
} from "@/lib/disputed";

/**
 * One book's list, published as one book's list.
 *
 * Sita Ram Goel's "Hindu Temples: What Happened to Them" carries a
 * state-by-district catalogue of Muslim monuments its author asserts stand on
 * demolished temples. It is among the most-cited and most-disputed documents in
 * the argument over India's medieval past, and it is regularly reproduced
 * online stripped of any indication that it is an argument at all.
 *
 * That is the reason to render it carefully rather than not at all. A reader
 * who wants to know what this list actually says should be able to find out
 * without being handed either a suppressed source or an endorsed one. So the
 * page states whose claim this is before it draws anything, keeps the author's
 * own categories rather than merging them into a verdict, publishes no total,
 * and never lets these entries touch the temple atlas.
 *
 * The one thing this page must not become is a map of destroyed temples. It is
 * a map of a bibliography.
 */

export const metadata = {
  title: "A disputed list",
  description:
    "Sita Ram Goel's 1990 catalogue of monuments claimed to stand on Hindu temple sites, recorded as one contested source's claims — with its method, its coverage bias, and what it does not contain stated plainly.",
};

function n(x: number): string {
  return x.toLocaleString("en-IN");
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

export default function DisputedPage() {
  const d = loadDisputed();
  const states = byState(d.entries);
  const districts = byDistrict(d.entries);
  const claims = claimBreakdown(d.claimTypes);
  const maxClaim = Math.max(1, ...claims.map((c) => c.n));
  const maxDistrict = Math.max(1, ...districts.map((x) => x.n));

  return (
    <main className="mx-auto max-w-[1180px] px-4 pb-24 sm:px-6">
      <PageHeader
        eyebrow="A contested source"
        title="One book's list, published as one book's list"
        lede={
          <>
            In 1990 Sita Ram Goel published a state-by-district catalogue of mosques,
            dargahs and forts he asserted stood on the sites of demolished Hindu temples.
            It is one of the most-cited and most-disputed documents in the argument over
            India&rsquo;s medieval past, and it circulates widely with no indication that
            it is an argument. This page records what it says, and who says it.
          </>
        }
        stats={[
          { k: "Entries", v: n(d.entries.length) },
          { k: "States", v: n(d.states.length) },
          { k: "Districts", v: n(d.districts) },
          { k: "Published", v: "1990" },
        ]}
      />

      <div className="mt-8 rounded-lg border-l-2 border-l-[color:var(--status-serious)] bg-[var(--surface-1)] p-5">
        <p className="eyebrow mb-2">Before the map</p>
        <p className="max-w-[70ch] text-[14px] leading-[1.75]">
          <strong>Every entry here names a mosque, dargah, idgah or fort — not a temple.</strong>{" "}
          None of it is on the temple map, and none of it has been independently verified.
          These are the assertions of one author, writing into the Ayodhya dispute, whose
          method and conclusions are contested by other historians. Counting them tells you
          what he compiled; it does not tell you what happened.
        </p>
      </div>

      <Section eyebrow="What it does not contain" title="The three things people come here for">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              k: "Temple locations",
              v: "Not in this book. Every entry is a Muslim monument, named as such. The temples it refers to are, by its own argument, gone.",
            },
            {
              k: "Visitor numbers",
              v: "Not one, anywhere in either volume. It is a historical polemic, not a gazetteer. Footfall for living temples has to come from the trusts that administer them.",
            },
            {
              k: "Coordinates",
              v: "None. The list gives a district and usually a town, which is why this page shades states rather than dropping pins.",
            },
          ].map((x) => (
            <div key={x.k} className="rounded-lg border bg-[var(--surface-1)] p-4">
              <h3 className="text-[13px] font-semibold">{x.k}</h3>
              <p className="mt-2 text-[12.5px] leading-[1.7] text-[color:var(--text-secondary)]">
                {x.v}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Distribution" title="Where the book looked">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <DisputedMap states={states} />
          <div>
            <h3 className="eyebrow mb-3">Entries by state, as the book files them</h3>
            <div className="space-y-2">
              {states.map((s) => (
                <div key={s.book} className="flex items-center gap-3">
                  <span className="w-[8.5rem] shrink-0 truncate text-[12.5px]" title={s.book}>
                    {s.book.charAt(0) + s.book.slice(1).toLowerCase()}
                  </span>
                  <span className="h-[9px] min-w-0 flex-1 rounded-sm bg-[var(--surface-2)]">
                    <span
                      className="block h-[9px] rounded-sm"
                      style={{
                        width: `${Math.max(1.2, (s.n / (states[0]?.n ?? 1)) * 100)}%`,
                        background: "var(--series-1)",
                      }}
                    />
                  </span>
                  <span className="mono w-[3rem] shrink-0 text-right text-[12px] tabular-nums text-[color:var(--text-secondary)]">
                    {n(s.n)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 max-w-[52ch] text-[11px] leading-relaxed text-[color:var(--text-muted)]">
              These are 1990 states. Four of today&rsquo;s did not exist:{" "}
              {SPLIT_SINCE.map((s) => `${s.now} was part of ${s.then}`).join(", ")}. An entry
              filed under Madhya Pradesh may sit in what is now Chhattisgarh, so the shaded
              polygon is the closest honest rendering rather than an exact one.
            </p>
          </div>
        </div>
      </Section>

      <Section eyebrow="The verdicts" title="Three different assertions, kept apart">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-4 text-[14px] leading-[1.75] text-[color:var(--text-secondary)]">
            <p>
              The book does not say one thing about its entries. It says several, and they
              rest on different evidence. &ldquo;Temple materials used&rdquo; is an
              observation about spolia — carved stone reused in a wall, which is visible and
              often uncontroversial. &ldquo;Temple site&rdquo; is a claim about what stood
              there before, which usually rests on a chronicle or an inscription.
              &ldquo;Converted temple&rdquo; asserts the building itself was one.
            </p>
            <p>
              Those are not interchangeable, and a single figure covering all of them would
              make the list say something its author did not. They are kept apart here for
              that reason, and no total is published: a row count is a count of what one man
              catalogued in 1990.
            </p>
            <p className="text-[13px] text-[color:var(--text-muted)]">
              {d.unclassified}
            </p>
          </div>
          <div>
            <h3 className="eyebrow mb-3">Entries by the book&rsquo;s own verdict</h3>
            <div className="space-y-2">
              {claims.slice(0, 8).map((c) => (
                <div key={c.k} className="flex items-center gap-3">
                  {/* Wraps rather than truncates: "Converted Mãhãlakshmî Temple"
                      lost its deity to an ellipsis, and the deity is the whole
                      content of that verdict. */}
                  <span className="w-[9rem] shrink-0 text-[12.5px] leading-snug sm:w-[12rem]" title={c.k}>
                    {c.k}
                  </span>
                  <span className="h-[9px] min-w-0 flex-1 rounded-sm bg-[var(--surface-2)]">
                    <span
                      className="block h-[9px] rounded-sm"
                      style={{ width: `${Math.max(1.2, (c.n / maxClaim) * 100)}%`, background: "var(--series-3)" }}
                    />
                  </span>
                  <span className="mono w-[3rem] shrink-0 text-right text-[12px] tabular-nums text-[color:var(--text-secondary)]">
                    {n(c.n)}
                  </span>
                </div>
              ))}
            </div>
            {claims.length > 8 && (
              <p className="mt-3 text-[11px] text-[color:var(--text-muted)]">
                {claims.length - 8} further verdicts appear once or twice each, naming a
                specific deity&rsquo;s temple.
              </p>
            )}
          </div>
        </div>
      </Section>

      <Section eyebrow="Concentration" title="The twenty districts the list returns to">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left">
            <thead>
              <tr className="border-b">
                <th className="eyebrow pb-2 pr-3">District</th>
                <th className="eyebrow pb-2 pr-3">State, as filed</th>
                <th className="eyebrow pb-2">Entries</th>
              </tr>
            </thead>
            <tbody>
              {districts.slice(0, 20).map((x) => (
                <tr key={`${x.state}-${x.district}`} className="border-b">
                  <td className="py-2 pr-3 text-[13px] font-medium">{x.district}</td>
                  <td className="py-2 pr-3 text-[12px] text-[color:var(--text-secondary)]">
                    {x.state.charAt(0) + x.state.slice(1).toLowerCase()}
                  </td>
                  <td className="py-2">
                    <span className="flex items-center gap-2">
                      <span className="h-[8px] w-[7rem] rounded-sm bg-[var(--surface-2)]">
                        <span
                          className="block h-[8px] rounded-sm"
                          style={{ width: `${(x.n / maxDistrict) * 100}%`, background: "var(--series-1)" }}
                        />
                      </span>
                      <span className="mono text-[12px] tabular-nums">{n(x.n)}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 max-w-[68ch] text-[11px] leading-relaxed text-[color:var(--text-muted)]">
          A district appears often here when it has a dense medieval building record and a
          well-documented gazetteer, not necessarily when more happened in it. Delhi, Agra
          and Bijapur are among the most thoroughly surveyed places in India.
        </p>
      </Section>

      <Section eyebrow="How to read it" title="What would settle any one of these">
        <div className="max-w-[70ch] space-y-4 text-[14px] leading-[1.75] text-[color:var(--text-secondary)]">
          <p>
            Each line in this catalogue is a testable proposition about one building, and the
            evidence that would settle it is specific: excavation beneath the structure,
            epigraphy naming a predecessor, or a datable chronicle describing the event. Some
            entries have that behind them. Many rest on a district gazetteer&rsquo;s passing
            remark, and a few on the presence of reused stone, which proves a quarry and not
            a demolition — medieval builders reused material constantly, including from
            ruined buildings of their own faith.
          </p>
          <p>
            Historians disagree sharply about the aggregate, and the disagreement is real
            scholarship rather than evasion on either side. Nothing on this page adjudicates
            it. What the page can do is refuse the move that makes the argument impossible —
            turning a list of individually checkable claims into a single number that cannot
            be checked at all.
          </p>
          <p className="text-[color:var(--text-primary)]">{d.framing}</p>
        </div>
      </Section>

      <Section eyebrow="Provenance" title="Where this comes from">
        <p className="max-w-[62ch] text-[14px] leading-[1.75] text-[color:var(--text-secondary)]">
          {d.source.author}, <em>{d.source.title}</em>. {d.source.publisher}.{" "}
          {d.source.chapter}. Extracted{" "}
          {new Date(d.builtAt).toISOString().slice(0, 10)} from a copy supplied to this
          project. The book is in copyright; what is recorded here is the factual content of
          its list — place, district and the author&rsquo;s verdict — not its prose.
        </p>
        <p className="mt-4 text-[13px]">
          <Link href="/sacred" className="underline underline-offset-4">
            The temple atlas, which this is kept out of
          </Link>
          <span className="mx-2 text-[color:var(--text-muted)]">·</span>
          <Link href="/methodology" className="underline underline-offset-4">
            How sources are judged
          </Link>
        </p>
      </Section>
    </main>
  );
}
