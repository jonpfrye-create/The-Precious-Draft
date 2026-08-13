import { describe, expect, it } from "vitest";
import { chooseAutoPick, isDemoLeague } from "./auto-pick";
import type { SlotSpec } from "./roster-fit";

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

const player = (player_id: string, position: string) => ({
  player_id,
  position,
});

describe("chooseAutoPick", () => {
  it("takes the first available player when anything fits", () => {
    const pick = chooseAutoPick(
      [player("a", "RB"), player("b", "WR")],
      [],
      LEFTOVERS
    );
    expect(pick?.player_id).toBe("a");
  });

  it("skips players the team has no slot for", () => {
    // Kicker already taken, so the next kicker in the list gets skipped.
    const pick = chooseAutoPick(
      [player("k2", "K"), player("wr", "WR")],
      ["K"],
      LEFTOVERS
    );
    expect(pick?.player_id).toBe("wr");
  });

  it("takes the kicker when it's the only slot left", () => {
    // Eight slots filled; only K remains, so best-available has to be
    // overridden. This is what puts a kicker on every Leftovers roster.
    const drafted = ["QB", "RB", "RB", "WR", "WR", "TE", "RB", "DEF"];
    const pick = chooseAutoPick(
      [player("wr", "WR"), player("rb", "RB"), player("k", "K")],
      drafted,
      LEFTOVERS
    );
    expect(pick?.player_id).toBe("k");
  });

  it("returns null when nothing fits", () => {
    const full = ["QB", "RB", "RB", "WR", "WR", "TE", "RB", "DEF", "K"];
    expect(chooseAutoPick([player("x", "WR")], full, LEFTOVERS)).toBeNull();
  });

  it("returns null for an empty pool", () => {
    expect(chooseAutoPick([], [], LEFTOVERS)).toBeNull();
  });
});

describe("isDemoLeague", () => {
  it("recognises only the throwaway league", () => {
    expect(isDemoLeague("ZZZ Draw Test")).toBe(true);
  });

  it("rejects the real league", () => {
    // The guard that stops the demo tools writing picks into a real draft.
    expect(isDemoLeague("The Precious")).toBe(false);
  });

  it("is exact, not fuzzy", () => {
    expect(isDemoLeague("zzz draw test")).toBe(false);
    expect(isDemoLeague("ZZZ Draw Test 2")).toBe(false);
    expect(isDemoLeague("")).toBe(false);
  });
});
