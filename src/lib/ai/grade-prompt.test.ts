import { describe, expect, it } from "vitest";
import { buildGradePrompt, parseGradeResponse } from "./grade-prompt";
import { corpusKey, examplesFor, gradeDistribution, hasContent } from "./corpus";
import type { CorpusEntry } from "./corpus";

function entry(team: string, grade: string, comment: string): CorpusEntry {
  return {
    key: corpusKey("The Precious", "main", team),
    league: "The Precious",
    phase: "main",
    team,
    grade,
    comment,
    roster: `Team: ${team}\nPicks, in order:\n  1. Someone (RB - ATL)`,
    exportedAt: "2026-08-14T00:00:00.000Z",
  };
}

const CORPUS = [
  entry("Alpha", "B", "Great running backs, dreadful receivers."),
  entry("Beta", "B-", "Not sure about that tight end at all."),
  entry("Gamma", "A-", "This is the draft I wanted to make."),
];

describe("examplesFor", () => {
  it("never includes the team being graded", () => {
    // The whole reveal depends on this: if Clams AI has seen his grade for
    // this team, it is reciting rather than predicting.
    const target = corpusKey("The Precious", "main", "Beta");
    const examples = examplesFor(target, CORPUS);

    expect(examples.map((e) => e.team)).toEqual(["Alpha", "Gamma"]);
    expect(examples.some((e) => e.key === target)).toBe(false);
  });

  it("keeps the same team name from a different league or phase", () => {
    // Last year's grade for this team is legitimate material; only
    // tonight's grade for tonight's roster has to be hidden.
    const corpus = [
      entry("Beta", "B-", "This year."),
      {
        ...entry("Beta", "D", "Last year."),
        key: corpusKey("The Precious 2025", "main", "Beta"),
        league: "The Precious 2025",
      },
    ];
    const examples = examplesFor(corpusKey("The Precious", "main", "Beta"), corpus);

    expect(examples).toHaveLength(1);
    expect(examples[0].comment).toBe("Last year.");
  });
});

