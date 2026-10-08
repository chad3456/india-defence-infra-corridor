import { loadInternet } from "@/lib/internet";
import { Chart, MapDefs, INDIA } from "@/components/internet/Charts";
import { TipLayer } from "@/components/internet/TipLayer";
import type { ChartView, Cite } from "@/lib/internet-shared";

/**
 * Signal and sovereignty: the state of the internet, country by country, and
 * the case that a satellite network owned by one foreign company is a
 * question about who governs a country's communications.
 *
 * Every chart is computed in lib/internet.ts from committed data; every case
 * study and hand-entered count is in data/internet/curated.json with the page
 * that states it. The verdict at the end is an editorial judgement and is
 * labelled as one.
 */

export const metadata = {
  title: "Signal and sovereignty · Bharat Tracker",
  description:
    "Twenty charts on the state of the internet worldwide and in India — who is online, how fast, what a gigabyte costs, "
    + "where the cables land, who shuts it off — and seven case studies on why Starlink is a sovereignty question.",
};

const PARTS: Array<{ id: ChartView["part"]; n: string; title: string; lede: string }> = [
  { id: "access", n: "I", title: "Who gets online", lede: "Most of the world now uses the internet. The share that does not is concentrated in a handful of populous, poorer countries, and India, for all its progress, is one of them." },
  { id: "speed", n: "II", title: "How fast", lede: "Speed is measured, not claimed: millions of speed tests a quarter, published by Ookla as open map tiles and aggregated here by country. India's story splits in two — a fast phone network, and a thin wired one." },
  { id: "price", n: "III", title: "What it costs", lede: "The ITU prices the same basket of data in every country, every year, and records the exact plan it priced. India's data is among the cheapest in the world in dollars; what matters for access is the price against income." },
  { id: "plumbing", n: "IV", title: "The plumbing", lede: "The internet is physical: servers in buildings, exchange points where networks swap traffic, and cables on the sea floor. Where these sit decides whose law applies to the traffic." },
  { id: "control", n: "V", title: "Who holds the switch", lede: "Sovereignty over the internet is usually exercised by switching it off. India recorded more internet shutdowns than any other country every year from 2018 to 2023, and has been second only to Myanmar since." },
  { id: "sky", n: "VI", title: "The sky has an owner", lede: "A new layer is being added above all of this, and most of it belongs to one company. A Starlink terminal needs no cable, no tower and no local operator — only a beam the company chooses to switch on." },
];

function Cites({ cite }: { cite: Cite[] }) {
  return (
    <span className="ie-cites">
      {cite.map((c, i) => (
        <a key={c.url + i} href={c.url} target="_blank" rel="noopener noreferrer" title={`${c.title} — accessed ${c.accessed}`}>{c.publisher}</a>
      ))}
    </span>
  );
}

