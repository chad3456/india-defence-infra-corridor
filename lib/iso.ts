/**
 * ISO 3166-1 alpha-3 to numeric, and nothing else.
 *
 * ── Why this table is in the repository ──────────────────────────────────
 *
 * Data sources name countries by alpha-3 code ("IND"). The world atlas this
 * project draws maps with identifies them by numeric code ("356"). Without a
 * crosswalk the two cannot be joined, and joining on country NAME instead is
 * the failure that silently drops exactly the countries whose names are most
 * often written differently — Korea, Côte d'Ivoire, Türkiye, the Democratic
 * Republic of the Congo.
 *
 * This is a published standard rather than a finding: nothing here is measured,
 * estimated or attributable to anyone, and it does not change. It is typed out
 * rather than fetched because a build should not need the network to draw a
 * map, and because a crosswalk that failed to load would take every map on the
 * site down at once.
 *
 * Territories the atlas cannot draw at 110m resolution — Singapore, Hong Kong,
 * Malta and the rest of the small states — are still here. A caller that gets
 * a code back and finds no outline should say the country is not drawn, which
 * is a different statement from the country being absent from the data.
 */

const TABLE = `
ABW533 AFG004 AGO024 AIA660 ALA248 ALB008 AND020 ARE784 ARG032 ARM051 ASM016 ATA010 ATF260 ATG028
AUS036 AUT040 AZE031 BDI108 BEL056 BEN204 BES535 BFA854 BGD050 BGR100 BHR048 BHS044 BIH070 BLM652
BLR112 BLZ084 BMU060 BOL068 BRA076 BRB052 BRN096 BTN064 BVT074 BWA072 CAF140 CAN124 CCK166 CHE756
CHL152 CHN156 CIV384 CMR120 COD180 COG178 COK184 COL170 COM174 CPV132 CRI188 CUB192 CUW531 CXR162
CYM136 CYP196 CZE203 DEU276 DJI262 DMA212 DNK208 DOM214 DZA012 ECU218 EGY818 ERI232 ESH732 ESP724
EST233 ETH231 FIN246 FJI242 FLK238 FRA250 FRO234 FSM583 GAB266 GBR826 GEO268 GGY831 GHA288 GIB292
GIN324 GLP312 GMB270 GNB624 GNQ226 GRC300 GRD308 GRL304 GTM320 GUF254 GUM316 GUY328 HKG344 HMD334
HND340 HRV191 HTI332 HUN348 IDN360 IMN833 IND356 IOT086 IRL372 IRN364 IRQ368 ISL352 ISR376 ITA380
JAM388 JEY832 JOR400 JPN392 KAZ398 KEN404 KGZ417 KHM116 KIR296 KNA659 KOR410 KWT414 LAO418 LBN422
LBR430 LBY434 LCA662 LIE438 LKA144 LSO426 LTU440 LUX442 LVA428 MAC446 MAF663 MAR504 MCO492 MDA498
MDG450 MDV462 MEX484 MHL584 MKD807 MLI466 MLT470 MMR104 MNE499 MNG496 MNP580 MOZ508 MRT478 MSR500
MTQ474 MUS480 MWI454 MYS458 MYT175 NAM516 NCL540 NER562 NFK574 NGA566 NIC558 NIU570 NLD528 NOR578
NPL524 NRU520 NZL554 OMN512 PAK586 PAN591 PCN612 PER604 PHL608 PLW585 PNG598 POL616 PRI630 PRK408
PRT620 PRY600 PSE275 PYF258 QAT634 REU638 ROU642 RUS643 RWA646 SAU682 SDN729 SEN686 SGP702 SGS239
SHN654 SJM744 SLB090 SLE694 SLV222 SMR674 SOM706 SPM666 SRB688 SSD728 STP678 SUR740 SVK703 SVN705
SWE752 SWZ748 SXM534 SYC690 SYR760 TCA796 TCD148 TGO768 THA764 TJK762 TKL772 TKM795 TLS626 TON776
TTO780 TUN788 TUR792 TUV798 TWN158 TZA834 UGA800 UKR804 UMI581 URY858 USA840 UZB860 VAT336 VCT670
VEN862 VGB092 VIR850 VNM704 VUT548 WLF876 WSM882 YEM887 ZAF710 ZMB894 ZWE716
`;

const ALPHA_TO_NUM = new Map<string, string>();
const NUM_TO_ALPHA = new Map<string, string>();
for (const token of TABLE.trim().split(/\s+/)) {
  const alpha = token.slice(0, 3);
  const num = token.slice(3);
  if (alpha.length !== 3 || num.length !== 3) continue;
  ALPHA_TO_NUM.set(alpha, num);
  NUM_TO_ALPHA.set(num, alpha);
}

/** The atlas's numeric id for an alpha-3 code, or undefined. Never a guess. */
export function numericOf(alpha3: string): string | undefined {
  return ALPHA_TO_NUM.get(alpha3.toUpperCase());
}

/** The alpha-3 code for an atlas numeric id, or undefined. */
export function alphaOf(numeric: string | number): string | undefined {
  return NUM_TO_ALPHA.get(String(numeric).padStart(3, "0"));
}

export function isoCount(): number {
  return ALPHA_TO_NUM.size;
}
