/**
 * Breakneck, read out of the book and checked back against it.
 *
 * `npm run breakneck:book`. Writes data/global/breakneck-book.json. Reads the
 * book committed to data/; touches no network.
 *
 * ── What this source is ──────────────────────────────────────────────────
 *
 * Dan Wang, *Breakneck: China's Quest to Engineer the Future* (W. W. Norton,
 * 2025). An argument, not a statistical yearbook: a technology analyst's
 * account of six years in China, built around one idea — that China is an
 * engineering state that builds, and the United States a lawyerly society
 * that blocks. Its numbers come from many places (official statistics, state
 * media, the World Bank, Moody's, Vaclav Smil, a teardown analysis, the
 * author's own reporting), and the book usually says which. Every record
 * below keeps that attribution in `credit`. A figure here is what the book
 * prints; it has not been re-checked against the book's own sources, and the
 * page says so.
 *
 * ── Why every number is verified ─────────────────────────────────────────
 *
 * Each figure was typed by hand from the book, which is how a number turns
 * into a slightly different number. So each carries a `verify` phrase that
 * must still appear in the book, plus `also` phrases for anything else its
 * value or label rests on; the run fails if any does not. Pages are never
 * typed: they come from the print-page anchors in the EPUB. A phrase may not
 * straddle a page break (the anchor sits inside the text), which is why a few
 * sentences are split into `verify` and `also`.
 *
 * The phrases are short on purpose: they are citations, kept in this file to
 * be checked, and are not written to the output. The page shows this site's
 * own labels and the page number, not the book's prose.
 *
 * `npm run test:breakneck` repeats the check offline and adds two: every
 * value must be a number its phrases print, and every number in a label must
 * be one too.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { findBook, readChapters, locate, type Chapter } from "../lib/epub";
import { isEntryPoint } from "../lib/entry";
import type { BkChapter, BkEvent, BkFigure, BreakneckBook, ChapterId } from "../../../lib/breakneck-shared";

const OUT_DIR = join(process.cwd(), "data", "global");
const OUT = join(OUT_DIR, "breakneck-book.json");
const BOOK_DIR = join(process.cwd(), "data");

export const BOOK = {
  title: "Breakneck",
  subtitle: "China's Quest to Engineer the Future",
  author: "Dan Wang",
  publisher: "W. W. Norton & Company",
  year: 2025,
  isbn: "9781324106036",
};

export const CHAPTERS: Record<string, { id: ChapterId; n: string; title: string }> = {
  "text/06_Introduction": { id: "intro", n: "Intro", title: "Introduction" },
  "text/08_Chapter01": { id: "c1", n: "1", title: "Engineers vs. Lawyers" },
  "text/09_Chapter02": { id: "c2", n: "2", title: "Building Big" },
  "text/10_Chapter03": { id: "c3", n: "3", title: "Tech Power" },
  "text/11_Chapter04": { id: "c4", n: "4", title: "One Child" },
  "text/12_Chapter05": { id: "c5", n: "5", title: "Zero-Covid" },
  "text/13_Chapter06": { id: "c6", n: "6", title: "Fortress China" },
  "text/14_Chapter07": { id: "c7", n: "7", title: "Learning to Love Engineers" },
};

export interface FigureSpec extends Omit<BkFigure, "page"> {
  verify: string;
  also?: string[];
}

const A = "the author";

export const FIGURES: FigureSpec[] = [
  /* ── 1. Engineers vs. Lawyers ─────────────────────────────────────────── */
  { id: "pbsc-engineers", ch: "c1", label: "Members of the Politburo standing committee trained as engineers, 2002", value: 9, unit: "of 9", year: "2002", credit: A,
    verify: "By 2002, all nine members of the Politburo’s standing committee" },
  { id: "highways-vs-us", ch: "c1", label: "Highways built since 1980, against the US systems", value: 2, unit: "× US length", credit: A,
    verify: "an expanse of highways equal to twice the length of the US systems", also: ["Since 1980, after Deng’s reforms began"] },
  { id: "hsr-vs-japan", ch: "c1", label: "High-speed rail network against Japan's", value: 20, unit: "× Japan", credit: A,
    verify: "a high-speed rail network twenty times more extensive than Japan’s" },
  { id: "presidents-law", ch: "c1", label: "Of the last ten US presidents, attended law school", value: 5, unit: "of 10", credit: A,
    verify: "Five out of the last ten presidents attended law school" },
  { id: "congress-law", ch: "c1", label: "Share of Congress with law degrees, in any year", value: 50, unit: "%", hedge: "at least", credit: A,
    verify: "at least half the US Congress has law degrees" },
  { id: "engineer-presidents", ch: "c1", label: "US presidents who worked as engineers", value: 2, unit: "presidents", credit: A,
    verify: "only two American presidents worked as engineers" },
  { id: "politburo-size", ch: "c1", label: "Members of the Politburo", value: 24, unit: "men", credit: A,
    verify: "the twenty-four men who make up the Political Bureau" },
  { id: "rail-length", ch: "c1", label: "Length of each high-speed line, Beijing–Shanghai and San Francisco–Los Angeles", value: 800, unit: "miles", hedge: "around", credit: A,
    verify: "Both lines would be around eight hundred miles long upon completion" },
  { id: "bjsh-cost", ch: "c1", label: "Beijing–Shanghai high-speed line, opened 2011", value: 36e9, unit: "US$", year: "2011", credit: A,
    verify: "China opened the Beijing–Shanghai line in 2011 at a cost of $36 billion" },
  { id: "bjsh-trips", ch: "c1", label: "Passenger trips on the Beijing–Shanghai line in its first decade", value: 1.35e9, unit: "trips", credit: A,
    verify: "In its first decade of operation, it completed 1.35 billion passenger trips" },
  { id: "ca-cost", ch: "c1", label: "Latest estimate for California's high-speed rail", value: 128e9, unit: "US$", credit: "official estimate",
    verify: "The latest estimate for California’s rail line is $128 billion" },
  { id: "ca-opening", ch: "c1", label: "First segment of California's line to start operating", value: 2030, value2: 2033, unit: "year", credit: "official estimates",
    verify: "The first segment of California’s train will start operating, according to official estimates, between 2030 and 2033" },
  { id: "ca-years", ch: "c1", label: "Years since the 2008 ballot proposition, with a small stretch of rail built", value: 17, unit: "years", credit: A,
    verify: "California has built, seventeen years after the ballot proposition, a small stretch of rail", also: ["The year 2008 offers a direct comparison between California’s speed and China’s speed"] },
  { id: "lawyers-per-100k", ch: "c1", label: "US lawyers per hundred thousand people — three times the European average", value: 400, unit: "per 100,000", credit: A,
    verify: "four hundred lawyers per hundred thousand people, which is three times higher than the average in European countries" },
  { id: "valuations-erased", ch: "c1", label: "Corporate valuations Xi erased in a few months", value: 1e12, unit: "US$", credit: A,
    verify: "Xi Jinping could erase a trillion dollars from corporate valuations" },
  { id: "uighurs", ch: "c1", label: "Uighurs who have spent time in detention camps", value: 1e6, unit: "people", hedge: "perhaps over", credit: A,
    verify: "perhaps over a million Uighurs have spent time in detention camps" },

  /* ── 2. Building Big ──────────────────────────────────────────────────── */
  { id: "bike-miles", ch: "c2", label: "Miles cycled through Guizhou in five days", value: 400, unit: "miles", hedge: "nearly", credit: A,
    verify: "Over five days, we cycled nearly four hundred miles through Guizhou province" },
  { id: "fast-aperture", ch: "c2", label: "Aperture of the world's largest radio telescope, in Guizhou", value: 500, unit: "metres", credit: A,
    verify: "with an aperture measuring five hundred meters in diameter" },
  { id: "guitars", ch: "c2", label: "Guitars made worldwide that come from Zheng'an County", value: 7, unit: "one in", credit: "state media",
    verify: "one of every seven guitars made worldwide is produced in this township" },
  { id: "gz-bridges", ch: "c2", label: "Of the world's 100 highest bridges, in Guizhou", value: 45, unit: "of 100", credit: A,
    verify: "Guizhou has built forty-five of the world’s one hundred highest bridges" },
  { id: "gz-airports", ch: "c2", label: "Airports in Guizhou, with 3 more under construction", value: 11, value2: 3, unit: "airports", credit: A,
    verify: "It has eleven airports, with three more under construction" },
  { id: "gz-expressways", ch: "c2", label: "Miles of expressway in Guizhou, fourth among provinces", value: 5000, unit: "miles", credit: A,
    verify: "It has five thousand miles of expressways, ranked fourth among provinces in China by length" },
  { id: "gz-hsr", ch: "c2", label: "Miles of high-speed track in Guizhou", value: 1000, unit: "miles", hedge: "around", credit: A,
    verify: "It has around a thousand miles of high-speed train track" },
  { id: "gz-income", ch: "c2", label: "Guizhou income per head — Botswana's, 40% below China's average", value: 8000, unit: "US$", credit: A,
    verify: "At $8,000 per capita, the province has the income of Botswana, 40 percent below China’s national average" },
  { id: "gz-highschool", ch: "c2", label: "Guizhou children attending high school, 2010 — the lowest rate in China", value: 50, unit: "%", year: "2010", credit: A,
    verify: "In 2010, only half of Guizhou’s children attended high school" },
  { id: "gz-vs-ny", ch: "c2", label: "Guizhou's highways against New York State's, on a fifteenth of the household income", value: 3, unit: "× New York", credit: A,
    verify: "household income is one-fifteenth that of New York State", also: ["three times the length of New York’s highways"] },
  { id: "gz-airports-idle", ch: "c2", label: "Of Guizhou's 11 airports, with fewer than 12 flights a week", value: 5, unit: "of 11", credit: A,
    verify: "Of Guizhou’s eleven airports, five have less than a dozen flights each week" },
  { id: "gz-income-growth", ch: "c2", label: "Annual growth of Guizhou incomes, 2011–2022", value: 10, unit: "% a year", hedge: "nearly", credit: A,
    verify: "Guizhou incomes have risen by nearly 10 percent annually from 2011 to 2022" },
  { id: "liupanshui-projects", ch: "c2", label: "Tourism projects one Liupanshui party secretary authorised in three years", value: 23, unit: "projects", credit: A,
    verify: "In the three years that Li was party secretary of Liupanshui, he authorized twenty-three tourism projects" },
  { id: "liupanshui-debt", ch: "c2", label: "New debt Liupanshui got for them", value: 21e9, unit: "US$", credit: A,
    verify: "All that the city got for its troubles was $21 billion of new debt" },
  { id: "expressway-first", ch: "c2", label: "China's first interprovincial expressway opens", value: 1993, unit: "year", credit: A,
    verify: "China’s first interprovincial expressway opened in 1993" },
  { id: "expressway-pace", ch: "c2", label: "Years to build a highway network the length of the US interstates — the second took half that", value: 18, unit: "years", credit: A,
    verify: "The first expanse of highways took eighteen years to build; the second took half that time" },
  { id: "cars", ch: "c2", label: "Cars in China, 1990 and 2024", value: 0.5e6, value2: 435e6, unit: "cars", credit: A,
    verify: "In 1990, there were half a million automobiles in the country; in 2024, there were 435 million" },
  { id: "subway-cities", ch: "c2", label: "Chinese cities with subways in 2025, of which 11 are longer than New York's", value: 51, value2: 11, unit: "cities", year: "2025", credit: A,
    verify: "In 2025, fifty-one Chinese cities have subway lines, eleven of which are longer than New York’s" },
  { id: "hsr-vs-spain", ch: "c2", label: "High-speed network against Spain's and Japan's (second and third)", value: 10, unit: "× their length", credit: A,
    verify: "ten times the length of Spain’s and Japan’s" },
  { id: "hsr-trips", ch: "c2", label: "High-speed rail passenger trips a year", value: 2e9, unit: "trips", hedge: "around", credit: A,
    verify: "This system completes around two billion passenger trips each year" },
  { id: "nuclear-first", ch: "c2", label: "First commercial nuclear plant: United States 1957, China 1991", value: 1957, value2: 1991, unit: "year", credit: A,
    verify: "In 1957, the world’s first commercial nuclear plant started producing electricity in Pennsylvania", also: ["In 1991, China's first commercial nuclear power plant started producing electricity"] },
  { id: "nuclear-plants", ch: "c2", label: "Nuclear plants in 2025: China 55, United States 54", value: 55, value2: 54, unit: "plants", year: "2025", credit: A,
    verify: "By 2025, China caught up to the United States in the number of nuclear plants: fifty-five and fifty-four, respectively" },
  { id: "nuclear-building", ch: "c2", label: "Reactors under construction: China 31, United States 1", value: 31, value2: 1, unit: "reactors", credit: A,
    verify: "it has just one under construction. Meanwhile, thirty-one are under construction in China" },
  { id: "vogtle", ch: "c2", label: "The only US nuclear plant of this century: 15 years and $30 billion", value: 15, value2: 30e9, unit: "years, US$", credit: A,
    verify: "The only US nuclear plant built in the twenty-first century took fifteen years and $30 billion" },
  { id: "eleven-reactors", ch: "c2", label: "Reactors China approved in August 2024, expected to cost the same", value: 11, unit: "reactors", year: "2024", credit: A,
    verify: "In August 2024, China’s nuclear authority approved construction of eleven new reactors" },
  { id: "urban-growth", ch: "c2", label: "Added to China's urban population each year since 1978, on average", value: 16e6, unit: "people a year", credit: A,
    verify: "Its urban population has grown by an average of sixteen million people each year since 1978" },
  { id: "price-income", ch: "c2", label: "Urban apartment price in years of household income, 2007 and 2018", value: 9, value2: 7, unit: "× income", credit: A,
    verify: "From 2007 to 2018, the average price of an urban apartment fell from nine times the average household income to seven times" },
  { id: "cement", ch: "c2", label: "Cement China made in 2018–2019 — nearly all the US made in the twentieth century", value: 4.4e9, unit: "tons", credit: "Vaclav Smil",
    verify: "the 4.4 billion tons of cement that China produced from 2018 to 2019 nearly equals the amount of cement the United States produced over the entire twentieth century" },
  { id: "shanghai-parks", ch: "c2", label: "New parks a year Shanghai vowed, to reach 1,000 by 2025", value: 120, value2: 1000, unit: "parks", credit: A,
    verify: "Shanghai has vowed to open 120 new parks every year until 2025, when the city will reach 1,000 green spaces" },
  { id: "doubling", ch: "c2", label: "At 10% growth a year, the economy doubles about every 7 years", value: 7, unit: "years", credit: A,
    verify: "growth rates of 10 percent a year, it would feel like their country was reborn roughly every seven years" },
  { id: "hsr-cost-mile", ch: "c2", label: "High-speed rail cost per mile: China $33m, 40% below Europe, 80% below California's $192m", value: 33e6, value2: 192e6, unit: "US$ per mile", credit: "World Bank study (2019)",
    verify: "is about $33 million per mile, which is 40 percent cheaper than in Europe and 80 percent cheaper than California’s effort, which has seen costs balloon to $192 million per mile" },
  { id: "income-tax", ch: "c2", label: "Chinese spared from paying income tax", value: 75, unit: "%", hedge: "nearly", credit: A,
    verify: "Nearly three-quarters of China’s population are spared from paying income tax" },
  { id: "social-spending", ch: "c2", label: "Social spending as a share of GDP: China 10%, United States 20%, generous European states 30%", value: 10, value2: 20, unit: "% of GDP", series: [{ key: "China", value: 10 }, { key: "United States", value: 20 }, { key: "generous European states", value: 30 }], credit: A,
    verify: "Around 10 percent of its GDP goes toward social spending, compared to 20 percent in the United States and 30 percent among the more generous European states" },
  { id: "unemployed-covered", ch: "c2", label: "China's unemployed eligible for benefits", value: 10, unit: "%", hedge: "about", credit: A,
    verify: "Only about a tenth of China’s unemployed are eligible for modest benefits" },
  { id: "first-fyp", ch: "c2", label: "Industrial projects in the First Five-Year Plan, 1953", value: 700, unit: "projects", year: "1953", credit: A,
    verify: "which concentrated the state’s resources to build seven hundred industrial projects", also: ["Xi was born in 1953, the year that Beijing unveiled its First Five-Year Plan"] },
  { id: "urban-rail-plan", ch: "c2", label: "Urban rail the Fourteenth Five-Year Plan adds", value: 3000, unit: "km", credit: "Fourteenth Five-Year Plan",
    verify: "We will add 3,000 kilometers of urban rail transit", also: ["In 2020, Xi announced the Fourteenth Five-Year Plan"] },
  { id: "yarlung", ch: "c2", label: "Planned Yarlung Tsangpo hydropower against the Three Gorges Dam", value: 3, unit: "× Three Gorges", credit: A,
    verify: "which will have triple the power-generating capacity of the Three Gorges Dam" },
  { id: "tianjin-gdp", ch: "c2", label: "Tianjin's downward revision of its GDP, 2018", value: 20, unit: "%", hedge: "nearly", year: "2018", credit: A,
    verify: "In 2018, Tianjin acknowledged that Binhai’s growth was far overstated, forcing it to revise down its GDP by nearly 20 percent" },
  { id: "tianjin-tower", ch: "c2", label: "Floors in Tianjin's skyscraper, China's third-tallest, little occupied", value: 97, unit: "floors", credit: A,
    verify: "ninety-seven floors, little occupied" },
  { id: "megaregions", ch: "c2", label: "Average population of China's five largest urban regions — each nearly Japan", value: 110e6, unit: "people", credit: A,
    verify: "average 110 million people, each nearly the population of Japan", also: ["designated a dozen urban regions for concentrated investments. The five largest"] },
  { id: "car-capacity", ch: "c2", label: "China's car-making capacity against a global market of about ninety million", value: 60e6, value2: 90e6, unit: "cars a year", hedge: "around", credit: A,
    verify: "China now has the capacity to produce around sixty million cars a year", also: ["out of an annual global market of around ninety million cars sold"] },
  { id: "car-brands", ch: "c2", label: "Automotive brands in China", value: 100, unit: "brands", hedge: "over", credit: A,
    verify: "The country has over a hundred automotive brands" },
  { id: "us-checks", ch: "c2", label: "US pandemic cash payments to households, three rounds", value: 3200, unit: "US$", credit: A,
    verify: "three rounds totaling $3,200" },
  { id: "trade-surplus", ch: "c2", label: "China's record trade surplus, 2022", value: 1e12, unit: "US$", hedge: "almost", year: "2022", credit: A,
    verify: "China’s trade surplus hit a record high in 2021, and then again in 2022, approaching almost a trillion dollars" },
  { id: "economy-x8", ch: "c2", label: "Real growth of China's economy, 1992–2018 — while its stock index lagged", value: 8, unit: "×", credit: A,
    verify: "the economy has grown by a factor of eight in real terms between 1992 and 2018" },
  { id: "henan-flood", ch: "c2", label: "Drowned in a Henan subway train in the floods", value: 14, unit: "people", credit: "official numbers",
    verify: "fourteen people drowned in a subway train, according to official numbers" },
  { id: "guangdong-flood", ch: "c2", label: "Displaced by Guangdong floods, 2024", value: 100000, unit: "people", hedge: "more than", year: "2024", credit: A,
    verify: "floods that displaced more than a hundred thousand people in Guangdong in 2024" },
  { id: "three-gorges", ch: "c2", label: "People resettled for the Three Gorges Dam", value: 1.5e6, unit: "people", hedge: "up to", credit: A,
    verify: "Building it has demanded the resettlement of up to 1.5 million people", also: ["The world’s biggest dam is the Three Gorges Dam"] },
  { id: "sichuan-schools", ch: "c2", label: "Children killed in collapsed schools, Sichuan earthquake 2008", value: 5000, unit: "children", year: "2008", credit: "official figures",
    verify: "The 2008 earthquake that tore through Sichuan also shattered thousands of schoolrooms, killing five thousand children (according to official figures)" },
  { id: "icu-beds", ch: "c2", label: "Intensive-care beds per head, against the United States", value: 6, unit: "× fewer", credit: A,
    verify: "six times fewer intensive care unit beds per capita than in the United States" },
  { id: "flood-package", ch: "c2", label: "Flood-prevention package announced after sluggish 2023", value: 140e9, unit: "US$", credit: A,
    verify: "After a year of sluggish growth at the end of 2023, Beijing announced it would spend a cool one trillion renminbi (or $140 billion) on flood prevention" },
  { id: "infra-gdp", ch: "c2", label: "Infrastructure investment as a share of GDP: China 13.5% (2016), US about 3%", value: 13.5, value2: 3, unit: "% of GDP", credit: A,
    verify: "China spent 13.5 percent of its GDP on infrastructure investment in 2016, whereas the US average over the past three decades is closer to 3 percent each year" },
  { id: "metro-north", ch: "c2", label: "Express train New York–New Haven, 1915 and 2025", value: 2, unit: "hours", hedge: "around", credit: "Metro North timetable",
    verify: "took the same amount of time then as in 2025: around two hours", also: ["I came across a Metro North timetable from 1915"] },
  { id: "cape-wind", ch: "c2", label: "Years of lawsuits before Cape Wind, the first US offshore wind project, was abandoned", value: 16, unit: "years", credit: A,
    verify: "After sixteen years of lawsuits, the developer abandoned the project" },
  { id: "offshore-wind", ch: "c2", label: "US offshore wind in 2024: operating, under construction, in permitting", value: 42, value2: 20978, unit: "MW", year: "2024", series: [{ key: "operating", value: 42 }, { key: "under construction", value: 932 }, { key: "in permitting", value: 20978 }], credit: A,
    verify: "In 2024, the United States had 42 megawatts of operational offshore wind production, 932 megawatts under construction, and an astounding 20,978 megawatts undergoing permitting review" },
  { id: "wind-2023", ch: "c2", label: "New wind capacity in 2023: United States 6 GW, China 76 GW", value: 6, value2: 76, unit: "GW", year: "2023", credit: A,
    verify: "In 2023, while the United States added 6 gigawatts of new wind installations, China added 76" },
  { id: "wind-solar-g7", ch: "c2", label: "China's 2023 wind and solar build against the rest of the G-7 combined", value: 4, unit: "×", year: "2023", credit: A,
    verify: "four times more than the rest of the G-7 group of rich countries put together", also: ["In 2023, while the United States added 6 gigawatts of new wind installations"] },

  /* ── 3. Tech Power ────────────────────────────────────────────────────── */
  { id: "shenzhen-pop", ch: "c3", label: "Shenzhen's population: 1980, 2000, 2020", value: 300000, value2: 18e6, unit: "people", series: [{ key: "1980", value: 300000 }, { key: "2000", value: 7e6 }, { key: "2020", value: 18e6 }], credit: A,
    verify: "Its population soared from three hundred thousand in 1980 to seven million in 2000 and eighteen million in 2020" },
  { id: "foxconn-acres", ch: "c3", label: "Foxconn's Shenzhen campus", value: 500, unit: "acres", credit: A,
    verify: "occupies five hundred acres" },
  { id: "foxconn-workers", ch: "c3", label: "Workers on Foxconn's Shenzhen campus at peak — as many as live in Pittsburgh", value: 300000, unit: "workers", credit: A,
    verify: "At the peak times, three hundred thousand people work at Foxconn’s Shenzhen campus" },
  { id: "foxconn-food", ch: "c3", label: "What the campus ate each day: 40 tons of rice, 20 of pork, 10 of flour, 500 barrels of oil", value: 40, unit: "tons of rice", series: [{ key: "tons of rice", value: 40 }, { key: "tons of pork", value: 20 }, { key: "tons of flour", value: 10 }, { key: "barrels of cooking oil", value: 500 }], credit: "a Chinese report, 2009",
    verify: "the campus each day consumed forty tons of rice, twenty tons of pork, ten tons of flour, and five hundred barrels of cooking oil" },
  { id: "foxconn-dorm", ch: "c3", label: "Workers to a dormitory room", value: 6, unit: "people", hedge: "up to", credit: A,
    verify: "with up to six men or women crammed into one room" },
  { id: "foxconn-netting", ch: "c3", label: "Mesh netting put up around dormitories after the 2010 suicides", value: 3e6, unit: "square metres", credit: A,
    verify: "three million square meters of mesh netting", also: ["attempted suicide by jumping from factory dormitories in 2010"] },
  { id: "zhengzhou", ch: "c3", label: "Peak workforce at Foxconn Zhengzhou", value: 350000, unit: "workers", hedge: "around", credit: A,
    verify: "Zhengzhou has the capacity to employ around 350,000 people" },
  { id: "student-interns", ch: "c3", label: "High-school students made to assemble iPhones in Henan, 2017", value: 3000, unit: "students", hedge: "up to", year: "2017", credit: "Financial Times",
    verify: "In 2017, the Financial Times reported that up to three thousand high school students had to work on assembly lines" },
  { id: "apple-seats", ch: "c3", label: "Business-class seats Apple booked daily, San Francisco to Shanghai — $35m a year", value: 50, unit: "seats a day", credit: "United Airlines",
    verify: "Apple booked fifty business-class seats daily from San Francisco to Shanghai, from which the airline made $35 million each year" },
  { id: "apple-engineers", ch: "c3", label: "Time to hire 9,000 industrial engineers: 9 months in the US, 2 weeks in China", value: 9, value2: 2, unit: "months, weeks", series: [{ key: "engineers", value: 9000 }, { key: "months in the US", value: 9 }, { key: "weeks in China", value: 2 }], credit: "New York Times, 2012",
    verify: "expected recruitment to last nine months to hire that many engineers in the United States. In China, they were able to do it in two weeks", also: ["Apple needed to hire nearly nine thousand industrial engineers"] },
  { id: "iphone-2007", ch: "c3", label: "China's share of the iPhone's value, 2007", value: 4, unit: "%", hedge: "around", year: "2007", credit: A,
    verify: "which was around 4 percent of the phone’s final value", also: ["In 2007, Apple imported nearly all of the high-valued components"] },
  { id: "iphone-x", ch: "c3", label: "China's share of the iPhone X's value, 2017", value: 25, unit: "%", hedge: "around", year: "2017", credit: "a teardown analysis",
    verify: "China’s contribution to the iPhone X reached around 25 percent of the final value of the phone", also: ["By the time that the iPhone X was released in 2017"] },
  { id: "nobels", ch: "c3", label: "Science Nobels: Japan more than 20, China 1", value: 20, value2: 1, unit: "prizes", credit: A,
    verify: "Japanese researchers have earned more than twenty Nobel Prizes in the sciences, only one has ever been awarded" },
  { id: "ise", ch: "c3", label: "The Ise shrine, rebuilt every 20 years since 690 AD", value: 20, unit: "years", credit: A,
    verify: "Since it was first erected in 690 AD, craftspeople have completely rebuilt its sacred temples—made of wood and hay—every twenty years" },
  { id: "fogbank", ch: "c3", label: "Cost to relearn how to make Fogbank, a forgotten nuclear-weapon material", value: 69e6, unit: "US$", credit: A,
    verify: "The NNSA then spent $69 million to relearn how to produce this material" },
  { id: "us-mfg-jobs", ch: "c3", label: "US manufacturing workers: 1980, 2000, 2010, 2025", value: 19e6, value2: 13e6, unit: "workers", series: [{ key: "1980", value: 19e6 }, { key: "2000", value: 17e6 }, { key: "2010", value: 11e6 }, { key: "2025", value: 13e6 }], credit: A,
    verify: "US manufacturing employment peaked in 1980 at nineteen million workers. In 2000, it still had seventeen million",
    also: ["when the workforce fell to just eleven million in 2010. In 2025, the United States has around thirteen million manufacturing workers"] },
  { id: "us-defense", ch: "c3", label: "US defence spending a year — as much as the next ten countries", value: 1e12, unit: "US$", hedge: "nearly", credit: A,
    verify: "The United States spends nearly $1 trillion a year on defense, about as much as the next ten countries combined" },
  { id: "navy-delays", ch: "c3", label: "Every class of US Navy ship and submarine, behind schedule", value: 1, value2: 3, unit: "years", credit: "US Navy",
    verify: "every single class of its ships and submarines is one to three years behind schedule" },
  { id: "byd-tesla", ch: "c3", label: "BYD when Tesla's Shanghai plant opened, 2019: sales −11%, profits −42%", value: 11, value2: 42, unit: "% fall", year: "2019", credit: A,
    verify: "BYD saw its sales decline by 11 percent, while profits fell by 42 percent", also: ["When Tesla vehicles started rolling out of the Shanghai Gigafactory in 2019"] },
  { id: "mfg-workforce", ch: "c3", label: "China's manufacturing workforce — about eight times America's", value: 100e6, unit: "workers", hedge: "more than", credit: A,
    verify: "China’s manufacturing workforce employs more than a hundred million people, around eight times that of the United States" },
  { id: "apple-suppliers", ch: "c3", label: "Of Apple's top 200 suppliers, with sites in China (2023)", value: 156, value2: 72, unit: "of 200", year: "2023", credit: "Apple supplier report",
    verify: "156 of its top 200 suppliers have manufacturing sites in China. Seventy-two of them are in Shenzhen’s province of Guangdong, which is as many as there are in the United States, Vietnam, and India combined", also: ["According to Apple’s most recent supplier report (released in 2023)"] },
  { id: "un-categories", ch: "c3", label: "UN industrial product categories in which China makes something", value: 419, unit: "of 419", credit: "China's industry minister, 2024",
    verify: "it produces something in each of the 419 industrial product categories maintained by the United Nations" },
  { id: "mfg-share", ch: "c3", label: "Manufacturing share of GDP: China 28%, Germany 21%, Japan 20%, US and UK about 10%", value: 28, value2: 10, unit: "% of GDP", series: [{ key: "China", value: 28 }, { key: "Germany", value: 21 }, { key: "Japan", value: 20 }, { key: "United States", value: 10 }, { key: "United Kingdom", value: 10 }], credit: A,
    verify: "Manufacturing already accounts for 28 percent of China’s GDP, which is much higher than Germany’s 21 percent and Japan’s 20 percent",
    also: ["like the United States and the United Kingdom (both around 10 percent)"] },

  /* ── 4. One Child ─────────────────────────────────────────────────────── */
  { id: "pop-2100", ch: "c4", label: "China's projected population in 2100 — half today's", value: 700e6, unit: "people", year: "2100", credit: "projection",
    verify: "By 2100, China’s population is projected to halve to seven hundred million" },
  { id: "births", ch: "c4", label: "Births in China: 2019 and 2023", value: 15e6, value2: 9e6, unit: "births", series: [{ key: "2019", value: 15e6 }, { key: "2023", value: 9e6 }], credit: "official",
    verify: "In 2019, China had fifteen million births; four years later, it fell to nine million" },
  { id: "marriages", ch: "c4", label: "Chinese who married in 2024 — half the level of a decade before", value: 6e6, unit: "people", year: "2024", credit: A,
    verify: "Six million Chinese married in 2024, half the level of a decade ago" },
  { id: "tfr", ch: "c4", label: "Lifetime children per family: 1.0, against 2.1 for a stable population", value: 1.0, value2: 2.1, unit: "children", credit: A,
    verify: "a lifetime average of 1.0 children , far below the 2.1 children needed for a stable population" },
  { id: "pop-1949", ch: "c4", label: "Officials' guess at China's population, 1949", value: 500e6, unit: "people", hedge: "around", year: "1949", credit: "officials' guess",
    verify: "Officials guessed that China’s population might be around five hundred million people", also: ["In 1949, China was the world’s most populous nation"] },
  { id: "pop-1953", ch: "c4", label: "1953 census count", value: 600e6, unit: "people", hedge: "nearly", year: "1953", credit: "census",
    verify: "When the 1953 census counted nearly six hundred million" },
  { id: "pop-1966", ch: "c4", label: "Population before the Cultural Revolution", value: 700e6, unit: "people", hedge: "over", credit: A,
    verify: "Before Mao launched the Cultural Revolution, China’s population surpassed seven hundred million" },
  { id: "pop-1978", ch: "c4", label: "Population at the end of 1978", value: 1e9, unit: "people", hedge: "nearly", year: "1978", credit: "statistical authorities",
    verify: "the population numbered nearly one billion people at the end of 1978" },
  { id: "song-projection", ch: "c4", label: "Song Jian's projection at three children per woman: three billion by 2050, over four billion by 2080", value: 3e9, value2: 4e9, unit: "people", credit: "Song Jian's model",
    verify: "then the country would have three billion people by 2050 and over four billion by 2080", also: ["at the rate of 3.0 children per woman"] },
  { id: "song-optimal", ch: "c4", label: "Song Jian's 'optimal' population", value: 700e6, unit: "people", hedge: "no more than", credit: "Song Jian's model",
    verify: "China’s optimal population was no more than seven hundred million" },
  { id: "policy-adopted", ch: "c4", label: "Beijing adopts the one-child policy", value: 1980, unit: "year", credit: A,
    verify: "Beijing adopted the one-child policy in 1980" },
  { id: "open-letter", ch: "c4", label: "Target in the party's open letter: keep the population below 1.2 billion by the end of the century", value: 1.2e9, unit: "people", credit: "the party's open letter",
    verify: "In order to keep China’s population below 1.2 billion by the end of this century" },
  { id: "documents", ch: "c4", label: "Documents a woman needed to have a first child, 1990", value: 12, unit: "documents", hedge: "up to", year: "1990", credit: A,
    verify: "By 1990, in order to have a first child, a woman needed up to twelve documents" },
  { id: "fertility-urban-rural", ch: "c4", label: "Children per couple when the policy began: about 1.0 in cities, 2.5 in villages", value: 1.0, value2: 2.5, unit: "children", credit: A,
    verify: "urban fertility rates were already trending toward 1.0 child per couple", also: ["rural fertility was closer to 2.5"] },
  { id: "census-1982", ch: "c4", label: "Population added in the 18 years to the 1982 census", value: 300e6, unit: "people", credit: "1982 census",
    verify: "China’s population increased by three hundred million in those eighteen years, becoming the first country ever to surpass one billion people", also: ["In 1982, China was finally organized enough to undertake its first census since 1964"] },
  { id: "campaign-1983", ch: "c4", label: "Sterilisations and abortions, 1983 against 1975", value: 16e6, value2: 14e6, unit: "procedures", year: "1983", series: [{ key: "sterilisations 1975", value: 3e6 }, { key: "sterilisations 1983", value: 16e6 }, { key: "abortions 1975", value: 5e6 }, { key: "abortions 1983", value: 14e6 }], credit: A,
    verify: "the state sterilized sixteen million women and carried out fourteen million abortions. By comparison, in the pre-policy year of 1975, the state performed only three million sterilizations and five million abortions" },
  { id: "persuasion", ch: "c4", label: "Visits to persuade a woman to abort: 10 on average, up to 100", value: 10, value2: 100, unit: "visits", credit: "a Guangdong official, New York Times 1982",
    verify: "each person takes 10 times to be persuaded. The most difficult person can take up to 100 times" },
  { id: "sterilized-share", ch: "c4", label: "Married women of reproductive age sterilised by 1999", value: 35, unit: "%", year: "1999", credit: "health ministry statistics",
    verify: "by 1999, China’s health ministry statistics show that 35 percent of married women of reproductive age had been sterilized" },
  { id: "tubal-vasectomy", ch: "c4", label: "Women's tubal ligations for every vasectomy", value: 4, unit: "to 1", credit: A,
    verify: "four women received a tubal ligation for every vasectomy" },
  { id: "enforcer-training", ch: "c4", label: "Birth-planning enforcers with any medical training", value: 8, unit: "one in", credit: A,
    verify: "only one in eight received any medical training" },
  { id: "sex-ratio", ch: "c4", label: "Boys born per 100 girls: 120 in 1999, 111 now", value: 120, value2: 111, unit: "per 100 girls", credit: "official",
    verify: "120 boys born for every 100 girls in 1999. That ratio has since declined to 111 boys to 100 girls" },
  { id: "missing-women", ch: "c4", label: "Women 'missing'", value: 40e6, unit: "women", hedge: "around", credit: "demographers' estimate",
    verify: "around forty million women are" },
  { id: "commission-size", ch: "c4", label: "The birth-planning apparatus: 500,000 staff, 1.2m enforcers, 6m village officials", value: 500000, value2: 6e6, unit: "people", hedge: "over", series: [{ key: "commission staff", value: 500000 }, { key: "local enforcers", value: 1.2e6 }, { key: "village officials", value: 6e6 }], credit: A,
    verify: "over 500,000 workers, 1.2 million local enforcers, and 6 million village officials engaged in enforcement" },
  { id: "fines", ch: "c4", label: "Fines the commission collected over its lifetime", value: 200e9, unit: "US$", credit: "state media",
    verify: "It collected $200 billion in fines over its lifetime, according to state media" },
  { id: "policy-totals", ch: "c4", label: "Over 35 years: abortions, and women and men sterilised", value: 321e6, value2: 108e6, unit: "procedures", series: [{ key: "abortions", value: 321e6 }, { key: "women sterilised", value: 108e6 }, { key: "men sterilised", value: 26e6 }], credit: A,
    verify: "China performed a total of 321 million abortions", also: ["sterilized 108 million women and 26 million men", "Over the thirty-five years of the one-child era"] },
  { id: "policy-relaxed", ch: "c4", label: "Two-child policy 2015, three-child policy 2021", value: 2015, value2: 2021, unit: "year", credit: A,
    verify: "The one-child policy became a two-child policy in 2015, then a three-child policy in 2021" },
  { id: "adoptions", ch: "c4", label: "Children sent abroad for adoption, almost all girls", value: 150000, unit: "children", hedge: "more than", credit: A,
    verify: "more than 150,000 children had been sent abroad" },
  { id: "abortions-1991", ch: "c4", label: "Abortions in 1991, the second-highest year", value: 14e6, unit: "abortions", year: "1991", credit: A,
    verify: "fourteen million, a few hundred thousand shy of the peak enforcement year of 1983" },
  { id: "pop-growth-since", ch: "c4", label: "Population growth since the policy began", value: 40, unit: "%", credit: A,
    verify: "China’s population has increased by 40 percent since the start of the one-child policy" },
  { id: "fertility-fall", ch: "c4", label: "Children per woman: about 6.0 in 1970, already 2.7 when the policy began", value: 6.0, value2: 2.7, unit: "children", credit: A,
    verify: "China’s fertility rate was around 6.0 per woman at the start of 1970; a decade later, when the state implemented the one-child policy, the fertility rate had already fallen to 2.7" },
  { id: "births-prevented", ch: "c4", label: "Births state media claims family planning prevented", value: 400e6, unit: "births", credit: "state media (disputed by demographers)",
    verify: "prevented four hundred million births" },
  { id: "japan-richer", ch: "c4", label: "When Japan's population began to fall, 14 years before China's, it was more than twice as rich", value: 14, unit: "years earlier", credit: A,
    verify: "fourteen years before China’s", also: ["it was more than twice as rich"] },
  { id: "men-surplus", ch: "c4", label: "More Chinese men than women", value: 40e6, unit: "people", hedge: "approximately", credit: A,
    verify: "There are approximately forty million more Chinese men than women" },
  { id: "want-few", ch: "c4", label: "Women born after 1995 who want one child or none", value: 50, unit: "%", year: "2021", credit: "Chinese General Social Survey 2021",
    verify: "Half of all Chinese women born after 1995 told the Chinese general social survey of 2021 that they desire one or zero children" },
  { id: "divorce", ch: "c4", label: "Divorce applications granted: 70% mid-2000s, 40% a decade later", value: 70, value2: 40, unit: "%", credit: A,
    verify: "70 percent of divorce applications were granted in the mid-2000s, a rate that fell to 40 percent a decade later" },
  { id: "ivf", ch: "c4", label: "Hospitals authorised to offer IVF", value: 600, unit: "hospitals", credit: A,
    verify: "The country has only six hundred hospitals officially authorized to offer in vitro fertilization services" },
  { id: "vasectomies", ch: "c4", label: "Vasectomies: 181,000 in 2014, fewer than 5,000 in 2019", value: 181000, value2: 5000, unit: "a year", credit: "national health yearbooks",
    verify: "They fell from 181,000 in 2014 (the start of Xi’s rule) to fewer than 5,000 in 2019" },

  /* ── 5. Zero-Covid ────────────────────────────────────────────────────── */
  { id: "opium", ch: "c5", label: "Share of the world's narcotics consumed in early-1900s Shanghai", value: 90, unit: "%", hedge: "perhaps", credit: A,
    verify: "consuming perhaps 90 percent of the world’s narcotic drugs" },
  { id: "lockdown-pop", ch: "c5", label: "People in Shanghai, mostly unable to leave home for two months", value: 25e6, unit: "people", year: "2022", credit: A,
    verify: "a lockdown for the city of twenty-five million, who were mostly unable to step foot outside their residence for two months", also: ["The pleasures of Shanghai curdled in the spring of 2022"] },
  { id: "lockdown-promised", ch: "c5", label: "Promised length of Shanghai's 'quiet period'", value: 8, unit: "days", credit: "Shanghai government",
    verify: "a “quiet period” that would last eight days" },
  { id: "lockdown-actual", ch: "c5", label: "Actual length of the lockdown", value: 8, unit: "weeks", credit: A,
    verify: "Instead of lasting eight days, the lockdown lasted eight weeks, finally reopening in June" },
  { id: "puxi-notice", ch: "c5", label: "Extra days Puxi had to stock up; Pudong had hours", value: 4, unit: "days", credit: A,
    verify: "Puxi, the more populous western half where I lived, had four more days to prepare" },
  { id: "trucking", ch: "c5", label: "Shanghai trucking activity in mid-April 2022, against normal", value: 15, unit: "%", year: "2022", credit: A,
    verify: "In mid-April, trucking activity in Shanghai was only 15 percent of its normal level", also: ["The pleasures of Shanghai curdled in the spring of 2022"] },
  { id: "veg-price", ch: "c5", label: "What celebrities paid for a delivery of vegetables and eggs", value: 300, unit: "US$", hedge: "nearly", credit: A,
    verify: "they had to spend nearly $300 to have some vegetables and eggs delivered" },
  { id: "bread", ch: "c5", label: "A loaf of bread from a home baker during lockdown", value: 40, unit: "US$", credit: A,
    verify: "at $40 a loaf" },
  { id: "taxi", ch: "c5", label: "Taxi to the airport: $30 normally, $300 in lockdown", value: 30, value2: 300, unit: "US$", credit: A,
    verify: "A taxi to the airport that costs $30 in normal times shot up to $300" },
  { id: "quarantine-beds", ch: "c5", label: "Beds in Shanghai's largest convention centre, used for quarantine", value: 50000, unit: "beds", credit: "a CNN producer",
    verify: "which hosted fifty thousand beds" },
  { id: "wuhan-feast", ch: "c5", label: "People at a Wuhan community feast six miles from the market", value: 100000, unit: "people", credit: A,
    verify: "a community feast that attracted a hundred thousand people only six miles away from the Huanan Seafood Market" },
  { id: "wuhan-hospital", ch: "c5", label: "Days to build a new hospital in Wuhan", value: 11, unit: "days", credit: "state media livestream",
    verify: "a dozen excavators that built a new hospital in eleven days" },
  { id: "shower-code", ch: "c5", label: "Hours every two days a Shanghai University student's shower code was green", value: 5.5, unit: "hours", credit: "a Shanghai newspaper",
    verify: "which was green for five and a half hours every two days" },
  { id: "disneyland", ch: "c5", label: "Visitors trapped inside Shanghai Disneyland for most of a day, 2022", value: 30000, unit: "visitors", year: "2022", credit: A,
    verify: "had passed through it. Thirty thousand", also: ["visitors were trapped inside the park for much of a day in 2022"] },
  { id: "pcr-window", ch: "c5", label: "Age of the negative test needed to enter any public space", value: 72, unit: "hours", credit: A,
    verify: "negative PCR test taken in the past seventy-two hours" },
  { id: "bus-crash", ch: "c5", label: "Killed when a bus to quarantine overturned in Guizhou", value: 27, unit: "people", year: "2022", credit: A,
    verify: "overturned on hilly terrain in Guizhou, killing twenty-seven people", also: ["An earthquake struck Sichuan in September 2022"] },
  { id: "urumqi-fire", ch: "c5", label: "Died in the Urumqi fire, with fire trucks blocked by barricades", value: 10, unit: "people", year: "2022", credit: A,
    verify: "where ten people died after fire trucks were obstructed by pandemic-control barricades", also: ["An earthquake struck Sichuan in September 2022"] },
  { id: "testing-cost", ch: "c5", label: "Cost of mass testing, 2022", value: 1.8, unit: "% of GDP", year: "2022", credit: "Nomura economists",
    verify: "Economists from Nomura estimated that testing cost 1.8 percent of China’s GDP in 2022" },
  { id: "covid-deaths", ch: "c5", label: "Covid deaths: official count against scholarly estimates of excess deaths", value: 125000, value2: 2e6, unit: "deaths", credit: "official count; scholarly estimates",
    verify: "China announced a total of around 125,000 deaths related to Covid-19, an absurd undercount when scholarly estimates come to nearly 2 million excess deaths" },

  /* ── 6. Fortress China ────────────────────────────────────────────────── */
  { id: "shanghai-foreigners", ch: "c6", label: "Long-term foreign residents Shanghai lost, 2010–2020", value: 25, unit: "%", credit: A,
    verify: "Between 2010 and 2020, China’s most internationalized city lost a quarter of its long-term foreign residents" },
  { id: "millionaires", ch: "c6", label: "Millionaires emigrating from China: 2023 and 2024", value: 14000, value2: 15000, unit: "millionaires", credit: "a UK-based emigration firm",
    verify: "nearly 14,000 millionaires emigrated from China in 2023 and over 15,000 in 2024" },
  { id: "investor-visas", ch: "c6", label: "Chinese investor residencies: Canada 2,000 to 4,000 (2019–2023), US 3,900 to 7,500 (2019–2024)", value: 3900, value2: 7500, unit: "people", series: [{ key: "Canada 2019", value: 2000 }, { key: "Canada 2023", value: 4000 }, { key: "United States 2019", value: 3900 }, { key: "United States 2024", value: 7500 }], credit: "US and Canadian governments",
    verify: "from 2,000 to 4,000 in Canada between 2019 and 2023, and from 3,900 to 7,500 in the United States between 2019 and 2024" },
  { id: "border", ch: "c6", label: "Chinese nationals apprehended at the US southwest border: 2021 and 2024", value: 450, value2: 38000, unit: "people", credit: "US border officials",
    verify: "from 450 in 2021 rocketing to 38,000 in 2024" },
  { id: "games", ch: "c6", label: "Hours a week minors were allowed to play video games", value: 3, unit: "hours", credit: "press regulator",
    verify: "minors were permitted to play video games during only three designated hours per week" },
  { id: "crackdown", ch: "c6", label: "Market value the 2021 regulatory storm wiped out", value: 1e12, unit: "US$", year: "2021", credit: A,
    verify: "wiped out a trillion dollars of market value from Chinese companies", also: ["Over the course of 2021, hardly any major Chinese tech company emerged unscathed"] },
  { id: "new-oriental", ch: "c6", label: "New Oriental: market value lost, staff laid off", value: 90, value2: 60, unit: "%", credit: A,
    verify: "lost 90 percent of its market cap and then laid off 60 percent of its employees" },
  { id: "alibaba", ch: "c6", label: "Alibaba: $800 billion, then a quarter of that two years later", value: 800e9, unit: "US$", credit: A,
    verify: "Alibaba toppled from being an $800 billion company to just a quarter of that size two years later" },
  { id: "xi-score", ch: "c6", label: "How often Xi is right, by the author's reckoning — Deng scored Mao 70%", value: 60, unit: "%", hedge: "perhaps", credit: "the author's judgement",
    verify: "he is perhaps 60 percent correct on everything", also: ["Mao Zedong was 70 percent correct and 30 percent wrong"] },
  { id: "us-students", ch: "c6", label: "American students in China now — a tenth of pre-pandemic", value: 1000, unit: "students", hedge: "about", credit: A,
    verify: "there are only about a thousand American students studying in China. Just before the pandemic, there were ten times that many" },
  { id: "comedy-fine", ch: "c6", label: "Fine on the studio after a stand-up joke, 2023", value: 2e6, unit: "US$", year: "2023", credit: A,
    verify: "the studio that employed him fined $2 million", also: ["After a stand-up comic in Beijing made a joke in 2023"] },
  { id: "renminbi", ch: "c6", label: "Renminbi share of global payments", value: 3, unit: "%", credit: A,
    verify: "China’s renminbi accounts for 3 percent of global payments" },
  { id: "bri-loans", ch: "c6", label: "Belt and Road loans outstanding, in 150 countries", value: 1e12, value2: 150, unit: "US$, countries", credit: A,
    verify: "with $1 trillion worth of loans outstanding in 150 countries" },
  { id: "africa-share", ch: "c6", label: "Infrastructure projects in Africa that China builds", value: 4, unit: "one in", credit: "Deloitte",
    verify: "building one in four projects on the continent" },
  { id: "jakarta-bandung", ch: "c6", label: "Jakarta–Bandung high-speed rail: a billion dollars over budget, four years late", value: 1e9, value2: 4, unit: "US$, years", credit: A,
    verify: "Chinese builders went a billion dollars over budget and completed it four years late" },
  { id: "bri-forum", ch: "c6", label: "World leaders at the Belt and Road Forum: 120 in 2017, three dozen in 2023", value: 120, value2: 36, unit: "leaders", credit: A,
    verify: "when Xi Jinping was surrounded by 120 world leaders, and of the same forum in 2023, when there were only three dozen" },
  { id: "coal-2023", ch: "c6", label: "China's new coal capacity in 2023 against the rest of the world", value: 20, unit: "×", year: "2023", credit: A,
    verify: "in 2023, China added twenty times more coal-burning capacity than the rest of the world put together" },
  { id: "five-percent", ch: "c6", label: "Of China's economy: 50% dysfunctional, 5% doing superbly", value: 50, value2: 5, unit: "%", credit: "Greg Ip, Wall Street Journal",
    verify: "Though 50 percent of China’s economy might be dysfunctional, 5 percent is doing superbly well" },
  { id: "mfg-de-jp", ch: "c6", label: "Manufacturing workers: Germany eight million, Japan ten million", value: 8e6, value2: 10e6, unit: "workers", credit: A,
    verify: "Germany and Japan are mighty exporters with, respectively, eight million and ten million manufacturing workers" },
  { id: "stem-phd", ch: "c6", label: "STEM PhDs China graduates in 2025, against the United States", value: 2, unit: "×", hedge: "more than", year: "2025", credit: A,
    verify: "In 2025, China will graduate more than twice as many PhDs in STEM fields as the United States" },
  { id: "mic2025", ch: "c6", label: "Industries Made in China 2025 set out to dominate", value: 10, unit: "industries", credit: A,
    verify: "a sweeping plan to dominate ten technological industries", also: ["his government announced Made in China 2025"] },
  { id: "scientists", ch: "c6", label: "Scientists of Chinese descent moving from the US to China: 2010 and 2021", value: 1000, value2: 2500, unit: "scientists", credit: A,
    verify: "Fewer than 1,000 scientists of Chinese descent moved from the United States to China in 2010; more than 2,500 did in 2021" },
  { id: "salary-cap", ch: "c6", label: "Salary cap imposed on China's financial sector", value: 400000, unit: "US$", credit: A,
    verify: "a salary cap of $400,000 on the financial sector" },
  { id: "pop-ratio", ch: "c6", label: "China's population against America's", value: 4, unit: "×", credit: A,
    verify: "a peer competitor that has four times its population" },
  { id: "ships", ch: "c6", label: "Ships under construction, 2022: China nearly 1,800, United States 5", value: 1800, value2: 5, unit: "ships", year: "2022", credit: A,
    verify: "In 2022, China had nearly 1,800 ships under construction, and the United States had 5" },
  { id: "shells", ch: "c6", label: "Days for Ukraine to fire a month of US shell production", value: 2, unit: "days", credit: A,
    verify: "In two days, Ukraine could fire as many shells as the United States makes in a month" },
  { id: "unido", ch: "c6", label: "Share of world industrial capacity in 2030: China 45%, all high-income countries together 38%", value: 45, value2: 38, unit: "%", year: "2030", credit: "UNIDO forecast, 2024",
    verify: "China will have 45 percent of the world’s industrial capacity by 2030", also: ["and all other high-income states combined add up to 38 percent of capacity"] },

  /* ── 7. Learning to Love Engineers ────────────────────────────────────── */
  { id: "meat-coupons", ch: "c7", label: "Meat ration coupons a month, the author's mother's first year at college", value: 4, unit: "coupons", credit: A,
    verify: "My mom began freshman year with four ration coupons for meat per month" },
  { id: "kunming-salary", ch: "c7", label: "A good monthly salary in Kunming", value: 2000, unit: "US$", credit: A,
    verify: "$2,000 a month would be considered good" },
  { id: "moses-pools", ch: "c7", label: "Swimming pools Robert Moses opened in 1936", value: 11, unit: "pools", year: "1936", credit: A,
    verify: "one of the eleven swimming pools that Parks Commissioner Robert Moses opened in 1936" },
  { id: "power-broker", ch: "c7", label: "Pages in Robert Caro's The Power Broker", value: 1300, unit: "pages", credit: A,
    verify: "into each of its 1,300 pages" },
  { id: "rust-cities", ch: "c7", label: "Population Detroit, St. Louis and Cleveland have lost since the 1950s", value: 67, unit: "%", credit: A,
    verify: "These cities have lost two-thirds of their population since the 1950s" },
  { id: "renters", ch: "c7", label: "American renters who are cost-burdened (over 30% of income on rent)", value: 50, unit: "%", credit: A,
    verify: "half of American renters are considered cost-burdened (meaning that they spend more than 30 percent of their pretax income on rent)" },
  { id: "nyc-subway", ch: "c7", label: "Cost of a kilometre of subway in New York against Paris", value: 5, unit: "×", credit: A,
    verify: "It costs five times as much to build a kilometer of subway in New York City as it does in Paris", also: ["five of the six most expensive transit projects in the world"] },
  { id: "broadband", ch: "c7", label: "Rural broadband money from Congress, 2021 — four years later, no home connected", value: 42e9, unit: "US$", year: "2021", credit: A,
    verify: "In 2021, Congress allocated $42 billion to expand broadband services to rural communities", also: ["Four years later, not a single home has been connected to this network"] },
  { id: "ev-chargers", ch: "c7", label: "EV charging money from Congress — stations working two years later: 7", value: 7.5e9, value2: 7, unit: "US$, stations", credit: A,
    verify: "Two years after Congress allocated $7.5 billion to build electric vehicle charging stations across the United States, just seven have become operational" },
  { id: "nissan", ch: "c7", label: "Cars a year per auto worker, as Deng heard it: Nissan 94, China 1", value: 94, unit: "cars", credit: "as told to Deng Xiaoping",
    verify: "an auto worker at Japan’s Nissan might be able to produce ninety-four cars a year, while an auto worker in China could produce but one" },
];

