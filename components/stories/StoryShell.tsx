import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The shell every page in the story register sits in.
 *
 * ── Why this is a component and not a layout ─────────────────────────────
 *
 * It began as `app/stories/layout.tsx`, which was right while every page in
 * this register lived under `/stories`. Then `/growth-100` and `/world` were
 * built outside that segment, and they silently rendered without it.
 *
 * Silently is the important word. `.story` carries the register's three tone
 * variables — `--s-hot`, `--s-mid`, `--s-cool` — and nothing errors when a
 * custom property is undefined. `fill: var(--s-cool)` falls back to the
 * initial value, which is black, so every toned dot and bar rendered in ink
 * and looked deliberate. `stroke: var(--s-cool)` also falls back to its
 * initial value, which is `none` — so on a hundred sparklines the line
 * disappeared entirely and left the two end dots behind. A hundred panels of
 * what looked like two-point series, on a page whose subject is change over
 * time, and the markup was correct in every one of them.
 *
 * The same omission had the `.story-card` surface, the display face and the
 * pulled-out coloured ground missing too, which read as a plainer page rather
 * than a broken one. That is the whole failure mode: a missing wrapper does
 * not look like a bug, it looks like a design.
 *
 * So the shell is a component that any route can mount, and the three routes
 * that use the register each mount it in their own layout.
 */
export function StoryShell({
  children,
  back,
}: {
  children: ReactNode;
  /** Where the corner link goes back to, and what it is called. */
  back?: { href: string; label: string };
}) {
  /*
   * The negative margins pull the coloured ground out past the site's content
   * column. A story that sits in a narrow white column with lavender either
   * side reads as an embed; these pages are supposed to take over the screen.
   */
  return (
    <div className="story -mx-4 -mt-6 min-h-screen px-4 pb-20 pt-6 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
      <div className="mx-auto max-w-[1100px]">
        {back && (
          <Link
            href={back.href}
            className="story-card inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium"
            style={{ borderRadius: 999 }}
          >
            <span aria-hidden>←</span> {back.label}
          </Link>
        )}
        {children}
      </div>
    </div>
  );
}