export default function InternetPage() {
  const v = loadInternet();
  const { w, h, shapes } = v.map;
  const cur = v.curated;
  const lastShut = cur.shutdowns.years[cur.shutdowns.years.length - 1];
  return (
    <div className="ie-root">
      <MapDefs shapes={shapes} />
      <TipLayer />

      <header className="ie-hero">
        <svg className="ie-orbits" viewBox="0 0 1200 420" aria-hidden preserveAspectRatio="xMidYMid slice">
          {Array.from({ length: 9 }, (_, i) => (
            <ellipse key={i} cx="600" cy="520" rx={300 + i * 70} ry={150 + i * 34} className="ie-orbit" style={{ animationDelay: `${-i * 2.3}s` }} />
          ))}
          {Array.from({ length: 70 }, (_, i) => {
            const a = (i * 137.5 * Math.PI) / 180, r = 320 + (i % 9) * 70;
            return <circle key={i} cx={600 + Math.cos(a) * r} cy={520 + Math.sin(a) * r * 0.48} r={i % 7 === 0 ? 2.2 : 1.3} className={i % 3 ? "ie-sat" : "ie-sat sl"} />;
          })}
        </svg>
        <p className="ie-kicker">A visual essay · the internet, country by country</p>
        <h1>Signal <em>and</em> sovereignty</h1>
        <p className="ie-stand">
          Twenty charts on the state of the internet — who is online, how fast, what a gigabyte costs, where the cables land and who switches it off —
          and the case, made from documented events rather than fear, that a network in the sky owned by one foreign company is a question about who governs a country.
        </p>
        {v.headline.length > 0 && (
          <dl className="ie-head">
            {v.headline.map((s) => (
              <div key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd><small>{s.sub}</small></div>
            ))}
          </dl>
        )}
        <nav className="ie-toc" aria-label="Parts">
          {PARTS.map((p) => <a key={p.id} href={`#part-${p.id}`}><b>{p.n}</b> {p.title}</a>)}
          <a href="#cases"><b>VII</b> Seven cases</a>
          <a href="#india"><b>VIII</b> India's answer</a>
          <a href="#sources"><b>·</b> Sources</a>
        </nav>
      </header>

      <main className="ie-body">
        {!v.present && (
          <div className="ie-awaiting ie-wide"><b>The data is on its way</b><span>The sources are read by scheduled jobs that have not run yet. The case studies below are hand-entered and cited.</span></div>
        )}

        {PARTS.map((p) => (
          <section key={p.id} id={`part-${p.id}`} className={`ie-part${p.id === "sky" ? " ie-sky" : ""}`}>
            <div className="ie-part-head">
              <span className="ie-part-n">{p.n}</span>
              <h2>{p.title}</h2>
              <p>{p.lede}</p>
            </div>
            <div className="ie-grid-charts">
              {v.charts.filter((c) => c.part === p.id).map((c) => <Chart key={c.id} c={c} shapes={shapes} w={w} h={h} />)}
            </div>
            {p.id === "control" && (
              <p className="ie-aside">
                Hold that thought. Every one of those {lastShut?.india ?? ""} shutdowns in {lastShut?.year} worked because Indian internet traffic runs through
                operators licensed in India, on towers and cables in India. A satellite terminal pointed at a foreign constellation does not. That is the whole of the sovereignty argument in one sentence — and why it cuts both ways.
              </p>
            )}
          </section>
        ))}

        <section id="cases" className="ie-part ie-sky ie-cases">
          <div className="ie-part-head">
            <span className="ie-part-n">VII</span>
            <h2>Seven cases</h2>
            <p>What has actually happened, in the order it happened. Each card says whose word the account rests on — a company statement is not a court finding, and an anonymous officer is not a forensic report.</p>
          </div>
          <figure className="ie-mapfig ie-casemap">
            <svg viewBox={`0 0 ${w} ${h}`} className="ie-map" role="img" aria-label="Where the seven cases happened">
              {shapes.map((s, i) => <use key={`${s.iso3}-${i}`} href={`#ie-c-${s.iso3}-${i}`} fill={s.iso3 === "IND" ? "#3a2a1c" : "#1a2240"} className={s.iso3 === "IND" ? "ie-in" : undefined} />)}
              {v.cases.filter((c) => c.x !== null).map((c, i) => (
                <g key={c.id} className="ie-pin" data-tip={`${i + 1}. ${c.title} — ${c.place}, ${c.date}`}>
                  <a href={`#case-${c.id}`}>
                    <circle cx={c.x!} cy={c.y!} r={10} />
                    <text x={c.x!} y={c.y! + 4}>{i + 1}</text>
                  </a>
                </g>
              ))}
            </svg>
          </figure>
          <ol className="ie-casecards">
            {v.cases.map((c, i) => (
              <li key={c.id} id={`case-${c.id}`} className="ie-case">
                <div className="ie-case-top"><span className="ie-case-n">{i + 1}</span><span>{c.date}</span><span>{c.place}</span></div>
                <h3>{c.title}</h3>
                <p>{c.what}</p>
                <p className="ie-case-why"><b>Why it matters.</b> {c.why}</p>
                <p className="ie-case-src"><span className="ie-claimant">On whose word: {c.claimant}</span> <Cites cite={c.cite} /></p>
              </li>
            ))}
          </ol>
        </section>

        <section id="india" className="ie-part">
          <div className="ie-part-head">
            <span className="ie-part-n">VIII</span>
            <h2>India's answer: let it in, on conditions</h2>
            <p>India did not ban Starlink. It licensed it, after the company agreed to security conditions written for exactly the cases above. Each condition below is matched to the risk it addresses.</p>
          </div>
          <ol className="ie-timeline">
            {cur.indiaConditions.granted.map((g) => (
              <li key={g.date}><b>{g.date}</b><span>{g.what} <Cites cite={g.cite} /></span></li>
            ))}
          </ol>
          <div className="ie-conds">
            {cur.indiaConditions.conditions.map((c) => (
              <article key={c.rule} className="ie-cond">
                <h4>{c.rule}</h4>
                <p>{c.why}</p>
                <Cites cite={c.cite} />
              </article>
            ))}
          </div>

          <div className="ie-verdict">
            <p className="ie-verdict-label">Editorial judgement — not a measurement</p>
            <h3>Is Starlink a threat to India's sovereignty?</h3>
            <div className="ie-verdict-cols">
              <div>
                <h4>The case that it is</h4>
                <ul>
                  <li><b>The switch is abroad.</b> Ukraine showed that coverage over a war zone is decided by the operator. Licence conditions bind service inside India; they cannot compel a US company to keep beams on over a border India is fighting on.</li>
                  <li><b>Unlicensed terminals work where beams reach.</b> Iran, Myanmar, the Andaman Sea and, on the Army's account, Manipur: hardware bought next door works wherever the company does not geofence it.</li>
                  <li><b>Concentration.</b> One company operates most of the world's working satellites. There is no second supplier at that scale yet, which is what dependence means.</li>
                </ul>
              </div>
              <div>
                <h4>The strongest case against</h4>
                <ul>
                  <li><b>States do have leverage — when the operator has assets inside.</b> Brazil collected its fines from Starlink's accounts; Starlink then obeyed. India's licence requires Indian gateways, interception and terminal location, which is the same leverage written in advance.</li>
                  <li><b>The company has switched off misuse when asked.</b> 2,500 kits at Myanmar's scam compounds; Russian terminals in Ukraine. The remedy works — the dependence is on it being applied.</li>
                  <li><b>Scale.</b> Starlink claims about 12 million customers worldwide; India alone has hundreds of millions of people online through its own operators and the cables in chart 16. Satellite broadband is a complement in India, not a replacement, for now.</li>
                </ul>
              </div>
            </div>
            <p className="ie-verdict-bottom">
              <b>Our reading:</b> the threat is real but narrow. In peacetime India's licence conditions answer most of it. The residual risk is the one no licence can reach: in a conflict, whether satellites over India are on, off or serving the other side is decided outside India. That argues for a domestic or allied alternative — not for keeping the service out.
            </p>
          </div>
        </section>

        <section id="sources" className="ie-part ie-sources">
          <div className="ie-part-head">
            <span className="ie-part-n">·</span>
            <h2>Sources and method</h2>
            <p>Data last read {v.generatedAt ? new Date(v.generatedAt).toISOString().slice(0, 10) : "—"}. Every chart names its source; arithmetic on published figures is marked <b>Derived</b> where it is drawn.</p>
          </div>
          <ul className="ie-srclist">
            {v.sources.map((s) => (
              <li key={s.name}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a> — {s.what}{s.licence ? ` (${s.licence})` : ""}</li>
            ))}
          </ul>
          <h3 className="ie-h3">Shutdown counts, year by year</h3>
          <ul className="ie-srclist">
            {cur.shutdowns.years.map((y) => (
              <li key={y.year}><b>{y.year}</b>: {y.global} worldwide in {y.countries} countries, India {y.india}{y.note ? `. ${y.note}` : ""} <Cites cite={y.cite} /></li>
            ))}
          </ul>
          <h3 className="ie-h3">Starlink subscriber claims</h3>
          <ul className="ie-srclist">
            {cur.starlinkSubscribers.map((s) => (
              <li key={s.date}><b>{s.date}</b>: {(s.subscribers / 1e6).toFixed(0)} million{ s.countries ? `, ${s.countries}+ countries` : ""} <Cites cite={s.cite} /></li>
            ))}
          </ul>
          <p className="ie-method">
            Maps draw borders as India does (Natural Earth's India view). Speeds are means of Ookla's tests aggregated by this site, not Ookla's published index.
            Countries with too few tests, or with no recent figure, are left grey rather than estimated. <span style={{ color: INDIA }}>Saffron</span> marks India in every chart.
          </p>
        </section>
      </main>
    </div>
  );
}
