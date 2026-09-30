import { loadChinaExports } from "@/lib/china-exports";
import { ChinaDashboard } from "@/components/china/ChinaDashboard";

/**
 * Made in China, sold everywhere: what China exports, from speakers to drones
 * to guitars, as China reports it to the UN, checked against what the rest of
 * the world reports buying. See lib/china-exports.ts for every derivation and
 * scripts/etl/connectors/china-exports.ts for the source.
 */

export const metadata = {
  title: "Made in China, sold everywhere · Bharat Tracker",
  description:
    "A dashboard of China's exports to the world — speakers, headphones, guitars, drones, solar panels, batteries, "
    + "e-bikes and more — from UN Comtrade, with a flow map of who buys each one and every source listed.",
};

/** A band of cloud-scroll, the border of a blue-and-white bowl. */
function Border() {
  return (
    <svg className="cx-border" viewBox="0 0 400 24" preserveAspectRatio="none" aria-hidden>
      <defs>
        <pattern id="cloudband" width="40" height="24" patternUnits="userSpaceOnUse">
          <path d="M2 18c0-6 8-8 11-3 1-6 11-7 12 0 3-4 10-2 10 3" fill="none" stroke="#1b3a85" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M8 18c1-2 4-2 5 0M24 18c1-3 5-3 6 0" fill="none" stroke="#1b3a85" strokeWidth="1.1" strokeLinecap="round" />
        </pattern>
      </defs>
      <rect width="400" height="24" fill="url(#cloudband)" />
    </svg>
  );
}

export default function ChinaExportsPage() {
  const v = loadChinaExports();
  return (
    <div className="cxp">
      <header className="cx-hero">
        <Border />
        <p className="cx-kicker">Trade · from speakers to drones to guitars</p>
        <h1>Made in China, <em>sold everywhere</em></h1>
        <p className="cx-stand">
          {v.present && v.latestYear
            ? <>What China shipped to the world in {v.latestYear}, product by product and country by country, as China reports it to the United Nations — and checked against what the rest of the world says it bought.</>
            : <>What China ships to the world, product by product and country by country, as China reports it to the United Nations.</>}
        </p>
        <Border />
      </header>
      {v.present ? (
        <ChinaDashboard v={v} />
      ) : (
        <section className="cx-panel cx-empty">
          <h2 className="cx-h2">The numbers are on their way</h2>
          <p>The data is read from UN Comtrade by a scheduled job and has not arrived yet. Nothing is shown until it has, rather than a guess in its place.</p>
        </section>
      )}
    </div>
  );
}
