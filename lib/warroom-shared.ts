/**
 * Types and display constants shared between the server readers and the
 * client timeline.
 *
 * Pure: no imports, no `node:fs`. `lib/warroom.ts` reads files and cannot be
 * imported from a client component — `npm run test:client` walks the import
 * graph of every "use client" file and fails on a node builtin, which is how
 * the indicator picker's dependency on `node:fs` was caught. The same split
 * that fixed it is the one used here.
 */

export type Claimant = "India" | "Pakistan" | "third-party" | "unattributed";

export interface SindoorEntry {
  date: string;
  yearInferred: boolean;
  text: string;
  section: string;
  page: string;
  role: "operation" | "trigger";
  claimant: Claimant;
  claimantCue: string | null;
  reported: boolean;
  citations: Array<{ publisher: string | null; title: string | null; url: string | null }>;
}

/**
 * The tone each claimant is drawn in, fixed so the two national accounts never
 * swap colours between one chart and the next.
 *
 * "Unattributed" shares the neutral tone with third parties rather than taking
 * one of the two national ones, because giving it a colour of its own would
 * make it look like a third position in the dispute. It is not a position; it
 * is an absence of one.
 */
export const CLAIMANT_TONE: Record<Claimant, "hot" | "mid" | "cool"> = {
  India: "cool",
  Pakistan: "hot",
  "third-party": "mid",
  unattributed: "mid",
};

export const CLAIMANT_LABEL: Record<Claimant, string> = {
  India: "Indian sources",
  Pakistan: "Pakistani sources",
  "third-party": "Third parties, or both at once",
  unattributed: "No source named in the sentence",
};
