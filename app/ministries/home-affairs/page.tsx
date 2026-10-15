import { loadMha, loadMhaRead, mhaMonth, type MhaAmount } from "@/lib/ministry";
import { Eyebrow, Standfirst, Stat } from "@/components/stories/Kit";
import { ChartTitle, Caption } from "@/components/stories/Charts";
import { MonthLines, LabelBars } from "@/components/ministry/MonthCharts";
import { MinistryTabs } from "@/components/ministry/Tabs";

/**
 * The Home Ministry's monthly reports, as data. The reports are prose — a
 * numbered list of what the ministry did that month — so the page draws only
 * what can be counted or quoted exactly: items per report, the subjects items
 * mention (by printed keyword rules), the Bills given assent, actions under the
 * UAPA, the figures the reports state in a repeated form, and every rupee
 * amount with the words around it. Every quote is re-found in its pinned
 * report by lib/ministry.ts before it is drawn.
 */

export const metadata = {
  title: "The Home Ministry's monthly reports, read · Bharat Tracker",
  description: "Ten years of the Ministry of Home Affairs' Monthly Major Achievements, pinned as PDFs and read: items per month, subjects by printed rules, Bills given assent, UAPA actions, stated counts and rupee figures, each quoted from its report.",
};

const C1 = "var(--series-1)", C2 = "var(--series-2)", C3 = "var(--series-3)", C4 = "var(--series-4)";
const REPO = "https://github.com/chad3456/india-defence-infra-corridor/blob/claude/india-defence-infra-tracker-qfpsfu/";
const int = (v: number) => Math.round(v).toLocaleString("en-IN");

const STATES = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Puducherry", "Jammu and Kashmir"];

function Card({ n, title, what, read, children, wide, foot }: { n: number; title: string; what: string; read?: string; children: React.ReactNode; wide?: boolean; foot: string }) {
  return (
    <figure className={`story-card min-w-0 p-4 sm:p-5 ${wide ? "lg:col-span-2" : ""}`}>
      <div className="flex items-baseline gap-2">
        <span className="mono text-[11px] font-bold tabular-nums" style={{ color: "var(--s-hot)" }}>{String(n).padStart(2, "0")}</span>
        <div className="min-w-0 flex-1"><ChartTitle note={what}>{title}</ChartTitle></div>
      </div>
      {children}
      {read && <figcaption><Caption>{read}</Caption></figcaption>}
      <p className="mono mt-3 text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>{foot}</p>
    </figure>
  );
}

