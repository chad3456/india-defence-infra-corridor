/**
 * Indian politics on Instagram: the published figures trace to their
 * sources and add up, the claims the page checks are checked correctly, the
 * Graph API parser reads what Meta returns, and the register holds nothing it
 * should not — no token, no comment text.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ACCOUNTS, NEGATIVE_GROUPS, followerFlags, groupThemes, parseDiscovery, pctChange, ratioOutliers, summarise, topicsOf, weekly,
  type InstagramRegister, type Media, type Published,
} from "../lib/instagram";

let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => { console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${!cond && detail ? `  ${detail}` : ""}`); if (!cond) failed++; };
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const pub = JSON.parse(readFileSync(join(process.cwd(), "data", "instagram", "published.json"), "utf8")) as Published;
const ids = new Set(pub.sources.map((s) => s.id));

console.log("Sources");
ok("every source has an https address, an access date, a tier and a provenance", pub.sources.every((s) => /^https:\/\//.test(s.url) && /^\d{4}-\d{2}-\d{2}$/.test(s.accessed) && [1, 2, 3].includes(s.tier) && !!s.provenance));
ok("source ids are unique", ids.size === pub.sources.length);
const cited = [
  ...pub.followers.map((f) => f.source), pub.engagementBeforeAfterJuly20.source, pub.engagementBeforeAfterJuly20.highlight.source, pub.cjpStudy.source,
  ...pub.followerOrigin.map((o) => o.source), pub.followerOriginVerdict.source, ...pub.trackerMetrics.map((m) => m.source), ...pub.context.map((c) => c.source), pub.baseline.source,
];
ok("every figure cites a source that exists", cited.every((c) => ids.has(c)), cited.filter((c) => !ids.has(c)).join(", "));
ok("a source not yet located says so", pub.sources.filter((s) => s.id === pub.cjpStudy.source).every((s) => !!s.pending));

console.log("\nFigures");
ok("every follower figure is a positive count with the sentence it was read from", pub.followers.every((f) => f.value > 0 && Number.isInteger(f.value) && f.quote.length > 10));
ok("low confidence always says why", pub.followers.filter((f) => f.confidence === "low").every((f) => !!f.notes));
ok("an undated figure is never more than low confidence", pub.followers.filter((f) => !f.date).every((f) => f.confidence === "low"));
ok("an estimate from an analytics firm is never high confidence", pub.followers.every((f) => !(pub.sources.find((s) => s.id === f.source)!.provenance === "think-tank" && f.confidence === "high")));
for (const r of pub.engagementBeforeAfterJuly20.rows) ok(`before/after: @${r.account}'s ${r.changePct}% is what its two numbers give`, near(pctChange(r.before, r.after)!, r.changePct, 1.6), String(pctChange(r.before, r.after)));
for (const s of pub.cjpStudy.sentiment) ok(`sentiment ${s.platform}/${s.window} sums to 100`, s.positive + s.negative === 100);
for (const w of ["neet", "cec"] as const) for (const side of ["positive", "negative"] as const) {
  const sum = pub.cjpStudy.themes[w][side].reduce((a, [, v]) => a + v, 0);
  ok(`themes ${w}/${side} sum to 100 (±0.6)`, near(sum, 100, 0.6), sum.toFixed(1));
}

console.log("\nThe claims the page checks");
const e = (acc: string, p = "instagram") => pub.cjpStudy.engagement.find((x) => x.account === acc && x.platform === p)!;
ok("CJP Instagram: −58%", Math.round(pctChange(e("cockroachjantaparty").neet, e("cockroachjantaparty").cec)!) === -58);
ok("CJP X: +25%", Math.round(pctChange(e("CJP on X", "x").neet, e("CJP on X", "x").cec)!) === 25);
ok("Dipke: −58%, not the −52% in circulation", Math.round(pctChange(e("abhijeetdipke").neet, e("abhijeetdipke").cec)!) === -58);
ok("Neha Bora: +132%, not 'nearly 50%'", Math.round(pctChange(e("nehabora").neet, e("nehabora").cec)!) === 132);
const neg = (w: "neet" | "cec", re: RegExp) => pub.cjpStudy.themes[w].negative.filter(([l]) => re.test(l)).reduce((a, [, v]) => a + v, 0);
ok("anti-national + flop/fake: 14.7% in July, 13.1% in the CEC window", near(neg("neet", /anti-national|flop/i), 14.7, 0.05) && near(neg("cec", /anti-national|flop/i), 13.1, 0.05));
const g = groupThemes(pub.cjpStudy.themes.cec.negative, NEGATIVE_GROUPS);
ok("grouping keeps every share: groups sum to the themes' total", near(g.reduce((a, x) => a + x.share, 0), pub.cjpStudy.themes.cec.negative.reduce((a, [, v]) => a + v, 0), 0.3));
ok("grouping: Dipke attacks are the founder's group, AAP-front is credibility", g.find((x) => x.group.startsWith("The founder"))!.share === 9.1 && groupThemes([["CJP is a front for AAP", 3.2]], NEGATIVE_GROUPS)[0]!.share === 3.2);

console.log("\nArithmetic and the Graph API parser");
const body = { business_discovery: { username: "x", name: "X", followers_count: 1000, media_count: 3, media: { data: [
  { id: "1", timestamp: "2026-10-01T10:00:00+0000", media_type: "VIDEO", media_product_type: "REELS", like_count: 100, comments_count: 10, permalink: "https://www.instagram.com/reel/a/", caption: "NEET paper leak protest at Jantar Mantar" },
  { id: "2", timestamp: "2026-10-02T10:00:00+0000", media_type: "IMAGE", media_product_type: "FEED", comments_count: 5, permalink: "https://www.instagram.com/p/b/", caption: "Vikas yojana launch" },
  { timestamp: "2026-10-03T10:00:00+0000" },
], paging: { cursors: { after: "CUR" }, next: "https://graph.facebook.com/next" } } } };
const p = parseDiscovery(body);
ok("business discovery: counts, posts, hidden likes as null, malformed posts dropped, the next cursor", !!p && p.followers === 1000 && p.media.length === 2 && p.media[1]!.likes === null && p.after === "CUR" && p.media[0]!.t === "2026-10-01T10:00:00.000Z");
ok("an error body is not an account", parseDiscovery({ error: { message: "x" } }) === null);
const s = summarise(p!.media);
ok("summary: engagement is likes plus comments; hidden likes counted", s.avg === (110 + 5) / 2 && s.hidden === 1 && s.reels === 1 && s.reelAvg === 110);
ok("no change is computed off nothing", pctChange(0, 5) === null && pctChange(null, 5) === null);
ok("topics by keyword", topicsOf("NEET paper leak protest at Jantar Mantar").join() === "Exams & education,Protest & police" && topicsOf("Vikas yojana launch").join() === "Development & welfare");
ok("weeks start on Monday", weekly(p!.media)[0]!.week === "2026-09-28");
const snaps = Array.from({ length: 12 }, (_, i) => ({ d: `2026-10-${String(i + 1).padStart(2, "0")}`, followers: 1_000_000 + i * 1000 + (i === 8 ? 300_000 : 0), posts: 10 }));
const flags = followerFlags(snaps);
ok("a follower jump far outside the account's usual is flagged, and the fall back too; ordinary days are not", flags.filter((f) => f.flagged).map((f) => f.d).join() === "2026-10-09,2026-10-10", JSON.stringify(flags.filter((f) => f.flagged)));
const media: Media[] = Array.from({ length: 12 }, (_, i) => ({ id: String(i), t: "2026-10-01T00:00:00.000Z", type: "IMAGE", product: "FEED", likes: 1000, comments: i === 5 ? 400 : 20 + (i % 3), permalink: "", caption: "" }));
ok("a post whose comments-per-like is far from the account's norm is flagged; the rest are not", ratioOutliers(media).filter((r) => r.flagged).map((r) => r.m.id).join() === "5");

console.log("\nThe register");
const reg = JSON.parse(readFileSync(join(process.cwd(), "data", "instagram", "register.json"), "utf8")) as InstagramRegister;
const raw = readFileSync(join(process.cwd(), "data", "instagram", "register.json"), "utf8");
ok("no access token in the register", !/EAA[A-Za-z0-9]{20,}|access_token/i.test(raw));
ok("inactive says why", reg.active || !!reg.reason);
ok("only the listed accounts", Object.keys(reg.accounts).every((h) => ACCOUNTS.some((a) => a.handle === h)));
ok("one follower snapshot per account per day", Object.values(reg.accounts).every((a) => new Set(a.snapshots.map((x) => x.d)).size === a.snapshots.length));
ok("posts carry counts and a short caption, never comment text", Object.values(reg.accounts).every((a) => a.media.every((m) => Object.keys(m).every((k) => ["id", "t", "type", "product", "likes", "comments", "permalink", "caption"].includes(k)) && m.caption.length <= 280)));

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
