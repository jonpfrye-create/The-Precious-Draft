import { describe, expect, it } from "vitest";
import {
  currentPick,
  generateSnakeOrder,
  pickNumbersForPosition,
} from "./snake-order";

describe("generateSnakeOrder", () => {
  it("reverses order on even rounds (4 teams, 3 rounds)", () => {
    const teams = ["A", "B", "C", "D"];
    const picks = generateSnakeOrder(teams, 3);

    expect(picks.map((p) => p.teamId)).toEqual([
      "A", "B", "C", "D", // round 1
      "D", "C", "B", "A", // round 2 (reversed)
      "A", "B", "C", "D", // round 3 (back to original)
    ]);
  });

  it("numbers overall picks sequentially across rounds", () => {
    const picks = generateSnakeOrder(["A", "B", "C"], 2);
    expect(picks.map((p) => p.overallPick)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("assigns round and pickInRound correctly", () => {
    const picks = generateSnakeOrder(["A", "B", "C"], 2);
    expect(picks[3]).toEqual({
      overallPick: 4,
      round: 2,
      pickInRound: 1,
      teamId: "C",
    });
  });

  it("handles a single team (every round is just that team)", () => {
    const picks = generateSnakeOrder(["A"], 4);
    expect(picks.map((p) => p.teamId)).toEqual(["A", "A", "A", "A"]);
  });

  it("handles arbitrary team counts, e.g. an 8-team Leftovers phase", () => {
    const teams = Array.from({ length: 8 }, (_, i) => `team-${i}`);
    const picks = generateSnakeOrder(teams, 5);
    expect(picks).toHaveLength(40);
    // round 2 must be the exact reverse of round 1
    const round1 = picks.filter((p) => p.round === 1).map((p) => p.teamId);
    const round2 = picks.filter((p) => p.round === 2).map((p) => p.teamId);
    expect(round2).toEqual([...round1].reverse());
  });

  it("does not mutate the input team order", () => {
    const teams = ["A", "B", "C"];
    generateSnakeOrder(teams, 2);
    expect(teams).toEqual(["A", "B", "C"]);
  });

  it("throws on an empty team list", () => {
    expect(() => generateSnakeOrder([], 3)).toThrow();
  });

  it("throws on zero or negative rounds", () => {
    expect(() => generateSnakeOrder(["A", "B"], 0)).toThrow();
    expect(() => generateSnakeOrder(["A", "B"], -1)).toThrow();
  });
});

describe("currentPick", () => {
  it("returns the next pick given how many have been made", () => {
    const picks = generateSnakeOrder(["A", "B"], 2);
    expect(currentPick(picks, 0)?.teamId).toBe("A");
    expect(currentPick(picks, 1)?.teamId).toBe("B");
    expect(currentPick(picks, 3)?.teamId).toBe("A");
  });

  it("returns null once every pick has been made", () => {
    const picks = generateSnakeOrder(["A", "B"], 2);
    expect(currentPick(picks, picks.length)).toBeNull();
  });
});

describe("pickNumbersForPosition", () => {
  it("gives the classic 12-team snake pattern", () => {
    // Position 7 of 12: 7th, then the turn brings it back at 18th.
    expect(pickNumbersForPosition(12, 4, 7)).toEqual([7, 18, 31, 42]);
  });

  it("pairs the ends of the order correctly", () => {
    // Pick 1 waits the longest for its second pick; pick 12 picks twice
    // back to back at the turn.
    expect(pickNumbersForPosition(12, 2, 1)).toEqual([1, 24]);
    expect(pickNumbersForPosition(12, 2, 12)).toEqual([12, 13]);
  });

  it("agrees with generateSnakeOrder for every position", () => {
    // The reveal card computes these directly instead of walking the full
    // order, so this is the guard that the two implementations never drift.
    const teams = Array.from({ length: 12 }, (_, i) => `team-${i + 1}`);
    const rounds = 14;
    const full = generateSnakeOrder(teams, rounds);

    for (let position = 1; position <= teams.length; position++) {
      const teamId = teams[position - 1];
      const fromFullOrder = full
        .filter((p) => p.teamId === teamId)
        .map((p) => p.overallPick);
      expect(pickNumbersForPosition(teams.length, rounds, position)).toEqual(
        fromFullOrder
      );
    }
  });

  it("agrees with generateSnakeOrder for odd team counts too", () => {
    const teams = ["A", "B", "C", "D", "E"];
    const full = generateSnakeOrder(teams, 7);
    for (let position = 1; position <= teams.length; position++) {
      const fromFullOrder = full
        .filter((p) => p.teamId === teams[position - 1])
        .map((p) => p.overallPick);
      expect(pickNumbersForPosition(teams.length, 7, position)).toEqual(
        fromFullOrder
      );
    }
  });

  it("returns one pick per round", () => {
    expect(pickNumbersForPosition(12, 14, 3)).toHaveLength(14);
  });

  it("returns nothing for a position outside the league", () => {
    expect(pickNumbersForPosition(12, 3, 0)).toEqual([]);
    expect(pickNumbersForPosition(12, 3, 13)).toEqual([]);
    expect(pickNumbersForPosition(0, 3, 1)).toEqual([]);
  });
});
