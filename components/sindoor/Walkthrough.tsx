"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * The scroll-scrubbed walkthrough.
 *
 * A stack of rendered frames pinned in the viewport while the reader scrolls
 * past a column of beats. The frame swaps as each beat comes into view, so the
 * camera appears to move around the region while the argument stays legible.
 *
 * ── The one thing this must not do ───────────────────────────────────────
 *
 * It must not animate an attack. There are no arcs from launch point to
 * target, no impact flashes, no counters climbing. What was hit, in what
 * order, and to what effect are precisely the questions the Indian and
 * Pakistani accounts answer differently, and motion is the most persuasive
 * possible way to assert a sequence — a reader who watches a line travel from
 * A to B has been told that it did, by something that never cited anything.
 *
 * So the only thing that moves is the viewpoint. Sites are marked where they
 * are; who says what happened at them is printed, attributed, in the column.
 *
 * ── Why the images are all mounted ───────────────────────────────────────
 *
 * Every frame renders at once, stacked, with opacity switching between them.
 * Swapping a single `src` instead would show the paper background on every
 * change while the next frame decoded — a flicker on each beat, which on a
 * page about a four-day sequence reads as the sequence stuttering. Seventeen
 * WebPs of flat art are about half a megabyte in total, which is less than
 * one photograph.
 */

export interface Beat {
  id: string;
  date: string;
  label: string;
  what: string;
  tier: string;
  chapter: string;
  page: number | null;
}

export interface Site {
  id: string;
  name: string;
  town?: string;
  kind: "camp" | "base";
  /** Percent position within the frame, if the page knows it. Sites without
   *  one are listed rather than pinned — never placed approximately. */
  at?: { x: number; y: number };
}

const TIER_LABEL: Record<string, string> = {
  "india-official": "India, officially",
  author: "The author's account",
  "pakistan-concession": "Conceded by a Pakistani source",
  "third-party": "A third party",
  contested: "The accounts conflict",
};

const TIER_TONE: Record<string, string> = {
  "india-official": "var(--s-mid)",
  author: "var(--story-ink-2)",
  "pakistan-concession": "var(--s-hot)",
  "third-party": "var(--s-cool)",
  contested: "var(--s-hot)",
};

export default function Walkthrough({
  frames,
  beats,
  basePath = "/sindoor",
}: {
  frames: string[];
  beats: Beat[];
  basePath?: string;
}) {
  const [active, setActive] = useState(0);
  const stepRefs = useRef<Array<HTMLLIElement | null>>([]);

  /*
   * Each beat gets the frame at its proportional position in the sequence, so
   * the camera walks the whole orbit however many beats there are. Computed
   * rather than hand-paired: pairing by hand goes stale the moment either list
   * changes length, and the failure is silent — a beat about Bahawalpur over a
   * frame of the north.
   */
  const frameFor = useMemo(() => {
    if (frames.length === 0 || beats.length === 0) return [] as number[];
    return beats.map((_, i) =>
      Math.min(frames.length - 1, Math.round((i / Math.max(1, beats.length - 1)) * (frames.length - 1))),
    );
  }, [frames.length, beats]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = Number((e.target as HTMLElement).dataset["step"]);
          if (Number.isFinite(i)) setActive(i);
        }
      },
      /* A band across the middle of the viewport: a beat becomes current when
         it reaches the reader's eye, not when its first pixel appears. */
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    for (const el of stepRefs.current) if (el) io.observe(el);
    return () => io.disconnect();
  }, [beats.length]);

  const shown = frameFor[active] ?? 0;

  return (
    <div className="relative mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* The pinned plate. On a phone it sits above the column rather than
          sticking, because a sticky half-screen image leaves no room to read. */}
      <div className="lg:sticky lg:top-20 lg:h-[72vh]">
        <div className="ink-plate relative aspect-[15/9] w-full overflow-hidden lg:h-full">
          {frames.map((f, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={f}
              src={`${basePath}/${f}.webp`}
              alt={
                i === shown
                  ? "An ink-drawn map of the India–Pakistan border region, with the sites named in the book marked as pins."
                  : ""
              }
              aria-hidden={i !== shown}
              loading={i < 2 ? "eager" : "lazy"}
              decoding="async"
              /*
               * Contain, not cover. The frames are drawings with their subject
               * at a known place in them; cover crops to fill, which sliced
               * India off the right-hand edge of its own map at the one aspect
               * ratio a phone actually has.
               */
              className="absolute inset-0 h-full w-full object-contain transition-opacity duration-500"
              style={{ opacity: i === shown ? 1 : 0 }}
            />
          ))}

          <div className="pointer-events-none absolute bottom-10 left-3 flex flex-wrap gap-1.5">
            <span className="ink-note px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: "var(--s-hot)" }}>
              ● sites named for 7 May
            </span>
            <span className="ink-note px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: "var(--s-mid)" }}>
              ● sites named for 9–10 May
            </span>
          </div>

          <p className="ink-hand pointer-events-none absolute bottom-2.5 right-3 text-[15px] opacity-80">
            drawn from the data, not from a photograph
          </p>
        </div>
        <p className="mt-2 text-[11px] leading-[1.5]" style={{ color: "var(--story-ink-3)" }}>
          Country shapes: Natural Earth. Pin positions: each place resolved against Wikipedia by the
          connector, never typed. Nothing on this drawing depicts an impact, a blast or a loss —
          those are the contested questions, and a drawing asserts without sourcing.
        </p>
      </div>

      {/* The column of beats. */}
      <ol className="space-y-6">
        {beats.map((b, i) => (
          <li
            key={b.id}
            ref={(el) => { stepRefs.current[i] = el; }}
            data-step={i}
            className="ink-note p-5 transition-opacity duration-300"
            data-tilt={i % 2 === 0 ? "l" : "r"}
            style={{ opacity: i === active ? 1 : 0.55 }}
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="mono text-[11px] font-semibold tabular-nums" style={{ color: "var(--story-ink-3)" }}>
                {b.date}
              </span>
              <span
                className="mono text-[10px] font-bold uppercase tracking-[0.1em]"
                style={{ color: TIER_TONE[b.tier] ?? "var(--story-ink-2)" }}
              >
                {TIER_LABEL[b.tier] ?? b.tier}
              </span>
            </div>
            <h3 className="ink-hand mt-1.5 text-[26px] leading-[1.1]">{b.label}</h3>
            <div className="ink-rule mt-2 w-24" aria-hidden />
            <p className="mt-2.5 text-[13.5px] leading-[1.62]" style={{ color: "var(--story-ink-2)" }}>
              {b.what}
            </p>
            <p className="mono mt-2.5 text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>
              {b.chapter}{b.page !== null ? `, p${b.page}` : ""}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
