import { loadNamesakes, type FigureCount, type NsView } from "@/lib/namesakes";
import { FIGURES, CATEGORY_LABEL, TIER_LABEL, type Category } from "@/lib/namesakes-shared";
import { NamesakesBoard, type BoardPlace } from "@/components/namesakes/NamesakesBoard";
import { NamesakesList } from "@/components/namesakes/NamesakesList";
import { figureIcon } from "@/components/namesakes/Doodles";

/**
 * Named after whom? Places named after Ram, Krishna, Hanuman and the other
 * gods, and places and institutions named after Mahatma, Indira and Rajiv
 * Gandhi.
 *
 * ── The rule this page is built on ───────────────────────────────────────
 *
 * A place is pinned for a figure only on evidence a reader can open: Wikidata's
 * "named after", a sentence in its Wikipedia article (printed verbatim), or —
 * for the Gandhis only — the full name in the place's own name. Spelling alone
 * never pins anything; see scripts/etl/connectors/namesakes.ts. Every number
 * here is a count of rows in data/namesakes/namesakes.json, computed in
 * lib/namesakes.ts. The prose writes no number of its own.
 *
 * ── The register ─────────────────────────────────────────────────────────
 *
 * Hand-drawn board game: paper, ink outlines, hard shadows, chunky type. The
 * fun is in the form; the claims stay as careful as the rest of the site.
 */

export const metadata = {
  title: "Named after whom? The gods and the Gandhis on India's map · Bharat Tracker",
  description:
    "A playable 3D map of places named after Ram, Krishna, Hanuman and the other gods, and of the airports, "
    + "universities, hospitals, stadiums and roads named after Mahatma, Indira and Rajiv Gandhi — each with the proof.",
};

const GANDHIS = ["mahatma", "indira", "rajiv"] as const;
const GANDHI_COLOURS: Record<string, string> = { mahatma: "#b8760a", indira: "#c8367a", rajiv: "#2f7fd0" };
const fmt = (n: number) => n.toLocaleString("en-IN");
/** Each place is counted once, at its strongest proof. */
const TIER_SHORT = { stated: "on Wikidata", quoted: "quoted from Wikipedia", named: "by full name" } as const;

function count(v: NsView, id: string): FigureCount {
  const c = v.counts.find((x) => x.id === id);
  if (!c) throw new Error(`namesakes page needs figure "${id}", which the data does not carry`);
  return c;
}

