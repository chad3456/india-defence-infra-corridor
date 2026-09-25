/**
 * The programmes on the mela, typed by hand and verified by machine.
 *
 * The government's own scheme directory answered 401 when this site asked it
 * for a list, and the Wikipedia roster the /schemes page reads is missing Make
 * in India, Ayushman Bharat, PLI and Beti Bachao outright and carries no
 * launch year for Jan Dhan. So these were curated — which is the step where a
 * 2016 becomes a 2015 and nobody notices.
 *
 * Every entry names the English Wikipedia article that is its source, and
 * `npm run mela:verify` fetches the opening section of each and checks that
 * the stated year actually appears in it. An entry that fails is not
 * rendered; it is listed on the page as unverified, with the reason. Adding
 * one here is not enough to publish it.
 *
 * ── What is deliberately included ────────────────────────────────────────
 *
 * Programmes that were withdrawn (the 2020 farm laws), programmes whose
 * effects are disputed (demonetisation), and programmes that began before
 * 2014 and were expanded after it (Direct Benefit Transfer). A tour of a
 * government's record that showed only what it would choose to show is an
 * advertisement. Where a scheme continues an older one — Swachh Bharat after
 * Nirmal Bharat, PMAY after Indira Awaas — the predecessor is named and
 * verified the same way.
 *
 * ── What was removed, and why ────────────────────────────────────────────
 *
 * The first verification run failed 27 of 70. Where the failure was a wrong
 * title and the right article exists, the title was corrected. Where the
 * right article's opening states a different year and says what it is — the
 * Institutions of Eminence article reads "set up in 2017" — the year was
 * corrected to it. Where there is no dedicated article (Mudra's title
 * redirects to a general article on the premiership), or the article's opening
 * never states a launch year at all (PMAY, UDAN, Smart Cities, Bharatmala, Gati
 * Shakti), the entry was removed. The one thing not done was to change a year
 * to whichever one would pass: that would turn a check into a rubber stamp.
 * Removal is not a judgement on the programme; its sector's numbers still show.
 *
 * Notes are one neutral line on what the programme is. They are not an
 * assessment; the assessment is the stall's verdict, from lib/assessment.ts.
 */

export type StallId =
  | "infrastructure" | "defence" | "finance" | "manufacturing" | "innovation"
  | "education" | "rural" | "women" | "health" | "digital" | "trade";

export interface CuratedProgramme {
  id: string;
  stall: StallId;
  name: string;
  year: number;
  kind: "scheme" | "mission" | "reform" | "law" | "institution" | "event";
  /** English Wikipedia title. Redirects are followed and the final title recorded. */
  article: string;
  continues?: { name: string; year: number; article: string };
  note?: string;
}

