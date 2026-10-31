/**
 * The 12-axis political test: twelve independent questions about where a
 * person, a leader or a government stands, each answered by eight statements
 * of its own. No node imports — the questionnaire runs in the browser.
 *
 * ── How it is kept neutral ─────────────────────────────────────────────────
 *
 * 1. Balanced keying. Every axis has four statements for each pole, so a
 *    respondent who agrees with everything lands in the middle, not at one end.
 * 2. Each pole in its own words. A statement is phrased as that position's
 *    supporters would put it, never as its opponents caricature it, and the
 *    poles carry descriptive names — "Collective" and "Market", not "left"
 *    and "right", and no single ideology label for the whole profile.
 * 3. Universal wording. No statement names a country, party or person, so the
 *    same questionnaire fits India, the United States or Brazil.
 * 4. "No record" is not neutral. An unanswered statement is left out of the
 *    score rather than counted as the middle; an axis is scored only with at
 *    least four answers including one on each side, so a profile cannot lean
 *    on half a questionnaire.
 * 5. For anyone but yourself, evidence. Rating a leader or a government asks
 *    for a source per answer and reports how many answers carry one; ratings
 *    by several people can be averaged and their spread shown.
 * 6. An outside anchor. Where V-Dem's expert-coded V-Party data measures the
 *    same thing, its position is shown beside the questionnaire's, and kept
 *    separate from it.
 *
 * ── Scoring ───────────────────────────────────────────────────────────────
 *
 * Answers run −2 (strongly disagree / record strongly against) to +2. A
 * statement keyed to the right-hand pole counts its answer as given; one keyed
 * to the left-hand pole counts it reversed. An axis's score is the mean over
 * answered statements, scaled to −100 (left-hand pole) … +100 (right-hand).
 */

export type AxisId = "economy" | "welfare" | "trade" | "environment" | "liberty" | "pluralism" | "populism" | "social" | "religion" | "nation" | "world" | "force";

export interface Axis {
  id: AxisId;
  name: string;
  question: string;
  /** Left-hand pole (score −100) and right-hand pole (+100). */
  poles: [string, string];
  /** One line each: what the pole stands for, in its supporters' terms. */
  means: [string, string];
}

/** A statement and the pole that agreeing with it moves toward: −1 left, +1 right. */
export interface Item { id: string; axis: AxisId; key: -1 | 1; text: string }

export const AXES: Axis[] = [
  { id: "economy", name: "Economic system", question: "Who should own and steer the economy?", poles: ["Collective", "Market"], means: ["The state and workers steer key sectors, prices and investment.", "Private ownership and competition allocate resources best."] },
  { id: "welfare", name: "Welfare and tax", question: "How much should the state share out?", poles: ["Redistribution", "Self-reliance"], means: ["Taxes on the well-off fund universal services and a floor for all.", "Low taxes, targeted help, and family and community first."] },
  { id: "trade", name: "Trade and globalisation", question: "How open should the economy be to the world?", poles: ["Open", "Protected"], means: ["Free trade and investment raise prosperity.", "Domestic industry and self-sufficiency come first."] },
  { id: "environment", name: "Environment", question: "What gives way when nature and growth collide?", poles: ["Ecological", "Growth-first"], means: ["Limits on emissions and land use, even at a cost.", "Jobs, energy and development come before climate targets."] },
  { id: "liberty", name: "Civil liberties", question: "How much power should the state have over individuals?", poles: ["Liberty", "Order"], means: ["Free speech, privacy and protest, with courts guarding them.", "Security powers, firm policing and limits for public order."] },
  { id: "pluralism", name: "Checks and balances", question: "Should power be dispersed or concentrated?", poles: ["Pluralist", "Concentrated"], means: ["Independent courts, institutions, regions and opposition.", "A strong mandate and leader, unencumbered by vetoes."] },
  { id: "populism", name: "People and elites", question: "Who should be trusted to decide?", poles: ["Institutional", "Populist"], means: ["Expertise, established institutions and compromise.", "Ordinary people's will against a self-serving elite."] },
  { id: "social", name: "Social values", question: "How should family, gender and sexuality be governed?", poles: ["Progressive", "Traditional"], means: ["Equal rights and personal choice in family and sexuality.", "The traditional family, custom and public morals."] },
  { id: "religion", name: "Religion and state", question: "What place should religion have in public life?", poles: ["Secular", "Religious"], means: ["A state neutral between faiths and non-belief.", "Faith, and the majority's faith, shaping law and public life."] },
  { id: "nation", name: "Nation and belonging", question: "Who belongs, and on what terms?", poles: ["Inclusive", "National"], means: ["Immigrants, refugees and minorities on equal terms.", "A shared heritage, less immigration, citizens first."] },
  { id: "world", name: "World order", question: "How far should the country bind itself to others?", poles: ["Multilateral", "Sovereign"], means: ["International law, institutions and binding agreements.", "National decisions free of outside authority."] },
  { id: "force", name: "Force and security", question: "When and how should the country use force?", poles: ["Restraint", "Strength"], means: ["Negotiation, arms control and force only in self-defence.", "Military power, deterrence and readiness to strike first."] },
];

