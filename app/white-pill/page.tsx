import { GapRows, PaceRow, Spark, fmt } from "@/components/white-pill/Charts";
import { LiveFeed } from "@/components/white-pill/LiveFeed";
import { BREAK, LIVE_TOPICS, PACE, THEMES, type Pace, type Study } from "@/lib/white-pill";
import { loadWhitePill, type ResolvedCard } from "@/lib/white-pill-load";

/**
 * The white pill: what is measurably getting better in India, theme by
 * theme, with the catch printed beside each chart; whether the pace changed
 * after 2014, on indicators chosen before their results were computed; what
 * the major reports say, including the ones that cut the other way; and live
 * reporting, kept apart from the numbers.
 *
 * Every figure is from the site's record or data/white-pill/studies.json.
 * The prose computes its numbers from those files; none is typed here.
 */

export const metadata = {
  title: "The white pill: India's progress, counted · Bharat Tracker",
  description:
    "What is measurably getting better in India — poverty, inequality, space, technology, AI, infrastructure, defence exports — with the catch beside every chart, a test of what changed after 2014, and live reporting.",
};

const pct = (v: number) => `${v.toFixed(v >= 10 ? 0 : 1)}%`;

function StudyCard({ s }: { s: Study }) {
  return (
    <article className={`wp-study wp-s-${s.stance}`}>
      <p className="wp-study-eyebrow">{s.stance === "supports" ? "Report" : "The other side"} · {s.publisher} · {s.published}</p>
      <h4><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a></h4>
      <p>{s.finding}</p>
      {s.caveat && <p className="wp-catch"><b>The catch:</b> {s.caveat}</p>}
      {s.checkedVia?.length ? <p className="wp-fine">Checked against {s.checkedVia.map((u, i) => <span key={u}>{i ? ", " : ""}<a href={u} target="_blank" rel="noopener noreferrer">{new URL(u).hostname.replace(/^www\./, "")}</a></span>)}.</p> : null}
    </article>
  );
}

