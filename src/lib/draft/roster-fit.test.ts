import { describe, expect, it } from "vitest";
import {
  assignRoster,
  canFillRoster,
  draftablePositions,
  forcedPositions,
  isPositionDraftable,
  unassignedPlayers,
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

describe("assignRoster", () => {
  const p = (name: string, position: string) => ({ name, position });

  it("puts running backs in RB slots, not FLEX", () => {
    // The naive version drops the first RB into whichever slot it hits
    // first. A human reading the Yahoo checklist expects RB1/RB2 filled
    // before FLEX.
    const assigned = assignRoster(
      [p("Bijan", "RB"), p("Saquon", "RB")],
      LEFTOVERS
    );
    const byName = new Map(
      assigned.filter((a) => a.player).map((a) => [a.player!.name, a.slot.slotName])
    );
    expect(byName.get("Bijan")).toMatch(/^RB[12]$/);
    expect(byName.get("Saquon")).toMatch(/^RB[12]$/);
    expect(byName.get("Bijan")).not.toBe(byName.get("Saquon"));
  });

  it("uses FLEX only once the specific slots are full", () => {
    const assigned = assignRoster(
      [p("A", "RB"), p("B", "RB"), p("C", "RB")],
      LEFTOVERS
    );
    const flex = assigned.find((a) => a.slot.slotName === "FLEX");
    expect(flex?.player).not.toBeNull();
    expect(
      assigned.filter((a) => a.slot.slotName.startsWith("RB") && a.player)
    ).toHaveLength(2);
  });

  it("returns a row for every slot, in declared order", () => {
    const assigned = assignRoster([p("A", "QB")], LEFTOVERS);
    expect(assigned).toHaveLength(LEFTOVERS.length);
    expect(assigned.map((a) => a.slot.slotName)).toEqual(
      LEFTOVERS.map((s) => s.slotName)
    );
  });

  it("leaves unfilled slots empty rather than guessing", () => {
    const assigned = assignRoster([p("A", "QB")], LEFTOVERS);
    expect(assigned.filter((a) => a.player === null)).toHaveLength(
      LEFTOVERS.length - 1
    );
  });

  it("places a complete Leftovers roster into every slot", () => {
    const roster = [
      p("qb", "QB"), p("rb1", "RB"), p("rb2", "RB"), p("wr1", "WR"),
      p("wr2", "WR"), p("te", "TE"), p("flex", "RB"), p("def", "DEF"),
      p("k", "K"),
    ];
    const assigned = assignRoster(roster, LEFTOVERS);
    expect(assigned.every((a) => a.player !== null)).toBe(true);
    expect(new Set(assigned.map((a) => a.player!.name)).size).toBe(9);
  });

  it("fills a full Main roster including the bench", () => {
    const roster = [
      p("qb", "QB"), p("rb1", "RB"), p("rb2", "RB"), p("wr1", "WR"),
      p("wr2", "WR"), p("te", "TE"), p("flex", "RB"), p("def", "DEF"),
      p("b1", "QB"), p("b2", "RB"), p("b3", "WR"), p("b4", "WR"),
      p("b5", "TE"), p("b6", "K"),
    ];
    const assigned = assignRoster(roster, MAIN);
    expect(assigned.every((a) => a.player !== null)).toBe(true);
  });

  it("puts the kicker in the K slot, not on a bench", () => {
    const assigned = assignRoster([p("kicker", "K")], MAIN.concat(
      { slotName: "K", eligiblePositions: ["K"] }
    ));
    const k = assigned.find((a) => a.slot.slotName === "K");
    expect(k?.player?.name).toBe("kicker");
  });

  it("never places the same player twice", () => {
    const roster = [p("a", "RB"), p("b", "RB"), p("c", "RB")];
    const names = assignRoster(roster, LEFTOVERS)
      .filter((a) => a.player)
      .map((a) => a.player!.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("unassignedPlayers", () => {
  const p = (name: string, position: string) => ({ name, position });

  it("is empty for a legal roster", () => {
    expect(unassignedPlayers([p("a", "K")], LEFTOVERS)).toEqual([]);
  });

  it("reports a player who fits nowhere", () => {
    // Two kickers in Leftovers: one has no slot to go in.
    const orphans = unassignedPlayers([p("k1", "K"), p("k2", "K")], LEFTOVERS);
    expect(orphans).toHaveLength(1);
  });
});

describe("assignRoster respects pick order", () => {
  const p = (name: string, position: string) => ({ name, position });

  it("starts the earliest pick when a team is deep at one position", () => {
    // Four running backs, three RB/FLEX-capable starting slots. The first
    // pick must start; benching a first-rounder while a later pick starts
    // is a valid matching and obviously wrong to a human.
    const roster = [
      p("first", "RB"), p("second", "RB"), p("third", "RB"), p("fourth", "RB"),
    ];
    const assigned = assignRoster(roster, MAIN);
    const slotFor = (name: string) =>
      assigned.find((a) => a.player?.name === name)!.slot.slotName;

    expect(slotFor("first")).not.toMatch(/^BENCH/);
    expect(slotFor("fourth")).toMatch(/^BENCH/);
  });

  it("keeps the earliest picks out of the bench generally", () => {
    const roster = [
      p("r1", "RB"), p("r2", "WR"), p("r3", "RB"), p("r4", "WR"),
      p("r5", "TE"), p("r6", "QB"), p("r7", "DEF"), p("r8", "RB"),
      p("r9", "WR"),
    ];
    const assigned = assignRoster(roster, MAIN);
    const benched = assigned
      .filter((a) => a.slot.slotName.startsWith("BENCH") && a.player)
      .map((a) => a.player!.name);
    // Only the ninth pick overflows to the bench; the first eight all fit
    // the starting slots.
    expect(benched).toEqual(["r9"]);
  });

  it("still fills every slot it can", () => {
    const roster = [
      p("a", "RB"), p("b", "RB"), p("c", "RB"), p("d", "RB"),
    ];
    const assigned = assignRoster(roster, MAIN);
    expect(assigned.filter((a) => a.player).length).toBe(4);
  });
});
