import type { RefreshState } from "@/lib/freshness";
import { STALE_THRESHOLD_HOURS } from "@/lib/freshness";

/**
 * A one-line statement of how old the map is, and what that means.
 *
 * Deliberately not a green dot. A live-looking indicator on data that can be
 * six hours old is worse than no indicator, because it answers the reader's
 * question wrongly rather than leaving it open. The age is stated in words, the
 * feed count says how much of the network answered, and when the data is behind
 * the line says that instead of implying freshness by omission.
 */
export default function Freshness({ state }: { state: RefreshState | null }) {
  if (!state) {
    return (
      <p className="text-[11px] text-[color:var(--text-muted)]">
        No ingest has run yet, so the map shows nothing.
      </p>
    );
  }

  const failed = state.feedsTotal - state.feedsOk;

  return (
    <div className="rounded-lg border p-3">
      <p className="flex flex-wrap items-baseline gap-x-2 text-[12px]">
        <span
          aria-hidden
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{
            background: state.stale ? "var(--status-warning)" : "var(--status-good)",
          }}
        />
        <span className="font-medium">Feeds last read {state.ago}</span>
        <span className="text-[color:var(--text-muted)]">
          · {state.feedsOk} of {state.feedsTotal} answered
          {failed > 0 ? ` · ${failed} did not` : ""}
          {" · "}
          {state.total} events on the map
        </span>
      </p>

      <p className="mt-1.5 text-[11px] leading-relaxed text-[color:var(--text-secondary)]">
        {state.stale ? (
          <>
            <strong className="font-medium">This is behind.</strong> The ingest runs every six
            hours and has not run for over {STALE_THRESHOLD_HOURS} hours, so anything reported
            since then is missing. A quiet map right now means a stalled pipeline, not a quiet
            day. The live panel above is unaffected — it reads the feeds directly.
          </>
        ) : (
          <>
            The ingest runs every six hours. It asked for every half hour and GitHub would not
            honour that — measured gaps ran to twelve hours — so a pin here can lag the outlet
            that reported it by most of a working day. That is the cost of the checking: these
            events have been placed, categorised and matched against primary sources. For what is
            on the wires this minute, unchecked, see the live panel above.
          </>
        )}
      </p>
    </div>
  );
}
