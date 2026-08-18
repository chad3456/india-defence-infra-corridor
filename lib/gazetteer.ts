/**
 * Place lookup for geo-locating development events.
 *
 * Coordinates are city/state centroids, not precise project sites — an event
 * pin says "this happened in Kanpur", not "this is the factory gate". The map
 * legend states that so a reader does not over-read the placement.
 *
 * `aliases` carry the spellings that actually appear in Indian news copy
 * (Bengaluru/Bangalore, Prayagraj/Allahabad), because matching only the
 * official name would miss most mentions.
 */

export interface Place {
  id: string;
  name: string;
  state: string;
  /** [longitude, latitude] */
  coords: [number, number];
  aliases?: string[];
}

export const STATES: Record<string, [number, number]> = {
  "Andhra Pradesh": [79.74, 15.91],
  "Arunachal Pradesh": [94.73, 28.22],
  Assam: [92.94, 26.2],
  Bihar: [85.31, 25.1],
  Chhattisgarh: [81.87, 21.28],
  Goa: [74.12, 15.3],
  Gujarat: [71.19, 22.26],
  Haryana: [76.09, 29.06],
  "Himachal Pradesh": [77.17, 31.1],
  Jharkhand: [85.28, 23.61],
  Karnataka: [75.71, 15.32],
  Kerala: [76.27, 10.85],
  "Madhya Pradesh": [78.66, 22.97],
  Maharashtra: [75.71, 19.75],
  Manipur: [93.91, 24.66],
  Meghalaya: [91.37, 25.47],
  Mizoram: [92.94, 23.16],
  Nagaland: [94.56, 26.16],
  Odisha: [85.1, 20.95],
  Punjab: [75.34, 31.15],
  Rajasthan: [74.22, 27.02],
  Sikkim: [88.51, 27.53],
  "Tamil Nadu": [78.66, 11.13],
  Telangana: [79.02, 17.12],
  Tripura: [91.99, 23.94],
  "Uttar Pradesh": [80.95, 26.85],
  Uttarakhand: [79.02, 30.07],
  "West Bengal": [87.86, 22.99],
  Delhi: [77.21, 28.61],
  "Jammu and Kashmir": [74.8, 33.78],
  Ladakh: [77.58, 34.15],
  Puducherry: [79.81, 11.94],
  Chandigarh: [76.78, 30.73],
  "Andaman and Nicobar Islands": [92.75, 11.74],
};

