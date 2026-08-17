import Link from "next/link";
import { DATA_COVERAGE } from "@/lib/data";
import { registryStats } from "@/lib/registry";

export default function Footer() {
  const stats = registryStats();
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-[420px]">
            <p className="text-[12px] font-medium">Bharat Tracker</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[color:var(--text-secondary)]">
              An independent, source-cited record of Indian defence, infrastructure, trade and
              manufacturing. Not affiliated with any government body. Where the data is weak or
              contested, this site says so rather than smoothing it over.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-[11px] sm:grid-cols-4">
            <div>
              <dt className="eyebrow">charts</dt>
              <dd className="tnum mt-0.5">{stats.total}</dd>
            </div>
            <div>
              <dt className="eyebrow">series</dt>
              <dd className="tnum mt-0.5">{DATA_COVERAGE.seriesCount}</dd>
            </div>
            <div>
              <dt className="eyebrow">data points</dt>
              <dd className="tnum mt-0.5">{DATA_COVERAGE.pointCount}</dd>
            </div>
            <div>
              <dt className="eyebrow">sources</dt>
              <dd className="tnum mt-0.5">{DATA_COVERAGE.sourceCount}</dd>
            </div>
          </dl>
        </div>
        <div className="mt-6 flex flex-wrap gap-x-4 gap-y-1 border-t pt-4 text-[11px] text-[color:var(--text-muted)]">
          <Link href="/methodology" className="link-underline">
            Methodology & caveats
          </Link>
          <Link href="/sources" className="link-underline">
            Source register
          </Link>
          <Link href="/benchmark" className="link-underline">
            Honest assessment
          </Link>
          <span className="ml-auto">Data is public-domain government and multilateral output.</span>
        </div>
      </div>
    </footer>
  );
}
