import { readFileSync } from "node:fs";
import { join } from "node:path";
import FranceLive from "@/components/france/FranceLive";
import { Eyebrow, Standfirst } from "@/components/stories/Kit";
import { franceOutline } from "@/lib/france-outline";
import { FRANCE_RIOTS } from "@/lib/sources";
import type { FranceLivePayload, FranceRegister } from "@/lib/france-riots-shared";

/**
 * France's October 2026 riots, tracked live. The page is built from the
 * scheduled job's last register so it reads without JavaScript; the live
 * component then asks /api/france-riots every minute.
 */

export const metadata = {
  title: "France riots, live: reports, videos and official statements · Bharat Tracker",
  description: "A live tracker of the October 2026 riots in France: headlines in French and English, newsroom videos, officials' figures quoted from reporting, coverage by hour and by place, government announcements and travel advice — refreshed every minute.",
};

/** The reporting the background sentence rests on; the tracker below carries the rest. */
const BACKGROUND = [
  { outlet: "CNN", url: "https://www.cnn.com/2026/10/17/europe/half-million-protesters-sweep-france-in-youth-unrest-latam-intl" },
  { outlet: "Al Jazeera", url: "https://www.aljazeera.com/news/2026/10/17/france-wave-of-nationwide-protests" },
  { outlet: "NPR", url: "https://www.npr.org/2026/10/17/nx-s1-6006773/student-protests-france" },
  { outlet: "France 24", url: "https://www.france24.com/en/france/20261017-live-france-s-yellow-vests-throw-their-weight-behind-mounting-student-protests" },
];

export default function FranceRiotsPage() {
  let reg: FranceRegister | null = null;
  try { reg = JSON.parse(readFileSync(join(process.cwd(), "data", "france-riots", "register.json"), "utf8")) as FranceRegister; } catch { reg = null; }
  const initial: FranceLivePayload = {
    fetchedAt: reg?.updatedAt ?? new Date(0).toISOString(),
    headlines: reg?.headlines ?? [], videos: reg?.videos ?? [], advisories: reg?.advisories ?? [],
    register: reg, registerFrom: reg ? "deployment" : "none", status: reg?.status ?? [],
  };

  return (
    <article className="pt-6">
      <Eyebrow tone="hot">Live · France · October 2026</Eyebrow>
      <h1 className="story-display mt-3 max-w-[22ch] text-[32px] sm:text-[44px]">France&apos;s riots, as they are reported</h1>
      <Standfirst>
        Protests over the cost of living and public spending, led by students since early October, turned to rioting, arson and looting in several French cities on
        Saturday 17 October 2026, according to reporting by{" "}
        {BACKGROUND.map((b, i) => <span key={b.url}>{i ? (i === BACKGROUND.length - 1 ? " and " : ", ") : ""}<a className="underline decoration-dotted" href={b.url} target="_blank" rel="noopener noreferrer">{b.outlet}</a></span>)}.
        This page opens on Friday 16 to Sunday 18 October, with a lens for Paris and the Île-de-France, and gathers what was and is being published: the reporting hour by hour,
        posts on X that newsrooms embedded, newsroom video, what officials say and government notices. It refreshes itself every minute.
      </Standfirst>

      <FranceLive initial={initial} outline={franceOutline()} focus={FRANCE_RIOTS.focus} />

      <section className="mt-14 border-t pt-8" style={{ borderColor: "var(--story-rule)" }}>
        <Eyebrow>What this tracker is, and is not</Eyebrow>
        <ul className="mt-3 max-w-[74ch] list-disc space-y-1.5 pl-5 text-[13px] leading-[1.6]" style={{ color: "var(--story-ink-2)" }}>
          <li><b>Everything here is a report.</b> Figures are shown as the sentence an article printed, with who gave them. They are not checked, totalled or charted as fact; police, ministry and organisers routinely count differently, and counts change through a night.</li>
          <li><b>Two speeds.</b> Headlines, newsroom videos and the UK&apos;s travel advice are asked for every minute while the page is open. GDELT&apos;s index, quoted figures, the Interior Ministry&apos;s press page and X are read by a job every twenty minutes, which also keeps everything it has seen so the record outlasts each source&apos;s short memory.</li>
          <li><b>No private individuals.</b> Posts on X are searched only from institutions, public officials and newsrooms, and the site stores their ids, never their text; the post itself comes from X when you ask to see it. Videos are newsrooms&apos; own.</li>
          <li><b>Coverage is not violence.</b> The hourly pulse and the map measure how much is written and which places are named, not what happened where.</li>
          <li><b>A source that stops answering says so</b> in the list of sources, rather than being replaced by an older figure.</li>
        </ul>
      </section>
    </article>
  );
}