/** The two people the book uses to show how much the year of birth decided. */
export const COHORTS: Array<Omit<BkEvent, "page"> & { verify: string }> = [
  { id: "lu-born", who: "lu", age: 0, year: 1949, what: "Born the year Mao founds the People's Republic", verify: "A strong contender, I believe, is 1949" },
  { id: "lu-famine", who: "lu", age: 10, year: 1959, what: "Food shortages of the Great Leap Forward", verify: "Around age ten, Lu would suffer some degree of food shortage" },
  { id: "lu-college", who: "lu", age: 18, year: 1967, what: "Misses college: Mao shuts higher education", verify: "At age eighteen, Lu might have just missed her chance to attend college" },
  { id: "lu-onechild", who: "lu", age: 30, year: 1980, what: "Meets the one-child policy if she waits past thirty", verify: "If Lu decided to have a child after the age of thirty" },
  { id: "lu-covid", who: "lu", age: 70, year: 2019, what: "Zero-Covid lockdowns as she turns seventy", verify: "But as Lu turned seventy and entered the twilight of her life" },
  { id: "yao-born", who: "yao", age: 0, year: 1959, what: "Born with no memory of famine", verify: "Someone born in 1959 would have no memory of famine" },
  { id: "yao-college", who: "yao", age: 18, year: 1977, what: "University just as Deng reopens the schools", verify: "By the time he turned eighteen, Mao would have died" },
  { id: "yao-wto", who: "yao", age: 40, year: 1999, what: "Business at WTO entry; a home for a song as housing is privatised", verify: "As he turned forty and entered the prime of his career" },
];