/** Horizontal bars with labels on the left; for long category names. */
function HBars({ rows, colour = C1, format = int }: { rows: Array<{ label: string; v: number; note?: string }>; colour?: string; format?: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.v));
  return (
    <ul className="mt-2 space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,11rem)_1fr] items-center gap-2 text-[12px] sm:grid-cols-[minmax(0,15rem)_1fr]">
          <span className="truncate" title={r.note ?? r.label} style={{ color: "var(--story-ink-2)" }}>{r.label}</span>
          <span className="flex min-w-0 items-center gap-2">
            <span style={{ width: `${(r.v / max) * 100}%`, minWidth: 2, height: 10, background: colour, borderRadius: 2 }} />
            <span className="mono shrink-0 text-[11px] font-semibold tabular-nums">{format(r.v)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const crore = (a: MhaAmount) => (a.unit === "lakh" ? a.v / 100 : a.unit === "lakh crore" ? a.v * 1e5 : a.v);

export default function HomeAffairsPage() {
  const all = loadMha();
  const r = loadMhaRead();
  if (!r) return <article className="pt-6"><MinistryTabs active="home" /><p>The reports have not been read yet.</p></article>;
  const { file } = r;
  const reports = file.reports.filter((x) => x.month);
  const read = reports.filter((x) => x.readable);
  const years = [...new Set(reports.map((x) => x.month!.slice(0, 4)))].sort();
  const pinnedByYear = years.map((y) => ({ label: y, v: reports.filter((x) => x.month!.startsWith(y)).length }));
  const readByYear = years.map((y) => ({ label: y, v: read.filter((x) => x.month!.startsWith(y)).length }));
  const itemsPerMonth = read.map((x) => ({ m: x.month!, v: x.items }));
  const quoted = r.items.filter((i) => i.quote);
  const themeTotals = file.themes.map((t) => ({ label: t.label, v: quoted.filter((i) => i.themes.includes(t.id)).length, note: t.rule })).sort((a, b) => b.v - a.v);
  const readYears = [...new Set(read.map((x) => x.month!.slice(0, 4)))].sort();
  const share = (theme: string, y: string) => {
    const ys = quoted.filter((i) => i.month.startsWith(y));
    return ys.length ? (ys.filter((i) => i.themes.includes(theme)).length / ys.length) * 100 : null;
  };
  const billsByYear = readYears.map((y) => ({ label: y, v: r.bills.filter((b) => b.month.startsWith(y)).length }));
  const billState = (name: string) => STATES.find((s) => name.toLowerCase().includes(s.toLowerCase())) ?? (/\bJammu|Kashmir/i.test(name) ? "Jammu and Kashmir" : null);
  const byState = new Map<string, number>();
  for (const b of r.bills) { const s = billState(b.name) ?? "State not named in the title"; byState.set(s, (byState.get(s) ?? 0) + 1); }
  const stateRows = [...byState].map(([label, v]) => ({ label, v })).sort((a, b) => b.v - a.v).slice(0, 14);
  const stated = (id: string) => r.stated.filter((s) => s.series === id).sort((a, b) => a.month.localeCompare(b.month));
  const sanction = stated("uapa-sanction");
  const sanctionByYear = [...new Set(sanction.map((s) => s.month.slice(0, 4)))].sort().map((y) => {
    const xs = sanction.filter((s) => s.month.startsWith(y));
    return { label: `${y} (${xs.length} mo)`, v: xs.reduce((a, s) => a + s.v, 0) };
  });
  const uapaKinds = [...new Set(r.uapa.map((u) => u.kind))].map((k) => ({ label: k, v: r.uapa.filter((u) => u.kind === k).length })).sort((a, b) => b.v - a.v);
  const amountsByTheme = file.themes.map((t) => ({ label: t.label, v: r.amounts.filter((a) => a.themes.includes(t.id)).length })).filter((x) => x.v).sort((a, b) => b.v - a.v);
  const bigAmounts = [...r.amounts].sort((a, b) => crore(b) - crore(a)).slice(0, 30);
  const ocr = all.docs.filter((d) => d.ocr).length;
  const docOf = (src: string) => r.docs.get(src);
  const isOcr = (src: string) => !!r.docs.get(src)?.ocr;
  const ocrN = (rows: Array<{ src: string }>) => rows.filter((x) => isOcr(x.src)).length;
  const Tag = ({ src }: { src: string }) => (isOcr(src) ? <span className="mono ml-1 text-[9.5px]" style={{ color: "var(--s-hot)" }} title="Read from a scan by OCR: the quote matches the machine's reading of the page.">OCR</span> : null);

  let n = 0;
  return (
    <article className="pt-6">
      <MinistryTabs active="home" />
      <Eyebrow tone="hot">Ministry of Home Affairs · Monthly Major Achievements</Eyebrow>
      <h1 className="story-display mt-3 max-w-[24ch] text-[32px] sm:text-[44px]">Ten years of the Home Ministry&apos;s monthly reports, read</h1>
      <Standfirst>
        Each month the Home Ministry publishes a numbered list of what it did. {all.docs.length} of those reports, from {reports[0]?.month} to {reports.at(-1)?.month},
        are pinned in this repository as the PDFs the ministry published. The reports are prose, not statistics, so this page draws only what can be counted or quoted
        exactly — and every quote below was re-found in its report before the page was built.
      </Standfirst>
      <div className="mt-7 grid gap-3 sm:grid-cols-4">
        <Stat size="md" label="Reports pinned" value={String(all.docs.length)} note={`${years.length} calendar years.`} />
        <Stat size="md" tone="hot" label="Reports read item by item" value={String(read.length)} note={`${all.docs.length - read.length} are scans, Hindi-only, or too damaged to number.`} />
        <Stat size="md" label="Items read" value={int(quoted.length)} note="Numbered paragraphs, each quoted." />
        <Stat size="md" label="Scans read by OCR" value={String(ocr)} note={r.failed.length ? `${r.failed.length} quotes failed the check and are not drawn.` : "Every quote passed the check."} />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card n={++n} title="Reports pinned, by year" what="Monthly reports the ministry has published and this repository holds. Twelve is a complete year." foot={`${all.docs.length} PDFs · mha.gov.in`}>
          <LabelBars bars={pinnedByYear} colour={C1} format={int} />
        </Card>
        <Card n={++n} title="Reports whose items could be read" what="Reports with an English text layer (or a legible scan) whose numbered paragraphs could be followed in order." read={`${ocr} reports are image-only scans with no text layer. They were read by OCR, and every figure taken from one is marked OCR: a machine can misread a digit, and the check only proves the quote matches its reading. Reports that still could not be followed are counted as unread rather than guessed.`} foot={`${read.length} of ${all.docs.length} reports`}>
          <LabelBars bars={readByYear} colour={C3} format={int} />
        </Card>
        <Card n={++n} wide title="Items reported, each month" what="The number of the last numbered paragraph in each report — a count anyone can redo by opening the PDF. Derived here." read="A count of entries, not a measure of work: one item can be a single meeting or a cabinet decision covering every state. Where a scan's text layer misreads a paragraph number, that paragraph is read with the one before it; the count is still the report's own last number. Gaps are months with no readable report." foot={`${read.length} reports · derived count`}>
          <MonthLines wide unit="items" format={int} lines={[{ label: "Items", colour: C1, points: itemsPerMonth }]} />
        </Card>
        <Card n={++n} title="What the items are about" what="Items mentioning each subject, all years. An item can mention several subjects, or none. Hover a label for the keyword rule." read={`${quoted.filter((i) => !i.themes.length).length} items match no rule. The rules are keyword lists, printed in the table below; they classify what an item mentions, not what it achieved.`} foot={`${quoted.length} items · keyword rules, derived`}>
          <HBars rows={themeTotals} colour={C1} />
        </Card>
        <Card n={++n} title="Bills given the President's assent, as the reports list them" what="Bills named in items about Presidential assent — mostly State Bills reserved for the President's consideration under Article 201, many on concurrent-list subjects." read="Counted only in reports that could be read; a year with few readable reports undercounts." foot={`${r.bills.length} Bills, each quoted · ${ocrN(r.bills)} by OCR · derived count`}>
          <LabelBars bars={billsByYear} colour={C2} format={int} />
        </Card>
        <Card n={++n} title="Whose Bills they were" what="The State named in each Bill's title. Top 14." foot={`${r.bills.length} Bills · derived`}>
          <HBars rows={stateRows} colour={C2} />
        </Card>
        <Card n={++n} wide title="Accused persons against whom prosecution was sanctioned under UAPA" what="The figure each report states for the month: “sanction for prosecution … against N accused persons … under the Unlawful Activities (Prevention) Act”." read={`Only months whose report states the figure. No report read after ${sanction.at(-1)?.month ?? "—"} states it; that is a change in what is reported, not evidence that sanctions stopped.`} foot={`${sanction.length} monthly figures, each quoted · ${ocrN(sanction)} read from scans by OCR`}>
          <MonthLines wide unit="persons" format={int} lines={[{ label: "Accused", colour: C4, points: sanction.map((s) => ({ m: s.month, v: s.v })) }]} />
        </Card>
        <Card n={++n} title="The same, totalled by year" what="Sum of the monthly figures the reports state, derived here. The bracket gives the number of months with a figure." read="A total over the months reported, not a year's total: a year with five reported months is five months' worth." foot="derived sum">
          <LabelBars bars={sanctionByYear} colour={C4} format={int} />
        </Card>
        <Card n={++n} title="Items invoking the UAPA, by what they record" what="Items naming the Unlawful Activities (Prevention) Act, sorted by printed rules: prosecution sanctioned; individuals designated terrorists; ban extended; declared unlawful." foot={`${r.uapa.length} items · keyword rules`}>
          <HBars rows={uapaKinds} colour={C4} />
        </Card>
        <Card n={++n} title="Rupee figures stated, by subject" what="How many crore or lakh amounts the items state, by the subject of the item. Counted, not summed: the amounts are sanctioned, released, recommended or project costs, and adding them would mix kinds." foot={`${r.amounts.length} amounts, each quoted · ${ocrN(r.amounts)} by OCR`}>
          <HBars rows={amountsByTheme} colour={C3} />
        </Card>
        <Card n={++n} title="Protected Area Permit applications granted" what="Permits for foreigners to visit protected areas, as the report states for its month." foot={`${stated("pap").length} monthly figures, each quoted · ${ocrN(stated("pap"))} by OCR`}>
          <LabelBars bars={stated("pap").map((s) => ({ label: s.month, v: s.v }))} colour={C1} format={int} />
        </Card>
        <Card n={++n} title="OCI cards issued in the month" what="Overseas Citizen of India cards, where a report states the month's total (cards issued in lieu of PIO cards excluded)." foot={`${stated("oci").length} monthly figures, each quoted · ${ocrN(stated("oci"))} by OCR`}>
          <LabelBars bars={stated("oci").map((s) => ({ label: s.month, v: s.v }))} colour={C3} format={int} />
        </Card>
      </div>

      <section className="mt-14 border-t pt-8" style={{ borderColor: "var(--story-rule)" }}>
        <Eyebrow>Subjects, year by year</Eyebrow>
        <p className="mt-3 max-w-[72ch] text-[13px] leading-[1.65]" style={{ color: "var(--story-ink-2)" }}>
          Share of each year&apos;s items that mention the subject, per cent. Derived from the keyword rules on the right, which match whole words in the item&apos;s English text.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead><tr className="text-left" style={{ color: "var(--story-ink-3)" }}><th className="py-1 pr-3">Subject</th>{readYears.map((y) => <th key={y} className="mono px-1 text-right">{y}</th>)}<th className="pl-3">Rule</th></tr></thead>
            <tbody>
              {file.themes.map((t) => (
                <tr key={t.id} className="border-t" style={{ borderColor: "var(--story-rule)" }}>
                  <td className="py-1 pr-3">{t.label}</td>
                  {readYears.map((y) => { const s = share(t.id, y); return (
                    <td key={y} className="mono px-1 text-right tabular-nums" style={{ background: s == null ? undefined : `color-mix(in srgb, var(--series-1) ${Math.min(70, s * 1.4)}%, transparent)` }}>{s == null ? "—" : s.toFixed(0)}</td>
                  ); })}
                  <td className="mono pl-3 text-[10px]" style={{ color: "var(--story-ink-3)", maxWidth: 320 }}>{t.rule}</td>
                </tr>
              ))}
              <tr className="border-t" style={{ borderColor: "var(--story-rule)", color: "var(--story-ink-3)" }}>
                <td className="py-1 pr-3">Items read</td>
                {readYears.map((y) => <td key={y} className="mono px-1 text-right">{quoted.filter((i) => i.month.startsWith(y)).length}</td>)}
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-14 border-t pt-8" style={{ borderColor: "var(--story-rule)" }}>
        <Eyebrow>The largest rupee figures, in the reports&apos; words</Eyebrow>
        <p className="mt-3 max-w-[72ch] text-[13px] leading-[1.65]" style={{ color: "var(--story-ink-2)" }}>
          Thirty largest of {r.amounts.length} amounts, in ₹ crore (lakh converted at 100 lakh to a crore). The quote is the report&apos;s own text around the figure.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead><tr className="text-left" style={{ color: "var(--story-ink-3)" }}><th className="py-1 pr-3">Month</th><th className="pr-3 text-right">₹ crore</th><th className="pr-3">The report says</th><th>Report</th></tr></thead>
            <tbody>
              {bigAmounts.map((a, i) => (
                <tr key={i} className="border-t align-top" style={{ borderColor: "var(--story-rule)" }}>
                  <td className="mono py-1 pr-3">{a.month}</td>
                  <td className="mono pr-3 text-right font-semibold">{int(crore(a))}<Tag src={a.src} /></td>
                  <td className="pr-3" style={{ color: "var(--story-ink-2)" }}>&ldquo;…{a.quote}…&rdquo;</td>
                  <td><a className="underline decoration-dotted" href={docOf(a.src)?.url} target="_blank" rel="noopener noreferrer">PDF</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-14 border-t pt-8" style={{ borderColor: "var(--story-rule)" }}>
        <Eyebrow>Bills given assent</Eyebrow>
        <div className="mt-4 max-h-[420px] overflow-auto">
          <table className="w-full text-[12px]">
            <thead><tr className="text-left" style={{ color: "var(--story-ink-3)" }}><th className="py-1 pr-3">Report month</th><th className="pr-3">Bill, as named in the report</th><th>Report</th></tr></thead>
            <tbody>
              {[...r.bills].sort((a, b) => b.month.localeCompare(a.month)).map((b, i) => (
                <tr key={i} className="border-t" style={{ borderColor: "var(--story-rule)" }}>
                  <td className="mono py-1 pr-3">{b.month}</td><td className="pr-3">{b.name}<Tag src={b.src} /></td>
                  <td><a className="underline decoration-dotted" href={docOf(b.src)?.url} target="_blank" rel="noopener noreferrer">PDF</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-14 border-t pt-8" style={{ borderColor: "var(--story-rule)" }}>
        <Eyebrow>Actions under the UAPA, in the reports&apos; words</Eyebrow>
        <div className="mt-4 max-h-[420px] overflow-auto">
          <table className="w-full text-[12px]">
            <thead><tr className="text-left" style={{ color: "var(--story-ink-3)" }}><th className="py-1 pr-3">Month</th><th className="pr-3">Kind</th><th className="pr-3">The report says</th></tr></thead>
            <tbody>
              {[...r.uapa].filter((u) => u.kind !== "prosecution sanctioned").sort((a, b) => b.month.localeCompare(a.month)).map((u, i) => (
                <tr key={i} className="border-t align-top" style={{ borderColor: "var(--story-rule)" }}>
                  <td className="mono py-1 pr-3">{u.month}</td><td className="pr-3">{u.kind}<Tag src={u.src} /></td>
                  <td style={{ color: "var(--story-ink-2)" }}>&ldquo;{u.quote}…&rdquo; <a className="underline decoration-dotted" href={docOf(u.src)?.url} target="_blank" rel="noopener noreferrer">PDF</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>Prosecution sanctions are charted above and left out of this list.</p>
      </section>

      <section className="mt-14 border-t pt-8" style={{ borderColor: "var(--story-rule)" }}>
        <Eyebrow>The reports, pinned</Eyebrow>
        <p className="mt-3 max-w-[72ch] text-[13px] leading-[1.65]" style={{ color: "var(--story-ink-2)" }}>
          A scheduled job downloads each report from mha.gov.in, saves the PDF in this repository with its SHA-256, and extracts its text (OCR for scans that have none, marked below).
          The reading rules are in <code>scripts/etl/ministry/extract_mha.py</code>.
        </p>
        <div className="mt-4 max-h-[520px] overflow-auto">
          <table className="w-full text-[12px]">
            <thead><tr className="text-left" style={{ color: "var(--story-ink-3)" }}><th className="py-1 pr-3">Month</th><th className="pr-3">Report</th><th className="pr-3">Items</th><th className="pr-3">Pinned copy</th><th>SHA-256</th></tr></thead>
            <tbody>
              {[...all.docs].sort((a, b) => (mhaMonth(b.title) ?? "").localeCompare(mhaMonth(a.title) ?? "")).map((d) => {
                const rep = file.reports.find((x) => x.src === d.id);
                return (
                  <tr key={d.id} className="border-t" style={{ borderColor: "var(--story-rule)" }}>
                    <td className="mono py-1 pr-3">{mhaMonth(d.title)}</td>
                    <td className="pr-3"><a className="underline decoration-dotted" href={d.url} target="_blank" rel="noopener noreferrer">{d.title}</a>{d.ocr ? <span className="mono ml-1 text-[10px]" style={{ color: "var(--s-hot)" }}>OCR</span> : null}</td>
                    <td className="mono pr-3">{rep?.readable ? rep.items : "unread"}</td>
                    <td className="pr-3">{d.file ? <a className="underline decoration-dotted" href={REPO + d.file} target="_blank" rel="noopener noreferrer">{d.file.split("/").pop()}</a> : "—"}</td>
                    <td className="mono" style={{ color: "var(--story-ink-3)" }}>{d.sha256?.slice(0, 12)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </article>
  );
}
