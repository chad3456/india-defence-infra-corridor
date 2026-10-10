import { loadProtest, type ProtestAccount, type ProtestRecord, type Voice } from "@/lib/protest";
import { Eyebrow, Standfirst, Sources, WhatThisCannotSay } from "@/components/stories/Kit";
import { ProtestMap, ProtestMapLegend } from "@/components/protests/ProtestMap";
import { Frame, FigureChart, HourlyChart, PublisherBars, RestrictionGantt, ThemeMultiples } from "@/components/protests/ProtestCharts";
import { buildCharts, THEMES } from "@/lib/protest-charts";

/**
 * Delhi, 10 October 2026: the Cockroach Janta Party protest and the police
 * operation that prevented it.
 *
 * The page is a register of attributed accounts, not an account. Police and
 * government statements, the organisers', the opposition's and those of
 * rights groups, lawyers and press bodies sit in separate columns in their own
 * words, each linked to where it was reported. The page does not rule on
 * whether the operation was lawful, proportionate, or good for democracy —
 * those are the questions the accounts disagree on, and courts, not this
 * site, decide the first two.
 *
 * Every number is somebody's number and says whose. The coverage wire is
 * refreshed every half hour by .github/workflows/protest-news.yml; headlines
 * are context, never data.
 */

export const metadata = {
  title: "Delhi, 10 October 2026: the protest and the police operation · Bharat Tracker",
  description:
    "The Cockroach Janta Party protest called for Jantar Mantar on 10 October 2026 and the police operation that stopped it: where detentions were reported, "
    + "the restrictions in force, detention counts by source, the police's and government's stated reasons beside the organisers', opposition's and rights groups', "
    + "and a coverage wire refreshed every half hour.",
};

const VOICES: Array<{ voice: Voice; title: string; note: string }> = [
  { voice: "police", title: "Delhi Police", note: "The force's stated reasons, as it gave them or as they were reported." },
  { voice: "government", title: "The government and ruling party", note: "Statements from the BJP and from officials." },
  { voice: "organisers", title: "The organisers", note: "The Cockroach Janta Party's statements and claims." },
  { voice: "opposition", title: "Opposition parties", note: "Statements by opposition leaders." },
  { voice: "courts", title: "The courts", note: "What judges said or decided, as reported." },
  { voice: "rights", title: "Rights groups, lawyers and press bodies", note: "Statements by civil-society, legal and journalists' organisations." },
];

const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const istTime = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

function Cites({ ids, rec }: { ids: string[]; rec: ProtestRecord }) {
  return (
    <span className="pr-cites">
      {ids.map((id, i) => {
        const s = rec.sources[id]!;
        return <span key={id}>{i > 0 ? " · " : ""}<a href={s.url} target="_blank" rel="noopener noreferrer" title={s.title}>{s.publisher}</a></span>;
      })}
    </span>
  );
}

function Account({ a, rec }: { a: ProtestAccount; rec: ProtestRecord }) {
  return (
    <li className="pr-account">
      <p className="pr-who"><b>{a.who}</b> · {day(a.date)}</p>
      <p>{a.text}</p>
      <Cites ids={a.sources} rec={rec} />
    </li>
  );
}

