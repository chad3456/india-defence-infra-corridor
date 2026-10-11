import Link from "next/link";
import { HouseStrips } from "@/components/elections/Dashboards";
import { monthLabel } from "@/lib/elections-atlas-shared";
import { allSummaries } from "@/lib/elections-summary";

/** Every state assembly's latest election read, one strip each, newest first. */

export const metadata = {
  title: "Every state assembly, seat by seat",
  description: "The latest assembly election in every state, from ECI's own result pages: who won how many seats, where the majority line falls, and how close it was.",
};

const fmt = (n: number) => n.toLocaleString("en-IN");

export default function AssembliesPage() {
  const { assemblies } = allSummaries();
  const byDate = [...assemblies].sort((a, b) => b.date.localeCompare(a.date) || a.stateName.localeCompare(b.stateName));
  const complete = assemblies.filter((a) => a.expectedSeats && a.seatsRead === a.expectedSeats).length;
  const seats = assemblies.reduce((a, b) => a + b.seatsRead, 0);
  const matched = assemblies.filter((a) => a.tallyMatches).length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">Elections · Assemblies</p>
        <h1 className="display mt-4 max-w-[24ch] text-[32px] leading-[1.07] text-ink sm:text-[42px]">Every state assembly, as it was elected</h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          The most recent general election to each state&rsquo;s assembly that ECI&rsquo;s archived result pages cover.
          The vertical line is the majority mark; hatching is seats the archive never saved.
        </p>
      </header>

      <section className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat value={String(assemblies.length)} label="assemblies read" />
        <Stat value={fmt(seats)} label="constituencies" />
        <Stat value={String(complete)} label="read in full" note="every seat in the house" />
        <Stat value={String(matched)} label="match ECI's tally" note="party for party, where ECI's page survives" />
      </section>

      <section className="mb-12"><HouseStrips results={byDate} /></section>

      <section className="mb-12">
        <h2 className="text-sm font-semibold text-ink">The closest seat in each assembly</h2>
        <div className="mt-3 overflow-x-auto rounded border border-gridline">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface-2 text-[11px] uppercase tracking-wide text-ink-muted">
              <tr><th className="px-2 py-1.5 text-left">State</th><th className="px-2 py-1.5 text-left">Election</th><th className="px-2 py-1.5 text-left">Seat</th><th className="px-2 py-1.5 text-left">Winner</th><th className="px-2 py-1.5 text-right">Margin</th></tr>
            </thead>
            <tbody>
              {[...assemblies].filter((a) => a.closest).sort((a, b) => a.closest!.margin - b.closest!.margin).map((a) => (
                <tr key={a.state} className="border-t border-gridline">
                  <td className="px-2 py-1"><Link href={`/elections/atlas/${a.slug}`} className="text-ink hover:underline">{a.stateName}</Link></td>
                  <td className="px-2 py-1 text-ink-2">{monthLabel(a.date)}</td>
                  <td className="px-2 py-1 text-ink">{a.closest!.name}</td>
                  <td className="px-2 py-1 text-ink-2">{a.closest!.winner} <span className="text-ink-muted">{a.parties.find((p) => p.party === a.closest!.party)?.abbr}</span></td>
                  <td className="px-2 py-1 text-right font-mono tabular-nums text-ink">{fmt(a.closest!.margin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mt-10 border-t border-gridline pt-4 text-xs text-ink-muted">
        Election Commission of India result pages as archived by the Internet Archive. Seat counts are counted winners; vote shares on each state page are derived.
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
