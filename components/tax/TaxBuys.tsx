"use client";

import { useState } from "react";
import { Icon } from "./Icons";
import { countIn, howMany, iconUnit, inr, type TaxItem } from "@/lib/tax";

/**
 * What a sum of income tax would buy, at published prices, as unit charts: one
 * icon stands for a round number of the thing, said beside it. The sum can be
 * the whole year's tax, one day's, the average per return filed, or per Indian.
 */

export interface Pot { id: string; label: string; rupees: number; note: string }
type Row = TaxItem & { inr: number; cite: { publisher: string; url: string } };

const HUE: Record<TaxItem["icon"], string> = { phone: "var(--series-1)", missile: "var(--s-hot)", jet: "var(--s-hot)", ship: "var(--series-2)", moon: "var(--series-3)", hospital: "var(--s-cool)", train: "var(--series-4)" };

export function TaxBuys({ pots, items }: { pots: Pot[]; items: Row[] }) {
  const [pi, setPi] = useState(0);
  const pot = pots[pi]!;
  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Which sum">
        {pots.map((p, i) => (
          <button key={p.id} type="button" onClick={() => setPi(i)} aria-pressed={i === pi} className="rounded-full border px-3 py-1 text-[12.5px] font-semibold"
            style={{ borderColor: i === pi ? "var(--story-ink)" : "var(--story-rule)", background: i === pi ? "var(--story-ink)" : "transparent", color: i === pi ? "var(--story-card)" : "var(--story-ink-2)" }}>
            {p.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[13px]" style={{ color: "var(--story-ink-2)" }}><b className="text-[22px] font-black tabular-nums" style={{ color: "var(--story-ink)" }}>{inr(pot.rupees)}</b> · {pot.note}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => {
          const n = howMany(pot.rupees, it.inr), exact = pot.rupees / it.inr;
          const unit = iconUnit(Math.max(exact, 0.0001));
          const icons = exact / unit, whole = Math.floor(icons), part = icons - whole;
          return (
            <div key={it.id} className="story-card flex min-w-0 flex-col p-4" style={{ color: HUE[it.icon] }}>
              <p className="story-display text-[30px] leading-none tabular-nums" style={{ color: "var(--story-ink)" }}>
                {n >= 1 ? countIn(n) : exact >= 0.01 ? `${(exact * 100).toFixed(exact >= 0.1 ? 0 : 1)}%` : `${(exact * 100).toFixed(3)}%`}
              </p>
              <p className="mt-1 text-[12.5px] font-semibold leading-snug" style={{ color: "var(--story-ink)" }}>{n >= 1 ? it.name : `of ${it.name}`}</p>
              <div className="mt-2 flex flex-wrap gap-[3px]" aria-hidden>
                {Array.from({ length: Math.min(whole, 40) }, (_, k) => <Icon key={k} kind={it.icon} size={15} />)}
                {part > 0.02 && whole < 40 && <Icon kind={it.icon} size={15} fraction={part} />}
              </div>
              <p className="mt-1 text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>{n >= 1 ? `one icon = ${countIn(unit)}` : "the icon is one whole"}</p>
              <p className="mt-auto pt-2 text-[10.5px] leading-snug" style={{ color: "var(--story-ink-3)" }}>
                at {inr(it.inr)}{it.priceUsd ? ` ($${it.priceUsd})` : ""} · <a className="underline decoration-dotted" href={it.cite.url} target="_blank" rel="noopener noreferrer">{it.cite.publisher}</a>
                {it.confidence === "low" && <span className="ml-1 font-semibold" style={{ color: "var(--s-hot)" }}>· unverified estimate</span>}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
