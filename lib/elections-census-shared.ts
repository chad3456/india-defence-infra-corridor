/** Client-safe types for the census profiles (lib/elections-census.ts reads the files). */
export interface DistrictProfile {
  district: string; population: number;
  /** Women per 1,000 men in the census population. */
  sexRatio: number;
  literacy: number; femaleLiteracy: number;
  sc: number; st: number;
  religion: Array<[string, number]>;
}