const L = -1 as const, R = 1 as const;
const raw: Record<AxisId, Array<[-1 | 1, string]>> = {
  economy: [
    [L, "Key industries such as energy, railways and banking are best owned or run by the state."],
    [L, "Government should set or cap the prices of essentials such as food, fuel and medicine."],
    [L, "Workers should hold a legal share of control over the companies that employ them."],
    [L, "Government should direct where investment goes, through planning and targets."],
    [R, "Most state-owned businesses should be sold to private owners."],
    [R, "Competition between private firms delivers better goods and services than public provision."],
    [R, "Businesses should be free to set their own prices and wages."],
    [R, "Cutting rules and red tape for business should take priority over adding new ones."],
  ],
  welfare: [
    [L, "People with high incomes should pay a much larger share of them in tax."],
    [L, "Healthcare should be free to everyone, paid for from taxes."],
    [L, "Government should guarantee every adult a minimum income or a job."],
    [L, "Large inheritances should be heavily taxed."],
    [R, "Welfare benefits should go mainly to those who cannot work."],
    [R, "Lower taxes for everyone matter more than expanding public services."],
    [R, "Family and community, not the state, should be the first support in hard times."],
    [R, "Benefits should come with a requirement to work or train."],
  ],
  trade: [
    [L, "Tariffs and import barriers should come down, even if some domestic jobs are lost."],
    [L, "Foreign companies should be free to invest in and own businesses here."],
    [L, "Free-trade agreements with other countries are generally good for the economy."],
    [L, "People should be free to buy the cheapest goods, wherever they are made."],
    [R, "Domestic industries should be shielded from foreign competition by tariffs or quotas."],
    [R, "Government should favour domestic producers when it buys goods and services."],
    [R, "Foreign ownership of strategic sectors should be restricted."],
    [R, "The country should make most essential goods itself, even if they cost more."],
  ],
  environment: [
    [L, "Fossil-fuel use should be phased out on a fixed timetable."],
    [L, "Polluters should pay a tax on their carbon emissions."],
    [L, "Protecting forests, rivers and wildlife can justify stopping a development project."],
    [L, "Environmental rules should be tightened even if that raises costs for industry."],
    [R, "Economic growth and jobs should come before climate targets."],
    [R, "Environmental approvals for industry and infrastructure should be faster and simpler."],
    [R, "The country should keep using its own coal, oil or gas for as long as they are useful."],
    [R, "Climate policies should not be allowed to raise household energy prices."],
  ],
  liberty: [
    [L, "People should be free to criticise the government, even offensively, without legal penalty."],
    [L, "Police and security agencies should need a judge's warrant before monitoring anyone."],
    [L, "Adults should be free to make their own personal choices, so long as others are not harmed."],
    [L, "Peaceful protests should be allowed even when they disrupt daily life."],
    [R, "Security agencies need wide surveillance powers to keep the country safe."],
    [R, "Detaining suspects without trial is sometimes necessary."],
    [R, "Speech that threatens public order or national unity should be restricted by law."],
    [R, "Tougher punishments are the best way to reduce crime."],
  ],
  pluralism: [
    [L, "Courts should be able to strike down government decisions, even popular ones."],
    [L, "Election bodies, central banks and auditors should be independent of the government."],
    [L, "The opposition is a legitimate part of the system, not an enemy of the nation."],
    [L, "States, provinces or regions should hold powers the national government cannot override."],
    [R, "A strong leader who is not slowed down by parliament or the courts is good for the country."],
    [R, "A government with a large majority should be free to change the constitution as it sees fit."],
    [R, "Media that persistently work against the national interest should face consequences."],
    [R, "Term limits are unnecessary if voters keep re-electing the same leader."],
  ],
  populism: [
    [L, "Policy should follow experts and evidence, even when it is unpopular."],
    [L, "Society holds many legitimate interests; no one group speaks for the whole people."],
    [L, "Established institutions, flaws and all, deserve to be trusted."],
    [L, "Compromise between parties is a sign of healthy politics, not betrayal."],
    [R, "Ordinary people's common sense is a better guide than experts' advice."],
    [R, "A self-serving elite works against the interests of ordinary people."],
    [R, "Major decisions should be put directly to the people in referendums."],
    [R, "The will of the people is too often blocked by bureaucrats, judges and the media."],
  ],
  social: [
    [L, "Same-sex couples should have the same legal right to marry or form unions as other couples."],
    [L, "Women should have access to legal abortion."],
    [L, "Law should actively promote equality between women and men at work and at home."],
    [L, "Schools should teach children about sexuality and relationships."],
    [R, "The traditional family is the foundation of society, and the state should protect it."],
    [R, "Social change on gender and sexuality is moving too fast."],
    [R, "Respect for elders, custom and tradition should guide public life."],
    [R, "Censoring indecent content is justified to protect public morals."],
  ],
  religion: [
    [L, "Government should be strictly neutral between all religions and non-belief."],
    [L, "Public money should not fund religious institutions or ceremonies."],
    [L, "Family and personal law should be the same for citizens of every religion."],
    [L, "Religious leaders should stay out of party politics."],
    [R, "The majority's religion should hold a special place in national life."],
    [R, "Religious values should guide the country's laws."],
    [R, "Insulting religion should be a criminal offence."],
    [R, "Religious instruction should be part of public schooling."],
  ],
  nation: [
    [L, "Immigrants enrich the country's culture and economy."],
    [L, "Citizenship should be open on equal terms regardless of religion, ethnicity or origin."],
    [L, "Minorities should have legal protection for their language, culture and religion."],
    [L, "Refugees fleeing persecution should be given asylum."],
    [R, "Immigration should be sharply reduced."],
    [R, "Newcomers and minorities should adopt the country's main culture and language."],
    [R, "The nation is defined by a shared heritage, not only by citizenship."],
    [R, "Citizens should come before non-citizens for jobs, housing and benefits."],
  ],
  world: [
    [L, "Bodies such as the UN and WTO should have real authority, and their rulings should be respected."],
    [L, "Global problems such as pandemics and climate change need binding international agreements."],
    [L, "The country should give development aid to poorer countries."],
    [L, "International courts should be able to try the leaders of any country for grave crimes."],
    [R, "No international agreement should limit national sovereignty."],
    [R, "The country should leave international bodies that act against its interests."],
    [R, "Foreign governments and organisations should not fund political or social groups inside the country."],
    [R, "The country should act alone when allies or institutions disagree with it."],
  ],
  force: [
    [L, "Disputes with other countries should be settled by negotiation, even at the cost of concessions."],
    [L, "Military spending should be cut in favour of other priorities."],
    [L, "Force abroad should be used only in direct self-defence or with international authorisation."],
    [L, "Nuclear weapons should be reduced and eventually abolished worldwide."],
    [R, "A powerful military is the best guarantee of peace."],
    [R, "The country should be ready to strike first against a serious threat."],
    [R, "Military service or training for young people is a good thing."],
    [R, "A large domestic arms industry and arms exports serve the national interest."],
  ],
};

