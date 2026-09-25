"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { inTerm, type MelaPayload } from "@/lib/mela-shared";
import World, { PLACE, STAND, START_X, type TermKey } from "./World";
import Panel from "./Panel";

/**
 * The mela's controller: which term is showing, which stall is open, and
 * where the guide is standing.
 *
 * The guide is the navigation, not decoration. Choosing a stall walks him to
 * it — the world is wide and a jump would lose the reader — and only when he
 * arrives does the stall's panel open, so the eye follows him to the place
 * the panel is about.
 */

const TOUR = ["finance", "defence", "manufacturing", "innovation", "education", "infrastructure", "rural", "women", "health", "digital", "trade"];
const WALK_MS = 1150;

const TICKETS: Array<{ key: TermKey; label: string; years: string; tone: string }> = [
  { key: "all", label: "All three terms", years: "2014–2026", tone: "var(--paper-2)" },
  { key: "I", label: "Term I", years: "May 2014 – May 2019", tone: "var(--term-1-fill)" },
  { key: "II", label: "Term II", years: "May 2019 – Jun 2024", tone: "var(--term-2-fill)" },
  { key: "III", label: "Term III", years: "Jun 2024 –", tone: "var(--term-3-fill)" },
];

export default function Mela({ data, intro }: { data: MelaPayload; intro: string }) {
  const [term, setTerm] = useState<TermKey>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [guideX, setGuideX] = useState(START_X);
  const [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState<1 | -1>(1);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const byId = useMemo(() => new Map(data.stalls.map((s) => [s.id, s])), [data.stalls]);
  const worldStalls = useMemo(() => data.stalls.map((s) => ({
    id: s.id, name: s.name, sfx: s.sfx,
    count: s.programmes.filter((p) => inTerm(p.term, term)).length,
  })), [data.stalls, term]);

  /* Keep the guide in view when the world is wider than the screen. */
  const follow = useCallback((x: number) => {
    const f = frameRef.current;
    if (!f || f.scrollWidth <= f.clientWidth + 2) return;
    const scale = f.scrollWidth / 1600;
    f.scrollTo({ left: Math.max(0, x * scale - f.clientWidth / 2), behavior: "smooth" });
  }, []);

  const go = useCallback((id: string) => {
    const stand = STAND[id];
    if (stand === undefined) return;
    const target = Math.min(1530, Math.max(70, stand));
    if (timer.current) clearTimeout(timer.current);
    setSelected(id);
    setFacing(target < guideX ? -1 : target > guideX ? 1 : facing);
    const moving = Math.abs(target - guideX) > 4;
    setWalking(moving);
    setGuideX(target);
    follow(target);
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    timer.current = setTimeout(() => {
      setWalking(false);
      /* On arrival he turns to the stall he is about to describe, rather than
         keeping his back to it in the direction he happened to be walking. */
      const stallX = PLACE[id]?.x;
      if (stallX !== undefined) setFacing(stallX < target ? -1 : 1);
      setOpen(id);
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" }));
    }, moving && !reduced ? WALK_MS : 0);
  }, [guideX, follow, facing]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  /* On a narrow screen, open the world centred on the guide, not on its left edge. */
  useEffect(() => {
    const f = frameRef.current;
    if (!f || f.scrollWidth <= f.clientWidth + 2) return;
    f.scrollLeft = Math.max(0, START_X * (f.scrollWidth / 1600) - f.clientWidth / 2);
  }, []);

  const step = (d: 1 | -1) => {
    const i = selected ? TOUR.indexOf(selected) : -1;
    const next = TOUR[(i + d + TOUR.length) % TOUR.length];
    if (next) go(next);
  };

  const current = open ? byId.get(open) ?? null : null;
  const narration = walking ? "This way…" : current ? current.narration : intro;

  return (
    <div>
      {/* ── Term tickets ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2.5" role="group" aria-label="Choose a term">
        {TICKETS.map((t) => (
          <button key={t.key} type="button" aria-pressed={term === t.key} onClick={() => setTerm(t.key)}
            className="manga-ticket px-3.5 py-2 text-left" style={{ background: t.tone, color: "var(--ink)" }}>
            <span className="manga-title block text-[16px]">{t.label}</span>
            <span className="mono block text-[10px]" style={{ color: "var(--story-ink-2)" }}>{t.years}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>
        {term === "all"
          ? "Morning at the mela. Choose a term to change the time of day and count what was launched in it."
          : term === "I" ? "Morning: the first term. Each sign counts the programmes launched in it."
          : term === "II" ? "Golden hour: the second term. Each sign counts the programmes launched in it."
          : "Lantern night: the third term, still running. Each sign counts the programmes launched in it."}
      </p>

      {/* ── The world ────────────────────────────────────────────── */}
      <div ref={frameRef} className="mela-frame mt-4">
        <World stalls={worldStalls} selected={selected} term={term} guideX={guideX}
          walking={walking} talking={!walking} facing={facing} onSelect={go} />
      </div>

      {/* ── The guide's line ─────────────────────────────────────── */}
      <div className="mt-6 flex flex-wrap items-end gap-4">
        <div className="manga-bubble max-w-[60ch] flex-1">
          <p className="text-[14.5px] font-semibold leading-[1.5]">{narration}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => step(-1)} className="manga-ticket px-3 py-2 text-[13px] font-bold"
            style={{ background: "var(--paper)", color: "var(--ink)" }} aria-label="Previous stall">‹ Back</button>
          <button type="button" onClick={() => step(1)} className="manga-ticket px-4 py-2 text-[13px] font-bold"
            style={{ background: "#ffe27a", color: "#16101f" }}>
            {selected ? "Next stall ›" : "Take the tour ›"}
          </button>
        </div>
      </div>
      <p className="mt-3 text-[11px]" style={{ color: "var(--story-ink-3)" }}>
        The guide is a cartoon. His lines are this site&rsquo;s narration — directions around the fair — and are not
        quotations of anyone.
      </p>

      {/* ── A plain list, for anyone who would rather not play ──── */}
      <nav className="mt-5" aria-label="All stalls">
        <ul className="flex flex-wrap gap-1.5">
          {data.stalls.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => go(s.id)} aria-current={open === s.id}
                className="rounded-full border-2 px-3 py-1 text-[12px] font-semibold"
                style={{
                  borderColor: "var(--ink)",
                  background: open === s.id ? "var(--ink)" : "var(--paper)",
                  color: open === s.id ? "var(--paper)" : "var(--ink)",
                }}>
                {s.name}
                {term !== "all" && <span className="mono ml-1.5 opacity-70">{s.programmes.filter((p) => inTerm(p.term, term)).length}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div ref={panelRef} className="mt-8 scroll-mt-24">
        {current && <Panel key={current.id} stall={current} term={term} />}
      </div>
    </div>
  );
}
