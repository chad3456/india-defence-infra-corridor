import { loadTrade, monthSeries, fiscalYears, type TradeObs, type TradeView } from "@/lib/ministry";
import { Eyebrow, Standfirst, Stat } from "@/components/stories/Kit";
import { ChartTitle, Caption } from "@/components/stories/Charts";
import { MonthLines, LabelBars } from "@/components/ministry/MonthCharts";
import { MinistryTabs } from "@/components/ministry/Tabs";

/**
 * India's foreign trade, month by month, read out of the Commerce Ministry's
 * own monthly releases. Every figure drawn is in a release pinned under
 * data/pdf/commerce/ and was checked against that release's text by the
 * loader (lib/ministry.ts) before the page was built.
 */

export const metadata = {
  title: "India's trade, from the Commerce Ministry's releases · Bharat Tracker",
  description: "Merchandise and services exports and imports, month by month and year by year, read from the Department of Commerce's monthly press releases — every figure checked against the pinned release it came from.",
};

const C1 = "var(--series-1)", C2 = "var(--series-2)", C3 = "var(--series-3)", C4 = "var(--series-4)";
const REPO = "https://github.com/chad3456/india-defence-infra-corridor/blob/claude/india-defence-infra-tracker-qfpsfu/";
const bn = (v: number) => `$${v.toFixed(v >= 100 ? 0 : 1)} bn`;

function Card({ n, title, what, read, children, wide, count }: { n: number; title: string; what: string; read?: string; children: React.ReactNode; wide?: boolean; count: number }) {
  return (
    <figure className={`story-card min-w-0 p-4 sm:p-5 ${wide ? "lg:col-span-2" : ""}`}>
      <div className="flex items-baseline gap-2">
        <span className="mono text-[11px] font-bold tabular-nums" style={{ color: "var(--s-hot)" }}>{String(n).padStart(2, "0")}</span>
        <div className="min-w-0 flex-1"><ChartTitle note={what}>{title}</ChartTitle></div>
      </div>
      {children}
      {read && <figcaption><Caption>{read}</Caption></figcaption>}
      <p className="mono mt-3 text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>{count} figures, each checked against its release&apos;s text · Department of Commerce</p>
    </figure>
  );
}

/** Year-on-year change, derived here from two published figures. */
function yoy(points: Array<{ m: string; v: number }>) {
  const by = new Map(points.map((p) => [p.m, p.v]));
  return points.flatMap((p) => {
    const prev = by.get(`${Number(p.m.slice(0, 4)) - 1}${p.m.slice(4)}`);
    return prev ? [{ m: p.m, v: ((p.v - prev) / prev) * 100 }] : [];
  });
}

function revisions(v: TradeView, series: string) {
  const first = monthSeries(v, series, "first"), latest = new Map(monthSeries(v, series, "latest").map((p) => [p.m, p.v]));
  return first.flatMap((f) => { const l = latest.get(f.m); return l != null && l !== f.v ? [{ m: f.m, v: l - f.v }] : []; });
}

