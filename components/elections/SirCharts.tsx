"use client";

import HoverCard, { useHoverCard } from "@/components/charts/HoverCard";
import type { SirFile, SirReason, SirState } from "@/lib/elections-atlas-shared";
import { lakh, reasonGap } from "@/lib/elections-atlas-shared";

/**
 * Reasons in a fixed order and a fixed colour each, on every chart. The
 * categorical slots are the site's validated four plus a neutral; "not
 * attributed" is hatched, because it is the absence of a reason and must not
 * read as a fifth one.
 */
export const REASON_ORDER: Array<SirReason | "unattributed"> = ["dead", "shifted", "absent", "shiftedOrAbsent", "duplicate", "other", "unattributed"];
export const REASON_COLOUR: Record<SirReason | "unattributed", string> = {
  dead: "var(--series-1)",
  shifted: "var(--series-2)",
  absent: "var(--series-4)",
  shiftedOrAbsent: "var(--series-2)",
  duplicate: "var(--series-3)",
  other: "var(--color-ink-2)",
  unattributed: "url(#sir-hatch)",
};
const SHORT: Record<SirReason | "unattributed", string> = {
  dead: "Dead",
  shifted: "Shifted",
  absent: "Absent",
  shiftedOrAbsent: "Shifted or absent",
  duplicate: "Duplicate",
  other: "Other",
  unattributed: "Not attributed",
};

const fmt = (n: number) => n.toLocaleString("en-IN");

function Hatch() {
  return (
    <defs>
      <pattern id="sir-hatch" width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill="var(--surface-2)" />
        <path d="M-1,1 l2,-2 M0,6 l6,-6 M5,7 l2,-2" stroke="var(--color-ink-muted)" strokeWidth="1.2" />
      </pattern>
    </defs>
  );
}

/** The same hatching for HTML bars, where an SVG pattern cannot be used as a background. */
const HATCH_CSS = "repeating-linear-gradient(135deg, var(--surface-2) 0 3px, var(--color-ink-muted) 3px 4.5px)";

/** Segments of a stage's left-out total: each reason given, then whatever no reason was given for. */
function segments(st: SirState): Array<{ key: SirReason | "unattributed"; value: number }> {
  const d = st.draft;
  if (!d?.leftOut) return [];
  const out: Array<{ key: SirReason | "unattributed"; value: number }> = [];
  for (const k of REASON_ORDER) {
    if (k === "unattributed") continue;
    const v = d.reasons?.[k];
    if (v) out.push({ key: k, value: v });
  }
  const gap = reasonGap(d);
  const un = gap ? Math.max(0, gap.unattributed) : d.leftOut;
  if (un > 0) out.push({ key: "unattributed", value: un });
  return out;
}

/**
 * "Shifted" and "shifted or absent" share a colour: states report one or the
 * other, and a fifth hue would fail the site's colour-distance check. The
 * legend says so rather than listing the same swatch twice.
 */
export function SirLegend({ keys }: { keys: Array<SirReason | "unattributed"> }) {
  const both = keys.includes("shifted") && keys.includes("shiftedOrAbsent");
  const shown = both ? keys.filter((k) => k !== "shiftedOrAbsent") : keys;
  return (
    <div className="flex flex-wrap gap-3 text-[11px] text-ink-2">
      {shown.map((k) => (
        <span key={k} className="inline-flex items-center gap-1">
          <svg width="20" height="12" aria-hidden><Hatch /><rect width="20" height="12" rx="2" fill={REASON_COLOUR[k]} /></svg>
          {both && k === "shifted" ? "Shifted (or shifted/absent, where reported together)" : SHORT[k]}
        </span>
      ))}
    </div>
  );
}

/**
 * Every state's draft-stage left-out names as one bar, split by reason. Bars
 * are drawn to a common scale in names, not normalised to 100%, because the
 * size of the deletion is the first thing a reader needs; the share of the
 * roll is printed beside it.
 */
