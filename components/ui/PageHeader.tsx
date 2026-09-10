import type { ReactNode } from "react";

/**
 * One opening for every page on the site.
 *
 * Before this, three pages opened in the display serif at 40px and fifteen
 * opened in the body sans at 24px, because the first three were written after
 * the type system existed and the rest were not. Nothing was broken; the site
 * simply read as two sites, and a reader crossing from the front page to the
 * chart registry met a different publication.
 *
 * The component takes the eyebrow, the title, the standfirst and an optional
 * strip of figures, and gives them one rhythm. Pages keep their own bodies —
 * this is a masthead, not a template.
 */

export interface HeaderStat {
  k: string;
  v: string;
}

export default function PageHeader({
  eyebrow,
  title,
  lede,
  stats,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  /** A short strip of counts. Four or fewer, or the row wraps oddly. */
  stats?: HeaderStat[];
  /** Anything the page wants under the standfirst — links, a caveat, a filter. */
  children?: ReactNode;
}) {
  return (
    <header className="pt-6 sm:pt-10">
      <p className="eyebrow">{eyebrow}</p>

      <h1 className="display mt-4 max-w-[20ch] text-[34px] leading-[1.06] sm:text-[46px]">
        {title}
      </h1>

      {lede && (
        <p className="mt-5 max-w-[58ch] text-[14px] leading-[1.7] text-[color:var(--text-secondary)]">
          {lede}
        </p>
      )}

      {stats && stats.length > 0 && (
        <dl className="mt-7 grid max-w-[52rem] grid-cols-2 gap-px overflow-hidden rounded-md border bg-[var(--hairline)] sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.k} className="bg-[var(--surface-1)] px-4 py-3.5">
              <dt className="eyebrow">{s.k}</dt>
              <dd className="mono mt-1.5 text-[18px] leading-none tracking-tight">{s.v}</dd>
            </div>
          ))}
        </dl>
      )}

      {children && <div className="mt-6">{children}</div>}
    </header>
  );
}
