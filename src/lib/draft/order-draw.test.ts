import { describe, expect, it } from "vitest";
import {
  assignDraftPositions,
  evaluateDrawRequest,
  isPositionRevealed,
  nextRevealStep,
  shuffle,
} from "./order-draw";

const TEAMS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"];

describe("evaluateDrawRequest", () => {
  it("allows the first draw with no confirmation", () => {
    expect(evaluateDrawRequest({ picksMade: 0, drawCount: 0 })).toEqual({
      allowed: true,
      requiresConfirmation: false,
    });
  });

  it("requires confirmation for every redraw", () => {
    for (const drawCount of [1, 2, 7]) {
      expect(evaluateDrawRequest({ picksMade: 0, drawCount })).toEqual({
        allowed: true,
        requiresConfirmation: true,
      });
    }
  });

  it("refuses once a single pick has been made, even on the first draw", () => {
    const decision = evaluateDrawRequest({ picksMade: 1, drawCount: 0 });
    expect(decision.allowed).toBe(false);
  });

  it("refuses after picks regardless of how many draws happened", () => {
    // There is deliberately no confirmation phrase that unlocks this - a
    // redraw mid-draft would orphan picks already made.
    for (const drawCount of [0, 1, 5]) {
      expect(
        evaluateDrawRequest({ picksMade: 24, drawCount }).allowed
      ).toBe(false);
    }
  });
});

describe("shuffle", () => {
  it("returns a permutation of the input", () => {
    const result = shuffle(TEAMS);
    expect([...result].sort()).toEqual([...TEAMS].sort());
  });

  it("does not mutate the input", () => {
    const original = [...TEAMS];
    shuffle(TEAMS);
    expect(TEAMS).toEqual(original);
  });

  it("handles empty and single-item lists", () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle(["only"])).toEqual(["only"]);
  });

  it("is deterministic given a fixed randomness source", () => {
    // With j pinned to 0, each pass swaps the current tail element with the
    // head, walking the original head rightwards: [a,b,c,d] -> [b,c,d,a].
    // Any change to the swap logic moves this result.
    const alwaysZero = () => 0;
    expect(shuffle(["a", "b", "c", "d"], alwaysZero)).toEqual([
      "b",
      "c",
      "d",
      "a",
    ]);
  });

  it("uses the full range including the current index", () => {
    // randomIntFn is called with i+1, so j can equal i (element stays put).
    // Calling it with i instead is the classic off-by-one that biases the
    // shuffle; this pins the exact arguments.
    const calls: number[] = [];
    shuffle(["a", "b", "c", "d"], (max) => {
      calls.push(max);
      return 0;
    });
    expect(calls).toEqual([4, 3, 2]);
  });

  it("never drops or duplicates a team across many runs", () => {
    for (let i = 0; i < 300; i++) {
      const result = shuffle(TEAMS);
      expect(result).toHaveLength(TEAMS.length);
      expect(new Set(result).size).toBe(TEAMS.length);
    }
  });

  it("puts every team in every position given enough draws", () => {
    // A shuffle with an off-by-one (the classic `i` vs `i + 1` bug) leaves
    // some team unable to reach some position. 2000 draws over 12 teams
    // makes that impossible to miss.
    const seen = new Map<string, Set<number>>(
      TEAMS.map((t) => [t, new Set<number>()])
    );
    for (let i = 0; i < 2000; i++) {
      shuffle(TEAMS).forEach((team, index) => seen.get(team)!.add(index));
    }
    for (const team of TEAMS) {
      expect(seen.get(team)!.size).toBe(TEAMS.length);
    }
  });

  it("does not leave the first team in place suspiciously often", () => {
    // Guards against a shuffle that never touches index 0. Expected rate is
    // 1/12 (~167 of 2000); anything near 0 or near 2000 is a bug.
    let firstUnchanged = 0;
    for (let i = 0; i < 2000; i++) {
      if (shuffle(TEAMS)[0] === TEAMS[0]) firstUnchanged++;
    }
    expect(firstUnchanged).toBeGreaterThan(60);
    expect(firstUnchanged).toBeLessThan(400);
  });
});

