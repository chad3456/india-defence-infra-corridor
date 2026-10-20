/**
 * Indian politics on Instagram (/instagram-politics): the accounts followed,
 * the shape of what the scheduled job stores, and the arithmetic every
 * dashboard on the page is computed with. No node imports.
 *
 * ── Two kinds of number ──────────────────────────────────────────────────
 *
 * Published figures (data/instagram/published.json) are what a newspaper, a
 * tracker or an analytics firm printed, each with its source. Measured
 * figures (data/instagram/register.json) are public counts the scheduled job
 * reads from Meta's Graph API "business discovery" endpoint: followers,
 * posts, and the likes and comments on each recent post of a public business
 * or creator account. That is all Meta exposes about someone else's account —
 * no reach, no views, no comment text, no audience — so none of those is
 * claimed here.
 *
 * ── What engagement is not ───────────────────────────────────────────────
 *
 * Likes plus comments measure attention, not approval: an outraged comment
 * counts the same as a supportive one. Comment sentiment on this page is only
 * ever a published study's, credited to it. "Signals" (a follower jump, an
 * unusual likes-to-comments ratio) are patterns worth a look, never proof of
 * bots; the page says so wherever it shows one.
 */

export type Party = "BJP" | "INC" | "AAP" | "CJP" | "AISA";
export interface Account { handle: string; name: string; party: Party; kind: "party" | "leader"; role: string; verified: boolean }

/**
 * The accounts read. `verified` is true where a published source names the
 * handle; the others are the job's best guess and are reported as not found
 * if wrong, never silently replaced.
 */
export const ACCOUNTS: Account[] = [
  { handle: "bjp4india", name: "BJP", party: "BJP", kind: "party", role: "Bharatiya Janata Party", verified: true },
  { handle: "incindia", name: "Congress", party: "INC", kind: "party", role: "Indian National Congress", verified: true },
  { handle: "aamaadmiparty", name: "AAP", party: "AAP", kind: "party", role: "Aam Aadmi Party", verified: true },
  { handle: "cockroachjantaparty", name: "CJP", party: "CJP", kind: "party", role: "Cockroach Janta Party", verified: true },
  { handle: "narendramodi", name: "Narendra Modi", party: "BJP", kind: "leader", role: "Prime Minister", verified: true },
  { handle: "rahulgandhi", name: "Rahul Gandhi", party: "INC", kind: "leader", role: "Congress MP", verified: true },
  { handle: "arvindkejriwal", name: "Arvind Kejriwal", party: "AAP", kind: "leader", role: "AAP national convenor", verified: true },
  { handle: "abhijeetdipke", name: "Abhijeet Dipke", party: "CJP", kind: "leader", role: "CJP founder", verified: false },
];

export const PARTY_LABEL: Record<Party, string> = { BJP: "BJP", INC: "Congress", AAP: "AAP", CJP: "CJP", AISA: "AISA" };
/** Display names for handles that appear only in published figures. */
export const EXTRA_NAMES: Record<string, string> = { raghavchadha: "Raghav Chadha", nehabora: "Neha Bora (AISA)", "CJP on X": "CJP on X" };
export const nameOf = (handle: string) => ACCOUNTS.find((a) => a.handle === handle)?.name ?? EXTRA_NAMES[handle] ?? handle;
export const partyOf = (handle: string): Party | null => ACCOUNTS.find((a) => a.handle === handle)?.party ?? (handle === "raghavchadha" ? "AAP" : handle === "nehabora" ? "AISA" : handle === "CJP on X" ? "CJP" : null);

/** The windows the page compares: the NEET protest month, and the protest against the Chief Election Commissioner. */
export const WINDOWS = {
  neet: { from: "2026-07-01", to: "2026-08-01", label: "NEET protest, July 2026" },
  cec: { from: "2026-09-25", to: "2026-10-15", label: "CEC protest, 25 Sep – 14 Oct 2026" },
} as const;
/** Six months back from the page's reference date: the job reads this far. */
export const SINCE = "2026-04-20";

/* ── What the scheduled job stores ────────────────────────────────────── */

export interface Media { id: string; t: string; type: string; product: string | null; likes: number | null; comments: number | null; permalink: string; caption: string }
export interface Snapshot { d: string; followers: number; posts: number }
export interface AccountRecord { handle: string; ok: boolean; error?: string; name?: string; snapshots: Snapshot[]; media: Media[]; readAt?: string }
export interface InstagramRegister {
  updatedAt: string;
  active: boolean;
  reason?: string;
  accounts: Record<string, AccountRecord>;
}

/* ── Arithmetic ───────────────────────────────────────────────────────── */

/** Likes plus comments; a post whose likes are hidden counts its comments only, and says so through `hidden`. */
export const engagement = (m: Media) => (m.likes ?? 0) + (m.comments ?? 0);
export const inRange = (t: string, from: string, to: string) => t >= from && t < to;