export const PLACES: Place[] = [
  { id: "delhi", name: "New Delhi", state: "Delhi", coords: [77.21, 28.61], aliases: ["Delhi", "NCR"] },
  { id: "mumbai", name: "Mumbai", state: "Maharashtra", coords: [72.88, 19.08], aliases: ["Bombay"] },
  { id: "pune", name: "Pune", state: "Maharashtra", coords: [73.86, 18.52] },
  { id: "nagpur", name: "Nagpur", state: "Maharashtra", coords: [79.09, 21.15] },
  { id: "nashik", name: "Nashik", state: "Maharashtra", coords: [73.79, 19.997] },
  { id: "aurangabad", name: "Chhatrapati Sambhajinagar", state: "Maharashtra", coords: [75.34, 19.88], aliases: ["Aurangabad"] },
  { id: "bengaluru", name: "Bengaluru", state: "Karnataka", coords: [77.59, 12.97], aliases: ["Bangalore"] },
  { id: "mysuru", name: "Mysuru", state: "Karnataka", coords: [76.64, 12.3], aliases: ["Mysore"] },
  { id: "mangaluru", name: "Mangaluru", state: "Karnataka", coords: [74.86, 12.91], aliases: ["Mangalore"] },
  { id: "chennai", name: "Chennai", state: "Tamil Nadu", coords: [80.27, 13.08], aliases: ["Madras"] },
  { id: "coimbatore", name: "Coimbatore", state: "Tamil Nadu", coords: [76.96, 11.02] },
  { id: "hosur", name: "Hosur", state: "Tamil Nadu", coords: [77.83, 12.74] },
  { id: "salem", name: "Salem", state: "Tamil Nadu", coords: [78.15, 11.66] },
  { id: "trichy", name: "Tiruchirappalli", state: "Tamil Nadu", coords: [78.7, 10.79], aliases: ["Trichy"] },
  { id: "thoothukudi", name: "Thoothukudi", state: "Tamil Nadu", coords: [78.13, 8.76], aliases: ["Tuticorin"] },
  { id: "hyderabad", name: "Hyderabad", state: "Telangana", coords: [78.49, 17.39] },
  { id: "visakhapatnam", name: "Visakhapatnam", state: "Andhra Pradesh", coords: [83.22, 17.69], aliases: ["Vizag"] },
  { id: "amaravati", name: "Amaravati", state: "Andhra Pradesh", coords: [80.52, 16.51] },
  { id: "sriharikota", name: "Sriharikota", state: "Andhra Pradesh", coords: [80.23, 13.72], aliases: ["Satish Dhawan Space Centre", "SDSC"] },
  { id: "tirupati", name: "Tirupati", state: "Andhra Pradesh", coords: [79.42, 13.63] },
  { id: "kolkata", name: "Kolkata", state: "West Bengal", coords: [88.36, 22.57], aliases: ["Calcutta"] },
  { id: "haldia", name: "Haldia", state: "West Bengal", coords: [88.06, 22.06] },
  { id: "ahmedabad", name: "Ahmedabad", state: "Gujarat", coords: [72.57, 23.02] },
  { id: "surat", name: "Surat", state: "Gujarat", coords: [72.83, 21.17] },
  { id: "vadodara", name: "Vadodara", state: "Gujarat", coords: [73.18, 22.31], aliases: ["Baroda"] },
  { id: "gandhinagar", name: "Gandhinagar", state: "Gujarat", coords: [72.63, 23.22], aliases: ["GIFT City"] },
  { id: "mundra", name: "Mundra", state: "Gujarat", coords: [69.72, 22.84] },
  { id: "dholera", name: "Dholera", state: "Gujarat", coords: [72.19, 22.25] },
  { id: "sanand", name: "Sanand", state: "Gujarat", coords: [72.38, 22.99] },
  { id: "jaipur", name: "Jaipur", state: "Rajasthan", coords: [75.79, 26.91] },
  { id: "jodhpur", name: "Jodhpur", state: "Rajasthan", coords: [73.02, 26.24] },
  { id: "lucknow", name: "Lucknow", state: "Uttar Pradesh", coords: [80.95, 26.85] },
  { id: "kanpur", name: "Kanpur", state: "Uttar Pradesh", coords: [80.35, 26.45] },
  { id: "noida", name: "Noida", state: "Uttar Pradesh", coords: [77.39, 28.54], aliases: ["Greater Noida"] },
  { id: "agra", name: "Agra", state: "Uttar Pradesh", coords: [78.01, 27.18] },
  { id: "aligarh", name: "Aligarh", state: "Uttar Pradesh", coords: [78.09, 27.9] },
  { id: "jhansi", name: "Jhansi", state: "Uttar Pradesh", coords: [78.58, 25.45] },
  { id: "chitrakoot", name: "Chitrakoot", state: "Uttar Pradesh", coords: [80.87, 25.2] },
  { id: "varanasi", name: "Varanasi", state: "Uttar Pradesh", coords: [82.99, 25.32], aliases: ["Benares", "Kashi"] },
  { id: "prayagraj", name: "Prayagraj", state: "Uttar Pradesh", coords: [81.85, 25.44], aliases: ["Allahabad"] },
  { id: "meerut", name: "Meerut", state: "Uttar Pradesh", coords: [77.7, 28.98] },
  { id: "ayodhya", name: "Ayodhya", state: "Uttar Pradesh", coords: [82.19, 26.79] },
  { id: "jewar", name: "Jewar", state: "Uttar Pradesh", coords: [77.56, 28.12], aliases: ["Noida International Airport"] },
  { id: "bhopal", name: "Bhopal", state: "Madhya Pradesh", coords: [77.41, 23.26] },
  { id: "indore", name: "Indore", state: "Madhya Pradesh", coords: [75.86, 22.72] },
  { id: "patna", name: "Patna", state: "Bihar", coords: [85.14, 25.61] },
  { id: "ranchi", name: "Ranchi", state: "Jharkhand", coords: [85.31, 23.34] },
  { id: "bhubaneswar", name: "Bhubaneswar", state: "Odisha", coords: [85.82, 20.3] },
  { id: "paradip", name: "Paradip", state: "Odisha", coords: [86.61, 20.32] },
  { id: "raipur", name: "Raipur", state: "Chhattisgarh", coords: [81.63, 21.25] },
  { id: "kochi", name: "Kochi", state: "Kerala", coords: [76.27, 9.93], aliases: ["Cochin"] },
  { id: "thiruvananthapuram", name: "Thiruvananthapuram", state: "Kerala", coords: [76.94, 8.52], aliases: ["Trivandrum"] },
  { id: "vizhinjam", name: "Vizhinjam", state: "Kerala", coords: [76.98, 8.38] },
  { id: "chandigarh", name: "Chandigarh", state: "Chandigarh", coords: [76.78, 30.73] },
  { id: "amritsar", name: "Amritsar", state: "Punjab", coords: [74.87, 31.63] },
  { id: "ludhiana", name: "Ludhiana", state: "Punjab", coords: [75.86, 30.9] },
  { id: "gurugram", name: "Gurugram", state: "Haryana", coords: [77.03, 28.46], aliases: ["Gurgaon"] },
  { id: "faridabad", name: "Faridabad", state: "Haryana", coords: [77.31, 28.41] },
  { id: "dehradun", name: "Dehradun", state: "Uttarakhand", coords: [78.03, 30.32] },
  { id: "guwahati", name: "Guwahati", state: "Assam", coords: [91.75, 26.14] },
  { id: "itanagar", name: "Itanagar", state: "Arunachal Pradesh", coords: [93.61, 27.08] },
  { id: "imphal", name: "Imphal", state: "Manipur", coords: [93.94, 24.82] },
  { id: "shillong", name: "Shillong", state: "Meghalaya", coords: [91.88, 25.58] },
  { id: "agartala", name: "Agartala", state: "Tripura", coords: [91.28, 23.83] },
  { id: "aizawl", name: "Aizawl", state: "Mizoram", coords: [92.72, 23.73] },
  { id: "kohima", name: "Kohima", state: "Nagaland", coords: [94.11, 25.67] },
  { id: "gangtok", name: "Gangtok", state: "Sikkim", coords: [88.61, 27.33] },
  { id: "srinagar", name: "Srinagar", state: "Jammu and Kashmir", coords: [74.8, 34.08] },
  { id: "jammu", name: "Jammu", state: "Jammu and Kashmir", coords: [74.86, 32.73] },
  { id: "leh", name: "Leh", state: "Ladakh", coords: [77.58, 34.15] },
  { id: "portblair", name: "Port Blair", state: "Andaman and Nicobar Islands", coords: [92.75, 11.62], aliases: ["Sri Vijaya Puram"] },
  { id: "bhogapuram", name: "Bhogapuram", state: "Andhra Pradesh", coords: [83.42, 18.13], aliases: ["Alluri Sitarama Raju International Airport"] },
  { id: "chandipur", name: "Chandipur", state: "Odisha", coords: [86.98, 21.47], aliases: ["Integrated Test Range", "Balasore"] },
  { id: "balotra", name: "Balotra", state: "Rajasthan", coords: [72.24, 25.83], aliases: ["Pachpadra", "Barmer"] },
  { id: "vadhavan", name: "Vadhavan", state: "Maharashtra", coords: [72.75, 19.75], aliases: ["Palghar", "Dahanu"] },
  { id: "kandla", name: "Kandla", state: "Gujarat", coords: [70.22, 23.03], aliases: ["Deendayal Port", "Tuna Tekra"] },
  { id: "vizianagaram", name: "Vizianagaram", state: "Andhra Pradesh", coords: [83.42, 18.11] },
  { id: "goa", name: "Panaji", state: "Goa", coords: [73.83, 15.49], aliases: ["Goa", "Vasco"] },
];

