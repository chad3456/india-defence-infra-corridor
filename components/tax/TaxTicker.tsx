"use client";

import { useEffect, useState } from "react";

/**
 * Income tax collected since the page opened, at FY 2025-26's average rate per
 * second. A derived illustration of the rate, not a live feed of collections:
 * the page says so beside it.
 */
export function TaxTicker({ perSecond }: { perSecond: number }) {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);
  const v = ((now - start) / 1000) * perSecond;
  return <span className="tabular-nums">₹{Math.floor(v).toLocaleString("en-IN")}</span>;
}
