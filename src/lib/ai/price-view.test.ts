import { describe, expect, it } from "vitest";
import { buildGradePrompt } from "./grade-prompt";

describe("price objections", () => {
  it("separates the price from the player", () => {
    // Found by a live run: told he wouldn't touch Puka at 1.03 and A.J.
    // Brown in the second, the model called the roster "receivers I don't
    // trust" - while the commissioner's own grade for that team opened
    // "Great QB and WR". He objects to what a pick cost, not to the man.
    const prompt = buildGradePrompt({
      targetRoster: "Team: X",
      targetKey: "x",
      corpus: [],
      context: { philosophy: "", players: "# P\n\n---\n\nSomeone - not at that price." },
    });

    expect(prompt.system).toContain("not a player he thinks is bad");
    expect(prompt.system).toContain("criticise the price and not the man");
  });
});
