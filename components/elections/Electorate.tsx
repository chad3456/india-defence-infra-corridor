import { loadElections } from "@/lib/elections";
import { STATE_FACTS } from "@/lib/census-shared";
import type { AtlasState } from "@/lib/elections-atlas-shared";
import { loadElectors } from "@/lib/elections-electors";
import { median } from "@/lib/elections-pattern";

/**
 * A state's electorate across the last three general elections: the size of
 * the roll, how many voted, and the roll against the 2011 census population.
 * Server-rendered: everything here is read at build time.
 */
const fmt = (n: number) => n.toLocaleString("en-IN");
const crore = (n: number) => (n >= 1e7 ? `${(n / 1e7).toFixed(2)} crore` : `${(n / 1e5).toFixed(1)} lakh`);

export default function Electorate({ st }: { st: AtlasState }) {
  return (
    <div className="space-y-10">
      <Segments st={st} />
      <Trend st={st} />
    </div>
  );
}

/**
 * The state's 2024 roll, constituency by constituency, from ECI's statistical
 * report 15: who is on it by gender, and how turnout and the gender balance
 * vary across the state's assembly segments.
 */
function Segments({ st }: { st: AtlasState }) {
  const file = loadElectors();
  const segs = file?.states[st.eci]?.segments ?? [];
  if (!file || !segs.length) return null;
  const sum = (k: "m" | "f" | "tg" | "nri" | "serviceM" | "serviceF" | "electors" | "polledEvm") => segs.reduce((a, s) => a + s[k], 0);
  const m = sum("m"), f = sum("f"), tg = sum("tg"), nri = sum("nri"), svc = sum("serviceM") + sum("serviceF"), el = sum("electors"), polled = sum("polledEvm");
  const rows = segs.map((s) => ({ s, turnout: (s.polledEvm / s.electors) * 100, ratio: (s.f / s.m) * 1000 }));
  const hist = (vals: number[], edges: number[]) => edges.slice(0, -1).map((lo, i) => ({ lo, hi: edges[i + 1]!, n: vals.filter((v) => v >= lo && v < edges[i + 1]!).length }));
  const tEdges = [0, 50, 55, 60, 65, 70, 75, 80, 85, 101], rEdges = [0, 850, 900, 950, 1000, 1050, 1100, 2000];
  const tHist = hist(rows.map((r) => r.turnout), tEdges), rHist = hist(rows.map((r) => r.ratio), rEdges);
  const byT = [...rows].sort((a, b) => b.turnout - a.turnout);
  const byR = [...rows].sort((a, b) => b.ratio - a.ratio);
  const label = (lo: number, hi: number, unit: string) => (lo === 0 ? `under ${hi}${unit}` : hi > 1000 && unit === "" && hi >= 2000 ? `${lo}+` : hi > 100 && unit === "%" ? `${lo}%+` : `${lo}–${hi}${unit}`);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile value={crore(el)} label="electors on the 2024 roll" note={`${segs.length} assembly segments`} />
        <Tile value={((f / m) * 1000).toFixed(0)} label="women per 1,000 men" note={`${fmt(f)} women, ${fmt(m)} men (derived)`} />
        <Tile value={fmt(tg)} label="third-gender electors" note={`${fmt(nri)} overseas · ${fmt(svc)} service electors`} />
        <Tile value={`${((polled / el) * 100).toFixed(1)}%`} label="voted on EVMs, 2024" note={`median segment ${median(rows.map((r) => r.turnout)).toFixed(1)}%; postal ballots not included`} />
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <Hist title="Turnout across the state's segments" note="Share of each segment's electors who voted on an EVM in 2024 (derived)." bins={tHist.map((b) => ({ label: label(b.lo, b.hi, "%"), n: b.n }))} />
        <Hist title="Women per 1,000 men on the roll" note="Each segment's gender balance; 1,000 is parity (derived)." bins={rHist.map((b) => ({ label: b.lo === 0 ? "under 850" : b.hi >= 2000 ? "1,100+" : `${b.lo}–${b.hi}`, n: b.n }))} />
      </div>
      <div className="grid gap-8 sm:grid-cols-2">
        <Ranked title="Highest turnout" rows={byT.slice(0, 5).map((r) => [r.s.ac, `${r.turnout.toFixed(1)}%`])} />
        <Ranked title="Lowest turnout" rows={byT.slice(-5).reverse().map((r) => [r.s.ac, `${r.turnout.toFixed(1)}%`])} />
        <Ranked title="Most women per 1,000 men" rows={byR.slice(0, 5).map((r) => [r.s.ac, r.ratio.toFixed(0)])} />
        <Ranked title="Fewest women per 1,000 men" rows={byR.slice(-5).reverse().map((r) => [r.s.ac, r.ratio.toFixed(0)])} />
      </div>
      <p className="text-[11px] leading-snug text-ink-muted">
        {file.source.publisher}, <a href={file.source.url} className="underline" target="_blank" rel="noopener noreferrer">{file.source.title}</a>, read from the archived PDF committed at {file.source.file}. Every row is kept only if its parts add up, and every Lok Sabha seat&rsquo;s subtotal equals the sum of its segments. Votes polled are EVM votes; postal ballots are counted separately and are not in this report.
      </p>
    </div>
  );
}

