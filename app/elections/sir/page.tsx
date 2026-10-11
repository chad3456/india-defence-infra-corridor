import Link from "next/link";
import { SirStateBars, SirStateDetail } from "@/components/elections/SirCharts";
import { atlasState, lakh, loadSir, reasonGap } from "@/lib/elections-atlas";

/**
 * The Special Intensive Revision on its own page: every state's draft-roll
 * deletions by reason, then each state's roll through the revision.
 */

export const metadata = {
  title: "The Special Intensive Revision: who was left off the rolls, and why",
  description: "Names left out of each state's draft electoral roll in the SIR, by the reason given: dead, shifted, absent, duplicate. ECI and CEO figures, each linked.",
};

export default function SirPage() {
  const sir = loadSir();
  if (!sir) return <main className="mx-auto max-w-6xl px-4 py-10"><p className="text-sm text-ink-2">No SIR data.</p></main>;
  const draft = sir.states.filter((s) => s.draft?.leftOut);
  const total = draft.reduce((a, s) => a + s.draft!.leftOut!, 0);
  const sum = (k: "dead" | "duplicate") => draft.reduce((a, s) => a + (s.draft!.reasons?.[k] ?? 0), 0);
  const moved = draft.reduce((a, s) => a + (s.draft!.reasons?.shifted ?? 0) + (s.draft!.reasons?.shiftedOrAbsent ?? 0) + (s.draft!.reasons?.absent ?? 0), 0);
  const unattributed = draft.reduce((a, s) => { const g = reasonGap(s.draft); return a + (g ? Math.max(0, g.unattributed) : s.draft!.leftOut!); }, 0);
  const ordered = [...draft].sort((a, b) => b.draft!.leftOut! - a.draft!.leftOut!);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">Elections · SIR</p>
        <h1 className="display mt-4 max-w-[24ch] text-[32px] leading-[1.07] text-ink sm:text-[42px]">Who the roll revision left out, and the reason given</h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          The Special Intensive Revision re-verified electoral rolls state by state. A name left out of a draft roll
          is not yet a deletion: claims and objections follow, and the final roll can be larger. Figures are ECI&rsquo;s
          and the state Chief Electoral Officers&rsquo;, as reported in the sources linked under each state.
        </p>
      </header>

      <section className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat value={lakh(total)} label="left out of drafts" note={`${draft.length} states and UTs`} />
        <Stat value={lakh(sum("dead"))} label="recorded as dead" />
        <Stat value={lakh(moved)} label="shifted or absent" note="incl. where reported together" />
        <Stat value={lakh(sum("duplicate"))} label="enrolled twice" />
        <Stat value={lakh(unattributed)} label="no reason in the sources" note="shown hatched" />
      </section>

      <section className="mb-12">
        <h2 className="text-sm font-semibold text-ink">Every state&rsquo;s draft, by reason</h2>
        <div className="mt-3"><SirStateBars sir={sir} /></div>
      </section>

      <section className="mb-12 grid gap-3 sm:grid-cols-3">
        {sir.phases.map((p) => (
          <div key={p.id} className="rounded-lg border border-gridline bg-surface-1 p-4">
            <p className="text-[11px] uppercase tracking-wide text-ink-muted">{p.label} · ordered {p.ordered}</p>
            <p className="mt-1 text-sm font-medium text-ink">{p.coverage}</p>
            <p className="mt-1 text-xs leading-snug text-ink-2">{p.note}</p>
          </div>
        ))}
      </section>

      <section className="mb-12 space-y-10">
        <h2 className="text-lg font-semibold text-ink">State by state</h2>
        {ordered.map((st) => {
          const a = atlasState(st.state);
          return (
            <div key={st.state} className="border-t border-gridline pt-6">
              <h3 className="text-base font-semibold text-ink">
                {a ? <Link href={`/elections/atlas/${a.slug}`} className="hover:underline">{st.state}</Link> : st.state}
                <span className="ml-2 text-xs font-normal text-ink-muted">{sir.phases.find((p) => p.id === st.phase)?.label}</span>
              </h3>
              <div className="mt-3"><SirStateDetail st={st} sir={sir} /></div>
            </div>
          );
        })}
      </section>

      <p className="max-w-3xl text-xs leading-relaxed text-ink-muted">{sir.about}</p>
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
