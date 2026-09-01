import type { Stage } from "@/lib/localisation";
import { STAGE_LABEL } from "@/lib/localisation";

/**
 * A stage badge: colour plus the stage's name, always together.
 *
 * The name is not decoration. The diverging ramp carries two sub-3:1 contrast
 * warnings on its pale steps, and the standing relief for those is a visible
 * label — so the label ships with the swatch in every context, and colour never
 * has to carry the meaning by itself.
 */
export const STAGE_VAR: Record<Stage, string> = {
  reversed: "var(--stage-reversed)",
  narrowing: "var(--stage-narrowing)",
  holding: "var(--stage-holding)",
  "import-reliant": "var(--stage-import-reliant)",
  slipping: "var(--stage-slipping)",
  deepening: "var(--stage-deepening)",
  thin: "var(--baseline)",
};

export default function StageChip({ stage, small }: { stage: Stage; small?: boolean }) {
  // "Net exporter throughout" is not a point on the substitution axis, so it
  // gets a hollow marker rather than a hue. See the note in globals.css.
  const hollow = stage === "holding" || stage === "thin";
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-hairline ${
        small ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      }`}
    >
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={
          hollow
            ? { border: `1.5px solid ${STAGE_VAR[stage]}` }
            : { background: STAGE_VAR[stage] }
        }
      />
      <span className="text-ink-2">{STAGE_LABEL[stage]}</span>
    </span>
  );
}
