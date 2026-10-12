import Link from "next/link";
import { ATLAS_STATES } from "@/lib/elections-atlas";
import { loadElectors } from "@/lib/elections-electors";
import { districtsOfState, loadCensus } from "@/lib/elections-census";

/**
 * Who is on India's electoral roll, and who lives in India: the 2024 roll by
 * gender from ECI's own statistical report, country → state → constituency,
 * and religion, Scheduled Castes and Tribes from the 2011 Census, country →
 * state → district. The two are never merged into an estimate of who voted.
 */

export const metadata = {
  title: "The electorate: gender on the roll, and who lives where",
  description: "India's 2024 electoral roll by gender, state and constituency, from ECI's statistical report; religion, Scheduled Castes and Tribes by state and district from the 2011 Census.",
};

const fmt = (n: number) => n.toLocaleString("en-IN");
const crore = (n: number) => `${(n / 1e7).toFixed(2)} crore`;
const pct = (n: number, d = 1) => `${n.toFixed(d)}%`;
const SHADES = ["var(--seq-700)", "var(--seq-550)", "var(--seq-400)", "var(--seq-250)", "var(--seq-100)"];

export default function ElectoratePage() {
  const el = loadElectors();
  const census = loadCensus();
  const segs = el ? Object.entries(el.states).flatMap(([code, s]) => s.segments.map((x) => ({ ...x, code }))) : [];
  const m = segs.reduce((a, s) => a + s.m, 0), f = segs.reduce((a, s) => a + s.f, 0), tg = segs.reduce((a, s) => a + s.tg, 0);
  const nri = segs.reduce((a, s) => a + s.nri, 0), svc = segs.reduce((a, s) => a + s.serviceM + s.serviceF, 0), total = segs.reduce((a, s) => a + s.electors, 0), polled = segs.reduce((a, s) => a + s.polledEvm, 0);

  // Each state: women per 1,000 men on the 2024 roll (ECI) and in the 2011 population (census).
  const states = ATLAS_STATES.filter((s) => s.slug !== "ladakh").map((s) => {
    const sg = el?.states[s.eci]?.segments ?? [];
    const ds = districtsOfState(s.eci);
    const cm = ds.reduce((a, d) => a + d.male, 0), cf = ds.reduce((a, d) => a + d.female, 0), pop = ds.reduce((a, d) => a + d.population, 0);
    const r = (k: keyof (typeof ds)[number]["religion"]) => ds.reduce((a, d) => a + d.religion[k], 0);
    return {
      s,
      roll: sg.length ? (sg.reduce((a, x) => a + x.f, 0) / sg.reduce((a, x) => a + x.m, 0)) * 1000 : null,
      electors: sg.reduce((a, x) => a + x.electors, 0),
      turnout: sg.length ? (sg.reduce((a, x) => a + x.polledEvm, 0) / sg.reduce((a, x) => a + x.electors, 0)) * 100 : null,
      tg: sg.reduce((a, x) => a + x.tg, 0),
      census: cm ? (cf / cm) * 1000 : null,
      pop, sc: pop ? (ds.reduce((a, d) => a + d.sc, 0) / pop) * 100 : null, st: pop ? (ds.reduce((a, d) => a + d.st, 0) / pop) * 100 : null,
      religion: pop ? ([["Hindu", r("hindu")], ["Muslim", r("muslim")], ["Christian", r("christian")], ["Sikh", r("sikh")], ["Buddhist", r("buddhist")], ["Jain", r("jain")], ["Other", r("other") + r("notStated")]] as Array<[string, number]>).map(([k, v]) => [k, (v / pop) * 100] as [string, number]) : [],
    };
  }).filter((x) => x.roll != null);
  const byRoll = [...states].sort((a, b) => b.roll! - a.roll!);
  const rMin = Math.min(...states.map((x) => Math.min(x.roll!, x.census ?? x.roll!))), rMax = Math.max(...states.map((x) => Math.max(x.roll!, x.census ?? x.roll!)));
  const xr = (v: number) => ((v - rMin) / (rMax - rMin)) * 100;
  const segRatio = segs.filter((s) => s.m > 0).map((s) => ({ s, r: (s.f / s.m) * 1000, t: (s.polledEvm / s.electors) * 100 }));
  const most = [...segRatio].sort((a, b) => b.r - a.r).slice(0, 10), fewest = [...segRatio].sort((a, b) => a.r - b.r).slice(0, 10);
  const nameOf = (code: string) => ATLAS_STATES.find((x) => x.eci === code)?.name ?? code;
  const slugOf = (code: string) => ATLAS_STATES.find((x) => x.eci === code)?.slug ?? "";
  const nat = census ? (() => { const ds = census.districts; const p = ds.reduce((a, d) => a + d.population, 0); const r = (k: keyof (typeof ds)[number]["religion"]) => (ds.reduce((a, d) => a + d.religion[k], 0) / p) * 100; return { p, sc: (ds.reduce((a, d) => a + d.sc, 0) / p) * 100, st: (ds.reduce((a, d) => a + d.st, 0) / p) * 100, rel: [["Hindu", r("hindu")], ["Muslim", r("muslim")], ["Christian", r("christian")], ["Sikh", r("sikh")], ["Buddhist", r("buddhist")], ["Jain", r("jain")], ["Other", r("other")], ["Not stated", r("notStated")]] as Array<[string, number]> }; })() : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">Elections · Electorate</p>
        <h1 className="display mt-4 max-w-[24ch] text-[32px] leading-[1.07] text-ink sm:text-[42px]">Who is on the roll, and who lives where</h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          The 2024 electoral roll by gender, from the Election Commission&rsquo;s own statistical report, for the country, every state and every
          constituency. Religion and Scheduled Castes and Tribes from the 2011 Census, for the country, every state and every district.
        </p>
      </header>

      {el && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-ink">The roll by gender, 2024</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile value={crore(total)} label="electors" note={`${fmt(segs.length)} assembly segments`} />
            <Tile value={((f / m) * 1000).toFixed(0)} label="women per 1,000 men on the roll" note={`${crore(f)} women · ${crore(m)} men (derived)`} />
            <Tile value={fmt(tg)} label="third-gender electors" note={`${fmt(nri)} overseas · ${fmt(svc)} service`} />
            <Tile value={pct((polled / total) * 100)} label="voted on EVMs" note="postal ballots not in this report" />
          </div>
          <div className="mt-3 flex h-5 overflow-hidden rounded-sm" role="img" aria-label="Electors by gender">
            <span style={{ width: `${(m / (m + f + tg)) * 100}%`, background: "var(--seq-550)" }} />
            <span style={{ width: `${(f / (m + f + tg)) * 100}%`, background: "var(--seq-250)" }} />
            <span style={{ width: `${Math.max(0.3, (tg / (m + f + tg)) * 100)}%`, background: "var(--color-ink-muted)" }} />
          </div>
          <p className="mt-1 text-[11px] text-ink-2">Men {pct((m / (m + f + tg)) * 100, 2)} · women {pct((f / (m + f + tg)) * 100, 2)} · third gender {pct((tg / (m + f + tg)) * 100, 3)} of general electors</p>

          <h3 className="mt-8 text-sm font-semibold text-ink">Women per 1,000 men: on the 2024 roll against the 2011 population</h3>
          <p className="mt-1 max-w-3xl text-xs text-ink-2">
            Each state&rsquo;s dot is the electoral roll (ECI, 2024); its ring is the whole population (Census, 2011). A dot left of its ring means
            fewer women are registered than live there would suggest — though thirteen years and the age structure separate the two, so the gap is a
            prompt, not a count of missing voters (derived).
          </p>
          <div className="mt-3 space-y-1">
            {byRoll.map((x) => (
              <div key={x.s.slug} className="grid grid-cols-[7.5rem_minmax(0,1fr)_5.5rem] items-center gap-2 text-xs sm:grid-cols-[11rem_minmax(0,1fr)_7rem]">
                <Link href={`/elections/atlas/${x.s.slug}`} className="truncate text-right text-ink-2 hover:underline">{x.s.name}</Link>
                <div className="relative h-4">
                  <span className="absolute top-1/2 h-px w-full bg-[color:var(--gridline)]" />
                  {x.census != null && <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[color:var(--seq-400)]" style={{ left: `${xr(x.census)}%` }} title={`2011 population: ${x.census.toFixed(0)}`} />}
                  <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color:var(--seq-700)]" style={{ left: `${xr(x.roll!)}%` }} title={`2024 roll: ${x.roll!.toFixed(0)}`} />
                </div>
                <span className="tabular-nums text-ink">{x.roll!.toFixed(0)}{x.census != null ? <span className="text-ink-muted"> · {x.census.toFixed(0)}</span> : null}</span>
              </div>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-ink-muted">Scale runs from {rMin.toFixed(0)} to {rMax.toFixed(0)}. Andhra Pradesh and Telangana use the 2011 districts each state&rsquo;s constituencies now lie in.</p>

          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            <Ranked title="Constituencies with the most women per 1,000 men" rows={most.map((x) => [`${x.s.ac}`, nameOf(x.s.code), slugOf(x.s.code), x.r.toFixed(0)])} />
            <Ranked title="…and the fewest" rows={fewest.map((x) => [`${x.s.ac}`, nameOf(x.s.code), slugOf(x.s.code), x.r.toFixed(0)])} />
          </div>
          <p className="mt-3 text-[11px] text-ink-muted">ECI, <a href={el.source.url} className="underline" target="_blank" rel="noopener noreferrer">{el.source.title}</a>. Every row adds up, and every Lok Sabha seat&rsquo;s subtotal equals its segments.</p>
        </section>
      )}

      {nat && census && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-ink">Religion, Scheduled Castes and Tribes, 2011</h2>
          <p className="mt-1 max-w-3xl text-sm text-ink-2">
            The Election Commission records no one&rsquo;s religion or caste. The only official count is the census, and the last one was in 2011.
            It counts castes only as Scheduled Castes and Tribes. These are counts of residents by state and district; they say nothing about
            any voter or how anyone voted, and this site does not estimate them for constituencies.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile value={`${(nat.p / 1e7).toFixed(2)} crore`} label="people, 2011" note={`${census.districts.length} districts`} />
            <Tile value={pct(nat.sc)} label="Scheduled Castes" />
            <Tile value={pct(nat.st)} label="Scheduled Tribes" />
            <Tile value={pct(nat.rel.find((r) => r[0] === "Muslim")![1])} label="Muslim" note={`Hindu ${pct(nat.rel[0]![1])} · Christian ${pct(nat.rel[2]![1])} · Sikh ${pct(nat.rel[3]![1])}`} />
          </div>
          <div className="mt-3 flex h-5 overflow-hidden rounded-sm" role="img" aria-label="India by religion, Census 2011">
            {nat.rel.map(([k, v], i) => <span key={k} title={`${k} ${v.toFixed(2)}%`} style={{ width: `${v}%`, background: SHADES[Math.min(i, 4)] }} />)}
          </div>
          <p className="mt-1 text-[11px] text-ink-2">{nat.rel.map(([k, v]) => `${k} ${v.toFixed(2)}%`).join(" · ")}</p>

          <div className="mt-6 overflow-x-auto rounded border border-gridline">
            <table className="w-full min-w-[720px] text-xs">
              <thead className="bg-surface-2 text-[10px] uppercase tracking-wide text-ink-muted">
                <tr><th className="px-2 py-1.5 text-left">State</th><th className="px-2 py-1.5 text-right">People</th><th className="px-2 py-1.5 text-left">Religion</th><th className="px-2 py-1.5 text-right">SC</th><th className="px-2 py-1.5 text-right">ST</th><th className="px-2 py-1.5 text-right">Women /1,000 men</th></tr>
              </thead>
              <tbody>
                {[...states].filter((x) => x.pop).sort((a, b) => b.pop - a.pop).map((x) => (
                  <tr key={x.s.slug} className="border-t border-gridline">
                    <td className="px-2 py-1"><Link href={`/elections/atlas/${x.s.slug}`} className="text-ink hover:underline">{x.s.name}</Link></td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmt(x.pop)}</td>
                    <td className="px-2 py-1">
                      <div className="flex h-2.5 w-40 overflow-hidden rounded-sm">{[...x.religion].sort((a, b) => b[1] - a[1]).map(([k, v], i) => <span key={k} title={`${k} ${v.toFixed(1)}%`} style={{ width: `${v}%`, background: SHADES[Math.min(i, 4)] }} />)}</div>
                      <span className="text-[10px] text-ink-muted">{[...x.religion].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v.toFixed(1)}%`).join(", ")}</span>
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">{pct(x.sc!)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{pct(x.st!)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{x.census?.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-[11px] text-ink-muted">Bars shade each state&rsquo;s own largest religions darkest first; hover for every share. Every district is on its state&rsquo;s atlas page. Census of India 2011, via a district compilation that reproduces the census&rsquo;s national totals exactly.</p>
        </section>
      )}

      <section className="mb-12 rounded-lg border border-gridline bg-surface-1 p-5">
        <h2 className="text-sm font-semibold text-ink">What is not here, and why</h2>
        <ul className="mt-2 space-y-2 text-sm leading-relaxed text-ink-2">
          <li><strong className="text-ink">Religion or caste of voters.</strong> No Indian electoral record holds either. Inferring them from voters&rsquo; names would be guesswork about real people, so this site does not do it; the census counts above are by district.</li>
          <li><strong className="text-ink">Caste beyond SC and ST.</strong> The census enumerates only Scheduled Castes and Tribes. The 2011 caste census (SECC) caste tables were never published.</li>
          <li><strong className="text-ink">Ward level.</strong> Municipal and panchayat wards are run by State Election Commissions, not ECI, and their results are not in ECI&rsquo;s records.</li>
          <li><strong className="text-ink">Polling-booth (BLO) level.</strong> A booth&rsquo;s roll is a list of named people, which this site will not publish. Votes per booth are in each state&rsquo;s Form 20 PDFs; reading them is a separate, state-by-state job.</li>
        </ul>
      </section>
    </main>
  );
}

function Tile({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div className="rounded-lg border border-gridline bg-surface-2 p-4">
      <p className="text-2xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink">{label}</p>
      {note && <p className="mt-0.5 text-[11px] text-ink-muted">{note}</p>}
    </div>
  );
}

function Ranked({ title, rows }: { title: string; rows: Array<[string, string, string, string]> }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</h4>
      <ol className="mt-2 space-y-1 text-xs">
        {rows.map(([ac, st, slug, v]) => (
          <li key={`${st}-${ac}`} className="flex justify-between gap-2 border-b border-gridline pb-1">
            <span className="truncate"><span className="text-ink">{ac}</span> <Link href={`/elections/atlas/${slug}`} className="text-ink-muted hover:underline">{st}</Link></span>
            <span className="tabular-nums text-ink-2">{v}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
