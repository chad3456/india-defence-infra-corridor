/**
 * The documents behind the public-order section, read rather than recalled.
 *
 * The section charts riots, damage to public property, police firing and police
 * casualties since 2004. Every one of those numbers lives in an official
 * document this sandbox cannot open: NCRB's Crime in India volumes, answers laid
 * in Parliament, the Home Ministry's annual reports. This runs in Actions,
 * where those hosts answer, and does two things:
 *
 *   1. Lists the document links on NCRB's publication pages, so the choice of
 *      which volume to read is a reading, not a guessed URL.
 *   2. Downloads the documents named in DOCS, converts them to text with
 *      pdftotext -layout, and keeps the pages that mention what the section is
 *      about. The kept text is committed so every curated figure can be checked
 *      against the words of its source by a test, not by memory.
 *
 * Publishes no figure. The page reads data/protests/public-order.json, which is
 * written by hand from this text and checked against it.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { getText } from "./lib/http";

const OUT = join(process.cwd(), "data", "protests", "public-order-probe.json");
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Pages whose document links are listed. */
const LISTINGS: Array<{ id: string; url: string }> = [
  { id: "ncrb:previous", url: "https://www.ncrb.gov.in/crime-in-india-all-previous-publications.html" },
  ...[2014, 2015, 2016, 2017, 2018, 2019, 2020, 2023, 2024].map((y) => ({ id: `ncrb:${y}`, url: `https://www.ncrb.gov.in/crime-in-india-year-wise.html?year=${y}` })),
  { id: "ncrb:en-2022", url: "https://www.ncrb.gov.in/en/crime-in-india-year-wise.html?year=2022" },
  { id: "ncrb:en-index", url: "https://www.ncrb.gov.in/en/crime-in-india.html" },
  { id: "ncrb:tables", url: "https://www.ncrb.gov.in/crime-in-india-table-content.html" },
  { id: "opencity:ckan", url: "https://data.opencity.in/api/3/action/package_search?q=%22crime+in+india%22&rows=60" },
  { id: "opencity:ckan-ncrb", url: "https://data.opencity.in/api/3/action/package_search?q=ncrb&rows=100" },
  ...[2016, 2017, 2018, 2019, 2020, 2021, 2023].map((y) => ({ id: `opencity:ckan-${y}`, url: `https://data.opencity.in/api/3/action/package_show?id=crime-in-india-${y}` })),
  ...["2019", "2020", "2021", "2023"].map((y) => ({ id: `pari:${y}-v3`, url: `https://ruralindiaonline.org/en/library/resource/crime-in-india-${y}-volume-iii/` })),
  { id: "wayback:ncrb-nic", url: "https://web.archive.org/cdx/search/cdx?url=ncrb.nic.in/CII*&output=json&fl=original,timestamp&filter=mimetype:application/pdf&collapse=urlkey&limit=4000" },
  { id: "wayback:ncrb-gov-stat", url: "https://web.archive.org/cdx/search/cdx?url=ncrb.gov.in/StatPublications/CII/*&output=json&fl=original,timestamp&filter=mimetype:application/pdf&collapse=urlkey&limit=4000" },
];

/** What a kept page must mention. */
const TOPIC = /riot|damage to public property|police firing|lathi|police personnel killed|killed or injured|casualt|communal|agitation|stone[- ]pelting|public order/i;

/** Documents to read. `pages` caps how many matching pages are kept. */
const NCRB_V1 = /Rioting|\bRiots\b|Damage to Public Property|Offences against the State/i;
const NCRB_V3 = /Police Firing|Lathi|Police Personnel (?:Killed|Injured)|Casualties|Killed or Injured|Civilians/i;
const NCRB = "https://www.ncrb.gov.in/uploads/nationalcrimerecordsbureau/custom/";
const OC = "https://data.opencity.in/dataset/";

