/**
 * Types and the room register for /museum, safe for the client.
 *
 * A room is either one artist or one school of painting, named by its
 * English Wikipedia article so the Wikidata item is resolved at ingest, never
 * hard-coded. What hangs in a room is decided by the record, not by taste:
 * every work there is a painting Wikidata attributes to the artist or the
 * school, with a Commons image whose licence Commons itself says is free.
 * "Best" is the ingest's ordering — works with articles in the most Wikipedia
 * languages first — and the page says so.
 */

export interface Room {
  id: string;
  title: string;
  /** One line under the title, in the gallery's voice. */
  line: string;
  /** Artists (P170) or schools (P135) whose works hang here, by enwiki title. */
  artists?: string[];
  movements?: string[];
  /**
   * Commons categories to draw from as well, for schools whose paintings are
   * rarely tagged with the school on Wikidata. Several spellings are listed
   * because Commons names vary; the ones that do not exist simply add nothing.
   */
  categories?: string[];
  /** Commons searches, for schools whose categories are thin or misnamed. */
  searches?: string[];
  /** Wall colour of the room, a museum's paint, not a data encoding. */
  wall: string;
}

export const ROOMS: Room[] = [
  { id: "mughal", title: "The Mughal Court", line: "Albums and manuscripts made in the imperial workshops.", movements: ["Mughal painting"], categories: ["Mughal miniatures", "Mughal paintings", "Mughal painting", "Akbarnama", "Padshahnama", "Hamzanama"], wall: "#2f4a3a" },
  { id: "rajput", title: "Rajput Courts", line: "Painting for the kingdoms of Rajasthan and Central India.", movements: ["Rajput painting"], categories: ["Rajput painting", "Rajput paintings", "Rajasthani painting", "Mewar painting", "Bundi painting", "Kishangarh painting", "Kota painting"], wall: "#7a2e2a" },
  { id: "pahari", title: "The Hills", line: "Pahari painting from the Himalayan foothill courts.", movements: ["Pahari painting"], categories: ["Pahari painting", "Pahari paintings", "Kangra painting", "Basohli painting", "Guler painting"], wall: "#33506b" },
  { id: "deccan", title: "The Deccan", line: "Painting at the sultanate courts of the south.", movements: ["Deccan painting"], categories: ["Deccan painting", "Deccani painting", "Deccani paintings", "Bijapur painting", "Golconda painting"], searches: ['"Deccani painting"', '"Deccan painting" Bijapur', '"Deccan painting" Golconda'], wall: "#4b3a5e" },
  { id: "company", title: "Company Painting", line: "Indian artists painting for British patrons.", movements: ["Company painting"], categories: ["Company painting", "Company style paintings", "Company School paintings", "Company School"], searches: ['"Company painting"', '"Company style" painting India', '"Company School" painting'], wall: "#5d5040" },
  { id: "kalighat", title: "Kalighat", line: "Quick, bold pictures sold near the Kalighat temple in Calcutta.", movements: ["Kalighat painting"], categories: ["Kalighat painting", "Kalighat paintings", "Kalighat pat"], wall: "#8a5a1e" },
  { id: "ravivarma", title: "Raja Ravi Varma", line: "Oil painting, the epics, and the printing press.", artists: ["Raja Ravi Varma"], wall: "#6b1f2a" },
  { id: "bengal", title: "The Bengal School", line: "The Tagores and a return to Indian ways of painting.", artists: ["Abanindranath Tagore", "Gaganendranath Tagore", "Rabindranath Tagore"], movements: ["Bengal School of Art"], wall: "#465a3a" },
  { id: "shergil", title: "Amrita Sher-Gil", line: "Paris training, Indian subjects, a short life.", artists: ["Amrita Sher-Gil"], wall: "#2c3e57" },
];

/**
 * Artists the page names but cannot hang. Under the Copyright Act, 1957, an
 * artistic work stays protected for sixty years from the beginning of the
 * year after the artist's death; the page computes each one's year from the
 * death date Wikidata records, and says "living" where there is none.
 */
export const NOT_YET: string[] = [
  "Nandalal Bose", "Jamini Roy", "M. F. Husain", "S. H. Raza", "F. N. Souza", "Tyeb Mehta",
  "V. S. Gaitonde", "Akbar Padamsee", "Bhupen Khakhar", "Ram Kumar (artist)", "K. G. Subramanyan",
  "Benode Behari Mukherjee", "Ramkinkar Baij", "Arpita Singh", "Krishen Khanna",
];

export interface Work {
  /** A Wikidata id, or "file:<name>" for a work known only from Commons. */
  qid: string;
  /** Where the work was found, which decides how it was ranked. */
  source: "wikidata" | "commons";
  /** Commons only: how many Wikimedia pages use the image — its ranking. */
  usage?: number;
  title: string;
  artist: string | null;
  year: string | null;
  medium: string | null;
  collection: string | null;
  /** Wikipedia languages with an article on this work — the room's ordering. */
  sitelinks: number;
  image: {
    file: string;
    /** A ~1000 px rendition from Commons, for the walls. */
    thumb: string;
    width: number;
    height: number;
    license: string;
    credit: string | null;
    page: string;
  };
}

export interface RoomData { id: string; works: Work[]; found: number; refused: number }

export interface NotYet {
  name: string;
  qid: string | null;
  born: number | null;
  died: number | null;
  /** First calendar year the work is free in India, or null while the artist lives. */
  freeIn: number | null;
  url: string;
}

export interface Museum {
  generatedAt: string;
  rooms: RoomData[];
  notYet: NotYet[];
  errors: string[];
}

/**
 * Wikimedia's own image servers. Renditions now come from thumb.wikimedia.org
 * as well as upload.wikimedia.org; nothing else is ever hotlinked.
 */
export const WIKIMEDIA_IMAGE = /^https:\/\/(upload|thumb)\.wikimedia\.org\//;

/** Licences the walls accept, as Commons names them. */
export const FREE_LICENSE = /^(public domain|pd|cc0|cc[- ]by(-sa)?([ -]\d(\.\d)?)?)/i;

/** The year a work becomes free in India: death year + 61 (60 years from 1 January after). */
export function freeYear(died: number | null): number | null {
  return died === null ? null : died + 61;
}

/** A room as the page draws it: the register entry with what hangs in it. */
export interface GalleryRoom extends Room { works: Work[]; found: number; refused: number }

export interface MuseumView {
  present: boolean;
  generatedAt: string | null;
  rooms: GalleryRoom[];
  notYet: NotYet[];
  total: number;
  refused: number;
}
