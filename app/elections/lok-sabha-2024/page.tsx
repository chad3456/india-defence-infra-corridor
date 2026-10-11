import Link from "next/link";
import { Hemicycle, SeatsVotes } from "@/components/elections/Dashboards";
import { allSummaries, nationalLokSabha } from "@/lib/elections-summary";
import { partyColours } from "@/lib/elections-atlas-shared";

/**
 * The 2024 general election, added up from 543 constituency pages. Seat
 * counts are counted winners; vote shares are sums over the seats read,
 * NOTA included, so they are derived and labelled as such.
 */

export const metadata = {
  title: "Lok Sabha 2024, seat by seat",
  description: "All 543 constituencies of the 2024 general election from ECI's own result pages: the chamber, seats against votes, and every state's split.",
};

const fmt = (n: number) => n.toLocaleString("en-IN");

export default function LokSabha2024Page() {
  const { lokSabha, abbr } = allSummaries();
  const nat = nationalLokSabha(lokSabha, abbr);
  const colour = partyColours(nat.parties.map((p) => p.party));
  const cols = nat.parties.slice(0, 8);
  const byState = [...lokSabha].sort((a, b) => b.seatsRead - a.seatsRead);
  // Every state's ten closest, pooled: the national ten are among them.
  const closest = lokSabha.flatMap((s) => s.closestTen.map((c) => ({ ...c, state: s.stateName }))).sort((a, b) => a.margin - b.margin).slice(0, 10);
  const lead = nat.parties[0];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">Elections · Lok Sabha 2024</p>
        <h1 className="display mt-4 max-w-[24ch] text-[32px] leading-[1.07] text-ink sm:text-[42px]">The 2024 general election, all {nat.seats} seats</h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          Every constituency read from the Election Commission&rsquo;s own result page, each checked against its
          printed total. Counted here, not copied from a summary.
        </p>
      </header>

      {nat.seats === 0 ? <p className="text-sm text-ink-2">No Lok Sabha results have been read yet.</p> : (
        <>
          <section className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat value={`${nat.seats} / 543`} label="seats read" />
            <Stat value={lead ? `${lead.abbr} ${lead.won}` : "—"} label="largest party" note={`majority is 272`} />
            <Stat value={fmt(nat.votes)} label="votes counted" note="NOTA included" />
            <Stat value={fmt(nat.nota)} label="votes for NOTA" note={`${((nat.nota / nat.votes) * 100).toFixed(2)}% of votes (derived)`} />
          </section>

          <section className="mb-12 grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="text-sm font-semibold text-ink">The chamber</h2>
              <p className="mt-1 text-xs text-ink-2">One dot per seat, by the party that won it. Hover for the party&rsquo;s seats and votes.</p>
              <div className="mt-3"><Hemicycle parties={nat.parties} total={nat.seats} label={`${nat.seats} Lok Sabha seats by winning party`} /></div>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink">Seats won against votes won</h2>
              <p className="mt-1 text-xs text-ink-2">Vote share is of every vote counted in the seats read, computed here (derived).</p>
              <div className="mt-3"><SeatsVotes parties={nat.parties} total={nat.seats} /></div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-sm font-semibold text-ink">Every state&rsquo;s seats, by party</h2>
            <p className="mt-1 text-xs text-ink-2">The eight parties with most seats nationally; the rest are summed. Click a state for every constituency.</p>
            <div className="mt-3 overflow-x-auto rounded border border-gridline">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-surface-2 text-[11px] uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="px-2 py-1.5 text-left">State</th><th className="px-2 py-1.5 text-right">Seats</th>
                    {cols.map((p) => <th key={p.party} className="px-2 py-1.5 text-right" title={p.party}><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: colour(p.party) }} />{p.abbr}</th>)}
                    <th className="px-2 py-1.5 text-right">Others</th>
                  </tr>
                </thead>
                <tbody>
                  {byState.map((s) => {
                    const inCols = cols.reduce((a, c) => a + (s.parties.find((p) => p.party === c.party)?.won ?? 0), 0);
                    return (
                      <tr key={s.state} className="border-t border-gridline">
                        <td className="px-2 py-1"><Link href={`/elections/atlas/${s.slug}`} className="text-ink hover:underline">{s.stateName}</Link></td>
                        <td className="px-2 py-1 text-right tabular-nums text-ink">{s.seatsRead}</td>
                        {cols.map((c) => {
                          const n = s.parties.find((p) => p.party === c.party)?.won ?? 0;
                          return <td key={c.party} className="px-2 py-1 text-right tabular-nums" style={{ background: n ? `color-mix(in srgb, ${colour(c.party)} ${Math.round(15 + (n / s.seatsRead) * 55)}%, transparent)` : undefined, color: n ? "var(--color-ink)" : "var(--color-ink-muted)" }}>{n || "·"}</td>;
                        })}
                        <td className="px-2 py-1 text-right tabular-nums text-ink-2">{s.seatsRead - inCols || "·"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-sm font-semibold text-ink">The ten closest seats in the country</h2>
            <p className="mt-1 text-xs text-ink-2">Winner&rsquo;s lead over the runner-up, in votes.</p>
            <ol className="mt-3 grid gap-2 sm:grid-cols-2">
              {closest.map((c) => (
                <li key={`${c.state}-${c.no}`} className="flex items-baseline gap-3 rounded border border-gridline bg-surface-1 px-3 py-2 text-sm">
                  <span className="w-16 shrink-0 text-right font-mono tabular-nums text-ink">{fmt(c.margin)}</span>
                  <span className="min-w-0"><span className="text-ink">{c.name}</span> <span className="text-ink-muted">({c.state})</span><br /><span className="text-xs text-ink-2">{c.winner}, {abbr[c.party] ?? c.party}</span></span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
      <footer className="mt-10 border-t border-gridline pt-4 text-xs text-ink-muted">
        Election Commission of India result pages for June 2024, as archived by the Internet Archive; each constituency links its page on the state&rsquo;s atlas page.
      </footer>
    </main>
  );
}

function Stat({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div className="rounded-lg border border-gridline bg-surface-2 p-4">
      <p className="text-2xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink">{label}</p>
      {note && <p className="mt-0.5 text-[11px] text-ink-muted">{note}</p>}
    </div>
  );
}
