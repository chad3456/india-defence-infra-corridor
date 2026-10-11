import Link from "next/link";
import AtlasMap from "@/components/elections/AtlasMap";
import { Hemicycle, HouseStrips } from "@/components/elections/Dashboards";
import { lakh, loadGoverns, loadSir } from "@/lib/elections-atlas";
import { mapRows } from "@/lib/elections-atlas-view";
import { allSummaries, nationalLokSabha } from "@/lib/elections-summary";

/** The elections section's front page: one visual from each dashboard, each linking to it. */

export const metadata = {
  title: "Elections: who governs, every result, and the roll revision",
  description: "India's elections from ECI's own result pages: the map of who governs, Lok Sabha 2024 and every state assembly seat by seat, the SIR's deletions by reason, and turnout.",
};

export default function ElectionsOverview() {
  const rows = mapRows();
  const gov = loadGoverns();
  const sir = loadSir();
  const { assemblies, lokSabha, abbr } = allSummaries();
  const nat = nationalLokSabha(lokSabha, abbr);
  const seatsRead = assemblies.reduce((a, b) => a + b.seatsRead, 0) + nat.seats;
  const sirTotal = (sir?.states ?? []).reduce((a, s) => a + (s.draft?.leftOut ?? 0), 0);
  const recent = [...assemblies].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const count = (al: string[]) => rows.filter((r) => r.alliance && al.includes(r.alliance)).length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">Elections</p>
        <h1 className="display mt-4 max-w-[24ch] text-[32px] leading-[1.07] text-ink sm:text-[42px]">India&rsquo;s elections, seat by seat</h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          Results read from the Election Commission&rsquo;s own constituency pages and checked against their printed
          totals; who governs each state today; and the Special Intensive Revision&rsquo;s deletions by reason.
        </p>
      </header>

      <section className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat href="/elections/atlas" value={`${count(["NDA"])} · ${count(["INDIA"])} · ${count(["Other", "None"])}`} label="NDA · INDIA · neither" note={`state governments${gov ? `, as of ${gov.fetchedAt.slice(0, 10)}` : ""}`} />
        <Stat href="/elections/lok-sabha-2024" value={`${nat.seats} / 543`} label="Lok Sabha 2024 seats read" />
        <Stat href="/elections/assemblies" value={seatsRead.toLocaleString("en-IN")} label="constituency results" note={`${assemblies.length} assemblies and the Lok Sabha`} />
        <Stat href="/elections/sir" value={sirTotal ? lakh(sirTotal) : "—"} label="left out of SIR drafts" note="by reason given" />
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <Panel href="/elections/atlas" title="Who governs, state by state" cta="Open the atlas">
          <AtlasMap rows={rows} />
        </Panel>
        <div className="space-y-10">
          <Panel href="/elections/lok-sabha-2024" title="Lok Sabha 2024" cta="Every seat, every state">
            <Hemicycle parties={nat.parties} total={nat.seats} label="Lok Sabha 2024 seats by winning party" />
          </Panel>
          <Panel href="/elections/assemblies" title="The latest assembly elections" cta={`All ${assemblies.length} assemblies`}>
            <HouseStrips results={recent} />
          </Panel>
        </div>
      </div>

      <section className="mt-12 grid gap-3 sm:grid-cols-3">
        <Card href="/elections/sir" title="The roll revision" text="Names left out of each draft roll in the SIR, split by dead, shifted, absent and duplicate, with the sources for every figure." />
        <Card href="/elections/turnout" title="Turnout by state" text="Turnout, electors and seats for the 2014, 2019 and 2024 general elections, every row checked against its own arithmetic." />
        <Card href="/elections/atlas" title="Any state, seat by seat" text="Open a state for its assembly and Lok Sabha results: every constituency, every candidate, the archived ECI page it was read from." />
      </section>
    </main>
  );
}

function Stat({ href, value, label, note }: { href: string; value: string; label: string; note?: string }) {
  return (
    <Link href={href} className="rounded-lg border border-gridline bg-surface-2 p-4 hover:border-[color:var(--color-ink-2)]">
      <p className="text-2xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink">{label}</p>
      {note && <p className="mt-0.5 text-[11px] text-ink-muted">{note}</p>}
    </Link>
  );
}

function Panel({ href, title, cta, children }: { href: string; title: string; cta: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <Link href={href} className="ml-auto text-xs text-ink-2 underline hover:text-ink">{cta} →</Link>
      </div>
      {children}
    </section>
  );
}

function Card({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link href={href} className="rounded-lg border border-gridline bg-surface-1 p-4 hover:border-[color:var(--color-ink-2)]">
      <p className="text-sm font-medium text-ink">{title} →</p>
      <p className="mt-1 text-xs leading-snug text-ink-2">{text}</p>
    </Link>
  );
}
