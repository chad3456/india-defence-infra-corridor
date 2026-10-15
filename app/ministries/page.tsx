import Link from "next/link";
import { loadTrade, loadMha, fiscalYears } from "@/lib/ministry";
import { Eyebrow, Standfirst, Stat } from "@/components/stories/Kit";
import { MinistryTabs } from "@/components/ministry/Tabs";

export const metadata = {
  title: "Ministries, from their own documents · Bharat Tracker",
  description: "The Commerce Ministry's monthly trade releases and the Home Ministry's monthly reports, pinned in the repository and read into charts — every figure checked against the document it came from.",
};

export default function MinistriesPage() {
  const t = loadTrade();
  const m = loadMha();
  const fy = fiscalYears(t, "total-exports").at(-1);
  return (
    <article className="pt-6">
      <MinistryTabs active="overview" />
      <Eyebrow tone="hot">Ministries · from their own documents</Eyebrow>
      <h1 className="story-display mt-3 max-w-[22ch] text-[32px] sm:text-[44px]">What two ministries publish, read into data</h1>
      <Standfirst>
        Each month the Department of Commerce releases India&apos;s trade figures and the Ministry of Home Affairs publishes its major achievements.
        Every one of those documents this site could find is downloaded, kept in the repository with its checksum, converted to text and read by rules
        that are published beside the code. A figure is drawn only after it has been found again in the document&apos;s own words.
      </Standfirst>
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <Link href="/ministries/commerce" className="block">
          <Stat size="md" tone="hot" label="Commerce · trade releases" value={String(t.releases.length)} unit="releases"
            note={<>{t.verified.length} figures checked{fy ? <>; total exports in FY {fy.fy}: ${fy.v.toFixed(0)} bn</> : null}. Open the trade dashboard →</>} />
        </Link>
        <Link href="/ministries/home-affairs" className="block">
          <Stat size="md" label="Home Affairs · monthly reports" value={String(m.docs.length)} unit="reports"
            note={<>{m.byMonth[0]?.m} to {m.byMonth.at(-1)?.m}; {m.docs.filter((d) => d.ocr).length} were scans, read by OCR. Open the reports dashboard →</>} />
        </Link>
      </div>
    </article>
  );
}
