import Link from "next/link";

const TABS = [
  { id: "overview", href: "/ministries", label: "Overview" },
  { id: "commerce", href: "/ministries/commerce", label: "Commerce: trade" },
  { id: "home", href: "/ministries/home-affairs", label: "Home Affairs: monthly reports" },
];

/** The section's tab strip; the page says which tab it is. */
export function MinistryTabs({ active }: { active: string }) {
  return (
    <nav aria-label="Ministries" className="mb-6 flex flex-wrap gap-2 text-[12.5px]">
      {TABS.map((t) => (
        <Link key={t.id} href={t.href} aria-current={t.id === active ? "page" : undefined} className="story-card px-3 py-1.5"
          style={{ borderRadius: 999, fontWeight: t.id === active ? 700 : 500, outline: t.id === active ? "2px solid var(--s-hot)" : undefined }}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
