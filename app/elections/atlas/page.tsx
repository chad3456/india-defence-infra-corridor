import Link from "next/link";
import AtlasMap from "@/components/elections/AtlasMap";
import { SirStateBars } from "@/components/elections/SirCharts";
import { ALLIANCE_COLOUR, ALLIANCE_LABEL, ATLAS_STATES, lakh, loadGoverns, loadResultIndex, loadSir, reasonGap } from "@/lib/elections-atlas";
import { mapRows } from "@/lib/elections-atlas-view";

/**
 * The election atlas: India shaded by who governs each state today, with each
 * state opening its own results-and-roll tool.
 *
 * Three kinds of source, kept apart on the page because they are not equal.
 * Results are ECI's own pages, read from the Internet Archive's copies and
 * checked against their own arithmetic. Who governs is Wikipedia's current
 * office-holders table: ECI publishes results, not governments. SIR deletions
 * are ECI and CEO figures as reported in the press, because ECI's press notes
 * refuse automated requests; each figure links where it was read.
 */

export const metadata = {
  title: "Election atlas: who governs, how every seat voted, and who the SIR removed",
  description:
    "India shaded by the alliance governing each state. Every state opens Assembly and Lok Sabha results seat by seat from ECI's own pages, and the Special Intensive Revision's deletions by reason.",
};

