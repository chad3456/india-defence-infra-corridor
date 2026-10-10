import { loadProtest, type ProtestAccount, type ProtestRecord, type Voice } from "@/lib/protest";
import { Eyebrow, Standfirst, Sources, WhatThisCannotSay } from "@/components/stories/Kit";
import { ProtestMap, ProtestMapLegend } from "@/components/protests/ProtestMap";

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
          { q: "Whether the detentions were lawful", a: <>That turns on the prohibitory order, how detainees were held and for how long, and is for courts to decide. Bar associations have asked the Chief Justice to intervene; no court ruling on 10 October had been reported when this record was read.</> },
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
