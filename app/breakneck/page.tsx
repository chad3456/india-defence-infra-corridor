import { loadBreakneck, fmt, cite, show, type BkFigure, type ChapterId } from "@/lib/breakneck";
import { Bars, Big, Calendar, Card, Dots, Grid, Lifelines, Line, Phones, Pictos, Squares } from "@/components/breakneck/Viz";
import { Flashcards, type Flashcard } from "@/components/breakneck/Flashcards";

/**
 * Breakneck, by the numbers: a visual study guide to Dan Wang's *Breakneck:
 * China's Quest to Engineer the Future* (2025).
 *
 * Every figure drawn here is one the book prints, found in the book's text by
 * scripts/etl/connectors/breakneck-book.ts and cited to its page. The chapter
 * summaries, takeaways and labels are this site's own words. Arithmetic on the
 * book's numbers is marked "Derived" where it appears.
 */

export const metadata = {
  title: "Breakneck, by the numbers · Bharat Tracker",
  description:
    "A visual study guide to Dan Wang's Breakneck: the engineering state against the lawyerly society, chapter by chapter — "
    + "189 figures from the book, each checked against its text and cited to the page, drawn as charts, with flashcards to test yourself.",
};

const sv = (f: BkFigure, key: string): number => {
  const hit = f.series?.find((s) => s.key === key);
  if (!hit) throw new Error(`breakneck: ${f.id} has no series value "${key}"`);
  return hit.value;
};
const m = (v: number) => `${(v / 1e6).toLocaleString("en-US", { maximumFractionDigits: 1 })}m`;

interface ChapterText { argument: string; remember: string[]; pushback: string }

/** This site's summaries — paraphrase, not the book's prose. */
const TEXT: Record<Exclude<ChapterId, "intro">, ChapterText> = {
  c1: {
    argument: "Who runs a country shapes what it can do. China's leaders were trained as engineers and treat problems as things to build or to control; America's are trained as lawyers and treat them as things to deliberate, regulate and litigate.",
    remember: [
      "The engineering state is good at physical things — roads, rail, power, factories — and dangerous when it treats people as quantities to be managed.",
      "The lawyerly society began as a necessary corrective to the excesses of the 1960s; its two pathologies now are process valued over outcomes, and rules that serve the well-off.",
      "In China the decade you were born in could decide whether you met a famine or a fortune — the engineering state moves in lurches.",
    ],
    pushback: "The book does not want fewer lawyers so much as more engineers beside them: checks and balances, it says, are fundamental to America's success, and courts are the last hope against an abusive state.",
  },
  c2: {
    argument: "Even China's poorer provinces have better infrastructure than America's richest states. Building big has delivered growth, mobility and pride — and also debt, vanity projects, displacement and environmental damage.",
    remember: [
      "Guizhou, among China's poorest provinces, compressed a century of American-style infrastructure into two decades.",
      "China builds cheaply because of standard designs and practised project management; America pays several times more for the same thing, when it builds at all.",
      "China is stingy with welfare and lavish with concrete: it spends on supply, not on households.",
      "The cost shows in local debt, in airports with almost no flights, in resettlement, and in schools that collapsed in an earthquake.",
    ],
    pushback: "Its own verdict is symmetric: China would be better off building less and building better, while the United States needs to build far more.",
  },
  c3: {
    argument: "Technology is not only tools and blueprints but process knowledge — skill that lives in a workforce. Shenzhen accumulated it making iPhones for Apple; America lost it when manufacturing left.",
    remember: [
      "China's share of the iPhone's value rose as its suppliers learned by doing, from assembly to components.",
      "Every closed factory is a lost community of engineering practice; that is the deeper cost of offshoring.",
      "China's leaders want to make everything and never deindustrialise; manufacturing is a far larger share of its economy than of rich countries'.",
      "China is still weak in basic science, chips and aircraft engines.",
    ],
    pushback: "The book doubts that Beijing's planning deserves the credit: subsidised firms show lower productivity growth, and the winners — BYD, the Shenzhen ecosystem — were pushed by competition, including from Tesla.",
  },
  c4: {
    argument: "The one-child policy was the engineering state's worst work: a missile scientist's straight-line projections turned into quotas, enforced on rural women with sterilisations and abortions — after fertility had already fallen.",
    remember: [
      "Song Jian's model projected billions more people and an 'optimal' population that China is now on track to reach by 2100 — by collapse, not design.",
      "Fertility had already fallen most of the way before the policy began; growth, cities and schooling did most of the work.",
      "Quotas made the violence systematic: sterilisation and abortion campaigns, missing girls, a lasting surplus of men.",
      "Now the state pushes the other way, and young women are unpersuaded.",
    ],
    pushback: "Demographers still debate how much the policy changed fertility at all; the state's claim of hundreds of millions of births prevented rests on the same linear thinking that produced the policy.",
  },
  c5: {
    argument: "Zero-Covid showed both faces of the engineering state: a remarkable first year of control, then a number-driven policy held so long that it locked twenty-five million people in their homes and ended in chaos.",
    remember: [
      "As with one child, the target was in the name — and was pursued past the point of sense.",
      "Shanghai's lockdown was announced as days and lasted weeks; food supply broke because the plan did not exist.",
      "Digital surveillance gave the state controls the one-child era never had.",
      "The end was abrupt, without vaccination drives or fever medicines, and the death toll was undercounted.",
    ],
    pushback: "The book is clear that early on the policy worked and was popular, and that America's own response was shambolic — though it produced mRNA vaccines China could not.",
  },
  c6: {
    argument: "Under Xi, China is turning into a fortress: closing up, crushing its consumer-tech champions, chasing out its creative and wealthy — while its manufacturing and military-industrial strength keep growing.",
    remember: [
      "The rich, the creative and the desperate are leaving; scientists are arriving.",
      "Xi is roughly right about problems and brutal in his solutions — the 2021 tech storm erased vast market value.",
      "Industrial capacity is military capacity: ships, shells, drones and batteries.",
      "China struggles to make culture the world wants, or a currency it will hold.",
    ],
    pushback: "The book does not expect China to overtake the United States as the leading power — the engineers' control neurosis is the limit — but expects it to dominate advanced manufacturing.",
  },
  c7: {
    argument: "America should learn to love engineers again: recover the building ethos of Robert Moses and Hyman Rickover without their arrogance, unwind the dominance of procedure, and call itself a developing country.",
    remember: [
      "The US once built at breakneck speed; New York still runs on infrastructure from that era.",
      "Money is not the bottleneck: projects funded by Congress have delivered almost nothing years later.",
      "Spain, Germany and Japan show a better balance between consultation and getting things built.",
      "Pluralism is the American advantage China cannot copy.",
    ],
    pushback: "The book insists America need not copy China's methods — evictions, lax safety, no public voice — only recover the will and capacity to build.",
  },
};

