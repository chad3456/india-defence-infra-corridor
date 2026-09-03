/**
 * The atlas: things you can count on a map but rarely see counted.
 *
 * Every metric here is a feature type in OpenStreetMap, counted per state. The
 * selection is deliberate — these are the questions nobody publishes a table
 * for. Nobody releases "planetariums by state" or "lighthouses by state",
 * because no ministry owns the question. The map does.
 *
 * ── The bias this carries, stated once and loudly ────────────────────────
 *
 * OSM is drawn by volunteers, and volunteers are not evenly distributed. A
 * count here measures the thing AND the mapping of the thing, and the two are
 * not separable. Kerala and Karnataka are mapped far more densely than
 * Arunachal or Nagaland, so a raw ranking partly ranks mapper enthusiasm.
 *
 * That is why the page offers per-million-people and per-area views, and why
 * it says outright that this is a census of the map rather than of the country.
 * Presented without that, these would be a hundred confident and quietly wrong
 * league tables.
 *
 * ── Why these specific types ─────────────────────────────────────────────
 *
 * Bounded ones only. `amenity=restaurant` or `place_of_worship` run to
 * hundreds of thousands of nodes across India: too heavy to fetch politely and
 * too well known to be interesting. Everything below is expected in the
 * hundreds-to-tens-of-thousands range, which is both fetchable in one query
 * and genuinely obscure.
 */

export interface CensusSpec {
  id: string;
  /** What the map is counting, in the reader's words. */
  label: string;
  /** The group it sits in, for the picker. */
  group: string;
  /** Overpass filter, applied to nodes, ways and relations. */
  filter: string;
  /** One line on what the count does and does not include. */
  note?: string;
}

export const CENSUS_GROUPS = [
  "Knowledge", "Culture", "Belief", "Health", "Learning",
  "Energy", "Water", "Movement", "Sport", "Food & drink",
  "Public life", "Heritage", "Nature", "Work",
] as const;

