import Link from "next/link";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import atlas from "world-atlas/countries-110m.json";
import PageHeader from "@/components/ui/PageHeader";
import DroneMap, { type MapCountry } from "@/components/map/DroneMap";
import {
  loadDrones, byClass, leadSupplier, supplierColour, provisionalOf, SUPPLIER_ORDER,
} from "@/lib/drones";

/**
 * How the world uses military drones.
 *
 * ── The claim, stated narrowly ───────────────────────────────────────────
 *
 * Which countries are publicly recorded as operating each of eighteen named
 * types. That is a much smaller claim than the page's title, and the page has
 * to keep saying so: it is not an inventory, nobody here counts airframes, and
 * it is not a record of combat use, which is a separate and much harder claim
 * to source. An absent country means nobody wrote it down.
 *
 * ── Why the map is only half the story ───────────────────────────────────
 *
 * The proliferation of these aircraft is not really a story about which
 * countries fly them. It is a story about price. A Reaper and a TB2 do
 * overlapping jobs an order of magnitude apart in cost, and that is why the
 * TB2's operator list is longer than the Reaper's despite arriving two decades
 * later. The map cannot show that, so the supplier bars sit next to it: the
 * interesting number is how many countries each producer reaches, not how many
 * types each produces.
 *
 * ── What the colour cannot carry ─────────────────────────────────────────
 *
 * One colour per country means one supplier per country, and the fact a single
 * hue most easily hides is a fleet bought from three places. Ties are painted
 * as mixed rather than resolved, and the panel gives the split as a fraction.
 *
 * ── Projected on the server ──────────────────────────────────────────────
 *
 * world-atlas, d3-geo and topojson-client stay here. The client gets finished
 * path strings and nothing else, which is a couple of hundred kilobytes of
 * library not shipped to draw a picture that never changes.
 */

export const metadata = {
  title: "How the world uses military drones · Bharat Tracker",
  description:
    "Countries publicly recorded as operating each of eighteen drone types, by supplier — with " +
    "what an operator list can and cannot tell you.",
};

const W = 960;
const H = 480;

/** One decimal is sub-pixel on a 960-wide map and a third off the payload. */
function trim(d: string): string {
  return d.replace(/(\d+\.\d)\d+/g, "$1");
}

