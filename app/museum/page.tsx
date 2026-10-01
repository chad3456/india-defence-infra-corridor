import { loadMuseum } from "@/lib/museum";
import { MuseumGallery } from "@/components/museum/MuseumGallery";

/**
 * The museum of Indian painting: a walkable gallery and its catalogue.
 *
 * What hangs is decided by the record — paintings Wikidata attributes to each
 * room's artist or school, or images in the school's Commons categories —
 * and only where Commons records the image as free to reuse. The order in
 * each room is the record's too: Wikipedia languages with an article on the
 * work, or for Commons-only works, Wikimedia pages that use the image. See
 * scripts/etl/connectors/museum.ts.
 */

export const metadata = {
  title: "The Museum of Indian Painting · Bharat Tracker",
  description:
    "Walk a virtual gallery of Indian painting — the Mughal court, Rajput and Pahari courts, the Deccan, Company painting, "
    + "Kalighat, Raja Ravi Varma, the Bengal School and Amrita Sher-Gil — with every work's licence and source.",
};

export default function MuseumPage() {
  const v = loadMuseum();
  const year = new Date().getUTCFullYear();
  return (
    <div className="mu">
      <header className="mu-top">
        <p className="mu-kicker">Bharat Tracker · a museum you can walk</p>
        <h1>The Museum of Indian Painting</h1>
        <p className="mu-stand">
          From the Mughal workshops to Amrita Sher-Gil{v.present ? <>: {v.total} paintings in {v.rooms.length} rooms</> : null}. Every one is out of copyright or freely licensed, and every label says where the picture comes from.
        </p>
      </header>

      {!v.present ? (
        <section className="mu-section"><p>The collection is being assembled from Wikidata and Wikimedia Commons by a scheduled job, and has not arrived yet.</p></section>
      ) : (
        <>
          <MuseumGallery rooms={v.rooms} />

          <section className="mu-section">
            <h2>The catalogue</h2>
            <p className="mu-lede">Every painting on the walls, room by room, in the order it hangs.</p>
            {v.rooms.map((r) => (
              <div key={r.id} className="mu-room">
                <h3 style={{ borderColor: r.wall }}>{r.title} <small>{r.line}</small></h3>
                <div className="mu-grid">
                  {r.works.map((w) => (
                    <figure key={w.qid} className="mu-card">
                      <a href={w.image.page} target="_blank" rel="noreferrer" className="mu-frame">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={w.image.thumb} alt={w.title} loading="lazy" width={w.image.width} height={w.image.height} />
                      </a>
                      <figcaption>
                        <b>{w.title}</b>
                        <span>{[w.artist, w.year].filter(Boolean).join(", ") || "Artist unrecorded"}</span>
                        {w.collection && <span className="mu-coll">{w.collection}</span>}
                        <span className="mu-lic">{w.image.license}</span>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="mu-section">
            <h2>Not on these walls — yet</h2>
            <p className="mu-lede">
              The great modern painters are still in copyright, and a museum that cannot show a picture should say so rather than borrow it. Under the Copyright Act, 1957, a painting is protected for sixty years from the start of the year after its artist&rsquo;s death. The years below are computed from the death dates Wikidata records.
            </p>
            <div className="mu-notyet">
              {v.notYet.map((a) => (
                <a key={a.name} href={a.url} className="mu-ny" target="_blank" rel="noreferrer">
                  <b>{a.name}</b>
                  <span>{a.born ?? "?"}–{a.died ?? ""}</span>
                  <em>{a.freeIn === null ? "Living, or no death date recorded" : a.freeIn <= year ? "Now free" : `Free in India from ${a.freeIn}`}</em>
                </a>
              ))}
            </div>
          </section>

          <section className="mu-section mu-sources">
            <h2>How this museum was hung</h2>
            <ul>
              <li><b>What hangs.</b> Paintings <a href="https://www.wikidata.org/">Wikidata</a> attributes to each room&rsquo;s artist (creator, P170) or school (movement, P135) and illustrates with an image; for the schools, also the images in the school&rsquo;s categories on <a href="https://commons.wikimedia.org/">Wikimedia Commons</a>, whose titles and dates come from each file&rsquo;s own description.</li>
              <li><b>What is allowed.</b> Every image&rsquo;s licence was asked of Commons, file by file. Only public domain and free Creative Commons licences hang; {v.refused} images were refused for their licence. The licence and credit are on every label.</li>
              <li><b>What &ldquo;best&rdquo; means here.</b> Not a curator&rsquo;s eye. Works from Wikidata are ordered by how many Wikipedia languages have an article on them; works found only on Commons, by how many Wikimedia pages use the image. Each room hangs its first twenty-four.</li>
              <li><b>What it cannot say.</b> A museum&rsquo;s greatest works are often unphotographed or unlicensed, and the open record favours what is already famous. A painting missing here is missing from the record, not judged lesser.</li>
              <li><b>The images</b> are Wikimedia Commons renditions, loaded from Wikimedia&rsquo;s servers, never altered, cropped or recoloured. Collected {v.generatedAt ? new Date(v.generatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—"}.</li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
