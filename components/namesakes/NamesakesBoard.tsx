"use client";

/**
 * The playable board at the top of /namesakes: the 3D map, the figure
 * buttons, the evidence card, and the five-card introduction.
 *
 * Every number on it is a count of the rows it was handed; it computes
 * nothing it could get wrong except what the reader filtered to.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { MapShape, Stage, StagePin } from "./stage";
import { figureIcon, SignpostArt, MagnifierArt, StampsArt, TokensArt, SwitchArt } from "./Doodles";
import { TIER_LABEL, CATEGORY_LABEL, type Category, type Tier } from "@/lib/namesakes-shared";

export interface BoardPlace {
  i: number;
  name: string;
  what: string | null;
  category: Category;
  state: string | null;
  locatedIn: string | null;
  x: number | null;
  y: number | null;
  figures: string[];
  evidence: Array<{ figure: string; tier: Tier; quote?: string; url: string }>;
  wikipedia: string | null;
}

export interface BoardFigure { id: string; name: string; kind: "god" | "leader" }

type Mode = "gods" | "gandhis";

/** A button on the board: one figure, or the gods outside the three the page leads with. */
interface Chip { id: string; label: string; members: string[]; colour: string }

/** Validated together on the paper surface; each pin also carries its icon. */
const GOD_COLOURS = ["#1c8f6a", "#3b62d6", "#d8641c", "#b0489a"];
const GANDHI_COLOURS = ["#b8760a", "#c8367a", "#2f7fd0"];

function chipsFor(mode: Mode, figures: BoardFigure[]): Chip[] {
  if (mode === "gandhis") {
    return [
      { id: "mahatma", label: "Mahatma", members: ["mahatma"], colour: GANDHI_COLOURS[0]! },
      { id: "indira", label: "Indira", members: ["indira"], colour: GANDHI_COLOURS[1]! },
      { id: "rajiv", label: "Rajiv", members: ["rajiv"], colour: GANDHI_COLOURS[2]! },
    ];
  }
  const lead = ["rama", "krishna", "hanuman"];
  const others = figures.filter((f) => f.kind === "god" && !lead.includes(f.id)).map((f) => f.id);
  return [
    { id: "rama", label: "Ram", members: ["rama"], colour: GOD_COLOURS[0]! },
    { id: "krishna", label: "Krishna", members: ["krishna"], colour: GOD_COLOURS[1]! },
    { id: "hanuman", label: "Hanuman", members: ["hanuman"], colour: GOD_COLOURS[2]! },
    { id: "others", label: "Other gods", members: others, colour: GOD_COLOURS[3]! },
  ];
}

const INTRO_KEY = "namesakes-intro-v1";
const fmt = (n: number) => n.toLocaleString("en-IN");

