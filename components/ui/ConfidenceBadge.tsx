/**
 * Confidence badge.
 *
 * Status colours ship with a label, never colour alone — a reader with any
 * colour vision deficiency still gets the word.
 */
const STYLES = {
  high: { bg: "var(--status-good)", label: "high" },
  medium: { bg: "var(--status-warning)", label: "medium" },
  low: { bg: "var(--status-critical)", label: "low" },
} as const;

export default function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  const s = STYLES[level];
  return (
    <span
      className="mono inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[color:var(--text-secondary)]"
      title={`Data confidence: ${s.label}`}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: s.bg }}
        aria-hidden
      />
      {s.label}
    </span>
  );
}
