import { describe, expect, it } from "vitest";
import {
  canFillRoster,
  draftablePositions,
  forcedPositions,
  isPositionDraftable,
  type SlotSpec,
} from "./roster-fit";
// Relative, not "@/lib/positions": there's no vitest config, so the alias
// Next resolves isn't available here.
import { POSITIONS } from "../positions";

const FLEX = ["RB", "WR", "TE"];
const ANY = ["QB", "RB", "WR", "TE", "K", "DEF"];

// Leftovers: nine slots, no bench, so every slot is binding. This is the
// shape the league's kicker rule actually lives in.
const LEFTOVERS: SlotSpec[] = [
  { slotName: "QB", eligiblePositions: ["QB"] },
  { slotName: "RB1", eligiblePositions: ["RB"] },
  { slotName: "RB2", eligiblePositions: ["RB"] },
  { slotName: "WR1", eligiblePositions: ["WR"] },
  { slotName: "WR2", eligiblePositions: ["WR"] },
  { slotName: "TE", eligiblePositions: ["TE"] },
  { slotName: "FLEX", eligiblePositions: FLEX },
  { slotName: "DEF", eligiblePositions: ["DEF"] },
  { slotName: "K", eligiblePositions: ["K"] },
];

// Main: same starters minus the kicker, plus six bench slots that take
// anything.
const MAIN: SlotSpec[] = [
  { slotName: "QB", eligiblePositions: ["QB"] },
  { slotName: "RB1", eligiblePositions: ["RB"] },
  { slotName: "RB2", eligiblePositions: ["RB"] },
  { slotName: "WR1", eligiblePositions: ["WR"] },
  { slotName: "WR2", eligiblePositions: ["WR"] },
  { slotName: "TE", eligiblePositions: ["TE"] },
  { slotName: "FLEX", eligiblePositions: FLEX },
  { slotName: "DEF", eligiblePositions: ["DEF"] },
  ...Array.from({ length: 6 }, (_, i) => ({
    slotName: `BENCH ${i + 1}`,
    eligiblePositions: ANY,
  })),
];

// Microwave: one flex starter and one bench slot.
const MICROWAVE: SlotSpec[] = [
  { slotName: "W/R/T", eligiblePositions: FLEX },
  { slotName: "BENCH", eligiblePositions: ANY },
];

describe("canFillRoster", () => {
  it("accepts an empty roster", () => {
    expect(canFillRoster([], LEFTOVERS)).toBe(true);
  });

  it("accepts a full, exactly-fitting Leftovers roster", () => {
    expect(
      canFillRoster(
        ["QB", "RB", "RB", "WR", "WR", "TE", "RB", "DEF", "K"],
        LEFTOVERS
      )
    ).toBe(true);
  });

  it("rejects more players than slots", () => {
    expect(canFillRoster(["QB", "RB"], [LEFTOVERS[0]])).toBe(false);
  });

  it("uses FLEX to absorb an extra RB", () => {
    // Three RBs fit: RB1, RB2 and FLEX.
    expect(canFillRoster(["RB", "RB", "RB"], LEFTOVERS)).toBe(true);
  });

  it("rejects a fourth RB in Leftovers", () => {
    expect(canFillRoster(["RB", "RB", "RB", "RB"], LEFTOVERS)).toBe(false);
  });

  it("reassigns players when a naive greedy match would fail", () => {
    // A greedy pass could drop the TE into FLEX and then have nowhere for
    // the real TE. The matching has to be able to move it.
    expect(canFillRoster(["TE", "TE"], LEFTOVERS)).toBe(true);
    expect(canFillRoster(["TE", "TE", "TE"], LEFTOVERS)).toBe(false);
  });

  it("rejects a player with no position at all", () => {
    expect(canFillRoster([null], LEFTOVERS)).toBe(false);
  });
});

