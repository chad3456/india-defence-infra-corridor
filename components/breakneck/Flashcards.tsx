"use client";

/**
 * Test yourself: guess each number before turning the card. Recall beats
 * re-reading for remembering a book; the cards hold the figures the page has
 * already drawn, with the page each comes from.
 */
import { useState } from "react";

export interface Flashcard { id: string; q: string; a: string; cite: string; ch: string }

export function Flashcards({ cards }: { cards: Flashcard[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const flip = (id: string) => setOpen((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  return (
    <div className="bk-flash">
      <div className="bk-flash-bar">
        <span>{open.size} of {cards.length} turned</span>
        <button type="button" onClick={() => setOpen(new Set())} disabled={open.size === 0}>Turn all back</button>
      </div>
      <ul className="bk-flash-grid">
        {cards.map((c) => {
          const on = open.has(c.id);
          return (
            <li key={c.id}>
              <button type="button" className={`bk-fc${on ? " on" : ""}`} onClick={() => flip(c.id)} aria-pressed={on}>
                <span className="bk-fc-ch">Chapter {c.ch}</span>
                <span className="bk-fc-q">{c.q}</span>
                {on ? (
                  <span className="bk-fc-a"><b>{c.a}</b><small>{c.cite}</small></span>
                ) : (
                  <span className="bk-fc-hint">Guess, then tap to turn</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