export default function DelhiProtestPage() {
  const { record: rec, wire } = loadProtest();
  const central = rec.places.filter((p) => p.lon > 77.17 && p.lon < 77.27 && p.lat > 28.585 && p.lat < 28.655);
  const charts = wire ? buildCharts(wire) : null;
  // IST instants for the restrictions whose times were reported.
  const ist = (d: string, hh = 0, mm = 0) => Date.parse(`${d}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+05:30`);
  const gantt = [
    { label: "Section 163 prohibitory order", start: ist("2026-10-02"), end: null, note: "In force from the first protests of the campaign; the police said on 3 and 9 October it remained in force." },
    { label: "Mobile data suspended, 4 km", start: ist("2026-10-09", 22), end: ist("2026-10-10", 22), note: "Within 4 km of the Janpath–Kartavya Path crossing, by the Union Home Secretary's order." },
    { label: "45 metro stations closed", start: ist("2026-10-10"), end: ist("2026-10-10", 22), note: "Start time not reported, so drawn from midnight; the Namo Bharat closures ran until 10 pm." },
    { label: "Permission refused for 11 October", start: ist("2026-10-10", 21), end: ist("2026-10-11", 23, 59), note: "Delhi Police refused permission for the resumed march and issued a traffic advisory." },
  ];
  const counted = rec.counts.filter((c) => c.figure !== null).sort((a, b) => a.figure! - b.figure!);
  const wireDays = new Map<string, NonNullable<typeof wire>["items"]>();
  for (const it of wire?.items.slice(0, 60) ?? []) {
    const d = new Date(it.publishedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" });
    wireDays.set(d, [...(wireDays.get(d) ?? []), it]);
  }

  return (
    <div className="pr">
      <header className="pt-10">
        <Eyebrow tone="hot">protest tracker · Delhi · 10 October 2026{wire ? ` · wire updated ${istTime(wire.updatedAt)} IST` : ""}</Eyebrow>
        <h1 className="story-display mt-4 max-w-[20ch] text-[34px] sm:text-[46px] lg:text-[54px]">
          A Protest Called, a Permission Refused, a City Centre Closed.
        </h1>
        <Standfirst>
          The Cockroach Janta Party called a protest at Jantar Mantar for 10 October to demand that the Chief Election Commissioner resign
          over the revision of voter rolls. Delhi Police refused permission, saying the request came late, and with prohibitory orders in force
          detained people across the city — at the airport, in Connaught Place, on the road from the Supreme Court. Here is what each side
          says, in its own words and with its source, and what everyone&rsquo;s reports agree on: where, when, and under which orders.
        </Standfirst>
      </header>


      {/* ── the day in charts ── */}
      {charts && (
        <section className="pr-section">
          <Eyebrow>the day in charts · from {charts.totalItems} headlines on the wire</Eyebrow>
          <p className="pr-lede">Everything charted here counts headlines — what the news index returned for the wire&rsquo;s searches — not people, events or opinions. A spike says outlets published a lot in that hour. Hover any bar or point for the headline behind it.</p>
          <div className="pc-grid">
            <Frame title="Headlines per hour, IST" note="The news cycle: quiet until the evening before, then a surge as detentions began on the morning of the 10th.">
              <HourlyChart hours={charts.hours} marks={[{ t: ist("2026-10-09", 22), label: "mobile data off" }, { t: ist("2026-10-10", 22), label: "mobile data back" }]} />
            </Frame>
            <Frame title="The detention figure, as headlines stated it" note={<>Each point is one headline that put a number on the detained, placed at the time it was published. They count different things — a street, a group of students, the whole city — so the rise shows the figure reported growing through the day, not a measured trend. Log scale. No figure from Delhi Police itself was found.</>}>
              <FigureChart figures={charts.figures} from={charts.from} to={charts.to} />
            </Frame>
          </div>
          <Frame title="What the headlines named, hour by hour" note="Each panel counts headlines using the words listed under it; a headline can count in several. Each panel has its own vertical scale.">
            <ThemeMultiples hours={charts.hours} themes={THEMES.map((t) => ({ id: t.id, label: t.label, words: t.words }))} />
          </Frame>
          <div className="pc-grid">
            <Frame title="The restrictions in force" note="From the record above. Hover a bar for its source's detail.">
              <RestrictionGantt rows={gantt} from={ist("2026-10-02")} to={ist("2026-10-12")} />
            </Frame>
            <Frame title={`Who published: the ${Math.min(15, charts.publishers.length)} busiest of ${charts.publishers.length} outlets`} note="Headlines on the wire by outlet. A measure of what the index carries and ranks, not of how much each outlet wrote.">
              <PublisherBars rows={charts.publishers.slice(0, 15)} total={charts.totalItems} />
            </Frame>
          </div>
        </section>
      )}

      {/* ── the numbers ── */}
      <section className="pr-section">
        <Eyebrow>how many were detained — by whose count</Eyebrow>
        <div className="pr-grid2">
          <div className="pr-card">
            <ol className="pr-counts">
              {counted.map((c) => (
                <li key={`${c.who}-${c.label}`}>
                  <b>{c.label}</b>
                  <span>{c.scope} — <em>{c.who}</em> <Cites ids={c.sources} rec={rec} /></span>
                </li>
              ))}
              {rec.counts.filter((c) => c.figure === null).map((c) => (
                <li key={`${c.who}-${c.label}`} className="pr-count-words">
                  <b>{c.label}</b><span>{c.scope} — <em>{c.who}</em> <Cites ids={c.sources} rec={rec} /></span>
                </li>
              ))}
            </ol>
            <p className="pr-note"><b>{rec.noOfficialCount}</b> The counts measure different things — one street, one morning, the capital, the country — so they are not alternative estimates of one number, and none is this site&rsquo;s.</p>
          </div>
          <div className="pr-card">
            <h3 className="pr-h3">The restrictions in force</h3>
            <ul className="pr-restrictions">
              {rec.restrictions.map((r) => (
                <li key={r.id}><b>{r.what}</b><p>{r.detail}</p><Cites ids={r.sources} rec={rec} /></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── the map ── */}
      <section className="pr-section">
        <Eyebrow>where</Eyebrow>
        <div className="pr-grid2">
          <figure className="pr-card pr-fig">
            <figcaption className="pr-h3">Delhi</figcaption>
            <ProtestMap places={rec.places} view="delhi" />
          </figure>
          <figure className="pr-card pr-fig">
            <figcaption className="pr-h3">Central New Delhi</figcaption>
            <ProtestMap places={central} view="central" />
          </figure>
        </div>
        <ProtestMapLegend />
        <ul className="pr-places">
          {rec.places.map((p) => <li key={p.id}><b>{p.name}.</b> {p.summary} <Cites ids={p.sources} rec={rec} /></li>)}
        </ul>
        <p className="pr-note">Schematic: positions are the landmarks&rsquo; own, placed by this site; the reports do not give coordinates. The holding centres the reports describe, including stadiums, are not named in any report read for this record, so they are not mapped.</p>
      </section>

      {/* ── the accounts ── */}
      <section className="pr-section">
        <Eyebrow>who says what</Eyebrow>
        <p className="pr-lede">Each column is one side&rsquo;s account, in its own words where they were reported. They are kept apart because they disagree — on whether the protest was a threat to order or the exercise of a right — and this page does not settle that for the reader.</p>
        <div className="pr-voices">
          {VOICES.map((v) => (
            <section key={v.voice} className={`pr-card pr-voice ${v.voice}`}>
              <h3 className="pr-h3">{v.title}</h3>
              <p className="pr-note">{v.note}</p>
              <ul>{rec.accounts.filter((a) => a.voice === v.voice).map((a, i) => <Account key={i} a={a} rec={rec} />)}</ul>
            </section>
          ))}
        </div>
      </section>

      {/* ── the timeline ── */}
      <section className="pr-section">
        <Eyebrow>how it built up</Eyebrow>
        <ol className="pr-timeline">
          {rec.timeline.map((t, i) => (
            <li key={i}>
              <span className="pr-when">{day(t.date)}{t.time ? `, ${t.time}` : ""}</span>
              <p>{t.what} <Cites ids={t.sources} rec={rec} /></p>
            </li>
          ))}
        </ol>
        <p className="pr-note">{rec.demand}</p>
      </section>

      {/* ── the wire ── */}
      <section className="pr-section">
        <Eyebrow>coverage wire · refreshed every 30 minutes</Eyebrow>
        {!wire ? (
          <p className="pr-card pr-note">Awaiting the first run of the coverage wire. It searches the news index every half hour for headlines naming the protest and lists them here with their publishers.</p>
        ) : (
          <div className="pr-card">
            <p className="pr-note">
              {wire.items.length} headlines naming the protest, newest first; last searched {istTime(wire.updatedAt)} IST. Headlines are what outlets published, not
              verified facts, and the count is what the index returned for these searches — not a measure of how much was written:{" "}
              {wire.queries.map((q) => `"${q.q}" (${q.kept} of ${q.returned})`).join(", ")}.
            </p>
            {[...wireDays.entries()].map(([d, items]) => (
              <div key={d} className="pr-wire-day">
                <h4>{d}</h4>
                <ul className="pr-wire">
                  {items.map((it) => (
                    <li key={`${it.publisher}|${it.title}`}>
                      <time>{new Date(it.publishedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false })}</time>
                      <a href={it.url} target="_blank" rel="noopener noreferrer">{it.title}</a>
                      <span>{it.publisher}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <WhatThisCannotSay
        items={[
          { q: "Whether the detentions were lawful", a: <>That turns on the prohibitory order, how detainees were held and for how long, and is for courts to decide. On 10 October the Chief Justice asked for detained lawyers to be released, and a Delhi court rejected one detainee&rsquo;s plea for an FIR against the officers who held her; neither is a ruling on the operation as a whole.</> },
          { q: "Whether the operation kept order or suppressed a protest", a: <>That is the disagreement itself. The police and the ruling party describe a ban on an unpermitted gathering enforced to keep public order; the organisers, opposition and rights groups describe the prevention of a peaceful protest. Both are recorded above; neither is this site&rsquo;s view.</> },
          { q: "How many people were detained", a: <>No official count was found. The figures above range from one street&rsquo;s to the organisers&rsquo; nationwide claim, and measure different things.</> },
          { q: "Whether violence was planned", a: <>The BJP&rsquo;s spokesperson accused protesters of planning to provoke arson and violence. No report read for this record documented arson or violence on 10 October; the accusation is recorded as a claim.</> },
          { q: "Who was detained", a: <>Only public figures named in reports appear here. Private individuals detained are not named, and will not be.</> },
          { q: "Everything that was reported", a: <>The record was assembled from search results on the day; the full articles could not be fetched from the editing environment. The wire adds headlines as they appear, but a headline is not a fact until a second source confirms it.</> },
        ]}
      />

      <Sources>
        Record read {rec.accessed} from: {Object.values(rec.sources).map((s, i) => <span key={s.url}>{i > 0 ? "; " : ""}<a href={s.url}>{s.publisher}</a></span>)}.
        Boundary: this site&rsquo;s state outlines. Wire: {wire?.source ?? "Google News RSS search"}. Times are India Standard Time.
      </Sources>
    </div>
  );
}
