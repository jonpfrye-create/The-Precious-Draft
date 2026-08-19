import { describe, expect, it } from "vitest";
import { pickLabel, pickInRound } from "./pick-label";

describe("pickLabel", () => {
  it("counts within the round, not overall", () => {
    // The bug this replaces: pick 30 rendered as 3.30, which reads as the
    // thirtieth pick of the third round.
    expect(pickLabel(30, 3, 12)).toBe("3.06");
  });

  it("handles the first and last pick of a round", () => {
    expect(pickLabel(1, 1, 12)).toBe("1.01");
    expect(pickLabel(12, 1, 12)).toBe("1.12");
    expect(pickLabel(13, 2, 12)).toBe("2.01");
    expect(pickLabel(24, 2, 12)).toBe("2.12");
  });

  it("pads to two digits so a column of them lines up", () => {
    expect(pickLabel(2, 1, 12)).toBe("1.02");
  });

  it("works for a league that isn't twelve teams", () => {
    // Leftovers and Microwave run with whoever stayed.
    expect(pickLabel(9, 2, 8)).toBe("2.01");
    expect(pickLabel(16, 2, 8)).toBe("2.08");
    expect(pickInRound(5, 4)).toBe(1);
  });

  it("degrades rather than dividing by zero", () => {
    expect(pickInRound(7, 0)).toBe(7);
  });
});
