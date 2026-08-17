import IndiaMap from "@/components/map/IndiaMap";
import ChartCard from "@/components/charts/ChartCard";
import { getChart } from "@/lib/registry";

export const metadata = { title: "Map & timelapse" };

export default function MapPage() {
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
          Where the corridors actually landed
        </h1>
        <p className="mt-2 max-w-[640px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          Drag the year or press play to watch India&apos;s access-controlled expressway network
          appear between 2001 and today. In 2001 there was effectively nothing — the Mumbai–Pune
          Expressway opened in 2002 and remained close to the whole story for a decade. Almost
          everything on this map is post-2017.
        </p>
      </section>

      <section className="py-6">
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
