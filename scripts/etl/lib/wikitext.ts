/**
 * A small wikitext table reader.
 *
 * Wikipedia is requested as raw wikitext rather than rendered HTML on purpose:
 * a table row there is a line with a known delimiter, where the rendered page is
 * a DOM whose class names change without notice. This parses the subset that
 * actually appears in route tables and refuses anything it does not understand
 * rather than guessing.
 *
 * What it deliberately does NOT do is resolve templates. A cell containing
 * {{sort|...}} or a flag icon is unwrapped to its visible text where the shape
 * is unambiguous, and otherwise left as-is for the caller to reject -- silently
 * inventing a value from a template is how a wrong number gets onto a chart.
 */

export interface WikiTable {
  /**
   * The header row that lines up with the body, as plain text.
   *
   * A wikitable may have several header rows: a spanning title above the real
   * headers, a second tier under them, or both. They must not be flattened
   * together — doing so was worth an off-by-one on every page whose table had
   * a caption row, which put "Production company" under the heading "Title"
   * and read the studio as the film. So the row chosen here is the one whose
   * width matches the body, and the others are kept separately.
   */
  headers: string[];
  /** Every header row, in order, before the body starts. */
  headerRows: string[][];
  /** Body rows, each already aligned to `headers` by position. */
  rows: string[][];
  /** Anything on the table line itself, e.g. a class or caption. */
  caption: string | null;
}