function ChartCard({ c }: { c: ResolvedCard }) {
  return (
    <article className="wp-card">
      <h4>{c.title}</h4>
      {c.missing ? <p className="wp-await">Awaiting data — this series is not in the record yet.</p> : <Spark points={c.points} unit={c.unit} better={c.better} />}
      {c.gap && (
        <div className="wp-cardgap">
          <p className="wp-gaplabel"><span className="wp-key-poor" /> poorest fifth <span className="wp-key-rich" /> richest fifth</p>
          <GapRows rows={c.gap} />
        </div>
      )}
      <p className="wp-catch"><b>The catch:</b> {c.card.caveat}</p>
      <p className="wp-src">{c.sources.slice(0, 2).map((s, i) => <span key={s.url + i}>{i ? " · " : ""}<a href={s.url} target={s.url.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer">{s.name}</a></span>)}</p>
    </article>
  );
}

export default function WhitePillPage() {
  const { cards, paces, gaps, studies } = loadWhitePill();
  const card = (series: string) => cards.find((c) => c.card.series === series && !c.missing);
  const at = (c: ResolvedCard | undefined, label: string) => c?.points.find((p) => p.label === label);
  const last = (c: ResolvedCard | undefined) => c?.points.at(-1);

  const pov = card("wdi-extreme-poverty"), acc = card("wdi-account-ownership"), pat = card("wdi-patents-resident");
  const net = card("wdi-internet-users"), dex = card("defence-exports"), fac = card("nfhs:facility_births");
  const facGap = fac?.gap;
  const stats = [
    pov && at(pov, "2011") && last(pov) ? { big: pct(last(pov)!.v), text: `of Indians in extreme poverty in ${last(pov)!.label}, on the World Bank's $3.00-a-day line — ${pct(at(pov, "2011")!.v)} in 2011` } : null,
    acc && last(acc) ? { big: pct(last(acc)!.v), text: `of adults have a bank or mobile-money account (${last(acc)!.label}), up from ${pct(acc.points[0]!.v)} in ${acc.points[0]!.label}` } : null,
    facGap && facGap.length >= 2 ? { big: pct(facGap.at(-1)!.poorest), text: `of births among the poorest fifth were in a health facility in ${facGap.at(-1)!.round}, up from ${pct(facGap.find((r) => r.round === "2005-06")?.poorest ?? facGap[0]!.poorest)} in 2005-06` } : null,
    pat && at(pat, "2014") && last(pat) ? { big: `${(last(pat)!.v / at(pat, "2014")!.v).toFixed(1)}×`, text: `patent applications by Indian residents, ${last(pat)!.label} against 2014 — ${fmt(last(pat)!.v)} filed` } : null,
    net && at(net, "2014") && last(net) ? { big: pct(last(net)!.v), text: `of Indians use the internet (${last(net)!.label}), up from ${pct(at(net, "2014")!.v)} in 2014` } : null,
    dex && last(dex) ? { big: fmt(last(dex)!.v, "₹ cr"), text: `of defence exports in ${last(dex)!.label}, in nominal rupees — ${fmt(dex.points[0]!.v, "₹ cr")} in ${dex.points[0]!.label}` } : null,
  ].filter((x): x is { big: string; text: string } => !!x);

  const counted = paces.filter((p) => p.verdict !== "unknown");
  const n = (v: Pace["verdict"]) => counted.filter((p) => p.verdict === v).length;
  const names = (v: Pace["verdict"]) => { const l = counted.filter((p) => p.verdict === v).map((p) => (/^[A-Z][a-z]/.test(p.spec.label) ? p.spec.label.charAt(0).toLowerCase() + p.spec.label.slice(1) : p.spec.label)); return l.length > 1 ? `${l.slice(0, -1).join(", ")} and ${l.at(-1)}` : l[0] ?? "nothing"; };
  const themedStudies = (t: string) => studies?.studies.filter((s) => s.theme === t) ?? [];

  return (
    <article className="wp-page">
      <header className="wp-hero">
        <p className="wp-eyebrow"><span className="wp-pill">White pill</span> Bharat Tracker · progress, counted</p>
        <h1>India is getting better at a lot of things. Here is the evidence — and the catch.</h1>
        <p className="wp-lede">
          Every chart on this page is a published series in this site&apos;s record, every report figure links to where it was checked, and every piece of good news
          carries the objection a careful reader would raise. Where a measure points the other way — income at the very top, women&apos;s anaemia, manufacturing&apos;s
          share of the economy — it is shown, not left out. A white pill is not a sugar pill.
        </p>
        <div className="wp-stats">
          {stats.map((s) => <div key={s.text}><b>{s.big}</b><span>{s.text}</span></div>)}
        </div>
        <nav className="wp-themenav" aria-label="Themes">
          {THEMES.map((t) => <a key={t.id} href={`#${t.id}`}>{t.name}</a>)}
          <a href="#since-2014" className="wp-strong">Since 2014</a>
          <a href="#live" className="wp-strong"><span className="wp-dot" aria-hidden /> Live</a>
        </nav>
      </header>

      {THEMES.map((t) => {
        const cs = cards.filter((c) => c.card.theme === t.id);
        const ss = themedStudies(t.id);
        return (
          <section key={t.id} id={t.id} className="wp-section">
            <div className="wp-sechead"><h2>{t.name}</h2><p>{t.line}</p></div>
            <div className="wp-grid">{cs.map((c) => <ChartCard key={c.card.series + c.card.theme} c={c} />)}</div>
            {t.id === "social" && gaps.length > 0 && (
              <div className="wp-gapblock">
                <h3>The gap between India&apos;s poorest and richest households</h3>
                <p className="wp-muted">The poorest fifth of households against the richest fifth, in each National Family Health Survey round. The bar between the two dots is the gap; on every one of these measures it has narrowed, because the poorest caught up rather than the richest fell back.</p>
                <div className="wp-gapgrid">
                  {gaps.map((g) => (
                    <div key={g.key}>
                      <p className="wp-gaptitle">{g.label} <span>{fmt(g.rows[0]!.richest - g.rows[0]!.poorest)} → {fmt(g.rows.at(-1)!.richest - g.rows.at(-1)!.poorest)} points</span></p>
                      <GapRows rows={g.rows} />
                    </div>
                  ))}
                </div>
                <p className="wp-fine"><span className="wp-key-poor" /> poorest fifth · <span className="wp-key-rich" /> richest fifth, by household wealth. The DHS Program&apos;s harmonised NFHS tables; NFHS-6 (2023–24) wealth breakdowns are not yet in them.</p>
              </div>
            )}
            {ss.length > 0 && <div className="wp-studies">{ss.map((s) => <StudyCard key={s.id} s={s} />)}</div>}
          </section>
        );
      })}

      <section id="since-2014" className="wp-section wp-2014">
        <div className="wp-sechead">
          <h2>What changed after {BREAK}?</h2>
          <p>
            Of {counted.length} measures chosen in advance, {n("faster")} improved faster after {BREAK} than in the decade before, {n("similar")} at about the same pace, and {n("slower")} more
            slowly or got worse. That is the measured answer to &ldquo;what changed under the Modi government&rdquo;: faster on {names("faster")}; about the same on {names("similar")};
            slower or worse on {names("slower")}.
          </p>
        </div>
        <div className="wp-legend"><span><b className="wp-pre" /> before {BREAK}</span><span><b className="wp-post" /> after {BREAK}</span></div>
        {(["faster", "similar", "slower"] as const).map((v) => (
          <div key={v}>
            <h3 className="wp-paceh">{v === "faster" ? "Faster after 2014" : v === "similar" ? "About the same pace" : "Slower, or worse"} <span>{n(v)}</span></h3>
            <ol className="wp-pacelist">{counted.filter((p) => p.verdict === v).map((p) => <PaceRow key={p.spec.key} p={p} />)}</ol>
          </div>
        ))}
        <dl className="wp-method">
          <div><dt>How the pace is compared</dt><dd>For coverage (toilets, accounts) the share of the remaining gap closed each year; for things that should fall (mortality, poverty) the percentage fall a year; for counts (patents, papers) annual growth; for GDP growth and investment the period average; for manufacturing&apos;s share, points a year. Gap-closing and percentage rates compare fairly across starting levels — closing the last 10% is as hard as the first 50%.</dd></div>
          <div><dt>When it counts as a change</dt><dd>A rate must differ by more than 15% of the earlier one; an average by more than half the series&apos; own year-to-year spread. Anything closer is &ldquo;about the same&rdquo;.</dd></div>
          <div><dt>Why these {PACE.length} measures</dt><dd>They are measured in both periods — a survey round, a count, the national accounts — and were chosen before their results were computed. Modelled series such as the World Bank&apos;s water or mortality curves are left out: they are smoothed between surveys, so they cannot show a break in any year.</dd></div>
          <div><dt>The survey rounds do not split neatly</dt><dd>NFHS-4 was in the field from January 2015 to December 2016, so the &ldquo;before&rdquo; period (NFHS-3 to NFHS-4) includes the first two years of the 2014 government, and the &ldquo;after&rdquo; period ends with NFHS-5 in 2019–21.</dd></div>
          <div><dt>Faster is not proof of cause</dt><dd>A trend can speed up for reasons a government did not choose — a new telecom entrant, falling solar prices, the base effect of a pandemic — and slow down for reasons it did not cause. This shows when the pace changed, not who changed it.</dd></div>
        </dl>
      </section>

      <section id="live" className="wp-section">
        <div className="wp-sechead"><h2>Tracking it as it is reported</h2><p>What newsrooms are reporting on each theme right now — praise and criticism alike. Kept apart from the numbers above, which change only when a statistical release does.</p></div>
        <LiveFeed topics={LIVE_TOPICS.map(([t]) => t)} />
      </section>

      <section className="wp-section">
        <div className="wp-sechead"><h2>How this page is kept honest</h2></div>
        <dl className="wp-method">
          <div><dt>Only published series</dt><dd>Every chart is a series already in the site&apos;s record with its sources — the World Bank, the National Family Health Survey, ministries&apos; own releases, SIPRI — and the same series appear on the rest of the site.</dd></div>
          <div><dt>The catch is part of the chart</dt><dd>Each card says what the number does not show: a changed survey method, nominal rupees, a consumption-based Gini, a modelled curve.</dd></div>
          <div><dt>Both sides of the reports</dt><dd>Reports are quoted in their own terms, and the ones that cut against the good news — the top 1%&apos;s rising income share, the critique of the &ldquo;fourth most equal&rdquo; claim — sit beside the ones that support it.</dd></div>
          <div><dt>News is never data</dt><dd>Live headlines inform; they do not move a chart. A number changes here only when its publisher releases a new figure.</dd></div>
          <div><dt>No posts from X</dt><dd>This site does not republish posts from X. Reporting on them reaches the live panel through the newsrooms that cover it.</dd></div>
        </dl>
        {studies && <p className="wp-fine">Report figures checked {studies.accessed}. {studies.note}</p>}
      </section>
    </article>
  );
}
