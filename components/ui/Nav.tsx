"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import NewBadge from "./NewBadge";

/**
 * The destinations, grouped into five.
 *
 * The bar carried all fifteen in one row. It fit — just — after the body face
 * changed to a narrower grotesque, but fitting was never the problem: a flat
 * row of fifteen links is a list of everything the site has, which is the
 * least useful thing a reader can be handed at the top of a page. Nothing in
 * it said that Growth and Everyday are the same kind of thing and Charts is
 * not.
 *
 * Five groups, named for what a reader is looking for rather than for how the
 * site is built: the country, its elections, the world it is measured against, the raw
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
 * The brand and the group buttons overflowed a 390px screen — the page
 * scrolled sideways and the bar wrapped to two lines. So the groups collapse
 * to one control there, and the panel it opens carries every group as
 * headed sections. Same destinations, one column, no horizontal scroll.
 *
 * ── Dashboards ───────────────────────────────────────────────────────────
 *
 * A few destinations are not one page but a section of many charts with
 * sub-pages of their own. In a list of twenty one-line links they read as one
 * more line. Marking one `dashboard` lifts it into a block at the top of its
 * group, with an accent bar, a tag, and links straight to its sub-pages. The
 * block leads the menu and links into the section's sub-pages.
 */

interface Item {
  href: string; label: string; blurb: string;
  /** A multi-page dashboard: shown first in its group, with its sub-pages linked directly. */
  dashboard?: { parts?: Array<{ href: string; label: string }> };
}
interface Group { id: string; label: string; items: Item[] }

