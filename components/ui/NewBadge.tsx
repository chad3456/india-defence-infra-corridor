"use client";

import { useEffect, useState } from "react";
import { isNew, newFeatureFor, type NewFeature } from "@/lib/whats-new";

/**
 * The small "New" marker.
 *
 * ── Why this is a client component for one word ──────────────────────────
 *
 * Because the page it sits on is prerendered. A server-rendered badge is
 * evaluated once, at build time, and then frozen into the HTML — so a page
 * built in March goes on telling readers it is new in September, which is the
 * exact failure that makes people stop believing the marker. Mounting on the
 * client and reading `Date.now()` there means the expiry is measured against
 * the reader's own clock, and the badge disappears on its own.
 *
 * It renders nothing until mounted, which also keeps the server and client
 * markup identical and avoids a hydration mismatch on every page that has one.
 */
export default function NewBadge({
  feature, href, className = "",
}: {
  /** Either the feature itself, or the path it announces. */
  feature?: NewFeature;
  href?: string;
  className?: string;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const now = Date.now();
    const f = feature ?? (href ? newFeatureFor(href, now) : undefined);
    setShow(Boolean(f && isNew(f, now)));
  }, [feature, href]);

  if (!show) return null;
  return (
    <span
      className={
        "ml-1.5 inline-flex shrink-0 items-center rounded-[3px] px-1 py-px align-middle " +
        "text-[9px] font-semibold uppercase leading-[1.35] tracking-[0.08em] " + className
      }
      style={{ background: "var(--series-1)", color: "var(--surface-1)" }}
    >
      New
    </span>
  );
}