/** Grouped horizontal bars: what each Gandhi's name is on. */
function GandhiKinds({ v }: { v: NsView }) {
  const cats = [...new Set(GANDHIS.flatMap((g) => Object.keys(count(v, g).byCategory)))] as Category[];
  const total = (c: Category) => GANDHIS.reduce((s, g) => s + (count(v, g).byCategory[c] ?? 0), 0);
  cats.sort((a, b) => total(b) - total(a));
  const max = Math.max(1, ...cats.flatMap((c) => GANDHIS.map((g) => count(v, g).byCategory[c] ?? 0)));
  return (
    <figure className="ns-chart">
      <figcaption className="ns-chart-title">What each Gandhi&rsquo;s name is on</figcaption>
      <div className="ns-legend">
        {GANDHIS.map((g) => (
          <span key={g}><i style={{ background: GANDHI_COLOURS[g] }} />{count(v, g).name}</span>
        ))}
      </div>
      <div className="ns-groups">
        {cats.map((c) => (
          <div key={c} className="ns-group">
            <div className="ns-group-label">{CATEGORY_LABEL[c]}</div>
            {GANDHIS.map((g) => {
              const n = count(v, g).byCategory[c] ?? 0;
              return (
                <div key={g} className="ns-bar-row" title={`${count(v, g).name} · ${CATEGORY_LABEL[c]}: ${fmt(n)}`}>
                  <span className="ns-bar" style={{ width: `${(n / max) * 100}%`, background: GANDHI_COLOURS[g] }} />
                  <span className="ns-bar-val">{fmt(n)}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="ns-note">{GANDHIS.some((g) => (v.schemes[g] ?? 0) > 0) && <>Not counted here, because they are not places: {GANDHIS.filter((g) => (v.schemes[g] ?? 0) > 0).map((g) => `${fmt(v.schemes[g] ?? 0)} schemes, awards and programmes named after ${count(v, g).name}`).join("; ")}. </>}Counts of places on the board, each counted once per Gandhi. &ldquo;What it is&rdquo; is read from the place&rsquo;s Wikidata class; an item with no usable class is &ldquo;something else&rdquo;.</p>
    </figure>
  );
}

/** One bar per god: how many places are provably named after each. */
function GodBars({ v }: { v: NsView }) {
  const gods = v.counts.filter((c) => c.kind === "god").sort((a, b) => b.total - a.total);
  const max = Math.max(1, ...gods.map((g) => g.total));
  return (
    <figure className="ns-chart">
      <figcaption className="ns-chart-title">Places named after each god, on proof</figcaption>
      <div className="ns-bars">
        {gods.map((g) => (
          <div key={g.id} className="ns-bar-line" title={`${g.name}: ${fmt(g.total)} (${fmt(g.byTier.stated)} on Wikidata, ${fmt(g.byTier.quoted)} quoted from Wikipedia)`}>
            <span className="ns-bar-name">{g.name}</span>
            <span className="ns-bar-track"><span className="ns-bar ink" style={{ width: `${(g.total / max) * 100}%` }} /></span>
            <span className="ns-bar-val">{fmt(g.total)}</span>
          </div>
        ))}
      </div>
      <p className="ns-note">
        Temples are not in these counts. {Object.values(v.temples).reduce((a, b) => a + b, 0) > 0 && <>A further {fmt(Object.values(v.temples).reduce((a, b) => a + b, 0))} temples and shrines matched, and were set aside: a temple is dedicated to its god, a different claim from a town being named after one.</>}
      </p>
    </figure>
  );
}

function Roads({ v }: { v: NsView }) {
  if (!v.roads) {
    return <p className="ns-note">The road count did not arrive in the latest run — OpenStreetMap&rsquo;s query service was busy. It is retried on every run.</p>;
  }
  const by = new Map(v.roads.map((r) => [r.figure, r]));
  const mg = by.get("mahatma");
  const states = mg ? Object.entries(mg.byState).filter(([s]) => s !== "Unplaced").sort((a, b) => b[1] - a[1]).slice(0, 8) : [];
  const max = Math.max(1, ...states.map(([, n]) => n));
  return (
    <>
      <div className="ns-tiles">
        {(["mahatma", "indira", "rajiv", "gandhi"] as const).map((f) => {
          const r = by.get(f);
          if (!r) return null;
          return (
            <div key={f} className="ns-card ns-tile">
              <div className="ns-tile-icon">{figureIcon(f === "gandhi" ? "all" : f, 34)}</div>
              <div className="ns-tile-num">{fmt(r.roads)}</div>
              <div className="ns-tile-label">
                {f === "mahatma" ? "M.G. Roads and Mahatma Gandhi Margs" : f === "indira" ? "Indira Gandhi roads" : f === "rajiv" ? "Rajiv Gandhi roads and salais" : "roads called just “Gandhi Road” — which Gandhi, the name does not say"}
              </div>
              <div className="ns-tile-sub">from {fmt(r.ways)} mapped road pieces</div>
            </div>
          );
        })}
      </div>
      {states.length > 0 && (
        <figure className="ns-chart">
          <figcaption className="ns-chart-title">Where the Mahatma&rsquo;s roads are: the eight states with the most</figcaption>
          <div className="ns-bars">
            {states.map(([s, n]) => (
              <div key={s} className="ns-bar-line" title={`${s}: ${fmt(n)}`}>
                <span className="ns-bar-name">{s}</span>
                <span className="ns-bar-track"><span className="ns-bar" style={{ width: `${(n / max) * 100}%`, background: GANDHI_COLOURS.mahatma }} /></span>
                <span className="ns-bar-val">{fmt(n)}</span>
              </div>
            ))}
          </div>
        </figure>
      )}
      <p className="ns-note">
        <b>Derived, and an estimate.</b> OpenStreetMap stores a road as many short pieces. Pieces with the same name whose centres chain within 1.5&nbsp;km are counted as one road. A road broken by a long unnamed stretch counts twice; two same-named roads side by side count once. Only roads whose mapped English name carries the Gandhi&rsquo;s name are found — a road signed only in Hindi or Tamil is missed.
      </p>
    </>
  );
}

function Lookalikes({ v }: { v: NsView }) {
  return (
    <div className="ns-looks">
      {v.lookalikes.map((l) => (
        <a key={l.title} className="ns-card ns-look" href={l.url} target="_blank" rel="noreferrer">
          <div className="ns-look-name">{l.name}</div>
          {l.state && <div className="ns-look-state">{l.state}</div>}
          {l.quote ? <q>{l.quote}</q> : <p className="ns-look-none">Its article states no namesake.</p>}
          <span className="ns-look-src">Wikipedia ↗</span>
        </a>
      ))}
    </div>
  );
}

function NameCounts({ v }: { v: NsView }) {
  if (!v.nameCounts) return <p className="ns-note">The name count did not arrive in the latest run. It is retried on every run.</p>;
  const rows = [...v.nameCounts].sort((a, b) => b.places - a.places);
  return (
    <div className="ns-stems">
      {rows.map((r) => (
        <div key={r.stem} className="ns-card ns-stem">
          <div className="ns-stem-head"><b>{r.stem}…</b><span>{fmt(r.places)}</span></div>
          <div className="ns-stem-top">
            {r.top.slice(0, 6).map(([n, c]) => <span key={n} className="ns-chip">{n} <i>×{fmt(c)}</i></span>)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NamesakesPage() {
  const v = loadNamesakes();
  const figures = FIGURES.map((f) => ({ id: f.id, name: f.name, kind: f.kind }));
  const places: BoardPlace[] = v.places.map((p) => ({
    i: p.i, name: p.name, what: p.what, category: p.category, state: p.state, locatedIn: p.locatedIn,
    x: p.x, y: p.y, figures: p.figures, evidence: p.evidence, wikipedia: p.wikipedia,
  }));
  const krishnanagar = v.lookalikes.find((l) => l.title === "Krishnanagar")?.quote ?? null;

  return (
    <div className="ns">
      <header className="ns-top">
        <p className="ns-kicker">Bharat Tracker · a playable map</p>
        <h1>Named after whom?</h1>
        <p className="ns-stand">
          The towns named after Ram, Krishna and Hanuman — and the airports, universities, hospitals, stadiums and
          roads named after Mahatma, Indira and Rajiv Gandhi. Only the ones with proof.
        </p>
      </header>

      {!v.present ? (
        <section className="ns-card ns-empty">
          <h2>The board is being built</h2>
          <p>
            The data is gathered from Wikidata, Wikipedia and OpenStreetMap by a scheduled job, and has not arrived yet.
            Nothing is shown until it has, rather than a guess in its place.
          </p>
        </section>
      ) : (
        <>
          <NamesakesBoard shape={v.shape} places={places} figures={figures} krishnanagar={krishnanagar} />

          <section className="ns-section">
            <h2>The scoreboard</h2>
            <div className="ns-tiles">
              {["rama", "krishna", "hanuman", ...GANDHIS].map((id) => {
                const c = count(v, id);
                return (
                  <div key={id} className="ns-card ns-tile">
                    <div className="ns-tile-icon">{figureIcon(id, 34)}</div>
                    <div className="ns-tile-num">{fmt(c.total)}</div>
                    <div className="ns-tile-label">named after {c.name}</div>
                    <div className="ns-tile-sub">
                      {(Object.keys(c.byTier) as Array<keyof typeof c.byTier>).filter((t) => c.byTier[t] > 0).map((t) => `${fmt(c.byTier[t])} ${TIER_SHORT[t]}`).join(" · ")}
                    </div>
                  </div>
                );
              })}
            </div>
            <GandhiKinds v={v} />
            <GodBars v={v} />
          </section>

          <section className="ns-section">
            <h2>Every M.G. Road</h2>
            <p className="ns-lede">Roads are counted from OpenStreetMap by their names, separately from the board above, because most roads have no Wikidata item or article of their own.</p>
            <Roads v={v} />
          </section>

          <section className="ns-section">
            <h2>Looks like it, isn&rsquo;t — or might not be</h2>
            <p className="ns-lede">
              Places whose names contain a god&rsquo;s or a Gandhi&rsquo;s, with the first sentence in each one&rsquo;s own Wikipedia article that says where the name comes from, word for word. Read them before trusting a spelling.
            </p>
            <Lookalikes v={v} />
          </section>

          <section className="ns-section">
            <h2>A name is not a dedication</h2>
            <p className="ns-lede">
              How many towns, villages and neighbourhoods in OpenStreetMap have a name that <em>begins</em> with each word. This counts spellings, not namesakes: a Rampur may be named after Ram, after a raja called Ram, or after nobody the record remembers.
            </p>
            <NameCounts v={v} />
          </section>

          <section className="ns-section">
            <h2>Every place, as a list</h2>
            <p className="ns-lede">Including the ones that exist in the record without coordinates of their own — listed, not pinned to a guess.</p>
            <NamesakesList places={places} figures={figures} />
          </section>

          <section className="ns-section ns-method">
            <h2>How this was made, and what it cannot say</h2>
            <ul>
              <li><b>Three kinds of proof, never blended.</b> {TIER_LABEL.stated}: Wikidata&rsquo;s &ldquo;named after&rdquo; property points at the figure. {TIER_LABEL.quoted}: a sentence in the place&rsquo;s English Wikipedia article says it is named after, named for, or named in memory of the figure — and, for a god, the sentence also says it is the god (Lord, deity, temple, Ramayana and so on), so a zamindar&rsquo;s daughter called Radha does not count. {TIER_LABEL.named}: the Gandhis only — the full name, &ldquo;Rajiv Gandhi&rdquo;, in the place&rsquo;s own name.</li>
              <li><b>Checked by hand where the rules were unsure.</b> {fmt(v.held)} sentences named a god without saying it was the god, and are held back rather than pinned. {v.reviewed.rejected > 0 && <>{fmt(v.reviewed.rejected)} matches were removed after reading the sentence. </>}{v.reviewed.accepted > 0 && <>{fmt(v.reviewed.accepted)} held sentences were confirmed and added. </>}</li>
              <li><b>It is only as complete as the open record.</b> A town whose Wikipedia article does not say where its name comes from cannot be found this way, however well known the story. Hindi, Tamil and other-language Wikipedias are not read. So every count here is a floor, not a census.</li>
              <li><b>Temples are set aside.</b> A temple is dedicated to its god; that is a different claim from being named after one, and mixing them would bury the towns under thousands of shrines.</li>
              <li><b>Coordinates are the place&rsquo;s own.</b> Nothing is pinned to a state capital or a district centre when its own position is unknown.</li>
              <li><b>Sources.</b> <a href="https://www.wikidata.org/wiki/Property:P138">Wikidata property P138, &ldquo;named after&rdquo;</a>; <a href="https://en.wikipedia.org/">English Wikipedia</a> article text; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> via the Overpass API, © OpenStreetMap contributors (ODbL). Data gathered {v.generatedAt ? new Date(v.generatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—"}.</li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
