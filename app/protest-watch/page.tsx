import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Eyebrow, Standfirst, WhatThisCannotSay } from "@/components/stories/Kit";
import { ProtestWatch } from "@/components/protest-watch/ProtestWatch";
import { summarise, type PwRegister } from "@/lib/protest-watch";
import { PW_MAP_H, PW_MAP_W, protestGeo } from "@/lib/protest-watch-geo";

/**
 * Protest Watch: protests worldwide, live, every cause measured by the same
 * rules. The page renders from the committed register so it reads without
 * JavaScript; the dashboard then asks /api/protest-watch every minute.
 */

export const metadata = {
  title: "Protest Watch: protests worldwide, live, every cause by the same rules · Bharat Tracker",
  description: "A live tracker of protests worldwide from news in 12 languages and 25 editions: where, for what cause, how covered, and what was reported — arrests, injuries, deaths, damage — with every cause, Palestine included, measured by the same rules and every figure linked to its report.",
};

export const revalidate = 300;

export default function ProtestWatchPage() {
  let reg: PwRegister | null = null;
  try { reg = JSON.parse(readFileSync(join(process.cwd(), "data", "protest-watch", "register.json"), "utf8")) as PwRegister; } catch { reg = null; }
  const { countries, shapes } = protestGeo();
  const initial = {
    fetchedAt: reg?.updatedAt ?? new Date(0).toISOString(), registerAt: reg?.updatedAt ?? null, registerFrom: "deployment", status: reg?.status ?? [], pulse: reg?.pulse ?? [],
    ...summarise(reg?.headlines ?? [], countries, 24, reg ? Date.parse(reg.updatedAt) : Date.now()),
  };
  const points = Object.fromEntries(countries.map((c) => [c.iso2, { name: c.name, x: c.x, y: c.y }]));
  // Figures the verifier agent has checked against independent sources (.claude/agents/protest-watch-verifier.md).
  type Verified = { eventId: string; cause: string; country: string | null; day: string; verdict: "confirmed" | "revised" | "disputed" | "unconfirmed"; headlineFigure: Record<string, number | null>; verifiedFigure: Record<string, number | null> | null; sources: Array<{ publisher: string; url: string }>; note?: string };
  let verified: Verified[] = [];
  try { verified = JSON.parse(readFileSync(join(process.cwd(), "data", "protest-watch", "verified.json"), "utf8")) as Verified[]; } catch { verified = []; }
  const fig = (f: Record<string, number | null> | null) => (f ? [f.deaths ? `${f.deaths} dead` : "", f.injured ? `${f.injured} injured` : "", f.arrested ? `${f.arrested} arrested` : ""].filter(Boolean).join(" · ") : "—");

  return (
    <article className="pt-6">
      <Eyebrow tone="hot">World · Live · Every cause, the same rules</Eyebrow>
      <h1 className="story-display mt-3 max-w-[18ch] text-[34px] sm:text-[52px]">Protest Watch</h1>
      <Standfirst>
        Every protest the news reports, worldwide, refreshed every minute: where it was, what it was about, how much coverage it drew, and what the reports say happened
        — arrests, injuries, deaths, damage. Palestine and Gaza protests are measured exactly as every other cause is, so any one can be compared with all the rest.
        The tracker counts what was reported; it does not judge why anyone marched.
      </Standfirst>

      <div className="mt-6"><ProtestWatch initial={initial} map={{ w: PW_MAP_W, h: PW_MAP_H, shapes, points }} /></div>

      <section className="mt-12">
        <Eyebrow>Checked by hand</Eyebrow>
        <h2 className="story-display mt-2 text-[24px] sm:text-[30px]">The largest figures, verified</h2>
        <p className="mt-1 max-w-[76ch] text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-3)" }}>The biggest reported losses — chosen by size, never by cause — checked against two independent sources by a verification agent with one standard for every cause.</p>
        {verified.length ? (
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {verified.slice(-20).reverse().map((v) => (
              <li key={v.eventId} className="story-card p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.05em]" style={{ color: v.verdict === "confirmed" ? "var(--s-cool)" : v.verdict === "unconfirmed" ? "var(--story-ink-3)" : "var(--s-hot)" }}>{v.verdict} · {v.cause} · {v.country ?? "place not named"} · {v.day}</p>
                <p className="mt-1 text-[12.5px]">Headline: <b>{fig(v.headlineFigure)}</b>{v.verifiedFigure ? <> · verified: <b>{fig(v.verifiedFigure)}</b></> : null}</p>
                {v.note && <p className="mt-1 text-[12px]" style={{ color: "var(--story-ink-2)" }}>{v.note}</p>}
                <p className="mt-1 text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>{v.sources.map((s, i) => <span key={s.url}>{i ? " · " : ""}<a className="underline decoration-dotted" href={s.url} target="_blank" rel="noopener noreferrer">{s.publisher}</a></span>)}</p>
              </li>
            ))}
          </ul>
        ) : <div className="story-card mt-3 p-4 text-[12.5px]" style={{ color: "var(--story-ink-3)" }}>No figures verified yet. The verifier runs on request; until it does, every number above is a headline&apos;s, unverified.</div>}
      </section>

      <section className="mt-12 grid gap-3 md:grid-cols-3">
        {[
          { h: "How it collects", b: "Every 30 minutes, a job searches Google News in 25 national editions and 12 languages for protest words only — never for a cause — and reads GDELT's coverage pulse. The page adds the past hour from six editions on every refresh." },
          { h: "How it sorts", b: "One set of keyword rules gives each headline a cause, a country (from a city or country it names, never from the cause itself) and any losses it ties to the protest. Headlines about one cause, in one country, on one day form an event." },
          { h: "How it stays fair", b: "The same rules for every cause; an event's figure is the largest any report gave, not a sum; deaths a protest is about (a war, a raid) are never counted as deaths at the protest; anything unplaceable stays unplaced." },
        ].map((x) => <div key={x.h} className="story-card p-4"><p className="text-[14px] font-bold">{x.h}</p><p className="mt-1.5 text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-2)" }}>{x.b}</p></div>)}
      </section>

      <WhatThisCannotSay items={[
        { q: "Which protests are performative?", a: "No feed can measure motive. The tracker shows what can be counted for every cause alike — events, places, coverage per event, outcomes — so a reader can compare causes on the record rather than on an impression." },
        { q: "Are these numbers true?", a: "They are what headlines reported, linked, and not verified; first reports are often revised. Where an official count exists elsewhere on this site — the France riots tracker, the protest and public-order record — it supersedes these." },
        { q: "Is every protest here?", a: "Only those the news covers, in the languages searched. Small protests, and countries whose press is not in Google News, are under-counted; heavily covered causes appear as more headlines per event, which the table shows as coverage." },
        { q: "Why do some causes look more violent?", a: "Violence is newsworthy, so peaceful events are under-reported everywhere. Compare causes with each other, not with zero." },
      ]} />
    </article>
  );
}
