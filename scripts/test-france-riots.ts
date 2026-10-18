/**
 * The France riots tracker: its parsers against samples of each source's
 * format, its rules for what belongs, and the promises the register makes —
 * no X post text, every quoted figure attributed, nothing outside the window.
 *
 * The sources themselves cannot be reached from the machine this is written
 * on; the scheduled job proves they answer, and records it in `status`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isAboutRiots, parseGoogleNews, parseYouTube, channelIdFromPage, parseGdeltArticles, parseGdeltTimeline,
  parseGovUkAdvice, articleText, isOfficialRelevant, placesFromHeadlines, fixMojibake, parseBingNews, attribution, unescape, extractStatements, countsIn, statementKind, mergeBy, headlineKey, inWindow,
  type FranceRegister,
} from "../lib/france-riots-shared";
import { FRANCE_RIOTS } from "../lib/sources";

let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => { if (!cond) failed++; console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  " + detail}`); };

console.log("\nWhat belongs on the tracker");
ok("a French riot headline belongs", isAboutRiots("Émeutes à Lyon : l'office de tourisme incendié"));
ok("an English one does", isAboutRiots("Police clash with protesters during huge demonstrations across France"));
ok("unrest elsewhere does not", !isAboutRiots("Riots in Nairobi after disputed vote"));
ok("French news without unrest does not", !isAboutRiots("Paris : la tour Eiffel rouvre après travaux"));
ok("undated items are kept in the window", inWindow(null, FRANCE_RIOTS.since));
ok("September items are not", !inWindow("2026-09-20T00:00:00Z", FRANCE_RIOTS.since));

console.log("\nParsers");
const gn = parseGoogleNews(`<rss><channel><item><title>Émeutes : 400 interpellations à Paris - Le Monde</title><link>https://news.google.com/rss/articles/abc</link><pubDate>Sat, 17 Oct 2026 21:04:00 GMT</pubDate><source url="https://www.lemonde.fr">Le Monde</source></item></channel></rss>`, "fr", "press", "q");
ok("Google News: title, outlet and time", gn.length === 1 && gn[0]!.title === "Émeutes : 400 interpellations à Paris" && gn[0]!.outlet === "Le Monde" && gn[0]!.published === "2026-10-17T21:04:00.000Z", JSON.stringify(gn));
const yt = parseYouTube(`<feed><title>FRANCE 24 English</title><author><name>FRANCE 24 English</name></author><entry><yt:videoId>dQw4w9WgXcQ</yt:videoId><title>France riots: cars torched in Paris</title><published>2026-10-17T20:00:00+00:00</published></entry><entry><yt:videoId>bad</yt:videoId><title>x</title></entry></feed>`, "FRANCE24English", "F24");
ok("YouTube: video id, title, channel; malformed ids dropped", yt.length === 1 && yt[0]!.id === "dQw4w9WgXcQ" && yt[0]!.channel === "FRANCE 24 English", JSON.stringify(yt));
ok("YouTube: channel id read from the channel page", channelIdFromPage(`..."externalId":"UCQfwfsi5VrQ8yKZ-UWmAEFg"...`) === "UCQfwfsi5VrQ8yKZ-UWmAEFg");
const ga = parseGdeltArticles({ articles: [{ url: "https://x.fr/a", title: " Violences à Nantes ", seendate: "20261017T213000Z", domain: "x.fr", language: "French", sourcecountry: "France", socialimage: "" }] });
ok("GDELT articles: date and fields", ga.length === 1 && ga[0]!.seen === "2026-10-17T21:30:00Z" && ga[0]!.image === null && ga[0]!.title === "Violences à Nantes");
const bn = parseBingNews(`<rss><channel><item><title>Émeutes : 855 interpellations à Paris</title><link>http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;aid=&amp;tid=x&amp;url=https%3a%2f%2fwww.lemonde.fr%2fsociete%2farticle%2f2026%2f10%2f18%2fx.html&amp;c=1</link><pubDate>Sun, 18 Oct 2026 08:00:00 GMT</pubDate></item></channel></rss>`, "fr");
ok("Bing News: the article's own address read out of the redirect", bn.length === 1 && bn[0]!.url === "https://www.lemonde.fr/societe/article/2026/10/18/x.html" && bn[0]!.domain === "lemonde.fr" && bn[0]!.language === "French", JSON.stringify(bn));
const gt = parseGdeltTimeline({ timeline: [{ series: "Article Count", data: [{ date: "20261017T200000Z", value: 3 }, { date: "20261017T201500Z", value: 4 }, { date: "20261017T210000Z", value: 9 }] }] });
ok("GDELT pulse: summed to the hour", gt.length === 2 && gt[0]!.v === 7 && gt[1]!.v === 9, JSON.stringify(gt));
const adv = parseGovUkAdvice({ public_updated_at: "2026-10-17T18:00:00Z", details: { change_description: "Latest update: protests in France", parts: [{ slug: "safety-and-security", body: "<p>Intro.</p><p>Large protests are taking place across France. Avoid demonstrations.</p>" }] } }, { id: "uk", name: "UK", page: "p" });
ok("gov.uk advice: change, date and the protest paragraph", adv.change === "Latest update: protests in France" && adv.updatedAt === "2026-10-17T18:00:00.000Z" && !!adv.excerpt?.startsWith("Large protests"));
ok("government items: a prefect's ban on a demonstration is kept", isOfficialRelevant("CABINET DU PRÉFET Arrêté n°2026-01342 portant interdiction partielle d’une manifestation"));
ok("government items: a call for expressions of interest is not a demonstration", !isOfficialRelevant("APPEL A MANIFESTATION D’INTERET"));
ok("titles mis-encoded upstream are repaired, others left alone", fixMojibake("ArrÃªtÃ© 2026-01351") === "Arrêté 2026-01351" && fixMojibake("Arrêté déjà") === "Arrêté déjà");
ok("government items: job offers and search pages are not", !isOfficialRelevant("Offres d'emploi") && !isOfficialRelevant("Résultats de recherche pour : manifestation"));
const pl = placesFromHeadlines(["Riots in Paris and Lyon", "Nice: shops looted", "What a nice evening", "Saint-Étienne et Saint-Denis"]);
ok("places: cities counted by headline, case-sensitively", pl.find((p) => p.name === "Paris")?.count === 1 && pl.find((p) => p.name === "Nice")?.count === 1 && !!pl.find((p) => p.name === "Saint-Étienne") && !!pl.find((p) => p.name === "Saint-Denis"), JSON.stringify(pl));
ok("article text: paragraphs only", articleText(`<script>var a="<p>no</p>"</script><p>Short</p><p>Le ministre de l'Intérieur a annoncé 1 800 interpellations dans toute la France.</p>`) === "Le ministre de l'Intérieur a annoncé 1 800 interpellations dans toute la France.");

console.log("\nOfficials' figures, quoted");
const meta = { outlet: "o", url: "u", seen: null, lang: "fr" };
const st = extractStatements("Le ministre de l'Intérieur Laurent Nuñez a fait état de 1 800 interpellations dans toute la France. Des manifestants ont défilé le 17 octobre à Paris, selon la police. Au moins 120 policiers et gendarmes ont été blessés, selon la préfecture de police. Il y avait beaucoup de monde.", meta);
ok("a minister's arrest figure is kept, attributed", st.some((s) => s.kind === "arrests" && s.who === "Interior Minister (Laurent Nuñez)" && s.numbers.includes("1 800")), JSON.stringify(st));
ok("injuries attributed to the prefecture", st.some((s) => s.kind === "injured" && s.who === "Paris Police Prefecture"));
ok("a date is not a count: no statement from the date-only sentence", !st.some((s) => /défilé/.test(s.quote)));
ok("a sentence naming no source is not kept", extractStatements("Some 300 cars were torched overnight across the country.", meta).length === 0);
ok("years, days and times are not counts", countsIn("En 2026, le 17 octobre à 22h, 450 personnes") .join() === "450");
ok("kinds: arrests, damage, turnout", statementKind("400 people were arrested") === "arrests" && statementKind("200 cars torched") === "damage" && statementKind("550,000 protesters") === "protesters");
ok("a sentence with two sources names both, in order", attribution("According to the Ministry of the Interior, 550,000 people took to the streets; the CGT union puts the number at 800,000.") === "the Interior Ministry; organisers or unions");
ok("people injured are not a source: 'firefighters' injured is not 'according to firefighters'", attribution("Interior Minister Laurent Nuñez has reported 1,800 arrests and 500 injured police officers and firefighters so far.") === "Interior Minister (Laurent Nuñez)");
ok("a burned town hall is not a mayor speaking", attribution("La mairie de Limoges a été incendiée, 40 interpellations selon la police.") === "police");
ok("turnout includes 'participated'", statementKind("The CGT trade union estimated that as many as 800,000 people participated.") === "protesters");
ok("entities decoded: &nbsp; &ldquo; &#x27;", unescape("Laurent Nuñez&nbsp;said &ldquo;500&rdquo; France&#x27;s") === "Laurent Nuñez said “500” France's");
ok("accented letters decoded by name: &ntilde; &Eacute; &ccedil; &oelig;", unescape("Nu&ntilde;ez &Eacute;lys&eacute;e fran&ccedil;ais c&oelig;ur") === "Nuñez Élysée français cœur");
ok("a sentence with an entity that cannot be decoded is not kept", extractStatements("Le ministre de l'Intérieur a annoncé 400 interpellations &zzz; dans la nuit.", meta).length === 0);
const merged = mergeBy([{ ...gn[0]! }], [{ ...gn[0]!, published: "2026-10-18T00:00:00Z" }], headlineKey, 10);
ok("merge: one entry per headline, first sighting kept", merged.length === 1 && merged[0]!.published === "2026-10-17T21:04:00.000Z");

console.log("\nThe register");
const reg = JSON.parse(readFileSync(join(process.cwd(), "data", "france-riots", "register.json"), "utf8")) as FranceRegister;
ok("X posts carry ids, never text", reg.x.posts.every((p) => /^\d+$/.test(p.id) && Object.keys(p).every((k) => ["id", "handle", "createdAt", "video"].includes(k))));
const accounts = new Set<string>(FRANCE_RIOTS.xAccounts.map((h) => h.toLowerCase()));
ok("X posts come only from the listed institutions, officials and newsrooms", reg.x.posts.every((p) => !p.handle || accounts.has(p.handle.toLowerCase())), reg.x.posts.filter((p) => p.handle && !accounts.has(p.handle.toLowerCase())).map((p) => p.handle).join(", "));
ok("every quoted figure names who gave it", reg.statements.every((s) => !!s.who && s.numbers.length > 0 && s.quote.length >= 40));
ok("no quote carries an undecoded HTML entity", reg.statements.every((s) => !/&(?:[a-z]+|#x?[0-9a-f]+);/i.test(s.quote)), reg.statements.filter((s) => /&(?:[a-z]+|#x?[0-9a-f]+);/i.test(s.quote)).slice(0, 2).map((s) => s.quote.slice(0, 80)).join(" | "));
ok("headlines and videos are inside the window", reg.headlines.every((h) => inWindow(h.published, FRANCE_RIOTS.since)) && reg.videos.every((v) => inWindow(v.published, FRANCE_RIOTS.since)));
ok("press headlines name unrest in France", reg.headlines.filter((h) => h.kind === "press").every((h) => isAboutRiots(h.title)));
ok("government-site items concern demonstrations or public order", reg.headlines.filter((h) => h.kind === "official").every((h) => isOfficialRelevant(h.title)));
ok("X spending stays within the day's budget", reg.x.readsToday <= Math.max(reg.x.budgetPerDay, 0) + 100);

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
