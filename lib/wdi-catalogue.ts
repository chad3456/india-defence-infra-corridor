import type { Category } from "./types";

/**
 * World Bank WDI indicators tracked by the ETL.
 *
 * These are declared here rather than hand-copied into JSON because the World
 * Bank API is free, keyless, versioned and revises history — copying it by hand
 * would guarantee drift. `scripts/etl/connectors/worldbank.ts` fetches the full
 * 2001-present run for each entry and writes `data/series/wdi.json`.
 *
 * Peer set is fixed across every indicator so cross-country charts stay
 * comparable: China and Vietnam (the manufacturing benchmarks India measures
 * itself against), Brazil (a fellow large federal democracy at similar income),
 * Indonesia (nearest large-population peer) and the United States (frontier).
 */

export interface WdiIndicator {
  /** World Bank indicator code. */
  code: string;
  /** Stable series id used across the site. */
  id: string;
  title: string;
  definition: string;
  category: Category;
  unit: string;
  unitShort: string;
  higherIsBetter: boolean | null;
  /** Rendered on the chart when the measure needs a caveat. */
  note?: string;
}

export const PEERS = [
  { iso3: "CHN", name: "China" },
  { iso3: "VNM", name: "Vietnam" },
  { iso3: "BRA", name: "Brazil" },
  { iso3: "IDN", name: "Indonesia" },
  { iso3: "USA", name: "United States" },
] as const;

export const WDI_START_YEAR = 2001;

