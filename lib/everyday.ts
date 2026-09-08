/**
 * A hundred indicators you could explain to someone on a train.
 *
 * The catalogue behind this site holds 690 World Bank series and most of them
 * are unreadable unless you already know what they mean. "Gross fixed capital
 * formation" is a real and important quantity, and it tells almost nobody
 * anything. This is the other kind: numbers that stand for something a person
 * can picture — a light switch that works, a toilet, a phone, a flight taken,
 * a bank account that exists.
 *
 * Every one of them is already ingested for India and five comparators, so
 * nothing here is a new claim. What is new is the framing: each carries the
 * plain question it answers, why it tracks growth at all, and the thing it
 * cannot tell you. That last field is not decoration. An indicator this
 * legible is easy to over-read, and "more Indians have a phone" is a fact
 * about phones, not a fact about prosperity.
 *
 * ── The two the request named, and where they went ───────────────────────
 *
 * Air conditioner sales are not available comparably and are not here. No
 * multilateral source publishes appliance ownership across countries on a
 * common definition. Trade data would be worse than nothing: India assembles
 * most of the air conditioners it sells, so imports of finished units would
 * put the world's fastest-growing AC market near the bottom of the table. The
 * closest honest substitute is household electricity consumption per person,
 * which rises when people buy appliances and run them, and it is included.
 *
 * Cost of housing per square foot is not here either. The World Bank carries
 * no cross-country house price series; the commercial ones that do are neither
 * open nor consistently defined. Urban population and the share living in
 * slums are the nearest available, and neither is a price.
 */

/** The everyday groupings, in the order the page shows them. */
export const EVERYDAY_THEMES = [
  "At home",
  "Staying alive",
  "Getting around",
  "Staying in touch",
  "Money in hand",
  "Work",
  "Learning",
  "What the country makes",
  "Ideas",
  "Energy and air",
  "The world outside",
] as const;

export type EverydayTheme = (typeof EVERYDAY_THEMES)[number];

export interface EverydayIndicator {
  /** Id of the ingested WDI series this reads. */
  id: string;
  theme: EverydayTheme;
  /** The question in words anyone would use. */
  question: string;
  /** Why this moves when a country gets richer. */
  why: string;
  /** What it cannot tell you. Required: a legible number is easy to over-read. */
  butNot: string;
}