describe("isPositionDraftable - the kicker rules", () => {
  it("allows a kicker at any point in Leftovers, not just round 9", () => {
    expect(isPositionDraftable([], "K", LEFTOVERS)).toBe(true);
    expect(isPositionDraftable(["RB", "WR"], "K", LEFTOVERS)).toBe(true);
  });

  it("refuses a second kicker", () => {
    // The league rule: you may only have one.
    expect(isPositionDraftable(["K"], "K", LEFTOVERS)).toBe(false);
  });

  it("forces the last pick to be a kicker when none has been taken", () => {
    // Eight picks in, every slot but K is filled.
    const eight = ["QB", "RB", "RB", "WR", "WR", "TE", "RB", "DEF"];
    expect(isPositionDraftable(eight, "K", LEFTOVERS)).toBe(true);
    for (const position of ["QB", "RB", "WR", "TE", "DEF"]) {
      expect(isPositionDraftable(eight, position, LEFTOVERS)).toBe(false);
    }
  });

  it("refuses a second DEF", () => {
    expect(isPositionDraftable(["DEF"], "DEF", LEFTOVERS)).toBe(false);
  });

  it("refuses a second QB in Leftovers but allows one in Main", () => {
    // Main's bench takes anything, so a backup QB is fine there.
    expect(isPositionDraftable(["QB"], "QB", LEFTOVERS)).toBe(false);
    expect(isPositionDraftable(["QB"], "QB", MAIN)).toBe(true);
  });
});

describe("Main rosters stay permissive", () => {
  it("allows a kicker on the bench even though Main has no K slot", () => {
    expect(isPositionDraftable([], "K", MAIN)).toBe(true);
  });

  it("allows several kickers, up to the bench capacity", () => {
    expect(canFillRoster(["K", "K", "K"], MAIN)).toBe(true);
  });

  it("rejects a seventh kicker, since only six bench slots exist", () => {
    expect(canFillRoster(Array(7).fill("K"), MAIN)).toBe(false);
  });

  it("accepts a realistic full 14-man Main roster", () => {
    expect(
      canFillRoster(
        [
          "QB", "RB", "RB", "WR", "WR", "TE", "RB", "DEF",
          "QB", "RB", "WR", "WR", "TE", "K",
        ],
        MAIN
      )
    ).toBe(true);
  });
});

describe("Microwave", () => {
  it("allows any flex-eligible player first", () => {
    for (const position of ["RB", "WR", "TE"]) {
      expect(isPositionDraftable([], position, MICROWAVE)).toBe(true);
    }
  });

  it("allows a QB only into the bench slot", () => {
    expect(isPositionDraftable([], "QB", MICROWAVE)).toBe(true);
    // Once the bench is used by a QB, the starter must be flex-eligible.
    expect(isPositionDraftable(["QB"], "QB", MICROWAVE)).toBe(false);
    expect(isPositionDraftable(["QB"], "RB", MICROWAVE)).toBe(true);
  });
});

describe("draftablePositions", () => {
  it("lists everything at the start of Leftovers", () => {
    expect(draftablePositions([], LEFTOVERS, POSITIONS).sort()).toEqual(
      [...POSITIONS].sort()
    );
  });

  it("drops kicker once one is taken", () => {
    expect(draftablePositions(["K"], LEFTOVERS, POSITIONS)).not.toContain("K");
  });

  it("narrows to just the kicker on the final pick", () => {
    expect(
      draftablePositions(
        ["QB", "RB", "RB", "WR", "WR", "TE", "RB", "DEF"],
        LEFTOVERS,
        POSITIONS
      )
    ).toEqual(["K"]);
  });
});

describe("forcedPositions", () => {
  it("forces nothing early on", () => {
    expect(forcedPositions([], LEFTOVERS, POSITIONS)).toEqual([]);
  });

  it("forces the kicker on the last pick", () => {
    expect(
      forcedPositions(
        ["QB", "RB", "RB", "WR", "WR", "TE", "RB", "DEF"],
        LEFTOVERS,
        POSITIONS
      )
    ).toEqual(["K"]);
  });

  it("reports nothing once the roster is full", () => {
    expect(
      forcedPositions(
        ["QB", "RB", "RB", "WR", "WR", "TE", "RB", "DEF", "K"],
        LEFTOVERS,
        POSITIONS
      )
    ).toEqual([]);
  });

  it("narrows as slots fill without being fully forced", () => {
    // Kicker already taken, plenty of picks left: some positions are out,
    // but the team still has a real choice.
    const forced = forcedPositions(["K"], LEFTOVERS, POSITIONS);
    expect(forced).not.toContain("K");
    expect(forced.length).toBeGreaterThan(1);
  });
});