export default function BreakneckPage() {
  const v = loadBreakneck();
  const F = v.fig;
  const ch = (id: ChapterId) => v.chapters.find((c) => c.id === id)!;

  const pages = (id: ChapterId) => {
    const order: ChapterId[] = ["c1", "c2", "c3", "c4", "c5", "c6", "c7"];
    const i = order.indexOf(id);
    const from = ch(id).firstPage;
    const next = order[i + 1] ? ch(order[i + 1]!).firstPage : 234;
    return from && next ? `pp. ${from}–${next - 1}` : "";
  };

  /* ── scorecard: China against the United States, as the book pairs them ── */
  const score = [
    { what: "High-speed rail cost per mile", cn: F("hsr-cost-mile").value, us: F("hsr-cost-mile").value2!, unit: "US$", better: "low", fs: [F("hsr-cost-mile")], usNote: "California" },
    { what: "Nuclear reactors under construction", cn: F("nuclear-building").value, us: F("nuclear-building").value2!, unit: "", better: "high", fs: [F("nuclear-building")] },
    { what: "New wind capacity, 2023 (GW)", cn: F("wind-2023").value2!, us: F("wind-2023").value, unit: "", better: "high", fs: [F("wind-2023")] },
    { what: "Infrastructure investment, % of GDP", cn: F("infra-gdp").value, us: F("infra-gdp").value2!, unit: "%", better: "high", fs: [F("infra-gdp")] },
    { what: "Manufacturing, % of GDP", cn: sv(F("mfg-share"), "China"), us: sv(F("mfg-share"), "United States"), unit: "%", better: "high", fs: [F("mfg-share")] },
    { what: "Manufacturing workers", cn: F("mfg-workforce").value, us: sv(F("us-mfg-jobs"), "2025"), unit: "", better: "high", fs: [F("mfg-workforce"), F("us-mfg-jobs")] },
    { what: "Ships under construction, 2022", cn: F("ships").value, us: F("ships").value2!, unit: "", better: "high", fs: [F("ships")] },
    { what: "Social spending, % of GDP", cn: sv(F("social-spending"), "China"), us: sv(F("social-spending"), "United States"), unit: "%", better: "high", fs: [F("social-spending")] },
  ];

  const cards: Flashcard[] = [
    ["pbsc-engineers", "How many of the Politburo standing committee's members had trained as engineers by 2002?"],
    ["bjsh-cost", "What did the Beijing–Shanghai high-speed line cost?"],
    ["ca-cost", "What is the latest estimate for California's high-speed rail?"],
    ["lawyers-per-100k", "How many lawyers does the US have per hundred thousand people?"],
    ["gz-bridges", "How many of the world's hundred highest bridges are in Guizhou?"],
    ["hsr-cost-mile", "What does a mile of high-speed rail cost to build in China?"],
    ["cement", "How much cement did China make in 2018–2019 — about what America made in the whole twentieth century?"],
    ["nuclear-building", "How many nuclear reactors were under construction in China (and in the US)?"],
    ["iphone-x", "What share of the iPhone X's value did China contribute?"],
    ["mfg-share", "What share of China's GDP is manufacturing?"],
    ["apple-suppliers", "Of Apple's top 200 suppliers, how many have sites in China?"],
    ["song-projection", "What did Song Jian's model project for China's population by 2050?"],
    ["fertility-fall", "What was China's fertility rate in 1970 — and already by 1980, when the one-child policy began?"],
    ["policy-totals", "How many abortions did China perform in the one-child era?"],
    ["missing-women", "How many women are estimated to be 'missing'?"],
    ["lockdown-actual", "Shanghai promised an eight-day 'quiet period'. How long did the lockdown last?"],
    ["covid-deaths", "How many Covid deaths did China officially announce?"],
    ["border", "How many Chinese nationals were apprehended at the US southwest border in 2024?"],
    ["ships", "How many ships was China building in 2022?"],
    ["unido", "What share of the world's industrial capacity is China forecast to have by 2030?"],
    ["broadband", "How many homes had Congress's 2021 rural broadband money connected four years later?"],
    ["nissan", "How many cars a year could a Nissan worker make, as Deng heard it?"],
  ].map(([id, q]) => {
    const f = F(id!);
    const a = id === "broadband" ? "None — not a single home" : id === "song-projection" ? `${fmt(f.value, f.unit)} by 2050; over ${fmt(f.value2!, f.unit)} by 2080`
      : id === "nuclear-building" ? `China ${f.value}; United States ${f.value2}` : id === "fertility-fall" ? `About ${f.value.toFixed(1)}; already ${f.value2} by 1980`
      : id === "policy-totals" ? `${fmt(sv(f, "abortions"), "")} abortions` : id === "lockdown-actual" ? `${f.value} weeks`
      : id === "covid-deaths" ? `About ${fmt(f.value, "")} — against scholarly estimates near ${fmt(f.value2!, "")} excess deaths`
      : id === "apple-suppliers" ? `${f.value} of 200 — ${f.value2} of them in Guangdong alone` : id === "unido" ? `${f.value}% — more than all high-income countries together (${f.value2}%)`
      : id === "border" ? fmt(f.value2!, "") : id === "pbsc-engineers" ? "All nine" : id === "nissan" ? `${f.value} — against one in China`
      : id === "ships" ? `Nearly ${fmt(f.value, "")} — the US had ${f.value2}` : `${f.hedge ? f.hedge + " " : ""}${show(f)}`;
    return { id: id!, q: q!, a, cite: cite(f), ch: ch(f.ch).n };
  });

  const Head = ({ id, art }: { id: Exclude<ChapterId, "intro">; art: React.ReactNode }) => (
    <header className="bk-ch-head">
      <div className="bk-ch-blue">
        <svg viewBox="0 0 220 120" className="bk-ch-art" aria-hidden>{art}</svg>
        <span className="bk-ch-n">Chapter {ch(id).n}</span>
        <h2>{ch(id).title}</h2>
        <span className="bk-ch-pages">{pages(id)}</span>
      </div>
      <div className="bk-ch-pad">
        <p className="bk-ch-label">The argument</p>
        <p>{TEXT[id].argument}</p>
      </div>
    </header>
  );

  const Foot = ({ id }: { id: Exclude<ChapterId, "intro"> }) => (
    <div className="bk-ch-foot">
      <div className="bk-remember">
        <h3>Remember</h3>
        <ul>{TEXT[id].remember.map((r) => <li key={r}>{r}</li>)}</ul>
      </div>
      <div className="bk-push">
        <h3>Where the book argues against itself</h3>
        <p>{TEXT[id].pushback}</p>
      </div>
      <details className="bk-ledger">
        <summary>Every figure in this chapter ({v.byChapter(id).length})</summary>
        <table>
          <thead><tr><th>What</th><th>Figure</th><th>Page</th><th>Whose number</th></tr></thead>
          <tbody>
            {v.byChapter(id).map((f) => (
              <tr key={f.id}>
                <td>{f.label}</td>
                <td className="num">{f.hedge ? <i>{f.hedge} </i> : null}{f.series ? f.series.map((s) => `${s.key}: ${fmt(s.value, f.unit.split(", ")[0]!)}`).join(" · ") : `${show(f)}${f.value2 !== undefined ? ` · ${show(f, 2)}` : ""}`}</td>
                <td className="num">{f.page}</td>
                <td>{f.credit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );

  const usJobs = F("us-mfg-jobs");
  const sz = F("shenzhen-pop");
  const off = F("offshore-wind");
  const camp = F("campaign-1983");
  const tot = F("policy-totals");

  return (
    <div className="bk-root">
      <header className="bk-hero">
        <div className="bk-hero-blue">
          <svg viewBox="0 0 400 220" aria-hidden className="bk-hero-art">
            <g className="bk-bp">
              <path d="M10 170h380" />
              <path d="M40 170V95M360 170V95M40 95Q200 10 360 95" />
              {Array.from({ length: 15 }, (_, i) => { const x = 60 + i * 20; const y = 95 - Math.sin(((x - 40) / 320) * Math.PI) * 60; return <path key={i} d={`M${x} ${y}V140`} />; })}
              <path d="M20 140h360" />
              <path d="M40 190h320M40 185v10M360 185v10" className="dim" />
              <text x="200" y="208" textAnchor="middle">{F("rail-length").value} MILES · {Number(F("bjsh-cost").year) - 2008} YEARS</text>
            </g>
          </svg>
          <p className="bk-side">The engineering state</p>
        </div>
        <div className="bk-hero-pad">
          <ul className="bk-pad-lines" aria-hidden>
            <li><s>Environmental impact statement</s></li>
            <li><s>Public comment period</s></li>
            <li><s>Lawsuit — round three</s></li>
            <li><s>Revised route via extra mountain range</s></li>
            <li>First segment: {F("ca-opening").value}–{F("ca-opening").value2}?</li>
          </ul>
          <p className="bk-side red">The lawyerly society</p>
        </div>
        <div className="bk-hero-title">
          <p className="bk-kicker">A visual study guide</p>
          <h1><em>Breakneck</em>, by the numbers</h1>
          <p className="bk-stand">
            Dan Wang's {v.book.year} book argues that China is an <b className="cn">engineering state</b> that builds whatever it can,
            and the United States a <b className="us">lawyerly society</b> that blocks whatever it can — good and bad. Here is the book's
            evidence, chapter by chapter: {v.figures.length} figures, each found in the book's own text and cited to its page.
          </p>
          <nav className="bk-toc" aria-label="Chapters">
            {v.chapters.filter((c) => c.id !== "intro").map((c) => <a key={c.id} href={`#${c.id}`}><b>{c.n}</b> {c.title}</a>)}
            <a href="#scorecard"><b>⚖</b> Scorecard</a>
            <a href="#test"><b>?</b> Test yourself</a>
          </nav>
        </div>
      </header>

      <main className="bk-body">
        <section className="bk-idea">
          <div>
            <h2>The big idea in one picture</h2>
            <p>
              The book's lens is who governs. By 2002 every member of China's top ruling body had trained as an engineer; half of America's last ten presidents
              went to law school. Engineers build; lawyers protect process and property. Each country has the virtue the other lacks — and the vices.
            </p>
          </div>
          <div className="bk-idea-viz">
            <Pictos n={F("pbsc-engineers").value} of={9} kind="hat" label="Politburo standing committee trained as engineers (2002)" />
            <Pictos n={F("presidents-law").value} of={10} kind="gavel" label="of the last ten US presidents attended law school" />
            <p className="bk-cite">{cite(F("pbsc-engineers"))} · {cite(F("presidents-law"))}</p>
          </div>
        </section>

        {/* ── 1 ─────────────────────────────────────────────────────── */}
        <section id="c1" className="bk-ch">
          <Head id="c1" art={<g className="bk-bp"><path d="M20 90h80M60 90V40M40 40h40M50 40l10-15 10 15" /><path d="M130 90h70M140 90V55h50v35M150 65h30M150 75h30" /><circle cx="60" cy="20" r="5" /></g>} />
          <div className="bk-cards">
            <Card wide kicker="Same year, same distance" title="Two high-speed lines started in 2008" fs={[F("rail-length"), F("bjsh-cost"), F("bjsh-trips"), F("ca-cost"), F("ca-opening")]}>
              <div className="bk-race">
                <div className="bk-race-row cn">
                  <span className="bk-race-name">Beijing–Shanghai</span>
                  <div className="bk-race-track"><span className="bk-race-bar" style={{ left: "0%", width: `${(3 / 25) * 100}%` }} /><span className="bk-race-mark" style={{ left: `${(3 / 25) * 100}%` }}>opened 2011</span></div>
                  <span className="bk-race-num">{fmt(F("bjsh-cost").value, "US$")} · {fmt(F("bjsh-trips").value, "")} trips in its first decade</span>
                </div>
                <div className="bk-race-row us">
                  <span className="bk-race-name">California</span>
                  <div className="bk-race-track"><span className="bk-race-bar" style={{ left: "0%", width: `${(17 / 25) * 100}%` }} /><span className="bk-race-bar dash" style={{ left: `${(22 / 25) * 100}%`, width: `${(3 / 25) * 100}%` }} /><span className="bk-race-mark end" style={{ left: `${(17 / 25) * 100}%` }}>2025: a short stretch built</span></div>
                  <span className="bk-race-num">{fmt(F("ca-cost").value, "US$")} estimate · first segment {F("ca-opening").value}–{F("ca-opening").value2}</span>
                </div>
                <div className="bk-race-axis">{[2008, 2013, 2018, 2023, 2028, 2033].map((y) => <span key={y} style={{ left: `${((y - 2008) / 25) * 100}%` }}>{y}</span>)}</div>
                <p className="bk-note">Both lines run about {F("rail-length").value} miles. The window for California's first segment is as long as China took to build the whole line.</p>
              </div>
            </Card>
            <Card title="Lawyers per hundred thousand people" fs={[F("lawyers-per-100k")]} derived="Europe's average is the book's ratio applied: 400 ÷ 3.">
              <Bars rows={[{ label: "United States", value: F("lawyers-per-100k").value, ink: "us" }, { label: "European average", value: Math.round(F("lawyers-per-100k").value / 3), ink: "x", text: `≈${Math.round(F("lawyers-per-100k").value / 3)}` }]} />
            </Card>
            <Card title="What China built since 1980, measured against others" fs={[F("highways-vs-us"), F("hsr-vs-japan")]}>
              <div className="bk-pair">
                <Big f={F("highways-vs-us")} sub="highways built since 1980, against the US systems" />
                <Big f={F("hsr-vs-japan")} sub="high-speed rail, against Japan's network" />
              </div>
            </Card>
            <Card wide kicker="The worst year to be born" title="Lu, born 1949, and Yao, born 1959" fs={v.cohorts.map((c) => ({ ...F("pbsc-engineers"), page: c.page, credit: "the author" }))} note="A thought experiment the book uses: ten years' difference in birth, very different lives. Years after birth are the book's ages added to the birth year.">
              <Lifelines events={v.cohorts} />
            </Card>
          </div>
          <Foot id="c1" />
        </section>

        {/* ── 2 ─────────────────────────────────────────────────────── */}
        <section id="c2" className="bk-ch">
          <Head id="c2" art={<g className="bk-bp"><path d="M10 95h200" /><path d="M30 95V50M190 95V50M30 50Q110 0 190 50" />{[50, 70, 90, 110, 130, 150, 170].map((x) => <path key={x} d={`M${x} ${50 - Math.sin(((x - 30) / 160) * Math.PI) * 30}V75`} />)}<path d="M20 75h180" /></g>} />
          <div className="bk-cards">
            <Card title="Guizhou holds 45 of the world's 100 highest bridges" fs={[F("gz-bridges")]}>
              <Grid total={100} parts={[{ n: F("gz-bridges").value, ink: "cn", label: "in Guizhou" }]} />
            </Card>
            <Card title="Guizhou's airports" fs={[F("gz-airports"), F("gz-airports-idle")]} derived="Busier airports = 11 − 5.">
              <Grid total={F("gz-airports").value + F("gz-airports").value2!} cols={7} rest="under construction" parts={[
                { n: F("gz-airports").value - F("gz-airports-idle").value, ink: "cn", label: "operating airports" },
                { n: F("gz-airports-idle").value, ink: "us", label: "with fewer than a dozen flights a week" },
              ]} />
              <p className="bk-note">The three empty squares: airports still under construction. Guizhou's income per head is about {fmt(F("gz-income").value, "US$")} — Botswana's.</p>
            </Card>
            <Card title="Cars in China" fs={[F("cars")]}>
              <Squares items={[
                { label: "1990", value: F("cars").value, ink: "x", text: m(F("cars").value) },
                { label: "2024", value: F("cars").value2!, ink: "cn", text: m(F("cars").value2!) },
              ]} />
            </Card>
            <Card title="High-speed rail: cost per mile" fs={[F("hsr-cost-mile")]} derived="Europe's figure is China's $33m divided by 0.6 — the book says China is 40% cheaper.">
              <Bars unit="US$" rows={[
                { label: "China", value: F("hsr-cost-mile").value, ink: "cn" },
                { label: "Europe", value: Math.round(F("hsr-cost-mile").value / 0.6 / 1e6) * 1e6, ink: "x", text: `≈${fmt(Math.round(F("hsr-cost-mile").value / 0.6 / 1e6) * 1e6, "US$")}` },
                { label: "California", value: F("hsr-cost-mile").value2!, ink: "us" },
              ]} />
            </Card>
            <Card title="Nuclear power, 2025" fs={[F("nuclear-plants"), F("nuclear-building"), F("vogtle")]}>
              <Dots cols={16} groups={[
                { label: "reactors under construction in China", n: F("nuclear-building").value, ink: "cn" },
                { label: "under construction in the United States", n: F("nuclear-building").value2!, ink: "us" },
              ]} />
              <p className="bk-note">Plants in operation are nearly level — {F("nuclear-plants").value} against {F("nuclear-plants").value2}. America's only new plant this century took {F("vogtle").value} years and {fmt(F("vogtle").value2!, "US$")}; China approved {F("eleven-reactors").value} reactors expected to cost the same.</p>
            </Card>
            <Card title="Offshore wind in the United States, 2024" fs={[off]}>
              <Bars log unit="" rows={[
                { label: "operating", value: sv(off, "operating"), ink: "cn", text: `${sv(off, "operating")} MW` },
                { label: "under construction", value: sv(off, "under construction"), ink: "x", text: `${sv(off, "under construction")} MW` },
                { label: "waiting in permitting", value: sv(off, "in permitting"), ink: "us", text: `${sv(off, "in permitting").toLocaleString("en-US")} MW` },
              ]} />
            </Card>
            <Card title="New wind capacity, 2023" fs={[F("wind-2023")]}>
              <Bars unit="" rows={[{ label: "China", value: F("wind-2023").value2!, ink: "cn", text: `${F("wind-2023").value2} GW` }, { label: "United States", value: F("wind-2023").value, ink: "us", text: `${F("wind-2023").value} GW` }]} />
            </Card>
            <Card title="What the state spends on: concrete or people" fs={[F("infra-gdp"), F("social-spending")]}>
              <Bars unit="%" rows={[
                { label: "China — infrastructure (2016)", value: F("infra-gdp").value, ink: "cn" },
                { label: "US — infrastructure", value: F("infra-gdp").value2!, ink: "us", text: `≈${F("infra-gdp").value2}%` },
                { label: "China — social spending", value: sv(F("social-spending"), "China"), ink: "cn" },
                { label: "US — social spending", value: sv(F("social-spending"), "United States"), ink: "us" },
                { label: "Generous Europe — social", value: sv(F("social-spending"), "generous European states"), ink: "x" },
              ]} />
              <p className="bk-note">Share of GDP. Only about a tenth of China's unemployed can claim benefits; nearly three-quarters of Chinese pay no income tax.</p>
            </Card>
            <Card title="Highway networks the length of America's interstates" fs={[F("expressway-first"), F("expressway-pace")]} derived="The second took half the first's 18 years: 9.">
              <Bars unit="" rows={[{ label: "First network (from 1993)", value: F("expressway-pace").value, ink: "cn", text: `${F("expressway-pace").value} years` }, { label: "Second network", value: F("expressway-pace").value / 2, ink: "cn", text: `${F("expressway-pace").value / 2} years` }]} />
            </Card>
            <Card title="The bill for building big" fs={[F("liupanshui-debt"), F("three-gorges"), F("sichuan-schools")]}>
              <ul className="bk-facts">
                <li><b>{fmt(F("liupanshui-debt").value, "US$")}</b> of new debt for one poor city's {F("liupanshui-projects").value} tourism projects</li>
                <li><b>up to {m(F("three-gorges").value)}</b> people resettled for the Three Gorges Dam</li>
                <li><b>{F("sichuan-schools").value.toLocaleString("en-US")}</b> children killed when schools collapsed in the 2008 earthquake</li>
                <li><b>{fmt(F("cement").value, "")} tons</b> of cement in two years — nearly America's whole twentieth century</li>
              </ul>
            </Card>
          </div>
          <Foot id="c2" />
        </section>

        {/* ── 3 ─────────────────────────────────────────────────────── */}
        <section id="c3" className="bk-ch">
          <Head id="c3" art={<g className="bk-bp"><rect x="85" y="10" width="50" height="95" rx="8" /><path d="M100 18h20" /><path d="M20 100V60l25 15V60l25 15V45h0M150 100V50h50v50" /><path d="M10 100h200" /></g>} />
          <div className="bk-cards">
            <Card title="Shenzhen: from oyster villages to a megacity" fs={[sz]}>
              <Line xFrom={1978} xTo={2022} yMax={20e6} yLabel="population" yFmt={(x) => `${x / 1e6}m`} series={[{ name: "Shenzhen", ink: "cn", points: ["1980", "2000", "2020"].map((k) => ({ x: Number(k), y: sv(sz, k), tag: m(sv(sz, k)) })) }]} />
            </Card>
            <Card title="How much of an iPhone is made in China" fs={[F("iphone-2007"), F("iphone-x")]}>
              <Phones items={[{ label: "First iPhone, 2007", pct: F("iphone-2007").value, text: `~${F("iphone-2007").value}%` }, { label: "iPhone X, 2017", pct: F("iphone-x").value, text: `~${F("iphone-x").value}%` }]} />
              <p className="bk-note">Share of the phone's final value: assembly labour at first, then batteries, charging and acoustic parts.</p>
            </Card>
            <Card title="American manufacturing jobs" fs={[usJobs]}>
              <Line xFrom={1978} xTo={2027} yMax={20e6} yLabel="workers" yFmt={(x) => `${x / 1e6}m`} series={[{ name: "US", ink: "us", points: ["1980", "2000", "2010", "2025"].map((k) => ({ x: Number(k), y: sv(usJobs, k), tag: m(sv(usJobs, k)) })) }]} bands={[{ from: 2001, to: 2010, label: "China joins the WTO; collapse" }]} />
            </Card>
            <Card title="Manufacturing as a share of GDP" fs={[F("mfg-share")]}>
              <Bars unit="%" rows={(F("mfg-share").series ?? []).map((s) => ({ label: s.key, value: s.value, ink: s.key === "China" ? "cn" as const : s.key === "United States" ? "us" as const : "x" as const, text: s.value === 10 ? "≈10%" : undefined }))} />
            </Card>
            <Card title="Factory workforces" fs={[F("mfg-workforce"), usJobs, F("mfg-de-jp")]}>
              <Squares items={[
                { label: "China", value: F("mfg-workforce").value, ink: "cn", text: `${m(F("mfg-workforce").value)}+` },
                { label: "United States", value: sv(usJobs, "2025"), ink: "us", text: m(sv(usJobs, "2025")) },
                { label: "Japan", value: F("mfg-de-jp").value2!, ink: "x", text: m(F("mfg-de-jp").value2!) },
                { label: "Germany", value: F("mfg-de-jp").value, ink: "x", text: m(F("mfg-de-jp").value) },
              ]} />
            </Card>
            <Card title="Apple's top 200 suppliers, 2023" fs={[F("apple-suppliers")]} derived="Elsewhere in China = 156 − 72.">
              <Grid total={200} cols={20} parts={[
                { n: F("apple-suppliers").value2!, ink: "us", label: "with sites in Guangdong — as many as the US, Vietnam and India combined" },
                { n: F("apple-suppliers").value - F("apple-suppliers").value2!, ink: "cn", label: "with sites elsewhere in China" },
              ]} />
            </Card>
            <Card title="Hiring nine thousand industrial engineers" fs={[F("apple-engineers")]}>
              <div className="bk-pair">
                <div className="bk-big" style={{ color: "#b8432a" }}><b>{sv(F("apple-engineers"), "months in the US")} months</b><span>expected in the United States</span></div>
                <div className="bk-big" style={{ color: "#1f5a9e" }}><b>{sv(F("apple-engineers"), "weeks in China")} weeks</b><span>done in China</span></div>
              </div>
            </Card>
            <Card title="A factory the size of a city" fs={[F("foxconn-workers"), F("foxconn-food")]}>
              <ul className="bk-facts">
                <li><b>{F("foxconn-workers").value.toLocaleString("en-US")}</b> workers at peak on Foxconn's Shenzhen campus</li>
                {(F("foxconn-food").series ?? []).map((s) => <li key={s.key}><b>{s.value}</b> {s.key} a day</li>)}
              </ul>
            </Card>
          </div>
          <Foot id="c3" />
        </section>

        {/* ── 4 ─────────────────────────────────────────────────────── */}
        <section id="c4" className="bk-ch">
          <Head id="c4" art={<g className="bk-bp"><path d="M20 100L200 20" strokeDasharray="6 5" /><path d="M20 100C70 70 120 60 200 95" /><circle cx="20" cy="100" r="4" /><text x="150" y="30">MODEL</text><text x="150" y="88">WORLD</text></g>} />
          <div className="bk-cards">
            <Card title="The model against the world" fs={[F("pop-1949"), F("pop-1953"), F("pop-1978"), F("song-projection"), F("song-optimal"), F("pop-2100"), F("pop-growth-since")]} derived="Today's ~1.4 billion is the 1978 figure grown by the book's 40% since the policy began.">
              <Line xFrom={1945} xTo={2105} yMax={4e9} yLabel="people" yFmt={(x) => `${x / 1e9}bn`} series={[
                { name: "Recorded", ink: "cn", points: [
                  { x: 1949, y: F("pop-1949").value }, { x: 1953, y: F("pop-1953").value }, { x: 1978, y: F("pop-1978").value, tag: "1bn" },
                  { x: 2023, y: F("pop-1978").value * (1 + F("pop-growth-since").value / 100), tag: "≈1.4bn" },
                ] },
                { name: "Projected", ink: "x", dashed: true, points: [{ x: 2023, y: F("pop-1978").value * (1 + F("pop-growth-since").value / 100) }, { x: 2100, y: F("pop-2100").value, tag: "0.7bn by 2100" }] },
                { name: "Song Jian's model", ink: "us", dashed: true, points: [{ x: 1978, y: F("pop-1978").value }, { x: 2050, y: F("song-projection").value, tag: "3bn" }, { x: 2080, y: F("song-projection").value2!, tag: "4bn+" }] },
              ]} />
              <p className="bk-note">Song Jian's "optimal" population was no more than {fmt(F("song-optimal").value, "")} — the number China now heads towards by collapse.</p>
            </Card>
            <Card title="Fertility had already fallen before the policy" fs={[F("fertility-fall"), F("tfr")]}>
              <Line xFrom={1965} xTo={2027} yMax={8} yLabel="children per woman" yFmt={(x) => x.toFixed(1)} series={[{ name: "fertility", ink: "cn", points: [
                { x: 1970, y: F("fertility-fall").value, tag: `${F("fertility-fall").value.toFixed(1)}` },
                { x: 1980, y: F("fertility-fall").value2!, tag: `${F("fertility-fall").value2} — policy begins` },
                { x: 2023, y: F("tfr").value, tag: `${F("tfr").value.toFixed(1)} now` },
              ] }, { name: "replacement", ink: "us", dashed: true, points: [{ x: 1965, y: F("tfr").value2! }, { x: 2027, y: F("tfr").value2!, tag: "2.1 replaces a population" }] }]} />
              <p className="bk-note">The "now" point is plotted at 2023, the latest year the chapter discusses.</p>
            </Card>
            <Card title="The 1983 campaign" fs={[camp]}>
              <Bars unit="" rows={[
                { label: "Sterilisations, 1975", value: sv(camp, "sterilisations 1975"), ink: "x", text: m(sv(camp, "sterilisations 1975")) },
                { label: "Sterilisations, 1983", value: sv(camp, "sterilisations 1983"), ink: "us", text: m(sv(camp, "sterilisations 1983")) },
                { label: "Abortions, 1975", value: sv(camp, "abortions 1975"), ink: "x", text: m(sv(camp, "abortions 1975")) },
                { label: "Abortions, 1983", value: sv(camp, "abortions 1983"), ink: "us", text: m(sv(camp, "abortions 1983")) },
              ]} />
            </Card>
            <Card title="Thirty-five years, in total" fs={[tot]}>
              <Squares items={[
                { label: "abortions", value: sv(tot, "abortions"), ink: "us", text: m(sv(tot, "abortions")) },
                { label: "women sterilised", value: sv(tot, "women sterilised"), ink: "us", text: m(sv(tot, "women sterilised")) },
                { label: "men sterilised", value: sv(tot, "men sterilised"), ink: "x", text: m(sv(tot, "men sterilised")) },
              ]} />
            </Card>
            <Card title="Boys born for every 100 girls" fs={[F("sex-ratio"), F("missing-women"), F("men-surplus")]}>
              <Bars unit="" rows={[{ label: "1999", value: F("sex-ratio").value, ink: "us", text: `${F("sex-ratio").value}` }, { label: "Now", value: F("sex-ratio").value2!, ink: "x", text: `${F("sex-ratio").value2}` }, { label: "Even", value: 100, ink: "cn", text: "100" }]} />
              <p className="bk-note">Demographers estimate about {m(F("missing-women").value)} women are "missing"; there are about {m(F("men-surplus").value)} more men than women.</p>
            </Card>
            <Card title="Fewer births, fewer marriages" fs={[F("births"), F("marriages"), F("vasectomies"), F("divorce")]}>
              <Bars unit="" rows={[
                { label: "Births, 2019", value: sv(F("births"), "2019"), ink: "x", text: m(sv(F("births"), "2019")) },
                { label: "Births, 2023", value: sv(F("births"), "2023"), ink: "us", text: m(sv(F("births"), "2023")) },
                { label: "Married, 2024", value: F("marriages").value, ink: "us", text: m(F("marriages").value) },
              ]} />
              <p className="bk-note">Marriages in 2024 were half the level of a decade before. Vasectomies fell from {F("vasectomies").value.toLocaleString("en-US")} (2014) to under {F("vasectomies").value2!.toLocaleString("en-US")} (2019); courts granted {F("divorce").value}% of divorce requests in the mid-2000s, {F("divorce").value2}% a decade later.</p>
            </Card>
          </div>
          <Foot id="c4" />
        </section>

        {/* ── 5 ─────────────────────────────────────────────────────── */}
        <section id="c5" className="bk-ch">
          <Head id="c5" art={<g className="bk-bp"><rect x="40" y="25" width="140" height="80" /><path d="M40 45h140M75 25v80M110 25v80M145 25v80M40 65h140M40 85h140" /><path d="M20 15l180 100" strokeWidth="3" /></g>} />
          <div className="bk-cards">
            <Card wide title="Shanghai, spring 2022: promised and delivered" fs={[F("lockdown-promised"), F("lockdown-actual"), F("lockdown-pop")]} derived="Eight weeks drawn as 56 days.">
              <Calendar promised={F("lockdown-promised").value} actualDays={F("lockdown-actual").value * 7} />
              <p className="bk-note">{m(F("lockdown-pop").value)} people, mostly unable to leave home.</p>
            </Card>
            <Card title="Covid deaths: counted and estimated" fs={[F("covid-deaths")]}>
              <Squares items={[{ label: "officially announced", value: F("covid-deaths").value, ink: "cn", text: `~${F("covid-deaths").value.toLocaleString("en-US")}` }, { label: "scholarly estimate of excess deaths", value: F("covid-deaths").value2!, ink: "us", text: `~${m(F("covid-deaths").value2!)}` }]} />
            </Card>
            <Card title="What lockdown did to a city" fs={[F("trucking"), F("taxi"), F("veg-price"), F("testing-cost")]}>
              <Bars unit="" rows={[
                { label: "Airport taxi, normal", value: F("taxi").value, ink: "x", text: `$${F("taxi").value}` },
                { label: "Airport taxi, lockdown", value: F("taxi").value2!, ink: "us", text: `$${F("taxi").value2}` },
                { label: "Vegetables & eggs delivered", value: F("veg-price").value, ink: "us", text: `~$${F("veg-price").value}` },
              ]} />
              <p className="bk-note">Trucking ran at {F("trucking").value}% of normal in mid-April. Mass testing cost an estimated {F("testing-cost").value}% of China's GDP in 2022.</p>
            </Card>
            <Card wide title="Three acts" fs={[F("wuhan-hospital"), F("disneyland"), F("urumqi-fire")]}>
              <ol className="bk-acts">
                <li><b>2020 · Fury, then control.</b> A hospital built in {F("wuhan-hospital").value} days; a cover-up that cost the world.</li>
                <li><b>2021 · Pride.</b> Life near normal while the world locked down; QR codes everywhere.</li>
                <li><b>2022 · Desperation.</b> {F("disneyland").value.toLocaleString("en-US")} trapped in Disneyland; Shanghai sealed; {F("urumqi-fire").value} dead in Urumqi; blank-paper protests; an abrupt end.</li>
              </ol>
            </Card>
          </div>
          <Foot id="c5" />
        </section>

        {/* ── 6 ─────────────────────────────────────────────────────── */}
        <section id="c6" className="bk-ch">
          <Head id="c6" art={<g className="bk-bp"><path d="M10 105V45h20V30h15v15h20V30h15v15h20V30h15v15h20V30h15v15h20V30h15v15h25v60z" /><path d="M95 105V80a15 15 0 0 1 30 0v25" /></g>} />
          <div className="bk-cards">
            <Card wide title="Ships under construction, 2022" fs={[F("ships")]}>
              <Dots per={5} cols={60} groups={[{ label: "ships in Chinese yards (nearly)", n: F("ships").value, ink: "cn" }, { label: "ships in American yards", n: F("ships").value2!, ink: "us" }]} />
            </Card>
            <Card title="Share of world industrial capacity, 2030 forecast" fs={[F("unido")]}>
              <Bars unit="%" rows={[{ label: "China", value: F("unido").value, ink: "cn" }, { label: "All high-income countries together", value: F("unido").value2!, ink: "us" }]} />
            </Card>
            <Card title="Leaving: Chinese nationals at the US southwest border" fs={[F("border")]}>
              <Bars unit="" log rows={[{ label: "2021", value: F("border").value, ink: "x" }, { label: "2024", value: F("border").value2!, ink: "us" }]} />
            </Card>
            <Card title="Leaving with money" fs={[F("millionaires"), F("investor-visas")]}>
              <Bars unit="" rows={[
                { label: "Millionaires emigrating, 2023", value: F("millionaires").value, ink: "x", text: `~${F("millionaires").value.toLocaleString("en-US")}` },
                { label: "Millionaires emigrating, 2024", value: F("millionaires").value2!, ink: "us", text: `${F("millionaires").value2!.toLocaleString("en-US")}+` },
                ...(F("investor-visas").series ?? []).map((s) => ({ label: `Investor residency, ${s.key}`, value: s.value, ink: (s.key.endsWith("2019") ? "x" : "cn") as "x" | "cn" })),
              ]} />
            </Card>
            <Card title="The 2021 tech storm" fs={[F("crackdown"), F("alibaba"), F("new-oriental")]} derived="A quarter of $800bn = $200bn.">
              <Squares items={[{ label: "Alibaba before", value: F("alibaba").value, ink: "x", text: fmt(F("alibaba").value, "US$") }, { label: "two years later", value: F("alibaba").value / 4, ink: "us", text: fmt(F("alibaba").value / 4, "US$") }]} />
              <p className="bk-note">Across the sector, {fmt(F("crackdown").value, "US$")} of market value wiped out; New Oriental lost {F("new-oriental").value}% of its value and {F("new-oriental").value2}% of its staff.</p>
            </Card>
            <Card title="Arriving: scientists of Chinese descent moving from the US to China" fs={[F("scientists"), F("us-students")]}>
              <Bars unit="" rows={[{ label: "2010", value: F("scientists").value, ink: "x", text: `<${F("scientists").value.toLocaleString("en-US")}` }, { label: "2021", value: F("scientists").value2!, ink: "cn", text: `>${F("scientists").value2!.toLocaleString("en-US")}` }]} />
              <p className="bk-note">The other way: about {F("us-students").value.toLocaleString("en-US")} American students study in China now, a tenth of the number before the pandemic.</p>
            </Card>
            <Card title="Belt and Road: lending far, losing friends" fs={[F("bri-loans"), F("bri-forum")]}>
              <Dots cols={40} groups={[{ label: "world leaders at the Belt and Road Forum, 2017", n: F("bri-forum").value, ink: "cn" }, { label: "in 2023", n: F("bri-forum").value2!, ink: "us" }]} />
              <p className="bk-note">{fmt(F("bri-loans").value, "US$")} of loans outstanding in {F("bri-loans").value2} countries.</p>
            </Card>
          </div>
          <Foot id="c6" />
        </section>

        {/* ── 7 ─────────────────────────────────────────────────────── */}
        <section id="c7" className="bk-ch">
          <Head id="c7" art={<g className="bk-bp"><path d="M10 100h200M40 100V35M180 100V35" /><path d="M40 40Q110 95 180 40" /><path d="M40 35l-8 10h16zM180 35l-8 10h16z" />{[60, 80, 100, 120, 140, 160].map((x) => <path key={x} d={`M${x} ${40 + Math.sin(((x - 40) / 140) * Math.PI) * 35}V100`} />)}</g>} />
          <div className="bk-cards">
            <Card wide title="Money spent, things built" fs={[F("broadband"), F("ev-chargers")]}>
              <div className="bk-ledgerpair">
                <div><b className="us">{fmt(F("broadband").value, "US$")}</b><span>for rural broadband, 2021</span><em>→ four years later: <b>0</b> homes connected</em></div>
                <div><b className="us">{fmt(F("ev-chargers").value, "US$")}</b><span>for EV charging stations</span><em>→ two years later: <b>{F("ev-chargers").value2}</b> working</em></div>
              </div>
            </Card>
            <Card title="Why American transit is so dear" fs={[F("nyc-subway"), F("renters"), F("rust-cities")]}>
              <Bars unit="" rows={[{ label: "A km of subway, Paris", value: 1, ink: "x", text: "1×" }, { label: "A km of subway, New York", value: F("nyc-subway").value, ink: "us", text: `${F("nyc-subway").value}×` }]} />
              <p className="bk-note">New York hosts five of the world's six most expensive transit projects. Half of American renters are cost-burdened.</p>
            </Card>
            <Card title="What Deng saw abroad" fs={[F("nissan")]}>
              <Dots cols={20} groups={[{ label: "cars a year per Nissan worker", n: F("nissan").value, ink: "cn" }, { label: "per Chinese auto worker", n: 1, ink: "us" }]} />
              <p className="bk-note">The book's point: the roles have since reversed.</p>
            </Card>
          </div>
          <Foot id="c7" />
        </section>

        {/* ── scorecard ─────────────────────────────────────────────── */}
        <section id="scorecard" className="bk-score">
          <h2>The scorecard</h2>
          <p className="bk-lede">The book's paired figures, China against the United States. The bar shows how many times larger one side is — log scale, centred on equal.</p>
          <div className="bk-score-rows">
            {score.map((s) => {
              const r = s.cn / s.us;
              const len = Math.min(48, (Math.abs(Math.log10(r)) / 2.6) * 48);
              const cnBigger = r >= 1;
              return (
                <div key={s.what} className="bk-score-row">
                  <span className="bk-score-what">{s.what}</span>
                  <span className="bk-score-cn">{fmt(s.cn, s.unit)}</span>
                  <span className="bk-score-bar">
                    <i className="mid" />
                    <i className={cnBigger ? "cn" : "us"} style={cnBigger ? { right: "50%", width: `${len}%` } : { left: "50%", width: `${len}%` }} />
                  </span>
                  <span className="bk-score-us">{fmt(s.us, s.unit)}{s.usNote ? ` (${s.usNote})` : ""}</span>
                  <span className="bk-score-x">{r >= 1 ? `${r >= 10 ? Math.round(r) : r.toFixed(1)}× higher in China` : `${(1 / r).toFixed(1)}× higher in the US`}</span>
                </div>
              );
            })}
          </div>
          <p className="bk-derived"><b>Derived</b> The ratios are this page's arithmetic on the book's figures. "US" manufacturing workers is the book's 2025 count; China's is "more than" its figure.</p>
          <p className="bk-cite">{[...new Set(score.flatMap((s) => s.fs).map((f) => `p. ${f.page}`))].join(" · ")}</p>
        </section>

        <section id="test" className="bk-test">
          <h2>Test yourself</h2>
          <p className="bk-lede">Guess each number before you turn the card — recalling beats rereading.</p>
          <Flashcards cards={cards} />
        </section>

        <section className="bk-method">
          <h2>About these numbers</h2>
          <p>
            Every figure on this page is printed in <em>{v.book.title}: {v.book.subtitle}</em> by {v.book.author} ({v.book.publisher}, {v.book.year}).
            Each was typed from the book and then found again in the book's own text by a script that fails if the sentence is not there; page numbers come from the
            book's print pagination, never typed by hand. Where the book names a source — the World Bank, Moody's, Vaclav Smil, state media, Nomura — the page
            names it too. These figures have <b>not</b> been re-checked against those original sources: this is a guide to the book's evidence, not an audit of it.
            Summaries and takeaways are this site's paraphrase. Arithmetic on the book's numbers is marked <b>Derived</b>.
          </p>
        </section>
      </main>
    </div>
  );
}