const DOCS: Array<{ id: string; url: string; what: string; pages?: number; topic?: RegExp; alt?: string }> = [
  { id: "ncrb:2014:1953-2014", what: "NCRB Crime in India 2014, excerpts: national IPC crimes 1953-2014", url: `${NCRB}1653897427_1953-2014.pdf`, pages: 80, topic: /./ },
  { id: "ncrb:2015:excerpts", what: "NCRB Crime in India 2015, excerpts: national", url: `${NCRB}1653896209_Excerpts%20National_0.pdf`, pages: 80, topic: /./ },
  { id: "ncrb:2016:full", what: "NCRB Crime in India 2016, full publication", url: `${NCRB}1653886924_Crime%20in%20India%20-%202016%20Complete%20PDF%20291117.pdf`, pages: 70, topic: new RegExp(`${NCRB_V1.source}|${NCRB_V3.source}`, "i") },
  { id: "ncrb:2017:v1", what: "NCRB Crime in India 2017, Volume 1", url: `${NCRB}1653885627_Crime%20in%20India%202017%20-%20Volume%201_0_0.pdf`, pages: 40, topic: NCRB_V1 },
  { id: "ncrb:2017:v3", what: "NCRB Crime in India 2017, Volume 3", url: "https://www.ncrb.gov.in/uploads/files/CII-2017Volume3.pdf", pages: 40, topic: NCRB_V3 },
  { id: "ncrb:2018:v1", what: "NCRB Crime in India 2018, Volume 1", url: `${NCRB}1653734481_Crime%20in%20India%202018%20-%20Volume%201_3_0_0.pdf`, pages: 40, topic: NCRB_V1 },
  { id: "ncrb:2018:v3", what: "NCRB Crime in India 2018, Volume 3", url: "https://www.ncrb.gov.in/uploads/files/CII-2018Volume3.pdf", pages: 40, topic: NCRB_V3 },
  { id: "ncrb:2022:v1", what: "NCRB Crime in India 2022, Volume 1 (OpenCity mirror)", url: `${OC}b2d3ff5c-b109-42ad-afe0-b244c26505cd/resource/b70cf1ea-442a-4b23-9216-399f07e6379b/download/2f0461a6-7f09-47f1-ae1e-43b68d888599.pdf`, pages: 40, topic: NCRB_V1 },
  { id: "ncrb:2022:v3", what: "NCRB Crime in India 2022, Volume 3 (OpenCity mirror)", url: `${OC}b2d3ff5c-b109-42ad-afe0-b244c26505cd/resource/2b5bbab1-902b-4821-9e69-69d2b195fc09/download/d4b642dc-035b-4743-8515-efd09a17c9ed.pdf`, pages: 40, topic: NCRB_V3 },
  { id: "ncrb:2023:v1", what: "NCRB Crime in India 2023, Volume 1 (OpenCity mirror)", url: `${OC}40449a25-7fb3-4e38-91b9-f834af6078e2/resource/b7c71212-9463-4407-ab63-f349403a75b6/download/4f02eaf8-5d55-43d9-9a23-09cd724b5566.pdf`, pages: 40, topic: NCRB_V1 },
  { id: "ncrb:2024:v1", what: "NCRB Crime in India 2024, Volume 1 (OpenCity mirror)", url: `${OC}7d883875-921a-4820-b298-713c6219bd90/resource/46f760f4-dcf4-4f95-85c9-2225e2f7bbe8/download/vol1-crimeinindia2024.pdf`, pages: 40, topic: NCRB_V1 },
  { id: "ncrb:2024:v3", what: "NCRB Crime in India 2024, Volume 3 (OpenCity mirror)", url: `${OC}7d883875-921a-4820-b298-713c6219bd90/resource/38167e0c-6c5c-45fb-9cd4-3dc4f9d15754/download/2crimeinindia2024-volumeii.pdf`, pages: 40, topic: NCRB_V3 },
  { id: "ncrb-old:2008:chapter14", what: "NCRB Crime in India 2008, Chapter 14.pdf (Wayback)", url: "https://web.archive.org/web/20100816051237id_/http://ncrb.nic.in:80/CII2008/cii-2008/Chapter%2014.pdf", pages: 16, topic: /Police|Firing|Riot|Killed|Injured|Casualt/i },
  { id: "ncrb-old:2008:chapter15", what: "NCRB Crime in India 2008, Chapter 15.pdf (Wayback)", url: "https://web.archive.org/web/20100816051243id_/http://ncrb.nic.in:80/CII2008/cii-2008/Chapter%2015.pdf", pages: 16, topic: /Police|Firing|Riot|Killed|Injured|Casualt/i },
  { id: "ncrb-old:2009:chapter14", what: "NCRB Crime in India 2009, Chapter 14.pdf (Wayback)", url: "https://web.archive.org/web/20110125101121id_/http://ncrb.nic.in:80/CII%202009/cii-2009/Chapter%2014.pdf", pages: 16, topic: /Police|Firing|Riot|Killed|Injured|Casualt/i },
  { id: "ncrb-old:2009:chapter15", what: "NCRB Crime in India 2009, Chapter 15.pdf (Wayback)", url: "https://web.archive.org/web/20110125101131id_/http://ncrb.nic.in:80/CII%202009/cii-2009/Chapter%2015.pdf", pages: 16, topic: /Police|Firing|Riot|Killed|Injured|Casualt/i },
  { id: "ncrb-old:2010:chapter14", what: "NCRB Crime in India 2010, Chapter 14.pdf (Wayback)", url: "https://web.archive.org/web/20111110085709id_/http://ncrb.nic.in:80/CII2010/cii-2010/Chapter%2014.pdf", pages: 16, topic: /Police|Firing|Riot|Killed|Injured|Casualt/i },
  { id: "ncrb-old:2010:chapter15", what: "NCRB Crime in India 2010, Chapter 15.pdf (Wayback)", url: "https://web.archive.org/web/20111110085711id_/http://ncrb.nic.in:80/CII2010/cii-2010/Chapter%2015.pdf", pages: 16, topic: /Police|Firing|Riot|Killed|Injured|Casualt/i },
  { id: "ncrb-old:2011:chapter14", what: "NCRB Crime in India 2011, Chapter 14.pdf (Wayback)", url: "https://web.archive.org/web/20160909012648id_/http://ncrb.gov.in:80/StatPublications/CII/CII2011/cii-2011/Chapter%2014.pdf", pages: 16, topic: /Police|Firing|Riot|Killed|Injured|Casualt/i },
  { id: "ncrb-old:2011:chapter15", what: "NCRB Crime in India 2011, Chapter 15.pdf (Wayback)", url: "https://web.archive.org/web/20160909012652id_/http://ncrb.gov.in:80/StatPublications/CII/CII2011/cii-2011/Chapter%2015.pdf", pages: 16, topic: /Police|Firing|Riot|Killed|Injured|Casualt/i },
  { id: "ncrb-old:2012:chapter14", what: "NCRB Crime in India 2012, Chapter 14.pdf (Wayback)", url: "https://web.archive.org/web/20160909011205id_/http://ncrb.gov.in:80/StatPublications/CII/CII2012/cii-2012/Chapter%2014.pdf", pages: 16, topic: /Police|Firing|Riot|Killed|Injured|Casualt/i },
  { id: "ncrb-old:2012:chapter15", what: "NCRB Crime in India 2012, Chapter 15.pdf (Wayback)", url: "https://web.archive.org/web/20160909012800id_/http://ncrb.gov.in:80/StatPublications/CII/CII2012/cii-2012/Chapter%2015.pdf", pages: 16, topic: /Police|Firing|Riot|Killed|Injured|Casualt/i },
  { id: "ncrb-old:2013:ch14", what: "NCRB Crime in India 2013, 14-Police firing and casualties.pdf (Wayback)", url: "https://web.archive.org/web/20160909011256id_/http://ncrb.gov.in:80/StatPublications/CII/CII2013/Chapters/14-Police%20firing%20and%20casualties.pdf", pages: 16, topic: /Police|Firing|Riot|Killed|Injured|Casualt/i },
  { id: "ncrb-old:2014:chapter14", what: "NCRB Crime in India 2014, Chapter 14.pdf (Wayback)", url: "https://web.archive.org/web/20160909011347id_/http://ncrb.gov.in:80/StatPublications/CII/CII2014/chapters/Chapter%2014.pdf", pages: 16, topic: /Police|Firing|Riot|Killed|Injured|Casualt/i },
  { id: "ncrb-old:2015:chapter14", what: "NCRB Crime in India 2015, Chapter 14-15.11.16.pdf (Wayback)", url: "https://web.archive.org/web/20180205205522id_/http://ncrb.gov.in:80/StatPublications/CII/CII2015/chapters/Chapter%2014-15.11.16.pdf", pages: 16, topic: /Police|Firing|Riot|Killed|Injured|Casualt/i },
  { id: "ncrb:2019:v1", what: "NCRB Crime in India 2019, Volume 1 (Wayback)", url: "https://web.archive.org/web/2022id_/https://ncrb.gov.in/sites/default/files/CII%202019%20Volume%201.pdf", pages: 40, topic: NCRB_V1 },
  { id: "ncrb:2019:v3", what: "NCRB Crime in India 2019, Volume 3 (Wayback)", url: "https://web.archive.org/web/2022id_/https://ncrb.gov.in/sites/default/files/CII%202019%20Volume%203.pdf", pages: 40, topic: NCRB_V3 },
  { id: "ncrb:2020:v1", what: "NCRB Crime in India 2020, Volume 1 (Wayback)", url: "https://web.archive.org/web/2022id_/https://ncrb.gov.in/sites/default/files/CII%202020%20Volume%201.pdf", pages: 40, topic: NCRB_V1 },
  { id: "ncrb:2020:v3", what: "NCRB Crime in India 2020, Volume 3 (Wayback)", url: "https://web.archive.org/web/2022id_/https://ncrb.gov.in/sites/default/files/CII%202020%20Volume%203.pdf", pages: 40, topic: NCRB_V3 },
  { id: "ncrb:2021:v1", what: "NCRB Crime in India 2021, Volume 1 (Wayback)", url: "https://web.archive.org/web/2023id_/https://ncrb.gov.in/sites/default/files/CII-2021/CII_2021Volume%201.pdf", pages: 40, topic: NCRB_V1 },
  { id: "ncrb:2021:v3", what: "NCRB Crime in India 2021, Volume 3 (Wayback)", url: "https://web.archive.org/web/2023id_/https://ncrb.gov.in/sites/default/files/CII-2021/CII_2021Volume%203.pdf", pages: 40, topic: NCRB_V3 },
  { id: "press:arunachal-commemoration-188", what: "Police Commemoration Day 2023: 188 policemen (Arunachal Times/PTI)", url: "https://arunachaltimes.in/index.php/2023/10/22/188-policemen-made-supreme-sacrifice-in-last-one-year-shah/" },
  { id: "press:arunachal-commemoration-188-p", what: "Police Commemoration Day 2023 (Arunachal Times, by id)", url: "https://arunachaltimes.in/?p=226851" },
  { id: "press:organiser-commemoration-2020", what: "Police Commemoration Day 2020 (Organiser)", url: "https://organiser.org/2020/10/21/131162/bharat/police-commemoration-day/" },
  { id: "press:orissapost-commemoration-2021", what: "Police Commemoration Day 2021 (Orissa Post)", url: "https://www.orissapost.com/police-commemoration-day-tributes-paid-to-bravehearts/" },
  { id: "official:tripura-commemoration-2022", what: "Police Commemoration Day 2022 (Tripura ICA)", url: "https://ica.tripura.gov.in/sites/default/files/6804_22.pdf" },
  { id: "press:wire-amp-no-big-riot", what: "Over 389 died in communal riots in four years (The Wire, AMP)", url: "https://m.thewire.in/article/communalism/no-big-communal-riot-in-last-four-years-says-bjp-minister/amp" },
  { id: "press:bs-riots-2014", what: "90 dead in riots in 2014 (Business Standard/PTI)", url: "https://www.business-standard.com/article/pti-stories/90-dead-in-riots-in-2014-govt-claims-19-pc-decline-in-violence-114112600873_1.html" },
  { id: "press:tnm-communal-2015", what: "Communal incidents see 17 pc rise in 2015 (The News Minute)", url: "https://www.thenewsminute.com/news/communal-incidents-see-17-pc-rise-2015-max-mha-39351" },
  { id: "press:indiatv-communal-2015", what: "UP saw maximum communal incidents in 2015 (India TV)", url: "https://www.indiatvnews.com/news/india/up-saw-maximum-communal-incidents-deaths-in-2015-mha-57876.html" },
  { id: "press:hrw-delhi-2020", what: "Delhi riots (HRW)", url: "https://www.hrw.org/news/2020/04/10/shoot-traitors/discrimination-against-muslims-under-indias-new-citizenship-policy" },
  { id: "ls:120995", what: "Lok Sabha answer (railway losses to agitations)", url: "https://eparlib.nic.in/bitstream/123456789/619689/1/120995.pdf", alt: "https://web.archive.org/web/2025id_/https://eparlib.nic.in/bitstream/123456789/619689/1/120995.pdf" },
  { id: "ls:28295", what: "Lok Sabha answer (railway property damage)", url: "https://eparlib.sansad.in/bitstream/123456789/527763/1/28295.pdf", alt: "https://web.archive.org/web/2025id_/https://eparlib.sansad.in/bitstream/123456789/527763/1/28295.pdf" },
  { id: "ls:147151", what: "Lok Sabha answer (railways and agitations)", url: "https://eparlib.nic.in/bitstream/123456789/647899/1/147151.pdf", alt: "https://web.archive.org/web/2025id_/https://eparlib.nic.in/bitstream/123456789/647899/1/147151.pdf" },
  { id: "ls:68296", what: "Lok Sabha answer (Gujjar agitation railway damage)", url: "https://eparlib.nic.in/bitstream/123456789/569451/1/68296.pdf", alt: "https://web.archive.org/web/2025id_/https://eparlib.nic.in/bitstream/123456789/569451/1/68296.pdf" },
  { id: "ls:125663", what: "Lok Sabha answer (Assam 2012)", url: "https://eparlib.nic.in/bitstream/123456789/624806/1/125663.pdf", alt: "https://web.archive.org/web/2025id_/https://eparlib.nic.in/bitstream/123456789/624806/1/125663.pdf" },
  { id: "rs:2014-u1603", what: "Rajya Sabha unstarred 1603, 5 February 2014 (communal incidents)", url: "https://rsdebate.nic.in/bitstream/123456789/629744/2/PQ_230_05022014_U1603_p142_p144.pdf" },
  { id: "rs:2019-u349", what: "Rajya Sabha unstarred 349, 6 February 2019 (communal incidents)", url: "https://rsdebate.nic.in/bitstream/123456789/697075/2/PQ_248_06022019_U349_p123_p135.pdf" },
  { id: "rs:2023-u3734", what: "Rajya Sabha unstarred 3734, 5 April 2023", url: "https://rsdebate.nic.in/bitstream/123456789/738994/1/PQ_259_05042023_U3734_p187_p189.pdf" },
  { id: "mha:ls-6502-2013", what: "MHA, Lok Sabha answer 6502, 7 May 2013 (communal incidents)", url: "https://www.mha.gov.in/MHA1/Par2017/pdfs/par2013-pdfs/ls-070513/6502.pdf" },
  { id: "press:outlook-communal-2015-17", what: "Nearly 300 killed in communal clashes in three years: Govt (Outlook/PTI)", url: "https://www.outlookindia.com/national/more-than-hundred-in-2017-alone-nearly-300-people-were-killed-in-communal-clashe-news-310141" },
  { id: "press:indiatv-communal-2014", what: "Rajya Sabha: no significant increase in communal violence (India TV)", url: "https://www.indiatvnews.com/politics/national/rajya-sabha-no-significant-increase-communal-violence-34225.html" },
  { id: "press:indiaspend-communal", what: "India's disturbing communal incidents data (IndiaSpend)", url: "https://www.indiaspend.com/indias-disturbing-communal-incidents-data-61-a-month-50269" },
  { id: "press:sacw-communal", what: "Communal clashes, RTI reply (South Asia Citizens Wire archive)", url: "https://www.sacw.net/article13795.html" },
  { id: "press:oneindia-up-rti", what: "Over 300 died in 9 years in communal incidents in UP: RTI (OneIndia)", url: "https://www.oneindia.com/india/over-300-died-in-9-years-in-communal-incidents-in-up-rti-1551072.html" },
  { id: "press:statesman-jat", what: "2016 Jat stir: cases withdrawn (The Statesman)", url: "https://www.thestatesman.com/cities/2016-jat-stir-haryana-govt-re-instates-three-more-officers-1498831330.html" },
  { id: "press:dh-jat-panel-90", what: "Panel indicts 90 officials over Jat stir (Deccan Herald)", url: "https://www.deccanherald.com/india/panel-indicts-90-officials-jat-2064502" },
  { id: "press:dh-lakhimpur-sit", what: "SIT files 5,000-page chargesheet in Lakhimpur Kheri case (Deccan Herald)", url: "https://www.deccanherald.com/india/sit-files-5000-page-charge-sheet-in-lakhimpur-kheri-case-ashish-mishra-prime-accused-1067446.html" },
  { id: "press:dh-kashmir-2016-toll", what: "Youth dies in fresh clashes, toll rises (Deccan Herald, 2016)", url: "https://www.deccanherald.com/india/youth-dies-fresh-clashes-toll-2082453" },
  { id: "press:dh-caa-complaints", what: "Anti-CAA protests: 10 complaints against police, UP govt tells High Court (Deccan Herald)", url: "https://www.deccanherald.com/national/north-and-central/anti-caa-protests-10-complaints-against-police-personnel-up-govt-tells-hight-court-805646.html" },
  { id: "press:scroll-caa-hc-953529", what: "Anti-CAA protests in UP: state tells High Court (Scroll)", url: "https://amp.scroll.in/latest/953529/scroll_in" },
  { id: "press:tribune-yogi-no-firing", what: "In UP Assembly, Yogi says no protester died in police firing (Tribune)", url: "https://www.tribuneindia.com/news/nation/in-up-assembly-yogi-says-no-protester-died-in-police-firing-44107" },
  { id: "press:tribune-redfort-394", what: "Delhi Police compensation for personnel injured in tractor parade violence (Tribune)", url: "https://www.tribuneindia.com/news/nation/delhi-police-announces-compensation-for-personnel-injured-during-tractor-parade-violence-206415" },
  { id: "press:caravan-lakhimpur", what: "Eight killed in UP after convoy runs over farmer protesters (Caravan)", url: "https://caravanmagazine.in/crime/eight-killed-lakhimpur-kheri-farmer-protest-ajay-mishra-teni-convoy" },
  { id: "press:outlook-lakhimpur-sit", what: "Supreme Court relieves SIT in Lakhimpur Kheri case (Outlook)", url: "https://www.outlookindia.com/national/supreme-court-relieves-sit-in-lakhimpur-kheri-violence-case-news-318790" },
  { id: "press:dh-djhalli-claims", what: "DJ Halli riots claims commission to submit report (Deccan Herald)", url: "https://www.deccanherald.com/city/bengaluru-crime/dj-halli-riots-claims-commission-to-submit-report-in-2-months-1135030.html" },
  { id: "press:tnm-djhalli-claims-commissioner", what: "Karnataka HC appoints retired judge to assess Bengaluru riot damage (The News Minute)", url: "https://www.thenewsminute.com/karnataka/karnataka-hc-appoints-retired-judge-assess-damage-caused-bengaluru-riots-131802" },
  { id: "press:outlook-rail-roko", what: "Rail roko... roko (Outlook, Gujjar agitation)", url: "https://www.outlookindia.com/national/rail-roko-roko-news-238342" },
  { id: "press:indianawaaz-commemoration-2023", what: "Police Commemoration Day 2023 (Indian Awaaz)", url: "https://theindianawaaz.com/?p=263734" },
  { id: "press:gk-commemoration-2023", what: "Police Commemoration Day 2023 (Greater Kashmir)", url: "https://www.greaterkashmir.com/?p=237933" },
  { id: "press:quint-jat-10", what: "Ten killed and 150 injured in Jat quota protest (The Quint)", url: "https://www.thequint.com/news/hot-news/ten-killed-and-150-left-injured-in-jat-quota-protest-in-haryana" },
  { id: "press:dh-jat-probe-head", what: "Haryana govt does not want second bitter pill, says Jat probe head (Deccan Herald, AMP)", url: "https://www.deccanherald.com/amp/story/india%2Fharyana-govt-does-not-want-second-bitter-pill-says-jat-probe-head-545367.html" },
  { id: "press:fpj-bengal-railways-84", what: "Bengal protests: Railways loses Rs 84 crore (Free Press Journal/PTI)", url: "https://www.freepressjournal.in/india/bengal-protests-railways-loses-rs84cr" },
  { id: "press:bt-bengal-railways-84", what: "Anti-CAA protests: Railway suffered losses of Rs 84 crore in West Bengal (Business Today)", url: "https://www.businesstoday.in/latest/economy-politics/story/anti-caa-protests-railway-suffered-losses-of-rs-84-crore-in-west-bengal-242832-2020-01-11" },
  { id: "press:scroll-railways-80", what: "CAA protests: Railways says it will recover Rs 80 crore (Scroll)", url: "https://scroll.in/latest/948335/caa-protests-railways-says-it-will-recover-rs-80-crore-from-demonstrators-for-damaging-property" },
  { id: "press:dh-djhalli-assessors", what: "Karnataka govt drags feet on appointing assessors to process riots claims (Deccan Herald)", url: "https://www.deccanherald.com/india/karnataka/bengaluru/karnataka-govt-drags-feet-on-appointing-assessors-to-process-riots-claims-1022512.html" },
  { id: "press:csw-kandhamal", what: "Kandhamal: Supreme Court orders re-investigation (CSW)", url: "https://www.csw.org.uk/2016/08/24/press/3231/article.htm" },
  { id: "press:arabnews-gujjar", what: "Gujjar agitation spreads; death toll reaches 37 (Arab News)", url: "https://www.arabnews.com/node/312297" },
  { id: "press:aj-gujjar", what: "India caste riot toll rises (Al Jazeera, 2008)", url: "https://www.aljazeera.com/news/2008/5/25/india-caste-riot-toll-rises" },
  { id: "press:outlook-assam-2012", what: "A Turf War: Assam 2012 (Outlook)", url: "https://www.outlookindia.com/national/a-turf-war-news-281788" },
  { id: "press:aj-assam-2012", what: "India's PM promises help to riot victims (Al Jazeera)", url: "https://www.aljazeera.com/news/2012/7/28/indias-pm-promises-help-to-riot-victims" },
  { id: "press:bt-sambhal", what: "Sambhal: 4 dead (Business Today)", url: "https://www.businesstoday.in/india/story/sambhal-riots-in-up-4-dead-internet-shutdown-amid-clashes-over-mosque-survey-heres-what-we-know-so-far-454978-2024-11-25" },
  { id: "press:aj-sambhal", what: "Arrests after Muslims killed in Sambhal (Al Jazeera)", url: "https://www.aljazeera.com/news/2024/11/25/arrests-after-muslims-killed-in-mosque-survey-violence-in-indias-sambhal" },
  { id: "press:fpj-sambhal-panel", what: "Sambhal judicial commission report (Free Press Journal)", url: "https://www.freepressjournal.in/india/sambhal-mosque-survey-violence-was-pre-planned-conspiracy-says-judicial-commission-report" },
  { id: "press:dh-caa-up-15", what: "CAA row: UP death toll rises to 15 (Deccan Herald)", url: "https://www.deccanherald.com/india/caa-row-up-death-toll-rises-to-15-protests-continue-787604.html" },
  { id: "press:wire-caa-25", what: "The 25 people killed during anti-CAA protests (The Wire, AMP)", url: "https://m.thewire.in/article/rights/anti-caa-protest-deaths/amp" },
  { id: "press:govnow-patidar", what: "Patel quota stir toll rises to 8 (Governance Now)", url: "https://www.governancenow.com/news/regular-story/gujarat-tense-death-patel-quota-stir-rises-8-army-streets" },
  { id: "press:quint-patidar-14", what: "Families of the 14 killed in the Patidar agitation (The Quint)", url: "https://www.thequint.com/gujarat-elections/hardik-patel-patidar-andolan-movement-protests-bjp-families-of-14-who-died-killed-police-firing-2015-2017-2022" },
  { id: "press:bs-murshidabad", what: "Murshidabad: 150 held, central forces deployed (Business Standard)", url: "https://www.business-standard.com/india-news/west-bengal-murshidabad-waqf-act-protests-violence-arrests-deaths-tmc-bjp-125041300242_1.html" },
  { id: "press:sabrang-murshidabad", what: "Waqf protests escalate in West Bengal (Sabrang)", url: "https://sabrangindia.in/protests-over-waqf-amendment-act-escalate-into-violence-in-west-bengal-calcutta-hc-intervenes/" },
  { id: "press:tnm-bengaluru-2020", what: "Bengaluru violence: damages to be recovered (The News Minute)", url: "https://www.thenewsminute.com/karnataka/bengaluru-violence-karnataka-govt-moves-recover-damages-culprits-130923" },
  { id: "press:hitavada-bengaluru-2020", what: "3 killed in police firing in Bengaluru (The Hitavada/PTI)", url: "https://www.thehitavada.com/Encyc/2020/8/13/3-killed-in-police-firing-in-violence-over-social-media-post-in-B-luru.html" },
  { id: "press:wire-amp-prakash-singh", what: "Prakash Singh committee report (The Wire, AMP)", url: "https://m.thewire.in/article/politics/the-prakash-singh-committee-report-administrative-failure-and-other-learnings-from-haryanas-jat-riots/amp" },
  { id: "press:wire-amp-delhi-affidavit", what: "Delhi Police affidavit (The Wire, AMP)", url: "https://m.thewire.in/article/communalism/delhi-police-affidavit-shows-muslims-bore-brunt-of-riots-silent-on-who-targeted-them-and-why/amp" },
  { id: "press:wire-amp-dera-report", what: "Haryana report to Centre on Dera violence (The Wire, AMP)", url: "https://m.thewire.in/article/politics/gurmeet-ram-rahim-dera-sacha-sauda-haryana-government/amp" },
  { id: "press:wire-amp-communal-rti", what: "Over 1600 killed in communal clashes 2004-2017 (The Wire, AMP)", url: "https://m.thewire.in/article/politics/communal-clashes-data-killed/amp" },
  { id: "press:wire-amp-communal-2016-20", what: "Communal riots 2016-2020 (The Wire, AMP)", url: "https://m.thewire.in/article/government/india-commuanl-religious-riots-2016-2020/amp" },
  { id: "ls:5195", what: "Lok Sabha answer (communal incidents)", url: "https://eparlib.nic.in/bitstream/123456789/727282/1/5195.pdf", alt: "https://web.archive.org/web/2025id_/https://eparlib.nic.in/bitstream/123456789/727282/1/5195.pdf" },
  { id: "ls:20238", what: "Lok Sabha answer", url: "https://eparlib.sansad.in/bitstream/123456789/519754/1/20238.pdf", alt: "https://web.archive.org/web/2025id_/https://eparlib.sansad.in/bitstream/123456789/519754/1/20238.pdf" },
  { id: "ls:30549", what: "Lok Sabha answer", url: "https://eparlib.sansad.in/bitstream/123456789/677173/1/30549.pdf", alt: "https://web.archive.org/web/2025id_/https://eparlib.sansad.in/bitstream/123456789/677173/1/30549.pdf" },
  { id: "ls:98529", what: "Lok Sabha answer", url: "https://eparlib.nic.in/bitstream/123456789/595219/1/98529.pdf", alt: "https://web.archive.org/web/2025id_/https://eparlib.nic.in/bitstream/123456789/595219/1/98529.pdf" },
  { id: "ls:20180", what: "Lok Sabha answer", url: "https://eparlib.nic.in/bitstream/123456789/665987/1/20180.pdf", alt: "https://web.archive.org/web/2025id_/https://eparlib.nic.in/bitstream/123456789/665987/1/20180.pdf" },
  { id: "ls:140601", what: "Lok Sabha answer", url: "https://eparlib.nic.in/bitstream/123456789/640964/1/140601.pdf", alt: "https://web.archive.org/web/2025id_/https://eparlib.nic.in/bitstream/123456789/640964/1/140601.pdf" },
  { id: "ls:127126", what: "Lok Sabha answer", url: "https://eparlib.nic.in/bitstream/123456789/626398/1/127126.pdf", alt: "https://web.archive.org/web/2025id_/https://eparlib.nic.in/bitstream/123456789/626398/1/127126.pdf" },
  { id: "mha:ls-1544-2022", what: "MHA, Lok Sabha unstarred 1544, 26 July 2022", url: "https://www.mha.gov.in/MHA1/Par2017/pdfs/par2022-pdfs/LS26072022/1544.pdf" },
  { id: "press:scroll-agnipath", what: "Agnipath: Railways lost Rs 259.44 crore (Scroll)", url: "https://scroll.in/latest/1028857/agnipath-railways-suffered-losses-worth-rs-259-44-crore-during-protests-centre-tells-parliament" },
  { id: "press:bt-agnipath-trains", what: "Agnipath: 2,132 trains cancelled (Business Today)", url: "https://www.businesstoday.in/latest/trends/story/agnipath-over-2000-trains-cancelled-during-protests-from-june-15-23-says-govt-342400-2022-07-22" },
  { id: "press:wire-prakash-singh", what: "Prakash Singh committee report (The Wire)", url: "https://thewire.in/politics/the-prakash-singh-committee-report-administrative-failure-and-other-learnings-from-haryanas-jat-riots" },
  { id: "press:scroll-delhi-541", what: "Delhi riots: 541 FIRs of damaging property (Scroll)", url: "https://scroll.in/latest/1033356/delhi-riots-of-541-firs-of-damaging-property-probe-incomplete-in-213-cases-police-tell-hc" },
  { id: "press:wire-delhi-affidavit", what: "Delhi Police affidavit, list of the dead (The Wire)", url: "https://thewire.in/communalism/delhi-police-affidavit-shows-muslims-bore-brunt-of-riots-silent-on-who-targeted-them-and-why" },
  { id: "press:aa-manipur-152", what: "Manipur: 152 killed, Home Minister (Anadolu)", url: "https://www.aa.com.tr/en/asia-pacific/152-killed-since-may-in-restive-indian-state-home-minister/2964396" },
  { id: "press:siasat-manipur-260", what: "Lok Sabha confirms President's Rule in Manipur (Siasat/PTI)", url: "https://www.siasat.com/lok-sabha-confirms-imposition-of-presidents-rule-in-manipur-3202507/" },
  { id: "press:dtnext-manipur-260", what: "Lok Sabha confirms President's rule in Manipur (DT Next)", url: "https://www.dtnext.in/news/national/lok-sabha-confirms-imposition-of-presidents-rule-in-manipur-828717" },
  { id: "press:scroll-dera", what: "30 dead, 250 injured after Dera verdict (Scroll)", url: "https://scroll.in/latest/848489/30-dead-250-injured-in-violence-after-court-convicts-dera-chief-ram-rahim-singh-in-rape-case" },
  { id: "press:wire-dera-report", what: "Haryana report to Centre on Dera violence (The Wire)", url: "https://thewire.in/politics/gurmeet-ram-rahim-dera-sacha-sauda-haryana-government" },
  { id: "press:wire-dera-36", what: "Haryana riots: death toll 36 (The Wire)", url: "https://thewire.in/171196/haryana-riots-dera-sacha-sauda" },
  { id: "press:scroll-caa-notices", what: "UP withdraws 274 recovery notices (Scroll)", url: "https://scroll.in/latest/1017701/anti-caa-agitation-uttar-pradesh-withdraws-recovery-notices-against-274-alleged-protestors" },
  { id: "press:livelaw-caa-refund", what: "SC: refund recoveries from anti-CAA protesters (LiveLaw)", url: "https://www.livelaw.in/top-stories/supreme-courts-criticism-up-govt-withdraws-recovery-notices-issued-anti-caa-protesters-directs-refund-recoveries-192249" },
  { id: "rights:hrw-ladakh", what: "India: 4 dead in protests over Ladakh statehood (HRW)", url: "https://www.hrw.org/news/2025/09/25/india-4-dead-in-protests-over-ladakh-statehood" },
  { id: "press:gk-ladakh", what: "Ladakh: 4 killed, 59 injured (Greater Kashmir)", url: "https://www.greaterkashmir.com/article/4-killed-59-injured/436840" },
  { id: "press:excelsior-2010", what: "Over 6,500 booked for violence in Kashmir in 2010 (Daily Excelsior)", url: "https://www.dailyexcelsior.com/6500-people-booked-violence-kashmir-2010/" },
  { id: "ls:95203", what: "Lok Sabha answer (Kashmir 2010)", url: "https://eparlib.nic.in/bitstream/123456789/591598/1/95203.pdf", alt: "https://web.archive.org/web/2025id_/https://eparlib.nic.in/bitstream/123456789/591598/1/95203.pdf" },
  { id: "ls:105867", what: "Lok Sabha answer (Kashmir 2010)", url: "https://eparlib.nic.in/bitstream/123456789/603257/1/105867.pdf", alt: "https://web.archive.org/web/2025id_/https://eparlib.nic.in/bitstream/123456789/603257/1/105867.pdf" },
  { id: "ls:142932", what: "Lok Sabha answer (Crime in India 2012)", url: "https://eparlib.nic.in/bitstream/123456789/643487/1/142932.pdf", alt: "https://web.archive.org/web/2025id_/https://eparlib.nic.in/bitstream/123456789/643487/1/142932.pdf" },
  { id: "ls:147410", what: "Lok Sabha answer", url: "https://eparlib.nic.in/bitstream/123456789/648139/1/147410.pdf", alt: "https://web.archive.org/web/2025id_/https://eparlib.nic.in/bitstream/123456789/648139/1/147410.pdf" },
  { id: "press:dh-muzaffarnagar", what: "Violence-hit UP town (Deccan Herald)", url: "https://www.deccanherald.com/india/violence-hit-up-town-continues-2292794" },
  { id: "press:maktoob-muzaffarnagar", what: "How many lives did 2013 Muzaffarnagar violence claim (Maktoob)", url: "https://maktoobmedia.com/features/how-many-lives-did-2013-muzaffarnagar-violence-claim/" },
  { id: "press:quint-stone-2018", what: "759 stone pelting incidents in 2018: MHA (The Quint)", url: "https://www.thequint.com/news/india/stone-pelting-incidents-in-jammu-and-kashmir-in-2018" },
  { id: "press:kd-stone-2019", what: "2019 recorded most stone pelting incidents: RTI (Kashmir Despatch)", url: "https://kashmirdespatch.com/2019-recorded-most-number-of-stone-pelting-incidents-in-jk-report/" },
  { id: "press:tribune-commemoration-216", what: "Amit Shah on Police Commemoration Day (Tribune)", url: "https://www.tribuneindia.com/news/india/amit-shah-says-fight-against-terror-attempts-to-incite-religious-sentiments-will-continue" },
  { id: "press:factly-rioting", what: "What does the data related to cases of rioting indicate (Factly)", url: "https://factly.in/data-what-does-the-data-related-to-cases-of-rioting-indicate/" },
  { id: "press:factly-firing-2009-13", what: "Police firings: more than 4000 incidents 2009-2013 (Factly)", url: "https://factly.in/police-firings-india-more-than-4000-incidents-from-2009-2013/" },
  { id: "press:wire-communal-rti", what: "Over 1600 killed in communal clashes 2004-2017, RTI (The Wire)", url: "https://thewire.in/politics/communal-clashes-data-killed" },
  { id: "press:wire-communal-2016-20", what: "Communal riots 2016-2020 (The Wire)", url: "https://thewire.in/government/india-commuanl-religious-riots-2016-2020" },
  { id: "press:factchecker-rijiju", what: "Fewer riots under Modi regime: Rijiju data (FactChecker)", url: "https://www.factchecker.in/fewer-riots-minorities-safer-under-modi-regime-kiren-rijiju-data-right-on-riots-but-claim-on-safer-minorities-without-foundation" },
  { id: "press:sabrang-869-703", what: "NCRB recorded 869 communal riots, MHA 703 (Sabrang)", url: "https://sabrangindia.in/2016-ncrb-recorded-869-communal-riots-home-ministry-says-703/" },
  { id: "press:tnm-riots-2015", what: "Religious riots down in 2015 (The News Minute)", url: "https://www.thenewsminute.com/news/religious-riots-down-2015-other-riots-rise-49912" },
  { id: "press:tribune-state-2020", what: "Highest crime-against-State FIRs in UP: NCRB (Tribune)", url: "https://www.tribuneindia.com/news/nation/highest-number-of-crime-against-state-firs-in-up-shows-ncrb-data-332193" },
  { id: "press:dh-uapa-2022", what: "Over 75 UAPA cases in 2022 (Deccan Herald)", url: "https://www.deccanherald.com/india/over-75-uapa-cases-in-2022-from-jammu-kashmir-manipur-assam-up-bengal-had-25-sedition-cases-ncrb-2796648" },
  { id: "press:sabrang-police-actions", what: "Civilian deaths in police actions: NCRB (Sabrang)", url: "https://sabrangindia.in/civilian-deaths-police-actions-surge-record-levels-ncrb-report/" },
  { id: "press:scroll-firing-7yrs", what: "Over 7 years, 2 civilians died a week in police firing (Scroll)", url: "https://scroll.in/article/840842/over-seven-years-two-civilians-died-every-week-in-police-firing" },
  { id: "press:dh-red-fort", what: "Crime Branch to probe Red Fort violence (Deccan Herald)", url: "https://www.deccanherald.com/india/delhi-police-crime-branch-to-probe-violence-at-red-fort-ito-7-other-places-during-farmers-tractor-rally-944450.html" },
  { id: "press:dtnext-nuh", what: "Haryana violence: 6 dead, 116 arrested (DT Next)", url: "https://www.dtnext.in/news/national/haryana-violence-6-dead-116-people-arrested-says-cm-khattar" },
  { id: "press:tribune-nuh-393", what: "Haryana violence: 393 held, 160 FIRs (Tribune)", url: "https://www.tribuneindia.com/news/haryana/haryana-violence-393-held-160-firs-registered-suspension-of-mobile-internet-sms-service-in-nuh-extended-534243" },
  { id: "press:scroll-bandh-2018", what: "Bharat Bandh: nine killed (Scroll)", url: "https://scroll.in/latest/874124/bharat-bandh-dalit-protestors-block-trains-in-bihar-odisha-against-scs-order-on-sc-st-act" },
  { id: "press:dh-haldwani", what: "Six killed in Haldwani violence (Deccan Herald)", url: "https://www.deccanherald.com/india/uttarakhand/six-killed-in-violence-in-haldwani-after-razing-of-illegally-built-madrasa-mosque-2887422" },
  { id: "press:aj-haldwani", what: "Killed by police bullets: Haldwani (Al Jazeera)", url: "https://www.aljazeera.com/features/2024/2/13/killed-by-police-bullets-deadly-attacks-on-muslims-in-indias-haldwani" },
  { id: "prs:communal-2011", what: "PRS Vital Stats: Communal violence in India (2011)", url: "https://prsindia.org/files/policy/policy_vital_state/1308201190_Vital%20Stats%20-%20Communal%20Violence%20in%20India%2014Jun11%20v2.pdf" },
];

