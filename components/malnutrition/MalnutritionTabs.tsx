"use client";

import { useState } from "react";
import type { MalMap } from "@/lib/malnutrition";
import type { Nfhs6Row, Nfhs6States } from "@/lib/nfhs6";
import { MalnutritionMap } from "./MalnutritionMap";
import { Nfhs6Map } from "./Nfhs6Map";

/** The two surveys on one map: the district geometry is sent once and shared. */
export function MalnutritionTabs({ data, nfhs6, stateOf, districtRows, youth }: {
  data: MalMap;
  nfhs6: Nfhs6States | null;
  stateOf: Record<string, string>;
  districtRows: Record<string, Nfhs6Row[]> | null;
  /** MoSPI's Youth in India 2022, by state, in the same shape. */
  youth: { states: Nfhs6States; stateOf: Record<string, string> } | null;
}) {
  const [tab, setTab] = useState<"nfhs6" | "nfhs5" | "youth">(nfhs6 ? "nfhs6" : "nfhs5");
  return (
    <div>
      <div className="n6-tabs" role="tablist" aria-label="Survey">
        {nfhs6 && (
          <button type="button" role="tab" aria-selected={tab === "nfhs6"} onClick={() => setTab("nfhs6")}>
            <b>NFHS-6 · 2023–24</b><span>all {nfhs6.indicators.length} indicators · {districtRows ? "districts and states" : "by state"}</span>
          </button>
        )}
        <button type="button" role="tab" aria-selected={tab === "nfhs5"} onClick={() => setTab("nfhs5")}>
          <b>NFHS-5 · 2019–21</b><span>child undernutrition · by district</span>
        </button>
        {youth && (
          <button type="button" role="tab" aria-selected={tab === "youth"} onClick={() => setTab("youth")}>
            <b>Youth in India 2022</b><span>ages 15–29 · {youth.states.indicators.length} indicators · by state</span>
          </button>
        )}
      </div>
      {tab === "nfhs6" && nfhs6
        ? <Nfhs6Map geo={data} data={nfhs6} stateOf={stateOf} districtRows={districtRows} />
        : tab === "youth" && youth
          ? <Nfhs6Map key="youth" geo={data} data={youth.states} stateOf={youth.stateOf} districtRows={null}
              rounds={{ now: "Latest", prev: "earlier round", nowName: "the latest round", prevName: "the earlier round" }}
              missing="Not in this statement of Youth in India 2022" />
          : <MalnutritionMap data={data} />}
    </div>
  );
}