function Hist({ title, note, bins }: { title: string; note: string; bins: Array<{ label: string; n: number }> }) {
  const max = Math.max(1, ...bins.map((b) => b.n));
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</h4>
      <p className="mt-1 text-xs text-ink-2">{note}</p>
      <div className="mt-3 space-y-1.5">
        {bins.map((b) => (
          <div key={b.label} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2 text-xs">
            <span className="text-right text-ink-2">{b.label}</span>
            <span className="flex items-center gap-2"><span className="h-3 rounded-sm bg-[color:var(--seq-400)]" style={{ width: `${(b.n / max) * 80}%` }} /><span className="tabular-nums text-ink">{b.n}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Ranked({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</h4>
      <ol className="mt-2 space-y-1 text-xs">
        {rows.map(([k, v]) => <li key={k} className="flex justify-between gap-2 border-b border-gridline pb-1"><span className="truncate text-ink">{k}</span><span className="tabular-nums text-ink-2">{v}</span></li>)}
      </ol>
    </div>
  );
}

/** The state's electorate at the last three general elections, from the statewise turnout file. */
function Trend({ st }: { st: AtlasState }) {
  const data = loadElections();
  const rows = data.years.map((y) => ({ year: y.year, row: y.rows.find((r) => st.topo.includes(r.state)) })).filter((x) => x.row);
  if (!rows.length) return null;
  const pop = st.topo.map((t) => STATE_FACTS[t]?.pop ?? 0).reduce((a, b) => a + b, 0);
  const shared = st.topo[0] === "Jammu & Kashmir" || st.slug === "dadra-nagar-haveli-daman-diu";
  const maxE = Math.max(...rows.map((r) => r.row!.electors));
  const last = rows.at(-1)!.row!, first = rows[0]!.row!;
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-ink">2014, 2019 and 2024</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile value={crore(last.electors)} label={`electors, ${rows.at(-1)!.year}`} note={`${rows[0]!.year}: ${crore(first.electors)} (${(((last.electors - first.electors) / first.electors) * 100).toFixed(1)}% change, derived)`} />
        <Tile value={`${last.turnoutPct.toFixed(1)}%`} label={`turnout, ${rows.at(-1)!.year} Lok Sabha`} note={rows.map((r) => `${r.year}: ${r.row!.turnoutPct.toFixed(1)}%`).join(" · ")} />
        <Tile value={crore(last.voters)} label="voted" note={`${fmt(last.electors - last.voters)} electors did not`} />
        {pop > 0 && !shared && <Tile value={`${((last.electors / pop) * 100).toFixed(0)}`} label="electors per 100 residents" note="against the 2011 census population, the latest taken (derived)" />}
      </div>
      <div className="space-y-2">
        {rows.map(({ year, row }) => (
          <div key={year} className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-2 text-xs">
            <span className="text-right text-ink-2">{year}</span>
            <div className="min-w-0">
              <div className="relative h-4 rounded-sm bg-[color:var(--seq-100)]" style={{ width: `${(row!.electors / maxE) * 100}%` }}>
                <div className="h-4 rounded-sm bg-[color:var(--seq-550)]" style={{ width: `${row!.turnoutPct}%` }} />
              </div>
              <p className="mt-0.5 tabular-nums text-ink-2">{crore(row!.voters)} voted of {crore(row!.electors)} electors · {row!.turnoutPct.toFixed(1)}% · {row!.seats} seats</p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] leading-snug text-ink-muted">
        Electors and voters are the Election Commission&rsquo;s general-election figures, read from Wikipedia&rsquo;s per-election tables, which carry them; each row is checked against its own arithmetic (voters ÷ electors must reproduce the printed turnout).
        {shared ? " This state shares a polygon with a neighbour on this site's map, so its row may include it." : ""}
      </p>
    </div>
  );
}

function Tile({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div className="rounded-lg border border-gridline bg-surface-1 p-3">
      <p className="text-lg font-semibold tabular-nums text-ink">{value}</p>
      <p className="text-[11px] text-ink">{label}</p>
      {note && <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">{note}</p>}
    </div>
  );
}