const GROUPS: Group[] = [
  {
    id: "india",
    label: "India",
    items: [
      { href: "/ministries", label: "Ministries' own records", blurb: "India's trade from the Commerce Ministry's releases; ten years of the Home Ministry's monthly reports, read",
        dashboard: { parts: [{ href: "/ministries/commerce", label: "Commerce: trade" }, { href: "/ministries/home-affairs", label: "Home Affairs: reports" }] } },
      { href: "/protests", label: "Protest and public order", blurb: "Riots, public property, police firing and casualties since 2004, every figure checked",
        dashboard: { parts: [{ href: "/protests/delhi-2026-10-10", label: "Delhi, 10 October" }] } },
      { href: "/protest-watch", label: "Protest Watch, live", blurb: "Protests worldwide every minute: where, what cause, how covered, what was reported — every cause by the same rules", dashboard: {} },
      { href: "/free-palestine-inc", label: "Free Palestine, Inc.?", blurb: "Cause or career? Gaza's toll, the hashtags, the keffiyeh boom, the money and the protests — 21 claims checked", dashboard: {} },
      { href: "/demolitions", label: "Religious structures demolished", blurb: "Temples, mazars, mosques removed as encroachments since 2014: every official and court figure, what adds up, and what does not", dashboard: {} },
      { href: "/income-tax", label: "What income tax buys", blurb: "₹12.41 lakh crore counted in iPhones, missiles and moon missions; who pays, where it goes, and India against the US", dashboard: {} },
      { href: "/tbm", label: "Tunnel boring machines", blurb: "A 3D particle story: how a TBM works, every machine in India to scale, who builds them, and China's export controls", dashboard: {} },
      { href: "/nfhs", label: "Family health, 1998–2021", blurb: "Every National Family Health Survey round since 1998–99 on the same measures: India, rich and poor, every state", dashboard: {} },
      { href: "/luxury-beliefs", label: "Luxury beliefs, tested", blurb: "Rob Henderson's idea against Indian data: who believes what, who pays — live headlines and the NFHS by class", dashboard: {} },
      { href: "/instagram-politics", label: "Politics on Instagram", blurb: "BJP, Congress, AAP and the CJP: followers, engagement and comment sentiment, every figure sourced", dashboard: {} },
      { href: "/live", label: "Live", blurb: "Markets, the rupee, military aircraft and the news, refreshed while you watch", dashboard: {} },
      { href: "/stories", label: "Visual stories", blurb: "Short, data-led arguments — semiconductors, defence, farming" },
      { href: "/growth", label: "Growth", blurb: "Digital payments, literacy, space, defence industry" },
      { href: "/growth-100", label: "A hundred indicators", blurb: "India across a hundred series, whichever way they point" },
      { href: "/ai", label: "AI", blurb: "What Indian labs have published, and the frontier record beside it" },
      { href: "/everyday", label: "Everyday", blurb: "A hundred numbers anyone can read" },
      { href: "/schemes", label: "Welfare schemes", blurb: "Ninety-six central schemes, and what they publish" },
      { href: "/made-in-india", label: "Made in India", blurb: "What is actually built here, by product" },
      { href: "/defence-tracker", label: "Defence", blurb: "Exports, production, corridors, insurgency" },
      { href: "/deals", label: "Defence deals", blurb: "Contracts, clearances and what each one actually is" },
      { href: "/mobility", label: "Mobility", blurb: "Rail, metro, highways, airports" },
      { href: "/statewise", label: "Transport by state", blurb: "What exists where, and what could not be sourced" },
      { href: "/atlas", label: "Atlas", blurb: "The statewise picture" },
      { href: "/sacred", label: "Sacred landscape", blurb: "Temples, deities, heritage and place-names" },
      { href: "/disputed", label: "A disputed list", blurb: "One contested 1990 catalogue, read as a claim" },
      { href: "/map", label: "Map", blurb: "Corridors and the highway timelapse" },
    ],
  },
  {
    id: "elections",
    label: "Elections",
    items: [
      { href: "/elections", label: "Overview", blurb: "Who governs, every result and the roll revision, on one page" },
      { href: "/elections/atlas", label: "Election atlas", blurb: "India by who governs; every state opens seat by seat" },
      { href: "/elections/lok-sabha-2024", label: "Lok Sabha 2024", blurb: "All 543 seats: the chamber, seats against votes, every state" },
      { href: "/elections/assemblies", label: "Assemblies", blurb: "Every state assembly as it was elected, against the majority line" },
      { href: "/elections/electorate", label: "Electorate", blurb: "The roll by gender; religion, SC and ST by district (Census 2011)" },
      { href: "/elections/sir", label: "Roll revision (SIR)", blurb: "Names left off draft rolls, by the reason given" },
      { href: "/elections/turnout", label: "Turnout", blurb: "Turnout and electors by state, 2014 to 2024" },
    ],
  },
  {
    id: "world",
    label: "The world",
    items: [
      { href: "/france-riots", label: "France riots, live", blurb: "October 2026: headlines, newsroom video, officials' figures and government notices, every minute", dashboard: {} },
      { href: "/world", label: "World tracker", blurb: "Every Our World in Data indicator, mapped one at a time" },
      { href: "/global", label: "Global economy", blurb: "India against the economies it is compared with" },
      { href: "/arsenal", label: "Arsenal", blurb: "Missiles by nation, and who is buying what" },
      { href: "/drones", label: "Military drones", blurb: "Who flies what, and which producer reaches furthest" },
      { href: "/airpower", label: "Airpower", blurb: "Airfields, catalogued fleets, and the sliver of military flying that is visible" },
      { href: "/satellites", label: "Satellites, live", blurb: "Where a thousand satellites are this second, India's fleet among them" },
      { href: "/military-ai", label: "Military AI", blurb: "A live register of AI, autonomy and drone reporting — and its English-language bias" },
      { href: "/sindoor", label: "Operation Sindoor", blurb: "Two incompatible accounts of one week, kept apart rather than merged" },
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

const hrefsOf = (i: Item) => [i.href, ...(i.dashboard?.parts ?? []).map((p) => p.href)];

/** The "Dashboard" tag: outlined, so it never competes with the filled "New" marker beside it. */
function DashTag() {
  return (
    <span
      className="ml-1.5 inline-flex shrink-0 items-center rounded-[3px] border px-1 py-px align-middle text-[9px] font-semibold uppercase leading-[1.35] tracking-[0.08em]"
      style={{ borderColor: "var(--series-1)", color: "var(--series-1)" }}
    >
      Dashboard
    </span>
  );
}

/** One dashboard in a menu: the section's own link, then its sub-pages. Links side by side, never nested. */
function DashboardEntry({ it, pathname, compact }: { it: Item; pathname: string | null; compact?: boolean }) {
  const here = hrefsOf(it).includes(pathname ?? "");
  return (
    <div
      className="border-b border-[color:var(--hairline)]"
      style={{ boxShadow: "inset 3px 0 0 var(--series-1)", background: here ? "var(--surface-2)" : undefined }}
    >
      <Link href={it.href} role="menuitem" className="flex flex-col px-3.5 pt-2 transition-colors hover:bg-[var(--surface-2)]">
        <span className="text-[12.5px] font-semibold leading-snug">
          {it.label}
          <DashTag />
          <NewBadge href={it.href} />
        </span>
        {!compact && <span className="text-[11px] leading-snug text-[color:var(--text-muted)]">{it.blurb}</span>}
      </Link>
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-3.5 pb-2 pt-1">
        {(it.dashboard?.parts ?? []).map((p) => (
          <Link key={p.href} href={p.href} role="menuitem" className="text-[11px] font-medium underline decoration-dotted underline-offset-2"
            style={{ color: pathname === p.href ? "var(--text-primary)" : "var(--series-1)" }}>
            {p.label} →
          </Link>
        ))}
      </div>
    </div>
  );
}

/** A group's items: its dashboards in a block of their own, then everything else. */
function split(g: Group) {
  return { dash: g.items.filter((i) => i.dashboard), rest: g.items.filter((i) => !i.dashboard) };
}

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

  // A section is active on its own pages and anything under them (a state's atlas page lights Elections).
  const activeGroup = GROUPS.find((g) => g.items.some((i) => hrefsOf(i).some((h) => h === pathname || (pathname ?? "").startsWith(`${h}/`))))?.id;

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
                  {split(g).dash.map((it) => <DashboardEntry key={it.href} it={it} pathname={pathname} compact />)}
                  {split(g).rest.map((it) => (
                    <Link
                      key={it.href}
                      href={it.href}
                      role="menuitem"
                      className="block border-b border-[color:var(--hairline)] px-3.5 py-2 text-[12.5px] font-medium"
                      style={{ background: pathname === it.href ? "var(--surface-2)" : undefined }}
                    >
                      {it.label}
                      <NewBadge href={it.href} />
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
                    className={`absolute right-0 top-[calc(100%+6px)] z-50 max-h-[calc(100vh-5rem)] overflow-y-auto rounded-lg border border-[color:var(--gridline)] bg-[var(--surface-1)] shadow-lg ${split(g).dash.length ? "w-[21rem]" : "w-[17.5rem]"}`}
                    role="menu"
                  >
                    {split(g).dash.length > 0 && (
                      <>
                        <p className="eyebrow border-b border-[color:var(--hairline)] px-3.5 py-1.5" style={{ color: "var(--series-1)" }}>Dashboards</p>
                        {split(g).dash.map((it) => <DashboardEntry key={it.href} it={it} pathname={pathname} />)}
                        <p className="eyebrow border-b border-[color:var(--hairline)] bg-[var(--surface-2)] px-3.5 py-1.5">More on {g.label}</p>
                      </>
                    )}
                    {split(g).rest.map((it) => (
                      <Link
                        key={it.href}
                        href={it.href}
                        role="menuitem"
                        className="flex flex-col border-b border-[color:var(--hairline)] px-3.5 py-2 transition-colors last:border-b-0 hover:bg-[var(--surface-2)]"
                        style={{
                          background: pathname === it.href ? "var(--surface-2)" : undefined,
                        }}
                      >
                        <span className="text-[12.5px] font-medium leading-snug">
                          {it.label}
                          <NewBadge href={it.href} />
                        </span>
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