export const PROGRAMMES: CuratedProgramme[] = [
  /* ── Finance ─────────────────────────────────────────────────────── */
  { id: "jan-dhan", stall: "finance", name: "Pradhan Mantri Jan Dhan Yojana", year: 2014, kind: "scheme",
    article: "Pradhan Mantri Jan Dhan Yojana", note: "Zero-balance bank accounts for households that had none." },
  { id: "apy", stall: "finance", name: "Atal Pension Yojana", year: 2015, kind: "scheme",
    article: "Atal Pension Yojana", note: "A contributory pension for workers in the unorganised sector." },
  { id: "pmjjby", stall: "finance", name: "PM Jeevan Jyoti Bima Yojana", year: 2015, kind: "scheme",
    article: "Pradhan Mantri Jeevan Jyoti Bima Yojana", note: "Low-premium life insurance linked to a bank account." },
  { id: "ibc", stall: "finance", name: "Insolvency and Bankruptcy Code", year: 2016, kind: "law",
    article: "Insolvency and Bankruptcy Code, 2016", note: "A time-bound process for resolving insolvent companies." },
  { id: "demonetisation", stall: "finance", name: "Demonetisation", year: 2016, kind: "reform",
    article: "2016 Indian banknote demonetisation", note: "₹500 and ₹1,000 notes withdrawn overnight. Its effects remain disputed." },
  { id: "gst", stall: "finance", name: "Goods and Services Tax", year: 2017, kind: "reform",
    article: "Goods and Services Tax (India)", note: "One indirect tax in place of most central and state levies." },
  { id: "dbt", stall: "finance", name: "Direct Benefit Transfer", year: 2013, kind: "scheme",
    article: "Direct Benefit Transfer", note: "Began in 2013, before this government, and was expanded after it." },

  /* ── Digital ─────────────────────────────────────────────────────── */
  { id: "digital-india", stall: "digital", name: "Digital India", year: 2015, kind: "mission",
    article: "Digital India", note: "Connectivity, e-governance and digital services, under one programme." },
  { id: "digilocker", stall: "digital", name: "DigiLocker", year: 2015, kind: "institution",
    article: "DigiLocker", note: "A government locker for official documents." },
  { id: "upi", stall: "digital", name: "Unified Payments Interface", year: 2016, kind: "institution",
    article: "Unified Payments Interface", note: "The instant payments system built by NPCI." },
  { id: "ondc", stall: "digital", name: "Open Network for Digital Commerce", year: 2021, kind: "institution",
    article: "Open Network for Digital Commerce", note: "An open protocol for online buying and selling." },

  /* ── Manufacturing ───────────────────────────────────────────────── */
  { id: "make-in-india", stall: "manufacturing", name: "Make in India", year: 2014, kind: "mission",
    article: "Make in India", note: "The campaign to raise manufacturing's share of the economy." },
  { id: "atmanirbhar", stall: "manufacturing", name: "Atmanirbhar Bharat", year: 2020, kind: "mission",
    article: "Atmanirbhar Bharat", note: "The self-reliance programme announced during the pandemic." },
  { id: "pli", stall: "manufacturing", name: "Production Linked Incentive schemes", year: 2020, kind: "scheme",
    article: "Production Linked Incentive schemes in India", note: "Subsidies tied to incremental output in chosen sectors." },
  { id: "vishwakarma", stall: "manufacturing", name: "PM Vishwakarma", year: 2023, kind: "scheme",
    article: "Pradhan Mantri Vishwakarma Kaushal Samman Yojana", note: "Credit and training for traditional artisans." },

  /* ── Defence ─────────────────────────────────────────────────────── */
  { id: "up-corridor", stall: "defence", name: "Uttar Pradesh Defence Industrial Corridor", year: 2018, kind: "mission",
    article: "Uttar Pradesh Defence Industrial Corridor", note: "One of two defence manufacturing corridors." },
  { id: "agnipath", stall: "defence", name: "Agnipath", year: 2022, kind: "scheme",
    article: "Agnipath Scheme", note: "Four-year enlistment for most new recruits. Contested at launch." },
  { id: "sindoor", stall: "defence", name: "Operation Sindoor", year: 2025, kind: "event",
    article: "Operation Sindoor", note: "Strikes after the Pahalgam attack. The two national accounts differ." },

  /* ── Innovation ──────────────────────────────────────────────────── */
  { id: "startup-india", stall: "innovation", name: "Startup India", year: 2016, kind: "mission",
    article: "Startup India", note: "Registration, tax and funding support for new firms." },
  { id: "aim", stall: "innovation", name: "Atal Innovation Mission", year: 2016, kind: "mission",
    article: "Atal Innovation Mission", note: "Tinkering labs in schools and incubators." },
  { id: "chandrayaan-3", stall: "innovation", name: "Chandrayaan-3", year: 2023, kind: "event",
    article: "Chandrayaan-3", note: "The lunar landing near the south pole." },
  { id: "aditya-l1", stall: "innovation", name: "Aditya-L1", year: 2023, kind: "event",
    article: "Aditya-L1", note: "The solar observatory at the first Lagrange point." },
  { id: "nqm", stall: "innovation", name: "National Quantum Mission", year: 2023, kind: "mission",
    article: "National Quantum Mission India", note: "Research funding for quantum technologies." },

  /* ── Education ───────────────────────────────────────────────────── */
  { id: "samagra", stall: "education", name: "Samagra Shiksha", year: 2018, kind: "scheme",
    article: "Samagra Shiksha Abhiyan", note: "One scheme for school education, pre-school to class XII." },
  /* The article: "a recognition status set up in 2017". */
  { id: "ioe", stall: "education", name: "Institutions of Eminence", year: 2017, kind: "scheme",
    article: "Institutions of Eminence", note: "Autonomy and funding for selected universities." },
  { id: "nep", stall: "education", name: "National Education Policy 2020", year: 2020, kind: "reform",
    article: "National Education Policy 2020", note: "The first new education policy since 1986. Some states rejected parts of it." },
  { id: "onos", stall: "education", name: "One Nation One Subscription", year: 2025, kind: "scheme",
    article: "One Nation One Subscription", note: "A national licence to academic journals." },

  /* ── Rural ───────────────────────────────────────────────────────── */
  { id: "swachh", stall: "rural", name: "Swachh Bharat Mission", year: 2014, kind: "mission",
    article: "Swachh Bharat Mission", note: "Toilets and the end of open defecation.",
    continues: { name: "Nirmal Bharat Abhiyan", year: 2012, article: "Nirmal Bharat Abhiyan" } },
  { id: "pmfby", stall: "rural", name: "PM Fasal Bima Yojana", year: 2016, kind: "scheme",
    article: "Pradhan Mantri Fasal Bima Yojana", note: "Crop insurance." },
  { id: "saubhagya", stall: "rural", name: "Saubhagya", year: 2017, kind: "scheme",
    article: "Saubhagya scheme", note: "An electricity connection for every household." },
  { id: "pm-kisan", stall: "rural", name: "PM-KISAN", year: 2019, kind: "scheme",
    article: "Pradhan Mantri Kisan Samman Nidhi", note: "A fixed annual cash transfer to landholding farmers." },
  { id: "jjm", stall: "rural", name: "Jal Jeevan Mission", year: 2019, kind: "mission",
    article: "Jal Jeevan Mission", note: "A tap connection for every rural household.",
    continues: { name: "National Rural Drinking Water Programme", year: 2009, article: "National Rural Drinking Water Programme" } },
  { id: "pmgkay", stall: "rural", name: "PM Garib Kalyan Anna Yojana", year: 2020, kind: "scheme",
    article: "Pradhan Mantri Garib Kalyan Anna Yojana", note: "Free foodgrain, begun during the pandemic." },
  { id: "svamitva", stall: "rural", name: "SVAMITVA", year: 2020, kind: "scheme",
    article: "Svamitva Yojana", note: "Drone-surveyed property cards for village homes." },
  { id: "farm-laws", stall: "rural", name: "The farm laws", year: 2020, kind: "law",
    article: "2020 Indian agriculture acts", note: "Passed in 2020 and repealed in 2021 after a year of protest." },

  /* ── Women ───────────────────────────────────────────────────────── */
  { id: "bbbp", stall: "women", name: "Beti Bachao Beti Padhao", year: 2015, kind: "scheme",
    article: "Beti Bachao Beti Padhao", note: "Against sex-selective abortion, and for girls' schooling." },
  { id: "sukanya", stall: "women", name: "Sukanya Samriddhi Account", year: 2015, kind: "scheme",
    article: "Sukanya Samriddhi Account", note: "A savings account for a girl child." },
  { id: "ujjwala", stall: "women", name: "PM Ujjwala Yojana", year: 2016, kind: "scheme",
    article: "Pradhan Mantri Ujjwala Yojana", note: "LPG connections in the name of women in poor households." },
  { id: "stand-up", stall: "women", name: "Stand-Up India", year: 2016, kind: "scheme",
    article: "Stand-Up India", note: "Bank loans for women and SC/ST entrepreneurs." },
  { id: "pmmvy", stall: "women", name: "PM Matru Vandana Yojana", year: 2017, kind: "scheme",
    article: "Pradhan Mantri Matru Vandana Yojana", note: "A cash transfer during pregnancy." },
  { id: "triple-talaq", stall: "women", name: "Muslim Women (Protection of Rights on Marriage) Act", year: 2019, kind: "law",
    article: "Muslim Women (Protection of Rights on Marriage) Act, 2019", note: "Made instant triple talaq a criminal offence." },
  { id: "nari-shakti", stall: "women", name: "Nari Shakti Vandan Adhiniyam", year: 2023, kind: "law",
    article: "Nari Shakti Vandan Adhiniyam", note: "A third of legislative seats for women, once the next delimitation is done." },

  /* ── Health ──────────────────────────────────────────────────────── */
  { id: "indradhanush", stall: "health", name: "Mission Indradhanush", year: 2014, kind: "mission",
    article: "Mission Indradhanush", note: "Catch-up immunisation for children and pregnant women." },
  { id: "jan-aushadhi", stall: "health", name: "PM Bhartiya Janaushadhi Pariyojana", year: 2015, kind: "scheme",
    article: "Pradhan Mantri Bharatiya Janaushadhi Pariyojana", note: "Generic-medicine shops." },
  { id: "ayushman", stall: "health", name: "Ayushman Bharat", year: 2018, kind: "scheme",
    article: "Ayushman Bharat Yojana", note: "Hospital insurance for poorer households.",
    continues: { name: "Rashtriya Swasthya Bima Yojana", year: 2008, article: "Rashtriya Swasthya Bima Yojana" } },
  { id: "covid-vax", stall: "health", name: "COVID-19 vaccination", year: 2021, kind: "event",
    article: "COVID-19 vaccination in India", note: "The national vaccination drive." },

  /* ── Infrastructure ──────────────────────────────────────────────── */
  { id: "amrut", stall: "infrastructure", name: "AMRUT", year: 2015, kind: "mission",
    article: "Atal Mission for Rejuvenation and Urban Transformation", note: "Water and sewerage in urban areas." },
  { id: "sagarmala", stall: "infrastructure", name: "Sagarmala", year: 2015, kind: "mission",
    article: "Sagarmala project", note: "Port-led development along the coast." },
  { id: "vande-bharat", stall: "infrastructure", name: "Vande Bharat Express", year: 2019, kind: "institution",
    article: "Vande Bharat Express", note: "Domestically built semi-high-speed trains." },

  /* ── Trade ───────────────────────────────────────────────────────── */
  { id: "efta-tepa", stall: "trade", name: "India–EFTA TEPA", year: 2024, kind: "law",
    article: "India–EFTA Trade and Economic Partnership Agreement", note: "A trade agreement with Switzerland, Norway, Iceland and Liechtenstein." },
  { id: "uk-fta", stall: "trade", name: "India–UK trade agreement", year: 2025, kind: "law",
    article: "India–United Kingdom Free Trade Agreement", note: "Signed in 2025." },
];
