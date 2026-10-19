"use client";

import { Fragment, useMemo, useState } from "react";
import { Translated } from "./Translated";
import {
  BRAND_SECTOR, DAMAGE_LABEL, inFocus, langName,
  type BusinessReport, type DamageCategory, type DamageItem,
} from "@/lib/france-riots-shared";

/**
 * The property damage register: every sentence in the articles read that
 * reports property attacked, looted or burned, by kind of property, brand,
 * named building and city — each with the sentence itself and its source.
 *
 * Counts here are counts of sentences, not of shops or cars: one looted store
 * reported by six outlets is six rows, and "dozens of shops" is one. Where a
 * sentence gives a number it is picked out, never added up.
 */

const paris = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/Paris", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "undated");
const Muted = ({ children }: { children: React.ReactNode }) => <p className="text-[13px]" style={{ color: "var(--story-ink-3)" }}>{children}</p>;
const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button type="button" onClick={onClick} className="rounded-full border px-2.5 py-0.5 text-[11.5px]"
    style={{ borderColor: on ? "var(--story-ink)" : "var(--story-rule)", fontWeight: on ? 700 : 500, background: on ? "var(--story-card)" : "transparent" }}>{children}</button>
);

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;
function toCsv(rows: DamageItem[]): string {
  const head = ["reported_at_utc", "city", "property", "brands", "named_places", "numbers_in_sentence", "sentence_original", "language", "sentence_english_machine_translation", "outlet", "url"];
  const body = rows.map((d) => [d.seen ?? "", d.city ?? "", d.categories.map((c) => DAMAGE_LABEL[c]).join("; "), d.brands.join("; "), d.places.join("; "), d.numbers.join("; "), d.quote, langName(d.lang), d.en ?? "", d.outlet, d.url].map(csvCell).join(","));
  return [head.join(","), ...body].join("\n");
}

