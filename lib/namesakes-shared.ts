/**
 * Types and the figure register for /namesakes, safe for the client.
 *
 * The register is the one place a figure is defined: the connector searches
 * with these words, the sentence rules test with them, the page draws with
 * them. The Wikidata id is not written here — it is resolved at ingest from
 * the English Wikipedia title, so a merged or moved item cannot leave a stale
 * id behind in the code.
 */

export type Tier = "stated" | "quoted" | "named";

export interface Figure {
  id: string;
  /** How the page names the figure. */
  name: string;
  kind: "god" | "leader";
  /** English Wikipedia article, from which the Wikidata item is resolved. */
  enwiki: string;
  /** Words that name the figure in a sentence. */
  words: string[];
  /** The subset searched for on Wikipedia — the rest only match sentences. */
  search: string[];
  /** Leaders: words that mean a different person is being named. */
  notWith?: string[];
  /** Leaders: phrases that, in an item's own name, name this person. */
  label?: RegExp;
  /** Addressed as Lord or Goddess in search phrases. */
  title?: "Lord" | "Goddess";
}

export const FIGURES: Figure[] = [
  { id: "rama", name: "Ram", kind: "god", enwiki: "Rama", title: "Lord",
    words: ["Rama", "Ram", "Sri Rama", "Shri Ram", "Ramachandra", "Raghunatha", "Raghunath"],
    search: ["Rama", "Ram", "Sri Rama", "Shri Ram"] },
  { id: "sita", name: "Sita", kind: "god", enwiki: "Sita", title: "Goddess",
    words: ["Sita", "Seeta", "Janaki", "Vaidehi", "Sita Mata", "Mata Sita"],
    search: ["Sita", "Janaki"] },
  { id: "lakshmana", name: "Lakshman", kind: "god", enwiki: "Lakshmana", title: "Lord",
    words: ["Lakshmana", "Lakshman", "Laxman"],
    search: ["Lakshmana", "Lakshman"] },
  { id: "hanuman", name: "Hanuman", kind: "god", enwiki: "Hanuman", title: "Lord",
    words: ["Hanuman", "Hanumana", "Hanumanji", "Anjaneya", "Anjaneyar", "Maruti", "Maruthi", "Bajrangbali", "Bajrang Bali"],
    search: ["Hanuman", "Anjaneya", "Maruti", "Bajrangbali"] },
  { id: "krishna", name: "Krishna", kind: "god", enwiki: "Krishna", title: "Lord",
    words: ["Krishna", "Sri Krishna", "Shri Krishna", "Gopala", "Govinda", "Kanha", "Kanhaiya", "Keshava", "Mukunda", "Murari"],
    search: ["Krishna", "Sri Krishna", "Gopala", "Govinda"] },
  { id: "radha", name: "Radha", kind: "god", enwiki: "Radha", title: "Goddess",
    words: ["Radha", "Radhika", "Radharani"], search: ["Radha"] },
  { id: "balarama", name: "Balaram", kind: "god", enwiki: "Balarama", title: "Lord",
    words: ["Balarama", "Balram", "Baladeva"], search: ["Balarama", "Balram"] },
  { id: "vishnu", name: "Vishnu", kind: "god", enwiki: "Vishnu", title: "Lord",
    words: ["Vishnu", "Narayana", "Venkateswara", "Jagannath", "Jagannatha"],
    search: ["Vishnu", "Narayana", "Venkateswara", "Jagannath"] },
  { id: "shiva", name: "Shiva", kind: "god", enwiki: "Shiva", title: "Lord",
    words: ["Shiva", "Siva", "Shiv", "Mahadev", "Mahadeva", "Shankar", "Shankara", "Nataraja", "Bholenath"],
    search: ["Shiva", "Siva", "Shiv", "Mahadev"] },
  { id: "parvati", name: "Parvati", kind: "god", enwiki: "Parvati", title: "Goddess",
    words: ["Parvati", "Parvathi", "Uma", "Gauri"], search: ["Parvati", "Parvathi"] },
  { id: "ganesha", name: "Ganesh", kind: "god", enwiki: "Ganesha", title: "Lord",
    words: ["Ganesha", "Ganesh", "Ganapati", "Ganapathi", "Ganpati", "Vinayaka", "Vinayak"],
    search: ["Ganesha", "Ganesh", "Ganapati", "Vinayaka"] },
  { id: "kartikeya", name: "Murugan", kind: "god", enwiki: "Kartikeya", title: "Lord",
    words: ["Kartikeya", "Murugan", "Muruga", "Subramanya", "Subrahmanya", "Skanda"],
    search: ["Murugan", "Kartikeya", "Subramanya"] },
  { id: "durga", name: "Durga", kind: "god", enwiki: "Durga", title: "Goddess",
    words: ["Durga", "Durga Mata", "Ambe", "Amba"], search: ["Durga"] },
  { id: "kali", name: "Kali", kind: "god", enwiki: "Kali", title: "Goddess",
    words: ["Kali", "Kalika", "Kalikamata", "Mahakali"], search: ["Kali", "Kalika"] },
  { id: "lakshmi", name: "Lakshmi", kind: "god", enwiki: "Lakshmi", title: "Goddess",
    words: ["Lakshmi", "Laxmi", "Mahalakshmi"], search: ["Lakshmi", "Mahalakshmi"] },
  { id: "saraswati", name: "Saraswati", kind: "god", enwiki: "Saraswati", title: "Goddess",
    words: ["Saraswati", "Sarasvati", "Saraswathi"], search: ["Saraswati"] },
  { id: "mahatma", name: "Mahatma Gandhi", kind: "leader", enwiki: "Mahatma Gandhi",
    words: ["Mahatma Gandhi", "Mohandas Karamchand Gandhi", "Mohandas Gandhi", "M. K. Gandhi", "M.K. Gandhi", "Gandhiji", "Bapu"],
    search: ["Mahatma Gandhi", "Gandhiji"],
    notWith: ["Indira", "Rajiv", "Sonia", "Rahul", "Sanjay", "Feroze", "Varun", "Maneka"],
    label: /\b(mahatma gandhi|gandhiji)\b/i },
  { id: "indira", name: "Indira Gandhi", kind: "leader", enwiki: "Indira Gandhi",
    words: ["Indira Gandhi", "Smt. Indira Gandhi", "Indiraji"], search: ["Indira Gandhi"],
    label: /\bindira gandhi\b/i },
  { id: "rajiv", name: "Rajiv Gandhi", kind: "leader", enwiki: "Rajiv Gandhi",
    words: ["Rajiv Gandhi", "Rajivji"], search: ["Rajiv Gandhi"],
    label: /\brajiv gandhi\b/i },
];