export default function DronesPage() {
  const d = loadDrones();

  const t = atlas as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
  const world = feature(t, t.objects.countries) as FeatureCollection<Geometry, { name: string }>;
  const proj = geoNaturalEarth1().fitExtent([[2, 2], [W - 2, H - 2]], world);
  const path = geoPath(proj);

  const operators = new Map(d.countries.map((c) => [c.country, c]));
  const mapCountries: MapCountry[] = [];
  const baseParts: string[] = [];

  for (const f of world.features) {
    const geo = path(f) ?? "";
    if (!geo) continue;
    const row = operators.get(f.properties.name);
    if (!row) { baseParts.push(trim(geo)); continue; }
    const lead = leadSupplier(row.types, d.types);
    mapCountries.push({
      country: row.country,
      d: trim(geo),
      supplier: lead.origin,
      colour: lead.origin === "mixed" ? "var(--text-muted)" : supplierColour(lead.origin),
      of: lead.of,
      total: lead.total,
      types: row.types,
      origins: row.origins,
    });
  }

  // A supplier the atlas cannot place is a country missing from the map with
  // nothing to say so. Recorded rather than assumed away.
  const undrawn = d.countries.filter((c) => !mapCountries.some((m) => m.country === c.country));

  const legend = SUPPLIER_ORDER
    .map((origin) => ({
      origin,
      colour: supplierColour(origin),
      operators: d.suppliers.find((s) => s.origin === origin)?.operators ?? 0,
    }))
    .filter((l) => l.operators > 0)
    .sort((a, b) => b.operators - a.operators);

  const classes = byClass(d);
  const maxReach = Math.max(1, ...d.suppliers.map((s) => s.operators));
  const readTypes = [...d.types].sort((a, b) => b.operators.length - a.operators.length);
  const provisional = d.provisionalRows ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="the world · uncrewed aircraft"
        title="How the world uses military drones"
        lede={
          <>
            Eighteen types, and the countries publicly recorded as operating each of them. Not an
            inventory — nobody here is counting airframes — and not a record of who has used one
            in anger, which is a separate and much harder thing to source.
          </>
        }
        stats={[
          { k: "Operator countries", v: String(d.countryCount) },
          { k: "Types read", v: `${d.readCount} of ${d.typeCount}` },
          { k: "Producers", v: String(legend.length) },
          { k: "Built", v: d.builtAt.slice(0, 10) },
        ]}
      />

      {/* ── The map ───────────────────────────────────────────────────── */}
      <section className="mt-9">
        <DroneMap
          base={baseParts.join(" ")}
          countries={mapCountries}
          width={W}
          height={H}
          legend={legend}
        />
        <p className="mt-3 max-w-[70ch] text-[12px] leading-[1.6] text-[color:var(--text-muted)]">
          Shaded by the supplier most of a country&rsquo;s types come from. A country flying types
          from three producers cannot be painted three colours, so where no supplier leads it is
          drawn as mixed rather than assigned to one — click any country for the split.
          {undrawn.length > 0 && (
            <> {undrawn.length} operator{undrawn.length === 1 ? "" : "s"} in the data
              ({undrawn.map((u) => u.country).join(", ")}) {undrawn.length === 1 ? "is" : "are"} not
              a shape this atlas can draw and {undrawn.length === 1 ? "is" : "are"} missing from the
              map.</>
          )}
        </p>
      </section>

      {/* ── Reach, which is the actual story ─────────────────────────── */}
      <section className="mt-14 border-t pt-12">
        <h2 className="display text-[28px] leading-tight sm:text-[34px]">Reach, not range</h2>
        <p className="mt-3 max-w-[58ch] text-[13.5px] leading-[1.7] text-[color:var(--text-secondary)]">
          How many countries each producer&rsquo;s aircraft have reached. This is the number that
          has changed this decade, and it has changed on price rather than on capability: the
          types with the longest operator lists are the cheap ones, not the advanced ones.
        </p>
        <div className="mt-7 space-y-3">
          {d.suppliers.map((s) => (
            <div key={s.origin} className="flex items-center gap-3">
              <span className="w-[7.5rem] shrink-0 text-[12.5px]">{s.origin}</span>
              <span className="min-w-0 flex-1">
                <span
                  className="block h-[12px] rounded-sm"
                  style={{
                    width: `${(s.operators / maxReach) * 100}%`,
                    background: supplierColour(s.origin),
                  }}
                />
              </span>
              <span className="mono w-[2.5rem] shrink-0 text-right text-[12px]">{s.operators}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-[color:var(--text-muted)]">
          Countries reached, deduplicated across that producer&rsquo;s types. These columns overlap
          — a country flying a Turkish type and an Israeli one is counted in both — so they do not
          sum to {d.countryCount}.
        </p>
      </section>

      {/* ── By what the aircraft is for ──────────────────────────────── */}
      {classes.length > 0 && (
        <section className="mt-14 border-t pt-12">
          <h2 className="display text-[28px] leading-tight sm:text-[34px]">By what it is for</h2>
          <p className="mt-3 max-w-[58ch] text-[13.5px] leading-[1.7] text-[color:var(--text-secondary)]">
            Three broad roles. The class is stated in the dataset rather than parsed from an
            article, because it is the one property of these aircraft that does not depend on how
            an editor laid out a page — and because the line between an armed reconnaissance drone
            and a combat drone is a doctrinal argument, not a fact this page can settle.
          </p>
          <div className="mt-6 grid gap-px overflow-hidden rounded-md border bg-[var(--hairline)] sm:grid-cols-3">
            {classes.map((c) => (
              <div key={c.klass} className="bg-[var(--surface-1)] p-4">
                <p className="eyebrow">{c.klass}</p>
                <p className="mono mt-2 text-[26px] leading-none tracking-tight">{c.countries}</p>
                <p className="mt-1.5 text-[12px] leading-[1.5] text-[color:var(--text-secondary)]">
                  countries, across {c.types} type{c.types === 1 ? "" : "s"} read
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── The types, with how each was read ─────────────────────────── */}
      <section className="mt-14 border-t pt-12">
        <h2 className="display text-[28px] leading-tight sm:text-[34px]">The types</h2>
        <p className="mt-3 max-w-[62ch] text-[13.5px] leading-[1.7] text-[color:var(--text-secondary)]">
          Every row says how its operator list was found, because the three ways are not equally
          strong. A list entry is the firmest. A country sub-heading is nearly as good. A scan of
          every flag template in the section is the loosest — inside a section about who operates
          the type it is a fair reading, but a country named in a sentence about exports counts the
          same as one in a table, and that difference should not be averaged away.
        </p>
        <div className="mt-7 overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-[color:var(--baseline)]">
                <th className="eyebrow pb-2.5 pr-4 font-normal">Type</th>
                <th className="eyebrow pb-2.5 pr-4 font-normal">Origin</th>
                <th className="eyebrow pb-2.5 pr-4 font-normal">Role</th>
                <th className="eyebrow pb-2.5 pr-4 text-right font-normal">Operators</th>
                <th className="eyebrow pb-2.5 pr-4 font-normal">Read by</th>
                <th className="eyebrow pb-2.5 font-normal">The article&rsquo;s own count</th>
              </tr>
            </thead>
            <tbody>
              {readTypes.map((t) => {
                const prov = provisionalOf(t);
                return (
                  <tr key={t.page} className="border-b border-[color:var(--hairline)] align-top">
                    <td className="py-2.5 pr-4 text-[13px]">
                      <a
                        href={`https://en.wikipedia.org/wiki/${t.page}`}
                        rel="noopener noreferrer nofollow"
                        target="_blank"
                        className="link-underline"
                      >
                        {t.name}
                      </a>
                    </td>
                    <td className="py-2.5 pr-4 text-[12.5px]">
                      <span className="flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="inline-block h-2 w-2 shrink-0 rounded-[2px]"
                          style={{ background: supplierColour(t.origin) }}
                        />
                        {t.origin}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-[12.5px] text-[color:var(--text-secondary)]">
                      {t.klass}
                    </td>
                    <td className="mono py-2.5 pr-4 text-right text-[13px]">
                      {t.read ? t.operators.length : "—"}
                      {prov > 0 && (
                        <span className="ml-1 text-[10.5px] text-[color:var(--text-muted)]">
                          incl. {prov} former/potential
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-[11.5px] text-[color:var(--text-muted)]">
                      {t.read ? (t.method ?? "list") : (t.note ?? "not read")}
                    </td>
                    <td className="py-2.5 text-[11.5px] leading-[1.45] text-[color:var(--text-secondary)]">
                      {t.statedReach ?? <span className="text-[color:var(--text-muted)]">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {provisional > 0 && (
          <p className="mt-3 max-w-[66ch] text-[12px] leading-[1.6] text-[color:var(--text-muted)]">
            {provisional} operator row{provisional === 1 ? "" : "s"} came from a “Former” or
            “Potential” subsection. Those are worth holding — which states flew a type and stopped
            is a fact about proliferation — but they are not a claim that the state operates it
            today, and each one carries the heading it was read from.
          </p>
        )}
      </section>

      {/* ── What this cannot tell you ─────────────────────────────────── */}
      <section className="mt-14 border-t pt-12">
        <h2 className="display text-[28px] leading-tight sm:text-[34px]">
          What an operator list cannot tell you
        </h2>
        <dl className="mt-6 max-w-[64ch] space-y-4 text-[13.5px] leading-[1.7]">
          <div>
            <dt className="font-semibold">How many</dt>
            <dd className="mt-1 text-[color:var(--text-secondary)]">{d.note}</dd>
          </div>
          <div>
            <dt className="font-semibold">Who is missing</dt>
            <dd className="mt-1 text-[color:var(--text-secondary)]">{d.gap}</dd>
          </div>
          <div>
            <dt className="font-semibold">Where the origin comes from</dt>
            <dd className="mt-1 text-[color:var(--text-secondary)]">{d.originNote}</dd>
          </div>
          {d.faults.length > 0 && (
            <div>
              <dt className="font-semibold">Known faults in this build</dt>
              <dd className="mt-1 text-[color:var(--text-secondary)]">
                {d.faults.join(" · ")}. Recorded rather than hidden: a parse that is wrong and says
                so is worth more than one that is wrong and does not.
              </dd>
            </div>
          )}
        </dl>
        <p className="mt-6 text-[12.5px]">
          <Link href="/arsenal" className="link-underline">
            Missiles by nation, and who is buying what →
          </Link>
        </p>
      </section>
    </div>
  );
}