export const CENSUS_SPECS: CensusSpec[] = [
  // ── Knowledge ──────────────────────────────────────────────────────
  { id: "library", label: "Libraries", group: "Knowledge", filter: '["amenity"="library"]' },
  { id: "bookshop", label: "Bookshops", group: "Knowledge", filter: '["shop"="books"]' },
  { id: "archive", label: "Archives", group: "Knowledge", filter: '["amenity"="archive"]' },
  { id: "newspaper_kiosk", label: "Newsagents", group: "Knowledge", filter: '["shop"="newsagent"]' },
  { id: "internet_cafe", label: "Internet cafés", group: "Knowledge", filter: '["amenity"="internet_cafe"]' },
  { id: "research", label: "Research institutes", group: "Knowledge", filter: '["amenity"="research_institute"]' },
  { id: "observatory", label: "Observatories", group: "Knowledge", filter: '["man_made"="observatory"]' },
  { id: "planetarium", label: "Planetariums", group: "Knowledge", filter: '["amenity"="planetarium"]' },

  // ── Culture ────────────────────────────────────────────────────────
  { id: "cinema", label: "Cinemas", group: "Culture", filter: '["amenity"="cinema"]' },
  { id: "theatre", label: "Theatres", group: "Culture", filter: '["amenity"="theatre"]' },
  { id: "museum", label: "Museums", group: "Culture", filter: '["tourism"="museum"]' },
  { id: "gallery", label: "Art galleries", group: "Culture", filter: '["tourism"="gallery"]' },
  { id: "arts_centre", label: "Arts centres", group: "Culture", filter: '["amenity"="arts_centre"]' },
  { id: "community_centre", label: "Community centres", group: "Culture", filter: '["amenity"="community_centre"]' },
  { id: "music_shop", label: "Musical-instrument shops", group: "Culture", filter: '["shop"="musical_instrument"]' },
  { id: "artwork", label: "Public artworks", group: "Culture", filter: '["tourism"="artwork"]' },
  { id: "photo_studio", label: "Photo studios", group: "Culture", filter: '["shop"="photo"]' },

  // ── Belief ─────────────────────────────────────────────────────────
  { id: "temple_hindu", label: "Hindu temples", group: "Belief", filter: '["amenity"="place_of_worship"]["religion"="hindu"]' },
  { id: "mosque", label: "Mosques", group: "Belief", filter: '["amenity"="place_of_worship"]["religion"="muslim"]' },
  { id: "church", label: "Churches", group: "Belief", filter: '["amenity"="place_of_worship"]["religion"="christian"]' },
  { id: "gurdwara", label: "Gurdwaras", group: "Belief", filter: '["amenity"="place_of_worship"]["religion"="sikh"]' },
  { id: "jain", label: "Jain temples", group: "Belief", filter: '["amenity"="place_of_worship"]["religion"="jain"]' },
  { id: "buddhist", label: "Buddhist temples", group: "Belief", filter: '["amenity"="place_of_worship"]["religion"="buddhist"]' },
  { id: "monastery", label: "Monasteries", group: "Belief", filter: '["amenity"="monastery"]' },

  // ── Health ─────────────────────────────────────────────────────────
  { id: "hospital", label: "Hospitals", group: "Health", filter: '["amenity"="hospital"]' },
  { id: "clinic", label: "Clinics", group: "Health", filter: '["amenity"="clinic"]' },
  { id: "pharmacy", label: "Pharmacies", group: "Health", filter: '["amenity"="pharmacy"]' },
  { id: "dentist", label: "Dentists", group: "Health", filter: '["amenity"="dentist"]' },
  { id: "veterinary", label: "Veterinary clinics", group: "Health", filter: '["amenity"="veterinary"]' },
  { id: "blood_bank", label: "Blood banks", group: "Health", filter: '["healthcare"="blood_donation"]' },
  { id: "optician", label: "Opticians", group: "Health", filter: '["shop"="optician"]' },
  { id: "ayurveda", label: "Ayurveda practices", group: "Health", filter: '["healthcare:speciality"~"ayurveda",i]' },

  // ── Learning ───────────────────────────────────────────────────────
  { id: "university", label: "Universities", group: "Learning", filter: '["amenity"="university"]' },
  { id: "college", label: "Colleges", group: "Learning", filter: '["amenity"="college"]' },
  { id: "driving_school", label: "Driving schools", group: "Learning", filter: '["amenity"="driving_school"]' },
  { id: "music_school", label: "Music schools", group: "Learning", filter: '["amenity"="music_school"]' },
  { id: "language_school", label: "Language schools", group: "Learning", filter: '["amenity"="language_school"]' },
  { id: "kindergarten", label: "Kindergartens", group: "Learning", filter: '["amenity"="kindergarten"]' },

  // ── Energy ─────────────────────────────────────────────────────────
  { id: "ev_charging", label: "EV charging points", group: "Energy", filter: '["amenity"="charging_station"]' },
  { id: "wind_turbine", label: "Wind turbines", group: "Energy", filter: '["generator:source"="wind"]' },
  { id: "solar_plant", label: "Solar generators", group: "Energy", filter: '["generator:source"="solar"]' },
  { id: "substation", label: "Electrical substations", group: "Energy", filter: '["power"="substation"]' },
  { id: "fuel", label: "Fuel stations", group: "Energy", filter: '["amenity"="fuel"]' },
  { id: "gas_station_lpg", label: "LPG outlets", group: "Energy", filter: '["amenity"="fuel"]["fuel:lpg"="yes"]' },
  { id: "power_plant", label: "Power plants", group: "Energy", filter: '["power"="plant"]' },

  // ── Water ──────────────────────────────────────────────────────────
  { id: "dam", label: "Dams", group: "Water", filter: '["waterway"="dam"]' },
  { id: "water_tower", label: "Water towers", group: "Water", filter: '["man_made"="water_tower"]' },
  { id: "drinking_water", label: "Drinking-water points", group: "Water", filter: '["amenity"="drinking_water"]' },
  { id: "water_well", label: "Water wells", group: "Water", filter: '["man_made"="water_well"]' },
  { id: "stepwell", label: "Stepwells", group: "Water", filter: '["historic"="stepwell"]' },
  { id: "lighthouse", label: "Lighthouses", group: "Water", filter: '["man_made"="lighthouse"]' },
  { id: "ferry_terminal", label: "Ferry terminals", group: "Water", filter: '["amenity"="ferry_terminal"]' },

  // ── Movement ───────────────────────────────────────────────────────
  { id: "bus_station", label: "Bus stations", group: "Movement", filter: '["amenity"="bus_station"]' },
  { id: "taxi_stand", label: "Taxi stands", group: "Movement", filter: '["amenity"="taxi"]' },
  { id: "helipad", label: "Helipads", group: "Movement", filter: '["aeroway"="helipad"]' },
  { id: "aerodrome", label: "Aerodromes", group: "Movement", filter: '["aeroway"="aerodrome"]' },
  { id: "toll_booth", label: "Toll booths", group: "Movement", filter: '["barrier"="toll_booth"]' },
  { id: "level_crossing", label: "Level crossings", group: "Movement", filter: '["railway"="level_crossing"]' },
  { id: "bicycle_parking", label: "Cycle parking", group: "Movement", filter: '["amenity"="bicycle_parking"]' },
  { id: "car_wash", label: "Car washes", group: "Movement", filter: '["amenity"="car_wash"]' },
  { id: "weighbridge", label: "Weighbridges", group: "Movement", filter: '["man_made"="weighbridge"]' },

  // ── Sport ──────────────────────────────────────────────────────────
  { id: "cricket", label: "Cricket grounds", group: "Sport", filter: '["sport"="cricket"]' },
  { id: "stadium", label: "Stadiums", group: "Sport", filter: '["leisure"="stadium"]' },
  { id: "swimming", label: "Swimming pools", group: "Sport", filter: '["leisure"="swimming_pool"]' },
  { id: "gym", label: "Gyms", group: "Sport", filter: '["leisure"="fitness_centre"]' },
  { id: "golf", label: "Golf courses", group: "Sport", filter: '["leisure"="golf_course"]' },
  { id: "sports_centre", label: "Sports centres", group: "Sport", filter: '["leisure"="sports_centre"]' },
  { id: "yoga", label: "Yoga centres", group: "Sport", filter: '["sport"="yoga"]' },
  { id: "shooting", label: "Shooting ranges", group: "Sport", filter: '["sport"="shooting"]' },

  // ── Food & drink ───────────────────────────────────────────────────
  { id: "cafe", label: "Cafés", group: "Food & drink", filter: '["amenity"="cafe"]' },
  { id: "icecream", label: "Ice-cream parlours", group: "Food & drink", filter: '["amenity"="ice_cream"]' },
  { id: "bakery", label: "Bakeries", group: "Food & drink", filter: '["shop"="bakery"]' },
  { id: "butcher", label: "Butchers", group: "Food & drink", filter: '["shop"="butcher"]' },
  { id: "greengrocer", label: "Greengrocers", group: "Food & drink", filter: '["shop"="greengrocer"]' },
  { id: "dairy", label: "Dairies", group: "Food & drink", filter: '["shop"="dairy"]' },
  { id: "spices", label: "Spice shops", group: "Food & drink", filter: '["shop"="spices"]' },
  { id: "tea", label: "Tea shops", group: "Food & drink", filter: '["shop"="tea"]' },
  { id: "brewery", label: "Breweries", group: "Food & drink", filter: '["craft"="brewery"]' },
  { id: "marketplace", label: "Marketplaces", group: "Food & drink", filter: '["amenity"="marketplace"]' },

  // ── Public life ────────────────────────────────────────────────────
  { id: "police", label: "Police stations", group: "Public life", filter: '["amenity"="police"]' },
  { id: "fire_station", label: "Fire stations", group: "Public life", filter: '["amenity"="fire_station"]' },
  { id: "post_office", label: "Post offices", group: "Public life", filter: '["amenity"="post_office"]' },
  { id: "bank", label: "Banks", group: "Public life", filter: '["amenity"="bank"]' },
  { id: "atm", label: "ATMs", group: "Public life", filter: '["amenity"="atm"]' },
  { id: "courthouse", label: "Courthouses", group: "Public life", filter: '["amenity"="courthouse"]' },
  { id: "prison", label: "Prisons", group: "Public life", filter: '["amenity"="prison"]' },
  { id: "townhall", label: "Town halls", group: "Public life", filter: '["amenity"="townhall"]' },
  { id: "toilets", label: "Public toilets", group: "Public life", filter: '["amenity"="toilets"]' },
  { id: "crematorium", label: "Crematoria", group: "Public life", filter: '["amenity"="crematorium"]' },
  { id: "fountain", label: "Fountains", group: "Public life", filter: '["amenity"="fountain"]' },
  { id: "clock", label: "Public clocks", group: "Public life", filter: '["amenity"="clock"]' },

  // ── Heritage ───────────────────────────────────────────────────────
  { id: "fort", label: "Forts", group: "Heritage", filter: '["historic"="fort"]' },
  { id: "castle", label: "Palaces & castles", group: "Heritage", filter: '["historic"="castle"]' },
  { id: "ruins", label: "Ruins", group: "Heritage", filter: '["historic"="ruins"]' },
  { id: "archaeological", label: "Archaeological sites", group: "Heritage", filter: '["historic"="archaeological_site"]' },
  { id: "memorial", label: "Memorials", group: "Heritage", filter: '["historic"="memorial"]' },
  { id: "monument", label: "Monuments", group: "Heritage", filter: '["historic"="monument"]' },
  { id: "tomb", label: "Tombs", group: "Heritage", filter: '["historic"="tomb"]' },
  { id: "milestone", label: "Milestones", group: "Heritage", filter: '["historic"="milestone"]' },

  // ── Nature ─────────────────────────────────────────────────────────
  { id: "peak", label: "Named peaks", group: "Nature", filter: '["natural"="peak"]' },
  { id: "waterfall", label: "Waterfalls", group: "Nature", filter: '["waterway"="waterfall"]' },
  { id: "cave", label: "Cave entrances", group: "Nature", filter: '["natural"="cave_entrance"]' },
  { id: "hot_spring", label: "Hot springs", group: "Nature", filter: '["natural"="hot_spring"]' },
  { id: "spring", label: "Springs", group: "Nature", filter: '["natural"="spring"]' },
  { id: "beach", label: "Beaches", group: "Nature", filter: '["natural"="beach"]' },
  { id: "glacier", label: "Glaciers", group: "Nature", filter: '["natural"="glacier"]' },
  { id: "zoo", label: "Zoos", group: "Nature", filter: '["tourism"="zoo"]' },
  { id: "botanical", label: "Botanical gardens", group: "Nature", filter: '["leisure"="garden"]["garden:type"="botanical"]' },
  { id: "tree_notable", label: "Notable trees", group: "Nature", filter: '["natural"="tree"]["name"]' },

  // ── Work ───────────────────────────────────────────────────────────
  { id: "quarry", label: "Quarries", group: "Work", filter: '["landuse"="quarry"]' },
  { id: "mine", label: "Mineshafts", group: "Work", filter: '["man_made"="mineshaft"]' },
  { id: "works", label: "Factories", group: "Work", filter: '["landuse"="industrial"]["name"]' },
  { id: "sawmill", label: "Sawmills", group: "Work", filter: '["craft"="sawmill"]' },
  { id: "tailor", label: "Tailors", group: "Work", filter: '["craft"="tailor"]' },
  { id: "goldsmith", label: "Goldsmiths", group: "Work", filter: '["craft"="goldsmith"]' },
  { id: "potter", label: "Potters", group: "Work", filter: '["craft"="potter"]' },
  { id: "blacksmith", label: "Blacksmiths", group: "Work", filter: '["craft"="blacksmith"]' },
  { id: "carpenter", label: "Carpenters", group: "Work", filter: '["craft"="carpenter"]' },
  { id: "silo", label: "Silos", group: "Work", filter: '["man_made"="silo"]' },
  { id: "chimney", label: "Industrial chimneys", group: "Work", filter: '["man_made"="chimney"]' },
  { id: "warehouse", label: "Warehouses", group: "Work", filter: '["building"="warehouse"]["name"]' },
];
