import { CorridorAtlas, type AtlasCorridor } from "@/components/corridors/CorridorAtlas";
import { CorridorTimeline, ItsCard, RankLine, VERDICT_LABEL } from "@/components/corridors/EconCharts";
import { DOMAINS } from "@/lib/corridors-economy";
import { loadCorridors } from "@/lib/corridors-load";

/**
 * Every economic corridor India is part of, mapped, dated and checked — and
 * the economy since 2014 tested against its own trend before it.
 *
 * The corridor register is data/corridors/corridors.json, each entry with the
 * year it was begun (often before 2014) and its sources. The economic
 * comparison is a segmented regression on World Bank series chosen in
 * advance (lib/corridors-economy.ts, lib/its.ts); every count in the prose is
 * computed from those results.
 */

export const metadata = {
  title: "India's economic corridors, and the economy since 2014 · Bharat Tracker",
  description:
    "An index of every economic corridor India is part of — IMEC, the North–South corridor, Chennai–Vladivostok, the freight corridors, the bullet train, the industrial corridors — mapped and checked, and a regression test of whether India's economy changed course after 2014, across nine domains.",
};

export default function CorridorsPage() {
  const { file, worldView, indiaView, corridorSeries, expressways, economy } = loadCorridors();
  const cs = file.corridors;
  const before = cs.filter((c) => c.started < 2014).length;
  const live = cs.filter((c) => c.status === "operational" || c.status === "partly-operational").length;
  const stuck = cs.filter((c) => c.status === "stalled" || c.status === "framework").length;
  const tested = economy.filter((e) => !e.spec.modelled && e.fit);
  const n = (v: string) => tested.filter((e) => e.verdict === v).length;
  const ex = expressways?.points ?? [];
  const lpi = file.logistics.points;
  const sum = (id: string) => corridorSeries[id]?.points.reduce((a, p) => a + p.value, 0) ?? null;
  const committed = sum("defence-corridor-committed"), grounded = sum("defence-corridor-grounded");
  // Point estimates alone, before asking whether the difference is real: did the trend move the better way or the worse?
  const directed = tested.filter((e) => e.spec.better !== null && e.fit);
  const goodWay = directed.filter((e) => (e.fit!.change > 0) === (e.spec.better === "up")).length;
  const wide = tested.filter((e) => (e.fit?.rho ?? 0) >= 0.9).length;
  const names = (v: string) => { const l = tested.filter((e) => e.verdict === v).map((e) => e.spec.label.charAt(0).toLowerCase() + e.spec.label.slice(1)); return l.length > 1 ? `${l.slice(0, -1).join(", ")} and ${l.at(-1)}` : l[0] ?? "none"; };
  const atlas: AtlasCorridor[] = cs.map((c) => ({ id: c.id, name: c.name, scope: c.scope, mode: c.mode, partners: c.partners, started: c.started, startedNote: c.startedNote, status: c.status, statusNote: c.statusNote, progress: c.progress, progressLabel: c.progressLabel, facts: c.facts, sources: c.sources }));
  const strip = (v: { width: number; height: number; routes: Array<{ id: string; d: string; mode: string }>; nodes: Array<{ id: string; name: string; x: number; y: number }>; labels: Array<{ id: string; x: number; y: number }> }) => ({ width: v.width, height: v.height, routes: v.routes, nodes: v.nodes, labels: v.labels });

  return (
    <article className="cx">
      <header className="cor-hero">
        <div className="cor-heroart" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/corridors/world.svg" alt="" />
          <svg viewBox={`0 0 ${worldView.width} ${worldView.height}`}>
            {worldView.routes.map((r, i) => <path key={i} d={r.d} pathLength={1} className={`cor-heroroute cor-m-${r.mode}`} style={{ animationDelay: `${i * 0.09}s` }} />)}
          </svg>
        </div>
        <div className="cor-herotext">
          <p className="cor-eyebrow">Corridors · the economy · 2004–2026</p>
          <h1>The roads, rails and sea lanes India is building — and what the economy did</h1>
          <p className="cor-lede">
            {cs.length} economic corridors, from a Mediterranean rail link that is still a memorandum to a freight line that runs today. {before} of them were begun before 2014;
            the decade since is when most were built, or stalled. Below them, a test of the economy itself: across {tested.length} measured indicators, did the
            trend change after 2014? Taken at face value, {goodWay} of {directed.length} trends moved the better way and {directed.length - goodWay} the worse. Tested against each
            series&apos; own year-to-year drift, only {n("better") + n("worse") + n("steeper") + n("flatter")} changes are clear: {n("better")} for the better, {n("worse")} for the worse{n("steeper") + n("flatter") ? <>, and {n("steeper") + n("flatter")} in a series with no better direction</> : null}. Twenty-two years of data cannot settle the rest.
          </p>
        </div>
      </header>

      <div className="cor-stats">
        <div><b>{cs.length}</b><span>corridors indexed: {cs.filter((c) => c.scope === "international").length} international, {cs.filter((c) => c.scope !== "international").length} national or industrial</span></div>
        <div><b>{live}</b><span>operational or partly operational; {stuck} stalled or still a framework</span></div>
        {ex.length >= 2 && <div><b>{Math.round(ex.at(-1)!.value).toLocaleString("en-IN")} km</b><span>of access-controlled expressway in {ex.at(-1)!.period}, from {ex[0]!.value} km in {ex[0]!.period}</span></div>}
        <div><b>{lpi[0]![1]} → {lpi.at(-1)![1]}</b><span>India&apos;s World Bank logistics rank, {lpi[0]![0]} to {lpi.at(-1)![0]} (best: {Math.min(...lpi.map((p) => p[1]))}th, {lpi.find((p) => p[1] === Math.min(...lpi.map((q) => q[1])))![0]})</span></div>
        {committed && grounded ? <div><b>{Math.round((100 * grounded) / committed)}%</b><span>of investment committed to the defence corridors actually grounded</span></div> : null}
        <div><b>{goodWay} / {directed.length - goodWay}</b><span>indicators whose trend moved the better / worse way after 2014, at face value. By regression, clearly better: {n("better")}; clearly worse: {n("worse")}</span></div>
      </div>

      <section className="cor-section">
        <h2>The index</h2>
        <p className="cor-note">Every corridor India is party to. Tap a card or a route. Routes are drawn through their main nodes, not surveyed alignments. Colour shows status as last reported; each card says when the corridor was begun and what has happened since.</p>
        <CorridorAtlas corridors={atlas} world={strip(worldView)} india={strip(indiaView)} />
      </section>

      <section className="cor-section">
        <h2>Begun when, and where they stand</h2>
        <p className="cor-note">Each bar runs from the year a corridor was begun to today, coloured by its status. The freight corridors, the industrial corridors, the North–South corridor and the Myanmar links were all begun before 2014; the high-speed line, the Delhi–Mumbai Expressway, the eastern maritime route and IMEC after.</p>
        <CorridorTimeline rows={[...cs].sort((a, b) => a.started - b.started)} />
        <p className="cor-legend cor-legend-gantt"><span><i className="cor-k ec-b-op" /> operational</span><span><i className="cor-k ec-b-part" /> partly operational</span><span><i className="cor-k ec-b-build" /> under construction</span><span><i className="cor-k ec-b-stall" /> stalled</span><span><i className="cor-k ec-b-frame" /> framework only</span></p>
      </section>

      <section className="cor-section cor-two">
        <div>
          <h3 className="cor-h3">{file.logistics.title}</h3>
          <RankLine points={lpi} label={file.logistics.title} />
          <p className="cor-note">{file.logistics.note} Sources: {file.logistics.sources.map((u, i) => <a key={u} href={u} target="_blank" rel="noopener noreferrer">{i ? ", " : ""}{new URL(u).hostname.replace(/^www\./, "")}</a>)}.</p>
        </div>
        {committed && grounded ? (
          <div>
            <h3 className="cor-h3">Defence corridors: committed against grounded</h3>
            <div className="cor-bars">
              <div><span>Committed</span><i style={{ width: "100%" }} /><b>₹{Math.round(committed).toLocaleString("en-IN")} cr</b></div>
              <div><span>Grounded</span><i className="cor-g" style={{ width: `${(100 * grounded) / committed}%` }} /><b>₹{Math.round(grounded).toLocaleString("en-IN")} cr</b></div>
            </div>
            <p className="cor-note">Uttar Pradesh and Tamil Nadu together, from this site&apos;s record; see the <a href="/defence-tracker">defence tracker</a>. A commitment is not construction.</p>
          </div>
        ) : null}
      </section>

      <section className="cor-section">
        <h2>The economy: did anything change course after 2014?</h2>
        <p className="cor-note">
          For each indicator, two straight trends are fitted — one through 2004–13, one through 2014 onward — and the question is whether the second differs from the first by
          more than chance. Taken at face value, {goodWay} of the {directed.length} indicators with a better direction moved that way after 2014 and {directed.length - goodWay} the
          other. But each answer comes with a 95% range, and a change is called only when the whole range is on one side of zero. On that test, {n("better")} improved
          faster ({names("better")}), {n("worse")} slowed or worsened ({names("worse")}), and {n("unclear")} cannot be told apart from the series&apos; own drift — for {wide} of
          them the residuals wander so persistently that the range had to be made very wide to stay honest. That is a limit of twenty-two annual points, not a finding that
          nothing changed. Levels rose on most — a slower trend is still growth — and the 2004–13 decade had a commodity boom and a credit boom of its own, so a slower trend
          after it is not by itself a verdict on policy.
        </p>
        <div className="cor-tally">
          {(["better", "worse", "steeper", "flatter", "unclear"] as const).filter((v) => n(v) > 0).map((v) => <span key={v} className={`ec-pill ec-p-${v}`}>{VERDICT_LABEL[v]}: {n(v)}</span>)}
        </div>
        {DOMAINS.map((d) => {
          const rows = economy.filter((e) => e.spec.domain === d.id);
          if (!rows.length) return null;
          return (
            <div key={d.id} className="cor-domain">
              <h3 className="cor-h3">{d.name} <span className="cor-muted">— {d.line}</span></h3>
              <div className="ec-grid">{rows.map((e) => <ItsCard key={e.spec.id} e={e} />)}</div>
            </div>
          );
        })}
      </section>

      <section className="cor-section">
        <h2>How the test works, and what it cannot say</h2>
        <dl className="cor-method">
          <div><dt>The model</dt><dd>A segmented regression: level and trend before 2014, and a separate level and trend after. Money and counts are fitted on their logarithm, so trends read as % growth a year; shares and rates as they are, in points a year.</dd></div>
          <div><dt>Honest error bars</dt><dd>Yearly economic series drift, one year leaning on the last, which makes ordinary error bars too narrow. The textbook fix, Newey–West errors, was tried first and checked by simulation on this exact design: its &ldquo;95%&rdquo; ranges caught the truth only 84% of the time even with no drift, and 64% with moderate drift. So the ranges here are calibrated by simulation instead: measure how strongly each series&apos; residuals carry over from year to year, correct that measure for its known bias toward zero (leaning cautious), simulate noise that drifts that much on the same years, and widen the range until it catches the truth 95% of the time. Checked the same way, it does — 94–98% for moderate drift, about 90% for very strong drift. The price is width: with about ten years a side, &ldquo;no clear change&rdquo; usually means the data cannot say.</dd></div>
          <div><dt>Chosen in advance</dt><dd>The indicators are every measured World Bank series in this site&apos;s record with five or more years either side of 2014. One was reclassified after the first run, and says so: mobile subscriptions were saturating by 2014, so their slower trend is not counted as worse. ILO&apos;s modelled labour series are shown but not counted.</dd></div>
          <div><dt>The pandemic</dt><dd>2020–21 sit inside the later period. Each card says when leaving them out would change its verdict.</dd></div>
          <div><dt>When, not who</dt><dd>A change of trend at 2014 says when the economy turned, not why. Oil prices, the global cycle, a credit bust inherited from the boom, and the pandemic all fall in the same years as the change of government.</dd></div>
          <div><dt>Corridors are not yet the economy</dt><dd>Most corridors here opened, or will, in the 2020s. Their effect on these national series, if any, is mostly still to come; this page shows both and claims no link between them.</dd></div>
        </dl>
        <p className="cor-note">Corridor facts checked {file.accessed}. Economic series: World Bank, World Development Indicators, as held in this site&apos;s record.</p>
      </section>
    </article>
  );
}
