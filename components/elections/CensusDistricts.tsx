import { districtsOfState, loadAcDistricts, loadCensus, profile, resolveDistrict } from "@/lib/elections-census";
import { loadElectors } from "@/lib/elections-electors";
import type { AtlasState } from "@/lib/elections-atlas-shared";

/**
 * Who lives in the state, district by district, from the 2011 Census: religion,
 * Scheduled Castes and Tribes, the gender balance and literacy — and which of
 * the state's constituencies lie in each district. Server-rendered.
 */
const fmt = (n: number) => n.toLocaleString("en-IN");
const pct = (n: number) => `${n.toFixed(1)}%`;
const SHADES = ["var(--seq-700)", "var(--seq-550)", "var(--seq-400)", "var(--seq-250)", "var(--seq-100)"];

export default function CensusDistricts({ st }: { st: AtlasState }) {
  const census = loadCensus();
  const ds = districtsOfState(st.eci);
  if (!census || !ds.length) return null;
  // Delhi's and other shared polygons aside, a state's census is its districts summed.
  const sum = (f: (d: (typeof ds)[number]) => number) => ds.reduce((a, d) => a + f(d), 0);
  const pop = sum((d) => d.population), men = sum((d) => d.male), women = sum((d) => d.female);
  const rel = (k: keyof (typeof ds)[number]["religion"]) => sum((d) => d.religion[k]);
  const state = profile({ ...ds[0]!, district: st.name, population: pop, male: men, female: women, literate: sum((d) => d.literate), maleLiterate: sum((d) => d.maleLiterate), femaleLiterate: sum((d) => d.femaleLiterate), sc: sum((d) => d.sc), st: sum((d) => d.st), religion: { hindu: rel("hindu"), muslim: rel("muslim"), christian: rel("christian"), sikh: rel("sikh"), buddhist: rel("buddhist"), jain: rel("jain"), other: rel("other"), notStated: rel("notStated") } });
  // Seats per district, where the constituency could be placed.
  const seats = new Map<string, string[]>();
  for (const r of loadAcDistricts()?.states[st.eci] ?? []) {
    const d = resolveDistrict(st.eci, r.district);
    if (d) seats.set(d.district, [...(seats.get(d.district) ?? []), `${r.no}. ${r.name}`]);
  }
  // The roll's gender balance in 2024 (ECI) beside the population's in 2011 (census).
  const segs = loadElectors()?.states[st.eci]?.segments ?? [];
  const rollRatio = segs.length ? Math.round((segs.reduce((a, s) => a + s.f, 0) / segs.reduce((a, s) => a + s.m, 0)) * 1000) : null;
  const relOrder = [...state.religion].sort((a, b) => b[1] - a[1]).filter(([, v]) => v >= 0.5).map(([k]) => k);
  const shade = (k: string) => SHADES[Math.min(relOrder.indexOf(k), 4)] ?? SHADES[4];
  const rows = ds.map((d) => ({ d, p: profile(d) })).sort((a, b) => b.p.population - a.p.population);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile value={fmt(pop)} label="people, 2011" note={`${ds.length} districts`} />
        <Tile value={`${pct(state.sc)} · ${pct(state.st)}`} label="Scheduled Castes · Tribes" note="share of the population" />
        <Tile value={String(state.sexRatio)} label="women per 1,000 men, 2011" note={rollRatio ? `on the 2024 electoral roll: ${rollRatio}` : "whole population"} />
        <Tile value={pct(state.literacy)} label="literate, 2011" note={`share of all ages, under-7s included (below the official literacy rate); women ${pct(state.femaleLiteracy)} (derived)`} />
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Religion, state total</h4>
        <div className="mt-2 flex h-5 overflow-hidden rounded-sm" role="img" aria-label={`Religion in ${st.name}, Census 2011`}>
          {state.religion.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k, v]) => <span key={k} title={`${k} ${v.toFixed(2)}%`} style={{ width: `${v}%`, background: shade(k) }} />)}
        </div>
        <p className="mt-1 text-[11px] text-ink-2">{[...state.religion].sort((a, b) => b[1] - a[1]).filter(([, v]) => v >= 0.05).map(([k, v]) => `${k} ${v.toFixed(2)}%`).join(" · ")}</p>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">District by district</h4>
        <div className="mt-2 max-h-[560px] overflow-auto rounded border border-gridline">
          <table className="w-full min-w-[760px] text-xs">
            <thead className="sticky top-0 bg-surface-2 text-[10px] uppercase tracking-wide text-ink-muted">
              <tr><th className="px-2 py-1.5 text-left">District</th><th className="px-2 py-1.5 text-right">People</th><th className="px-2 py-1.5 text-left">Religion</th><th className="px-2 py-1.5 text-right">SC</th><th className="px-2 py-1.5 text-right">ST</th><th className="px-2 py-1.5 text-right">Women /1,000 men</th><th className="px-2 py-1.5 text-right">Literate</th><th className="px-2 py-1.5 text-left">Constituencies</th></tr>
            </thead>
            <tbody>
              {rows.map(({ d, p }) => (
                <tr key={d.code} className="border-t border-gridline align-top">
                  <td className="px-2 py-1 text-ink">{d.district}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{fmt(d.population)}</td>
                  <td className="px-2 py-1">
                    <div className="flex h-2.5 w-36 overflow-hidden rounded-sm">{p.religion.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k, v]) => <span key={k} title={`${k} ${v.toFixed(1)}%`} style={{ width: `${v}%`, background: shade(k) }} />)}</div>
                    <span className="text-[10px] text-ink-muted">{[...p.religion].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${k} ${v.toFixed(0)}%`).join(", ")}</span>
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">{pct(p.sc)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{pct(p.st)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{p.sexRatio}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{pct(p.literacy)}</td>
                  <td className="px-2 py-1 text-[10px] text-ink-2">{(seats.get(d.district) ?? []).join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[11px] text-ink-muted">Shading is by the state&rsquo;s largest religions, darkest first; hover a bar for every share.</p>
      </div>

      <p className="text-[11px] leading-snug text-ink-muted">
        Census of India 2011 (Primary Census Abstract; table C-01 on religion), read from a district-level compilation of
        the census tables that reproduces the census&rsquo;s published national totals exactly; the 2021 census has not been
        taken. The Election Commission records no one&rsquo;s religion or caste, and the census counts castes only as
        Scheduled Castes and Tribes; these figures describe districts, never voters or constituencies. Districts are 2011&rsquo;s
        (many have since been divided), and constituencies are placed in them by DataMeet&rsquo;s layer of ECI&rsquo;s polling-station
        locator, kept only where its constituency name matches ECI&rsquo;s results page.
        {st.slug === "telangana" ? " Telangana was part of Andhra Pradesh in 2011, so its districts here are the Andhra Pradesh census districts that now lie in Telangana." : ""}
      </p>
    </div>
  );
}

function Tile({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div className="rounded-lg border border-gridline bg-surface-1 p-3">
      <p className="text-lg font-semibold tabular-nums text-ink">{value}</p>
      <p className="text-[11px] text-ink">{label}</p>
      {note && <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">{note}</p>}
    </div>
  );
}