export function SirStateBars({ sir, onPick }: { sir: SirFile; onPick?: (state: string) => void }) {
  const card = useHoverCard();
  const rows = sir.states
    .filter((s) => s.draft?.leftOut)
    .map((s) => ({ s, segs: segments(s), total: s.draft!.leftOut!, share: s.before?.electors ? (s.draft!.leftOut! / s.before.electors) * 100 : null }))
    .sort((a, b) => b.total - a.total);
  const max = Math.max(...rows.map((r) => r.total));
  const used = new Set<SirReason | "unattributed">();
  rows.forEach((r) => r.segs.forEach((g) => used.add(g.key)));

  return (
    <div>
      <SirLegend keys={REASON_ORDER.filter((k) => used.has(k))} />
      <ol className="mt-3 space-y-2" aria-label="Names left out of each state's SIR draft roll, by reason">
        {rows.map((r) => (
          <li key={r.s.state} className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-2 sm:grid-cols-[11rem_minmax(0,1fr)]">
            <span className="truncate pt-0.5 text-right text-xs text-ink-2" title={r.s.state}>{r.s.state}</span>
            <span className="min-w-0">
              <span className="flex h-4 overflow-hidden rounded-sm" style={{ width: `${Math.max(1, (r.total / max) * 100)}%` }}>
                {r.segs.map((g) => (
                  <span key={g.key} className="h-full" style={{ width: `${(g.value / r.total) * 100}%`, background: g.key === "unattributed" ? undefined : REASON_COLOUR[g.key], backgroundImage: g.key === "unattributed" ? HATCH_CSS : undefined }}
                    onMouseMove={(e) => card.show(e, {
                      title: `${r.s.state}: ${SHORT[g.key].toLowerCase()}`,
                      subtitle: `Phase ${r.s.phase} draft roll`,
                      rows: [
                        { label: "Names", value: fmt(g.value), colour: g.key === "unattributed" ? undefined : REASON_COLOUR[g.key] },
                        { label: "Share of left out", value: `${((g.value / r.total) * 100).toFixed(1)}%` },
                        { label: "All left out", value: fmt(r.total) },
                      ],
                      note: g.key === "unattributed" ? "The difference between the stated total and the reasons reported for it." : r.s.draft?.note,
                    })}
                    onMouseLeave={card.hide} />
                ))}
              </span>
              <span className="mt-0.5 block text-[11px] tabular-nums text-ink">{lakh(r.total)}{r.share != null ? ` · ${r.share.toFixed(1)}% of the roll` : ""}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-1 text-[11px] text-ink-muted">
        Percent is of the roll before revision, computed here (derived). Approximate where the source wrote the figure in lakh or crore.
      </p>
      <HoverCard hover={card.hover} />
    </div>
  );
}

/** One state's roll through the revision: before, left out by reason, draft, final. */
export function SirStateDetail({ st, sir }: { st: SirState; sir: SirFile }) {
  const card = useHoverCard();
  const segs = segments(st);
  const before = st.before?.electors, draft = st.draft?.electors, final = st.final?.electors;
  const stages = [
    ["Roll before revision", before, st.before],
    ["Draft roll", draft, st.draft],
    ["Final roll", final, st.final],
  ] as const;
  const maxRoll = Math.max(...stages.map((s) => s[1] ?? 0));
  const total = segs.reduce((a, b) => a + b.value, 0);
  const srcLinks = (ids: string[]) => ids.map((id) => sir.sources[id]).filter(Boolean);

  return (
    <div className="space-y-6">
      {maxRoll > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">The roll at each stage</p>
          <ol className="mt-2 space-y-2">
            {stages.map(([label, v, stage]) => (
              <li key={label} className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
                <span className="text-xs text-ink-2">{label}</span>
                {v ? (
                  <span className="flex min-w-0 items-center gap-2"
                    onMouseMove={(e) => card.show(e, { title: `${st.state}: ${label.toLowerCase()}`, rows: [{ label: "Electors", value: `${stage?.approx ? "about " : ""}${fmt(v)}` }, ...(stage?.date ? [{ label: "Date", value: stage.date }] : [])], note: stage?.note })}
                    onMouseLeave={card.hide}>
                    <span className="h-4 shrink-0 rounded-sm bg-[color:var(--seq-400)]" style={{ width: `${(v / maxRoll) * 70}%` }} />
                    <span className="whitespace-nowrap text-[11px] tabular-nums text-ink">{stage?.approx ? "≈ " : ""}{lakh(v)}</span>
                  </span>
                ) : <span className="text-[11px] text-ink-muted">not published or not found</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {st.draft?.leftOut ? (
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">
            Left out of the draft: {st.draft.leftOutApprox ? "about " : ""}{fmt(st.draft.leftOut)}, by reason
          </p>
          <div className="mt-2 flex h-7 overflow-hidden rounded-sm" role="img" aria-label={`${st.state} names left out of the draft roll, split by reason`}>
            {segs.map((g) => (
              <span key={g.key} className="flex h-full items-center overflow-hidden whitespace-nowrap px-1.5 text-[11px] text-white"
                style={{ width: `${(g.value / total) * 100}%`, background: g.key === "unattributed" ? undefined : REASON_COLOUR[g.key], backgroundImage: g.key === "unattributed" ? HATCH_CSS : undefined, color: g.key === "unattributed" ? "var(--color-ink)" : undefined }}
                onMouseMove={(e) => card.show(e, { title: SHORT[g.key], rows: [{ label: "Names", value: fmt(g.value) }, { label: "Share", value: `${((g.value / st.draft!.leftOut!) * 100).toFixed(1)}%` }] })}
                onMouseLeave={card.hide}>
                {(g.value / total) > 0.12 ? `${SHORT[g.key]} ${((g.value / st.draft!.leftOut!) * 100).toFixed(0)}%` : ""}
              </span>
            ))}
          </div>
          <table className="mt-3 w-full max-w-lg text-sm">
            <tbody>
              {segs.map((g) => (
                <tr key={g.key} className="border-b border-gridline">
                  <td className="py-1 pr-3 text-ink-2">
                    <svg width="12" height="12" className="mr-2 inline" aria-hidden><Hatch /><rect width="12" height="12" rx="2" fill={REASON_COLOUR[g.key]} /></svg>
                    {g.key === "unattributed" ? "No reason given in the sources" : sir.reasons.find((r) => r.id === g.key)?.label}
                  </td>
                  <td className="py-1 text-right font-mono tabular-nums text-ink">{fmt(g.value)}</td>
                  <td className="py-1 pl-3 text-right font-mono tabular-nums text-ink-muted">{((g.value / st.draft!.leftOut!) * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!st.draft.reasons && <p className="mt-2 text-xs text-ink-2">No count by reason has been published for this state.</p>}
        </div>
      ) : null}

      {st.final && (st.final.added || st.final.removedAfterDraft || st.final.netRemoved) ? (
        <dl className="grid max-w-lg grid-cols-2 gap-2 text-sm">
          {st.final.added ? (<><dt className="text-ink-2">Added after the draft</dt><dd className="text-right font-mono tabular-nums">{fmt(st.final.added)}</dd></>) : null}
          {st.final.removedAfterDraft ? (<><dt className="text-ink-2">Removed after the draft</dt><dd className="text-right font-mono tabular-nums">{fmt(st.final.removedAfterDraft)}</dd></>) : null}
          {st.final.netRemoved ? (<><dt className="text-ink-2">Net removed, roll to final</dt><dd className="text-right font-mono tabular-nums">{fmt(st.final.netRemoved)}</dd></>) : null}
        </dl>
      ) : null}

      <div className="space-y-2 text-xs leading-relaxed text-ink-2">
        {[st.before, st.draft, st.final].map((s, i) => s?.note ? <p key={i}>{s.note}</p> : null)}
        <p className="text-ink-muted">
          Sources:{" "}
          {[...new Set([...(st.before?.sources ?? []), ...(st.draft?.sources ?? []), ...(st.final?.sources ?? [])])].map((id, i, all) => {
            const s = srcLinks([id])[0];
            return s ? <span key={id}><a href={s.url} className="underline" rel="noopener noreferrer" target="_blank">{s.publisher}</a>{i < all.length - 1 ? " · " : ""}</span> : null;
          })}
        </p>
      </div>
      <HoverCard hover={card.hover} />
    </div>
  );
}