export const WDI_INDICATORS: WdiIndicator[] = [
  /* ---------------- Economy ---------------- */
  { code: "NY.GDP.MKTP.CD", id: "wdi-gdp-current-usd", title: "GDP (current US$)", definition: "Gross domestic product at current market prices.", category: "economy", unit: "current US$", unitShort: "US$", higherIsBetter: true },
  { code: "NY.GDP.MKTP.KD.ZG", id: "wdi-gdp-growth", title: "GDP growth", definition: "Annual percentage growth of GDP at constant local prices.", category: "economy", unit: "% per year", unitShort: "%", higherIsBetter: true },
  { code: "NY.GDP.PCAP.CD", id: "wdi-gdp-per-capita", title: "GDP per capita (current US$)", definition: "GDP divided by midyear population.", category: "economy", unit: "current US$", unitShort: "US$", higherIsBetter: true, note: "The measure that matters for living standards. India's headline GDP rank flatters a per-capita position outside the world's top 130." },
  { code: "NY.GDP.PCAP.PP.CD", id: "wdi-gdp-per-capita-ppp", title: "GDP per capita, PPP", definition: "GDP per capita converted at purchasing power parity.", category: "economy", unit: "current international $", unitShort: "int$", higherIsBetter: true },
  { code: "NY.GNP.PCAP.CD", id: "wdi-gni-per-capita", title: "GNI per capita, Atlas method", definition: "Gross national income per capita, Atlas conversion.", category: "economy", unit: "current US$", unitShort: "US$", higherIsBetter: true },
  { code: "FP.CPI.TOTL.ZG", id: "wdi-inflation", title: "Inflation, consumer prices", definition: "Annual percentage change in the consumer price index.", category: "economy", unit: "% per year", unitShort: "%", higherIsBetter: false },
  { code: "NE.GDI.TOTL.ZS", id: "wdi-gross-capital-formation", title: "Gross capital formation", definition: "Investment in fixed assets plus inventory change, as a share of GDP.", category: "economy", unit: "% of GDP", unitShort: "%", higherIsBetter: true, note: "The best single proxy for how much of national income is being converted into future capacity." },
  { code: "NE.GDI.FTOT.ZS", id: "wdi-fixed-capital-formation", title: "Gross fixed capital formation", definition: "Fixed asset investment as a share of GDP.", category: "economy", unit: "% of GDP", unitShort: "%", higherIsBetter: true },
  { code: "GC.DOD.TOTL.GD.ZS", id: "wdi-govt-debt", title: "Central government debt", definition: "Total central government debt stock as a share of GDP.", category: "economy", unit: "% of GDP", unitShort: "%", higherIsBetter: false },
  { code: "NY.GDS.TOTL.ZS", id: "wdi-gross-savings", title: "Gross domestic savings", definition: "GDP less final consumption expenditure, as a share of GDP.", category: "economy", unit: "% of GDP", unitShort: "%", higherIsBetter: true },
  { code: "GC.TAX.TOTL.GD.ZS", id: "wdi-tax-revenue", title: "Tax revenue", definition: "Compulsory transfers to central government, as a share of GDP.", category: "economy", unit: "% of GDP", unitShort: "%", higherIsBetter: null, note: "India's tax-to-GDP ratio is low for its income level, which constrains every spending series on this site." },
  { code: "SL.UEM.TOTL.ZS", id: "wdi-unemployment", title: "Unemployment rate", definition: "Share of the labour force without work but available for and seeking employment (ILO estimate).", category: "economy", unit: "% of labour force", unitShort: "%", higherIsBetter: false },
  { code: "SL.TLF.CACT.FE.ZS", id: "wdi-female-labour-participation", title: "Female labour force participation", definition: "Share of women aged 15+ economically active (ILO estimate).", category: "economy", unit: "% of female pop 15+", unitShort: "%", higherIsBetter: true, note: "One of India's weakest indicators against every peer — and a direct constraint on growth." },

  /* ---------------- Trade ---------------- */
  { code: "NE.EXP.GNFS.CD", id: "wdi-exports-usd", title: "Exports of goods and services", definition: "Value of all goods and services provided to the rest of the world.", category: "trade", unit: "current US$", unitShort: "US$", higherIsBetter: true },
  { code: "NE.EXP.GNFS.ZS", id: "wdi-exports-gdp", title: "Exports as share of GDP", definition: "Exports of goods and services as a percentage of GDP.", category: "trade", unit: "% of GDP", unitShort: "%", higherIsBetter: true },
  { code: "NE.IMP.GNFS.CD", id: "wdi-imports-usd", title: "Imports of goods and services", definition: "Value of all goods and services received from the rest of the world.", category: "trade", unit: "current US$", unitShort: "US$", higherIsBetter: null },
  { code: "NE.TRD.GNFS.ZS", id: "wdi-trade-openness", title: "Trade openness", definition: "Sum of exports and imports as a share of GDP.", category: "trade", unit: "% of GDP", unitShort: "%", higherIsBetter: null },
  { code: "TX.VAL.TECH.MF.ZS", id: "wdi-hightech-exports-share", title: "High-technology exports", definition: "Share of manufactured exports with high R&D intensity — aerospace, computers, pharmaceuticals, instruments.", category: "trade", unit: "% of manufactured exports", unitShort: "%", higherIsBetter: true, note: "The sharpest test of whether manufacturing is moving up the value chain. Compare against Vietnam." },
  { code: "TX.VAL.TECH.CD", id: "wdi-hightech-exports-usd", title: "High-technology exports (US$)", definition: "Value of high-technology manufactured exports.", category: "trade", unit: "current US$", unitShort: "US$", higherIsBetter: true },
  { code: "BX.KLT.DINV.CD.WD", id: "wdi-fdi-inflows", title: "Foreign direct investment, net inflows", definition: "Net inflows of investment acquiring a lasting management interest.", category: "trade", unit: "current US$", unitShort: "US$", higherIsBetter: true },
  { code: "BX.KLT.DINV.WD.GD.ZS", id: "wdi-fdi-gdp", title: "FDI net inflows as share of GDP", definition: "Foreign direct investment inflows relative to economy size.", category: "trade", unit: "% of GDP", unitShort: "%", higherIsBetter: true },
  { code: "BN.CAB.XOKA.GD.ZS", id: "wdi-current-account", title: "Current account balance", definition: "Net trade, income and transfers with the rest of the world, as a share of GDP.", category: "trade", unit: "% of GDP", unitShort: "%", higherIsBetter: null },
  { code: "FI.RES.TOTL.CD", id: "wdi-reserves", title: "Total reserves including gold", definition: "Foreign exchange reserves, SDRs, IMF position and gold.", category: "trade", unit: "current US$", unitShort: "US$", higherIsBetter: true },
  { code: "BX.TRF.PWKR.CD.DT", id: "wdi-remittances", title: "Personal remittances received", definition: "Transfers received from nationals working abroad.", category: "trade", unit: "current US$", unitShort: "US$", higherIsBetter: null, note: "India is the world's largest remittance recipient — a strength that is also a measure of how many skilled workers left." },
  { code: "TX.VAL.MRCH.CD.WT", id: "wdi-merch-exports", title: "Merchandise exports", definition: "Value of goods exported, customs basis.", category: "trade", unit: "current US$", unitShort: "US$", higherIsBetter: true },

  /* ---------------- Manufacturing ---------------- */
  { code: "NV.IND.MANF.ZS", id: "wdi-manufacturing-gdp", title: "Manufacturing value added", definition: "Manufacturing output net of intermediate inputs, as a share of GDP.", category: "manufacturing", unit: "% of GDP", unitShort: "%", higherIsBetter: true, note: "The single most damaging number on this site: essentially flat since 2001 despite a decade of Make in India. The 25% target has never been approached." },
  { code: "NV.IND.MANF.CD", id: "wdi-manufacturing-usd", title: "Manufacturing value added (US$)", definition: "Absolute manufacturing value added.", category: "manufacturing", unit: "current US$", unitShort: "US$", higherIsBetter: true },
  { code: "NV.IND.MANF.KD.ZG", id: "wdi-manufacturing-growth", title: "Manufacturing value added growth", definition: "Annual growth in real manufacturing value added.", category: "manufacturing", unit: "% per year", unitShort: "%", higherIsBetter: true },
  { code: "NV.IND.TOTL.ZS", id: "wdi-industry-gdp", title: "Industry value added", definition: "Mining, manufacturing, construction and utilities, as a share of GDP.", category: "manufacturing", unit: "% of GDP", unitShort: "%", higherIsBetter: true },
  { code: "NV.AGR.TOTL.ZS", id: "wdi-agriculture-gdp", title: "Agriculture value added", definition: "Agriculture, forestry and fishing, as a share of GDP.", category: "manufacturing", unit: "% of GDP", unitShort: "%", higherIsBetter: null },
  { code: "NV.SRV.TOTL.ZS", id: "wdi-services-gdp", title: "Services value added", definition: "Services sector output as a share of GDP.", category: "manufacturing", unit: "% of GDP", unitShort: "%", higherIsBetter: null, note: "India industrialised out of order — services grew before manufacturing did. This chart is that anomaly." },
  { code: "SL.IND.EMPL.ZS", id: "wdi-industry-employment", title: "Employment in industry", definition: "Share of total employment in the industrial sector (ILO estimate).", category: "manufacturing", unit: "% of employment", unitShort: "%", higherIsBetter: true },
  { code: "SL.AGR.EMPL.ZS", id: "wdi-agriculture-employment", title: "Employment in agriculture", definition: "Share of total employment in agriculture (ILO estimate).", category: "manufacturing", unit: "% of employment", unitShort: "%", higherIsBetter: false, note: "Still over 40%. Structural transformation has stalled — the workers left agriculture for construction and services, not factories." },
  { code: "GB.XPD.RSDV.GD.ZS", id: "wdi-rd-spending", title: "Research and development expenditure", definition: "Gross domestic R&D spending as a share of GDP.", category: "ai-science", unit: "% of GDP", unitShort: "%", higherIsBetter: true, note: "India spends around 0.65% of GDP on R&D against China's 2.4%. No defence-industrial ambition survives that gap indefinitely." },
  { code: "IP.PAT.RESD", id: "wdi-patents-resident", title: "Patent applications, residents", definition: "Patent applications filed by residents.", category: "ai-science", unit: "applications", unitShort: "apps", higherIsBetter: true },
  { code: "IP.PAT.NRES", id: "wdi-patents-nonresident", title: "Patent applications, non-residents", definition: "Patent applications filed by non-residents.", category: "ai-science", unit: "applications", unitShort: "apps", higherIsBetter: null },
  { code: "IP.JRN.ARTC.SC", id: "wdi-scientific-articles", title: "Scientific and technical journal articles", definition: "Number of scientific and engineering articles published.", category: "ai-science", unit: "articles", unitShort: "articles", higherIsBetter: true },
  { code: "TX.VAL.MANF.ZS.UN", id: "wdi-manufactured-exports-share", title: "Manufactured exports", definition: "Manufactured goods as a share of merchandise exports.", category: "manufacturing", unit: "% of merchandise exports", unitShort: "%", higherIsBetter: true },

  /* ---------------- Defence ---------------- */
  { code: "MS.MIL.XPND.GD.ZS", id: "wdi-milex-gdp", title: "Military expenditure", definition: "Military spending as a share of GDP (SIPRI via World Bank).", category: "defence", unit: "% of GDP", unitShort: "%", higherIsBetter: null, note: "India's military burden has fallen steadily as a share of GDP since 2001 even as absolute spending rose — the economy grew faster than the budget." },
  { code: "MS.MIL.XPND.CD", id: "wdi-milex-usd", title: "Military expenditure (US$)", definition: "Absolute military spending in current dollars.", category: "defence", unit: "current US$", unitShort: "US$", higherIsBetter: null },
  { code: "MS.MIL.XPND.ZS", id: "wdi-milex-govt-share", title: "Military expenditure as share of government spending", definition: "Military spending as a percentage of central government expenditure.", category: "defence", unit: "% of govt spending", unitShort: "%", higherIsBetter: null },
  { code: "MS.MIL.TOTL.P1", id: "wdi-armed-forces", title: "Armed forces personnel", definition: "Active duty military personnel including paramilitary where training and equipment are military.", category: "defence", unit: "personnel", unitShort: "people", higherIsBetter: null },
  { code: "MS.MIL.TOTL.TF.ZS", id: "wdi-armed-forces-share", title: "Armed forces personnel share of labour force", definition: "Military personnel as a share of the total labour force.", category: "defence", unit: "% of labour force", unitShort: "%", higherIsBetter: null },

  /* ---------------- Infrastructure & energy ---------------- */
  { code: "EG.ELC.ACCS.ZS", id: "wdi-electricity-access", title: "Access to electricity", definition: "Share of population with access to electricity.", category: "infrastructure", unit: "% of population", unitShort: "%", higherIsBetter: true, note: "From roughly 60% to near-universal. On any honest reckoning this is the single largest infrastructure achievement of the period." },
  { code: "EG.USE.ELEC.KH.PC", id: "wdi-electricity-per-capita", title: "Electric power consumption per capita", definition: "Electricity consumed per person per year.", category: "energy", unit: "kWh per capita", unitShort: "kWh", higherIsBetter: true, note: "Still roughly a third of China's. Consumption per head is the least gameable measure of industrialisation." },
  { code: "EG.FEC.RNEW.ZS", id: "wdi-renewable-share", title: "Renewable energy consumption", definition: "Renewable energy as a share of total final energy consumption.", category: "energy", unit: "% of final energy", unitShort: "%", higherIsBetter: true, note: "Falling in this series is not necessarily bad — it partly reflects households switching off traditional biomass." },
  { code: "EG.ELC.RNEW.ZS", id: "wdi-renewable-electricity", title: "Renewable electricity output", definition: "Electricity generated from renewable sources as a share of total generation.", category: "energy", unit: "% of output", unitShort: "%", higherIsBetter: true },
  { code: "EG.IMP.CONS.ZS", id: "wdi-energy-imports", title: "Energy imports, net", definition: "Net energy imports as a share of energy use.", category: "energy", unit: "% of energy use", unitShort: "%", higherIsBetter: false, note: "Import dependence is the strategic vulnerability that most constrains Indian foreign policy." },
  { code: "EN.GHG.CO2.PC.CE.AR5", id: "wdi-co2-per-capita", title: "CO2 emissions per capita", definition: "Carbon dioxide emissions per person.", category: "energy", unit: "tonnes per capita", unitShort: "t", higherIsBetter: false, note: "India's per-capita emissions remain far below the world average — the core of its position in climate negotiations." },
  { code: "IT.CEL.SETS.P2", id: "wdi-mobile-subscriptions", title: "Mobile cellular subscriptions", definition: "Mobile subscriptions per 100 people.", category: "infrastructure", unit: "per 100 people", unitShort: "/100", higherIsBetter: true },
  { code: "IT.NET.USER.ZS", id: "wdi-internet-users", title: "Individuals using the internet", definition: "Share of population using the internet.", category: "infrastructure", unit: "% of population", unitShort: "%", higherIsBetter: true },
  { code: "IT.NET.BBND.P2", id: "wdi-broadband", title: "Fixed broadband subscriptions", definition: "Fixed broadband subscriptions per 100 people.", category: "infrastructure", unit: "per 100 people", unitShort: "/100", higherIsBetter: true, note: "India's weakest connectivity metric. Mobile-first adoption left fixed-line infrastructure far behind every peer." },
  { code: "IS.AIR.PSGR", id: "wdi-air-passengers", title: "Air transport, passengers carried", definition: "Passengers carried by air carriers registered in the country.", category: "infrastructure", unit: "passengers", unitShort: "pax", higherIsBetter: true },
  { code: "IS.AIR.GOOD.MT.K1", id: "wdi-air-freight", title: "Air transport freight", definition: "Volume of freight carried by air.", category: "infrastructure", unit: "million tonne-km", unitShort: "mt-km", higherIsBetter: true },
  { code: "IS.SHP.GOOD.TU", id: "wdi-container-traffic", title: "Container port traffic", definition: "Container throughput measured in twenty-foot equivalent units.", category: "infrastructure", unit: "TEU", unitShort: "TEU", higherIsBetter: true },
  { code: "SP.URB.TOTL.IN.ZS", id: "wdi-urban-population", title: "Urban population", definition: "Share of population living in urban areas.", category: "real-estate", unit: "% of population", unitShort: "%", higherIsBetter: null, note: "India urbanised far more slowly than every comparator. Under-urbanisation, not over-urbanisation, is the planning problem." },
  { code: "SP.URB.GROW", id: "wdi-urban-growth", title: "Urban population growth", definition: "Annual growth rate of the urban population.", category: "real-estate", unit: "% per year", unitShort: "%", higherIsBetter: null },
  { code: "EN.POP.SLUM.UR.ZS", id: "wdi-slum-population", title: "Population living in slums", definition: "Share of the urban population living in slum households.", category: "real-estate", unit: "% of urban population", unitShort: "%", higherIsBetter: false },

  /* ---------------- Quality of life & social ---------------- */
  { code: "SP.DYN.LE00.IN", id: "wdi-life-expectancy", title: "Life expectancy at birth", definition: "Years a newborn would live under prevailing mortality patterns.", category: "quality-of-life", unit: "years", unitShort: "yrs", higherIsBetter: true },
  { code: "SP.DYN.IMRT.IN", id: "wdi-infant-mortality", title: "Infant mortality rate", definition: "Deaths of infants under one year per 1,000 live births.", category: "quality-of-life", unit: "per 1,000 live births", unitShort: "/1k", higherIsBetter: false, note: "Roughly a two-thirds reduction since 2001 — among the strongest social gains in the dataset." },
  { code: "SH.STA.MMRT", id: "wdi-maternal-mortality", title: "Maternal mortality ratio", definition: "Maternal deaths per 100,000 live births.", category: "quality-of-life", unit: "per 100,000 live births", unitShort: "/100k", higherIsBetter: false },
  { code: "SH.DYN.MORT", id: "wdi-under5-mortality", title: "Under-five mortality rate", definition: "Deaths before age five per 1,000 live births.", category: "quality-of-life", unit: "per 1,000 live births", unitShort: "/1k", higherIsBetter: false },
  { code: "SH.H2O.BASW.ZS", id: "wdi-water-access", title: "Access to basic drinking water", definition: "Share of population using at least basic drinking water services.", category: "quality-of-life", unit: "% of population", unitShort: "%", higherIsBetter: true },
  { code: "SH.STA.BASS.ZS", id: "wdi-sanitation-access", title: "Access to basic sanitation", definition: "Share of population using at least basic sanitation services.", category: "quality-of-life", unit: "% of population", unitShort: "%", higherIsBetter: true, note: "The steepest improvement of any social indicator here, concentrated in 2014-2019." },
  { code: "SH.XPD.CHEX.GD.ZS", id: "wdi-health-spending", title: "Current health expenditure", definition: "Total health spending, public and private, as a share of GDP.", category: "quality-of-life", unit: "% of GDP", unitShort: "%", higherIsBetter: true },
  { code: "SH.XPD.OOPC.CH.ZS", id: "wdi-oop-health", title: "Out-of-pocket health expenditure", definition: "Share of health spending paid directly by households.", category: "quality-of-life", unit: "% of health spending", unitShort: "%", higherIsBetter: false, note: "Among the highest in the world. Medical costs remain a leading cause of household impoverishment in India." },
  { code: "SE.XPD.TOTL.GD.ZS", id: "wdi-education-spending", title: "Government expenditure on education", definition: "Public education spending as a share of GDP.", category: "social", unit: "% of GDP", unitShort: "%", higherIsBetter: true },
  { code: "SE.ADT.LITR.ZS", id: "wdi-literacy", title: "Adult literacy rate", definition: "Share of people aged 15+ who can read and write.", category: "social", unit: "% of people 15+", unitShort: "%", higherIsBetter: true },
  { code: "SE.SEC.ENRR", id: "wdi-secondary-enrolment", title: "Secondary school enrolment, gross", definition: "Total secondary enrolment as a share of the official school-age population.", category: "social", unit: "% gross", unitShort: "%", higherIsBetter: true },
  { code: "SE.TER.ENRR", id: "wdi-tertiary-enrolment", title: "Tertiary school enrolment, gross", definition: "Total tertiary enrolment as a share of the relevant age cohort.", category: "social", unit: "% gross", unitShort: "%", higherIsBetter: true },
  { code: "SI.POV.DDAY", id: "wdi-extreme-poverty", title: "Poverty headcount at $2.15/day", definition: "Share of population below the international extreme poverty line, 2017 PPP.", category: "social", unit: "% of population", unitShort: "%", higherIsBetter: false, note: "The most consequential number in this dataset. Hundreds of millions moved above the line in this period." },
  { code: "SI.POV.GINI", id: "wdi-gini", title: "Gini index", definition: "Income distribution inequality, 0 = perfect equality.", category: "social", unit: "index", unitShort: "Gini", higherIsBetter: false },
  { code: "SP.POP.TOTL", id: "wdi-population", title: "Population, total", definition: "Total midyear resident population.", category: "social", unit: "people", unitShort: "people", higherIsBetter: null },
  { code: "SP.DYN.TFRT.IN", id: "wdi-fertility", title: "Fertility rate, total", definition: "Births per woman over a lifetime at current age-specific rates.", category: "social", unit: "births per woman", unitShort: "births", higherIsBetter: null, note: "India fell below the 2.1 replacement rate around 2020. The demographic dividend has a closing window." },
  { code: "SP.POP.65UP.TO.ZS", id: "wdi-population-65plus", title: "Population aged 65 and above", definition: "Share of population aged 65+.", category: "social", unit: "% of population", unitShort: "%", higherIsBetter: null },
  { code: "SP.POP.0014.TO.ZS", id: "wdi-population-0-14", title: "Population aged 0-14", definition: "Share of population aged 0-14.", category: "social", unit: "% of population", unitShort: "%", higherIsBetter: null },
  // --- AI, research and the digital base -----------------------------------
  // Added because "defence innovation" and "AI development" are claims that
  // have to be measurable to be worth making. R&D intensity, who does the
  // research, whether the country earns from its own intellectual property,
  // and whether the digital base exists to build on.
  { code: "SP.POP.SCIE.RD.P6", id: "wdi-researchers", title: "Researchers in R&D", definition: "Professionals engaged in the conception or creation of new knowledge, per million people.", category: "ai-science", unit: "per million people", unitShort: "per m", higherIsBetter: true, note: "India has roughly 260 researchers per million against Korea's 8,700. The constraint on an AI or defence-tech ambition is people before it is money." },
  { code: "SP.POP.TECH.RD.P6", id: "wdi-technicians", title: "Technicians in R&D", definition: "Technical staff supporting research, per million people.", category: "ai-science", unit: "per million people", unitShort: "per m", higherIsBetter: true },
  { code: "BX.GSR.ROYL.CD", id: "wdi-ip-receipts", title: "Charges for the use of intellectual property, receipts", definition: "What the country earns from licensing its own intellectual property abroad.", category: "ai-science", unit: "current US$", unitShort: "US$", higherIsBetter: true, note: "The honest test of whether research becomes property. Receipts against payments is the number to read." },
  { code: "BM.GSR.ROYL.CD", id: "wdi-ip-payments", title: "Charges for the use of intellectual property, payments", definition: "What the country pays to license intellectual property from abroad.", category: "ai-science", unit: "current US$", unitShort: "US$", higherIsBetter: null },
  { code: "TX.VAL.ICTG.ZS.UN", id: "wdi-ict-goods-exports", title: "ICT goods exports", definition: "Share of total goods exports made up of information and communication technology goods.", category: "ai-science", unit: "% of goods exports", unitShort: "%", higherIsBetter: true },
  { code: "BX.GSR.CCIS.ZS", id: "wdi-ict-service-exports", title: "ICT service exports", definition: "Share of service exports made up of information and communication technology services.", category: "ai-science", unit: "% of service exports", unitShort: "%", higherIsBetter: true, note: "India's strongest card, and the reason the AI conversation here starts from services rather than from silicon." },
];

export const WDI_BY_ID = new Map(WDI_INDICATORS.map((i) => [i.id, i]));
