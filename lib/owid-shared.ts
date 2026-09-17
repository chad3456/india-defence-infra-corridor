/**
 * The OWID types a browser is allowed to see.
 *
 * ── Why this file exists ─────────────────────────────────────────────────
 *
 * lib/owid.ts reads shard files, so it imports node:fs. A client component
 * that imports anything from it — even a type — pulls the whole module into
 * the browser bundle, because a bare `import { X }` is not erased the way
 * `import type { X }` is, and the rule this project enforces is simpler than
 * remembering which is which: a client component may not reach a module that
 * touches a node builtin.
 *
 * So the shapes that cross the wire live here, with no imports of their own,
 * and `lib/owid.ts` re-exports them. The split is the same one
 * lib/census-shared.ts already makes, and `npm run test:client` is what caught
 * this one — a check that walks the import graph of every "use client" file
 * looking for node builtins.
 */

/** The compact shape a picker sends to the browser. Never the whole registry. */
export interface PickerRow {
  slug: string;
  title: string;
  category: string;
  map: boolean;
  /**
   * The unit is part of the row on purpose.
   *
   * OWID carries indicators whose titles are near-identical and whose units
   * are not — an absolute count, a per-capita rate and a share of GDP may all
   * be called the same thing. In a list of a thousand the unit is frequently
   * the only thing telling two adjacent rows apart.
   */
  unit: string;
}
