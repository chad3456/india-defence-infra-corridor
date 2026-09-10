"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Fifteen destinations, grouped into four.
 *
 * The bar carried all fifteen in one row. It fit — just — after the body face
 * changed to a narrower grotesque, but fitting was never the problem: a flat
 * row of fifteen links is a list of everything the site has, which is the
 * least useful thing a reader can be handed at the top of a page. Nothing in
 * it said that Growth and Everyday are the same kind of thing and Charts is
 * not.
 *
 * Four groups, named for what a reader is looking for rather than for how the
 * site is built: the country, the world it is measured against, the raw
 * catalogue, and how the whole thing works. Each opens on click and stays open
 * until it is dismissed, because a hover menu on a page full of hoverable
 * charts fires when nobody asked it to.
 *
 * The old bar also faded its right edge with a mask to mark a scroll boundary,
 * which meant the last item read as clipped whether or not there was anything
 * to scroll to. There is no mask now because there is nothing to scroll.
 *
 * ── Below the small breakpoint ───────────────────────────────────────────
 *
 * The brand and four group buttons overflowed a 390px screen — the page
 * scrolled sideways and the bar wrapped to two lines. So the groups collapse
 * to one control there, and the panel it opens carries all four groups as
 * headed sections. Same destinations, one column, no horizontal scroll.
 */

interface Item { href: string; label: string; blurb: string }
interface Group { id: string; label: string; items: Item[] }

const GROUPS: Group[] = [
  {
    id: "india",
    label: "India",
    items: [
      { href: "/growth", label: "Growth", blurb: "Digital payments, literacy, space, defence industry" },
      { href: "/everyday", label: "Everyday", blurb: "A hundred numbers anyone can read" },
      { href: "/made-in-india", label: "Made in India", blurb: "What is actually built here, by product" },
      { href: "/defence-tracker", label: "Defence", blurb: "Exports, production, corridors, insurgency" },
      { href: "/mobility", label: "Mobility", blurb: "Rail, metro, highways, airports" },
      { href: "/atlas", label: "Atlas", blurb: "The statewise picture" },
      { href: "/elections", label: "Elections", blurb: "Turnout and voting patterns by state" },
      { href: "/map", label: "Map", blurb: "Corridors and the highway timelapse" },
    ],
  },
  {
    id: "world",
    label: "The world",
    items: [
      { href: "/global", label: "Global economy", blurb: "India against the economies it is compared with" },
      { href: "/arsenal", label: "Arsenal", blurb: "Missiles by nation, and who is buying what" },
      { href: "/benchmark", label: "Benchmark", blurb: "The honest global assessment" },
    ],
  },
  {
    id: "data",
    label: "Data",
    items: [
      { href: "/charts", label: "All charts", blurb: "The full chart registry" },
      { href: "/matrix", label: "Matrix", blurb: "Every series, cross-tabulated" },
      { href: "/tracker", label: "News tracker", blurb: "What the feeds found this fortnight" },
      { href: "/evidence", label: "Evidence", blurb: "Claims against the figures that test them" },
    ],
  },
  {
    id: "method",
    label: "Method",
    items: [
      { href: "/methodology", label: "Methodology", blurb: "What counts as a source, and the publish gate" },
      { href: "/sources", label: "Source register", blurb: "Every publisher behind the numbers" },
      { href: "/data-sources", label: "Data sources", blurb: "Feeds, APIs and their refresh cadence" },
    ],
  },
];

export default function Nav() {
  const [open, setOpen] = useState<string | null>(null);
  const pathname = usePathname();
  const barRef = useRef<HTMLDivElement>(null);

  // A menu that survives navigation is a menu covering the page you asked for.
  useEffect(() => { setOpen(null); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    const onDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const activeGroup = GROUPS.find((g) => g.items.some((i) => i.href === pathname))?.id;

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--hairline)] bg-[var(--plane)]/85 backdrop-blur-md">
      <div ref={barRef} className="mx-auto flex max-w-[1180px] items-center gap-6 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-baseline gap-2">
          <span className="text-[15px] font-semibold tracking-tight">Bharat Tracker</span>
          <span className="eyebrow hidden sm:inline">since 2001</span>
        </Link>

        {/* Phones: one control, every group inside it. */}
        <div className="relative ml-auto sm:hidden">
          <button
            type="button"
            onClick={() => setOpen(open === "all" ? null : "all")}
            aria-expanded={open === "all"}
            aria-haspopup="true"
            className="flex items-center gap-1.5 rounded-md border border-[color:var(--gridline)] px-2.5 py-1.5 text-[12.5px]"
          >
            Sections
            <svg width="8" height="5" viewBox="0 0 8 5" aria-hidden
              style={{ transform: open === "all" ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
              <path d="M0 0 L4 5 L8 0" fill="none" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </button>
          {open === "all" && (
            <div
              className="absolute right-0 top-[calc(100%+6px)] z-50 max-h-[70vh] w-[16rem] overflow-y-auto rounded-lg border border-[color:var(--gridline)] bg-[var(--surface-1)] shadow-lg"
              role="menu"
            >
              {GROUPS.map((g) => (
                <div key={g.id}>
                  <p className="eyebrow border-b border-[color:var(--hairline)] bg-[var(--surface-2)] px-3.5 py-1.5">
                    {g.label}
                  </p>
                  {g.items.map((it) => (
                    <Link
                      key={it.href}
                      href={it.href}
                      role="menuitem"
                      className="block border-b border-[color:var(--hairline)] px-3.5 py-2 text-[12.5px] font-medium"
                      style={{ background: pathname === it.href ? "var(--surface-2)" : undefined }}
                    >
                      {it.label}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <nav className="ml-auto hidden items-center gap-1 sm:flex" aria-label="Sections">
          {GROUPS.map((g) => {
            const isOpen = open === g.id;
            return (
              <div key={g.id} className="relative">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : g.id)}
                  aria-expanded={isOpen}
                  aria-haspopup="true"
                  className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12.5px] transition-colors hover:bg-[var(--surface-2)] sm:px-2.5"
                  style={{
                    color: activeGroup === g.id || isOpen
                      ? "var(--text-primary)" : "var(--text-secondary)",
                  }}
                >
                  {g.label}
                  <svg width="8" height="5" viewBox="0 0 8 5" aria-hidden
                    style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
                    <path d="M0 0 L4 5 L8 0" fill="none" stroke="currentColor" strokeWidth="1.3" />
                  </svg>
                </button>

                {isOpen && (
                  <div
                    className="absolute right-0 top-[calc(100%+6px)] z-50 w-[17.5rem] overflow-hidden rounded-lg border border-[color:var(--gridline)] bg-[var(--surface-1)] shadow-lg"
                    role="menu"
                  >
                    {g.items.map((it) => (
                      <Link
                        key={it.href}
                        href={it.href}
                        role="menuitem"
                        className="flex flex-col border-b border-[color:var(--hairline)] px-3.5 py-2 transition-colors last:border-b-0 hover:bg-[var(--surface-2)]"
                        style={{
                          background: pathname === it.href ? "var(--surface-2)" : undefined,
                        }}
                      >
                        <span className="text-[12.5px] font-medium leading-snug">{it.label}</span>
                        <span className="text-[11px] leading-snug text-[color:var(--text-muted)]">
                          {it.blurb}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