/** Strip the markup that carries no data. */
export function plain(cell: string): string {
  let s = cell;
  s = s.replace(/<ref[^>]*\/>/gi, "");
  s = s.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "");
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<br\s*\/?>/gi, " ");
  s = s.replace(/<[^>]+>/g, "");
  // {{sort|key|Display}} and {{nowrap|X}} -> the last argument, which is what
  // renders. A template with one argument unwraps to that argument.
  s = s.replace(/\{\{\s*(?:sort|nowrap|nobr)\s*\|([^{}]*)\}\}/gi, (_m, inner: string) => {
    const parts = String(inner).split("|");
    return parts[parts.length - 1] ?? "";
  });
  // Station-link templates: {{stnlnk|Agra Cantonment}} and friends. The station
  // NAME is the first argument, unlike {{sort}} where the display text is last.
  // Stripping these left 62 of 81 routes with an origin of "(AGC)" -- the code
  // in parentheses that followed the template, and nothing else.
  s = s.replace(/\{\{\s*(?:stnlnk|stn|rws|rwsx|station link)\s*\|([^{}]*)\}\}/gi, (_m, inner: string) => {
    const a = String(inner).split("|").map((x) => x.trim()).filter(Boolean);
    return a[0] ?? "";
  });
  // {{convert|455|km|mi|abbr=on}} -> "455 km". The value and its unit are the
  // first two arguments; everything after is display options.
  s = s.replace(/\{\{\s*(?:convert|cvt)\s*\|([^{}]*)\}\}/gi, (_m, inner: string) => {
    const a = String(inner).split("|").map((x) => x.trim());
    return a[0] && a[1] ? `${a[0]} ${a[1]}` : (a[0] ?? "");
  });
  // {{start date|2023|2|10}} and {{start date and age|...}} -> an ISO date.
  // Dates are the one field where a partial unwrap would be worse than none,
  // so this only fires when all three components are present and numeric.
  s = s.replace(/\{\{\s*(?:start date(?: and age)?|end date)\s*\|([^{}]*)\}\}/gi, (_m, inner: string) => {
    const a = String(inner).split("|").map((x) => x.trim()).filter((x) => /^\d+$/.test(x));
    if (a.length < 3) return a[0] ?? "";
    return `${a[0]}-${String(a[1]).padStart(2, "0")}-${String(a[2]).padStart(2, "0")}`;
  });
  s = s.replace(/\{\{[^{}]*\}\}/g, " ");           // any remaining simple template
  /*
   * An embedded file is not data, and its caption is not a value.
   *
   * `[[File:Su-35S.jpg|thumb|154x154px|A Russian Air Force Su-35S]]` went
   * through the [[Target|Display]] rule below and came out as
   * "thumb|154x154px|A Russian Air Force Su-35S" — so an illustration column
   * in an inventory table read as an aircraft type, and every row of the
   * Russian fleet arrived named after its own photograph.
   *
   * Stripped innermost-first, because a caption routinely contains its own
   * links and a single pass over the outer brackets would leave their halves
   * behind.
   */
  const FILE = /\[\[\s*(?:File|Image|Datei|Archivo)\s*:[^[\]]*\]\]/gi;
  for (let guard = 0; guard < 8; guard++) {
    const before = s;
    s = s.replace(FILE, " ");
    // A caption routinely contains its own links, which keep the outer
    // brackets from matching. Resolving the innermost ones first — those with
    // no brackets inside them — lets the next pass see a flat file link.
    s = s.replace(/\[\[([^[\]|]+)\|([^[\]]+)\]\]/g, "$2");
    s = s.replace(/\[\[([^[\]|]+)\]\]/g, "$1");
    if (s === before) break;
  }
  s = s.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2");   // [[Target|Display]]
  s = s.replace(/\[\[([^\]]+)\]\]/g, "$1");              // [[Target]]
  s = s.replace(/\[(?:https?:)?\/\/\S+\s+([^\]]+)\]/g, "$1"); // [url Display]
  s = s.replace(/'''?/g, "");                             // bold / italic
  s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&ndash;/g, "-");
  s = s.replace(/\|\s*$/, "");
  return s.replace(/\s+/g, " ").trim();
}

/** Split a `|`-separated cell line, honouring `||` on one physical line. */
function splitCells(line: string, marker: "|" | "!"): string[] {
  const body = line.replace(new RegExp(`^\\${marker}+`), "");
  const parts = body.split(marker === "|" ? "||" : /!!|\|\|/);
  return parts.map((p) => {
    // A cell may carry attributes before the content: `style="..." | value`.
    // Only split on the FIRST bar, and only when what precedes it looks like
    // attributes rather than data.
    const m = /^([^|]*?)\|(?!\|)([\s\S]*)$/.exec(p);
    if (m && /=/.test(m[1] ?? "") && !/\[\[/.test(m[1] ?? "")) return plain(m[2] ?? "");
    return plain(p);
  });
}

/**
 * Which header row actually labels the body's columns.
 *
 * A spanning title row has one cell; a real header row has as many cells as
 * the body has columns. So the body decides: take the most common row width
 * and pick the header row that matches it, preferring the last such row since
 * it sits closest to the data. With nothing matching, fall back to the widest
 * header row, which is still better than concatenating them all.
 */
function alignedHeader(headerRows: string[][], rows: string[][]): string[] {
  if (headerRows.length === 0) return [];
  if (headerRows.length === 1) return headerRows[0]!;

  const widths = new Map<number, number>();
  for (const r of rows) widths.set(r.length, (widths.get(r.length) ?? 0) + 1);
  let modal = 0, best = 0;
  for (const [w, n] of widths) if (n > best) { best = n; modal = w; }

  if (modal > 0) {
    for (let i = headerRows.length - 1; i >= 0; i--) {
      if (headerRows[i]!.length === modal) return headerRows[i]!;
    }
  }
  return headerRows.reduce((a, b) => (b.length > a.length ? b : a));
}

/**
 * Every table in a page, in document order.
 *
 * Nested tables are skipped rather than mis-parsed: a table inside a cell is
 * usually an infobox, and flattening one into the outer table's rows produces
 * rows that look real and are not.
 */
export function parseTables(wikitext: string): WikiTable[] {
  const out: WikiTable[] = [];
  const lines = wikitext.split(/\r?\n/);

  let i = 0;
  while (i < lines.length) {
    if (!/^\s*\{\|/.test(lines[i] ?? "")) { i++; continue; }

    const caption0 = (lines[i] ?? "").replace(/^\s*\{\|/, "").trim() || null;
    let depth = 1;
    const body: string[] = [];
    i++;
    while (i < lines.length && depth > 0) {
      const ln = lines[i] ?? "";
      if (/^\s*\{\|/.test(ln)) depth++;
      else if (/^\s*\|\}/.test(ln)) { depth--; if (depth === 0) { i++; break; } }
      if (depth > 0) body.push(ln);
      i++;
    }

    // Rows are delimited by |-, and a row is a header row when every cell in
    // it came from ! rather than |. Tracking that per row, instead of
    // accumulating all ! cells into one list, is what keeps a spanning title
    // above the headers from shifting every column index by one.
    const headerRows: string[][] = [];
    const rows: string[][] = [];
    let cur: string[] = [];
    let curIsHeader = true;
    let started = false;
    let caption = caption0;

    const flush = (): void => {
      if (cur.length === 0) return;
      if (curIsHeader && rows.length === 0) headerRows.push(cur);
      else rows.push(cur);
      cur = [];
      curIsHeader = true;
    };

    /**
     * A line starting with `|` is a new cell only when nothing is still open.
     *
     * Citation templates are routinely broken across lines, and their
     * continuation lines start with the same character that starts a cell:
     *
     *     | 549<ref>{{cite web
     *      |url=https://www.flightglobal.com/download
     *      |title=World Air Forces 2026}}</ref>
     *
     * Read line by line, that is three cells rather than one — and the two
     * spurious ones shift every column after them. The damage is not that the
     * citation shows up; it is that the NEXT column's value is read from the
     * wrong place.
     *
     * The air-force inventories are where this surfaced. France's fleet came
     * to 845,649 aircraft, because a URL fragment landed in the quantity
     * column and the first digit run inside the URL was read as a count. The
     * Rafale came to 2,026 and the American Metroliners to 2,023: the year out
     * of a `|title=World Air Forces 2026` and a `|Flight Global|2023|`. Every
     * one of those is a number in the right units, in the right column, of an
     * entirely plausible magnitude for a fleet.
     *
     * So depth is tracked across lines. While a template or a ref is open, a
     * leading bar is data, and the line is appended to the cell it belongs to.
     */
    let braceDepth = 0;
    let inRef = false;
    const track = (ln: string): void => {
      braceDepth += (ln.match(/\{\{/g) ?? []).length;
      braceDepth -= (ln.match(/\}\}/g) ?? []).length;
      if (braceDepth < 0) braceDepth = 0;
      // Self-closing refs open nothing.
      const opens = (ln.match(/<ref(?![^>]*\/>)[^>]*>/gi) ?? []).length;
      const closes = (ln.match(/<\/ref>/gi) ?? []).length;
      if (opens > closes) inRef = true;
      else if (closes >= opens && closes > 0) inRef = false;
    };
    const stillOpen = (): boolean => braceDepth > 0 || inRef;

    for (const ln of body) {
      const wasOpen = stillOpen();
      if (!wasOpen && /^\s*\|\+/.test(ln)) {
        track(ln);
        caption = plain(ln.replace(/^\s*\|\+/, ""));
        continue;
      }
      if (!wasOpen && /^\s*\|-/.test(ln)) { track(ln); flush(); started = true; continue; }
      if (!wasOpen && /^\s*!/.test(ln)) {
        track(ln);
        cur.push(...splitCells(ln.trim(), "!"));
        started = true;
        continue;
      }
      if (!wasOpen && /^\s*\|/.test(ln)) {
        track(ln);
        cur.push(...splitCells(ln.trim(), "|"));
        curIsHeader = false;
        started = true;
        continue;
      }
      // A continuation line belongs to the cell above it — either because it
      // does not start a cell, or because something above it is still open.
      track(ln);
      if (started && cur.length > 0 && ln.trim()) {
        /*
         * Cleaned again once the cell is whole, not only line by line.
         *
         * `plain` strips a template by matching its braces, and half a
         * template matches nothing — so cleaning each line as it arrives
         * leaves the pieces behind and joins them into a cell that still
         * carries the citation. Re-running it on the concatenation is the
         * cheapest way to give it a balanced string to work on, and it is
         * safe to repeat because every rule in it is idempotent on text that
         * has already had the markup removed.
         */
        cur[cur.length - 1] = plain(`${cur[cur.length - 1]} ${plain(ln)}`).trim();
      }
    }
    flush();

    out.push({ headers: alignedHeader(headerRows, rows), headerRows, rows, caption });
  }
  return out;
}

/**
 * Resolve a column by what its header says, never by position.
 *
 * The same discipline the spreadsheet reader follows: a table that gains a
 * column silently shifts every positional index, and the failure is a chart
 * with the wrong numbers under the right title.
 */
export function columnIndex(headers: string[], want: RegExp): number {
  for (let i = 0; i < headers.length; i++) {
    if (want.test(headers[i] ?? "")) return i;
  }
  return -1;
}

/**
 * Read a template's named parameters.
 *
 * Route articles carry their facts in an {{Infobox rail service}} rather than
 * in a table, so this is what turns one article into one row. Nested templates
 * and links inside a value are handled by depth-counting rather than by regex:
 * a value like `{{convert|759|km}}` contains the delimiter this splits on, and
 * a naive split would cut it in half and produce a plausible wrong number.
 */
export function parseInfobox(wikitext: string, namePattern: RegExp): Record<string, string> | null {
  const start = wikitext.search(new RegExp(`\\{\\{\\s*${namePattern.source}`, namePattern.flags));
  if (start < 0) return null;

  // Walk forward tracking brace and bracket depth so the template's own end is
  // found, not the end of the first nested one.
  let i = start + 2;
  let brace = 1, bracket = 0;
  const body: string[] = [];
  while (i < wikitext.length && brace > 0) {
    const two = wikitext.slice(i, i + 2);
    if (two === "{{") { brace++; body.push(two); i += 2; continue; }
    if (two === "}}") { brace--; if (brace === 0) { i += 2; break; } body.push(two); i += 2; continue; }
    if (two === "[[") { bracket++; body.push(two); i += 2; continue; }
    if (two === "]]") { bracket--; body.push(two); i += 2; continue; }
    body.push(wikitext[i]!);
    i++;
  }

  // Split on top-level pipes only.
  const text = body.join("");
  const parts: string[] = [];
  let cur = "";
  let b2 = 0, k2 = 0;
  for (let j = 0; j < text.length; j++) {
    const two = text.slice(j, j + 2);
    if (two === "{{") { b2++; cur += two; j++; continue; }
    if (two === "}}") { b2--; cur += two; j++; continue; }
    if (two === "[[") { k2++; cur += two; j++; continue; }
    if (two === "]]") { k2--; cur += two; j++; continue; }
    const ch = text[j]!;
    if (ch === "|" && b2 === 0 && k2 === 0) { parts.push(cur); cur = ""; continue; }
    cur += ch;
  }
  parts.push(cur);

  const out: Record<string, string> = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf("=");
    if (eq < 0) continue;
    const key = p.slice(0, eq).trim().toLowerCase();
    if (!key || /[{}[\]]/.test(key)) continue;
    out[key] = plain(p.slice(eq + 1));
  }
  return out;
}

/** First number in a string, ignoring thousands separators. `null` when absent. */
export function firstNumber(s: string): number | null {
  const m = s.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}