export default function CommercePage() {
  const v = loadTrade();
  const S = (id: string) => monthSeries(v, id);
  const merchX = S("merch-exports"), merchM = S("merch-imports");
  const svcX = S("services-exports"), svcM = S("services-imports");
  const totX = S("total-exports"), totM = S("total-imports"), bal = S("total-balance");
  const merchBal = merchX.flatMap((p) => { const m = merchM.find((q) => q.m === p.m); return m ? [{ m: p.m, v: p.v - m.v }] : []; });
  const svcShare = totX.flatMap((p) => { const s = svcX.find((q) => q.m === p.m); return s ? [{ m: p.m, v: (s.v / p.v) * 100 }] : []; });
  const fy = (id: string) => fiscalYears(v, id).map((x) => ({ label: x.fy, v: x.v }));
  const months = [...new Set(v.verified.filter((o) => o.kind === "month").map((o) => o.period))].sort();
  const lastFy = fiscalYears(v, "total-exports").at(-1);
  const lastM = merchX.at(-1);
  const count = (...ids: string[]) => v.verified.filter((o) => ids.includes(o.series)).length;
  let n = 0;
  const cards: Array<{ title: string; what: string; read?: string; wide?: boolean; ids: string[]; body: React.ReactNode }> = [
    { title: "Merchandise exports and imports, every month", what: "Goods exported and imported, US$ billion, latest figure the ministry has published for each month.", read: "A month's figure is revised in the next year's release, where it appears as the comparison column; this is the revised figure where one exists.", wide: true, ids: ["merch-exports", "merch-imports"],
      body: <MonthLines wide lines={[{ label: "Exports", colour: C1, points: merchX }, { label: "Imports", colour: C2, points: merchM }]} /> },
    { title: "Services exports and imports, every month", what: "Services, US$ billion. The latest month is the ministry's estimate until the RBI publishes its own figure.", ids: ["services-exports", "services-imports"],
      body: <MonthLines lines={[{ label: "Exports", colour: C3, points: svcX }, { label: "Imports", colour: C4, points: svcM }]} /> },
    { title: "Total exports and imports (goods and services)", what: "Merchandise plus services, US$ billion, as each release tabulates them.", ids: ["total-exports", "total-imports"],
      body: <MonthLines lines={[{ label: "Exports", colour: C1, points: totX }, { label: "Imports", colour: C2, points: totM }]} /> },
    { title: "Overall trade balance, every month", what: "Total exports minus total imports, goods and services, as each release prints it. Below zero is a deficit.", ids: ["total-balance"],
      body: <MonthLines lines={[{ label: "Balance", colour: C2, points: bal }]} /> },
    { title: "Merchandise trade balance", what: "Goods exports minus goods imports, derived here from the two published figures.", read: "Derived: the releases print the overall balance, not the goods balance.", ids: ["merch-exports", "merch-imports"],
      body: <MonthLines lines={[{ label: "Goods balance", colour: C4, points: merchBal }]} /> },
    { title: "Services as a share of total exports", what: "Services exports divided by total exports, per cent, derived here.", ids: ["services-exports", "total-exports"],
      body: <MonthLines unit="%" lines={[{ label: "Services share", colour: C3, points: svcShare }]} /> },
    { title: "Merchandise exports, change on the same month a year earlier", what: "Per cent, derived from the two published monthly figures.", ids: ["merch-exports"],
      body: <MonthLines unit="%" lines={[{ label: "Year on year", colour: C1, points: yoy(merchX) }]} /> },
    { title: "Exports excluding petroleum, and excluding petroleum and gems", what: "The ministry's own core-trade measures: exports with petroleum products taken out, and with gems & jewellery taken out as well.", read: "Petroleum products and gems & jewellery are large lines whose values move with world prices; the ministry publishes trade without them as well.", ids: ["nonpetro-exports", "core-exports"],
      body: <MonthLines lines={[{ label: "Ex-petroleum", colour: C1, points: S("nonpetro-exports") }, { label: "Ex-petroleum & gems", colour: C3, points: S("core-exports") }]} /> },
    { title: "Imports excluding petroleum, and excluding petroleum and gems", what: "Imports with petroleum taken out, and with gold, silver, pearls and precious stones taken out as well.", ids: ["nonpetro-imports", "core-imports"],
      body: <MonthLines lines={[{ label: "Ex-petroleum", colour: C2, points: S("nonpetro-imports") }, { label: "Ex-petroleum & gems", colour: C4, points: S("core-imports") }]} /> },
    { title: "Fiscal-year merchandise exports", what: "April–March totals, US$ billion, from each March release's year table.", ids: ["merch-exports"], body: <LabelBars bars={fy("merch-exports")} colour={C1} /> },
    { title: "Fiscal-year services exports", what: "April–March totals, US$ billion.", ids: ["services-exports"], body: <LabelBars bars={fy("services-exports")} colour={C3} /> },
    { title: "Fiscal-year total exports", what: "Goods and services, April–March, US$ billion.", ids: ["total-exports"], body: <LabelBars bars={fy("total-exports")} colour={C1} /> },
    { title: "Fiscal-year trade balance", what: "Goods and services, April–March, US$ billion.", ids: ["total-balance"], body: <LabelBars bars={fy("total-balance")} colour={C2} /> },
    { title: "How much the first estimate of services exports was revised", what: "Latest published figure minus the figure in the month's own release, US$ billion, derived here.", read: "Services figures are the ministry's estimates until the RBI reports; a year later they are replaced. The size of the change is a measure of how provisional the first number is.", ids: ["services-exports"],
      body: <MonthLines lines={[{ label: "Revision", colour: C4, points: revisions(v, "services-exports") }]} /> },
    { title: "How much the first estimate of merchandise exports was revised", what: "Latest minus first published figure, US$ billion, derived here.", ids: ["merch-exports"],
      body: <MonthLines lines={[{ label: "Revision", colour: C1, points: revisions(v, "merch-exports") }]} /> },
  ];

  return (
    <article className="pt-6">
      <MinistryTabs active="commerce" />
      <Eyebrow tone="hot">Department of Commerce · monthly releases</Eyebrow>
      <h1 className="story-display mt-3 max-w-[22ch] text-[32px] sm:text-[44px]">India&apos;s trade, from the ministry&apos;s own releases</h1>
      <Standfirst>
        Every figure here is read from the Department of Commerce&apos;s monthly press release on India&apos;s foreign trade — {v.releases.length} releases,
        pinned in this repository with their checksums — and checked against the release&apos;s own text before it is drawn. {v.verified.length} figures
        cover {months.length} months from {months[0]} to {months.at(-1)}. Nothing is estimated here; derived views say so.
      </Standfirst>
      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        {lastM && <Stat size="md" label={`Merchandise exports, ${lastM.m}`} value={bn(lastM.v)} note="Latest month, as last published." />}
        {lastFy && <Stat size="md" tone="hot" label={`Total exports, FY ${lastFy.fy}`} value={bn(lastFy.v)} note="Goods and services, April–March." />}
        <Stat size="md" label="Releases pinned" value={String(v.releases.length)} note={<>{v.failed.length ? `${v.failed.length} figures failed the check and are not drawn.` : "Every extracted figure passed the check."}</>} />
      </div>
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {cards.map((c) => <Card key={c.title} n={++n} title={c.title} what={c.what} read={c.read} wide={c.wide} count={count(...c.ids)}>{c.body}</Card>)}
      </div>

      <section className="mt-14 border-t pt-8" style={{ borderColor: "var(--story-rule)" }}>
        <Eyebrow>The releases, pinned</Eyebrow>
        <p className="mt-3 max-w-[72ch] text-[13px] leading-[1.65]" style={{ color: "var(--story-ink-2)" }}>
          Each release is downloaded by a scheduled job from the ministry&apos;s site (or, for releases the site no longer lists, from the Internet Archive&apos;s
          copy), saved in this repository, and converted to text. The figures are read from the text by explicit table rules
          (<code>scripts/etl/ministry/extract_trade.py</code>), and a table is kept only if its rows add up as the ministry prints them.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead><tr className="text-left" style={{ color: "var(--story-ink-3)" }}><th className="py-1 pr-3">Published</th><th className="pr-3">Release</th><th className="pr-3">Figures</th><th className="pr-3">Pinned copy</th><th>SHA-256</th></tr></thead>
            <tbody>
              {[...v.releases].reverse().map((d) => (
                <tr key={d.id} className="border-t" style={{ borderColor: "var(--story-rule)" }}>
                  <td className="mono py-1 pr-3">{d.published}</td>
                  <td className="pr-3"><a className="underline decoration-dotted" href={d.url} target="_blank" rel="noopener noreferrer">{d.title}</a></td>
                  <td className="mono pr-3">{v.verified.filter((o: TradeObs) => o.src === d.id).length}</td>
                  <td className="pr-3">{d.file ? <a className="underline decoration-dotted" href={REPO + d.file} target="_blank" rel="noopener noreferrer">{d.file.split("/").pop()}</a> : "—"}</td>
                  <td className="mono" style={{ color: "var(--story-ink-3)" }}>{d.sha256?.slice(0, 12)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </article>
  );
}
