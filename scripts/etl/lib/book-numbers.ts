/**
 * Numbers as a book writes them, digits and words both.
 *
 * Shared by the book tests (Project Maven, Breakneck): a record's prose may
 * print only numbers that its verified phrases from the book contain, and
 * books write most numbers out in words.
 */
const UNITS: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SCALES: Record<string, number> = { hundred: 100, thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12, dozen: 12 };

/**
 * Every number in a piece of text, digits and words both. "one" and "a" count
 * only in front of a scale word ("a thousand", "one billion"), because alone
 * they are far more often pronouns and articles than quantities. Ordinals
 * (18th, first) are not quantities and are skipped. A digit followed by a
 * scale word yields both readings, so "$40.8 million" matches 40.8 and
 * 40,800,000.
 */
export function numbersIn(text: string): number[] {
  const out: number[] = [];
  const words = text
    .replace(/\u00AD/g, "")
    /* A chapter reference is a citation, checked by the chapter label, not a quantity. */
    .replace(/\bchapters? \d+/gi, " ")
    .toLowerCase()
    .replace(/[\u2010-\u2015-]/g, " ")
    .replace(/[^a-z0-9.,$ ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  let i = 0;
  while (i < words.length) {
    const w = (words[i] ?? "").replace(/^\$/, "").replace(/[.,]+$/, "");
    if (/^\d[\d,]*(\.\d+)?$/.test(w) && !/^\d+(st|nd|rd|th)$/.test(w)) {
      const n = Number.parseFloat(w.replace(/,/g, ""));
      out.push(n);
      const next = (words[i + 1] ?? "").replace(/[.,]+$/, "");
      if (SCALES[next] !== undefined) out.push(n * SCALES[next]);
      i++;
      continue;
    }
    /* A run of number words. */
    let total = 0; let current = 0; let seen = false; let j = i;
    for (; j < words.length; j++) {
      const t = (words[j] ?? "").replace(/[.,]+$/, "");
      const prev = (words[j - 1] ?? "").replace(/[.,]+$/, "");
      if (UNITS[t] !== undefined) { current += UNITS[t]; seen = true; }
      else if (t === "one" && seen && TENS[prev] !== undefined) { current += 1; }
      else if (TENS[t] !== undefined) { current += TENS[t]; seen = true; }
      else if ((t === "a" || t === "one") && SCALES[(words[j + 1] ?? "").replace(/[.,]+$/, "")] !== undefined) {
        current += 1; seen = true;
      } else if (SCALES[t] !== undefined && seen) {
        const s = SCALES[t];
        if (s >= 1000) { total += (current || 1) * s; current = 0; } else { current = (current || 1) * s; }
      } else if (t === "and" && seen && TENS[(words[j + 1] ?? "")] === undefined && UNITS[(words[j + 1] ?? "")] === undefined) {
        break;
      } else if (t === "and" && seen) {
        /* "fifty and eighty" is two numbers, not one: stop here. */
        break;
      } else break;
    }
    if (seen) { out.push(total + current); i = j; } else i++;
  }
  return out;
}