export const EVERYDAY: EverydayIndicator[] = [
  // ── At home ───────────────────────────────────────────────────────────
  { id: "wdi-electricity-access", theme: "At home", question: "Does the light come on?", why: "Universal power is the first thing every country that got rich did.", butNot: "A connection is not a supply. It counts households wired up, not hours without a cut." },
  { id: "wdi-clean-cooking", theme: "At home", question: "Can you cook without smoke?", why: "Wood and dung fires are what people stop using when they can afford not to.", butNot: "Having a gas connection is not using it. Refill rates are a separate and weaker story." },
  { id: "wdi-water-access", theme: "At home", question: "Is there clean water nearby?", why: "The walk to water is time nobody rich spends.", butNot: "Basic access allows a thirty-minute round trip. It is not water at the tap." },
  { id: "wdi-sanitation-access", theme: "At home", question: "Is there a toilet?", why: "Sanitation moves ahead of income almost everywhere, because it is built for people rather than bought by them.", butNot: "A toilet built is not a toilet used, and the survey cannot see which." },
  { id: "wdi-sh-sta-odfc-zs", theme: "At home", question: "How many people have nowhere to go?", why: "The clearest single measure of whether basic public provision reached the poorest.", butNot: "It says nothing about the sewage once collected." },
  { id: "wdi-slum-population", theme: "At home", question: "How many city dwellers live in slums?", why: "Cities grow faster than housing everywhere; the gap is what this measures.", butNot: "The definition is broad and includes tenure insecurity, not only bad building." },
  { id: "wdi-urban-population", theme: "At home", question: "How many people live in towns and cities?", why: "Every country that industrialised urbanised first.", butNot: "Urban is defined nationally, so the line is drawn differently in each country here." },
  { id: "wdi-urban-growth", theme: "At home", question: "How fast are the cities filling?", why: "The rate tells you whether infrastructure is chasing or keeping up.", butNot: "Fast growth is not prosperity; it is often distress moving." },
  { id: "wdi-household-consumption-pc", theme: "At home", question: "What does a household actually spend?", why: "The closest thing to money passing through an ordinary life.", butNot: "An average across a very unequal country is not a typical household." },

  // ── Staying alive ─────────────────────────────────────────────────────
  { id: "wdi-life-expectancy", theme: "Staying alive", question: "How long do people live?", why: "The single number that aggregates almost everything else on this page.", butNot: "It is dominated by deaths in childhood; it is not how long a healthy adult expects to live." },
  { id: "wdi-infant-mortality", theme: "Staying alive", question: "How many babies die before their first birthday?", why: "It falls with clean water, vaccination and a nurse within reach — three things money buys.", butNot: "It is a national average, and the range inside India is wider than the range between countries." },
  { id: "wdi-under5-mortality", theme: "Staying alive", question: "How many children die before they turn five?", why: "The measure the world has moved fastest on, and the one poverty shows up in first.", butNot: "Deaths are recorded where systems exist to record them." },
  { id: "wdi-maternal-mortality", theme: "Staying alive", question: "How many women die giving birth?", why: "It needs a functioning hospital within reach, which is infrastructure and staffing at once.", butNot: "It is modelled rather than counted in most countries, including this comparison set." },
  { id: "wdi-child-stunting", theme: "Staying alive", question: "How many children are too short for their age?", why: "Stunting is the physical record of years of poor nutrition, and it does not reverse.", butNot: "It reflects the decade before the survey, not this year." },
  { id: "wdi-undernourishment", theme: "Staying alive", question: "How many people do not get enough to eat?", why: "The floor below which nothing else on this page matters.", butNot: "It measures calories, not nutrition. A country can clear this bar and still be badly fed." },
  { id: "wdi-health-spending", theme: "Staying alive", question: "How much does the country spend on health?", why: "Spending is the input; the mortality lines above are the output.", butNot: "Spending is not care. Where it goes matters more than how much." },
  { id: "wdi-oop-health", theme: "Staying alive", question: "How much of a hospital bill comes out of pocket?", why: "The share people pay themselves is what turns an illness into poverty.", butNot: "A low share can mean good insurance or simply that nobody sought treatment." },
  { id: "wdi-fertility", theme: "Staying alive", question: "How many children does a woman have?", why: "It falls with schooling, income and child survival — usually in that order.", butNot: "Below replacement is not automatically good news; it becomes an ageing problem later." },
  { id: "wdi-population-65plus", theme: "Staying alive", question: "How many people are over sixty-five?", why: "Countries get old after they get rich, or, in a few cases, before.", butNot: "It says nothing about whether those people are supported." },

  // ── Getting around ────────────────────────────────────────────────────
  { id: "wdi-air-passengers", theme: "Getting around", question: "How many flights do people take?", why: "Flying is the first luxury a middle class buys and the first thing it stops buying in a downturn.", butNot: "It counts departures by carriers registered in the country, so a hub flatters and a small flag carrier hides." },
  { id: "wdi-air-freight", theme: "Getting around", question: "How much goes by air?", why: "Air freight is what you pay for when the thing is valuable or urgent — electronics, pharmaceuticals, parts.", butNot: "It is a small share of trade by weight and a large one by value; it is not a picture of trade overall." },
  { id: "wdi-container-traffic", theme: "Getting around", question: "How many containers move through the ports?", why: "Almost everything manufactured that crosses a border does it in a box this counts.", butNot: "Transhipment counts twice. A port that moves other countries' cargo looks busier than its economy." },

  // ── Staying in touch ──────────────────────────────────────────────────
  { id: "wdi-mobile-subscriptions", theme: "Staying in touch", question: "How many people have a phone?", why: "The fastest technology adoption in human history, and the one that reached the poor first.", butNot: "It counts subscriptions, not people. Two SIMs are two, and India has a great many." },
  { id: "wdi-internet-users", theme: "Staying in touch", question: "How many people use the internet?", why: "It is now where work, money and government are, so being off it is a real exclusion.", butNot: "Used in the last three months is the bar. It is not daily use and not good connections." },
  { id: "wdi-broadband", theme: "Staying in touch", question: "How many homes have fixed broadband?", why: "Fixed lines are what remote work, streaming and a home business actually need.", butNot: "India largely skipped fixed lines for mobile data, so a low figure here understates connectivity." },
  { id: "wdi-ict-goods-exports", theme: "Staying in touch", question: "Does the country sell electronics abroad?", why: "Electronics assembly is the classic first rung of manufacturing for export.", butNot: "Assembly counts as export at full value, so a phone assembled from imported parts flatters this." },

  // ── Money in hand ─────────────────────────────────────────────────────
  { id: "wdi-gdp-per-capita", theme: "Money in hand", question: "What does the economy produce per person?", why: "The headline. Everything else here is an attempt to say what it feels like.", butNot: "It is an average and India is unequal, so most Indians are below it." },
  { id: "wdi-gdp-per-capita-ppp", theme: "Money in hand", question: "And what does that buy locally?", why: "Adjusting for local prices is the fairer comparison, and it moves India up sharply.", butNot: "PPP conversion is an estimate with a wide margin, not a measurement." },
  { id: "wdi-gni-per-capita", theme: "Money in hand", question: "What income actually reaches the country?", why: "It nets out profits that leave, which for some economies is a large correction.", butNot: "It is still an average, and still says nothing about distribution." },
  { id: "wdi-gdp-growth", theme: "Money in hand", question: "How fast is the economy growing?", why: "The number every headline uses.", butNot: "Growth from a low base is easier. A fast-growing poor country is still poor." },
  { id: "wdi-inflation", theme: "Money in hand", question: "How fast are prices rising?", why: "The rate at which money in a pocket stops being worth what it was.", butNot: "The basket is national and averages across very different household budgets." },
  { id: "wdi-account-ownership", theme: "Money in hand", question: "How many adults have a bank account?", why: "An account is the precondition for saving, borrowing and receiving anything from the state.", butNot: "Opened is not used. A dormant account counts the same as an active one." },
  { id: "wdi-account-ownership-female", theme: "Money in hand", question: "How many women have one?", why: "The gap between this line and the one above is a good measure of who the economy includes.", butNot: "An account in a woman's name is not money she controls." },
  { id: "wdi-gfdd-ai-25", theme: "Money in hand", question: "How many cash machines are there?", why: "Physical access to your own money, which for most of the world is still how it works.", butNot: "Cash machines matter less each year in countries where payments went digital first." },
  { id: "wdi-gfdd-ai-02", theme: "Money in hand", question: "How many bank branches?", why: "A branch is where borrowing happens for anyone a phone app will not lend to.", butNot: "Branch counts fall in rich countries as banking moves online, so high is not always better." },
  { id: "wdi-gross-savings", theme: "Money in hand", question: "How much does the country save?", why: "Savings are what pays for the next factory, road or house.", butNot: "High savings can mean confidence or fear of having no safety net." },
  { id: "wdi-extreme-poverty", theme: "Money in hand", question: "How many live on almost nothing?", why: "The floor: below about two dollars a day, adjusted for local prices.", butNot: "The line is very low. Clearing it is not the same as being out of poverty." },
  { id: "wdi-gini", theme: "Money in hand", question: "How unequally is income shared?", why: "It decides whether growth in the average reaches an ordinary person.", butNot: "It is based on surveys that undercount the very rich almost everywhere." },
  { id: "wdi-remittances", theme: "Money in hand", question: "How much money is sent home from abroad?", why: "For millions of households this is the whole household budget, and it bypasses the state entirely.", butNot: "Only recorded transfers count; informal channels move a great deal more." },

  // ── Work ──────────────────────────────────────────────────────────────
  { id: "wdi-unemployment", theme: "Work", question: "How many people cannot find work?", why: "The most quoted labour number in the world.", butNot: "In countries with no unemployment benefit, people cannot afford to be unemployed — they take any work, so this reads low." },
  { id: "wdi-youth-unemployment", theme: "Work", question: "And how many young people?", why: "Youth unemployment leads the adult figure and scars earnings for decades.", butNot: "Students are excluded, so a country that expands education can look better without more jobs." },
  { id: "wdi-female-labour-participation", theme: "Work", question: "How many women are in the workforce?", why: "In India this fell while the economy grew, which is genuinely unusual and worth seeing.", butNot: "Unpaid work at home and on family farms is largely invisible to it." },
  { id: "wdi-agriculture-employment", theme: "Work", question: "How many people still farm?", why: "Moving off the land is the oldest definition of development there is.", butNot: "Leaving farming for insecure city work is not automatically an improvement." },
  { id: "wdi-industry-employment", theme: "Work", question: "How many work in industry?", why: "Factory jobs are the rung most countries climbed from farm to office.", butNot: "India's share has barely moved for thirty years, which is the central puzzle of its development." },
  { id: "wdi-services-employment", theme: "Work", question: "How many work in services?", why: "Where the jobs went in every rich country.", butNot: "Services covers both a software engineer and a street vendor. It is not one thing." },

  // ── Learning ──────────────────────────────────────────────────────────
  { id: "wdi-literacy", theme: "Learning", question: "How many adults can read?", why: "The precondition for nearly every other thing on this page.", butNot: "The bar is very low and self-reported in most surveys." },
  { id: "wdi-se-prm-cmpt-zs", theme: "Learning", question: "How many children finish primary school?", why: "Getting children into school was the easy part; keeping them to the end was not.", butNot: "Completion is not learning, and the gap between the two is India's real education problem." },
  { id: "wdi-secondary-enrolment", theme: "Learning", question: "How many reach secondary school?", why: "Secondary schooling is where the earnings premium starts to appear.", butNot: "Gross enrolment counts over-age pupils, so it can exceed 100% and often does." },
  { id: "wdi-tertiary-enrolment", theme: "Learning", question: "How many go on to college?", why: "It sets the ceiling on what an economy can move into next.", butNot: "It counts enrolment, not graduation, and says nothing about what a degree is worth." },
  { id: "wdi-education-spending", theme: "Learning", question: "How much is spent on schools?", why: "The input behind every line above it.", butNot: "Spending per pupil in a country with many children is a very different thing from the same share elsewhere." },
  { id: "wdi-se-enr-seco-fm-zs", theme: "Learning", question: "Do girls reach secondary school as often as boys?", why: "A ratio of one means parity, and India crossed it — which surprises people.", butNot: "Parity in enrolment is not parity in what happens after school." },

  // ── What the country makes ────────────────────────────────────────────
  { id: "wdi-manufacturing-gdp", theme: "What the country makes", question: "How much of the economy is factories?", why: "Manufacturing is how the countries in this comparison set got rich, with one exception.", butNot: "The share can fall because services grew, which is not the same as factories shrinking." },
  { id: "wdi-manufacturing-usd", theme: "What the country makes", question: "And how much is that in money?", why: "The absolute figure shows scale where the share shows structure.", butNot: "Dollar figures move with the exchange rate as much as with output." },
  { id: "wdi-manufacturing-growth", theme: "What the country makes", question: "Is manufacturing growing?", why: "The rate matters more than the level for a country trying to catch up.", butNot: "A single year is noise. The direction over a decade is the story." },
  { id: "wdi-industry-gdp", theme: "What the country makes", question: "How much is industry altogether?", why: "Factories plus mining, power and construction — the physical economy.", butNot: "Construction booms and commodity prices both move this without any change in capability." },
  { id: "wdi-agriculture-gdp", theme: "What the country makes", question: "How much comes from farming?", why: "A high share is the signature of a poor country, almost without exception.", butNot: "It falls as a share even when farm output rises, because everything else rises faster." },
  { id: "wdi-services-gdp", theme: "What the country makes", question: "How much from services?", why: "India went from farms to services and largely skipped the factory stage, which is genuinely unusual.", butNot: "It bundles IT exports with domestic haircuts. The average hides both." },
  { id: "wdi-hightech-exports-share", theme: "What the country makes", question: "How much of what it sells is advanced?", why: "The share of exports that are aerospace, pharmaceuticals, electronics and instruments.", butNot: "Assembling a high-tech product from imported components counts fully, which flatters several countries here." },
  { id: "wdi-manufactured-exports-share", theme: "What the country makes", question: "Does it sell things rather than raw material?", why: "Selling manufactures rather than commodities is what breaks the poverty trap.", butNot: "Low-value manufactures count the same as high-value ones." },
  { id: "wdi-merch-exports", theme: "What the country makes", question: "How much does it sell abroad in goods?", why: "The simplest measure of whether the world wants what a country makes.", butNot: "Re-exports count, so entrepôt economies look larger than they are." },

  // ── Ideas ─────────────────────────────────────────────────────────────
  { id: "wdi-patents-resident", theme: "Ideas", question: "How many patents do residents file?", why: "The count of ideas somebody thought worth defending.", butNot: "Patent counts measure filing behaviour and legal culture at least as much as invention." },
  { id: "wdi-scientific-articles", theme: "Ideas", question: "How many research papers?", why: "Volume of published science, which tracks university capacity closely.", butNot: "It counts papers, not whether anyone read them." },
  { id: "wdi-researchers", theme: "Ideas", question: "How many researchers are there?", why: "Per million people, so it compares across country sizes fairly.", butNot: "Headcount is not output, and definitions of who counts vary by country." },
  { id: "wdi-ict-service-exports", theme: "Ideas", question: "Does it sell software and services abroad?", why: "India's single most successful export sector, and visible from space in this series.", butNot: "It is concentrated in a few cities and a few firms, which the national figure hides." },
  { id: "wdi-listed-companies", theme: "Ideas", question: "How many companies are publicly listed?", why: "A rough count of firms large and formal enough to raise money from the public.", butNot: "Listing rules differ so much between these countries that the comparison is loose." },

  // ── Energy and air ────────────────────────────────────────────────────
  { id: "wdi-electricity-per-capita", theme: "Energy and air", question: "How much electricity does each person use?", why: "The closest available stand-in for appliances owned and run — including the air conditioners nobody publishes comparably.", butNot: "It includes industry, so a factory-heavy country reads high without any household using more." },
  { id: "wdi-co2-per-capita", theme: "Energy and air", question: "How much carbon per person?", why: "Historically the price of getting rich, and the thing every country now has to break from.", butNot: "Emissions from making goods count where they are made, not where they are consumed." },
  { id: "wdi-renewable-share", theme: "Energy and air", question: "How much energy is renewable?", why: "The direction every energy system is being pushed.", butNot: "It counts traditional biomass, so burning wood makes a poor country look green." },
  { id: "wdi-renewable-electricity", theme: "Energy and air", question: "And how much of the electricity?", why: "A cleaner measure than the one above, because it excludes cooking fires.", butNot: "Large hydro dominates it in several of these countries." },
  { id: "wdi-electricity-coal", theme: "Energy and air", question: "How much electricity comes from coal?", why: "The single largest lever on emissions in this comparison set.", butNot: "A falling share can coexist with rising absolute coal use, and in India it has." },
  { id: "wdi-electricity-nuclear", theme: "Energy and air", question: "How much from nuclear?", why: "The only large low-carbon source that runs regardless of weather.", butNot: "It takes fifteen years to change, so this line moves too slowly to reflect current policy." },
  { id: "wdi-energy-imports", theme: "Energy and air", question: "How much energy has to be bought abroad?", why: "Energy import dependence is the vulnerability that sets a country's foreign policy.", butNot: "A negative figure means a net exporter, which is a different kind of dependence." },

  // ── The world outside ─────────────────────────────────────────────────
  { id: "wdi-exports-gdp", theme: "The world outside", question: "How much of the economy is exports?", why: "Whether growth is being pulled by the world or pushed from inside.", butNot: "Big countries always look less trade-dependent, because more of the trade is internal." },
  { id: "wdi-trade-openness", theme: "The world outside", question: "How open is it to trade overall?", why: "Exports plus imports against the size of the economy.", butNot: "Openness is not a policy score; geography and size drive most of it." },
  { id: "wdi-fdi-gdp", theme: "The world outside", question: "How much foreign money comes to build things?", why: "Foreign investment brings technology and management, not just capital.", butNot: "A single large acquisition can move a year, and it says nothing about what was built." },
  { id: "wdi-reserves", theme: "The world outside", question: "How much foreign currency is held in reserve?", why: "The buffer that decides whether a currency crisis becomes a catastrophe.", butNot: "Large reserves are also idle money, which is a cost." },
  { id: "wdi-tourist-arrivals", theme: "The world outside", question: "How many people visit?", why: "Tourism is an export you cannot offshore, and it employs people with few qualifications.", butNot: "Arrivals count crossings, so a business trip and a fortnight's holiday count the same." },
  { id: "wdi-tourism-receipts", theme: "The world outside", question: "And how much do they spend?", why: "Receipts show whether visitors are worth having, where arrivals only show that they came.", butNot: "It is measured in dollars, so a weak currency depresses it without fewer visitors." },
  { id: "wdi-tourism-spending", theme: "The world outside", question: "How much do its own people spend abroad?", why: "Outbound tourism is one of the purest signals of a middle class with money spare.", butNot: "It is concentrated in a small slice of the population everywhere." },
  { id: "wdi-current-account", theme: "The world outside", question: "Does the country earn more abroad than it spends?", why: "A persistent deficit has to be financed by somebody, every year.", butNot: "Deficits are normal and healthy for a fast-growing country importing machinery." },
  // ── The rest of the hundred ───────────────────────────────────────────
  { id: "wdi-gdp-current-usd", theme: "Money in hand", question: "How big is the economy altogether?", why: "The number countries are ranked by, and the one India climbs fastest on.", butNot: "Size is not wealth. India is a top-five economy and roughly 140th per person." },
  { id: "wdi-household-consumption-share", theme: "Money in hand", question: "How much of the economy is households spending?", why: "A high share means growth is being driven by ordinary consumption rather than by the state or exports.", butNot: "It can also be high simply because investment is weak." },
  { id: "wdi-private-credit", theme: "Money in hand", question: "How much can people and firms borrow?", why: "Credit is what turns a plan into a business or a house.", butNot: "Rapid credit growth is how most financial crises start." },
  { id: "wdi-market-cap-gdp", theme: "Money in hand", question: "How large is the stock market?", why: "Against the size of the economy, so it compares fairly across countries.", butNot: "A market can be large because a few firms are, not because many are." },
  { id: "wdi-tax-revenue", theme: "Money in hand", question: "How much tax does the state collect?", why: "Everything a government does is downstream of this.", butNot: "A low ratio can mean low rates or wide evasion, and this cannot tell them apart." },
  { id: "wdi-govt-debt", theme: "Money in hand", question: "How much does the government owe?", why: "Debt taken on now is spending given up later.", butNot: "The level matters far less than what the borrowing bought." },
  { id: "wdi-gross-capital-formation", theme: "What the country makes", question: "How much is being built?", why: "Investment today is the capacity to produce tomorrow — roads, factories, machines.", butNot: "It counts spending, not whether the thing built was worth building." },
  { id: "wdi-fixed-capital-formation", theme: "What the country makes", question: "And how much of that is lasting things?", why: "Strips out inventories, so it is closer to genuine building.", butNot: "Housing dominates it in several of these countries." },
  { id: "wdi-exports-usd", theme: "The world outside", question: "What does the country sell abroad in total?", why: "Goods and services together, which is where India differs most from its comparators.", butNot: "Dollar totals move with exchange rates as much as with volume." },
  { id: "wdi-imports-usd", theme: "The world outside", question: "And what does it buy?", why: "Imports rise when people can afford more, so this tracks demand as well as dependence.", butNot: "Oil dominates India's import bill, so the world price moves this line." },
  { id: "wdi-fdi-inflows", theme: "The world outside", question: "How much foreign investment arrives?", why: "In dollars rather than as a share, which shows the scale a country attracts.", butNot: "Money routed through tax havens is counted at the last hop, not the first." },
  { id: "wdi-hightech-exports-usd", theme: "What the country makes", question: "How much advanced manufacturing does it sell?", why: "The absolute figure, where the share above shows composition.", butNot: "Same assembly caveat: imported components count at full value on the way out." },
  { id: "wdi-patents-nonresident", theme: "Ideas", question: "How many foreign patents are filed here?", why: "Foreigners patent where they expect a market worth defending.", butNot: "It measures market attractiveness and legal confidence, not domestic invention." },
  { id: "wdi-population", theme: "Staying alive", question: "How many people are there?", why: "The denominator under almost every other line on this page.", butNot: "It is not an indicator of anything by itself, and is included because so many others need it." },
  { id: "wdi-population-0-14", theme: "Staying alive", question: "How many are children?", why: "A young population is a workforce coming, or a dependency burden, depending on the schools.", butNot: "The dividend is not automatic; it is only realised if the jobs exist." },
  { id: "wdi-food-production-index", theme: "At home", question: "Is the country growing more food?", why: "Against a fixed base year, so it shows real change in output.", butNot: "More food produced is not more food eaten, and India exports grain while children are stunted." },
  { id: "wdi-milex-gdp", theme: "The world outside", question: "How much goes on defence?", why: "As a share of the economy, which is how the burden is usually judged.", butNot: "A share falling while the economy grows can still be a large rise in spending." },
  { id: "wdi-armed-forces", theme: "The world outside", question: "How many people are in the armed forces?", why: "Headcount, which for India and China is among the largest in the world.", butNot: "Numbers are not capability, and the trend everywhere is fewer people and more equipment." },
  { id: "wdi-gfdd-oi-13", theme: "Money in hand", question: "How much of the economy is money sent home?", why: "As a share of GDP, which is where remittances turn from useful to structural.", butNot: "For India the absolute figure is the world's largest while the share is small." },
  { id: "wdi-gfdd-si-02", theme: "Money in hand", question: "How many loans are going bad?", why: "Bad debt is where the last boom is buried, and India spent a decade digging it out.", butNot: "Recognition rules differ, so a low figure can mean a healthy system or a slow one." },
];