export function NamesakesBoard({
  shape, places, figures, krishnanagar,
}: {
  shape: MapShape;
  places: BoardPlace[];
  figures: BoardFigure[];
  /** Krishnanagar's own naming sentence, if the ingest found one — card two quotes it. */
  krishnanagar: string | null;
}) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<Mode>("gods");
  const [only, setOnly] = useState<string | null>(null);
  const [kind, setKind] = useState<Category | "all">("all");
  const [picked, setPicked] = useState<number | null>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const [intro, setIntro] = useState<number | null>(null);
  const [walkers, setWalkers] = useState(true);

  const figName = useMemo(() => new Map(figures.map((f) => [f.id, f.name])), [figures]);
  const chips = useMemo(() => chipsFor(mode, figures), [mode, figures]);

  /** Places in this mode and kind, each assigned to its first chip. */
  const inMode = useMemo(() => {
    const out: Array<{ p: BoardPlace; slot: number }> = [];
    for (const p of places) {
      if (kind !== "all" && p.category !== kind) continue;
      const slot = chips.findIndex((c) => c.members.some((m) => p.figures.includes(m)));
      if (slot >= 0) out.push({ p, slot });
    }
    return out;
  }, [places, chips, kind]);

  const shown = useMemo(
    () => (only ? inMode.filter(({ p }) => chips.find((c) => c.id === only)!.members.some((m) => p.figures.includes(m))) : inMode),
    [inMode, only, chips],
  );
  const placed = shown.filter(({ p }) => p.x !== null);

  const countFor = (c: Chip) => inMode.filter(({ p }) => c.members.some((m) => p.figures.includes(m))).length;

  const kinds = useMemo(() => {
    const m = new Map<Category, number>();
    for (const p of places) {
      if (!chipsFor(mode, figures).some((c) => c.members.some((x) => p.figures.includes(x)))) continue;
      m.set(p.category, (m.get(p.category) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [places, mode, figures]);

  // ── Mount the stage once ─────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    (async () => {
      try {
        const { createStage } = await import("./stage");
        if (!alive || !host.current) return;
        stage.current = createStage(host.current, shape, {
          onPick: (i) => setPicked(i),
          onHover: (i, x, y) => setHover(i === null ? null : { i, x, y }),
        }, reduced);
        setReady(true);
      } catch {
        setFailed(true);
      }
    })();
    try { if (!localStorage.getItem(INTRO_KEY)) setIntro(0); } catch { setIntro(0); }
    return () => { alive = false; stage.current?.dispose(); stage.current = null; };
  }, [shape]);

  // ── Tokens follow the filter ─────────────────────────────────────────
  useEffect(() => {
    if (!ready || !stage.current) return;
    const pins: StagePin[] = placed.map(({ p, slot }) => ({ i: p.i, x: p.x!, y: p.y!, slot, name: p.name }));
    stage.current.setPins(pins, chips.map((c) => c.colour));
  }, [ready, placed, chips]);

  useEffect(() => { stage.current?.focus(picked); }, [picked]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (intro !== null) { setIntro(null); try { localStorage.setItem(INTRO_KEY, "1"); } catch { /* ignore */ } }
      else setPicked(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [intro]);
  useEffect(() => { stage.current?.setWalkers(walkers); }, [walkers]);

  const closeIntro = () => {
    setIntro(null);
    try { localStorage.setItem(INTRO_KEY, "1"); } catch { /* private window: it will show again */ }
  };

  const pick = picked !== null ? places[picked] ?? null : null;
  const lead = only ? chips.find((c) => c.id === only)! : null;

  const CARDS: Array<{ title: ReactNode; body: ReactNode; art: ReactNode }> = [
    {
      title: <>Who is this place named after?</>,
      body: <>India names towns after its gods and names airports, universities and roads after its Gandhis. This board puts every one we could prove on the map — one token each.</>,
      art: <SignpostArt />,
    },
    {
      title: <>Spelling is not proof</>,
      body: krishnanagar
        ? <>A name that contains a god&rsquo;s is not evidence of a god. Krishnanagar&rsquo;s own article: <q>{krishnanagar}</q> So nothing lands on this map because of how it is spelled.</>
        : <>A name that contains a god&rsquo;s is not evidence of a god: plenty of Krishna-towns and Ram-towns are named after kings, rivers and hills. So nothing lands on this map because of how it is spelled.</>,
      art: <MagnifierArt />,
    },
    {
      title: <>Three kinds of proof</>,
      body: <>A token needs Wikidata&rsquo;s &ldquo;named after&rdquo;, or a sentence in the place&rsquo;s Wikipedia article that says so — quoted word for word — or, for the Gandhis only, the full name in the place&rsquo;s own name.</>,
      art: <StampsArt />,
    },
    {
      title: <>Tap a token</>,
      body: <>Each token is one place, sitting on its own coordinates. A stack is many places in one town. Tap one to read the proof and open its source. The little people just read the signs aloud.</>,
      art: <TokensArt />,
    },
    {
      title: <>Gods or Gandhis</>,
      body: <>Flip the board with the switch at the top. The round buttons pick one figure; the counts on them are the tokens you can see.</>,
      art: <SwitchArt />,
    },
  ];

  return (
    <div className="ns-board">
      <div ref={host} className="ns-stage" aria-label="3D map of India with places named after the chosen figures" role="img" />
      {failed && <p className="ns-fallback">This board needs WebGL, which this browser did not provide. Every place is in the list further down the page.</p>}

      {/* Top-left: the headline number, like a score. */}
      <div className="ns-hud">
        <div className="ns-hud-num">{fmt(shown.length)}</div>
        <div className="ns-hud-label">
          {mode === "gods" ? "places named after " : "places named after "}
          {lead ? lead.label === "Other gods" ? "the other gods" : lead.label === "Mahatma" ? "Mahatma Gandhi" : lead.label === "Indira" ? "Indira Gandhi" : lead.label === "Rajiv" ? "Rajiv Gandhi" : lead.label : mode === "gods" ? "the gods" : "the Gandhis"}
        </div>
        <div className="ns-hud-bar"><span style={{ width: `${shown.length ? (placed.length / shown.length) * 100 : 0}%` }} /></div>
        <div className="ns-hud-sub">{fmt(placed.length)} on the map · {fmt(shown.length - placed.length)} have no coordinates of their own</div>
      </div>

      {/* Top-right: the switch and the kind filter. */}
      <div className="ns-panel">
        <div className="ns-switch" role="radiogroup" aria-label="Which board">
          {(["gods", "gandhis"] as const).map((m) => (
            <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? "on" : ""}
              onClick={() => { setMode(m); setOnly(null); setKind("all"); setPicked(null); }}>
              {m === "gods" ? "Gods" : "Gandhis"}
            </button>
          ))}
        </div>
        <label className="ns-kind">
          <span>What kind</span>
          <select value={kind} onChange={(e) => { setKind(e.target.value as Category | "all"); setPicked(null); }}>
            <option value="all">Everything</option>
            {kinds.map(([k, n]) => <option key={k} value={k}>{CATEGORY_LABEL[k]} ({fmt(n)})</option>)}
          </select>
        </label>
      </div>

      {/* Bottom-left: the tip card. */}
      <div className="ns-tip">
        <b>{mode === "gods" ? "Named, not dedicated" : "One name, many things"}</b>
        <p>
          {mode === "gods"
            ? "Temples are left off this board: a temple is dedicated to its god, which is a different claim from a town being named after one."
            : "The Gandhis' tokens are universities, hospitals, stadiums, airports and roads as well as towns. Use “What kind” to see one sort at a time."}
        </p>
        <button className="ns-link" onClick={() => setWalkers((w) => !w)}>{walkers ? "Pause the walkers" : "Let them walk"}</button>
        {" · "}
        <button className="ns-link" onClick={() => setIntro(0)}>How this works</button>
      </div>

      {/* Bottom-right: the figure buttons with their counts. */}
      <div className="ns-figs" role="group" aria-label="Pick a figure">
        {chips.map((c) => {
          const n = countFor(c);
          return (
            <button key={c.id} className={`ns-fig ${only === c.id ? "on" : ""}`} aria-pressed={only === c.id}
              onClick={() => { setOnly(only === c.id ? null : c.id); setPicked(null); }}
              title={c.id === "others" ? c.members.map((m) => figName.get(m)).join(", ") : c.label}>
              <span className="ns-fig-disc" style={{ color: "#1c1b19", ["--dot" as string]: c.colour }}>{figureIcon(c.id, 28)}</span>
              <span className="ns-fig-badge" style={{ background: c.colour }}>{n > 999 ? `${Math.round(n / 100) / 10}k` : n}</span>
              <span className="ns-fig-name">{c.label}</span>
            </button>
          );
        })}
      </div>

      {hover && hover.i !== picked && (
        <div className="ns-tooltip" style={{ left: hover.x + 14, top: hover.y + 14 }}>{places[hover.i]?.name}</div>
      )}

      {pick && (
        <aside className="ns-card ns-pick" aria-live="polite">
          <button className="ns-close" onClick={() => setPicked(null)} aria-label="Close">×</button>
          <div className="ns-eyebrow">{CATEGORY_LABEL[pick.category]}</div>
          <h3>{pick.name}</h3>
          <p className="ns-where">{[pick.what, pick.locatedIn, pick.state].filter(Boolean).filter((x, k, a) => a.indexOf(x) === k).join(" · ")}</p>
          {pick.figures.map((f) => (
            <div key={f} className="ns-proof">
              <div className="ns-proof-who">Named after <b>{figName.get(f)}</b></div>
              {pick.evidence.filter((e) => e.figure === f).map((e, k) => (
                <div key={k} className={`ns-stamp t-${e.tier}`}>
                  <span className="ns-stamp-tier">{TIER_LABEL[e.tier]}</span>
                  {e.quote && <q>{e.quote}</q>}
                  <a href={e.url} target="_blank" rel="noreferrer">{e.url.includes("wikidata") ? "Open on Wikidata" : "Open on Wikipedia"} ↗</a>
                </div>
              ))}
            </div>
          ))}
        </aside>
      )}

      {intro !== null && (
        <div className="ns-intro" role="dialog" aria-modal="true" aria-label="How this board works">
          <div className="ns-card ns-intro-card">
            <div className="ns-intro-art">{CARDS[intro]!.art}</div>
            <div className="ns-intro-count">{intro + 1} of {CARDS.length}</div>
            <h2>{CARDS[intro]!.title}</h2>
            <p>{CARDS[intro]!.body}</p>
            <div className="ns-intro-buttons">
              {intro < CARDS.length - 1 ? (
                <>
                  <button className="ns-btn" onClick={closeIntro}>Skip</button>
                  <button className="ns-btn dark" onClick={() => setIntro(intro + 1)}>Next</button>
                </>
              ) : (
                <button className="ns-btn dark" onClick={closeIntro}>Play now</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
