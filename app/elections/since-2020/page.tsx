import { PairBars, Timeline, TileMap } from "@/components/elections/Since2020Charts";
import { Hemicycle } from "@/components/elections/Dashboards";
import { getSeries } from "@/lib/data";
import { loadGoverns } from "@/lib/elections-atlas";
import { loadSince2020, type Election } from "@/lib/since-2020";

/**
 * The BJP and the NDA in every election since the pandemic: the 2024 Lok
 * Sabha, every state assembly from Bihar 2020 to May 2026, the Rajya Sabha,
 * who voted for them, and the world those elections were held in.
 *
 * Seats and vote shares are counted from ECI's seat pages wherever the
 * archive holds them; the 2020–21 round is reported and marked so. Every
 * summary figure in the prose is computed from those rows.
 */

export const metadata = {
  title: "The BJP since the pandemic: every election, counted · Bharat Tracker",
  description:
    "Every Lok Sabha and state assembly election since 2020, counted seat by seat from ECI's pages: the BJP's and the NDA's seats and vote share, who governs now, the Rajya Sabha, women's and men's votes, and the wars, pandemic and economy around them.",
};

const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)}%`);
const BASIS: Record<Election["basis"], string> = { counted: "Counted from ECI's seat pages", tally: "ECI's party tally; vote share not read", reported: "Reported, before the archive's coverage" };

export default function Since2020Page() {
  const { file, elections, ls2024 } = loadSince2020();
  const governs = loadGoverns();
  const decided = elections.filter((e) => e.ndaGovernment !== null);
  const formed = decided.filter((e) => e.ndaGovernment).length;
  const bjpSeatsAll = elections.reduce((a, e) => a + e.bjpSeats, 0);
  const housesAll = elections.reduce((a, e) => a + e.house, 0);
  const latest: Record<string, Election> = {};
  for (const e of elections) latest[e.state] = e;
  const now = governs?.states ?? [];
  const ndaNow = now.filter((g) => g.alliance === "NDA").length, bjpNow = now.filter((g) => g.party === "BJP").length;
  const ls19 = file.lokSabha2019;
  const growth = (getSeries("wdi-gdp-growth")?.points ?? []).filter((p) => p.value !== null).map((p) => ({ year: Number(p.period), v: p.value as number }));
  const inflation = (getSeries("wdi-inflation")?.points ?? []).filter((p) => p.value !== null).map((p) => ({ year: Number(p.period), v: p.value as number }));
  const g20 = growth.find((g) => g.year === 2020), g21 = growth.find((g) => g.year === 2021);
  const recent = growth.filter((g) => g.year >= 2022);
  const avgRecent = recent.length ? recent.reduce((a, g) => a + g.v, 0) / recent.length : null;
  const shareRows = elections.filter((e) => e.bjpShare !== null);
  const best = [...shareRows].sort((a, b) => b.bjpShare! - a.bjpShare!)[0];
  const demo = file.demographics;
  const L = file.lokniti2024;
  const partnerRows = ls2024.partners.map((p) => ls2024.parties.find((x) => x.party === p.party)!).filter(Boolean);
  const restVotes = ls2024.parties.filter((x) => !ls2024.partners.some((p) => p.party === x.party)).reduce((a, x) => a + x.votes, 0);
  const restShare = ls2024.parties.filter((x) => !ls2024.partners.some((p) => p.party === x.party)).reduce((a, x) => a + x.share, 0);
  const lsParties = [...partnerRows, { party: "Everyone else", abbr: "Others", won: ls2024.seats - ls2024.ndaSeats, votes: restVotes, share: restShare }];

  return (
    <main className="s20">
      <header className="s20-hero">
        <p className="s20-eyebrow">Elections · since the pandemic · 2020–2026</p>
        <h1>The BJP after the pandemic, election by election</h1>
        <p className="s20-lede">
          Since Bihar voted in November 2020, India has held {elections.length} state assembly elections and a general election. The NDA formed the government after {formed} of
          the {decided.length} assembly elections. In 2024 the BJP lost its own majority — {ls2024.bjpSeats} seats against {ls19.bjpSeats} in 2019 — and governs through
          its allies, with {ls2024.ndaSeats}. Every seat and vote share here is counted from the Election Commission&apos;s own result pages where the archive holds them.
        </p>
        <div className="s20-stats">
          <div><b>{ls2024.bjpSeats}</b><span>BJP Lok Sabha seats in 2024 ({pct(ls2024.bjpShare)} of the vote); {ls19.bjpSeats} in 2019 ({pct(ls19.bjpShare)})</span></div>
          <div><b>{ls2024.ndaSeats}</b><span>NDA seats of {ls2024.seats} in 2024 — {ls2024.ndaSeats - 272 >= 0 ? `${ls2024.ndaSeats - 272} above` : `${272 - ls2024.ndaSeats} short of`} a majority; {ls19.ndaSeats} in 2019</span></div>
          <div><b>{formed}/{decided.length}</b><span>assembly elections since 2020 after which the NDA formed the government</span></div>
          <div><b>{ndaNow}</b><span>of {now.length} states and UTs with legislatures have an NDA government today, {bjpNow} with a BJP chief minister</span></div>
          <div><b>{bjpSeatsAll.toLocaleString("en-IN")}</b><span>assembly seats won by the BJP in these elections, of {housesAll.toLocaleString("en-IN")} contested</span></div>
          <div><b>{pct(file.turnoutByGender2024.women)}</b><span>of women voted in 2024, against {pct(file.turnoutByGender2024.men)} of men</span></div>
        </div>
      </header>

      <section className="s20-section">
        <h2>Every election, and the world around it</h2>
        <p className="s20-note">
          Each circle is an election, placed by date and by the BJP&apos;s share of the vote; above them, the shocks of the period; below, India&apos;s growth and inflation.
          The economy contracted {g20 ? `${Math.abs(g20.v).toFixed(1)}%` : ""} in 2020 and grew {g21 ? `${g21.v.toFixed(1)}%` : ""} in 2021{avgRecent !== null ? `, then averaged ${avgRecent.toFixed(1)}% a year from 2022` : ""}.
          The chart shows when things happened, not that one caused another.
        </p>
        <Timeline elections={elections} events={file.events} growth={growth} inflation={inflation} />
      </section>

      <section className="s20-section">
        <h2>The 2024 general election</h2>
        <div className="s20-two">
          <div>
            <Hemicycle parties={lsParties} total={ls2024.seats} label="NDA seats in 2024, by party" />
            <p className="s20-note">The NDA&apos;s {ls2024.ndaSeats}: {ls2024.partners.map((p) => `${p.abbr} ${p.won}`).join(", ")}. Majority: 272. Counted from ECI&apos;s 543 seat pages; the alliance is the {ls2024.partners.length}-party pre-poll line-up that won seats.</p>
          </div>
          <div>
            <PairBars max={ls19.ndaSeats} rows={[
              { label: "BJP seats", a: ls19.bjpSeats, b: ls2024.bjpSeats, aLabel: "2019", bLabel: "2024" },
              { label: "NDA seats", a: ls19.ndaSeats, b: ls2024.ndaSeats, aLabel: "2019", bLabel: "2024" },
            ]} />
            <PairBars max={60} unit="%" rows={[
              { label: "BJP share of the vote", a: ls19.bjpShare, b: Number(ls2024.bjpShare.toFixed(2)), aLabel: "2019", bLabel: "2024" },
            ]} />
            <p className="s20-note">2019 as reported; 2024 counted. The BJP lost {ls19.bjpSeats - ls2024.bjpSeats} seats on a vote share {Math.abs(ls19.bjpShare - ls2024.bjpShare).toFixed(1)} points {ls2024.bjpShare < ls19.bjpShare ? "lower" : "higher"} — votes and seats do not move together under first-past-the-post.</p>
          </div>
        </div>
        <h3 className="s20-h3">State by state, 2024</h3>
        <div className="s20-statebars">
          {ls2024.byState.filter((s) => s.seats >= 4).map((s) => (
            <div key={s.state} className="s20-sb">
              <span className="s20-sbname">{s.state}</span>
              <span className="s20-sbtrack">
                <i className="s20-sbbjp" style={{ width: `${(100 * s.bjpSeats) / s.seats}%` }} />
                <i className="s20-sbnda" style={{ width: `${(100 * (s.ndaSeats - s.bjpSeats)) / s.seats}%` }} />
              </span>
              <span className="s20-sbval"><b>{s.bjpSeats}</b>{s.ndaSeats > s.bjpSeats ? `+${s.ndaSeats - s.bjpSeats}` : ""}/{s.seats} · {pct(s.bjpShare)}</span>
            </div>
          ))}
        </div>
        <p className="s20-note"><i className="s20-key s20-sbbjp" /> BJP seats <i className="s20-key s20-sbnda" /> allies&apos; seats, of each state&apos;s total; then the BJP&apos;s vote share. States with four or more seats.</p>
      </section>

      <section className="s20-section">
        <h2>Who governs now</h2>
        <div className="s20-two">
          <TileMap governs={now} latest={latest} />
          <div>
            <p className="s20-note">Each square is a state or union territory, coloured by the alliance of its chief minister today, with the BJP&apos;s vote share at its latest assembly election. {governs ? <>Chief ministers from <a href={governs.source.url} target="_blank" rel="noopener noreferrer">{governs.source.publisher}</a>, checked {new Date(governs.fetchedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.</> : null}</p>
            {best && <p className="s20-note">The BJP&apos;s highest assembly vote share of the period: {pct(best.bjpShare)} in {best.state}, {best.label}.</p>}
          </div>
        </div>
      </section>

      <section className="s20-section">
        <h2>Every assembly election since 2020</h2>
        <div className="s20-tablewrap">
          <table className="s20-table">
            <thead><tr><th>When</th><th>State</th><th>BJP seats</th><th>BJP vote</th><th>NDA seats</th><th>NDA vote</th><th>Government</th></tr></thead>
            <tbody>
              {elections.map((e) => (
                <tr key={e.key}>
                  <td>{e.label}</td>
                  <td>{e.slug ? <a href={`/elections/atlas/${e.slug}`}>{e.state}</a> : e.state}<span className={`s20-basis s20-b-${e.basis}`} title={BASIS[e.basis]}>{e.basis === "counted" ? "ECI" : e.basis === "tally" ? "ECI tally" : "reported"}</span></td>
                  <td><span className="s20-cellbar"><i style={{ width: `${(100 * e.bjpSeats) / e.house}%` }} /></span><b>{e.bjpSeats}</b>/{e.house}</td>
                  <td>{pct(e.bjpShare)}</td>
                  <td>{e.ndaSeats === null ? "—" : e.basis === "reported" ? <><b>{e.ndaSeats}</b> <span className="s20-dim">(reported)</span></> : e.partners.length > 1 ? <><b>{e.ndaSeats}</b> <span className="s20-dim" title={e.partners.join(", ")}>({e.partners.length} parties)</span></> : <span className="s20-dim">BJP alone</span>}</td>
                  <td>{e.partners.length > 1 ? pct(e.ndaShare) : "—"}</td>
                  <td><span className={e.ndaGovernment ? "s20-yes" : e.ndaGovernment === false ? "s20-no" : ""}>{e.ndaGovernment ? "NDA" : e.ndaGovernment === false ? "Opposition" : "—"}</span>{(e.governmentNote || e.allianceNote || e.note) && <span className="s20-fn" title={[e.governmentNote, e.allianceNote, e.note].filter(Boolean).join(" ")}> ⓘ</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="s20-notes">
          {elections.filter((e) => e.governmentNote || e.allianceNote || e.note).map((e) => <li key={e.key}><b>{e.state}, {e.label}:</b> {[e.governmentNote, e.allianceNote, e.note].filter(Boolean).join(" ")}</li>)}
        </ul>
        <p className="s20-note">
          <b>ECI</b> — counted from every seat page, NOTA included in the vote. <b>ECI tally</b> — the archive holds too few seat pages for December 2023, so seats are ECI&apos;s own party tally and vote shares are left blank rather than estimated.
          <b> Reported</b> — Bihar 2020 and the 2021 round predate the archive; each figure is checked against two outlets ({elections.filter((e) => e.basis === "reported").flatMap((e) => e.sources).slice(0, 2).map((s, i) => <span key={s.url}>{i ? ", " : ""}<a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a></span>)} and others). NDA columns count the BJP&apos;s pre-poll alliance; where the line-up could not be confirmed the BJP is shown alone.
        </p>
      </section>

      <section className="s20-section">
        <h2>The Rajya Sabha</h2>
        <ol className="s20-rs">
          {file.rajyaSabha.map((r) => (
            <li key={r.date}>
              <b>{r.date.length === 4 ? r.date : new Date(`${r.date}-01`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</b>
              <span>{r.text}</span>
              {r.nda && r.majority ? <span className="s20-rsbar"><i style={{ width: `${(100 * r.nda) / 245}%` }} /><em style={{ left: `${(100 * r.majority) / 245}%` }} /></span> : null}
              <span className="s20-src">{r.sources.map((u, i) => <a key={u} href={u} target="_blank" rel="noopener noreferrer">{i ? " · " : ""}{new URL(u).hostname.replace(/^www\./, "")}</a>)}</span>
            </li>
          ))}
        </ol>
        <p className="s20-note">The Rajya Sabha is elected by state legislators, so its arithmetic follows the assembly results above with a lag of up to six years. Strength changes with every biennial round and by-election; figures are as reported at each date.</p>
      </section>

      <section className="s20-section">
        <h2>Who voted</h2>
        <div className="s20-two">
          <div>
            <h3 className="s20-h3">Turnout, 2024: women outvoted men</h3>
            <PairBars same max={100} unit="%" rows={[{ label: "Share of registered voters who voted", a: file.turnoutByGender2024.women, b: file.turnoutByGender2024.men, aLabel: "Women", bLabel: "Men" }]} />
            <p className="s20-note">{file.turnoutByGender2024.note} Election Commission&apos;s <a href={file.turnoutByGender2024.sources[0]} target="_blank" rel="noopener noreferrer">Atlas 2024</a>.</p>
          </div>
          {demo && (
            <div>
              <h3 className="s20-h3">The BJP&apos;s vote among women and men, 2024</h3>
              {demo.groups.map((g) => (
                <PairBars same key={g.dimension} max={60} unit="%" rows={[{ label: `Voted BJP, by ${g.dimension.toLowerCase()}`, a: g.rows[0]!.bjp, b: g.rows[1]!.bjp, aLabel: g.rows[0]!.group, bLabel: g.rows[1]!.group }]} />
              ))}
              <p className="s20-note">From the {demo.survey}, as reported by <a href={demo.url} target="_blank" rel="noopener noreferrer">Al Jazeera</a>. A sample survey, not a count: a one-point gap is within its margin of error.</p>
              {demo.pending && <p className="s20-pending"><b>Age and youth:</b> {demo.pending}</p>}
            </div>
          )}
        </div>
      </section>

      {L && (
        <section className="s20-section">
          <h2>What voters said, 2024</h2>
          <p className="s20-note">
            Lokniti-CSDS asked {L.sample.toLocaleString("en-IN")} voters after the 2024 election. As a check on the sample: {L.voteCheck.bjp}% of them said they voted BJP, against the {pct(ls2024.bjpShare)} counted.
          </p>
          <h3 className="s20-h3">&ldquo;{L.anotherChance.question}&rdquo;</h3>
          <div className="s20-stack" role="img" aria-label={`Yes ${L.anotherChance.yes}%, no ${L.anotherChance.no}%, don't know ${L.anotherChance.dontKnow}%`}>
            <i className="s20-st-yes" style={{ width: `${L.anotherChance.yes}%` }}><span>Yes {L.anotherChance.yes}%</span></i>
            <i className="s20-st-dk" style={{ width: `${L.anotherChance.dontKnow}%` }}><span>{L.anotherChance.dontKnow}%</span></i>
            <i className="s20-st-no" style={{ width: `${L.anotherChance.no}%` }}><span>No {L.anotherChance.no}%</span></i>
          </div>
          <div className="s20-two s20-reasons">
            {[{ t: "Why another chance", r: L.reasonsYes, cls: "s20-st-yes" }, { t: "Why not", r: L.reasonsNo, cls: "s20-st-no" }].map(({ t, r, cls }) => (
              <div key={t}>
                <h3 className="s20-h3">{t} <span className="s20-dim">— {r.base.toLowerCase()}, page {r.page}</span></h3>
                {r.rows.map(([label, v]) => (
                  <div key={label} className="s20-reason"><span>{label}</span><span className="s20-sbtrack"><i className={cls} style={{ width: `${(v / 32) * 100}%` }} /></span><b>{v.toFixed(1)}%</b></div>
                ))}
              </div>
            ))}
          </div>
          <p className="s20-note">From Lokniti-CSDS, <a href={L.url} target="_blank" rel="noopener noreferrer">{L.title}</a> — the Internet Archive&apos;s copy, as Lokniti has since taken the file down; committed to this repository at {L.pdf} and checked against its pages on every build. A sample survey: reasons are each respondent&apos;s single main answer, as coded by Lokniti.</p>
        </section>
      )}

      <section className="s20-section">
        <h2>What this page does not claim</h2>
        <dl className="s20-method">
          <div><dt>That events decided elections</dt><dd>The timeline puts elections beside wars, the pandemic and the economy because they happened in the same years. Which mattered to voters, if any, is a question for surveys, not a chart.</dd></div>
          <div><dt>That vote shares are official</dt><dd>Counted vote shares are sums over the seat pages read, NOTA included; ECI&apos;s own published percentages can differ by a few hundredths.</dd></div>
          <div><dt>That an alliance is fixed</dt><dd>Partners came and went in this period — the JD(U) left the NDA in 2022 and returned in 2024. Each election uses the line-up that fought it.</dd></div>
          <div><dt>That surveys are counts</dt><dd>Gender and age splits come only from sample surveys. They are shown with their source and the caution they need, and a split is shown only when a primary copy has been read.</dd></div>
        </dl>
        <p className="s20-note">Data checked {file.accessed}. Seat pages: the Election Commission of India&apos;s results portal, as archived by the Internet Archive. Economy: World Bank, World Development Indicators.</p>
      </section>
    </main>
  );
}
