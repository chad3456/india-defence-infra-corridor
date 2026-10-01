"use client";

/**
 * The walkable gallery at the top of /museum, and the label card a tapped
 * painting opens. Everything on the card is the record's: Wikidata's or the
 * Commons file's own description, with the licence and credit Commons gives.
 */
import { useEffect, useRef, useState } from "react";
import type { Gallery, Hang } from "./gallery";
import type { GalleryRoom } from "@/lib/museum-shared";

export function MuseumGallery({ rooms }: { rooms: GalleryRoom[] }) {
  const host = useRef<HTMLDivElement>(null);
  const g = useRef<Gallery | null>(null);
  const [room, setRoom] = useState(0);
  const [pick, setPick] = useState<Hang | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    (async () => {
      try {
        const { createGallery } = await import("./gallery");
        if (!alive || !host.current) return;
        g.current = createGallery(host.current, rooms, { onRoom: setRoom, onPick: setPick }, reduced);
      } catch { setFailed(true); }
    })();
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, select, textarea")) return;
      if (e.key === "Escape") setPick(null);
      else if (e.key === "ArrowUp" || e.key === "w") { e.preventDefault(); g.current?.step(1); }
      else if (e.key === "ArrowDown" || e.key === "s") { e.preventDefault(); g.current?.step(-1); }
      else if (e.key === "PageDown") { e.preventDefault(); setRoom((r) => { g.current?.goRoom(r + 1); return r; }); }
      else if (e.key === "PageUp") { e.preventDefault(); setRoom((r) => { g.current?.goRoom(r - 1); return r; }); }
    };
    window.addEventListener("keydown", onKey);
    return () => { alive = false; window.removeEventListener("keydown", onKey); g.current?.dispose(); g.current = null; };
  }, [rooms]);

  const r = rooms[room];
  const w = pick ? rooms[pick.room]?.works[pick.work] : null;

  return (
    <div className="mu-hall">
      <div ref={host} className="mu-stage" role="img" aria-label="A walkable 3D gallery of Indian paintings, room by room" />
      {failed && <p className="mu-fallback">This gallery needs WebGL. Every painting is in the catalogue below.</p>}

      {r && (
        <div className="mu-where" aria-live="polite">
          <span className="mu-where-n">Room {room + 1} of {rooms.length}</span>
          <span className="mu-where-t">{r.title}</span>
        </div>
      )}

      <div className="mu-controls">
        <button onClick={() => g.current?.goRoom(room - 1)} disabled={room === 0} aria-label="Previous room">‹ Room</button>
        <button onClick={() => g.current?.step(-1)} aria-label="Step back">Back</button>
        <button className="on" onClick={() => g.current?.step(1)} aria-label="Walk forward">Walk</button>
        <button onClick={() => g.current?.goRoom(room + 1)} disabled={room >= rooms.length - 1} aria-label="Next room">Room ›</button>
      </div>
      <nav className="mu-rooms" aria-label="Rooms">
        {rooms.map((x, k) => (
          <button key={x.id} className={k === room ? "on" : ""} onClick={() => g.current?.goRoom(k)} title={x.title}>
            <i style={{ background: x.wall }} />{x.title}
          </button>
        ))}
      </nav>
      <p className="mu-hint">Drag to look around · tap a painting to step up to it · ↑ ↓ to walk</p>

      {w && (
        <aside className="mu-label" aria-live="polite">
          <button className="mu-close" onClick={() => setPick(null)} aria-label="Close">×</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={w.image.thumb} alt={w.title} />
          <h3>{w.title}</h3>
          <p className="mu-label-by">{[w.artist, w.year].filter(Boolean).join(", ") || "Artist unrecorded"}</p>
          <dl>
            {w.medium && <><dt>Medium</dt><dd>{w.medium}</dd></>}
            {w.collection && <><dt>Collection</dt><dd>{w.collection}</dd></>}
            <dt>Licence</dt><dd>{w.image.license}</dd>
            {w.image.credit && <><dt>Credit</dt><dd>{w.image.credit}</dd></>}
          </dl>
          <p className="mu-label-links">
            <a href={w.image.page} target="_blank" rel="noreferrer">Image on Wikimedia Commons ↗</a>
            {w.qid.startsWith("Q") && <> · <a href={`https://www.wikidata.org/wiki/${w.qid}`} target="_blank" rel="noreferrer">Record on Wikidata ↗</a></>}
          </p>
        </aside>
      )}
    </div>
  );
}
