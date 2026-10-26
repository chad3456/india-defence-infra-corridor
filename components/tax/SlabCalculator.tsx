"use client";

import { useMemo, useState } from "react";
import { inr, newRegimeTax, type TaxPublished } from "@/lib/tax";

/**
 * Your salary, your income tax under the new regime, and what it pays for:
 * how many seconds of the Union government's spending, and how many people's
 * worth of the average tax per Indian. All derived from the published slabs
 * and budget; the salaried standard deduction is applied, surcharge is not.
 */
export function SlabCalculator({ slabs, spendPerSecond, perIndian, iphone }: { slabs: TaxPublished["slabs"]; spendPerSecond: number; perIndian: number; iphone: number }) {
  const [gross, setGross] = useState(1800000);
  const r = useMemo(() => newRegimeTax(gross, slabs), [gross, slabs]);
  const marks = [600000, 1275000, 1500000, 2000000, 2500000, 3000000, 5000000];
  return (
    <div className="story-card p-4 sm:p-5">
      <label className="block text-[12px] font-semibold" style={{ color: "var(--story-ink-2)" }} htmlFor="salary">Gross salary a year</label>
      <p className="story-display text-[34px] tabular-nums">{inr(gross)}</p>
      <input id="salary" type="range" min={300000} max={5000000} step={25000} value={gross} onChange={(e) => setGross(Number(e.target.value))} className="w-full accent-[color:var(--s-hot)]" />
      <div className="mt-1 flex flex-wrap gap-1.5">
        {marks.map((m) => <button key={m} type="button" onClick={() => setGross(m)} className="rounded border px-1.5 py-0.5 text-[11px]" style={{ borderColor: "var(--story-rule)" }}>{inr(m)}</button>)}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="text-[11px] uppercase tracking-[0.06em]" style={{ color: "var(--story-ink-3)" }}>Income tax + cess</p><p className="text-[26px] font-black tabular-nums">{inr(r.total)}</p><p className="text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>{(r.effective * 100).toFixed(1)}% of salary · {inr(Math.round(r.total / 12))} a month</p></div>
        <div><p className="text-[11px] uppercase tracking-[0.06em]" style={{ color: "var(--story-ink-3)" }}>Runs the Union government for</p><p className="text-[26px] font-black tabular-nums">{(r.total / spendPerSecond).toFixed(r.total / spendPerSecond < 1 ? 3 : 2)} s</p><p className="text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>it spends {inr(spendPerSecond)} a second</p></div>
        <div><p className="text-[11px] uppercase tracking-[0.06em]" style={{ color: "var(--story-ink-3)" }}>Equal to the average tax of</p><p className="text-[26px] font-black tabular-nums">{Math.round(r.total / perIndian).toLocaleString("en-IN")}</p><p className="text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>Indians ({inr(Math.round(perIndian))} each)</p></div>
        <div><p className="text-[11px] uppercase tracking-[0.06em]" style={{ color: "var(--story-ink-3)" }}>In iPhone 17s</p><p className="text-[26px] font-black tabular-nums">{(r.total / iphone).toFixed(1)}</p><p className="text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>at {inr(iphone)}</p></div>
      </div>
      <p className="mt-3 text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>Derived: {slabs.regime}; ₹{slabs.standardDeduction.toLocaleString("en-IN")} standard deduction, rebate to ₹12 lakh taxable with marginal relief, {slabs.cess}% cess. {slabs.notes}</p>
    </div>
  );
}