export const ITEMS: Item[] = AXES.flatMap((a) => raw[a.id].map(([key, text], i) => ({ id: `${a.id}-${i + 1}`, axis: a.id, key, text })));

/* ── Who is being rated ────────────────────────────────────────────────── */

export type SubjectKind = "self" | "leader" | "country";

/** The answer scale, worded for the subject. Index 0 → −2 … index 4 → +2. */
export const SCALE: Record<SubjectKind, string[]> = {
  self: ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"],
  leader: ["Record strongly against", "Record against", "Mixed record", "Record for", "Record strongly for"],
  country: ["Policy strongly against", "Policy against", "Mixed policy", "Policy for", "Policy strongly for"],
};
export const NO_RECORD: Record<SubjectKind, string> = { self: "Not sure", leader: "No record", country: "No policy" };

export const PROMPT: Record<SubjectKind, string> = {
  self: "How far do you agree?",
  leader: "Going by what they have said and done — speeches, votes, laws, decisions in office — where does their record stand on this?",
  country: "Going by the current government's laws, policies and budgets — not its rhetoric — where does it stand on this?",
};

/* ── Answers and scores ────────────────────────────────────────────────── */

/** An answer: −2…+2, or null for "no record / not sure". Missing keys are unanswered. */
export type Answers = Record<string, number | null>;
/** A source for an answer: a URL and, optionally, a few words. */
export type Evidence = Record<string, string>;

export const MIN_ANSWERS = 4;