/** What kind of thing a place is, read from its Wikidata class labels. */
export type Category =
  | "settlement" | "admin" | "neighbourhood" | "nature"
  | "road" | "transport" | "education" | "health" | "sport" | "park"
  | "memorial" | "building" | "religious" | "scheme" | "other";

export interface Evidence {
  figure: string;
  tier: Tier;
  /** The sentence, verbatim, for the quoted tier. */
  quote?: string;
  /** Where to check it: the Wikidata item or the Wikipedia article. */
  url: string;
}

export interface Place {
  qid: string;
  name: string;
  description: string | null;
  lat: number | null;
  lon: number | null;
  state: string | null;
  /** The item's own "located in" label, one level up. */
  locatedIn: string | null;
  category: Category;
  classes: string[];
  enwiki: string | null;
  evidence: Evidence[];
  /** A god matched without devotional context — held for review, never pinned. */
  review?: boolean;
  /** The sentences that were held, so the review reads them rather than guessing. */
  held?: Evidence[];
}

export interface Lookalike {
  title: string;
  qid: string | null;
  name: string;
  lat: number | null;
  lon: number | null;
  state: string | null;
  /** The first sentence in the article that states a namesake, if any. */
  quote: string | null;
  url: string;
}

export interface RoadSet {
  figure: "mahatma" | "indira" | "rajiv" | "gandhi";
  ways: number;
  roads: number;
  byState: Record<string, number>;
  /** [lat, lon] per clustered road. */
  points: Array<[number, number]>;
}

export interface NameCount {
  stem: string;
  places: number;
  top: Array<[string, number]>;
}

export interface Namesakes {
  generatedAt: string;
  figures: Array<{ id: string; name: string; kind: "god" | "leader"; qid: string | null; enwiki: string }>;
  places: Place[];
  lookalikes: Lookalike[];
  roads: RoadSet[] | null;
  nameCounts: NameCount[] | null;
  funnel: Record<string, number>;
  errors: string[];
}

/**
 * Things that carry a name without being a place or an institution: coins,
 * medals and stamps that depict a Gandhi, paintings, contests, and the events
 * of their deaths. Read from the item's name, description and classes.
 * Foundations and trusts are institutions and stay.
 */
const NOT_A_PLACE = /\b(coins?|banknotes?|bank ?notes?|medals?|medallions?|tokens?|bullion|stamps?|paintings?|photographs?|portraits?|edit-a-thon|contest|films?|books?|songs?|assassination|murder|scam|case|festival|boat race|race|series of banknotes|award|prize|fellowship|scholarship|scheme|yojana|pariyojana|programme|program|mission|policy|manifesto|election|numista|num\d+|holiday|online exhibition|branch of)\b/i;

export function notAPlace(name: string, description: string | null, classes: string[]): boolean {
  return NOT_A_PLACE.test(`${name} ${description ?? ""} ${classes.join(" ")}`) || /\[Num\d+\]/.test(name);
}

export const TIER_LABEL: Record<Tier, string> = {
  stated: "Wikidata says so",
  quoted: "Wikipedia says so",
  named: "Carries the full name",
};

export const CATEGORY_LABEL: Record<Category, string> = {
  settlement: "City, town or village",
  admin: "District or other division",
  neighbourhood: "Neighbourhood or colony",
  nature: "River, hill or lake",
  road: "Road or square",
  transport: "Airport, station or bridge",
  education: "University, college or school",
  health: "Hospital or medical college",
  sport: "Stadium or sports ground",
  park: "Park, garden or sanctuary",
  memorial: "Memorial, museum or statue",
  building: "Building, hall or office",
  religious: "Temple or shrine",
  scheme: "Scheme or programme",
  other: "Something else",
};
