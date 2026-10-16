import { loadTrade, fiscalYears, monthSeries, type TradeObs } from "@/lib/ministry";
import { Insight, Rows, Split } from "./Glance";
import { LabelBars, MonthLines } from "./MonthCharts";

/**
 * India's trade, at a glance: how much the country sells, whether it sells
 * more than it buys, what it sells, what oil and gold do to the gap, and how
 * this year is going — answered from the Commerce Ministry's own releases,
 * every figure already checked against its release's text.
 *
 * Per-day amounts, shares, differences and growth rates are arithmetic on two
 * published figures and are marked "calculated here".
 */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthName = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const bn = (v: number) => `$${Math.abs(v).toFixed(Math.abs(v) >= 100 ? 0 : 1)} bn`;
const bn1 = (v: number) => `$${Math.abs(v).toFixed(1)} bn`;
const pc = (a: number, b: number) => `${Math.abs(((b - a) / a) * 100).toFixed(1)}%`;
const dir = (a: number, b: number) => (b < a ? "down" : "up");
const fyLabel = (fy: string) => `${fy} (April ${fy.slice(0, 4)} to March ${Number(fy.slice(0, 4)) + 1})`;
const days = (fy: string) => { const y = Number(fy.slice(0, 4)); return (Date.UTC(y + 1, 3, 1) - Date.UTC(y, 3, 1)) / 86_400_000; };

