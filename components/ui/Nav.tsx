import Link from "next/link";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/charts", label: "Charts" },
  { href: "/map", label: "Map" },
  { href: "/defence-tracker", label: "Defence" },
  { href: "/made-in-india", label: "Made in India" },
  { href: "/matrix", label: "Matrix" },
  { href: "/benchmark", label: "Assessment" },
  { href: "/tracker", label: "Tracker" },
  { href: "/evidence", label: "Evidence" },
  { href: "/data-sources", label: "Sources" },
  { href: "/methodology", label: "Method" },
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
        <nav className="ml-auto flex min-w-0 items-center gap-3 overflow-x-auto sm:gap-4">
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
