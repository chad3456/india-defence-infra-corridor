/**
 * The charts on /protests, as specs over the curated file. No node imports.
 *
 * A spec names the series, breakdown or episode field it draws and says, in
 * one line each, what the chart is and how it can be misread. The page draws
 * only figures that passed verification; the test requires every spec to have
 * at least two figures to draw, so a chart cannot ship as an empty frame.
 */
import type { Episode, PublicOrderFile } from "./public-order-shared";

export type Part = "record" | "motive" | "property" | "police" | "communal" | "episodes";

export const PARTS: Array<{ id: Part; n: string; title: string; lede: string }> = [
  { id: "record", n: "I", title: "What the police record", lede: "Every riot case registered in India is counted by the National Crime Records Bureau from police station returns. It is the only national count that runs unbroken from 2004, and it counts cases registered — not riots that happened, not people hurt." },
  { id: "motive", n: "II", title: "What the riots were about", lede: "Since 2017 the Bureau has split rioting cases by the motive the police recorded. Agitations and attacks on police are two of the seventeen heads. Of the cases with a motive recorded, most arise from disputes over land, family and old enmities." },
  { id: "property", n: "III", title: "Damage to public property", lede: "Destroying public property is a separate offence under the Prevention of Damage to Public Property Act, 1984. These are cases registered under that Act — the count of prosecutions begun, not of rupees lost, which no national body publishes." },
  { id: "police", n: "IV", title: "Police and civilians: firing, lathi-charge, casualties", lede: "The Bureau records police personnel killed and injured on duty, and civilians killed and injured during police operations, by cause. Riot duty is one cause among many; accidents kill more policemen than mobs do." },
  { id: "communal", n: "V", title: "Communal violence: two counts that disagree", lede: "The Home Ministry counts communal incidents reported by states; the Bureau counts rioting cases whose motive police recorded as communal or religious. They measure different things, are published separately here, and should never be added together." },
  { id: "episodes", n: "VI", title: "Episode by episode", lede: "National counts cannot say what happened in Panchkula or Imphal. These are the deaths, injuries, arrests and losses of the major episodes since 2004, each from the official statement or court filing that gave it, and each labelled with whose number it is." },
];

interface Base { id: string; part: Part; title: string; what: string; read?: string }
export type ChartSpec =
  | (Base & { kind: "bars"; series: string; colour?: string })
  | (Base & { kind: "lines"; lines: Array<{ series: string; label: string; colour: string; dashed?: boolean }> })
  | (Base & { kind: "stack"; parts: Array<{ series: string[]; label: string; colour: string }>; years: number[] })
  | (Base & { kind: "rank"; breakdown: string; top?: number })
  | (Base & { kind: "episodes"; field: "deaths" | "injured" | "policeInjured" | "arrests" | "firs" | "loss" | "displaced" });

const C1 = "var(--series-1)", C2 = "var(--series-2)", C3 = "var(--series-3)", C4 = "var(--series-4)";

