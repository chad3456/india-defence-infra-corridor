import IndiaMap from "@/components/map/IndiaMap";
import DevelopmentMap from "@/components/map/DevelopmentMap";
import { getEvents, latestEventDate } from "@/lib/events";
import ChartCard from "@/components/charts/ChartCard";
import { getChart } from "@/lib/registry";

export const metadata = { title: "Map & timelapse" };

export default function MapPage() {
  const events = getEvents();
  const latest = latestEventDate();

  const related = [
    "expressway-length--level",
    "nh-constructed-annual--level",
    "curated--network-vs-construction",
    "defence-corridor-nodes--level",
  ]
    .map((id) => getChart(id))
    .filter((c) => c !== undefined);

  return (
    <div>
      <section className="border-b pb-5">
        <p className="eyebrow">geography</p>
        <h1 className="mt-2 text-[24px] font-semibold tracking-tight">
          Where development actually landed
        </h1>
        <p className="mt-2 max-w-[660px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          Two views of the same country. Below, dated developments pinned to the place they
          happened, filterable by sector and by whether they landed in the last two days or at any
          point on record. Under that, a timelapse of the access-controlled expressway network from
          2001 to today — which in 2001 was, essentially, one road.
        </p>
      </section>

      {/* Development events */}
      <section className="border-b py-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-semibold tracking-tight">What moved, and where</h2>
          <span className="eyebrow">
            {latest ? `latest event ${latest}` : "awaiting first ingest"}
          </span>
        </div>
        <p className="mb-4 max-w-[640px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          Dated, geo-located developments built from the news pipeline. A headline becomes a pin
          only when both a category and a place can be determined — an event that cannot be placed
          is counted but never guessed onto the map. Every pin links to the outlet that reported it
          and is marked <strong>verified</strong> (a government primary release) or{" "}
          <strong>reported</strong> (a single press report). None of this feeds a chart: reported
          activity and measured data are kept apart deliberately.
        </p>
        <DevelopmentMap events={events} latestDate={latest} recentDays={2} />
      </section>

      {/* Corridor timelapse */}
      <section className="py-6">
        <h2 className="text-[15px] font-semibold tracking-tight">Expressway corridors, 2001–2026</h2>
        <p className="mt-1.5 mb-4 max-w-[640px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          Drag the year or press play to watch India&apos;s access-controlled network appear. In
          2001 there was effectively nothing — the Mumbai–Pune Expressway opened in 2002 and
          remained close to the whole story for a decade. Almost everything here is post-2017.
        </p>
        <IndiaMap />
      </section>

      <section className="border-t py-6">
        <h2 className="text-[15px] font-semibold tracking-tight">The same story as data</h2>
        <p className="mt-1.5 mb-4 max-w-[560px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          The map shows only the flagship expressways with verifiable opening years. These charts
          carry the full national picture, including the part the map cannot show: annual
          construction has flattened even as total network length keeps climbing.
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {related.map((spec) => (
            <ChartCard key={spec.id} spec={spec} compact />
          ))}
        </div>
      </section>
    </div>
  );
}