export interface AxisScore {
  axis: AxisId;
  /** −100 … +100, or null when the axis has too few answers to score. */
  score: number | null;
  answered: number;
  /** Answered statements carrying evidence. */
  cited: number;
  /** Why it is not scored, when it is not. */
  why?: string;
}

export function scoreAxis(axis: AxisId, answers: Answers, evidence: Evidence = {}): AxisScore {
  const items = ITEMS.filter((i) => i.axis === axis);
  const done = items.filter((i) => typeof answers[i.id] === "number");
  const cited = done.filter((i) => !!evidence[i.id]?.trim()).length;
  if (done.length < MIN_ANSWERS) return { axis, score: null, answered: done.length, cited, why: `${done.length} of ${items.length} answered; ${MIN_ANSWERS} needed` };
  if (!done.some((i) => i.key === -1) || !done.some((i) => i.key === 1)) return { axis, score: null, answered: done.length, cited, why: "answers only on one side of the axis" };
  const mean = done.reduce((s, i) => s + i.key * (answers[i.id] as number), 0) / done.length;
  return { axis, score: Math.round((mean / 2) * 100), answered: done.length, cited };
}

export const scoreAll = (answers: Answers, evidence: Evidence = {}) => AXES.map((a) => scoreAxis(a.id, answers, evidence));

/** Words for a score's strength. No ideology names: only how far toward which pole. */
export function describe(axis: Axis, score: number | null): string {
  if (score === null) return "Not enough answers";
  const a = Math.abs(score);
  if (a < 15) return "Centre";
  const pole = score < 0 ? axis.poles[0] : axis.poles[1];
  return `${a < 45 ? "Leans" : a < 75 ? "Clearly" : "Strongly"} ${pole.toLowerCase()}`;
}

/** Several raters' profiles of one subject: the mean and the spread (min–max) on each axis. */
export function combine(profiles: Array<AxisScore[]>): Array<{ axis: AxisId; mean: number | null; min: number | null; max: number | null; raters: number }> {
  return AXES.map((a) => {
    const v = profiles.map((p) => p.find((s) => s.axis === a.id)?.score).filter((x): x is number => typeof x === "number");
    return { axis: a.id, mean: v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null, min: v.length ? Math.min(...v) : null, max: v.length ? Math.max(...v) : null, raters: v.length };
  });
}

/* ── Sharing a profile as text ─────────────────────────────────────────── */

export interface Profile { v: 1; kind: SubjectKind; subject: string; answers: Answers; evidence: Evidence; rater?: string; at: string }

const ANS = "01234";
/** Answers in item order, one character each: 0–4, "n" no record, "-" unanswered; evidence and names alongside. */
export function encodeProfile(p: Profile): string {
  const a = ITEMS.map((i) => { const x = p.answers[i.id]; return x === null ? "n" : typeof x === "number" ? ANS[x + 2]! : "-"; }).join("");
  const ev = Object.fromEntries(Object.entries(p.evidence).filter(([, u]) => u.trim()).map(([k, u]) => [ITEMS.findIndex((i) => i.id === k), u.trim()]));
  const json = JSON.stringify({ v: 1, k: p.kind, s: p.subject, a, e: ev, r: p.rater || undefined, t: p.at });
  return toBase64Url(json);
}

export function decodeProfile(code: string): Profile | null {
  try {
    const o = JSON.parse(fromBase64Url(code.trim().replace(/^.*[#?&]p=/, ""))) as { v: number; k: SubjectKind; s: string; a: string; e?: Record<string, string>; r?: string; t: string };
    if (o.v !== 1 || typeof o.a !== "string" || o.a.length !== ITEMS.length || !(o.k in SCALE)) return null;
    const answers: Answers = {};
    ITEMS.forEach((it, i) => { const c = o.a[i]!; if (c === "n") answers[it.id] = null; else if (ANS.includes(c)) answers[it.id] = ANS.indexOf(c) - 2; });
    const evidence: Evidence = {};
    for (const [k, u] of Object.entries(o.e ?? {})) { const it = ITEMS[Number(k)]; if (it && typeof u === "string") evidence[it.id] = u; }
    return { v: 1, kind: o.k, subject: String(o.s ?? "").slice(0, 120), answers, evidence, rater: o.r ? String(o.r).slice(0, 80) : undefined, at: String(o.t ?? "") };
  } catch { return null; }
}

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64Url(s: string): string {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** A fixed shuffle, so "mixed order" is the same for everyone and a page reload. */
export function mixedOrder(seed = 12): Item[] {
  const out = [...ITEMS];
  let x = seed;
  const rnd = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j]!, out[i]!]; }
  return out;
}
