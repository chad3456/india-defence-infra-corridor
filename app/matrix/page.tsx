import Link from "next/link";
import QuadrantMatrix, { QuadrantTable } from "@/components/charts/QuadrantMatrix";
import { getAllSeries } from "@/lib/data";
import { buildMatrix, QUADRANTS } from "@/lib/quadrant";
import { CATEGORY_LABELS, type Category } from "@/lib/types";

/**
 * Every comparable series on one grid: where India stands, and which way it is
 * moving. The point of the arrangement is that neither axis alone is honest —
 * a league table of levels hides an advantage being spent, and a growth-rate
 * table hides how far there is to go.
 */

export const metadata = {
  title: "Development matrix",
  description:
    "Every comparable series placed by standing against comparators and momentum over the period — computed, not assigned.",
};

export default async function MatrixPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const sp = await searchParams;
  const highlight = sp.category;

  const { placed, unplaceable, byQuadrant } = buildMatrix(getAllSeries());

  const categories = [...new Set(placed.map((p) => p.category))].sort();
  const reasons = new Map<string, number>();
  for (const u of unplaceable) {
    const key = u.reason.split(";")[0]?.replace(/\d+/g, "n") ?? u.reason;
    reasons.set(key, (reasons.get(key) ?? 0) + 1);
  }

  return (
    <div className="max-w-[1180px]">
      <section className="border-b pb-5">
        <p className="eyebrow">development matrix</p>
        <h1 className="mt-2 text-[24px] font-semibold tracking-tight">
          Standing against momentum
        </h1>
        <p className="mt-2 max-w-[760px] text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
          Every series with enough history and enough comparators, placed on two axes: where India
          sits against China, Vietnam, Brazil, Indonesia and the United States today, and which way
          it has moved across the period. Both are signed by each series&rsquo; own direction of
          good, so a fall in undernourishment and a rise in exports both read as improvement.
        </p>
        <p className="mt-2 max-w-[760px] text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
          Neither axis is honest alone. A table of levels hides an advantage being spent; a table of
          growth rates hides how far there is left to go. The quadrant that usually matters most is{" "}
          <strong className="font-medium text-[color:var(--text-primary)]">holding ground</strong> —
          ahead, but the lead narrowing — and it is invisible in every league table.
        </p>
      </section>

      <section className="mt-6 flex flex-wrap items-center gap-2">
        <Link
          href="/matrix"
          className={`rounded-full border px-3 py-1 text-[11px] ${
            highlight ? "text-[color:var(--text-secondary)]" : "font-medium"
          }`}
        >
          All sectors
        </Link>
        {categories.map((c) => (
          <Link
            key={c}
            href={`/matrix?category=${c}`}
            className={`rounded-full border px-3 py-1 text-[11px] ${
              highlight === c ? "font-medium" : "text-[color:var(--text-secondary)]"
            }`}
          >
            {CATEGORY_LABELS[c as Category]}
          </Link>
        ))}
      </section>

      <section className="mt-6">
        <QuadrantMatrix placed={placed} highlight={highlight} />
      </section>

      <section className="mt-8">
        <h2 className="border-b pb-2 text-[15px] font-semibold tracking-tight">
          What sits where
        </h2>
        <QuadrantTable byQuadrant={byQuadrant} />
      </section>

      <section className="mt-10 border-t pt-5">
        <h2 className="text-[15px] font-semibold tracking-tight">How a series is placed</h2>
        <p className="mt-2 max-w-[760px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          Standing is the gap between India&rsquo;s latest value and the median comparator, as a
          share of that median. Momentum is the total change from the first year to the latest, as a
          share of the first. Both are squashed into a −1 to +1 range and signed by the
          series&rsquo; direction of good. Nothing is placed by hand — the same rule the constructed
          security indices follow, and for the same reason: a matrix whose quadrants encode the
          author&rsquo;s opinion is an argument wearing a chart&rsquo;s clothes.
        </p>
        <p className="mt-2 max-w-[760px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          These are ordinal. A point further into a corner is more strongly that thing than one near
          the origin; it is not twice anything.
        </p>

        <h3 className="mt-5 text-[13px] font-semibold">
          {unplaceable.length} series are not on the grid
        </h3>
        <p className="mt-1 max-w-[760px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          Listed rather than dropped, because which series cannot be compared is itself a finding.
        </p>
        <ul className="mt-2 space-y-1">
          {[...reasons.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([reason, n]) => (
              <li key={reason} className="text-[12px] text-[color:var(--text-secondary)]">
                <span className="tnum text-[color:var(--text-primary)]">{n}</span> — {reason}
              </li>
            ))}
        </ul>
        <p className="mt-3 max-w-[760px] text-[11px] leading-relaxed text-[color:var(--text-muted)]">
          The largest group is series with no agreed direction of good. Defence spending, arms
          imports and warhead counts are deliberately undirected on this site: whether more is
          better is the argument, not the data, and an axis running from worse to better cannot
          carry them. Full method on{" "}
          <Link href="/methodology" className="link-underline">
            methodology
          </Link>
          .
        </p>
      </section>

      <section className="mt-8 border-t pt-5">
        <h2 className="text-[15px] font-semibold tracking-tight">The four quadrants</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {QUADRANTS.map((q) => (
            <div key={q.id}>
              <dt className="text-[12px] font-medium">{q.label}</dt>
              <dd className="mt-0.5 text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
                {q.meaning}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
