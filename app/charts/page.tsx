import Link from "next/link";
import ChartCard from "@/components/charts/ChartCard";
import { getRegistry, registryStats } from "@/lib/registry";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/types";
import { TRANSFORM_LABELS } from "@/lib/transforms";
import type { Transform } from "@/lib/types";

export const metadata = { title: "All charts" };

const PAGE_SIZE = 24;
const TRANSFORMS: Transform[] = ["level", "yoy", "index-2001", "cagr", "share", "delta"];

interface Params {
  category?: string;
  view?: string;
  status?: string;
  page?: string;
}

export default async function ChartsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;
  const category = CATEGORIES.includes(sp.category as Category)
    ? (sp.category as Category)
    : undefined;
  const view = TRANSFORMS.includes(sp.view as Transform) ? (sp.view as Transform) : undefined;
  const status = sp.status === "live" || sp.status === "pending" ? sp.status : undefined;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const stats = registryStats();

  let charts = getRegistry();
  if (category) charts = charts.filter((c) => c.category === category);
  if (view) charts = charts.filter((c) => c.transform === view);
  if (status === "live") charts = charts.filter((c) => !c.pending);
  if (status === "pending") charts = charts.filter((c) => c.pending);

  // Live charts first — a reader should hit real data before placeholders.
  charts = [...charts].sort((a, b) => Number(a.pending) - Number(b.pending));

  const totalPages = Math.max(1, Math.ceil(charts.length / PAGE_SIZE));
  const clamped = Math.min(page, totalPages);
  const slice = charts.slice((clamped - 1) * PAGE_SIZE, clamped * PAGE_SIZE);

  const qs = (over: Partial<Params>) => {
    const p = new URLSearchParams();
    const merged = { category, view, status, ...over };
    if (merged.category) p.set("category", merged.category);
    if (merged.view) p.set("view", merged.view);
    if (merged.status) p.set("status", merged.status);
    if (merged.page && merged.page !== "1") p.set("page", String(merged.page));
    const s = p.toString();
    return s ? `/charts?${s}` : "/charts";
  };

  const Chip = ({
    href,
    active,
    children,
  }: {
    href: string;
    active: boolean;
    children: React.ReactNode;
  }) => (
    <Link
      href={href}
      className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
        active
          ? "border-transparent bg-[var(--text-primary)] text-[color:var(--surface-1)]"
          : "hover:bg-[var(--surface-2)]"
      }`}
    >
      {children}
    </Link>
  );

  return (
    <div>
      <section className="border-b pb-5">
        <p className="eyebrow">chart gallery</p>
        <h1 className="mt-2 text-[24px] font-semibold tracking-tight">
          {stats.total} charts, {stats.live} live
        </h1>
        <p className="mt-2 max-w-[600px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          Derived views — year-on-year, indexed, growth rates — are labelled as derived and are only
          generated where the underlying series has enough points to make them meaningful. Charts
          awaiting the ETL backfill are shown explicitly rather than hidden.
        </p>
      </section>

      {/* Filters — one row per dimension, above the charts */}
      <div className="sticky top-[45px] z-20 -mx-4 mb-4 space-y-2 border-b bg-[var(--plane)]/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="eyebrow shrink-0 pr-1">topic</span>
          <Chip href={qs({ category: undefined, page: "1" })} active={!category}>
            all
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c} href={qs({ category: c, page: "1" })} active={category === c}>
              {CATEGORY_LABELS[c]}
              <span className="ml-1 opacity-60">{stats.byCategory[c] ?? 0}</span>
            </Chip>
          ))}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="eyebrow shrink-0 pr-1">view</span>
          <Chip href={qs({ view: undefined, page: "1" })} active={!view}>
            all
          </Chip>
          {TRANSFORMS.map((t) => (
            <Chip key={t} href={qs({ view: t, page: "1" })} active={view === t}>
              {TRANSFORM_LABELS[t]}
            </Chip>
          ))}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="eyebrow shrink-0 pr-1">data</span>
          <Chip href={qs({ status: undefined, page: "1" })} active={!status}>
            all
          </Chip>
          <Chip href={qs({ status: "live", page: "1" })} active={status === "live"}>
            live now ({stats.live})
          </Chip>
          <Chip href={qs({ status: "pending", page: "1" })} active={status === "pending"}>
            awaiting ETL ({stats.pending})
          </Chip>
        </div>
      </div>

      <p className="mb-3 text-[11px] text-[color:var(--text-muted)]">
        {charts.length} matching · page {clamped} of {totalPages}
      </p>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {slice.map((spec) => (
          <ChartCard key={spec.id} spec={spec} compact />
        ))}
      </div>

      {slice.length === 0 && (
        <p className="py-12 text-center text-[12px] text-[color:var(--text-muted)]">
          No charts match these filters.
        </p>
      )}

      {totalPages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-2 border-t pt-5">
          {clamped > 1 && (
            <Link
              href={qs({ page: String(clamped - 1) })}
              className="rounded border px-3 py-1.5 text-[11px] hover:bg-[var(--surface-2)]"
            >
              ← previous
            </Link>
          )}
          <span className="tnum px-2 text-[11px] text-[color:var(--text-muted)]">
            {clamped} / {totalPages}
          </span>
          {clamped < totalPages && (
            <Link
              href={qs({ page: String(clamped + 1) })}
              className="rounded border px-3 py-1.5 text-[11px] hover:bg-[var(--surface-2)]"
            >
              next →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