export function DamageRegister({ items, businesses, window: win }: { items: DamageItem[]; businesses: BusinessReport[]; window: { from: string; to: string; label: string } }) {
  const [span, setSpan] = useState<"window" | "all">("window");
  const [cat, setCat] = useState<"all" | DamageCategory>("all");
  const [city, setCity] = useState("all");
  const [q, setQ] = useState("");
  const [n, setN] = useState(25);
  const [openBrand, setOpenBrand] = useState<string | null>(null);

  // The business reports found before the damage register existed are folded in, so no named brand is lost.
  const all = useMemo(() => {
    const have = new Set(items.map((d) => d.quote));
    const extra: DamageItem[] = businesses.filter((b) => !have.has(b.quote)).map((b) => ({ quote: b.quote, categories: ["shop"], brands: [b.brand], places: [], numbers: [], city: b.city, outlet: b.outlet, url: b.url, seen: b.seen, lang: b.lang ?? "en", ...(b.en ? { en: b.en } : {}) }));
    const merged = new Map<string, DamageItem>();
    for (const d of [...items, ...extra]) {
      const prev = merged.get(d.quote);
      merged.set(d.quote, prev ? { ...prev, brands: [...new Set([...prev.brands, ...d.brands])] } : d);
    }
    return [...merged.values()].sort((a, b) => (b.seen ?? "").localeCompare(a.seen ?? ""));
  }, [items, businesses]);
  const inSpan = all.filter((d) => span === "all" || inFocus(d.seen, win));
  const cities = [...new Set(inSpan.map((d) => d.city).filter((c): c is string => !!c))].sort((a, b) => inSpan.filter((d) => d.city === b).length - inSpan.filter((d) => d.city === a).length);
  const needle = q.trim().toLowerCase();
  const shown = inSpan.filter((d) => (cat === "all" || d.categories.includes(cat)) && (city === "all" || d.city === city) && (!needle || `${d.quote} ${d.en ?? ""} ${d.brands.join(" ")} ${d.places.join(" ")}`.toLowerCase().includes(needle)));

  const byCat = (Object.keys(DAMAGE_LABEL) as DamageCategory[]).map((c) => ({ c, n: inSpan.filter((d) => d.categories.includes(c)).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  const maxCat = Math.max(1, ...byCat.map((x) => x.n));
  const brands = useMemo(() => {
    const by = new Map<string, DamageItem[]>();
    for (const d of inSpan) for (const b of d.brands) by.set(b, [...(by.get(b) ?? []), d]);
    return [...by].map(([brand, rs]) => ({ brand, sector: BRAND_SECTOR[brand] ?? "Other", rs, cities: [...new Set(rs.map((r) => r.city).filter(Boolean))] as string[], numbers: [...new Set(rs.flatMap((r) => r.numbers))] }))
      .sort((a, b) => b.rs.length - a.rs.length || a.brand.localeCompare(b.brand));
  }, [inSpan]);
  const places = useMemo(() => {
    const by = new Map<string, DamageItem[]>();
    for (const d of inSpan) for (const p of d.places) by.set(p, [...(by.get(p) ?? []), d]);
    return [...by].map(([place, rs]) => ({ place, rs, city: rs.find((r) => r.city)?.city ?? null })).sort((a, b) => b.rs.length - a.rs.length);
  }, [inSpan]);
  const sectors = [...new Set(brands.map((b) => b.sector))];

  const download = () => {
    const blob = new Blob([`﻿${toCsv(shown)}`], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `france-riots-damage-${span === "window" ? "17-18-october" : "october"}-2026.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5_000);
  };

  if (!all.length) return <Muted>No property damage reported in the articles read so far. The scheduled job reads new articles on each run.</Muted>;
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center gap-2">
        <Chip on={span === "window"} onClick={() => setSpan("window")}>{win.label} (reported 17–19 Oct, Paris time)</Chip>
        <Chip on={span === "all"} onClick={() => setSpan("all")}>All of October</Chip>
        <span className="text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>{inSpan.length} sentences · {brands.length} brands · {places.length} named buildings and centres · {cities.length} cities</span>
      </div>

      {/* What kind of property */}
      <div>
        <h3 className="text-[14px] font-bold">What was reported damaged</h3>
        <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>Sentences naming each kind of property as attacked, looted or burned. A sentence can name several. Press a bar to filter the list below.</p>
        <ul className="mt-3 space-y-1.5">
          {byCat.map(({ c, n: v }) => (
            <li key={c}>
              <button type="button" onClick={() => setCat(cat === c ? "all" : c)} className="grid w-full grid-cols-[minmax(9rem,15rem)_minmax(0,1fr)_2.5rem] items-center gap-2 text-left text-[12.5px]">
                <span style={{ fontWeight: cat === c ? 700 : 500 }}>{DAMAGE_LABEL[c]}</span>
                <span className="h-3 rounded-[2px]" style={{ width: `${(100 * v) / maxCat}%`, background: cat === c ? "var(--s-hot)" : "var(--series-1)", minWidth: 3 }} />
                <span className="mono text-right tabular-nums">{v}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Brands */}
      <div>
        <h3 className="text-[14px] font-bold">Brands and chains named</h3>
        <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>Every brand a sentence names as attacked, grouped by what it sells. Numbers are the ones the sentences print (e.g. &ldquo;50 of the retailer&apos;s outlets&rdquo;), shown, never summed. Press a brand for its sentences.</p>
        {brands.length ? (
          <div className="mt-3 space-y-4">
            {sectors.map((sec) => (
              <div key={sec}>
                <p className="text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--series-2)" }}>{sec}</p>
                <div className="mt-1 overflow-x-auto">
                  <table className="w-full min-w-[560px] table-fixed text-[12.5px]">
                    <colgroup><col className="w-[24%]" /><col className="w-[11%]" /><col className="w-[25%]" /><col className="w-[20%]" /><col className="w-[20%]" /></colgroup>
                    <thead><tr className="text-left text-[11px]" style={{ color: "var(--story-ink-3)" }}><th className="py-1 pr-3 font-medium">Brand</th><th className="pr-3 text-right font-medium">Sentences</th><th className="pr-3 font-medium">Cities named</th><th className="pr-3 font-medium">Numbers given</th><th className="font-medium">First reported</th></tr></thead>
                    <tbody>
                      {brands.filter((b) => b.sector === sec).map((b) => (
                        <Fragment key={b.brand}>
                          <tr className="cursor-pointer border-t align-top" style={{ borderColor: "var(--story-rule)" }} onClick={() => setOpenBrand(openBrand === b.brand ? null : b.brand)}>
                            <td className="py-1.5 pr-3 font-semibold">{b.brand} <span className="text-[10.5px] font-normal" style={{ color: "var(--story-ink-3)" }}>{openBrand === b.brand ? "▾" : "▸"}</span></td>
                            <td className="mono pr-3 text-right tabular-nums">{b.rs.length}</td>
                            <td className="pr-3">{b.cities.join(", ") || "—"}</td>
                            <td className="mono pr-3">{b.numbers.slice(0, 5).join(", ") || "—"}</td>
                            <td className="mono whitespace-nowrap text-[11px]">{paris([...b.rs].sort((x, y) => (x.seen ?? "").localeCompare(y.seen ?? ""))[0]!.seen)}</td>
                          </tr>
                          {openBrand === b.brand && (
                            <tr><td colSpan={5} className="pb-3">
                              <ul className="space-y-2 pl-3">
                                {b.rs.slice(0, 10).map((r) => (
                                  <li key={r.quote} className="text-[12px] leading-[1.5]"><Translated text={r.quote} en={r.en} lang={r.lang} quote /> <a className="mono text-[10.5px] underline decoration-dotted" style={{ color: "var(--story-ink-3)" }} href={r.url} target="_blank" rel="noopener noreferrer">{r.outlet} · {paris(r.seen)} ↗</a></li>
                                ))}
                              </ul>
                            </td></tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : <div className="mt-2"><Muted>No brand named as attacked in this view.</Muted></div>}
      </div>

      {/* Named buildings */}
      {places.length > 0 && (
        <div>
          <h3 className="text-[14px] font-bold">Named buildings, stations and shopping centres</h3>
          <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>Town halls, police stations, schools, stations and centres that sentences name by place — &ldquo;la mairie de …&rdquo;, &ldquo;… police station&rdquo;.</p>
          <ul className="mt-2 grid gap-x-6 gap-y-1 text-[12.5px] sm:grid-cols-2">
            {places.slice(0, 40).map((p) => (
              <li key={p.place} className="flex items-baseline gap-2">
                <span className="font-semibold">{p.place}</span>
                <span className="text-[11px]" style={{ color: "var(--story-ink-3)" }}>{p.city ?? ""}{p.city ? " · " : ""}{p.rs.length} sentence{p.rs.length === 1 ? "" : "s"} · <a className="underline decoration-dotted" href={p.rs[0]!.url} target="_blank" rel="noopener noreferrer">{p.rs[0]!.outlet} ↗</a></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Every sentence */}
      <div>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-[14px] font-bold">Every report, newest first · {shown.length}</h3>
          <button type="button" onClick={download} className="rounded-md border px-3 py-1 text-[12px] font-semibold" style={{ borderColor: "var(--story-ink)" }}>Download these {shown.length} as CSV</button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Chip on={city === "all"} onClick={() => setCity("all")}>Every city</Chip>
          {cities.slice(0, 14).map((c) => <Chip key={c} on={city === c} onClick={() => setCity(city === c ? "all" : c)}>{c}</Chip>)}
          {cat !== "all" && <Chip on onClick={() => setCat("all")}>{DAMAGE_LABEL[cat]} ✕</Chip>}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a brand, street, building…" aria-label="Search the damage reports"
            className="ml-auto min-w-[12rem] rounded-md border bg-transparent px-2 py-1 text-[12px]" style={{ borderColor: "var(--story-rule)" }} />
        </div>
        <ul className="mt-3 divide-y" style={{ borderColor: "var(--story-rule)" }}>
          {shown.slice(0, n).map((d) => (
            <li key={d.quote} className="grid gap-1 py-2.5 sm:grid-cols-[8.5rem_minmax(0,1fr)]" style={{ borderColor: "var(--story-rule)" }}>
              <span className="mono text-[10.5px] leading-[1.5]" style={{ color: "var(--story-ink-3)" }}>{paris(d.seen)}<br />{d.city ?? "city not named"}</span>
              <span className="min-w-0">
                <span className="flex flex-wrap gap-1">
                  {d.categories.map((c) => <span key={c} className="rounded-[3px] px-1.5 text-[10px] font-semibold" style={{ background: "var(--s-hot-fill)" }}>{DAMAGE_LABEL[c]}</span>)}
                  {d.brands.map((b) => <span key={b} className="rounded-[3px] border px-1.5 text-[10px] font-semibold" style={{ borderColor: "var(--story-ink-3)" }}>{b}</span>)}
                  {d.places.map((p) => <span key={p} className="rounded-[3px] border border-dashed px-1.5 text-[10px]" style={{ borderColor: "var(--story-ink-3)" }}>{p}</span>)}
                </span>
                <span className="mt-1 block text-[12.5px] leading-[1.55]"><Translated text={d.quote} en={d.en} lang={d.lang} quote /></span>
                <a className="mono text-[10.5px] underline decoration-dotted" style={{ color: "var(--story-ink-3)" }} href={d.url} target="_blank" rel="noopener noreferrer">{d.outlet} ↗</a>
              </span>
            </li>
          ))}
          {!shown.length && <li className="py-2"><Muted>No report matches.</Muted></li>}
        </ul>
        {n < shown.length && <button type="button" onClick={() => setN((x) => x + 50)} className="mt-3 rounded-md border px-3 py-1.5 text-[12.5px]" style={{ borderColor: "var(--story-rule)" }}>Show more ({shown.length - n} left)</button>}
        <p className="mt-3 text-[11px]" style={{ color: "var(--story-ink-3)" }}>Found by rules that look for a verb of attack (looted, burned, smashed; pillé, incendié, saccagé…) next to a kind of property, in French and English articles; other languages are read for pictures only. A rule can miss a report or catch a sentence about something else — every row links to its article.</p>
      </div>
    </div>
  );
}
