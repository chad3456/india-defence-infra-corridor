/**
 * Indian unmanned aircraft programmes, read from the committed file.
 *
 * Server-only. The interesting axis is the stage, not the count: "building the
 * next generation" is a claim about a pipeline, and a pipeline is described by
 * how much has left development, not by how many entries it has.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Stage = "in service" | "flying" | "in development" | "cancelled" | "unstated";

/**
 * The stages in pipeline order, with what each one means and the tone it gets.
 *
 * "unstated" is last and is deliberately hot: a programme whose own article
 * will not say what stage it is at is the weakest evidence in the file, and
 * colouring it neutrally would let it read as a mild middle case.
 */
export const STAGES: Array<{ id: Stage; label: string; means: string; tone: "hot" | "mid" | "cool" }> = [
  { id: "in service", label: "In service", tone: "cool",
    means: "The article says operational, in service, active or inducted. It does not say in what number." },
  { id: "flying", label: "Flying", tone: "mid",
    means: "Prototype, trials or flight testing. The airframe exists and has flown; nothing here says it has been ordered." },
  { id: "in development", label: "In development", tone: "mid",
    means: "Design, development, proposed or planned. No statement that anything has flown." },
  { id: "cancelled", label: "Cancelled", tone: "hot",
    means: "Cancelled, shelved or terminated. Tested first, because a cancelled programme's status line often names the stage it was cancelled from." },
  { id: "unstated", label: "Stage unstated", tone: "hot",
    means: "The infobox carries no status field. Recorded as unknown rather than assumed to be in development, which is the assumption that would flatter the pipeline." },
];

export type StageBasis = "status field" | "stated service entry" | "stated first flight" | "none";

export interface Programme {
  title: string;
  status: string | null;
  stage: Stage;
  /** Which field the stage came from, so an inference is never read as a statement. */
  stageBasis: StageBasis;
  role: string | null;
  manufacturer: string | null;
  origin: string | null;
  firstFlight: number | null;
  introduced: number | null;
  numberBuilt: string | null;
  primaryUser: string | null;
  via: string[];
}

export interface IndiaUav {
  present: boolean;
  builtAt: string;
  source: string;
  method: string;
  cannotSay: string[];
  categories: string[];
  indexNotes: string[];
  counts: {
    articlesIndexed: number;
    withInfobox: number;
    keptAsUnmanned: number;
    filteredNotUnmanned: number;
    noInfobox: number;
  };
  byStage: Record<Stage, number>;
  programmes: Programme[];
}

const EMPTY: IndiaUav = {
  present: false, builtAt: "", source: "", method: "", cannotSay: [], categories: [],
  indexNotes: [],
  counts: { articlesIndexed: 0, withInfobox: 0, keptAsUnmanned: 0, filteredNotUnmanned: 0, noInfobox: 0 },
  byStage: { "in service": 0, flying: 0, "in development": 0, cancelled: 0, unstated: 0 },
  programmes: [],
};

export function loadIndiaUav(): IndiaUav {
  try {
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), "data/global/india-uav.json"), "utf8"),
    ) as Partial<IndiaUav>;
    return { ...EMPTY, ...raw, present: (raw.programmes?.length ?? 0) > 0 };
  } catch {
    return EMPTY;
  }
}

/** Programmes at one stage, newest first flight first, then alphabetical. */
export function atStage(d: IndiaUav, stage: Stage): Programme[] {
  return d.programmes
    .filter((p) => p.stage === stage)
    .sort((a, b) => (b.firstFlight ?? 0) - (a.firstFlight ?? 0) || a.title.localeCompare(b.title));
}

/**
 * The share of the pipeline that has left development.
 *
 * In service plus flying, over everything that is not cancelled. Cancelled is
 * excluded from the denominator rather than counted as a failure, because a
 * category that accumulates dead programmes over forty years would make the
 * ratio a function of how long the category has existed.
 */
export function pastPaper(d: IndiaUav): { value: number; numerator: number; denominator: number } {
  const live = d.programmes.filter((p) => p.stage !== "cancelled");
  const flying = live.filter((p) => p.stage === "in service" || p.stage === "flying");
  return {
    value: live.length > 0 ? (flying.length / live.length) * 100 : 0,
    numerator: flying.length,
    denominator: live.length,
  };
}
