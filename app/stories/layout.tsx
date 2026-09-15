import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The shell every visual story sits in.
 *
 * It exists to carry one class. `.story` swaps the surface, the ink and the
 * display face for the louder register these pages use, and doing it on a
 * layout rather than per page means a story cannot accidentally be half in one
 * register and half in the other.
 *
 * The negative margins pull the coloured ground out past the site's content
 * column. A story that sits in a narrow white column with lavender either side
 * reads as an embed; these pages are supposed to take over the screen.
 */
export default function StoriesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="story -mx-4 -mt-6 min-h-screen px-4 pb-20 pt-6 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
      <div className="mx-auto max-w-[1100px]">
        <Link
          href="/stories"
          className="story-card inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium"
          style={{ borderRadius: 999 }}
        >
          <span aria-hidden>←</span> Visual stories
        </Link>
        {children}
      </div>
    </div>
  );
}
