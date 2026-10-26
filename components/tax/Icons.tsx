/** Small pictograms for the unit charts on /income-tax. Each is drawn in currentColor so the card sets its hue. */
import type { TaxItem } from "@/lib/tax";

const PATHS: Record<TaxItem["icon"], string> = {
  phone: "M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm3 17h4v1h-4z",
  missile: "M11 1h2l1.5 4v12l2.5 3v2l-3-1.5-.5 2.5h-3l-.5-2.5L7 22v-2l2.5-3V5z",
  jet: "M12 1l1.5 6 9.5 6v2l-9.5-3-.5 6 3 2.5v1.5l-4-1-4 1v-1.5l3-2.5-.5-6-9.5 3v-2l9.5-6z",
  ship: "M2 15h20l-3 6H5zm4-2V9h5V6h3v3h3v4zM11 3h2v3h-2z",
  moon: "M12 2a10 10 0 1 0 10 10 8 8 0 0 1-10-10z",
  hospital: "M4 22V6l8-4 8 4v16h-6v-5h-4v5zm6.5-14v2.5H8v2h2.5V15h2v-2.5H15v-2h-2.5V8z",
  train: "M6 3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3l2 3h-2.5l-2-3h-7l-2 3H4l2-3a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm-.5 4v5h13V7zM7 14.5a1.5 1.5 0 1 0 0 .01zm10 0a1.5 1.5 0 1 0 0 .01z",
};

export function Icon({ kind, size = 18, fraction = 1 }: { kind: TaxItem["icon"]; size?: number; fraction?: number }) {
  // A partial last icon is clipped from the left, so 0.4 of an icon shows as 40% of it.
  const id = `clip-${kind}-${Math.round(fraction * 100)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="inline-block flex-none">
      {fraction < 1 && <defs><clipPath id={id}><rect x="0" y="0" width={24 * fraction} height="24" /></clipPath></defs>}
      {fraction < 1 && <path d={PATHS[kind]} fill="currentColor" opacity={0.18} />}
      <path d={PATHS[kind]} fill="currentColor" clipPath={fraction < 1 ? `url(#${id})` : undefined} />
    </svg>
  );
}