export default function CommerceGlance() {
  const v = loadTrade();
  const FY = (id: string) => fiscalYears(v, id);
  const at = (id: string, fy: string) => FY(id).find((x) => x.fy === fy)?.v;
  const tx = FY("total-exports"), last = tx.at(-1), first = tx[0], prev = tx.at(-2);
  if (!last) return null;
  const fy = last.fy;
  const ti = at("total-imports", fy), tb = at("total-balance", fy);
  const mx = at("merch-exports", fy), sx = at("services-exports", fy), mi = at("merch-imports", fy);
  const cx = at("core-exports", fy), cm = at("core-imports", fy);
  const share = (y: string) => { const s = at("services-exports", y), t = at("total-exports", y); return s != null && t ? (s / t) * 100 : null; };

  // This year so far: the latest April-to-date period, against the same months a year earlier (both from one release).
  const ytd = [...v.latest.values()].filter((o) => o.kind === "ytd" && o.series === "total-exports" && !/:Apr-Mar$/.test(o.period)).sort((a, b) => a.period.localeCompare(b.period));
  const fyNow = ytd.map((o) => o.period.split(":")[0]!).sort().at(-1);
  const cur = ytd.filter((o) => o.period.startsWith(`${fyNow}:`) && o.role === "current").sort((a, b) => (a.released ?? "").localeCompare(b.released ?? "")).at(-1);
  const pair = (series: string): [TradeObs | undefined, TradeObs | undefined] => {
    if (!cur) return [undefined, undefined];
    const same = v.verified.filter((o) => o.src === cur.src && o.series === series && o.kind === "ytd");
    return [same.find((o) => o.role === "current"), same.find((o) => o.role === "year-earlier")];
  };
  const [ex1, ex0] = pair("total-exports"), [im1, im0] = pair("total-imports");
  const through = cur ? cur.period.split(":Apr-")[1] : null;
  const throughName = through ? MONTHS.find((m) => m.startsWith(through)) : null;

  // The latest month, against the same month a year earlier.
  const mxs = monthSeries(v, "merch-exports"), mis = monthSeries(v, "merch-imports");
  const lm = mxs.at(-1), lm0 = lm ? mxs.find((p) => p.m === `${Number(lm.m.slice(0, 4)) - 1}${lm.m.slice(4)}`) : undefined;
  const recent = (s: Array<{ m: string; v: number }>) => s.slice(-24);

  const C1 = "var(--series-1)", C2 = "var(--series-2)", C3 = "var(--series-3)";
  const src = <>Department of Commerce, monthly press releases · every figure checked against its release</>;

  return (
    <section aria-labelledby="glance" className="mt-8">
      <h2 id="glance" className="story-display text-[24px] sm:text-[28px]">At a glance</h2>
      <p className="mt-2 max-w-[70ch] text-[13.5px] leading-[1.6]" style={{ color: "var(--story-ink-2)" }}>
        What India sells to the world, what it buys, and how the year is going — in the ministry&apos;s own figures. Amounts are in US dollars, as the ministry reports them;
        a fiscal year runs April to March. Sentences are written from the numbers by code, so they change when a new release arrives.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Insight q="How much does India sell to the rest of the world in a year?" answer={bn(last.v)} unit={`in ${fy}`}
          sentence={<>Goods and services together, India exported {bn1(last.v)} in {fyLabel(fy)} — about {bn1(last.v / days(fy))} every day.
            {prev ? <> That is {dir(prev.v, last.v)} {pc(prev.v, last.v)} on {prev.fy}</> : null}{first && first !== prev ? <> and {dir(first.v, last.v)} {pc(first.v, last.v)} on {first.fy}</> : null}.</>}
          derived source={<>{src} · per day and growth calculated here</>}>
          <LabelBars bars={tx.map((x) => ({ label: x.fy, v: x.v }))} colour={C1} format={bn} height={150} />
        </Insight>

        {ti != null && tb != null && (
          <Insight q="Does India sell more than it buys?" answer={tb < 0 ? "No" : "Yes"} unit={tb < 0 ? `a gap of ${bn1(tb)} in ${fy}` : `a surplus of ${bn1(tb)} in ${fy}`}
            sentence={<>In {fy} India bought {bn1(ti)} of goods and services and sold {bn1(last.v)}{tb < 0 ? <>, so it bought {bn1(tb)} more than it sold</> : <>, a surplus of {bn1(tb)}</>}.
              {FY("total-balance")[0] && FY("total-balance")[0]!.fy !== fy ? <> In {FY("total-balance")[0]!.fy} the {FY("total-balance")[0]!.v < 0 ? "gap" : "surplus"} was {bn1(FY("total-balance")[0]!.v)}.</> : null} Money coming in from abroad — what Indians working overseas send home, investment and borrowing — covers the difference.</>}
            source={src}>
            <LabelBars bars={FY("total-balance").map((x) => ({ label: x.fy, v: x.v }))} colour={C2} format={(x) => `${x < 0 ? "−" : ""}${bn(x)}`} height={160} />
          </Insight>
        )}

        {mx != null && sx != null && (
          <Insight q="What does India sell: goods or services?" answer={`${Math.round((sx / last.v) * 100)}%`} unit={`of exports were services in ${fy}`}
            sentence={<>Goods earned {bn1(mx)} and services {bn1(sx)}.
              {first && share(first.fy) != null && first.fy !== fy ? <> Services were {Math.round(share(first.fy)!)}% of exports in {first.fy}; since then services exports grew {pc(at("services-exports", first.fy)!, sx)} and goods exports {pc(at("merch-exports", first.fy)!, mx)}.</> : null}
              {" "}The releases do not say which services; that breakdown is the Reserve Bank&apos;s.</>}
            derived source={<>{src} · shares calculated here</>}>
            <Split parts={[{ label: "Goods", v: mx, colour: C1 }, { label: "Services", v: sx, colour: C3 }]} />
          </Insight>
        )}

        {mx != null && mi != null && cx != null && cm != null && (
          <Insight q="How much of the trade gap is oil and gold?" answer={bn(Math.abs((mx - mi) - (cx - cm)))} unit={`of the ${bn(mx - mi)} goods gap in ${fy}`}
            sentence={<>India&apos;s goods imports exceeded goods exports by {bn1(mx - mi)}. Petroleum products and gems &amp; jewellery (gold, silver, pearls and precious stones) account for {bn1((mx - mi) - (cx - cm))} of that:
              leave them out, as the ministry&apos;s own &quot;core trade&quot; table does, and the gap is {bn1(cx - cm)}.</>}
            derived source={<>{src} · differences calculated here</>}>
            <Rows rows={[{ label: "Goods trade gap", v: mi - mx }, { label: "…without petroleum, gems and jewellery", v: cm - cx }]} colour={C2} format={bn1} />
          </Insight>
        )}

        {ex1 && ex0 && im1 && im0 && throughName && (
          <Insight q="How is this year going?" answer={`${dir(ex0.v, ex1.v) === "up" ? "+" : "−"}${pc(ex0.v, ex1.v)}`} unit={`exports, April to ${throughName}`}
            sentence={<>From April to {throughName} {fyNow?.slice(2, 6)}, India exported {bn1(ex1.v)} of goods and services, {dir(ex0.v, ex1.v)} {pc(ex0.v, ex1.v)} on the same months a year earlier ({bn1(ex0.v)}).
              Imports were {bn1(im1.v)}, {dir(im0.v, im1.v)} {pc(im0.v, im1.v)}. The latest month&apos;s services figure is the ministry&apos;s estimate until the Reserve Bank reports.</>}
            derived source={<>{src} · both years from the same release · growth calculated here</>}>
            <Rows rows={[
              { label: `Exports, ${ex1.period.split(":")[0]!.replace(/^FY/, "")}`, v: ex1.v }, { label: `Exports, ${ex0.period.split(":")[0]!.replace(/^FY/, "")}`, v: ex0.v },
              { label: `Imports, ${im1.period.split(":")[0]!.replace(/^FY/, "")}`, v: im1.v }, { label: `Imports, ${im0.period.split(":")[0]!.replace(/^FY/, "")}`, v: im0.v },
            ]} colour={C1} format={bn1} />
          </Insight>
        )}

        {lm && (
          <Insight q="And the latest month?" answer={bn1(lm.v)} unit={`goods exports, ${monthName(lm.m)}`}
            sentence={<>India exported {bn1(lm.v)} of goods in {monthName(lm.m)}{lm0 ? <>, {dir(lm0.v, lm.v)} {pc(lm0.v, lm.v)} on {monthName(lm0.m)} ({bn1(lm0.v)})</> : null}, and imported {bn1(mis.at(-1)?.v ?? 0)}.
              The chart shows the last two years; gaps are months whose release is not yet in the archive.</>}
            derived={!!lm0} source={src}>
            <MonthLines height={190} lines={[{ label: "Exports", colour: C1, points: recent(mxs) }, { label: "Imports", colour: C2, points: recent(mis) }]} />
          </Insight>
        )}
      </div>
    </section>
  );
}
