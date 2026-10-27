"use client";

import { useState } from "react";

/** "Cause or career?" as four tests, each flipped between the case for the thesis and the case against. */
export function TestCards({ tests }: { tests: Array<{ test: string; for: string; against: string; evidence: string }> }) {
  const [side, setSide] = useState<Record<number, "for" | "against">>({});
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {tests.map((t, i) => {
        const s = side[i] ?? "for";
        return (
          <div key={t.test} className="story-card p-4">
            <p className="text-[15px] font-bold leading-snug">{t.test}</p>
            <div className="mt-2 flex overflow-hidden rounded-md border text-[12px] font-semibold" style={{ borderColor: "var(--story-rule)" }} role="group" aria-label="Which case">
              {(["for", "against"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setSide((x) => ({ ...x, [i]: k }))} aria-pressed={s === k} className="flex-1 px-2 py-1" style={{ background: s === k ? (k === "for" ? "var(--s-hot)" : "var(--s-cool)") : "transparent", color: s === k ? "#fff" : "var(--story-ink-2)" }}>
                  {k === "for" ? "Case for 'career'" : "Case for 'cause'"}
                </button>
              ))}
            </div>
            <p className="mt-2.5 min-h-[3.2em] text-[13.5px] leading-[1.55]">{s === "for" ? t.for : t.against}</p>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.05em]" style={{ color: "var(--story-ink-3)" }}>Evidence: {t.evidence}</p>
          </div>
        );
      })}
    </div>
  );
}