function chapterOf(file: string): ChapterId {
  const c = CHAPTERS[file];
  if (!c) throw new Error(`unknown chapter file ${file}`);
  return c.id;
}

export function loadBook(): Chapter[] {
  const path = findBook(BOOK_DIR, "Breakneck");
  return readChapters(path, Object.fromEntries(Object.entries(CHAPTERS).map(([f, c]) => [f, c.title])));
}

export function build(chapters: Chapter[]): { out: BreakneckBook; missing: string[] } {
  const missing: string[] = [];
  const figures: BkFigure[] = [];
  for (const f of FIGURES) {
    const at = locate(chapters, f.verify);
    if (!at.found) missing.push(`${f.id}: "${f.verify}"`);
    else if (chapterOf(at.chapter) !== f.ch) missing.push(`${f.id}: found in ${at.chapterLabel}, filed under ${f.ch}`);
    for (const a of f.also ?? []) if (!locate(chapters, a).found) missing.push(`${f.id} (also): "${a}"`);
    const { verify: _v, also: _a, ...rest } = f;
    figures.push({ ...rest, page: at.page });
  }
  const cohorts: BkEvent[] = COHORTS.map((e) => {
    const at = locate(chapters, e.verify);
    if (!at.found) missing.push(`${e.id}: "${e.verify}"`);
    const { verify: _v, ...rest } = e;
    return { ...rest, page: at.page };
  });
  const firstPage = (ch: Chapter) => {
    const m = /\[\[p(\d+)\]\]/.exec(ch.text);
    return m ? Number(m[1]) : null;
  };
  const chapters_: BkChapter[] = chapters.map((ch) => ({ ...CHAPTERS[ch.id]!, firstPage: firstPage(ch) }));
  return { out: { generatedAt: new Date().toISOString(), book: BOOK, chapters: chapters_, figures, cohorts }, missing };
}

async function main(): Promise<void> {
  const ids = new Set<string>();
  for (const f of FIGURES) {
    if (ids.has(f.id)) throw new Error(`duplicate id ${f.id}`);
    ids.add(f.id);
  }
  const { out, missing } = build(loadBook());
  if (missing.length) {
    console.error(`${missing.length} phrase(s) not found in the book:\n  ${missing.join("\n  ")}`);
    process.exit(1);
  }
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 1) + "\n", "utf8");
  const unpaged = out.figures.filter((f) => f.page === null).length;
  console.log(`wrote ${OUT}: ${out.figures.length} figures, ${out.cohorts.length} cohort events, ${unpaged} without a page`);
}

if (isEntryPoint(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