interface Kept { page: number; text: string }

function anchors(html: string, base: string): Array<{ href: string; text: string }> {
  const out: Array<{ href: string; text: string }> = [];
  for (const m of html.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const raw = m[1] ?? "";
    if (!raw || raw.startsWith("#") || raw.startsWith("javascript:")) continue;
    const text = (m[2] ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    let href = raw;
    try { href = new URL(raw, base).toString(); } catch { /* as written */ }
    out.push({ href, text });
  }
  return out;
}

async function download(url: string): Promise<{ ok: boolean; status: string; buf?: Buffer; type?: string }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*" }, signal: AbortSignal.timeout(90_000), redirect: "follow" });
      if (!res.ok) { if (attempt === 1 || res.status < 500) return { ok: false, status: `HTTP ${res.status}` }; continue; }
      return { ok: true, status: `HTTP ${res.status}`, buf: Buffer.from(await res.arrayBuffer()), type: res.headers.get("content-type") ?? "" };
    } catch (e) {
      if (attempt === 1) return { ok: false, status: (e as Error).message };
    }
    await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
  }
  return { ok: false, status: "unreachable" };
}

/** Some hosts (the Lok Sabha archive) break Node's HTTP parser; curl reads them. */
function curlDownload(url: string): { ok: boolean; status: string; buf?: Buffer } {
  const dir = mkdtempSync(join(tmpdir(), "po-curl-"));
  const out = join(dir, "body");
  try {
    execFileSync("curl", ["-sSL", "--connect-timeout", "20", "--max-time", "75", "-A", UA, "-o", out, url], { stdio: "ignore", timeout: 90_000 });
    return existsSync(out) ? { ok: true, status: "curl", buf: readFileSync(out) } : { ok: false, status: "curl: no body" };
  } catch (e) { return { ok: false, status: `curl: ${(e as Error).message.slice(0, 120)}` }; }
}