describe("buildGradePrompt", () => {
  it("excludes the target's own grade from the prompt text", () => {
    const prompt = buildGradePrompt({
      targetRoster: "Team: Beta",
      targetKey: corpusKey("The Precious", "main", "Beta"),
      corpus: CORPUS,
    });

    expect(prompt.user).not.toContain("Not sure about that tight end");
    expect(prompt.user).toContain("Great running backs");
    expect(prompt.exampleCount).toBe(2);
  });

  it("states the grade distribution so it doesn't inflate", () => {
    const prompt = buildGradePrompt({
      targetRoster: "Team: Delta",
      targetKey: corpusKey("The Precious", "main", "Delta"),
      corpus: CORPUS,
    });

    expect(prompt.system).toContain("B: 1");
    expect(prompt.system).toContain("Match this spread");
  });

  it("does not describe the commissioner's voice in its own words", () => {
    // Voice must come from examples. Any adjective here would be a guess
    // at a real person, which the model would then perform instead of him.
    const prompt = buildGradePrompt({
      targetRoster: "Team: Delta",
      targetKey: "x",
      corpus: CORPUS,
    });

    for (const word of ["wry", "sarcastic", "witty", "dry humour", "snarky"]) {
      expect(prompt.system.toLowerCase()).not.toContain(word);
    }
  });

  it("says so plainly when there are no examples", () => {
    const prompt = buildGradePrompt({
      targetRoster: "Team: Delta",
      targetKey: "x",
      corpus: [],
    });

    expect(prompt.exampleCount).toBe(0);
    expect(prompt.user).toContain("no examples");
    expect(prompt.user).toContain("do not adopt a persona");
  });

  it("targets the length of the real comments", () => {
    const prompt = buildGradePrompt({
      targetRoster: "Team: Delta",
      targetKey: "x",
      corpus: CORPUS,
    });

    // Examples run 5-7 words, so it should be asking for something short.
    const match = prompt.system.match(/roughly (\d+) words/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeLessThan(15);
  });
});

describe("stated views", () => {
  const VIEWS = {
    philosophy: "# How I think\n\nI want two running backs early. Kickers are a joke.",
    players: "# Guys\n\n## Don't like\n\nSomeone Awful - I don't trust him.",
  };

  it("puts his views in the prompt and tells it to side with him over ADP", () => {
    const prompt = buildGradePrompt({
      targetRoster: "Team: Delta",
      targetKey: "x",
      corpus: CORPUS,
      context: VIEWS,
    });

    expect(prompt.system).toContain("two running backs early");
    expect(prompt.system).toContain("Someone Awful");
    expect(prompt.system).toContain("side with him");
  });

  it("forbids inferring an opinion about a player he never mentioned", () => {
    const prompt = buildGradePrompt({
      targetRoster: "Team: Delta",
      targetKey: "x",
      corpus: CORPUS,
      context: VIEWS,
    });

    expect(prompt.system).toContain("only for the players actually named");
  });

  it("treats an untouched template as empty", () => {
    // Verbatim from voice/philosophy.md. The guidance above the rule is
    // addressed to the human, and it is real prose, not comments - an
    // earlier version counted it as 53 words of his opinions and would
    // have had the model grading teams against "say things the way you'd
    // say them out loud".
    const template = {
      philosophy: `# How I think about a draft

Free text. Written by the commissioner, read by Clams AI as his stated
views. Anything here is treated as his opinion and is allowed to drive a
grade.

---

<!-- Roster construction: what a good team looks like to you. -->
`,
      players: `# Guys I like, guys I don't

Free text. Read by Clams AI as the commissioner's own opinions.

---

## Like

<!-- e.g. Player Name - why. -->
`,
    };
    const prompt = buildGradePrompt({
      targetRoster: "Team: Delta",
      targetKey: "x",
      corpus: CORPUS,
      context: template,
    });

    expect(prompt.system).not.toContain("HIS VIEWS");
    expect(prompt.system).not.toContain("Free text");
    expect(prompt.system).not.toContain("say them out loud");
  });

  it("keeps only what's below the rule when he has written something", () => {
    const written = {
      philosophy:
        "# How I think\n\nGuidance for the human that must not leak.\n\n---\n\nI take two running backs early. Always.",
      players: "",
    };
    const prompt = buildGradePrompt({
      targetRoster: "T",
      targetKey: "x",
      corpus: CORPUS,
      context: written,
    });

    expect(prompt.system).toContain("two running backs early");
    expect(prompt.system).not.toContain("must not leak");
  });

  it("works with no context at all", () => {
    const prompt = buildGradePrompt({
      targetRoster: "Team: Delta",
      targetKey: "x",
      corpus: CORPUS,
    });

    expect(prompt.system).not.toContain("HIS VIEWS");
    expect(prompt.system).toContain("must come from the roster you are given.");
  });

  it("widens the sourcing rule only once views exist", () => {
    const without = buildGradePrompt({
      targetRoster: "T",
      targetKey: "x",
      corpus: CORPUS,
    });
    const with_ = buildGradePrompt({
      targetRoster: "T",
      targetKey: "x",
      corpus: CORPUS,
      context: VIEWS,
    });

    expect(without.system).not.toContain("or from his stated views");
    expect(with_.system).toContain("or from his stated views");
  });
});

describe("hasContent", () => {
  it("sees through headings, rules and comments", () => {
    expect(hasContent("# Title\n\n---\n\n<!-- a note -->\n")).toBe(false);
    expect(hasContent("# Title\n\nI like running backs.")).toBe(true);
    expect(hasContent("")).toBe(false);
  });
});

describe("gradeDistribution", () => {
  it("counts grades commonest first", () => {
    const corpus = [
      entry("A", "B", "x"),
      entry("B", "B", "x"),
      entry("C", "A-", "x"),
    ];
    expect(gradeDistribution(corpus)).toEqual([
      { grade: "B", count: 2 },
      { grade: "A-", count: 1 },
    ]);
  });
});

describe("parseGradeResponse", () => {
  it("reads a well-formed reply", () => {
    const parsed = parseGradeResponse("GRADE: B-\nCOMMENT: Rough at receiver.");
    expect(parsed).toEqual({ grade: "B-", comment: "Rough at receiver." });
  });

  it("survives a preamble and markdown fences", () => {
    const parsed = parseGradeResponse(
      "Sure, here you go:\n\n```\nGRADE: A\nCOMMENT: Loved it.\n```"
    );
    expect(parsed?.grade).toBe("A");
    expect(parsed?.comment).toBe("Loved it.");
  });

  it("keeps a multi-line comment whole", () => {
    const parsed = parseGradeResponse(
      "GRADE: C+\nCOMMENT: One thought.\n\nAnd another."
    );
    expect(parsed?.comment).toBe("One thought.\n\nAnd another.");
  });

  it("rejects a grade that isn't on the scale", () => {
    // Storing a fallback here would put a grade the model never chose in
    // front of the league.
    expect(parseGradeResponse("GRADE: E\nCOMMENT: Nope.")).toBeNull();
  });

  it("rejects a reply with no comment", () => {
    expect(parseGradeResponse("GRADE: B\nCOMMENT:   ")).toBeNull();
  });

  it("rejects an unparseable reply rather than guessing", () => {
    expect(parseGradeResponse("I think they did pretty well overall!")).toBeNull();
  });

  it("normalises a lowercase grade", () => {
    expect(parseGradeResponse("grade: b+\ncomment: Fine.")?.grade).toBe("B+");
  });
});
