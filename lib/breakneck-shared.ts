/**
 * Types for /breakneck, the visual study guide to Dan Wang's *Breakneck*.
 * Shared by the connector, the loader and the client components; no node
 * imports.
 */

export type ChapterId = "intro" | "c1" | "c2" | "c3" | "c4" | "c5" | "c6" | "c7";

/** A figure as the book prints it, with the page it is printed on. */
export interface BkFigure {
  id: string;
  ch: ChapterId;
  /** Short label in this site's words; any number in it is one the book prints. */
  label: string;
  value: number;
  /** Upper end of a range ("between 2030 and 2033"), or a second value the same sentence gives. */
  value2?: number;
  /** Every value a multi-number sentence gives, keyed — for charts that need all of them. */
  series?: Array<{ key: string; value: number }>;
  unit: string;
  /** The book's own hedge: about, nearly, over, up to, at least, fewer than. */
  hedge?: string;
  year?: string;
  /**
   * Whose figure it is, as the book attributes it: "the author" when the book
   * states it without a source, otherwise the source the book names.
   */
  credit: string;
  page: number | null;
}

export interface BkEvent {
  id: string;
  who: "lu" | "yao";
  age: number;
  year: number;
  what: string;
  page: number | null;
}

export interface BkChapter {
  id: ChapterId;
  n: string;
  title: string;
  firstPage: number | null;
}

export interface BreakneckBook {
  generatedAt: string;
  book: { title: string; subtitle: string; author: string; publisher: string; year: number; isbn: string };
  chapters: BkChapter[];
  figures: BkFigure[];
  cohorts: BkEvent[];
}