/** Indicators in a theme, in the order declared. */
export function byTheme(theme: EverydayTheme): EverydayIndicator[] {
  return EVERYDAY.filter((e) => e.theme === theme);
}

/**
 * Indicators measured too rarely to draw a trend through, and why.
 *
 * These are not broken series. Poverty and inequality both come from household
 * consumption surveys, which most countries run every five to ten years and
 * India has run less often than that — the World Bank's Indian series carries
 * 2004, 2009, 2011 and then nothing until 2022. Slum share is thinner still.
 *
 * The temptation is to drop them for failing a density check, and that would
 * be exactly backwards: on a page asking whether growth reaches ordinary
 * people, these are the two that answer it most directly. So they stay, and
 * the page labels them rather than drawing a confident line through four
 * points spread over eighteen years.
 *
 * Listed explicitly so that adding a sparse indicator is a decision somebody
 * makes, not something that slips in.
 */
export const SPARSE: Record<string, string> = {
  "wdi-extreme-poverty": "From household consumption surveys, which India runs rarely — four readings since 2004, with an eleven-year gap in the middle.",
  "wdi-gini": "The same survey as poverty above, so the same four years and the same gap.",
  "wdi-slum-population": "Two readings, a year apart. Enough for a comparison, not for a trend.",
};

/** Is this indicator one of the rarely-measured ones? */
export function sparseNote(id: string): string | null {
  return SPARSE[id] ?? null;
}