export default function ElectionAtlasPage() {
  const rows = mapRows();
  const gov = loadGoverns();
  const sir = loadSir();
  const index = loadResultIndex();
  const seatsRead = index.reduce((a, e) => a + Object.values(e.states).reduce((x, y) => x + y, 0), 0);
  const pc = index.find((e) => e.house === "PC");
  const pcSeats = pc ? Object.values(pc.states).reduce((a, b) => a + b, 0) : 0;
  const acStates = new Set(index.filter((e) => e.house === "AC").flatMap((e) => Object.keys(e.states)));

  const draftStates = sir?.states.filter((s) => s.draft?.leftOut) ?? [];
  const sirTotal = draftStates.reduce((a, s) => a + (s.draft!.leftOut ?? 0), 0);
  const sirDead = draftStates.reduce((a, s) => a + (s.draft!.reasons?.dead ?? 0), 0);
  const sirUnattr = draftStates.reduce((a, s) => { const g = reasonGap(s.draft); return a + (g ? Math.max(0, g.unattributed) : s.draft!.leftOut!); }, 0);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">
          <Link href="/elections" className="hover:underline">Elections</Link> · Atlas
        </p>
        <h1 className="display mt-4 max-w-[24ch] text-[32px] leading-[1.07] text-ink sm:text-[42px]">
          Who governs, how every seat voted, and who the roll revision left out
        </h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          India shaded by the national alliance of each state&rsquo;s government today. Open any state for its
          Assembly and Lok Sabha results constituency by constituency, read from the Election
          Commission&rsquo;s own result pages, and for the Special Intensive Revision&rsquo;s deletions by the reason given.
        </p>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat value={String(gov?.states.length ?? 0)} label="state and UT governments" note={gov ? `as of ${gov.fetchedAt.slice(0, 10)}` : ""} />
        <Stat value={seatsRead.toLocaleString("en-IN")} label="constituency results read" note={`${acStates.size} ${acStates.size === 1 ? "assembly" : "assemblies"}${pcSeats ? ` · ${pcSeats} of 543 Lok Sabha seats` : ""}`} />
        <Stat value={sirTotal ? lakh(sirTotal) : "—"} label="names left out of SIR drafts" note={`${draftStates.length} states and UTs with a published draft figure`} />
        <Stat value={sirDead ? lakh(sirDead) : "—"} label="of them recorded as dead" note={sirUnattr ? `${lakh(sirUnattr)} with no reason in the sources` : ""} />
      </section>

      <section className="mb-10">
        <AtlasMap rows={rows} />
        <p className="mt-3 max-w-3xl text-xs leading-relaxed text-ink-muted">
          Alliance is the governing party&rsquo;s national alliance as listed by{" "}
          {gov ? <a href={gov.source.url} className="underline" target="_blank" rel="noopener noreferrer">Wikipedia&rsquo;s current office-holders table</a> : "Wikipedia"}, read weekly.
          ECI publishes results, not governments, so this is the one layer here that is not the Commission&rsquo;s.
          Union territories without a legislature are governed by the Centre through an administrator and are shown grey.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-lg font-semibold text-ink">Every state and UT</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows.sort((a, b) => a.name.localeCompare(b.name)).map((r) => (
            <Link key={r.slug} href={`/elections/atlas/${r.slug}`} className="group flex items-start gap-3 rounded-lg border border-gridline bg-surface-1 p-3 hover:border-ink">
              <span className="mt-1 inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: r.alliance ? ALLIANCE_COLOUR[r.alliance] : "var(--surface-2)", border: "1px solid var(--gridline)" }} />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink group-hover:underline">{r.name}</span>
                <span className="block truncate text-[11px] text-ink-2">
                  {r.legislature ? `${r.chiefMinister ?? "?"} · ${r.party ?? ""} · ${r.alliance ? ALLIANCE_LABEL[r.alliance] : ""}` : "No legislature"}
                </span>
                <span className="block truncate text-[11px] text-ink-muted">
                  {[r.assembly && `Assembly ${r.assembly.split(",")[0]}`, r.lokSabha && "Lok Sabha 2024", r.sirLeftOut != null && `SIR ${lakh(r.sirLeftOut)} left out`].filter(Boolean).join(" · ") || "No results read yet"}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {sir && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-ink">The Special Intensive Revision, state by state</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">
            Names left out of each state&rsquo;s draft roll, split by the reason the Election Commission or the state&rsquo;s
            Chief Electoral Officer gave. A name left out of a draft is not yet a deletion: claims and objections
            follow, and the final roll can be larger. Where the reasons reported do not add up to the total, the
            remainder is shown hatched as not attributed rather than shared out.
          </p>
          <div className="mt-4"><SirStateBars sir={sir} /></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {sir.phases.map((p) => (
              <div key={p.id} className="rounded-lg border border-gridline bg-surface-1 p-4">
                <p className="text-[11px] uppercase tracking-wide text-ink-muted">{p.label} · ordered {p.ordered}</p>
                <p className="mt-1 text-sm font-medium text-ink">{p.coverage}</p>
                <p className="mt-1 text-xs leading-snug text-ink-2">{p.note}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 max-w-3xl text-xs leading-relaxed text-ink-muted">{sir.about}</p>
        </section>
      )}

      <section className="mb-10 rounded-lg border border-gridline bg-surface-1 p-5">
        <h2 className="text-sm font-semibold text-ink">Where the results come from</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">
          ECI&rsquo;s results portal keeps only the count in progress; every earlier election&rsquo;s pages now
          answer &ldquo;not found&rdquo;. The Internet Archive saved those pages on and after counting day, and an
          archived page is ECI&rsquo;s page as it was served. So each constituency here is read from the newest
          archived copy of ECI&rsquo;s own result page, and kept only if that page agrees with itself: every
          candidate&rsquo;s EVM and postal votes must add to their total, and the totals to ECI&rsquo;s printed sum.
          Each seat links to the archived page it came from. Seats the archive never saved are missing, not
          estimated, and seats archived only mid-count are marked.
        </p>
        <ul className="mt-3 grid gap-1 text-xs text-ink-2 sm:grid-cols-2">
          {index.map((e) => (
            <li key={e.folder}>
              <span className="text-ink">{e.house === "PC" ? "Lok Sabha" : "Assembly"} {e.date}</span> ·{" "}
              {Object.entries(e.states).map(([code, n]) => `${ATLAS_STATES.find((s) => s.eci === code)?.name ?? code} ${n}`).join(", ")}
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-10 border-t border-gridline pt-4 text-xs text-ink-muted">
        Results: Election Commission of India, results.eci.gov.in, as archived by the Internet Archive. Governments:
        Wikipedia. SIR: ECI and CEO figures as reported, each linked. ·{" "}
        <Link href="/elections" className="underline">Turnout by state</Link> · <Link href="/methodology" className="underline">Method</Link>
      </footer>
    </main>
  );
}

function Stat({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div className="rounded-lg border border-gridline bg-surface-2 p-4">
      <p className="text-2xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink">{label}</p>
      {note && <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">{note}</p>}
    </div>
  );
}
