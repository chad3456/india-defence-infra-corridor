import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { Eyebrow, Standfirst } from "@/components/stories/Kit";
import { Awaiting, Bars, Dumbbell, Paired, Panel, SourceLine, Split, Timeline, colourOf, fmt, signed } from "@/components/instagram/Charts";
import {
  ACCOUNTS, NEGATIVE_GROUPS, WINDOWS, followerFlags, groupThemes, inRange, nameOf, partyOf, pctChange, perThousand, ratioOutliers, summarise, topicsOf, weekly, TOPICS,
  type InstagramRegister, type Published, type PublishedSource,
} from "@/lib/instagram";

/**
 * Indian politics on Instagram: what the published record says about the BJP,
 * Congress, AAP and the Cockroach Janta Party, and what the site measures
 * itself once Meta's Graph API is connected. Every published number names its
 * source; every measured one says how it was computed.
 */

export const metadata = {
  title: "Politics on Instagram: BJP, Congress, AAP and the CJP · Bharat Tracker",
  description: "Twenty dashboards on Indian politics on Instagram — followers, engagement per post, the CJP from its launch to the CEC protest, comment sentiment as published, and the claims about bots — every figure sourced, every claim checked against its own chart.",
};

const load = <T,>(f: string): T | null => { try { return JSON.parse(readFileSync(join(process.cwd(), "data", "instagram", f), "utf8")) as T; } catch { return null; } };
/** A date as precise as the source gives it: "2026-05" is May 2026, not the 1st of May. */
const dmy = (d: string | null) => (!d ? "undated" : new Date(d.length === 7 ? `${d}-01` : d).toLocaleDateString("en-GB", { ...(d.length === 7 ? {} : { day: "numeric" }), month: "short", year: "numeric", timeZone: "UTC" }));

