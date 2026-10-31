import { AxesTest } from "@/components/axes/AxesTest";
import { AXES, ITEMS, MIN_ANSWERS } from "@/lib/axes";
import { ANCHOR_MAP } from "@/lib/axes-anchors";
import { loadVParty } from "@/lib/axes-load";

/**
 * The 12-axis political test. Take it yourself, or rate any leader or
 * government on their record with a source per answer; lay other raters'
 * profiles and V-Dem's expert-coded V-Party positions over the result.
 *
 * Nothing on this page is a verdict on anyone. The site publishes no score
 * for any leader or country: a profile exists only when someone answers the
 * questionnaire, and it says who answered it and how much of it is sourced.
 * Every statement and the way it is scored are printed below.
 */

export const metadata = {
  title: "The 12-axis political test · Bharat Tracker",
  description:
    "Twelve independent axes, 96 statements, half pointing each way. Take it yourself, or rate any leader or government on their record with a source for every answer, and compare with V-Dem's expert-coded party positions.",
};

export default function PoliticalAxesPage() {
  const vp = loadVParty();
  const parties = vp?.parties ?? [];
  return (
    <article className="mt-6 ax-page">
      <p className="ax-eyebrow">Politics · a questionnaire, not a verdict</p>
      <h1 className="ax-title">The 12-axis political test</h1>
      <p className="ax-lede">
        Left and right squeeze too much into one line. A government can be market-minded and protectionist; a leader can be socially traditional and fiercely
        secular. This test asks twelve separate questions, each with eight statements of its own. Take it yourself, or rate any leader or government in any country
        on their record, with a source for every answer, and lay several raters and V-Dem&apos;s expert survey of {parties.length ? `${parties.length.toLocaleString("en-IN")} ` : ""}parties beside it.
      </p>

      <ul className="ax-axislist">
        {AXES.map((a, i) => <li key={a.id}><b>{i + 1}. {a.name}</b><span>{a.poles[0]} ↔ {a.poles[1]}</span></li>)}
      </ul>

      <section className="mt-8" aria-label="The test">
        <AxesTest parties={parties} vpartySource={vp ? { url: vp.file.source.url, title: vp.file.source.title } : null} />
      </section>

      <section className="mt-14">
        <h2 className="ax-h2">How it is kept even-handed</h2>
        <dl className="ax-method">
          <div><dt>Four statements for each pole</dt><dd>Every axis has eight statements, four pointing each way, so someone who agrees with everything lands in the middle rather than at one end. Agreeing with a statement keyed to the left-hand pole moves a score left; agreeing with one keyed right moves it right.</dd></div>
          <div><dt>Each side in its own words</dt><dd>Statements are written as the people who hold them would put them, not as their opponents would. The poles have descriptive names — Collective and Market, Secular and Religious — and the result never gives a profile an ideology label.</dd></div>
          <div><dt>Nothing country-specific</dt><dd>No statement names a country, party or person, so the same questionnaire fits any country, leader or government, and two of them can be compared on the same terms.</dd></div>
          <div><dt>&ldquo;No record&rdquo; is not the middle</dt><dd>An unanswered statement is left out of the score, never counted as neutral. An axis is scored only with at least {MIN_ANSWERS} answers including at least one on each side; otherwise it says so.</dd></div>
          <div><dt>Records, with sources</dt><dd>Rating a leader asks about their record — what they have said and done in office — and rating a country asks about its government&apos;s laws, policies and budgets, not its rhetoric. Each answer takes a source, and the result shows how many answers have one.</dd></div>
          <div><dt>More than one rater</dt><dd>Several people can rate the same leader and share links; the results show their mean and their range on every axis. A wide range is a finding: it means the record is contested or the raters disagree.</dd></div>
          <div><dt>An outside check</dt><dd>Where V-Dem&apos;s V-Party expert survey measures something close to an axis, its position for a party can be laid alongside — kept separate, and labelled with exactly what it measured.</dd></div>
          <div><dt>Mixed order</dt><dd>Taking it yourself, statements come shuffled across axes, so an axis is not answered as a block. Rating someone else, they come by axis, which makes the research easier.</dd></div>
        </dl>
      </section>

      <section className="mt-12">
        <h2 className="ax-h2">Every statement, and which way it counts</h2>
        <p className="ax-note">{ITEMS.length} statements. ◀ moves a score toward the left-hand pole when agreed with; ▶ toward the right-hand pole. Disagreeing moves it the other way.</p>
        <div className="ax-itemgrid">
          {AXES.map((a) => (
            <details key={a.id} className="ax-itemcard">
              <summary><b>{a.name}</b> <span>{a.poles[0]} ↔ {a.poles[1]}</span></summary>
              <p className="ax-note">{a.poles[0]}: {a.means[0]} {a.poles[1]}: {a.means[1]}</p>
              <ul>
                {ITEMS.filter((i) => i.axis === a.id).map((i) => <li key={i.id}><span className="ax-key" aria-label={i.key < 0 ? `toward ${a.poles[0]}` : `toward ${a.poles[1]}`}>{i.key < 0 ? "◀" : "▶"}</span>{i.text}</li>)}
              </ul>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="ax-h2">The expert anchor</h2>
        <p className="ax-note">
          V-Party, from the V-Dem Institute at the University of Gothenburg, asks country experts to code each party&apos;s positions at every national election since 1970.
          {vp ? <> This page uses each party&apos;s latest coded election — {parties.length.toLocaleString("en-IN")} parties, read from the {vp.file.rows.toLocaleString("en-IN")} party-election rows in the V-Dem Institute&apos;s own data package.</> : null}{" "}
          A value is placed on the axis by rescaling the experts&apos; answer scale to −100 … +100; two V-Party questions on one axis are averaged.
        </p>
        <div className="ax-tablewrap">
          <table className="ax-table">
            <thead><tr><th>Axis</th><th>What V-Party measured</th><th>Variables</th></tr></thead>
            <tbody>
              {AXES.map((a) => { const m = ANCHOR_MAP.find((x) => x.axis === a.id); return (
                <tr key={a.id}><td>{a.name}</td><td>{m ? m.measures : <span className="ax-dim">No V-Party measure — no anchor</span>}</td><td className="ax-mono">{m ? m.vars.join(", ") : "—"}</td></tr>
              ); })}
            </tbody>
          </table>
        </div>
        <p className="ax-note">
          The direction of each V-Party scale is checked on every build against cases that are not in dispute — the AfD against immigration and the German Greens for it,
          the US Republicans more religious in their appeals than the Democrats, Labour more redistributive than the Conservatives — and against V-Dem&apos;s own populism and
          anti-pluralism indices. A party&apos;s position is not its leader&apos;s, the latest coding is 2019 at best, and V-Party codes parties, not governments&apos; actions.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="ax-h2">What this cannot do</h2>
        <dl className="ax-method">
          <div><dt>It does not rate anyone by itself</dt><dd>This site publishes no score for any leader or country. A profile exists only when someone fills the questionnaire in, and it carries who did and how much of it is sourced.</dd></div>
          <div><dt>Eight statements are a sample</dt><dd>No set of statements covers a whole axis. Two people who read a statement differently will answer it differently; the full list is above so the wording can be argued with.</dd></div>
          <div><dt>Records are mixed</dt><dd>Leaders say one thing and do another, and governments change course. &ldquo;Mixed record&rdquo; exists for that, and a source should point to what was done, not only what was said.</dd></div>
          <div><dt>Axes are not independent in practice</dt><dd>They are separate questions, but positions travel together in most countries. A profile that is far out on every axis is more likely a strongly held worldview than twelve separate findings.</dd></div>
        </dl>
      </section>

      {vp && (
        <p className="ax-sources">
          Expert anchor: <a href={vp.file.source.url} target="_blank" rel="noopener noreferrer">{vp.file.source.title}</a>, {vp.file.source.publisher}, licence {vp.file.source.licence}; read from the{" "}
          <a href={vp.file.source.via} target="_blank" rel="noopener noreferrer">vdemdata package</a>{vp.file.source.commit ? ` at commit ${vp.file.source.commit.slice(0, 7)}` : ""}, {new Date(vp.file.fetchedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
          Cite as Lindberg, Staffan I. et al., Varieties of Party Identity and Organization (V-Party) Dataset, V-Dem Institute.
        </p>
      )}
    </article>
  );
}
