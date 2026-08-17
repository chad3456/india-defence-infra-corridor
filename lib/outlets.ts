/**
 * Outlet display names, kept separate from the ETL connector so the page can
 * list them without pulling Node-only fetch code into the client graph.
 * Must stay in sync with `scripts/etl/connectors/news.ts`.
 */
export const OUTLET_NAMES = [
  "ThePrint",
  "The Hindu",
  "Swarajya",
  "OpIndia",
  "NDTV",
  "India Today",
  "Rest of World",
] as const;
