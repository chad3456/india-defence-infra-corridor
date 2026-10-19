"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Translated } from "./Translated";
import type { MediaItem, MediaPage } from "@/lib/france-riots-shared";

/**
 * Pictures and videos from the riots, scrolling without end until the
 * collection runs out: every page is asked of /api/france-riots/media as the
 * reader nears the bottom. Each picture is shown from its publisher's own
 * address with its credit and a link to where it was published; a picture a
 * publisher no longer serves is dropped from view rather than replaced.
 */

const PAGE = 24;
const paris = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/Paris", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "undated");
const VIA: Record<MediaItem["via"], string> = { article: "in the article", gdelt: "as the article's preview image", commons: "on Wikimedia Commons", youtube: "on YouTube" };

function Card({ m, onOpen }: { m: MediaItem; onOpen: (m: MediaItem) => void }) {
  const [broken, setBroken] = useState(false);
  const [play, setPlay] = useState(false);
  if (broken) return null;
  return (
    <figure className="story-card mb-3 break-inside-avoid overflow-hidden">
      {m.kind === "video" && m.videoId ? (
        <div className="relative aspect-video bg-black">
          {play ? (
            <iframe className="absolute inset-0 h-full w-full" src={`https://www.youtube-nocookie.com/embed/${m.videoId}?autoplay=1&rel=0`} title={m.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
          ) : (
            <button type="button" onClick={() => setPlay(true)} className="group absolute inset-0" aria-label={`Play: ${m.en ?? m.title}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-cover opacity-90 group-hover:opacity-100" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full px-4 py-2 text-[13px] font-bold" style={{ background: "rgba(0,0,0,.7)", color: "#fff" }}>▶ Play</span>
            </button>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => onOpen(m)} className="block w-full" aria-label={`Enlarge: ${m.en ?? m.title}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.src} alt={m.en ?? m.title} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="block w-full" style={{ minHeight: 80, background: "var(--story-rule)" }} />
        </button>
      )}
      <figcaption className="p-2.5">
        <p className="text-[12px] leading-[1.45]"><Translated text={m.title} en={m.en} lang={m.lang} /></p>
        <p className="mono mt-1 text-[10px] leading-[1.5]" style={{ color: "var(--story-ink-3)" }}>
          {m.kind === "video" ? "Video" : "Photo"} published by {m.credit}{m.license ? ` · ${m.license}` : ""} {VIA[m.via]} · {paris(m.seen)} · <a className="underline decoration-dotted" href={m.page} target="_blank" rel="noopener noreferrer">source ↗</a>
        </p>
      </figcaption>
    </figure>
  );
}

export function Gallery({ initial }: { initial: MediaPage }) {
  const [kind, setKind] = useState<"all" | "image" | "video">("all");
  const [items, setItems] = useState<MediaItem[]>(initial.items);
  const [total, setTotal] = useState(initial.total);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<MediaItem | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const state = useRef({ kind, n: initial.items.length, busy: false });

  const more = useCallback(async (reset = false) => {
    const s = state.current;
    if (s.busy) return;
    s.busy = true; setBusy(true);
    try {
      const r = await fetch(`/api/france-riots/media?offset=${reset ? 0 : s.n}&limit=${PAGE}&kind=${s.kind}`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const page = (await r.json()) as MediaPage;
      setItems((prev) => {
        const base = reset ? [] : prev;
        const have = new Set(base.map((m) => m.videoId ?? m.src));
        const next = [...base, ...page.items.filter((m) => !have.has(m.videoId ?? m.src))];
        s.n = reset ? page.items.length : s.n + page.items.length;
        return next;
      });
      setTotal(page.total); setFailed(false);
    } catch { setFailed(true); } finally { s.busy = false; setBusy(false); }
  }, []);

  useEffect(() => { state.current.kind = kind; state.current.n = 0; void more(true); }, [kind, more]);
  useEffect(() => {
    const el = end.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting) && state.current.n < total && !failed) void more(); }, { rootMargin: "800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [more, total, failed]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {([["all", "Everything"], ["image", "Photos"], ["video", "Videos"]] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setKind(k)} className="rounded-full border px-2.5 py-1 text-[11.5px]"
            style={{ borderColor: kind === k ? "var(--story-ink)" : "var(--story-rule)", fontWeight: kind === k ? 700 : 500 }}>{label}</button>
        ))}
        <span className="text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>{total} in the collection · showing {items.length}</span>
      </div>
      <div className="mt-4 gap-3 sm:columns-2 lg:columns-3 xl:columns-4">
        {items.map((m) => <Card key={m.videoId ?? m.src} m={m} onOpen={setOpen} />)}
      </div>
      <div ref={end} className="py-6 text-center text-[12px]" style={{ color: "var(--story-ink-3)" }}>
        {busy ? "Loading more…" : failed ? <button type="button" className="underline" onClick={() => { setFailed(false); void more(); }}>Could not load more — try again</button>
          : items.length >= total ? (total ? "That is everything collected so far. The scheduled job adds more as it reads new articles." : "No pictures or videos yet.") : ""}
      </div>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={open.en ?? open.title} className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.86)" }} onClick={() => setOpen(null)}>
          <figure className="max-h-full max-w-5xl overflow-auto" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={open.src} alt={open.en ?? open.title} referrerPolicy="no-referrer" className="mx-auto max-h-[78vh] w-auto" />
            <figcaption className="mt-2 text-[13px] leading-[1.5]" style={{ color: "#f4f1ea" }}>
              {open.en ?? open.title}
              <span className="mono mt-1 block text-[11px]" style={{ color: "#bdb8ad" }}>{open.credit}{open.license ? ` · ${open.license}` : ""} · {paris(open.seen)} · <a className="underline" href={open.page} target="_blank" rel="noopener noreferrer">where it was published ↗</a> · press Esc to close</span>
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}
