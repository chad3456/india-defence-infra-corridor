"use client";

import { useEffect, useMemo, useState } from "react";
import { AXES, ITEMS, NO_RECORD, PROMPT, SCALE, combine, decodeProfile, describe, encodeProfile, mixedOrder, scoreAll, type Answers, type AxisScore, type Evidence, type Profile, type SubjectKind } from "@/lib/axes";
import { ANCHOR_MAP, anchorScores, governingParty, type AnchorParty } from "@/lib/axes-anchors";

/**
 * The 12-axis test: answer it for yourself, or rate a leader or a government
 * on their record, with a source per answer. Results are twelve diverging
 * bars; other profiles (shared codes) and V-Party's expert anchors can be laid
 * over them. Nothing leaves the browser except as a link the user copies.
 */

const COLOURS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];
const KIND_LABEL: Record<SubjectKind, string> = { self: "Yourself", leader: "A leader", country: "A country" };
const STORE = "axes12-draft";
const PER_PAGE = 8;

type Overlay = { label: string; scores: AxisScore[]; colour: string };
type Anchor = { party: AnchorParty; why: string };

export function AxesTest({ parties, vpartySource }: { parties: AnchorParty[]; vpartySource: { url: string; title: string } | null }) {
  const [kind, setKind] = useState<SubjectKind>("self");
  const [subject, setSubject] = useState("");
  const [rater, setRater] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [evidence, setEvidence] = useState<Evidence>({});
  const [order, setOrder] = useState<"mixed" | "axis">("mixed");
  const [page, setPage] = useState(0);
  const [view, setView] = useState<"test" | "results">("test");
  const [others, setOthers] = useState<Profile[]>([]);
  const [pasted, setPasted] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [asRaters, setAsRaters] = useState(false);
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [pq, setPq] = useState("");
  const [copied, setCopied] = useState(false);

  // A shared link opens straight on its results; otherwise the last draft is restored.
  useEffect(() => {
    const m = /[#&]p=([^&]+)/.exec(window.location.hash);
    const shared = m ? decodeProfile(m[1]!) : null;
    if (shared) { load(shared); setView("results"); return; }
    try {
      const d = JSON.parse(localStorage.getItem(STORE) ?? "null") as Profile | null;
      if (d && d.v === 1) load(d);
    } catch { /* no storage: start empty */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify({ v: 1, kind, subject, answers, evidence, rater, at: "" } satisfies Profile)); } catch { /* private window */ }
  }, [kind, subject, answers, evidence, rater]);

  function load(p: Profile) {
    setKind(p.kind); setSubject(p.subject); setAnswers(p.answers); setEvidence(p.evidence); setRater(p.rater ?? "");
    setOrder(p.kind === "self" ? "mixed" : "axis");
  }

  const items = useMemo(() => (order === "mixed" ? mixedOrder() : ITEMS), [order]);
  const pages = Math.ceil(items.length / PER_PAGE);
  const shown = items.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const answered = ITEMS.filter((i) => i.id in answers).length;
  const scores = useMemo(() => scoreAll(answers, evidence), [answers, evidence]);
  const cited = Object.entries(evidence).filter(([k, v]) => v.trim() && typeof answers[k] === "number").length;
  const numeric = ITEMS.filter((i) => typeof answers[i.id] === "number").length;
  const scale = SCALE[kind];
  const who = kind === "self" ? "You" : subject.trim() || (kind === "leader" ? "This leader" : "This government");

  const profile = (): Profile => ({ v: 1, kind, subject: subject.trim(), answers, evidence, rater: rater.trim() || undefined, at: new Date().toISOString().slice(0, 10) });
  const shareUrl = () => `${window.location.origin}${window.location.pathname}#p=${encodeProfile(profile())}`;

  const overlays: Overlay[] = others.map((o, i) => ({ label: `${o.kind === "self" ? o.rater || "A respondent" : o.subject}${o.rater && o.kind !== "self" ? ` (rated by ${o.rater})` : ""}`, scores: scoreAll(o.answers, o.evidence), colour: COLOURS[(i + 1) % COLOURS.length]! }));
  const pooled = asRaters && others.length ? combine([scores, ...overlays.map((o) => o.scores)]) : null;
  const anchorRows = anchors.map((a) => ({ ...a, scores: anchorScores(a.party) }));

  const partyHits = useMemo(() => {
    const q = pq.trim().toLowerCase();
    if (q.length < 2) return [];
    return parties.filter((p) => `${p.name} ${p.orig ?? ""} ${p.abbr ?? ""} ${p.country}`.toLowerCase().includes(q)).sort((a, b) => b.year - a.year || (b.vote ?? 0) - (a.vote ?? 0)).slice(0, 8);
  }, [pq, parties]);
  const countries = useMemo(() => [...new Set(parties.filter((p) => p.gov === 0).map((p) => p.country))].sort(), [parties]);

  const set = (id: string, v: number | null) => setAnswers((a) => ({ ...a, [id]: v }));
  const unset = (id: string) => setAnswers((a) => { const n = { ...a }; delete n[id]; return n; });

  return (
    <div className="ax">
      <div className="ax-setup">
        <div className="ax-seg" role="radiogroup" aria-label="Who is being rated">
          {(Object.keys(KIND_LABEL) as SubjectKind[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => { setKind(k); setOrder(k === "self" ? "mixed" : "axis"); setPage(0); }}>{KIND_LABEL[k]}</button>
          ))}
        </div>
        {kind !== "self" && (
          <input className="ax-input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={kind === "leader" ? "Leader's name, and office held" : "Country, and the government in office"} aria-label="Who is being rated" maxLength={120} />
        )}
        <input className="ax-input ax-input-sm" value={rater} onChange={(e) => setRater(e.target.value)} placeholder={kind === "self" ? "Your name (optional)" : "Rated by (optional)"} aria-label="Rater" maxLength={80} />
        <div className="ax-seg" role="radiogroup" aria-label="Question order">
          <button type="button" role="radio" aria-checked={order === "mixed"} onClick={() => { setOrder("mixed"); setPage(0); }}>Mixed order</button>
          <button type="button" role="radio" aria-checked={order === "axis"} onClick={() => { setOrder("axis"); setPage(0); }}>By axis</button>
        </div>
      </div>
      <p className="ax-note">{PROMPT[kind]} {kind !== "self" && "Add a source for each answer — a link to a speech, vote, law or budget line. Leave a statement on “" + NO_RECORD[kind] + "” rather than guess: it is left out of the score, not counted as the middle."}{kind === "self" && " Mixed order keeps you from answering an axis as a block."}</p>

      <div className="ax-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={view === "test"} onClick={() => setView("test")}>Questions <em>{answered}/{ITEMS.length}</em></button>
        <button type="button" role="tab" aria-selected={view === "results"} onClick={() => setView("results")}>Results <em>{scores.filter((s) => s.score !== null).length}/12 axes</em></button>
      </div>

      {view === "test" ? (
        <div>
          <div className="ax-progress" aria-hidden><i style={{ width: `${(100 * answered) / ITEMS.length}%` }} /></div>
          <div className="ax-pages" role="navigation" aria-label="Pages">
            {Array.from({ length: pages }, (_, i) => {
              const ids = items.slice(i * PER_PAGE, i * PER_PAGE + PER_PAGE).map((x) => x.id);
              const done = ids.filter((id) => id in answers).length;
              return <button key={i} type="button" aria-current={i === page} onClick={() => setPage(i)} title={order === "axis" ? AXES[i]!.name : `Page ${i + 1}`} className={done === ids.length ? "ax-done" : done ? "ax-part" : ""}>{order === "axis" ? AXES[i]!.name.split(" ")[0] : i + 1}</button>;
            })}
          </div>
          {order === "axis" && <div className="ax-axishead"><h3>{AXES[page]!.name}</h3><p>{AXES[page]!.question} <span>{AXES[page]!.poles[0]} ↔ {AXES[page]!.poles[1]}</span></p></div>}
          <ol className="ax-items" start={page * PER_PAGE + 1}>
            {shown.map((it) => {
              const a = answers[it.id];
              return (
                <li key={it.id}>
                  <p className="ax-stmt">{it.text}</p>
                  <div className="ax-scale" role="radiogroup" aria-label={it.text}>
                    {scale.map((lab, i) => (
                      <button key={lab} type="button" role="radio" aria-checked={a === i - 2} onClick={() => (a === i - 2 ? unset(it.id) : set(it.id, i - 2))} className={`ax-s${i}`}>{lab}</button>
                    ))}
                    <button type="button" role="radio" aria-checked={a === null} onClick={() => (a === null ? unset(it.id) : set(it.id, null))} className="ax-nr">{NO_RECORD[kind]}</button>
                  </div>
                  {kind !== "self" && typeof a === "number" && (
                    <input className="ax-input ax-ev" value={evidence[it.id] ?? ""} onChange={(e) => setEvidence((ev) => ({ ...ev, [it.id]: e.target.value }))} placeholder="Source: link to a speech, vote, law, budget or reliable report" aria-label="Source for this answer" maxLength={400} />
                  )}
                </li>
              );
            })}
          </ol>
          <div className="ax-nav">
            <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Previous</button>
            {page < pages - 1 ? <button type="button" className="ax-primary" onClick={() => setPage((p) => p + 1)}>Next →</button> : <button type="button" className="ax-primary" onClick={() => setView("results")}>See results →</button>}
          </div>
          <button type="button" className="ax-link" onClick={() => { if (confirm("Clear every answer and source?")) { setAnswers({}); setEvidence({}); setPage(0); } }}>Start again</button>
        </div>
      ) : (
        <div>
          <div className="ax-reshead">
            <div>
              <p className="ax-eyebrow">{KIND_LABEL[kind]}{rater && kind !== "self" ? ` · rated by ${rater}` : ""}</p>
              <h3>{kind === "self" ? (rater ? `${rater}'s profile` : "Your profile") : who}</h3>
              <p className="ax-note">{numeric} of {ITEMS.length} statements answered{kind !== "self" && <> · <b className={cited < numeric ? "ax-warn" : ""}>{cited} of {numeric} answers sourced</b></>}. Scores run from −100 (left-hand pole) to +100 (right-hand); the bands are words, not verdicts.</p>
            </div>
            <div className="ax-actions">
              <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(shareUrl()); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { window.prompt("Copy this link", shareUrl()); } }}>{copied ? "Copied" : "Copy share link"}</button>
              <button type="button" onClick={() => { const blob = new Blob([JSON.stringify({ ...profile(), scores, items: ITEMS.map((i) => ({ id: i.id, axis: i.axis, key: i.key, text: i.text, answer: answers[i.id] ?? "unanswered", source: evidence[i.id] || undefined })) }, null, 1)], { type: "application/json" }); const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = `12-axes-${(subject || rater || "profile").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`; a.click(); URL.revokeObjectURL(u); }}>Download answers</button>
            </div>
          </div>

          <div className="ax-legend">
            <span><i style={{ background: COLOURS[0] }} />{kind === "self" ? "This profile" : who}</span>
            {overlays.map((o) => <span key={o.label}><i style={{ background: o.colour }} />{o.label}</span>)}
            {pooled && <span><i className="ax-band-key" />Raters' mean and range</span>}
            {anchorRows.map((a, k) => <span key={a.party.id}><i className={`ax-diamond-key ax-a${k}`} />{a.party.abbr ?? a.party.name}, {a.party.country} — V-Party {a.party.year}</span>)}
          </div>

          <ol className="ax-results">
            {AXES.map((ax) => {
              const s = scores.find((x) => x.axis === ax.id)!;
              const pool = pooled?.find((x) => x.axis === ax.id);
              const anchorMeasure = ANCHOR_MAP.find((m) => m.axis === ax.id)?.measures;
              return (
                <li key={ax.id}>
                  <div className="ax-rowhead">
                    <b>{ax.name}</b><span className="ax-q">{ax.question}</span>
                    <span className="ax-desc">{describe(ax, s.score)}{s.score !== null && <em> {s.score > 0 ? "+" : ""}{s.score}</em>}</span>
                  </div>
                  <div className="ax-track">
                    <span className="ax-pole" title={ax.means[0]}>{ax.poles[0]}</span>
                    <div className="ax-bar">
                      <div className="ax-zero" />
                      {pool && pool.min !== null && pool.max !== null && <div className="ax-band" style={{ left: `${(pool.min + 100) / 2}%`, width: `${(pool.max - pool.min) / 2}%` }} />}
                      {pool && pool.mean !== null && <div className="ax-mean" style={{ left: `${(pool.mean + 100) / 2}%` }} title={`Mean of ${pool.raters} raters: ${pool.mean}`} />}
                      {s.score !== null && <div className="ax-fill" style={{ left: `${Math.min(50, (s.score + 100) / 2)}%`, width: `${Math.abs(s.score) / 2}%`, background: COLOURS[0] }} />}
                      {s.score !== null && <div className="ax-dot" style={{ left: `${(s.score + 100) / 2}%`, background: COLOURS[0] }} />}
                      {overlays.map((o) => { const v = o.scores.find((x) => x.axis === ax.id)?.score; return v === null || v === undefined ? null : <div key={o.label} className="ax-dot ax-dot-o" style={{ left: `${(v + 100) / 2}%`, background: o.colour }} title={`${o.label}: ${v}`} />; })}
                      {anchorRows.map((a, k) => { const v = a.scores.find((x) => x.axis === ax.id)?.score; return v === null || v === undefined ? null : <div key={a.party.id} className={`ax-diamond ax-a${k}`} style={{ left: `${(v + 100) / 2}%` }} title={`${a.party.abbr ?? a.party.name} (V-Party ${a.party.year}): ${v}`} />; })}
                    </div>
                    <span className="ax-pole ax-pole-r" title={ax.means[1]}>{ax.poles[1]}</span>
                  </div>
                  <p className="ax-meta">
                    {s.score === null ? s.why : `${s.answered} of 8 answered${kind !== "self" ? `, ${s.cited} sourced` : ""}`}
                    {anchorRows.length > 0 && (anchorMeasure ? <> · V-Party anchor: {anchorMeasure}</> : <> · No V-Party measure for this axis</>)}
                  </p>
                </li>
              );
            })}
          </ol>

          <div className="ax-compare">
            <div>
              <h4>Compare with another profile</h4>
              <p className="ax-note">Paste a share link someone else made — another person, or another rater of the same leader.</p>
              <div className="ax-row">
                <input className="ax-input" value={pasted} onChange={(e) => { setPasted(e.target.value); setPasteError(""); }} placeholder="Paste a share link or code" aria-label="Share link to compare" />
                <button type="button" onClick={() => { const p = decodeProfile(pasted); if (!p) { setPasteError("That is not a 12-axis share link."); return; } if (others.length >= 3) { setPasteError("Three comparisons at most."); return; } setOthers((o) => [...o, p]); setPasted(""); }}>Add</button>
              </div>
              {pasteError && <p className="ax-warn">{pasteError}</p>}
              {others.length > 0 && (
                <>
                  <ul className="ax-chips">{others.map((o, i) => <li key={i}><span style={{ background: COLOURS[(i + 1) % 4] }} />{o.subject || o.rater || "Profile"}<button type="button" aria-label="Remove" onClick={() => setOthers((x) => x.filter((_, j) => j !== i))}>✕</button></li>)}</ul>
                  <label className="ax-check"><input type="checkbox" checked={asRaters} onChange={(e) => setAsRaters(e.target.checked)} /> These are raters of the same subject: show their mean and range</label>
                </>
              )}
            </div>
            <div>
              <h4>Expert anchor: V-Party</h4>
              {parties.length ? (
                <>
                  <p className="ax-note">V-Dem&apos;s experts coded {parties.length.toLocaleString("en-IN")} parties in {new Set(parties.map((p) => p.country)).size} countries, last in 2019 at the latest. A leader is anchored by their party; a country by the senior governing party in its latest coded year. Seven of the twelve axes have a V-Party measure.</p>
                  <input className="ax-input" value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Search a party or country…" aria-label="Search V-Party" />
                  {partyHits.length > 0 && (
                    <ul className="ax-hits">{partyHits.map((p) => (
                      <li key={p.id}><button type="button" onClick={() => { if (!anchors.some((a) => a.party.id === p.id) && anchors.length < 3) setAnchors((a) => [...a, { party: p, why: "chosen" }]); setPq(""); }}>
                        <b>{p.abbr ? `${p.abbr} · ` : ""}{p.name}</b><span>{p.country}, coded {p.year}{p.vote !== null ? `, ${p.vote}% of the vote` : ""}{p.orig ? ` · ${p.orig}` : ""}</span>
                      </button></li>
                    ))}</ul>
                  )}
                  <select className="ax-input" value="" onChange={(e) => { const g = governingParty(parties, e.target.value); if (g && !anchors.some((a) => a.party.id === g.id) && anchors.length < 3) setAnchors((a) => [...a, { party: g, why: `governing ${e.target.value}` }]); }} aria-label="Anchor a country by its governing party">
                    <option value="">…or a country&apos;s governing party</option>
                    {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {anchors.length > 0 && <ul className="ax-chips">{anchors.map((a, k) => <li key={a.party.id}><span className={`ax-diamond-key ax-a${k}`} />{a.party.abbr ?? a.party.name}, {a.party.country} ({a.party.year}{a.why !== "chosen" ? `, ${a.why}` : ""})<button type="button" aria-label="Remove" onClick={() => setAnchors((x) => x.filter((y) => y.party.id !== a.party.id))}>✕</button></li>)}</ul>}
                  {vpartySource && <p className="ax-note">Source: <a href={vpartySource.url} target="_blank" rel="noopener noreferrer">{vpartySource.title}</a>, V-Dem Institute. A party&apos;s position is not its leader&apos;s, and 2019 is not today.</p>}
                </>
              ) : <p className="ax-note">The V-Party extract is not in this build.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
