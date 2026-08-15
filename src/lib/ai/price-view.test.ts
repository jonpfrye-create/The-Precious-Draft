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

describe("cache breakpoint", () => {
  const CORPUS = [
    { key: "a", league: "L", phase: "main", team: "A", grade: "F",
      comment: "Awful.", roster: "Team: A", exportedAt: "" },
    { key: "b", league: "L", phase: "main", team: "B", grade: "B",
      comment: "Fine.", roster: "Team: B", exportedAt: "" },
    { key: "c", league: "L", phase: "main", team: "C", grade: "B",
      comment: "Also fine.", roster: "Team: C", exportedAt: "" },
  ];

  it("keeps the stable half identical across different teams", () => {
    // The whole point of the split: if this varies, every call writes a
    // new cache entry and reads none, which costs more than not caching.
    const a = buildGradePrompt({ targetRoster: "T", targetKey: "a", corpus: CORPUS });
    const b = buildGradePrompt({ targetRoster: "T", targetKey: "b", corpus: CORPUS });

    expect(a.systemStable).toBe(b.systemStable);
    expect(a.systemVariable).not.toBe(b.systemVariable);
  });

  it("keeps the leave-one-out distribution out of the cached half", () => {
    // With one F in the corpus, "F: 1" alongside examples containing no F
    // tells the model the held-out grade is the F. That inference must at
    // least never be frozen into a block shared by every other team.
    const a = buildGradePrompt({ targetRoster: "T", targetKey: "a", corpus: CORPUS });

    expect(a.systemStable).not.toContain("F: 1");
    expect(a.systemVariable).toContain("B: 2");
    expect(a.system).toBe(`${a.systemStable}\n\n${a.systemVariable}`);
  });

  it("tells it to use the whole scale rather than hedge to the middle", () => {
    const a = buildGradePrompt({ targetRoster: "T", targetKey: "a", corpus: CORPUS });
    expect(a.systemVariable).toContain("Use the whole scale");
  });
});
