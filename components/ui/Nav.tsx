import Link from "next/link";

/**
 * The dashboards, and only the dashboards.
 *
 * Fifteen entries did not fit: at 1340px the bar clipped mid-word, rendering
 * "Method" as "Metl". It scrolled, but a label cut in half reads as broken
 * rather than as scrollable.
 *
 * The four that went — Assessment, Sources, Data sources and Method — are all
 * linked from the footer of every page, so nothing became unreachable. They
 * are about how the site works rather than about India, which is the right
 * distinction to make when something has to go.
 */
const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/growth", label: "Growth" },
  { href: "/everyday", label: "Everyday" },
  { href: "/made-in-india", label: "Made in India" },
  { href: "/defence-tracker", label: "Defence" },
  { href: "/mobility", label: "Mobility" },
  { href: "/atlas", label: "Atlas" },
  { href: "/elections", label: "Elections" },
  { href: "/map", label: "Map" },
  { href: "/charts", label: "Charts" },
  { href: "/matrix", label: "Matrix" },
  { href: "/tracker", label: "Tracker" },
  { href: "/evidence", label: "Evidence" },
];

export default function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b bg-[var(--plane)]/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1180px] items-center gap-4 px-4 py-2.5 sm:px-6">
        <Link href="/" className="flex items-baseline gap-1.5">
          <span className="text-[14px] font-semibold tracking-tight">Bharat Tracker</span>
          <span className="eyebrow hidden sm:inline">since 2001</span>
        </Link>
        {/* min-w-0: a flex item defaults to min-width:auto, so without it the
            overflow-x-auto never engages and the links push the page wider
            than the viewport instead of scrolling inside the bar. */}
        {/* The fade marks the scroll edge on narrow viewports, so a label that
            runs off reads as continuing rather than as cut off. */}
        <nav
          className="ml-auto flex min-w-0 items-center gap-3 overflow-x-auto sm:gap-4"
          style={{
            maskImage: "linear-gradient(to right, black calc(100% - 1.5rem), transparent)",
            WebkitMaskImage: "linear-gradient(to right, black calc(100% - 1.5rem), transparent)",
          }}
        >
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="whitespace-nowrap text-[12px] text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)]"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