export interface Summary { posts: number; avg: number | null; median: number | null; hidden: number; reels: number; reelAvg: number | null; feedAvg: number | null }
export function summarise(media: Media[]): Summary {
  const vals = media.map(engagement).sort((a, b) => a - b);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const reels = media.filter((m) => m.product === "REELS");
  const feed = media.filter((m) => m.product !== "REELS");
  return {
    posts: media.length, avg: mean(vals), median: vals.length ? (vals.length % 2 ? vals[(vals.length - 1) / 2]! : (vals[vals.length / 2 - 1]! + vals[vals.length / 2]!) / 2) : null,
    hidden: media.filter((m) => m.likes === null).length, reels: reels.length, reelAvg: mean(reels.map(engagement)), feedAvg: mean(feed.map(engagement)),
  };
}
/** Percentage change, or null where the base is missing or zero: no change is computed off nothing. */
export const pctChange = (from: number | null | undefined, to: number | null | undefined) => (from && to !== null && to !== undefined ? ((to - from) / from) * 100 : null);

/** Average engagement per 1,000 followers: attention relative to audience size. */
export const perThousand = (avg: number | null, followers: number | null) => (avg !== null && followers ? (avg / followers) * 1000 : null);

/** Posts per ISO week, oldest first. */
export function weekly(media: Media[]): Array<{ week: string; posts: number; avg: number }> {
  const by = new Map<string, Media[]>();
  for (const m of media) {
    const d = new Date(m.t);
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)));
    const k = monday.toISOString().slice(0, 10);
    by.set(k, [...(by.get(k) ?? []), m]);
  }
  return [...by].sort((a, b) => a[0].localeCompare(b[0])).map(([week, ms]) => ({ week, posts: ms.length, avg: ms.reduce((a, m) => a + engagement(m), 0) / ms.length }));
}

/** What a caption is about, by keyword: a rough topic, never a stance. */
export const TOPICS: Array<[string, RegExp]> = [
  ["Exams & education", /\bneet\b|paper leak|pepar leak|exam|pariksha|परीक्षा|student|chhatra|छात्र|education|शिक्षा|pradhan/i],
  ["Elections & the EC", /election commission|\bECI\b|\bCEC\b|gyanesh|\bSIR\b|vote chor|वोट चोर|voter|मतदाता|ballot|evm/i],
  ["Protest & police", /protest|andolan|आंदोलन|jantar mantar|detain|हिरासत|police|पुलिस|lathi/i],
  ["Jobs & economy", /job|rozgar|रोजगार|unemploy|berozgar|बेरोजगार|inflation|mehngai|महंगाई|economy|gdp/i],
  ["Development & welfare", /yojana|योजना|scheme|launch|inaugurat|उद्घाटन|vikas|विकास|infrastructure|road|railway/i],
  ["Nation & security", /army|sena|सेना|operation|border|terror|आतंक|security|sindoor/i],
];
export const topicsOf = (caption: string) => TOPICS.filter(([, re]) => re.test(caption)).map(([t]) => t);

/**
 * Day-over-day follower changes and the ones far outside the account's own
 * usual: more than four median absolute deviations from the median change.
 * A flag says a jump or fall is unusual for that account — a viral post, a
 * purge of fake accounts by Meta, a hack or bought followers all look alike
 * here — and nothing more.
 */
export function followerFlags(snaps: Snapshot[]): Array<{ d: string; delta: number; flagged: boolean }> {
  const s = [...snaps].sort((a, b) => a.d.localeCompare(b.d));
  const deltas = s.slice(1).map((x, i) => ({ d: x.d, delta: x.followers - s[i]!.followers }));
  if (deltas.length < 5) return deltas.map((x) => ({ ...x, flagged: false }));
  const med = (xs: number[]) => { const v = [...xs].sort((a, b) => a - b); return v.length % 2 ? v[(v.length - 1) / 2]! : (v[v.length / 2 - 1]! + v[v.length / 2]!) / 2; };
  const m = med(deltas.map((x) => x.delta));
  const mad = med(deltas.map((x) => Math.abs(x.delta - m))) || 1;
  return deltas.map((x) => ({ ...x, flagged: Math.abs(x.delta - m) > 4 * mad }));
}

/**
 * Comments per 100 likes on each post, and the posts whose ratio is far from
 * the account's own median (beyond four median absolute deviations, in
 * either direction). Many likes and almost no comments, or a pile of
 * comments on few likes, can come from coordinated activity — or from a
 * giveaway, a contest, a pinned comment war or a post that went viral
 * outside the account's followers.
 */
