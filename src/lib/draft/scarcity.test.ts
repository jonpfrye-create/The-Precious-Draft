import { describe, expect, it } from "vitest";
import { scarcityWarnings } from "./scarcity";
import type { SlotSpec } from "./roster-fit";

// The Leftovers roster: every slot binding, one QB and one K per team.
const LEFTOVERS: SlotSpec[] = [
  { slotName: "QB", eligiblePositions: ["QB"] },
  { slotName: "RB1", eligiblePositions: ["RB"] },
  { slotName: "RB2", eligiblePositions: ["RB"] },
  { slotName: "WR1", eligiblePositions: ["WR"] },
  { slotName: "WR2", eligiblePositions: ["WR"] },
  { slotName: "TE", eligiblePositions: ["TE"] },
  { slotName: "FLEX", eligiblePositions: ["RB", "WR", "TE"] },
  { slotName: "DEF", eligiblePositions: ["DEF"] },
  { slotName: "K", eligiblePositions: ["K"] },
];

const PLENTY = { QB: 60, RB: 200, WR: 300, TE: 90, K: 40, DEF: 20 };

describe("scarcityWarnings", () => {
  it("says nothing when the pool is deep enough", () => {
    expect(scarcityWarnings(LEFTOVERS, 9, PLENTY)).toEqual([]);
  });

  it("catches the quarterback shortage that started this", () => {
    // Nine teams staying, only six quarterbacks left after Main.
    const warnings = scarcityWarnings(LEFTOVERS, 9, { ...PLENTY, QB: 6 });
    expect(warnings).toEqual([{ position: "QB", needed: 9, available: 6 }]);
  });

  it("is quiet when supply exactly meets demand", () => {
    expect(scarcityWarnings(LEFTOVERS, 9, { ...PLENTY, QB: 9 })).toEqual([]);
  });

  it("warns one short", () => {
    const warnings = scarcityWarnings(LEFTOVERS, 9, { ...PLENTY, QB: 8 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].available).toBe(8);
  });

  it("counts two slots of the same position as two per team", () => {
    // RB1 and RB2 means eighteen running backs for nine teams.
    const warnings = scarcityWarnings(LEFTOVERS, 9, { ...PLENTY, RB: 17 });
    expect(warnings).toEqual([{ position: "RB", needed: 18, available: 17 }]);
  });

  it("ignores flex slots, which can always take something", () => {
    // Nothing here can be individually short: FLEX accepts three positions.
    const flexOnly: SlotSpec[] = [
      { slotName: "W/R/T", eligiblePositions: ["RB", "WR", "TE"] },
      { slotName: "BENCH", eligiblePositions: ["RB", "WR", "TE"] },
    ];
    expect(scarcityWarnings(flexOnly, 12, { RB: 0, WR: 0, TE: 1 })).toEqual([]);
  });

  it("reports several shortages worst-first", () => {
    const warnings = scarcityWarnings(LEFTOVERS, 10, {
      ...PLENTY,
      QB: 8, // two short
      K: 4, // six short
    });
    expect(warnings.map((w) => w.position)).toEqual(["K", "QB"]);
  });

  it("treats a position missing from the pool entirely as zero", () => {
    const warnings = scarcityWarnings(LEFTOVERS, 4, { RB: 99, WR: 99, TE: 99 });
    expect(warnings.map((w) => w.position).sort()).toEqual(["DEF", "K", "QB"]);
  });

  it("says nothing when no teams are selected yet", () => {
    expect(scarcityWarnings(LEFTOVERS, 0, { QB: 0 })).toEqual([]);
  });

  it("scales with the number of teams staying", () => {
    const pool = { ...PLENTY, QB: 8 };
    // Eight teams is fine; nine is one short.
    expect(scarcityWarnings(LEFTOVERS, 8, pool)).toEqual([]);
    expect(scarcityWarnings(LEFTOVERS, 9, pool)).toHaveLength(1);
  });
});