export default function InstagramPoliticsPage() {
  const pub = load<Published>("published.json")!;
  const reg = load<InstagramRegister>("register.json");
  const src = (id: string): PublishedSource => pub.sources.find((s) => s.id === id)!;
  const line = (...ids: string[]) => <SourceLine items={[...new Set(ids)].map((id) => { const s = src(id); return { publisher: s.publisher, url: s.url, date: s.published ? dmy(s.published) : null, pending: s.pending }; })} />;
  const S = pub.cjpStudy;

  // Latest dated follower figure per account, and every figure for CJP in date order.
  const latest = (handle: string) => [...pub.followers.filter((f) => f.account === handle)].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0];
  const parties = ["incindia", "bjp4india", "cockroachjantaparty", "aamaadmiparty"];
  const cjpLine = pub.followers.filter((f) => f.account === "cockroachjantaparty" && f.date).sort((a, b) => a.date!.localeCompare(b.date!) || a.value - b.value);
  const may21 = pub.followers.filter((f) => f.date === "2026-05-21" && f.source === (f.account === "aamaadmiparty" ? "kashmirlife-cjp" : "bt-cjp-most-followed"));
  const ig = S.engagement.find((e) => e.platform === "instagram" && e.account === "cockroachjantaparty")!;
  const x = S.engagement.find((e) => e.platform === "x")!;
  const dipke = S.engagement.find((e) => e.account === "abhijeetdipke")!;
  const bora = S.engagement.find((e) => e.account === "nehabora")!;
  const sent = (p: "instagram" | "x", w: "neet" | "cec") => S.sentiment.find((s) => s.platform === p && s.window === w)!;
  const themeRows = (side: "positive" | "negative") => {
    // The study words some themes differently in each window; these are the same theme.
    const norm = (l: string) => {
      const k = l.toLowerCase().replace(/\(.*?\)/g, "").replace(/in support of/, "supports").replace(/critical of/, "against").replace(/supporting/, "supports").replace(/^for police$/, "supports police").replace(/ and /, " / ").replace(/against andhbhakts/, "against bjp supporters").split(" / ")[0]!.trim();
      return k;
    };
    const a = S.themes.neet[side], b = S.themes.cec[side];
    const keys = [...new Set([...a, ...b].map(([l]) => norm(l)))];
    return keys.map((k) => {
      const ra = a.find(([l]) => norm(l) === k), rb = b.find(([l]) => norm(l) === k);
      return { label: (rb ?? ra)![0], a: ra ? ra[1] : null, b: rb ? rb[1] : null };
    }).sort((p, q) => (q.b ?? 0) + (q.a ?? 0) - (p.b ?? 0) - (p.a ?? 0));
  };
  const grouped = { neet: groupThemes(S.themes.neet.negative, NEGATIVE_GROUPS), cec: groupThemes(S.themes.cec.negative, NEGATIVE_GROUPS) };

  // Measured: what the Graph API job has stored.
  const accts = ACCOUNTS.map((a) => ({ a, rec: reg?.accounts?.[a.handle] })).filter((r) => r.rec?.ok);
  const measured = reg?.active && accts.length > 0;
  const today = reg?.updatedAt?.slice(0, 10) ?? "";
  const monthAgo = today ? new Date(Date.parse(today) - 30 * 86_400_000).toISOString().slice(0, 10) : "";
  const awaiting = (what: ReactNode) => <Awaiting>{what} {reg?.reason ?? "The scheduled job has not run yet."}</Awaiting>;

  const nav: Array<[number, string]> = [[1, "Followers"], [5, "After 20 July"], [7, "The CJP study"], [10, "Sentiment"], [14, "Claims checked"], [15, "Bots & origin"], [17, "Measured"]];

  return (
    <article className="pt-6">
      <Eyebrow tone="hot">India · Instagram · April–October 2026</Eyebrow>
      <h1 className="story-display mt-3 max-w-[24ch] text-[32px] sm:text-[44px]">Indian politics on Instagram, by the numbers</h1>
      <Standfirst>
        How the BJP, Congress, AAP and the Cockroach Janta Party fare on Instagram, measured by what can actually be counted: followers, posts, likes and comments. Twenty
        dashboards, from the CJP&apos;s launch in May to its protest against the Chief Election Commissioner in October. Published figures name their source and the
        sentence they were read from. Comment sentiment is a published study&apos;s, credited to it and checked against its own charts. Nothing here is a poll: engagement measures attention, which outrage earns as readily as approval.
      </Standfirst>

      <nav aria-label="On this page" className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
        {nav.map(([n, l]) => <a key={n} href={`#d${n}`} className="underline decoration-dotted underline-offset-2">{l}</a>)}
        <a href="#reading" className="underline decoration-dotted underline-offset-2">Reading the record</a>
        <a href="#method" className="underline decoration-dotted underline-offset-2">How it is measured</a>
      </nav>

      <ol className="mt-6 grid gap-2 border-l-2 pl-4 text-[12.5px] leading-[1.5] sm:grid-cols-2" style={{ borderColor: "var(--story-rule)" }}>
        {pub.context.map((c) => (
          <li key={c.date + c.text}><span className="mono text-[11px] font-bold">{dmy(c.date)}</span> — {c.text} <a className="underline decoration-dotted text-[11px]" style={{ color: "var(--story-ink-3)" }} href={src(c.source).url} target="_blank" rel="noopener noreferrer">{src(c.source).publisher}</a></li>
        ))}
      </ol>

      <h2 className="story-display mt-12 text-[24px]">Followers</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel n={1} title="The four party accounts, latest published count" kind="published"
          note={<>Each bar is the newest count anyone published, with its date: they are not from the same day. The CJP&apos;s is from October; the others are from May, when the CJP overtook them, or an undated tracker snapshot.</>}
          source={line(...parties.map((h) => latest(h)!.source))}>
          <Bars rows={parties.map((h) => { const f = latest(h)!; return { label: nameOf(h), value: f.value, colour: colourOf(partyOf(h)), sub: `@${h} · ${dmy(f.date)}${f.confidence === "low" ? " · low confidence" : ""}`, tip: `"${f.quote}"` }; })} />
        </Panel>

        <Panel n={2} title="The CJP, from launch to 25 million" kind="published"
          note={<>Every count published since the account opened in mid-May. It passed 9 million in four days and 22 million in a week, then grew slowly; the tracker&apos;s 9 October count shows it losing about 474,000 followers in the preceding 30 days. Gaps between points are months nobody published a figure for, not a smooth line of growth.</>}
          source={line(...cjpLine.map((f) => f.source))}>
          <Timeline colour={colourOf("CJP")} points={cjpLine.map((f, i) => ({ d: f.date!, v: f.value, label: i === 0 || i === cjpLine.length - 1 || f.value === 22000000 ? fmt(f.value) : undefined, tip: `${dmy(f.date)}: ${fmt(f.value)} — ${src(f.source).publisher}: "${f.quote}"` }))} />
        </Panel>

        <Panel n={3} title="21 May: the day the CJP overtook the parties" kind="published"
          note={<>The one day for which the four accounts were counted together. A week-old satire account passed a party with a decade on the platform. Kashmir Life counted 13.2 million for Congress and 8.7 million for the BJP the same day.</>}
          source={line("bt-cjp-most-followed", "kashmirlife-cjp")}>
          <Bars rows={may21.sort((a, b) => b.value - a.value).map((f) => ({ label: nameOf(f.account), value: f.value, colour: colourOf(partyOf(f.account)), sub: src(f.source).publisher }))} />
        </Panel>

        <Panel n={4} title="Leaders: personal accounts dwarf party handles" kind="published"
          note={<>Narendra Modi&apos;s account has more than ten times the BJP&apos;s followers, and Rahul Gandhi&apos;s about as many as Congress&apos;s. Raghav Chadha lost 1.1 million followers within 24 hours of leaving AAP for the BJP in April. Follower bases are partisan, and they move with the politics.</>}
          source={line("stackumbrella-rahul", "hypeauditor-kejriwal", "keralakaumudi-chadha")}>
          <Bars rows={["narendramodi", "rahulgandhi", "raghavchadha", "arvindkejriwal"].map((h) => { const f = latest(h)!; return { label: nameOf(h), value: f.value, colour: colourOf(partyOf(h)), sub: `${dmy(f.date)}${h === "raghavchadha" ? " · after leaving AAP (was 14.6M)" : ""}${f.confidence === "low" ? " · low confidence" : ""}`, tip: `"${f.quote}"` }; })} />
        </Panel>
      </div>

      <h2 className="story-display mt-12 text-[24px]">After 20 July: who gained attention</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel n={5} title="Average engagement per post, before and after 20 July" kind="published"
          note={<>Data Beings split each account&apos;s posts at the CJP&apos;s 20 July march to Parliament. Every account gained; the leaders far more than the parties. Modi&apos;s 23 July video drew {fmt(pub.engagementBeforeAfterJuly20.highlight.likes)} likes and {fmt(pub.engagementBeforeAfterJuly20.highlight.shares)} shares on its own.</>}
          source={<>{line("bt-databeings-modi", "sundayguardian-genz")} Business Today&apos;s sentence calls the party figures &ldquo;followers&rdquo;; a party with 13 million followers cannot have 50,000, so they are read as engagement per post.</>}>
          <Dumbbell fromLabel="Before 20 July" toLabel="After 20 July" rows={pub.engagementBeforeAfterJuly20.rows.map((r) => ({ label: nameOf(r.account), from: r.before, to: r.after, colour: colourOf(partyOf(r.account)), sub: `@${r.account}` }))} />
        </Panel>

        <Panel n={6} title="The rise, in absolute terms" kind="derived"
          note={<>Percentages flatter small bases. Added engagement per post: Modi gained 3.44 million, Rahul Gandhi 274,000, Congress 22,000, the BJP 9,000. The attention the CJP&apos;s protests generated went overwhelmingly to the Prime Minister&apos;s account. Computed from the figures in dashboard 5.</>}
          source={line("bt-databeings-modi")}>
          <Bars rows={pub.engagementBeforeAfterJuly20.rows.map((r) => ({ label: nameOf(r.account), value: r.after - r.before, colour: colourOf(partyOf(r.account)), sub: `${signed(r.changePct)} on ${fmt(r.before)} a post` }))} />
        </Panel>
      </div>

      <h2 className="story-display mt-12 text-[24px]">The CJP: NEET protest (July) against CEC protest (25 Sep – 14 Oct)</h2>
      <p className="mt-2 max-w-[74ch] text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-3)" }}>
        Dashboards 7–13 are Data Beings&apos; study, transcribed from its chart images; the post they come from has not been located, and the numbers will be re-checked against it when it is.
        Sentiment is classified from {S.sample.toLowerCase()}
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel n={7} title="CJP's engagement per post: down on Instagram, up on X" kind="published"
          note={<>On Instagram, average engagement per post fell 58%, from 882,459 to 371,201. On X it rose 25%. The CJP&apos;s X account was withheld in India in May, and the Delhi High Court declined to order it restored; X readers are therefore not the same audience as Instagram&apos;s.</>}
          source={line(S.source)}>
          <Dumbbell fromLabel={S.windows.neet} toLabel={S.windows.cec} rows={[{ label: "Instagram", from: ig.neet, to: ig.cec, colour: colourOf("CJP"), sub: "@cockroachjantaparty" }, { label: "X", from: x.neet, to: x.cec, colour: "var(--story-ink-3)", sub: "CJP's X handle" }]} />
        </Panel>

        <Panel n={8} title="How much the CJP posted" kind="published"
          note={<>Posts in each window. The CEC window is three weeks, July is a month, and the CJP posted 60% fewer times on Instagram. Fewer posts at a time of less attention: average engagement per post and volume fell together.</>}
          source={line(S.source)}>
          <Bars rows={[{ label: "Instagram, July", value: ig.postsNeet!, colour: colourOf("CJP") }, { label: "Instagram, CEC", value: ig.postsCec!, colour: colourOf("CJP") }, { label: "X, July", value: x.postsNeet!, colour: "var(--story-ink-3)" }, { label: "X, CEC", value: x.postsCec!, colour: "var(--story-ink-3)" }]} />
        </Panel>

        <Panel n={9} title="The founder and the ally: Dipke against Neha Bora" kind="published"
          note={<>Abhijeet Dipke&apos;s engagement per post fell 58%; AISA president Neha Bora&apos;s rose 132% — she was detained at the 2 October Jantar Mantar protest. A protest against the Election Commission drew in established student and party organisations, and their figures gained the attention.</>}
          source={line(S.source, "theweek-oct2")}>
          <Dumbbell fromLabel={S.windows.neet} toLabel={S.windows.cec} rows={[{ label: "Abhijeet Dipke", from: dipke.neet, to: dipke.cec, colour: colourOf("CJP"), sub: "CJP founder" }, { label: "Neha Bora", from: bora.neet, to: bora.cec, colour: colourOf("AISA"), sub: "AISA president" }]} />
        </Panel>

        <Panel n={10} title="Comment sentiment: steady on Instagram, souring on X" kind="published"
          note={<>On Instagram, three in four classified comments stayed positive in both windows (77% to 75%). On X, positive comments fell from a third to a sixth. The CJP keeps its Instagram audience&apos;s goodwill; X, where its account was withheld in India in May, is hostile and growing more so.</>}
          source={line(S.source)}>
          <Split rows={[
            { label: "Instagram · July", a: sent("instagram", "neet").positive, b: sent("instagram", "neet").negative },
            { label: "Instagram · CEC", a: sent("instagram", "cec").positive, b: sent("instagram", "cec").negative },
            { label: "X · July", a: sent("x", "neet").positive, b: sent("x", "neet").negative },
            { label: "X · CEC", a: sent("x", "cec").positive, b: sent("x", "cec").negative },
          ]} />
        </Panel>

        <Panel n={11} title="What the positive comments said" kind="published"
          note={<>Plain support for the CJP fell from 57% of positive comments to 41%, while comments against the Chief Election Commissioner and &ldquo;vote chori&rdquo; — a theme the CEC protest itself raised — took 22%. Supporters followed the issue more than the party.</>}
          source={line(S.source)}>
          <Paired colour="var(--s-cool)" aLabel="July (NEET)" bLabel="25 Sep – 14 Oct (CEC)" rows={themeRows("positive").slice(0, 12)} />
        </Panel>

        <Panel n={12} title="What the negative comments said" kind="published"
          note={<>About half of negative comments in both windows are general criticism. New in October: 6.1% back the Election Commission, and 1.6% call the CJP a front for Congress, beside 3.2% who say AAP. Personal attacks on Dipke fell slightly, from 10.2% to 9.1%.</>}
          source={line(S.source)}>
          <Paired colour="var(--s-hot)" aLabel="July (NEET)" bLabel="25 Sep – 14 Oct (CEC)" rows={themeRows("negative").slice(0, 13)} />
        </Panel>

        <Panel n={13} title="Negative comments, grouped by what they attack" kind="derived"
          note={<>The study&apos;s categories grouped: attacks on the CJP&apos;s credibility (flop, fake, paid, a party&apos;s front), on its loyalty (anti-national, a Pakistani agent), on its founder, and comments for the other side. Credibility and loyalty attacks did not grow; support for the government, police and Election Commission did.</>}
          source={line(S.source)}>
          <Paired colour="var(--s-hot)" aLabel="July (NEET)" bLabel="25 Sep – 14 Oct (CEC)" rows={grouped.neet.map((g, i) => ({ label: g.group, a: g.share, b: grouped.cec[i]!.share }))} />
        </Panel>
      </div>

      <h2 className="story-display mt-12 text-[24px]">Checking the claims, and the bot question</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel n={14} title="The ‘credibility crisis’ claims, checked against the charts they cite" kind="derived"
          note={<>A widely shared reading of the Data Beings charts argues the CJP is losing public goodwill. Each of its numbers is recomputed here from the charts themselves. Four hold; three do not.</>}
          source={line(S.source)}>
          <ul className="space-y-2 text-[12px] leading-[1.5]">
            {S.claimsInCirculation.map((c) => {
              const ok = !/does not match|fell\.|the share fell/i.test(c.check);
              return (
                <li key={c.claim} className="grid grid-cols-[1.4rem_minmax(0,1fr)] gap-1">
                  <span aria-label={ok ? "holds" : "does not hold"} className="font-bold" style={{ color: ok ? "var(--s-cool)" : "var(--s-hot)" }}>{ok ? "✓" : "✗"}</span>
                  <span><b>&ldquo;{c.claim}&rdquo;</b><span className="block" style={{ color: "var(--story-ink-2)" }}>{c.check}</span></span>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel n={15} title="Where the CJP's followers are: three claims, no audit" kind="published"
          note={<>Two BJP figures said about half the CJP&apos;s followers were in Pakistan. Its founder showed the page&apos;s own analytics: 94.7% in India. Country breakdowns are visible only to an account&apos;s admins, so none of the three can be checked from outside. Lenz rated the India-majority claim &ldquo;{pub.followerOriginVerdict.verdict}&rdquo; — plausible, not confirmed.</>}
          source={line(...pub.followerOrigin.map((o) => o.source), pub.followerOriginVerdict.source)}>
          <ul className="space-y-3">
            {pub.followerOrigin.map((o) => (
              <li key={o.who} className="text-[12px]">
                <p className="font-semibold leading-tight">{o.who}</p>
                <span className="mt-1 flex h-5 overflow-hidden rounded-[4px] text-[10.5px] font-bold" title={`"${o.quote}"`}>
                  {o.india !== undefined && <span className="flex items-center pl-1.5" style={{ width: `${o.india}%`, minWidth: "4.2rem", whiteSpace: "nowrap", background: "var(--s-cool-fill)", borderRight: "2px solid var(--story-card)" }}>India {o.india}%</span>}
                  {o.pakistan !== undefined && <span className="flex items-center pl-1.5" style={{ width: `${o.pakistan}%`, minWidth: "4.2rem", whiteSpace: "nowrap", background: "var(--s-hot-fill)", borderRight: "2px solid var(--story-card)" }}>Pakistan {o.pakistan}%</span>}
                  {o.usa !== undefined && <span className="flex items-center pl-1.5" style={{ width: `${o.usa}%`, minWidth: "3.4rem", whiteSpace: "nowrap", background: "var(--story-rule)", borderRight: "2px solid var(--story-card)" }}>US {o.usa}%</span>}
                  {o.bangladesh !== undefined && <span className="flex items-center pl-1.5" style={{ width: `${o.bangladesh}%`, minWidth: "3.4rem", whiteSpace: "nowrap", background: "var(--story-rule)" }}>BD {o.bangladesh}%</span>}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel n={16} title="Losses, and the third-party trackers" kind="published"
          note={<>What the trackers say about the CJP now. HypeAuditor rates its 4.77% engagement rate &ldquo;Good&rdquo; for an account of its size, and calls a 30-day follower fall of 0.39% &ldquo;Low&rdquo; growth. Both are undated on the tracker&apos;s page. For scale: Instagram engagement fell 26% across the platform in 2025, so not every fall is the account&apos;s own.</>}
          source={line("instastatistics-cjp", "hypeauditor-cjp", "hypeauditor-kejriwal", "newsx-cjp-bots", "emarketer-ig-2025")}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {pub.trackerMetrics.map((m) => (
              <li key={m.account + m.metric} className="rounded-md border p-3" style={{ borderColor: "var(--story-rule)" }} title={`"${m.quote}"`}>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--story-ink-3)" }}>{nameOf(m.account)} · {m.metric}</p>
                <p className="mono mt-1 text-[22px] font-bold tabular-nums">{m.unit === "%" ? `${m.value}%` : `${m.value < 0 ? "−" : ""}${fmt(Math.abs(m.value))}`}</p>
                <p className="text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>{src(m.source).publisher}{m.notes ? ` · ${m.notes}` : ""}</p>
              </li>
            ))}
            <li className="rounded-md border p-3" style={{ borderColor: "var(--story-rule)" }}>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--story-ink-3)" }}>Instagram, all accounts · 2025</p>
              <p className="mono mt-1 text-[22px] font-bold tabular-nums">−26%</p>
              <p className="text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>engagement rate 7.3% → 5.4%, year on year · Buffer, via eMarketer</p>
            </li>
          </ul>
        </Panel>
      </div>

      <h2 className="story-display mt-12 text-[24px]">Measured by this site</h2>
      <p className="mt-2 max-w-[74ch] text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-3)" }}>
        Read twice a day from Meta&apos;s Graph API for {ACCOUNTS.map((a) => `@${a.handle}`).join(", ")}: followers, posts, and the likes and comments on every post since {dmy("2026-04-20")}.
        {reg?.active ? ` Last read ${dmy(reg.updatedAt)}.` : ""} Follower history starts on the first day the job runs; nothing earlier is reconstructed.
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel n={17} title="Followers today, and unusual daily changes" kind="measured"
          note={<>Each account&apos;s followers and its change per day. A change is flagged when it is more than four median deviations from that account&apos;s own usual: a viral post, a purge of fake accounts by Meta, a hack or bought followers all look alike here. A flag is a signal to look, not a finding of bots.</>}>
          {measured ? (
            <Bars rows={accts.map(({ a, rec }) => {
              const snaps = rec!.snapshots, last = snaps.at(-1);
              const flags = followerFlags(snaps).filter((f) => f.flagged);
              const prev = snaps.at(-2);
              return { label: a.name, value: last?.followers ?? 0, colour: colourOf(a.party), sub: `${prev ? `${(last!.followers - prev.followers).toLocaleString("en-IN")} since ${dmy(prev.d)}` : "first reading"}${flags.length ? ` · ${flags.length} flagged day${flags.length === 1 ? "" : "s"}` : ""}` };
            })} />
          ) : awaiting("Followers per account, read from the Graph API.")}
        </Panel>

        <Panel n={18} title="Engagement per post: last 30 days, NEET window, CEC window" kind="measured"
          note={<>Average likes plus comments per post, for posts made in each window, and per 1,000 followers so a 100-million account and a 2-million one can be compared. Posts whose likes the owner hid count comments only and are counted below.</>}>
          {measured ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-[12px]">
                <thead><tr className="text-left text-[11px]" style={{ color: "var(--story-ink-3)" }}><th className="py-1 font-medium">Account</th><th className="text-right font-medium">Last 30 days</th><th className="text-right font-medium">per 1,000</th><th className="text-right font-medium">NEET (July)</th><th className="text-right font-medium">CEC window</th><th className="text-right font-medium">Change</th></tr></thead>
                <tbody>
                  {accts.map(({ a, rec }) => {
                    const f = rec!.snapshots.at(-1)?.followers ?? null;
                    const last = summarise(rec!.media.filter((m) => m.t.slice(0, 10) >= monthAgo));
                    const neet = summarise(rec!.media.filter((m) => inRange(m.t, WINDOWS.neet.from, WINDOWS.neet.to)));
                    const cec = summarise(rec!.media.filter((m) => inRange(m.t, WINDOWS.cec.from, WINDOWS.cec.to)));
                    return (
                      <tr key={a.handle} className="border-t" style={{ borderColor: "var(--story-rule)" }}>
                        <td className="py-1.5"><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: colourOf(a.party) }} />{a.name}</td>
                        <td className="mono text-right">{fmt(last.avg)} <span style={{ color: "var(--story-ink-3)" }}>({last.posts})</span></td>
                        <td className="mono text-right">{fmt(perThousand(last.avg, f), 1)}</td>
                        <td className="mono text-right">{fmt(neet.avg)} <span style={{ color: "var(--story-ink-3)" }}>({neet.posts})</span></td>
                        <td className="mono text-right">{fmt(cec.avg)} <span style={{ color: "var(--story-ink-3)" }}>({cec.posts})</span></td>
                        <td className="mono text-right font-semibold">{signed(pctChange(neet.avg, cec.avg), 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-1 text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>Posts counted in brackets. The NEET and CEC windows need posts back to July, which the job reads on its first run.</p>
            </div>
          ) : awaiting("Average likes and comments per post, per window and per 1,000 followers.")}
        </Panel>

        <Panel n={19} title="How often, and in what format" kind="measured"
          note={<>Posts per week over the last six months, the share that are reels, and how reels perform against images and carousels. Format is the largest lever on Instagram reach, which Data Beings credits for Modi&apos;s rise.</>}>
          {measured ? (
            <ul className="space-y-2 text-[12px]">
              {accts.map(({ a, rec }) => {
                const s = summarise(rec!.media), w = weekly(rec!.media);
                return (
                  <li key={a.handle} className="grid grid-cols-[minmax(7rem,9rem)_minmax(0,1fr)] gap-2">
                    <span className="font-semibold">{a.name}</span>
                    <span>
                      <span className="flex h-6 items-end gap-[1px]" title={w.map((x) => `${x.week}: ${x.posts} posts`).join("\n")}>
                        {w.slice(-26).map((x) => <span key={x.week} className="w-[5px] rounded-t-[1px]" style={{ height: `${Math.max(2, (100 * x.posts) / Math.max(...w.map((y) => y.posts)))}%`, background: colourOf(a.party) }} />)}
                      </span>
                      <span className="text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>{(s.posts / Math.max(1, w.length)).toFixed(1)} a week · reels {s.posts ? Math.round((100 * s.reels) / s.posts) : 0}% · reel {fmt(s.reelAvg)} vs other {fmt(s.feedAvg)} a post</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : awaiting("Posting cadence and the reel share, per account.")}
        </Panel>

        <Panel n={20} title="What they post about, and comment patterns worth a look" kind="measured"
          note={<>Each caption tagged by keyword — exams, elections and the EC, protest and police, jobs, welfare, security — and the number of posts whose comments-per-100-likes ratio is far outside the account&apos;s own range. A topic is not a stance; an odd ratio is not proof of bots.</>}>
          {measured ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[11.5px]">
                <thead><tr className="text-left text-[10.5px]" style={{ color: "var(--story-ink-3)" }}><th className="py-1 font-medium">Account</th>{TOPICS.map(([t]) => <th key={t} className="text-right font-medium">{t.split(" ")[0]}</th>)}<th className="text-right font-medium">Odd ratio</th></tr></thead>
                <tbody>
                  {accts.map(({ a, rec }) => {
                    const n = Math.max(1, rec!.media.length);
                    const flagged = ratioOutliers(rec!.media).filter((r) => r.flagged).length;
                    return (
                      <tr key={a.handle} className="border-t" style={{ borderColor: "var(--story-rule)" }}>
                        <td className="py-1.5 font-semibold">{a.name}</td>
                        {TOPICS.map(([t]) => <td key={t} className="mono text-right">{Math.round((100 * rec!.media.filter((m) => topicsOf(m.caption).includes(t)).length) / n)}%</td>)}
                        <td className="mono text-right">{flagged}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : awaiting("Caption topics and comment-to-like outliers, per account.")}
        </Panel>
      </div>

      <section id="reading" className="mt-14 border-t pt-8" style={{ borderColor: "var(--story-rule)" }}>
        <Eyebrow>Reading the record</Eyebrow>
        <p className="mt-2 max-w-[74ch] text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-3)" }}>An editorial reading of the dashboards above, party by party. Each paragraph ends with the strongest case against itself. The numbers stand without it.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {[
            ["BJP", "The BJP's Instagram is the Prime Minister's. The party handle has fewer followers than Congress's and the lowest engagement per post of the four accounts Data Beings measured — 34,000 after July, against Modi's 4.63 million. When the CJP's protests pushed politics into young people's feeds, the BJP's answer came through Modi's reels: his 23 July video drew 21 million likes, and his account took 3.4 million of the roughly 3.75 million in added engagement per post across the four accounts.",
              "Against: engagement is not approval, and a protest month brings hostile attention too. The 290% rise is one firm's split of four accounts at one date, not independently verified."],
            ["Congress", "Congress had the larger party account in May — 13.2 to 13.3 million against the BJP's 8.7 to 8.8 million — and its handle grew engagement faster (+43% against +37%). Rahul Gandhi's personal engagement nearly tripled after July, through Ask-Me-Anything sessions and student meetings. In absolute terms, his gain per post was a twelfth of Modi's.",
              "Against: claims that bots inflate Rahul Gandhi's engagement circulate but are unproven, and the same caution applies to every account here. The party-handle figures carry Business Today's word \"followers\" for what is plainly engagement — an error somewhere in the chain."],
            ["AAP", "AAP has the smallest party account of the four — about 1.9 million in May — and its biggest personal draws have moved: Raghav Chadha's following fell from 14.6 to 13.5 million within a day of his move to the BJP. Its leaders stood with the CJP's CEC protest (Atishi was among those detained on 2 October), and the CJP's critics noticed: 3.2% of negative comments in October called the CJP a front for AAP.",
              "Against: no 2026 engagement figure for AAP's own handle has been published; until the Graph API reads it, the party's Instagram standing rests on a May follower count and an undated tracker figure for Kejriwal."],
            ["CJP", "The CJP's Instagram story has two halves. From launch to late May it grew faster than any Indian political account, to 22 million and more in a week. Between the NEET protest and the CEC protest, its engagement per post fell 58% and its posting fell 60%, and by 9 October it was losing about 474,000 followers a month. That is a real loss of attention. But the goodwill of those still engaging held on Instagram: positive comments went from 77% to 75%, and attacks on its credibility and on its founder fell slightly rather than rose. The sharpest deterioration is on X, where its account was withheld in India in May. Supporters' comments shifted from the party to the issue, the Election Commission, and the allies who joined the CEC protest — Neha Bora above all — gained the attention its founder lost.",
              "Against: July was a national story with a single demand that was met; a protest against a constitutional body, met with permission refusals and detentions, is a different and harder sell. Instagram engagement fell 26% across the platform in 2025. And the sentiment sample is the top post of each day only, of unstated size."],
          ].map(([party, body, against]) => (
            <div key={party} className="story-card p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: colourOf(party === "Congress" ? "INC" : (party as "BJP" | "AAP" | "CJP")) }}>{party}</p>
              <p className="mt-2 text-[13px] leading-[1.6]">{body}</p>
              <p className="mt-2 text-[12px] italic leading-[1.55]" style={{ color: "var(--story-ink-3)" }}>{against}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="method" className="mt-12 border-t pt-8" style={{ borderColor: "var(--story-rule)" }}>
        <Eyebrow>How it is measured, and what it cannot say</Eyebrow>
        <ul className="mt-3 max-w-[78ch] list-disc space-y-1.5 pl-5 text-[13px] leading-[1.6]" style={{ color: "var(--story-ink-2)" }}>
          <li><b>Published figures</b> are what a newspaper, a tracker or an analytics firm printed. Each names its source and the sentence it was read from (hover a bar); where two sources disagree both are kept. They were read from search excerpts on 20 October 2026, because the article pages could not be opened from where this was built.</li>
          <li><b>Measured figures</b> come from Meta&apos;s Graph API &ldquo;business discovery&rdquo;: the one sanctioned way to read another account&apos;s public counts. It gives followers, posts, likes and comments per post — no views, no reach, no comment text, no audience location. Instagram is never scraped. {reg?.active ? "The job is connected." : `The job is not connected yet: ${reg?.reason ?? "it has not run."}`}</li>
          <li><b>Sentiment</b> is Data Beings&apos;, from their study: comments on each day&apos;s top post by engagement, classified positive or negative and by theme. The site cannot read comment text on accounts it does not own, so it adds no sentiment of its own.</li>
          <li><b>Bots</b> cannot be detected from public counts. What can be seen — a follower jump far outside an account&apos;s usual, or a post whose comments-to-likes ratio is far from the account&apos;s norm — is shown as a signal, with the innocent explanations beside it. Follower-origin claims are shown as claims, because country breakdowns are visible only to an account&apos;s own admins.</li>
          <li><b>Engagement is attention, not approval</b>, and Instagram is not India: its users skew young, urban and male, and a party&apos;s followers are its existing audience, not the electorate.</li>
        </ul>
      </section>
    </article>
  );
}