describe("nextRevealStep", () => {
  it("starts at the last pick and walks upwards", () => {
    expect(nextRevealStep(12, 0)).toEqual({
      positions: [12],
      revealedAfter: 1,
      isFinale: false,
      setsUpFinale: false,
    });
    expect(nextRevealStep(12, 1)).toEqual({
      positions: [11],
      revealedAfter: 2,
      isFinale: false,
      setsUpFinale: false,
    });
  });

  it("flags the click that leaves only pick 1 outstanding", () => {
    // Revealing pick 2 means the room can already name pick 1 by
    // elimination - the UI holds here rather than rolling on.
    expect(nextRevealStep(12, 10)).toEqual({
      positions: [2],
      revealedAfter: 11,
      isFinale: false,
      setsUpFinale: true,
    });
  });

  it("makes pick 1 its own click, and the finale", () => {
    expect(nextRevealStep(12, 11)).toEqual({
      positions: [1],
      revealedAfter: 12,
      isFinale: true,
      setsUpFinale: false,
    });
  });

  it("returns null once everything is revealed", () => {
    expect(nextRevealStep(12, 12)).toBeNull();
    expect(nextRevealStep(12, 13)).toBeNull();
  });

  it("takes exactly one click per team", () => {
    for (const total of [2, 3, 8, 12, 14]) {
      let revealed = 0;
      let clicks = 0;
      let step = nextRevealStep(total, revealed);
      while (step) {
        revealed = step.revealedAfter;
        clicks++;
        step = nextRevealStep(total, revealed);
      }
      expect(revealed).toBe(total);
      expect(clicks).toBe(total);
    }
  });

  it("covers every position exactly once, ending on pick 1", () => {
    const total = 12;
    let revealed = 0;
    const seen: number[] = [];
    let step = nextRevealStep(total, revealed);
    while (step) {
      seen.push(...step.positions);
      revealed = step.revealedAfter;
      step = nextRevealStep(total, revealed);
    }
    expect(seen[seen.length - 1]).toBe(1);
    expect([...seen].sort((a, b) => a - b)).toEqual(
      Array.from({ length: total }, (_, i) => i + 1)
    );
  });

  it("fires exactly one finale per run", () => {
    for (const total of [2, 5, 12]) {
      let revealed = 0;
      let finales = 0;
      let setups = 0;
      let step = nextRevealStep(total, revealed);
      while (step) {
        if (step.isFinale) finales++;
        if (step.setsUpFinale) setups++;
        revealed = step.revealedAfter;
        step = nextRevealStep(total, revealed);
      }
      expect(finales).toBe(1);
      expect(setups).toBe(1);
    }
  });

  it("handles a one-team phase as an immediate finale", () => {
    expect(nextRevealStep(1, 0)).toEqual({
      positions: [1],
      revealedAfter: 1,
      isFinale: true,
      setsUpFinale: false,
    });
    expect(nextRevealStep(1, 1)).toBeNull();
  });
});

describe("isPositionRevealed", () => {
  it("reveals from the bottom up", () => {
    expect(isPositionRevealed(12, 0, 12)).toBe(false);
    expect(isPositionRevealed(12, 1, 12)).toBe(true);
    expect(isPositionRevealed(12, 1, 11)).toBe(false);
    expect(isPositionRevealed(12, 3, 10)).toBe(true);
    expect(isPositionRevealed(12, 3, 9)).toBe(false);
  });

  it("shows everything once fully revealed", () => {
    for (let p = 1; p <= 12; p++) {
      expect(isPositionRevealed(12, 12, p)).toBe(true);
    }
  });

  it("shows nothing before the first click", () => {
    for (let p = 1; p <= 12; p++) {
      expect(isPositionRevealed(12, 0, p)).toBe(false);
    }
  });
});

describe("assignDraftPositions", () => {
  it("numbers teams from 1 in the order given", () => {
    expect(assignDraftPositions(["x", "y", "z"])).toEqual([
      { teamId: "x", draftPosition: 1 },
      { teamId: "y", draftPosition: 2 },
      { teamId: "z", draftPosition: 3 },
    ]);
  });

  it("produces positions with no gaps or repeats for a full league", () => {
    const positions = assignDraftPositions(shuffle(TEAMS));
    const numbers = positions.map((p) => p.draftPosition).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });
});
