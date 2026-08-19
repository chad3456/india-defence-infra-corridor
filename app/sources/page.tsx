import Link from "next/link";
import { getAllSources, getAllSeries } from "@/lib/data";

export const metadata = { title: "Source register" };

const TIER_LABEL: Record<number, string> = {
  1: "primary record",
  2: "secondary compiler",
  3: "press report",
};

export default function SourcesPage() {
  const sources = getAllSources();
  const series = getAllSeries();

  // Count how many series lean on each source, so a reader can see which
  // sources carry the most weight on this site.
  const usage = new Map<string, string[]>();
  for (const s of series) {
    const ids = new Set<string>(s.sourceIds);
    s.points.forEach((p) => p.sourceId && ids.add(p.sourceId));
    for (const id of ids) {
      usage.set(id, [...(usage.get(id) ?? []), s.title]);
    }
  }

  const byTier = [1, 2, 3].map((tier) => ({
    tier,
    items: sources
      .filter((s) => s.tier === tier)
      .sort((a, b) => (usage.get(b.id)?.length ?? 0) - (usage.get(a.id)?.length ?? 0)),
  }));

  return (
    <div className="max-w-[820px]">
      <section className="border-b pb-5">
        <p className="eyebrow">source register</p>
        <h1 className="mt-2 text-[24px] font-semibold tracking-tight">
          Every source behind every number
        </h1>
        <p className="mt-2 text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          {sources.length} sources, grouped by tier. Tier 1 is the primary record holder for that
          quantity; tier 3 is a press report of a primary claim. A series resting only on tier-3
          sources cannot be graded above low confidence. For what each publisher covers, how often
          it refreshes and where it falls short, see the{" "}
          <Link href="/data-sources" className="link-underline">
            data source catalogue
          </Link>
          .
        </p>
      </section>

      {byTier.map(({ tier, items }) => (
        <section key={tier} className="py-6">
          <div className="mb-3 flex items-baseline gap-2">
            <h2 className="text-[15px] font-semibold tracking-tight">Tier {tier}</h2>
            <span className="eyebrow">{TIER_LABEL[tier]}</span>
            <span className="tnum ml-auto text-[11px] text-[color:var(--text-muted)]">
              {items.length}
            </span>
          </div>
          <ul className="divide-y rounded-lg border">
            {items.map((s) => {
              const used = usage.get(s.id) ?? [];
              return (
                <li key={s.id} className="p-3">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link-underline text-[13px] font-medium"
                    >
                      {s.name}
                    </a>
                    <span className="eyebrow">{s.provenance}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[color:var(--text-secondary)]">{s.publisher}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[10px] text-[color:var(--text-muted)]">
                    <span>accessed {s.accessed}</span>
                    {used.length > 0 && (
                      <span>
                        backs {used.length} series: {used.slice(0, 3).join(", ")}
                        {used.length > 3 ? `, +${used.length - 3} more` : ""}
                      </span>
                    )}
                    {used.length === 0 && <span>activated by the pipeline on first run</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
