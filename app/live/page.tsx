import Link from "next/link";
import LiveTracker from "@/components/live/LiveTracker";
import { getSeries, latestPoint } from "@/lib/data";

/**
 * The live tracker: markets, military aircraft and headlines, read when the
 * page is open. The official annual figures beside them are the site's record
 * (World Bank WDI, committed and validated); the live readings are not.
 */

export const metadata = {
  title: "Live: markets, military aircraft and the news, now",
  description: "India's market indices and the rupee, military aircraft broadcasting over South Asia, and the last day's economy and defence headlines, refreshed while you watch.",
};
export const dynamic = "force-static";

const BASELINE: Array<[string, string, (v: number) => string]> = [
  ["wdi-gdp-growth", "GDP growth", (v) => `${v.toFixed(1)}%`],
  ["wdi-inflation", "Consumer-price inflation", (v) => `${v.toFixed(1)}%`],
  ["wdi-unemployment", "Unemployment", (v) => `${v.toFixed(1)}%`],
  ["wdi-reserves", "Foreign reserves", (v) => `$${(v / 1e9).toFixed(0)} bn`],
  ["wdi-exports-usd", "Exports, goods and services", (v) => `$${(v / 1e9).toFixed(0)} bn`],
  ["wdi-milex-gdp", "Military spending", (v) => `${v.toFixed(2)}% of GDP`],
];

export default function LivePage() {
  const baseline = BASELINE.map(([id, label, f]) => {
    const s = getSeries(id);
    const last = s ? latestPoint(s) : undefined;
    return last && last.value != null ? { id, label, value: f(last.value), period: last.period } : null;
  }).filter((x): x is NonNullable<typeof x> => !!x);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">Live</p>
        <h1 className="display mt-4 max-w-[24ch] text-[32px] leading-[1.07] text-ink sm:text-[42px]">Markets, military aircraft and the news, now</h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          Read when you open the page and refreshed while it stays open. These are live readings, not the site&rsquo;s record: they are
          not checked, not stored, and a source that stops answering shows as unavailable rather than as an older number.
        </p>
      </header>

      {baseline.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">The official baseline · latest annual figures</h2>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {baseline.map((b) => (
              <Link key={b.id} href="/charts" className="rounded-lg border border-gridline bg-surface-2 p-3 hover:border-[color:var(--color-ink-2)]">
                <p className="text-lg font-semibold tabular-nums text-ink">{b.value}</p>
                <p className="text-[11px] text-ink">{b.label}</p>
                <p className="text-[10px] text-ink-muted">{b.period} · World Bank WDI</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <LiveTracker />

      <footer className="mt-12 border-t border-gridline pt-4 text-xs leading-relaxed text-ink-muted">
        Index prices: NSE and BSE via Moneycontrol&rsquo;s public price feed. Currency: European Central Bank reference rates via Frankfurter,
        cross-checked with ExchangeRate-API. Aircraft: adsb.lol and adsb.fi, community ADS-B aggregators. Headlines: Google News, and the
        government feeds in this site&rsquo;s source register. Commodity prices are not shown: no keyless source answered.
        Longer-run military flying is on the <Link href="/airpower" className="underline">airpower</Link> page; the checked news register is the{" "}
        <Link href="/tracker" className="underline">tracker</Link>.
      </footer>
    </main>
  );
}
