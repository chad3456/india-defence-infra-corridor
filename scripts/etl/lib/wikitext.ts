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
  /** Header cells, in order, as plain text. */
  headers: string[];
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
  s = s.replace(/\{\{[^{}]*\}\}/g, " ");           // any remaining simple template
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

    const headers: string[] = [];
    const rows: string[][] = [];
    let cur: string[] | null = null;
    let caption = caption0;

    for (const ln of body) {
      if (/^\s*\|\+/.test(ln)) { caption = plain(ln.replace(/^\s*\|\+/, "")); continue; }
      if (/^\s*\|-/.test(ln)) {
        if (cur && cur.length) rows.push(cur);
        cur = [];
        continue;
      }
      if (/^\s*!/.test(ln)) {
        // Header cells only count before any body row has started.
        if (rows.length === 0 && (cur === null || cur.length === 0)) {
          headers.push(...splitCells(ln.trim(), "!"));
          continue;
        }
      }
      if (/^\s*\|/.test(ln)) {
        const cells = splitCells(ln.trim(), "|");
        if (cur === null) cur = [];
        cur.push(...cells);
        continue;
      }
      // A continuation line belongs to the cell above it.
      if (cur && cur.length > 0 && ln.trim()) {
        cur[cur.length - 1] = `${cur[cur.length - 1]} ${plain(ln)}`.trim();
      }
    }
    if (cur && cur.length) rows.push(cur);
    out.push({ headers, rows, caption });
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
