/**
 * Reading tables out of a PDF.
 *
 * PDFs have no table structure. A page is a bag of text fragments, each with a
 * position, and the rows and columns a reader sees are an artefact of where
 * those fragments sit. So this reconstructs them: group fragments by their y
 * coordinate into rows, order each row by x, and hand back a grid.
 *
 * That reconstruction is a guess about layout, and this project has already
 * published wrong numbers once from a layout guess. Two things make this case
 * different from scraping a live page, and both matter:
 *
 *   1. The PDF is committed to the repository. It cannot change shape under
 *      the extractor between runs, and the exact bytes that produced a figure
 *      stay pinned next to it.
 *   2. It can be looked at. A page can be read directly and the extracted grid
 *      compared against what the page actually says, before anything is
 *      published — which was never possible with a host this sandbox cannot
 *      reach.
 *
 * Extraction still does not publish anything on its own. It produces a grid for
 * a person to check; the numbers reach the site only through the curated file,
 * with a citation naming the document and page.
 */

export interface TextFragment {
  text: string;
  x: number;
  y: number;
}

export interface PdfPageTable {
  page: number;
  rows: string[][];
}

/**
 * Fragments whose baselines differ by less than this are the same row.
 *
 * Statistical tables commonly set a superscript footnote marker a point or two
 * above the line; a tolerance below about 2 splits those into their own row.
 */
const ROW_TOLERANCE = 2.5;

/** Group positioned fragments into rows, each ordered left to right. */
export function fragmentsToRows(
  fragments: TextFragment[],
  rowTolerance = ROW_TOLERANCE,
): string[][] {
  if (fragments.length === 0) return [];

  // PDF y grows upward, so a descending sort reads the page top to bottom.
  const sorted = [...fragments].sort((a, b) => b.y - a.y || a.x - b.x);

  const rows: TextFragment[][] = [];
  let current: TextFragment[] = [];
  let anchor = sorted[0]?.y ?? 0;

  for (const f of sorted) {
    if (Math.abs(f.y - anchor) <= rowTolerance) {
      current.push(f);
    } else {
      if (current.length > 0) rows.push(current);
      current = [f];
      anchor = f.y;
    }
  }
  if (current.length > 0) rows.push(current);

  return rows.map((r) =>
    [...r].sort((a, b) => a.x - b.x).map((f) => f.text.replace(/\s+/g, " ").trim()),
  );
}

/**
 * Rows whose first cell reads as a year or an Indian fiscal year.
 *
 * Statistical appendix pages carry headings, footnotes and source lines around
 * the table. Anchoring on the year column is what separates the data from the
 * furniture, and it is the same anchor the SATP parser uses.
 */
export function yearRows(rows: string[][]): string[][] {
  return rows.filter((r) => /^(19|20)\d{2}(-\d{2,4})?\*?$/.test((r[0] ?? "").trim()));
}

/**
 * Parse an Indian-format number.
 *
 * Handles lakh/crore digit grouping (1,68,300), a trailing footnote asterisk,
 * and a dash meaning "not available". Returns null rather than 0 for anything
 * it cannot read: a missing figure and a zero are different facts, and this
 * project treats collapsing them as a defect.
 */
export function parseIndianNumber(cell: string): number | null {
  const cleaned = (cell ?? "").replace(/[,\s*†#]/g, "");
  if (cleaned === "" || /^[-–—]+$/.test(cleaned) || /^n\.?a\.?$/i.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Extract positioned text from a PDF, page by page.
 *
 * pdfjs is loaded dynamically so the library is a development dependency of
 * this script rather than something the site build has to carry.
 */
export async function extractPages(
  data: Uint8Array,
  opts: { firstPage?: number; lastPage?: number } = {},
): Promise<Array<{ page: number; fragments: TextFragment[] }>> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data, useSystemFonts: true });
  const doc = await task.promise;

  const first = Math.max(1, opts.firstPage ?? 1);
  const last = Math.min(doc.numPages, opts.lastPage ?? doc.numPages);

  const out: Array<{ page: number; fragments: TextFragment[] }> = [];
  for (let p = first; p <= last; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const fragments: TextFragment[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const str = item.str;
      if (!str || !str.trim()) continue;
      // transform is [a, b, c, d, e, f]; e and f are the x and y translation.
      const t = item.transform as number[];
      fragments.push({ text: str, x: t[4] ?? 0, y: t[5] ?? 0 });
    }
    out.push({ page: p, fragments });
  }
  // The loading task owns the worker; destroying the document is not enough.
  await task.destroy();
  return out;
}

/** Everything above, applied to a whole document: page number plus its rows. */
export async function extractTables(
  data: Uint8Array,
  opts: { firstPage?: number; lastPage?: number; yearsOnly?: boolean } = {},
): Promise<PdfPageTable[]> {
  const pages = await extractPages(data, opts);
  return pages.map(({ page, fragments }) => {
    const rows = fragmentsToRows(fragments);
    return { page, rows: opts.yearsOnly ? yearRows(rows) : rows };
  });
}