const BY_KEY = new Map<string, Place>();
for (const p of PLACES) {
  BY_KEY.set(p.name.toLowerCase(), p);
  for (const a of p.aliases ?? []) BY_KEY.set(a.toLowerCase(), p);
}

export function findPlace(id: string): Place | undefined {
  return PLACES.find((p) => p.id === id);
}

/**
 * Best-effort geo-tag for a headline.
 *
 * Longest names are tried first so "New Delhi" wins over "Delhi" and
 * "Greater Noida" over "Noida". Returns null rather than guessing when no place
 * is mentioned — an unplaceable event is listed but never pinned, because a pin
 * in the wrong state is worse than no pin.
 */
export function detectPlace(text: string): Place | null {
  const haystack = ` ${text.toLowerCase()} `;
  const keys = [...BY_KEY.keys()].sort((a, b) => b.length - a.length);
  for (const k of keys) {
    // Word-boundary match so "Goa" does not fire inside "Goalpara".
    if (new RegExp(`[^a-z]${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^a-z]`).test(haystack)) {
      return BY_KEY.get(k) ?? null;
    }
  }
  for (const [state, coords] of Object.entries(STATES)) {
    if (new RegExp(`[^a-z]${state.toLowerCase()}[^a-z]`).test(haystack)) {
      return { id: state.toLowerCase().replace(/\s+/g, "-"), name: state, state, coords };
    }
  }
  return null;
}
