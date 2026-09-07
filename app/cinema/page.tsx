import Link from "next/link";
import { loadCinema } from "@/lib/cinema";
import CinemaTable from "@/components/charts/CinemaTable";

/**
 * What India is watching.
 *
 * The page it is not: a showtime tracker. BookMyShow, District and Paytm each
 * answered 403 to a plainly identified request and to the browser-agent retry
 * this project already makes for publishers that refuse bots. Reading them
 * would mean defeating bot protection rather than reading a page.
 *
 * What it is instead is arguably the better question. A showtime count says
 * how many screens a distributor booked; box office says how many people
 * actually went.
 */

export const metadata = {
  title: "What India is watching",
  description:
    "Films released in India this year by language, with worldwide gross where it has been reported, and momentum built from daily readings rather than claimed.",
};

export default function CinemaPage() {
  const data = loadCinema();
  const days = data.runs.length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">Cinema</p>
        <h1 className="mt-2 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-ink">
          What India is watching
        </h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          This year&rsquo;s releases in five languages, with worldwide gross where anyone has
          reported one. Most have no figure yet, and that is the honest state of the record
          rather than a hole in this one.
        </p>
      </header>

      {data.present ? (
        <>
          <section className="mb-8 rounded-lg border border-gridline bg-surface-1 p-5">
            <h2 className="text-sm font-semibold text-ink">Why this is box office and not showtimes</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">
              The obvious source was the ticketing platforms. BookMyShow, District and Paytm each
              answered 403 — to a request that identified itself, and to the browser-agent retry
              this project already makes for publishers that reject bots. They are not failing to
              serve listings; they are declining automated access, and the step past a 403 like
              that is defeating bot protection rather than reading a page.
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-2">
              So these come from Wikipedia&rsquo;s per-language release lists, which carry
              worldwide gross columns updated through a film&rsquo;s run. It is arguably the better
              measure: a showtime count says how many screens a distributor booked, and box office
              says how many people actually went.
            </p>
          </section>

          <section className="mb-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-gridline bg-surface-2 p-4">
              <p className="text-[11px] uppercase tracking-wide text-ink-muted">Films listed</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{data.films.length}</p>
              <p className="mt-1 text-xs leading-snug text-ink-2">
                Across {data.languages.length} languages, from this year&rsquo;s release lists.
              </p>
            </div>
            <div className="rounded-lg border border-gridline bg-surface-2 p-4">
              <p className="text-[11px] uppercase tracking-wide text-ink-muted">With a figure</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{data.reported}</p>
              <p className="mt-1 text-xs leading-snug text-ink-2">
                The rest are listed without one. A film with no reported gross is shown as
                unreported, never as zero.
              </p>
            </div>
            <div className="rounded-lg border border-gridline bg-surface-2 p-4">
              <p className="text-[11px] uppercase tracking-wide text-ink-muted">Days watched</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{days}</p>
              <p className="mt-1 text-xs leading-snug text-ink-2">
                {days >= 14
                  ? "Enough to compare whole weeks."
                  : `Momentum needs about 14. Until then it reads "too early", because it is.`}
              </p>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="mb-3 text-sm font-semibold text-ink">By language</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.languages.map((l) => (
                <div key={l.language}
                  className="flex items-baseline justify-between rounded border border-gridline bg-surface-1 px-3 py-2">
                  <span className="text-sm text-ink">{l.language}</span>
                  <span className="text-xs text-ink-2">
                    {l.films} film{l.films === 1 ? "" : "s"} ·{" "}
                    <span className="font-mono tabular-nums">
                      {l.reported > 0 ? `₹${Math.round(l.croreTotal).toLocaleString("en-IN")} cr` : "no figures yet"}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-snug text-ink-muted">
              A language total sums only the films that have reported, so it is a floor and not a
              tally. Kannada leads it here because its list is the best maintained, not because it
              out-earned Hindi.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="mb-3 text-sm font-semibold text-ink">Every film on the list</h2>
            <CinemaTable films={data.films} />
          </section>

          <section className="mb-10">
            <h2 className="text-sm font-semibold text-ink">How momentum is read, and why it waits</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-gridline bg-surface-1 p-4">
                <p className="text-sm font-medium text-ink">The trend is earned, not fetched</p>
                <p className="mt-1 text-xs leading-snug text-ink-2">
                  Nobody publishes what is rising and what is dying. Gross is cumulative, so a
                  single reading says how a film has done and not how it is doing — the difference
                  between two days is what it earned that day. This project has to watch to know,
                  and it has been watching for {days} day{days === 1 ? "" : "s"}.
                </p>
              </div>
              <div className="rounded-lg border border-gridline bg-surface-1 p-4">
                <p className="text-sm font-medium text-ink">Cinema is violently weekly</p>
                <p className="mt-1 text-xs leading-snug text-ink-2">
                  A film sells a multiple of its Tuesday on the following Saturday, every week of
                  its run. Comparing the latest reading to yesterday&rsquo;s would report every
                  Monday as a collapse and every Friday as a breakout, for every film, forever. So
                  nothing here compares adjacent days.
                </p>
              </div>
              <div className="rounded-lg border border-gridline bg-surface-1 p-4">
                <p className="text-sm font-medium text-ink">What a figure of zero would mean</p>
                <p className="mt-1 text-xs leading-snug text-ink-2">
                  Most of this year&rsquo;s releases have no worldwide gross recorded anywhere.
                  Writing that down as zero would turn an absence of reporting into a claim that
                  nobody went, so it is shown as unreported and left out of every ranking.
                </p>
              </div>
              <div className="rounded-lg border border-gridline bg-surface-1 p-4">
                <p className="text-sm font-medium text-ink">What a key would add</p>
                <p className="mt-1 text-xs leading-snug text-ink-2">
                  TMDB answered 401 rather than 403 — it will serve now-playing for India to anyone
                  with a free key, with popularity scores updated daily. That would add what is
                  actually in cinemas this week, which box office alone cannot say.
                </p>
              </div>
            </div>
          </section>
        </>
      ) : (
        <p className="rounded-lg border border-gridline bg-surface-2 p-5 text-sm text-ink-2">
          No box office data has been ingested yet. The connector runs daily in CI and commits what
          it reads; this page fills in on the next run.
        </p>
      )}

      <footer className="mt-10 border-t border-gridline pt-4 text-xs text-ink-muted">
        Worldwide gross from Wikipedia&rsquo;s per-language film lists, read daily. ·{" "}
        <Link href="/methodology" className="underline">Method</Link> ·{" "}
        <Link href="/atlas" className="underline">Atlas</Link>
      </footer>
    </main>
  );
}