function pdfPages(buf: Buffer): string[] {
  const dir = mkdtempSync(join(tmpdir(), "po-"));
  const pdf = join(dir, "doc.pdf"), txt = join(dir, "doc.txt");
  writeFileSync(pdf, buf);
  execFileSync("pdftotext", ["-layout", pdf, txt], { stdio: "ignore", timeout: 300_000, maxBuffer: 1 << 28 });
  return existsSync(txt) ? readFileSync(txt, "utf8").split("\f") : [];
}

const errors: string[] = [];
process.on("unhandledRejection", (e) => { errors.push(`unhandled: ${(e as Error)?.stack ?? e}`); console.error("unhandled", e); });
process.on("uncaughtException", (e) => { errors.push(`uncaught: ${e.stack ?? e}`); console.error("uncaught", e); });

async function main(): Promise<void> {
  const listings: unknown[] = [];
  for (const l of LISTINGS) try {
    await new Promise((r) => setTimeout(r, 1500));
    const res = await getText(l.url, { timeoutMs: 45_000, retries: 1, cacheMs: 0 });
    if (!res.ok || !res.data) { listings.push({ id: l.id, url: l.url, ok: false, status: res.error ?? "no body" }); console.log(`  ${l.id}: ${res.error}`); continue; }
    if (l.id.startsWith("wayback:")) {
      try { const rows = JSON.parse(res.data) as string[][]; listings.push({ id: l.id, url: l.url, ok: true, links: rows.slice(1).map((r) => ({ href: r[0], text: r[1] })) }); }
      catch (e) { listings.push({ id: l.id, url: l.url, ok: false, status: (e as Error).message }); }
      continue;
    }
    if (l.id.startsWith("opencity:")) {
      try {
        type Pk = { name: string; title: string; resources?: Array<{ name: string; url: string }> };
        const j = JSON.parse(res.data) as { result?: { results?: Pk[] } & Partial<Pk> };
        const list: Pk[] = j.result?.results ?? (j.result?.name ? [j.result as Pk] : []);
        const pk = list.map((p) => ({ name: p.name, title: p.title, resources: (p.resources ?? []).map((r) => ({ name: r.name, url: r.url })) }));
        listings.push({ id: l.id, url: l.url, ok: true, packages: pk });
      } catch (e) { listings.push({ id: l.id, url: l.url, ok: false, status: (e as Error).message }); }
      continue;
    }
    const docs = anchors(res.data, l.url).filter((a) => /\.(?:pdf|xlsx?|csv|zip)(?:$|\?)/i.test(a.href));
    const byHref = new Map<string, string>();
    for (const a of docs) { const p = byHref.get(a.href); if (p === undefined || a.text.length > p.length) byHref.set(a.href, a.text); }
    listings.push({ id: l.id, url: l.url, ok: true, links: [...byHref].map(([href, text]) => ({ href, text })).slice(0, 400) });
    console.log(`  ${l.id}: ${byHref.size} documents`);
  } catch (e) { errors.push(`${l.id}: ${(e as Error).stack ?? e}`); }

  // What earlier runs read is kept, and not fetched again: a document read
  // whole once does not need reading every run. One whose pages were cut at
  // the old 9,000-character limit is read again.
  type Doc = { id: string; ok: boolean; url: string; readAt?: string; kept?: Kept[]; pdf?: boolean };
  let prev: Doc[] = [];
  let prevAt: string | undefined;
  try { const f = JSON.parse(readFileSync(OUT, "utf8")) as { probedAt?: string; documents?: Doc[] }; prev = f.documents ?? []; prevAt = f.probedAt; } catch { /* first run */ }
  const prevById = new Map(prev.map((x) => [x.id, x]));
  const reusable = (d: { id: string; url: string }) => {
    const o = prevById.get(d.id);
    return !!o && o.ok && o.url === d.url && !(o.pdf && (o.kept ?? []).some((k) => k.text.length === 9000));
  };
  const results = new Map<string, Doc>();
  const listed = new Set(DOCS.map((d) => d.id));
  for (const o of prev) if (o.ok && listed.has(o.id)) results.set(o.id, { ...o, readAt: o.readAt ?? prevAt });

  const save = async () => {
    await mkdir(dirname(OUT), { recursive: true });
    await writeFile(OUT, JSON.stringify({ probedAt: new Date().toISOString(), refusal: "Source text for checking, not data. Nothing here is rendered.", errors, listings, documents: [...results.values()] }, null, 1));
  };

  const ids = DOCS.map((d) => d.id);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) throw new Error(`duplicate document ids: ${dup.join(", ")}`);
  const isWb = (u: string) => u.includes("web.archive.org/");
  const pending = DOCS.filter((d) => !reusable(d));
  const queue = pending.filter((d) => !isWb(d.url));
  // The Wayback Machine answers 429 to four at a time: it gets one request
  // every few seconds, after everything else, with a pause on 429.
  const wbQueue = pending.filter((d) => isWb(d.url));
  console.log(`  ${DOCS.length - queue.length} documents already read; fetching ${queue.length}`);
  const one = async (d: (typeof DOCS)[number], url = d.url) => {
    let got: { ok: boolean; status: string; buf?: Buffer } = await download(url);
    if (!got.ok && !isWb(url)) { const c = curlDownload(url); if (c.ok) got = c; else got = { ok: false, status: `${got.status}; ${c.status}` }; }
    if (!got.ok && d.alt && url !== d.alt) { wbQueue.push({ ...d, url: d.alt }); console.log(`  ${d.id}: ${got.status}; queued its archived copy`); return; }
    if (got.ok && got.buf && url !== d.url) console.log(`  ${d.id}: read from its archived copy`);
    if (!got.ok || !got.buf) { if (!results.get(d.id)?.ok) results.set(d.id, { id: d.id, url: d.url, ok: false, ...{ what: d.what, status: got.status } } as Doc); console.log(`  ${d.id}: ${got.status}`); return; }
    let pages: string[] = [];
    const isPdf = got.buf.subarray(0, 5).toString() === "%PDF-";
    // A PDF link that answers with a web page is an error page, not the document.
    if (!isPdf && /\.pdf(?:$|\?)/i.test(url)) { if (!results.get(d.id)?.ok) results.set(d.id, { id: d.id, url: d.url, ok: false, ...{ what: d.what, status: "not a PDF" } } as Doc); console.log(`  ${d.id}: not a PDF`); return; }
    try { pages = isPdf ? pdfPages(got.buf) : [got.buf.toString("utf8").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ")]; }
    catch (e) { errors.push(`${d.id}: extract: ${(e as Error).message}`); return; }
    const kept: Kept[] = [];
    // A web page is one article: keep its text whole. A PDF keeps the pages on topic.
    if (!isPdf) kept.push({ page: 1, text: (pages[0] ?? "").replace(/\s*\n\s*/g, "\n").slice(0, 60000) });
    else pages.forEach((t, i) => { if ((d.topic ?? TOPIC).test(t) && kept.length < (d.pages ?? 12)) kept.push({ page: i + 1, text: t.slice(0, 40000) }); });
    results.set(d.id, { id: d.id, what: d.what, url: d.url, ok: true, pdf: isPdf, bytes: got.buf.length, pagesTotal: pages.length, kept, readAt: new Date().toISOString() } as Doc);
    console.log(`  ${d.id}: ${pages.length} pages, ${kept.length} kept`);
  };
  // Four at a time, saving after each, so a run stopped by its time limit
  // still leaves everything it finished.
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < queue.length) {
      const d = queue[next++]!;
      try { await one(d); } catch (e) { errors.push(`${d.id}: ${(e as Error).stack ?? e}`); }
      await save();
    }
  }));
  // Most useful first: whole volumes, then the police firing chapters.
  const rank = (d: { id: string }) => (/^ncrb:20(19|20|21)/.test(d.id) ? 0 : /chapter14|ch14/.test(d.id) ? 1 : /^ls:/.test(d.id) ? 2 : 3);
  wbQueue.sort((a, b) => rank(a) - rank(b));
  let refusals = 0;
  for (const d of wbQueue) {
    if (refusals >= 3) { console.log(`  wayback: stopped after ${refusals} refusals in a row; ${d.id} and later wait for the next run`); break; }
    await new Promise((r) => setTimeout(r, 12_000));
    try {
      await one(d, d.url);
      const status = String((results.get(d.id) as { status?: string } | undefined)?.status ?? "");
      if (!results.get(d.id)?.ok && /429|fetch failed/.test(status)) {
        await new Promise((r) => setTimeout(r, 90_000));
        await one(d, d.url);
      }
      refusals = results.get(d.id)?.ok ? 0 : refusals + 1;
    } catch (e) { errors.push(`${d.id}: ${(e as Error).stack ?? e}`); }
    await save();
  }
  await save();
}

// A fatal error leaves the previous file in place rather than replacing what
// earlier runs read with an error message.
main().catch((e) => { console.error(e); });
