import Link from "next/link";
import { notFound } from "next/navigation";
import StateResults from "@/components/elections/StateResults";
import Electorate from "@/components/elections/Electorate";
import { SirStateDetail } from "@/components/elections/SirCharts";
import { ALLIANCE_COLOUR, ALLIANCE_LABEL, ATLAS_STATES, atlasState, atlasStateBySlug, loadGoverns, loadSir } from "@/lib/elections-atlas";
import { compactResults, electorateMedians, sirFor } from "@/lib/elections-atlas-view";

/** One state's tool: who governs, every seat in its Assembly and Lok Sabha elections, and its SIR. */

export const dynamicParams = false;
export function generateStaticParams() {
  return ATLAS_STATES.map((s) => ({ state: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }) {
  const st = atlasStateBySlug((await params).state);
  return st ? {
    title: `${st.name}: election results seat by seat, and the SIR`,
    description: `${st.name}'s government, Assembly and Lok Sabha results for every constituency from ECI's own pages, and electoral-roll deletions by reason.`,
  } : {};
}

export default async function StateAtlasPage({ params }: { params: Promise<{ state: string }> }) {
  const st = atlasStateBySlug((await params).state);
  if (!st) notFound();
  const gov = loadGoverns();
  const g = gov?.states.find((x) => atlasState(x.state)?.slug === st.slug);
  const sir = loadSir();
  const sirState = sirFor(st);
  const results = compactResults(st);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">
          <Link href="/elections/atlas" className="hover:underline">Election atlas</Link> · {st.legislature ? "State" : "Union territory"}
        </p>
        <h1 className="display mt-3 text-[32px] leading-[1.07] text-ink sm:text-[42px]">{st.name}</h1>
        {g ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: ALLIANCE_COLOUR[g.alliance] }} />
              <strong className="text-ink">{ALLIANCE_LABEL[g.alliance]}</strong>
            </span>
            <span>Chief minister <strong className="text-ink">{g.chiefMinister}</strong> ({g.party}){g.cmConstituency ? `, MLA for ${g.cmConstituency}` : ""}</span>
            {g.stateAlliance && g.stateAlliance !== g.alliance && <span>State alliance: {g.stateAlliance}</span>}
            {g.election && <span>Elected {g.election}</span>}
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-2">
            {st.legislature ? "Government not found in the current office-holders table." : "No legislature: governed by the Centre through an administrator or lieutenant governor."}
          </p>
        )}
        {st.slug === "jammu-and-kashmir" && <p className="mt-2 text-xs text-ink-muted">Ladakh has been a separate union territory since 2019; its Lok Sabha seat is on the Ladakh page.</p>}
      </header>

      <section className="mb-12">
        <h2 className="mb-4 text-lg font-semibold text-ink">Results, seat by seat</h2>
        <StateResults results={results} stateName={st.name} medians={electorateMedians(st)} />
      </section>

      <section className="mb-12">
        <h2 className="text-lg font-semibold text-ink">The electorate</h2>
        <p className="mb-4 mt-1 text-sm text-ink-2">How many people are on {st.name}&rsquo;s roll, and how many voted, at the last three general elections.</p>
        <Electorate st={st} />
      </section>

      <section className="mb-12">
        <h2 className="text-lg font-semibold text-ink">Special Intensive Revision of the electoral roll</h2>
        {sirState && sir ? (
          <div className="mt-4">
            <p className="mb-4 text-sm text-ink-2">{sir.phases.find((p) => p.id === sirState.phase)?.label}: {sir.phases.find((p) => p.id === sirState.phase)?.note}</p>
            <SirStateDetail st={sirState} sir={sir} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-2">
            No SIR figures for {st.name} have been published in a form found so far. Phase III covers sixteen
            states and three union territories, with drafts from August 2026; this page fills in when a figure
            with a source is added.
          </p>
        )}
      </section>

      <footer className="mt-10 border-t border-gridline pt-4 text-xs text-ink-muted">
        Results: Election Commission of India result pages as archived by the Internet Archive; each seat links its page.
        Government: {gov ? <a href={gov.source.url} className="underline">Wikipedia</a> : "Wikipedia"}. SIR: figures as reported by the sources linked above. ·{" "}
        <Link href="/elections/atlas" className="underline">All states</Link>
      </footer>
    </main>
  );
}