export const CHARTS: ChartSpec[] = [
  /* I — the record */
  { id: "riots-total", part: "record", kind: "bars", series: "riots-total", title: "Rioting cases registered, 2004–2024",
    what: "Cases registered under the rioting sections (147–151 IPC; from July 2024 also their BNS equivalents), all India.",
    read: "A fall in registered cases is not by itself a fall in rioting: a state that registers fewer cases, or files them under another section, moves this line too." },
  { id: "riots-rate", part: "record", kind: "bars", series: "riots-rate", colour: C2, title: "Rioting cases per lakh people",
    what: "The Bureau's own crime rate for rioting: cases per 1,00,000 population, from its population estimates.",
    read: "Corrects the count for population growth, which the bare count does not." },
  { id: "unlawful-assembly", part: "record", kind: "bars", series: "unlawful-assembly", colour: C3, title: "Unlawful assembly cases",
    what: "Cases under sections 143–145 IPC — being a member of an unlawful assembly — registered without a riot charge.",
    read: "The charge most often used against protesters who did not riot; a rise can reflect a crackdown as well as more protest." },
  { id: "riots-states", part: "record", kind: "rank", breakdown: "riots-states-2024", top: 15, title: "Rioting cases by state or UT, 2024",
    what: "Rioting cases registered in 2024, IPC and BNS together, the fifteen highest states.",
    read: "Large states register more of everything. The next chart corrects for population." },
  { id: "riots-rate-states", part: "record", kind: "rank", breakdown: "riots-rate-states-2024", top: 15, title: "Rioting rate by state or UT, 2024",
    what: "Rioting cases per lakh population in 2024, as the Bureau computes it, the fifteen highest states.",
    read: "Small states move a lot on a few cases; Manipur's figure is a few hundred cases in a population of about three million." },
  { id: "riot-victims-states", part: "record", kind: "rank", breakdown: "riot-victims-states-2024", top: 15, title: "Victims of rioting by state or UT, 2024",
    what: "People the police recorded as victims in rioting cases, 2024 — injured or harmed, not only killed.",
    read: "A count of victims named in cases, which is larger than the count of cases wherever one riot hurts many." },

  /* II — motive */
  { id: "motive-mix", part: "motive", kind: "stack", years: [2017, 2018, 2020, 2021, 2022, 2023, 2024], title: "What rioting cases were recorded as being about",
    parts: [
      { label: "Private disputes: land, family, enmity, money, water, power", colour: "var(--series-1)", series: ["riots-land", "riots-family", "riots-enmity", "riots-money", "riots-water", "riots-electricity", "riots-sudden"] },
      { label: "Public order: during an agitation, or attacking police", colour: "var(--series-4)", series: ["riots-aandolan", "riots-attacks-police"] },
      { label: "Demands: agrarian, political, student, industrial", colour: "var(--series-2)", series: ["riots-agrarian", "riots-political", "riots-students", "riots-industrial"] },
      { label: "Identity: communal, caste, sectarian, ethnic", colour: "var(--series-3)", series: ["riots-communal", "riots-caste", "riots-sectarian", "riots-ethnic", "riots-vigilante"] },
      { label: "Other or not stated", colour: "var(--story-ink-3)", series: ["riots-other"] },
    ],
    what: "Share of rioting cases by the motive police recorded, for the years the Bureau published seventeen heads, grouped into five by this site (the grouping is ours; every head's own figure is in the data). 2019 is missing from the volumes read.",
    read: "\"Other\" is the largest single head every year: the motive is often not recorded, which limits every finding below." },
  { id: "riots-aandolan", part: "motive", kind: "bars", series: "riots-aandolan", colour: C2, title: "Rioting during an agitation or morcha",
    what: "Rioting cases the police recorded as arising during an andolan or morcha — the closest the Bureau comes to counting violent protest.",
    read: "Counts registered cases, not protests; most protests produce no riot case at all." },
  { id: "riots-attacks-police", part: "motive", kind: "bars", series: "riots-attacks-police", colour: C4, title: "Rioting that attacked police or officials",
    what: "Rioting cases recorded as attacks on police personnel or government servants." },
  { id: "riots-demands", part: "motive", kind: "lines", title: "Agrarian, political and student rioting",
    lines: [{ series: "riots-agrarian", label: "Agrarian", colour: C1 }, { series: "riots-political", label: "Political", colour: C2 }, { series: "riots-students", label: "Students", colour: C3 }],
    what: "Rioting cases under three motive heads published since 2015.",
    read: "The agrarian head is rioting over farm matters, which is mostly local disputes, not farm-union protest." },
  { id: "riots-identity", part: "motive", kind: "lines", title: "Communal, caste and sectarian rioting",
    lines: [{ series: "riots-communal", label: "Communal/religious", colour: C1 }, { series: "riots-caste", label: "Caste conflict", colour: C2 }, { series: "riots-sectarian", label: "Sectarian", colour: C3 }],
    what: "Rioting cases under three identity-related motive heads, 2015–2024.",
    read: "Caste-conflict cases fell by two-thirds in 2017, the year the motive list grew from eight heads to seventeen; some of the fall is reclassification." },
  { id: "riots-disputes", part: "motive", kind: "lines", title: "Land, family and enmity",
    lines: [{ series: "riots-land", label: "Land/property", colour: C1 }, { series: "riots-enmity", label: "Enmity/rivalry", colour: C2 }, { series: "riots-family", label: "Family", colour: C3 }],
    what: "The three largest named motives: most rioting cases are private quarrels that turned into group violence.",
    read: "These are what drive the national total, which is why the total says little about public protest." },

  /* III — property */
  { id: "pdpp", part: "property", kind: "bars", series: "pdpp", colour: C4, title: "Cases under the Prevention of Damage to Public Property Act",
    what: "Cases registered under the 1984 Act, all India, 2014–2024.",
    read: "A count of cases, not of damage. The Bureau publishes no rupee value for public property destroyed; the chart below gives the few official figures that exist, episode by episode." },
  { id: "loss", part: "property", kind: "episodes", field: "loss", title: "Public property lost in single episodes, where an official figure exists",
    what: "Rupees crore, as stated by the government, a court or a commission, for the episodes where one was stated.",
    read: "Each figure counts something different — railway assets only, or claims lodged, or a state's estimate — and none is an audited total. They are not comparable with one another." },

  /* IV — police and civilians */
  { id: "police-killed", part: "police", kind: "bars", series: "police-killed", colour: C1, title: "Police personnel killed on duty",
    what: "State police personnel killed on duty, all causes, all India.",
    read: "Accidents are most of it. The next charts isolate deaths and injuries caused by mobs." },
  { id: "police-injured", part: "police", kind: "bars", series: "police-injured", colour: C2, title: "Police personnel injured on duty",
    what: "State police personnel injured on duty, all causes, all India." },
  { id: "police-killed-mobs", part: "police", kind: "bars", series: "police-killed-mobs", colour: C4, title: "Police killed by riotous mobs",
    what: "Police personnel the Bureau records as killed on duty by riotous mobs." },
  { id: "police-injured-mobs", part: "police", kind: "bars", series: "police-injured-mobs", colour: C4, title: "Police injured by riotous mobs",
    what: "Police personnel the Bureau records as injured on duty by riotous mobs." },
  { id: "police-killed-cause", part: "police", kind: "rank", breakdown: "police-killed-cause-2022", title: "Why police died on duty, 2022",
    what: "Police personnel killed on duty in 2022 by the cause the Bureau records." },
  { id: "civ-killed-riots", part: "police", kind: "lines", title: "Civilians killed during riots, by how",
    lines: [{ series: "civ-killed-riots-firing", label: "Police firing", colour: C1 }, { series: "civ-killed-riots-lathi", label: "Lathi-charge", colour: C2 }, { series: "civ-killed-riots-mobs", label: "By the mob", colour: C3 }],
    what: "Civilians the Bureau records as killed during riots: by police firing, in lathi-charges, or by riotous mobs.",
    read: "From state returns, which record the cause as the police classified it." },
  { id: "civ-injured-riots", part: "police", kind: "lines", title: "Civilians injured during riots, by how",
    lines: [{ series: "civ-injured-riots-firing", label: "Police firing", colour: C1 }, { series: "civ-injured-riots-lathi", label: "Lathi-charge", colour: C2 }, { series: "civ-injured-riots-mobs", label: "By the mob", colour: C3 }],
    what: "Civilians recorded as injured during riots, by the same three causes." },
  { id: "firing-2016", part: "police", kind: "rank", breakdown: "firing-2016-civ-killed", title: "Civilians killed when police opened fire, 2016, by occasion",
    what: "Civilians killed in police firing in 2016, by the occasion the Bureau records the firing was for — the last year it published this table.",
    read: "Riot control accounts for most deaths in police firing; the table was replaced in 2017 by the civilians-killed charts above." },
  { id: "commemoration", part: "police", kind: "bars", series: "commemoration", colour: C3, title: "Police and CAPF personnel killed in the line of duty, as announced on Police Commemoration Day",
    what: "The figure the Home Minister or a senior official announces each 21 October for the year to 31 August, state police and central armed police together.",
    read: "A different count from the Bureau's: wider (central forces included), on a September-to-August year, and announced rather than tabulated." },

  /* V — communal */
  { id: "mha-incidents", part: "communal", kind: "bars", series: "mha-communal-incidents", colour: C1, title: "Communal incidents, Home Ministry count, 2004–2017",
    what: "Communal incidents reported by states to the Home Ministry, as given in its RTI reply and answers to Parliament.",
    read: "The ministry's year-wise series stops with 2017 in what it has released; later years exist only as the Bureau's rioting cases." },
  { id: "mha-killed", part: "communal", kind: "bars", series: "mha-communal-killed", colour: C4, title: "People killed in communal incidents, Home Ministry count",
    what: "Deaths in communal incidents, as the ministry reported them." },
  { id: "mha-injured", part: "communal", kind: "bars", series: "mha-communal-injured", colour: C2, title: "People injured in communal incidents, Home Ministry count",
    what: "Injuries in communal incidents, as the ministry reported them." },
  { id: "two-counts", part: "communal", kind: "lines", title: "Two counts of communal violence",
    lines: [{ series: "mha-communal-incidents", label: "MHA incidents", colour: C1 }, { series: "riots-communal", label: "NCRB cases", colour: C2, dashed: true }],
    what: "The ministry's incident count beside the Bureau's communal-rioting case count, for the years both exist.",
    read: "In 2016 the Bureau recorded 869 communal riot cases and the ministry 703 incidents. Neither is wrong; they count different things." },
  { id: "communal-justice", part: "communal", kind: "lines", title: "Communal rioting: arrested against convicted",
    lines: [{ series: "communal-riot-arrested", label: "Persons arrested", colour: C1 }, { series: "communal-riot-convicted", label: "Persons convicted", colour: C4 }],
    what: "Persons arrested and persons convicted under the communal/religious rioting head, 2018–2020, from NCRB's table as the Home Ministry laid it in the Lok Sabha.",
    read: "Convictions in a year mostly concern cases from earlier years, so the two lines are not a conviction rate." },
  { id: "stone-pelting", part: "communal", kind: "bars", series: "jk-stone-pelting", colour: C3, title: "Stone-pelting incidents in Jammu & Kashmir",
    what: "Incidents the Home Ministry gave in an RTI reply; 2019 runs to 30 November.",
    read: "2019 is eleven months, and the spike after 5 August followed the revocation of Article 370." },

  /* VI — episodes */
  { id: "episode-deaths", part: "episodes", kind: "episodes", field: "deaths", title: "Deaths, episode by episode",
    what: "Deaths in each major episode since 2004, from the official statement or filing cited.",
    read: "Official tolls are often lower than independent counts, and the gaps are noted under each episode." },
  { id: "episode-police-injured", part: "episodes", kind: "episodes", field: "policeInjured", title: "Police injured, episode by episode",
    what: "Police personnel injured, where the police or government stated a figure." },
  { id: "episode-injured", part: "episodes", kind: "episodes", field: "injured", title: "People injured, episode by episode",
    what: "All injuries stated, police and civilians, where a figure was given." },
  { id: "episode-arrests", part: "episodes", kind: "episodes", field: "arrests", title: "Arrests, episode by episode",
    what: "People arrested, as of the date of the statement cited; most counts rose afterwards." },
  { id: "episode-firs", part: "episodes", kind: "episodes", field: "firs", title: "Cases registered, episode by episode",
    what: "First information reports registered, as of the statement cited." },
];

/** How many verified-or-not figures a spec has to draw (the test checks verification separately). */
export function chartPoints(c: ChartSpec, f: PublicOrderFile): number {
  const s = (id: string) => f.series.find((x) => x.id === id)?.points.length ?? 0;
  switch (c.kind) {
    case "bars": return s(c.series);
    case "lines": return Math.max(0, ...c.lines.map((l) => s(l.series)));
    case "stack": return c.years.filter((y) => c.parts.some((p) => p.series.some((id) => f.series.find((x) => x.id === id)?.points.some((q) => q.x === y)))).length;
    case "rank": return f.breakdowns.find((b) => b.id === c.breakdown)?.rows.length ?? 0;
    case "episodes": return f.episodes.filter((e) => e[c.field as keyof Episode]).length;
  }
}
