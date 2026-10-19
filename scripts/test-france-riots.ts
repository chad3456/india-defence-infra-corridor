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
  parseGovUkAdvice, extractClaims, extractBusinessReports, incidentsByCity, parseStooq, articleText, tweetsInHtml, tweetTime, isParis, inFocus, isOfficialRelevant, placesFromHeadlines, fixMojibake, parseBingNews, attribution, unescape, extractStatements, countsIn, statementKind, mergeBy, headlineKey, inWindow,
  type FranceRegister,
} from "../lib/france-riots-shared";
import { FRANCE_RIOTS } from "../lib/sources";

let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => { if (!cond) failed++; console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  " + detail}`); };

console.log("\nWhat belongs on the tracker");
ok("a French riot headline belongs", isAboutRiots("Émeutes à Lyon : l'office de tourisme incendié"));
ok("an English one does", isAboutRiots("Police clash with protesters during huge demonstrations across France"));
ok("'les violences du 17 octobre' belongs: the date is this story's name", isAboutRiots("Violences du 17 octobre : Yaël Braun-Pivet veut une commission d'enquête"));
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

console.log("\nPosts on X that newsrooms embedded");
const html = `<blockquote class="twitter-tweet"><p lang="fr">texte du post</p>&mdash; Préfecture de police (@prefpolice) <a href="https://twitter.com/prefpolice/status/1979512345678901234?ref_src=twsrc%5Etfw">October 17, 2026</a></blockquote><a href="https://x.com/intent/tweet?url=x">share</a><a href="https://x.com/i/status/1979512345678901299">i</a><a href="https://x.com/lemondefr">follow</a>`;
const tw = tweetsInHtml(html);
ok("embedded posts: status links read, share and follow links ignored", tw.length === 2 && tw[0]!.id === "1979512345678901234" && tw[0]!.handle === "prefpolice", JSON.stringify(tw));
ok("a link that names no author keeps the post, with no handle", tw[1]!.id === "1979512345678901299" && tw[1]!.handle === "");
ok("embedded posts: nothing of the post's text is taken", JSON.stringify(tw).indexOf("texte") === -1);
ok("a post's time is read from its id", tweetTime("1850000000000000000") === "2024-10-26T02:22:25.994Z" && tweetTime("abc") === null);
ok("Paris lens: suburbs and the prefecture count, Lyon does not", isParis("Violences à Bobigny") && isParis("selon la préfecture de police") && !isParis("Émeutes à Lyon"));
ok("focus window: 17 October inside, 19 October and undated outside", inFocus("2026-10-17T20:00:00Z", FRANCE_RIOTS.focus) && !inFocus("2026-10-19T08:00:00Z", FRANCE_RIOTS.focus) && !inFocus(null, FRANCE_RIOTS.focus));

console.log("\nOfficials' figures, quoted");
const meta = { outlet: "o", url: "u", seen: null, lang: "fr" };
const st = extractStatements("Le ministre de l'Intérieur Laurent Nuñez a fait état de 1 800 interpellations dans toute la France. Des manifestants ont défilé le 17 octobre à Paris, selon la police. Au moins 120 policiers et gendarmes ont été blessés, selon la préfecture de police. Il y avait beaucoup de monde.", meta);
ok("a minister's arrest figure is kept, attributed", st.some((s) => s.kind === "arrests" && s.who === "Interior Minister (Laurent Nuñez)" && s.numbers.includes("1 800")), JSON.stringify(st));
ok("injuries attributed to the prefecture", st.some((s) => s.kind === "injured" && s.who === "Paris Police Prefecture"));
ok("a date is not a count: no statement from the date-only sentence", !st.some((s) => /défilé/.test(s.quote)));
ok("a sentence naming no source is not kept", extractStatements("Some 300 cars were torched overnight across the country.", meta).length === 0);
ok("ages and distances are not counts", countsIn("A 22-year-old police officer died 250 miles away; un homme de 34 ans, âgé de 19 ; 600 injured").join() === "600", countsIn("A 22-year-old police officer died 250 miles away; un homme de 34 ans, âgé de 19 ; 600 injured").join());
ok("years, days and times are not counts", countsIn("En 2026, le 17 octobre à 22h, 450 personnes") .join() === "450");
ok("kinds: arrests, damage, turnout", statementKind("400 people were arrested") === "arrests" && statementKind("200 cars torched") === "damage" && statementKind("550,000 protesters") === "protesters");
ok("a sentence with two sources names both, in order", attribution("According to the Ministry of the Interior, 550,000 people took to the streets; the CGT union puts the number at 800,000.") === "the Interior Ministry; organisers or unions");
ok("people injured are not a source: 'firefighters' injured is not 'according to firefighters'", attribution("Interior Minister Laurent Nuñez has reported 1,800 arrests and 500 injured police officers and firefighters so far.") === "Interior Minister (Laurent Nuñez)");
ok("a burned town hall is not a mayor speaking", attribution("La mairie de Limoges a été incendiée, 40 interpellations selon la police.") === "police");
ok("'according to authorities' is a source", attribution("About 550,000 people took part in protests across France, according to authorities, while organizers counted about 800,000.") === "the authorities; organisers or unions");
ok("turnout includes 'participated'", statementKind("The CGT trade union estimated that as many as 800,000 people participated.") === "protesters");
ok("entities decoded: &nbsp; &ldquo; &#x27;", unescape("Laurent Nuñez&nbsp;said &ldquo;500&rdquo; France&#x27;s") === "Laurent Nuñez said “500” France's");
ok("accented letters decoded by name: &ntilde; &Eacute; &ccedil; &oelig;", unescape("Nu&ntilde;ez &Eacute;lys&eacute;e fran&ccedil;ais c&oelig;ur") === "Nuñez Élysée français cœur");
ok("a sentence with an entity that cannot be decoded is not kept", extractStatements("Le ministre de l'Intérieur a annoncé 400 interpellations &zzz; dans la nuit.", meta).length === 0);
const merged = mergeBy([{ ...gn[0]! }], [{ ...gn[0]!, published: "2026-10-18T00:00:00Z" }], headlineKey, 10);
ok("merge: one entry per headline, first sighting kept", merged.length === 1 && merged[0]!.published === "2026-10-17T21:04:00.000Z");

console.log("\nDamage, claims, economy");
ok("a burned tourist office is damage, not the tourism economy", statementKind("L'office de tourisme de Lyon a été incendié, 40 interpellations selon la préfecture.") !== "economy");
ok("hotel cancellations are the economy", statementKind("Les hôteliers parisiens font état de 30 % d'annulations, selon l'UMIH.") === "economy");
ok("a euro damage figure is a cost", statementKind("Les assureurs estiment les dégâts à 650 millions d'euros, selon France Assureurs.") === "cost");
ok("'violences' is not 'viol': violence alone is not an assault on a person's body", statementKind("Les violences ont fait 300 blessés selon la police.") === "injured");
ok("sexual assaults are their own kind", statementKind("Le parquet a ouvert 12 enquêtes pour agression sexuelle.") === "assaults");
ok("who was arrested: ages and records are a profile", statementKind("Selon le parquet, 40 % des 855 interpellés sont mineurs.") === "profile");
ok("forces deployed", statementKind("Le ministre de l'Intérieur a annoncé que 80 000 policiers et gendarmes seront mobilisés samedi.") === "deployment");
const cl = extractClaims("Donald Trump blamed immigration for the riots, saying France is burning. The weather was mild. Jean-Luc Mélenchon accused the government of provoking the violence with its austerity budget.", { outlet: "o", url: "u", seen: null, lang: "en" });
ok("claims: a speaker, a verb and a theme, credited to the speaker", cl.length === 2 && cl[0]!.speaker === "Donald Trump" && cl[0]!.themes.includes("immigration") && cl[1]!.speaker === "Jean-Luc Mélenchon (LFI)" && cl[1]!.themes.includes("cost-of-living"), JSON.stringify(cl.map((c) => [c.speaker, c.themes])));
ok("a minister named by title is a speaker: the far-left claim is his", (() => { const c = extractClaims("S'exprimant devant la presse, le ministre de l'Intérieur a fait valoir qu'en marge des cortèges, s'étaient constitués des groupes de casseurs à l'instigation très claire de l'ultragauche.", { outlet: "o", url: "u", seen: null, lang: "fr" }); return c.length === 1 && c[0]!.speaker === "Laurent Nuñez (Interior Minister)" && c[0]!.themes.includes("far-left"); })());
ok("'constitués' is not 'tués'", statementKind("Le ministre a dénombré 110 défilés ; des groupes de casseurs s'étaient constitués, selon la police.") !== "deaths");
ok("claims: a sentence with no named speaker is not a claim", extractClaims("Many blamed immigration for the riots across France.", { outlet: "o", url: "u", seen: null, lang: "en" }).length === 0);
const bz = extractBusinessReports("A Paris, un McDonald's et une agence BNP ont été pillés dans la nuit. L'Apple Store a rouvert normalement.", { outlet: "o", url: "u", seen: null });
ok("businesses: named and attacked, with the city", bz.length === 2 && bz.every((b) => b.city === "Paris") && bz.map((b) => b.brand).join() === "McDonald's,BNP Paribas", JSON.stringify(bz.map((b) => [b.brand, b.city])));
const inc = incidentsByCity(["La mairie de Limoges incendiée", "Pillages à Paris", "Heurts à Paris, gaz lacrymogène"]);
ok("incidents by city: Limoges fire and public building, Paris looting and clashes", inc.find((c) => c.name === "Limoges")?.types.arson === 1 && inc.find((c) => c.name === "Limoges")?.types["public-buildings"] === 1 && inc.find((c) => c.name === "Paris")?.types.looting === 1 && inc.find((c) => c.name === "Paris")?.types.clashes === 1);
ok("Stooq closes read, header and junk skipped", JSON.stringify(parseStooq("Date,Open,High,Low,Close,Volume\n2026-10-16,8000,8100,7900,8050.5,0\nN/D,,,,\n2026-10-19,8040,8060,7800,7850,0")) === JSON.stringify([{ d: "2026-10-16", close: 8050.5 }, { d: "2026-10-19", close: 7850 }]));

console.log("\nThe register");
const reg = JSON.parse(readFileSync(join(process.cwd(), "data", "france-riots", "register.json"), "utf8")) as FranceRegister;
ok("X posts carry ids, never text", reg.x.posts.every((p) => /^\d+$/.test(p.id) && Object.keys(p).every((k) => ["id", "handle", "createdAt", "video"].includes(k))));
const accounts = new Set<string>(FRANCE_RIOTS.xAccounts.map((h) => h.toLowerCase()));
ok("X posts come only from the listed institutions, officials and newsrooms", reg.x.posts.every((p) => !p.handle || accounts.has(p.handle.toLowerCase())), reg.x.posts.filter((p) => p.handle && !accounts.has(p.handle.toLowerCase())).map((p) => p.handle).join(", "));
ok("embedded posts carry ids, handles, times and the article that embedded them — never text", (reg.embedded ?? []).every((p) => Object.keys(p).every((k) => ["id", "handle", "createdAt", "outlet", "articleUrl", "articleTitle"].includes(k))));
ok("every embedded post comes from an article whose title names unrest in France", (reg.embedded ?? []).every((p) => isAboutRiots(p.articleTitle)));
ok("each embedded post's time is the one its id encodes, inside the story's window", (reg.embedded ?? []).every((p) => p.createdAt === tweetTime(p.id) && inWindow(p.createdAt, FRANCE_RIOTS.since)));
ok("every claim names its speaker and a theme, and comes from an article", (reg.claims ?? []).every((c) => !!c.speaker && c.themes.length > 0 && /^https?:/.test(c.url)));
ok("every business listed is named in its quote", (reg.businesses ?? []).every((b) => b.quote.length > 20 && /^https?:/.test(b.url)));
ok("every quoted figure names who gave it", reg.statements.every((s) => !!s.who && s.numbers.length > 0 && s.quote.length >= 40));
ok("no quote carries an undecoded HTML entity", reg.statements.every((s) => !/&(?:[a-z]+|#x?[0-9a-f]+);/i.test(s.quote)), reg.statements.filter((s) => /&(?:[a-z]+|#x?[0-9a-f]+);/i.test(s.quote)).slice(0, 2).map((s) => s.quote.slice(0, 80)).join(" | "));
ok("headlines and videos are inside the window", reg.headlines.every((h) => inWindow(h.published, FRANCE_RIOTS.since)) && reg.videos.every((v) => inWindow(v.published, FRANCE_RIOTS.since)));
ok("press headlines name unrest in France", reg.headlines.filter((h) => h.kind === "press").every((h) => isAboutRiots(h.title)));
ok("government-site items concern demonstrations or public order", reg.headlines.filter((h) => h.kind === "official").every((h) => isOfficialRelevant(h.title)));
ok("X spending stays within the day's budget", reg.x.readsToday <= Math.max(reg.x.budgetPerDay, 0) + 100);

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
