"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  readSeen, writeSeen, toAnnounce, currentlyNew, type NewFeature,
} from "@/lib/whats-new";

/**
 * "There is something new here" — said once, to people who have been before.
 *
 * ── The rule that makes this tolerable ───────────────────────────────────
 *
 * A browser with nothing stored is a reader who has never visited, and to them
 * nothing on the site is new. So a first visit shows no toast at all and
 * silently records every current feature as seen. Without that rule the first
 * thing a stranger meets is a stack of notifications about pages they have not
 * read yet, which is how this pattern usually earns its reputation.
 *
 * After that, each feature is announced once. Dismissing writes the id, and so
 * does following the link, because a reader who clicked through does not need
 * telling again. At most two at a time: three stacked cards cover the content
 * they are advertising.
 *
 * ── Not a modal ──────────────────────────────────────────────────────────
 *
 * It takes no focus, traps none, and blocks nothing. `role="status"` with
 * `aria-live="polite"` means a screen reader is told after it finishes the
 * sentence it is on rather than being interrupted. Escape dismisses the stack,
 * and each card has a real button rather than an icon with a title attribute.
 *
 * The entrance animation is skipped entirely under prefers-reduced-motion —
 * something sliding in beside the text you are reading is precisely what that
 * setting is asking not to happen.
 */
export default function ToastHost() {
  const [queue, setQueue] = useState<NewFeature[]>([]);
  const [leaving, setLeaving] = useState<string[]>([]);

  useEffect(() => {
    const now = Date.now();
    const seen = readSeen();
    if (seen === null) {
      // First visit: nothing is new to someone who has never been.
      writeSeen(currentlyNew(now).map((f) => f.id));
      return;
    }
    const next = toAnnounce(seen, now);
    if (next.length === 0) return;
    // A short delay so the toast arrives after the page has settled rather
    // than racing the first paint of the thing it is talking about.
    const timer = window.setTimeout(() => setQueue(next), 900);
    return () => window.clearTimeout(timer);
  }, []);

  const dismiss = useCallback((id: string) => {
    writeSeen([...(readSeen() ?? []), id]);
    setLeaving((l) => [...l, id]);
    window.setTimeout(() => {
      setQueue((q) => q.filter((f) => f.id !== id));
      setLeaving((l) => l.filter((x) => x !== id));
    }, 180);
  }, []);

  const dismissAll = useCallback(() => {
    writeSeen([...(readSeen() ?? []), ...queue.map((f) => f.id)]);
    setQueue([]);
  }, [queue]);

  useEffect(() => {
    if (queue.length === 0) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dismissAll(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [queue, dismissAll]);

  if (queue.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Recently added"
      className="pointer-events-none fixed inset-x-3 bottom-3 z-50 flex flex-col gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[21.5rem]"
    >
      {queue.map((f) => (
        <div
          key={f.id}
          data-leaving={leaving.includes(f.id) ? "" : undefined}
          className="toast pointer-events-auto rounded-lg border border-[color:var(--gridline)] p-3.5 shadow-lg"
          style={{
            background: "color-mix(in srgb, var(--surface-1) 88%, transparent)",
            backdropFilter: "blur(14px) saturate(1.3)",
            WebkitBackdropFilter: "blur(14px) saturate(1.3)",
          }}
        >
          <div className="flex items-start gap-2">
            <span
              className="mt-[3px] inline-flex shrink-0 items-center rounded-[3px] px-1 py-px text-[9px] font-semibold uppercase leading-[1.35] tracking-[0.08em]"
              style={{ background: "var(--series-1)", color: "var(--surface-1)" }}
            >
              New
            </span>
            <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug">{f.title}</p>
            <button
              type="button"
              onClick={() => dismiss(f.id)}
              aria-label={`Dismiss: ${f.title}`}
              className="-mr-1 -mt-1 shrink-0 rounded p-1 text-[color:var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[color:var(--text-primary)]"
            >
              <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
                <path d="M1 1l9 9M10 1l-9 9" stroke="currentColor" strokeWidth="1.4" fill="none" />
              </svg>
            </button>
          </div>
          <p className="mt-1.5 text-[12px] leading-[1.55] text-[color:var(--text-secondary)]">
            {f.blurb}
          </p>
          <Link
            href={f.href}
            onClick={() => dismiss(f.id)}
            className="link-underline mt-2.5 inline-block text-[12px] font-medium"
          >
            Take a look →
          </Link>
        </div>
      ))}
    </div>
  );
}
