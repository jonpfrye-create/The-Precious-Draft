import { describe, expect, it } from "vitest";
import { currentPick, generateSnakeOrder } from "./snake-order";

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
