import type { ReactNode } from "react";
import Link from "next/link";

/** A dark page: the map reads best on a dark ground, so the page takes the whole width in it. */
export default function MalnutritionLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mal-page -mt-6 min-h-screen pb-20 pt-6">
      <div>
        <Link href="/" className="mal-back"><span aria-hidden>←</span> Home</Link>
        {children}
      </div>
    </div>
  );
}