export function ratioOutliers(media: Media[]): Array<{ m: Media; ratio: number; flagged: boolean }> {
  const rows = media.filter((m) => m.likes && m.likes > 0 && m.comments !== null).map((m) => ({ m, ratio: (100 * m.comments!) / m.likes! }));
  if (rows.length < 8) return rows.map((r) => ({ ...r, flagged: false }));
  const v = rows.map((r) => r.ratio).sort((a, b) => a - b);
  const med = v[Math.floor(v.length / 2)]!;
  const devs = v.map((x) => Math.abs(x - med)).sort((a, b) => a - b);
  const mad = devs[Math.floor(devs.length / 2)]! || 0.01;
  return rows.map((r) => ({ ...r, flagged: Math.abs(r.ratio - med) > 4 * mad }));
}

/** The Graph API business-discovery response for one account, as the job stores it. */
export function parseDiscovery(body: unknown): { name: string; followers: number; posts: number; media: Media[]; after: string | null } | null {
  const bd = (body as { business_discovery?: Record<string, unknown> })?.business_discovery;
  if (!bd || typeof bd.followers_count !== "number") return null;
  const mediaBlock = bd.media as { data?: Array<Record<string, unknown>>; paging?: { cursors?: { after?: string }; next?: string } } | undefined;
  const media: Media[] = (mediaBlock?.data ?? []).flatMap((m) => {
    if (typeof m.id !== "string" || typeof m.timestamp !== "string") return [];
    const t = new Date(m.timestamp).toISOString();
    return [{
      id: m.id, t, type: String(m.media_type ?? ""), product: typeof m.media_product_type === "string" ? m.media_product_type : null,
      likes: typeof m.like_count === "number" ? m.like_count : null, comments: typeof m.comments_count === "number" ? m.comments_count : null,
      permalink: typeof m.permalink === "string" ? m.permalink : "", caption: typeof m.caption === "string" ? m.caption.slice(0, 280) : "",
    }];
  });
  return { name: String(bd.name ?? bd.username ?? ""), followers: bd.followers_count, posts: typeof bd.media_count === "number" ? bd.media_count : 0, media, after: mediaBlock?.paging?.next ? mediaBlock?.paging?.cursors?.after ?? null : null };
}

/* ── Published figures ────────────────────────────────────────────────── */

export interface PublishedSource { id: string; publisher: string; title: string; url: string; published: string | null; accessed: string; tier: 1 | 2 | 3; provenance: string; pending?: string }
export interface Published {
  about: string;
  sources: PublishedSource[];
  followers: Array<{ account: string; date: string | null; value: number; source: string; confidence: "high" | "medium" | "low"; quote: string; notes?: string }>;
  engagementBeforeAfterJuly20: { source: string; method: string; rows: Array<{ account: string; before: number; after: number; changePct: number; quote: string; notes?: string }>; highlight: { account: string; date: string; likes: number; comments: number; reposts: number; shares: number; source: string; quote: string } };
  cjpStudy: {
    source: string; windows: { neet: string; cec: string }; sample: string;
    engagement: Array<{ platform: "instagram" | "x"; account: string; neet: number; cec: number; postsNeet?: number; postsCec?: number }>;
    sentiment: Array<{ platform: "instagram" | "x"; window: "neet" | "cec"; positive: number; negative: number }>;
    themes: Record<"neet" | "cec", { positive: Array<[string, number]>; negative: Array<[string, number]> }>;
    claimsInCirculation: Array<{ claim: string; check: string }>;
  };
  followerOrigin: Array<{ who: string; india?: number; pakistan?: number; usa?: number; bangladesh?: number; source: string; quote: string; notes?: string }>;
  followerOriginVerdict: { source: string; verdict: string; quote: string };
  trackerMetrics: Array<{ account: string; metric: string; value: number; unit: string; source: string; quote: string; notes?: string }>;
  context: Array<{ date: string; text: string; source: string }>;
  baseline: { text: string; source: string };
}

/**
 * Themes in negative comments grouped by what they say: attacks on CJP's
 * credibility or loyalty, personal attacks on its founder, and support for
 * the other side. A grouping of the study's own categories, labelled derived.
 */
export const NEGATIVE_GROUPS: Array<[string, RegExp]> = [
  ["Credibility: flop, fake, paid, a front", /flop|fake|drama|paid|foreign|front for|selective|attention/i],
  ["Loyalty: anti-national, Pakistani agent", /anti-national|pakistan/i],
  ["The founder personally", /dipke/i],
  ["For the government, BJP, police or EC", /supports?|supporting|for police/i],
  ["General criticism of CJP", /critical|against cjp|harms/i],
];
export function groupThemes(themes: Array<[string, number]>, groups: Array<[string, RegExp]>): Array<{ group: string; share: number }> {
  const out = groups.map(([g]) => ({ group: g, share: 0 }));
  let other = 0;
  for (const [label, v] of themes) {
    const i = groups.findIndex(([, re]) => re.test(label));
    if (i >= 0) out[i]!.share += v; else other += v;
  }
  return [...out, { group: "Other", share: other }].map((x) => ({ ...x, share: Math.round(x.share * 10) / 10 }));
}
