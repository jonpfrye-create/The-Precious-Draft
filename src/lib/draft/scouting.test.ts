import { describe, expect, it } from "vitest";
import { describeReport, scoutTeam, type ScoutedPickInput } from "./scouting";
import type { ScoutingSlot } from "./scouting";

const MAIN: ScoutingSlot[] = [
  { slotName: "QB", eligiblePositions: ["QB"] },
  { slotName: "RB1", eligiblePositions: ["RB"] },
  { slotName: "RB2", eligiblePositions: ["RB"] },
  { slotName: "WR1", eligiblePositions: ["WR"] },
  { slotName: "WR2", eligiblePositions: ["WR"] },
  { slotName: "TE", eligiblePositions: ["TE"] },
  { slotName: "FLEX", eligiblePositions: ["RB", "WR", "TE"] },
  { slotName: "BENCH1", eligiblePositions: ["QB", "RB", "WR", "TE"], isBench: true },
];

function pick(
  pickNumber: number,
  fullName: string,
  position: string,
  adp: number | null
): ScoutedPickInput {
  return {
    pickNumber,
    round: Math.ceil(pickNumber / 12),
    player: { fullName, position, nflTeam: "XXX", adp },
  };
}

describe("scoutTeam", () => {
  it("calls a player taken ahead of ADP a reach, and behind it value", () => {
    const report = scoutTeam(
      "Test",
      1,
      [pick(1, "Early Guy", "RB", 20), pick(13, "Late Guy", "WR", 5)],
      MAIN
    );

    expect(report.picks[0].vsAdp).toBe(19);
    expect(report.picks[1].vsAdp).toBe(-8);
    expect(report.reaches.map((p) => p.fullName)).toEqual(["Early Guy"]);
    expect(report.values.map((p) => p.fullName)).toEqual(["Late Guy"]);
  });

  it("leaves vsAdp null for players with no ADP rather than assuming zero", () => {
    // Treating a missing ADP as 0 would score every sharpie player as the
    // biggest reach of the draft.
    const report = scoutTeam("Test", 1, [pick(4, "Nobody", "K", null)], MAIN);

    expect(report.picks[0].vsAdp).toBeNull();
    expect(report.reaches).toEqual([]);
    expect(report.offTheBoard.map((p) => p.fullName)).toEqual(["Nobody"]);
    expect(report.averageVsAdp).toBeNull();
  });

  it("averages only over picks that have an ADP", () => {
    const report = scoutTeam(
      "Test",
      1,
      [pick(1, "A", "RB", 11), pick(2, "B", "WR", 4), pick(3, "C", "TE", null)],
      MAIN
    );

    // (10 + 2) / 2, with C excluded entirely.
    expect(report.averageVsAdp).toBe(6);
  });

  it("gives the first pick the starting slot, not the bench", () => {
    // The bug this guards: a maximum matching is free to bench a
    // first-rounder and start a late pick at the same position.
    const report = scoutTeam(
      "Test",
      1,
      [
        pick(1, "Stud", "RB", 1),
        pick(50, "Scrub", "RB", 50),
        pick(60, "Third", "RB", 60),
        pick(70, "Fourth", "RB", 70),
      ],
      MAIN
    );

    expect(report.picks[0].slot).toBe("RB1");
    expect(report.picks[0].isStarter).toBe(true);
    // Third fills FLEX, which RBs are eligible for; only the fourth is
    // left over for the bench - and it is the latest pick, not the first.
    expect(report.picks[2].slot).toBe("FLEX");
    expect(report.picks[3].slot).toBe("BENCH1");
    expect(report.picks[3].isStarter).toBe(false);
  });

  it("counts the roster shape by position", () => {
    const report = scoutTeam(
      "Test",
      1,
      [pick(1, "A", "RB", 1), pick(2, "B", "RB", 2), pick(3, "C", "WR", 3)],
      MAIN
    );

    expect(report.byPosition).toEqual({ RB: 2, WR: 1 });
  });

  it("orders picks by pick number even when handed them shuffled", () => {
    const report = scoutTeam(
      "Test",
      1,
      [pick(24, "Second", "WR", 24), pick(1, "First", "RB", 1)],
      MAIN
    );

    expect(report.picks.map((p) => p.fullName)).toEqual(["First", "Second"]);
  });

  it("handles a team with no picks", () => {
    const report = scoutTeam("Empty", 3, [], MAIN);

    expect(report.picks).toEqual([]);
    expect(report.averageVsAdp).toBeNull();
    expect(report.byPosition).toEqual({});
  });
});

describe("describeReport", () => {
  it("states reaches and values as picks, not as judgements", () => {
    const text = describeReport(
      scoutTeam("Test", 2, [pick(1, "Early Guy", "RB", 20)], MAIN)
    );

    expect(text).toContain("taken 19 picks early");
    // The prompt must not editorialise - that's the grader's job.
    expect(text.toLowerCase()).not.toContain("reach");
    expect(text.toLowerCase()).not.toContain("questionable");
  });

  it("says a player has no ADP rather than printing a number", () => {
    const text = describeReport(
      scoutTeam("Test", 2, [pick(1, "Nobody", "K", null)], MAIN)
    );

    expect(text).toContain("no ADP");
    expect(text).not.toContain("ADP null");
  });
});
